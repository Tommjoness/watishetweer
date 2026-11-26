"use strict";

/* Onderdeel van nachtzicht-pariteit-browser.test.js, op hetzelfde finale artifact. */
const assert = require("node:assert/strict");
const { PARK, GEVALLEN, verwachting, instant, lokaal, verwachteUurlabels } = require("./fixtures/nachtzicht-klokwissel.js");

const nachtRij = "#nights .row.night:not(.kop)";
const parkPad = "/nachtzicht/" + PARK.slug + "/";
const weerPad = plaats => "/?" + new URLSearchParams({
  lat: plaats.lat, lon: plaats.lon, plaats: "Testplaats", land: plaats.land, analytics: "uit"
});

async function bezoek(browser, basis, d, nu, pad, { reserve = null, doorlopendeKlok = false } = {}) {
  const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam", serviceWorkers: "block" });
  const page = await context.newPage(), fouten = [], aanvragen = { primair: 0, reserve: 0 };
  page.on("pageerror", e => fouten.push(e.message));
  if (doorlopendeKlok) await page.clock.install({ time: new Date(nu) });
  else await page.clock.setFixedTime(new Date(nu));
  await context.route("**/*", route => {
    const u = new URL(route.request().url());
    if (u.hostname === "api.open-meteo.com" && u.pathname === "/v1/forecast") {
      aanvragen.primair++;
      return reserve ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: d });
    }
    if (u.pathname === "/api/forecast") {
      aanvragen.reserve++;
      return reserve ? route.fulfill({ json: d, headers: { "x-wiw-weather-source": reserve } })
        : route.fulfill({ status: 503, json: {} });
    }
    if (u.origin !== basis || u.pathname.startsWith("/api/")) return route.fulfill({ status: 503, json: {} });
    return route.continue();
  });
  try {
    await page.goto(basis + pad);
    await page.locator(pad === parkPad ? "#nz-vannacht .nz-cijfer" : nachtRij + " .nachtoordeel").first().waitFor();
    return { context, page, aanvragen, fouten };
  } catch (e) {
    await context.close();
    throw e;
  }
}

async function leesApp(page) {
  const nacht = page.locator(nachtRij).first();
  return {
    score: await nacht.locator(".score").innerText(),
    oordeel: await nacht.locator(".nachtoordeel").innerText(),
    venster: await nacht.locator(".nachtvenster").innerText(),
    maan: await nacht.locator(".nachtmaanregel").textContent()
  };
}

async function leesPark(page) {
  const uit = page.locator("#nz-vannacht");
  return {
    score: await uit.locator(".nz-cijfer").innerText(),
    oordeel: await uit.locator(".nz-oordeel b").innerText(),
    venster: await uit.locator(".nz-oordeel span").innerText(),
    feiten: await uit.locator("dd").allTextContents(),
    uren: await uit.locator(".nz-gegevens tbody tr").evaluateAll(rijen => rijen.map(r => [...r.cells].map(c => c.textContent)))
  };
}

async function controleerKlokwissels(browser, basis, kern) {
  for (const g of GEVALLEN) {
    const nu = Date.parse(g.klok), d = verwachting(nu, g.wolken);
    const app = await bezoek(browser, basis, d, nu, weerPad(PARK));
    try {
      const park = await bezoek(browser, basis, d, nu, parkPad);
      try {
        const a = await leesApp(app.page), p = await leesPark(park.page);
        const { uren, feiten, ...parkKop } = p;
        const { maan, ...appKop } = a;
        assert.deepEqual(appKop, parkKop, g.naam + ": app en park");
        assert.match(maan, new RegExp("Maanondergang om " + g.maanOnder));
        assert(feiten.some(t => t.endsWith("onder " + g.maanOnder)));
        assert(feiten.some(t => t.endsWith("op " + g.zonOp)));
        assert.equal(a.score, Math.round(g.score) + "/10");
        if (g.venster) assert.equal(a.venster, g.venster, "normale nacht behoudt het kijkvenster");
        else assert.match(a.venster, /geen aaneengesloten gunstig kijkvenster/);
        assert.deepEqual(uren.map(u => u[0]), verwachteUurlabels(d, nu), g.naam + ": zichtbare parkuren");
        if (g.naam === "voorjaar") assert.equal(uren.find(u => u[0] === "07:00")[2], "maan niet op");
        if (g.naam === "najaar") {
          assert.equal(uren.filter(u => u[0] === "02:00").length, 2);
          assert.match(uren.find(u => u[0] === "05:00")[3], /te veel maanlicht/);
          assert.equal(uren.find(u => u[0] === "06:00")[2], "maan op");
        }
        assert.deepEqual([...app.fouten, ...park.fouten], []);
      } finally { await park.context.close(); }
    } finally { await app.context.close(); }
  }

  /* Ook met een nog geldige oude respons moet het tweede 02:00 een nieuwe
     berekening veroorzaken. De parkpagina heeft dan geen nieuw verzoek nodig. */
  const nu = Date.parse("2026-10-25T00:30:00Z"), d = verwachting(nu, 24);
  for (const pad of [parkPad, weerPad(PARK)]) {
    const tab = await bezoek(browser, basis, d, nu, pad, { doorlopendeKlok: true });
    try {
      const eerste = tab.page.locator(".nz-gegevens tbody th").first();
      if (pad === parkPad) assert.equal(await eerste.textContent(), "02:30");
      await tab.page.clock.fastForward(31 * 60000);
      if (pad === parkPad) {
        await tab.page.waitForFunction(() => document.querySelector(".nz-gegevens tbody th")?.textContent === "02:01");
        assert.equal(tab.aanvragen.primair, 1, "park berekent tweede 02:00 opnieuw op de aanwezige data");
      } else {
        await tab.page.waitForFunction(() => S.op >= Date.parse("2026-10-25T01:00:00Z"));
        const bijgewerkt = kern.nachten(d, PARK.lat, PARK.lon, PARK.tz, 1, Date.parse("2026-10-25T01:01:00Z"))[0];
        assert.equal((await leesApp(tab.page)).score, bijgewerkt.scoreTekst, "app ververst op de juiste UTC-klok");
      }
      assert.deepEqual(tab.fouten, []);
    } finally { await tab.context.close(); }
  }

  for (const [plaats, klok] of [
    [{ lat: 27.7172, lon: 85.324, land: "NP", tz: "Asia/Kathmandu" }, "2026-10-24T06:30:00Z"],
    [{ lat: -31.555, lon: 159.084, land: "AU", tz: "Australia/Lord_Howe" }, "2026-10-03T04:30:00Z"]
  ]) {
    const nuMs = Date.parse(klok), weer = verwachting(nuMs, 15, plaats);
    if (plaats.tz === "Australia/Lord_Howe") {
      // De eerste bewolkte rij volgt na de sprong van 30 minuten. Trek het
      // modeluur af op UTC, zodat het einde op 01:00 en niet op 01:30 valt.
      weer.hourly.time.forEach((tijd, i) => {
        if (tijd.startsWith("2026-10-04T") && tijd.slice(11) >= "02:00") weer.hourly.cloud_cover[i] = 80;
      });
    }
    const tab = await bezoek(browser, basis, weer, nuMs, weerPad(plaats));
    try {
      const n = kern.nachten(weer, plaats.lat, plaats.lon, plaats.tz, 1, nuMs)[0];
      assert.deepEqual(Array.from(n.uren, u => u.tijd), verwachteUurlabels(weer, nuMs), plaats.tz + ": lokale uren");
      const app = await leesApp(tab.page);
      assert.equal(app.score, n.scoreTekst, plaats.tz + ": scorepariteit");
      assert.equal(app.venster, n.zin, plaats.tz + ": vensterpariteit");
      if (plaats.tz === "Australia/Lord_Howe") assert.equal(app.venster, "Beste periode: 18:00–01:00.");
      assert.deepEqual(tab.fouten, []);
    } finally { await tab.context.close(); }
  }

  const { vcPayload, weatherApiPayload } = await import("./klokwissel-fixtures.mjs");
  const { normaliseerVisualCrossing } = await import("../lib/visualcrossing-forecast.mjs");
  const { normaliseerWeatherApi } = await import("../lib/weatherapi-forecast.mjs");
  const najaar = Date.parse("2026-10-24T12:30:00Z");
  const invoer = { timezone: PARK.tz, nuEpochS: najaar / 1000, startDatum: "2026-10-24" };
  for (const [reserve, weer] of [
    ["visual-crossing", normaliseerVisualCrossing(vcPayload(invoer))],
    ["weatherapi", normaliseerWeatherApi(weatherApiPayload(invoer))]
  ]) {
    assert.equal(weer.utc_offset_seconds, 7200);
    const ochtend = weer.daily.sunrise[1];
    assert.equal(lokaal(instant(ochtend, weer), PARK.tz), "07:15");
    for (const pad of [parkPad, weerPad(PARK)]) {
      const tab = await bezoek(browser, basis, weer, najaar, pad, { reserve });
      try {
        const n = kern.nachten(weer, PARK.lat, PARK.lon, PARK.tz, 1, najaar)[0];
        assert.equal(tab.aanvragen.reserve, 1, reserve + ": reservepad gebruikt");
        if (pad === parkPad) {
          const p = await leesPark(tab.page);
          assert(p.feiten.some(t => t.endsWith("op 07:15")), reserve + ": zonsopkomst om 07:15 CET");
          assert.deepEqual(p.uren.map(u => u[0]), verwachteUurlabels(weer, najaar));
          assert.equal(p.score, n.scoreTekst);
        } else assert.equal((await leesApp(tab.page)).score, n.scoreTekst, reserve + ": app-score");
        assert.deepEqual(tab.fouten, []);
      } finally { await tab.context.close(); }
    }
  }
  console.log("Nachtzicht-klokwissel: vijf T02-fixtures, dubbele 02:00 in open tabbladen, Kathmandu, Lord Howe en beide reserveproviders groen.");
}

module.exports = { controleerKlokwissels };

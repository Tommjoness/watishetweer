/* Rekenkern voor de Nachtzicht-pagina's (/nachtzicht/ en /maan/).

   Per nacht tonen de pagina's dezelfde score, hetzelfde oordeel en hetzelfde
   kijkvenster als het blok Nachtzicht op de plaatspagina's. Daarvoor zet
   scripts/nachtzicht-bron.js de rekenfuncties van de app vóór deze kern:
   - de stand van zon en maan uit index.html (maan, maanHoogte, opOnder);
   - WeatherNowNachtzichtProductie.senior: nachtzichtScore,
     nachtSegmentHorizon en maanEventsBinnenVenster uit senior-correctness-v2.js;
   - WeatherNowNachtzichtProductie.presentatie: oordeel, "Voorlopig" en de
     vensterzin uit mobile-screenshot-polish.js, zoals de build ze bewerkt;
   - WeatherNowFinalGlobalCorrectness (tijdsvorm, zin zonder venster) en
     WeatherNowNederlandseGrammatica (opsomming van redenen).
   Deze kern doet alleen wat in de app de browserintegratie doet: de nachten
   afbakenen, de uurrijen opbouwen en de functies in dezelfde volgorde
   aanroepen. Een browsertest vergelijkt de uitkomst nacht voor nacht met de
   echte app.

   Alle tijden van Open-Meteo zijn lokale tijden ("YYYY-MM-DDTHH:MM") in de
   tijdzone die bij de aanvraag is opgegeven. */
(function (wereld) {
  "use strict";

  const DAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  const getal = v => v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
  const twee = n => String(n).padStart(2, "0");

  const formatters = {};
  function zoneDelen(ms, tz) {
    try {
      if (!formatters[tz]) formatters[tz] = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const p = {};
      formatters[tz].formatToParts(new Date(ms)).forEach(x => { if (x.type !== "literal") p[x.type] = Number(x.value); });
      return [p.year, p.month, p.day, p.hour, p.minute, p.second].every(Number.isFinite) ? p : null;
    } catch (e) { return null; }
  }
  function zoneOffset(ms, tz) {
    const p = zoneDelen(ms, tz); if (!p) return null;
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
  }
  /* Lokale tijd naar UTC-milliseconden, zoals naarUTC() in de app. */
  function naarUTC(lokaal, tz) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(lokaal || ""));
    if (!m) return NaN;
    const doel = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    let gok = doel;
    for (let i = 0; i < 4; i++) {
      const off = zoneOffset(gok, tz); if (off === null) break;
      const nieuw = doel - off; if (Math.abs(nieuw - gok) < 1000) { gok = nieuw; break; } gok = nieuw;
    }
    return gok;
  }
  function naarLokaal(msUTC, tz) {
    const p = zoneDelen(msUTC, tz);
    return p ? twee(p.hour) + ":" + twee(p.minute) : "";
  }
  function lokaleDatum(msUTC, tz) {
    const p = zoneDelen(msUTC, tz);
    return p ? p.year + "-" + twee(p.month) + "-" + twee(p.day) : "";
  }
  /* "YYYY-MM-DDTHH:MM" van een moment in de tijdzone van de plek, zoals
     weatherNowActueleLokaleTijd() in de app. */
  function lokaleTijd(msUTC, tz) {
    const p = zoneDelen(msUTC, tz);
    return p ? p.year + "-" + twee(p.month) + "-" + twee(p.day) + "T" + twee(p.hour) + ":" + twee(p.minute) : null;
  }
  /* Open-Meteo zet alle tijden van één antwoord op één vaste afwijking, ook over
     een klokwissel heen; zichtbare tijden gaan daarom via die afwijking naar de
     echte lokale tijd, zoals weatherNowLokaleTijd() in de app. */
  function providerLokaal(t, d, tz) {
    const s = String(t == null ? "" : t), m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s), off = getal(d && d.utc_offset_seconds);
    if (!m || off === null) return s;
    return lokaleTijd(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - off * 1000, tz) || s;
  }
  /* Index van het huidige uur, zoals actueelUurIndex() in de app. */
  function actueelUurIndex(d, nuMs) {
    const tijden = d && d.hourly && Array.isArray(d.hourly.time) ? d.hourly.time : [];
    const uur = t => String(t || "").slice(0, 13);
    let i = tijden.findIndex(t => uur(t) === uur(d && d.current && d.current.time));
    const offset = d && typeof d.utc_offset_seconds === "number" && Number.isFinite(d.utc_offset_seconds) ? d.utc_offset_seconds : null;
    if (i >= 0 && offset !== null && Number.isFinite(nuMs)) {
      const klok = new Date(nuMs + offset * 1000).toISOString().slice(0, 13);
      const k = tijden.findIndex(t => uur(t) === klok);
      if (k > i && k - i <= 3) i = k;
    }
    return i < 0 ? 0 : i;
  }
  const labelDag = t => DAGEN[new Date(String(t).slice(0, 10) + "T12:00:00Z").getUTCDay()];
  const isMist = code => Number(code) === 45 || Number(code) === 48;
  const isNat = code => { code = Number(code); return code >= 51 && code <= 99; };

  /* De komende nachten voor één plek, zoals Nachtzicht in de app ze toont.
     nuMs is het huidige moment (standaard Date.now()). */
  function nachten(d, lat, lon, tz, maxNachten, nuMs) {
    const P = wereld.WeatherNowNachtzichtProductie, G = wereld.WeatherNowFinalGlobalCorrectness, T = wereld.WeatherNowNederlandseGrammatica;
    const h = d && d.hourly, c = d && d.current || {};
    if (!P || !G || !T || !h || !Array.isArray(h.time) || !Array.isArray(h.is_day)) return [];
    tz = d.timezone || tz;
    const klokMs = Number.isFinite(nuMs) ? nuMs : Date.now();
    const nuLokaal = lokaleTijd(klokMs, tz) || String(c.time || "").slice(0, 16);
    const nuUtc = naarUTC(nuLokaal, tz), i0 = actueelUurIndex(d, klokMs);
    const S = P.senior, V = P.presentatie;
    /* Tussen middernacht en zonsopkomst hoort de lopende nacht bij de zonsondergang
       van gisteren; de app rekent dan met een aangevulde dagreeks. */
    const data = V.normaliseerNachtDagdata(d, nuLokaal), day = data.daily || {};
    const actief = V.nachtIsActiefNu(d, nuLokaal);

    function maanFactor(t) {
      try {
        const ms = naarUTC(t, tz), m = maan(new Date(ms)), hg = maanHoogte(ms, lat, lon);
        return (hg <= 0 ? 0 : Math.min(1, Math.sin(hg * Math.PI / 180) / Math.sin(45 * Math.PI / 180))) * m.ill;
      } catch (e) { return 0; }
    }
    function uurRij(i) {
      const t = h.time[i], temp = getal(h.temperature_2m && h.temperature_2m[i]), dp = getal(h.dew_point_2m && h.dew_point_2m[i]);
      return { tijd: t, ms: naarUTC(t, tz), cloud: getal(h.cloud_cover && h.cloud_cover[i]), visibility: getal(h.visibility && h.visibility[i]),
        precip: getal(h.precipitation && h.precipitation[i]), code: getal(h.weather_code && h.weather_code[i]),
        humidity: getal(h.relative_humidity_2m && h.relative_humidity_2m[i]), spread: temp !== null && dp !== null ? temp - dp : null,
        gust: getal(h.wind_gusts_10m && h.wind_gusts_10m[i]), moon: maanFactor(t) };
    }
    function actueleRij() {
      const temp = getal(c.temperature_2m), rhNu = getal(c.relative_humidity_2m);
      const g = temp !== null && rhNu !== null && rhNu > 0 && rhNu <= 100 ? Math.log(rhNu / 100) + 17.625 * temp / (243.04 + temp) : null;
      const dp = g !== null ? 243.04 * g / (17.625 - g) : getal(h.dew_point_2m && h.dew_point_2m[i0]);
      return { tijd: nuLokaal, ms: naarUTC(nuLokaal, tz), cloud: getal(c.cloud_cover), visibility: getal(c.visibility), precip: getal(c.precipitation), code: getal(c.weather_code),
        humidity: rhNu, spread: temp !== null && dp !== null ? temp - dp : null, gust: getal(c.wind_gusts_10m), moon: maanFactor(nuLokaal) };
    }
    function segmenten() {
      const is = h.is_day, uit = []; let begin = null;
      for (let i = 0; i < is.length; i++) {
        if (Number(is[i]) === 0 && begin === null) begin = i;
        if (begin !== null && (Number(is[i]) === 1 || i === is.length - 1)) {
          const eind = Number(is[i]) === 1 ? i - 1 : i;
          if (eind >= begin) uit.push({ begin, eind });
          begin = null;
        }
      }
      return uit;
    }
    function nachtGrenzen(s, vanafMs) {
      let start = naarUTC(h.time[s.begin], tz), eind = naarUTC(h.time[s.eind], tz) + 3600000;
      if (!Number.isFinite(start) || !Number.isFinite(eind)) return null;
      const zonOnder = (day.sunset || []).map(t => naarUTC(t, tz)).filter(Number.isFinite).filter(ms => ms >= start - 12 * 3600000 && ms <= start + 3600000).sort((a, b) => b - a)[0];
      const zonOp = (day.sunrise || []).map(t => naarUTC(t, tz)).filter(Number.isFinite).filter(ms => ms >= eind - 2 * 3600000 && ms <= eind + 4 * 3600000).sort((a, b) => a - b)[0];
      if (Number.isFinite(zonOnder)) start = zonOnder;
      if (Number.isFinite(zonOp)) eind = zonOp;
      if (Number.isFinite(vanafMs)) start = Math.max(start, vanafMs);
      return eind > start ? { start, eind } : null;
    }
    function maanInfo(s, vanafMs) {
      const grens = nachtGrenzen(s, vanafMs); if (!grens) return null;
      const mt = opOnder("maan", grens.start - 6 * 3600000, lat, lon);
      const events = S.maanEventsBinnenVenster(mt.op, mt.onder, grens.start, grens.eind);
      const midden = (grens.start + grens.eind) / 2, mn = maan(new Date(midden));
      return { naam: mn.naam, ill: mn.ill, fase: mn.fase, momenten: events.map(e => ({ type: e.type, tijd: naarLokaal(e.ms, tz) })),
        boven: events.length ? null : maanHoogte(midden, lat, lon) > 0 };
    }
    /* De zichtbare vensterzin, met dezelfde stappen als de app na het tekenen
       van de rij (presentatielaag, finale correctheidslaag). */
    function vensterZin(venster, horizon, zichtbaar) {
      const sr = V.hhmmIso(day.sunrise && day.sunrise[horizon + 1]);
      const avondDatum = Array.isArray(day.time) ? day.time[horizon] : null, zonsondergang = Array.isArray(day.sunset) ? day.sunset[horizon] : null;
      const nachtDatum = G.nachtVensterStartDatum(venster, avondDatum, zonsondergang);
      const opties = { zonsopkomst: sr, actief: !!actief && horizon === 0, nuTijd: V.hhmmIso(nuLokaal), nuDatumTijd: nuLokaal, nachtDatum, tijdzone: tz, nuEpochMs: klokMs };
      let lokaal = V.corrigeerNachtVensterBron(venster, horizon, zichtbaar, opties);
      const geen = /^Geen (?:gunstig|goed) kijkvenster door (.+?)[.!?]*$/i.exec(String(lokaal || "").trim());
      if (geen) lokaal = G.nachtAdvies(zichtbaar, geen[1]);
      return G.nachtVensterTijdsvorm(lokaal, { horizonDagen: horizon, nuDatumTijd: opties.nuDatumTijd, nachtDatum: opties.nachtDatum, tijdzone: opties.tijdzone, nuEpochMs: opties.nuEpochMs });
    }

    const stukken = segmenten().filter(s => s.eind >= i0), uit = [];
    for (const s of stukken) {
      if (uit.length >= (maxNachten || 6)) break;
      const actueel = i0 >= s.begin && i0 <= s.eind && Number(c.is_day) === 0;
      const rijen = [];
      if (actueel) rijen.push(actueleRij());
      const vanaf = actueel ? Math.max(i0 + 1, s.begin) : s.begin;
      for (let i = vanaf; i <= s.eind; i++) { const r = uurRij(i); if (r.ms >= nuUtc) rijen.push(r); }
      if (!rijen.length) continue;
      const eerste = rijen[0], laatste = rijen[rijen.length - 1];
      const bronHorizon = S.nachtSegmentHorizon(eerste.tijd, laatste.tijd, nuLokaal, actueel);
      if (bronHorizon === null) continue;
      const a = S.nachtzichtScore(rijen), mi = maanInfo(s, actueel ? nuUtc : null), zon = nachtGrenzen(s, null);
      let venster;
      if (!a.genoeg) venster = "Geen betrouwbare zichtscore";
      else if (a.beste) {
        const bs = a.beste[0], be = a.beste[a.beste.length - 1];
        const eindIndex = h.time.indexOf(be.tijd), volgende = eindIndex >= 0 && h.time[eindIndex + 1] ? h.time[eindIndex + 1] : null;
        venster = "Beste periode " + (actueel && bs === eerste ? nuLokaal.slice(11, 16) : providerLokaal(bs.tijd, d, tz).slice(11, 16))
          + "–" + (volgende ? providerLokaal(volgende, d, tz) : providerLokaal(be.tijd, d, tz)).slice(11, 16);
      } else venster = T.geenZichtvensterZin(a.redenen).replace(/Geen goed zichtvenster/g, "Geen gunstig kijkvenster");
      /* De presentatielaag houdt de rijvolgorde als ondergrens voor de horizon. */
      const horizon = Math.max(uit.length, bronHorizon);
      const zichtbaar = a.genoeg ? Math.round(a.score) : null;
      const oordeel = V.nachtAdviesMetHorizon(zichtbaar === null ? "Onvoldoende data" : V.nachtOordeelGetoond(zichtbaar), horizon);
      const zin = vensterZin(venster, horizon, zichtbaar);
      const tijden = /(\d{2}:\d{2})[–-](\d{2}:\d{2})/.exec(zin), nuTot = /nu tot (\d{2}:\d{2})/.exec(zin);
      const goed = r => getal(r.cloud) !== null && r.cloud < 35 && getal(r.visibility) !== null && r.visibility >= 8000
        && (getal(r.precip) || 0) < 0.05 && !isMist(r.code) && !isNat(r.code) && Math.max(0, Math.min(1, getal(r.moon) || 0)) < 0.2;
      uit.push({
        index: uit.length, horizon,
        label: actueel || bronHorizon === 0 ? "vannacht" : labelDag(eerste.tijd) + " op " + labelDag(laatste.tijd),
        score: a.genoeg ? a.score : null, scoreTekst: zichtbaar === null ? "–" : zichtbaar + "/10",
        oordeel, zin,
        venster: tijden ? { van: tijden[1], tot: tijden[2], nu: false } : nuTot ? { van: "nu", tot: nuTot[1], nu: true } : null,
        redenen: a.genoeg ? a.redenen.slice() : [], reden: a.genoeg ? T.opsomming(a.redenen) : "onvoldoende data",
        bewolking: a.genoeg ? a.gemBewolking : null, zicht: a.genoeg ? a.gemZicht : null,
        maan: mi, zonOnder: zon ? naarLokaal(zon.start, tz) : null, zonOp: zon ? naarLokaal(zon.eind, tz) : null,
        uren: rijen.map(r => ({ tijd: (r === eerste && actueel ? nuLokaal : providerLokaal(r.tijd, d, tz)).slice(11, 16), bewolking: getal(r.cloud), maanOp: (getal(r.moon) || 0) > 0, goed: goed(r) }))
      });
    }
    /* Na middernacht heten de lopende nacht en de volgende nacht allebei
       "vannacht"; de app noemt de lopende nacht dan "nu" en de volgende nacht
       naar het dagpaar (herstelNachtlabels in mobile-truth-ux-20260828.js). */
    const dagen = d.daily || {};
    for (let i = 1; i < uit.length; i++) {
      if (uit[i - 1].label.toLowerCase() !== uit[i].label.toLowerCase()) continue;
      if (i === 1) uit[0].label = "nu";
      const ss = dagen.sunset && dagen.sunset[i - 1], sr = dagen.sunrise && dagen.sunrise[i];
      uit[i].label = ss && sr ? labelDag(ss) + " op " + labelDag(sr) : "volgende nacht";
    }
    return uit;
  }

  /* Momenten van de hoofdfasen volgens Meeus, Astronomical Algorithms (2e druk,
     hoofdstuk 49), zonder de kleine planeetcorrecties: nauwkeurig tot op enkele
     minuten. Het eenvoudige maanmodel van de app (gemiddelde fase) is goed voor de
     verlichting per nacht, maar kan het moment van nieuwe of volle maan ruim een
     halve dag missen; voor datums gebruikt deze pagina daarom Meeus. */
  function faseMoment(k) {
    const T = k / 1236.85, R = Math.PI / 180, s = x => Math.sin(x * R), c = x => Math.cos(x * R);
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.000000150 * T ** 3 + 0.00000000073 * T ** 4;
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    const M = 2.5534 + 29.10535670 * k - 0.0000014 * T * T - 0.00000011 * T ** 3;
    const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4;
    const F = 160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4;
    const O = 124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3;
    const q = Math.round((((k % 1) + 1) % 1) * 4) / 4;
    if (q === 0) jde += -0.40720 * s(Mp) + 0.17241 * E * s(M) + 0.01608 * s(2 * Mp) + 0.01039 * s(2 * F) + 0.00739 * E * s(Mp - M) - 0.00514 * E * s(Mp + M) + 0.00208 * E * E * s(2 * M) - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M) - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F) - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(O);
    else if (q === 0.5) jde += -0.40614 * s(Mp) + 0.17302 * E * s(M) + 0.01614 * s(2 * Mp) + 0.01043 * s(2 * F) + 0.00734 * E * s(Mp - M) - 0.00515 * E * s(Mp + M) + 0.00209 * E * E * s(2 * M) - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M) - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F) - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(O);
    else {
      jde += -0.62801 * s(Mp) + 0.17172 * E * s(M) - 0.01183 * E * s(Mp + M) + 0.00862 * s(2 * Mp) + 0.00804 * s(2 * F) + 0.00454 * E * s(Mp - M) + 0.00204 * E * E * s(2 * M) - 0.00180 * s(Mp - 2 * F) - 0.00070 * s(Mp + 2 * F) - 0.00040 * s(3 * Mp) - 0.00034 * E * s(2 * Mp - M) + 0.00032 * E * s(M + 2 * F) + 0.00032 * E * s(M - 2 * F) - 0.00028 * E * E * s(Mp + 2 * M) + 0.00027 * E * s(2 * Mp + M) - 0.00017 * s(O);
      const W = 0.00306 - 0.00038 * E * c(M) + 0.00026 * c(Mp) - 0.00002 * c(Mp - M) + 0.00002 * c(Mp + M) + 0.00002 * c(2 * F);
      jde += q === 0.25 ? W : -W;
    }
    /* JDE is Terrestrial Time; het verschil met UTC is ruim een minuut (ΔT ≈ 69 s). */
    return (jde - 2440587.5) * 86400000 - 69000;
  }
  const FASE_NAMEN = ["nieuwe maan", "eerste kwartier", "volle maan", "laatste kwartier"];
  function hoofdfasen(nuMs, aantal, tz) {
    const jd = nuMs / 86400000 + 2440587.5, k0 = Math.floor((jd - 2451550.09766) / 29.530588861) - 1;
    const uit = [];
    for (let k = k0; uit.length < (aantal || 4) && k < k0 + 16; k += 0.25) {
      const ms = faseMoment(k);
      if (ms > nuMs) uit.push({ naam: FASE_NAMEN[Math.round((((k % 1) + 1) % 1) * 4) % 4], ms, datum: lokaleDatum(ms, tz), tijd: naarLokaal(ms, tz) });
    }
    return uit;
  }

  /* Maan nu (zelfde model als de app) en de komende hoofdfasen (Meeus). */
  function maanOverzicht(nuMs, lat, lon, tz) {
    const nu = maan(new Date(nuMs));
    const datum = lokaleDatum(nuMs, tz);
    const middernacht = naarUTC(datum + "T00:00", tz);
    const vandaag = opOnder("maan", middernacht, lat, lon);
    return {
      naam: nu.naam, ill: nu.ill, fase: nu.fase, datum,
      op: vandaag.op != null ? naarLokaal(vandaag.op, tz) : null,
      onder: vandaag.onder != null ? naarLokaal(vandaag.onder, tz) : null,
      opMs: vandaag.op, onderMs: vandaag.onder,
      fasen: hoofdfasen(nuMs, 4, tz)
    };
  }

  const kern = { nachten, maanOverzicht, hoofdfasen, faseMoment, naarUTC, naarLokaal, lokaleDatum, lokaleTijd, DAGEN };
  if (typeof module === "object" && module.exports) module.exports = kern;
  wereld.WeatherNowNachtzichtKern = kern;
})(typeof globalThis !== "undefined" ? globalThis : this);

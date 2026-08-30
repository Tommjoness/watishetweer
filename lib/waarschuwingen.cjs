// Vercel serverless functie. Geeft officiele weerwaarschuwingen voor een locatie.
//
// Bronnen:
//   Verenigde Staten en gebieden -> National Weather Service, exact op coordinaat
//   Europa                        -> MeteoAlarm
//   elders                        -> geen bron, lege lijst met dekking:false
//
// MeteoAlarm heeft in 2026 een moderne EDR/GeoJSON-API, maar die vereist een
// autorisatietoken en is niet algemeen publiek beschikbaar. De publieke
// compatibiliteitsfeed kan wel CAP-gebiedsinformatie bevatten en wordt daarom
// eerst geprobeerd. Alleen als die binnen de strakke latencygrens niet bruikbaar
// is, valt de route terug op de onderhouden landbrede Atom-feed. Zo'n Atom-item
// wordt nooit als plaats-specifiek voorgesteld.

// MeteoAlarm awareness_level: 1 groen, 2 geel, 3 oranje, 4 rood.
// Niveau 1 is geen waarschuwing; als het toch in een bron verschijnt tonen we
// het terughoudend als geel in plaats van een zwaardere kleur te verzinnen.
const NIVEAU = { 1: "geel", 2: "geel", 3: "oranje", 4: "rood",
  Minor: "geel", Moderate: "geel", Severe: "oranje", Extreme: "rood" };

/* ---------- gebied afbakenen ---------- */

function inPolygoon(lat, lon, punten) {
  let binnen = false;
  for (let i = 0, j = punten.length - 1; i < punten.length; j = i++) {
    const [ai, oi] = punten[i], [aj, oj] = punten[j];
    if ((oi > lon) !== (oj > lon) &&
        lat < (aj - ai) * (lon - oi) / (oj - oi) + ai) binnen = !binnen;
  }
  return binnen;
}

function leesPolygoon(p) {
  const punten = String(p).trim().split(/\s+/).map(par => {
    const [a, o] = par.split(",").map(Number);
    return (isFinite(a) && isFinite(o)) ? [a, o] : null;
  }).filter(Boolean);
  return punten.length >= 3 ? punten : null;
}

function inCirkel(lat, lon, c) {
  const m = String(c).trim().split(/\s+/);
  const [a, o] = (m[0] || "").split(",").map(Number);
  const r = Number(m[1]);
  if (!isFinite(a) || !isFinite(o) || !isFinite(r)) return null;
  const R = 6371, rad = Math.PI / 180;
  const dA = (lat - a) * rad, dO = (lon - o) * rad;
  const h = Math.sin(dA / 2) ** 2 + Math.cos(a * rad) * Math.cos(lat * rad) * Math.sin(dO / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))) <= r;
}

/**
 * Bepaalt of een CAP-info het punt raakt.
 * @returns true binnen, false erbuiten, null als er geen bruikbaar gebied in staat
 */
function raaktPunt(info, lat, lon) {
  const gebieden = Array.isArray(info.area) ? info.area : (info.area ? [info.area] : []);
  let gezien = false;
  for (const g of gebieden) {
    if (!g) continue;
    const polys = [].concat(g.polygon || []);
    for (const p of polys) {
      const pts = leesPolygoon(p);
      if (!pts) continue;
      gezien = true;
      if (inPolygoon(lat, lon, pts)) return true;
    }
    const cirkels = [].concat(g.circle || []);
    for (const c of cirkels) {
      const r = inCirkel(lat, lon, c);
      if (r === null) continue;
      gezien = true;
      if (r) return true;
    }
  }
  return gezien ? false : null;
}

const METEOALARM = {
  AD:"andorra", AT:"austria", BE:"belgium", BA:"bosnia-herzegovina", BG:"bulgaria", HR:"croatia",
  CY:"cyprus", CZ:"czechia", DK:"denmark", EE:"estonia", FI:"finland", FR:"france",
  DE:"germany", GR:"greece", HU:"hungary", IS:"iceland", IE:"ireland", IL:"israel",
  IT:"italy", LV:"latvia", LT:"lithuania", LU:"luxembourg", MT:"malta", MD:"moldova",
  ME:"montenegro", NL:"netherlands", MK:"republic-of-north-macedonia", NO:"norway", PL:"poland",
  PT:"portugal", RO:"romania", RS:"serbia", SK:"slovakia", SI:"slovenia", ES:"spain",
  SE:"sweden", CH:"switzerland", UA:"ukraine", GB:"united-kingdom"
};

/*
 * Rechthoeken als snelle kandidaatfilter voor punten waarvoor api.weather.gov
 * waarschuwingen kan leveren. Ze zijn bewust ruim en vormen GEEN landsgrens:
 * de CONUS-box bevat bijvoorbeeld ook delen van Canada en Mexico. Daarom mag
 * deze geometrie nooit zelfstandig NWS-dekking bewijzen; de landcode wordt in
 * de handler apart bevestigd voordat er een NWS-request wordt gedaan.
 *
 * Een lengtegraadpaar met west <= oost is een normaal interval. Als west > oost
 * kruist het interval de internationale datumgrens en geldt dus lon >= west OF
 * lon <= oost. Daarmee kunnen geografische gebieden rond ±180° expliciet en
 * zonder wereldwijde overdekking worden gemodelleerd.
 */
const NWS_GEBIED = [
  [24.0, 49.5, -125.0, -66.5],
  [51.0, 72.0, -170.0, -129.0],
  [51.0, 54.5, 170.0, -170.0], // westelijke Aleoeten: datumgrens-overstekend
  [18.5, 22.5, -160.5, -154.5],
  [17.5, 18.6, -67.5, -64.5],
  [13.2, 15.4, 144.6, 146.1],
  [-14.6, -10.5, -171.5, -167.0]  // American Samoa
];
const NWS_LANDCODES = new Set(["US","PR","VI","GU","MP","AS"]);
function inLengtegraadBereik(lon, west, oost) {
  return west <= oost ? lon >= west && lon <= oost : lon >= west || lon <= oost;
}
const inNWS = (lat, lon) =>
  NWS_GEBIED.some(([z, n, w, o]) => lat >= z && lat <= n && inLengtegraadBereik(lon, w, o));
const isNWSLandCode = code => NWS_LANDCODES.has(String(code || "").toUpperCase());

const UA = "WatIsHetWeer/1.0 (watishetweer.nl; contact via github.com/Tommjoness/weathernow)";
const METEO_COMPAT_TIMEOUT_MS = 4000;
const METEO_ATOM_TIMEOUT_MS = 3200;
const METEO_HEDGE_HEADER_MS = 1500;
const METEO_HEDGE_BYTES = 2000000;

async function haal(url, accept, timeoutMs = 6000) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": accept },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!r.ok) throw new Error("status " + r.status);
  return r;
}

/* ---------- land bepalen ---------- */

async function landCode(lat, lon) {
  try {
    // Alleen dit providerafhankelijke pad laadt de gedeelde Nominatim-config.
    // De gebiedsfilterfuncties erboven blijven bewust puur en los uitvoerbaar.
    const { reverseUrl } = require("./nominatim.cjs");
    const r = await haal(reverseUrl(lat, lon, {zoom:3, language:"en"}), "application/json");
    const g = await r.json(), a = g && g.address || {};
    return a.country_code ? String(a.country_code).toUpperCase() : null;
  } catch (e) { return null; }
}

/* ---------- National Weather Service ---------- */

function waarschuwingTekst(waarde, max = 700) {
  const s = String(waarde || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const stuk = s.slice(0, max + 1);
  const grenzen = [stuk.lastIndexOf(". "), stuk.lastIndexOf("! "), stuk.lastIndexOf("? ")];
  const zin = Math.max(...grenzen);
  if (zin >= Math.min(240, Math.floor(max * 0.55))) return stuk.slice(0, zin + 1).trim();
  const woord = stuk.slice(0, max).replace(/\s+\S*$/, "").trim();
  return (woord || stuk.slice(0, max).trim()) + "…";
}

async function viaNWS(lat, lon) {
  const p = lat.toFixed(4) + "," + lon.toFixed(4);
  const r = await haal("https://api.weather.gov/alerts/active?point=" + p,
    "application/geo+json");
  const g = await r.json();
  const lijst = [];
  for (const f of (g.features || [])) {
    const i = f.properties || {};
    const kop = i.event || i.headline;
    if (!kop) continue;
    lijst.push({
      titel: String(kop),
      tekst: waarschuwingTekst(i.description || i.instruction || ""),
      niveau: NIVEAU[i.severity] || "geel",
      niveauIsOfficieel: false,
      bronErnst: i.severity || null,
      van: i.onset || i.effective || null,
      tot: i.ends || i.expires || null,
      gebied: i.areaDesc || null,
      plaatsSpecifiek: true,
      scope: "punt"
    });
  }
  return lijst;
}

/* ---------- MeteoAlarm ---------- */

function uitCap(json, lat, lon) {
  const lijst = [];
  const groepen = json.warnings || json.features || json.data || [];
  for (const g of Array.isArray(groepen) ? groepen : []) {
    const info = (g.capData && g.capData.info) || g.info || g.properties || g;
    const items = Array.isArray(info) ? info : [info];
    for (const i of items) {
      if (!i) continue;
      const kop = i.event || i.headline || i.title;
      if (!kop) continue;
      const raak = raaktPunt(i, lat, lon);
      if (raak === false) continue;
      lijst.push({
        landelijk: raak === null,
        plaatsSpecifiek: raak === true,
        scope: raak === true ? "gebied" : "land",
        titel: String(kop),
        tekst: waarschuwingTekst(i.description || i.instruction || ""),
        niveau: NIVEAU[i.severity] || NIVEAU[i.level] || "geel",
        niveauIsOfficieel: true,
        van: i.onset || i.effective || null,
        tot: i.ends || i.expires || null,
        gebied: (i.area && i.area[0] && i.area[0].areaDesc) || i.areaDesc || null
      });
    }
  }
  return lijst;
}

function uitAtom(xml) {
  const xmlTekst = waarde => String(waarde || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => ({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"}[n]));
  const lijst = [];
  for (const e of xml.split("<entry").slice(1)) {
    const t = (e.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1];
    const s = (e.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1];
    if (!t) continue;
    lijst.push({
      landelijk: true,
      plaatsSpecifiek: false,
      scope: "land",
      titel: xmlTekst(t).trim(),
      tekst: waarschuwingTekst(xmlTekst(s)),
      niveau: /rood|red/i.test(t) ? "rood" : /oranje|orange/i.test(t) ? "oranje" : "geel",
      niveauIsOfficieel: true,
      van: null, tot: null, gebied: null
    });
  }
  return lijst;
}

async function viaMeteoAlarm(slug, lat, lon) {
  // De compatibiliteitsfeed blijft altijd leidend: alleen die bevat bruikbare
  // gebiedsinformatie. Grote of traag startende feeds krijgen wel een hedged
  // Atom-fallback, zodat een mislukte compatibiliteitsdownload niet daarna nog
  // eens volledig seriëel op de landfeed hoeft te wachten.
  const compat = "https://feeds.meteoalarm.org/api/v1/warnings/feeds-" + slug;
  const atom = "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-" + slug;
  let atomBelofte = null;
  const startAtom = () => {
    if (!atomBelofte) atomBelofte = (async () => {
      try {
        const r = await haal(atom, "*/*", METEO_ATOM_TIMEOUT_MS);
        const tekst = await r.text();
        if (/<feed(?:\s|>)/i.test(tekst)) {
          return { bron: atom, lijst: uitAtom(tekst), plaatsSpecifiek: false };
        }
      } catch (e) {}
      return null;
    })();
    return atomBelofte;
  };

  let compatHeadersOntvangen = false;
  let headerHedge = setTimeout(() => {
    if (!compatHeadersOntvangen) void startAtom();
  }, METEO_HEDGE_HEADER_MS);
  try {
    const r = await haal(compat, "application/json", METEO_COMPAT_TIMEOUT_MS);
    compatHeadersOntvangen = true;
    clearTimeout(headerHedge);
    headerHedge = null;
    const lengteTekst = r.headers && typeof r.headers.get === "function"
      ? r.headers.get("content-length") : null;
    const lengte = Number(lengteTekst);
    if (Number.isFinite(lengte) && lengte > METEO_HEDGE_BYTES) void startAtom();
    const tekst = await r.text();
    const kop = tekst.trim().charAt(0);
    if (kop === "{" || kop === "[") {
      return { bron: compat, lijst: uitCap(JSON.parse(tekst), lat, lon), plaatsSpecifiek: true };
    }
  } catch (e) {
  } finally {
    compatHeadersOntvangen = true;
    if (headerHedge !== null) clearTimeout(headerHedge);
  }

  // Atom blijft uitsluitend fallback: ook wanneer de hedge al liep, wordt een
  // geldige compatibiliteitsresponse hierboven altijd als eerste gebruikt.
  return await startAtom();
}

/* ---------- afhandeling ---------- */

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");

  const q = req.query || {};
  const leesCoord = v => v == null || String(v).trim() === "" ? NaN : Number(v);
  const lat = leesCoord(q.lat);
  const lon = leesCoord(q.lon);
  if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
    return res.status(200).json({ bron: null, dekking: false, lijst: [], reden: "geen geldige locatie" });

  const meegegevenLand=/^[A-Za-z]{2}$/.test(String(q.land||""))?String(q.land).toUpperCase():null;
  let code=meegegevenLand,landOpgevraagd=false;
  const bepaalLand=async()=>{
    if(code)return code;
    if(landOpgevraagd)return null;
    landOpgevraagd=true;
    code=await landCode(lat,lon);
    return code;
  };

  /* De NWS-rechthoeken zijn alleen een snelle kandidaatfilter en overlappen
     landsgrenzen. NWS mag daarom pas worden gekozen nadat de landcode bevestigt
     dat het punt in de VS of een door NWS bediend territorium ligt. Ontbreekt
     land= (bijv. eerste GPS-load), dan bepalen we die eerst. Mislukt dat, dan
     falen waarschuwingen gesloten in plaats van Canada/Mexico als NWS-dekking
     te markeren. */
  if (inNWS(lat, lon)) {
    await bepaalLand();
    if (isNWSLandCode(code)) {
      try {
        return res.status(200).json({
          bron: "National Weather Service", dekking: true, lijst: await viaNWS(lat, lon), plaatsSpecifiek: true, land: code
        });
      } catch (e) {
        return res.status(200).json({ bron: "National Weather Service", dekking: false, lijst: [], reden: "bron onbereikbaar", land: code });
      }
    }
  }

  await bepaalLand();
  const slug = code ? METEOALARM[code] : null;
  if (slug) {
    const uit = await viaMeteoAlarm(slug, lat, lon);
    if (uit) return res.status(200).json({
      bron: "MeteoAlarm " + slug, dekking: true, lijst: uit.lijst, land: code,
      plaatsSpecifiek: uit.plaatsSpecifiek
    });
    return res.status(200).json({ bron: "MeteoAlarm " + slug, dekking: false, lijst: [], reden: "bron onbereikbaar", land: code });
  }

  return res.status(200).json({
    bron: null, dekking: false, lijst: [],
    reden: code ? ("geen waarschuwingsbron voor " + code) : "land onbekend", land: code
  });
};

/* Pure gebiedshelpers voor regressietests; geen extra runtimepad in productie. */
module.exports._intern = { NWS_GEBIED, NWS_LANDCODES, inLengtegraadBereik, inNWS, isNWSLandCode };
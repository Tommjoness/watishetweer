// Serverlogica achter /api/waarschuwingen (Cloudflare Pages Function). Geeft officiele weerwaarschuwingen voor een locatie.
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

// Regiocode (EMMA_ID) naar gebiedsvorm, voor waarschuwingen zonder polygoon.
const { regioBevat } = require("./meteoalarm-gebieden.cjs");

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
    /* Alleen een regiocode (EMMA_ID), zoals bij KNMI, DWD en AEMET: de vorm
       komt uit de MeteoAlarm-regiovormen. Een onbekende code bewijst niets. */
    const toets = typeof regioBevat === "function" ? regioBevat : null;
    for (const gc of toets ? [].concat(g.geocode || []) : []) {
      if (!gc || !/^EMMA_ID$/i.test(String(gc.valueName || ""))) continue;
      const r = toets(gc.value, lat, lon);
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

const UA = "WatIsHetWeer/1.0 (watishetweer.nl; contact via github.com/Tommjoness/watishetweer)";
const METEO_COMPAT_TIMEOUT_MS = 4000;
const METEO_ATOM_TIMEOUT_MS = 4500;
const METEO_HEDGE_HEADER_MS = 1500;
const METEO_HEDGE_BYTES = 2000000;
const METEO_FEED_CACHE_TTL_S = 300;

/* ---------- landfeed-cache ----------
   Een MeteoAlarm-feed geldt voor een heel land en is soms meer dan 2 MB. De
   route-cache is per coördinaat; zonder deze laag downloadde iedere nieuwe
   coördinaat de volledige landfeed opnieuw. In de Cloudflare-runtime bewaren we
   daarom de feedtekst vijf minuten per feed-URL in caches.default. Buiten die
   runtime (Node-tests) bestaat caches niet en blijft het gedrag ongewijzigd.
   Een cachefout valt altijd stil terug op de gewone download. */
function feedCache() {
  try { return (globalThis.caches && globalThis.caches.default) || null; }
  catch (e) { return null; }
}
function feedCacheSleutel(url) {
  return new Request(url + (url.includes("?") ? "&" : "?") + "__wiw_feed_cache=v1");
}
async function leesFeedUitCache(url) {
  const cache = feedCache();
  if (!cache) return null;
  try {
    const hit = await cache.match(feedCacheSleutel(url));
    return hit ? await hit.text() : null;
  } catch (e) { return null; }
}
async function bewaarFeedInCache(url, tekst, contentType) {
  const cache = feedCache();
  if (!cache) return;
  try {
    await cache.put(feedCacheSleutel(url), new Response(tekst, {
      headers: {
        "Content-Type": contentType || "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=" + METEO_FEED_CACHE_TTL_S
      }
    }));
  } catch (e) {}
}

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

/* De huidige MeteoAlarm-feed levert per waarschuwing { alert: { info: [...] } }
   met één info-blok per taal. Kies er één, zodat dezelfde waarschuwing niet
   meervoudig telt: de taal van de bezoeker (Nederlands, of Engels bij ?taal=en),
   anders de andere van die twee, anders het eerste. Zo krijgt een Engelse
   bezoeker de officiële Engelse tekst van de weerdienst en nooit een eigen
   vertaling van een waarschuwing. */
function kiesInfo(infos, voorkeur = "nl") {
  const lijst = (Array.isArray(infos) ? infos : [infos]).filter(Boolean);
  const taal = re => lijst.find(i => re.test(String(i.language || "")));
  const [eerst, dan] = voorkeur === "en" ? [/^en/i, /^nl/i] : [/^nl/i, /^en/i];
  return taal(eerst) || taal(dan) || lijst[0] || null;
}
/* MeteoAlarm-awareness 1 (groen) betekent "geen waarschuwing"; zulke
   blokken staan voor iedere regio in de feed en zijn geen waarschuwing. */
function bewustzijnsniveau(i) {
  const p = [].concat(i && i.parameter || []).find(x => x && /awareness_level/i.test(String(x.valueName || "")));
  const m = /^\s*(\d)/.exec(String(p && p.value || ""));
  return m ? Number(m[1]) : null;
}
/* Kleur en soort van een MeteoAlarm-waarschuwing, zodat de site een landelijke
   melding kan geven als de plaats zelf niet te bepalen is. */
const MA_KLEUR = { 2: "geel", 3: "oranje", 4: "rood" };
const MA_TYPE_NUMMER = { 1: "wind", 2: "sneeuw-ijzel", 3: "onweer", 4: "mist", 5: "hitte", 6: "kou", 7: "kust", 8: "bosbrand", 9: "lawine", 10: "regen", 12: "overstroming", 13: "regen-overstroming" };
const MA_TYPE_NAAM = { "wind": "wind", "snow-ice": "sneeuw-ijzel", "thunderstorm": "onweer", "fog": "mist", "high-temperature": "hitte", "low-temperature": "kou",
  "coastal event": "kust", "coastalevent": "kust", "forest fire": "bosbrand", "forest-fire": "bosbrand", "avalanches": "lawine", "avalanche": "lawine", "rain": "regen",
  "flooding": "overstroming", "flood": "overstroming", "rain-flood": "regen-overstroming" };
/* Kop van een MeteoAlarm-kaart uit de officiële indeling (niveau en soort), in
   elk land en voor elke soort gelijk: "Code geel: wind". De officiële titel
   staat bij veel diensten niet in de taal van de bezoeker (KNMI zet ook in het
   Nederlandse blok "Moderate wind warning"). De tekst eronder blijft altijd de
   officiële tekst. Zonder bekend niveau of soort blijft de officiële titel
   (eigenaar, 4 oktober: keuze A). */
const MA_KOP_SOORT = { "wind": "wind", "sneeuw-ijzel": "sneeuw en ijzel", "onweer": "onweer", "mist": "mist", "hitte": "hitte", "kou": "kou",
  "kust": "kustgevaar", "bosbrand": "bosbrandgevaar", "lawine": "lawinegevaar", "regen": "regen", "overstroming": "overstromingen",
  "regen-overstroming": "regen en overstromingen" };
function maKop(i, officieel) {
  const kleur = MA_KLEUR[bewustzijnsniveau(i)], soort = MA_KOP_SOORT[maType(i)];
  return kleur && soort ? "Code " + kleur + ": " + soort : String(officieel);
}
function maType(i) {
  const p = [].concat(i && i.parameter || []).find(x => x && /awareness_type/i.test(String(x.valueName || "")));
  const m = /^\s*(\d+)/.exec(String(p && p.value || ""));
  return m ? (MA_TYPE_NUMMER[Number(m[1])] || null) : null;
}
function isVerlopen(i, nu) {
  const eind = Date.parse(i && (i.expires || i.ends) || "");
  return Number.isFinite(eind) && eind <= nu;
}

function uitCap(json, lat, lon, nu = Date.now(), voorkeur = "nl") {
  const lijst = [];
  const groepen = json.warnings || json.features || json.data || [];
  for (const g of Array.isArray(groepen) ? groepen : []) {
    const alert = g && g.alert && g.alert.info ? g.alert : null;
    const info = alert ? kiesInfo(alert.info, voorkeur) : ((g.capData && g.capData.info) || g.info || g.properties || g);
    const items = Array.isArray(info) ? info : [info];
    for (const i of items) {
      if (!i) continue;
      if (bewustzijnsniveau(i) === 1 || isVerlopen(i, nu)) continue;
      const kop = i.event || i.headline || i.title;
      if (!kop) continue;
      const raak = raaktPunt(i, lat, lon);
      if (raak === false) continue;
      lijst.push({
        landelijk: raak === null,
        plaatsSpecifiek: raak === true,
        scope: raak === true ? "gebied" : "land",
        kleur: MA_KLEUR[bewustzijnsniveau(i)] || null,
        type: maType(i),
        titel: maKop(i, kop),
        tekst: waarschuwingTekst(i.description || i.instruction || ""),
        taal: i.language ? String(i.language) : null,
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

function uitAtom(xml, nu = Date.now()) {
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
    const eind = Date.parse(xmlTekst((e.match(/<cap:expires>([\s\S]*?)<\/cap:expires>/) || [])[1]));
    if (Number.isFinite(eind) && eind <= nu) continue;
    const kop = /^(Yellow|Orange|Red)\s+(.+?)\s+Warning\b/i.exec(xmlTekst(t).trim());
    const gebiedAtom = xmlTekst((e.match(/<cap:areaDesc>([\s\S]*?)<\/cap:areaDesc>/) || [])[1]).trim() || null;
    lijst.push({
      landelijk: true,
      plaatsSpecifiek: false,
      scope: "land",
      titel: xmlTekst(t).trim(),
      tekst: waarschuwingTekst(xmlTekst(s)),
      niveau: /rood|red/i.test(t) ? "rood" : /oranje|orange/i.test(t) ? "oranje" : "geel",
      niveauIsOfficieel: true,
      kleur: kop ? ({ yellow: "geel", orange: "oranje", red: "rood" })[kop[1].toLowerCase()] : null,
      type: kop ? (MA_TYPE_NAAM[kop[2].toLowerCase()] || null) : null,
      van: null, tot: Number.isFinite(eind) ? new Date(eind).toISOString() : null, gebied: gebiedAtom
    });
  }
  return lijst;
}

async function viaMeteoAlarm(slug, lat, lon, voorkeur = "nl") {
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
        const gecachet = feedCache() ? await leesFeedUitCache(atom) : null;
        if (gecachet && /<feed(?:\s|>)/i.test(gecachet)) {
          return { bron: atom, lijst: uitAtom(gecachet), plaatsSpecifiek: false };
        }
        const r = await haal(atom, "*/*", METEO_ATOM_TIMEOUT_MS);
        const tekst = await r.text();
        if (/<feed(?:\s|>)/i.test(tekst)) {
          await bewaarFeedInCache(atom, tekst, "application/atom+xml; charset=utf-8");
          return { bron: atom, lijst: uitAtom(tekst), plaatsSpecifiek: false };
        }
      } catch (e) {}
      return null;
    })();
    return atomBelofte;
  };

  /* Zonder cache geen extra await: de hedged Atom-start blijft dan exact even vroeg. */
  const gecachetCompat = feedCache() ? await leesFeedUitCache(compat) : null;
  if (gecachetCompat) {
    try {
      return { bron: compat, lijst: uitCap(JSON.parse(gecachetCompat), lat, lon, Date.now(), voorkeur), plaatsSpecifiek: true };
    } catch (e) {}
  }

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
      const lijst = uitCap(JSON.parse(tekst), lat, lon, Date.now(), voorkeur);
      await bewaarFeedInCache(compat, tekst, "application/json; charset=utf-8");
      return { bron: compat, lijst, plaatsSpecifiek: true };
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

/* Landelijke samenvatting voor tussenstap C: actieve waarschuwingen die niet aan
   de gekozen plaats te koppelen zijn. Hoogste kleur eerst, per kleur en soort
   maximaal drie gebieden, hooguit twee regels. */
const LAND_NL = { AD:"Andorra", AT:"Oostenrijk", BE:"België", BA:"Bosnië en Herzegovina", BG:"Bulgarije", HR:"Kroatië", CY:"Cyprus", CZ:"Tsjechië",
  DK:"Denemarken", EE:"Estland", FI:"Finland", FR:"Frankrijk", DE:"Duitsland", GR:"Griekenland", HU:"Hongarije", IS:"IJsland", IE:"Ierland", IL:"Israël",
  IT:"Italië", LV:"Letland", LT:"Litouwen", LU:"Luxemburg", MT:"Malta", MD:"Moldavië", ME:"Montenegro", NL:"Nederland", MK:"Noord-Macedonië", NO:"Noorwegen",
  PL:"Polen", PT:"Portugal", RO:"Roemenië", RS:"Servië", SK:"Slowakije", SI:"Slovenië", ES:"Spanje", SE:"Zweden", CH:"Zwitserland", UA:"Oekraïne", GB:"het Verenigd Koninkrijk" };
const KLEUR_RANG = { rood: 3, oranje: 2, geel: 1 };
function eldersSamenvatting(lijst, land) {
  const groepen = new Map();
  for (const w of Array.isArray(lijst) ? lijst : []) {
    if (!w || w.plaatsSpecifiek === true || !KLEUR_RANG[w.kleur] || !w.type) continue;
    const sleutel = w.kleur + "|" + w.type;
    if (!groepen.has(sleutel)) groepen.set(sleutel, { kleur: w.kleur, type: w.type, gebieden: new Set() });
    if (w.gebied) groepen.get(sleutel).gebieden.add(String(w.gebied).trim());
  }
  if (!groepen.size) return null;
  const lijstGroepen = [...groepen.values()]
    .sort((a, b) => KLEUR_RANG[b.kleur] - KLEUR_RANG[a.kleur] || b.gebieden.size - a.gebieden.size)
    .slice(0, 2)
    .map(g => {
      const alle = [...g.gebieden].sort((a, b) => a.localeCompare(b, "nl"));
      return { kleur: g.kleur, type: g.type, gebieden: alle.slice(0, 3), meer: Math.max(0, alle.length - 3) };
    });
  return { land, landNaam: LAND_NL[land] || null, groepen: lijstGroepen };
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
    const uit = await viaMeteoAlarm(slug, lat, lon, String(q.taal || "") === "en" ? "en" : "nl");
    if (uit) {
      /* Alleen waarschuwingen die niet aan de plaats te koppelen zijn. Een
         waarschuwing die aantoonbaar elders geldt, telt niet mee: de app toont
         alleen wat voor deze plaats geldt (eigenaar, 4 oktober). */
      const elders = eldersSamenvatting(uit.lijst, code);
      return res.status(200).json(Object.assign({
        bron: "MeteoAlarm " + slug, dekking: true, lijst: uit.lijst, land: code,
        plaatsSpecifiek: uit.plaatsSpecifiek
      }, elders ? { elders } : {}));
    }
    return res.status(200).json({ bron: "MeteoAlarm " + slug, dekking: false, lijst: [], reden: "bron onbereikbaar", land: code });
  }

  return res.status(200).json({
    bron: null, dekking: false, lijst: [],
    reden: code ? ("geen waarschuwingsbron voor " + code) : "land onbekend", land: code
  });
};

/* Pure gebiedshelpers voor regressietests; geen extra runtimepad in productie. */
module.exports._intern = { NWS_GEBIED, NWS_LANDCODES, inLengtegraadBereik, inNWS, isNWSLandCode, METEO_FEED_CACHE_TTL_S, eldersSamenvatting, uitAtom, uitCap, kiesInfo };
// Vercel serverless functie. Geeft officiele weerwaarschuwingen voor een locatie.
//
// De vorige versie haalde altijd de Nederlandse MeteoAlarm-feed op en negeerde lat
// en lon volledig. Wie naar Tokio keek kreeg dus Nederlandse waarschuwingen te zien.
// Nu wordt de bron gekozen op basis van de coordinaten.
//
// Er bestaat geen bruikbare wereldwijde bron. De WMO bouwt daaraan met de Alert Hub,
// maar die feedlijst staat op het moment van schrijven leeg en is gemarkeerd als demo.
// Daarom twee echte bronnen en verder eerlijk niets:
//
//   Verenigde Staten en gebieden  ->  National Weather Service, exact op coordinaat
//   Europa                        ->  MeteoAlarm, per land
//   elders                        ->  geen bron, lege lijst met dekking:false
//
// Liever niets tonen dan iets tonen dat ergens anders geldt.

// MeteoAlarm awareness_level: 1 groen, 2 geel, 3 oranje, 4 rood.
// Niveau 1 is geen waarschuwing; als het toch in een bron verschijnt tonen we
// het terughoudend als geel in plaats van een zwaardere kleur te verzinnen.
const NIVEAU = { 1: "geel", 2: "geel", 3: "oranje", 4: "rood",
  Minor: "geel", Moderate: "geel", Severe: "oranje", Extreme: "rood" };

/* ---------- gebied afbakenen ----------

Een MeteoAlarm-landfeed bevat alle waarschuwingen van dat land. Voor Nederland
valt dat mee, maar een onweersbui in de Pyreneeen hoort niet boven Parijs te
staan. Elke CAP-waarschuwing draagt zijn eigen gebied mee als polygoon of als
cirkel. Die worden hier tegen het punt gehouden.

Waar geen gebied in staat blijft de waarschuwing wel staan: dan is er geen
grond om hem weg te gooien, en iets missen is erger dan iets extra's zien.
Zo'n waarschuwing krijgt landelijk:true mee zodat de app dat kan tonen. */

// standaard puntinpolygoon met de horizontale halve lijn
function inPolygoon(lat, lon, punten) {
  let binnen = false;
  for (let i = 0, j = punten.length - 1; i < punten.length; j = i++) {
    const [ai, oi] = punten[i], [aj, oj] = punten[j];
    if ((oi > lon) !== (oj > lon) &&
        lat < (aj - ai) * (lon - oi) / (oj - oi) + ai) binnen = !binnen;
  }
  return binnen;
}

// CAP schrijft een polygoon als "lat,lon lat,lon ..." met spaties ertussen
function leesPolygoon(p) {
  const punten = String(p).trim().split(/\s+/).map(par => {
    const [a, o] = par.split(",").map(Number);
    return (isFinite(a) && isFinite(o)) ? [a, o] : null;
  }).filter(Boolean);
  return punten.length >= 3 ? punten : null;
}

// en een cirkel als "lat,lon straal" met de straal in kilometers
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
 * @returns true binnen, false erbuiten, null als er geen gebied in staat
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

// De landen waarvoor MeteoAlarm een feed publiceert, op ISO 3166-1 alfa-2.
// De naam is de slug die in de feed-URL gaat.
const METEOALARM = {
  AD:"andorra", AT:"austria", BE:"belgium", BA:"bosnia-herzegovina", BG:"bulgaria", HR:"croatia",
  CY:"cyprus", CZ:"czechia", DK:"denmark", EE:"estonia", FI:"finland", FR:"france",
  DE:"germany", GR:"greece", HU:"hungary", IS:"iceland", IE:"ireland", IL:"israel",
  IT:"italy", LV:"latvia", LT:"lithuania", LU:"luxembourg", MT:"malta", MD:"moldova",
  ME:"montenegro", NL:"netherlands", MK:"republic-of-north-macedonia", NO:"norway", PL:"poland",
  PT:"portugal", RO:"romania", RS:"serbia", SK:"slovakia", SI:"slovenia", ES:"spain",
  SE:"sweden", CH:"switzerland", UA:"ukraine", GB:"united-kingdom"
};

// Ruwe kaders voor het NWS-gebied. Alleen bedoeld om een zinloze aanroep te
// vermijden; valt een punt er net buiten, dan geeft de NWS zelf een lege lijst.
const NWS_GEBIED = [
  [24.0, 49.5, -125.0, -66.5],   // vasteland
  [51.0, 72.0, -170.0, -129.0],  // Alaska
  [18.5, 22.5, -160.5, -154.5],  // Hawaii
  [17.5, 18.6, -67.5, -64.5],    // Puerto Rico en Maagdeneilanden
  [13.2, 15.4, 144.6, 146.1],    // Guam en Noordelijke Marianen
  [-14.6, -10.5, -171.5, -167.0]  // American Samoa (WSO Pago Pago)
];
const inNWS = (lat, lon) =>
  NWS_GEBIED.some(([z, n, w, o]) => lat >= z && lat <= n && lon >= w && lon <= o);

const UA = "WatIsHetWeer/1.0 (watishetweer.nl; contact via github.com/Tommjoness/weathernow)";

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
  // Alleen fallback voor oude/gedeelde locaties waar de browser nog geen landcode
  // heeft meegegeven. Nominatim staat incidentele, gebruiker-gestuurde reverse
  // geocoding toe; de waarschuwingenroute wordt daarnaast door Vercel gecachet.
  try {
    const r = await haal(
      "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=3&lat=" +
      lat + "&lon=" + lon + "&accept-language=en", "application/json");
    const g = await r.json(), a = g && g.address || {};
    return a.country_code ? String(a.country_code).toUpperCase() : null;
  } catch (e) { return null; }
}

/* ---------- National Weather Service ---------- */

// Houd veiligheidsinformatie leesbaar: nooit midden in een woord afbreken.
// Bij lange teksten heeft een volledige zin de voorkeur; anders een nette
// woordgrens met ellipsis. De limiet voorkomt dat één alert de hele pagina vult.
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
  // vier decimalen is het maximum dat de NWS accepteert
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
      // NWS: ends is het verwachte einde van het weergebeuren; expires is
      // de levensduur van dit CAP-bericht en kan dus eerder vallen.
      tot: i.ends || i.expires || null,
      gebied: i.areaDesc || null
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
      if (raak === false) continue;              // gebied bekend en dit punt valt erbuiten
      lijst.push({
        landelijk: raak === null,                // geen gebied meegeleverd
        titel: String(kop),
        tekst: waarschuwingTekst(i.description || i.instruction || ""),
        niveau: NIVEAU[i.severity] || NIVEAU[i.level] || "geel",
        niveauIsOfficieel: true,
        van: i.onset || i.effective || null,
        // NWS: ends is het verwachte einde van het weergebeuren; expires is
      // de levensduur van dit CAP-bericht en kan dus eerder vallen.
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
      landelijk: true, // Atom bevat geen betrouwbaar polygoon: dit altijd expliciet melden
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
  // De onderhouden publieke Atom-feed blijft eerste keus. MeteoAlarm antwoordt
  // op deze Atom-route met 406 zodra we een te specifieke Accept-header sturen;
  // wildcard-Accept levert dezelfde officiële feed wel als application/atom+xml.
  // De compatibiliteits-JSON is alleen fallback en krijgt, op basis van de gemeten
  // responstijd, genoeg ruimte zonder dat beide pogingen samen de 7s-clienttimeout
  // overschrijden.
  const atom = "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-" + slug;
  try {
    const r = await haal(atom, "*/*", 1500);
    const tekst = await r.text();
    // Een geldige feed zonder <entry> betekent gewoon: geen actieve waarschuwingen.
    if (/<feed(?:\s|>)/i.test(tekst)) return { bron: atom, lijst: uitAtom(tekst) };
  } catch (e) {}

  const compat = "https://feeds.meteoalarm.org/api/v1/warnings/feeds-" + slug;
  try {
    const r = await haal(compat, "application/json", 4500);
    const tekst = await r.text();
    const kop = tekst.trim().charAt(0);
    if (kop === "{" || kop === "[") return { bron: compat, lijst: uitCap(JSON.parse(tekst), lat, lon) };
  } catch (e) {}
  return null;
}

/* ---------- afhandeling ---------- */

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");

  const q = req.query || {};
  const leesCoord = v => v == null || String(v).trim() === "" ? NaN : Number(v);
  const lat = leesCoord(q.lat);
  const lon = leesCoord(q.lon);
  // Zonder geldige coordinaten kan er geen bron gekozen worden. Dan liever niets
  // dan terugvallen op een willekeurig land.
  if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)
    return res.status(200).json({ bron: null, dekking: false, lijst: [], reden: "geen geldige locatie" });

  if (inNWS(lat, lon)) {
    try {
      return res.status(200).json({
        bron: "National Weather Service", dekking: true, lijst: await viaNWS(lat, lon)
      });
    } catch (e) {
      return res.status(200).json({ bron: "National Weather Service", dekking: false, lijst: [], reden: "bron onbereikbaar" });
    }
  }

  const meegegevenLand=/^[A-Za-z]{2}$/.test(String(q.land||""))?String(q.land).toUpperCase():null;
  const code = meegegevenLand || await landCode(lat, lon);
  const slug = code ? METEOALARM[code] : null;
  if (slug) {
    const uit = await viaMeteoAlarm(slug, lat, lon);
    if (uit) return res.status(200).json({ bron: "MeteoAlarm " + slug, dekking: true, lijst: uit.lijst, land: code });
    return res.status(200).json({ bron: "MeteoAlarm " + slug, dekking: false, lijst: [], reden: "bron onbereikbaar", land: code });
  }

  return res.status(200).json({
    bron: null, dekking: false, lijst: [],
    reden: code ? ("geen waarschuwingsbron voor " + code) : "land onbekend", land: code
  });
}

"use strict";

/* Moon 2.0, M0: onafhankelijke referentie (JPL Horizons) en nulmeting van de huidige maankern.
   Volledig offline: gebruikt alleen het vastgelegde bestand scripts/maan-referentie/horizons-2026-2028.json
   (gemaakt met scripts/maan-referentie/genereer-horizons.js, dat nooit in CI draait).

   1. Integriteit en bron: inhoud-hash, efemeride, exacte aanvraagparameters, aansluiting op het referentiekader.
   2. Dekking: 2026-2028, beide halfronden, evenaar, hoge breedtes, datumgrens, Nederlandse klokwissels,
      seizoenen, en vensters zonder opkomst of ondergang.
   3. Interne consistentie van de referentie (refractie, topocentrisch tegenover geocentrisch, gebeurtenissen).
   4. Bewaking: geen workflow of npm-script roept Horizons of de generator aan.
   5. Onzekerheid van de referentie zelf: waar de gebroken bovenrand werkelijk door 0° gaat, ten opzichte van
      de opkomst-/ondergangsminuut van Horizons (fijne monsters per 10 s).
   6. Nulmeting van de HUIDIGE productiekern (maan, maanHoogte, opOnder uit index.html en maanStand uit de
      Nachtzicht-kern), ongewijzigd, met modelafwijking (zelfde definitie als de kern) apart van het
      definitieverschil (topocentrisch tegenover geocentrisch). Afwijkingen worden gerapporteerd en mogen niet
      groter worden (regressiegrens). Deze test verandert niets aan de runtime, scores, drempels of vensters. */

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { LOCATIES, MOMENTEN, OPKOMST_VENSTERS } = require("./maan-referentie/referentiekader.js");
const { zonMaanBron, laadKern } = require("./nachtzicht-bron.js");

const ROOT = path.join(__dirname, "..");
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "maan-referentie", "horizons-2026-2028.json"), "utf8"));
const R = Math.PI / 180;
const ms = utc => Date.parse(utc.replace(" ", "T") + ":00Z");
const hoek = (a, b) => ((a - b + 540) % 360) - 180;
let n = 0;
const ok = (v, m) => { assert(v, m); n++; };
/* Regressiegrenzen van de nulmeting (gemeten maxima, naar boven afgerond); zie onderdeel 6. */
const GRENZEN_NULMETING = { ill: 1.8, hoogte: 1.7, rand: 1.2, illTotaal: 2.4, hoogteTotaal: 2.5, randTotaal: 2.5, opkomstMin: 19, opkomstHoogte: 1.7, schampendMin: 35, schampendHoogte: 1.3, gemistSchampend: 1 };
const gelijk = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };

/* ---------- 1. Integriteit en bron ---------- */
{
  const { meta, ...inhoud } = REF;
  ok(meta && /JPL Horizons/.test(meta.bron), "bron is JPL Horizons");
  gelijk(crypto.createHash("sha256").update(JSON.stringify(inhoud)).digest("hex"), meta.inhoudSha256, "inhoud-hash klopt: gegevens zijn niet met de hand gewijzigd");
  ok(Array.isArray(meta.efemeriden) && meta.efemeriden.length && meta.efemeriden.every(e => /^DE4\d\d$/.test(e)), "efemeride vastgelegd (JPL DE4xx): " + meta.efemeriden);
  ok(meta.signatuur && meta.signatuur.source === "NASA/JPL Horizons API", "Horizons-API-signatuur vastgelegd");
  ok(Array.isArray(meta.aardrotatie) && meta.aardrotatie.some(r => /EOP coverage/.test(r)), "dekking van de aardrotatiegegevens (EOP) vastgelegd");
  ok(/^\d{4}-\d{2}-\d{2}T/.test(meta.gegenereerd), "tijdstip van ophalen vastgelegd");
  ok(meta.aanvragen.length >= 100 && meta.aanvragen.every(a => a.doel && a.parameters && a.parameters.COMMAND && a.parameters.QUANTITIES), "iedere aanvraag met doel en exacte parameters vastgelegd");
  ok(meta.aanvragen.filter(a => a.parameters.R_T_S_ONLY === "'GEO'" && a.parameters.STEP_SIZE === "'1 MINUTES'").length === LOCATIES.length * OPKOMST_VENSTERS.length, "opkomst en ondergang per locatie en venster met GEO-horizon en stap van 1 minuut");
  ok(meta.aanvragen.some(a => a.parameters.APPARENT === "'REFRACTED'"), "gebroken (refracted) hoogtes apart opgevraagd");
  for (const k of ["airless", "refracted", "astrometrisch", "opkomstOndergang", "topocentrisch", "geocentrisch", "toekomst"]) ok(meta.definities[k], "definitie vastgelegd: " + k);
  gelijk(JSON.parse(JSON.stringify(LOCATIES)), REF.locaties, "fixtures horen bij de huidige locatielijst");
  gelijk(JSON.parse(JSON.stringify(MOMENTEN)), REF.momenten, "fixtures horen bij de huidige momentenlijst");
  gelijk(JSON.parse(JSON.stringify(OPKOMST_VENSTERS)), REF.vensters, "fixtures horen bij de huidige vensterlijst");
}

/* ---------- 2. Dekking ---------- */
{
  const jaren = new Set(MOMENTEN.map(m => m.utc.slice(0, 4)));
  gelijk([...jaren].sort(), ["2026", "2027", "2028"], "2026, 2027 en 2028");
  ok(LOCATIES.some(l => l.lat > 0) && LOCATIES.some(l => l.lat < 0), "beide halfronden");
  ok(LOCATIES.some(l => Math.abs(l.lat) < 1), "evenaar");
  ok(LOCATIES.some(l => l.lat >= 70) && LOCATIES.some(l => l.lat <= -50), "hoge noordelijke en zuidelijke breedte");
  ok(LOCATIES.some(l => l.hoogteKm >= 2), "waarnemer op grote hoogte");
  /* Datumgrens: op minstens één moment ligt de lokale kalenderdatum een dag na de UTC-datum. */
  const lokaleDatum = (t, tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
  ok(MOMENTEN.some(m => lokaleDatum(ms(m.utc), "Pacific/Apia") > m.utc.slice(0, 10)), "datumgrens: lokale datum in Apia ligt voor op UTC");
  /* Klokwissels: de Nederlandse UTC-offset springt precies op die momenten. */
  const offset = t => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", hour12: false, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(new Date(t)).reduce((o, x) => (o[x.type] = x.value, o), {}); return (Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute) - t) / 3600000; };
  const wissels = MOMENTEN.filter(m => /klokwissel/.test(m.id));
  gelijk(wissels.length, 6, "zes Nederlandse klokwissels (2026-2028)");
  for (const m of wissels) ok(Math.abs(offset(ms(m.utc) - 60000) - offset(ms(m.utc) + 60000)) === 1, "Nederlandse klokwissel op " + m.utc + " UTC");
  ok(["06-21", "12-21"].every(d => MOMENTEN.some(m => m.utc.slice(5, 10) === d)), "beide zonnewendes");
  for (const soort of ["sikkel-wassend", "eerste-kwartier", "bijna-vol", "laatste-kwartier", "sikkel-afnemend", "libratie-groot"])
    ok(MOMENTEN.filter(m => m.id.endsWith(soort)).length === 3, "elk jaar: " + soort);
  gelijk(REF.topocentrisch.length, LOCATIES.length * MOMENTEN.length, "topocentrische rij voor iedere locatie en ieder moment");
  gelijk(REF.geocentrisch.length, MOMENTEN.length, "geocentrische rij voor ieder moment");
  gelijk(REF.opkomst.length, LOCATIES.length * OPKOMST_VENSTERS.length, "opkomst/ondergang voor iedere locatie en ieder venster");
  ok(REF.opkomst.some(o => o.zonderOpkomstOfOndergang && o.zonderOpkomstOfOndergang.every(h => h.gebrokenHoogte < 0)), "venster waarin de maan steeds onder de horizon blijft");
  ok(REF.opkomst.some(o => o.zonderOpkomstOfOndergang && o.zonderOpkomstOfOndergang.every(h => h.gebrokenHoogte > 0)), "venster waarin de maan steeds boven de horizon blijft");
  const fasen = REF.geocentrisch.map(g => g.maan["Illu%"]);
  ok(Math.min(...fasen) < 10 && Math.max(...fasen) > 95, "verlichting van smalle sikkel (<10%) tot bijna vol (>95%)");
}

/* ---------- 3. Interne consistentie van de referentie ---------- */
{
  const KOLOMMEN = ["R.A.___(ICRF)", "DEC____(ICRF)", "R.A.__(a-app)", "DEC___(a-app)", "Azimuth_(a-app)", "Elevation_(a-app)", "L_Ap_Sid_Time", "Illu%", "Ang-diam", "ObsSub-LON", "ObsSub-LAT", "NP.ang", "delta", "S-T-O"];
  let maxRefractie = 0, maxTopoGeoIll = 0, maxTopoGeoLib = 0;
  for (const r of REF.topocentrisch) {
    for (const k of KOLOMMEN) ok(Number.isFinite(r.maan[k]), `${r.locatie} ${r.moment}: ${k} aanwezig`);
    const g = REF.geocentrisch.find(x => x.moment === r.moment);
    const el = r.maan["Elevation_(a-app)"], elr = r.maanGebroken["Elevation_(r-app)"];
    if (el > 0) { ok(elr >= el && elr - el < 0.6, `${r.locatie} ${r.moment}: refractie positief en < 0,6°`); maxRefractie = Math.max(maxRefractie, elr - el); }
    maxTopoGeoIll = Math.max(maxTopoGeoIll, Math.abs(r.maan["Illu%"] - g.maan["Illu%"]));
    maxTopoGeoLib = Math.max(maxTopoGeoLib, Math.abs(hoek(r.maan["ObsSub-LON"], g.maan["ObsSub-LON"])), Math.abs(r.maan["ObsSub-LAT"] - g.maan["ObsSub-LAT"]));
    /* Topocentrisch staat de maan dichterbij of verder dan geocentrisch, maar nooit meer dan één aardstraal. */
    ok(Math.abs(r.maan.delta - g.maan.delta) * 149597870.7 < 6400, `${r.locatie} ${r.moment}: afstand topocentrisch tegenover geocentrisch < 1 aardstraal`);
  }
  ok(maxTopoGeoIll > 0.1 && maxTopoGeoIll < 1.5, "topocentrisch effect op de verlichting gemeten: " + maxTopoGeoIll.toFixed(3) + " procentpunt");
  ok(maxTopoGeoLib > 0.3 && maxTopoGeoLib < 1.2, "topocentrisch effect op de libratie gemeten: " + maxTopoGeoLib.toFixed(3) + "°");
  for (const o of REF.opkomst) {
    const t = o.gebeurtenissen.map(g => ms(g.utc));
    ok(t.every((x, i) => i === 0 || x >= t[i - 1]), `${o.locatie} ${o.venster}: gebeurtenissen chronologisch`);
    ok(t.every(x => x >= ms(o.start) && x <= ms(o.eind)), `${o.locatie} ${o.venster}: gebeurtenissen binnen het venster`);
    for (const g of o.gebeurtenissen.filter(g => g.soort === "r" || g.soort === "s"))
      ok(g.hoogte > -1.4 && g.hoogte < -0.4, `${o.locatie} ${g.utc}: airless middelpunt bij opkomst/ondergang tussen -1,4° en -0,4° (gebroken bovenrand op 0°)`);
    if (o.zonderOpkomstOfOndergang) {
      const h = o.zonderOpkomstOfOndergang.map(x => x.gebrokenHoogte);
      ok(h.length === 3 && (h.every(x => x > 0) || h.every(x => x < 0)), `${o.locatie} ${o.venster}: zonder opkomst/ondergang en eenduidig boven of onder de horizon`);
    }
  }
  console.log(`Referentie: refractie bij de getoetste hoogtes tot ${maxRefractie.toFixed(3)}°; topocentrisch tegenover geocentrisch tot ${maxTopoGeoIll.toFixed(3)} procentpunt verlichting en ${maxTopoGeoLib.toFixed(3)}° libratie.`);
}

/* ---------- 4. Bewaking: Horizons en de generator nooit vanuit CI ---------- */
{
  const WF = path.join(ROOT, ".github", "workflows");
  for (const naam of fs.readdirSync(WF).filter(x => /\.ya?ml$/.test(x))) {
    const t = fs.readFileSync(path.join(WF, naam), "utf8");
    ok(!/ssd\.jpl\.nasa\.gov|svs\.gsfc\.nasa\.gov|genereer-horizons/.test(t), naam + ": geen live Horizons/SVS-aanroep of generator in CI");
  }
  const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts;
  ok(!Object.values(scripts).some(s => /genereer-horizons/.test(s)), "geen npm-script start de generator");
  ok(/process\.env\.CI \|\| process\.env\.GITHUB_ACTIONS/.test(fs.readFileSync(path.join(__dirname, "maan-referentie", "genereer-horizons.js"), "utf8")), "generator weigert in CI");
}

/* ---------- 5. Onzekerheid van de referentie zelf: wanneer gaat de gebroken bovenrand door 0°? ---------- */
/* Horizons RTS meldt het event "ergens in de afgelopen stap" (stap 1 min). Uit de validatiemonsters (gebroken
   middelpunthoogte + halve diameter, per 10 s) volgt het werkelijke kruispunt ten opzichte van die minuut.
   Schampende gevallen (hoogteverandering < 0,05°/min, alleen Longyearbyen) zijn slecht bepaald. */
const SCHAMPEND = 0.05; /* °/min */
const valid = { normaal: [], schampend: [] };
{
  ok(REF.opkomstValidatie.length >= 24, "validatiemonsters voor opkomst/ondergang aanwezig: " + REF.opkomstValidatie.length);
  for (const e of REF.opkomstValidatie) {
    ok(e.monsters.length === 19 && e.monsters.every((m, i) => m.s === -120 + 10 * i && Number.isFinite(m.gebrokenHoogte) && m.diameter > 1700 && m.diameter < 2100), `${e.locatie} ${e.utc}: 19 monsters per 10 s met gebroken hoogte en diameter`);
    const p = e.monsters.map(m => [m.s, m.gebrokenHoogte + m.diameter / 7200]);
    const snelheid = Math.abs(p[p.length - 1][1] - p[0][1]) / 3; /* °/min over 180 s */
    let kruising = null;
    for (let i = 1; i < p.length && kruising === null; i++) if ((p[i - 1][1] < 0) !== (p[i][1] < 0)) kruising = p[i - 1][0] + (0 - p[i - 1][1]) * (p[i][0] - p[i - 1][0]) / (p[i][1] - p[i - 1][1]);
    (snelheid < SCHAMPEND ? valid.schampend : valid.normaal).push({ e, snelheid, kruising });
  }
  ok(valid.normaal.length >= 20 && valid.normaal.every(v => v.kruising !== null && v.kruising >= -90 && v.kruising <= 30), "niet-schampend: gebroken bovenrand gaat binnen 90 s vóór tot 30 s ná de Horizons-minuut door 0°: " + valid.normaal.map(v => v.kruising && v.kruising.toFixed(0)).join(","));
  ok(valid.schampend.every(v => v.e.locatie === "longyearbyen"), "schampende opkomst/ondergang alleen in het poolgebied");
  const k = valid.normaal.map(v => v.kruising);
  console.log(`Referentie opkomst/ondergang: kruising van de gebroken bovenrand ${Math.min(...k).toFixed(0)} tot +${Math.max(...k).toFixed(0)} s t.o.v. de Horizons-minuut (n=${k.length}); schampend (< ${SCHAMPEND}°/min): n=${valid.schampend.length}, kruising ${valid.schampend.map(v => v.kruising === null ? "niet eenduidig" : v.kruising.toFixed(0) + " s").join(", ")}.`);
}

/* ---------- 6. Nulmeting van de huidige productiekern (ongewijzigd) ---------- */
/* Steeds twee getallen, zodat definitieverschillen niet als fout van de kern worden gelezen:
   - modelafwijking: kern tegenover Horizons met DEZELFDE definitie als de kern (geocentrisch, middelpunt, zonder
     refractie). Dit is de werkelijke rekenfout van de kern en wordt begrensd (mag niet slechter worden);
   - definitieverschil: Horizons topocentrisch tegenover geocentrisch (parallax, geodetische breedte). Dit is wat de
     waarnemer extra ziet; het hoort bij de vraag welke grootheid de app zou moeten tonen (Moon 2.0, M1), niet bij een
     fout in de huidige berekening. Alleen gerapporteerd.
   Opkomst/ondergang: kern en Horizons beschrijven hetzelfde event (gebroken bovenrand op de geometrische horizon;
   de kern via de standaardhoogte +0,125° voor het middelpunt, Meeus). Het tijdsverschil wordt buiten het
   referentie-interval gemeten en ook uitgedrukt als hoogte-equivalent: tijdsverschil x lokale
   horizonpassagesnelheid volgens het kernmodel (dh/dt over +-5 min). Dat is een lineaire benadering, niet een
   gemeten hoogteafwijking; bij een schampende maan (kleine, snel veranderende dh/dt) is ze onbetrouwbaar. */
const INDEX = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const ctx = { Math, Date }; vm.createContext(ctx);
vm.runInContext(zonMaanBron(INDEX) + ";this.__k={maan,maanHoogte,opOnder};", ctx);
const { maan, maanHoogte, opOnder } = ctx.__k;
const K = laadKern(INDEX);
function randstand(zra, zde, mra, mde) { /* Meeus 48.5, positiehoek van de verlichte rand */
  return (Math.atan2(Math.cos(zde * R) * Math.sin((zra - mra) * R), Math.sin(zde * R) * Math.cos(mde * R) - Math.cos(zde * R) * Math.sin(mde * R) * Math.cos((zra - mra) * R)) / R + 360) % 360;
}
/* Geocentrische middelpunthoogte uit de Horizons-positie, met dezelfde vereenvoudiging als de kern (geen parallax,
   breedte direct in de bolformule): zo blijft alleen het verschil in efemeride/model over. */
function geoHoogte(ra, dec, lastUur, lat) {
  const H = (lastUur * 15 - ra) * R;
  return Math.asin(Math.sin(lat * R) * Math.sin(dec * R) + Math.cos(lat * R) * Math.cos(dec * R) * Math.cos(H)) / R;
}
const model = { ill: [], hoogte: [], rand: [] }, definitie = { ill: [], hoogte: [], rand: [] }, totaal = { ill: [], hoogte: [], rand: [] }, randBuiten = [];
for (const r of REF.topocentrisch) {
  const l = LOCATIES.find(x => x.id === r.locatie), t = ms(r.utc), g = REF.geocentrisch.find(x => x.moment === r.moment);
  const illOud = maan(new Date(t)).ill * 100;
  model.ill.push(Math.abs(illOud - g.maan["Illu%"]));
  totaal.ill.push(Math.abs(illOud - r.maan["Illu%"]));
  definitie.ill.push(Math.abs(r.maan["Illu%"] - g.maan["Illu%"]));
  const hGeo = geoHoogte(g.maan["R.A.__(a-app)"], g.maan["DEC___(a-app)"], r.maan["L_Ap_Sid_Time"], l.lat);
  model.hoogte.push(Math.abs(maanHoogte(t, l.lat, l.lon) - hGeo));
  definitie.hoogte.push(Math.abs(r.maan["Elevation_(a-app)"] - hGeo));
  totaal.hoogte.push(Math.abs(maanHoogte(t, l.lat, l.lon) - r.maan["Elevation_(a-app)"]));
  const randGeo = randstand(g.zon["R.A.__(a-app)"], g.zon["DEC___(a-app)"], g.maan["R.A.__(a-app)"], g.maan["DEC___(a-app)"]);
  const randTopo = randstand(r.zon["R.A.__(a-app)"], r.zon["DEC___(a-app)"], r.maan["R.A.__(a-app)"], r.maan["DEC___(a-app)"]);
  /* De randstand is alleen goed bepaald (en zichtbaar) bij een duidelijke sikkel of schaduw: 5-95% verlicht. */
  const dRand = Math.abs(hoek(K.maanStand(t, l.lat, null).rand, randGeo));
  if (g.maan["Illu%"] >= 5 && g.maan["Illu%"] <= 95) { model.rand.push(dRand); definitie.rand.push(Math.abs(hoek(randTopo, randGeo))); totaal.rand.push(Math.abs(hoek(K.maanStand(t, l.lat, null).rand, randTopo))); } else randBuiten.push(dRand);
}
const opkomst = { normaal: [], normaalHoogte: [], schampend: [], schampendHoogte: [] };
let gemist = 0, gemistSchampend = 0, extra = 0, zonderOk = 0;
for (const o of REF.opkomst) {
  const l = LOCATIES.find(x => x.id === o.locatie);
  for (const g of o.gebeurtenissen.filter(g => g.soort === "r" || g.soort === "s")) {
    const t = ms(g.utc), snelheid = Math.abs(maanHoogte(t + 300000, l.lat, l.lon) - maanHoogte(t - 300000, l.lat, l.lon)) / 10;
    const schampend = snelheid < SCHAMPEND;
    const res = opOnder("maan", t - 45 * 60000, l.lat, l.lon), oud = g.soort === "r" ? res.op : res.onder;
    if (oud == null || Math.abs(oud - t) > 90 * 60000) { if (schampend) gemistSchampend++; else gemist++; continue; }
    /* Horizons-tijd is een minuutstap (kruising binnen ca. -90..+30 s, zie 5): verschil tot de dichtstbijzijnde rand van dat interval. */
    const dMin = Math.max(0, (t - 90000) - oud, oud - (t + 30000)) / 60000;
    opkomst[schampend ? "schampend" : "normaal"].push(dMin);
    opkomst[schampend ? "schampendHoogte" : "normaalHoogte"].push(dMin * snelheid);
  }
  if (o.zonderOpkomstOfOndergang) {
    let gevonden = 0;
    for (let t = ms(o.start); t < ms(o.eind); t += 86400000) { const res = opOnder("maan", t, l.lat, l.lon); gevonden += (res.op != null) + (res.onder != null); }
    if (gevonden) extra++; else zonderOk++;
  }
}
const stat = a => { const s = [...a].sort((x, y) => x - y); return { n: s.length, mediaan: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };
const fmt = (a, e, d = 2) => { const s = stat(a); return `mediaan ${s.mediaan.toFixed(d)}${e}, p95 ${s.p95.toFixed(d)}${e}, max ${s.max.toFixed(d)}${e} (n=${s.n})`; };
const M = Object.fromEntries(Object.entries(model).map(([k, v]) => [k, stat(v)])), T = Object.fromEntries(Object.entries(totaal).map(([k, v]) => [k, stat(v)])), O = Object.fromEntries(Object.entries(opkomst).map(([k, v]) => [k, stat(v)]));
console.log("Nulmeting huidige kern tegenover JPL Horizons:");
console.log("  verlichting   model (geocentrisch)          " + fmt(model.ill, " procentpunt") + "; definitieverschil topo-geo " + fmt(definitie.ill, " procentpunt"));
console.log("  hoogte        model (geocentrisch, middelpunt, zonder refractie) " + fmt(model.hoogte, "°") + "; definitieverschil parallax " + fmt(definitie.hoogte, "°"));
console.log("  randstand     model (geocentrisch, 5-95%)   " + fmt(model.rand, "°") + "; definitieverschil topo-geo " + fmt(definitie.rand, "°") + `; buiten 5-95% (slecht bepaald) max ${Math.max(...randBuiten).toFixed(2)}° (n=${randBuiten.length})`);
console.log("  totaal (kern tegenover topocentrisch, wat de waarnemer ziet): verlichting " + fmt(totaal.ill, " procentpunt") + "; hoogte " + fmt(totaal.hoogte, "°") + "; randstand (5-95%) " + fmt(totaal.rand, "°"));
console.log("  opkomst/ondergang buiten referentie-interval, niet schampend: " + fmt(opkomst.normaal, " min", 1) + "; als hoogte " + fmt(opkomst.normaalHoogte, "°") + `; gemist ${gemist}`);
console.log("  opkomst/ondergang buiten referentie-interval, schampend (< 0,05°/min): " + fmt(opkomst.schampend, " min", 1) + "; als hoogte " + fmt(opkomst.schampendHoogte, "°") + `; gemist ${gemistSchampend}; vensters zonder gebeurtenis correct ${zonderOk}, onterecht gebeurtenis ${extra}`);

/* Regressiegrenzen op de MODELafwijking van de bestaande kern (naar boven afgerond). Geen eis voor Moon 2.0 (M1).
   Definitieverschillen en slecht bepaalde gevallen worden gerapporteerd, niet als kernfout begrensd. */
const GRENS = GRENZEN_NULMETING;
ok(M.ill.max <= GRENS.ill, `verlichting: modelafwijking niet groter dan de nulmeting (${M.ill.max.toFixed(2)} <= ${GRENS.ill})`);
ok(M.hoogte.max <= GRENS.hoogte, `hoogte: modelafwijking niet groter dan de nulmeting (${M.hoogte.max.toFixed(2)} <= ${GRENS.hoogte})`);
ok(M.rand.max <= GRENS.rand, `randstand: modelafwijking niet groter dan de nulmeting (${M.rand.max.toFixed(2)} <= ${GRENS.rand})`);
ok(T.ill.max <= GRENS.illTotaal && T.hoogte.max <= GRENS.hoogteTotaal && T.rand.max <= GRENS.randTotaal, `totaal tegenover topocentrisch niet groter dan de nulmeting (${T.ill.max.toFixed(2)}/${T.hoogte.max.toFixed(2)}/${T.rand.max.toFixed(2)} <= ${GRENS.illTotaal}/${GRENS.hoogteTotaal}/${GRENS.randTotaal})`);
ok(O.schampend.max <= GRENS.schampendMin, `opkomst/ondergang (schampend): niet slechter dan de nulmeting (${O.schampend.max.toFixed(1)} <= ${GRENS.schampendMin} min)`);
ok(O.normaal.max <= GRENS.opkomstMin, `opkomst/ondergang (niet schampend): niet slechter dan de nulmeting (${O.normaal.max.toFixed(1)} <= ${GRENS.opkomstMin} min)`);
ok(O.normaalHoogte.max <= GRENS.opkomstHoogte, `opkomst/ondergang (niet schampend) als hoogte: niet slechter dan de nulmeting (${O.normaalHoogte.max.toFixed(2)} <= ${GRENS.opkomstHoogte}°)`);
ok(O.schampendHoogte.max <= GRENS.schampendHoogte, `opkomst/ondergang (schampend) als hoogte: niet slechter dan de nulmeting (${O.schampendHoogte.max.toFixed(2)} <= ${GRENS.schampendHoogte}°)`);
ok(gemist === 0, "geen niet-schampende opkomst of ondergang gemist");
ok(gemistSchampend <= GRENS.gemistSchampend, "hooguit de bekende gemiste schampende opkomst: " + gemistSchampend);
ok(extra === 0, "geen onterechte opkomst/ondergang in vensters zonder gebeurtenis");

console.log(`Maanreferentie (JPL Horizons, ${REF.meta.efemeriden.join("/")}): ${n} controles geslaagd; ${REF.topocentrisch.length} topocentrische en ${REF.geocentrisch.length} geocentrische rijen, ${REF.opkomst.reduce((s, o) => s + o.gebeurtenissen.length, 0)} gebeurtenissen, offline.`);

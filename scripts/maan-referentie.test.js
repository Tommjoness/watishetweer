"use strict";

/* Moon 2.0, M0: onafhankelijke referentie (JPL Horizons) en nulmeting van de huidige maankern.
   Volledig offline: gebruikt alleen het vastgelegde bestand scripts/maan-referentie/horizons-2026-2028.json
   (gemaakt met scripts/maan-referentie/genereer-horizons.js, dat nooit in CI draait).

   1. Integriteit en bron: inhoud-hash, efemeride, exacte aanvraagparameters, aansluiting op het referentiekader.
   2. Dekking: 2026-2028, beide halfronden, evenaar, hoge breedtes, datumgrens, Nederlandse klokwissels,
      seizoenen, en vensters zonder opkomst of ondergang.
   3. Interne consistentie van de referentie (refractie, topocentrisch tegenover geocentrisch, gebeurtenissen).
   4. Bewaking: geen workflow of npm-script roept Horizons of de generator aan.
   5. Nulmeting van de HUIDIGE productiekern (maan, maanHoogte, opOnder uit index.html en maanStand uit de
      Nachtzicht-kern), ongewijzigd: de gemeten afwijkingen worden gerapporteerd en mogen niet groter worden
      (regressiegrens). Deze test verandert niets aan de runtime, scores, drempels of vensters. */

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

/* ---------- 5. Nulmeting van de huidige productiekern (ongewijzigd) ---------- */
const INDEX = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const ctx = { Math, Date }; vm.createContext(ctx);
vm.runInContext(zonMaanBron(INDEX) + ";this.__k={maan,maanHoogte,opOnder};", ctx);
const { maan, maanHoogte, opOnder } = ctx.__k;
const K = laadKern(INDEX);
function randstand(zra, zde, mra, mde) { /* Meeus 48.5, positiehoek van de verlichte rand */
  return (Math.atan2(Math.cos(zde * R) * Math.sin((zra - mra) * R), Math.sin(zde * R) * Math.cos(mde * R) - Math.cos(zde * R) * Math.sin(mde * R) * Math.cos((zra - mra) * R)) / R + 360) % 360;
}
const meting = { ill: [], hoogte: [], rand: [], opkomst: [], opkomstPool: [] }, randBuiten = [];
let gemist = 0, gemistPool = 0, extra = 0, circumpolairOk = 0;
const pool = l => Math.abs(l.lat) >= 66.5; /* binnen de poolcirkel schampt de maan vaak langs de horizon */
for (const r of REF.topocentrisch) {
  const l = LOCATIES.find(x => x.id === r.locatie), t = ms(r.utc);
  meting.ill.push(Math.abs(maan(new Date(t)).ill * 100 - r.maan["Illu%"]));
  meting.hoogte.push(Math.abs(maanHoogte(t, l.lat, l.lon) - r.maan["Elevation_(a-app)"]));
  /* De randstand is alleen goed bepaald (en zichtbaar) als er een duidelijke sikkel of schaduw is: bij bijna
     nieuwe of bijna volle maan verandert de hoek sterk bij een minieme positieafwijking. Grens: 5-95% verlicht. */
  const dRand = Math.abs(hoek(K.maanStand(t, l.lat, null).rand, randstand(r.zon["R.A.__(a-app)"], r.zon["DEC___(a-app)"], r.maan["R.A.__(a-app)"], r.maan["DEC___(a-app)"])));
  (r.maan["Illu%"] >= 5 && r.maan["Illu%"] <= 95 ? meting.rand : randBuiten).push(dRand);
}
for (const o of REF.opkomst) {
  const l = LOCATIES.find(x => x.id === o.locatie);
  for (const g of o.gebeurtenissen.filter(g => g.soort === "r" || g.soort === "s")) {
    const res = opOnder("maan", ms(g.utc) - 45 * 60000, l.lat, l.lon), oud = g.soort === "r" ? res.op : res.onder;
    if (oud == null || Math.abs(oud - ms(g.utc)) > 90 * 60000) { if (pool(l)) gemistPool++; else gemist++; continue; }
    meting[pool(l) ? "opkomstPool" : "opkomst"].push(Math.abs(oud - ms(g.utc)) / 60000);
  }
  if (o.zonderOpkomstOfOndergang) {
    let gevonden = 0;
    for (let t = ms(o.start); t < ms(o.eind); t += 86400000) { const res = opOnder("maan", t, l.lat, l.lon); gevonden += (res.op != null) + (res.onder != null); }
    if (gevonden) extra++; else circumpolairOk++;
  }
}
const stat = a => { const s = [...a].sort((x, y) => x - y); return { n: s.length, mediaan: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };
const S = Object.fromEntries(Object.entries(meting).map(([k, v]) => [k, stat(v)]));
const fmt = (s, e) => `mediaan ${s.mediaan.toFixed(2)}${e}, p95 ${s.p95.toFixed(2)}${e}, max ${s.max.toFixed(2)}${e} (n=${s.n})`;
console.log("Nulmeting huidige kern tegenover JPL Horizons (topocentrisch, airless):");
console.log("  verlichting:            " + fmt(S.ill, " procentpunt"));
console.log("  hoogte (geocentrisch model, zonder parallax): " + fmt(S.hoogte, "°"));
console.log("  randstand (geocentrisch model, 5-95% verlicht): " + fmt(S.rand, "°") + `; buiten dat bereik (slecht bepaald) max ${Math.max(...randBuiten).toFixed(2)}° (n=${randBuiten.length})`);
console.log("  opkomst/ondergang (|breedte| < 66,5°): " + fmt(S.opkomst, " min") + `; niet gevonden binnen 90 min: ${gemist}`);
console.log("  opkomst/ondergang (poolgebied):         " + fmt(S.opkomstPool, " min") + `; niet gevonden binnen 90 min: ${gemistPool}; vensters zonder gebeurtenis correct: ${circumpolairOk}, onterecht gebeurtenis: ${extra}`);

/* Regressiegrenzen: de huidige afwijkingen, naar boven afgerond. Ze beschrijven de bestaande kern en zijn
   GEEN nauwkeurigheidseis voor Moon 2.0 (die volgt in M1). Een wijziging die de kern slechter maakt, faalt hier. */
const GRENS = { ill: 2.4, hoogte: 2.5, rand: 2.5, opkomst: 15, opkomstPool: 35, gemist: 0, gemistPool: 1, extra: 0 };
ok(S.ill.max <= GRENS.ill, `verlichting niet slechter dan de nulmeting (${S.ill.max.toFixed(2)} <= ${GRENS.ill})`);
ok(S.hoogte.max <= GRENS.hoogte, `hoogte niet slechter dan de nulmeting (${S.hoogte.max.toFixed(2)} <= ${GRENS.hoogte})`);
ok(S.rand.max <= GRENS.rand, `randstand niet slechter dan de nulmeting (${S.rand.max.toFixed(2)} <= ${GRENS.rand})`);
ok(S.opkomst.max <= GRENS.opkomst, `opkomst/ondergang buiten het poolgebied niet slechter dan de nulmeting (${S.opkomst.max.toFixed(1)} <= ${GRENS.opkomst} min)`);
ok(S.opkomstPool.max <= GRENS.opkomstPool, `opkomst/ondergang in het poolgebied niet slechter dan de nulmeting (${S.opkomstPool.max.toFixed(1)} <= ${GRENS.opkomstPool} min)`);
ok(gemist <= GRENS.gemist, "buiten het poolgebied geen opkomst of ondergang gemist: " + gemist);
ok(gemistPool <= GRENS.gemistPool, "in het poolgebied hooguit de bekende gemiste schampende opkomst: " + gemistPool);
ok(extra <= GRENS.extra, "geen onterechte opkomst/ondergang in vensters zonder gebeurtenis: " + extra);

console.log(`Maanreferentie (JPL Horizons, ${REF.meta.efemeriden.join("/")}): ${n} controles geslaagd; ${REF.topocentrisch.length} topocentrische en ${REF.geocentrisch.length} geocentrische rijen, ${REF.opkomst.reduce((s, o) => s + o.gebeurtenissen.length, 0)} gebeurtenissen, offline.`);

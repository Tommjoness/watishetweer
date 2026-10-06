"use strict";

/* Stelt de broncode van de Nachtzicht-kern samen uit de eigenaren die de app
   zelf gebruikt, zodat de Nachtzicht-pagina's per nacht exact dezelfde score,
   hetzelfde oordeel en hetzelfde kijkvenster tonen als het blok Nachtzicht op
   de plaatspagina's:
   - de stand van zon en maan: letterlijk uit index.html;
   - de nachtscore (nachtzichtScore), de horizon per nacht en de maanmomenten:
     senior-correctness-v2.js, de renderer die in de productiebundel de nachten
     tekent;
   - het getoonde oordeel, "Voorlopig" en de vensterzin: mobile-screenshot-polish.js,
     met dezelfde twee tekstbewerkingen die de build op de app toepast
     (apply-unified-weather-truth.js en apply-final-presentation-consistency.js);
   - de tijdsvorm en de zin zonder venster: final-global-correctness-20260901.js;
   - de opsomming van redenen: nederlandse-weergrammatica.js.
   Als een van die eigenaren een functie hernoemt of de tekst waarop de build
   aanhaakt verandert, faalt de build hier in plaats van dat de pagina's
   stilletjes iets anders tonen dan de app. Een browsertest vergelijkt de
   uitkomst bovendien nacht voor nacht met de echte app. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const ZON_MAAN_BEGIN = "/* ---------- stand van zon en maan ---------- */";
const ZON_MAAN_EIND = "// lokale tijdstring naar UTC-milliseconden";
const MAAN_BEGIN = "function maan(d){";
const MAAN_EIND = "  return {fase:f,ill:ill,naam:naam};\n}";

const BESTAND = {
  senior: path.join(ROOT, "senior-correctness-v2.js"),
  polish: path.join(__dirname, "mobile-screenshot-polish.js"),
  presentatie: path.join(__dirname, "apply-final-presentation-consistency.js"),
  finaal: path.join(__dirname, "final-global-correctness-20260901.js"),
  grammatica: path.join(ROOT, "nederlandse-weergrammatica.js"),
  kern: path.join(__dirname, "nachtzicht-kern.js")
};
const lees = p => fs.readFileSync(p, "utf8");

function knip(bron, begin, eind, label) {
  const a = bron.indexOf(begin);
  if (a < 0 || bron.indexOf(begin, a + 1) >= 0) throw new Error(`Nachtzicht-bron: begin van ${label} ontbreekt of is dubbel.`);
  const b = bron.indexOf(eind, a);
  if (b < 0) throw new Error(`Nachtzicht-bron: einde van ${label} ontbreekt.`);
  return bron.slice(a, b + (eind.startsWith("//") ? 0 : eind.length));
}
/* Precies één regel die met `begin` start (een losse helper als const). */
function regel(bron, begin, label) {
  const regels = bron.split("\n").filter(r => r.startsWith(begin));
  if (regels.length !== 1) throw new Error(`Nachtzicht-bron: ${label} ontbreekt of is dubbel (${regels.length}).`);
  return regels[0];
}
function functie(module, naam, label) {
  const f = module && module[naam];
  if (typeof f !== "function") throw new Error(`Nachtzicht-bron: ${label}.${naam} ontbreekt.`);
  return f.toString();
}
function vervangEenmaal(bron, van, naar, label) {
  const n = bron.split(van).length - 1;
  if (n !== 1) throw new Error(`Nachtzicht-bron: ${label} ${n} keer gevonden in plaats van één keer.`);
  return bron.replace(van, () => naar);
}
/* Een template literal zonder interpolatie uit een buildscript, zonder dat
   script uit te voeren (het schrijft bij laden naar public/). */
function letterlijk(bron, naam) {
  const begin = `const ${naam}=\``;
  const a = bron.indexOf(begin);
  if (a < 0 || bron.indexOf(begin, a + 1) >= 0) throw new Error(`Nachtzicht-bron: ${naam} ontbreekt of is dubbel.`);
  const b = bron.indexOf("`;", a + begin.length);
  const ruw = bron.slice(a + begin.length, b);
  if (b < 0 || ruw.includes("${")) throw new Error(`Nachtzicht-bron: ${naam} is geen vaste tekst.`);
  return vm.runInNewContext("`" + ruw + "`");
}

function zonMaanBron(indexHtml) {
  const html = indexHtml == null ? lees(path.join(ROOT, "index.html")) : String(indexHtml);
  const stand = knip(html, ZON_MAAN_BEGIN, ZON_MAAN_EIND, "stand van zon en maan");
  const fase = knip(html, MAAN_BEGIN, MAAN_EIND, "maanfase");
  for (const naam of ["function zonPositie(", "function maanPositie(", "function hoogteVan(", "function maanHoogte(", "function opOnder("]) {
    if (!stand.includes(naam)) throw new Error(`Nachtzicht-bron: ${naam} ontbreekt in index.html.`);
  }
  return stand + "\n" + fase + "\n";
}

/* De rekenhelpers van de seniorlaag; de browserintegratie van dat bestand
   (die S en het DOM gebruikt) wordt bewust niet overgenomen. */
function seniorBron() {
  const tekst = lees(BESTAND.senior), mod = require(BESTAND.senior);
  const helpers = ["const num=", "const clampNum=", "const natCode=", "const mistCode="].map(b => regel(tekst, b, "senior " + b));
  const fns = ["nachtzichtScore", "nachtSegmentHorizon", "maanEventsBinnenVenster"].map(n => functie(mod, n, "senior"));
  return `(function(){\n"use strict";\n${helpers.join("\n")}\n${fns.join("\n")}\nreturn {nachtzichtScore,nachtSegmentHorizon,maanEventsBinnenVenster};\n})()`;
}

/* De presentatiehelpers van Nachtzicht, met de tekstbewerkingen die de build
   in dezelfde volgorde op de app toepast. */
function presentatieBron() {
  const tekst = lees(BESTAND.polish), mod = require(BESTAND.polish), build = lees(BESTAND.presentatie);
  const helpers = ["const getal=", "const begrens=", "const hhmmIso="].map(b => regel(tekst, b, "polish " + b));
  const los = ["function minuutVanTijd(", "function tijdVanMinuut(", "function opTijdlijn("].map(b => regel(tekst, b, "polish " + b));
  const fns = ["nachtOordeelGetoond", "nachtAdviesMetHorizon", "dagdeelVanUur", "datumVerschuif", "normaliseerNachtDagdata", "nachtIsActiefNu"].map(n => functie(mod, n, "polish"));
  let venster = functie(mod, "corrigeerNachtVensterBron", "polish");
  /* apply-unified-weather-truth.js: "Geen goed zichtvenster" heet in de app "Geen gunstig kijkvenster". */
  if (!/Geen goed zichtvenster/.test(venster)) throw new Error("Nachtzicht-bron: zichtvenster-tekst in corrigeerNachtVensterBron ontbreekt.");
  venster = venster.replace(/Geen goed zichtvenster/g, "Geen gunstig kijkvenster");
  /* apply-final-presentation-consistency.js: scorebewuste zin zonder venster. */
  venster = vervangEenmaal(venster, letterlijk(build, "NACHT_OUD"), letterlijk(build, "NACHT_NIEUW"), "NACHT_OUD in corrigeerNachtVensterBron");
  return `(function(){\n"use strict";\n${helpers.join("\n")}\n${los.join("\n")}\n${fns.join("\n")}\n${venster}\nreturn {nachtOordeelGetoond,nachtAdviesMetHorizon,corrigeerNachtVensterBron,hhmmIso,normaliseerNachtDagdata,nachtIsActiefNu};\n})()`;
}

function kernBron(indexHtml) {
  return zonMaanBron(indexHtml)
    + lees(BESTAND.grammatica) + "\n"
    + lees(BESTAND.finaal) + "\n"
    + `globalThis.WeatherNowNachtzichtProductie={senior:${seniorBron()},presentatie:${presentatieBron()}};\n`
    + lees(BESTAND.kern);
}

/* Voor tests: de kern in een eigen context laden, precies zoals de browser hem krijgt. */
function laadKern(indexHtml) {
  const context = { Intl, Date, Math, Number, String, Array, Object, JSON, Set, RegExp, console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(kernBron(indexHtml), context, { filename: "nachtzicht-kern-samengesteld.js" });
  return context.WeatherNowNachtzichtKern;
}

module.exports = { zonMaanBron, seniorBron, presentatieBron, kernBron, laadKern };

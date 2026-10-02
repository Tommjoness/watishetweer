"use strict";

/*
 * Taalkwaliteit Engels: vult iedere zinsvorm uit de app met álle waarden die
 * erin kunnen staan (weertypen, kansen, dagdelen, windkracht 0–12, alle 16
 * windrichtingen, getallen 0, 1, −1, decimalen, tijden, dagen, maanden,
 * maanfasen, UV, pollen, luchtkwaliteit, oorzaken in iedere volgorde) en
 * controleert de Engelse uitkomst op taalregels:
 *   - iedere combinatie heeft een vertaling;
 *   - enkelvoud/meervoud (1 hour, 2 hours; there is rain, there are showers);
 *   - a/an, geen dubbele woorden of leestekens, geen dubbele spaties;
 *   - decimale punt, geen Nederlandse woorden, hoofdletter na een punt;
 *   - Engelse Beaufortnamen (7 near gale … 12 hurricane force).
 * Gebruik: node scripts/taal-kwaliteit.test.js [--lijst uitvoer.txt]
 */

const assert = require("assert");
const fs = require("fs");
const kern = require("../taal/vertaalkern.js");
const woordenboek = require("../taal/en.js");

const v = kern.maakVertaler(woordenboek);
const { WEER, WINDKRACHT, RICHTING_VOL, RICHTING_KORT } = woordenboek.lijsten;

/* ---------- Waarden ---------- */
const weerNamen = Object.keys(WEER);
/* Na "kans op" en vóór "mogelijk" zet de app alleen een neerslagsoort. */
const kansWeer = weerNamen.filter(w => /regen|motregen|sneeuw|buien|onweer|ijzel|hagel|neerslag|druppels/.test(w) && !/mogelijk|kans op/.test(w));
const neerslagTypen = ["neerslag", "regen", "lichte regen", "zware regen", "motregen", "lichte motregen", "sneeuw", "lichte sneeuw", "buien", "regenbuien", "sneeuwbuien", "onweer", "ijzel", "hagel"].filter(w => WEER[w]);
const kansen = ["zeer kleine", "kleine", "grote", "zeer grote"];
const dagdelen = ["in de vroege ochtend", "in de ochtend", "in de middag", "in de avond", "in de nacht"];
const richtingen = Object.keys(RICHTING_VOL);
const bftNamen = ["windstil", "zwakke wind", "zwakke wind", "matige wind", "matige wind", "vrij krachtige wind", "krachtige wind", "harde wind", "stormachtige wind", "storm", "zware storm", "zeer zware storm", "orkaan"];
const getallen = ["0", "1", "-1", "−1", "2", "12", "0,9", "1,5", "24"];
const gehelen = ["0", "1", "2", "12", "35"];
const tijden = ["00:00", "07:45", "16:00", "23:59"];
const dagenKort = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const dagenVol = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
const maanden = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const maandenKort = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const maanfasen = ["nieuwe maan", "wassende sikkel", "eerste kwartier", "wassende maan", "volle maan", "afnemende maan", "laatste kwartier", "afnemende sikkel"];
const oorzaakDelen = ["neerslag", "bewolking", "maanlicht", "mist of zeer slecht zicht", "wind", "vocht"];
const uvNiveaus = ["laag", "matig", "hoog", "zeer hoog", "extreem"];
const pollenNiveaus = ["Weinig", "Matig veel", "Veel", "Zeer veel"];
const pollenSoorten = ["graspollen", "berkenpollen", "elzenpollen", "bijvoetpollen", "ambrosiapollen", "olijfpollen"];
const hoofd = s => s.charAt(0).toUpperCase() + s.slice(1);

function oorzaakLijsten() {
  const uit = [];
  for (const a of oorzaakDelen) {
    uit.push(a);
    for (const b of oorzaakDelen) if (b !== a) {
      uit.push(`${a} en ${b}`);
      for (const c of oorzaakDelen) if (c !== a && c !== b) uit.push(`${a}, ${b} en ${c}`);
    }
  }
  return uit;
}

/* ---------- Zinsvormen van de app ---------- */
function* combinaties() {
  for (const w of weerNamen) { yield hoofd(w); yield hoofd(w) + "."; yield w; }
  for (const w of weerNamen) for (const k of ["zeer kleine", "kleine", "grote", "zeer grote"]) yield `${hoofd(w)}; ${k} neerslagkans`;
  for (const w of weerNamen) for (const n of kansWeer) yield `${hoofd(w)}; ${n} mogelijk`;
  for (const k of kansen) for (const w of kansWeer) {
    yield `${hoofd(k)} kans op ${w}`;
    yield `${hoofd(k)} kans op ${w}.`;
    for (const d of dagdelen) yield `${hoofd(k)} kans op ${w} ${d}`;
  }
  for (const w of kansWeer) { yield `${hoofd(w)} mogelijk`; for (const d of dagdelen) yield `${hoofd(w)} mogelijk ${d}`; }
  for (const w of neerslagTypen) {
    yield `Er valt nu ${w}.`;
    yield `Volgens het weermodel valt er nu ${w}.`;
    for (const k of kansen) {
      yield `De komende twee uur is er een ${k} kans op ${w}.`;
      yield `Er is een ${k} kans op ${w} in de komende twee uur (maximaal 40%).`;
    }
  }
  for (const w of ["buien", "regenbuien", "sneeuwbuien"]) yield `Er vallen nu ${w}.`;
  for (let b = 0; b < bftNamen.length; b++) {
    const naam = bftNamen[b];
    /* Zo schrijft de app de windtegel: 0 Bft is "Vrijwel windstil.", zonder richting volgt een extra zin. */
    if (b === 0) continue;
    for (const r of richtingen) yield `${hoofd(naam)} uit het ${r} (${b} Bft).`;
    yield `${hoofd(naam)} (${b} Bft). Windrichting niet beschikbaar.`;
    if (naam !== "windstil") yield `In de komende 24 uur is de wind het sterkst, met ${b} Bft (${naam}).`;
  }
  for (const r of richtingen) { yield `De wind komt uit het ${r}.`; for (const r2 of ["noorden", "zuidwesten"]) yield `De wind komt uit het ${r} en draait naar het ${r2}.`; }
  for (const r of Object.keys(RICHTING_KORT)) for (const b of [0, 1, 7, 12]) yield `${r} ${b} Bft`;
  for (const g of getallen) {
    for (const m of ["graden", "graad"]) {
      yield `Morgen wordt het ongeveer ${g} ${m}.`;
      yield `Vannacht koelt het af naar ongeveer ${g} ${m}.`;
      yield `Vannacht daalt de temperatuur naar ongeveer ${g} ${m}.`;
      yield `Vannacht loopt de temperatuur op naar ongeveer ${g} ${m}.`;
      yield `Vannacht blijft de temperatuur rond ${g} ${m}.`;
      yield `De minimumtemperatuur vannacht ligt rond ${g} ${m}.`;
      yield `De maximumtemperatuur van vandaag ligt rond ${g} ${m}.`;
      yield `Het verwachte maximum voor morgen is ${g} ${m}.`;
      for (const t of tijden.slice(1, 3)) {
        yield `Het verwachte maximum lag vandaag rond ${t} op ${g} ${m}.`;
        yield `Het verwachte maximum ligt morgen rond ${t} op ${g} ${m}.`;
        yield `De temperatuur blijft tot rond ${t} ongeveer ${g} ${m}.`;
      }
      yield `De temperatuur blijft de komende uren rond ${g} ${m}.`;
      yield `${g} ${m}`;
    }
    yield `De temperatuur blijft de komende uren rond ${g} °C.`;
    yield `Gevoelstemperatuur ${g}°C`;
    yield `${g}°`; yield `nu ${g}°`; yield `voelt ${g}°`;
    if (!/^[−-]/.test(g)) { yield `Voor vandaag is ${g} uur zon berekend.`; yield `${g} uur`; yield `${g} mm`; }
    yield `Er valt nu neerslag: ${g} mm/u.`;
    yield `Verwachte hoeveelheid: ongeveer ${g} mm.`;
    yield `In totaal ongeveer ${g} mm.`;
    yield `In de komende twee uur wordt daarna ongeveer ${g} mm verwacht.`;
    yield `Als er neerslag valt, berekent het model ongeveer ${g} mm.`;
    yield `Gemiddeld zicht: ${g} km`;
  }
  /* Grafiekvenster bij een gekozen uur (audit F04). */
  for (const l of ["temperatuur", "voelt als", "wind", "windstoten", "bewolking", "neerslag", "kans komend uur", "kans 16:00–17:00", "geen neerslag verwacht", "16:00 · bewolkt", "03:00 · lichte regen", "12 km/u WZW, 3 Bft", "4 km/u, 1 Bft", "48 km/u", "30 km/u NNO, 5 Bft", "02:00, neerslagkans 8%", "14:00, neerslagkans 65%, verwacht 1,4 mm"]) yield l;
  for (const [a, b] of [["Licht", "Donker"], ["Donker", "Licht"]]) {
    yield `Handmatig ${a} voor deze browsersessie. Klik om ${b} te kiezen.`;
    yield `Huidige handmatige keuze: ${a} (deze browsersessie).`;
  }
  for (const n of gehelen) {
    yield `Zonsondergang over ${n} ${n === "1" ? "minuut" : "minuten"}, vandaag om 19:15.`;
    yield `Zonsopkomst over ${n} ${n === "1" ? "minuut" : "minuten"}, morgen om 07:43.`;
    for (const u of ["1", "2"]) {
      yield `Zonsondergang over ${u} uur en ${n} ${n === "1" ? "minuut" : "minuten"}, vandaag om 19:15.`;
      yield `Zonsopkomst over ${u} uur en ${n} ${n === "1" ? "minuut" : "minuten"}, morgen om 07:43.`;
    }
    yield `${n} uur daglicht`;
    yield n === "1" ? "1 plaats gevonden." : `${n} plaatsen gevonden.`;
    yield `Gegevens opgehaald om 22:01 · ${n} min geleden`;
    yield `Komend uur: ${n}% kans.`;
    yield `Komend uur is de neerslagkans ${n}%.`;
    yield `Later vandaag loopt de neerslagkans op tot ${n}%.`;
    yield `Bewolking ${n}%`;
    yield `${n}% kans`;
    yield `Neerslag vandaag vanaf nu: ${n} procent.`;
    yield `${n} korrels/m³`;
    yield `${n} korrel/m³`;
    yield `<${n} korrel/m³`;
    yield `Hoogste neerslagkans in één uur ${n} procent; 1,5 mm`;
    yield `Kans op neerslag: ${n}% · verwachte hoeveelheid: 0,4 mm.`;
    yield `16:00, 1 graad, ${n} procent neerslagkans`;
    yield `16:00, ${n} graden, ${n} procent neerslagkans`;
    yield `${n}% is de hoogste neerslagkans in één uur in de resterende uren van vandaag.`;
    for (const d of dagenKort) yield `${n}% is de hoogste neerslagkans in één uur op ${d} 2.`;
  }
  for (const t of tijden) {
    yield `Rond ${t} wordt het naar verwachting droog.`;
    yield `Rond ${t} wordt het droog.`;
    yield `Vanaf ongeveer ${t} wordt neerslag verwacht.`;
    yield `zon op ${t}`; yield `zon onder ${t}`; yield `maan op ${t}`; yield `maan onder ${t}`;
    yield `Maanopkomst om ${t}.`; yield `Maanondergang om ${t}.`;
    yield `Vandaag om ${t}.`; yield `Morgen om ${t}.`;
    yield `Geldig tot ${t}.`; yield `Geldig tot morgen ${t}.`;
    yield `Actieve nacht tot zonsopkomst ${t}`;
    for (const u of uvNiveaus) { yield `Verwachte UV-piek rond ${t} · ${u}.`; yield `Verwachte UV-piek lag rond ${t} · ${u}.`; }
    for (const p of ["Beste", "Relatief beste", "Waarschijnlijk beste"]) { yield `${p} periode: ${t}–23:59.`; yield `${p} periode: nu tot ${t}.`; }
  }
  for (const p of ["Beste", "Relatief beste", "Waarschijnlijk beste"]) {
    for (const d of dagdelen) yield `${p} periode ${d}.`;
    for (const [a, b] of [["avond", "nacht"], ["avond", "vroege ochtend"], ["nacht", "vroege ochtend"], ["nacht", "ochtend"], ["vroege ochtend", "ochtend"]]) yield `${p} periode van de ${a} tot de ${b}.`;
  }
  for (const o of oorzaakLijsten()) {
    yield `Geen gunstig kijkvenster door ${o}.`;
    yield `Matige omstandigheden, maar door ${o} geen gunstig kijkvenster.`;
    for (const q of ["Uitstekende", "Goede", "Redelijke"]) yield `${q} omstandigheden, maar door ${o} is er geen aaneengesloten gunstig kijkvenster.`;
    yield `De omstandigheden zijn redelijk, maar ${o} onderbreekt een langer gunstig kijkvenster.`;
    yield `De totale zichtscore is hoog, maar ${o} onderbreekt een langer optimaal kijkvenster.`;
  }
  for (const f of maanfasen) { yield hoofd(f); yield `${f}, 1 procent verlicht`; yield `${f}, 71 procent verlicht`; }
  for (const u of uvNiveaus) { yield hoofd(u); yield `Verwachte UV-piek vandaag: 7,5 (${u}).`; }
  for (const n of pollenNiveaus) for (const s of pollenSoorten) yield `${n} ${s} verwacht voor dit uur.`;
  for (const l of ["zeer slecht", "slecht", "extreem slecht"]) yield `Luchtkwaliteit volgens het model is ${l} (Europese AQI 85).`;
  for (const z of ["Uitstekend", "Goed", "Redelijk", "Matig", "Ongunstig", "Slecht", "Onbekend", "Voorlopig goed"]) yield z;
  for (const d of dagenKort) { yield d; yield `${d} 2`; yield `${d} 2 okt`; yield `${d} 23 jul 14:00`; yield `${hoofd(d)} op ${dagenKort[(dagenKort.indexOf(d) + 1) % 7]}`; }
  for (const d of dagenVol) { yield hoofd(d); yield `${hoofd(d)} 2`; yield `${d} 2 oktober, per uur`; }
  for (const m of maanden) yield `Verloop van 1 ${m} 2026 om 22:00 tot 2 ${m} 2026 om 22:00, temperatuur tussen 12 en 21 graden, hoogste neerslagkans 37 procent.`;
  for (const m of maandenKort) yield `vr 2 ${m}`;
  for (const k of ["geel", "oranje", "rood"]) for (const w of ["onweersbuien", "zware windstoten", "gladheid", "hitte", "mist", "sneeuw", "regen", "storm"]) {
    yield `Code ${k}: ${w}`;
    yield `Officiële weerwaarschuwing (${k}): Code ${k}: ${w}.`;
  }
  yield "Neerslagperioden: 16:00–18:00 · 4,8 mm; daarna 21:00–22:00 · 0,4 mm; plus 1 latere periode.";
  yield "Neerslagperioden: 16:00–18:00 · 4,8 mm; plus 3 latere perioden.";
  yield "Verwachte meetbare neerslag: vr 23:00–za 02:00 · 1.750 mm.";
  yield "Weer Almere vandaag, morgen en per uur";
  yield "Weer Capelle aan den IJssel vandaag, morgen en per uur";
  yield "Het weer vandaag, morgen en per uur | watishetweer.nl";
  for (const p of ["Noord-Holland", "Zuid-Holland", "Noord-Brabant", "Utrecht", "Fryslân"]) yield `Bekijk het actuele weer in Haarlem, ${p}, met neerslag voor de komende uren en de 7-daagse verwachting.`;
}

/* ---------- Taalregels ---------- */
const NL = /\b(de|het|een|van|en|niet|uur|graden|graad|neerslag|kans|vandaag|morgen|vannacht|droog|bewolkt|regen|sneeuw|wind uit|zon|maan|verwacht|ongeveer|rond|om|tot)\b/i;
const regels = [
  [/\bthere is (?:(?:light|heavy|severe|rain|snow) )*(showers|thunderstorms|grains)\b/i, "is + meervoud"],
  [/(^|[^\d.,−-])1 (hours|minutes|degrees|days|places|periods|seconds)\b/, "1 + meervoud"],
  [/(^|[^\d.,])(?:[02-9]|\d{2,}) (hour|minute|degree|day|place|period)\b(?!s)/, "meervoud ontbreekt"],
  [/\b1 hours? of sunshine are\b|\bhours of sunshine is\b/, "werkwoord telt niet mee"],
  [/\ba (?=[aeiou])(?!one|uni|use|eu)/i, "a voor klinker"],
  [/\ban (?=[^aeiouh\s])/i, "an voor medeklinker"],
  [/\b(\w+) \1\b/i, "dubbel woord"],
  [/ {2,}/, "dubbele spatie"],
  [/ [.,;:]/, "spatie voor leesteken"],
  [/\.\.(?!\.)|,,|;;/, "dubbel leesteken"],
  [/\d,\d{1,2}(?!\d)/, "decimale komma"],
  [/[.!?] [a-z]/, "kleine letter na punt"],
  [/\b(of|for|with|and|the) [A-Z][a-z]+ (rain|snow|drizzle|showers|cloud)/, "hoofdletter midden in zin"],
  [/\b(storm|severe storm) from the\b.*\(9 Bft\)|\bvery strong wind\b.*\(7 Bft\)/i, "Beaufortnaam"],
  [/\bundefined\b|\bnull\b|NaN|\$\{/, "lege waarde"]
];
const BEAUFORT_EN = ["calm", "light wind", "light wind", "moderate wind", "moderate wind", "fresh wind", "strong wind", "near gale", "gale", "severe gale", "storm", "violent storm", "hurricane-force wind"];

const lijst = [];
const fouten = [];
let aantal = 0;
const gezien = new Set();
for (const nl of combinaties()) {
  if (gezien.has(nl)) continue;
  gezien.add(nl);
  aantal++;
  const en = v.vertaal(nl);
  if (en == null) { fouten.push(`geen vertaling: ${nl}`); continue; }
  lijst.push(`${nl}\n  → ${en}`);
  if (NL.test(en) && !/watishetweer\.nl|Capelle aan den IJssel|Haarlem|Almere/.test(en)) fouten.push(`Nederlands woord: ${nl} → ${en}`);
  for (const [re, naam] of regels) if (re.test(en)) fouten.push(`${naam}: ${nl} → ${en}`);
}
bftNamen.forEach((naam, b) => {
  const en = v.vertaal(`${hoofd(naam)} uit het westen (${b} Bft).`);
  const want = naam === "windstil" ? null : BEAUFORT_EN[b];
  if (want && !en.toLowerCase().startsWith(want)) fouten.push(`Beaufort ${b}: ${en} (verwacht ${want})`);
});

const pos = process.argv.indexOf("--lijst");
if (pos > 0) fs.writeFileSync(process.argv[pos + 1], lijst.join("\n") + "\n");
assert.deepStrictEqual(fouten.slice(0, 40), [], `${fouten.length} taalfouten in ${aantal} combinaties:\n` + fouten.slice(0, 40).join("\n"));
console.log(`Taalkwaliteit Engels: ${aantal} combinaties vertaald en gecontroleerd op enkelvoud/meervoud, a/an, leestekens, decimale punt, Nederlandse resten en Beaufortnamen.`);

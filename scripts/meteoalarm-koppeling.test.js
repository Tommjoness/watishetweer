"use strict";
/*
 * Waarschuwingen per plaats via de MeteoAlarm-regiocode (EMMA_ID), zonder netwerk:
 *   - de regiovormen (lib/meteoalarm-gebieden-data.cjs) hebben bron en licentie
 *     en leggen bekende plaatsen in de juiste regio;
 *   - een waarschuwing met alleen een regiocode geldt voor plaatsen in die regio
 *     (alle gebieden waarin de plaats ligt, ook kustwater: eigenaar 4 okt, 1A)
 *     en voor geen andere; een onbekende code bewijst niets;
 *   - een waarschuwing die aantoonbaar elders geldt, verschijnt nergens: de app
 *     toont alleen wat voor deze plaats geldt (eigenaar 4 okt);
 *   - kop uit niveau en soort voor alle soorten, in het Nederlands en Engels.
 */
const assert = require("assert");
const data = require("../lib/meteoalarm-gebieden-data.cjs");
const { regioBevat, regioNaam } = require("../lib/meteoalarm-gebieden.cjs");
const { uitCap, eldersSamenvatting } = require("../lib/waarschuwingen.cjs")._intern;
const { alleenPlaatsgebonden } = require("../lib/waarschuwing-scope.cjs");
const v = require("../taal/vertaalkern.js").maakVertaler(require("../taal/en.js"));

/* 1. Databestand */
assert.match(data.licentie, /CC BY 4\.0/, "licentie MeteoAlarm vastgelegd");
assert.match(data.bron, /MeteoAlarm/, "bron vastgelegd");
assert(data.aantal >= 2000, "alle MeteoAlarm-regio's aanwezig (" + data.aantal + ")");
for (const land of ["NL", "BE", "DE", "ES", "PL", "HR", "CZ", "AT"]) assert(data.landen[land], "regiovormen voor " + land);
assert.equal(Object.keys(JSON.parse(data.landen.NL)).length, 25, "Nederland: 12 provincies, Waddeneilanden en 12 kustwatergebieden");

/* 2. Plaatsen in de juiste regio */
const PLAATS = {
  Assen: [52.993, 6.562], Utrecht: [52.091, 5.122], Amsterdam: [52.37, 4.90], Rotterdam: [51.922, 4.479],
  Maastricht: [50.851, 5.69], Lelystad: [52.518, 5.471], Vlissingen: [51.442, 3.573], Brussel: [50.85, 4.35],
  Berlijn: [52.52, 13.40], Barcelona: [41.385, 2.173], Oslo: [59.91, 10.75]
};
const verwacht = [
  ["NL018", "Assen", true], ["NL018", "Utrecht", false], ["NL015", "Utrecht", true], ["NL011", "Amsterdam", true],
  ["NL009", "Rotterdam", true], ["NL012", "Maastricht", true], ["NL008", "Lelystad", true], ["NL010", "Vlissingen", true],
  ["NL812", "Vlissingen", true], ["BE004", "Brussel", true], ["DE202", "Berlijn", true], ["NL018", "Berlijn", false],
  ["XX999", "Assen", null], ["", "Assen", null]
];
for (const [code, plaats, uit] of verwacht) assert.strictEqual(regioBevat(code, ...PLAATS[plaats]), uit, `${code} bevat ${plaats}: ${uit}`);
assert.strictEqual(regioBevat("nl018", ...PLAATS.Assen), true, "code ongeacht hoofdletters");
assert.strictEqual(regioBevat("NL018", NaN, 6.5), null, "zonder geldig punt geen uitspraak");
assert.equal(regioNaam("NL018"), "Drenthe");

/* 3. Waarschuwingen met alleen een regiocode (zoals KNMI) */
const morgen = new Date(Date.now() + 864e5).toISOString();
const info = (code, gebied, niveau, soort, taal = "nl-NL") => ({
  language: taal, event: "Windstoten", headline: `Code ${niveau === 2 ? "geel" : "groen"} ${gebied}`, description: "Zware windstoten.",
  expires: morgen, severity: "Moderate",
  parameter: [{ valueName: "awareness_level", value: niveau + "; " + (niveau === 2 ? "yellow; Moderate" : "green; Minor") },
    { valueName: "awareness_type", value: soort }],
  area: [{ areaDesc: gebied, geocode: [{ valueName: "EMMA_ID", value: code }] }]
});
const feed = { warnings: [
  { alert: { info: [info("NL018", "Drenthe", 2, "1; Wind"), info("NL018", "Drenthe", 2, "1; Wind", "en-GB")] } },
  { alert: { info: [info("NL812", "Zierikzee", 2, "4; Fog")] } },
  { alert: { info: [info("NL015", "Utrecht", 1, "1; Wind")] } },
  { alert: { info: [info("NL999", "Onbekend gebied", 2, "10; Rain")] } }
] };
const voor = plaats => uitCap(feed, ...PLAATS[plaats], Date.now(), "nl");
{
  const lijst = voor("Assen");
  const lokaal = lijst.filter(w => w.plaatsSpecifiek);
  assert.deepEqual(lokaal.map(w => w.gebied), ["Drenthe"], "Assen: de waarschuwing voor Drenthe geldt hier, één keer (Nederlandse tekst)");
  assert.equal(lokaal[0].kleur, "geel");
  assert.equal(lokaal[0].titel, "Code geel: wind", "kop uit niveau en soort");
  assert(!lijst.some(w => w.gebied === "Zierikzee"), "Assen: de mist bij Zierikzee geldt elders en verschijnt niet");
  assert.deepEqual(lijst.filter(w => !w.plaatsSpecifiek).map(w => w.gebied), ["Onbekend gebied"], "onbekende regiocode blijft onbewezen");
}
{
  const lijst = voor("Utrecht");
  assert.equal(lijst.filter(w => w.plaatsSpecifiek).length, 0, "Utrecht: geen eigen waarschuwing (groen telt niet)");
  assert(!lijst.some(w => w.gebied === "Drenthe" || w.gebied === "Zierikzee"), "Utrecht: Drenthe en Zierikzee gelden elders en verschijnen niet");
}
{
  const lijst = voor("Vlissingen");
  assert.deepEqual(lijst.filter(w => w.plaatsSpecifiek).map(w => w.gebied), ["Zierikzee"], "Vlissingen ligt in het kustwatergebied Zierikzee: die waarschuwing telt (keuze 1A)");
}

/* 4. Servergrens */
{
  /* Alleen waarschuwingen elders: bewezen geen eigen waarschuwing, en geen
     regel over elders ("Geen officiële weerwaarschuwingen voor deze locatie."). */
  const lijst = uitCap({ warnings: feed.warnings.slice(0, 3) }, ...PLAATS.Utrecht, Date.now(), "nl");
  const uit = alleenPlaatsgebonden({ bron: "MeteoAlarm netherlands", dekking: true, plaatsSpecifiek: true, land: "NL", lijst,
    ...(eldersSamenvatting(lijst, "NL") ? { elders: eldersSamenvatting(lijst, "NL") } : {}) });
  assert.equal(uit.dekking, true, "Utrecht: dekking");
  assert.deepEqual(uit.lijst, [], "Utrecht: geen eigen waarschuwing");
  assert.equal(uit.elders, undefined, "Utrecht: geen melding over waarschuwingen elders");
}
{
  /* Een niet te koppelen waarschuwing: eerlijk "kunnen we nog niet bepalen". */
  const lijst = voor("Utrecht");
  const uit = alleenPlaatsgebonden({ bron: "MeteoAlarm netherlands", dekking: true, plaatsSpecifiek: true, land: "NL", lijst,
    elders: eldersSamenvatting(lijst, "NL") });
  assert.equal(uit.dekking, false);
  assert.deepEqual(uit.elders.groepen.map(g => g.type + ":" + g.gebieden.join()), ["regen:Onbekend gebied"], "alleen de onbewezen waarschuwing, niet die van elders");
}

/* 5. Engelse tekst van de eerlijke melding (die had nog geen vertaling). */
assert.equal(
  v.vertaal("In Frankrijk geldt nu code rood voor overstromingen (Hérault); code oranje voor regen en overstromingen (Gard, Var, Var2 en 2 andere gebieden). Of dit ook voor deze plaats geldt, kunnen we nog niet bepalen."),
  "In France: red warning for flooding (Hérault); orange warning for rain and flooding (Gard, Var, Var2 and 2 other areas). We cannot yet tell whether this applies to this place."
);
assert.equal(v.vertaal("In Nederland geldt nu code geel voor wind (Drenthe). Of dit ook voor deze plaats geldt, kunnen we nog niet bepalen."),
  "In the Netherlands: yellow warning for wind (Drenthe). We cannot yet tell whether this applies to this place.");

/* 6. Alle MeteoAlarm-soorten (awareness_type 1–13) in geel, oranje en rood:
      geldt in de eigen regio, niet elders; kop en briefing in Nederlands en Engels. */
{
  const SOORTEN = { 1: ["Wind", "wind", "wind"], 2: ["snow-ice", "sneeuw en ijzel", "snow and ice"], 3: ["Thunderstorm", "onweer", "thunderstorms"],
    4: ["Fog", "mist", "fog"], 5: ["high-temperature", "hitte", "heat"], 6: ["low-temperature", "kou", "cold"], 7: ["coastalevent", "kustgevaar", "coastal hazards"],
    8: ["forest-fire", "bosbrandgevaar", "forest fire danger"], 9: ["avalanches", "lawinegevaar", "avalanche danger"], 10: ["Rain", "regen", "rain"],
    12: ["flooding", "overstromingen", "flooding"], 13: ["rain-flood", "regen en overstromingen", "rain and flooding"] };
  const KLEUR = { 2: ["yellow", "geel", "yellow"], 3: ["orange", "oranje", "orange"], 4: ["red", "rood", "red"] };
  for (const [n, [api, nl, en]] of Object.entries(SOORTEN)) for (const [lvl, [k, kNl, kEn]] of Object.entries(KLEUR)) {
    const blok = { language: "nl-NL", event: "X", description: "Y", expires: morgen,
      parameter: [{ valueName: "awareness_level", value: `${lvl}; ${k}; Moderate` }, { valueName: "awareness_type", value: `${n}; ${api}` }],
      area: [{ areaDesc: "Zeeland", geocode: [{ valueName: "EMMA_ID", value: "NL010" }] }] };
    const zeeland = uitCap({ warnings: [{ alert: { info: [blok] } }] }, ...PLAATS.Vlissingen, Date.now(), "nl");
    assert.equal(zeeland.filter(w => w.plaatsSpecifiek).length, 1, `${api} ${k}: geldt in Vlissingen`);
    assert.equal(zeeland[0].titel, `Code ${kNl}: ${nl}`, `${api} ${k}: kop uit niveau en soort`);
    assert.equal(v.vertaal(zeeland[0].titel), `${kEn[0].toUpperCase() + kEn.slice(1)} warning for ${en}`, `${api} ${k}: Engelse kop`);
    assert.equal(v.vertaal(`Officiële weerwaarschuwing: Code ${kNl}: ${nl}.`), `Official weather warning: ${kEn} warning for ${en}.`, `${api} ${k}: briefing in het Engels`);
    assert.deepEqual(uitCap({ warnings: [{ alert: { info: [blok] } }] }, ...PLAATS.Utrecht, Date.now(), "nl"), [], `${api} ${k}: niet in Utrecht`);
    const melding = `In Nederland geldt nu code ${kNl} voor ${nl}. Of dit ook voor deze plaats geldt, kunnen we nog niet bepalen.`;
    assert.equal(v.vertaal(melding), `In the Netherlands: ${kEn} warning for ${en}. We cannot yet tell whether this applies to this place.`, `${api} ${k}: eerlijke melding Engels`);
  }
}
console.log("MeteoAlarm-koppeling: regiovormen (CC BY 4.0), plaatsen in de juiste regio, waarschuwing per regiocode, kustwater telt mee, niets van elders, kop en meldingen voor alle 12 soorten in Nederlands en Engels geslaagd.");

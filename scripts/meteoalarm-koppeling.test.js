"use strict";
/*
 * Waarschuwingen per plaats via de MeteoAlarm-regiocode (EMMA_ID), zonder netwerk:
 *   - de regiovormen (lib/meteoalarm-gebieden-data.cjs) hebben bron en licentie
 *     en leggen bekende plaatsen in de juiste regio;
 *   - een waarschuwing met alleen een regiocode geldt voor plaatsen in die regio
 *     en voor geen andere; een onbekende code bewijst niets;
 *   - waarschuwingen elders voeden de korte regel "Elders in …" (eigenaar 4 okt:
 *     alle gebieden waarin de plaats ligt tellen, ook kustwater; de regel blijft);
 *   - de Nederlandse en Engelse tekst van die regel.
 */
const assert = require("assert");
const data = require("../lib/meteoalarm-gebieden-data.cjs");
const { regioBevat, regioNaam } = require("../lib/meteoalarm-gebieden.cjs");
const { uitCap, eldersSamenvatting } = require("../lib/waarschuwingen.cjs")._intern;
const { alleenPlaatsgebonden } = require("../lib/waarschuwing-scope.cjs");
const { weatherNowWaarschuwingElders } = require("./warning-render-state.js");

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
function voor(plaats) {
  const elders = [];
  const lijst = uitCap(feed, ...PLAATS[plaats], Date.now(), "nl", elders);
  return { lijst, elders };
}
{
  const { lijst, elders } = voor("Assen");
  const lokaal = lijst.filter(w => w.plaatsSpecifiek);
  assert.deepEqual(lokaal.map(w => w.gebied), ["Drenthe"], "Assen: de waarschuwing voor Drenthe geldt hier, één keer (Nederlandse tekst)");
  assert.equal(lokaal[0].kleur, "geel");
  assert.deepEqual(elders.map(w => w.gebied), ["Zierikzee"], "Assen: de mist bij Zierikzee geldt elders");
  assert.deepEqual(lijst.filter(w => !w.plaatsSpecifiek).map(w => w.gebied), ["Onbekend gebied"], "onbekende regiocode blijft onbewezen");
}
{
  const { lijst, elders } = voor("Utrecht");
  assert.equal(lijst.filter(w => w.plaatsSpecifiek).length, 0, "Utrecht: geen eigen waarschuwing (groen telt niet)");
  assert.deepEqual(elders.map(w => w.gebied).sort(), ["Drenthe", "Zierikzee"], "Utrecht: Drenthe en Zierikzee gelden elders");
  /* Hooguit twee groepen (kleur en soort); de onbewezen regenwaarschuwing telt
     ook mee als "elders", net als nu. */
  const samenvatting = eldersSamenvatting(lijst.concat(elders), "NL");
  assert.equal(samenvatting.landNaam, "Nederland");
  assert.equal(samenvatting.groepen.length, 2);
  assert(samenvatting.groepen.some(g => g.type === "wind" && g.gebieden.join() === "Drenthe"), "wind in Drenthe staat in de regel elders");
  const zonderOnbekend = [];
  const l2 = uitCap({ warnings: feed.warnings.slice(0, 3) }, ...PLAATS.Utrecht, Date.now(), "nl", zonderOnbekend);
  assert.deepEqual(eldersSamenvatting(l2.concat(zonderOnbekend), "NL").groepen.map(g => g.type + ":" + g.gebieden.join(",")).sort(), ["mist:Zierikzee", "wind:Drenthe"]);
}
{
  const { lijst } = voor("Vlissingen");
  assert.deepEqual(lijst.filter(w => w.plaatsSpecifiek).map(w => w.gebied), ["Zierikzee"], "Vlissingen ligt in het kustwatergebied Zierikzee: die waarschuwing telt (keuze 1A)");
}

/* 4. Servergrens: alleen bewezen waarschuwingen; de regel elders blijft bewaard. */
{
  const feedZonderOnbekend = { warnings: feed.warnings.slice(0, 3) };
  const elders = [];
  const lijst = uitCap(feedZonderOnbekend, ...PLAATS.Utrecht, Date.now(), "nl", elders);
  const uit = alleenPlaatsgebonden({ bron: "MeteoAlarm netherlands", dekking: true, plaatsSpecifiek: true, land: "NL", lijst,
    elders: eldersSamenvatting(lijst.concat(elders), "NL") });
  assert.equal(uit.dekking, true, "Utrecht: dekking, want de waarschuwingen zijn aantoonbaar voor andere gebieden");
  assert.deepEqual(uit.lijst, [], "Utrecht: geen eigen waarschuwing");
  assert(uit.elders && uit.elders.groepen.length === 2, "Utrecht: de regel elders gaat mee naar de app");
}

/* 5. Tekst van de regel, Nederlands en Engels */
{
  const esc = t => String(t);
  const nl = weatherNowWaarschuwingElders({ landNaam: "Nederland", groepen: [{ kleur: "geel", type: "wind", gebieden: ["Drenthe"], meer: 0 }] }, esc, true);
  assert.equal(nl, "Elders in Nederland geldt nu code geel voor wind (Drenthe).");
  const v = require("../taal/vertaalkern.js").maakVertaler(require("../taal/en.js"));
  assert.equal(v.vertaal(nl), "Elsewhere in the Netherlands: yellow warning for wind (Drenthe).");
  assert.equal(
    v.vertaal("In Frankrijk geldt nu code rood voor overstromingen (Hérault); code oranje voor regen en overstromingen (Gard, Var, Var2 en 2 andere gebieden). Of dit ook voor deze plaats geldt, kunnen we nog niet bepalen."),
    "In France: red warning for flooding (Hérault); orange warning for rain and flooding (Gard, Var, Var2 and 2 other areas). We cannot yet tell whether this applies to this place."
  );
}
console.log("MeteoAlarm-koppeling: regiovormen (CC BY 4.0), plaatsen in de juiste regio, waarschuwing per regiocode, kustwater telt mee, regel elders in Nederlands en Engels geslaagd.");

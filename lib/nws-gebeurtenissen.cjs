"use strict";

/* Gebeurtenissen van de National Weather Service (NWS) en hun Nederlandse titel.

   De bron levert per melding de officiële Engelse gebeurtenisnaam (`event`). De site toont
   die naam niet langer in een algemene kop, maar altijd de specifieke gebeurtenis:
   - een Nederlandse titel als de vertaling zeker is;
   - de officiële Engelse naam (lang="en") als de vertaling onzeker is of de naam onbekend is.
   Een onbekende naam wordt dus nooit verborgen, ook niet als NWS later een nieuw type uitgeeft.

   Dekking: alle gebeurtenistypen van https://api.weather.gov/alerts/types (111 op 25 oktober 2026;
   fixture in scripts/fixtures/nws-gebeurtenistypen.json) plus enkele bekende oudere namen.
   Alleen de server leest deze tabel; de pagina's krijgen het resultaat (`titelNl`) in het antwoord van
   /api/waarschuwingen, zodat de tabel niet in iedere pagina wordt meegeleverd. Vertaling alleen waar
   de betekenis ondubbelzinnig is; een twijfelgeval staat op `null` (zie de opmerking bij die regel). */

/* [officiële naam, Nederlandse titel of null, klasse-override]. Klasse: waarschuwing, waakzaamheid, advies, melding. */
const TABEL = [
  ["911 Telephone Outage", "Storing van het alarmnummer 911", "waarschuwing"],
  ["Administrative Message", "Administratief bericht"],
  ["Air Quality Alert", "Luchtkwaliteitswaarschuwing", "waarschuwing"],
  ["Air Quality Advisory", "Luchtkwaliteitsadvies"],
  ["Air Stagnation Advisory", "Advies voor stilstaande lucht"],
  ["Ashfall Advisory", "Advies voor vulkanische asval"],
  ["Ashfall Warning", "Waarschuwing voor vulkanische asval"],
  ["Avalanche Advisory", "Lawine-advies"],
  ["Avalanche Warning", "Lawinewaarschuwing"],
  ["Avalanche Watch", "Waakzaamheid voor lawines"],
  ["Beach Hazards Statement", "Melding over gevaren aan het strand"],
  ["Blizzard Warning", "Waarschuwing voor sneeuwstorm (blizzard)"],
  ["Blowing Dust Advisory", "Advies voor opwaaiend stof"],
  ["Blowing Dust Warning", "Waarschuwing voor opwaaiend stof"],
  ["Blue Alert", null, "waarschuwing"], /* politie-alarm in de VS; geen gangbare Nederlandse term */
  ["Brisk Wind Advisory", "Advies voor stevige wind"],
  ["Child Abduction Emergency", "Noodmelding kinderontvoering", "waarschuwing"],
  ["Civil Danger Warning", "Waarschuwing voor gevaar voor de bevolking"],
  ["Civil Emergency Message", "Melding van een noodsituatie voor de bevolking", "waarschuwing"],
  ["Coastal Flood Advisory", "Advies voor overstroming aan de kust"],
  ["Coastal Flood Statement", "Melding over overstroming aan de kust"],
  ["Coastal Flood Warning", "Waarschuwing voor overstroming aan de kust"],
  ["Coastal Flood Watch", "Waakzaamheid voor overstroming aan de kust"],
  ["Cold Weather Advisory", "Advies voor koud weer"],
  ["Dense Fog Advisory", "Mistadvies"],
  ["Dense Smoke Advisory", "Advies voor dichte rook"],
  ["Dust Advisory", "Stofadvies"],
  ["Dust Storm Warning", "Waarschuwing voor stofstorm"],
  ["Earthquake Warning", "Aardbevingswaarschuwing"],
  ["Evacuation Immediate", "Onmiddellijke evacuatie", "waarschuwing"],
  ["Excessive Heat Warning", "Waarschuwing voor extreme hitte"],
  ["Excessive Heat Watch", "Waakzaamheid voor extreme hitte"],
  ["Extreme Cold Warning", "Waarschuwing voor extreme kou"],
  ["Extreme Cold Watch", "Waakzaamheid voor extreme kou"],
  ["Extreme Fire Danger", "Extreem brandgevaar", "waarschuwing"],
  ["Extreme Heat Warning", "Waarschuwing voor extreme hitte"],
  ["Extreme Heat Watch", "Waakzaamheid voor extreme hitte"],
  ["Extreme Wind Warning", "Waarschuwing voor extreme wind"],
  ["Fire Warning", "Brandwaarschuwing"],
  ["Fire Weather Watch", "Waakzaamheid voor brandgevaarlijk weer"],
  ["Flash Flood Emergency", "Noodmelding voor plotselinge overstromingen", "waarschuwing"],
  ["Flash Flood Statement", "Melding over plotselinge overstroming"],
  ["Flash Flood Warning", "Waarschuwing voor plotselinge overstromingen"],
  ["Flash Flood Watch", "Waakzaamheid voor plotselinge overstromingen"],
  ["Flood Advisory", "Advies voor wateroverlast"],
  ["Flood Statement", "Melding over overstroming"],
  ["Flood Warning", "Waarschuwing voor overstromingen"],
  ["Flood Watch", "Waakzaamheid voor overstromingen"],
  ["Freeze Warning", "Waarschuwing voor vorst"],
  ["Freeze Watch", "Waakzaamheid voor vorst"],
  ["Freezing Fog Advisory", "Advies voor aanvriezende mist"],
  ["Freezing Spray Advisory", "Advies voor aanvriezende zeespray"],
  ["Frost Advisory", "Vorstadvies"],
  ["Gale Warning", "Waarschuwing voor stormachtige wind (gale)"],
  ["Gale Watch", "Waakzaamheid voor stormachtige wind (gale)"],
  ["Hazardous Materials Warning", "Waarschuwing voor gevaarlijke stoffen"],
  ["Hazardous Seas Warning", "Waarschuwing voor gevaarlijke zeegang"],
  ["Hazardous Seas Watch", "Waakzaamheid voor gevaarlijke zeegang"],
  ["Hazardous Weather Outlook", "Vooruitblik op gevaarlijk weer"],
  ["Heat Advisory", "Hitteadvies"],
  ["Heat Warning", "Waarschuwing voor hitte"],
  ["Heavy Freezing Spray Warning", "Waarschuwing voor zware aanvriezende zeespray"],
  ["Heavy Freezing Spray Watch", "Waakzaamheid voor zware aanvriezende zeespray"],
  ["High Surf Advisory", "Advies voor hoge branding"],
  ["High Surf Warning", "Waarschuwing voor hoge branding"],
  ["High Wind Warning", "Waarschuwing voor zeer harde wind"],
  ["High Wind Watch", "Waakzaamheid voor zeer harde wind"],
  ["Hurricane Force Wind Warning", "Waarschuwing voor wind met orkaankracht"],
  ["Hurricane Force Wind Watch", "Waakzaamheid voor wind met orkaankracht"],
  ["Hurricane Warning", "Orkaanwaarschuwing"],
  ["Hurricane Watch", "Waakzaamheid voor een orkaan"],
  ["Hydrologic Outlook", null, "melding"], /* betreft overstroming én droogte; een korte Nederlandse term bestaat niet */
  ["Ice Storm Warning", "Waarschuwing voor ijsstorm"],
  ["Lake Effect Snow Warning", "Waarschuwing voor lake-effect-sneeuw"],
  ["Lake Wind Advisory", "Advies voor wind op het meer"],
  ["Lakeshore Flood Advisory", "Advies voor overstroming aan de meeroever"],
  ["Lakeshore Flood Statement", "Melding over overstroming aan de meeroever"],
  ["Lakeshore Flood Warning", "Waarschuwing voor overstroming aan de meeroever"],
  ["Lakeshore Flood Watch", "Waakzaamheid voor overstroming aan de meeroever"],
  ["Law Enforcement Warning", "Waarschuwing van de politie"],
  ["Local Area Emergency", "Lokale noodsituatie", "waarschuwing"],
  ["Low Water Advisory", "Advies voor laag water"],
  ["Marine Weather Statement", "Melding over het weer op zee"],
  ["Nuclear Power Plant Warning", "Waarschuwing voor een kerncentrale"],
  ["Radiological Hazard Warning", "Waarschuwing voor radiologisch gevaar"],
  ["Red Flag Warning", "Waarschuwing voor brandgevaarlijk weer (red flag)"],
  ["Rip Current Statement", "Melding over gevaarlijke stromingen (rip currents)"],
  ["Severe Thunderstorm Warning", "Waarschuwing voor zwaar onweer"],
  ["Severe Thunderstorm Watch", "Waakzaamheid voor zwaar onweer"],
  ["Severe Weather Statement", "Melding over zwaar weer"],
  ["Shelter In Place Warning", "Waarschuwing om binnen te blijven (shelter in place)"],
  ["Short Term Forecast", "Verwachting voor de komende uren"],
  ["Small Craft Advisory", "Advies voor kleine vaartuigen"],
  ["Snow Squall Warning", "Waarschuwing voor plotselinge hevige sneeuwbui (snow squall)"],
  ["Special Marine Warning", null], /* geen zekere Nederlandse term; de officiële naam blijft staan */
  ["Special Weather Statement", "Speciale weermelding"],
  ["Storm Surge Warning", "Waarschuwing voor stormvloed"],
  ["Storm Surge Watch", "Waakzaamheid voor stormvloed"],
  ["Storm Warning", "Stormwaarschuwing"],
  ["Storm Watch", "Waakzaamheid voor storm"],
  ["Tornado Warning", "Tornadowaarschuwing"],
  ["Tornado Watch", "Waakzaamheid voor tornado's"],
  ["Tropical Cyclone Local Statement", "Lokale melding over een tropische cycloon"],
  ["Tropical Storm Warning", "Waarschuwing voor een tropische storm"],
  ["Tropical Storm Watch", "Waakzaamheid voor een tropische storm"],
  ["Tsunami Advisory", "Tsunami-advies"],
  ["Tsunami Warning", "Tsunamiwaarschuwing"],
  ["Tsunami Watch", "Waakzaamheid voor een tsunami"],
  ["Typhoon Warning", "Tyfoonwaarschuwing"],
  ["Typhoon Watch", "Waakzaamheid voor een tyfoon"],
  ["Volcano Warning", "Vulkaanwaarschuwing"],
  ["Wind Advisory", "Windadvies"],
  ["Winter Storm Warning", "Waarschuwing voor zwaar winterweer"],
  ["Winter Storm Watch", "Waakzaamheid voor zwaar winterweer"],
  ["Winter Weather Advisory", "Winterweeradvies"]
];

/* Gevaarsklasse volgens het einde van de officiële naam. Hoger is dringender; alleen gebruikt als
   tweede sorteersleutel bij gelijke ernst en voor de uitlegzin. Een onbekende naam valt op "melding". */
const KLASSE_RANG = Object.freeze({ waarschuwing: 4, waakzaamheid: 3, advies: 2, melding: 1 });
function klasseUitNaam(naam) {
  const n = String(naam || "").toLowerCase();
  if (/\b(warning|emergency|evacuation)\b/.test(n)) return "waarschuwing";
  if (/\bwatch\b/.test(n)) return "waakzaamheid";
  if (/\b(advisory|alert)\b/.test(n)) return "advies";
  return "melding";
}

const sleutel = naam => String(naam == null ? "" : naam).replace(/\s+/g, " ").trim().toLowerCase();
const PER_NAAM = new Map(TABEL.map(([naam, nl, klasse]) => [sleutel(naam), Object.freeze({ naam, nl, klasse: klasse || klasseUitNaam(naam) })]));

/* Nederlandse titel (of null) en klasse van een officiële gebeurtenisnaam. */
function nwsGebeurtenis(event) {
  const gevonden = PER_NAAM.get(sleutel(event));
  return gevonden
    ? { titelNl: gevonden.nl, klasse: gevonden.klasse, bekend: true }
    : { titelNl: null, klasse: klasseUitNaam(event), bekend: false };
}

/* Ernst in de bron (CAP `severity`) in een begrijpelijk Nederlands woord. Geen KNMI-kleurcode: de site
   toont dit als ernst volgens de Amerikaanse weerdienst. Onbekende of ontbrekende waarden zijn "niet opgegeven". */
const ERNST = Object.freeze({
  Extreme: Object.freeze({ rang: 4, nl: "extreem" }),
  Severe: Object.freeze({ rang: 3, nl: "ernstig" }),
  Moderate: Object.freeze({ rang: 2, nl: "matig" }),
  Minor: Object.freeze({ rang: 1, nl: "gering" }),
  Unknown: Object.freeze({ rang: 0, nl: "niet opgegeven" })
});
function nwsErnst(waarde) {
  const e = ERNST[String(waarde == null ? "" : waarde).trim()];
  return e || ERNST.Unknown;
}

/* Volgorde waarin de pagina meldingen toont (hoger = eerder). Eerst de ernst die de bron zelf opgeeft, daarna de
   klasse: bij gelijke ernst staat een waarschuwing boven een waakzaamheid, advies en melding. Als enige getal
   zodat de pagina alleen hoeft te sorteren; het verschil tussen "gering" en "matig" gaat anders verloren in de
   kleurindeling (beide geel), waardoor een matige melding onder een geringe kon staan. */
function nwsPrioriteit(ernst, klasse) {
  return (ernst ? ernst.rang : 0) * 10 + (KLASSE_RANG[klasse] || 0);
}

module.exports = { nwsGebeurtenis, nwsErnst, nwsPrioriteit, klasseUitNaam, KLASSE_RANG, ERNST, TABEL };

"use strict";

/*
 * Vaste voorbeelden voor het Engelse woordenboek: de belangrijkste zinnen
 * moeten precies zo vertaald blijven, en het woordenboek zelf moet gezond
 * zijn (geen dubbele sleutels, geen Nederlandse resten, Brits Engels).
 */

const assert = require("assert");
const kern = require("../taal/vertaalkern.js");
const woordenboek = require("../taal/en.js");
const { pasHtmlAan } = require("./apply-taal.js");

const v = kern.maakVertaler(woordenboek);
const verwacht = {
  "Er valt nu neerslag: 8,0 mm/u. Rond 16:45 wordt het naar verwachting droog. Het verwachte maximum lag vandaag rond 10:00 op 20 graden. Vannacht koelt het af naar ongeveer 12 graden. De wind komt uit het noordwesten. In de komende 24 uur is de wind het sterkst, met 6 Bft (krachtige wind). Windstoten kunnen vandaag tussen 15:00 en 16:00 oplopen tot 95 km/u.":
    "Precipitation is falling now: 8.0 mm/h. It is expected to turn dry around 16:45. Today's forecast high was 20 degrees at around 10:00. Tonight it cools to about 12 degrees. The wind is from the north-west. Over the next 24 hours, the wind peaks at 6 Bft (strong breeze). Gusts may reach 95 km/h today between 15:00 and 16:00.",
  "Vannacht koelt het af naar ongeveer 1 graad.": "Tonight it cools to about 1 degree.",
  "Vannacht koelt het af naar ongeveer -1 graad.": "Tonight it cools to about -1 degree.",
  "Grote kans op lichte regen in de middag": "Light rain likely in the afternoon",
  "Zeer grote kans op regen": "Rain very likely",
  "Kleine kans op lichte regen": "Low chance of light rain",
  "Matige wind uit het noordwesten (3 Bft).": "Gentle breeze from the north-west (3 Bft).",
  "Matige wind uit het westen (4 Bft).": "Moderate breeze from the west (4 Bft).",
  "Matige wind (3 Bft).": "Gentle breeze (3 Bft).",
  "In de komende 6 uur is de wind het sterkst, met 4 Bft (matige wind).": "Over the next 6 hours, the wind peaks at 4 Bft (moderate breeze).",
  "Ook later vandaag blijft neerslag onwaarschijnlijk.": "It should stay dry for the rest of today too.",
  "Code oranje: zware windstoten": "Orange warning for severe gusts",
  "Officiële weerwaarschuwing: Code oranje: zware windstoten.": "Official weather warning: orange warning for severe gusts.",
  "NW 3 Bft": "NW 3 Bft",
  "do 23 jul 14:00": "Thu 23 Jul 14:00",
  "Vrijwel onbewolkt": "Mostly clear",
  "Geheel bewolkt.": "Overcast.",
  /* KNMI "zwaar bewolkt" = 6-7/8 bedekt; Engels "mostly cloudy" (5-7/8), niet "heavy cloud" (3 okt). */
  "Zwaar bewolkt": "Mostly cloudy",
  "Zwaar bewolkt.": "Mostly cloudy.",
  "Mist": "Fog",
  /* Live gevonden (2 okt): toestanden die alleen met echte data voorkomen. */
  "Zonuren niet beschikbaar": "Sunshine hours unavailable",
  "Verwachte UV-piek vandaag: 7,5 (hoog).": "Expected UV peak today: 7.5 (high).",
  "Neerslag vandaag vanaf nu: 30 procent.": "Highest hourly chance of precipitation for the rest of today: 30 per cent.",
  "52.368, 4.904 · Europe/Amsterdam": "52.368, 4.904 · Europe/Amsterdam",
  "52.368, 4.904 · 3 m hoogte · Europe/Amsterdam": "52.368, 4.904 · 3 m elevation · Europe/Amsterdam",
  "KwaZulu-Natal, Zuid-Afrika": "KwaZulu-Natal, South Africa",
  "In Oss is juli met gemiddeld 24 °C overdag de warmste maand; in januari is het 's nachts gemiddeld 0 °C. Per jaar valt er ongeveer 740 mm neerslag en schijnt de zon zo'n 1.750 uur.":
    "In Oss, July is the warmest month, with an average daytime high of 24 °C; in January, the average night-time low is 0 °C. Each year brings about 740 mm of precipitation and roughly 1,750 hours of sunshine.",
  "Geen gunstig kijkvenster door neerslag, bewolking en maanlicht.": "No favourable viewing window because of precipitation, cloud and moonlight.",
  "Zonsondergang over 1 uur en 1 minuten, vandaag om 21:46.": "Sunset in 1 hour and 1 minute, today at 21:46.",
  /* Externe tekstcontrole (3 okt): nachtlabel met beide dagen, "falling" in plaats van
     "there is snow" (dat kan ook "er ligt sneeuw" betekenen), Beaufortnamen van de Met
     Office, de twee-uurskans als hoogste uurkans en de kleur één keer in de waarschuwing. */
  "zo op ma": "Sun–Mon",
  "Veel bewolking": "Cloudy",
  "Volgens het weermodel valt er nu sneeuw.": "According to the weather model, snow is falling now.",
  "Er vallen nu buien.": "Showers are falling now.",
  "Volgens het weermodel valt er nu onweer.": "According to the weather model, there are thunderstorms now.",
  "De wind komt uit het zuidwesten en draait naar het noorden.": "The wind is south-westerly, becoming northerly.",
  "voelt 2°": "feels like 2°",
  "Handmatig Donker voor deze browsersessie. Klik om Licht te kiezen.": "Dark selected for this browser session. Click to choose Light.",
  "Gegevens opgehaald om 22:01 · 12 min geleden": "Loaded at 22:01 · 12 min ago",
  "Vrij krachtige wind uit het noorden (5 Bft).": "Fresh breeze from the north (5 Bft).",
  "Relatief beste periode van de nacht tot de vroege ochtend.": "Best available period: overnight into the early morning.",
  "Waarschijnlijk beste periode van de avond tot de vroege ochtend.": "Likely best period: from the evening into the early morning.",
  "14:00, neerslagkans 65%, verwacht 1,4 mm": "14:00, 65% chance of precipitation, 1.4 mm expected",
  "De verwachte neerslag in de rest van vandaag is alleen een spoor.": "Only a trace of precipitation is expected for the rest of today.",
  "De verwachte neerslag over de hele dag is 3,0 mm.": "Expected precipitation for the whole day is 3.0 mm.",
  "Officiële weerwaarschuwing (oranje): Code oranje: mist.": "Official weather warning: orange warning for fog.",
  "Er is een kleine kans op regen in de komende twee uur (hoogste uurkans 20%).": "There is a low chance of rain in the next two hours (highest hourly chance 20%).",
  "Geen officiële waarschuwing.": "Not an official warning."
};
for (const [nl, en] of Object.entries(verwacht)) assert.equal(v.vertaal(nl), en, nl);

/* Nooit half vertalen: één onbekende zin in een blok laat het hele blok staan. */
assert.equal(v.vertaal("Het regent nu. Dit is een onbekende zin."), null);

/* Gezondheid van de vaste teksten. */
const exact = Object.entries(woordenboek.exact);
for (const [nl, en] of exact) {
  assert(typeof en === "string" && en.trim(), `lege vertaling voor ${nl}`);
  assert(!/\b(het|een|niet|wordt|neerslag|vandaag|morgen|graden|kans|bewolkt)\b/i.test(en) || /Autoriteit Persoonsgegevens|\/weer\//.test(en), `Nederlandse resten in vertaling van "${nl}": ${en}`);
  assert(!/\b(color|center|meters|kilometers|favorable|analyze|behavior)\b/i.test(en), `Amerikaanse spelling in "${en}"`);
}
assert(v.aantalPatronen > 100 && v.aantalExact > 400, "woordenboek is ongewoon klein");

/* Build: precies één ladertag, vóór de eerste externe script, ook bij herhalen. */
const html = '<html><head><title>x</title><script type="application/ld+json">{}</script><script src="/app-aaaaaaaaaaaa.min.js" defer></script></head><body></body></html>';
const een = pasHtmlAan(html, "taal-0123456789ab.js");
const twee = pasHtmlAan(een, "taal-ba9876543210.js");
assert.equal((twee.match(/data-taal-lader/g) || []).length, 1, "herhaald toepassen geeft één ladertag");
assert(twee.indexOf("taal-ba9876543210.js") < twee.indexOf("/app-aaaaaaaaaaaa.min.js"), "lader staat vóór de app");
/* Subpagina: het synchrone pre-paint themascript blijft vóór de CSS en vóór de lader. */
const sub = pasHtmlAan('<html><head><script src="/early-1.min.js"></script><style>b{}</style><script src="/page-1.min.js" defer></script></head><body></body></html>', "taal-0123456789ab.js");
assert(sub.indexOf("/early-1.min.js") < sub.indexOf("<style>") && sub.indexOf("<style>") < sub.indexOf("taal-0123456789ab.js"), "themascript blijft eerst, lader na de CSS");
assert(sub.indexOf("taal-0123456789ab.js") < sub.indexOf("/page-1.min.js"), "lader vóór het eerste deferred script");

console.log(`Woordenboek Engels: ${v.aantalExact} vaste teksten en ${v.aantalPatronen} zinspatronen; ${Object.keys(verwacht).length} vaste voorbeelden, geen halve vertalingen, Brits Engels en ladertag geslaagd.`);

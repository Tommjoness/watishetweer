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
    "Precipitation is falling now: 8.0 mm/h. It is expected to turn dry around 16:45. Today's expected high was 20 degrees, around 10:00. Tonight it cools to about 12 degrees. The wind is from the north-west. Over the next 24 hours, the wind peaks at 6 Bft (strong wind). Gusts may reach 95 km/h today between 15:00 and 16:00.",
  "Vannacht koelt het af naar ongeveer 1 graad.": "Tonight it cools to about 1 degree.",
  "Vannacht koelt het af naar ongeveer -1 graad.": "Tonight it cools to about -1 degree.",
  "Grote kans op lichte regen in de middag": "Light rain likely in the afternoon",
  "Zeer grote kans op regen": "Rain very likely",
  "Kleine kans op lichte regen": "Low chance of light rain",
  "Matige wind uit het noordwesten (3 Bft).": "Moderate wind from the north-west (3 Bft).",
  "Code oranje: zware windstoten": "Code orange: severe gusts",
  "Officiële weerwaarschuwing: Code oranje: zware windstoten.": "Official weather warning: code orange for severe gusts.",
  "NW 3 Bft": "NW 3 Bft",
  "do 23 jul 14:00": "Thu 23 Jul 14:00",
  "Vrijwel onbewolkt": "Mostly clear",
  "Geheel bewolkt.": "Overcast.",
  "Mist": "Fog",
  "KwaZulu-Natal, Zuid-Afrika": "KwaZulu-Natal, South Africa",
  "In Oss is juli met gemiddeld 24 °C overdag de warmste maand; in januari is het 's nachts gemiddeld 0 °C. Per jaar valt er ongeveer 740 mm neerslag en schijnt de zon zo'n 1.750 uur.":
    "In Oss, July is the warmest month, with an average daytime high of 24 °C; in January, the average night-time low is 0 °C. Each year brings about 740 mm of precipitation and roughly 1,750 hours of sunshine.",
  "Geen gunstig kijkvenster door neerslag, bewolking en maanlicht.": "No favourable viewing window because of precipitation, cloud and moonlight.",
  "Zonsondergang over 1 uur en 1 minuten, vandaag om 21:46.": "Sunset in 1 hour and 1 minute, today at 21:46."
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

console.log(`Woordenboek Engels: ${v.aantalExact} vaste teksten en ${v.aantalPatronen} zinspatronen; ${Object.keys(verwacht).length} vaste voorbeelden, geen halve vertalingen, Brits Engels en ladertag geslaagd.`);

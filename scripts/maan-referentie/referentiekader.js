"use strict";

/* Moon 2.0, M0: het vaste referentiekader voor de onafhankelijke maancontrole.
   Zowel de generator (genereer-horizons.js, draait nooit in CI) als de offline test
   (scripts/maan-referentie.test.js) lezen deze lijst, zodat de vastgelegde JPL
   Horizons-gegevens en de toetsing altijd over dezelfde gevallen gaan.

   Locaties: beide halfronden, de evenaar (Quito, 2,85 km hoog), hoge noordelijke
   (Longyearbyen) en zuidelijke breedte (Ushuaia) en de datumgrens (Apia, UTC+13).
   Hoogte in km boven de referentie-ellipsoïde (WGS-84), zoals Horizons SITE_COORD verwacht.

   Momenten: 2026, 2027 en 2028; per jaar smalle wassende en afnemende sikkel, eerste
   en laatste kwartier, bijna vol, grote libratie, beide Nederlandse klokwissels
   (01:00 UTC) en een moment rond beide zonnewendes. De fasemomenten zijn op
   20 november 2026 gekozen met astronomy-engine 2.1.19 (alleen als keuzehulp, op het
   hele uur afgerond); de waarheid in de fixtures komt uitsluitend van JPL Horizons.

   Opkomst en ondergang: per locatie en jaar vier vensters van vijf etmalen, rond
   beide klokwissels en beide zonnewendes. */

const LOCATIES = Object.freeze([
  { id: "de-bilt", naam: "De Bilt", lat: 52.10, lon: 5.18, hoogteKm: 0.002, tz: "Europe/Amsterdam", kenmerk: "Nederland, referentiepunt" },
  { id: "sydney", naam: "Sydney", lat: -33.87, lon: 151.21, hoogteKm: 0.02, tz: "Australia/Sydney", kenmerk: "zuidelijk halfrond" },
  { id: "quito", naam: "Quito", lat: -0.18, lon: -78.47, hoogteKm: 2.85, tz: "America/Guayaquil", kenmerk: "evenaar, grote hoogte" },
  { id: "tokyo", naam: "Tokyo", lat: 35.68, lon: 139.69, hoogteKm: 0.04, tz: "Asia/Tokyo", kenmerk: "noordelijk halfrond, oostelijke lengte" },
  { id: "longyearbyen", naam: "Longyearbyen", lat: 78.22, lon: 15.65, hoogteKm: 0.03, tz: "Arctic/Longyearbyen", kenmerk: "hoge noordelijke breedte (circumpolaire maan)" },
  { id: "ushuaia", naam: "Ushuaia", lat: -54.80, lon: -68.30, hoogteKm: 0.01, tz: "America/Argentina/Ushuaia", kenmerk: "hoge zuidelijke breedte" },
  { id: "apia", naam: "Apia", lat: -13.83, lon: -171.76, hoogteKm: 0.002, tz: "Pacific/Apia", kenmerk: "datumgrens (UTC+13)" }
]);

const MOMENTEN = Object.freeze([
  ["2026-sikkel-wassend", "2026-03-21 13:00", "smalle wassende sikkel (nieuwe maan + 2,5 d)"],
  ["2026-eerste-kwartier", "2026-07-21 11:00", "eerste kwartier"],
  ["2026-bijna-vol", "2026-10-25 16:00", "bijna vol (volle maan - 12 u)"],
  ["2026-laatste-kwartier", "2026-03-11 10:00", "laatste kwartier"],
  ["2026-sikkel-afnemend", "2026-10-08 04:00", "smalle afnemende sikkel (nieuwe maan - 2,5 d)"],
  ["2026-libratie-groot", "2026-12-19 12:00", "grote libratie (verlichting > 50%)"],
  ["2026-nl-klokwissel-voorjaar", "2026-03-29 01:00", "Nederlandse klokwissel voorjaar"],
  ["2026-nl-klokwissel-najaar", "2026-10-25 01:00", "Nederlandse klokwissel najaar"],
  ["2026-juni-avond", "2026-06-21 22:00", "rond de junizonnewende"],
  ["2026-december-avond", "2026-12-21 18:00", "rond de decemberzonnewende"],
  ["2027-sikkel-wassend", "2027-05-08 23:00", "smalle wassende sikkel (nieuwe maan + 2,5 d)"],
  ["2027-eerste-kwartier", "2027-08-09 05:00", "eerste kwartier"],
  ["2027-bijna-vol", "2027-12-13 04:00", "bijna vol (volle maan - 12 u)"],
  ["2027-laatste-kwartier", "2027-05-28 14:00", "laatste kwartier"],
  ["2027-sikkel-afnemend", "2027-12-25 08:00", "smalle afnemende sikkel (nieuwe maan - 2,5 d)"],
  ["2027-libratie-groot", "2027-07-26 17:00", "grote libratie (verlichting > 50%)"],
  ["2027-nl-klokwissel-voorjaar", "2027-03-28 01:00", "Nederlandse klokwissel voorjaar"],
  ["2027-nl-klokwissel-najaar", "2027-10-31 01:00", "Nederlandse klokwissel najaar"],
  ["2027-juni-avond", "2027-06-21 22:00", "rond de junizonnewende"],
  ["2027-december-avond", "2027-12-21 18:00", "rond de decemberzonnewende"],
  ["2028-sikkel-wassend", "2028-02-27 23:00", "smalle wassende sikkel (nieuwe maan + 2,5 d)"],
  ["2028-eerste-kwartier", "2028-06-29 12:00", "eerste kwartier"],
  ["2028-bijna-vol", "2028-11-01 21:00", "bijna vol (volle maan - 12 u)"],
  ["2028-laatste-kwartier", "2028-02-17 08:00", "laatste kwartier"],
  ["2028-sikkel-afnemend", "2028-11-14 01:00", "smalle afnemende sikkel (nieuwe maan - 2,5 d)"],
  ["2028-libratie-groot", "2028-02-03 21:00", "grote libratie (verlichting > 50%)"],
  ["2028-nl-klokwissel-voorjaar", "2028-03-26 01:00", "Nederlandse klokwissel voorjaar"],
  ["2028-nl-klokwissel-najaar", "2028-10-29 01:00", "Nederlandse klokwissel najaar"],
  ["2028-juni-avond", "2028-06-21 22:00", "rond de junizonnewende"],
  ["2028-december-avond", "2028-12-21 18:00", "rond de decemberzonnewende"]
].map(([id, utc, soort]) => Object.freeze({ id, utc, soort })));

/* Vijf etmalen (UTC) rond elke klokwissel en zonnewende. */
const OPKOMST_VENSTERS = Object.freeze([
  ["2026-klokwissel-voorjaar", "2026-03-27 00:00", "2026-04-01 00:00"],
  ["2026-juni", "2026-06-19 00:00", "2026-06-24 00:00"],
  ["2026-klokwissel-najaar", "2026-10-23 00:00", "2026-10-28 00:00"],
  ["2026-december", "2026-12-19 00:00", "2026-12-24 00:00"],
  ["2027-klokwissel-voorjaar", "2027-03-26 00:00", "2027-03-31 00:00"],
  ["2027-juni", "2027-06-19 00:00", "2027-06-24 00:00"],
  ["2027-klokwissel-najaar", "2027-10-29 00:00", "2027-11-03 00:00"],
  ["2027-december", "2027-12-19 00:00", "2027-12-24 00:00"],
  ["2028-klokwissel-voorjaar", "2028-03-24 00:00", "2028-03-29 00:00"],
  ["2028-juni", "2028-06-19 00:00", "2028-06-24 00:00"],
  ["2028-klokwissel-najaar", "2028-10-27 00:00", "2028-11-01 00:00"],
  ["2028-december", "2028-12-19 00:00", "2028-12-24 00:00"]
].map(([id, start, eind]) => Object.freeze({ id, start, eind })));

/* Validatie van de Horizons-opkomsttijden: eerste opkomst en ondergang in deze vensters, per locatie. */
const VALIDATIE_VENSTERS = Object.freeze(["2026-klokwissel-voorjaar", "2027-december"]);

module.exports = { LOCATIES, MOMENTEN, OPKOMST_VENSTERS, VALIDATIE_VENSTERS };

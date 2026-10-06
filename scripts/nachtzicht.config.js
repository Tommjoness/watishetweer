"use strict";

/* De plekken voor de Nachtzicht-pagina's zijn de Nationale Parken van
   Nederland, met naam en coördinaat uit Wikidata (CC0; het Q-nummer staat
   erbij, zodat iedere plek na te trekken is). Er is bewust geen eigen lijst
   van "mooie" plekken: de selectie is controleerbaar en voor iedereen gelijk.

   De lichtvervuiling wordt niet hier vastgelegd maar bij de build uit
   lichtvervuiling-nl.json (RIVM-kaart) gelezen, dezelfde bron als de regel in
   Nachtzicht op de plaatspagina's. Een park doet alleen mee als de kaart rond
   de coördinaat volledig is: aan de landsgrens ontbreekt licht uit het
   buitenland en zou de schatting te donker uitvallen. */

const PARKEN = [
  { slug: "alde-feanen", naam: "Nationaal Park Alde Feanen", kort: "Alde Feanen", lat: 53.1244, lon: 5.9233, wikidata: "Q1651436" },
  { slug: "biesbosch", naam: "Nationaal Park De Biesbosch", kort: "De Biesbosch", lat: 51.758333, lon: 4.758333, wikidata: "Q1702833" },
  { slug: "drents-friese-wold", naam: "Nationaal Park Drents-Friese Wold", kort: "Drents-Friese Wold", lat: 52.909722, lon: 6.280556, wikidata: "Q1113318" },
  { slug: "drentsche-aa", naam: "Nationaal Park Drentsche Aa", kort: "Drentsche Aa", lat: 53.041612, lon: 6.649453, wikidata: "Q1702806" },
  { slug: "duinen-van-texel", naam: "Nationaal Park Duinen van Texel", kort: "Duinen van Texel", lat: 53.145833, lon: 4.8025, wikidata: "Q1702843" },
  { slug: "dwingelderveld", naam: "Nationaal Park Dwingelderveld", kort: "Dwingelderveld", lat: 52.816389, lon: 6.4075, wikidata: "Q1651303" },
  { slug: "groote-peel", naam: "Nationaal Park De Groote Peel", kort: "De Groote Peel", lat: 51.345556, lon: 5.823889, wikidata: "Q152994" },
  { slug: "hoge-veluwe", naam: "Nationaal Park De Hoge Veluwe", kort: "De Hoge Veluwe", lat: 52.0833, lon: 5.79855, wikidata: "Q1623374" },
  { slug: "lauwersmeer", naam: "Nationaal Park Lauwersmeer", kort: "Lauwersmeer", lat: 53.363889, lon: 6.199722, wikidata: "Q1651298" },
  { slug: "maasduinen", naam: "Nationaal Park De Maasduinen", kort: "De Maasduinen", lat: 51.588611, lon: 6.089167, wikidata: "Q1702950" },
  { slug: "meinweg", naam: "Nationaal Park De Meinweg", kort: "De Meinweg", lat: 51.163333, lon: 6.118889, wikidata: "Q1703071" },
  { slug: "nieuw-land", naam: "Nationaal Park Nieuw Land", kort: "Nieuw Land", lat: 52.5, lon: 5.333333, wikidata: "Q27306267" },
  { slug: "oosterschelde", naam: "Nationaal Park Oosterschelde", kort: "Oosterschelde", lat: 51.571944, lon: 3.945278, wikidata: "Q1703017" },
  { slug: "sallandse-heuvelrug", naam: "Nationaal Park Sallandse Heuvelrug", kort: "Sallandse Heuvelrug", lat: 52.316667, lon: 6.416667, wikidata: "Q1702823" },
  { slug: "schiermonnikoog", naam: "Nationaal Park Schiermonnikoog", kort: "Schiermonnikoog", lat: 53.4893, lon: 6.232, wikidata: "Q1651381" },
  { slug: "utrechtse-heuvelrug", naam: "Nationaal Park Utrechtse Heuvelrug", kort: "Utrechtse Heuvelrug", lat: 52.031162, lon: 5.42141, wikidata: "Q1030114" },
  { slug: "van-gogh", naam: "Van Gogh Nationaal Park", kort: "Van Gogh Nationaal Park", lat: 51.6456, lon: 5.1253, wikidata: "Q84161251" },
  { slug: "veluwezoom", naam: "Nationaal Park Veluwezoom", kort: "Veluwezoom", lat: 52.048439, lon: 6.019914, wikidata: "Q1703055" },
  { slug: "weerribben-wieden", naam: "Nationaal Park Weerribben-Wieden", kort: "Weerribben-Wieden", lat: 52.7769, lon: 5.9489, wikidata: "Q1702815" },
  { slug: "zoom-kalmthoutse-heide", naam: "Grenspark De Zoom-Kalmthoutse Heide", kort: "De Zoom-Kalmthoutse Heide", lat: 51.3969, lon: 4.4036, wikidata: "Q2156810" },
  { slug: "zuid-kennemerland", naam: "Nationaal Park Zuid-Kennemerland", kort: "Zuid-Kennemerland", lat: 52.396199, lon: 4.592096, wikidata: "Q774464" }
];

const BASIS = "/nachtzicht/";
const MAAN = "/maan/";
/* Referentiepunt voor maantijden op /maan/: De Bilt (KNMI), ook gebruikt op de seizoenspagina's. */
const MAAN_REFERENTIE = { naam: "De Bilt", lat: 52.1009, lon: 5.1801 };
const TIJDZONE = "Europe/Amsterdam";

const parkUrl = p => `https://watishetweer.nl${BASIS}${p.slug}/`;

module.exports = { PARKEN, BASIS, MAAN, MAAN_REFERENTIE, TIJDZONE, parkUrl };

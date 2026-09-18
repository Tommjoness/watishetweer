"use strict";

/*
 * Bewuste SEO-kernset: echte plaatsen met een stabiele, leesbare URL.
 * Geen willekeurige coördinatenpagina's en geen automatische long-tail-spam.
 * De coördinaten zijn stadskernen en worden uitsluitend gebruikt om dezelfde
 * bestaande WeatherNow-runtime op de plaatsroute te starten.
 */
const LOCATIES=Object.freeze([
  {slug:"alkmaar",naam:"Alkmaar",provincie:"Noord-Holland",lat:52.6324,lon:4.7534},
  {slug:"almelo",naam:"Almelo",provincie:"Overijssel",lat:52.35667,lon:6.6625},
  {slug:"almere",naam:"Almere",provincie:"Flevoland",lat:52.3508,lon:5.2647,populair:true},
  {slug:"alphen-aan-den-rijn",naam:"Alphen aan den Rijn",provincie:"Zuid-Holland",lat:52.1292,lon:4.6555},
  {slug:"amersfoort",naam:"Amersfoort",provincie:"Utrecht",lat:52.1561,lon:5.3874,populair:true},
  {slug:"amstelveen",naam:"Amstelveen",provincie:"Noord-Holland",lat:52.300833,lon:4.863889},
  {slug:"amsterdam",naam:"Amsterdam",provincie:"Noord-Holland",lat:52.3676,lon:4.9041,populair:true},
  {slug:"apeldoorn",naam:"Apeldoorn",provincie:"Gelderland",lat:52.2112,lon:5.9699},
  {slug:"arnhem",naam:"Arnhem",provincie:"Gelderland",lat:51.9851,lon:5.8987,populair:true},
  {slug:"assen",naam:"Assen",provincie:"Drenthe",lat:52.9928,lon:6.5624},
  {slug:"bergen-op-zoom",naam:"Bergen op Zoom",provincie:"Noord-Brabant",lat:51.495,lon:4.2917},
  {slug:"breda",naam:"Breda",provincie:"Noord-Brabant",lat:51.5719,lon:4.7683,populair:true},
  {slug:"capelle-aan-den-ijssel",naam:"Capelle aan den IJssel",provincie:"Zuid-Holland",lat:51.9357,lon:4.5782},
  {slug:"delft",naam:"Delft",provincie:"Zuid-Holland",lat:52.0116,lon:4.3571},
  {slug:"den-bosch",naam:"Den Bosch",provincie:"Noord-Brabant",lat:51.6978,lon:5.3037},
  {slug:"den-haag",naam:"Den Haag",provincie:"Zuid-Holland",lat:52.0705,lon:4.3007,populair:true},
  {slug:"den-helder",naam:"Den Helder",provincie:"Noord-Holland",lat:52.9599,lon:4.7593},
  {slug:"deventer",naam:"Deventer",provincie:"Overijssel",lat:52.2550,lon:6.1639},
  {slug:"doetinchem",naam:"Doetinchem",provincie:"Gelderland",lat:51.966667,lon:6.3},
  {slug:"dordrecht",naam:"Dordrecht",provincie:"Zuid-Holland",lat:51.8133,lon:4.6901},
  {slug:"drachten",naam:"Drachten",provincie:"Fryslân",lat:53.112536,lon:6.098897},
  {slug:"ede",naam:"Ede",provincie:"Gelderland",lat:52.0402,lon:5.6649},
  {slug:"eindhoven",naam:"Eindhoven",provincie:"Noord-Brabant",lat:51.4416,lon:5.4697,populair:true},
  {slug:"emmen",naam:"Emmen",provincie:"Drenthe",lat:52.7858,lon:6.8976},
  {slug:"enschede",naam:"Enschede",provincie:"Overijssel",lat:52.2215,lon:6.8937},
  {slug:"gouda",naam:"Gouda",provincie:"Zuid-Holland",lat:52.0116,lon:4.7105},
  {slug:"groningen",naam:"Groningen",provincie:"Groningen",lat:53.2194,lon:6.5665,populair:true},
  {slug:"haarlem",naam:"Haarlem",provincie:"Noord-Holland",lat:52.3874,lon:4.6462,populair:true},
  {slug:"harderwijk",naam:"Harderwijk",provincie:"Gelderland",lat:52.34167,lon:5.62083},
  {slug:"heerenveen",naam:"Heerenveen",provincie:"Fryslân",lat:52.95683,lon:5.92701},
  {slug:"heerlen",naam:"Heerlen",provincie:"Limburg",lat:50.883651,lon:5.981541},
  {slug:"helmond",naam:"Helmond",provincie:"Noord-Brabant",lat:51.4791,lon:5.6558},
  {slug:"hengelo",naam:"Hengelo",provincie:"Overijssel",lat:52.2659,lon:6.7924},
  {slug:"hilversum",naam:"Hilversum",provincie:"Noord-Holland",lat:52.223333,lon:5.176389},
  {slug:"hoofddorp",naam:"Hoofddorp",provincie:"Noord-Holland",lat:52.3061,lon:4.6907},
  {slug:"hoorn",naam:"Hoorn",provincie:"Noord-Holland",lat:52.6533,lon:5.0736},
  {slug:"kampen",naam:"Kampen",provincie:"Overijssel",lat:52.555,lon:5.911111},
  {slug:"leeuwarden",naam:"Leeuwarden",provincie:"Fryslân",lat:53.2012,lon:5.7999},
  {slug:"leiden",naam:"Leiden",provincie:"Zuid-Holland",lat:52.1601,lon:4.4970},
  {slug:"lelystad",naam:"Lelystad",provincie:"Flevoland",lat:52.5185,lon:5.4714},
  {slug:"maastricht",naam:"Maastricht",provincie:"Limburg",lat:50.8514,lon:5.6910,populair:true},
  {slug:"middelburg",naam:"Middelburg",provincie:"Zeeland",lat:51.4988,lon:3.6109},
  {slug:"nieuwegein",naam:"Nieuwegein",provincie:"Utrecht",lat:52.0367,lon:5.0836},
  {slug:"nijmegen",naam:"Nijmegen",provincie:"Gelderland",lat:51.8426,lon:5.8528,populair:true},
  {slug:"oss",naam:"Oss",provincie:"Noord-Brabant",lat:51.781,lon:5.5811},
  {slug:"purmerend",naam:"Purmerend",provincie:"Noord-Holland",lat:52.5025,lon:4.9615},
  {slug:"roosendaal",naam:"Roosendaal",provincie:"Noord-Brabant",lat:51.5331,lon:4.4561},
  {slug:"rotterdam",naam:"Rotterdam",provincie:"Zuid-Holland",lat:51.9244,lon:4.4777,populair:true},
  {slug:"schiedam",naam:"Schiedam",provincie:"Zuid-Holland",lat:51.919167,lon:4.388889},
  {slug:"sittard",naam:"Sittard",provincie:"Limburg",lat:50.9974,lon:5.8667},
  {slug:"spijkenisse",naam:"Spijkenisse",provincie:"Zuid-Holland",lat:51.845,lon:4.329167},
  {slug:"tilburg",naam:"Tilburg",provincie:"Noord-Brabant",lat:51.5555,lon:5.0913},
  {slug:"utrecht",naam:"Utrecht",provincie:"Utrecht",lat:52.0907,lon:5.1214,populair:true},
  {slug:"veenendaal",naam:"Veenendaal",provincie:"Utrecht",lat:52.028627,lon:5.55891},
  {slug:"venlo",naam:"Venlo",provincie:"Limburg",lat:51.3704,lon:6.1724},
  {slug:"vlaardingen",naam:"Vlaardingen",provincie:"Zuid-Holland",lat:51.9125,lon:4.341667},
  {slug:"weert",naam:"Weert",provincie:"Limburg",lat:51.251667,lon:5.706944},
  {slug:"zaandam",naam:"Zaandam",provincie:"Noord-Holland",lat:52.43854,lon:4.82643},
  {slug:"zoetermeer",naam:"Zoetermeer",provincie:"Zuid-Holland",lat:52.0607,lon:4.4940},
  {slug:"zwolle",naam:"Zwolle",provincie:"Overijssel",lat:52.5168,lon:6.0830,populair:true}
].map(x=>Object.freeze({...x,land:"NL"})));

const POPULAIR=Object.freeze(LOCATIES.filter(x=>x.populair));
const BASIS_URL="https://watishetweer.nl";

function plaatsUrl(loc){return `${BASIS_URL}/weer/${loc.slug}/`;}
function plaatsTitel(loc){return `Weer ${loc.naam} vandaag | watishetweer.nl`;}
function plaatsBeschrijving(loc){return `Bekijk het actuele weer in ${loc.naam}, neerslag voor de komende uren en de 7-daagse verwachting. Met lokale tijden, luchtkwaliteit en nachtzicht.`;}

module.exports={LOCATIES,POPULAIR,BASIS_URL,plaatsUrl,plaatsTitel,plaatsBeschrijving};

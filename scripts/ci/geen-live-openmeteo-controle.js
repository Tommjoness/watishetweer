"use strict";

/* Afsluitende CI-stap: faalt als de bewaker (geen-live-openmeteo.cjs) in deze job
   één of meer live Open-Meteo-pogingen heeft geblokkeerd, ook als een test die
   fout zelf heeft weggevangen. Draait altijd (if: always()). */
const {controleer,LOG}=require("./geen-live-openmeteo.cjs");
process.exit(controleer(process.argv[2]||LOG));

"use strict";

/* Open-Meteo hapert soms kort rond het hele uur (gemeten op 2 oktober 2026:
   503 "upstream connect error … connection timeout" om 13:00, 15:00 en 16:01
   Nederlandse tijd). De app vangt dat op: na een mislukte volledige aanvraag
   volgen direct de kleinere Open-Meteo-aanvraag en de eigen reservebron
   /api/forecast, en de bezoeker ziet binnen enkele seconden de verwachting.
   De browser zet de mislukte aanvraag toch als "Failed to load resource" in de
   console, en een productiemonitor die iedere consolefout telt, faalt dan op
   een storing van de weerdienst die de site zelf correct afhandelt.

   Deze module scheidt precies dat geval af: een 429- of 5xx-antwoord van een
   Open-Meteo-host. Alles daarbuiten blijft een echte fout, ook een 5xx van
   de eigen site of een 4xx van Open-Meteo (dat is een fout in de aanvraag).
   Een monitor die dit gebruikt, moet daarnaast zelf aantonen dat de pagina
   toch weerdata toont; zonder dat herstel telt de storing alsnog als fout. */
const OPEN_METEO_HOST=/^https:\/\/(?:api|air-quality-api|geocoding-api)\.open-meteo\.com\//;
const TIJDELIJK=/^Failed to load resource: the server responded with a status of (?:429|5\d\d)\b/;

function isProviderStoring(tekst,url){
  return TIJDELIJK.test(String(tekst||""))&&OPEN_METEO_HOST.test(String(url||""));
}

/* Voor een Playwright-consolebericht: de URL van de mislukte resource staat in
   location().url. */
function isProviderStoringBericht(msg){
  let url="";
  try{url=msg.location&&msg.location().url||"";}catch(e){url="";}
  return isProviderStoring(msg.text(),url);
}

function logProviderStoringen(label,storingen){
  if(storingen.length)console.log(`${label}: ${storingen.length} tijdelijke Open-Meteo-storing(en) opgevangen door de app (${storingen.map(s=>s.status).join(", ")}); pagina toonde daarna weerdata.`);
}

/* Maakt van een consolebericht {status,url} voor het log. */
function beschrijf(msg){
  let url="";
  try{url=msg.location&&msg.location().url||"";}catch(e){url="";}
  const m=/status of (\d{3})/.exec(msg.text());
  return {status:m?Number(m[1]):null,url:url.split("?")[0]};
}

module.exports={isProviderStoring,isProviderStoringBericht,logProviderStoringen,beschrijf};

"use strict";

/* Volgorde waarin de wereldwijde monitor zijn live bronnen verzamelt.

   Eerst voor alle locaties de exacte forecast-URL ontdekken (met de bestaande pauze ertussen), daarna alle live
   antwoorden direct achter elkaar ophalen. Zo kan Node één open verbinding met de provider hergebruiken in plaats
   van per locatie een nieuwe te openen.

   Waarom: in 195 productieruns (24 oktober tot 11 november 2026) mislukte bij ophalingen met vijf seconden of meer
   ertussen 46,7% van de pogingen vanaf de derde locatie op een verbinding die niet tot stand kwam, terwijl
   ophalingen direct achter elkaar in dezelfde runs vrijwel nooit mislukten (3 van 1.781). Node houdt een
   ongebruikte verbinding standaard maar enkele seconden open; met een pauze ertussen is elke ophaling dus een
   nieuwe verbinding.

   Deze functie verandert niets aan wat er wordt opgehaald of gecontroleerd: `ontdek`, `controleerUrl` en `haal`
   zijn de bestaande functies van de monitor, inclusief retries, backoff, reserveroute en volledigheidscontrole.
   Mislukt één stap, dan stopt de hele verzameling met die fout. */
async function verzamelLiveBronnen({locaties,ontdek,controleerUrl,haal,pauzeMs,slaap,meld}){
  const namen=locaties.map(locatie=>locatie.naam);
  if(new Set(namen).size!==namen.length)throw new Error("locatienamen moeten uniek zijn om bron en locatie te koppelen");

  const urls=new Map();
  for(const [index,locatie] of locaties.entries()){
    if(index>0)await slaap(pauzeMs);
    const sourceUrl=await ontdek(locatie);
    controleerUrl(sourceUrl,locatie);
    urls.set(locatie.naam,sourceUrl);
  }

  const bronnen=new Map();
  for(const locatie of locaties){
    const sourceUrl=urls.get(locatie.naam);
    if(!sourceUrl)throw new Error(`${locatie.naam}: forecast-URL ontbreekt na de ontdekking`);
    const live=await haal(sourceUrl,locatie);
    if(!live||!live.bron)throw new Error(`${locatie.naam}: live bron ontbreekt na het ophalen`);
    bronnen.set(locatie.naam,live.bron);
    meld(locatie,live);
  }
  return bronnen;
}

module.exports={verzamelLiveBronnen};

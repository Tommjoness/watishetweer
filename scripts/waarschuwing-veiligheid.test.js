"use strict";
/* SYNTHETISCHE voorbeeldteksten, geen officiële weerwaarschuwingen en
   geen DeepL-kwaliteitsmeting. Er worden geen netwerkrequests verstuurd. */
const assert=require("node:assert/strict");
const t=require("../lib/waarschuwing-vertaling.cjs");

const voorbeelden=[
  {
    taal:"EN",
    bron:"Do not travel between 18:00 and 21:00 UTC. Wind gusts up to 90 km/h.\nStay indoors until the storm has passed.",
    nl:"Reis niet tussen 18:00 en 21:00 UTC. Windstoten tot 90 km/u.\nBlijf binnen tot de storm voorbij is."
  },
  {
    taal:"FR",
    bron:"Ne sortez pas entre 18:00 et 21:00 UTC. Rafales jusqu'à 90 km/h.\nRestez à l'intérieur.",
    nl:"Ga niet naar buiten tussen 18:00 en 21:00 UTC. Windstoten tot 90 km/u.\nBlijf binnen."
  },
  {
    taal:"DE",
    bron:"Fahren Sie nicht zwischen 18:00 und 21:00 UTC. Böen bis 90 km/h.\nBleiben Sie zu Hause.",
    nl:"Rijd niet tussen 18:00 en 21:00 UTC. Windstoten tot 90 km/u.\nBlijf thuis."
  },
  {
    taal:"ES",
    bron:"No viaje entre las 18:00 y las 21:00 UTC. Rachas de hasta 90 km/h.\nPermanezca dentro de casa.",
    nl:"Reis niet tussen 18:00 en 21:00 UTC. Windstoten tot 90 km/u.\nBlijf binnen."
  },
  {
    taal:"IT",
    bron:"Non viaggiare tra le 18:00 e le 21:00 UTC. Raffiche fino a 90 km/h.\nRestare al chiuso.",
    nl:"Reis niet tussen 18:00 en 21:00 UTC. Windstoten tot 90 km/u.\nBlijf binnen."
  }
];
for(const geval of voorbeelden){
  assert(t.GETOETSTE_TALEN.has(geval.taal),"getoetste brontaal "+geval.taal);
  assert(t.veilig(geval.bron,geval.nl,geval.taal),geval.taal+": consistente testvertaling");
  assert(!t.veilig(geval.bron,geval.nl.replace(/\bniet\b/,"wel"),geval.taal),
    geval.taal+": verdwenen ontkenning wordt geweigerd");
  assert(!t.veilig(geval.bron,geval.nl.replace("90 km/u","95 km/u"),geval.taal),
    geval.taal+": veranderde windsnelheid wordt geweigerd");
  assert(!t.veilig(geval.bron,geval.nl.replace("90 km/u","90 mph"),geval.taal),
    geval.taal+": veranderde meeteenheid wordt geweigerd");
  assert(!t.veilig(geval.bron,geval.nl.replace("UTC","CET"),geval.taal),
    geval.taal+": gewijzigde tijdzone wordt geweigerd");
  assert(!t.veilig(geval.bron,geval.nl.split("\n")[0],geval.taal),
    geval.taal+": ontbrekende aparte veiligheidsinstructie wordt geweigerd");
  assert(!t.veilig(geval.bron,geval.nl+"…",geval.taal),
    geval.taal+": afgebroken vertaalantwoord wordt geweigerd");
  assert(!t.veilig(geval.bron,geval.nl+"<script>",geval.taal),
    geval.taal+": HTML wordt geweigerd");
}

assert(!t.veilig("Do not travel tonight.\nStay indoors.",
  "Reis vanavond.\nBlijf niet binnen.","EN"),
  "dezelfde ontkenning mag niet naar een andere veiligheidsinstructie verschuiven");
assert(!t.veilig("Travel between 18:00 and 21:00 UTC.",
  "Reis niet tussen 18:00 en 21:00 UTC.","EN"),"extra ontkenning wordt conservatief geweigerd");
assert(!t.veilig("Winds could be dangerous. ".repeat(35),"Alles is veilig.","EN"),
  "sterk ingekorte vertaling wordt geweigerd");
assert(!t.veilig("Rainfall of 30 mm is expected.","Er wordt 30 cm neerslag verwacht.","EN"),
  "gewijzigde neerslageenheid wordt geweigerd");
assert(!t.veilig("Wind gusts of 20 m/s.","Windstoten van 20 km/u.","EN"),
  "m/s mag niet als km/u worden gepresenteerd");
assert(!t.veilig("Humidity 90%.","Luchtvochtigheid 90.","EN"),
  "procentteken mag niet verdwijnen");
assert(!t.veilig("Temperature −5 °C.","Temperatuur 5 °C.","EN"),
  "minteken mag niet verdwijnen");
assert(!t.veilig("Warning of 8 Bft.","Waarschuwing voor 8 m/s.","EN"),
  "Beaufort mag niet als een andere eenheid worden gepresenteerd");
assert(!t.veilig("Wind gusts of 90 km/h.","Windstoten tot 90 km/u.","PT"),
  "nog niet getoetste brontalen falen gesloten");
assert(t.veilig("Rachas de 75–90 km/h.","Windstoten van 75-90 km/u.","ES"),
  "bewezen equivalent windbereik blijft toegestaan");
assert(!t.veilig("Avoid travel.","Reizen is toegestaan.","EN"),
  "verbod/vermijdingsinstructie mag niet vervallen");
assert(t.veilig("Avoid travel.","Vermijd reizen.","EN"),
  "herkenbare vermijdingsinstructie blijft toegestaan");

/* De structurele heuristiek accepteert aantoonbaar een tegenovergesteld gebod.
   Dit is bewust een onderzoeksassertie, geen goedkeuring van de vertaling. */
const bronInstructie=voorbeelden[0].bron;
const verkeerdeInstructie="Reis niet tussen 18:00 en 21:00 UTC. Windstoten tot 90 km/u.\nGa naar buiten totdat de storm voorbij is.";
assert(t.veilig(bronInstructie,verkeerdeInstructie,"EN"),
  "regressie: de heuristiek mist semantische omkering");
assert.equal(t.WAARSCHUWINGVERTALING_VRIJGEGEVEN,false,"geen ongereviewde publicatie");

(async()=>{
  const env={DEEPL_TRANSLATE_ENABLED:"1",DEEPL_API_KEY:"TEST_ONLY"};
  let calls=0;
  const fetcher=async()=>{calls++;throw Error("veiligheidslock: geen DeepL-verzoek toegestaan");};
  for(const geval of voorbeelden){
    const data={bron:"National Weather Service",dekking:true,lijst:[{taal:geval.taal.toLowerCase(),tekst:geval.bron}]};
    const out=await t.vertaalWaarschuwingen(data,env,{fetcher,cache:null});
    assert.strictEqual(out,data,geval.taal+": officiële bron onveranderd");
    assert.equal(out.lijst[0].vertaling,undefined,geval.taal+": geen machinevertaling");
  }
  const data={bron:"National Weather Service",dekking:true,lijst:[{taal:"en-US",tekst:bronInstructie}]};
  assert.strictEqual(await t.vertaalWaarschuwingen(data,env,{
    fetcher:async()=>({ok:true,json:async()=>({translations:[{text:verkeerdeInstructie,detected_source_language:"EN"}]})}),cache:null
  }),data,"ook de bewezen semantische omkering kan niet gepubliceerd worden");
  assert.equal(calls,0,"nul DeepL-verzoeken ondanks expliciete opt-in");
  assert.strictEqual(await t.vertaalWaarschuwingen(null,env,{fetcher}),null);
  assert.strictEqual(await t.vertaalWaarschuwingen(data,env,{
    fetcher,cache:{match:()=>{throw Error("geen vertaalcache lezen");}}
  }),data,"oude vertalingen komen niet uit de cache");
  console.log("Veiligheid: vijf synthetische brontalen onderzocht, semantische false-negative aangetoond; harde no-publish/no-network lock geslaagd.");
})().catch(err=>{console.error(err);process.exitCode=1;});

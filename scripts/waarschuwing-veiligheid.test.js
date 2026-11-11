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

(async()=>{
  const env={DEEPL_TRANSLATE_ENABLED:"1",DEEPL_API_KEY:"TEST_ONLY"};
  let calls=0;
  const voorbeeld=voorbeelden[0];
  const data={bron:"National Weather Service",dekking:true,lijst:[{taal:"en-US",tekst:voorbeeld.bron,titel:"High Wind Warning"}]};
  const fetcher=async()=>{calls++;return {ok:true,json:async()=>({translations:[{text:voorbeeld.nl,detected_source_language:"EN"}]})};};
  const uit=await t.vertaalWaarschuwingen(data,env,{fetcher,cache:null});
  assert.equal(calls,1,"synthetische stub wordt precies eenmaal aangeroepen");
  assert.equal(uit.lijst[0].tekst,voorbeeld.bron,"officiële tekst blijft intact");
  assert.equal(uit.lijst[0].vertaling.tekst,voorbeeld.nl,"synthetische vertaling slaagt");
  const fout=await t.vertaalWaarschuwingen(data,env,{cache:null,fetcher:async()=>({
    ok:true,json:async()=>({translations:[{text:voorbeeld.nl.replace(/\bniet\b/,"wel"),detected_source_language:"EN"}]})
  })});
  assert.strictEqual(fout,data,"onveilige stubvertaling wordt niet gepubliceerd");
  const onbekend={...data,lijst:[{...data.lijst[0],taal:"pt-PT"}]};
  assert.strictEqual(await t.vertaalWaarschuwingen(onbekend,env,{
    cache:null,fetcher:()=>{throw Error("ongetoetste brontaal mag geen API-request doen");}
  }),onbekend);
  const uitgeschakeld=await t.vertaalWaarschuwingen(data,{DEEPL_TRANSLATE_ENABLED:"0",DEEPL_API_KEY:"TEST_ONLY"},{
    fetcher:()=>{throw Error("opt-out mag geen API-request doen");}
  });
  assert.strictEqual(uitgeschakeld,data,"standaard uit: geen kosten en originele data");
  console.log("Waarschuwingveiligheid: 5 synthetische talen, expliciete ontkenningen, tijdzones, cijfers, eenheden, volledigheid en fail-closed stub geslaagd.");
})().catch(err=>{console.error(err);process.exitCode=1;});

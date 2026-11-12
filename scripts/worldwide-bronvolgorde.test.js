"use strict";

/* Regressietest voor de volgorde waarin de wereldwijde monitor zijn live bronnen verzamelt
   (scripts/worldwide-bronvolgorde.js): eerst alle URL's ontdekken met de bestaande pauze, daarna alle live
   antwoorden direct achter elkaar ophalen. Wordt geladen door production-monitoring-config.test.js en draait
   zo mee in `npm test`. Geen netwerk, geen browser. */

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {verzamelLiveBronnen}=require("./worldwide-bronvolgorde.js");

const monitor=fs.readFileSync(path.join(__dirname,"production-worldwide-browser.js"),"utf8");
const VERWACHTE_LOCATIES=["Amsterdam","Singapore","Ushuaia","La Paz","Longyearbyen","Zuidpool","Dubai","Reykjavik","Punta Arenas","Miami","Tokio"];

/* De echte locatielijst van de monitor: alle 11, in dezelfde volgorde. */
const lijst=/const locaties=\[([^]*?)\n\];/.exec(monitor);
assert(lijst,"wereldwijde monitor: locatielijst niet gevonden");
const namen=[...lijst[1].matchAll(/\{naam:"([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(namen,VERWACHTE_LOCATIES,"wereldwijde monitor moet dezelfde 11 locaties in dezelfde volgorde houden");
const locaties=namen.map(naam=>({naam}));

function proefopstelling({ontdekFout,controleFout,haalFout,haalLeeg,haalDuur}={}){
  const stappen=[];
  const urlVan=naam=>"https://api.open-meteo.com/v1/forecast?plaats="+encodeURIComponent(naam);
  return {
    stappen,urlVan,
    opties:{
      locaties,
      pauzeMs:5000,
      slaap:async ms=>{stappen.push("slaap:"+ms);},
      ontdek:async locatie=>{
        stappen.push("ontdek:"+locatie.naam);
        if(ontdekFout===locatie.naam)throw new Error(locatie.naam+": volledige forecast-URL niet binnen 8000 ms opgebouwd");
        return urlVan(locatie.naam);
      },
      controleerUrl:(url,locatie)=>{
        stappen.push("controle:"+locatie.naam);
        assert.equal(url,urlVan(locatie.naam),"de URL-controle moet de URL van dezelfde locatie krijgen");
        if(controleFout===locatie.naam)throw new Error(locatie.naam+": retired pressure_msl staat nog in productiequery");
      },
      haal:async (url,locatie)=>{
        stappen.push("haal:"+locatie.naam);
        assert.equal(url,urlVan(locatie.naam),"het ophalen moet de eerder ontdekte URL van dezelfde locatie gebruiken");
        /* Ongelijke duur per locatie: de koppeling mag niet van timing afhangen. */
        if(haalDuur)await new Promise(resolve=>setTimeout(resolve,haalDuur(locatie.naam)));
        if(haalFout===locatie.naam)throw new Error(locatie.naam+": live bron niet bereikbaar");
        if(haalLeeg===locatie.naam)return {poging:1,via:"Open-Meteo"};
        return {bron:{uit:url,plaats:locatie.naam},poging:1,via:"Open-Meteo"};
      },
      meld:(locatie,live)=>{stappen.push("meld:"+locatie.naam);assert.equal(live.bron.plaats,locatie.naam,"de melding moet bij dezelfde locatie horen");}
    }
  };
}
const soort=stap=>stap.split(":")[0];
async function faalt(belofte,patroon,melding){
  let fout=null;
  try{await belofte;}catch(e){fout=e;}
  assert(fout,melding+": er kwam geen fout");
  assert(patroon.test(String(fout.message)),melding+": onverwachte fout "+fout.message);
}

(async()=>{
  /* 1. Volgorde: eerst alle ontdekkingen (met pauze ertussen), dan alle ophalingen zonder pauze. */
  {
    const p=proefopstelling({haalDuur:naam=>naam.length%3});
    const bronnen=await verzamelLiveBronnen(p.opties);
    const verwacht=[];
    locaties.forEach((l,i)=>{if(i>0)verwacht.push("slaap:5000");verwacht.push("ontdek:"+l.naam,"controle:"+l.naam);});
    locaties.forEach(l=>verwacht.push("haal:"+l.naam,"meld:"+l.naam));
    assert.deepEqual(p.stappen,verwacht,"volgorde: eerst alle URL's ontdekken met de bestaande pauze, daarna alle live antwoorden achter elkaar");
    const eersteOphaling=p.stappen.findIndex(stap=>soort(stap)==="haal");
    assert(p.stappen.slice(eersteOphaling).every(stap=>soort(stap)==="haal"||soort(stap)==="meld"),"na de eerste ophaling mag er geen pauze of ontdekking meer volgen");
    assert.equal(p.stappen.filter(stap=>soort(stap)==="slaap").length,locaties.length-1,"de bestaande pauze tussen de ontdekkingen blijft: één minder dan het aantal locaties");
    assert.equal(p.stappen.filter(stap=>soort(stap)==="haal").length,11,"alle 11 locaties worden opgehaald");
    /* Koppeling: iedere locatie krijgt de bron van haar eigen URL. */
    assert.deepEqual([...bronnen.keys()],VERWACHTE_LOCATIES,"de verzameling bevat alle 11 locaties in volgorde");
    for(const l of locaties)assert.deepEqual(bronnen.get(l.naam),{uit:p.urlVan(l.naam),plaats:l.naam},l.naam+": bron hoort niet bij de eigen URL");
  }
  /* 2. Een mislukte ontdekking of URL-controle stopt alles vóór de eerste ophaling. */
  for(const optie of [{ontdekFout:"Longyearbyen"},{controleFout:"Longyearbyen"}]){
    const p=proefopstelling(optie);
    await faalt(verzamelLiveBronnen(p.opties),/^Longyearbyen: /,"mislukte ontdekking of URL-controle");
    assert.equal(p.stappen.filter(stap=>soort(stap)==="haal").length,0,"zonder volledige ontdekking wordt er niets opgehaald");
    assert(!p.stappen.includes("ontdek:Zuidpool"),"na de fout volgt geen volgende locatie");
  }
  /* 3. Een bron die niet bereikbaar is of leeg terugkomt, laat de hele verzameling mislukken: geen gedeeltelijk resultaat. */
  {
    const p=proefopstelling({haalFout:"La Paz"});
    await faalt(verzamelLiveBronnen(p.opties),/^La Paz: live bron niet bereikbaar$/,"onbereikbare bron");
    assert.deepEqual(p.stappen.filter(stap=>soort(stap)==="haal"),["haal:Amsterdam","haal:Singapore","haal:Ushuaia","haal:La Paz"],"na een onbereikbare bron wordt niet doorgegaan");
    const q=proefopstelling({haalLeeg:"Zuidpool"});
    await faalt(verzamelLiveBronnen(q.opties),/^Zuidpool: live bron ontbreekt na het ophalen$/,"lege bron");
    assert(!q.stappen.includes("meld:Zuidpool"),"een lege bron mag niet als opgehaald worden gemeld");
  }
  /* 4. Dubbele namen zouden bronnen verwisselen: weigeren vóór de eerste stap. */
  {
    const p=proefopstelling();
    await faalt(verzamelLiveBronnen({...p.opties,locaties:[{naam:"Dubai"},{naam:"Dubai"}]}),/locatienamen moeten uniek zijn/,"dubbele locatienaam");
    assert.deepEqual(p.stappen,[],"bij dubbele namen wordt niets gestart");
  }

  /* 5. De monitor gebruikt deze volgorde met zijn bestaande functies; wat er wordt opgehaald en gecontroleerd is ongewijzigd. */
  for(const fragment of [
    'const {verzamelLiveBronnen}=require("./worldwide-bronvolgorde.js");',
    "const liveBronnen=await verzamelLiveBronnen({",
    "ontdek:locatie=>ontdekVolledigeForecastUrl(browser,locatie),",
    "controleerUrl:(sourceUrl,locatie)=>verifieerGeenPressureQuery(sourceUrl,locatie.naam),",
    "return haalLiveForecast(sourceUrl,locatie.naam,locatie);",
    "pauzeMs:BRON_PACING_MS,"
  ])assert(monitor.includes(fragment),"wereldwijde monitor gebruikt de vaste bronvolgorde niet meer: "+fragment);
  assert(!/await slaap\(BRON_PACING_MS\)/.test(monitor),"de pauze tussen locaties hoort alleen nog in de ontdekkingsronde van worldwide-bronvolgorde.js");
  for(const [fragment,waarom] of [
    ['begrensdeMs("WORLDWIDE_SOURCE_PACING_MS",5000,1000,30000)',"de bestaande pauze tussen ontdekkingen blijft gelijk"],
    ["for(let poging=1;poging<=3;poging++)","drie pogingen bij Open-Meteo blijven"],
    ["if(poging<3)await slaap(BRON_RETRY_BACKOFF_MS*poging)","de bestaande backoff bij Open-Meteo blijft"],
    ['const reserve=ROOT+"/api/forecast?"',"de reserveroute blijft"],
    ["for(let poging=1;poging<=2;poging++)","twee pogingen op de reserveroute blijven"],
    ["if(poging<2)await slaap(BRON_RETRY_BACKOFF_MS)","de bestaande backoff op de reserveroute blijft"],
    ["live bron niet bereikbaar","een onbereikbare bron blijft een fout"],
    ["if(!isVolledigeBron(bron))","onvolledige brondata wordt bij het ophalen geweigerd"],
    ["return ingevuld(bron.current.temperature_2m)&&uren.filter(ingevuld).length>=24;","de volledigheidscontrole eist echte meetwaarden"],
    ["assert(isVolledigeBron(bron),`${scherm.naam}/${locatie.naam}: live bronfixture ontbreekt`);","iedere browsercontrole eist opnieuw een volledige bron voor die locatie"],
    ["const bron=liveBronnen.get(locatie.naam);","de browsercontrole gebruikt de bron van dezelfde locatie"],
    ["for(const scherm of schermen){","beide schermformaten blijven"],
    ["for(const locatie of locaties){","iedere locatie wordt per scherm gecontroleerd"],
    ["verifieerBronwaarheid(bron,uit","de bronwaarheid blijft tegen de live respons gecontroleerd"]
  ])assert(monitor.includes(fragment),"wereldwijde monitor: "+waarom);

  console.log("worldwide-bronvolgorde: 11 locaties, eerst ontdekken met pauze en daarna achter elkaar ophalen, vaste koppeling locatie-URL-bron, fail-closed bij ontdek-, controle- en bronfouten, ongewijzigde retries, reserveroute en volledigheidscontrole.");
})().catch(fout=>{console.error(fout&&fout.stack||fout);process.exit(1);});

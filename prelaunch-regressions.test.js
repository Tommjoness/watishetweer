"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),cp=require("child_process");
const R=__dirname,lees=p=>fs.readFileSync(path.join(R,p),"utf8");let n=0;
const ok=(c,m)=>{assert.ok(c,m);n++;console.log("OK  "+m);};
const index=lees("index.html"),waars=lees("lib/waarschuwingen.cjs"),plaats=lees("lib/plaatsnaam.cjs"),build=lees("build-weather.js");
const workflowDir=path.join(R,".github","workflows");
const workflowBestanden=fs.readdirSync(workflowDir).filter(f=>/\.ya?ml$/i.test(f));
const workflows=workflowBestanden.map(f=>lees(path.join(".github","workflows",f))).join("\n");
const manifest=JSON.parse(lees("manifest.json"));
ok(index.includes("Wat is het weer?")&&manifest.name==="Wat is het weer?","publieke merknaam is consequent Nederlands");
ok(index.includes("privacy.html")&&fs.existsSync(path.join(R,"privacy.html")),"privacy-informatie is direct bereikbaar");
ok(!index.includes('locatieNu("auto-terugkerend");')&&!index.includes('locatieNu("auto-leeg").then'),"gps start niet automatisch bij openen");
ok(index.includes("coordOpslag")&&index.includes('S.lat.toFixed(3)')&&index.includes('S.lon.toFixed(3)'),"blijvende/deelbare locatieprecisie is beperkt tot drie decimalen");
ok(waars.includes("i.ends || i.expires || null"),"NWS gebruikt gebeurteniseinde vóór CAP-berichtverval");
ok(waars.includes("American Samoa")&&waars.includes("-14.6"),"American Samoa valt binnen NWS-dekking");
ok(waars.includes("waarschuwingTekst")&&!waars.includes("trim().slice(0, 300)"),"waarschuwingstekst breekt niet meer hard op 300 tekens af");
ok(index.includes("waarschuwingGeldigTot")&&!index.includes('" Geldig tot "+esc(w.tot)'),"waarschuwingstijd wordt lokaal en menselijk geformatteerd");
ok(index.includes("kan Open-Meteo uurdata interpoleren"),"kwartiergrafiek benoemt mogelijke interpolatie");
ok(plaats.indexOf("[viaBigDataCloud, viaNominatim]")>=0,"Nominatim is alleen fallback voor reverse-geocoding");
ok(index.includes("© OpenStreetMap-bijdragers")&&index.includes("MeteoAlarm")&&index.includes("National Weather Service"),"relevante databronnen zijn zichtbaar geattribueerd");
ok(index.includes('type="button" class="x"')&&index.includes('aria-label="Verwijder'),"verwijderen van bewaarde plaats is keyboard- en screenreaderbereikbaar");
ok(build.includes("CACHE_BRONNEN")&&build.includes('"manifest.json"')&&build.includes('"icon-192.png"')&&build.includes('instrument-sans-latin-600-normal.woff2'),"cachehash omvat de volledige app-shell");
ok(!/actions\/(?:checkout|setup-node)@v[1-5]\b/.test(workflows)&&workflows.includes("actions/checkout@v6")&&workflows.includes("actions/setup-node@v6")&&workflows.includes("node-version: 24")&&workflows.includes("playwright@latest"),"alle vaste CI-workflows gebruiken actuele Node-24 Actions; browserverificatie gebruikt actuele Playwright");
function nepRes(){return{statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[String(k).toLowerCase()]=v;},status(c){this.statusCode=c;return this;},json(b){this.body=b;return this;}};}
async function roep(moduleNaam,query,fetchImpl){const oud=global.fetch,p=require.resolve(moduleNaam);delete require.cache[p];global.fetch=fetchImpl;try{const h=require(p),r=nepRes();await h({query},r);return r;}finally{global.fetch=oud;delete require.cache[p];}}
(async()=>{
  const lang="Dit is een volledige eerste zin met belangrijke veiligheidsinformatie. "+"waarschuwing ".repeat(90)+"einde";
  const ny=await roep("./lib/waarschuwingen.cjs",{lat:"40.7128",lon:"-74.0060"},async url=>({ok:true,json:async()=>({features:[{properties:{event:"Heat Advisory",description:lang,severity:"Moderate",onset:"2026-08-09T10:00:00-04:00",expires:"2026-08-09T11:00:00-04:00",ends:"2026-08-09T19:00:00-04:00",areaDesc:"New York"}}]})}));
  ok(ny.body.lijst[0].tot==="2026-08-09T19:00:00-04:00","live NWS-adapter bewaart ends als geldigheid");
  ok((ny.body.lijst[0].tekst.length<=701&&!/\w$/.test(ny.body.lijst[0].tekst.slice(-1)))||ny.body.lijst[0].tekst.endsWith("."),"lange waarschuwing wordt op nette grens ingekort");
  let asUrl="";const as=await roep("./lib/waarschuwingen.cjs",{lat:"-14.2756",lon:"-170.7020"},async url=>{asUrl=String(url);return{ok:true,json:async()=>({features:[]})};});
  ok(as.body.bron==="National Weather Service"&&as.body.dekking===true&&asUrl.includes("api.weather.gov/alerts/active?point="),"American Samoa gebruikt de NWS-puntroute");
  const urls=[];const pl=await roep("./lib/plaatsnaam.cjs",{lat:"52.35",lon:"5.26"},async url=>{urls.push(String(url));return{ok:true,json:async()=>({city:"Almere"})};});
  ok(pl.body.naam==="Almere"&&urls.length===1&&urls[0].includes("bigdatacloud"),"BigDataCloud voorkomt normale Nominatim-aanroep");
  const manifestPad=path.join(R,"manifest.json"),origineel=fs.readFileSync(manifestPad,"utf8"),swPad=path.join(R,"public","sw.js");
  const cache=()=>{const m=/const CACHE = "([^"]+)";/.exec(fs.readFileSync(swPad,"utf8"));return m&&m[1];};
  const voor=cache();
  try{
    const gewijzigd=JSON.parse(origineel);gewijzigd.short_name="Weer test";fs.writeFileSync(manifestPad,JSON.stringify(gewijzigd,null,2)+"\n");
    cp.execFileSync(process.execPath,[path.join(R,"build-weather.js")],{cwd:R,stdio:"pipe"});
    ok(cache()!==voor,"wijziging van manifest verandert serviceworker-cachehash");
  }finally{
    fs.writeFileSync(manifestPad,origineel);
    cp.execFileSync(process.execPath,[path.join(R,"build-weather.js")],{cwd:R,stdio:"pipe"});
  }
  console.log("Pre-launch regressies: "+n+" controles geslaagd.");
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

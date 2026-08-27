"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),cp=require("child_process");
const R=__dirname,lees=p=>fs.readFileSync(path.join(R,p),"utf8");let n=0;
const ok=(c,m)=>{assert.ok(c,m);n++;console.log("OK  "+m);};
const index=lees("index.html"),privacy=lees("privacy.html"),engine=lees("interpretatie-engine.js"),waars=lees("lib/waarschuwingen.cjs"),plaats=lees("lib/plaatsnaam.cjs"),build=lees("build-weather.js"),cacheContract=lees("scripts/postbuild-cache.js");
const workflowDir=path.join(R,".github","workflows");
const workflowBestanden=fs.readdirSync(workflowDir).filter(f=>/\.ya?ml$/i.test(f));
const workflows=workflowBestanden.map(f=>lees(path.join(".github","workflows",f))).join("\n");
const manifest=JSON.parse(lees("manifest.json"));
ok(index.includes("Wat is het weer?")&&manifest.name==="Wat is het weer?","publieke merknaam is consequent Nederlands");
ok(index.includes("privacy.html")&&fs.existsSync(path.join(R,"privacy.html")),"privacy-informatie is direct bereikbaar");
ok(!privacy.includes("—"),"zichtbare privacycopy gebruikt geen em dash");
ok(!index.includes("Nu is het ")&&!index.includes("De actuele temperatuur is niet beschikbaar."),"briefing herhaalt de actuele temperatuur niet");
ok(index.includes("const opvallendeWind=bm>=5")&&index.includes("gmax!==null&&gmax>=60"),"gewone windpiek tot 4 Bft krijgt geen hoofdrol in briefing");
ok(index.includes("Afgelopen 15 minuten")&&index.includes("Komend uur")&&engine.includes('set(\"pop\",\"Droog\")'),"neerslagtegels gebruiken directe tijdvakken en consumententaal");
ok(index.includes("Kwartierverwachting op basis van weermodellen.")&&index.includes("<summary>Over deze gegevens</summary>"),"technische kwartieruitleg is ingeklapt beschikbaar");
ok(index.includes("${Math.round(sc)}/10")&&index.includes("Beste periode ")&&index.includes("Beste zichtperiode"),"nachtzicht toont afgeronde score en kortere consumententaal");
ok(index.includes("Technische locatiegegevens")&&index.includes("footer-details")&&!index.includes("Geen account, advertentietracking of analytics."),"footer houdt techniek uit de hoofdweergave");
ok(index.includes('const nuLabel=nuTemp===null?"nu":"nu "+Math.round(nuTemp)+"°"')&&index.includes("kandKaart.delete(idx)"),"grafiek toont één expliciete actuele temperatuur en onderdrukt nabije uurlabels");
ok(index.includes('UV-piek vandaag')&&index.includes('Math.round(Math.max(0,pu.v))'),"UV-tegel presenteert dagpiek zonder actuele schijnwaarde");
ok(index.includes('Math.abs(dp)<1 ? "Vrijwel stabiel."'),"kleine luchtdrukschommeling wordt consumentgericht als stabiel samengevat");
ok(index.includes('huidigeBft>=3')&&index.includes('richtingRelevant'),"zwakke wind krijgt geen irrelevante richtingsdraai in de briefing");
ok(index.includes("#suntimes .zondag")&&index.includes("Zonsopkomst ")&&index.includes("Zonsondergang ")&&index.includes("zon op ")&&index.includes("zon onder "),"zonsinformatie heeft een eigen daghiërarchie en expliciete grafieklabels");
ok(index.includes('--teal:#A7AEAB')&&!index.includes('--teal:#63C9BF')&&index.includes('#aq{border-top:1px solid var(--rule)}'),"normale informatie gebruikt een rustig neutraal accent in plaats van fel blauwgroen");
ok(engine.includes('briefingNeerslagZin')&&engine.includes('Geen neerslag verwacht.')&&engine.includes('? "Geen neerslag."'),"briefing en neerslagtegels gebruiken korte consumententaal zonder dubbele technische uitleg");
ok(!engine.includes('sub.textContent="Gemodelleerde concentratie"'),"pollen houdt een begrijpelijk kwalitatief oordeel");
ok(!index.includes('locatieNu("auto-terugkerend");')&&!index.includes('locatieNu("auto-leeg").then'),"gps start niet automatisch bij openen");
ok(index.includes("coordOpslag")&&index.includes('S.lat.toFixed(3)')&&index.includes('S.lon.toFixed(3)'),"blijvende/deelbare locatieprecisie is beperkt tot drie decimalen");
ok(waars.includes("i.ends || i.expires || null"),"NWS gebruikt gebeurteniseinde vóór CAP-berichtverval");
ok(waars.includes("American Samoa")&&waars.includes("-14.6"),"American Samoa valt binnen NWS-dekking");
ok(waars.includes("waarschuwingTekst")&&!waars.includes("trim().slice(0, 300)"),"waarschuwingstekst breekt niet meer hard op 300 tekens af");
ok(waars.includes("meteoalarm-legacy-atom-")&&waars.includes("api/v1/warnings/feeds-")&&waars.indexOf("api/v1/warnings/feeds-")<waars.indexOf("meteoalarm-legacy-atom-"),"MeteoAlarm probeert locatie-filterbare compatibiliteitsdata vóór de landbrede Atom-fallback");
ok(waars.includes('haal(compat, "application/json", 4000)')&&waars.includes('haal(atom, "*/*", 1800)')&&waars.includes("timeoutMs = 6000"),"MeteoAlarm houdt compatibiliteits- en Atom-fallback samen binnen de clienttimeout");
ok(waars.includes("plaatsSpecifiek: false")&&waars.includes('scope: "land"'),"landbrede Atom-waarschuwingen worden expliciet als niet plaats-specifiek gemarkeerd");
ok(index.includes("waarschuwingGeldigTot")&&!index.includes('" Geldig tot "+esc(w.tot)'),"waarschuwingstijd wordt lokaal en menselijk geformatteerd");
ok(index.includes("kan Open-Meteo uurdata interpoleren"),"kwartiergrafiek benoemt mogelijke interpolatie");
ok(!plaats.includes("api.bigdatacloud.net")&&!waars.includes("api.bigdatacloud.net")&&index.includes("api.bigdatacloud.net/data/reverse-geocode-client"),"gratis BigDataCloud reverse-geocoding draait uitsluitend client-side");
ok(index.includes("data-land=")&&index.includes("&land=")&&index.includes("land:S.land"),"landcode reist mee met zoeken, opslag, delen en waarschuwingen");
ok(index.includes("© OpenStreetMap-bijdragers")&&index.includes("MeteoAlarm")&&index.includes("National Weather Service"),"relevante databronnen zijn zichtbaar geattribueerd");
ok(index.includes('type="button" class="x"')&&index.includes('aria-label="Verwijder'),"verwijderen van bewaarde plaats is keyboard- en screenreaderbereikbaar");
ok(cacheContract.includes("CACHE_BRONNEN")&&cacheContract.includes('"manifest.json"')&&cacheContract.includes('"icon-192.png"')&&cacheContract.includes('instrument-sans-latin-600-normal.woff2')&&build.includes('vernieuwServiceworkerCache(OUT,"build-weather")'),"cachehash omvat de volledige app-shell via één gedeeld contract");
const playwrightPins=workflows.match(/playwright@[^\s"']+/g)||[];
ok(!/actions\/(?:checkout|setup-node)@v[1-5]\b/.test(workflows)&&workflows.includes("actions/checkout@v6")&&workflows.includes("actions/setup-node@v6")&&workflows.includes("node-version: 24")&&playwrightPins.length>=2&&playwrightPins.every(x=>x==="playwright@1.62.1")&&!workflows.includes("playwright@latest"),"vaste CI-workflows gebruiken moderne Actions en een reproduceerbare Playwright-pin");
function nepRes(){return{statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[String(k).toLowerCase()]=v;},status(c){this.statusCode=c;return this;},json(b){this.body=b;return this;}};}
async function roep(moduleNaam,query,fetchImpl){const oud=global.fetch,p=require.resolve(moduleNaam);delete require.cache[p];global.fetch=fetchImpl;try{const h=require(p),r=nepRes();await h({query},r);return r;}finally{global.fetch=oud;delete require.cache[p];}}
(async()=>{
  const lang="Dit is een volledige eerste zin met belangrijke veiligheidsinformatie. "+"waarschuwing ".repeat(90)+"einde";
  const ny=await roep("./lib/waarschuwingen.cjs",{lat:"40.7128",lon:"-74.0060",land:"US"},async url=>({ok:true,json:async()=>({features:[{properties:{event:"Heat Advisory",description:lang,severity:"Moderate",onset:"2026-08-09T10:00:00-04:00",expires:"2026-08-09T11:00:00-04:00",ends:"2026-08-09T19:00:00-04:00",areaDesc:"New York"}}]})}));
  ok(ny.body.lijst[0].tot==="2026-08-09T19:00:00-04:00","live NWS-adapter bewaart ends als geldigheid");
  ok(ny.body.lijst[0].plaatsSpecifiek===true,"NWS-puntroute wordt als plaats-specifiek gemarkeerd");
  ok((ny.body.lijst[0].tekst.length<=701&&!/\w$/.test(ny.body.lijst[0].tekst.slice(-1)))||ny.body.lijst[0].tekst.endsWith("."),"lange waarschuwing wordt op nette grens ingekort");
  let asUrl="";const as=await roep("./lib/waarschuwingen.cjs",{lat:"-14.2756",lon:"-170.7020",land:"AS"},async url=>{asUrl=String(url);return{ok:true,json:async()=>({features:[]})};});
  ok(as.body.bron==="National Weather Service"&&as.body.dekking===true&&asUrl.includes("api.weather.gov/alerts/active?point="),"American Samoa gebruikt de NWS-puntroute");
  const urls=[];const pl=await roep("./lib/plaatsnaam.cjs",{lat:"52.35",lon:"5.26"},async url=>{urls.push(String(url));return{ok:true,json:async()=>({address:{city:"Almere",country_code:"nl"}})};});
  ok(pl.body.naam==="Almere"&&pl.body.land==="NL"&&urls.length===1&&urls[0].includes("nominatim")&&!urls[0].includes("bigdatacloud"),"serverfallback gebruikt alleen Nominatim en bewaart landcode");

  const compatUrls=[];
  const eu=await roep("./lib/waarschuwingen.cjs",{lat:"52.35",lon:"5.26",land:"NL"},async url=>{
    compatUrls.push(String(url));
    return{ok:true,text:async()=>JSON.stringify({warnings:[]})};
  });
  ok(eu.body.dekking===true&&eu.body.land==="NL"&&eu.body.plaatsSpecifiek===true&&compatUrls.length===1&&compatUrls[0].includes("api/v1/warnings/feeds-netherlands"),"meegegeven landcode gebruikt eerst de locatie-filterbare MeteoAlarm-compatibiliteitsfeed");
  ok(!compatUrls.some(u=>u.includes("nominatim")||u.includes("bigdatacloud")),"meegegeven landcode voorkomt reverse-geocoding voor MeteoAlarm");

  const fbUrls=[];let atomAccept=null;
  const fb=await roep("./lib/waarschuwingen.cjs",{lat:"52.35",lon:"5.26",land:"NL"},async (url,opt)=>{
    fbUrls.push(String(url));
    if(String(url).includes("api/v1/warnings/feeds-")) throw new Error("compat test failure");
    atomAccept=opt&&opt.headers&&opt.headers.Accept;
    return{ok:true,text:async()=>"<?xml version=\"1.0\"?><feed xmlns=\"http://www.w3.org/2005/Atom\"><entry><title>Code geel</title><summary>Landbrede waarschuwing</summary></entry></feed>"};
  });
  ok(fb.body.dekking===true&&fb.body.land==="NL"&&fbUrls.length===2&&fbUrls[0].includes("api/v1/warnings/feeds-")&&fbUrls[1].includes("meteoalarm-legacy-atom-"),"MeteoAlarm valt na compatibiliteitsfout begrensd terug op Atom");
  ok(atomAccept==="*/*","MeteoAlarm Atom-aanroep gebruikt wildcard Accept om 406 te voorkomen");
  ok(fb.body.plaatsSpecifiek===false&&fb.body.lijst[0].plaatsSpecifiek===false&&fb.body.lijst[0].landelijk===true,"Atom-fallback blijft expliciet landbreed en niet plaats-specifiek");

  const gebied=await roep("./lib/waarschuwingen.cjs",{lat:"52.35",lon:"5.26",land:"NL"},async url=>({
    ok:true,text:async()=>JSON.stringify({warnings:[
      {event:"Binnen",severity:"Moderate",area:[{polygon:"52.0,5.0 52.0,5.5 52.6,5.5 52.6,5.0"}]},
      {event:"Buiten",severity:"Moderate",area:[{polygon:"50.0,3.0 50.0,3.5 50.5,3.5 50.5,3.0"}]}
    ]})
  }));
  ok(gebied.body.lijst.length===1&&gebied.body.lijst[0].titel==="Binnen"&&gebied.body.lijst[0].plaatsSpecifiek===true,"CAP-geometrie filtert waarschuwingen buiten de gekozen plaats weg");

  const oudUrls=[];const oud=await roep("./lib/waarschuwingen.cjs",{lat:"52.35",lon:"5.26"},async url=>{
    oudUrls.push(String(url));
    if(String(url).includes("nominatim"))return{ok:true,json:async()=>({address:{country_code:"nl"}})};
    return{ok:true,text:async()=>JSON.stringify({warnings:[]})};
  });
  ok(oud.body.land==="NL"&&oudUrls.some(u=>u.includes("nominatim"))&&oudUrls.some(u=>u.includes("api/v1/warnings/feeds-"))&&!oudUrls.some(u=>u.includes("bigdatacloud")),"oude locatie zonder landcode migreert via eenmalige Nominatim-fallback");

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

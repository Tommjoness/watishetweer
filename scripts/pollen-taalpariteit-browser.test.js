"use strict";

/* Pollenniveau per soort: de Nederlandse en Engelse weergave tonen bij identieke brongegevens exact dezelfde classificatie.
   De tegel per pollensoort krijgt van pollenNiveau() (scripts/final-audit-runtime-20260901.js) een niveau volgens de pollenschaal van het
   National Allergy Bureau (AAAAI): een zin ("Veel graspollen verwacht voor dit uur."), data-pollen-niveau op de waarde en daarmee de visuele
   nadruk (vet vanaf "hoog"). De soort werd uit de (in het Engels al vertaalde) tegelkop afgeleid, waardoor in het Engels de generieke zin
   bleef staan en het niveau en de nadruk ontbraken. De soort staat nu als data-pollen-soort op de tegel, onafhankelijk van de taal.

   Gecontroleerd (Chromium, de gebouwde pagina met onderschepte weerdata, tijd vastgezet):
   A. koude laad: alle zes soorten op de vier niveaugrenzen (net onder en op de grens), NL en EN: zin, data-pollen-niveau, data-pollen-soort
      en lettergewicht zijn gelijk aan de verwachte classificatie en gelijk tussen de talen; de Engelse zin onderscheidt de niveaus;
   B. opnieuw renderen in dezelfde pagina (lucht()) over alle niveaus per soort, ook met waarden van duizenden korrels (Engelse
      cijferweergave), en nog steeds correct na de late herberekeningen van de lagen eromheen;
   C. twee soorten tegelijk (hoogste eerst), ieder met zijn eigen niveau;
   D. 0 korrels, alle waarden ontbrekend (null), een locatie buiten Europa: geen niveau, geen nadruk, juiste melding in beide talen;
   E. taalwissel via de echte taalknop (herlaad): dezelfde classificatie in NL, EN en weer NL;
   F. asynchroon: laat antwoord van de luchtkwaliteitsbron en een plaatswissel met nieuwe pollengegevens.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");
const kern=require("../taal/vertaalkern.js"),woordenboek=require("../taal/en.js");
const vertaler=kern.maakVertaler(woordenboek);

const OUT=process.env.WIW_PUBLIC||path.join(__dirname,"..","public");
const KLOK="2026-07-22T15:39:00Z",METING="2026-07-22T17:30";
const PADEN={nl:"/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL",buiten:"/?lat=1.3521&lon=103.8198&plaats=Singapore&land=SG"};

function fixture(lat,lon){
  const d=bouw({temp:(u,dag)=>+(15.5+4.5*Math.sin((u-9)/24*Math.PI*2)-dag*0.4).toFixed(1),pp:()=>5,pr:()=>0,wc:(u)=>u<11?1:u<17?2:3,som:2});
  d.latitude=lat;d.longitude=lon;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,14)+"00");}
  const nu=h.time.indexOf(METING.slice(0,14)+"00");
  d.current.time=METING;d.current.temperature_2m=h.temperature_2m[nu];d.current.apparent_temperature=h.temperature_2m[nu]-1;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

/* Bron van de luchtkwaliteit en pollen voor de pagina; per test aan te passen. */
const SOORTEN=["gras","berk","els","bijvoet","ambrosia","olijf"];
const SLEUTEL={gras:"grass_pollen",berk:"birch_pollen",els:"alder_pollen",bijvoet:"mugwort_pollen",ambrosia:"ragweed_pollen",olijf:"olive_pollen"};
const AIR={modus:"normaal",waarden:{},vertraging:0};
function airJson(){
  const t=METING.slice(0,14)+"00",hourly={time:[t]};
  for(const s of SOORTEN)hourly[SLEUTEL[s]]=[AIR.modus==="null"?null:(AIR.waarden[s]||0)];
  return {current:{european_aqi:22,us_aqi:30},hourly};
}

/* Het contract dat behouden moet blijven: niveaugrenzen per soort (matig, hoog, zeer hoog) in korrels per m³ en de bijbehorende zinnen. */
const SCHAAL={gras:[5,20,200],berk:[15,90,1500],els:[15,90,1500],olijf:[15,90,1500],bijvoet:[10,50,500],ambrosia:[10,50,500]};
const WOORD={gras:"graspollen",berk:"berkenpollen",els:"elzenpollen",olijf:"olijfpollen",bijvoet:"bijvoetpollen",ambrosia:"ambrosiapollen"};
const NIVEAU_ZIN={laag:"Weinig","matig":"Matig veel",hoog:"Veel","zeer hoog":"Zeer veel"};
const NIVEAUS=["laag","matig","hoog","zeer hoog"];
const niveauVan=(s,v)=>{const [m,h,z]=SCHAAL[s];return v<m?"laag":v<h?"matig":v<z?"hoog":"zeer hoog";};
const zinNl=(s,niv)=>`${NIVEAU_ZIN[niv]} ${WOORD[s]} verwacht voor dit uur.`;
const zinEn=(s,niv)=>vertaler.vertaal(zinNl(s,niv));
const vet=niv=>niv==="hoog"||niv==="zeer hoog";
const grenswaarden=s=>{const [m,h,z]=SCHAAL[s];return [m-1,m,h-1,h,z-1,z];};

async function open(browser,root,{w=390,taal="nl",pad="nl",schema="light"}={}){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:mobiel?844:936},deviceScaleFactor:1,locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",colorScheme:schema,serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(([k,t])=>{
    const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;
    if(t==="en")try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(x){}
  },[KLOK,taal]);
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast"){
      const la=+(u.searchParams.get("latitude")||u.searchParams.get("lat")||52.09),lo=+(u.searchParams.get("longitude")||u.searchParams.get("lon")||5.12);
      return r.fulfill({json:fixture(la,lo)});
    }
    if(u.hostname==="geocoding-api.open-meteo.com")return r.fulfill({json:{results:[]}});
    if(u.hostname==="air-quality-api.open-meteo.com"){
      if(AIR.vertraging)await new Promise(x=>setTimeout(x,AIR.vertraging));
      return r.fulfill({json:airJson()});
    }
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+PADEN[pad],{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:25000});
  await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelector("#aq .stat"),null,{timeout:25000});
  /* Wacht ook op de late herberekeningen van de lagen rond de luchtsectie (één frame later en de vertaallaag). */
  await page.waitForTimeout(AIR.vertraging?AIR.vertraging+1500:1500);
  return {context,page,fouten};
}

/* De pollentegels: alles in #aq behalve de eerste (luchtkwaliteit) en de zonurentegel. */
const meetPollen=page=>page.evaluate(()=>{
  const aq=document.getElementById("aq"),tegels=[...aq.children];
  return tegels.filter((t,i)=>i>0&&!t.classList.contains("zon")).map(t=>{
    const val=t.querySelector(".sval"),sub=t.querySelector(".ssub");
    return {kop:(t.querySelector(".eyebrow")||{}).textContent||"",waarde:val?val.textContent.trim():"",sub:sub?sub.textContent.trim():"",
      niveau:val?val.getAttribute("data-pollen-niveau"):null,soort:t.getAttribute("data-pollen-soort"),
      gewicht:val?Number(getComputedStyle(val).fontWeight):null};
  });
});

let n=0;
const ok=(c,m)=>{assert(c,m);n++;};
const gelijk=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};
const eerlijk=(fouten,wat)=>gelijk(fouten,[],wat+": scriptfouten "+fouten.join(" | "));

/* Eén tegel tegen de verwachte classificatie. */
function controleerTegel(t,soort,v,taal,L){
  const niv=niveauVan(soort,v);
  gelijk(t.soort,soort,`${L}: data-pollen-soort`);
  gelijk(t.niveau,niv,`${L}: data-pollen-niveau`);
  gelijk(t.sub,taal==="nl"?zinNl(soort,niv):zinEn(soort,niv),`${L}: zin voor ${v} korrels/m³ (${niv})`);
  ok(vet(niv)?t.gewicht>=600:t.gewicht<600,`${L}: lettergewicht ${t.gewicht} past niet bij niveau ${niv}`);
  /* Enkelvoud bij 1 ("1 korrel/m³", "1 grain/m³") is bestaande weergave. */
  ok(new RegExp("^"+v+"\\s*(korrels?|grains?)/m³$").test(t.waarde),`${L}: getoonde waarde ${t.waarde}`);
}

/* De Engelse zinnen moeten de vier niveaus per soort onderscheiden (geen samenvallen op één generieke zin). */
function controleerVertaaltabel(){
  for(const s of SOORTEN){
    const en=NIVEAUS.map(niv=>zinEn(s,niv));
    ok(en.every(Boolean),`geen Engelse vertaling voor ${s}: ${JSON.stringify(en)}`);
    gelijk(new Set(en).size,4,`Engelse zinnen voor ${s} onderscheiden de niveaus niet: ${JSON.stringify(en)}`);
  }
}

/* A. koude laad: alle soorten op de niveaugrenzen, NL en EN. */
async function testKoudeLaad(browser,root){
  let aantal=0;
  for(const s of SOORTEN)for(const v of grenswaarden(s)){
    const resultaat={};
    for(const taal of ["nl","en"]){
      AIR.modus="normaal";AIR.vertraging=0;AIR.waarden={[s]:v};
      const {context,page,fouten}=await open(browser,root,{taal});
      try{
        const tegels=await meetPollen(page),L=`koud ${taal} ${s} ${v}`;
        gelijk(tegels.length,1,`${L}: aantal pollentegels`);
        controleerTegel(tegels[0],s,v,taal,L);
        resultaat[taal]=tegels[0];aantal++;
        eerlijk(fouten,L);
      }finally{await context.close();}
    }
    /* Pariteit: dezelfde classificatie en nadruk in beide talen. */
    gelijk([resultaat.nl.niveau,resultaat.nl.gewicht,resultaat.nl.soort],[resultaat.en.niveau,resultaat.en.gewicht,resultaat.en.soort],`pariteit NL/EN ${s} ${v}`);
  }
  console.log(`A. Koude laad: ${aantal} pagina's (6 soorten x 6 waarden x NL en EN): classificatie, zin, nadruk en soort gelijk aan de verwachting en gelijk in NL en EN.`);
}

/* B. opnieuw renderen in dezelfde pagina over alle niveaus, ook met duizenden korrels. */
async function testHerrender(browser,root){
  let aantal=0;
  for(const s of SOORTEN)for(const taal of ["nl","en"]){
    AIR.modus="normaal";AIR.vertraging=0;AIR.waarden={[s]:1};
    const {context,page,fouten}=await open(browser,root,{taal});
    try{
      const [m,h,z]=SCHAAL[s],waarden=[1,m-1,m,h-1,h,z-1,z,z*2+1,2500,m,1];
      for(const v of waarden){
        await page.evaluate(([k,v])=>{const i=S.air.hourly.time.findIndex(t=>t.slice(0,13)===S.d.current.time.slice(0,13));S.air.hourly[k][i<0?0:i]=v;lucht();},[SLEUTEL[s],v]);
        /* Eén frame later en de vertaallaag (maximaal 20 schrijfacties per 2 s per node: iedere render maakt nieuwe nodes). */
        await page.waitForTimeout(taal==="en"?450:120);
        const tegels=await meetPollen(page),L=`herrender ${taal} ${s} ${v}`;
        gelijk(tegels.length,1,`${L}: aantal pollentegels`);
        controleerTegel(tegels[0],s,v,taal,L);aantal++;
      }
      eerlijk(fouten,`herrender ${taal} ${s}`);
    }finally{await context.close();}
  }
  console.log(`B. Opnieuw renderen: ${aantal} renders over alle niveaus per soort (NL en EN, tot duizenden korrels/m³): altijd de juiste classificatie.`);
}

/* C. twee soorten tegelijk. */
async function testTweeSoorten(browser,root){
  for(const taal of ["nl","en"]){
    AIR.modus="normaal";AIR.vertraging=0;AIR.waarden={gras:140,berk:1600,els:3};
    const {context,page,fouten}=await open(browser,root,{taal});
    try{
      const tegels=await meetPollen(page),L=`twee soorten ${taal}`;
      gelijk(tegels.length,2,`${L}: hoogste twee soorten`);
      controleerTegel(tegels[0],"berk",1600,taal,L+" tegel 1");
      controleerTegel(tegels[1],"gras",140,taal,L+" tegel 2");
      eerlijk(fouten,L);
    }finally{await context.close();}
  }
  console.log("C. Twee soorten tegelijk (berk 1600 zeer hoog, gras 140 hoog; els 3 valt weg): ieder met eigen niveau, NL en EN.");
}

/* D. 0, ontbrekende data en buiten Europa. */
async function testGeenNiveau(browser,root){
  const gevallen=[
    /* Bij 0 korrels toont de pagina "0 korrels/m³" met de nul-melding; bij ontbrekende data en buiten Europa staat er een streepje. */
    ["alles 0",{modus:"normaal",waarden:{}},"nl",/^0\s*(korrels|grains)\/m³$/,{nl:"Geen pollen verwacht voor dit uur.",en:vertaler.vertaal("Geen pollen verwacht voor dit uur.")}],
    ["alles ontbreekt (null)",{modus:"null",waarden:{}},"nl","–",{nl:"Geen pollendata voor deze locatie",en:vertaler.vertaal("Geen pollendata voor deze locatie")}],
    ["buiten Europa",{modus:"normaal",waarden:{gras:140}},"buiten","–",{nl:"Voor deze locatie niet beschikbaar",en:vertaler.vertaal("Voor deze locatie niet beschikbaar")}]];
  for(const [naam,air,pad,waarde,zinnen] of gevallen)for(const taal of ["nl","en"]){
    Object.assign(AIR,{vertraging:0},air);
    const {context,page,fouten}=await open(browser,root,{taal,pad});
    try{
      const tegels=await meetPollen(page),L=`geen niveau ${naam} ${taal}`;
      gelijk(tegels.length,1,`${L}: één meldingstegel`);
      gelijk(tegels[0].niveau,null,`${L}: geen niveau`);gelijk(tegels[0].soort,null,`${L}: geen soort`);
      if(waarde instanceof RegExp)ok(waarde.test(tegels[0].waarde),`${L}: waarde ${tegels[0].waarde}`);else gelijk(tegels[0].waarde,waarde,`${L}: waarde`);ok(tegels[0].gewicht<600,`${L}: geen nadruk (${tegels[0].gewicht})`);
      ok(zinnen[taal],`${L}: vertaling ontbreekt`);gelijk(tegels[0].sub,zinnen[taal],`${L}: melding`);
      eerlijk(fouten,L);
    }finally{await context.close();}
  }
  console.log("D. 0 korrels, alle waarden ontbreken en buiten Europa: geen niveau, geen nadruk, juiste melding in NL en EN.");
}

/* E. taalwissel via de echte taalknop (herlaadt de pagina): NL > EN > NL. */
async function testTaalwissel(browser,root){
  for(const [s,v] of [["gras",140],["berk",1600],["bijvoet",9],["ambrosia",50]]){
    AIR.modus="normaal";AIR.vertraging=0;AIR.waarden={[s]:v};
    const {context,page,fouten}=await open(browser,root,{taal:"nl"});
    try{
      const L=`wissel ${s} ${v}`,staat=[];
      staat.push(["nl",await meetPollen(page)]);
      for(const doel of ["en","nl"]){
        await Promise.all([page.waitForNavigation({waitUntil:"domcontentloaded"}),page.click(`[data-taal-keuze="${doel}"]`)]);
        await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelector("#aq .stat"),null,{timeout:25000});
        await page.waitForTimeout(1500);
        staat.push([doel,await meetPollen(page)]);
      }
      staat.forEach(([taal,tegels])=>{gelijk(tegels.length,1,`${L} ${taal}: aantal`);controleerTegel(tegels[0],s,v,taal,`${L} ${taal}`);});
      gelijk(staat.map(([,t])=>[t[0].niveau,t[0].gewicht]).map(x=>JSON.stringify(x)).filter((x,i,a)=>a.indexOf(x)===i).length,1,`${L}: classificatie verschilt tussen NL, EN en NL`);
      eerlijk(fouten,L);
    }finally{await context.close();}
  }
  console.log("E. Taalwissel via de taalknop (NL > EN > NL): dezelfde classificatie, zin en nadruk na iedere herlaad.");
}

/* F. asynchroon: laat luchtantwoord en plaatswissel met nieuwe gegevens. */
async function testAsynchroon(browser,root){
  for(const taal of ["nl","en"]){
    /* Het luchtantwoord komt 1,8 s later dan de rest van de pagina. */
    AIR.modus="normaal";AIR.vertraging=1800;AIR.waarden={berk:100};
    const a=await open(browser,root,{taal});
    try{
      const L=`laat luchtantwoord ${taal}`,tegels=await meetPollen(a.page);
      gelijk(tegels.length,1,`${L}: aantal`);controleerTegel(tegels[0],"berk",100,taal,L);
      eerlijk(a.fouten,L);
      /* Plaatswissel: nieuwe pollengegevens via de eigen laadroute (vertraagd antwoord, andere soort en niveau). */
      AIR.waarden={gras:30,olijf:2};
      await a.page.evaluate(()=>load(51.9225,4.4792,"Rotterdam",false,true,"NL"));
      await a.page.waitForTimeout(AIR.vertraging+2200);
      const na=await meetPollen(a.page),L2=`plaatswissel ${taal}`;
      gelijk(na.length,2,`${L2}: aantal`);
      controleerTegel(na[0],"gras",30,taal,L2+" tegel 1");controleerTegel(na[1],"olijf",2,taal,L2+" tegel 2");
      eerlijk(a.fouten,L2);
    }finally{await a.context.close();AIR.vertraging=0;}
  }
  console.log("F. Asynchroon: laat luchtantwoord (1,8 s) en plaatswissel met nieuwe pollengegevens: juiste classificatie in NL en EN.");
}

server.listen(0,"127.0.0.1",async()=>{
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    controleerVertaaltabel();
    const tijd=async(naam,f)=>{const t=Date.now();await f();console.log("  duur "+naam+": "+((Date.now()-t)/1000).toFixed(1)+" s");};
    await tijd("A",()=>testKoudeLaad(browser,root));
    await tijd("B",()=>testHerrender(browser,root));
    await tijd("C",()=>testTweeSoorten(browser,root));
    await tijd("D",()=>testGeenNiveau(browser,root));
    await tijd("E",()=>testTaalwissel(browser,root));
    await tijd("F",()=>testAsynchroon(browser,root));
    console.log(`Pollenniveau NL/EN: ${n} controles geslaagd.`);
  }catch(e){console.error(e);process.exitCode=1;}
  finally{await browser.close();server.close();}
});

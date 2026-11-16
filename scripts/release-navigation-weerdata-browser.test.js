"use strict";

/* Releasenavigatie: weatherReady() accepteert alleen echte weerdata.
   Aanleiding: preview-release-navigation faalde met "hard-refresh uitgangspunt moet
   Amsterdam zijn" terwijl de preview geen weerdata had (Open-Meteo onbereikbaar,
   /api/forecast 503 zonder providersleutel). De oude readiness accepteerde de
   foutpagina zonder data: de statische aria-label "Plaats" en #t "--" zijn niet leeg.

   Gecontroleerd (Chromium, gebouwde pagina, onderschepte bronnen, gedeelde URL Amsterdam):
   A. normale weerdata: openWeather() slaagt bij poging 1 met plaats Amsterdam en een echte temperatuur;
   B. Open-Meteo onbereikbaar en /api/forecast HTTP 503: openWeather() faalt na precies 3
      begrensde pogingen met de juiste foutmelding en diagnostiek; de oude readiness had
      deze foutpagina geaccepteerd;
   C. placeholders (aria-label "Plaats" of "Gedeelde locatie", #t "--") op een zichtbare
      app worden niet als weerdata geaccepteerd.

   Draait na: npm run build:cloudflare */

process.env.NAVIGATION_WEATHER_RETRY_BACKOFF_MS="1000";

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");
const {weatherReady,openWeather,GENERIEKE_PLAATSLABELS}=require("./production-release-recovery-navigation.js");

const OUT=process.env.WIW_PUBLIC||path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(OUT,"index.html")))throw new Error("public/index.html ontbreekt voor de releasenavigatie-weerdatatest.");
const KLOK="2026-07-22T15:39:00Z",METING="2026-07-22T17:30";
const PAD="/?lat=52.368&lon=4.904&plaats=Amsterdam&land=NL";

function fixture(lat,lon){
  const d=bouw({temp:(u,dag)=>+(15.5+4.5*Math.sin((u-9)/24*Math.PI*2)-dag*0.4).toFixed(1),pp:()=>5,pr:()=>0,wc:(u)=>u<11?1:u<17?2:3,som:2});
  d.latitude=lat;d.longitude=lon;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,14)+"00");}
  const nu=h.time.indexOf(METING.slice(0,14)+"00");
  d.current.time=METING;d.current.temperature_2m=h.temperature_2m[nu];d.current.apparent_temperature=h.temperature_2m[nu]-1;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webp":"image/webp",".ico":"image/x-icon",".webmanifest":"application/manifest+json"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

/* modus: "data" = normale weerdata; "storing" = Open-Meteo onbereikbaar en /api/forecast 503;
   "hangt" = weerbronnen antwoorden niet (de app blijft op de statische placeholders staan). */
async function open(browser,root,modus){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
  const page=await context.newPage(),fouten=[],documenten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  page.on("request",r=>{if(r.isNavigationRequest()&&r.resourceType()==="document")documenten.push(r.url());});
  await page.addInitScript(k=>{
    const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;
  },KLOK);
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    const weerbron=u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast";
    if(weerbron&&modus==="hangt")return; /* nooit beantwoord */
    if(u.hostname==="api.open-meteo.com"){
      if(modus==="storing")return r.abort("timedout");
      return r.fulfill({json:fixture(+u.searchParams.get("latitude"),+u.searchParams.get("longitude"))});
    }
    if(u.pathname==="/api/forecast"){
      if(modus==="storing")return r.fulfill({status:503,json:{fout:"geen providersleutel (testsituatie preview)"}});
      return r.fulfill({json:fixture(+u.searchParams.get("lat"),+u.searchParams.get("lon"))});
    }
    if(u.hostname==="air-quality-api.open-meteo.com"){
      if(modus==="storing")return r.abort("timedout");
      return r.fulfill({json:{current:{european_aqi:20,us_aqi:30},hourly:{time:[]}}});
    }
    if(u.hostname==="geocoding-api.open-meteo.com")return r.fulfill({json:{results:[]}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname==="/api/plaatsnaam")return r.fulfill({json:{naam:"Amsterdam",land:"NL",bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  return {context,page,fouten,documenten};
}

/* De readiness vóór deze correctie, letterlijk: alleen niet-lege plaats en temperatuur. */
const oudeReadiness=page=>page.evaluate(()=>{
  const plaats=(document.getElementById("place")?.getAttribute("aria-label")||"").trim();
  const temp=(document.getElementById("t")?.textContent||"").trim();
  return !!plaats&&!!temp;
});

let n=0;
const ok=(c,m)=>{assert(c,m);n++;};
const gelijk=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};

async function testNormaal(browser,root){
  const {context,page,fouten}=await open(browser,root,"data");
  try{
    const poging=await openWeather(page,root+PAD,"normaal");
    gelijk(poging,1,"A: normale weerdata moet bij de eerste poging slagen");
    const s=await page.evaluate(()=>({plaats:document.getElementById("place").getAttribute("aria-label"),temp:document.getElementById("t").textContent.trim(),zonderData:document.getElementById("app").hasAttribute("data-zonder-data")}));
    gelijk(s.plaats,"Amsterdam","A: plaatslabel");
    ok(/^[\u2212-]?\d+$/.test(s.temp),`A: temperatuur moet een getal zijn, kreeg ${JSON.stringify(s.temp)}`);
    gelijk(s.zonderData,false,"A: geen foutpagina zonder data");
    gelijk(fouten,[],"A: scriptfouten");
  }finally{await context.close();}
  console.log("A. Normale weerdata: geaccepteerd bij poging 1 met plaats Amsterdam en een echte temperatuur.");
}

async function testStoring503(browser,root){
  const {context,page,fouten,documenten}=await open(browser,root,"storing");
  try{
    let fout=null;
    const start=Date.now();
    try{await openWeather(page,root+PAD,"hard-refresh voor");}catch(e){fout=e;}
    ok(fout,"B: openWeather moet falen zonder weerdata");
    const melding=String(fout.message);
    ok(melding.startsWith("hard-refresh voor: geen geldige weatherdata na 3 begrensde pogingen;"),`B: verkeerde foutmelding: ${melding}`);
    ok(melding.includes("fout=foutpagina zonder weerdata (data-zonder-data)"),`B: foutoorzaak ontbreekt: ${melding}`);
    const toestand=JSON.parse(melding.slice(melding.indexOf("toestand=")+"toestand=".length));
    gelijk(toestand.zonderData,true,"B: diagnostiek zonderData");
    gelijk(toestand.plaats,"Plaats","B: diagnostiek toont het generieke aria-label");
    gelijk(toestand.kop,"Amsterdam","B: diagnostiek toont de zichtbare kop");
    gelijk(toestand.temp,"--","B: diagnostiek toont de placeholdertemperatuur");
    ok(/^Ophalen mislukt/.test(toestand.status),`B: diagnostiek toont de foutstatus, kreeg ${JSON.stringify(toestand.status)}`);
    gelijk(documenten.length,3,`B: precies 3 begrensde pogingen (documentladingen), kreeg ${documenten.length}`);
    ok(Date.now()-start>=3000,"B: de backoff tussen de pogingen moet zijn gebruikt");
    gelijk(await oudeReadiness(page),true,"B: de oude readiness had deze foutpagina geaccepteerd (regressiebewijs)");
    gelijk(fouten,[],"B: scriptfouten");
  }finally{await context.close();}
  console.log("B. Open-Meteo onbereikbaar en /api/forecast 503: na 3 begrensde pogingen terecht gefaald met foutpagina-oorzaak en diagnostiek.");
}

async function testPlaceholders(browser,root){
  const {context,page,fouten}=await open(browser,root,"hangt");
  try{
    await page.goto(root+PAD,{waitUntil:"load",timeout:30000});
    await page.waitForFunction(()=>document.documentElement.dataset.appBootstrap==="ready",null,{timeout:20000});
    for(const [label,temp] of [["Plaats","--"],[GENERIEKE_PLAATSLABELS[1],"12"],["Amsterdam","--"]]){
      await page.evaluate(([label,temp])=>{
        const app=document.getElementById("app");app.style.display="block";app.removeAttribute("data-zonder-data");
        document.getElementById("place").setAttribute("aria-label",label);document.getElementById("t").textContent=temp;
      },[label,temp]);
      let fout=null;
      try{await weatherReady(page,2500);}catch(e){fout=e;}
      ok(fout&&/Timeout/i.test(String(fout.message)),`C: placeholder ${label}/${temp} mag niet als weerdata gelden (${fout?fout.message.split("\n")[0]:"geaccepteerd"})`);
    }
    gelijk(await oudeReadiness(page),true,"C: de oude readiness accepteerde placeholders");
    gelijk(fouten,[],"C: scriptfouten");
  }finally{await context.close();}
  console.log("C. Placeholders op een zichtbare app (Plaats/--, Gedeelde locatie, --) worden niet als weerdata geaccepteerd.");
}

server.listen(0,"127.0.0.1",async()=>{
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    await testNormaal(browser,root);
    await testStoring503(browser,root);
    await testPlaceholders(browser,root);
    console.log(`Releasenavigatie-weerdata: ${n} controles geslaagd.`);
  }catch(e){console.error(e);process.exitCode=1;}
  finally{await browser.close();server.close();}
});

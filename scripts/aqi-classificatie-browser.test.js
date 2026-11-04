"use strict";

/* Luchtkwaliteit (AQI): de getoonde categorie volgt per schaal de officiële indeling.
   Amerikaanse AQI (EPA, buiten Europa): 0–50 Goed (Good), 51–100 Matig (Moderate), 101–150 Ongezond voor gevoelige groepen
   (Unhealthy for sensitive groups), 151–200 Ongezond (Unhealthy), 201–300 Zeer ongezond (Very unhealthy), 301+ Gevaarlijk (Hazardous).
   Europese AQI (EEA, in Europa) blijft ongewijzigd: Goed, Redelijk, Matig, Slecht, Zeer slecht, Extreem slecht.
   De pagina legt de categorie in meerdere lagen vast (index.html, interpretatie-engine.js, senior-semantiek-20260810.js);
   de definitieve weergave in de gebouwde pagina is wat de bezoeker ziet en wat hier wordt gecontroleerd. De getalkleur is
   bewust neutraal en mag niet per categorie verschillen.

   Gecontroleerd (Chromium, gebouwde pagina met onderschepte weerdata, tijd vastgezet):
   A. koude laad op drie grenswaarden per schaal, NL en EN;
   B. opnieuw renderen (lucht()) over alle categoriegrenzen van beide schalen, NL en EN, op telefoon- en bureaubladbreedte;
   C. de getalkleur is voor alle categorieën gelijk (neutraal).

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=process.env.WIW_PUBLIC||path.join(__dirname,"..","public");
const KLOK="2026-07-22T15:39:00Z",METING="2026-07-22T17:30";
const PADEN={eu:"/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL",us:"/?lat=25.7617&lon=-80.1918&plaats=Miami&land=US"};

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

const AIR={eu:22,us:30};
const airJson=()=>({current:{european_aqi:AIR.eu,us_aqi:AIR.us},hourly:{time:[METING.slice(0,14)+"00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}});

/* Het contract: [bovengrens, Nederlandse naam, Engelse naam]; boven de laatste grens geldt de laatste categorie. */
const SCHALEN={
  us:{label:{nl:"AQI (VS-schaal)",en:"AQI (US scale)"},
    banden:[[50,"goed","good"],[100,"matig","moderate"],[150,"ongezond voor gevoelige groepen","unhealthy for sensitive groups"],[200,"ongezond","unhealthy"],[300,"zeer ongezond","very unhealthy"],[Infinity,"gevaarlijk","hazardous"]]},
  eu:{label:{nl:"Europese AQI",en:"European AQI"},
    banden:[[20,"goed","good"],[40,"redelijk","fair"],[60,"matig","moderate"],[80,"slecht","poor"],[100,"zeer slecht","very poor"],[Infinity,"extreem slecht","extremely poor"]]}
};
const GRENSWAARDEN={us:[0,50,51,100,101,150,151,200,201,300,301,500],eu:[0,20,21,40,41,60,61,80,81,100,101,150]};
const verwacht=(schaal,v,taal)=>{const b=SCHALEN[schaal].banden.find(x=>v<=x[0]);return taal==="nl"?b[1]:b[2];};

async function open(browser,root,{w=390,taal="nl",schaal="us"}={}){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:mobiel?844:936},deviceScaleFactor:1,locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
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
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:airJson()});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:schaal==="us"?"US":"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+PADEN[schaal],{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:25000});
  await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelector("#aq .stat"),null,{timeout:25000});
  await page.waitForTimeout(1500);
  return {context,page,fouten};
}

const meetAqi=page=>page.evaluate(()=>{
  const t=document.querySelector("#aq .stat"),val=t.querySelector(".sval"),sub=t.querySelector(".ssub");
  return {waarde:val.textContent.trim(),sub:sub.textContent.trim().toLowerCase(),subZichtbaar:sub.innerText.trim(),kleur:getComputedStyle(val).color,kop:((t.querySelector(".eyebrow")||{}).textContent||"").trim()};
});

let n=0;
const ok=(c,m)=>{assert(c,m);n++;};
const gelijk=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};

async function testKoudeLaad(browser,root){
  let aantal=0;
  for(const schaal of ["us","eu"])for(const taal of ["nl","en"])for(const v of (schaal==="us"?[51,101,301]:[21,41,101])){
    AIR[schaal]=v;AIR[schaal==="us"?"eu":"us"]=22;
    const {context,page,fouten}=await open(browser,root,{taal,schaal});
    try{
      const m=await meetAqi(page),L=`koude laad ${schaal} ${taal} ${v}`;
      gelijk(m.waarde,String(v),`${L}: waarde`);
      gelijk(m.sub,verwacht(schaal,v,taal),`${L}: categorie`);
      gelijk(m.kop,SCHALEN[schaal].label[taal],`${L}: schaallabel`);
      gelijk(fouten,[],`${L}: scriptfouten`);aantal++;
    }finally{await context.close();}
  }
  console.log(`A. Koude laad: ${aantal} situaties (VS en Europa, NL en EN) tonen de juiste categorie en schaallabel.`);
}

async function testHerrender(browser,root){
  let aantal=0;
  for(const schaal of ["us","eu"])for(const taal of ["nl","en"])for(const w of [390,1280]){
    AIR.us=30;AIR.eu=22;
    const {context,page,fouten}=await open(browser,root,{w,taal,schaal});
    const kleuren=new Set();
    try{
      for(const v of GRENSWAARDEN[schaal]){
        await page.evaluate(([s,v])=>{S.air.current[s==="us"?"us_aqi":"european_aqi"]=v;lucht();},[schaal,v]);
        await page.waitForTimeout(taal==="en"?450:120);
        const m=await meetAqi(page),L=`herrender ${schaal} ${taal} ${w}px ${v}`;
        gelijk(m.waarde,String(v),`${L}: waarde`);
        gelijk(m.sub,verwacht(schaal,v,taal),`${L}: categorie`);
        gelijk(m.kop,SCHALEN[schaal].label[taal],`${L}: schaallabel`);
        ok(/^[A-ZÀ-Ý]/.test(m.subZichtbaar),`${L}: zichtbare categorie begint met een hoofdletter (${m.subZichtbaar})`);
        kleuren.add(m.kleur);aantal++;
      }
      gelijk([...kleuren].length,1,`herrender ${schaal} ${taal} ${w}px: getalkleur is neutraal en voor alle categorieën gelijk (${[...kleuren].join(" | ")})`);
      gelijk(fouten,[],`herrender ${schaal} ${taal} ${w}px: scriptfouten`);
    }finally{await context.close();}
  }
  console.log(`B/C. Opnieuw renderen: ${aantal} renders over alle categoriegrenzen (VS en Europa, NL en EN, 390 en 1280 px); getalkleur neutraal.`);
}

server.listen(0,"127.0.0.1",async()=>{
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    await testKoudeLaad(browser,root);
    await testHerrender(browser,root);
    console.log(`AQI-classificatie: ${n} controles geslaagd.`);
  }catch(e){console.error(e);process.exitCode=1;}
  finally{await browser.close();server.close();}
});

"use strict";

/* Sectie "Lucht, pollen en zon": volgorde en indeling van de tegels.
   De sectietitel noemt lucht, pollen en zon; de tegels staan nu in die volgorde: AQI (Europese of Amerikaanse), pollen (een of twee soorten,
   of de melding dat er geen pollendata is) en als laatste de zonuren. Op mobiel vult de laatste tegel bij drie tegels de hele tweede rij.
   Gecontroleerd voor vijf samenstellingen (een pollensoort, twee soorten, geen noemenswaardige pollen, geen pollendata buiten Europa, geen
   luchtdata), NL en EN, licht en donker, 320 t/m 1920 px:
   A. DOM-volgorde = visuele volgorde = verwachte volgorde (geen CSS order of omgekeerde stroom); de zonurentegel is steeds de laatste;
   B. indeling: mobiel (tot en met 900 px) twee kolommen met bij een oneven aantal de laatste tegel over de volle breedte; desktop een rij met
      gelijke kolommen; tegels in dezelfde rij even hoog;
   C. geen afkapping, overflow of horizontale scroll, en geen onnodige witruimte (de hoogste tegel bepaalt de rijhoogte).

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=process.env.WIW_PUBLIC||path.join(__dirname,"..","public");
const KLOK="2026-07-22T15:39:00Z",METING="2026-07-22T17:30";
const PAD="/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL";
const TEKST={nl:"Kies een uur in de grafiek om de details te bekijken.",en:"Select an hour on the chart to see the details."};

function fixture(lat,lon){
  const d=bouw({temp:(u,dag)=>+(15.5+4.5*Math.sin((u-9)/24*Math.PI*2)-dag*0.4).toFixed(1),pp:()=>SC.pp,pr:()=>SC.pr,wc:(u,dag)=>u<11?1:u<17?2:3,som:2});
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



const SC={pp:0,pr:0};
const AIR={modus:"normaal",gras:5,berk:0};
const PADS={nl:"/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL",buiten:"/?lat=1.3521&lon=103.8198&plaats=Singapore&land=SG"};
const SAMENSTELLINGEN=[
  ["een pollensoort",{modus:"normaal",gras:5,berk:0},"nl",["aqi","pollen","zon"]],
  ["twee pollensoorten",{modus:"normaal",gras:5,berk:20},"nl",["aqi","pollen","pollen","zon"]],
  ["geen noemenswaardige pollen",{modus:"normaal",gras:0,berk:0},"nl",["aqi","pollen","zon"]],
  ["geen pollendata (buiten Europa)",{modus:"normaal",gras:5,berk:0},"buiten",["aqi","pollen","zon"]],
  ["geen luchtdata",{modus:"geen"},"nl",["melding"]]];

async function open(browser,root,{w,taal="nl",schema="light",pad="nl"}={}){
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
      if(AIR.modus==="geen")return r.fulfill({status:500,body:"{}"});
      const t=METING.slice(0,14)+"00",rij=v=>[v];
      return r.fulfill({json:{current:{european_aqi:22,us_aqi:30},hourly:{time:[t],grass_pollen:rij(AIR.gras),birch_pollen:rij(AIR.berk),alder_pollen:rij(0),mugwort_pollen:rij(0),ragweed_pollen:rij(0),olive_pollen:rij(0)}}});
    }
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+PADS[pad],{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:25000});
  await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelector("#aq .stat"),null,{timeout:25000});
  await page.waitForTimeout(1200);
  if(schema==="dark")await page.evaluate(()=>document.documentElement.setAttribute("data-thema","donker"));
  return {context,page,fouten};
}

const meetAq=page=>page.evaluate(()=>{
  const aq=document.getElementById("aq"),tegels=[...aq.children],R=e=>e.getBoundingClientRect(),cs=getComputedStyle(aq);
  const soort=t=>t.classList.contains("zon")?"zon":tegels.length===1?"melding":t===tegels[0]?"aqi":"pollen";
  const info=tegels.map((t,i)=>{
    const r=R(t),kinderen=[...t.querySelectorAll("*")].filter(e=>e.children.length===0&&e.textContent.trim());
    const inhoudOnder=Math.max(...kinderen.map(e=>R(e).bottom)),inhoudBoven=Math.min(...kinderen.map(e=>R(e).top));
    const buiten=kinderen.filter(e=>{const b=R(e);return b.left<r.left-0.5||b.right>r.right+0.5||b.top<r.top-0.5||b.bottom>r.bottom+0.5;}).map(e=>e.textContent.trim());
    const overflow=kinderen.filter(e=>e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=="visible").map(e=>e.textContent.trim());
    return {i,soort:soort(t),kop:(t.querySelector(".eyebrow")||{}).textContent||"",x:Math.round(r.left*10)/10,y:Math.round(r.top*10)/10,w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10,
      inhoud:Math.round((inhoudOnder-inhoudBoven)*10)/10,buiten,overflow,order:getComputedStyle(t).order};
  });
  return {tegels:info,kolommen:cs.gridTemplateColumns.split(" ").length,flow:cs.gridAutoFlow,richting:cs.direction,hscroll:document.documentElement.scrollWidth>innerWidth,cols:aq.className};
});
let n=0;const ok=(c,m)=>{assert(c,m);n++;};const gelijk=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};

function controleer(m,verwacht,w,L){
  const t=m.tegels;
  gelijk(t.map(x=>x.soort),verwacht,`${L}: samenstelling en DOM-volgorde ${JSON.stringify(t.map(x=>x.kop))}`);
  /* A. visuele leesvolgorde (rij voor rij, links naar rechts) = DOM-volgorde; geen CSS order of omgekeerde stroom */
  const visueel=[...t].sort((a,b)=>Math.abs(a.y-b.y)>2?a.y-b.y:a.x-b.x).map(x=>x.i);
  gelijk(visueel,t.map(x=>x.i),`${L}: visuele volgorde wijkt af van de DOM-volgorde`);
  ok(t.every(x=>x.order==="0")&&!/dense/.test(m.flow)&&m.richting==="ltr",`${L}: order/flow/richting verstoort de volgorde`);
  if(verwacht.includes("zon"))gelijk(t[t.length-1].soort,"zon",`${L}: zonuren is niet de laatste tegel`);
  /* B. indeling */
  const rijen=[...new Set(t.map(x=>Math.round(x.y)))],aantal=t.length;
  if(w<=900){
    if(aantal===1)gelijk([rijen.length,Math.round(t[0].w)],[1,Math.round(t[0].w)],`${L}: enkele tegel`);
    gelijk(rijen.length,Math.ceil(aantal/2),`${L}: ${rijen.length} rijen bij ${aantal} tegels op ${w}px`);
    if(aantal%2===1&&aantal>1){const laatste=t[t.length-1],eerste=t[0];ok(Math.abs(laatste.w-(t[1]?(t[0].w+t[1].w):laatste.w))<=2,`${L}: laatste tegel vult niet de volle rij (${laatste.w})`);gelijk(laatste.soort,verwacht[verwacht.length-1],`${L}: laatste tegel`);}
    if(aantal%2===0)ok(t.every(x=>Math.abs(x.w-t[0].w)<=1.5),`${L}: ongelijke kolommen ${t.map(x=>x.w)}`);
  }else{
    gelijk(rijen.length,1,`${L}: desktop is één rij`);
    ok(t.every(x=>Math.abs(x.w-t[0].w)<=1.5),`${L}: ongelijke kolommen ${t.map(x=>x.w)}`);
  }
  for(const r of rijen){
    const rij=t.filter(x=>Math.round(x.y)===r);
    ok(rij.every(x=>Math.abs(x.h-rij[0].h)<=1.5),`${L}: ongelijke tegelhoogtes in een rij ${rij.map(x=>x.h)}`);
    /* C. geen onnodige witruimte: de hoogste inhoud bepaalt de rijhoogte (rij is niet meer dan de tegelpadding hoger) */
    ok(rij[0].h-Math.max(...rij.map(x=>x.inhoud))<=40,`${L}: onnodige witruimte, rij ${rij[0].h}px, hoogste inhoud ${Math.max(...rij.map(x=>x.inhoud))}px`);
  }
  ok(t.every(x=>x.buiten.length===0),`${L}: tekst buiten de tegel ${JSON.stringify(t.map(x=>x.buiten))}`);
  ok(t.every(x=>x.overflow.length===0),`${L}: overflow ${JSON.stringify(t.map(x=>x.overflow))}`);
  ok(!m.hscroll,`${L}: horizontale scroll`);
}

server.listen(0,"127.0.0.1",async()=>{
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    const breedtes=[320,360,390,430,768,900,901,1024,1366,1920];
    for(const [naam,air,pad,verwacht] of SAMENSTELLINGEN)for(const w of breedtes)for(const [taal,schema] of [["nl","light"],["en","dark"]]){
      Object.assign(AIR,{gras:0,berk:0},air);
      const {context,page,fouten}=await open(browser,root,{w,taal,schema,pad});
      const L=`${naam} ${w}px ${taal} ${schema}`;
      try{
        const m=await meetAq(page);
        controleer(m,verwacht,w,L);
        assert.deepEqual(fouten,[],L+": scriptfouten "+fouten.join(" | "));
      }finally{await context.close();}
    }
    console.log(`Lucht, pollen en zon: ${n} controles geslaagd (vijf samenstellingen x ${breedtes.join("/")} px x NL licht en EN donker): volgorde AQI, pollen, zonuren in DOM en beeld, indeling, geen afkapping of onnodige witruimte.`);
  }catch(e){console.error(e);process.exitCode=1;}
  finally{await browser.close();server.close();}
});

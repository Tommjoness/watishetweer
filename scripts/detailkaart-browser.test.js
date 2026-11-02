"use strict";

/* Mobiele detailkaart (#tip-strook, tot en met 429 px): vier rijen met kans en neerslaghoeveelheid als aparte waarden.
   Toetst, met de langste realistische waarden en op 320, 360, 390, 413, 420 en 429 px in NL en EN:
   A. waarden: elke kaartwaarde komt uit de weerreeksen en klopt met het gekozen uur (kans, hoeveelheid, temperatuur, wind, bewolking;
      "0,0 mm" alleen bij een echte nul, "<0,1 mm" bij een kleine positieve waarde, "–" bij een ontbrekende waarde, nooit stilzwijgend nul);
   B. geen afkapping, overlap, regelafbreking of horizontale scroll; kleinste tekst >= 12 px; vaste hoogte 140 px;
   C. uitlijning: bij normale waarden staan de tweede kolommen van de drie dubbele rijen onder elkaar en eindigen alle waarden op de rechterrand;
   D. geen layoutverschuiving bij het wisselen van uren en talen (hoogte van de kaart en positie van de inhoud eronder constant);
   E. de kaart volgt de gegevens bij een verversing met hetzelfde geselecteerde uur;
   F. de SVG-tooltip en de desktopweergave blijven ongewijzigd (zes rijen, gecombineerde neerslagregel, kaart verborgen);
   G. toegankelijkheid ongewijzigd: kaart aria-hidden, slidertekst met uur, temperatuur en neerslagkans.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");

const OUT=process.env.WIW_PUBLIC||path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(OUT,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const UUR=3600000,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const iso=(ms,off)=>new Date(ms+off*1000).toISOString().slice(0,16);

/* Zes weerscenario's, gekozen op het UTC-uur (u % 6): normaal, extreem (langste waarden), droog, kleine hoeveelheid, ontbrekende waarden, vorst met sneeuw. */
const SC=[
  {T:12.4,A:10.2,P:8,MM:0.2,W:19,WD:0,G:35,C:30,code:2},
  {T:-40.4,A:-45.2,P:100,MM:123.4,W:250.4,WD:250,G:250.2,C:100,code:99},
  {T:3.2,A:1.1,P:0,MM:0,W:8,WD:90,G:20,C:0,code:0},
  {T:7.6,A:5.9,P:30,MM:0.04,W:22,WD:180,G:48,C:55,code:3},
  {T:9.4,A:7.4,P:40,MM:null,W:14,WD:315,G:null,C:80,code:61},
  {T:-5.4,A:-9.6,P:65,MM:1.46,W:105,WD:200,G:118.4,C:100,code:71}];
/* Verwachte kaartwaarden per scenario (Nederlands): temperatuur, voelt als, kans, neerslag, windstoten, bewolking. */
const VERWACHT=[
  ["12°C","10°C","8%","0,2 mm","35 km/u","30%"],
  ["-40°C","-45°C","100%","123,4 mm","250 km/u","100%"],
  ["3°C","1°C","0%","0,0 mm","20 km/u","0%"],
  ["8°C","6°C","30%","<0,1 mm","48 km/u","55%"],
  ["9°C","7°C","40%","–","–","80%"],
  ["-5°C","-10°C","65%","1,5 mm","118 km/u","100%"]];
/* Open-Meteo-vormig antwoord op één vaste offset, met scenario-gestuurde uurwaarden. */
function antwoord(nuMs,offsetS,opties){
  const o=opties||{};
  const lokaalNu=iso(nuMs,offsetS),vandaag=lokaalNu.slice(0,10);
  const dag0=Date.parse(vandaag+"T00:00:00Z")-offsetS*1000,start=dag0-24*UUR,uren=8*24;
  const h={time:[],temperature_2m:[],apparent_temperature:[],relative_humidity_2m:[],dew_point_2m:[],precipitation_probability:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[],cloud_cover:[],wind_speed_10m:[],wind_direction_10m:[],wind_gusts_10m:[],visibility:[],uv_index:[],pressure_msl:[],is_day:[]};
  for(let i=0;i<uren;i++){
    const ms=start+i*UUR,u=new Date(ms).getUTCHours(),s=SC[u%6],vorig=SC[(u+5)%6];
    h.time.push(iso(ms,offsetS));
    h.temperature_2m.push(s.T);h.apparent_temperature.push(s.A);h.relative_humidity_2m.push(80);h.dew_point_2m.push(s.T-4);
    /* Kans en hoeveelheid horen bij het uur dat op TI[k] begint: bronindex +1 (zie etmaal). */
    h.precipitation_probability.push(vorig.P);h.precipitation.push(vorig.MM);h.rain.push(vorig.MM);h.showers.push(0);h.snowfall.push(0);
    h.weather_code.push(s.code);h.cloud_cover.push(s.C);
    h.wind_speed_10m.push(s.W);h.wind_direction_10m.push(s.WD);h.wind_gusts_10m.push(s.G);h.visibility.push(20000);h.uv_index.push(0);h.pressure_msl.push(1015);h.is_day.push(u>=6&&u<16?1:0);
  }
  const dagen=Array.from({length:7},(_,k)=>new Date(Date.parse(vandaag+"T00:00:00Z")+k*86400000).toISOString().slice(0,10));
  const uurIndex=h.time.indexOf(iso(Math.floor(nuMs/UUR)*UUR,offsetS)),kwartier=Math.floor(nuMs/900000)*900000;
  return {latitude:52.37,longitude:4.9,timezone:"Europe/Amsterdam",timezone_abbreviation:offsetS===7200?"GMT+2":"GMT+1",utc_offset_seconds:offsetS,
    current:{time:iso(kwartier,offsetS),temperature_2m:h.temperature_2m[uurIndex]==null?10:h.temperature_2m[uurIndex],apparent_temperature:9,relative_humidity_2m:80,is_day:h.is_day[uurIndex],precipitation:0,rain:0,showers:0,snowfall:0,weather_code:2,cloud_cover:30,pressure_msl:1015,wind_speed_10m:12,wind_direction_10m:240,wind_gusts_10m:25,visibility:20000},
    minutely_15:{time:Array.from({length:20},(_,k)=>iso(kwartier+(k-4)*900000,offsetS)),precipitation:Array(20).fill(0),rain:Array(20).fill(0),showers:Array(20).fill(0),snowfall:Array(20).fill(0),weather_code:Array(20).fill(2)},
    hourly:h,
    daily:{time:dagen,weather_code:dagen.map(()=>2),temperature_2m_max:dagen.map(()=>14),temperature_2m_min:dagen.map(()=>6),sunrise:dagen.map(d=>iso(Date.parse(d+"T05:30:00Z"),offsetS)),sunset:dagen.map(d=>iso(Date.parse(d+"T16:30:00Z"),offsetS)),
      precipitation_probability_max:dagen.map(()=>20),precipitation_sum:dagen.map(()=>0),uv_index_max:dagen.map(()=>1),wind_speed_10m_max:dagen.map(()=>20),wind_gusts_10m_max:dagen.map(()=>30),wind_direction_10m_dominant:dagen.map(()=>240),sunshine_duration:dagen.map(()=>18000)}};
}

const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,"http://localhost").pathname);if(p.endsWith("/"))p+="index.html";
  let f=path.join(OUT,p);if(!fs.existsSync(f)&&fs.existsSync(f+".html"))f+=".html";
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,{w,h,nuIso,offsetS,taal,opties}){
  const nuMs=Date.parse(nuIso),mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:h||900},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(([e,taal])=>{const N=Date,s=N.now();class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;
    try{if(taal)localStorage.setItem("weerbriefing.taal.v1",JSON.stringify(taal));}catch(x){}},[nuMs,taal==="en"?"en":null]);
  const bron={data:antwoord(nuMs,offsetS,opties)};
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:bron.data});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:[bron.data.current.time.slice(0,13)+":00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],olive_pollen:[0],ragweed_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/amsterdam/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:20000});
  await page.waitForFunction(()=>document.querySelectorAll("#days .row.day").length>=7&&document.getElementById("scrub")&&(((document.getElementById("scrub").dataset.modus)&&document.querySelectorAll("#wiw-hour-table tbody tr").length>0)||((document.getElementById("tip-strook")||{}).dataset&&document.getElementById("tip-strook").dataset.leeg)),null,{timeout:20000});
  await sleep(500);
  return {context,page,fouten,bron};
}


const geoXY=(page,ms)=>page.evaluate(ms=>{
  const G=S.geo,svg=document.getElementById("chart");svg.scrollIntoView({block:"center"});
  const k=WeatherNowInterpretatie.indexVoorInstant(G.TI,S.d.utc_offset_seconds,ms);if(k<0)return null;
  const r=svg.getBoundingClientRect(),sc=r.width/(G.W||900);return {k,x:r.left+G.x(k)*sc,y:r.top+G.y(G.T[k])*sc};
},ms);
const meetKaart=page=>page.evaluate(()=>{
  const st=document.getElementById("tip-strook"),cs=getComputedStyle(st),sb=st.getBoundingClientRect();
  const binnenRechts=sb.right-parseFloat(cs.paddingRight)-1;
  const cellen=[...st.querySelectorAll(".tip-rij")];
  const regelH=e=>parseFloat(getComputedStyle(e).lineHeight);
  const problemen=[];
  cellen.forEach(c=>{
    const dt=c.querySelector("dt"),dd=c.querySelector("dd"),a=dt.getBoundingClientRect(),b=dd.getBoundingClientRect(),cr=c.getBoundingClientRect();
    if(c.scrollWidth>c.clientWidth+0.5)problemen.push("overflow "+dt.textContent);
    if(a.right>b.left-0.5)problemen.push("label raakt waarde "+dt.textContent);
    if(a.height>regelH(dt)*1.4||b.height>regelH(dd)*1.4)problemen.push("regelafbreking "+dt.textContent);
    if(b.right>cr.right+0.5||a.left<cr.left-0.5||b.right>binnenRechts+0.5)problemen.push("buiten de kaart "+dt.textContent);
  });
  const kop=st.querySelector(".tip-kop"),oms=st.querySelector(".tip-oms");
  if(kop.getBoundingClientRect().height>parseFloat(getComputedStyle(kop).lineHeight)*1.4)problemen.push("kop breekt af");
  if(oms.getBoundingClientRect().height>regelH(oms)*1.4)problemen.push("omschrijving breekt af");
  const fonts=[...st.querySelectorAll(".tip-kop,.tip-oms,dt,dd")].map(e=>parseFloat(getComputedStyle(e).fontSize));
  const duos=[...st.querySelectorAll(".tip-duo")];
  const dag=document.querySelector(".dagmod").getBoundingClientRect().bottom+scrollY;
  const volgende=[...document.querySelectorAll("h2")].find(h=>{const r=h.getBoundingClientRect();return r.height>0&&r.top+scrollY>dag;});
  return {rijen:cellen.map(c=>[c.querySelector("dt").textContent,c.querySelector("dd").textContent]),problemen,h:Math.round(sb.height*100)/100,
    minFont:Math.min(...fonts),docBreed:document.documentElement.scrollWidth,vw:innerWidth,
    tweedeKolomX:duos.map(d=>Math.round(d.children[1].querySelector("dt").getBoundingClientRect().left*10)/10),
    waardeRechts:cellen.filter((c,i)=>i%1===0).map(c=>Math.round(c.querySelector("dd").getBoundingClientRect().right*10)/10).filter((x,i)=>[1,3,4,6].includes(i)),binnenRechts:Math.round(binnenRechts*10)/10,
    volgendTop:volgende?Math.round((volgende.getBoundingClientRect().top+scrollY)*10)/10:null,docH:document.documentElement.scrollHeight,
    kaartTop:Math.round((sb.top+scrollY)*10)/10,naKaartBottom:st.nextElementSibling?Math.round((st.nextElementSibling.getBoundingClientRect().bottom+scrollY)*10)/10:null,
    kop:kop.textContent,oms:oms.textContent.replace(/\u00a0/g,""),ariaHidden:st.getAttribute("aria-hidden"),
    svgWind:(document.querySelector('#scrub text[data-tip-rij="4"][data-tip-kol="waarde"]')||{}).textContent||"",
    svgStoot:(document.querySelector('#scrub text[data-tip-rij="5"][data-tip-kol="waarde"]')||{}).textContent||"",
    valuetext:(document.getElementById("hit")||{getAttribute:()=>""}).getAttribute("aria-valuetext")};
});
const sleutel=iso0=>String(Date.parse(iso0));
const eerlijk=async (page,fouten,wat)=>{assert.deepEqual(fouten,[],wat+": scriptfouten "+fouten.join(" | "));};
let n=0;const ok=(c,m)=>{assert(c,m);n++;};const gelijk=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};
const enGetal=t=>t.replace(",",".").replace("km/u","km/h");

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    const NU="2026-07-22T12:10:00Z",OFFSET=7200;
    const referentie={};   // per breedte: kaarthoogte en positie eronder, om NL en EN te vergelijken
    for(const w of [320,360,390,413,420,429])for(const taal of ["nl","en"]){
      const L=w+"px "+taal;
      const {context,page,fouten}=await open(browser,root,{w,nuIso:NU,offsetS:OFFSET,taal:taal==="en"?"en":undefined});
      try{
        const hoogtes=new Set(),volgend=new Set(),tops=new Set();
        /* Zes opeenvolgende uren: 13:00Z t/m 18:00Z = scenario 1 t/m 5 en 0 (u % 6). */
        for(const u of [13,14,15,16,17,18]){
          const sc=u%6,instant=Date.parse("2026-07-22T"+String(u).padStart(2,"0")+":00:00Z");
          const pv=await geoXY(page,instant);ok(pv,L+": uur "+u+"Z staat in de grafiek");
          await page.touchscreen.tap(pv.x,pv.y);
          await page.waitForFunction(lokaal=>(document.querySelector("#tip-strook .tip-kop")||{textContent:""}).textContent.endsWith(lokaal),String(u+2).padStart(2,"0")+":00",{timeout:8000});
          await sleep(250);
          const m=await meetKaart(page);
          /* A. waarden */
          gelijk(m.rijen.length,7,L+" uur "+u+": zeven waarden");
          const v=VERWACHT[sc].map(x=>taal==="en"?enGetal(x):x);
          const labels=taal==="en"?["temperature","feels like","chance","precip.","wind","gusts","cloud cover"]:["temperatuur","voelt als","kans","neerslag","wind","windstoten","bewolking"];
          gelijk(m.rijen.map(r=>r[0]),labels,L+" uur "+u+": labels");
          gelijk([m.rijen[0][1],m.rijen[1][1],m.rijen[2][1],m.rijen[3][1],m.rijen[5][1],m.rijen[6][1]],v,L+" uur "+u+": waarden voor scenario "+sc);
          gelijk(m.rijen[4][1],m.svgWind,L+" uur "+u+": wind gelijk aan de SVG-tooltip");
          if(sc!==4)gelijk(m.rijen[5][1],m.svgStoot,L+" uur "+u+": windstoten gelijk aan de SVG-tooltip");
          if(sc===1)ok(/250 km\/(u|h) (WZW|WSW), 12 Bft/.test(m.rijen[4][1]),L+": wind met drie cijfers en richting ("+m.rijen[4][1]+")");
          ok(!m.rijen.some(r=>/NaN|undefined|null/.test(r[1])),L+" uur "+u+": geen NaN of undefined");
          /* G. toegankelijkheid */
          gelijk(m.ariaHidden,"true",L+": kaart is aria-hidden");
          ok(taal==="en"||new RegExp("^"+String(u+2).padStart(2,"0")+":00, -?\\d+ graden, \\d+ procent neerslagkans$").test(m.valuetext||""),L+" uur "+u+": slidertekst ("+m.valuetext+")");
          /* B. geen afkapping, overlap of afbreking; lettergrootte; geen horizontale scroll */
          gelijk(m.problemen,[],L+" uur "+u+": "+m.problemen.join("; "));
          ok(m.minFont>=12,L+" uur "+u+": kleinste tekst "+m.minFont+"px");ok(m.docBreed<=m.vw,L+" uur "+u+": horizontale scroll");
          gelijk(m.h,140,L+" uur "+u+": kaarthoogte");
          /* C. uitlijning bij normale waarden (scenario 0, 2, 3, 5): tweede kolom en rechterrand lijnen uit */
          if([0,2,3,5].includes(sc)){
            ok(Math.max(...m.tweedeKolomX)-Math.min(...m.tweedeKolomX)<=1,L+" uur "+u+": tweede kolom lijnt niet uit ("+m.tweedeKolomX+")");
            ok(m.waardeRechts.every(x=>Math.abs(x-m.binnenRechts)<=1),L+" uur "+u+": waarden eindigen niet op de rechterrand ("+m.waardeRechts+" vs "+m.binnenRechts+")");
          }
          hoogtes.add(m.h);tops.add(m.kaartTop);volgend.add(Math.round((m.naKaartBottom-m.kaartTop)*10)/10);
        }
        /* D. geen verschuiving tussen uren (en tussen talen): de kaart zelf (positie en hoogte) en het element direct eronder staan stil.
           Bewust niet de paginahoogte: de vetgedrukte geselecteerde rij van de uurtabel (PR 1, buiten deze PR) breekt bij de extreme
           waarden van scenario 1 op 320 px af (rij 59 i.p.v. 38 px); dat is een apart punt en geen eigenschap van de kaart. */
        gelijk(hoogtes.size,1,L+": kaarthoogte wisselt tussen uren");gelijk(tops.size,1,L+": de kaart verschuift tussen uren ("+[...tops]+")");gelijk(volgend.size,1,L+": het element direct onder de kaart verschuift tussen uren ("+[...volgend]+")");
        if(!referentie[w])referentie[w]={h:[...hoogtes][0],v:[...volgend][0]};
        else{gelijk([...hoogtes][0],referentie[w].h,w+"px: kaarthoogte verschilt tussen NL en EN");ok(Math.abs([...volgend][0]-referentie[w].v)<=0.5,w+"px: afstand van de kaart tot het element eronder verschilt tussen NL en EN ("+[...volgend][0]+" tegen "+referentie[w].v+")");}
        await eerlijk(page,fouten,L);
      }finally{await context.close();}
    }

    /* E. de kaart volgt de gegevens bij een verversing; het geselecteerde uur blijft hetzelfde (selectiemodel PR 1) */
    {
      const {context,page,fouten,bron}=await open(browser,root,{w:390,nuIso:NU,offsetS:OFFSET});
      try{
        const u=15,instant=Date.parse("2026-07-22T15:00:00Z"),pv=await geoXY(page,instant);
        await page.touchscreen.tap(pv.x,pv.y);await sleep(400);
        let m=await meetKaart(page);gelijk(m.rijen[3][1],"<0,1 mm","E: begin: kleine hoeveelheid");gelijk(m.rijen[2][1],"30%","E: begin: kans");
        const volgendeTijd=iso(Date.parse("2026-07-22T16:00:00Z"),OFFSET),i=bron.data.hourly.time.indexOf(volgendeTijd);
        bron.data.hourly.precipitation[i]=2.54;bron.data.hourly.precipitation_probability[i]=77;
        await page.evaluate(()=>{S.op=0;});await page.evaluate(()=>weatherNowVerversTick());await sleep(1200);
        m=await meetKaart(page);
        gelijk([m.rijen[2][1],m.rijen[3][1]],["77%","2,5 mm"],"E: de kaart toont de nieuwe gegevens van hetzelfde uur");
        ok(m.kop.endsWith("17:00"),"E: het geselecteerde uur blijft 17:00 ("+m.kop+")");gelijk(m.h,140,"E: hoogte blijft 140");
        await eerlijk(page,fouten,"verversing");
      }finally{await context.close();}
    }

    /* F. desktop en SVG-tooltip ongewijzigd */
    for(const taal of ["nl","en"]){
      const {context,page,fouten}=await open(browser,root,{w:1440,nuIso:NU,offsetS:OFFSET,taal:taal==="en"?"en":undefined});
      try{
        const pv=await geoXY(page,Date.parse("2026-07-22T14:00:00Z"));
        await page.mouse.move(pv.x,pv.y,{steps:3});await sleep(500);
        const d=await page.evaluate(()=>{const g=document.getElementById("scrub"),st=document.getElementById("tip-strook");
          const rij=k=>[(g.querySelector('text[data-tip-rij="'+k+'"][data-tip-kol="label"]')||{}).textContent,(g.querySelector('text[data-tip-rij="'+k+'"][data-tip-kol="waarde"]')||{}).textContent];
          return {kaart:getComputedStyle(st).display,modus:g.dataset.modus,rijen:[1,2,3,4,5,6].map(rij),teksten:g.querySelectorAll("text").length,uur:g.dataset.uur};});
        gelijk(d.kaart,"none","F: de kaart is op desktop verborgen ("+taal+")");gelijk(d.modus,"voorvertoning","F: hover toont de SVG-tooltip");
        gelijk(d.rijen.every(r=>r[0]&&r[1]),true,"F: zes gevulde tooltiprijen ("+taal+")");
        ok(/^\d+%( · <?[\d.,]+ mm)?$/.test(d.rijen[2][1]),"F: gecombineerde neerslagregel in de SVG-tooltip ongewijzigd ("+d.rijen[2][1]+")");
        ok(taal==="en"?/precip/.test(d.rijen[2][0]):d.rijen[2][0]==="neerslagkans","F: label van de neerslagregel ongewijzigd ("+d.rijen[2][0]+")");
        gelijk(d.rijen.length,6,"F: zes tooltiprijen");ok(d.uur&&/^2026-07-22T16:00$/.test(d.uur),"F: #scrub noteert het getoonde uur ("+d.uur+")");
        await eerlijk(page,fouten,"desktop "+taal);
      }finally{await context.close();}
    }
    console.log(`Detailkaart: ${n} controles geslaagd (waarden uit de weerreeksen, geen afkapping of overlap, uitlijning, vaste hoogte, NL/EN, 320 t/m 429 px, verversing, desktop ongewijzigd, toegankelijkheid).`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

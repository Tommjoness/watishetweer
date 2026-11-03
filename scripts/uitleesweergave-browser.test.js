"use strict";

/* Uitleesweergave op tablet en desktop (Fase 1, PR 3, voorstel B): vanaf 430 px staat de informatiestrook (#tip-strook, dezelfde DOM en
   toegankelijkheid als de mobiele detailkaart) onder de uurgrafiek en vervangt de zwevende SVG-tooltip. Toetst, met de langste realistische
   waarden (-40 C, 250 km/u, 123,4 mm, WZW) en in NL en EN (licht en donker):
   A. indeling per breedte: twee kolommen onder 780 px stripbreedte, vier kolommen van twee gegevens vanaf 780 px (container query op de
      eigen breedte, niet op de viewport); typografie 12/12,5 px (tot 462 px strip), 13/13,5 px, vanaf 1024 px viewport 14/15 px; hoogte
      constant 140 px (vanaf 1024 px 150 px); geen afkapping, overlap, regelafbreking of horizontale scroll; gedeelde uitlijning, kader, horizontale en
      verticale haarlijnen, windroos rechts van de richtingstekst;
   B. geen layoutverschuiving (CLS 0) en dezelfde positie van de inhoud eronder bij het wisselen van uren;
   C. interactie met de muis: hover toont tijdelijk het aangewezen uur, na het verlaten keert de strook terug naar het geselecteerde UTC-uur, klikken
      selecteert, toetsenbord en Escape behouden hun semantiek, kruisdraad en meetpunt blijven zichtbaar, hover wordt niet aangekondigd; dagwissel
      (morgen) en het dubbele klokuur van de najaarswissel blijven op de UTC-instant gekoppeld; aanraking op tablet;
   D. toegankelijkheid zonder dubbele informatie: de SVG-tooltip staat niet in de toegankelijkheidsboom (CDP), de acht waarden van de strook wel,
      de slider verwijst met aria-details naar de strook en er is geen extra live-regio;
   E. de lege toestand ("Geen uurgegevens", en de rustregel zonder JavaScript) is op desktop zichtbaar, niet toegankelijk als groep en zonder aria-details;
   F. de uurtabel naast de grafiek (vanaf 1100 px) wordt niet bepaald door de strook: evenveel rijen met en zonder strook, en geen scrollsprong.

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
  {T:9.4,A:7.4,P:40,MM:null,W:14,WD:null,G:null,C:80,code:61},
  {T:-5.4,A:-9.6,P:65,MM:1.46,W:105,WD:200,G:118.4,C:100,code:71}];
/* Verwachte kaartwaarden per scenario (Nederlands): temperatuur, voelt als, neerslagkans, neerslag, windstoten, bewolking. */
const VERWACHT=[
  ["12°C","10°C","8%","0,2 mm","35 km/u","30%"],
  ["-40°C","-45°C","100%","123,4 mm","250 km/u","100%"],
  ["3°C","1°C","0%","0,0 mm","20 km/u","0%"],
  ["8°C","6°C","30%","<0,1 mm","48 km/u","55%"],
  ["9°C","7°C","40%","–","–","80%"],
  ["-5°C","-10°C","65%","1,5 mm","118 km/u","100%"]];
/* Verwachte windkracht en kompasrichting (NL) per scenario; de windroos krijgt de graden uit SC (null: geen windroos). */
const WIND=[["19 km/u · 3 Bft","N"],["250 km/u · 12 Bft","WZW"],["8 km/u · 2 Bft","O"],["22 km/u · 4 Bft","Z"],["14 km/u · 3 Bft","–"],["105 km/u · 11 Bft","ZZW"]];
const RICHTING_EN={N:"N",WZW:"WSW",O:"E",Z:"S",ZZW:"SSW","–":"–"};
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
    h.wind_speed_10m.push(s.W);h.wind_direction_10m.push(o.wd?o.wd(u):s.WD);h.wind_gusts_10m.push(s.G);h.visibility.push(20000);h.uv_index.push(0);h.pressure_msl.push(1015);h.is_day.push(u>=6&&u<16?1:0);
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

async function open(browser,root,{w,h,nuIso,offsetS,taal,opties,touch=false}){
  const nuMs=Date.parse(nuIso),mobiel=w<700||touch;
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

const eerlijk=async (page,fouten,wat)=>{assert.deepEqual(fouten,[],wat+": scriptfouten "+fouten.join(" | "));};
let n=0;const ok=(c,m)=>{assert(c,m);n++;};const gelijk=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};
const NU="2026-07-22T12:10:00Z",OFFSET=7200;
const TEKST={nl:"Kies een uur in de grafiek om de details te bekijken.",en:"Select an hour on the chart to see the details."};
const U=s=>Date.parse(s);
const metingen=[];

/* Selecteert een uur op zijn UTC-instant (zelfde pad als een tabelrij) en wacht tot de strook is bijgewerkt. */
async function kiesInstant(page,ms){
  const gelukt=await page.evaluate(ms=>uurKiesInstant(ms,false),ms);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await sleep(120);
  return gelukt;
}

const meetIndeling=page=>page.evaluate(()=>{
  const st=document.getElementById("tip-strook"),cs=getComputedStyle(st),sb=st.getBoundingClientRect(),R=x=>Math.round(x*10)/10;
  const rijen=st.querySelector(".tip-rijen"),duos=[...st.querySelectorAll(".tip-rijen>.tip-duo")],cellen=[...st.querySelectorAll(".tip-rij")];
  const binnenL=sb.left+parseFloat(cs.borderLeftWidth)+parseFloat(cs.paddingLeft),binnenR=sb.right-parseFloat(cs.borderRightWidth)-parseFloat(cs.paddingRight);
  const inkt=e=>{let l=1e9,r=-1e9;const voeg=b=>{if(b.width===0&&b.height===0)return;l=Math.min(l,b.left);r=Math.max(r,b.right);};
    const loop=nd=>{if(nd.nodeType===3){const rg=document.createRange();rg.selectNodeContents(nd);voeg(rg.getBoundingClientRect());}
      else if(nd.nodeType===1&&!nd.classList.contains("sr-only")){if(nd.tagName.toLowerCase()==="svg")voeg(nd.getBoundingClientRect());else nd.childNodes.forEach(loop);}};
    e.childNodes.forEach(loop);return {l,r};};
  const regelH=e=>parseFloat(getComputedStyle(e).lineHeight);
  const problemen=[];let minGap=1e9;
  cellen.forEach(c=>{
    const dt=c.querySelector("dt"),dd=c.querySelector("dd"),a=inkt(dt),b=inkt(dd),cr=c.getBoundingClientRect(),cc=getComputedStyle(c),naam=dt.textContent;
    const celL=cr.left+parseFloat(cc.paddingLeft),celR=cr.right-parseFloat(cc.paddingRight);
    if(c.scrollWidth>c.clientWidth+0.5)problemen.push("overflow "+naam);
    minGap=Math.min(minGap,b.l-a.r);
    if(b.l-a.r<7.5)problemen.push("label raakt waarde "+naam+" ("+R(b.l-a.r)+")");
    if(dt.getBoundingClientRect().height>regelH(dt)*1.4||dd.getBoundingClientRect().height>regelH(dd)*1.4)problemen.push("regelafbreking "+naam);
    if(b.r>celR+0.5||a.l<celL-0.5)problemen.push("buiten de cel "+naam);
    if(b.r>binnenR+0.5||a.l<binnenL-0.5)problemen.push("buiten de strook "+naam);
  });
  const U2=a=>a.length?R(Math.max(...a)-Math.min(...a)):0;
  const eerste=cellen.filter((c,i)=>i%2===0),tweede=cellen.filter((c,i)=>i%2===1);
  const rc=cellen.find(c=>/^(richting|direction)$/.test(c.querySelector("dt").textContent)),roos=rc&&rc.querySelector(".tip-roos");
  let roosGap=null,roosRechtsVanTekst=null;
  if(roos){const sp=rc.querySelector("dd>span[aria-hidden='true']");if(sp){const g=document.createRange();g.selectNodeContents(sp);roosGap=R(roos.getBoundingClientRect().left-g.getBoundingClientRect().right);}}
  const svg=document.getElementById("chart").getBoundingClientRect();
  const dt0=cellen[0].querySelector("dt"),dd0=cellen[0].querySelector("dd");
  return {W:R(sb.width),inhoud:R(sb.width-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-parseFloat(cs.borderLeftWidth)-parseFloat(cs.borderRightWidth)),h:R(sb.height),vw:innerWidth,
    kolommen:getComputedStyle(rijen).gridTemplateColumns.split(" ").length,aantalCellen:cellen.length,aantalDl:duos.length,
    dtPx:parseFloat(getComputedStyle(dt0).fontSize),ddPx:parseFloat(getComputedStyle(dd0).fontSize),
    minFont:Math.min(...[...st.querySelectorAll("dt,dd")].map(e=>parseFloat(getComputedStyle(e).fontSize))),
    minGap:R(minGap),problemen,hscroll:document.documentElement.scrollWidth>innerWidth,
    uitlijning:{l2:U2(tweede.map(c=>inkt(c.querySelector("dt")).l)),w1:U2(eerste.map(c=>inkt(c.querySelector("dd")).r)),w2:U2(tweede.map(c=>inkt(c.querySelector("dd")).r))},
    duoBreedtes:duos.map(d=>R(d.getBoundingClientRect().width)),
    topEerste:U2(eerste.map(c=>c.getBoundingClientRect().top)),topTweede:U2(tweede.map(c=>c.getBoundingClientRect().top)),
    duoRand:duos.map(d=>getComputedStyle(d).borderLeftWidth),duoSchaduw:duos.map(d=>getComputedStyle(d).boxShadow!=="none"),
    celRand:tweede.map(c=>getComputedStyle(c).borderTopWidth),middenLijn:tweede.map(c=>getComputedStyle(c,"::before").display),
    roosGap,roosAantal:st.querySelectorAll(".tip-roos").length,
    kaderBreedte:getComputedStyle(st).borderTopWidth,kaderStijl:getComputedStyle(st).borderTopStyle,
    uitgelijndMetGrafiek:R(Math.abs(sb.left-svg.left)+Math.abs(sb.right-svg.right)),
    kop:(st.querySelector(".tip-kop")||{}).textContent||"",rol:st.getAttribute("role"),ariaHidden:st.getAttribute("aria-hidden")};
});
const verwachtIndeling=m=>({kolommen:m.W>=780?4:2,px:m.vw>=1024?[14,15]:(m.inhoud>=440?[13,13.5]:[12,12.5]),minH:m.vw>=1024?150:140});

function controleerIndeling(m,L,metRoos=true){
  const v=verwachtIndeling(m);
  gelijk([m.aantalCellen,m.aantalDl],[8,4],L+": acht gegevens in vier dl's");
  gelijk(m.kolommen,v.kolommen,`${L}: ${v.kolommen} kolommen bij een strook van ${m.W}px`);
  gelijk([m.dtPx,m.ddPx],v.px,`${L}: typografie bij een strook van ${m.W}px en viewport ${m.vw}px`);
  ok(m.minFont>=12,`${L}: kleinste tekst ${m.minFont}px`);
  gelijk(m.problemen,[],`${L}: ${m.problemen.join(" | ")}`);
  ok(Math.abs(m.h-v.minH)<=0.6,`${L}: hoogte ${m.h}px, gereserveerd ${v.minH}px (de inhoud mag de gereserveerde ruimte niet overschrijden)`);
  ok(!m.hscroll,`${L}: horizontale paginascroll`);
  gelijk([m.kaderBreedte,m.kaderStijl],["1px","solid"],L+": subtiel kader");
  if(metRoos)ok(m.roosAantal===1&&m.roosGap!==null&&m.roosGap>=2&&m.roosGap<=8,`${L}: windroos rechts van de richtingstekst op ${m.roosGap}px`);
  else gelijk(m.roosAantal,0,L+": zonder windrichting geen windroos");
  if(v.kolommen===2){
    ok(m.uitlijning.l2<=0.6&&m.uitlijning.w1<=0.6&&m.uitlijning.w2<=0.6,`${L}: gedeelde uitlijning ${JSON.stringify(m.uitlijning)}`);
    gelijk(m.duoSchaduw,[true,true,true,false],L+": horizontale haarlijnen onder rij 1 t/m 3");
    gelijk(m.middenLijn,["block","block","block","block"],L+": verticale lijn tussen de helften");
  }else{
    ok(Math.max(...m.duoBreedtes)-Math.min(...m.duoBreedtes)<=1.2,`${L}: gelijke kolommen ${m.duoBreedtes}`);
    ok(m.topEerste<=0.6&&m.topTweede<=0.6,`${L}: rijen staan op één lijn (${m.topEerste}/${m.topTweede})`);
    gelijk(m.duoRand,["0px","1px","1px","1px"],L+": verticale haarlijnen tussen de kolommen");
    gelijk(m.celRand,["1px","1px","1px","1px"],L+": horizontale haarlijn in iedere kolom");
    gelijk(m.duoSchaduw,[false,false,false,false],L+": geen dubbele lijn onder de rijen");
    gelijk(m.middenLijn,["none","none","none","none"],L+": geen verticale lijn binnen een kolom");
  }
}

/* A. Indeling, typografie, hoogte en uitlijning per breedte, met de langste waarden. */
async function testIndeling(browser,root){
  const breedtes=[430,480,520,600,700,768,820,850,880,900,1000,1023,1024,1100,1200,1280,1366,1440,1536,1660,1920];
  const en=[430,768,880,1024,1100,1280,1366,1920];
  for(const w of breedtes)for(const [taal,donker] of [["nl",false],["en",true]]){
    if(taal==="en"&&!en.includes(w))continue;
    const {context,page,fouten}=await open(browser,root,{w,nuIso:NU,offsetS:OFFSET,taal:taal==="en"?"en":undefined});
    try{
      if(donker){await page.evaluate(()=>document.documentElement.setAttribute("data-thema","donker"));await sleep(150);}
      for(const [naam,ms] of [["extreem",U("2026-07-22T13:00:00Z")],["ontbrekend",U("2026-07-22T16:00:00Z")],["kleine hoeveelheid",U("2026-07-22T15:00:00Z")],["vorst",U("2026-07-22T17:00:00Z")]]){
        gelijk(await kiesInstant(page,ms),true,`${w}px ${naam}: uur niet te kiezen`);
        const m=await meetIndeling(page),L=`${w}px ${taal} ${donker?"donker":"licht"} ${naam}`;
        controleerIndeling(m,L,naam!=="ontbrekend");
        if(naam==="extreem"){
          ok(/-40|−40/.test(await page.evaluate(()=>document.querySelector("#tip-strook .tip-rij dd").textContent)),L+": het extreme uur toont -40°C");
          metingen.push([w,taal,m.W,m.kolommen,m.dtPx+"/"+m.ddPx,m.h,m.minGap]);
        }
      }
      await eerlijk(page,fouten,`${w}px ${taal}`);
    }finally{await context.close();}
  }
  console.log(`A. Indeling per breedte (${breedtes.join("/")} px; NL licht, EN donker op ${en.join("/")}): twee kolommen onder 780 px stripbreedte, vier daarboven, typografie 12/13/14 px-trap, vaste hoogte, geen afkapping of overlap, gedeelde uitlijning en haarlijnen, windroos rechts.`);
}

/* A2. De indeling volgt de breedte tijdens gebruik (resize), zonder herladen. */
async function testResize(browser,root){
  const {context,page,fouten}=await open(browser,root,{w:1366,nuIso:NU,offsetS:OFFSET});
  try{
    await kiesInstant(page,U("2026-07-22T13:00:00Z"));
    for(const w of [1366,900,1100,600,1920,768,1024,430,1280]){
      await page.setViewportSize({width:w,height:900});await sleep(900);
      controleerIndeling(await meetIndeling(page),"resize naar "+w+"px");
    }
    await eerlijk(page,fouten,"resize");
  }finally{await context.close();}
  console.log("A2. Resize tijdens gebruik (1366/900/1100/600/1920/768/1024/430/1280 px): indeling, typografie en hoogte volgen de breedte zonder herladen.");
}

/* B. Geen layoutverschuiving en een vaste positie van de inhoud eronder. */
async function testGeenVerschuiving(browser,root){
  for(const w of [768,1024,1366,1920]){
    const {context,page,fouten}=await open(browser,root,{w,nuIso:NU,offsetS:OFFSET});
    try{
      await page.evaluate(()=>{window.__ls=0;new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__ls+=e.value;}).observe({type:"layout-shift"});});
      const pos=()=>page.evaluate(()=>{const st=document.getElementById("tip-strook"),dag=st.getBoundingClientRect().bottom+scrollY;
        const h=[...document.querySelectorAll("h2")].find(e=>e.getBoundingClientRect().height>0&&e.getBoundingClientRect().top+scrollY>dag);
        return {h:st.getBoundingClientRect().height,onder:h?Math.round((h.getBoundingClientRect().top+scrollY)*10)/10:null,doc:document.documentElement.scrollHeight};});
      await kiesInstant(page,U("2026-07-22T14:00:00Z"));const basis=await pos();
      for(const u of [13,15,16,17,18,19,20]){
        await kiesInstant(page,U(`2026-07-22T${u}:00:00Z`));const p=await pos();
        gelijk(p,basis,`${w}px uur ${u}Z: hoogte van de strook of positie van de inhoud eronder is veranderd`);
      }
      const ls=await page.evaluate(()=>window.__ls);ok(ls<0.0001,`${w}px: layoutverschuiving ${ls} bij het wisselen van uren`);
      await eerlijk(page,fouten,"CLS "+w);
    }finally{await context.close();}
  }
  console.log("B. Wisselen van uren op 768/1024/1366/1920 px: strookhoogte, positie van de inhoud eronder en gemeten layout-shift blijven gelijk (CLS 0).");
}

const toestand=page=>page.evaluate(()=>{
  const st=document.getElementById("tip-strook"),g=document.getElementById("scrub"),hit=document.getElementById("hit"),G=S.geo;
  const zichtbaar=e=>!!e&&getComputedStyle(e).display!=="none"&&getComputedStyle(e).visibility!=="hidden"&&e.getBoundingClientRect().width+e.getBoundingClientRect().height>0;
  const kruis=[...g.querySelectorAll("line")].find(l=>l.getAttribute("x1")===l.getAttribute("x2")),punt=g.querySelector("circle");
  const sel=UURSEL.huidig,k=G.TI.indexOf(g.dataset.uur);
  return {kop:(st.querySelector(".tip-kop")||{}).textContent||"",rijen:st.querySelectorAll(".tip-rij").length,modus:g.dataset.modus||"",gDisplay:g.style.display,
    scrubMs:g.dataset.uur?uurInstant(g.dataset.uur):null,selMs:sel?sel.ms:null,handmatig:sel?sel.handmatig:null,
    kruisZ:zichtbaar(kruis),puntZ:zichtbaar(punt),kruisOpUur:!!kruis&&k>=0&&Math.abs(+kruis.getAttribute("x1")-G.x(k))<0.6,
    svgTekstZ:[...g.querySelectorAll("text")].filter(zichtbaar).length,svgDoosZ:zichtbaar(g.querySelector("rect")),
    status:(document.getElementById("wiw-uur-status")||{}).textContent||"",now:hit.getAttribute("aria-valuenow"),waardetekst:hit.getAttribute("aria-valuetext")||"",details:hit.getAttribute("aria-details"),
    liveInStrook:st.querySelectorAll("[aria-live],[role=status],[role=alert],[role=log]").length,
    tabelRij:(()=>{const r=document.querySelector('#wiw-hour-table tbody tr[data-selected="1"]');return r?r.dataset.instant:null;})()};
});

async function axTelling(page,sel){
  const cdp=await page.context().newCDPSession(page);
  try{
    const {root}=await cdp.send("DOM.getDocument",{depth:0});const {nodeIds}=await cdp.send("DOM.querySelectorAll",{nodeId:root.nodeId,selector:sel});
    let zichtbaar=0;for(const nodeId of nodeIds){const r=await cdp.send("Accessibility.getPartialAXTree",{nodeId,fetchRelatives:false});if(r.nodes[0]&&!r.nodes[0].ignored)zichtbaar++;}
    return {totaal:nodeIds.length,zichtbaar};
  }finally{await cdp.detach().catch(()=>{});}
}
const geefXY=async(page,iso)=>{const p=await geoXY(page,U(iso));assert(p,"uur staat in de grafiek: "+iso);return p;};
const wegVanGrafiek=async page=>{await page.mouse.move(6,6,{steps:2});await sleep(250);};

/* C. Interactie met de muis, het toetsenbord en op aanraking; D. toegankelijkheid zonder dubbele informatie. */
async function testInteractie(browser,root,w,taal){
  const {context,page,fouten}=await open(browser,root,{w,nuIso:NU,offsetS:OFFSET,taal:taal==="en"?"en":undefined});
  const T=`${w}px ${taal}: `;
  try{
    const A="2026-07-22T14:00:00Z",B="2026-07-22T18:00:00Z";
    let t=await toestand(page);
    ok(t.selMs!==null&&t.modus==="selectie"&&t.rijen===8&&t.svgTekstZ===0&&t.kruisZ&&t.puntZ&&t.kruisOpUur,T+"beginstaat "+JSON.stringify(t));
    gelijk(t.details,"tip-strook",T+"de slider verwijst naar de strook");gelijk(t.liveInStrook,0,T+"geen live-regio in de strook");
    const beginKop=t.kop;
    /* klik op A: A is geselecteerd */
    const a=await geefXY(page,A);await page.mouse.move(a.x,a.y,{steps:3});await page.mouse.down();await page.mouse.up();await sleep(250);
    t=await toestand(page);const kopA=t.kop;
    gelijk([t.selMs,t.handmatig],[U(A),true],T+"klik selecteert uur A");ok(kopA!==beginKop&&kopA.length>0,T+"de strook toont A ("+kopA+")");
    gelijk(await page.evaluate(()=>document.getElementById("hit").getAttribute("aria-valuenow")!==null),true,T+"slider heeft een waarde");
    /* hover op B: tijdelijke voorvertoning, selectie blijft A, hover wordt niet aangekondigd */
    const voorHover=await toestand(page);
    const b=await geefXY(page,B);await page.mouse.move(b.x,b.y,{steps:4});await sleep(250);
    t=await toestand(page);const kopB=t.kop;
    ok(kopB!==kopA&&kopB.length>0,T+"hover toont het aangewezen uur B ("+kopB+" tegen "+kopA+")");
    gelijk([t.modus,t.selMs,t.scrubMs],["voorvertoning",U(A),U(B)],T+"hover is een voorvertoning, de selectie blijft A");
    gelijk([t.rijen,t.svgTekstZ,t.svgDoosZ,t.kruisZ,t.puntZ,t.kruisOpUur],[8,0,false,true,true,true],T+"tijdens hover: acht gegevens, geen zichtbare tooltip, kruisdraad en punt op B");
    gelijk([t.status,t.now,t.waardetekst],[voorHover.status,voorHover.now,voorHover.waardetekst],T+"hover verandert de slider of de statusmelding niet (geen aankondiging)");
    if(w>=1100)gelijk(t.tabelRij,String(U(A)),T+"de tabelrij van de selectie blijft A tijdens hover");
    /* D: tijdens hover staat alleen de strook in de toegankelijkheidsboom */
    let ax=await axTelling(page,"#chart #scrub text, #chart #scrub rect");ok(ax.totaal>0&&ax.zichtbaar===0,T+"SVG-tooltip tijdens hover niet in de toegankelijkheidsboom "+JSON.stringify(ax));
    ax=await axTelling(page,"#tip-strook dd");gelijk(ax,{totaal:8,zichtbaar:8},T+"de acht waarden van de strook zijn toegankelijk");
    /* verlaten: terug naar het geselecteerde UTC-uur A */
    await wegVanGrafiek(page);t=await toestand(page);
    gelijk([t.kop,t.modus,t.selMs,t.scrubMs,t.kruisOpUur,t.kruisZ,t.puntZ],[kopA,"selectie",U(A),U(A),true,true,true],T+"na het verlaten keert de strook terug naar A");
    if(w>=1100)gelijk(t.tabelRij,String(U(A)),T+"tabelrij blijft A na het verlaten");
    ax=await axTelling(page,"#chart #scrub text, #chart #scrub rect");ok(ax.zichtbaar===0,T+"SVG-tooltip na selectie niet in de toegankelijkheidsboom "+JSON.stringify(ax));
    /* klik op B na hover: B is geselecteerd en blijft dat na het verlaten */
    await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.down();await page.mouse.up();await sleep(250);
    await wegVanGrafiek(page);t=await toestand(page);
    gelijk([t.kop,t.selMs,t.scrubMs,t.handmatig],[kopB,U(B),U(B),true],T+"klik op B: B blijft geselecteerd na het verlaten");
    /* hover op A en verlaten: terug naar B, niet naar de eerdere selectie */
    await page.mouse.move(a.x,a.y,{steps:3});await sleep(200);gelijk((await toestand(page)).kop,kopA,T+"hover op A");
    await wegVanGrafiek(page);gelijk((await toestand(page)).kop,kopB,T+"na het verlaten terug naar B");
    /* toetsenbord: pijlen, Home, End, Escape behouden de bestaande semantiek */
    await page.evaluate(()=>document.getElementById("hit").focus());
    const ms0=(await toestand(page)).selMs;
    await page.keyboard.press("ArrowRight");await sleep(200);t=await toestand(page);
    gelijk([t.selMs,t.scrubMs,t.handmatig],[ms0+3600000,ms0+3600000,true],T+"pijl rechts selecteert het volgende uur");ok(t.kop!==kopB&&t.rijen===8,T+"de strook volgt het toetsenbord");
    const kopRechts=t.kop;
    await page.keyboard.press("ArrowLeft");await page.keyboard.press("ArrowLeft");await sleep(200);t=await toestand(page);
    gelijk(t.selMs,ms0-3600000,T+"pijl links, twee keer");
    await page.keyboard.press("Home");await sleep(200);t=await toestand(page);
    gelijk(t.selMs,await page.evaluate(()=>uurInstant(S.geo.TI[0])),T+"Home gaat naar het eerste uur");
    await page.keyboard.press("End");await sleep(200);t=await toestand(page);
    gelijk(t.selMs,await page.evaluate(()=>uurInstant(S.geo.TI[S.geo.n-1])),T+"End gaat naar het laatste uur");
    const kopEinde=t.kop;
    await page.keyboard.press("Escape");await sleep(200);t=await toestand(page);
    gelijk([t.modus,t.kop,t.selMs,t.svgTekstZ,t.kruisZ,t.puntZ],["selectie",kopEinde,await page.evaluate(()=>uurInstant(S.geo.TI[S.geo.n-1])),0,true,true],T+"Escape sluit alleen een tijdelijke weergave; de selectie en de strook blijven");
    gelijk(t.liveInStrook,0,T+"geen live-regio in de strook na toetsenbordgebruik");
    gelijk(await page.evaluate(()=>[...document.querySelectorAll("[aria-live]")].filter(e=>e.closest(".dagmod,#tip-strook")).length),0,T+"in het grafiekblok geen extra aria-live");
    await eerlijk(page,fouten,T+"interactie");
  }finally{await context.close();}
}

/* C2. Dagwissel en het dubbele klokuur van de najaarswissel blijven op de UTC-instant gekoppeld (desktop). */
async function testTijdcontext(browser,root,taal){
  const T=taal+": ";
  {
    const {context,page,fouten}=await open(browser,root,{w:1366,nuIso:NU,offsetS:OFFSET,taal:taal==="en"?"en":undefined});
    try{
      const vandaag="2026-07-22T20:00:00Z",morgen="2026-07-23T05:00:00Z";
      await kiesInstant(page,U(vandaag));const kopVandaag=(await toestand(page)).kop;
      ok(!/^(Morgen|Tomorrow)\b/i.test(kopVandaag),T+"vandaag heeft geen dagaanduiding ("+kopVandaag+")");
      const m=await geefXY(page,morgen);await page.mouse.move(m.x,m.y,{steps:4});await sleep(250);let t=await toestand(page);
      ok(/^(Morgen|Tomorrow)\b/i.test(t.kop),T+"hover op morgen toont de dagaanduiding ("+t.kop+")");gelijk(t.selMs,U(vandaag),T+"de selectie blijft vandaag");
      await wegVanGrafiek(page);t=await toestand(page);gelijk([t.kop,t.selMs],[kopVandaag,U(vandaag)],T+"na het verlaten terug naar het geselecteerde uur van vandaag");
      await eerlijk(page,fouten,T+"dagwissel");
    }finally{await context.close();}
  }
  {
    const w2=await open(browser,root,{w:1366,nuIso:"2026-10-24T23:30:00Z",offsetS:OFFSET,taal:taal==="en"?"en":undefined});
    try{
      const page=w2.page,eerste=U("2026-10-25T00:00:00Z"),winter=U("2026-10-25T01:00:00Z");
      await kiesInstant(page,eerste);let t=await toestand(page);const kopZomer=t.kop;
      ok(/02:00 \(/.test(kopZomer),T+"het eerste 02:00-uur heeft een aanduiding ("+kopZomer+")");
      await page.locator('#wiw-hour-table tbody tr[data-instant="'+winter+'"] .wiw-hour-pick').click();await sleep(300);
      t=await toestand(page);const kopWinter=t.kop;gelijk(t.selMs,winter,T+"het tweede 02:00-uur is geselecteerd");ok(kopWinter!==kopZomer&&/02:00 \(/.test(kopWinter),T+"de twee klokuren zijn te onderscheiden ("+kopZomer+" / "+kopWinter+")");
      const p=await geefXY(page,"2026-10-25T00:00:00Z");await page.mouse.move(p.x,p.y,{steps:4});await sleep(250);t=await toestand(page);
      gelijk([t.kop,t.scrubMs,t.selMs],[kopZomer,eerste,winter],T+"hover op het eerste 02:00-uur toont dat uur, de selectie blijft het tweede");
      await wegVanGrafiek(page);t=await toestand(page);gelijk([t.kop,t.selMs,t.tabelRij],[kopWinter,winter,String(winter)],T+"na het verlaten terug naar het tweede 02:00-uur (UTC-instant)");
      await eerlijk(w2.page,w2.fouten,T+"najaarswissel");
    }finally{await w2.context.close();}
  }
}

/* C3. Aanraking op een tablet (768 px, ruimte voor de strook): tikken selecteert, de tijdelijke weergave verdwijnt, de selectie blijft. */
async function testAanraking(browser,root){
  const {context,page,fouten}=await open(browser,root,{w:768,nuIso:NU,offsetS:OFFSET,touch:true});
  try{
    const A="2026-07-22T14:00:00Z",B="2026-07-22T18:00:00Z";
    const a=await geefXY(page,A);await page.touchscreen.tap(a.x,a.y);await sleep(400);
    let t=await toestand(page);gelijk([t.selMs,t.rijen,t.svgTekstZ],[U(A),8,0],"768px aanraking: tik selecteert A en toont acht gegevens");const kopA=t.kop;
    const b=await geefXY(page,B);await page.touchscreen.tap(b.x,b.y);await sleep(400);t=await toestand(page);
    gelijk([t.selMs,t.scrubMs],[U(B),U(B)],"768px aanraking: tik selecteert B");ok(t.kop!==kopA,"768px aanraking: de strook volgt de tik");const kopB=t.kop;
    await sleep(4600);t=await toestand(page);
    gelijk([t.selMs,t.kop,t.svgTekstZ,t.kruisZ,t.puntZ,t.modus],[U(B),kopB,0,true,true,"selectie"],"768px aanraking: na de tijdelijke weergave blijft B geselecteerd, kruisdraad en punt blijven");
    await eerlijk(page,fouten,"aanraking");
  }finally{await context.close();}
}

/* E. De lege toestand op desktop. */
async function testLeeg(browser,root){
  for(const taal of ["nl","en"]){
    const {context,page,fouten}=await open(browser,root,{w:1366,nuIso:NU,offsetS:OFFSET,taal:taal==="en"?"en":undefined});
    try{
      await page.evaluate(()=>uurLegeToestand(document.getElementById("tip-strook"),true));await sleep(200);
      const m=await page.evaluate(()=>{const st=document.getElementById("tip-strook"),r=st.querySelector(".tip-kop").getBoundingClientRect(),sb=st.getBoundingClientRect();
        return {kop:st.querySelector(".tip-kop").textContent,zichtbaar:getComputedStyle(st).display!=="none"&&r.width>0&&r.height>0&&r.top>=sb.top&&r.bottom<=sb.bottom,h:sb.height,aria:st.getAttribute("aria-hidden"),rol:st.getAttribute("role"),
          labelledby:st.getAttribute("aria-labelledby"),details:document.getElementById("hit").getAttribute("aria-details"),leeg:st.dataset.leeg};});
      gelijk([m.kop,m.zichtbaar,m.h,m.aria,m.rol,m.labelledby,m.details,m.leeg],[taal==="en"?"No hourly data":"Geen uurgegevens",true,150,"true",null,null,null,"1"],`${taal}: lege toestand op desktop zichtbaar, geen groep, geen aria-details, vaste hoogte`);
      const ax=await axTelling(page,"#tip-strook .tip-kop, #tip-strook .tip-oms");gelijk(ax.zichtbaar,0,`${taal}: de melding staat niet als gevulde groep in de toegankelijkheidsboom`);
      await kiesInstant(page,U("2026-07-22T14:00:00Z"));
      const t=await toestand(page);gelijk([t.rijen,t.details],[8,"tip-strook"],`${taal}: terug naar een uur herstelt de groep en de koppeling`);
      await eerlijk(page,fouten,"leeg "+taal);
    }finally{await context.close();}
    /* zonder JavaScript: de rustregel staat als CSS-inhoud in de gereserveerde, zichtbare strook */
    const context2=await browser.newContext({viewport:{width:1366,height:900},locale:taal==="en"?"en-GB":"nl-NL",javaScriptEnabled:false,serviceWorkers:"block"});
    try{
      const p=await context2.newPage();await p.goto(root+"/weer/amsterdam/",{waitUntil:"domcontentloaded"});
      if(taal==="en")await p.evaluate(()=>0).catch(()=>{});
      const m=await p.evaluate(()=>{const st=document.getElementById("tip-strook");return {content:getComputedStyle(st,"::before").content,h:st.getBoundingClientRect().height,display:getComputedStyle(st).display};});
      gelijk([m.display,m.h],["block",150],`zonder JavaScript ${taal}: de lege strook is zichtbaar met gereserveerde hoogte`);
      ok(m.content==='"'+TEKST.nl+'"'||m.content==='"'+TEKST.en+'"',`zonder JavaScript ${taal}: de rustregel staat als CSS-inhoud (${m.content})`);
    }finally{await context2.close();}
  }
  console.log("E. Lege toestand op desktop (NL/EN): melding en rustregel zichtbaar, geen gevulde groep, geen aria-details, vaste hoogte, herstel bij een volgend uur.");
}

/* F. De uurtabel naast de grafiek wordt niet bepaald door de strook. */
async function testUurtabel(browser,root){
  for(const w of [1100,1280,1366,1440,1660,1920]){
    const {context,page,fouten}=await open(browser,root,{w,h:w>=1440?1000:900,nuIso:NU,offsetS:OFFSET});
    try{
      await page.waitForFunction(()=>document.querySelectorAll("#wiw-hour-table tbody tr").length>0);await sleep(600);
      const tel=()=>page.evaluate(()=>document.querySelectorAll("#wiw-hour-table tbody tr").length);
      const rijenMet=await tel();
      ok(rijenMet>=1&&rijenMet<=12,`${w}px: ${rijenMet} uurrijen (contract: 1 t/m 12)`);
      /* scrolpositie: een nieuwe berekening mag de pagina niet laten springen */
      const y0=await page.evaluate(()=>{const st=document.getElementById("tip-strook");scrollTo(0,st.getBoundingClientRect().top+scrollY-300);return scrollY;});await sleep(200);
      const y1=await page.evaluate(()=>scrollY);
      await page.evaluate(()=>WeatherNowFinalDesktopUI20260902.render());await sleep(500);
      ok(Math.abs((await page.evaluate(()=>scrollY))-y1)<=1,`${w}px: de pagina verspringt bij een nieuwe berekening van de tabelhoogte (${y1} -> ${await page.evaluate(()=>scrollY)})`);
      gelijk(await tel(),rijenMet,`${w}px: een nieuwe berekening geeft hetzelfde aantal rijen`);
      /* zonder strook (display:none) evenveel rijen: de strook bepaalt het aantal niet */
      await page.evaluate(()=>{document.getElementById("tip-strook").style.display="none";WeatherNowFinalDesktopUI20260902.render();});await sleep(600);
      gelijk(await tel(),rijenMet,`${w}px: met en zonder strook evenveel uurrijen`);
      const grens=await page.evaluate(()=>{const r=[...document.querySelectorAll("#wiw-hour-table tbody tr")].pop(),m=document.querySelector(".wiw-chart-main");return r.getBoundingClientRect().bottom<=m.getBoundingClientRect().bottom+0.5;});
      ok(grens,`${w}px: de laatste rij valt binnen de grafieksectie zonder strook`);
      await page.evaluate(()=>{document.getElementById("tip-strook").style.display="";WeatherNowFinalDesktopUI20260902.render();});await sleep(600);
      gelijk(await tel(),rijenMet,`${w}px: na terugplaatsen van de strook weer hetzelfde aantal rijen`);
      await eerlijk(page,fouten,"uurtabel "+w);
    }finally{await context.close();}
  }
  console.log("F. Uurtabel op 1100/1280/1366/1440/1660/1920 px: evenveel rijen met en zonder strook (1 t/m 12), geen scrollsprong bij herberekening.");
}

server.listen(0,"127.0.0.1",async()=>{
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    const tijd=async(naam,f)=>{const t=Date.now();await f();console.log("  duur "+naam+": "+((Date.now()-t)/1000).toFixed(1)+" s");};
    await tijd("A",()=>testIndeling(browser,root));
    await tijd("A2",()=>testResize(browser,root));
    await tijd("B",()=>testGeenVerschuiving(browser,root));
    await tijd("C/D",async()=>{for(const [w,taal] of [[1366,"nl"],[1024,"nl"],[1280,"en"],[768,"nl"]])await testInteractie(browser,root,w,taal);});
    console.log("C/D. Muis, toetsenbord en Escape op 1366/1024/1280/768 px: hover is tijdelijk, verlaten keert terug naar het geselecteerde UTC-uur, klik selecteert, kruisdraad en punt blijven, geen aankondiging bij hover; SVG-tooltip niet in de toegankelijkheidsboom, acht waarden wel.");
    await tijd("C2",async()=>{for(const taal of ["nl","en"])await testTijdcontext(browser,root,taal);});
    console.log("C2. Dagwissel (morgen) en dubbel klokuur van de najaarswissel op desktop (NL/EN): hover en selectie blijven op de UTC-instant gekoppeld.");
    await tijd("C3",()=>testAanraking(browser,root));
    console.log("C3. Aanraking op 768 px: tik selecteert, de selectie en het meetpunt blijven na de tijdelijke weergave.");
    await tijd("E",()=>testLeeg(browser,root));
    await tijd("F",()=>testUurtabel(browser,root));
    console.log("Metingen (breedte, taal, strook px, kolommen, dt/dd px, hoogte px, kleinste ruimte label-waarde px):");
    for(const r of metingen)console.log("  "+r.join(" | "));
    console.log(`Uitleesweergave: ${n} controles geslaagd.`);
  }catch(e){console.error(e);process.exitCode=1;}
  finally{await browser.close();server.close();}
});

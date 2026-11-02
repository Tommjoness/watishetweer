"use strict";

/* Mobiele detailkaart (#tip-strook, tot en met 429 px): vier rijen met telkens twee waarden (acht gegevens) in een gedeeld editorial raster.
   Toetst, met de langste realistische waarden en op 320, 360, 390, 413, 420 en 429 px in NL en EN (licht en donker):
   A. waarden: elke kaartwaarde komt uit de weerreeksen en klopt met het gekozen uur (neerslagkans, hoeveelheid, temperatuur, windkracht met Beaufort,
      kompasrichting, windstoten, bewolking; "0,0 mm" alleen bij een echte nul, "<0,1 mm" bij een kleine positieve waarde, "–" bij een ontbrekende waarde);
   B. geen afkapping, overlap, regelafbreking of horizontale scroll; kleinste tekst >= 12 px; vaste hoogte 140 px;
   C. gedeeld raster, bij ALLE waarden (ook de extreme): de tweede kolom begint in elke rij op dezelfde x, de waarden eindigen per kolom op dezelfde x,
      en die posities blijven gelijk tussen uren en talen; zijpadding 6 px (tot 339 px) of 10 px, tussenruimte 8 of 14 px;
   D. scheidingslijnen: hairlines onder de rijen 1 t/m 3 en een verticale lijn tussen de helften, met voldoende ruimte tot tekst (en windroos), in --rule-soft (licht) en --rule (donker);
   E. windroos: rechts van de richtingstekst op vaste afstand, wijst naar de herkomst (graden uit de weerreeks), ontbreekt bij een ontbrekende richting en is decoratief;
   F. geen layoutverschuiving bij het wisselen van uren en talen (hoogte van de kaart en positie van de inhoud eronder constant);
   G. de kaart volgt de gegevens bij een verversing met hetzelfde geselecteerde uur;
   H. de SVG-tooltip en de desktopweergave blijven ongewijzigd (zes rijen, gecombineerde neerslagregel, kaart verborgen);
   I. toegankelijkheid: een gevulde kaart is een groep (niet aria-hidden), de slidertekst met uur, temperatuur en neerslagkans blijft ongewijzigd;
      de volledige toegankelijkheidscontrole staat in detailkaart-toegankelijkheid-browser.test.js.

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
  const st=document.getElementById("tip-strook"),cs=getComputedStyle(st),sb=st.getBoundingClientRect(),R=x=>Math.round(x*100)/100;
  const binnenL=sb.left+parseFloat(cs.borderLeftWidth)+parseFloat(cs.paddingLeft),binnenRechts=sb.right-parseFloat(cs.borderRightWidth)-parseFloat(cs.paddingRight);
  const duos=[...st.querySelectorAll(".tip-rijen>.tip-duo")],cellen=[...st.querySelectorAll(".tip-rij")];
  /* De werkelijke inkt (tekst en windroos) van een element, niet de doos eromheen. */
  const inkt=e=>{
    let l=1e9,r=-1e9;const voeg=b=>{if(b.width===0&&b.height===0)return;l=Math.min(l,b.left);r=Math.max(r,b.right);};
    const loop=n=>{
      if(n.nodeType===3){const rg=document.createRange();rg.selectNodeContents(n);voeg(rg.getBoundingClientRect());}
      else if(n.nodeType===1&&!n.classList.contains("sr-only")){if(n.tagName.toLowerCase()==="svg")voeg(n.getBoundingClientRect());else n.childNodes.forEach(loop);}
    };
    e.childNodes.forEach(loop);return {l,r};
  };
  /* Wat een gebruiker ziet: tekst zonder de sr-only-tekst voor hulptechnologie en zonder windroos. */
  const zichtbaar=e=>[...e.childNodes].map(n=>n.nodeType===3?n.textContent:(n.nodeType===1&&!n.classList.contains("sr-only")&&n.tagName.toLowerCase()!=="svg"?n.textContent:"")).join("");
  const regelH=e=>parseFloat(getComputedStyle(e).lineHeight);
  const kleurVan=v=>{const p=document.createElement("i");p.style.color=v;st.appendChild(p);const c=getComputedStyle(p).color;p.remove();return c;};
  const problemen=[];let minLabelWaarde=1e9;
  cellen.forEach(c=>{
    const dt=c.querySelector("dt"),dd=c.querySelector("dd"),a=inkt(dt),b=inkt(dd),cr=c.getBoundingClientRect();
    if(c.scrollWidth>c.clientWidth+0.5)problemen.push("overflow "+dt.textContent);
    minLabelWaarde=Math.min(minLabelWaarde,b.l-a.r);
    if(b.l-a.r<7.5)problemen.push("label raakt waarde "+dt.textContent);
    if(dt.getBoundingClientRect().height>regelH(dt)*1.4||dd.getBoundingClientRect().height>regelH(dd)*1.4)problemen.push("regelafbreking "+dt.textContent);
    if(b.r>cr.right+0.5||a.l<cr.left-0.5||b.r>binnenRechts+0.5||a.l<binnenL-0.5)problemen.push("buiten de kaart "+dt.textContent);
  });
  const kop=st.querySelector(".tip-kop"),oms=st.querySelector(".tip-oms");
  if(kop.getBoundingClientRect().height>parseFloat(getComputedStyle(kop).lineHeight)*1.4)problemen.push("kop breekt af");
  if(oms.getBoundingClientRect().height>regelH(oms)*1.4)problemen.push("omschrijving breekt af");
  const fonts=[...st.querySelectorAll(".tip-kop,.tip-oms,dt,dd")].map(e=>parseFloat(getComputedStyle(e).fontSize));
  /* Raster: x van het eerste en tweede label, en van de rechterrand van de waarden (tekst of windroos) per kolom. */
  const kol=k=>duos.map(d=>d.children[k]);
  const x={label1:kol(0).map(c=>R(inkt(c.querySelector("dt")).l)),label2:kol(1).map(c=>R(inkt(c.querySelector("dt")).l)),waarde1:kol(0).map(c=>R(inkt(c.querySelector("dd")).r)),waarde2:kol(1).map(c=>R(inkt(c.querySelector("dd")).r))};
  /* Verticale lijn: positie volgens de CSS en de ruimte tot de tekst links (waarde) en rechts (label). */
  const lijnen=duos.map(d=>{const c2=d.children[1],ps=getComputedStyle(c2,"::before"),lx=c2.getBoundingClientRect().left+parseFloat(ps.left),br=parseFloat(ps.width);
    return {links:R(lx-inkt(d.children[0].querySelector("dd")).r),rechts:R(inkt(c2.querySelector("dt")).l-(lx+br)),breedte:br,kleur:ps.backgroundColor,inhoud:ps.content,top:ps.top,bottom:ps.bottom,hoogte:ps.height};});
  const haarlijnen=duos.map(d=>getComputedStyle(d).boxShadow);
  /* Windroos in de richtingscel: afstand tot de tekst, rechterrand, afmeting, gedrag voor hulptechnologie en de wijsrichting (graden, 0 = omhoog). */
  const rc=cellen.find(c=>c.querySelector("dt").textContent.match(/^(richting|direction)$/)),roos=rc.querySelector(".tip-roos");let r=null;
  if(roos){
    const dd=rc.querySelector("dd"),tg=document.createRange();tg.selectNodeContents(dd.querySelector(':scope>span[aria-hidden="true"]'));const tb=tg.getBoundingClientRect(),rb=roos.getBoundingClientRect();
    const path=roos.querySelector("path"),pt=roos.createSVGPoint();pt.x=6;pt.y=1.6;const punt=pt.matrixTransform(path.getScreenCTM());
    const mid=roos.createSVGPoint();mid.x=6;mid.y=6;const m0=mid.matrixTransform(roos.getScreenCTM());
    r={links:R(rb.left-tb.right),tekstRechts:R(tb.right),roosRechts:R(rb.right),ddRechts:R(dd.getBoundingClientRect().right),breed:R(rb.width),hoog:R(rb.height),
       bearing:R(((Math.atan2(punt.x-m0.x,-(punt.y-m0.y))*180/Math.PI)+360)%360),ariaHidden:roos.getAttribute("aria-hidden"),focusable:roos.getAttribute("focusable"),
       tekstInRoos:roos.textContent.trim(),titel:!!roos.querySelector("title,desc"),kinderen:[...dd.children].map(e=>e.tagName.toLowerCase())};
  }
  const dag=document.querySelector(".dagmod").getBoundingClientRect().bottom+scrollY;
  const volgende=[...document.querySelectorAll("h2")].find(h=>{const q=h.getBoundingClientRect();return q.height>0&&q.top+scrollY>dag;});
  return {rijen:cellen.map(c=>[c.querySelector("dt").textContent,zichtbaar(c.querySelector("dd"))]),problemen,h:R(sb.height),minLabelWaarde:R(minLabelWaarde),
    minFont:Math.min(...fonts),docBreed:document.documentElement.scrollWidth,vw:innerWidth,x,binnenL:R(binnenL),binnenRechts:R(binnenRechts),lijnen,haarlijnen,roos:r,
    aantalDuo:duos.length,aantalRij:cellen.length,directeRijen:st.querySelectorAll(".tip-rijen>.tip-rij").length,padL:parseFloat(cs.paddingLeft),padR:parseFloat(cs.paddingRight),gat:parseFloat(getComputedStyle(duos[0]).columnGap),
    kleuren:{zacht:kleurVan("var(--rule-soft)"),rule:kleurVan("var(--rule)")},thema:document.documentElement.getAttribute("data-thema"),
    volgendTop:volgende?R(volgende.getBoundingClientRect().top+scrollY):null,docH:document.documentElement.scrollHeight,
    kaartTop:R(sb.top+scrollY),naKaartBottom:st.nextElementSibling?R(st.nextElementSibling.getBoundingClientRect().bottom+scrollY):null,
    kop:kop.textContent,oms:oms.textContent.replace(/ /g,""),ariaHidden:st.getAttribute("aria-hidden"),rol:st.getAttribute("role"),
    svgWind:(document.querySelector('#scrub text[data-tip-rij="4"][data-tip-kol="waarde"]')||{}).textContent||"",
    svgStoot:(document.querySelector('#scrub text[data-tip-rij="5"][data-tip-kol="waarde"]')||{}).textContent||"",
    valuetext:(document.getElementById("hit")||{getAttribute:()=>""}).getAttribute("aria-valuetext")};
});
const sleutel=iso0=>String(Date.parse(iso0));
const eerlijk=async (page,fouten,wat)=>{assert.deepEqual(fouten,[],wat+": scriptfouten "+fouten.join(" | "));};
let n=0;const ok=(c,m)=>{assert(c,m);n++;};const gelijk=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};
const enGetal=t=>t.replace(",",".").replace("km/u","km/h");


const uniek=a=>Math.max(...a)-Math.min(...a);
const cirkelVerschil=(a,b)=>Math.abs((((a-b)%360)+540)%360-180);
/* Alle controles op één meting van de kaart (één uur, één taal, één breedte, één thema). */
function toets(m,{L,u,sc,taal,w,donker}){
  const T=L+" uur "+u+(donker?" donker":"")+": ";
  /* A. structuur en waarden */
  gelijk(m.aantalDuo,4,T+"vier rijen");gelijk(m.aantalRij,8,T+"acht gegevens");gelijk(m.directeRijen,0,T+"geen losse rij over de volle breedte meer");
  const labels=taal==="en"?["temperature","feels like","precip. chance","precip.","wind","direction","gusts","cloud cover"]:["temperatuur","voelt als","neerslagkans","neerslag","wind","richting","windstoten","bewolking"];
  gelijk(m.rijen.map(r=>r[0]),labels,T+"labels");
  const v=VERWACHT[sc].map(x=>taal==="en"?enGetal(x):x);
  gelijk([m.rijen[0][1],m.rijen[1][1],m.rijen[2][1],m.rijen[3][1],m.rijen[6][1],m.rijen[7][1]],v,T+"waarden voor scenario "+sc);
  gelijk(m.rijen[4][1],taal==="en"?enGetal(WIND[sc][0]):WIND[sc][0],T+"windkracht");
  gelijk(m.rijen[5][1],taal==="en"?RICHTING_EN[WIND[sc][1]]:WIND[sc][1],T+"windrichting (tekst)");
  /* Wind en richting horen bij dezelfde meetwaarde als de SVG-tooltip ("19 km/u N, 3 Bft"). */
  const sv=/^(\d+) km\/(u|h)(?: (\S+))?, (\d+) Bft$/.exec(m.svgWind);
  if(sv){gelijk(m.rijen[4][1],sv[1]+" km/"+sv[2]+" · "+sv[4]+" Bft",T+"windkracht gelijk aan de SVG-tooltip");gelijk(m.rijen[5][1],sv[3]||"–",T+"richting gelijk aan de SVG-tooltip");}
  if(sc!==4)gelijk(m.rijen[6][1],m.svgStoot,T+"windstoten gelijk aan de SVG-tooltip");
  ok(!m.rijen.some(r=>/NaN|undefined|null/.test(r[1])),T+"geen NaN of undefined");
  /* I. toegankelijkheid */
  gelijk([m.ariaHidden,m.rol],[null,"group"],T+"een gevulde kaart is een toegankelijke groep (niet aria-hidden)");
  if(!donker)ok(taal==="en"||new RegExp("^"+String(u+2).padStart(2,"0")+":00, -?\\d+ graden, \\d+ procent neerslagkans$").test(m.valuetext||""),T+"slidertekst ("+m.valuetext+")");
  /* B. geen afkapping, overlap of afbreking; lettergrootte; geen horizontale scroll; vaste hoogte */
  gelijk(m.problemen,[],T+m.problemen.join("; "));
  ok(m.minFont>=12,T+"kleinste tekst "+m.minFont+"px");ok(m.docBreed<=m.vw,T+"horizontale scroll");gelijk(m.h,140,T+"kaarthoogte");
  /* C. gedeeld raster: bij alle waarden dezelfde x voor de tweede kolom en voor de rechterranden van de waarden */
  ok(uniek(m.x.label1)<=0.1,T+"eerste kolom begint niet overal op dezelfde x ("+m.x.label1+")");
  ok(uniek(m.x.label2)<=0.1,T+"tweede kolom begint niet overal op dezelfde x ("+m.x.label2+")");
  ok(uniek(m.x.waarde1)<=0.1,T+"waarden van de eerste kolom eindigen niet op dezelfde x ("+m.x.waarde1+")");
  ok(uniek(m.x.waarde2)<=0.1,T+"waarden van de tweede kolom eindigen niet op dezelfde x ("+m.x.waarde2+")");
  ok(Math.abs(m.x.label1[0]-m.binnenL)<=0.5,T+"eerste kolom begint niet aan de linkerrand ("+m.x.label1[0]+" tegen "+m.binnenL+")");
  ok(Math.abs(m.x.waarde2[0]-m.binnenRechts)<=0.5,T+"waarden eindigen niet op de rechterrand ("+m.x.waarde2[0]+" tegen "+m.binnenRechts+")");
  gelijk([m.padL,m.padR],w<=339?[6,6]:[10,10],T+"zijpadding");gelijk(m.gat,w<=339?8:14,T+"tussenruimte tussen de helften");
  /* D. scheidingslijnen: hairlines onder rij 1 t/m 3, verticale lijn tussen de helften, met ruimte tot de tekst; --rule-soft (licht) of --rule (donker) */
  const kleur=donker?m.kleuren.rule:m.kleuren.zacht;
  gelijk(m.thema==="donker",!!donker,T+"thema");
  m.haarlijnen.forEach((b,i)=>{if(i<3)ok(b!=="none"&&b.includes(kleur)&&/inset/.test(b),T+"hairline onder rij "+(i+1)+" ("+b+" tegen "+kleur+")");else gelijk(b,"none",T+"geen lijn onder de laatste rij");});
  const ruimte=w<=339?3.4:6.4;
  m.lijnen.forEach((l,i)=>{gelijk([l.breedte,l.inhoud,l.kleur],[1,'""',kleur],T+"verticale lijn rij "+(i+1)+" (breedte, aanwezig, kleur)");
    ok(l.links>=ruimte&&l.rechts>=ruimte,T+"ruimte tussen de verticale lijn en de tekst rij "+(i+1)+": links "+l.links+", rechts "+l.rechts+" (minimaal "+ruimte+")");});
  /* E. windroos */
  if(WIND[sc][1]==="–"){
    gelijk(m.roos,null,T+"zonder windrichting geen windroos");gelijk(m.rijen[5][1],"–",T+"zonder windrichting uitsluitend een streepje");
  }else{
    const r=m.roos;ok(r,T+"windroos aanwezig");
    gelijk([r.breed,r.hoog],[12,12],T+"windroos 12 px");ok(r.links>=3.5&&r.links<=4.5,T+"windroos staat op vaste afstand rechts van de tekst ("+r.links+")");
    ok(r.tekstRechts<r.roosRechts-12+0.5,T+"windroos staat rechts van de richtingstekst");ok(Math.abs(r.ddRechts-r.roosRechts)<=0.5,T+"tekst en windroos vormen één rechts uitgelijnde groep");
    ok(cirkelVerschil(r.bearing,SC[sc].WD)<=0.6,T+"windroos wijst naar de herkomst: "+r.bearing+"° tegen "+SC[sc].WD+"°");
    gelijk([r.ariaHidden,r.focusable,r.tekstInRoos,r.titel,r.kinderen.join()],["true","false","",false,"span,span,svg"],T+"windroos is decoratief (zichtbare afkorting, tekst voor hulptechnologie en windroos)");
  }
}

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
        const hoogtes=new Set(),volgend=new Set(),tops=new Set(),xs=new Set();
        /* Zes opeenvolgende uren: 13:00Z t/m 18:00Z = scenario 1 t/m 5 en 0 (u % 6). */
        for(const u of [13,14,15,16,17,18]){
          const sc=u%6,instant=Date.parse("2026-07-22T"+String(u).padStart(2,"0")+":00:00Z");
          const pv=await geoXY(page,instant);ok(pv,L+": uur "+u+"Z staat in de grafiek");
          await page.touchscreen.tap(pv.x,pv.y);
          await page.waitForFunction(lokaal=>(document.querySelector("#tip-strook .tip-kop")||{textContent:""}).textContent.endsWith(lokaal),String(u+2).padStart(2,"0")+":00",{timeout:8000});
          await sleep(250);
          const m=await meetKaart(page);
          toets(m,{L,u,sc,taal,w,donker:false});
          xs.add(m.x.label2[0]);
          hoogtes.add(m.h);tops.add(m.kaartTop);volgend.add(Math.round((m.naKaartBottom-m.kaartTop)*10)/10);
        }
        /* Donkere modus: dezelfde controles voor het extreme (scenario 1) en het normale uur (scenario 0); het raster blijft op dezelfde plek. */
        await page.evaluate(()=>document.documentElement.setAttribute("data-thema","donker"));
        for(const u of [13,18]){
          const sc=u%6,pv=await geoXY(page,Date.parse("2026-07-22T"+String(u).padStart(2,"0")+":00:00Z"));
          await page.touchscreen.tap(pv.x,pv.y);
          await page.waitForFunction(lokaal=>(document.querySelector("#tip-strook .tip-kop")||{textContent:""}).textContent.endsWith(lokaal),String(u+2).padStart(2,"0")+":00",{timeout:8000});
          await sleep(250);
          const m=await meetKaart(page);toets(m,{L,u,sc,taal,w,donker:true});xs.add(m.x.label2[0]);hoogtes.add(m.h);tops.add(m.kaartTop);
        }
        ok(uniek([...xs])<=0.1,L+": de tweede kolom verspringt tussen uren of thema's ("+[...xs]+")");
        if(!referentie[w+"x"])referentie[w+"x"]=[...xs][0];else ok(Math.abs([...xs][0]-referentie[w+"x"])<=0.1,w+"px: de tweede kolom begint in NL en EN niet op dezelfde x ("+[...xs][0]+" tegen "+referentie[w+"x"]+")");
        /* D. geen verschuiving tussen uren (en tussen talen): de kaart zelf (positie en hoogte) en het element direct eronder staan stil.
           Bewust niet de paginahoogte: de vetgedrukte geselecteerde rij van de uurtabel (PR 1, buiten deze PR) breekt bij de extreme
           waarden van scenario 1 op 320 px af (rij 59 i.p.v. 38 px); dat is een apart punt en geen eigenschap van de kaart. */
        gelijk(hoogtes.size,1,L+": kaarthoogte wisselt tussen uren");gelijk(tops.size,1,L+": de kaart verschuift tussen uren ("+[...tops]+")");gelijk(volgend.size,1,L+": het element direct onder de kaart verschuift tussen uren ("+[...volgend]+")");
        if(!referentie[w])referentie[w]={h:[...hoogtes][0],v:[...volgend][0]};
        else{gelijk([...hoogtes][0],referentie[w].h,w+"px: kaarthoogte verschilt tussen NL en EN");ok(Math.abs([...volgend][0]-referentie[w].v)<=0.5,w+"px: afstand van de kaart tot het element eronder verschilt tussen NL en EN ("+[...volgend][0]+" tegen "+referentie[w].v+")");}
        await eerlijk(page,fouten,L);
      }finally{await context.close();}
    }

    /* E (windroos). De wijsrichting van de windroos bij 24 verschillende windrichtingen (ook vlak om de vakgrenzen van 22,5°): de naaldpunt wijst
       naar de meteorologische herkomst (0° = omhoog, 90° = rechts) en de kompastekst uit dezelfde graden valt in hetzelfde vak. */
    {
      const WD24=[0,11.2,11.3,22.5,45,67.5,90,112.5,135,157.5,180,202.5,225,247.5,250,270,292.5,315,337.5,348.7,348.8,359.9,5,100];
      const DIRSKORT=["N","NNO","NO","ONO","O","OZO","ZO","ZZO","Z","ZZW","ZW","WZW","W","WNW","NW","NNW"];
      const wd=u=>WD24[((u-13)%24+24)%24];
      const {context,page,fouten}=await open(browser,root,{w:390,nuIso:NU,offsetS:OFFSET,opties:{wd}});
      try{
        const gezien=[];
        for(let k=0;k<24;k++){
          const instant=Date.parse("2026-07-22T13:00:00Z")+k*UUR,u=new Date(instant).getUTCHours(),deg=wd(u);
          const pv=await geoXY(page,instant);ok(pv,"windroos: uur "+k+" staat in de grafiek");
          await page.touchscreen.tap(pv.x,pv.y);
          await page.waitForFunction(lokaal=>(document.querySelector("#tip-strook .tip-kop")||{textContent:""}).textContent.endsWith(lokaal),String((u+2)%24).padStart(2,"0")+":00",{timeout:8000});
          await sleep(150);
          const m=await meetKaart(page);
          ok(m.roos,"windroos: aanwezig bij "+deg+"°");
          ok(cirkelVerschil(m.roos.bearing,deg)<=0.1+0.05,"windroos "+deg+"°: de punt wijst naar "+m.roos.bearing+"°");
          gelijk(m.rijen[5][1],DIRSKORT[((Math.round(deg/22.5)%16)+16)%16],"windroos "+deg+"°: kompastekst bij dezelfde graden");
          gezien.push(m.roos.bearing);
        }
        ok(uniek(gezien.slice(0,1))===0&&Math.abs(gezien[WD24.indexOf(0)])<0.2&&Math.abs(gezien[WD24.indexOf(90)]-90)<0.2&&Math.abs(gezien[WD24.indexOf(180)]-180)<0.2&&Math.abs(gezien[WD24.indexOf(270)]-270)<0.2,"windroos: wind uit het noorden wijst omhoog, uit het oosten naar rechts, uit het zuiden omlaag en uit het westen naar links");
        await eerlijk(page,fouten,"windroos");
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
    console.log(`Detailkaart: ${n} controles geslaagd (acht waarden uit de weerreeksen, gedeeld raster en scheidingslijnen, windroos, geen afkapping of overlap, vaste hoogte, NL/EN, licht/donker, 320 t/m 429 px, verversing, desktop ongewijzigd, toegankelijkheid).`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

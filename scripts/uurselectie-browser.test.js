"use strict";

/* Uurselectie op het finale artifact met de echte runtime (Fase 1, PR 1).
   Eén selectie voor grafiek, detailkaart (strook), slider en uurtabel, gesleuteld op het UTC-instant van het uur.

   Het antwoord is API-vormig zoals Open-Meteo het levert (gemeten 31 oktober 2026): één vaste UTC-offset per antwoord, de
   dag begint om 00:00 in die offset, 24 uur historie en 7 dagen, 24 uren per as-dag. De temperatuur van een uur is gelijk
   aan het UTC-uur van zijn moment (0 tot 23), zodat de kaart bewijst bij welk echt moment een selectie hoort.

   Bewaakt:
   A. Standaard: het eerstvolgende uur is geselecteerd (kaart 140 px, geen layoutverschuiving), de eerste tabelrij heeft
      aria-current="time" en is ook de selectie, niets wordt aangekondigd bij laden.
   B. Handmatig: een tik blijft staan (ook na de 4 seconden en na een minuutherteken), het eerstvolgende uur blijft apart herkenbaar
      (data-current/aria-current) en verliest zijn selectiemarkering; één rij is gemarkeerd, nooit een andere.
   C. Tabel: een klik op de rij of de knop (muis, toetsenbord) kiest het uur; de focus blijft op de knop; alleen na een handeling
      wordt "Geselecteerd: …" aangekondigd.
   D. Een gekozen uur buiten de zichtbare rijen: verwijzing zonder layoutverschuiving (mobiel markering op "Alle uren bekijken", desktop op "Grafiekgegevens als tabel"; tekst voor schermlezers),
      geen automatisch uitklappen en geen scrollen.
   E. Hover is een voorvertoning en wijzigt de selectie niet; Escape sluit alleen de tijdelijke doos.
   F. Dag uit de zevendaagse lijst: vandaag begint bij het eerstvolgende toekomstige uur, een andere dag bij het eerste uur van
      het getoonde dagvenster; geen toekomstig uur meer: compacte melding.
   G. Wintertijd (25 oktober 2026): "02:00 (zomertijd)" en "02:00 (wintertijd)" zijn eenduidig, ook voor de schermlezer, en de
      selectie blijft op hetzelfde instant als een verversing de provider-offset wijzigt.
   H. Engels: aanduidingen, knoppen, meldingen en lege toestand.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");

const OUT=process.env.WIW_PUBLIC||path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(OUT,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const UUR=3600000,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const iso=(ms,off)=>new Date(ms+off*1000).toISOString().slice(0,16);

/* Open-Meteo-vormig antwoord op één vaste offset. */
function antwoord(nuMs,offsetS,opties){
  const o=opties||{};
  const lokaalNu=iso(nuMs,offsetS),vandaag=lokaalNu.slice(0,10);
  const dag0=Date.parse(vandaag+"T00:00:00Z")-offsetS*1000,start=dag0-24*UUR,uren=8*24;
  const h={time:[],temperature_2m:[],apparent_temperature:[],relative_humidity_2m:[],dew_point_2m:[],precipitation_probability:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[],cloud_cover:[],wind_speed_10m:[],wind_direction_10m:[],wind_gusts_10m:[],visibility:[],uv_index:[],pressure_msl:[],is_day:[]};
  for(let i=0;i<uren;i++){
    const ms=start+i*UUR,u=new Date(ms).getUTCHours(),leeg=false;
    h.time.push(iso(ms,offsetS));
    h.temperature_2m.push(leeg?null:u);h.apparent_temperature.push(leeg?null:u-1);h.relative_humidity_2m.push(80);h.dew_point_2m.push(u-4);
    h.precipitation_probability.push(20);h.precipitation.push(0);h.rain.push(0);h.showers.push(0);h.snowfall.push(0);h.weather_code.push(2);h.cloud_cover.push(30);
    h.wind_speed_10m.push(12);h.wind_direction_10m.push(240);h.wind_gusts_10m.push(25);h.visibility.push(20000);h.uv_index.push(u>=8&&u<=14?1:0);h.pressure_msl.push(1015);h.is_day.push(u>=6&&u<16?1:0);
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

const lees=page=>page.evaluate(()=>{
  const g=document.getElementById("scrub"),st=document.getElementById("tip-strook"),hit=document.getElementById("hit");
  const rijen=[...document.querySelectorAll("#wiw-hour-table tbody tr")];
  const knop=r=>r.querySelector(".wiw-hour-pick");
  const verw=document.getElementById("wiw-uur-verwijzing");
  return {
    scrub:g?{display:g.style.display,modus:g.dataset.modus||""}:null,
    kop:(st&&st.querySelector(".tip-kop")||{}).textContent||"",oms:(st&&st.querySelector(".tip-oms")||{}).textContent||"",stH:st?Math.round(st.getBoundingClientRect().height):null,leeg:st?st.dataset.leeg||"":"",rijenInStrook:st?st.querySelectorAll(".tip-rij").length:0,
    valuenow:hit&&hit.getAttribute("aria-valuenow"),valuetext:hit&&hit.getAttribute("aria-valuetext")||"",
    gekozen:rijen.filter(r=>r.dataset.selected==="1").map(r=>r.dataset.instant),
    ingedrukt:rijen.filter(r=>knop(r)&&knop(r).getAttribute("aria-pressed")==="true").map(r=>r.dataset.instant),
    eerstvolgend:rijen.filter(r=>r.getAttribute("aria-current")==="time").map(r=>r.dataset.instant),
    status:(document.getElementById("wiw-uur-status")||{}).textContent||"",
    verwijzing:verw?verw.textContent.trim():"",verwDoel:(()=>{const d=document.querySelector("[data-uur-verwijzing]");return d?(d.id||d.tagName)+"|"+d.getAttribute("aria-describedby"):"";})(),docH:document.documentElement.scrollHeight,
    scrollY:Math.round(window.scrollY),focus:document.activeElement?(document.activeElement.className||document.activeElement.id||document.activeElement.tagName):""
  };
});
const geoXY=(page,ms)=>page.evaluate(ms=>{
  const G=S.geo,svg=document.getElementById("chart");svg.scrollIntoView({block:"center"});
  const k=WeatherNowInterpretatie.indexVoorInstant(G.TI,S.d.utc_offset_seconds,ms);if(k<0)return null;
  const r=svg.getBoundingClientRect(),sc=r.width/(G.W||900);return {k,x:r.left+G.x(k)*sc,y:r.top+G.y(G.T[k])*sc};
},ms);
const sleutel=iso0=>String(Date.parse(iso0));
const eerlijk=async (page,fouten,wat)=>{assert.deepEqual(fouten,[],wat+": scriptfouten "+fouten.join(" | "));};
let n=0;const ok=(c,m)=>{assert(c,m);n++;};const gelijk=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    /* ---------- A–D, F: telefoon, juli (zomertijd, offset +02:00), 22 juli 14:10 lokaal = 12:10Z ---------- */
    {
      const {context,page,fouten}=await open(browser,root,{w:390,nuIso:"2026-07-22T12:10:00Z",offsetS:7200});
      try{
        const eerst=sleutel("2026-07-22T13:00:00Z");      // 15:00 lokaal
        let m=await lees(page);
        gelijk(m.scrub,{display:"block",modus:"selectie"},"A: kruisdraad staat, tijdelijke doos is verborgen");
        gelijk(m.kop,"15:00","A: standaard = eerstvolgend uur (15:00)");
        ok(m.stH===140,"A: kaart is 140 px ("+m.stH+")");ok(m.rijenInStrook>=6,"A: kaart gevuld met de zes rijen");
        ok(/^15:00/.test(m.valuetext)&&Number(m.valuenow)>=1,"A: slider volgt de selectie ("+m.valuetext+")");
        gelijk(m.gekozen,[eerst],"A: één tabelrij gemarkeerd: 15:00");gelijk(m.ingedrukt,[eerst],"A: aria-pressed op dezelfde rij");gelijk(m.eerstvolgend,[eerst],"A: eerstvolgend uur apart herkenbaar (aria-current=time)");
        gelijk(m.status,"","A: niets aangekondigd bij laden");
        ok(await page.evaluate(()=>!document.querySelector("#wiw-hour-table [aria-selected]")),"A: geen aria-selected in de tabel (tabelsemantiek ongewijzigd)");
        ok(await page.evaluate(()=>[...document.querySelectorAll("#wiw-hour-table .wiw-hour-pick")].every(b=>/^Toon .+ in de grafiek/.test(b.getAttribute("aria-label")||""))),"A: iedere rij heeft een knop met naam");
        /* B. Een tik op 17:00 (15:00Z) blijft staan, ook na 5 s en na een minuutherteken. */
        const p17=await geoXY(page,Date.parse("2026-07-22T15:00:00Z"));ok(p17,"B: 17:00 staat in de grafiek");
        await page.touchscreen.tap(p17.x,p17.y);await sleep(5200);
        m=await lees(page);
        gelijk(m.kop,"17:00","B: kaart toont 17:00 ook na 5 s");gelijk(m.scrub.modus,"selectie","B: doos weg, selectie blijft");
        gelijk(m.gekozen,[sleutel("2026-07-22T15:00:00Z")],"B: alleen 17:00 gemarkeerd");gelijk(m.eerstvolgend,[eerst],"B: eerstvolgend uur blijft herkenbaar, zonder selectie");
        ok(m.status.startsWith("Geselecteerd: 17:00"),"B: aangekondigd na een handeling ("+m.status+")");
        await page.evaluate(()=>etmaal(S.chartStart,S.chartBereik));await sleep(150);
        m=await lees(page);gelijk(m.kop,"17:00","B: selectie blijft na de minuutherteken");gelijk(m.gekozen,[sleutel("2026-07-22T15:00:00Z")],"B: markering blijft na herteken");
        /* C. Klik op een rij en toetsenbord op de knop. */
        await page.click('#wiw-hour-table tbody tr[data-instant="'+sleutel("2026-07-22T17:00:00Z")+'"] td:nth-child(3)');await sleep(200);
        m=await lees(page);gelijk(m.kop,"19:00","C: klik op de rij kiest 19:00");gelijk(m.gekozen,[sleutel("2026-07-22T17:00:00Z")],"C: rij 19:00 gemarkeerd");ok(m.status.startsWith("Geselecteerd: 19:00"),"C: aangekondigd");
        const knop=page.locator('#wiw-hour-table tbody tr[data-instant="'+sleutel("2026-07-22T18:00:00Z")+'"] .wiw-hour-pick');
        await knop.focus();await page.keyboard.press("Enter");await sleep(200);
        m=await lees(page);gelijk(m.kop,"20:00","C: Enter op de knop kiest 20:00");ok(/wiw-hour-pick/.test(m.focus),"C: focus blijft op de knop ("+m.focus+")");
        gelijk(m.ingedrukt,[sleutel("2026-07-22T18:00:00Z")],"C: aria-pressed alleen op 20:00");
        /* D. Een uur in de uitklap: verwijzing, niet uitklappen, niet scrollen. */
        const verder=Date.parse("2026-07-23T05:00:00Z");   // 07:00 morgen: rij 17 van 23, verborgen op een telefoon
        const pv=await geoXY(page,verder);ok(pv,"D: uur ligt in de grafiek");
        const y0=await page.evaluate(()=>Math.round(window.scrollY)),h0=(await lees(page)).docH;
        await page.touchscreen.tap(pv.x,pv.y);await sleep(5200);
        m=await lees(page);
        ok(/Alle uren bekijken/.test(m.verwijzing),"D: verwijzing naar Alle uren bekijken ("+m.verwijzing+")");
        gelijk(m.verwDoel,"wiw-hour-toggle|wiw-uur-verwijzing","D: de knop 'Alle uren bekijken' is gemarkeerd en beschreven door de verwijzing");
        ok(m.docH===h0,"D: de verwijzing verschuift de pagina niet ("+h0+" → "+m.docH+")");
        gelijk(await page.evaluate(()=>document.getElementById("wiw-hour-toggle").getAttribute("aria-expanded")),"false","D: niet automatisch uitgeklapt");
        ok(Math.abs(m.scrollY-y0)<=2,"D: niet gescrold");
        gelijk(await page.evaluate(()=>Math.round(document.getElementById("wiw-hour-table").getBoundingClientRect().height)>0),true,"D: tabel intact");
        await page.click("#wiw-hour-toggle");await sleep(200);
        m=await lees(page);gelijk(m.verwijzing,"","D: na uitklappen is de rij zichtbaar en de verwijzing weg");gelijk(m.verwDoel,"","D: markering weg na uitklappen");
        gelijk(m.gekozen,[sleutel("2026-07-23T05:00:00Z")],"D: rij gemarkeerd na uitklappen");
        /* F. Dagen. */
        await page.click('#days .row.day[data-i="1"]');await sleep(500);
        m=await lees(page);ok(/00:00$/.test(m.kop),"F: morgen begint bij het eerste uur van het dagvenster ("+m.kop+")");
        await page.click('#days .row.day[data-i="0"]');await sleep(500);
        m=await lees(page);gelijk(m.kop,"15:00","F: vandaag begint bij het eerstvolgende toekomstige uur, niet bij 00:00");
        await eerlijk(page,fouten,"telefoon");
      }finally{await context.close();}
    }

    /* ---------- F: vandaag zonder toekomstige uren (23:30 lokaal) ---------- */
    {
      const {context,page,fouten}=await open(browser,root,{w:390,nuIso:"2026-07-22T21:30:00Z",offsetS:7200});
      try{
        let m=await lees(page);gelijk(m.kop,"morgen 00:00","F: om 23:30 is het eerstvolgende uur morgen 00:00");
        await page.click('#days .row.day[data-i="0"]');await sleep(500);
        m=await lees(page);
        gelijk(m.leeg,"1","F: lege toestand");gelijk(m.kop,"Geen uurgegevens","F: kop");gelijk(m.oms,"Geen komende uren meer vandaag.","F: melding voor vandaag");
        gelijk(m.scrub.display,"none","F: geen kruisdraad zonder geldig uur");ok(m.stH===140,"F: lege toestand houdt de gereserveerde hoogte ("+m.stH+")");
        gelijk(m.gekozen,[],"F: geen tabelrij gemarkeerd");
        await page.click('#days .row.day[data-i="1"]');await sleep(500);
        m=await lees(page);ok(m.leeg===""&&/00:00$/.test(m.kop),"F: een andere dag herstelt de kaart ("+m.kop+")");
        await eerlijk(page,fouten,"23:30");
      }finally{await context.close();}
    }


    /* ---------- E: desktop, hover en verwijzing naar Grafiekgegevens als tabel ---------- */
    {
      const {context,page,fouten}=await open(browser,root,{w:1440,nuIso:"2026-07-22T12:10:00Z",offsetS:7200});
      try{
        let m=await lees(page);
        gelijk(m.scrub.modus,"selectie","E: desktop start met alleen kruisdraad");gelijk(m.gekozen,[sleutel("2026-07-22T13:00:00Z")],"E: standaardrij gemarkeerd");
        const hoverMs=Date.parse("2026-07-22T17:00:00Z"),p=await geoXY(page,hoverMs);
        await page.mouse.move(p.x,p.y,{steps:3});await sleep(250);
        m=await lees(page);gelijk(m.scrub.modus,"voorvertoning","E: hover toont de tijdelijke doos");gelijk(m.gekozen,[sleutel("2026-07-22T13:00:00Z")],"E: hover wijzigt de selectie niet");
        await page.mouse.move(3,3);await sleep(300);
        m=await lees(page);gelijk(m.scrub.modus,"selectie","E: doos weg na verlaten, selectie blijft");
        await page.mouse.move(p.x,p.y,{steps:2});await sleep(150);await page.keyboard.press("Escape");
        /* Desktop: geen knoppen in de uurkolom (bewaker cwv-desktop-recovery), wel een klikbare rij voor de muis. */
        gelijk(await page.evaluate(()=>[...document.querySelectorAll("#wiw-hour-panel button")].filter(e=>e.getClientRects().length>0).length),0,"E: de desktop-uurkolom heeft geen zichtbare knoppen");
        const rij3=await page.evaluate(()=>document.querySelectorAll("#wiw-hour-table tbody tr")[2].dataset.instant);
        await page.click('#wiw-hour-table tbody tr:nth-child(3) td:nth-child(3)');await sleep(250);
        m=await lees(page);gelijk(m.gekozen,[rij3],"E: een klik op een rij kiest dat uur");
        /* Escape op een niet-gefocust vlak doet niets met de selectie. */
        const ver=Date.parse("2026-07-23T06:00:00Z"),pv=await geoXY(page,ver);ok(pv,"E: uur ligt in de grafiek");
        const y0=await page.evaluate(()=>Math.round(window.scrollY)),h0=(await lees(page)).docH;
        await page.mouse.click(pv.x,pv.y);await sleep(300);await page.mouse.move(3,3);await sleep(300);
        m=await lees(page);
        gelijk(m.gekozen,[],"E: geen rij gemarkeerd als het uur niet in de zichtbare rijen staat");
        ok(/staat niet in dit overzicht; zie Grafiekgegevens als tabel/.test(m.verwijzing)&&m.verwDoel==="SUMMARY|wiw-uur-verwijzing","E: verwijzing naar Grafiekgegevens als tabel ("+m.verwijzing+" "+m.verwDoel+")");
        ok(m.docH===h0,"E: de verwijzing verschuift de pagina niet ("+h0+" → "+m.docH+")");
        gelijk(await page.evaluate(()=>document.querySelector("details#chartdata").open),false,"E: uitklap ongewijzigd (niet automatisch geopend)");
        ok(Math.abs(m.scrollY-y0)<=2,"E: niet gescrold");gelijk(await page.evaluate(()=>(document.querySelector("#wiw-hour-table tbody tr")||{dataset:{}}).dataset.instant),sleutel("2026-07-22T13:00:00Z"),"E: de eerste rij blijft het eerstvolgende uur (desktoptabel heeft geen aria-current-rij, bestaand gedrag)");
        await eerlijk(page,fouten,"desktop");
      }finally{await context.close();}
    }

    /* ---------- G: wintertijd 25 oktober 2026 ---------- */
    {
      /* 01:30 CEST (23:30Z), antwoord op +02:00: beide uren 02:00 staan in de tabel. */
      const {context,page,fouten,bron}=await open(browser,root,{w:390,nuIso:"2026-10-24T23:30:00Z",offsetS:7200});
      try{
        const zomer=sleutel("2026-10-25T00:00:00Z"),winter=sleutel("2026-10-25T01:00:00Z");
        let m=await lees(page);
        gelijk(m.kop,"02:00 (zomertijd)","G: standaard = het eerste 02:00-uur, eenduidig");
        ok(/^02:00 \(zomertijd\)/.test(m.valuetext),"G: slider leest 'zomertijd' voor ("+m.valuetext+")");
        const lab=await page.evaluate(()=>[...document.querySelectorAll("#wiw-hour-table tbody tr")].slice(0,3).map(r=>({i:r.dataset.instant,t:r.querySelector("time").textContent.trim(),z:(r.querySelector(".wiw-hour-tijdzone")||{}).textContent||"",l:r.querySelector(".wiw-hour-pick").getAttribute("aria-label")})));
        gelijk(lab.map(x=>x.t),["02:00","02:00","03:00"],"G: twee rijen met label 02:00 (twee echte uren)");
        gelijk(lab.map(x=>x.z),["(zomertijd)","(wintertijd)",""],"G: eenduidige aanduiding in de tabel");
        ok(/zomertijd/.test(lab[0].l)&&/wintertijd/.test(lab[1].l),"G: ook de knopnaam (schermlezer) is eenduidig ("+lab[0].l+" / "+lab[1].l+")");
        gelijk(lab.map(x=>x.i),[zomer,winter,sleutel("2026-10-25T02:00:00Z")],"G: sleutel is het instant");
        /* Kies het tweede 02:00 via de tabel. */
        await page.locator('#wiw-hour-table tbody tr[data-instant="'+winter+'"] .wiw-hour-pick').click();await sleep(250);
        m=await lees(page);gelijk(m.kop,"02:00 (wintertijd)","G: tweede keer gekozen");gelijk(m.gekozen,[winter],"G: alleen de tweede rij gemarkeerd");ok(/Geselecteerd: 02:00 \(wintertijd\)/.test(m.status),"G: aangekondigd met aanduiding ("+m.status+")");
        /* Verversing met een andere offset (antwoord na de wissel: +01:00, dag begint een uur later in tekst). */
        bron.data=antwoord(Date.parse("2026-10-25T00:40:00Z"),3600);
        await page.evaluate(()=>{S.op=0;});await page.evaluate(()=>weatherNowVerversTick());await sleep(900);
        gelijk(await page.evaluate(()=>S.d.utc_offset_seconds),3600,"G: nieuw antwoord is geladen (offset +01:00)");
        m=await lees(page);gelijk(m.kop,"02:00 (wintertijd)","G: selectie blijft op hetzelfde instant na verversing met andere offset");gelijk(m.gekozen,[winter],"G: tabelmarkering blijft op het instant");
        await eerlijk(page,fouten,"wintertijd");
      }finally{await context.close();}
    }

    /* ---------- H: Engels ---------- */
    {
      const {context,page,fouten}=await open(browser,root,{w:390,nuIso:"2026-10-24T23:30:00Z",offsetS:7200,taal:"en"});
      try{
        const winter=sleutel("2026-10-25T01:00:00Z");
        let m=await lees(page);gelijk(m.kop,"02:00 (summer time)","H: kop Engels");ok(/summer time/.test(m.valuetext),"H: slider Engels ("+m.valuetext+")");
        const lab=await page.evaluate(()=>[...document.querySelectorAll("#wiw-hour-table tbody tr")].slice(0,2).map(r=>({z:(r.querySelector(".wiw-hour-tijdzone")||{}).textContent||"",l:r.querySelector(".wiw-hour-pick").getAttribute("aria-label")})));
        gelijk(lab.map(x=>x.z),["(summer time)","(winter time)"],"H: aanduiding in de tabel");
        ok(/^Show 02:00 \(winter time\) in the chart/.test(lab[1].l),"H: knopnaam Engels ("+lab[1].l+")");
        await page.locator('#wiw-hour-table tbody tr[data-instant="'+winter+'"] .wiw-hour-pick').click();await sleep(250);
        m=await lees(page);ok(/^Selected: 02:00 \(winter time\)/.test(m.status),"H: melding Engels ("+m.status+")");
        const ver=Date.parse("2026-10-25T21:00:00Z"),pv=await geoXY(page,ver);
        if(pv){await page.touchscreen.tap(pv.x,pv.y);await sleep(5200);m=await lees(page);ok(/is selected; that row is under ‘See all hours’\./.test(m.verwijzing),"H: verwijzing Engels ("+m.verwijzing+")");}
        await eerlijk(page,fouten,"Engels");
      }finally{await context.close();}
      const l=await open(browser,root,{w:390,nuIso:"2026-07-22T21:30:00Z",offsetS:7200,taal:"en"});
      try{await l.page.click('#days .row.day[data-i="0"]');await sleep(500);const m=await lees(l.page);gelijk(m.kop,"No hourly data","H: lege toestand Engels");gelijk(m.oms,"No more upcoming hours today.","H: melding Engels");await eerlijk(l.page,l.fouten,"Engels leeg");}finally{await l.context.close();}
    }
    /* ---------- I: aria-valuetext volgt gegevens en taal ook als de gekozen index gelijk blijft ---------- */
    {
      const {context,page,fouten,bron}=await open(browser,root,{w:390,nuIso:"2026-07-22T12:10:00Z",offsetS:7200});
      const klaar=()=>page.waitForFunction(()=>document.querySelectorAll("#days .row.day").length>=7&&document.querySelectorAll("#wiw-hour-table tbody tr").length>0&&(document.getElementById("hit")||{getAttribute:()=>""}).getAttribute("aria-valuetext"),null,{timeout:20000});
      try{
        const k17=sleutel("2026-07-22T15:00:00Z");
        /* Verschillende tabeluren: elk eigen uur zet index, tekst en markering, zonder rest van het vorige uur. */
        const gezien=[];
        for(const u of ["2026-07-22T14:00:00Z","2026-07-22T15:00:00Z","2026-07-22T16:00:00Z"]){
          await page.locator('#wiw-hour-table tbody tr[data-instant="'+sleutel(u)+'"] .wiw-hour-pick').click();await sleep(250);
          const m=await lees(page);const uur=String(new Date(Date.parse(u)).getUTCHours());
          ok(new RegExp("^"+String(Number(uur)+2).padStart(2,"0")+":00, "+uur+" graden").test(m.valuetext),"I: valuetext volgt het gekozen tabeluur "+u+" ("+m.valuetext+")");
          gelijk(m.gekozen,[sleutel(u)],"I: alleen het gekozen tabeluur is gemarkeerd ("+u+")");gezien.push(m.valuenow);
        }
        ok(new Set(gezien).size===3,"I: aria-valuenow verschilt per gekozen uur ("+gezien+")");
        await page.locator('#wiw-hour-table tbody tr[data-instant="'+k17+'"] .wiw-hour-pick').click();await sleep(250);
        let m=await lees(page);const nu0=m.valuenow,tekst0=m.valuetext;
        ok(/^17:00, 15 graden/.test(tekst0),"I: 17:00 gekozen ("+tekst0+")");
        /* Gegevensverversing met dezelfde geselecteerde index maar andere waarden: valuetext en kaart volgen de nieuwe gegevens. */
        const nieuw=antwoord(Date.parse("2026-07-22T12:10:00Z"),7200);
        nieuw.hourly.temperature_2m[nieuw.hourly.time.indexOf(iso(Date.parse("2026-07-22T15:00:00Z"),7200))]=21;
        bron.data=nieuw;
        await page.evaluate(()=>{S.op=0;});await page.evaluate(()=>weatherNowVerversTick());await sleep(900);
        m=await lees(page);
        gelijk(m.valuenow,nu0,"I: dezelfde index na verversing");gelijk(m.kop,"17:00","I: selectie blijft op 17:00 na verversing");
        ok(/^17:00, 21 graden/.test(m.valuetext),"I: valuetext volgt de nieuwe temperatuur bij gelijke index ("+m.valuetext+")");
        ok(await page.evaluate(()=>/21\s*°C/.test(document.getElementById("tip-strook").textContent)),"I: de kaart toont de nieuwe temperatuur");
        gelijk(m.gekozen,[k17],"I: tabelmarkering blijft op 17:00");
        /* Verversing met identieke gegevens: dezelfde tekst, geen verlies van selectie. */
        const vt1=m.valuetext;await page.evaluate(()=>{S.op=0;});await page.evaluate(()=>weatherNowVerversTick());await sleep(900);
        m=await lees(page);gelijk(m.valuetext,vt1,"I: identieke gegevens geven dezelfde valuetext");gelijk(m.gekozen,[k17],"I: selectie blijft staan");
        /* NL → EN met de echte schakelaar: nieuwe laadbeurt, valuetext en knopnamen in het Engels, selectie via de tabel werkt daar ook. */
        await Promise.all([page.waitForNavigation({waitUntil:"domcontentloaded"}),page.click('[data-taal-keuze="en"]')]);await klaar();await sleep(600);
        m=await lees(page);
        ok(/degrees/.test(m.valuetext)&&!/graden|procent/.test(m.valuetext),"I: valuetext is Engels na de taalwissel ("+m.valuetext+")");
        await page.locator('#wiw-hour-table tbody tr[data-instant="'+k17+'"] .wiw-hour-pick').click();await sleep(300);
        m=await lees(page);ok(/^17:00, 21 degrees/.test(m.valuetext),"I: gekozen uur in het Engels, met de bijgewerkte gegevens ("+m.valuetext+")");ok(m.status.startsWith("Selected: 17:00"),"I: melding Engels ("+m.status+")");
        /* EN → NL. */
        await Promise.all([page.waitForNavigation({waitUntil:"domcontentloaded"}),page.click('[data-taal-keuze="nl"]')]);await klaar();await sleep(600);
        m=await lees(page);ok(/graden/.test(m.valuetext)&&!/degrees/.test(m.valuetext),"I: valuetext is weer Nederlands ("+m.valuetext+")");
        await eerlijk(page,fouten,"valuetext en taal");
      }finally{await context.close();}
    }
    console.log(`Uurselectie: ${n} controles geslaagd (standaardkeuze, persistente selectie, tabel, verwijzingen, dagen, lege toestand (23:30), wintertijd, Engels, valuetext bij verversing en taalwissel).`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

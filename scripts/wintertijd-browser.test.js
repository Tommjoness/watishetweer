"use strict";

/* Wintertijd (zondag 25 oktober 2026, 03:00 CEST → 02:00 CET) op het finale
   artifact met de echte runtime, in een browser in Europe/Amsterdam.

   Open-Meteo zet alle tijden in één antwoord op één vaste UTC-afwijking: die
   van het moment van opvragen (gemeten 4 oktober: Sydney, en de wissel van
   26 oktober 2025 in Amsterdam). Vóór de wissel opgevraagd staat zondag dus nog
   in +02:00, erna staat zaterdag al in +01:00. De site moet iedere tijd via
   die vaste afwijking naar het echte moment omrekenen en dan in de echte
   lokale tijd tonen.

   Om dat hard te toetsen is de temperatuur in de nagebootste data gelijk aan
   het UTC-uur van dat moment (00..23). Een uurrij "03:00" op zondag (02:00 UTC)
   hoort dus 2 graden te tonen. De zonsopkomst is de echte (07:24 CET op 25
   oktober), in de vaste afwijking van het antwoord.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");

const OUT=process.env.WIW_PUBLIC||path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const UUR=3600000;

/* Zonstanden Amsterdam in UTC (benadering, ±2 minuten). In echte lokale tijd:
   zaterdag 24 oktober op 08:22 CEST, zondag 25 oktober op 07:24 CET. */
const ZON_UTC={
  "2026-10-20":["06:14","16:53"],"2026-10-21":["06:15","16:51"],"2026-10-22":["06:17","16:49"],
  "2026-10-23":["06:20","16:46"],"2026-10-24":["06:22","16:44"],"2026-10-25":["06:24","16:42"],
  "2026-10-26":["06:26","16:40"],"2026-10-27":["06:27","16:38"],"2026-10-28":["06:29","16:36"],
  "2026-10-29":["06:31","16:34"],"2026-10-30":["06:33","16:32"],"2026-10-31":["06:35","16:30"]
};
const zonUtc=(datum,i)=>Date.parse(datum+"T"+ZON_UTC[datum][i]+":00Z");

const iso=(ms,offsetS)=>new Date(ms+offsetS*1000).toISOString().slice(0,16);

/* Een Open-Meteo-antwoord zoals de echte API het opgevraagd op `nuMs` geeft:
   alle tijden in één vaste afwijking `offsetS`, de dag begint om 00:00 in die
   afwijking, 24 uur historie, 7 dagen. */
function openMeteo(nuMs,offsetS){
  const lokaalNu=iso(nuMs,offsetS);
  const vandaag=lokaalNu.slice(0,10);
  const dag0=Date.parse(vandaag+"T00:00:00Z")-offsetS*1000;
  const start=dag0-24*UUR,uren=8*24;
  const h={time:[],temperature_2m:[],apparent_temperature:[],relative_humidity_2m:[],dew_point_2m:[],precipitation_probability:[],
    precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[],cloud_cover:[],wind_speed_10m:[],wind_direction_10m:[],
    wind_gusts_10m:[],visibility:[],uv_index:[],pressure_msl:[],is_day:[]};
  for(let i=0;i<uren;i++){
    const ms=start+i*UUR,utcUur=new Date(ms).getUTCHours();
    h.time.push(iso(ms,offsetS));
    h.temperature_2m.push(utcUur);h.apparent_temperature.push(utcUur-1);
    h.relative_humidity_2m.push(80);h.dew_point_2m.push(utcUur-4);h.precipitation_probability.push(ms===Date.parse("2026-10-25T01:00:00Z")||ms===Date.parse("2026-10-25T02:00:00Z")?80:5);
    /* Regen in de uren 00Z–01Z en 01Z–02Z van 25 oktober: 02:00 zomertijd tot
       03:00 wintertijd. Open-Meteo zet neerslag op het eind van het uur. */
    const regen=ms===Date.parse("2026-10-25T01:00:00Z")||ms===Date.parse("2026-10-25T02:00:00Z")?1:0;
    h.precipitation.push(regen);h.rain.push(regen);h.showers.push(0);h.snowfall.push(0);
    h.weather_code.push(2);h.cloud_cover.push(30);h.wind_speed_10m.push(12);h.wind_direction_10m.push(240);
    h.wind_gusts_10m.push(25);h.visibility.push(20000);h.uv_index.push(utcUur>=8&&utcUur<=14?1:0);h.pressure_msl.push(1015);
    h.is_day.push(utcUur>=6&&utcUur<16?1:0);
  }
  const dagen=Array.from({length:7},(_,k)=>new Date(Date.parse(vandaag+"T00:00:00Z")+k*86400000).toISOString().slice(0,10));
  const uurIndex=h.time.indexOf(iso(Math.floor(nuMs/UUR)*UUR,offsetS));
  const kwartier=Math.floor(nuMs/900000)*900000;
  return {
    latitude:52.37,longitude:4.9,timezone:"Europe/Amsterdam",timezone_abbreviation:offsetS===7200?"GMT+2":"GMT+1",utc_offset_seconds:offsetS,
    current:{time:iso(kwartier,offsetS),temperature_2m:h.temperature_2m[uurIndex],apparent_temperature:h.apparent_temperature[uurIndex],
      relative_humidity_2m:80,is_day:h.is_day[uurIndex],precipitation:0,rain:0,showers:0,snowfall:0,weather_code:2,cloud_cover:30,
      pressure_msl:1015,wind_speed_10m:12,wind_direction_10m:240,wind_gusts_10m:25,visibility:20000},
    minutely_15:{time:Array.from({length:20},(_,k)=>iso(kwartier+(k-4)*900000,offsetS)),precipitation:Array(20).fill(0),
      rain:Array(20).fill(0),showers:Array(20).fill(0),snowfall:Array(20).fill(0),weather_code:Array(20).fill(2)},
    hourly:h,
    daily:{time:dagen,weather_code:dagen.map(()=>2),temperature_2m_max:dagen.map(()=>14),temperature_2m_min:dagen.map(()=>6),
      sunrise:dagen.map(d=>iso(zonUtc(d,0),offsetS)),sunset:dagen.map(d=>iso(zonUtc(d,1),offsetS)),
      precipitation_probability_max:dagen.map(()=>5),precipitation_sum:dagen.map(()=>0),uv_index_max:dagen.map(()=>1),
      wind_speed_10m_max:dagen.map(()=>20),wind_gusts_10m_max:dagen.map(()=>30),wind_direction_10m_dominant:dagen.map(()=>240),
      sunshine_duration:dagen.map(()=>18000)}
  };
}

const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webmanifest":"application/manifest+json"};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,"http://localhost").pathname);if(p.endsWith("/"))p+="index.html";
  let f=path.join(OUT,p);if(!fs.existsSync(f)&&fs.existsSync(f+".html"))f+=".html";
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,{w,h,nuMs,offsetS,taal}){
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(([e,taal])=>{
    const N=Date,s=N.now();class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;
    try{if(taal)localStorage.setItem("weerbriefing.taal.v1",JSON.stringify(taal));}catch(x){}
  },[nuMs,taal||null]);
  const data=openMeteo(nuMs,offsetS);
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:data});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:[data.current.time.slice(0,13)+":00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/amsterdam/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:15000});
  await page.waitForFunction(()=>document.querySelectorAll("#wiw-hour-table tbody tr").length>0&&document.querySelectorAll("#days .row.day").length>=7,null,{timeout:15000});
  await sleep(800);
  return {context,page,fouten};
}

const AMS=new Intl.DateTimeFormat("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const echtLabel=ms=>AMS.format(new Date(ms));
/* Open-Meteo-tijd (vaste afwijking) → echt moment in ms. */
const moment=(t,offsetS)=>Date.parse(String(t).slice(0,16)+":00Z")-offsetS*1000;

const meet=()=>{
  const tekst=el=>(el&&el.textContent||"").replace(/\s+/g," ").trim();
  const rijen=[...document.querySelectorAll("#wiw-hour-table tbody tr")].map(tr=>{
    const tijd=tekst(tr.querySelector("time")).slice(0,5);
    const t=tekst(tr.querySelector(".wiw-hour-temp .wiw-hour-primary")||tr.cells[1]);
    const m=/(-?\d+)\s*°/.exec(t);return {tijd,temp:m?Number(m[1]):null};
  });
  /* Ieder uurlabel op de as met het uur op zijn positie (S.geo.x). */
  const g=S.geo||{},n=Array.isArray(g.TI)?g.TI.length:0;
  const as=[...document.querySelectorAll("#chart text")].filter(t=>/^\d{2}:00$/.test(t.textContent.trim())).map(t=>{
    const x=Number(t.getAttribute("x"));let i=-1;
    if(typeof g.x==="function")for(let k=0;k<n;k++)if(Math.abs(g.x(k)-x)<0.5){i=k;break;}
    return {tekst:t.textContent.trim(),i};
  });
  return {rijen,as,TI:(S.geo&&S.geo.TI)||[],zon:tekst(document.getElementById("suntimes")),
    regen:tekst(document.getElementById("final-rain-summary")),
    nacht:tekst(document.querySelector("#nightcard,#nacht,#nachtzicht,.nachtzicht,[id*=nacht]"))};
};

/* Iedere uurrij: label = echte lokale tijd van het uur waarvan het UTC-uur de
   getoonde temperatuur is, en de rijen volgen elkaar per uur op. */
function toetsRijen(label,rijen,nuMs){
  assert.ok(rijen.length>=8,label+": te weinig uurrijen ("+rijen.length+")");
  let vorige=nuMs-3*UUR;
  rijen.forEach((r,k)=>{
    assert.ok(Number.isInteger(r.temp),label+": rij "+k+" zonder temperatuur");
    let ms=Math.floor(vorige/UUR)*UUR+UUR;while(new Date(ms).getUTCHours()!==((r.temp%24)+24)%24)ms+=UUR;
    if(k>0)assert.equal(ms-vorige,UUR,label+": rij "+k+" ("+r.tijd+", "+r.temp+"°) volgt niet één uur na de vorige");
    assert.equal(r.tijd,echtLabel(ms),label+": rij "+k+" toont "+r.tijd+" maar het uur is "+echtLabel(ms)+" lokale tijd");
    vorige=ms;
  });
}
/* Tijdas: ieder getekend uurlabel is de echte lokale tijd van een punt op de
   as, in volgorde. */
function toetsAs(label,as,TI,offsetS){
  assert.ok(as.length>=3,label+": te weinig aslabels ("+as.length+")");
  for(const a of as){
    assert.ok(a.i>=0,label+": aslabel "+a.tekst+" staat niet op een uur van de as");
    const echt=echtLabel(moment(TI[a.i],offsetS));
    assert.equal(a.tekst,echt,label+": aslabel "+a.tekst+" staat op het uur "+echt+" lokale tijd ("+TI[a.i]+" in de bron)");
  }
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    const scenario=[
      {naam:"za 24 okt 22:10 CEST, opgevraagd in +02",nuMs:Date.parse("2026-10-24T20:10:00Z"),offsetS:7200,regen:/morgen 02:00–03:00/,zondag:true},
      {naam:"wo 21 okt 12:00 CEST, opgevraagd in +02",nuMs:Date.parse("2026-10-21T10:00:00Z"),offsetS:7200,zondag:true},
      {naam:"zo 25 okt 02:30 CET (tweede 02:30), opgevraagd in +01",nuMs:Date.parse("2026-10-25T01:30:00Z"),offsetS:3600},
      {naam:"zo 25 okt 02:30 CEST (eerste 02:30), opgevraagd in +02",nuMs:Date.parse("2026-10-25T00:30:00Z"),offsetS:7200},
      {naam:"zo 25 okt 12:00 CET, opgevraagd in +01",nuMs:Date.parse("2026-10-25T11:00:00Z"),offsetS:3600}
    ];
    for(const s of scenario)for(const [w,h] of [[390,844],[1366,900]]){
      const label=s.naam+" @"+w+"px";
      const {context,page,fouten}=await open(browser,root,{w,h,nuMs:s.nuMs,offsetS:s.offsetS});
      try{
        const m=await page.evaluate(meet);
        toetsRijen(label+" uurtabel",m.rijen,s.nuMs);
        toetsAs(label+" grafiek",m.as,m.TI,s.offsetS);
        if(s.regen)assert.match(m.regen,s.regen,label+": regenperiode "+JSON.stringify(m.regen));
        assert.deepEqual(fouten,[],label+": paginafouten");
        console.log("WINTERTIJD "+label+": uren "+m.rijen.slice(0,6).map(r=>r.tijd+"="+r.temp+"°").join(" ")+" | as "+m.as.slice(0,5).map(a=>a.tekst).join(" ")+(m.regen?" | "+m.regen:""));

        /* Zondag kiezen in Zeven dagen: zonsopkomst en uren in wintertijd. */
        if(s.zondag){
          const rij=await page.$$("#days .row.day");
          const zondag=await page.evaluate(()=>[...document.querySelectorAll("#days .row.day")].findIndex(r=>/zo(ndag)? 25 okt/.test(r.textContent)));
          if(zondag>=0){
            await rij[zondag].click();await sleep(700);
            const z=await page.evaluate(meet);
            assert.match(z.zon,/(?:Zonsopkomst|zon op) 07:24/i,label+": zondag zonsopkomst "+JSON.stringify(z.zon));
            assert.match(z.zon,/(?:Zonsondergang|zon onder) 17:42/i,label+": zondag zonsondergang "+JSON.stringify(z.zon));
            toetsAs(label+" grafiek zondag",z.as,z.TI,s.offsetS);
            console.log("WINTERTIJD "+label+" zondag gekozen: "+z.zon+" | as "+z.as.slice(0,6).map(a=>a.tekst).join(" "));
          }
        }
      }finally{await context.close();}
    }
    console.log("Wintertijd 25 oktober: uurtabel, grafiekas, regenperiode en zonstanden in echte lokale tijd, mobiel en desktop, vóór, tijdens en na de wissel.");
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

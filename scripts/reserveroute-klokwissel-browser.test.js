"use strict";

/* Reserveroute /api/forecast (Visual Crossing) rond klokwissels, op het finale
   artifact met de echte runtime. Open-Meteo is uitgevallen; de pagina valt terug
   op de daadwerkelijke serverroute api/forecast.mjs, gevoed met Visual
   Crossing-vormige data (scripts/klokwissel-fixtures.mjs). Alleen de upstream
   van Visual Crossing is nagebootst.

   Live gemeten op 25 oktober 2026, 10:37: de reserveroute meldde
   utc_offset_seconds 7200 bij tijden in wintertijd. De pagina toonde daardoor
   zon onder 16:24 in plaats van 17:24 en een uurtabel die een uur opschuift.

   Om dat hard te toetsen is de temperatuur van een uur gelijk aan het UTC-uur
   van zijn moment (0 tot 23). Een uurrij hoort het lokale klokuur van dat moment
   te tonen, in de zone van de plaats en niet in die van de bezoeker (die staat
   op Amsterdam). Zon op is 07:15 en zon onder 17:30 lokale tijd, elke dag.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");

const OUT=process.env.WIW_PUBLIC||path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const UUR=3600000;

const scenario=[
  {naam:"Amsterdam za 24 okt 22:10 CEST, wissel in het venster",tz:"Europe/Amsterdam",url:"/weer/amsterdam/",nu:"2026-10-24T20:10:00Z",start:"2026-10-24",offsetS:7200,wissel:"2026-10-25",nacht:[/^vannacht/,/^zo op ma/,/^ma op di/]},
  {naam:"Amsterdam zo 25 okt 02:30 CET (tweede 02:30)",tz:"Europe/Amsterdam",url:"/weer/amsterdam/",nu:"2026-10-25T01:30:00Z",start:"2026-10-25",offsetS:3600,wissel:"2026-10-25",nacht:[/^nu/,/^zo–ma/,/^ma op di/]},
  {naam:"Amsterdam zo 25 okt 10:37 CET, live gemeten fout",tz:"Europe/Amsterdam",url:"/weer/amsterdam/",nu:"2026-10-25T09:37:00Z",start:"2026-10-25",offsetS:3600,wissel:"2026-10-25",nacht:[/^vannacht/,/^ma op di/,/^di op wo/]},
  {naam:"Amsterdam za 27 mrt 2027 12:00 CET, voorjaarswissel in het venster",tz:"Europe/Amsterdam",url:"/weer/amsterdam/",nu:"2027-03-27T11:00:00Z",start:"2027-03-27",offsetS:3600,wissel:"2027-03-28",nacht:[/^vannacht/,/^zo op ma/,/^ma op di/]},
  {naam:"Amsterdam zo 28 mrt 2027 12:00 CEST, wisseldag zelf",tz:"Europe/Amsterdam",url:"/weer/amsterdam/",nu:"2027-03-28T10:00:00Z",start:"2027-03-28",offsetS:7200,wissel:"2027-03-28",nacht:[/^vannacht/,/^ma op di/,/^di op wo/]},
  {naam:"New York za 31 okt 2026 12:00 EDT, najaarswissel in het venster",tz:"America/New_York",url:"/?lat=40.7128&lon=-74.006&plaats=New+York&land=US",nu:"2026-10-31T16:00:00Z",start:"2026-10-31",offsetS:-14400,wissel:"2026-11-01"},
  {naam:"New York zo 1 nov 2026 12:00 EST, wisseldag zelf",tz:"America/New_York",url:"/?lat=40.7128&lon=-74.006&plaats=New+York&land=US",nu:"2026-11-01T17:00:00Z",start:"2026-11-01",offsetS:-18000,wissel:"2026-11-01"},
  {naam:"Sydney za 3 okt 2026 12:00 AEST, voorjaarssprong in het venster",tz:"Australia/Sydney",url:"/?lat=-33.8688&lon=151.2093&plaats=Sydney&land=AU",nu:"2026-10-03T02:00:00Z",start:"2026-10-03",offsetS:36000,wissel:"2026-10-04"},
  {naam:"Tokio zo 25 okt 2026 12:00 JST, geen zomertijd",tz:"Asia/Tokyo",url:"/?lat=35.6762&lon=139.6503&plaats=Tokio&land=JP",nu:"2026-10-25T03:00:00Z",start:"2026-10-25",offsetS:32400,wissel:null}
];

const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webmanifest":"application/manifest+json"};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,"http://localhost").pathname);if(p.endsWith("/"))p+="index.html";
  let f=path.join(OUT,p);if(!fs.existsSync(f)&&fs.existsSync(f+".html"))f+=".html";
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

const klok=tz=>new Intl.DateTimeFormat("nl-NL",{timeZone:tz,hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
const moment=(t,offsetS)=>Date.parse(String(t).slice(0,16)+":00Z")-offsetS*1000;

/* Het antwoord van de echte serverroute, met alleen de Visual Crossing-upstream nagebootst. */
async function reserveAntwoord(fix,worker,s){
  const payload=fix.vcPayload({timezone:s.tz,nuEpochS:Date.parse(s.nu)/1000,startDatum:s.start});
  const origineel=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify(payload),{status:200,headers:{"Content-Type":"application/json"}});
  try{
    const res=await worker.fetch(new Request("https://watishetweer.nl/api/forecast?lat=52.37&lon=4.9"),{VISUAL_CROSSING_API_KEY:"test-key"});
    assert.equal(res.status,200,s.naam+": serverroute");
    assert.equal(res.headers.get("x-wiw-weather-source"),"visualcrossing");
    return {body:await res.text(),bron:res.headers.get("x-wiw-weather-source")};
  }finally{globalThis.fetch=origineel;}
}

async function open(browser,root,s,antwoord,{w,h}){
  const nuMs=Date.parse(s.nu);
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(e=>{
    const N=Date,s0=N.now();class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s0]));}static now(){return e+N.now()-s0;}}window.Date=F;
  },nuMs);
  const nuIso=new Date(nuMs).toISOString().slice(0,13)+":00";
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"&&u.pathname.startsWith("/v1/forecast"))return r.abort();
    if(u.pathname==="/api/forecast")return r.fulfill({status:200,body:antwoord.body,headers:{"content-type":"application/json","x-wiw-weather-source":antwoord.bron}});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:[nuIso],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+s.url,{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll("#wiw-hour-table tbody tr").length>0&&document.querySelectorAll("#days .row.day").length>=7,null,{timeout:30000});
  await sleep(800);
  return {context,page,fouten};
}

const meet=()=>{
  const tekst=el=>(el&&el.textContent||"").replace(/\s+/g," ").trim();
  const rijen=[...document.querySelectorAll("#wiw-hour-table tbody tr")].map(tr=>{
    const tijd=tekst(tr.querySelector("time")).slice(0,5);
    const t=tekst(tr.querySelector(".wiw-hour-temp .wiw-hour-primary")||tr.cells[1]);
    const m=/(-?\d+)(?:[.,]\d)?\s*°/.exec(t);return {tijd,temp:m?Number(m[1]):null};
  });
  const g=S.geo||{},n=Array.isArray(g.TI)?g.TI.length:0;
  const as=[...document.querySelectorAll("#chart text")].filter(t=>!t.closest("#scrub")&&/^\d{2}:00$/.test(t.textContent.trim())).map(t=>{
    const x=Number(t.getAttribute("x"));let i=-1;
    if(typeof g.x==="function")for(let k=0;k<n;k++)if(Math.abs(g.x(k)-x)<0.5){i=k;break;}
    return {tekst:t.textContent.trim(),i};
  });
  return {rijen,as,TI:(S.geo&&S.geo.TI)||[],zon:tekst(document.getElementById("suntimes")),
    stempel:tekst(document.getElementById("stamp")),dagen:(S.d&&S.d.daily&&S.d.daily.time)||[],
    offset:S.d&&S.d.utc_offset_seconds,zone:S.d&&S.d.timezone,
    nachten:[...document.querySelectorAll("#nights .row.night:not(.kop)")].map(r=>tekst(r.querySelector(".dname")))};
};

/* Iedere uurrij toont het lokale klokuur van het uur waarvan het UTC-uur de getoonde temperatuur is. */
function toetsRijen(label,rijen,nuMs,tz){
  /* Typografie-ronde 29 oktober 2026: op 1366px passen naast de grafiek 7 volledige uurrijen van 16px en 14px tekst (main 8); op andere breedtes blijft het minimum 8. */
  const minRijen=/@1366px/.test(label)?7:8;
  assert.ok(rijen.length>=minRijen,label+": te weinig uurrijen ("+rijen.length+", minimaal "+minRijen+")");
  const echt=klok(tz);
  let vorige=nuMs-3*UUR;
  rijen.forEach((r,k)=>{
    assert.ok(Number.isInteger(r.temp),label+": rij "+k+" zonder temperatuur");
    let ms=Math.floor(vorige/UUR)*UUR+UUR;while(new Date(ms).getUTCHours()!==((r.temp%24)+24)%24)ms+=UUR;
    if(k>0)assert.equal(ms-vorige,UUR,label+": rij "+k+" ("+r.tijd+", "+r.temp+"°) volgt niet één uur na de vorige");
    assert.equal(r.tijd,echt.format(new Date(ms)),label+": rij "+k+" toont "+r.tijd+" maar het uur is "+echt.format(new Date(ms))+" lokale tijd");
    vorige=ms;
  });
}
/* Ieder getekend uurlabel op de as is de lokale tijd van een punt op de as. */
function toetsAs(label,as,TI,offsetS,tz){
  assert.ok(as.length>=3,label+": te weinig aslabels ("+as.length+")");
  const echt=klok(tz);
  for(const a of as){
    assert.ok(a.i>=0,label+": aslabel "+a.tekst+" staat niet op een uur van de as");
    const verwacht=echt.format(new Date(moment(TI[a.i],offsetS)));
    assert.equal(a.tekst,verwacht,label+": aslabel "+a.tekst+" staat op het uur "+verwacht+" lokale tijd ("+TI[a.i]+" in de bron)");
  }
}

(async()=>{
  const fix=await import("./klokwissel-fixtures.mjs");
  const {default:worker}=await import("../api/forecast.mjs");
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const s of scenario){
      const antwoord=await reserveAntwoord(fix,worker,s);
      const nuMs=Date.parse(s.nu);
      for(const [w,h] of [[390,844],[1366,900]]){
        const label=s.naam+" @"+w+"px";
        const {context,page,fouten}=await open(browser,root,s,antwoord,{w,h});
        try{
          const m=await page.evaluate(meet);
          assert.match(m.stempel,/Visual Crossing/,label+": de pagina gebruikt de reserveroute ("+m.stempel+")");
          assert.equal(m.offset,s.offsetS,label+": utc_offset_seconds van de reserveroute");
          assert.equal(m.zone,s.tz,label+": zone van de plaats");
          toetsRijen(label+" uurtabel",m.rijen,nuMs,s.tz);
          toetsAs(label+" grafiek",m.as,m.TI,s.offsetS,s.tz);
          assert.match(m.zon,/zon onder 17:30/i,label+": zon onder in lokale tijd, "+JSON.stringify(m.zon));
          assert.match(m.zon,/zon op 07:15/i,label+": zon op in lokale tijd, "+JSON.stringify(m.zon));
          /* Nachtzicht: dezelfde nachten, in dezelfde volgorde, als via de Open-Meteo-route (wintertijd-browser.test.js). */
          if(s.nacht)s.nacht.forEach((re,k)=>assert.match(m.nachten[k]||"",re,label+": nachtrij "+k+" is "+JSON.stringify(m.nachten[k])+" ("+JSON.stringify(m.nachten)+")"));
          assert.deepEqual(fouten,[],label+": paginafouten");
          console.log("RESERVEROUTE "+label+": uren "+m.rijen.slice(0,5).map(r=>r.tijd+"="+r.temp+"°").join(" ")+" | "+m.zon);

          /* De wisseldag kiezen in Zeven dagen: grafiekas en zon op die dag in lokale tijd. */
          if(s.wissel){
            const k=m.dagen.indexOf(s.wissel);
            assert.ok(k>=0,label+": wisseldag "+s.wissel+" ontbreekt in Zeven dagen ("+m.dagen.join(",")+")");
            const rij=await page.$$("#days .row.day");
            await rij[k].click();await sleep(700);
            const z=await page.evaluate(meet);
            assert.match(z.zon,/(?:Zonsopkomst|zon op) 07:15/i,label+": wisseldag zonsopkomst "+JSON.stringify(z.zon));
            assert.match(z.zon,/(?:Zonsondergang|zon onder) 17:30/i,label+": wisseldag zonsondergang "+JSON.stringify(z.zon));
            toetsAs(label+" grafiek wisseldag",z.as,z.TI,s.offsetS,s.tz);
            console.log("RESERVEROUTE "+label+" wisseldag "+s.wissel+": "+z.zon+" | as "+z.as.slice(0,6).map(a=>a.tekst).join(" "));
          }
        }finally{await context.close();}
      }
    }
    console.log("Reserveroute /api/forecast rond klokwissels: uurtabel, grafiekas en zon in de lokale tijd van de plaats, mobiel en desktop, "+scenario.length+" situaties (Amsterdam, New York, Sydney, Tokio; voor, tijdens en na iedere wissel).");
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

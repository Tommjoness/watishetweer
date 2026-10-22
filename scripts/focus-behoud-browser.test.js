"use strict";

/* WCAG 2.2 (2.4.3 Focusvolgorde, 3.2.x Voorspelbaar): een bedieningselement dat zichzelf of zijn omgeving
   herbouwt of uitschakelt mag de toetsenbordfocus niet laten verdwijnen (focus op <body>).
   Gecontroleerd met echte toetsaanslagen op het finale artifact (public/):
   - "Opnieuw proberen" op het Nachtzicht-overzicht, een parkpagina en de herfstvakantie: bij een
     volgende fout krijgt de nieuwe knop de focus, bij succes de inhoud;
   - hoofdpagina: Ververs, Bewaar plaats, een bewaarde plaats kiezen en verwijderen. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");
const {SEIZOENSPAGINAS}=require("./seizoenspagina.config.js");

const PUBLIC=path.join(__dirname,"..","public");
for(const f of ["index.html","nachtzicht/index.html","nachtzicht/alde-feanen/index.html","herfstvakantie/index.html"])
  if(!fs.existsSync(path.join(PUBLIC,f)))throw new Error("public/"+f+" ontbreekt; draai eerst de build.");
const herfst=SEIZOENSPAGINAS.find(p=>p.slug==="herfstvakantie");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  const rel=(pathname.endsWith("/")?pathname+"index.html":pathname).replace(/^\//,"");
  const file=path.join(PUBLIC,rel);
  if(file.startsWith(PUBLIC+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.writeHead(200,{"content-type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","cache-control":"no-store"});
    fs.createReadStream(file).pipe(res);return;
  }
  res.writeHead(404);res.end("not found");
});

function nacht(lat,lon){
  const d=bouw({geenKwartier:true,cc:()=>8});
  const i=d.hourly.time.indexOf("2026-07-22T21:00"),c=d.current,h=d.hourly;
  c.time="2026-07-22T21:30";
  for(const v of ["temperature_2m","relative_humidity_2m","precipitation","weather_code","cloud_cover","wind_gusts_10m","is_day"])c[v]=h[v][i];
  c.visibility=h.visibility?h.visibility[i]:null;
  d.latitude=lat;d.longitude=lon;d.elevation=2;
  return d;
}
function vakantieEen(){
  const dagen=[];for(let i=0;i<7;i++)dagen.push(new Date(Date.parse("2026-10-12T00:00:00Z")+i*864e5).toISOString().slice(0,10));
  return {daily:{time:dagen,temperature_2m_min:dagen.map(()=>7.6),temperature_2m_max:dagen.map(()=>15.4),
    precipitation_sum:dagen.map(()=>0.4),snowfall_sum:dagen.map(()=>0),precipitation_probability_max:dagen.map(()=>20),sunshine_duration:dagen.map(()=>null)}};
}
function hoofd(){
  const d=bouw({temp:(u,dag)=>+(18-u*.08+(dag||0)*.1).toFixed(1),tempNu:17.4,pp:u=>u%4?35:0,pr:u=>u===17?.4:0,som:.4,cc:u=>u>=20||u<=5?44:32,wc:u=>u===17?61:3,ws:14,wsNu:13,wg:()=>28});
  Object.assign(d.current,{time:"2026-07-22T14:17",interval:900,temperature_2m:17.4,apparent_temperature:16.8,is_day:1,weather_code:3,cloud_cover:32,wind_speed_10m:13,wind_direction_10m:250,pressure_msl:1014,visibility:18000});
  d.latitude=52.35;d.longitude=5.26;
  d.daily.sunrise=d.daily.time.map(t=>t+"T05:46");d.daily.sunset=d.daily.time.map(t=>t+"T21:44");d.daily.sunshine_duration=d.daily.time.map(()=>9.3*3600);
  return d;
}
const actief=()=>{const a=document.activeElement;return !a||a===document.body?"BODY":a.tagName.toLowerCase()+(a.id?"#"+a.id:"")+(typeof a.className==="string"&&a.className?"."+a.className.split(" ")[0]:"");};

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const base="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    /* ----- Opnieuw proberen op de informatiepagina's ----- */
    for(const [pad,knop,naam,klok] of [
      ["/nachtzicht/","#nz-status .nz-opnieuw","Nachtzicht-overzicht","2026-07-22T19:30:00Z"],
      ["/nachtzicht/alde-feanen/","#nz-status .nz-opnieuw","Nachtzicht-park","2026-07-22T19:30:00Z"],
      ["/herfstvakantie/",".seizoen-opnieuw","herfstvakantie","2026-10-12T10:00:00Z"]
    ]){
      for(const fouten of [1,2]){
        const context=await browser.newContext({viewport:{width:1280,height:900},timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
        const page=await context.newPage();
        let ronde=0;/* iedere poging na een klik op de knop; de eerste laadronde is 0 en mislukt altijd */
        await page.clock.setFixedTime(new Date(klok));
        await page.route("**/*",async r=>{
          const u=new URL(r.request().url());
          if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast"){
            if(ronde<fouten)return r.fulfill({status:503,body:"{}"});
            if(pad.startsWith("/herfstvakantie"))return r.fulfill({json:u.pathname==="/api/forecast"?vakantieEen():herfst.plaatsen.map(()=>vakantieEen())});
            const la=String(u.searchParams.get("latitude")||u.searchParams.get("lat")),lo=String(u.searchParams.get("longitude")||u.searchParams.get("lon"));
            if(la.includes(",")){const A=la.split(",").map(Number),B=lo.split(",").map(Number);return r.fulfill({json:A.map((x,i)=>nacht(x,B[i]))});}
            return r.fulfill({json:nacht(Number(la),Number(lo))});
          }
          if(u.pathname.startsWith("/api/"))return r.fulfill({status:503,json:{beschikbaar:false}});
          if(u.hostname!=="127.0.0.1")return r.fulfill({status:204,body:""});
          return r.continue();
        });
        const L=`${naam} (${fouten} extra fout${fouten>1?"en":""})`;
        try{
          await page.goto(base+pad,{waitUntil:"load"});
          await page.waitForSelector(knop,{timeout:30000});
          await page.focus(knop);
          for(let poging=1;poging<=fouten;poging++){
            ronde=poging;
            await page.keyboard.press("Enter");
            if(poging<fouten){
              /* Mislukt de poging opnieuw, dan staat er een nieuwe knop en die heeft de focus. */
              await page.waitForFunction(s=>{const a=document.activeElement;return a&&a.matches&&a.matches(s)&&!a.disabled;},knop,{timeout:30000});
            }
          }
          /* Na het laatste herstel: de focus staat niet op <body>. */
          await page.waitForFunction(()=>!document.querySelector("[aria-busy=true]"),null,{timeout:45000}).catch(()=>{});
          await page.waitForTimeout(1500);
          const f=await page.evaluate(actief);
          assert.notEqual(f,"BODY",`${L}: de focus is na het herstel op <body> beland`);
        }finally{await context.close();}
      }
    }
    console.log("Focus: Opnieuw proberen op Nachtzicht (overzicht en park) en herfstvakantie houdt de focus op een bruikbaar element.");

    /* ----- hoofdpagina ----- */
    for(const breedte of [1440,390]){
      const context=await browser.newContext({viewport:{width:breedte,height:900},timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:breedte<700,hasTouch:breedte<700});
      const page=await context.newPage();
      await page.clock.setFixedTime(new Date("2026-07-22T12:17:00Z"));
      const d0=hoofd();
      await page.route("**/*",r=>{
        const u=new URL(r.request().url());
        if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:d0});
        if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:24,us_aqi:33},hourly:{time:[],alder_pollen:[]}}});
        if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
        if(u.pathname==="/api/plaatsnaam")return r.fulfill({json:{naam:"Almere",land:"NL",bron:"test"}});
        if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
        if(u.hostname!=="127.0.0.1")return r.fulfill({status:204,body:""});
        return r.continue();
      });
      try{
        await page.goto(base+"/",{waitUntil:"load"});
        await page.waitForSelector("#ververs",{timeout:30000});
        await page.waitForTimeout(3000);
        for(const [naam,sel] of [["Ververs","#ververs"],["Bewaar plaats","#chipadd"],["Bewaarde plaats kiezen",'.chipplaats[data-i="0"]'],["Bewaarde plaats verwijderen",".chip .x"]]){
          const el=await page.$(sel);
          if(!el||!(await el.isVisible()))continue;
          await el.focus();
          await page.keyboard.press("Enter");
          await page.waitForTimeout(1200);
          const f=await page.evaluate(actief);
          assert.notEqual(f,"BODY",`${breedte}px ${naam}: de focus is op <body> beland`);
        }
      }finally{await context.close();}
    }
    console.log("Focus: Ververs en plaatsen bewaren, kiezen en verwijderen houden de focus op een bruikbaar element (1440 en 390 px).");
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

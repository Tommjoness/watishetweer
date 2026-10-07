"use strict";

/* Witte kerst in de echte, definitieve build: ver voor kerst (alleen de datum
   waarop de verwachting verschijnt), binnen het venster (echte tabel per dag),
   een gedeeltelijk venster, een mislukte verwachting en de jaarwissel. Mobiel
   en desktop, licht en donker. Met SEIZOEN_SCREENSHOTS=<map> worden ook
   screenshots bewaard. */

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {SEIZOENSPAGINAS}=require("./seizoenspagina.config.js");

const PUBLIC=path.join(__dirname,"..","public");
const PAD="/witte-kerst/";
const bestand=path.join(PUBLIC,"witte-kerst","index.html");
if(!fs.existsSync(bestand))throw new Error("public/witte-kerst/index.html ontbreekt; draai eerst de build.");
const kerst=SEIZOENSPAGINAS.find(p=>p.slug==="witte-kerst");
const SCHERMEN=process.env.SEIZOEN_SCREENSHOTS||"";

const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".css":"text/css; charset=utf-8"};
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

/* Open-Meteo-antwoord: 7 dagen vanaf `start`, per plaats eigen sneeuw. */
function antwoord(start,perPlaats){
  const dagen=[];const t0=Date.parse(start+"T00:00:00Z");
  for(let i=0;i<7;i++)dagen.push(new Date(t0+i*864e5).toISOString().slice(0,10));
  return kerst.plaatsen.map((p,i)=>{
    const sneeuw=perPlaats(p,i)||{};
    const uren=[],diepte=[];
    for(const d of dagen)for(let u=0;u<24;u++){uren.push(`${d}T${String(u).padStart(2,"0")}:00`);diepte.push(sneeuw[d]?sneeuw[d].diepte:0);}
    return {
      latitude:p.lat,longitude:p.lon,timezone:"Europe/Amsterdam",utc_offset_seconds:3600,
      daily:{time:dagen,
        temperature_2m_min:dagen.map(d=>sneeuw[d]?sneeuw[d].min:2.4),
        temperature_2m_max:dagen.map(d=>sneeuw[d]?sneeuw[d].max:6.8),
        snowfall_sum:dagen.map(d=>sneeuw[d]?sneeuw[d].val:0),
        precipitation_sum:dagen.map(d=>sneeuw[d]?sneeuw[d].nat:(i%2?1.6:0))},
      hourly:{time:uren,snow_depth:diepte}
    };
  });
}
const metSneeuw=start=>antwoord(start,(p,i)=>i===0||i===2?{
  "2026-12-25":{diepte:0.04,val:2.3,nat:1.9,min:-3.2,max:0.4},
  "2026-12-26":{diepte:0.05,val:0.6,nat:0.5,min:-5.1,max:-0.8}
}:null);

const SCENARIOS=[
  {naam:"ver",nu:"2026-10-05T10:00:00Z",verwacht:{kop:"Witte kerst 2026",aftellen:"81 dagen tot eerste kerstdag",melding:/^Vanaf zaterdag 19 december verschijnt hier de verwachting voor eerste kerstdag\. De verwachting voor tweede kerstdag volgt op zondag 20 december\.$/,tabellen:0,fetch:0}},
  {naam:"venster",nu:"2026-12-21T09:00:00Z",data:metSneeuw("2026-12-21"),verwacht:{kop:"Witte kerst 2026",aftellen:"4 dagen tot eerste kerstdag",samenvatting:"Volgens de huidige verwachting ligt er op beide kerstdagen sneeuw in De Bilt. Blijft dat zo, dan is het officieel een witte kerst.",tabellen:2,fetch:1,cel:"Sneeuwdek, 4 cm"}},
  {naam:"half",nu:"2026-12-19T09:00:00Z",data:metSneeuw("2026-12-19"),verwacht:{tabellen:1,fetch:1,later:"Tweede kerstdag: de verwachting verschijnt op zondag 20 december."}},
  {naam:"fout",nu:"2026-12-21T09:00:00Z",status:503,verwacht:{tabellen:0,fetch:1,fout:true}},
  {naam:"na-kerst",nu:"2026-12-27T09:00:00Z",verwacht:{kop:"Witte kerst 2027",aftellen:"363 dagen tot eerste kerstdag",tabellen:0,fetch:0}}
];

async function controleer(browserType,label,base){
  const browser=await browserType.launch({headless:true});
  try{
    for(const sc of SCENARIOS)for(const breedte of [390,1366])for(const schema of ["light","dark"]){
      if(schema==="dark"&&sc.naam!=="venster"&&sc.naam!=="ver")continue;
      const context=await browser.newContext({viewport:{width:breedte,height:breedte<700?844:900},colorScheme:schema});
      const page=await context.newPage();
      const fouten=[];let fetches=0;
      page.on("pageerror",e=>fouten.push(e.message));
      page.on("console",m=>{if(m.type()==="error"&&!/Failed to load resource/.test(m.text()))fouten.push(m.text());});
      await page.clock.setFixedTime(new Date(sc.nu));
      await page.route("https://api.open-meteo.com/**",route=>{
        fetches++;
        const url=new URL(route.request().url());
        assert.equal(url.searchParams.get("forecast_days"),"7");
        assert.equal(url.searchParams.get("latitude").split(",").length,kerst.plaatsen.length);
        if(sc.status)return route.fulfill({status:sc.status,body:"{}"});
        return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(sc.data)});
      });
      await page.route(/posthog|googletagmanager|google-analytics|cloudflareinsights/,route=>route.abort());
      await page.goto(base+PAD,{waitUntil:"networkidle"});
      const v=sc.verwacht,id=`${label} ${sc.naam} ${breedte}px ${schema}`;
      await page.waitForFunction(()=>!document.querySelector("#seizoen-verwachting[aria-busy]"));
      const r=await page.evaluate(()=>({
        kop:document.querySelector("h1").textContent.trim(),
        titel:document.title,
        aftellen:(()=>{const e=document.getElementById("seizoen-aftellen");return e&&!e.hidden?e.textContent.trim():"";})(),
        getal:(()=>{const e=document.querySelector("#seizoen-aftellen .aftel-getal");return e?parseFloat(getComputedStyle(e).fontSize):0;})(),
        melding:document.getElementById("seizoen-melding").textContent.trim(),
        samenvatting:(document.querySelector(".seizoen-samenvatting")||{}).textContent||"",
        tabellen:document.querySelectorAll(".seizoen-dag table").length,
        rijen:[...document.querySelectorAll(".seizoen-dag tbody tr")].length,
        cellen:[...document.querySelectorAll(".seizoen-dag td")].map(td=>td.textContent.trim()),
        later:[...document.querySelectorAll(".seizoen-later")].map(p=>p.textContent.trim()),
        fout:!!document.querySelector(".seizoen-fout"),
        breed:document.documentElement.scrollWidth,
        thema:document.documentElement.getAttribute("data-thema"),
        achtergrond:getComputedStyle(document.body).backgroundColor
      }));
      assert.deepEqual(fouten,[],`${id}: geen browserfouten`);
      assert.equal(fetches,v.fetch,`${id}: aantal verwachtingsverzoeken`);
      if(v.kop){assert.equal(r.kop,v.kop,`${id}: kop`);assert(r.titel.startsWith(v.kop+":"),`${id}: titel volgt het jaar (${r.titel})`);}
      if(v.aftellen)assert.equal(r.aftellen,v.aftellen,`${id}: aftelling`);
      if(/^\d/.test(v.aftellen||""))assert.equal(r.getal,76,`${id}: aftelgetal staat niet groot (${r.getal}px)`);
      if(v.melding)assert.match(r.melding,v.melding,`${id}: melding`);
      if(v.samenvatting)assert.equal(r.samenvatting.trim(),v.samenvatting,`${id}: samenvatting`);
      assert.equal(r.tabellen,v.tabellen,`${id}: aantal dagtabellen`);
      if(v.tabellen)assert.equal(r.rijen,v.tabellen*kerst.plaatsen.length,`${id}: één rij per plaats per dag`);
      if(v.cel)assert(r.cellen.includes(v.cel),`${id}: cel ${v.cel} in ${JSON.stringify(r.cellen)}`);
      if(v.later)assert.deepEqual(r.later,[v.later],`${id}: latere dag`);
      assert.equal(r.fout,!!v.fout,`${id}: foutmelding alleen bij een mislukte verwachting`);
      assert(!r.cellen.some(c=>/undefined|NaN|null/.test(c)),`${id}: geen lege waarden`);
      assert(r.breed<=breedte,`${id}: geen horizontale overflow (${r.breed}px)`);
      if(schema==="dark"){assert.equal(r.thema,"donker",`${id}: donker thema`);assert.equal(r.achtergrond,"rgb(10, 10, 10)",`${id}: donkere achtergrond`);}
      if(SCHERMEN&&label==="Chromium"&&(sc.naam==="ver"||sc.naam==="venster")){
        fs.mkdirSync(SCHERMEN,{recursive:true});
        await page.screenshot({path:path.join(SCHERMEN,`witte-kerst-${sc.naam}-${breedte<700?"mobiel":"desktop"}-${schema==="dark"?"donker":"licht"}.png`),fullPage:true});
      }
      await context.close();
    }
  }finally{await browser.close();}
}

/* Engels: alles vertaald, links en plaatsnamen blijven staan. */
const ENGELS=[
  {naam:"ver",nu:"2026-10-05T10:00:00Z",kop:"White Christmas 2026",zinnen:["81 days to go until Christmas Day","The forecast for Christmas Day will appear here from Saturday 19 December.","The Boxing Day forecast follows on Sunday 20 December."]},
  {naam:"venster",nu:"2026-12-21T09:00:00Z",data:metSneeuw("2026-12-21"),kop:"White Christmas 2026",zinnen:["4 days to go until Christmas Day","According to the current forecast, there will be snow on the ground in De Bilt on both Christmas Day and Boxing Day. If that holds, it will officially be a white Christmas.","Snow cover, 4 cm","No snow, 1.6 mm of rain","official measuring site"]},
  {naam:"half",nu:"2026-12-19T09:00:00Z",data:metSneeuw("2026-12-19"),kop:"White Christmas 2026",zinnen:["Boxing Day: the forecast will appear on Sunday 20 December."]}
];
async function engels(browserType,label,base){
  const browser=await browserType.launch({headless:true});
  try{
    for(const sc of ENGELS)for(const breedte of [390,1366]){
      const context=await browser.newContext({viewport:{width:breedte,height:breedte<700?844:900}});
      await context.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1",JSON.stringify("en"));}catch(e){}});
      const page=await context.newPage();
      const fouten=[];page.on("pageerror",e=>fouten.push(e.message));
      await page.clock.setFixedTime(new Date(sc.nu));
      await page.route("https://api.open-meteo.com/**",route=>route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(sc.data||[])}));
      await page.route(/posthog|googletagmanager|google-analytics|cloudflareinsights/,route=>route.abort());
      await page.goto(base+PAD,{waitUntil:"networkidle"});
      const id=`${label} EN ${sc.naam} ${breedte}px`;
      await page.waitForFunction(k=>document.querySelector("h1")&&document.querySelector("h1").textContent.trim()===k,sc.kop,{timeout:10000});
      await page.waitForTimeout(400);
      const r=await page.evaluate(()=>({
        /* Witruimte samengevoegd: het grote aftelgetal staat in een eigen blok. */
        tekst:document.body.innerText.replace(/\s+/g," "),
        titel:document.title,
        ontbreekt:[...(window.__WIW_TAAL_ONTBREEKT__||[])],
        links:[...document.querySelectorAll(".seizoen-dag a")].map(a=>a.getAttribute("href")),
        plaatsen:[...document.querySelectorAll(".seizoen-dag .plaats")].map(e=>e.textContent.trim())
      }));
      assert.deepEqual(fouten,[],`${id}: geen browserfouten`);
      assert.deepEqual(r.ontbreekt,[],`${id}: alles vertaald`);
      assert(r.titel.startsWith(sc.kop+": chance of snow at Christmas"),`${id}: titel (${r.titel})`);
      for(const z of sc.zinnen)assert(r.tekst.includes(z),`${id}: tekst bevat "${z}"`);
      assert(!/kerst|sneeuw|verwachting|Bekijk/i.test(r.tekst),`${id}: geen Nederlandse resten: ${r.tekst}`);
      if(sc.data){
        assert(r.plaatsen.includes("De Bilt")&&r.plaatsen.includes("Utrecht"),`${id}: plaatsnamen blijven staan`);
        assert(r.links.includes("/weer/utrecht/"),`${id}: links naar plaatspagina's blijven werken`);
      }
      if(SCHERMEN&&label==="Chromium"&&sc.naam==="venster"&&breedte===390){
        fs.mkdirSync(SCHERMEN,{recursive:true});
        await page.screenshot({path:path.join(SCHERMEN,"witte-kerst-venster-mobiel-engels.png"),fullPage:true});
      }
      await context.close();
    }
  }finally{await browser.close();}
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    await controleer(chromium,"Chromium",base);
    await controleer(webkit,"WebKit",base);
    await engels(chromium,"Chromium",base);
    await engels(webkit,"WebKit",base);
  }finally{server.close();}
  console.log("Witte kerst: ver voor kerst, volledig en half venster, storing en jaarwissel in Chromium en WebKit, mobiel en desktop, licht en donker; Engels volledig vertaald.");
})().catch(e=>{console.error(e);process.exit(1);});

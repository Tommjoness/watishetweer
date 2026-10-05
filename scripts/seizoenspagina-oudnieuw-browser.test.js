"use strict";

/* Oud en nieuw in de echte, definitieve build: ver voor de jaarwisseling,
   binnen het venster (één tabel voor 22:00–02:00, over de jaargrens), een
   mislukte verwachting, de dag erna (doorschuiven naar volgend jaar) en
   Engels. Mobiel en desktop, licht en donker. Met SEIZOEN_SCREENSHOTS=<map>
   worden ook screenshots bewaard. */

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {SEIZOENSPAGINAS}=require("./seizoenspagina.config.js");

const PUBLIC=path.join(__dirname,"..","public");
const PAD="/oud-en-nieuw/";
if(!fs.existsSync(path.join(PUBLIC,"oud-en-nieuw","index.html")))throw new Error("public/oud-en-nieuw/index.html ontbreekt; draai eerst de build.");
const oud=SEIZOENSPAGINAS.find(p=>p.slug==="oud-en-nieuw");
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

/* Open-Meteo-uurdata: 7 dagen vanaf `start`; per plaats afwijkende uren. */
function antwoord(start,perPlaats){
  const t0=Date.parse(start+"T00:00:00Z");
  return oud.plaatsen.map((p,i)=>{
    const extra=perPlaats(i)||{};
    const h={time:[],temperature_2m:[],precipitation:[],precipitation_probability:[],wind_speed_10m:[],wind_gusts_10m:[],wind_direction_10m:[],visibility:[]};
    for(let d=0;d<7;d++)for(let u=0;u<24;u++){
      const stempel=new Date(t0+d*864e5).toISOString().slice(0,10)+"T"+String(u).padStart(2,"0")+":00";
      const w=extra[stempel]||{};
      h.time.push(stempel);h.temperature_2m.push(w.temp??3.6);h.precipitation.push(w.nat??0);h.precipitation_probability.push(w.kans??10);
      h.wind_speed_10m.push(w.wind??14);h.wind_gusts_10m.push(w.stoot??31);h.wind_direction_10m.push(w.dir??225);h.visibility.push(w.zicht??24000);
    }
    return {latitude:p.lat,longitude:p.lon,timezone:"Europe/Amsterdam",utc_offset_seconds:3600,hourly:h};
  });
}
/* Rotterdam (1) en Den Haag (2): regen en harde stoten; Utrecht (3): mist. */
const gemengd=start=>antwoord(start,i=>i===1||i===2?{
  "2026-12-31T23:00":{nat:0.7,kans:65,stoot:58},"2027-01-01T00:00":{nat:0.4,kans:55,stoot:61,dir:250}
}:i===3?{"2027-01-01T00:00":{zicht:400},"2027-01-01T01:00":{zicht:300}}:null);

const SCENARIOS=[
  {naam:"ver",nu:"2026-10-05T10:00:00Z",verwacht:{kop:"Oud en nieuw 2026",aftellen:"Nog 87 dagen tot oudejaarsdag.",melding:/verschijnt hier op zaterdag 26 december/,tabellen:0,fetch:0}},
  {naam:"voor-venster",nu:"2026-12-25T10:00:00Z",verwacht:{aftellen:"Nog 6 dagen tot oudejaarsdag.",tabellen:0,fetch:0}},
  {naam:"venster",nu:"2026-12-28T09:00:00Z",data:gemengd("2026-12-28"),verwacht:{kop:"Oud en nieuw 2026",aftellen:"Nog 3 dagen tot oudejaarsdag.",tabellen:1,fetch:1,
    samenvatting:["Rond middernacht valt er volgens de huidige verwachting neerslag in Rotterdam en Den Haag.","Windstoten van 50 km/u of meer in Rotterdam en Den Haag.","Kans op mist (zicht onder 1 km) in Utrecht."],
    cellen:["1,1 mm · kans 65%","W 14 km/u · stoten 61","Droog · kans 10%","ZW 14 km/u · stoten 31","4°"],kop3:"Rond middernacht 31 december 22:00 – 1 januari 02:00"}},
  {naam:"rustig",nu:"2026-12-31T09:00:00Z",data:antwoord("2026-12-31",()=>null),verwacht:{aftellen:"Vandaag is het oudejaarsdag.",tabellen:1,fetch:1,samenvatting:["Rond middernacht blijft het volgens de huidige verwachting overal droog."]}},
  {naam:"fout",nu:"2026-12-28T09:00:00Z",status:503,verwacht:{tabellen:0,fetch:1,fout:true}},
  {naam:"na",nu:"2027-01-01T10:00:00Z",verwacht:{kop:"Oud en nieuw 2027",aftellen:"Nog 364 dagen tot oudejaarsdag.",tabellen:0,fetch:0}}
];

async function open(browser,base,sc,breedte,schema,taal){
  const context=await browser.newContext({viewport:{width:breedte,height:breedte<700?844:900},colorScheme:schema});
  if(taal)await context.addInitScript(t=>{try{localStorage.setItem("weerbriefing.taal.v1",JSON.stringify(t));}catch(e){}},taal);
  const page=await context.newPage();
  const fouten=[];let fetches=0;
  page.on("pageerror",e=>fouten.push(e.message));
  page.on("console",m=>{if(m.type()==="error"&&!/Failed to load resource/.test(m.text()))fouten.push(m.text());});
  await page.clock.setFixedTime(new Date(sc.nu));
  await page.route("https://api.open-meteo.com/**",route=>{
    fetches++;
    const url=new URL(route.request().url());
    assert.equal(url.searchParams.get("forecast_days"),"7");
    assert.equal(url.searchParams.get("latitude").split(",").length,oud.plaatsen.length);
    assert(url.searchParams.get("hourly").includes("visibility")&&!url.searchParams.has("daily"));
    if(sc.status)return route.fulfill({status:sc.status,body:"{}"});
    return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(sc.data)});
  });
  await page.route(/posthog|googletagmanager|google-analytics|cloudflareinsights/,route=>route.abort());
  await page.goto(base+PAD,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>!document.querySelector("#seizoen-verwachting[aria-busy]"));
  return {context,page,fouten,fetches:()=>fetches};
}
const meet=()=>({
  kop:document.querySelector("h1").textContent.trim(),
  titel:document.title,
  aftellen:(()=>{const e=document.getElementById("seizoen-aftellen");return e&&!e.hidden?e.textContent.trim():"";})(),
  melding:document.getElementById("seizoen-melding").textContent.trim(),
  samenvatting:[...document.querySelectorAll(".seizoen-samenvatting")].map(p=>p.textContent.trim()),
  kop3:(document.querySelector(".seizoen-dag h3")||{}).textContent||"",
  tabellen:document.querySelectorAll(".seizoen-dag table").length,
  rijen:document.querySelectorAll(".seizoen-dag tbody tr").length,
  cellen:[...document.querySelectorAll(".seizoen-dag td")].map(td=>td.textContent.trim()),
  plaatsen:[...document.querySelectorAll(".seizoen-dag .plaats")].map(e=>e.textContent.trim()),
  links:[...document.querySelectorAll(".seizoen-dag a")].map(a=>a.getAttribute("href")),
  fout:!!document.querySelector(".seizoen-fout"),
  tekst:document.body.innerText,
  ontbreekt:[...(window.__WIW_TAAL_ONTBREEKT__||[])],
  breed:document.documentElement.scrollWidth,
  thema:document.documentElement.getAttribute("data-thema"),
  achtergrond:getComputedStyle(document.body).backgroundColor
});

async function controleer(browserType,label,base){
  const browser=await browserType.launch({headless:true});
  try{
    for(const sc of SCENARIOS)for(const breedte of [390,1366])for(const schema of ["light","dark"]){
      if(schema==="dark"&&sc.naam!=="venster"&&sc.naam!=="ver")continue;
      const {context,page,fouten,fetches}=await open(browser,base,sc,breedte,schema,null);
      const v=sc.verwacht,id=`${label} ${sc.naam} ${breedte}px ${schema}`;
      const r=await page.evaluate(meet);
      assert.deepEqual(fouten,[],`${id}: geen browserfouten`);
      assert.equal(fetches(),v.fetch,`${id}: aantal verwachtingsverzoeken`);
      if(v.kop){assert.equal(r.kop,v.kop,`${id}: kop`);assert(r.titel.startsWith("Weer "+v.kop.toLowerCase()+":"),`${id}: titel (${r.titel})`);}
      if(v.aftellen)assert.equal(r.aftellen,v.aftellen,`${id}: aftelling`);
      if(v.melding)assert.match(r.melding,v.melding,`${id}: melding`);
      if(v.samenvatting)assert.deepEqual(r.samenvatting,v.samenvatting,`${id}: samenvatting`);
      if(v.kop3)assert.equal(r.kop3.replace(/\s+/g," ").trim(),v.kop3,`${id}: tabelkop`);
      assert.equal(r.tabellen,v.tabellen,`${id}: aantal tabellen`);
      if(v.tabellen){
        assert.equal(r.rijen,oud.plaatsen.length,`${id}: één rij per plaats`);
        assert.deepEqual(r.plaatsen,oud.plaatsen.map(p=>p.naam),`${id}: plaatsen in vaste volgorde`);
        assert(r.links.includes("/weer/den-haag/"),`${id}: plaatsen linken naar hun weerpagina`);
      }
      for(const c of v.cellen||[])assert(r.cellen.includes(c),`${id}: cel "${c}" in ${JSON.stringify(r.cellen)}`);
      assert.equal(r.fout,!!v.fout,`${id}: foutmelding alleen bij een mislukte verwachting`);
      assert(!r.cellen.some(c=>/undefined|NaN|null/.test(c)),`${id}: geen lege waarden`);
      assert(r.breed<=breedte,`${id}: geen horizontale overflow (${r.breed}px)`);
      if(schema==="dark"){assert.equal(r.thema,"donker",`${id}: donker thema`);assert.equal(r.achtergrond,"rgb(10, 10, 10)",`${id}: donkere achtergrond`);}
      if(SCHERMEN&&label==="Chromium"&&(sc.naam==="ver"||sc.naam==="venster")){
        fs.mkdirSync(SCHERMEN,{recursive:true});
        await page.screenshot({path:path.join(SCHERMEN,`oud-en-nieuw-${sc.naam}-${breedte<700?"mobiel":"desktop"}-${schema==="dark"?"donker":"licht"}.png`),fullPage:true});
      }
      await context.close();
    }
    /* Engels: volledig vertaald, plaatsnamen en links blijven staan. */
    for(const [naam,zinnen] of [
      ["ver",["87 days to go until New Year's Eve.","The forecast for New Year's Eve night will appear here on Saturday 26 December, once it falls within the 7-day forecast."]],
      ["venster",["3 days to go until New Year's Eve.","According to the current forecast, there will be precipitation around midnight in Rotterdam and Den Haag.","Gusts of 50 km/h or more in Rotterdam and Den Haag.","Chance of fog (visibility below 1 km) in Utrecht.","1.1 mm · chance 65%","W 14 km/h · gusts 61","Around midnight 31 December 22:00 – 1 January 02:00"]]
    ])for(const breedte of [390,1366]){
      const sc=SCENARIOS.find(s=>s.naam===naam);
      const {context,page,fouten}=await open(browser,base,sc,breedte,"light","en");
      await page.waitForFunction(()=>document.querySelector("h1").textContent.trim()==="New Year's Eve 2026",null,{timeout:10000});
      await page.waitForTimeout(400);
      const r=await page.evaluate(meet),id=`${label} EN ${naam} ${breedte}px`;
      assert.deepEqual(fouten,[],`${id}: geen browserfouten`);
      assert.deepEqual(r.ontbreekt,[],`${id}: alles vertaald`);
      assert(r.titel.startsWith("New Year's Eve weather 2026: precipitation, wind and fog around midnight"),`${id}: titel (${r.titel})`);
      for(const z of zinnen)assert(r.tekst.includes(z)||r.cellen.includes(z),`${id}: tekst bevat "${z}"`);
      assert(!/oudejaars|middernacht|verwachting|neerslag|Bekijk|stoten|Droog/i.test(r.tekst),`${id}: geen Nederlandse resten: ${r.tekst}`);
      if(naam==="venster"){
        assert(r.plaatsen.includes("Den Haag"),`${id}: plaatsnamen blijven staan`);
        assert(r.links.includes("/weer/den-haag/"),`${id}: links blijven werken`);
      }
      if(SCHERMEN&&label==="Chromium"&&naam==="venster"&&breedte===390){
        fs.mkdirSync(SCHERMEN,{recursive:true});
        await page.screenshot({path:path.join(SCHERMEN,"oud-en-nieuw-venster-mobiel-engels.png"),fullPage:true});
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
  }finally{server.close();}
  console.log("Oud en nieuw: ver, vlak voor het venster, venster over de jaargrens (neerslag, stoten, mist), rustige nacht, storing en doorschuiven in Chromium en WebKit, mobiel en desktop, licht en donker; Engels volledig vertaald.");
})().catch(e=>{console.error(e);process.exit(1);});

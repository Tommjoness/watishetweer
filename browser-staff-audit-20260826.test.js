"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const locaties={
  Kaapstad:{lat:-33.9249,lon:18.4241,land:"ZA",tz:"Africa/Johannesburg",offset:7200,temp:18},
  Amsterdam:{lat:52.3676,lon:4.9041,land:"NL",tz:"Europe/Amsterdam",offset:7200,temp:21},
  "New York":{lat:40.7128,lon:-74.0060,land:"US",tz:"America/New_York",offset:-14400,temp:27}
};
function forecast(loc){
  const d=bouw({tempNu:loc.temp,wcNu:1,ccNu:25,pp:()=>22,som:3.2});
  d.latitude=loc.lat;d.longitude=loc.lon;d.timezone=loc.tz;d.utc_offset_seconds=loc.offset;
  d.current.temperature_2m=loc.temp;d.current.apparent_temperature=loc.temp;d.current.weather_code=1;d.current.is_day=1;d.current.precipitation=0;
  d.daily.sunshine_duration=d.daily.time.map(()=>7*3600);
  return d;
}
const forecasts=Object.fromEntries(Object.entries(locaties).map(([naam,loc])=>[naam,forecast(loc)]));
const air={current:{european_aqi:24,us_aqi:40},hourly:{time:[forecasts.Amsterdam.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
let html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
const basis=forecasts.Amsterdam;
const fixedNow=Date.parse(basis.current.time+"Z")-(Number(basis.utc_offset_seconds)||0)*1000+15*60000;
const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
Date.now=()=>${fixedNow};
const STAFF_LOCATIES=${JSON.stringify(locaties)};
const STAFF_FORECASTS=${JSON.stringify(forecasts)};
const STAFF_AIR=${JSON.stringify(air)};
function staffAntwoord(payload){return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};}
window.fetch=async function(url){
  const u=String(url);
  if(u.includes('geocoding-api.open-meteo.com/v1/search?')){
    const q=(new URL(u)).searchParams.get('name')||'';
    const item=Object.entries(STAFF_LOCATIES).find(([naam])=>naam.toLowerCase()===q.trim().toLowerCase());
    if(!item)return staffAntwoord({results:[]});
    const [naam,loc]=item;
    return staffAntwoord({results:[{name:naam,latitude:loc.lat,longitude:loc.lon,admin1:'Testregio',country_code:loc.land}]});
  }
  if(u.includes('/api/waarschuwingen')){
    const params=new URL(u,location.origin).searchParams,land=(params.get('land')||'').toUpperCase();
    return staffAntwoord(land==='US'
      ?{bron:'National Weather Service',dekking:true,land:'US',lijst:[{titel:'Flood Watch',tekst:'Heavy rain may cause flooding.',niveau:'geel',plaatsSpecifiek:true,van:null,tot:null}]}
      :{bron:'test',dekking:true,land:land||null,lijst:[]});
  }
  if(u.includes('/api/neerslag'))return staffAntwoord({beschikbaar:false,provider:'knmi',reden:'niet beschikbaar'});
  if(u.includes('/api/plaatsnaam'))return staffAntwoord({naam:null,land:null,bron:'test'});
  if(u.includes('air-quality-api.open-meteo.com'))return staffAntwoord(STAFF_AIR);
  if(u.includes('api.open-meteo.com/v1/forecast')){
    const p=new URL(u).searchParams,lat=Number(p.get('latitude'));
    const item=Object.entries(STAFF_LOCATIES).find(([,loc])=>Math.abs(loc.lat-lat)<0.01);
    return staffAntwoord(item?STAFF_FORECASTS[item[0]]:STAFF_FORECASTS.Amsterdam);
  }
  return staffAntwoord({});
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const server=http.createServer((req,res)=>{
  const pathname=(req.url||"").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;
  }
  const rel=pathname.startsWith("/")?pathname.slice(1):pathname,file=path.join(__dirname,"public",rel);
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const ext=path.extname(file).toLowerCase(),types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(file).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

async function wachtPlaats(page,naam){
  await page.waitForFunction(n=>document.getElementById("place")?.getAttribute("aria-label")===n,naam,{timeout:10000});
  await page.waitForSelector("#app",{state:"visible",timeout:10000});
}
async function kies(page,naam){
  await page.locator("#q").fill(naam);
  await page.waitForSelector("#res.on div[data-lat]",{timeout:5000});
  await page.locator("#res div[data-lat]").filter({hasText:naam}).first().click();
  await wachtPlaats(page,naam);
}
function urlVoor(naam){
  const loc=locaties[naam],p=new URLSearchParams({lat:String(loc.lat),lon:String(loc.lon),plaats:naam,land:loc.land});
  return p.toString();
}

async function controleer(browserType,naam){
  const browser=await browserType.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},locale:"nl-NL",serviceWorkers:"block"});
    const page=await context.newPage(),fouten=[];
    page.on("pageerror",e=>fouten.push(String(e)));
    page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});

    await page.goto(`http://127.0.0.1:${server.address().port}/?${urlVoor("Kaapstad")}`,{waitUntil:"networkidle"});
    await wachtPlaats(page,"Kaapstad");
    await page.evaluate(()=>document.fonts&&document.fonts.ready);

    const init=await page.evaluate(()=>({
      uur:[...document.querySelectorAll("#chart text")].filter(el=>/^\d{2}$/.test((el.textContent||"").trim())).length,
      tabel:document.querySelectorAll("#chartdata tbody tr").length,
      main:document.querySelectorAll("main#app").length,
      skip:!!document.querySelector('.skiplink[href="#app"]')
    }));
    assert(init.uur>0,`${naam}: uurlabels ontbreken op eerste render`);
    assert(init.tabel>0,`${naam}: alternatieve grafiektabel is leeg`);
    assert.equal(init.main,1,`${naam}: exact één main-landmark`);
    assert(init.skip,`${naam}: skiplink ontbreekt`);

    const samenvatting=page.locator("#chartdata > summary");
    await samenvatting.focus();
    await page.keyboard.press("Enter");
    assert(await page.locator("#chartdata").evaluate(el=>el.open),`${naam}: grafiektabel opent niet via toetsenbord`);
    const focusStyle=await samenvatting.evaluate(el=>getComputedStyle(el).outlineStyle);
    assert.notEqual(focusStyle,"none",`${naam}: grafiektabel-summary heeft geen zichtbare focus`);

    await kies(page,"Amsterdam");
    await kies(page,"New York");
    assert((await page.evaluate(()=>history.length))>=3,`${naam}: expliciete locatiekeuzes maken geen history entries`);
    const warning=await page.evaluate(()=>({
      titel:document.querySelector("#waarschuwingen .waarsch h3")?.textContent||"",
      officieel:document.querySelector("#waarschuwingen .waarsch-officieel-details")?.textContent||"",
      briefing:document.getElementById("brief")?.textContent||""
    }));
    assert.equal(warning.titel,"Waakzaamheid voor overstromingen",`${naam}: bekende NWS-titel niet gecontroleerd vertaald`);
    assert(/Flood Watch/.test(warning.officieel)&&/National Weather Service/.test(warning.officieel),`${naam}: officiële titel/bron niet behouden`);
    assert(/Waakzaamheid voor overstromingen/.test(warning.briefing)&&!/Flood Watch/.test(warning.briefing),`${naam}: briefing gebruikt niet dezelfde Nederlandse waarschuwingstitel (${warning.briefing})`);

    await page.goBack({waitUntil:"domcontentloaded"});await wachtPlaats(page,"Amsterdam");
    assert(/plaats=Amsterdam/.test(page.url()),`${naam}: Back herstelt Amsterdam-URL niet (${page.url()})`);
    await page.goBack({waitUntil:"domcontentloaded"});await wachtPlaats(page,"Kaapstad");
    assert(/plaats=Kaapstad/.test(page.url()),`${naam}: tweede Back herstelt Kaapstad niet (${page.url()})`);
    await page.goForward({waitUntil:"domcontentloaded"});await wachtPlaats(page,"Amsterdam");
    await page.goForward({waitUntil:"domcontentloaded"});await wachtPlaats(page,"New York");
    assert(/plaats=New\+York|plaats=New%20York/.test(page.url()),`${naam}: Forward herstelt New York-URL niet (${page.url()})`);
    await page.reload({waitUntil:"networkidle"});await wachtPlaats(page,"New York");
    assert.equal(await page.title(),"New York · watishetweer.nl",`${naam}: refresh houdt locatie/titel niet synchroon`);

    const add=page.locator("#chipadd");if(await add.count())await add.click();
    assert.equal(await page.locator(".chip .x").count(),1,`${naam}: bewaarde locatie heeft geen verwijderknop`);
    for(const width of [320,360,375,390,430]){
      await page.setViewportSize({width,height:844});await page.waitForTimeout(40);
      const box=await page.locator(".chip .x").boundingBox();
      assert(box&&box.width>=39.5&&box.height>=39.5,`${naam}/${width}px: verwijdertarget ${box&&box.width}x${box&&box.height}`);
    }

    await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(100);
    const breed=await page.evaluate(()=>({
      uur:[...document.querySelectorAll("#chart text")].filter(el=>/^\d{2}$/.test((el.textContent||"").trim())).length,
      tabel:document.querySelectorAll("#chartdata tbody tr").length,
      overflow:document.documentElement.scrollWidth-window.innerWidth
    }));
    assert(breed.uur>0&&breed.tabel>0,`${naam}: resize verloor grafieklabels of tabeldata`);
    assert(breed.overflow<=2,`${naam}: desktop-resize geeft ${breed.overflow}px pagina-overflow`);
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
    assert((await page.locator("#chartdata tbody tr").count())>0,`${naam}: terugresizen verloor grafiekdata`);

    /* Bewaar bewust een geldige laatst-gebruikte plaats en open daarna een
       beschadigde deep link. Oude data mag niet onder die kapotte URL blijven. */
    const invalid=await context.newPage();
    await invalid.goto(`http://127.0.0.1:${server.address().port}/?lat=52abc&lon=5&plaats=KapotteLink`,{waitUntil:"domcontentloaded"});
    await invalid.waitForFunction(()=>/ongeldig/i.test(document.getElementById("state")?.textContent||""),null,{timeout:5000});
    const fout=await invalid.evaluate(()=>({
      state:(document.getElementById("state")?.textContent||"").trim(),
      app:getComputedStyle(document.getElementById("app")).display,
      plaats:document.getElementById("place")?.getAttribute("aria-label")||""
    }));
    assert(/gedeelde locatie is ongeldig|locatie-URL is ongeldig/i.test(fout.state),`${naam}: kapotte deep link mist foutmelding (${fout.state})`);
    assert.equal(fout.app,"none",`${naam}: oude weerdata blijft zichtbaar bij kapotte deep link`);
    assert.notEqual(fout.plaats,"New York",`${naam}: oude plaatsidentiteit verschijnt onder kapotte deep link`);
    await invalid.close();

    assert.deepEqual(fouten,[],`${naam}: browser/runtimefouten: ${fouten.join(" | ")}`);
    await context.close();
  }finally{await browser.close();}
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    await controleer(chromium,"Chromium");
    await controleer(webkit,"WebKit");
    console.log("Staff-audit browser groen: eerste grafiekrender, toetsenbordtabel, NWS-mapping, 3 locaties met Back/Forward/refresh, invalid deep link, resize en 320/360/375/390/430px touch targets in Chromium/WebKit.");
  }finally{server.close();}
})().catch(err=>{console.error(err);process.exit(1);});

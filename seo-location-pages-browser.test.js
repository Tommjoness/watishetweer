"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const PUBLIC=path.join(__dirname,"public");
const routePad=path.join(PUBLIC,"weer","almere","index.html");
const hubPad=path.join(PUBLIC,"weer","index.html");
if(!fs.existsSync(routePad)||!fs.existsSync(hubPad))throw new Error("SEO-plaatsartifacts ontbreken; voer eerst postbuild uit.");

const d=bouw();
d.latitude=52.3508;d.longitude=5.2647;d.timezone="Europe/Amsterdam";d.utc_offset_seconds=7200;
d.minutely_15=d.minutely_15||{time:[],precipitation:[]};
for(const sleutel of ["rain","showers","snowfall","weather_code"]){if(!Array.isArray(d.minutely_15[sleutel]))d.minutely_15[sleutel]=d.minutely_15.time.map(()=>0);}
const air={current:{european_aqi:22,us_aqi:45},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const stub=`<script>
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[]})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Almere",land:"NL",bron:"test"})}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;

function htmlMetStub(){return fs.readFileSync(routePad,"utf8").replace("</head>",stub+"</head>");}
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript",".json":"application/json",".woff2":"font/woff2",".png":"image/png",".svg":"image/svg+xml"};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url||"/","http://127.0.0.1");
  if(url.pathname==="/weer/almere/"||url.pathname==="/weer/almere/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(htmlMetStub());return;
  }
  if(url.pathname==="/weer/"||url.pathname==="/weer/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});fs.createReadStream(hubPad).pipe(res);return;
  }
  let rel=url.pathname.replace(/^\//,"");if(!rel)rel="index.html";
  const f=path.resolve(PUBLIC,rel);
  if(f.startsWith(PUBLIC+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()){
    res.writeHead(200,{"content-type":mime[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);return;
  }
  res.writeHead(404,{"content-type":"text/plain"});res.end("not found");
});

async function controleer(type,naam){
  const browser=await type.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const pageErrors=[],eigen404=[];
  page.on("pageerror",e=>pageErrors.push(String(e)));
  page.on("response",r=>{try{if(new URL(r.url()).origin===`http://127.0.0.1:${server.address().port}`&&r.status()>=400)eigen404.push(`${r.status()} ${new URL(r.url()).pathname}`);}catch(e){}});
  try{
    const basis=`http://127.0.0.1:${server.address().port}`;
    await page.goto(basis+"/weer/almere/",{waitUntil:"networkidle"});
    await page.waitForFunction(()=>document.querySelectorAll("#days .row.day").length>=5,{timeout:15000});
    const staat=await page.evaluate(()=>({
      place:(document.getElementById("place")?.textContent||"").trim(),
      pathname:location.pathname,
      search:location.search,
      canonical:document.querySelector('link[rel="canonical"]')?.href||"",
      base:document.baseURI,
      title:document.title,
      context:(document.querySelector(".seo-route-context")?.textContent||"").replace(/\s+/g," ").trim(),
      days:document.querySelectorAll("#days .row.day").length,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
    }));
    assert(/Almere/i.test(staat.place),`${naam}: route start niet in Almere: ${staat.place}`);
    assert.equal(staat.pathname,"/weer/almere/",`${naam}: plaatsroute verandert onverwacht van pad`);
    assert.equal(staat.search,"",`${naam}: plaatsroute lekt terug naar query-URL`);
    assert.equal(staat.canonical,"https://watishetweer.nl/weer/almere/",`${naam}: canonical wijkt af`);
    assert.equal(staat.base,basis+"/",`${naam}: baseURI staat niet op root; subpad-assets zijn dan onveilig`);
    assert.equal(staat.title,"Weer Almere vandaag | Wat is het weer?",`${naam}: unieke titel ontbreekt`);
    assert(staat.context.includes("Weer in Almere")&&staat.context.includes("Flevoland"),`${naam}: zichtbare prerendercontext ontbreekt`);
    assert(staat.days>=5,`${naam}: bestaande WeatherNow-runtime rendert geen weekdata`);
    assert.equal(staat.overflow,false,`${naam}: 390px route introduceert horizontale overflow`);
    assert.deepEqual(pageErrors,[],`${naam}: pageerrors op plaatsroute`);
    assert.deepEqual(eigen404,[],`${naam}: subpad-assets/API's geven 404: ${eigen404.join(", ")}`);

    if(await page.evaluate(()=>"serviceWorker" in navigator)){
      await page.waitForTimeout(500);
      const regs=await page.evaluate(async()=>{const rs=await navigator.serviceWorker.getRegistrations();return rs.map(r=>({scope:r.scope,script:r.active?.scriptURL||r.installing?.scriptURL||r.waiting?.scriptURL||""}));});
      assert(regs.some(r=>r.scope===basis+"/"&&/\/sw\.js$/.test(r.script)),`${naam}: plaatsroute registreert serviceworker niet op rootscope: ${JSON.stringify(regs)}`);
    }

    await page.goto(basis+"/weer/",{waitUntil:"domcontentloaded"});
    const hub=await page.evaluate(()=>({title:document.title,canonical:document.querySelector('link[rel="canonical"]')?.href||"",links:[...document.querySelectorAll('.plaatsen a')].map(a=>a.getAttribute('href'))}));
    assert.equal(hub.title,"Weer per plaats in Nederland | Wat is het weer?",`${naam}: /weer/ title wijkt af`);
    assert.equal(hub.canonical,"https://watishetweer.nl/weer/",`${naam}: /weer/ canonical wijkt af`);
    assert(hub.links.length>=30&&hub.links.includes("/weer/almere/")&&hub.links.includes("/weer/amsterdam/"),`${naam}: /weer/ mist crawlbare plaatslinks`);
  }finally{await context.close().catch(()=>{});await browser.close().catch(()=>{});}
}

server.listen(0,"127.0.0.1",async()=>{
  try{
    await controleer(chromium,"Chromium");
    await controleer(webkit,"WebKit");
    console.log("SEO-plaatsbrowser: Chromium + WebKit, Almere-route, root-assets, runtime, SW-scope, mobiel en /weer/-hub geslaagd.");
  }catch(e){console.error(e&&e.stack||e);process.exitCode=1;}
  finally{server.close();}
});

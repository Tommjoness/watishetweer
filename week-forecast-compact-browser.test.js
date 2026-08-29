"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("./data.js");

const d=bouw({pp:()=>4,pr:()=>0,som:0,wc:()=>1,wcNu:1});
d.current.time="2026-07-22T14:00";
d.current.weather_code=1;
d.current.precipitation=0;
d.timezone="Europe/Amsterdam";
d.utc_offset_seconds=7200;
d.daily.precipitation_probability_max=d.daily.time.map(()=>4);
d.daily.precipitation_sum=d.daily.time.map(()=>0);
d.hourly.precipitation_probability=d.hourly.time.map(()=>4);
d.hourly.precipitation=d.hourly.time.map(()=>0);

const air={current:{european_aqi:30,us_aqi:35},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const fixedNow=Date.UTC(2026,6,22,12,0);
let html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
const stub=`<script>
Date.now=()=>${fixedNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Almere",latitude:52.35,longitude:5.26,admin1:"Flevoland",country_code:"NL"}]})}
    :u.includes('bigdatacloud.net')||u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Almere",city:"Almere",locality:"Almere",countryCode:"NL",land:"NL",bron:"test"})}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload),headers:new Headers()};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const server=http.createServer((req,res)=>{
  const pathname=(req.url||"").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;
  }
  const rel=pathname.replace(/^\//,"");
  const file=path.join(__dirname,"public",rel);
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const ext=path.extname(file).toLowerCase();
    const types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".svg":"image/svg+xml"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(file).pipe(res);return;
  }
  res.writeHead(404);res.end("not found");
});

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const port=server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    for(const viewport of [{naam:"desktop",width:1440,height:1000},{naam:"mobiel",width:390,height:844}]){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},serviceWorkers:"block",locale:"nl-NL"});
      const page=await context.newPage();
      const errors=[];page.on("pageerror",e=>errors.push(String(e)));
      const params=new URLSearchParams({lat:"52.35",lon:"5.26",plaats:"Almere",land:"NL"});
      const response=await page.goto(`http://127.0.0.1:${port}/?${params}`,{waitUntil:"domcontentloaded",timeout:20000});
      assert(response&&response.ok(),viewport.naam+": pagina laadt niet");
      await page.waitForFunction(()=>document.querySelectorAll("#days .row.day:not(.kop)").length===7,null,{timeout:15000});
      const uit=await page.evaluate(()=>({
        marker:typeof WeatherNowWeekForecastCompact20260829!=="undefined",
        notities:document.querySelectorAll("#days .dag-neerslagnotitie").length,
        uitleg:!!document.getElementById("dagenneerslaguitleg"),
        beschreven:[...document.querySelectorAll("#days .row.day:not(.kop)")].filter(r=>r.hasAttribute("aria-describedby")).length,
        tekst:(document.getElementById("days")?.innerText||"").replace(/\s+/g," "),
        drains:[...document.querySelectorAll("#days .row.day:not(.kop) .drain")].map(el=>(el.innerText||"").replace(/\s+/g," ").trim())
      }));
      assert(uit.marker,viewport.naam+": compacte weekowner ontbreekt");
      assert.equal(uit.notities,0,viewport.naam+": lange dagnotities staan nog in de DOM");
      assert.equal(uit.uitleg,false,viewport.naam+": losse weekuitleg staat nog in de DOM");
      assert.equal(uit.beschreven,0,viewport.naam+": verwijderde notities blijven via aria-describedby gekoppeld");
      for(const verboden of ["hoogste neerslagkans in één uur","berekende dagsom","verschillende modelwaarden","één op één samen te vallen"]){
        assert(!uit.tekst.toLowerCase().includes(verboden),viewport.naam+": lange uitleg blijft zichtbaar: "+verboden);
      }
      assert(uit.drains.some(t=>/4%/.test(t)&&/0,0 mm/.test(t)),viewport.naam+": kans en 0,0 mm moeten compact in de Neerslag-kolom blijven");
      assert.deepEqual(errors,[],viewport.naam+": browserfouten: "+errors.join(" | "));
      await context.close();
    }
    console.log("Compacte weekverwachting browser: desktop en mobiel zonder lange neerslagnotities, kans en mm behouden.");
  }finally{
    await browser.close();server.close();
  }
})().catch(e=>{console.error(e&&e.stack||e);server.close();process.exit(1);});

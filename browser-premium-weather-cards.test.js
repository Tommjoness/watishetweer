"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const d=bouw({temp:()=>18,tempNu:18,pp:()=>5,pr:()=>0,som:0,ws:9,wsNu:9,cc:()=>85,ccNu:85,wg:()=>12,wc:()=>3,wcNu:3});
d.current.time="2026-07-22T20:10";
d.current.temperature_2m=18;
d.current.apparent_temperature=18;
d.current.relative_humidity_2m=86;
d.current.wind_speed_10m=9;
d.current.wind_direction_10m=157.5;
d.current.wind_gusts_10m=99; // bewust afwijkend: deze actuele 15-minutenwaarde mag de uurtegel niet voeden
const i=d.hourly.time.findIndex(t=>t==="2026-07-22T20:00");
assert(i>=0&&i+1<d.hourly.time.length,"fixture mist 20:00/21:00 uurpunten");
d.hourly.wind_gusts_10m[i]=11;
d.hourly.wind_gusts_10m[i+1]=14.4; // 21:00 beschrijft volgens providercontract het voorafgaande uur 20:00–21:00

const air={current:{european_aqi:25,us_aqi:35},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
let html=fs.readFileSync(path.join(__dirname,"public/index.html"),"utf8");
const fixedNow=Date.UTC(2026,6,22,18,10); // 20:10 CEST
const stub=`<script>
Date.now=()=>${fixedNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Almere",land:"NL",bron:"test"})}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const server=http.createServer((req,res)=>{
  const pathname=(req.url||"").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;
  }
  const rel=pathname.startsWith("/")?pathname.slice(1):pathname,file=path.join(__dirname,"public",rel);
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const ext=path.extname(file).toLowerCase(),types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(file).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

async function controleer(browserType,naam,viewport){
  const browser=await browserType.launch({headless:true});
  try{
    const context=await browser.newContext({viewport});
    const page=await context.newPage(),fouten=[];
    page.on("pageerror",e=>fouten.push(String(e)));
    page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
    await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Almere&land=NL`,{waitUntil:"networkidle"});
    await page.waitForSelector("#app",{state:"visible"});
    await page.evaluate(()=>document.fonts&&document.fonts.ready);
    await page.waitForTimeout(250);
    const r=await page.evaluate(()=>{
      const gust=document.getElementById("gust"),hum=document.getElementById("hum");
      return {
        gustKop:gust?.closest(".stat")?.querySelector(".eyebrow")?.textContent.trim()||"",
        gustWaarde:(gust?.textContent||"").replace(/\s+/g," ").trim(),
        gustSub:(document.getElementById("gustsub")?.textContent||"").replace(/\s+/g," ").trim(),
        humWaarde:(hum?.textContent||"").replace(/\s+/g," ").trim(),
        humSub:(document.getElementById("humsub")?.textContent||"").replace(/\s+/g," ").trim(),
        overflow:document.documentElement.scrollWidth-window.innerWidth
      };
    });
    assert.deepEqual(fouten,[],`${naam}: geen runtimefouten`);
    assert.equal(r.gustKop,"Windstoot dit uur",`${naam}: windstootkop heeft één duidelijke tijdscope`);
    assert(/14\s*km\/u/i.test(r.gustWaarde),`${naam}: uurforecast gebruikt 14 km/u en niet actuele 99 km/u (${r.gustWaarde})`);
    assert(!/99/.test(r.gustWaarde),`${naam}: actuele 15-minutenwindstoot lekt niet in uurforecast`);
    assert.equal(r.gustSub,"Verwacht maximum voor 20:00–21:00.",`${naam}: windstootsubtekst hoort bij exact dezelfde forecastwaarde`);
    assert(/86\s*%/.test(r.humWaarde),`${naam}: relatieve luchtvochtigheid blijft zichtbaar (${r.humWaarde})`);
    assert.equal(r.humSub,"Dauwpunt circa 16 °C · kan wat klam aanvoelen.",`${naam}: vochtigheid krijgt praktische dauwpuntduiding`);
    assert(r.overflow<=2,`${naam}: premium copy veroorzaakt geen horizontale overflow (${r.overflow}px)`);
    await context.close();
  }finally{await browser.close();}
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    await controleer(chromium,"Chromium desktop",{width:1280,height:900});
    await controleer(webkit,"WebKit mobiel",{width:390,height:844});
    console.log("Premium weerkaarten groen: windstootforecast en vochtigheidsduiding kloppen op desktop en mobiel.");
  }finally{server.close();}
})().catch(err=>{console.error(err);process.exit(1);});

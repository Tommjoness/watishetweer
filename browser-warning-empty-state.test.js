"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

/* Fysieke iPhone-regressie: tijdens een nog lopende officiële bronaanvraag mag
   het waarschuwingengebied niet stilletjes leeg zijn. Zodra een succesvolle,
   officiële Nederlandse feed leeg terugkomt moet de eindstate expliciet zeggen
   dat er voor deze locatie geen officiële waarschuwingen zijn. */
const d=bouw({temp:22,tempNu:22,pp:5,pr:0,som:0,ws:10,wsNu:10,cc:40,ccNu:40,wg:20,wc:2,wcNu:2});
d.current.time="2026-08-16T14:02";
d.current.temperature_2m=22;
d.current.apparent_temperature=22;
d.current.is_day=1;
d.current.precipitation=0;
d.current.weather_code=2;
d.current.cloud_cover=40;
d.current.wind_speed_10m=10;
d.current.wind_direction_10m=315;
d.current.wind_gusts_10m=20;
d.current.pressure_msl=1017;
d.current.visibility=12000;
d.latitude=51.99;d.longitude=5.09;
d.daily.sunshine_duration=d.daily.time.map(()=>8*3600);

const air={
  current:{european_aqi:28,us_aqi:35},
  hourly:{
    time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[8],
    mugwort_pollen:[1],ragweed_pollen:[0],olive_pollen:[0]
  }
};

let html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
const fixedNow=Date.UTC(2026,7,16,12,2);
const stub=`<script>
Date.now=()=>${fixedNow};
window.fetch=async function(url){
  const u=String(url);
  let payload;
  if(u.includes('/api/waarschuwingen')){
    await new Promise(resolve=>setTimeout(resolve,450));
    payload=${JSON.stringify({bron:"MeteoAlarm",dekking:true,lijst:[],land:"NL"})};
  }else if(u.includes('air-quality-api.open-meteo.com')){
    payload=${JSON.stringify(air)};
  }else if(u.includes('/api/plaatsnaam')){
    payload=${JSON.stringify({naam:"Vijfheerenlanden",land:"NL",bron:"test"})};
  }else{
    payload=${JSON.stringify(d)};
  }
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
  const rel=pathname.startsWith("/")?pathname.slice(1):pathname;
  const file=path.join(__dirname,"public",rel);
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const ext=path.extname(file).toLowerCase();
    const types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".svg":"image/svg+xml"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});
    fs.createReadStream(file).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

async function controleer(browserType,naam){
  const browser=await browserType.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const fouten=[];
    page.on("pageerror",e=>fouten.push(String(e)));
    page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
    await page.goto(`http://127.0.0.1:${server.address().port}/?lat=51.99&lon=5.09&plaats=Vijfheerenlanden&land=NL`,{waitUntil:"domcontentloaded"});
    await page.waitForSelector("#app",{state:"visible"});

    await page.waitForFunction(()=>{
      const el=document.querySelector('#waarschuwingen [data-ui-warning-loading="1"]');
      return !!el&&/controleren/.test(el.textContent||"");
    },null,{timeout:2000});
    const tijdens=await page.locator("#waarschuwingen").innerText();
    assert.match(tijdens,/Officiële weerwaarschuwingen controleren/,`${naam}: lopende officiële controle is zichtbaar`);

    await page.waitForFunction(()=>{
      const el=document.getElementById("waarschuwingen");
      return !!el&&(el.textContent||"").trim()==="Geen officiële weerwaarschuwingen voor deze locatie.";
    },null,{timeout:3000});
    const eind=await page.locator("#waarschuwingen").innerText();
    assert.equal(eind.trim(),"Geen officiële weerwaarschuwingen voor deze locatie.",`${naam}: lege officiële NL-feed krijgt expliciete nulwaarschuwingstatus`);
    assert.equal(await page.locator('#waarschuwingen [data-ui-warning-loading="1"]').count(),0,`${naam}: laadstatus verdwijnt na officiële eindstate`);
    assert.deepEqual(fouten,[],`${naam}: geen browserfouten`);
    console.log(`${naam}: waarschuwingcontrole en expliciete Nederlandse nulwaarschuwingstatus geslaagd.`);
  }finally{await browser.close();}
}

server.listen(0,"127.0.0.1",async()=>{
  try{
    await controleer(chromium,"Chromium");
    await controleer(webkit,"WebKit");
  }catch(e){console.error(e&&e.stack||e);process.exitCode=1;}
  finally{server.close();}
});

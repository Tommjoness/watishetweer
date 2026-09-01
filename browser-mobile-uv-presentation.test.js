"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const PUBLIC=path.join(__dirname,"public");
const d=bouw({som:0,pp:()=>0,pr:()=>0});
d.current.time="2026-07-22T14:17";
d.current.interval=900;
d.daily.sunshine_duration=d.daily.time.map(()=>9.5*3600);
/* Volledige kwartierstructuur voorkomt dat deze presentatietest onbedoeld een
   fallbackpad test. De UV-data zelf blijven de bestaande data.js-fixture. */
d.minutely_15={time:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[]};
for(let i=0;i<9;i++){
  const ms=Date.UTC(2026,6,22,12,15)+i*15*60000;
  const t=new Date(ms+2*3600000).toISOString().slice(0,16);
  d.minutely_15.time.push(t);d.minutely_15.precipitation.push(0);d.minutely_15.rain.push(0);
  d.minutely_15.showers.push(0);d.minutely_15.snowfall.push(0);d.minutely_15.weather_code.push(3);
}
const air={current:{european_aqi:24,us_aqi:33},hourly:{
  time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[1],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]
}};

let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
const fixedNow=Date.UTC(2026,6,22,12,17); // 14:17 Europe/Amsterdam
const stub=`<script>
Date.now=()=>${fixedNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Almere",latitude:52.35,longitude:5.26,admin1:"Flevoland",country_code:"NL"}]})}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Almere",land:"NL",bron:"test"})}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const mime={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;
  }
  const rel=pathname.replace(/^\//,""),file=path.join(PUBLIC,rel);
  if(file.startsWith(PUBLIC+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.writeHead(200,{"content-type":mime[path.extname(file).toLowerCase()]||"application/octet-stream"});
    fs.createReadStream(file).pipe(res);return;
  }
  res.writeHead(404);res.end("not found");
});

async function controleer(type,naam,breedte){
  const browser=await type.launch({headless:true});
  const page=await browser.newPage({viewport:{width:breedte,height:900}});
  const fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Almere&land=NL`,{waitUntil:"networkidle"});
    await page.waitForSelector("#app",{state:"visible"});
    await page.waitForFunction(()=>document.getElementById("uv")&&document.getElementById("uv").textContent.trim()!=="--");
    await page.evaluate(()=>document.fonts&&document.fonts.ready);

    const g=await page.evaluate(()=>{
      const rect=el=>{const b=el.getBoundingClientRect();return {l:b.left,r:b.right,t:b.top,b:b.bottom,w:b.width,h:b.height};};
      const value=document.getElementById("uv"),uv=value&&value.closest(".stat"),stats=uv&&uv.closest(".stats");
      const zicht=document.getElementById("vis"),zichtStat=zicht&&zicht.closest(".stat");
      const label=uv&&uv.querySelector(".eyebrow"),sub=uv&&uv.querySelector(".ssub");
      const cs=uv&&getComputedStyle(uv),gridcs=stats&&getComputedStyle(stats);
      const zichtbare=stats?[...stats.children].filter(el=>el.classList.contains("stat")&&getComputedStyle(el).display!=="none"):[];
      return {
        pageOverflow:document.documentElement.scrollWidth-window.innerWidth,
        uv:uv&&rect(uv),stats:stats&&rect(stats),zicht:zichtStat&&rect(zichtStat),label:label&&rect(label),value:value&&rect(value),sub:sub&&rect(sub),
        uvDisplay:cs&&cs.display,gridColumns:gridcs&&gridcs.gridTemplateColumns,
        paddingLeft:cs&&parseFloat(cs.paddingLeft),paddingRight:cs&&parseFloat(cs.paddingRight),
        uvOverflow:uv&&uv.scrollWidth-uv.clientWidth,subOverflow:sub&&sub.scrollWidth-sub.clientWidth,
        labelText:(label&&label.textContent||"").trim(),valueText:(value&&value.textContent||"").trim(),subText:(sub&&sub.textContent||"").trim(),
        breed:!!(uv&&uv.classList.contains("breed")),count:zichtbare.length,
        pressureVisible:zichtbare.some(el=>/luchtdruk/i.test((el.querySelector(".eyebrow")?.textContent||"")))
      };
    });

    const d=(a,b)=>Math.abs(a-b);
    assert.deepEqual(fouten,[],`${naam} ${breedte}px: geen runtime/consolefouten`);
    assert.ok(g.pageOverflow<=2,`${naam} ${breedte}px: geen horizontale pagina-overflow (${g.pageOverflow}px)`);
    assert.equal(g.count,8,`${naam} ${breedte}px: hoofdgrid bevat exact acht zichtbare tegels`);
    assert.equal(g.pressureVisible,false,`${naam} ${breedte}px: luchtdruk staat niet meer in het zichtbare hoofdgrid`);
    assert.equal(g.labelText,"UV-piek vandaag",`${naam} ${breedte}px: juiste UV-tegel`);
    assert.ok(/^\d+$/.test(g.valueText),`${naam} ${breedte}px: UV-waarde blijft zichtbaar (${g.valueText})`);
    assert.ok(g.subText.length>0&&/UV|piek/i.test(g.subText),`${naam} ${breedte}px: bestaande UV-toelichting blijft zichtbaar`);
    assert.equal(g.breed,false,`${naam} ${breedte}px: UV is geen brede volle-rijtegel meer`);
    assert.ok(g.gridColumns&&g.gridColumns!=="none",`${naam} ${breedte}px: hoofdgrid heeft actieve kolommen`);
    assert.ok(g.uv&&g.stats&&g.zicht,`${naam} ${breedte}px: UV, Zicht en hoofdgrid hebben meetbare geometrie`);
    assert.ok(g.uv.w<=g.stats.w*0.56&&g.zicht.w<=g.stats.w*0.56,`${naam} ${breedte}px: UV en Zicht nemen ieder ongeveer één van twee kolommen in`);
    assert.ok(d(g.uv.t,g.zicht.t)<=2&&d(g.uv.b,g.zicht.b)<=2,`${naam} ${breedte}px: Zicht en UV vormen samen de laatste rij`);
    assert.ok(g.zicht.l<g.uv.l,`${naam} ${breedte}px: Zicht staat links en UV rechts in de laatste rij`);
    assert.ok(d(g.uv.r,g.stats.r)<=1,`${naam} ${breedte}px: UV sluit rechts netjes aan op het raster`);
    assert.ok(g.uvOverflow<=1&&g.subOverflow<=1,`${naam} ${breedte}px: UV-inhoud loopt niet horizontaal uit`);
    assert.ok(g.label&&g.value&&g.sub&&g.label.t<=g.value.t&&g.sub.t>=g.value.b-1,`${naam} ${breedte}px: label, waarde en toelichting hebben normale verticale tegelhiërarchie`);
  }finally{
    await browser.close();
  }
}

server.listen(0,"127.0.0.1",async()=>{
  try{
    for(const [type,naam] of [[chromium,"Chromium"],[webkit,"WebKit"]]){
      await controleer(type,naam,360);
      await controleer(type,naam,390);
    }
    console.log("Mobiele UV-presentatie groen in Chromium en WebKit op 360 en 390 px: normale achtste tegel naast Zicht.");
  }catch(e){
    console.error(e.stack||e);process.exitCode=1;
  }finally{
    server.close();
  }
});

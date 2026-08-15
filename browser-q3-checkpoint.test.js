"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

function zonduur(d,sec){d.daily.sunshine_duration=d.daily.time.map(()=>sec);}
function zetUv(d,datum,uur,waarde){
  d.hourly.uv_index=d.hourly.time.map(t=>t===datum+"T"+String(uur).padStart(2,"0")+":00"?waarde:0);
  const i=d.daily.time.indexOf(datum);if(i>=0)d.daily.uv_index_max[i]=waarde;
}
function nulAir(tijd){return {current:{european_aqi:0,us_aqi:0},hourly:{
  time:[tijd],alder_pollen:[0],birch_pollen:[0],grass_pollen:[1],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]
}};}
function gewoneAir(tijd){return {current:{european_aqi:24,us_aqi:33},hourly:{
  time:[tijd],alder_pollen:[0],birch_pollen:[0],grass_pollen:[4],mugwort_pollen:[1],ragweed_pollen:[0],olive_pollen:[0]
}};}
function legeAir(tijd){return {current:{european_aqi:null,us_aqi:null},hourly:{
  time:[tijd],alder_pollen:[null],birch_pollen:[null],grass_pollen:[null],mugwort_pollen:[null],ragweed_pollen:[null],olive_pollen:[null]
}};}

function maakScenario(naam){
  let d,air,now,lat=52.35,lon=5.26,land="NL",plaats="Almere";
  if(naam==="zero"){
    d=bouw({geenKwartier:true,temp:()=>0,tempNu:0,rh:0,cc:()=>100,ccNu:100,ws:0,wsNu:0,wg:()=>0,zicht:0,pp:()=>0,pr:()=>0,som:0});
    d.current.apparent_temperature=0;d.current.pressure_msl=1000;d.current.wind_gusts_10m=0;
    d.hourly.pressure_msl=d.hourly.pressure_msl.map(()=>1000);d.hourly.uv_index=d.hourly.uv_index.map(()=>0);d.daily.uv_index_max=d.daily.uv_index_max.map(()=>0);
    zonduur(d,0);air=nulAir(d.current.time);now=Date.UTC(2026,6,22,12,0);
  }else if(naam==="missing"){
    d=bouw({geenKwartier:true});
    delete d.current.temperature_2m;delete d.current.apparent_temperature;delete d.current.relative_humidity_2m;
    delete d.current.cloud_cover;delete d.current.pressure_msl;delete d.current.wind_speed_10m;delete d.current.wind_direction_10m;delete d.current.wind_gusts_10m;
    d.hourly.visibility=d.hourly.visibility.map(()=>null);d.hourly.uv_index=d.hourly.uv_index.map(()=>null);d.daily.uv_index_max=d.daily.uv_index_max.map(()=>null);
    zonduur(d,null);air=legeAir(d.current.time);now=Date.UTC(2026,6,22,12,0);
  }else if(naam==="uvfuture"){
    d=bouw({geenKwartier:true});d.current.time="2026-07-22T10:00";zetUv(d,"2026-07-22",13,7.4);zonduur(d,8*3600);
    air=gewoneAir(d.current.time);now=Date.UTC(2026,6,22,8,0);
  }else if(naam==="uvpast"){
    d=bouw({geenKwartier:true});d.current.time="2026-07-22T18:00";zetUv(d,"2026-07-22",13,7.4);zonduur(d,8*3600);
    air=gewoneAir(d.current.time);now=Date.UTC(2026,6,22,16,0);
  }else if(naam==="tokyo"){
    d=bouw({geenKwartier:true});lat=35.676;lon=139.650;land="JP";plaats="Tokio";
    d.timezone="Asia/Tokyo";d.utc_offset_seconds=32400;d.latitude=lat;d.longitude=lon;d.current.time="2026-07-22T23:55";
    d.daily.sunrise=d.daily.time.map((x,i)=>x+(i===1?"T06:01":"T05:12"));d.daily.sunset=d.daily.time.map(x=>x+"T18:47");
    zetUv(d,"2026-07-22",13,8.2);zonduur(d,7*3600);air=gewoneAir(d.current.time);now=Date.UTC(2026,6,22,15,5);
  }else if(naam==="newyork"){
    d=bouw({geenKwartier:true});lat=40.713;lon=-74.006;land="US";plaats="New York";
    d.timezone="America/New_York";d.utc_offset_seconds=-14400;d.latitude=lat;d.longitude=lon;d.current.time="2026-07-22T23:55";
    d.daily.sunrise=d.daily.time.map((x,i)=>x+(i===1?"T05:44":"T05:43"));d.daily.sunset=d.daily.time.map(x=>x+"T20:20");
    zetUv(d,"2026-07-22",13,8.2);zonduur(d,8*3600);air=gewoneAir(d.current.time);now=Date.UTC(2026,6,23,4,5);
  }else throw new Error("Onbekend scenario "+naam);
  d.latitude=lat;d.longitude=lon;
  return {d,air,now,lat,lon,land,plaats};
}

const scenarioNamen=["zero","missing","uvfuture","uvpast","tokyo","newyork"];
const scenarios=Object.fromEntries(scenarioNamen.map(n=>[n,maakScenario(n)]));
let html=fs.readFileSync(path.join(__dirname,"public/index.html"),"utf8");
const stub=`<script>
(function(){
  const scenarios=${JSON.stringify(scenarios)};
  const naam=new URL(location.href).searchParams.get("scenario")||"zero";
  const s=scenarios[naam];
  Date.now=()=>s.now;
  window.fetch=async function(url){
    const u=String(url);
    const payload=u.includes('/api/waarschuwingen')?{bron:"test",dekking:true,lijst:[],land:s.land}
      :u.includes('air-quality-api.open-meteo.com')?s.air
      :u.includes('geocoding-api.open-meteo.com')?{results:[{name:s.plaats,latitude:s.lat,longitude:s.lon,country_code:s.land}]}
      :u.includes('/api/plaatsnaam')?{naam:s.plaats,land:s.land,bron:"test"}
      :s.d;
    return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
  };
  try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
})();
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

function compact(t){return String(t||"").replace(/\s+/g,"").trim();}
async function controleer(page,browserNaam,scenario,breedte){
  const s=scenarios[scenario],fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
  const qs=new URLSearchParams({scenario,lat:String(s.lat),lon:String(s.lon),plaats:s.plaats,land:s.land});
  await page.goto(`http://127.0.0.1:${server.address().port}/?${qs}`,{waitUntil:"networkidle"});
  await page.waitForSelector("#app",{state:"visible"});
  await page.waitForFunction(()=>document.querySelectorAll("#aq .stat").length>0);
  await page.evaluate(()=>document.fonts&&document.fonts.ready);

  const r=await page.evaluate(()=>{
    const txt=id=>((document.getElementById(id)||{}).textContent||"").trim();
    const pollen=[...document.querySelectorAll("#aq .stat")].find(x=>((x.querySelector(".eyebrow")||{}).textContent||"").trim()==="Graspollen");
    const footer=document.querySelector("footer");
    const sun=document.getElementById("suntimes"),sunRect=sun.getBoundingClientRect();
    const zonRijen=[...sun.querySelectorAll(".zonregel")].map(el=>{const b=el.getBoundingClientRect();return {tekst:(el.textContent||"").trim(),l:b.left,r:b.right,t:b.top,b:b.bottom};});
    const t=document.getElementById("t"),cs=getComputedStyle(t);
    return {
      overflow:document.documentElement.scrollWidth-window.innerWidth,
      temp:txt("t"),hum:txt("hum"),humsub:txt("humsub"),cloud:txt("cloud"),cloudsub:txt("cloudsub"),
      vis:txt("vis"),vissub:txt("vissub"),uv:txt("uv"),uvsub:txt("uvsub"),
      plaatsVandaag:typeof plaatsVandaag==="function"?plaatsVandaag():null,
      sunText:txt("suntimes"),sunDays:[...sun.querySelectorAll(".zondag")].map(x=>(x.textContent||"").trim()),
      sunBinnen:zonRijen.every(x=>x.l>=sunRect.left-1&&x.r<=sunRect.right+1),zonRijen,
      pollen:pollen?((pollen.querySelector(".sval")||{}).textContent||"").trim():"",
      pollenSub:pollen?((pollen.querySelector(".ssub")||{}).textContent||"").trim():"",
      footerItems:footer?footer.querySelectorAll(".bron-bronnen .bronitem").length:0,
      footerText:footer?(footer.textContent||"").trim():"",
      fontVariant:cs.fontVariantNumeric||"",fontFeatures:cs.fontFeatureSettings||""
    };
  });

  assert.deepEqual(fouten,[],`${browserNaam} ${scenario} ${breedte}px: geen runtime/consolefouten`);
  assert.ok(r.overflow<=2,`${browserNaam} ${scenario} ${breedte}px: geen horizontale overflow (${r.overflow}px)`);
  assert.equal(r.footerItems,6,`${browserNaam} ${scenario}: zes zelfstandige bronitems blijven zichtbaar`);
  for(const bron of ["Open-Meteo","CAMS","MeteoAlarm","National Weather Service","BigDataCloud","OpenStreetMap"]){
    assert(r.footerText.includes(bron),`${browserNaam} ${scenario}: bron ${bron} blijft zichtbaar`);
  }

  if(scenario==="zero"){
    assert.equal(r.temp,"0",`${browserNaam} ${breedte}px: 0°C blijft een echte nul`);
    assert.equal(compact(r.hum),"0%",`${browserNaam} ${breedte}px: 0% luchtvochtigheid blijft geldige data`);
    assert.equal(compact(r.cloud),"100%",`${browserNaam} ${breedte}px: 100% bewolking blijft exact zichtbaar`);
    assert.equal(r.cloudsub,"Geheel bewolkt.",`${browserNaam} ${breedte}px: 100% heet geheel bewolkt`);
    assert.equal(compact(r.vis),"0,0km",`${browserNaam} ${breedte}px: nul meter zicht blijft geldige data met bestaande km-precisie`);
    assert.equal(r.uv,"0",`${browserNaam} ${breedte}px: UV nul blijft geldige data`);
    assert.equal(r.uvsub,"Nauwelijks UV vandaag.",`${browserNaam} ${breedte}px: nul-UV krijgt tijdneutrale nultekst`);
    assert(/^1\s*korrel\/m³$/i.test(r.pollen),`${browserNaam} ${breedte}px: Graspollen met één korrel gebruikt enkelvoud (${r.pollen})`);
    assert(/tabular-nums/i.test(r.fontVariant)||/tnum/i.test(r.fontFeatures),`${browserNaam} ${breedte}px: numerieke kolommen behouden tabular-nums (${r.fontVariant}; ${r.fontFeatures})`);
    assert(!/slashed-zero/i.test(r.fontVariant)&&!/["']?zero["']?\s+1/i.test(r.fontFeatures),`${browserNaam} ${breedte}px: consumentencijfers gebruiken geen doorgestreepte nul (${r.fontVariant}; ${r.fontFeatures})`);
  }else if(scenario==="missing"){
    assert(!/^0(?:°|$)/.test(r.temp),`${browserNaam}: ontbrekende temperatuur wordt geen 0`);
    assert(!/^0%$/.test(compact(r.hum)),`${browserNaam}: ontbrekende luchtvochtigheid wordt geen 0%`);
    assert(!/^0%$/.test(compact(r.cloud)),`${browserNaam}: ontbrekende bewolking wordt geen 0%`);
    assert(!/^0(?:,0)?km$/.test(compact(r.vis)),`${browserNaam}: ontbrekend zicht wordt geen 0 of 0,0 km`);
    assert.notEqual(r.uv,"0",`${browserNaam}: ontbrekende UV wordt geen 0`);
    assert(/niet beschikbaar/i.test(r.humsub),`${browserNaam}: ontbrekende luchtvochtigheid wordt expliciet gemeld`);
    assert(/niet beschikbaar/i.test(r.cloudsub),`${browserNaam}: ontbrekende bewolking wordt expliciet gemeld`);
    assert(/niet beschikbaar/i.test(r.uvsub),`${browserNaam}: ontbrekende UV wordt expliciet gemeld`);
  }else if(scenario==="uvfuture"){
    assert.equal(r.uv,"7",`${browserNaam}: UV-piek rondt zichtbaar consistent af`);
    assert.equal(r.uvsub,"Piek rond 13:00 · hoog.",`${browserNaam}: toekomstige UV-piek wordt als toekomst gepresenteerd`);
  }else if(scenario==="uvpast"){
    assert.equal(r.uv,"7",`${browserNaam}: verstreken UV-piek behoudt de dagwaarde`);
    assert.equal(r.uvsub,"Piek was rond 13:00 · hoog.",`${browserNaam}: verstreken UV-piek wordt niet als toekomst gepresenteerd`);
  }else if(scenario==="tokyo"||scenario==="newyork"){
    assert.equal(r.plaatsVandaag,"2026-07-23",`${browserNaam} ${scenario}: kalenderdag volgt live IANA-plaatsklok`);
    assert.equal(r.uv,"–",`${browserNaam} ${scenario}: UV van stale vorige kalenderdag wordt niet als vandaag getoond`);
    assert.equal(r.uvsub,"UV-gegevens voor vandaag worden bijgewerkt.",`${browserNaam} ${scenario}: stale UV wordt eerlijk benoemd`);
    assert.equal(r.sunDays[0],"Vandaag",`${browserNaam} ${scenario}: zoninformatie kiest de live lokale kalenderdag (${r.sunDays.join(", ")})`);
    assert.equal(r.sunBinnen,true,`${browserNaam} ${scenario} ${breedte}px: zon/daglichtregels blijven binnen hun mobiele blok`);
  }
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const gevallen=[
    ["zero",320],["zero",390],["zero",1440],["missing",320],
    ["uvfuture",390],["uvpast",390],["tokyo",320],["tokyo",430],["newyork",320],["newyork",430]
  ];
  try{
    for(const [browserNaam,type] of [["Chromium",chromium],["WebKit",webkit]]){
      const browser=await type.launch({headless:true});
      try{
        for(const [scenario,breedte] of gevallen){
          const context=await browser.newContext({viewport:{width:breedte,height:900},deviceScaleFactor:breedte<760?3:1});
          const page=await context.newPage();
          try{await controleer(page,browserNaam,scenario,breedte);}finally{await context.close();}
        }
      }finally{await browser.close();}
    }
    console.log("Checkpoint 75 browsermatrix geslaagd: nul/missing, 100% bewolking, UV-tijd, lokale middernacht, zoninfo, natuurlijke pollen/footercopy en numerieke leesbaarheid in Chromium/WebKit.");
  }finally{server.close();}
})().catch(err=>{console.error(err);process.exit(1);});

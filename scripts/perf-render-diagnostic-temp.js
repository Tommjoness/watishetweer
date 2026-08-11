"use strict";
const fs=require("fs");
const path=require("path");
const http=require("http");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

function isoPlus(iso,uren){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(iso);
  const ms=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])+uren*3600000;
  return new Date(ms).toISOString().slice(0,16);
}
function compleet(aantal){
  const d=bouw({temp:u=>18+3*Math.sin(u/24*Math.PI*2),pp:u=>u%8<3?70:15,pr:u=>u%8<3?0.4:0,som:4.2});
  const h=d.hourly;
  h.rain=h.precipitation.slice();h.showers=Array(h.time.length).fill(0);h.snowfall=Array(h.time.length).fill(0);
  d.current.rain=d.current.precipitation;d.current.showers=0;d.current.snowfall=0;d.current.visibility=20000;
  d.daily.sunshine_duration=d.daily.time.map(()=>7*3600);
  const velden=Object.keys(h).filter(k=>Array.isArray(h[k]));
  while(h.time.length<aantal){
    const i=h.time.length,bron=24+(i%24);
    const laatste=h.time[h.time.length-1];
    for(const k of velden){
      if(k==="time")continue;
      const reeks=h[k];reeks.push(reeks[bron%reeks.length]);
    }
    h.time.push(isoPlus(laatste,1));
  }
  for(const k of velden){if(k!=="time")h[k]=h[k].slice(0,aantal);}
  h.time=h.time.slice(0,aantal);
  d.minutely_15={time:["2026-07-22T13:00","2026-07-22T13:15","2026-07-22T13:30","2026-07-22T13:45","2026-07-22T14:00","2026-07-22T14:15","2026-07-22T14:30","2026-07-22T14:45"],precipitation:[0,0,0,.1,.2,.2,.1,0],rain:[0,0,0,.1,.2,.2,.1,0],showers:[0,0,0,0,0,0,0,0],snowfall:[0,0,0,0,0,0,0,0],weather_code:[3,3,3,51,51,51,51,3]};
  return d;
}
const data408=compleet(408),data192=compleet(192);
const air={current:{european_aqi:22,us_aqi:37},hourly:{time:[data192.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
let html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
const stub=`<script>(function(){
 const D408=${JSON.stringify(data408)},D192=${JSON.stringify(data192)},AIR=${JSON.stringify(air)};
 window.__perfDelay=0;window.__forecastShape=[];
 const clone=x=>JSON.parse(JSON.stringify(x));
 const response=x=>({ok:true,status:200,json:async()=>clone(x),text:async()=>JSON.stringify(x)});
 window.fetch=async function(url){
   const u=String(url);
   if(u.includes('api.open-meteo.com/v1/forecast')){
     const x=new URL(u,location.href),beperkt=x.searchParams.get('forecast_hours')==='168';
     window.__forecastShape.push({beperkt,uren:beperkt?192:408});
     if(window.__perfDelay)await new Promise(r=>setTimeout(r,window.__perfDelay));
     return response(beperkt?D192:D408);
   }
   if(u.includes('air-quality-api.open-meteo.com'))return response(AIR);
   if(u.includes('/api/waarschuwingen'))return response({bron:'test',dekking:true,land:'NL',lijst:[]});
   return response({});
 };
 Date.now=()=>Date.UTC(2026,6,22,12,0,0);
})();</script>`;
html=html.replace("</head>",stub+"</head>");
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}
  const rel=pathname.startsWith("/")?pathname.slice(1):pathname,file=path.join(__dirname,"..","public",rel);
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const ext=path.extname(file),types={".woff2":"font/woff2",".png":"image/png",".json":"application/json",".js":"application/javascript"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(file).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});
const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
(async()=>{
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:"block"});
  const page=await ctx.newPage();
  const t0=Date.now();
  await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Start&land=NL`,{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible"});
  const initial=Date.now()-t0;
  await page.evaluate(()=>document.fonts&&document.fonts.ready);
  await page.evaluate(()=>{
    window.__renderTimes=[];
    const basis=tekenAlles;
    tekenAlles=function(){const t=performance.now();try{return basis();}finally{window.__renderTimes.push(performance.now()-t);}};
  });
  const loads=[];
  for(let i=0;i<8;i++){
    const x=await page.evaluate(async i=>{
      localStorage.removeItem("weerbriefing.plaatscache.q1");
      window.__perfDelay=0;window.__renderTimes=[];
      const t=performance.now();await load(10+i/100,20+i/100,"P"+i,false,false,"NL");
      return {elapsed:performance.now()-t,render:window.__renderTimes[0]||0};
    },i);
    loads.push(x);
  }
  const delayed=[];
  for(const delay of [200,1000]){
    const x=await page.evaluate(async delay=>{
      localStorage.removeItem("weerbriefing.plaatscache.q1");window.__perfDelay=delay;window.__renderTimes=[];
      const t=performance.now();await load(30+delay/10000,40,"D"+delay,false,false,"NL");
      return {delay,elapsed:performance.now()-t,render:window.__renderTimes[0]||0};
    },delay);
    delayed.push(x);
  }
  const shape=await page.evaluate(()=>window.__forecastShape.slice(-12));
  console.log("PERF_RENDER_SUMMARY",JSON.stringify({initialMs:initial,medianLoadMs:+median(loads.map(x=>x.elapsed)).toFixed(1),medianRenderMs:+median(loads.map(x=>x.render)).toFixed(1),maxRenderMs:+Math.max(...loads.map(x=>x.render)).toFixed(1),delayed:delayed.map(x=>({delay:x.delay,elapsed:+x.elapsed.toFixed(1),render:+x.render.toFixed(1)})),shape}));
  await ctx.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
"use strict";

// Bounded, deterministic measurements against the actual final build. No live
// provider traffic: this isolates layout/render work from provider availability.
const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");
const OUT=path.join(__dirname,"..","public");
const REPORT=path.join(__dirname,"..","cwv-evidence");
const routes=["/","/weer/amsterdam/","/weer/rotterdam/","/weer/groningen/","/weer/utrecht/","/?lat=52.396&lon=5.280&plaats=Almere&land=NL"];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function cls(entries){
  let max=0,sum=0,start=-Infinity,last=-Infinity;
  for(const e of entries.filter(e=>!e.hadRecentInput).sort((a,b)=>a.startTime-b.startTime)){
    if(e.startTime-last>1000||e.startTime-start>5000){start=e.startTime;sum=0;}
    sum+=e.value;last=e.startTime;max=Math.max(max,sum);
  }
  return max;
}
function fixture(url){
  const u=new URL(url),d=bouw({som:0,pp:()=>0,pr:()=>0});
  d.latitude=Number(u.searchParams.get("latitude")||u.searchParams.get("lat")||52.35);
  d.longitude=Number(u.searchParams.get("longitude")||u.searchParams.get("lon")||5.26);
  d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){
    const i=h.time.length,previous=h.time[i-1];
    for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);
    h.time.push(new Date(Date.parse(previous+"Z")+3600000).toISOString().slice(0,16));
  }
  return d;
}
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;
  if(p.endsWith("/"))p+="index.html";
  const file=path.join(OUT,p);
  if(!file.startsWith(OUT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end("not found");return;}
  const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml"};
  res.writeHead(200,{"content-type":types[path.extname(file)]||"application/octet-stream","cache-control":"public, max-age=300"});
  fs.createReadStream(file).pipe(res);
});

async function instrumentation(page){
  await page.addInitScript(()=>{
    const NativeDate=Date,start=NativeDate.now(),epoch=NativeDate.parse("2026-07-22T12:00:00Z");
    class FixtureDate extends NativeDate{constructor(...args){super(...(args.length?args:[epoch+NativeDate.now()-start]));}static now(){return epoch+NativeDate.now()-start;}}
    window.Date=FixtureDate;
    window.__cwv={shifts:[],tasks:[],events:[],frames:[],layouts:[],errors:[]};
    const name=e=>e&&((e.id&&"#"+e.id)||(typeof e.className==="string"&&"."+e.className.trim().replace(/\s+/g,"."))||e.tagName);
    for(const type of ["layout-shift","longtask","event","long-animation-frame"]){
      if(!PerformanceObserver.supportedEntryTypes.includes(type))continue;
      new PerformanceObserver(list=>{for(const e of list.getEntries()){
        if(type==="layout-shift")window.__cwv.shifts.push({value:e.value,startTime:e.startTime,hadRecentInput:e.hadRecentInput,sources:e.sources.map(s=>({node:name(s.node),previous:s.previousRect,current:s.currentRect}))});
        if(type==="longtask")window.__cwv.tasks.push({startTime:e.startTime,duration:e.duration});
        if(type==="event"&&e.interactionId)window.__cwv.events.push({name:e.name,target:name(e.target),startTime:e.startTime,duration:e.duration,processingStart:e.processingStart,processingEnd:e.processingEnd,interactionId:e.interactionId});
        if(type==="long-animation-frame")window.__cwv.frames.push({startTime:e.startTime,duration:e.duration,blockingDuration:e.blockingDuration,scripts:e.scripts.map(s=>({sourceURL:s.sourceURL,sourceFunctionName:s.sourceFunctionName,sourceCharPosition:s.sourceCharPosition,duration:s.duration,forcedStyleAndLayoutDuration:s.forcedStyleAndLayoutDuration}))});
      }}).observe({type,buffered:true,...(type==="event"?{durationThreshold:16}:{})});
    }
    let last="";
    const sample=()=>{
      const layout={};
      for(const s of [".sheet","#state","#app",".seo-route-context",".wiw-chart-main","#wiw-hour-panel","#wiw-hour-table",".wiw-rain-section",".dashrow-days"]){
        const e=document.querySelector(s);if(!e)continue;const r=e.getBoundingClientRect();
        layout[s]={top:r.top,height:r.height,width:r.width,display:getComputedStyle(e).display};
      }
      const value=JSON.stringify(layout);
      if(value!==last){window.__cwv.layouts.push({time:performance.now(),layout});last=value;}
      if(performance.now()<5000)requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function run(){
  fs.mkdirSync(REPORT,{recursive:true});
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true});
  const reports=[];
  try{
    for(const width of [390,1660])for(const route of routes){
      const context=await browser.newContext({viewport:{width,height:width===390?844:1000},locale:"nl-NL",timezoneId:"America/Los_Angeles",serviceWorkers:"block"});
      const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(String(e)));
      page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
      await instrumentation(page);
      await page.route("**/*",async r=>{
        const u=new URL(r.request().url());
        if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast"){
          await sleep(700);return r.fulfill({json:fixture(u.href)});
        }
        if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T14:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
        if(u.pathname==="/api/waarschuwingen"){await sleep(1100);return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});}
        if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
        if(u.origin!==root)return r.fulfill({json:{}});
        return r.continue();
      });
      for(const scenario of ["cold","reload"]){
        if(scenario==="cold")await page.goto(root+route,{waitUntil:"domcontentloaded"});else await page.reload({waitUntil:"domcontentloaded"});
        await page.waitForSelector("#app",{state:"visible",timeout:10000});
        await page.waitForTimeout(1600);
        const result=await page.evaluate(()=>{
          const rect=s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect().toJSON():null;};
          return {...window.__cwv,geometry:{main:rect(".wiw-chart-main"),graph:rect("#chart"),hours:rect("#wiw-hour-panel"),table:rect("#wiw-hour-table"),rain:rect(".wiw-rain-section"),days:rect(".dashrow-days")},rows:document.querySelectorAll("#wiw-hour-table tbody tr").length,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,sha:document.querySelector('meta[name="weather-build-sha"]')?.content};
        });
        result.route=route;result.width=width;result.scenario=scenario;result.cls=cls(result.shifts);
        reports.push(result);
        assert.deepEqual(errors,[],"Runtime/console: "+route);
        assert(result.overflow<=1,"Horizontale overflow: "+JSON.stringify({route,width,overflow:result.overflow}));
        console.log("CWV_BASELINE "+JSON.stringify({route,width,scenario,cls:result.cls,rows:result.rows,geometry:result.geometry,shifts:result.shifts}));
      }
      if(route==="/weer/amsterdam/"){
        const session=await context.newCDPSession(page);
        await session.send("Emulation.setCPUThrottlingRate",{rate:4});
        await session.send("Profiler.enable");await session.send("Profiler.start");
        for(let i=1;i<=3;i++){
          await page.locator("#days .row.day:not(.kop)").nth(i).click();
          await page.waitForTimeout(600);
        }
        await page.locator("#q").fill("Tokyo");await page.waitForTimeout(700);
        await page.locator("#q").fill("");
        await page.locator("#thema").click();await page.waitForTimeout(600);
        const profile=(await session.send("Profiler.stop")).profile;
        fs.writeFileSync(path.join(REPORT,"interactions-"+width+".cpuprofile"),JSON.stringify(profile));
        const metrics=await page.evaluate(()=>window.__cwv);
        fs.writeFileSync(path.join(REPORT,"interactions-"+width+".json"),JSON.stringify(metrics,null,2));
        console.log("CWV_INTERACTIONS "+JSON.stringify({width,cpuRate:4,events:metrics.events,frames:metrics.frames.slice(-12)}));
        await session.send("Emulation.setCPUThrottlingRate",{rate:1});
        await page.screenshot({path:path.join(REPORT,"amsterdam-"+width+".png"),fullPage:true});
      }
      await context.close();
    }
  }finally{
    fs.writeFileSync(path.join(REPORT,"measurements.json"),JSON.stringify(reports,null,2));
    await browser.close();server.close();
  }
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});

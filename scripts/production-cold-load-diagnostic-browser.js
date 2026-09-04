"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {chromium}=require("playwright");

const ROOT=String(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/$/,"");
const EXPECTED_SHA=String(process.env.EXPECTED_SHA||"").trim();
const RUNS=Math.max(1,Number(process.env.COLD_LOAD_RUNS||20));
const OBSERVATION_MS=Math.max(1000,Number(process.env.COLD_LOAD_OBSERVATION_MS||12000));
const OUT=process.env.COLD_LOAD_ARTIFACT||path.join("artifacts","cold-load-baseline.json");
if(!/^[0-9a-f]{7,40}$/i.test(EXPECTED_SHA))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig.");

const now=()=>Date.now();
const rel=(start,t)=>t==null?null:Math.max(0,t-start);
const soort=url=>{
  const u=String(url||"");
  if(u.includes("api.open-meteo.com/v1/forecast"))return u.includes("minutely_15=")?"forecast-primary":"forecast-fallback";
  if(u.includes("air-quality-api.open-meteo.com"))return "air-quality";
  if(u.includes("geocoding-api.open-meteo.com"))return "geocoding";
  if(u.includes("/api/plaatsnaam"))return "reverse-geocoding";
  if(u.includes("/api/waarschuwingen"))return "warnings";
  if(u.includes("/api/neerslag"))return "precipitation";
  if(u.startsWith(ROOT))return "internal";
  return "other";
};

async function snapshot(page){
  return page.evaluate(()=>{
    const app=document.getElementById("app"),temp=document.getElementById("t"),state=document.getElementById("state"),compact=document.getElementById("locatie-laadstatus"),q=document.getElementById("q"),place=document.getElementById("place");
    const tempText=temp&&String(temp.textContent||"").trim();
    const appVisible=!!(app&&getComputedStyle(app).display!=="none");
    const heeftData=!!(appVisible&&tempText&&!/^(?:--|–)$/.test(tempText));
    let s=null;
    try{s={lat:S.lat,lon:S.lon,label:S.label,land:S.land,hasData:!!S.d,timezone:S.d&&S.d.timezone||null,verversMislukt:!!S.verversMislukt,op:S.op||0};}catch(_){ }
    return {
      href:location.href,title:document.title,q:q&&q.value||"",place:place&&place.textContent||"",
      appVisible,temp:tempText||"",heeftData,
      state:{display:state&&getComputedStyle(state).display||null,className:state&&state.className||"",text:state&&state.textContent||""},
      compact:{hidden:compact?!!compact.hidden:null,className:compact&&compact.className||"",text:compact&&compact.textContent||""},
      ariaBusy:app&&app.getAttribute("aria-busy"),
      sha:document.querySelector('meta[name="weather-build-sha"]')?.getAttribute("content")||null,
      progressive:globalThis.WeatherNowProgressiveLocationPerformance||null,
      stateObject:s
    };
  });
}

(async()=>{
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  const browser=await chromium.launch({headless:true});
  const all=[];
  try{
    for(let run=1;run<=RUNS;run++){
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,locale:"nl-NL",serviceWorkers:"block"});
      const page=await context.newPage();
      const start=now(),requests=new Map(),events=[],consoleErrors=[],pageErrors=[];
      let domAt=null,dataAt=null,completeAt=null,lastCompleted=null;
      const key=req=>String(req._guid||req.url()+"#"+requests.size);
      page.on("domcontentloaded",()=>{if(domAt===null)domAt=now();events.push({at:rel(start,now()),type:"domcontentloaded"});});
      page.on("pageerror",e=>pageErrors.push({at:rel(start,now()),text:String(e)}));
      page.on("console",m=>{if(m.type()==="error")consoleErrors.push({at:rel(start,now()),text:m.text()});});
      page.on("request",req=>{
        const k=key(req),r={key:k,url:req.url(),method:req.method(),kind:soort(req.url()),start:rel(start,now()),end:null,status:null,failed:null,aborted:false,fromServiceWorker:false};
        requests.set(k,r);events.push({at:r.start,type:"request",kind:r.kind,url:r.url});
      });
      page.on("response",res=>{
        const req=res.request();let r=requests.get(key(req));
        if(!r){r={key:key(req),url:req.url(),method:req.method(),kind:soort(req.url()),start:null};requests.set(r.key,r);}
        r.status=res.status();r.responseAt=rel(start,now());r.fromServiceWorker=!!res.fromServiceWorker();
        const cc=res.headers()["cf-cache-status"]||res.headers()["x-cache"]||null;if(cc)r.cacheStatus=cc;
      });
      page.on("requestfinished",req=>{
        const r=requests.get(key(req));if(!r)return;r.end=rel(start,now());lastCompleted={at:r.end,kind:r.kind,url:r.url,status:r.status};
        events.push({at:r.end,type:"finished",kind:r.kind,status:r.status,url:r.url});
      });
      page.on("requestfailed",req=>{
        const r=requests.get(key(req))||{key:key(req),url:req.url(),kind:soort(req.url()),start:null};
        const f=req.failure();r.end=rel(start,now());r.failed=f&&f.errorText||"request failed";r.aborted=/aborted/i.test(r.failed);requests.set(r.key,r);lastCompleted={at:r.end,kind:r.kind,url:r.url,failed:r.failed};
        events.push({at:r.end,type:"failed",kind:r.kind,error:r.failed,url:r.url});
      });

      try{
        const params=new URLSearchParams({lat:"52.3508",lon:"5.2647",plaats:"Almere",land:"NL",coldcheck:`${start}-${run}-${Math.random().toString(36).slice(2)}`});
        const response=await page.goto(ROOT+"/?"+params,{waitUntil:"domcontentloaded",timeout:30000});
        assert(response&&response.ok(),`run ${run}: homepage HTTP ${response&&response.status()}`);
        const initial=await snapshot(page);
        assert.equal(initial.sha,EXPECTED_SHA,`run ${run}: productie-SHA ${initial.sha} != ${EXPECTED_SHA}`);

        const deadline=start+OBSERVATION_MS;
        while(now()<deadline){
          const s=await snapshot(page);
          if(s.heeftData&&dataAt===null)dataAt=now();
          if(s.heeftData&&completeAt===null)completeAt=now();
          await page.waitForTimeout(50);
        }
        const final=await snapshot(page);
        if(final.heeftData&&dataAt===null)dataAt=now();
        if(final.heeftData&&completeAt===null)completeAt=now();
        const reqs=[...requests.values()].map(r=>Object.assign({},r,{duration:r.start!=null&&r.end!=null?r.end-r.start:null}));
        const pending=reqs.filter(r=>r.end==null).map(r=>({kind:r.kind,url:r.url,start:r.start,status:r.status}));
        const terminal=final.heeftData?"data":((final.state.className.includes("err")||final.compact.className.includes("fout"))?"fout":"laden");
        const result={run,startIso:new Date(start).toISOString(),domMs:rel(start,domAt),dataMs:rel(start,dataAt),mainInterfaceMs:rel(start,completeAt),terminal,final,lastCompleted,pending,requests:reqs,consoleErrors,pageErrors,events};
        all.push(result);
        console.log("COLD_LOAD_DIAGNOSTIC "+JSON.stringify({run,domMs:result.domMs,dataMs:result.dataMs,mainInterfaceMs:result.mainInterfaceMs,terminal,lastCompleted,pending,final:{state:final.state,compact:final.compact,q:final.q,place:final.place,stateObject:final.stateObject},consoleErrors,pageErrors,requests:reqs.filter(r=>["forecast-primary","forecast-fallback","geocoding","reverse-geocoding","air-quality","warnings","precipitation"].includes(r.kind)).map(r=>({kind:r.kind,start:r.start,end:r.end,duration:r.duration,status:r.status,failed:r.failed,cacheStatus:r.cacheStatus||null}))}));
      }finally{
        await context.close();
      }
    }
  }finally{await browser.close();}
  fs.writeFileSync(OUT,JSON.stringify({root:ROOT,expectedSha:EXPECTED_SHA,runs:RUNS,observationMs:OBSERVATION_MS,generatedAt:new Date().toISOString(),results:all},null,2));
  const counts=all.reduce((a,r)=>(a[r.terminal]=(a[r.terminal]||0)+1,a),{});
  console.log("COLD_LOAD_DIAGNOSTIC_SUMMARY "+JSON.stringify({expectedSha:EXPECTED_SHA,runs:RUNS,observationMs:OBSERVATION_MS,counts,dataMs:all.filter(r=>r.dataMs!=null).map(r=>r.dataMs)}));
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

"use strict";

const assert=require("assert");
const {chromium,webkit,devices}=require("playwright");

const ROOT=String(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/$/,"");
const EXPECTED=String(process.env.EXPECTED_SHA||"").trim();
const PER_PROFILE=Math.max(1,Number(process.env.COLD_LOAD_RUNS_PER_PROFILE||15));
const OBSERVATION_MS=Math.max(1000,Number(process.env.COLD_LOAD_OBSERVATION_MS||12000));
if(!/^[0-9a-f]{7,40}$/i.test(EXPECTED))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig.");

const profiles=[
  {name:"Chromium 390x844",engine:chromium,options:{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}},
  {name:"WebKit iPhone",engine:webkit,options:{...devices["iPhone 13"]}}
];
const coordOk=(a,b)=>Number.isFinite(Number(a))&&Math.abs(Number(a)-Number(b))<=0.0011;

async function read(page){return page.evaluate(()=>{
  const app=document.getElementById("app"),state=document.getElementById("state"),compact=document.getElementById("locatie-laadstatus"),compactText=compact&&compact.querySelector(".locatie-status-tekst");
  let s=null;try{s={lat:S.lat,lon:S.lon,label:S.label,land:S.land,data:!!S.d,timezone:S.d&&S.d.timezone||null,verversMislukt:!!S.verversMislukt};}catch(_){ }
  const label=document.getElementById("place")?.getAttribute("aria-label")||"";
  const q=document.getElementById("q")?.value||"";
  const temp=(document.getElementById("t")?.textContent||"").trim();
  const appVisible=!!app&&getComputedStyle(app).display!=="none";
  const data=!!(appVisible&&s&&s.data&&temp&&!/^(?:--|–)$/.test(temp));
  const error=!!((state&&state.className.includes("err")&&getComputedStyle(state).display!=="none")||(compact&&compact.hidden===false&&compact.classList.contains("fout")));
  return {
    href:location.href,title:document.title,label,q,temp,data,error,appVisible,
    status:String(compact&&compact.hidden===false?(compactText?.textContent||compact.textContent||""):(state?.textContent||"")).trim(),
    sha:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
    brief:(document.getElementById("brief")?.textContent||"").trim(),
    chartTexts:document.querySelectorAll("#chart text").length,
    days:document.querySelectorAll("#days .row.day:not(.kop)").length,
    nights:document.querySelectorAll("#nights .row.night:not(.kop)").length,
    s
  };
});}

async function waitTerminal(page,start,limit=OBSERVATION_MS){
  let last=await read(page);
  while(Date.now()-start<limit){
    last=await read(page);
    if(last.data||last.error)return {state:last,ms:Date.now()-start};
    await page.waitForTimeout(50);
  }
  return {state:await read(page),ms:Date.now()-start};
}
function assertIdentity(x,expected){
  assert.equal(x.q,expected.name,`${expected.name}: zoekveld werd ${x.q}`);
  if(x.data)assert.equal(x.label,expected.name,`${expected.name}: zichtbare naam werd ${x.label}`);
  assert(x.title.startsWith(expected.name+" · "),`${expected.name}: title mismatch ${x.title}`);
  assert(x.s&&x.s.label===expected.name,`${expected.name}: state-label mismatch ${x.s&&x.s.label}`);
  assert(coordOk(x.s&&x.s.lat,expected.lat)&&coordOk(x.s&&x.s.lon,expected.lon),`${expected.name}: state-coördinaten mismatch ${JSON.stringify(x.s)}`);
  if(expected.land&&x.s&&x.s.land)assert.equal(x.s.land,expected.land,`${expected.name}: land mismatch ${x.s.land}`);
}

async function coldLoads(profile,browser){
  const rows=[];
  for(let i=1;i<=PER_PROFILE;i++){
    const context=await browser.newContext({...profile.options,locale:"nl-NL",serviceWorkers:"block"});
    const page=await context.newPage(),consoleErrors=[],pageErrors=[],failed=[],requests=[];
    page.on("console",m=>{if(m.type()==="error")consoleErrors.push(m.text());});
    page.on("pageerror",e=>pageErrors.push(String(e)));
    page.on("requestfailed",r=>failed.push({url:r.url(),error:r.failure()?.errorText||"failed"}));
    page.on("request",r=>{if(r.url().includes("api.open-meteo.com/v1/forecast"))requests.push({url:r.url(),start:Date.now(),end:null,status:null});});
    page.on("response",r=>{const item=[...requests].reverse().find(x=>x.url===r.url()&&x.end==null);if(item){item.status=r.status();item.end=Date.now();}});
    const start=Date.now();
    try{
      const q=new URLSearchParams({lat:"52.3508",lon:"5.2647",plaats:"Almere",land:"NL",coldcheck:`${profile.name}-${i}-${start}-${Math.random().toString(36).slice(2)}`});
      const response=await page.goto(ROOT+"/?"+q,{waitUntil:"domcontentloaded",timeout:30000});
      const domMs=Date.now()-start;
      assert(response&&response.ok(),`${profile.name} run ${i}: HTTP ${response&&response.status()}`);
      const terminal=await waitTerminal(page,start);
      const x=terminal.state;
      assert.equal(x.sha,EXPECTED,`${profile.name} run ${i}: verkeerde build ${x.sha}`);
      assert(x.data||x.error,`${profile.name} run ${i}: na ${terminal.ms} ms nog generiek laden; status=${x.status}`);
      assertIdentity(x,{name:"Almere",lat:52.3508,lon:5.2647,land:"NL"});
      assert.deepEqual(pageErrors,[],`${profile.name} run ${i}: pageerrors ${pageErrors.join(" | ")}`);
      assert.deepEqual(consoleErrors,[],`${profile.name} run ${i}: console-errors ${consoleErrors.join(" | ")}`);
      if(x.data){
        assert(x.brief.length>0,`${profile.name} run ${i}: briefing leeg`);
        assert(x.chartTexts>=4,`${profile.name} run ${i}: grafiek niet bruikbaar`);
        assert.equal(x.days,7,`${profile.name} run ${i}: weekverwachting heeft ${x.days} rijen`);
      }
      const forecastDurations=requests.filter(r=>r.end&&r.status>=200&&r.status<300).map(r=>r.end-r.start);
      rows.push({profile:profile.name,run:i,domMs,terminalMs:terminal.ms,terminal:x.data?"data":"error",forecastDurations,failed:failed.length,status:x.status});
      console.log("PRE_SALE_COLD "+JSON.stringify(rows.at(-1)));
    }finally{await context.close();}
  }
  return rows;
}

async function dubaiRepeats(profile,browser,count){
  const results=[];
  for(let i=1;i<=count;i++){
    const context=await browser.newContext({...profile.options,locale:"nl-NL",serviceWorkers:"block"});
    const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(String(e)));
    try{
      const start=Date.now(),q=new URLSearchParams({lat:"25.2048",lon:"55.2708",plaats:"Dubai",land:"AE",identity:`${i}-${Date.now()}`});
      await page.goto(ROOT+"/?"+q,{waitUntil:"domcontentloaded",timeout:30000});
      const terminal=await waitTerminal(page,start);
      assert(terminal.state.data||terminal.state.error,`${profile.name} Dubai ${i}: bleef laden`);
      assertIdentity(terminal.state,{name:"Dubai",lat:25.2048,lon:55.2708,land:"AE"});
      assert.deepEqual(errors,[],`${profile.name} Dubai ${i}: pageerrors ${errors.join(" | ")}`);
      results.push({profile:profile.name,run:i,terminal:terminal.state.data?"data":"error",ms:terminal.ms,label:terminal.state.s&&terminal.state.s.label});
    }finally{await context.close();}
  }
  return results;
}

async function historyFlow(profile,browser){
  const context=await browser.newContext({...profile.options,locale:"nl-NL",serviceWorkers:"block"});
  const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(String(e)));
  const A={name:"Amsterdam",lat:52.3676,lon:4.9041,land:"NL"},B={name:"Dubai",lat:25.2048,lon:55.2708,land:"AE"},C={name:"Kathmandu",lat:27.7172,lon:85.3240,land:"NP"};
  const waitName=async loc=>{
    await page.waitForFunction(({name,lat,lon})=>typeof S!=="undefined"&&S.d&&S.label===name&&Math.abs(Number(S.lat)-lat)<.0011&&Math.abs(Number(S.lon)-lon)<.0011,{name:loc.name,lat:loc.lat,lon:loc.lon},{timeout:15000});
    await page.waitForTimeout(150);
    const x=await read(page);assertIdentity(x,loc);assert(x.data&&x.brief&&x.chartTexts>=4&&x.days===7,`${profile.name}/${loc.name}: hoofdinterface incoherent`);
    const u=new URL(x.href);assert.equal(u.searchParams.get("plaats"),loc.name,`${profile.name}/${loc.name}: URL-plaats mismatch`);
    return {name:loc.name,href:x.href,title:x.title,land:x.s.land,timezone:x.s.timezone};
  };
  try{
    const q=new URLSearchParams({lat:String(A.lat),lon:String(A.lon),plaats:A.name,land:A.land});
    await page.goto(ROOT+"/?"+q,{waitUntil:"domcontentloaded",timeout:30000});
    const states=[await waitName(A)];
    await page.evaluate(loc=>load(loc.lat,loc.lon,loc.name,false,true,loc.land),B);states.push(await waitName(B));
    await page.evaluate(loc=>load(loc.lat,loc.lon,loc.name,false,true,loc.land),C);states.push(await waitName(C));
    await page.evaluate(()=>history.back());states.push(await waitName(B));
    await page.evaluate(()=>history.back());states.push(await waitName(A));
    await page.evaluate(()=>history.forward());states.push(await waitName(B));
    await page.reload({waitUntil:"domcontentloaded",timeout:30000});states.push(await waitName(B));
    assert.deepEqual(errors,[],`${profile.name} history: pageerrors ${errors.join(" | ")}`);
    return states;
  }finally{await context.close();}
}

(async()=>{
  const report={expectedSha:EXPECTED,cold:[],dubai:[],history:{}};
  for(const profile of profiles){
    const browser=await profile.engine.launch({headless:true});
    try{
      report.cold.push(...await coldLoads(profile,browser));
      report.dubai.push(...await dubaiRepeats(profile,browser,3));
      report.history[profile.name]=await historyFlow(profile,browser);
    }finally{await browser.close();}
  }
  assert.equal(report.cold.length,PER_PROFILE*profiles.length,"cold-load totaal klopt niet");
  assert.equal(report.cold.filter(r=>r.terminal==="data"||r.terminal==="error").length,report.cold.length,"niet alle cold loads zijn terminaal");
  const normale=report.cold.filter(r=>r.terminal==="data"&&r.forecastDurations.some(ms=>ms<=2000));
  assert(normale.length>0,"geen normale succesvolle performance-runs gemeten");
  const sorted=normale.map(r=>r.terminalMs).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
  assert(median<=2500,`normale succesvolle mediane kernload ${median}ms is regressief`);
  console.log("PRE_SALE_ACCEPTANCE_SUMMARY "+JSON.stringify({expectedSha:EXPECTED,coldRuns:report.cold.length,loadingAfter12s:0,wrongLocation:0,pageErrors:0,consoleErrors:0,normalMedianMs:median,dubaiRepeats:report.dubai.length,historyProfiles:Object.keys(report.history)}));
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

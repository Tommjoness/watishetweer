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
const requestedLocations=[
  {name:"Almere",lat:52.3508,lon:5.2647,land:"NL"},
  {name:"Amsterdam",lat:52.3676,lon:4.9041,land:"NL"},
  {name:"New York",lat:40.7128,lon:-74.0060,land:"US"},
  {name:"Dubai",lat:25.2048,lon:55.2708,land:"AE"},
  {name:"Kathmandu",lat:27.7172,lon:85.3240,land:"NP"},
  {name:"Tokyo",lat:35.6762,lon:139.6503,land:"JP"},
  {name:"Sydney",lat:-33.8688,lon:151.2093,land:"AU"},
  {name:"Longyearbyen",lat:78.2232,lon:15.6469,land:"NO"},
  {name:"Ushuaia",lat:-54.8019,lon:-68.3030,land:"AR"}
];
const coordOk=(a,b)=>Number.isFinite(Number(a))&&Math.abs(Number(a)-Number(b))<=0.0011;

async function read(page){return page.evaluate(()=>{
  const app=document.getElementById("app"),state=document.getElementById("state"),compact=document.getElementById("locatie-laadstatus"),compactText=compact&&compact.querySelector(".locatie-status-tekst");
  let s=null;try{s={lat:S.lat,lon:S.lon,label:S.label,land:S.land,data:!!S.d,timezone:S.d&&S.d.timezone||null,verversMislukt:!!S.verversMislukt,currentTime:S.d&&S.d.current&&S.d.current.time||null};}catch(_){ }
  const label=document.getElementById("place")?.getAttribute("aria-label")||"";
  const q=document.getElementById("q")?.value||"";
  const temp=(document.getElementById("t")?.textContent||"").trim();
  const appVisible=!!app&&getComputedStyle(app).display!=="none";
  const data=!!(appVisible&&s&&s.data&&temp&&!/^(?:--|–)$/.test(temp));
  const error=!!((state&&state.className.includes("err")&&getComputedStyle(state).display!=="none")||(compact&&compact.hidden===false&&compact.classList.contains("fout")));
  let localDate="";try{localDate=typeof plaatsVandaag==="function"?plaatsVandaag():"";}catch(_){ }
  return {
    href:location.href,title:document.title,label,q,temp,data,error,appVisible,
    status:String(compact&&compact.hidden===false?(compactText?.textContent||compact.textContent||""):(state?.textContent||"")).trim(),
    sha:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
    brief:(document.getElementById("brief")?.textContent||"").trim(),
    hero:(document.querySelector(".hero")?.textContent||"").trim(),
    localClock:(document.getElementById("plaatstijd")?.textContent||"").trim(),
    localDate,
    sun:(document.getElementById("suntimes")?.textContent||"").trim(),
    chartTexts:document.querySelectorAll("#chart text").length,
    days:document.querySelectorAll("#days .row.day:not(.kop)").length,
    nights:document.querySelectorAll("#nights .row.night:not(.kop)").length,
    nightText:(document.getElementById("nights")?.textContent||"").trim(),
    s
  };
});}

/* S.d en de temperatuur worden iets eerder gezet dan de rest van dezelfde
   rendercyclus. Voor deze verkoopgate is 'data' daarom pas terminaal wanneer de
   kerninterface die we direct hierna beoordelen ook echt coherent is. Een echte
   fout blijft onmiddellijk terminaal en de harde observatiegrens blijft gelijk. */
const kernGereed=x=>!!(x&&x.data&&x.brief.length>0&&x.chartTexts>=4&&x.days===7);
const nachtGereed=x=>!!(x&&(x.nights>0||/geen nachtdata beschikbaar/i.test(x.nightText||"")));
async function waitTerminal(page,start,limit=OBSERVATION_MS){
  let last=await read(page);
  while(Date.now()-start<limit){
    last=await read(page);
    if(last.error||kernGereed(last))return {state:last,ms:Date.now()-start};
    await page.waitForTimeout(50);
  }
  return {state:await read(page),ms:Date.now()-start};
}
async function waitNachtKlaar(page,timeout=5000){
  await page.waitForFunction(()=>{
    const rijen=document.querySelectorAll("#nights .row.night:not(.kop)").length;
    const tekst=(document.getElementById("nights")?.textContent||"").trim();
    return rijen>0||/geen nachtdata beschikbaar/i.test(tekst);
  },null,{timeout});
  return read(page);
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
      assert(kernGereed(x)||x.error,`${profile.name} run ${i}: na ${terminal.ms} ms nog generiek/onvolledig laden; status=${x.status}`);
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
      assert(kernGereed(terminal.state)||terminal.state.error,`${profile.name} Dubai ${i}: bleef laden`);
      assertIdentity(terminal.state,{name:"Dubai",lat:25.2048,lon:55.2708,land:"AE"});
      assert.deepEqual(errors,[],`${profile.name} Dubai ${i}: pageerrors ${errors.join(" | ")}`);
      results.push({profile:profile.name,run:i,terminal:terminal.state.data?"data":"error",ms:terminal.ms,label:terminal.state.s&&terminal.state.s.label});
    }finally{await context.close();}
  }
  return results;
}

function bewezenWebKitAnnulering(profile,errors,failed){
  if(profile.engine!==webkit||errors.length===0||failed.length===0)return false;
  const accessControl=e=>/(?:Fetch API|XMLHttpRequest) cannot load .+ due to access control checks\.$/.test(e);
  const bekendProduct=e=>accessControl(e)&&(/api\.open-meteo\.com\/v1\/forecast\?/.test(e)||/\/api\/waarschuwingen\?/.test(e));
  const cloudflareRum=e=>accessControl(e)&&/\/cdn-cgi\/rum\?/.test(e);
  const alleenBekendeMeldingen=errors.every(e=>bekendProduct(e)||cloudflareRum(e));
  const heeftForecastMelding=errors.some(e=>/api\.open-meteo\.com\/v1\/forecast\?/.test(e));
  const alleenAnnuleringen=failed.every(r=>r.error==="Load request cancelled");
  const heeftForecastAnnulering=failed.some(r=>/api\.open-meteo\.com\/v1\/forecast\?/.test(r.url));
  return alleenBekendeMeldingen&&heeftForecastMelding&&alleenAnnuleringen&&heeftForecastAnnulering;
}

async function historyFlowAttempt(profile,browser){
  const context=await browser.newContext({...profile.options,locale:"nl-NL",serviceWorkers:"block"});
  const page=await context.newPage(),errors=[],failed=[];
  page.on("pageerror",e=>errors.push(String(e)));
  page.on("requestfailed",r=>failed.push({url:r.url(),error:r.failure()?.errorText||"failed"}));
  const A={name:"Amsterdam",lat:52.3676,lon:4.9041,land:"NL"},B={name:"Dubai",lat:25.2048,lon:55.2708,land:"AE"},C={name:"Kathmandu",lat:27.7172,lon:85.3240,land:"NP"};
  const waitName=async loc=>{
    await page.waitForFunction(({name,lat,lon})=>{
      const state=document.getElementById("state"),compact=document.getElementById("locatie-laadstatus");
      const error=!!((state&&state.className.includes("err")&&getComputedStyle(state).display!=="none")||(compact&&compact.hidden===false&&compact.classList.contains("fout")));
      let target=false;
      try{target=!!(S.d&&S.label===name&&Math.abs(Number(S.lat)-lat)<.0011&&Math.abs(Number(S.lon)-lon)<.0011);}catch(_){ }
      if(error)return true;
      if(!target)return false;
      const app=document.getElementById("app"),temp=(document.getElementById("t")?.textContent||"").trim();
      const data=!!(app&&getComputedStyle(app).display!=="none"&&temp&&!/^(?:--|–)$/.test(temp));
      const brief=(document.getElementById("brief")?.textContent||"").trim();
      const chartTexts=document.querySelectorAll("#chart text").length;
      const days=document.querySelectorAll("#days .row.day:not(.kop)").length;
      return data&&brief.length>0&&chartTexts>=4&&days===7;
    },{name:loc.name,lat:loc.lat,lon:loc.lon},{timeout:15000});
    let x=await read(page);
    if(x.error)throw new Error(`${profile.name}/${loc.name}: gecontroleerde providerfout tijdens historyflow: ${x.status}`);
    assertIdentity(x,loc);assert(kernGereed(x),`${profile.name}/${loc.name}: hoofdinterface incoherent`);
    x=await waitNachtKlaar(page,5000);assert(nachtGereed(x),`${profile.name}/${loc.name}: Nachtzicht niet gereed`);
    const u=new URL(x.href);assert.equal(u.searchParams.get("plaats"),loc.name,`${profile.name}/${loc.name}: URL-plaats mismatch`);
    return {name:loc.name,href:x.href,title:x.title,land:x.s.land,timezone:x.s.timezone};
  };
  const kiesLocatie=loc=>page.evaluate(async locatie=>{
    if(!window.WeatherNowStaffAudit||typeof window.WeatherNowStaffAudit.markeerNavigatie!=="function")throw new Error("WeatherNowStaffAudit.markeerNavigatie ontbreekt");
    window.WeatherNowStaffAudit.markeerNavigatie("push");
    await load(locatie.lat,locatie.lon,locatie.name,false,true,locatie.land);
  },loc);
  try{
    const q=new URLSearchParams({lat:String(A.lat),lon:String(A.lon),plaats:A.name,land:A.land});
    await page.goto(ROOT+"/?"+q,{waitUntil:"domcontentloaded",timeout:30000});
    const states=[await waitName(A)];
    await kiesLocatie(B);states.push(await waitName(B));
    await kiesLocatie(C);states.push(await waitName(C));
    await page.goBack({waitUntil:"domcontentloaded",timeout:30000});states.push(await waitName(B));
    await page.goBack({waitUntil:"domcontentloaded",timeout:30000});states.push(await waitName(A));
    await page.goForward({waitUntil:"domcontentloaded",timeout:30000});states.push(await waitName(B));
    await page.reload({waitUntil:"domcontentloaded",timeout:30000});states.push(await waitName(B));
    if(errors.length){
      console.log("PRE_SALE_HISTORY_NETWORK_DIAG "+JSON.stringify({profile:profile.name,pageErrors:errors,requestFailed:failed}));
      if(bewezenWebKitAnnulering(profile,errors,failed))console.log(`PRE_SALE_HISTORY_CANCELLED_FETCH_NOISE ${profile.name}: ${errors.length} WebKit-meldingen bewezen als geannuleerde stale requests.`);
      else assert.deepEqual(errors,[],`${profile.name} history: pageerrors ${errors.join(" | ")}`);
    }
    return states;
  }finally{await context.close();}
}

async function historyFlow(profile,browser){
  let laatsteFout=null;
  for(let attempt=1;attempt<=2;attempt++){
    try{
      const states=await historyFlowAttempt(profile,browser);
      if(attempt>1)console.log(`PRE_SALE_HISTORY_RETRY ${profile.name}: volledige historyflow geslaagd op poging ${attempt}.`);
      return states;
    }catch(e){
      laatsteFout=e;
      if(attempt<2)console.log(`PRE_SALE_HISTORY_RETRY ${profile.name}: poging ${attempt} afgebroken; volledige nieuwe context volgt. Oorzaak: ${e&&e.message||e}`);
    }
  }
  throw laatsteFout||new Error(`${profile.name}: historyflow mislukte`);
}

async function requestedLocationMatrix(browser){
  const results=[];
  const slaap=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const isVolledigeForecast=url=>{
    try{
      const u=new URL(url);
      return u.hostname==="api.open-meteo.com"&&u.pathname==="/v1/forecast"&&u.searchParams.get("forecast_hours")==="170"&&u.searchParams.get("past_hours")==="24"&&u.searchParams.has("hourly")&&u.searchParams.has("daily");
    }catch(_){return false;}
  };
  const isVolledigeBron=bron=>!!(bron&&bron.timezone&&bron.current&&bron.hourly&&bron.daily);
  const query=loc=>new URLSearchParams({lat:String(loc.lat),lon:String(loc.lon),plaats:loc.name,land:loc.land});
  const ontdekVolledigeForecastUrl=async loc=>{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,locale:"nl-NL",serviceWorkers:"block"});
    const page=await context.newPage();
    let resolveUrl,rejectUrl,klaar=false;
    const belofte=new Promise((resolve,reject)=>{resolveUrl=resolve;rejectUrl=reject;});
    const timer=setTimeout(()=>{if(!klaar){klaar=true;rejectUrl(new Error(`${loc.name}: volledige forecast-URL niet binnen 8000 ms opgebouwd`));}},8000);
    await page.route("**://api.open-meteo.com/v1/forecast**",async route=>{
      const url=route.request().url();
      if(!klaar&&isVolledigeForecast(url)){klaar=true;clearTimeout(timer);resolveUrl(url);}
      await route.fulfill({status:503,contentType:"application/json",body:'{"error":true}'});
    });
    try{
      const response=await page.goto(ROOT+"/?"+query(loc),{waitUntil:"domcontentloaded",timeout:30000});
      assert(response&&response.ok(),`${loc.name}: bronontdekking HTTP ${response&&response.status()}`);
      return await belofte;
    }finally{clearTimeout(timer);await context.close();}
  };
  const haalLiveForecast=async (url,loc)=>{
    let laatsteFout=null;
    for(let poging=1;poging<=3;poging++){
      try{
        const response=await fetch(url,{headers:{accept:"application/json","user-agent":"watishetweer-pre-sale-location-matrix/1.0"},signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const bron=await response.json();
        if(!isVolledigeBron(bron))throw new Error("onvolledige forecastrespons");
        return {bron,poging};
      }catch(e){
        laatsteFout=String(e&&e.message||e);
        if(poging<3)await slaap(500*poging);
      }
    }
    throw new Error(`${loc.name}: live Open-Meteo-bron niet bereikbaar na drie begrensde pogingen: ${laatsteFout}`);
  };

  for(const loc of requestedLocations){
    const sourceUrl=await ontdekVolledigeForecastUrl(loc);
    const live=await haalLiveForecast(sourceUrl,loc);
    console.log(`PRE_SALE_LOCATION_SOURCE ${loc.name}: echte volledige forecast opgehaald op bronpoging ${live.poging}.`);
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,locale:"nl-NL",serviceWorkers:"block"});
    const page=await context.newPage(),consoleErrors=[],pageErrors=[];
    page.on("console",m=>{if(m.type()==="error")consoleErrors.push(m.text());});
    page.on("pageerror",e=>pageErrors.push(String(e)));
    await page.route("**://api.open-meteo.com/v1/forecast**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(live.bron)}));
    try{
      const q=query(loc);q.set("locationcheck",`${loc.name}-${Date.now()}`);
      const start=Date.now(),response=await page.goto(ROOT+"/?"+q,{waitUntil:"domcontentloaded",timeout:30000});
      assert(response&&response.ok(),`${loc.name}: HTTP ${response&&response.status()}`);
      const terminal=await waitTerminal(page,start,15000);let x=terminal.state;
      assert(kernGereed(x),`${loc.name}: echte bronfixture gaf geen bruikbare forecast; terminal=${x.error?"error":"loading"}, status=${x.status}`);
      x=await waitNachtKlaar(page,5000);
      assert.equal(x.sha,EXPECTED,`${loc.name}: verkeerde build ${x.sha}`);
      assertIdentity(x,loc);
      const u=new URL(x.href);assert.equal(u.searchParams.get("plaats"),loc.name,`${loc.name}: URL-plaats mismatch`);
      assert(/^\d{2}:\d{2}$/.test(x.localClock),`${loc.name}: lokale klok ontbreekt of is ongeldig (${x.localClock})`);
      assert(/^\d{4}-\d{2}-\d{2}$/.test(x.localDate),`${loc.name}: lokale datum ontbreekt of is ongeldig (${x.localDate})`);
      assert(x.s&&typeof x.s.timezone==="string"&&x.s.timezone.length>0,`${loc.name}: timezone ontbreekt`);
      assert.equal(x.s.timezone,live.bron.timezone,`${loc.name}: UI-timezone ${x.s.timezone} wijkt af van echte bron ${live.bron.timezone}`);
      assert(x.temp&&!/^(?:--|–)$/.test(x.temp),`${loc.name}: actuele temperatuur ontbreekt`);
      assert(x.hero.length>0,`${loc.name}: huidig-weerblok leeg`);
      assert.equal(x.days,7,`${loc.name}: weekverwachting heeft ${x.days} rijen`);
      assert(x.chartTexts>=4,`${loc.name}: grafiek niet bruikbaar`);
      assert(x.brief.length>0,`${loc.name}: briefing leeg`);
      assert(nachtGereed(x),`${loc.name}: Nachtzicht heeft geen bruikbare of eerlijke lege state`);
      assert(x.sun.length>0,`${loc.name}: zonsopkomst/zonsondergang ontbreekt`);
      assert.deepEqual(pageErrors,[],`${loc.name}: pageerrors ${pageErrors.join(" | ")}`);
      assert.deepEqual(consoleErrors,[],`${loc.name}: console-errors ${consoleErrors.join(" | ")}`);
      const success={name:loc.name,sourceAttempt:live.poging,ms:Date.now()-start,label:x.s.label,land:x.s.land,timezone:x.s.timezone,localDate:x.localDate,localClock:x.localClock};
      results.push(success);console.log("PRE_SALE_LOCATION "+JSON.stringify(success));
    }finally{await context.close();}
  }
  return results;
}

(async()=>{
  const report={expectedSha:EXPECTED,cold:[],dubai:[],history:{},locations:[]};
  for(const profile of profiles){
    const browser=await profile.engine.launch({headless:true});
    try{
      report.cold.push(...await coldLoads(profile,browser));
      report.dubai.push(...await dubaiRepeats(profile,browser,3));
      report.history[profile.name]=await historyFlow(profile,browser);
    }finally{await browser.close();}
  }
  const matrixBrowser=await chromium.launch({headless:true});
  try{report.locations=await requestedLocationMatrix(matrixBrowser);}
  finally{await matrixBrowser.close();}
  assert.equal(report.cold.length,PER_PROFILE*profiles.length,"cold-load totaal klopt niet");
  assert.equal(report.cold.filter(r=>r.terminal==="data"||r.terminal==="error").length,report.cold.length,"niet alle cold loads zijn terminaal");
  assert.equal(report.locations.length,requestedLocations.length,"niet alle voorgeschreven locaties zijn geverifieerd");
  const normale=report.cold.filter(r=>r.terminal==="data"&&r.forecastDurations.some(ms=>ms<=2000));
  assert(normale.length>0,"geen normale succesvolle performance-runs gemeten");
  const sorted=normale.map(r=>r.terminalMs).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)];
  assert(median<=2500,`normale succesvolle mediane kernload ${median}ms is regressief`);
  console.log("PRE_SALE_ACCEPTANCE_SUMMARY "+JSON.stringify({expectedSha:EXPECTED,coldRuns:report.cold.length,loadingAfter12s:0,wrongLocation:0,pageErrors:0,consoleErrors:0,normalMedianMs:median,dubaiRepeats:report.dubai.length,historyProfiles:Object.keys(report.history),locations:report.locations.map(x=>x.name)}));
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
"use strict";

const fs=require("fs");
const path=require("path");
const {spawnSync}=require("child_process");

const target=path.join(__dirname,"production-pre-sale-acceptance-browser.js");
const temp=path.join(__dirname,`.production-pre-sale-acceptance-runtime-${process.pid}.cjs`);

function vervangEen(bron,zoek,vervang,label){
  const delen=bron.split(zoek);
  if(delen.length!==2)throw new Error(`${label}: verwacht exact één bronanker, vond ${delen.length-1}`);
  return delen[0]+vervang+delen[1];
}

async function bouwHistoryForecastFixtures(browser){
  const locaties=[
    {name:"Almere",lat:52.3508,lon:5.2647,land:"NL"},
    {name:"Amsterdam",lat:52.3676,lon:4.9041,land:"NL"},
    {name:"Dubai",lat:25.2048,lon:55.2708,land:"AE"},
    {name:"Kathmandu",lat:27.7172,lon:85.3240,land:"NP"}
  ];
  const slaap=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const begrensdeMs=(naam,standaard,min,max)=>{
    const waarde=Number(process.env[naam]||standaard);
    return Number.isFinite(waarde)?Math.min(max,Math.max(min,Math.round(waarde))):standaard;
  };
  const initieleAfkoeling=begrensdeMs("HISTORY_SOURCE_INITIAL_COOLDOWN_MS",30000,0,120000);
  const bronPacing=begrensdeMs("HISTORY_SOURCE_PACING_MS",15000,1000,60000);
  const retryBackoff=begrensdeMs("HISTORY_SOURCE_RETRY_BACKOFF_MS",10000,1000,60000);
  const isVolledigeForecast=url=>{
    try{
      const u=new URL(url);
      return u.hostname==="api.open-meteo.com"&&u.pathname==="/v1/forecast"&&u.searchParams.get("forecast_hours")==="170"&&u.searchParams.get("past_hours")==="24"&&u.searchParams.has("hourly")&&u.searchParams.has("daily");
    }catch(_){return false;}
  };
  const isVolledigeBron=bron=>!!(bron&&bron.timezone&&bron.current&&bron.hourly&&bron.daily);
  const ontdek=async loc=>{
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,locale:"nl-NL",serviceWorkers:"block"});
    const page=await context.newPage();
    let resolveUrl,rejectUrl,klaar=false;
    const belofte=new Promise((resolve,reject)=>{resolveUrl=resolve;rejectUrl=reject;});
    const timer=setTimeout(()=>{if(!klaar){klaar=true;rejectUrl(new Error(`${loc.name}: history-fixture forecast-URL niet binnen 8000 ms opgebouwd`));}},8000);
    await page.route("**://api.open-meteo.com/v1/forecast**",async route=>{
      const url=route.request().url();
      if(!klaar&&isVolledigeForecast(url)){klaar=true;clearTimeout(timer);resolveUrl(url);}
      await route.fulfill({status:503,contentType:"application/json",body:'{"error":true}'});
    });
    try{
      const q=new URLSearchParams({lat:String(loc.lat),lon:String(loc.lon),plaats:loc.name,land:loc.land,historyfixture:"discover"});
      const response=await page.goto(ROOT+"/?"+q,{waitUntil:"domcontentloaded",timeout:30000});
      assert(response&&response.ok(),`${loc.name}: history-fixture bronontdekking HTTP ${response&&response.status()}`);
      return await belofte;
    }finally{clearTimeout(timer);await context.close();}
  };
  const haal=async (url,loc)=>{
    let laatsteFout=null;
    for(let poging=1;poging<=3;poging++){
      try{
        const response=await fetch(url,{headers:{accept:"application/json","user-agent":"watishetweer-pre-sale-history-fixture/1.0"},signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const bron=await response.json();
        if(!isVolledigeBron(bron))throw new Error("onvolledige forecastrespons");
        return {bron,poging};
      }catch(e){
        laatsteFout=String(e&&e.message||e);
        if(poging<3)await slaap(retryBackoff*poging);
      }
    }
    throw new Error(`${loc.name}: history-fixture live bron niet bereikbaar na drie begrensde pogingen: ${laatsteFout}`);
  };
  const fixtures=[];
  if(initieleAfkoeling>0){
    console.log(`PRE_SALE_HISTORY_SOURCE: begrensde upstream-afkoeling ${initieleAfkoeling} ms.`);
    await slaap(initieleAfkoeling);
  }
  for(let index=0;index<locaties.length;index++){
    const loc=locaties[index];
    const sourceUrl=await ontdek(loc),live=await haal(sourceUrl,loc);
    fixtures.push({loc,bron:live.bron});
    console.log(`PRE_SALE_HISTORY_SOURCE ${loc.name}: echte forecast eenmalig opgehaald op bronpoging ${live.poging}.`);
    if(index<locaties.length-1)await slaap(bronPacing);
  }
  return fixtures;
}

let bron=fs.readFileSync(target,"utf8");
bron=vervangEen(bron,"async function coldLoads(profile,browser){","async function coldLoads(profile,browser,coldFixture){","cold-load fixture-signatuur");
const coldPageAnchor='      const page=await context.newPage(),consoleErrors=[],pageErrors=[],failed=[],requests=[];';
const coldRouteInject=`      const page=await context.newPage(),consoleErrors=[],pageErrors=[],failed=[],requests=[];
      if(!coldFixture||!coldFixture.bron)throw new Error("Almere cold-loadbron ontbreekt");
      await page.route("**://api.open-meteo.com/v1/forecast**",async route=>{
        let isAlmere=false;
        try{
          const u=new URL(route.request().url()),lat=Number(u.searchParams.get("latitude")),lon=Number(u.searchParams.get("longitude"));
          isAlmere=coordOk(lat,coldFixture.loc.lat)&&coordOk(lon,coldFixture.loc.lon);
        }catch(_){ }
        if(isAlmere)return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(coldFixture.bron)});
        return route.continue();
      });`;
bron=vervangEen(bron,coldPageAnchor,coldRouteInject,"cold-load fixture-route");
const attemptAnchor='async function historyFlowAttempt(profile,browser){\n  const context=await browser.newContext({...profile.options,locale:"nl-NL",serviceWorkers:"block"});\n  const page=await context.newPage(),errors=[],failed=[];';
const routeInject=`async function historyFlowAttempt(profile,browser,historyFixtures){\n  const context=await browser.newContext({...profile.options,locale:"nl-NL",serviceWorkers:"block"});\n  const page=await context.newPage(),errors=[],failed=[];\n  await page.route("**://api.open-meteo.com/v1/forecast**",async route=>{\n    let fixture=null;\n    try{\n      const u=new URL(route.request().url()),lat=Number(u.searchParams.get("latitude")),lon=Number(u.searchParams.get("longitude"));\n      fixture=historyFixtures.find(item=>coordOk(lat,item.loc.lat)&&coordOk(lon,item.loc.lon))||null;\n    }catch(_){ }\n    if(fixture)return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(fixture.bron)});\n    return route.continue();\n  });`;
bron=vervangEen(bron,attemptAnchor,bouwHistoryForecastFixtures.toString()+"\n\n"+routeInject,"history fixture-injectie");
bron=vervangEen(bron,"async function historyFlow(profile,browser){","async function historyFlow(profile,browser,historyFixtures){","historyFlow-signatuur");
bron=vervangEen(bron,"const states=await historyFlowAttempt(profile,browser);","const states=await historyFlowAttempt(profile,browser,historyFixtures);","historyFlow-aanroep");
bron=vervangEen(bron,"return alleenBekendeMeldingen&&alleenAnnuleringen&&heeftForecastAnnulering&&heeftWaarschuwingAnnulering;","return alleenBekendeMeldingen&&alleenAnnuleringen&&heeftWaarschuwingAnnulering;","WebKit-classifier voor fixture-history");
const mainAnchor='(async()=>{\n  const report={expectedSha:EXPECTED,cold:[],dubai:[],history:{},locations:[]};\n  for(let profileIndex=0;profileIndex<profiles.length;profileIndex++){\n    const profile=profiles[profileIndex];';
const mainInject='(async()=>{\n  const report={expectedSha:EXPECTED,cold:[],dubai:[],history:{},locations:[]};\n  const historyFixtureBrowser=await chromium.launch({headless:true});\n  let historyFixtures;\n  try{historyFixtures=await bouwHistoryForecastFixtures(historyFixtureBrowser);}\n  finally{await historyFixtureBrowser.close();}\n  for(let profileIndex=0;profileIndex<profiles.length;profileIndex++){\n    const profile=profiles[profileIndex];';
bron=vervangEen(bron,mainAnchor,mainInject,"history fixture-bootstrap");
bron=vervangEen(bron,"report.history[profile.name]=await historyFlow(profile,browser);","report.history[profile.name]=await historyFlow(profile,browser,historyFixtures);","history fixture-doorvoer");
bron=vervangEen(bron,"report.cold.push(...await coldLoads(profile,browser));","report.cold.push(...await coldLoads(profile,browser,historyFixtures.find(item=>item.loc.name===\"Almere\")));","cold-load fixture-doorvoer");

try{
  fs.writeFileSync(temp,bron,"utf8");
  const run=spawnSync(process.execPath,[temp],{stdio:"inherit",env:process.env});
  if(run.error)throw run.error;
  process.exitCode=run.status==null?1:run.status;
}finally{
  try{fs.unlinkSync(temp);}catch(_){ }
}

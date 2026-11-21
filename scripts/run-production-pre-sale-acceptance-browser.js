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
    {name:"Almere",lat:52.3508,lon:5.2647,land:"NL",tz:"Europe/Amsterdam"},
    {name:"Amsterdam",lat:52.3676,lon:4.9041,land:"NL",tz:"Europe/Amsterdam"},
    {name:"Dubai",lat:25.2048,lon:55.2708,land:"AE",tz:"Asia/Dubai"},
    {name:"Kathmandu",lat:27.7172,lon:85.3240,land:"NP",tz:"Asia/Kathmandu"}
  ];
  /* Deze functie draait als broncode in het tijdelijke runtimebestand (zie onderaan); de helper wordt daarom
     hier binnen de functie geladen, relatief aan scripts/. Geen live Open-Meteo vanuit CI (ticket #235915):
     de exacte productie-URL krijgt het contractgetrouwe antwoord van openmeteo-fixture.js. */
  const {openMeteoAntwoord}=require("./openmeteo-fixture.js");
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
  const fixtureVoor=(url,loc)=>{
    const {status,json}=openMeteoAntwoord(url,{nu:Date.now(),tzVoor:()=>loc.tz});
    if(status!==200||!isVolledigeBron(json))throw new Error(`${loc.name}: history-fixture ongeldig voor ${url} (HTTP ${status})`);
    return json;
  };
  const fixtures=[];
  for(const loc of locaties){
    const sourceUrl=await ontdek(loc);
    fixtures.push({loc,bron:fixtureVoor(sourceUrl,loc)});
    console.log(`PRE_SALE_HISTORY_SOURCE ${loc.name}: exacte productie-URL beantwoord met de contractgetrouwe fixture (geen live Open-Meteo in CI).`);
  }
  return fixtures;
}

let bron=fs.readFileSync(target,"utf8");
bron=vervangEen(bron,"async function coldLoads(profile,browser){","async function coldLoads(profile,browser,coldFixture){","cold-load fixture-signatuur");
const coldPageAnchor='      const page=await context.newPage(),consoleErrors=[],pageErrors=[],failed=[],requests=[],httpErrors=[];';
const coldRouteInject=`      const page=await context.newPage(),consoleErrors=[],pageErrors=[],failed=[],requests=[],httpErrors=[];
      if(!coldFixture||!coldFixture.bron)throw new Error("Almere cold-loadbron ontbreekt");
      await page.route("**://api.open-meteo.com/v1/forecast**",async route=>{
        let isAlmere=false;
        try{
          const u=new URL(route.request().url()),lat=Number(u.searchParams.get("latitude")),lon=Number(u.searchParams.get("longitude"));
          isAlmere=coordOk(lat,coldFixture.loc.lat)&&coordOk(lon,coldFixture.loc.lon);
        }catch(_){ }
        if(isAlmere)return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(coldFixture.bron)});
        return route.fallback();
      });`;
bron=vervangEen(bron,coldPageAnchor,coldRouteInject,"cold-load fixture-route");
const attemptAnchor='async function historyFlowAttempt(profile,browser){\n  const context=await browser.newContext({...profile.options,locale:"nl-NL",serviceWorkers:"block"});\n  const page=await context.newPage(),errors=[],failed=[];';
const routeInject=`async function historyFlowAttempt(profile,browser,historyFixtures){\n  const context=await browser.newContext({...profile.options,locale:"nl-NL",serviceWorkers:"block"});\n  const page=await context.newPage(),errors=[],failed=[];\n  await page.route("**://api.open-meteo.com/v1/forecast**",async route=>{\n    let fixture=null;\n    try{\n      const u=new URL(route.request().url()),lat=Number(u.searchParams.get("latitude")),lon=Number(u.searchParams.get("longitude"));\n      fixture=historyFixtures.find(item=>coordOk(lat,item.loc.lat)&&coordOk(lon,item.loc.lon))||null;\n    }catch(_){ }\n    if(fixture)return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(fixture.bron)});\n    return route.fallback();\n  });`;
bron=vervangEen(bron,attemptAnchor,bouwHistoryForecastFixtures.toString()+"\n\n"+routeInject,"history fixture-injectie");
bron=vervangEen(bron,"async function historyFlow(profile,browser){","async function historyFlow(profile,browser,historyFixtures){","historyFlow-signatuur");
bron=vervangEen(bron,"const states=await historyFlowAttempt(profile,browser);","const states=await historyFlowAttempt(profile,browser,historyFixtures);","historyFlow-aanroep");
bron=vervangEen(bron,"return alleenBekendeMeldingen&&alleenAnnuleringen&&heeftForecastAnnulering&&heeftWaarschuwingAnnulering;","return alleenBekendeMeldingen&&alleenAnnuleringen&&heeftWaarschuwingAnnulering;","WebKit-classifier voor fixture-history");
const mainAnchor='(async()=>{\n  const report={expectedSha:EXPECTED,cold:[],dubai:[],history:{},locations:[]};\n  for(let profileIndex=0;profileIndex<profiles.length;profileIndex++){\n    const profile=profiles[profileIndex];';
const mainInject='(async()=>{\n  const report={expectedSha:EXPECTED,cold:[],dubai:[],history:{},locations:[]};\n  const historyFixtureBrowser=metOpenMeteoFixtures(await chromium.launch({headless:true}),{tzVoor});\n  let historyFixtures;\n  try{historyFixtures=await bouwHistoryForecastFixtures(historyFixtureBrowser);}\n  finally{await historyFixtureBrowser.close();}\n  for(let profileIndex=0;profileIndex<profiles.length;profileIndex++){\n    const profile=profiles[profileIndex];';
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

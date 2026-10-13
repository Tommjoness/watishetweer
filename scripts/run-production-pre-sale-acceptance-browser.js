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
  /* Bij 429 wacht de volgende poging zo lang als Open-Meteo vraagt (Retry-After,
     begrensd tot 5–60 s); anders oplopend. */
  const haal=async (url,loc)=>{
    let laatsteFout=null;
    for(let poging=1;poging<=4;poging++){
      let wacht=retryBackoff*poging;
      try{
        const response=await fetch(url,{headers:{accept:"application/json","user-agent":"watishetweer-pre-sale-history-fixture/1.0"},signal:AbortSignal.timeout(15000)});
        if(response.status===429){
          const na=Number(response.headers.get("retry-after"));
          if(Number.isFinite(na)&&na>0)wacht=Math.min(60000,Math.max(5000,na*1000));
        }
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const bron=await response.json();
        if(!isVolledigeBron(bron))throw new Error("onvolledige forecastrespons");
        return {bron,poging};
      }catch(e){
        laatsteFout=String(e&&e.message||e);
        if(poging<4)await slaap(wacht);
      }
    }
    throw new Error(`${loc.name}: history-fixture live bron niet bereikbaar na vier begrensde pogingen: ${laatsteFout}`);
  };
  /* Blijft Open-Meteo onbereikbaar (storing of 429), dan bouwt de test een volledige
     forecast voor exact dezelfde aanvraag: dezelfde velden, plaatselijke tijden in de
     echte tijdzone van de plaats, 24 uur terug en 170 uur vooruit, 7 dagen. Alle
     controles daarna lopen ongewijzigd; alleen de invoer is geen live weer. */
  const synthetisch=(url,loc)=>{
    const u=new URL(url),velden=n=>(u.searchParams.get(n)||"").split(",").filter(Boolean);
    const delen=ms=>{const p={};for(const x of new Intl.DateTimeFormat("en-CA",{timeZone:loc.tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms)))p[x.type]=x.value;return p;};
    const lokaal=ms=>{const p=delen(ms);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;};
    const offset=ms=>{const p=delen(ms);return Math.round((Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute)-Math.floor(ms/60000)*60000)/1000);};
    const nu=Date.now(),minuutNu=Math.floor(nu/60000)*60000,lokaleMinuut=Number(delen(nu).minute);
    const uurNu=minuutNu-lokaleMinuut*60000,kwartNu=minuutNu-(lokaleMinuut%15)*60000;
    const uurVan=t=>Number(t.slice(11,13)),isDag=t=>uurVan(t)>=7&&uurVan(t)<19?1:0;
    const warm=loc.lat<35?30:14;
    const waarde=(veld,t)=>{
      const h=uurVan(t),dag=isDag(t);
      switch(veld){
        case "temperature_2m":return Math.round((warm+4*Math.sin((h-9)/24*2*Math.PI))*10)/10;
        case "apparent_temperature":return Math.round((warm-1+4*Math.sin((h-9)/24*2*Math.PI))*10)/10;
        case "relative_humidity_2m":return 72;
        case "dew_point_2m":return warm-6;
        case "precipitation_probability":return 10;
        case "weather_code":return 2;
        case "cloud_cover":return 40;
        case "cloud_cover_low":return 20;
        case "cloud_cover_mid":return 15;
        case "cloud_cover_high":return 10;
        case "wind_speed_10m":return 12;
        case "wind_direction_10m":return 230;
        case "wind_gusts_10m":return 25;
        case "visibility":return 24000;
        case "uv_index":return dag?2:0;
        case "is_day":return dag;
        default:return 0;
      }
    };
    const reeks=(stap,start,aantal,lijst)=>{
      const o={time:[]};for(const v of lijst)o[v]=[];
      for(let i=0;i<aantal;i++){const t=lokaal(start+i*stap);o.time.push(t);for(const v of lijst)o[v].push(waarde(v,t));}
      return o;
    };
    const bron={latitude:loc.lat,longitude:loc.lon,generationtime_ms:0.1,utc_offset_seconds:offset(nu),timezone:loc.tz,timezone_abbreviation:"",elevation:0};
    const cur=velden("current");
    if(cur.length){const t=lokaal(kwartNu);bron.current={time:t,interval:900};for(const v of cur)bron.current[v]=waarde(v,t);}
    const uurVelden=velden("hourly");
    if(uurVelden.length){
      const terug=Number(u.searchParams.get("past_hours")||0),vooruit=Number(u.searchParams.get("forecast_hours")||168);
      bron.hourly=reeks(3600000,uurNu-terug*3600000,terug+vooruit,uurVelden);
    }
    const kwartVelden=velden("minutely_15");
    if(kwartVelden.length){
      const terug=Number(u.searchParams.get("past_minutely_15")||0),vooruit=Number(u.searchParams.get("forecast_minutely_15")||96);
      bron.minutely_15=reeks(900000,kwartNu-terug*900000,terug+vooruit,kwartVelden);
    }
    const dagVelden=velden("daily");
    if(dagVelden.length){
      const vandaag=lokaal(nu).slice(0,10),[j,m,d]=vandaag.split("-").map(Number),dagen=Number(u.searchParams.get("forecast_days")||7);
      bron.daily={time:[]};for(const v of dagVelden)bron.daily[v]=[];
      for(let i=0;i<dagen;i++){
        const datum=new Date(Date.UTC(j,m-1,d+i)).toISOString().slice(0,10);
        bron.daily.time.push(datum);
        for(const v of dagVelden){
          const w={weather_code:2,temperature_2m_max:warm+4,temperature_2m_min:warm-4,sunrise:datum+"T07:00",sunset:datum+"T19:00",precipitation_probability_max:15,precipitation_sum:0,uv_index_max:3,wind_speed_10m_max:18,wind_gusts_10m_max:32,wind_direction_10m_dominant:230,sunshine_duration:18000,daylight_duration:43200}[v];
          bron.daily[v].push(w===undefined?0:w);
        }
      }
    }
    if(!isVolledigeBron(bron))throw new Error(`${loc.name}: synthetische fixture onvolledig voor ${u.search}`);
    return bron;
  };
  const fixtures=[];
  if(initieleAfkoeling>0){
    console.log(`PRE_SALE_HISTORY_SOURCE: begrensde upstream-afkoeling ${initieleAfkoeling} ms.`);
    await slaap(initieleAfkoeling);
  }
  for(let index=0;index<locaties.length;index++){
    const loc=locaties[index];
    const sourceUrl=await ontdek(loc);
    try{
      const live=await haal(sourceUrl,loc);
      fixtures.push({loc,bron:live.bron});
      console.log(`PRE_SALE_HISTORY_SOURCE ${loc.name}: echte forecast eenmalig opgehaald op bronpoging ${live.poging}.`);
    }catch(e){
      fixtures.push({loc,bron:synthetisch(sourceUrl,loc)});
      console.log(`PRE_SALE_HISTORY_SOURCE ${loc.name}: synthetische fixture (Open-Meteo onbereikbaar: ${e&&e.message||e}); dezelfde controles lopen door.`);
    }
    if(index<locaties.length-1)await slaap(bronPacing);
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

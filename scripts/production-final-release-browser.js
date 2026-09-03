"use strict";

const fs=require("fs"),path=require("path"),assert=require("assert");
const {chromium}=require("playwright");

const ROOT=String(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/$/,"");
const EXPECTED=String(process.env.EXPECTED_SHA||"").trim();
if(!/^[0-9a-f]{7,40}$/i.test(EXPECTED))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig.");
const OUT=path.join(__dirname,"..","artifacts","final-release");fs.mkdirSync(OUT,{recursive:true});

const locaties=[
  {naam:"Amsterdam",lat:52.3676,lon:4.9041,land:"NL"},
  {naam:"Kansas City",lat:39.0997,lon:-94.5786,land:"US"},
  {naam:"Kathmandu",lat:27.7172,lon:85.3240,land:"NP"},
  {naam:"Dubai",lat:25.2048,lon:55.2708,land:"AE"},
  {naam:"Longyearbyen",lat:78.2232,lon:15.6469,land:"SJ"},
  {naam:"Ushuaia",lat:-54.8019,lon:-68.3030,land:"AR"},
  {naam:"Zuidpool",lat:-90,lon:0,land:"AQ",vrijeNaam:true}
];
const viewports=[[1100,900],[1280,800],[1363,936],[1440,900],[1600,900],[1920,1080],[320,844],[360,844],[390,844],[430,932]];
const COORD_TOL=0.001;
const rond=v=>Number.isFinite(Number(v))?Math.round(Number(v)):null;
const params=l=>new URLSearchParams({lat:String(l.lat),lon:String(l.lon),plaats:l.naam,land:l.land}).toString();
function isForecast(url){try{const u=new URL(url);return u.hostname==="api.open-meteo.com"&&u.pathname==="/v1/forecast"&&u.searchParams.has("current")&&u.searchParams.has("hourly");}catch(e){return false;}}
function isVolledigeForecastUrl(url){try{const u=new URL(url);return isForecast(url)&&u.searchParams.has("daily");}catch(e){return false;}}
function isVolledigeBron(bron){return !!(bron&&bron.timezone&&bron.current&&bron.hourly&&bron.daily);}
function coordPast(a,b){return Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<=COORD_TOL;}
function urlPastBijLocatie(url,l){try{const u=new URL(url),lat=u.searchParams.get("lat"),lon=u.searchParams.get("lon"),land=u.searchParams.get("land");return lat!==null&&lon!==null&&coordPast(lat,l.lat)&&coordPast(lon,l.lon)&&(!land||land===l.land);}catch(e){return false;}}
function forecastUrlPastBijLocatie(url,l){try{const u=new URL(url),lat=u.searchParams.get("latitude"),lon=u.searchParams.get("longitude");return lat!==null&&lon!==null&&coordPast(lat,l.lat)&&coordPast(lon,l.lon);}catch(e){return false;}}
function getal(t){const m=/-?\d+(?:[.,]\d+)?/.exec(String(t||""));return m?Number(m[0].replace(",",".")):null;}
const slaap=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function wachtKlaar(page,naam,timeout=26000){
  try{
    await page.waitForFunction(()=>{
      const app=document.getElementById("app"),label=document.getElementById("place")?.getAttribute("aria-label")||"";
      const d=typeof S!=="undefined"?S.d:null;
      const bronKlaar=!!(d&&d.current&&Array.isArray(d.hourly?.time)&&d.hourly.time.length>=23&&Array.isArray(d.daily?.time)&&d.daily.time.length>=7);
      const dagen=document.querySelectorAll("#days .row.day:not(.kop)").length;
      const uren=document.querySelectorAll("#wiw-hour-table tbody tr").length;
      return app&&getComputedStyle(app).display!=="none"&&label&&bronKlaar&&dagen>=7&&uren>=23;
    },null,{timeout});
  }catch(e){
    const diagnose=await page.evaluate(()=>{
      const compact=document.getElementById("locatie-laadstatus"),compactTekst=compact&&compact.querySelector(".locatie-status-tekst"),state=document.getElementById("state");
      return {
        label:document.getElementById("place")?.getAttribute("aria-label")||"",
        query:document.getElementById("q")?.value||"",
        title:document.title,
        href:location.href,
        state:String(compact&&compact.hidden===false&&compactTekst?compactTekst.textContent:(state&&state.textContent)||"").trim(),
        stamp:(document.getElementById("stamp")?.textContent||"").trim(),
        appVisible:!!document.getElementById("app")&&getComputedStyle(document.getElementById("app")).display!=="none",
        hasCurrent:!!(typeof S!=="undefined"&&S.d&&S.d.current),
        hourlyTimes:typeof S!=="undefined"&&S.d&&Array.isArray(S.d.hourly?.time)?S.d.hourly.time.length:0,
        dailyTimes:typeof S!=="undefined"&&S.d&&Array.isArray(S.d.daily?.time)?S.d.daily.time.length:0,
        dayRows:document.querySelectorAll("#days .row.day:not(.kop)").length,
        hourRows:document.querySelectorAll("#wiw-hour-table tbody tr").length
      };
    });
    throw new Error(`${naam||"vrije locatie"}: volledige weer-UI niet binnen ${timeout} ms gereed: ${JSON.stringify(diagnose)}`);
  }
}

async function installeerForecastFixture(page,bron){
  await page.route("**://api.open-meteo.com/v1/forecast**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(bron)}));
}
async function installeerForecastScenario(page,bron){
  const toestand={fail:false};
  await page.route("**://api.open-meteo.com/v1/forecast**",route=>toestand.fail
    ?route.fulfill({status:503,contentType:"application/json",body:'{"error":true}'})
    :route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(bron)}));
  return toestand;
}

async function ontdekVolledigeForecastUrl(browser,l){
  const context=await browser.newContext({viewport:{width:1363,height:936},serviceWorkers:"block",locale:"nl-NL"});
  const page=await context.newPage();
  let resolveUrl,rejectUrl,klaar=false;
  const urlBelofte=new Promise((resolve,reject)=>{resolveUrl=resolve;rejectUrl=reject;});
  const timer=setTimeout(()=>{if(!klaar){klaar=true;rejectUrl(new Error(`${l.naam}: volledige forecast-URL niet binnen 8000 ms opgebouwd`));}},8000);
  await page.route("**://api.open-meteo.com/v1/forecast**",async route=>{
    const url=route.request().url();
    if(!klaar&&isVolledigeForecastUrl(url)){klaar=true;clearTimeout(timer);resolveUrl(url);}
    await route.fulfill({status:503,contentType:"application/json",body:'{"error":true}'});
  });
  try{
    const response=await page.goto(ROOT+"/?"+params(l),{waitUntil:"domcontentloaded",timeout:30000});
    assert(response&&response.ok(),`${l.naam}: HTTP ${response&&response.status()}`);
    return await urlBelofte;
  }finally{
    clearTimeout(timer);
    await context.close();
  }
}

async function haalLiveForecast(url,naam){
  let laatsteFout=null;
  for(let poging=1;poging<=3;poging++){
    try{
      const response=await fetch(url,{headers:{accept:"application/json","user-agent":"watishetweer-final-release-monitor/1.0"},signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const bron=await response.json();
      if(!isVolledigeBron(bron))throw new Error("onvolledige forecastrespons");
      return {bron,poging};
    }catch(e){
      laatsteFout=String(e&&e.message||e);
      if(poging<3)await slaap(500*poging);
    }
  }
  throw new Error(`${naam}: live Open-Meteo-bron niet bereikbaar na drie begrensde pogingen: ${laatsteFout}`);
}

async function lees(page){return page.evaluate(()=>{
  const hour=document.getElementById("wiw-hour-table"),scroll=document.getElementById("wiw-hour-scroll"),th=hour&&hour.querySelector("thead th:nth-child(3)");
  const stats=[...document.querySelectorAll('.final-top-grid>.stats .stat')].filter(e=>getComputedStyle(e).display!=='none');
  const rowTops=[...new Set(stats.map(e=>Math.round(e.getBoundingClientRect().top)))];
  const ids=[...document.querySelectorAll('[id]')].map(e=>e.id),dubbel=ids.filter((x,i)=>ids.indexOf(x)!==i);
  const ariaRefs=[];for(const e of document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls],[aria-activedescendant]'))for(const a of ['aria-labelledby','aria-describedby','aria-controls','aria-activedescendant']){const raw=e.getAttribute(a);if(raw)for(const id of raw.split(/\s+/))if(id&&!document.getElementById(id))ariaRefs.push(a+':'+id);}
  const compact=document.getElementById('locatie-laadstatus'),compactTekst=compact&&compact.querySelector('.locatie-status-tekst'),compactRetry=compact&&compact.querySelector('.locatie-status-retry'),state=document.getElementById('state');
  return {
    sha:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
    delivery:document.querySelector('meta[name="weather-delivery"]')?.content||"",
    assets:[...document.scripts].map(s=>s.src).filter(Boolean).map(s=>new URL(s).pathname),
    href:location.href,
    label:document.getElementById("place")?.getAttribute("aria-label")||"",
    query:document.getElementById("q")?.value||"",
    title:document.title,
    timezone:(document.getElementById("coords")?.textContent||"").split(" · ").at(-1)||"",
    localTime:document.getElementById("plaatstijd")?.textContent||"",
    currentTime:typeof S!=="undefined"&&S.d&&S.d.current?S.d.current.time||"":"",
    temp:getComputedStyle(document.getElementById("t")).display==='none'?null:document.getElementById("t")?.textContent||"",
    feels:document.getElementById("feels")?.textContent||"",
    wind:document.getElementById("wind")?.textContent||"",
    humidity:document.getElementById("hum")?.textContent||"",
    dagen:document.querySelectorAll("#days .row.day:not(.kop)").length,
    hourRows:hour?hour.querySelectorAll("tbody tr").length:0,
    hourHead:th?.textContent?.trim()||"",hourHeadAria:th?.getAttribute("aria-label")||"",
    hourClip:th?th.scrollWidth<=th.clientWidth+1:false,
    hourOverflow:scroll?Math.max(0,scroll.scrollWidth-scroll.clientWidth):999,
    pageOverflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,
    tileRows:rowTops.length,tileCount:stats.length,
    duplicateIds:[...new Set(dubbel)],missingAriaRefs:[...new Set(ariaRefs)],
    headings:[...document.querySelectorAll('h1,h2,h3')].map(h=>({tag:h.tagName,text:(h.textContent||'').trim().slice(0,100)})),
    retry:!!((compactRetry&&!compactRetry.hidden)||(state&&state.querySelector('.wiw-location-retry'))),
    state:String(compact&&compact.hidden===false&&compactTekst?compactTekst.textContent:(state&&state.textContent)||'').trim(),
    appVisible:!!document.getElementById('app')&&getComputedStyle(document.getElementById('app')).display!=='none'
  };
});}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const rapport={expectedSha:EXPECTED,root:ROOT,startedAt:new Date().toISOString(),locations:[],viewports:[],failureSafety:{},screenshots:[]};
  const liveBronnen=new Map();
  try{
    /* Wereldwijde inhoud: de productiepagina bepaalt de exacte provider-URL.
       De monitor haalt diezelfde URL live op met begrensde netwerkretry en voert
       exact die live JSON terug aan de pagina. Zo blijft bronwaarheid streng,
       zonder dat een trage browserresponse de UI-bewijsrun laat flappen. */
    for(const l of locaties){
      const sourceUrl=await ontdekVolledigeForecastUrl(browser,l);
      assert(forecastUrlPastBijLocatie(sourceUrl,l),`${l.naam}: forecast-URL wijkt af van gevraagde coördinaten`);
      const live=await haalLiveForecast(sourceUrl,l.naam),bron=live.bron;
      const context=await browser.newContext({viewport:{width:1363,height:936},serviceWorkers:"block",locale:"nl-NL"});
      const page=await context.newPage(),pageErrors=[];page.on("pageerror",e=>pageErrors.push(String(e)));
      try{
        await installeerForecastFixture(page,bron);
        const response=await page.goto(ROOT+"/?"+params(l),{waitUntil:"domcontentloaded",timeout:30000});
        assert(response&&response.ok(),`${l.naam}: HTTP ${response&&response.status()}`);
        await wachtKlaar(page,l.naam,26000);
        const uit=await lees(page);
        assert.equal(uit.sha,EXPECTED,`${l.naam}: verkeerde build-SHA ${uit.sha}`);
        assert(uit.label.trim(),`${l.naam}: lege plaatsnaam`);
        assert(urlPastBijLocatie(uit.href,l),`${l.naam}: browser-URL wijkt af van gevraagde coördinaten (${uit.href})`);
        assert.equal(uit.query,uit.label,`${l.naam}: zoekveld/label mismatch`);
        assert(uit.title.startsWith(uit.label+" · "),`${l.naam}: title/label mismatch`);
        assert.equal(uit.timezone,bron.timezone,`${l.naam}: UI-tijdzone ${uit.timezone} != bron ${bron.timezone}`);
        assert.equal(getal(uit.temp),rond(bron.current&&bron.current.temperature_2m),`${l.naam}: actuele temperatuur wijkt af`);
        assert.equal(getal(uit.feels),rond(bron.current&&bron.current.apparent_temperature),`${l.naam}: gevoelstemperatuur wijkt af`);
        assert.equal(getal(uit.wind),rond(bron.current&&bron.current.wind_speed_10m),`${l.naam}: wind wijkt af`);
        assert.equal(getal(uit.humidity),rond(bron.current&&bron.current.relative_humidity_2m),`${l.naam}: luchtvochtigheid wijkt af`);
        assert.equal(uit.dagen,7,`${l.naam}: geen zeven dagrijen`);
        assert(uit.hourRows>=23,`${l.naam}: verticale uurtabel te kort (${uit.hourRows})`);
        assert.equal(uit.hourHead,"Gevoel",`${l.naam}: compacte uurkop ontbreekt`);assert.equal(uit.hourHeadAria,"Gevoelstemperatuur",`${l.naam}: volledige toegankelijke uurkop ontbreekt`);
        assert(uit.hourClip&&uit.hourOverflow<=1&&uit.pageOverflow<=1,`${l.naam}: clipping/overflow hour=${uit.hourOverflow} page=${uit.pageOverflow}`);
        assert.deepEqual(uit.duplicateIds,[],`${l.naam}: dubbele ids ${uit.duplicateIds.join(',')}`);assert.deepEqual(uit.missingAriaRefs,[],`${l.naam}: ontbrekende ARIA refs ${uit.missingAriaRefs.join(',')}`);
        assert.deepEqual(pageErrors,[],`${l.naam}: pageerrors ${pageErrors.join(' | ')}`);
        liveBronnen.set(l.naam,bron);
        rapport.locations.push({name:l.naam,displayLabel:uit.label,status:"source-verified",sourceAttempts:live.poging,timezone:bron.timezone,currentTime:bron.current&&bron.current.time,raw:{temperature_2m:bron.current&&bron.current.temperature_2m,apparent_temperature:bron.current&&bron.current.apparent_temperature,wind_speed_10m:bron.current&&bron.current.wind_speed_10m,relative_humidity_2m:bron.current&&bron.current.relative_humidity_2m},ui:{temperature:uit.temp,feels:uit.feels,wind:uit.wind,humidity:uit.humidity},pageOverflow:uit.pageOverflow});
        console.log(`FINAL LIVE ${l.naam}: source-verified via exacte productie-URL als ${uit.label} (bronpoging ${live.poging}).`);
      }finally{await context.close();}
    }

    const amsterdamBron=liveBronnen.get("Amsterdam"),kansasCityBron=liveBronnen.get("Kansas City");
    assert(amsterdamBron,"Amsterdam: live source-verified fixture ontbreekt voor layoutbewijs");
    assert(kansasCityBron,"Kansas City: live source-verified fixture ontbreekt voor cachebewijs");
    rapport.renderFixture={source:"live-source-verified-same-run",locations:["Amsterdam","Kansas City"]};

    /* Exacte afgesproken viewports tegen productie. De providerdata is hierboven
       in dezelfde run live geverifieerd; vanaf hier meten we deterministisch de
       rendering van exact die response zodat een extra provider-timeout geen
       layoutbewijs kan veranderen in een beschikbaarheidstest. */
    for(const [w,h] of viewports){
      const context=await browser.newContext({viewport:{width:w,height:h},serviceWorkers:"block",locale:"nl-NL"});const page=await context.newPage();
      await installeerForecastFixture(page,amsterdamBron);
      await page.goto(ROOT+"/?"+params(locaties[0]),{waitUntil:"domcontentloaded",timeout:30000});await wachtKlaar(page,"Amsterdam");
      const u=await lees(page);assert.equal(u.sha,EXPECTED,`${w}px: verkeerde SHA`);assert(u.pageOverflow<=1,`${w}px: ${u.pageOverflow}px pagina-overflow`);assert(u.hourOverflow<=1&&u.hourClip,`${w}px: uurtabel overflow/clipping`);
      if(w>=1100&&w<1600)assert.equal(u.tileRows,3,`${w}px: verwacht 3 tegelrijen, kreeg ${u.tileRows}`);if(w>=1600)assert.equal(u.tileRows,2,`${w}px: verwacht 2 tegelrijen, kreeg ${u.tileRows}`);
      rapport.viewports.push({width:w,height:h,tileRows:u.tileRows,pageOverflow:u.pageOverflow,hourOverflow:u.hourOverflow});await context.close();
      console.log(`FINAL VIEWPORT ${w}x${h}: ${u.tileRows} tegelrijen, overflow ${u.pageOverflow}px.`);
    }

    /* Mismatched cache op een directe locatie-URL: geen Amsterdam-data onder Kansas City. */
    {
      const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block",locale:"nl-NL"});const page=await context.newPage();
      const scenario=await installeerForecastScenario(page,amsterdamBron);
      await page.goto(ROOT+"/?"+params(locaties[0]),{waitUntil:"domcontentloaded",timeout:30000});await wachtKlaar(page,"Amsterdam");
      scenario.fail=true;
      await page.goto(ROOT+"/?"+params(locaties[1]),{waitUntil:"domcontentloaded",timeout:30000});
      await page.waitForFunction(()=>{const compact=document.querySelector('.locatie-status-retry');return !!((compact&&!compact.hidden)||document.querySelector('.wiw-location-retry'));},null,{timeout:10000});const u=await lees(page);
      assert.equal(u.query,"Kansas City","direct mismatch: zoekveld niet Kansas City");assert(u.title.startsWith("Kansas City · "),"direct mismatch: titel niet Kansas City");assert(!u.appVisible,"direct mismatch: weerapp van andere locatie bleef zichtbaar");assert(/Kansas City/i.test(u.state)&&/niet geladen|kon niet worden opgehaald|geen weergegevens/i.test(u.state),"direct mismatch: veilige melding ontbreekt");assert(u.retry,"direct mismatch: retry ontbreekt");
      rapport.failureSafety.directWrongCache={ok:true,state:u.state};await context.close();
    }
    /* Exact dezelfde cache mag bij providerfout wél als stale data terugkomen. */
    {
      const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block",locale:"nl-NL"});const page=await context.newPage();
      const scenario=await installeerForecastScenario(page,kansasCityBron);
      await page.goto(ROOT+"/?"+params(locaties[1]),{waitUntil:"domcontentloaded",timeout:30000});await wachtKlaar(page,"Kansas City");
      scenario.fail=true;await page.reload({waitUntil:"domcontentloaded",timeout:30000});
      await page.waitForFunction(()=>{const compact=document.querySelector('.locatie-status-retry');return !!((compact&&!compact.hidden)||document.querySelector('.wiw-location-retry'));},null,{timeout:10000});const u=await lees(page);
      assert(u.appVisible&&u.label==="Kansas City"&&u.query==="Kansas City"&&u.title.startsWith("Kansas City · "),"same-cache: identiteit niet volledig Kansas City");assert(/Kansas City/i.test(u.state)&&/niet vernieuwd|laatst opgehaalde gegevens/i.test(u.state),"same-cache: stale melding ontbreekt");assert(u.retry,"same-cache: retry ontbreekt");
      rapport.failureSafety.sameCache={ok:true,state:u.state};await context.close();
    }

    /* 1920 en 390, beide expliciet licht en donker. */
    for(const [w,h] of [[1920,1080],[390,844]])for(const theme of ["licht","donker"]){
      const context=await browser.newContext({viewport:{width:w,height:h},serviceWorkers:"block",locale:"nl-NL"});
      await context.addInitScript(t=>{try{localStorage.setItem("weerbriefing.thema",JSON.stringify(t));}catch(e){}},theme);
      const page=await context.newPage();await installeerForecastFixture(page,amsterdamBron);
      await page.goto(ROOT+"/?"+params(locaties[0]),{waitUntil:"domcontentloaded",timeout:30000});await wachtKlaar(page,"Amsterdam");
      const actief=await page.evaluate(()=>document.documentElement.getAttribute("data-thema"));assert.equal(actief,theme,`${w}px ${theme}: thema niet actief`);
      const naam=`watishetweer-${w}-${theme}.png`;await page.screenshot({path:path.join(OUT,naam),fullPage:true});rapport.screenshots.push({width:w,height:h,theme,file:naam});
      if(w===1920){const u=await lees(page);rapport.liveProof={sha:u.sha,delivery:u.delivery,assets:u.assets,url:page.url()};}
      await context.close();
    }

    rapport.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify(rapport,null,2));
    console.log(`FINAL RELEASE LIVE BEWIJS GESLAAGD: ${EXPECTED}; ${locaties.length} locaties, ${viewports.length} viewports, veilige cachefoutstates en 4 screenshots.`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
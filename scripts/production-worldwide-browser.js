"use strict";

const assert=require("assert");
const {chromium}=require("playwright");

const ROOT=String(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/$/,"");
const verwacht=String(process.env.EXPECTED_SHA||"").trim();
if(!/^[0-9a-f]{7,40}$/i.test(verwacht))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig.");

const locaties=[
  {naam:"Amsterdam",land:"NL",lat:52.3676,lon:4.9041,tz:"Europe/Amsterdam"},
  {naam:"New York",land:"US",lat:40.7128,lon:-74.0060,tz:"America/New_York"},
  {naam:"Tokio",land:"JP",lat:35.6762,lon:139.6503,tz:"Asia/Tokyo"},
  {naam:"Sydney",land:"AU",lat:-33.8688,lon:151.2093,tz:"Australia/Sydney"},
  {naam:"Longyearbyen",land:"SJ",lat:78.2232,lon:15.6469,tz:"Arctic/Longyearbyen",pool:true}
];
const schermen=[{naam:"mobiel",width:390,height:844},{naam:"desktop",width:1440,height:1000}];

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    for(const scherm of schermen){
      const context=await browser.newContext({viewport:{width:scherm.width,height:scherm.height},serviceWorkers:"block",locale:"nl-NL"});
      for(const locatie of locaties){
        const page=await context.newPage(),pageErrors=[];
        page.on("pageerror",e=>pageErrors.push(String(e)));
        const params=new URLSearchParams({lat:String(locatie.lat),lon:String(locatie.lon),plaats:locatie.naam,land:locatie.land});
        const response=await page.goto(ROOT+"/?"+params,{waitUntil:"domcontentloaded",timeout:30000});
        assert(response&&response.ok(),`${scherm.naam}/${locatie.naam}: homepage HTTP ${response&&response.status()}`);
        await page.waitForSelector("#app",{state:"visible",timeout:25000});
        await page.waitForFunction(()=>document.querySelectorAll("#days .row.day:not(.kop)").length===7&&/^Gegevens opgehaald om \d{2}:\d{2}/.test(document.getElementById("stamp")?.textContent||""),null,{timeout:25000});
        const uit=await page.evaluate(()=>({
          sha:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
          label:document.getElementById("place")?.getAttribute("aria-label")||"",
          query:document.getElementById("q")?.value||"",
          timezone:(document.getElementById("coords")?.textContent||"").split(" · ").at(-1),
          dagen:document.querySelectorAll("#days .row.day:not(.kop)").length,
          nachten:document.querySelectorAll("#nights .row.night:not(.kop)").length,
          nachtLeeg:(document.getElementById("nights")?.textContent||"").includes("Geen nachtdata beschikbaar"),
          stamp:document.getElementById("stamp")?.textContent||"",
          overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,
          titel:document.title,
          bronLinks:[...document.querySelectorAll('a[href*="open-meteo"],a[href*="knmi"]')].length
        }));
        assert.equal(uit.sha,verwacht,`${scherm.naam}/${locatie.naam}: verkeerde build ${uit.sha}`);
        assert.equal(uit.label,locatie.naam,`${scherm.naam}/${locatie.naam}: plaatsidentiteit werd ${uit.label}`);
        assert.equal(uit.query,locatie.naam,`${scherm.naam}/${locatie.naam}: zoekveld werd ${uit.query}`);
        assert.equal(uit.timezone,locatie.tz,`${scherm.naam}/${locatie.naam}: tijdzone werd ${uit.timezone}`);
        assert.equal(uit.dagen,7,`${scherm.naam}/${locatie.naam}: geen zeven dagen`);
        assert(locatie.pool?(uit.nachten>0||uit.nachtLeeg):uit.nachten>0,`${scherm.naam}/${locatie.naam}: nachtzicht heeft geen eerlijke staat`);
        assert(/^Gegevens opgehaald om \d{2}:\d{2} · /.test(uit.stamp),`${scherm.naam}/${locatie.naam}: ongeldige datastempel`);
        assert(uit.overflow<=1,`${scherm.naam}/${locatie.naam}: ${uit.overflow}px horizontale overflow`);
        assert(uit.titel.startsWith(locatie.naam+" · "),`${scherm.naam}/${locatie.naam}: titel en plaats verschillen`);
        assert(uit.bronLinks>=1,`${scherm.naam}/${locatie.naam}: bronvermelding ontbreekt`);
        assert.deepEqual(pageErrors,[],`${scherm.naam}/${locatie.naam}: pageerrors ${pageErrors.join(" | ")}`);
        console.log(`WERELDWIJD OK ${scherm.naam.padEnd(7)} ${locatie.naam}: ${uit.timezone}, ${uit.dagen} dagen, ${uit.nachten} nachten, overflow ${uit.overflow}px.`);
        await page.close();
      }
      await context.close();
    }
    console.log(`PRODUCTIE-BROWSERMONITOR GESLAAGD: ${verwacht}; 5 locaties × mobiel/desktop.`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

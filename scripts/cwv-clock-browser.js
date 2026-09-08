"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path");
const locations=[
  {name:"Almere",lat:52.396,lon:5.280,land:"NL",zone:"Europe/Amsterdam",offset:7200},
  {name:"New York",lat:40.7128,lon:-74.006,land:"US",zone:"America/New_York",offset:-14400},
  {name:"Tokyo",lat:35.6762,lon:139.6503,land:"JP",zone:"Asia/Tokyo",offset:32400},
  {name:"Kathmandu",lat:27.7172,lon:85.324,land:"NP",zone:"Asia/Kathmandu",offset:20700}
];
module.exports=async function clockChecks(browser,root,fixture,reportDir){
  const reports=[];
  for(const location of locations){
    // Device time deliberately differs from every selected location. The real
    // app timers run under Playwright's clock; no render helper is invoked.
    const context=await browser.newContext({viewport:{width:1660,height:1000},timezoneId:"America/Los_Angeles",serviceWorkers:"block"});
    const page=await context.newPage(),errors=[],externalErrors=[];let primary=0,fallback=0;
    // Cloudflare Web Analytics injects beacon.min.js at the production edge.
    // Chromium can report a deployment-specific SRI mismatch for that
    // third-party resource while the application itself remains error-free.
    // Keep the message in the evidence, but reserve the runtime-error gate
    // for errors emitted by the application under test.
    const isKnownAnalyticsIntegrityError=message=>/Failed to find a valid digest in the 'integrity' attribute for resource 'https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js\//.test(message);
    const captureError=message=>(isKnownAnalyticsIntegrityError(message)?externalErrors:errors).push(message);
    page.on("pageerror",e=>captureError(String(e)));page.on("console",m=>{if(m.type()==="error")captureError(m.text());});
    const start=Date.parse("2026-07-22T22:59:30Z")-location.offset*1000;
    await page.clock.install({time:new Date(start)});
    await page.route("**/*",async r=>{
      const u=new URL(r.request().url());
      if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast"){
        if(u.pathname==="/api/forecast")fallback++;else primary++;
        const now=await page.evaluate(()=>Date.now()),local=new Date(now+location.offset*1000).toISOString().slice(0,16);
        const d=fixture(u.href),shift=Date.parse(local.slice(0,10)+"T00:00Z")-Date.parse("2026-07-22T00:00Z");
        const move=t=>typeof t==="string"?new Date(Date.parse(t+(t.length===10?"T00:00Z":"Z"))+shift).toISOString().slice(0,t.length):t;
        for(const block of [d.hourly,d.daily,d.minutely_15])if(block)for(const k of ["time","sunrise","sunset"])if(block[k])block[k]=block[k].map(move);
        d.timezone=location.zone;d.utc_offset_seconds=location.offset;d.current.time=local;
        return r.fulfill({json:d});
      }
      if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:location.land,lijst:[]}});
      if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
      if(u.pathname==="/api/luchtkwaliteit")return r.fulfill({json:{beschikbaar:false,provider:"luchtmeetnet",reden:"test"}});
      if(u.pathname==="/api/plaatsnaam")return r.fulfill({json:{beschikbaar:false}});
      if(u.origin!==root)return r.fulfill({json:{}});
      return r.continue();
    });
    const url=root+"/?"+new URLSearchParams({lat:location.lat,lon:location.lon,plaats:location.name,land:location.land});
    await page.goto(url,{waitUntil:"load"});
    await page.waitForSelector("#wiw-hour-table tbody tr",{timeout:10000});
    const read=()=>page.evaluate(()=>({maxHours:WeatherNowFinalDesktopUI20260902.MAX_DESKTOP_UREN,graphTimes:S.geo.TI,sourceTimes:[...document.querySelectorAll("#wiw-hour-table tbody tr")].map(r=>S.d.hourly.time[Number(r.dataset.sourceIndex)]),now:Date.now(),rows:[...document.querySelectorAll("#wiw-hour-table tbody tr")].map(r=>({instant:r.querySelector("time").dateTime,label:r.querySelector("time").textContent})),place:document.getElementById("place").getAttribute("aria-label")}));
    const check=s=>{
      assert.equal(s.place,location.name);assert(s.rows.length>=4&&s.rows.length<=s.maxHours);
      assert.deepEqual(s.graphTimes,s.sourceTimes,"grafiek en tabel schuiven met dezelfde uren door");
      for(let i=0;i<s.rows.length;i++){
        const row=s.rows[i],expected=new Intl.DateTimeFormat("en-GB",{timeZone:location.zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(row.instant));
        assert.equal(row.label,expected,"label moet bij selected-location timezone horen");
        if(i)assert.equal(Date.parse(row.instant)-Date.parse(s.rows[i-1].instant),3600000);
      }
    };
    await page.screenshot({path:path.join(reportDir,"desktop-hours-"+location.name.replace(/ /g,"-")+".png"),fullPage:true});
    const before=await read();check(before);assert.equal(before.rows[0].label,"23:00");
    await page.clock.fastForward(62000);await page.waitForTimeout(100);
    const hour=await read();check(hour);assert.equal(hour.rows[0].label,"00:00");
    assert.equal(Date.parse(hour.rows[0].instant)-Date.parse(before.rows[0].instant),3600000,"zichtbare uren schuiven zonder gebruikeractie");
    // Cross the selected location's actual midnight, including its normal
    // calendar refresh. Requests keep using the primary provider.
    await page.clock.fastForward(3600000);await page.waitForTimeout(1000);
    const midnight=await read();check(midnight);assert.equal(midnight.rows[0].label,"01:00");
    assert.equal(Date.parse(midnight.rows[0].instant)-Date.parse(hour.rows[0].instant),3600000);
    for(const width of [1099,1100,1366,1660]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(150);if(width>=1100)check(await read());}
    assert.equal(fallback,0,"klok/layout mag geen extra WeatherAPI-fallback veroorzaken");assert.deepEqual(errors,[]);
    const result={location:location.name,timezone:location.zone,deviceTimezone:"America/Los_Angeles",before,hour,midnight,primary,fallback,errors,externalErrors};reports.push(result);
    console.log("CWV_CLOCK "+JSON.stringify(result));
    await context.close();
  }
  fs.writeFileSync(path.join(reportDir,"clock-rollover.json"),JSON.stringify(reports,null,2));
};

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
  if(d.longitude>130){d.timezone="Asia/Tokyo";d.utc_offset_seconds=32400;d.current.time="2026-07-22T21:00";}
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
  const root=String(process.env.CWV_ROOT||("http://127.0.0.1:"+server.address().port)).replace(/\/$/,"");
  const expected=String(process.env.EXPECTED_SHA||"");
  if(process.env.CWV_ROOT&&!/^[0-9a-f]{40}$/.test(expected))throw new Error("Live CWV-verificatie vereist exacte EXPECTED_SHA");
  const browser=await chromium.launch({headless:true});
  const reports=[];
  try{
    for(const width of [390,1024,1100,1366,1660,1920])for(const route of ([390,1660].includes(width)?routes:[routes[5]])){
      const context=await browser.newContext({viewport:{width,height:width===390?844:1000},locale:"nl-NL",timezoneId:"America/Los_Angeles",serviceWorkers:"block"});
      const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(String(e)));
      page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
      await instrumentation(page);
      await page.route("**/*",async r=>{
        const u=new URL(r.request().url());
        if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast"){
          await sleep(700);return r.fulfill({json:fixture(u.href)});
        }
        if(u.hostname==="geocoding-api.open-meteo.com")return r.fulfill({json:{results:[/tok/i.test(u.searchParams.get("name")||"")?{name:"Tokyo",latitude:35.6762,longitude:139.6503,country_code:"JP"}:{name:"Amsterdam",latitude:52.3676,longitude:4.9041,country_code:"NL"}]}});
        if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T14:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
        if(u.pathname==="/api/waarschuwingen"){await sleep(1100);return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});}
        if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
        if(u.pathname==="/api/luchtkwaliteit")return r.fulfill({json:{beschikbaar:false,provider:"luchtmeetnet",reden:"testfixture gebruikt CAMS voor pollen"}});
        if(u.pathname==="/api/plaatsnaam")return r.fulfill({json:{beschikbaar:false}});
        if(u.origin!==root)return process.env.CWV_ROOT?r.continue():r.fulfill({json:{}});
        return r.continue();
      });
      for(const scenario of ["cold","reload"]){
        if(scenario==="cold")await page.goto(root+route,{waitUntil:"domcontentloaded"});else await page.reload({waitUntil:"domcontentloaded"});
        await page.waitForSelector("#app",{state:"visible",timeout:10000});
        await page.waitForTimeout(1600);
        const result=await page.evaluate(()=>{
          const rect=s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect().toJSON():null;};
          const rows=[...document.querySelectorAll("#wiw-hour-table tbody tr")],scroll=document.querySelector("#wiw-hour-scroll"),panel=document.querySelector("#wiw-hour-panel");
          const night=document.querySelector("#nights .row.night:not(.kop)"),nightCells=night?[...night.children].map(e=>e.getBoundingClientRect().toJSON()):[];
          const temp=document.getElementById("t"),tempHead=document.querySelector("#wiw-hour-table thead th:nth-child(3)"),sunDay=document.querySelector("#suntimes .zondag");
          const footer=document.querySelector("footer"),footerChildren=footer?[...footer.children]:[],footerSources=footer&&footer.querySelector(".bron-bronnen"),footerDisclaimer=footerChildren.find(el=>el.classList&&el.classList.contains("bron")&&/Weersinformatie is algemeen/.test(el.textContent||"")),footerContact=footer&&footer.querySelector(".footer-contact");
          const visibleSourceLinks=footerSources?[...footerSources.querySelectorAll(".bronitem:not([hidden]) a")].filter(a=>a.getClientRects().length):[],sourceRects=visibleSourceLinks.map(a=>a.getBoundingClientRect()),sourceRows=[...new Set(sourceRects.map(r=>Math.round(r.top)))],contactParts=footerContact?[...footerContact.querySelectorAll(".footer-contact-question,.footer-contact-mail")].map(e=>e.getBoundingClientRect()):[];
          const utilityTargets=footer?[footer.querySelector('a[href="/over/"]'),footer.querySelector('a[href="/privacy"]'),footer.querySelector("details.footer-details>summary")].filter(Boolean):[],utilityRects=utilityTargets.map(e=>e.getBoundingClientRect());
          const disclaimerRect=footerDisclaimer&&footerDisclaimer.getBoundingClientRect(),disclaimerLineHeight=footerDisclaimer?parseFloat(getComputedStyle(footerDisclaimer).lineHeight)||0:0;
          const footerMetrics=footer&&footerSources&&footerDisclaimer&&footerContact?{
            rect:footer.getBoundingClientRect().toJSON(),
            sourceDisplay:getComputedStyle(footerSources).display,
            sourceWidth:footerSources.getBoundingClientRect().width,
            sourceVisible:visibleSourceLinks.length,
            sourceRows:sourceRows.length,
            sourceHitHeight:sourceRects.length?Math.min(...sourceRects.map(r=>r.height)):0,
            disclaimerWidth:disclaimerRect.width,
            disclaimerLineHeight,
            disclaimerLines:disclaimerLineHeight?Math.round(disclaimerRect.height/disclaimerLineHeight):0,
            contactWidth:footerContact.getBoundingClientRect().width,
            contactRowDelta:contactParts.length?Math.max(...contactParts.map(r=>r.top+r.height/2))-Math.min(...contactParts.map(r=>r.top+r.height/2)):999,
            contactHitHeight:footerContact.querySelector("a")?.getBoundingClientRect().height||0,
            utilityRowDelta:utilityRects.length?Math.max(...utilityRects.map(r=>r.top))-Math.min(...utilityRects.map(r=>r.top)):999,
            utilityRows:utilityRects.length?[...new Set(utilityRects.map(r=>Math.round(r.top)))].length:0,
            utilityPairDelta:utilityRects.length>=2?Math.abs(utilityRects[0].top-utilityRects[1].top):999,
            utilityDetailsDelta:utilityRects.length>=3?utilityRects[2].top-utilityRects[0].top:999,
            utilityHitHeight:utilityRects.length?Math.min(...utilityRects.map(r=>r.height)):0
          }:null;
          return {
            ...window.__cwv,
            maxHours:WeatherNowFinalDesktopUI20260902.MAX_DESKTOP_UREN,
            graphTimes:S.geo.TI,
            placeLayout:{justify:getComputedStyle(document.getElementById("place")).justifyContent,gap:parseFloat(getComputedStyle(document.getElementById("place")).gap)},
            sourceTimes:rows.map(r=>S.d.hourly.time[Number(r.dataset.sourceIndex)]),
            geometry:{layout:rect("#wiw-chart-layout"),main:rect(".wiw-chart-main"),graph:rect("#chart"),hours:rect("#wiw-hour-panel"),table:rect("#wiw-hour-table"),rain:rect(".wiw-rain-section"),days:rect(".dashrow-days"),night:rect("#nights .row.night:not(.kop)")},
            rows:rows.length,
            hourRows:rows.map(r=>({instant:r.querySelector("time")?.dateTime,time:r.querySelector("time")?.textContent,sourceIndex:Number(r.dataset.sourceIndex),rect:r.getBoundingClientRect().toJSON(),visible:getComputedStyle(r).display!=="none"})),
            hourHeaders:[...document.querySelectorAll("#wiw-hour-table thead th")].map(th=>th.textContent.trim()),
            hourHeaderFits:tempHead?tempHead.scrollWidth<=tempHead.clientWidth+1:false,
            hourCells:rows.every(r=>r.children.length===5&&!!r.querySelector(".wiw-hour-weather-icon svg")&&!!r.querySelector(".wiw-hour-temp .wiw-hour-secondary")&&!!r.querySelector(".wiw-hour-rain .wiw-hour-secondary")&&!!r.querySelector(".wiw-hour-wind .wiw-hour-secondary")),
            heroTempSize:temp?parseFloat(getComputedStyle(temp).fontSize):null,
            sunDayVisible:!!(sunDay&&sunDay.getClientRects().length),
            nightCells,
            rainVisible:document.getElementById("wiw-rain-section")?.getClientRects().length>0,
            chartDataVisible:[...document.querySelectorAll("details")].some(d=>/grafiekgegevens.*tabel/i.test(d.querySelector("summary")?.textContent||"")&&d.open&&d.getClientRects().length>0),
            hourOverflow:scroll&&getComputedStyle(scroll).overflowY,
            hourPanelVisibility:panel&&getComputedStyle(panel).visibility,
            hourButtons:panel&&[...panel.querySelectorAll("button")].filter(e=>e.getClientRects().length>0).length,
            copy:document.body.innerText,
            overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
            footer:footerMetrics,
            sha:document.querySelector('meta[name="weather-build-sha"]')?.content
          };
        });
        result.route=route;result.width=width;result.scenario=scenario;result.cls=cls(result.shifts);result.errors=errors.slice();
        reports.push(result);
        if(expected)assert.equal(result.sha,expected,"CWV-scenario moet op exacte release-SHA draaien");
        assert.deepEqual(errors,[],"Runtime/console: "+route+" "+JSON.stringify(errors));
        assert(result.overflow<=1,"Horizontale overflow: "+JSON.stringify({route,width,overflow:result.overflow}));
        if(width===390&&route==="/weer/amsterdam/"){
          const f=result.footer;
          assert(f,"mobiele footer ontbreekt in live 390px preview");
          assert.equal(f.sourceDisplay,"grid","live bronlijst gebruikt niet het finale gridritme");
          assert(f.sourceWidth>=330,"live bronlijst benut te weinig mobiele breedte: "+f.sourceWidth);
          assert(f.sourceVisible>=4,"live footer mist actieve bronlinks: "+JSON.stringify(f));
          assert.equal(f.sourceRows,Math.ceil(f.sourceVisible/2),"live bronnen volgen niet exact de tweekoloms row-flow: "+JSON.stringify(f));
          assert(f.sourceHitHeight>=43.5,"live bronlink verliest 44px tapdoel: "+f.sourceHitHeight);
          assert(Math.abs(f.disclaimerWidth-f.rect.width)<=1&&f.disclaimerLines<=4&&f.disclaimerLineHeight<=15.6,"live disclaimer benut niet rustig de footerbreedte: "+JSON.stringify(f));
          assert(Math.abs(f.contactWidth-f.rect.width)<=1&&f.contactRowDelta<=1,"live contactvraag en mail delen geen compacte volle rij: "+JSON.stringify(f));
          assert(f.contactHitHeight>=43.5,"live contactmail verliest 44px tapdoel: "+f.contactHitHeight);
          assert(f.utilityRows===1&&f.utilityRowDelta<=1&&f.utilityPairDelta<=1&&Math.abs(f.utilityDetailsDelta)<=1&&f.utilityHitHeight>=43.5,"live utilitylinks volgen niet de bedoelde ene utilityrij/tapdoelen: "+JSON.stringify(f));
          assert(f.rect.height<300,"live 390px-footer overschrijdt de compacte mobiele hoogteband: "+f.rect.height);
          console.log("FOOTER_390 "+JSON.stringify({scenario,height:f.rect.height,sourceWidth:f.sourceWidth,sourceVisible:f.sourceVisible,sourceRows:f.sourceRows,disclaimerWidth:f.disclaimerWidth,disclaimerLines:f.disclaimerLines,disclaimerLineHeight:f.disclaimerLineHeight,contactWidth:f.contactWidth,contactRowDelta:f.contactRowDelta,sourceHitHeight:f.sourceHitHeight,contactHitHeight:f.contactHitHeight,utilityRows:f.utilityRows,utilityPairDelta:f.utilityPairDelta,utilityDetailsDelta:f.utilityDetailsDelta,utilityHitHeight:f.utilityHitHeight}));
        }
        assert(result.cls<0.1,"Route-CLS buiten budget: "+JSON.stringify({route,width,scenario,cls:result.cls,shifts:result.shifts}));
        assert(!result.copy.includes("Vandaag: neerslag geldt vanaf nu; minimum en maximum gelden voor de volledige dag."),"verwijderde Vandaag-copy keert terug");
        if(width>=1100){
          const g=result.geometry;
          assert(Math.abs(g.hours.bottom-g.main.bottom)<=1,"uurpaneel en grafiekkolom eindigen niet gelijk");
          assert(Math.abs(g.table.bottom-result.hourRows.at(-1).rect.bottom)<=2,"geen lege onderste tabelregel");
          assert(Math.abs(g.table.bottom-g.hours.bottom)<=2,"geen loos ondervlak onder de laatste uurregel");
          assert.equal(result.graphTimes.length,result.sourceTimes.length,"grafiek en tabel moeten exact evenveel desktopuren tonen");
          assert.deepEqual(result.graphTimes,result.sourceTimes,"grafiek en tabel moeten exact dezelfde desktopurenreeks tonen");
          assert.equal(result.graphTimes[0],result.sourceTimes[0],"grafiek en tabel moeten bij hetzelfde lokale uur beginnen");
          for(let i=0;i<result.sourceTimes.length;i++)assert.equal(result.graphTimes[i],result.sourceTimes[i],`tabeluur ${i} komt niet overeen met hetzelfde grafiekpunt`);
          assert.equal(Date.parse(result.graphTimes.at(-1)+"Z")-Date.parse(result.graphTimes.at(-2)+"Z"),3600000,"opeenvolgende grafiekpunten moeten exact één uur verschillen");
          assert.equal(result.placeLayout.justify,"center","plaats en tijd vormen een compacte kopgroep");
          assert(result.placeLayout.gap>=12&&result.placeLayout.gap<=24,"afstand plaats/tijd buiten compacte band");
          if(width>=1366)assert(result.rows>=8&&result.rows<=11,"desktop toont geen comfortabele 8–11 volledige hoogtegestuurde uurregels");
          if(width>=1366){
            const grafiekAandeel=g.main.width/(g.main.width+g.hours.width);
            assert(grafiekAandeel>=.65&&grafiekAandeel<=.72,"grafiek/tabelverhouding valt buiten 65–72% / 28–35%");
          }
          assert(g.main.height-g.graph.height<80,"uurkolom rekt de grafiekrij uit");
          assert(g.graph.bottom<=g.main.bottom+1,"grafiek mag niet buiten de gemeten kolomhoogte vallen");
          const week=await page.evaluate(()=>{const hint=document.getElementById("dagenhint"),head=hint.previousElementSibling;return {hint:hint.getBoundingClientRect().left,head:head.getBoundingClientRect().left};});
          assert(Math.abs(week.hint-week.head)<=1,"weekinstructie hoort bij de kop, zonder gecentreerd los tekstblok");
          assert(result.rows>=4&&result.rows<=result.maxHours,"volledige desktopuren buiten begrensd bereik: "+result.rows);
          assert.deepEqual(result.hourHeaders,["Tijd","Weer","Temperatuur","Neerslag","Wind"],"rijke uurkolommen ontbreken");
          assert.equal(result.hourHeaderFits,true,"Temperatuur-kop wrapt of clipt in de desktop-uurtabel");
          const expectedHeroTemp=60;
          assert(Math.abs(result.heroTempSize-expectedHeroTemp)<=.75,"actuele temperatuur valt buiten de bedoelde desktopmaat: "+result.heroTempSize+" (verwacht circa "+expectedHeroTemp+")");
          assert.equal(result.sunDayVisible,false,"los Vandaag/Morgen-label staat nog boven de grafiek");
          assert.equal(result.hourCells,true,"uurregels missen weericoon, gevoel, neerslagkans of wind");
          assert.equal(result.rainVisible,false,"korte neerslagsectie is nog zichtbaar");
          assert.equal(result.chartDataVisible,false,"grafiektabelbediening is nog zichtbaar");
          assert.equal(result.hourOverflow,"visible");assert.equal(result.hourPanelVisibility,"visible","rijke uurkolom is niet zichtbaar");assert.equal(result.hourButtons,0,"geen extra uurbediening");
          for(const r of result.hourRows){assert(r.visible);assert(r.rect.height>=29&&r.rect.height<=46,"uurregel valt buiten comfortabele hoogte");assert(r.rect.bottom<=g.hours.bottom+1,"geen afgesneden laatste uurregel");}
          if(result.nightCells.length===5){assert(result.nightCells[2].width<=261,"Nachtzicht-scorebalk is nog onnodig breed");assert(result.nightCells[4].width<=481,"Nachtzicht-toelichting is niet leesbaar begrensd");}
          for(let i=1;i<result.hourRows.length;i++){
            assert.equal(Date.parse(result.hourRows[i].instant)-Date.parse(result.hourRows[i-1].instant),3600000,"unieke opeenvolgende instants, ook bij gelijke DST-labels");
            assert.equal(result.hourRows[i].sourceIndex,result.hourRows[i-1].sourceIndex+1,"geen bronuren overslaan");
          }
          assert(!/Eerstkomend|Eerstvolgend/.test(await page.locator("#wiw-hour-panel").innerText()),"overbodige uurtoevoeging blijft weg");
        }
        console.log("CWV_MEASUREMENT "+JSON.stringify({route,width,scenario,cls:result.cls,rows:result.rows,geometry:result.geometry,shifts:result.shifts}));
      }
      if(route==="/weer/amsterdam/"){
        const session=await context.newCDPSession(page);
        await session.send("Emulation.setCPUThrottlingRate",{rate:4});
        await session.send("Profiler.enable");await session.send("Profiler.start");
        for(let i=1;i<=3;i++){
          await page.locator("#days .row.day:not(.kop)").nth(i).click();
          await page.waitForTimeout(600);
        }
        for(const name of ["Tokyo","Amsterdam"]){
          await page.locator("#q").fill(name);
          await page.locator("#res div[data-lat]").first().waitFor({state:"visible"});
          await page.locator("#res div[data-lat]").first().click();
          await page.waitForFunction(name=>document.getElementById("place")?.getAttribute("aria-label")===name,name,{timeout:10000});
          await page.waitForTimeout(700);
        }
        const chart=await page.locator("#chart").boundingBox();
        for(let i=1;i<=8;i++)await page.mouse.move(chart.x+chart.width*i/10,chart.y+chart.height/2,{steps:2});
        await page.waitForTimeout(600);
        await page.locator("#thema").click();await page.waitForTimeout(600);
        const profile=(await session.send("Profiler.stop")).profile;
        fs.writeFileSync(path.join(REPORT,"interactions-"+width+".cpuprofile"),JSON.stringify(profile));
        const metrics=await page.evaluate(()=>window.__cwv);
        fs.writeFileSync(path.join(REPORT,"interactions-"+width+".json"),JSON.stringify(metrics,null,2));
        console.log("CWV_INTERACTIONS "+JSON.stringify({width,cpuRate:4,events:metrics.events,frames:metrics.frames.slice(-12)}));
        await session.send("Emulation.setCPUThrottlingRate",{rate:1});
        await page.locator("#thema").click();
        await page.screenshot({path:path.join(REPORT,"amsterdam-"+width+".png"),fullPage:true});
      }
      await context.close();
    }
    await require("./cwv-clock-browser.js")(browser,root,fixture,REPORT);
  }finally{
    fs.writeFileSync(path.join(REPORT,"measurements.json"),JSON.stringify(reports,null,2));
    await browser.close();server.close();
  }
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});

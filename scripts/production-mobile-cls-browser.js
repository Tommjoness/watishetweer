"use strict";

const assert=require("assert");
const {chromium}=require("playwright");

const ROOT=String(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/$/,"");
const verwacht=String(process.env.EXPECTED_SHA||"").trim();
if(!/^[0-9a-f]{7,40}$/i.test(verwacht))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig.");

const RONDEN=5;
const CLS_BUDGET=0.1;
const UITKOMST_TIMEOUT_MS=15000;
const LATE_DATA_WACHT_MS=8000;
const FOUT_SETTLE_MS=1000;

function clsUit(entries){
  const waarden=(entries||[]).filter(x=>x&&!x.hadRecentInput&&Number.isFinite(x.value)&&x.value>0).sort((a,b)=>a.startTime-b.startTime);
  let max=0,som=0,start=null,vorig=null;
  for(const e of waarden){
    if(start===null||e.startTime-vorig>1000||e.startTime-start>5000){start=e.startTime;som=e.value;}else som+=e.value;
    vorig=e.startTime;max=Math.max(max,som);
  }
  return max;
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const resultaten=[];
  try{
    for(let ronde=0;ronde<RONDEN;ronde++){
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,locale:"nl-NL",serviceWorkers:"block"});
      const page=await context.newPage(),pageErrors=[],consoleErrors=[];
      page.on("pageerror",e=>pageErrors.push(String(e)));
      page.on("console",m=>{if(m.type()==="error")consoleErrors.push(m.text());});
      await page.addInitScript(()=>{
        window.__weatherClsEntries=[];
        window.__weatherInitialScrollY=window.scrollY;
        try{
          new PerformanceObserver(list=>{
            for(const e of list.getEntries()){
              window.__weatherClsEntries.push({
                value:e.value,startTime:e.startTime,hadRecentInput:e.hadRecentInput,
                sources:(e.sources||[]).map(s=>({
                  node:s.node&&((s.node.id&&"#"+s.node.id)||(typeof s.node.className==="string"&&"."+s.node.className.replace(/\s+/g,"."))||s.node.nodeName)||"",
                  previousRect:s.previousRect,currentRect:s.currentRect
                }))
              });
            }
          }).observe({type:"layout-shift",buffered:true});
        }catch(e){window.__weatherClsObserverError=String(e);}
      });
      try{
        const params=new URLSearchParams({lat:"52.3508",lon:"5.2647",plaats:"Almere",land:"NL",clscheck:String(Date.now())+"-"+ronde});
        const response=await page.goto(ROOT+"/?"+params,{waitUntil:"domcontentloaded",timeout:30000});
        assert(response&&response.ok(),`ronde ${ronde+1}: homepage HTTP ${response&&response.status()}`);

        /* Deze job meet layoutstabiliteit, niet de uptime van Open-Meteo. De
           aparte live-performance- en wereldwijde jobs bewaken dat de echte
           productie weerdata kan laden. Hier is een cold load daarom afgerond
           zodra óf geldige weerdata zichtbaar is óf de app na zijn geharde
           full/fallbackketen een duidelijke terminale foutstatus toont. Zo kan
           ook het foutpad op CLS worden bewaakt zonder een providerhapering als
           een fictieve layout-regressie te rapporteren. */
        await page.waitForFunction(()=>{
          const app=document.getElementById("app"),temp=document.getElementById("t"),state=document.getElementById("state");
          const heeftData=!!(app&&getComputedStyle(app).display!=="none"&&temp&&!/^(?:--|–)$/.test(temp.textContent.trim()));
          const terminaleFout=!!(state&&state.classList.contains("err")&&/Ophalen mislukt|Geen verbinding/i.test(state.textContent||""));
          return heeftData||terminaleFout;
        },null,{timeout:UITKOMST_TIMEOUT_MS});

        const eindstate=await page.evaluate(()=>{
          const app=document.getElementById("app"),temp=document.getElementById("t"),state=document.getElementById("state");
          const heeftData=!!(app&&getComputedStyle(app).display!=="none"&&temp&&!/^(?:--|–)$/.test(temp.textContent.trim()));
          const terminaleFout=!!(state&&state.classList.contains("err")&&/Ophalen mislukt|Geen verbinding/i.test(state.textContent||""));
          return {
            uitkomst:heeftData?"data":terminaleFout?"fout":"onbeslist",
            stateTekst:state&&state.textContent||"",
            stateKlasse:state&&state.className||""
          };
        });
        assert.notEqual(eindstate.uitkomst,"onbeslist",`ronde ${ronde+1}: cold load bereikte geen geldige eindstate`);

        /* Bij data houden we acht seconden aan om late waarschuwing- en
           fallbackmutaties mee te nemen. Bij een terminale forecastfout zijn
           die datagedreven mutaties niet gestart; één seconde is daar genoeg
           om het foutlayout te laten settelen. */
        await page.waitForTimeout(eindstate.uitkomst==="data"?LATE_DATA_WACHT_MS:FOUT_SETTLE_MS);
        const meting=await page.evaluate(()=>({
          entries:window.__weatherClsEntries||[],observerError:window.__weatherClsObserverError||null,
          initialScrollY:window.__weatherInitialScrollY,finalScrollY:window.scrollY,
          sha:document.querySelector('meta[name="weather-build-sha"]')?.getAttribute("content")||null
        }));
        assert(!meting.observerError,`ronde ${ronde+1}: layout-shift observer faalde: ${meting.observerError}`);
        assert.equal(meting.sha,verwacht,`ronde ${ronde+1}: verkeerde productiebuild ${meting.sha}`);
        const cls=clsUit(meting.entries);
        const bronnen=meting.entries.slice().sort((a,b)=>b.value-a.value).slice(0,5).map(e=>({waarde:Number(e.value.toFixed(4)),tijd:Math.round(e.startTime),bronnen:e.sources.map(s=>s.node).filter(Boolean)}));
        assert(cls<CLS_BUDGET,`ronde ${ronde+1}: CLS ${cls.toFixed(3)} overschrijdt ${CLS_BUDGET}; grootste shifts ${JSON.stringify(bronnen)}`);
        assert.equal(meting.finalScrollY,meting.initialScrollY,`ronde ${ronde+1}: scrollY veranderde zonder gebruikersinput van ${meting.initialScrollY} naar ${meting.finalScrollY}`);
        assert.deepEqual(pageErrors,[],`ronde ${ronde+1}: pageerrors ${pageErrors.join(" | ")}`);
        assert.deepEqual(consoleErrors,[],`ronde ${ronde+1}: console-errors ${consoleErrors.join(" | ")}`);
        resultaten.push({cls,bronnen,uitkomst:eindstate.uitkomst});
        console.log(JSON.stringify({ronde:ronde+1,sha:meting.sha,uitkomst:eindstate.uitkomst,cls:Number(cls.toFixed(4)),scrollY:meting.finalScrollY,grootsteShifts:bronnen}));
      }finally{await context.close();}
    }
  }finally{await browser.close();}
  const max=Math.max(...resultaten.map(r=>r.cls));
  const dataRondes=resultaten.filter(r=>r.uitkomst==="data").length;
  const foutRondes=resultaten.filter(r=>r.uitkomst==="fout").length;
  console.log(`MOBIELE CLS PRODUCTIE GESLAAGD: ${verwacht}; ${RONDEN} koude layout-runs (${dataRondes} met data, ${foutRondes} nette foutstate), max CLS ${max.toFixed(3)} (< ${CLS_BUDGET}), scrollY stabiel. Beschikbaarheid wordt apart bewaakt.`);
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

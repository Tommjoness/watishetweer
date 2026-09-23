"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const ROOT=String(process.env.PREVIEW_ROOT||process.env.PRODUCTION_ROOT||"").replace(/\/$/,"");
const verwacht=String(process.env.EXPECTED_SHA||"").trim();
if(!/^https:\/\//.test(ROOT))throw new Error("PREVIEW_ROOT/PRODUCTION_ROOT ontbreekt of is ongeldig.");
if(!/^[0-9a-f]{7,40}$/i.test(verwacht))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig.");

const viewports=[
  {naam:"mobiel-320",width:320,height:844},
  {naam:"mobiel-360",width:360,height:844},
  {naam:"mobiel-375",width:375,height:844},
  {naam:"mobiel-390",width:390,height:844},
  {naam:"mobiel-430",width:430,height:932},
  {naam:"tablet-820",width:820,height:1180},
  {naam:"desktop-1366",width:1366,height:900},
  {naam:"desktop-1440",width:1440,height:1000},
  {naam:"desktop-1920",width:1920,height:1080}
];
const zoekFixture={results:[
  {id:101,name:"Singapore",admin1:"Singapore",country_code:"SG",latitude:1.28967,longitude:103.85007},
  {id:202,name:"Singapore",admin1:"Singapore",country_code:"SG",latitude:1.28967,longitude:103.85007},
  {id:303,name:"Singapore",admin1:"North East",country_code:"SG",latitude:1.35,longitude:103.9}
]};
const weerFixture=bouw({tempNu:17,wcNu:1,ccNu:30,pp:()=>22,som:2.4});
weerFixture.latitude=52.3676;weerFixture.longitude=4.9041;weerFixture.timezone="Europe/Amsterdam";weerFixture.utc_offset_seconds=7200;
weerFixture.daily.sunshine_duration=weerFixture.daily.time.map(()=>7*3600);
const luchtFixture={current:{european_aqi:24,us_aqi:40},hourly:{time:[weerFixture.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
function weerFixtureVoorViewport(breedte){
  const d=JSON.parse(JSON.stringify(weerFixture)),h=d.hourly||{},tijden=Array.isArray(h.time)?h.time:[];
  const huidig=String(d.current&&d.current.time||"").slice(0,13);
  let start=tijden.findIndex(t=>String(t).slice(0,13)===huidig);if(start<0)start=0;
  const lengte=Math.min(24,Math.max(0,tijden.length-start));
  let patroon=Array.from({length:lengte},(_,i)=>14+i*.15);
  if(breedte===320)patroon=Array.from({length:lengte},(_,i)=>22-i*.25); // vrijwel alleen dalend
  else if(breedte===360)patroon=Array.from({length:lengte},(_,i)=>10+i*.25); // vrijwel alleen stijgend
  else if(breedte===375){
    patroon=Array.from({length:lengte},(_,i)=>14+i*.04);
    for(const [i,v] of [[3,16],[4,14.5],[8,12],[9,14],[14,17],[15,14.5]])if(i<lengte)patroon[i]=v;
  }else if(breedte===390){
    patroon=Array.from({length:lengte},(_,i)=>13+i*.03);
    for(const [i,v] of [[4,15],[5,15],[6,14],[11,11],[12,11],[13,13]])if(i<lengte)patroon[i]=v; // vlakke top + vlak dal
  }else if(breedte===430){
    /* De productowner ankert op het eerste zichtbare forecastpunt en daarna op
       echte +3-uursforecastpunten. In deze gewone (niet-DST) fixture zijn dat
       indices 0/3/6/...; zet bewust één extremum op zo'n anker en één ernaast. */
    const a=6;
    if(a>0&&a+2<lengte){patroon[a-1]=13;patroon[a]=17;patroon[a+1]=11;patroon[a+2]=14;}
  }
  for(let j=0;j<lengte;j++){
    const i=start+j,v=patroon[j];
    if(Array.isArray(h.temperature_2m))h.temperature_2m[i]=v;
    if(Array.isArray(h.apparent_temperature))h.apparent_temperature[i]=v-1;
  }
  if(lengte&&d.current)d.current.temperature_2m=patroon[0];
  return d;
}
const fixtureEpoch=Date.parse("2026-07-22T12:30:00Z");

function binnenViewport(rect,width){return !!rect&&rect.left>=-1&&rect.right<=width+1&&rect.width>0;}
const antwoord=(route,data)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});

(async()=>{
  const browser=await chromium.launch({headless:true});
  const evidence=path.join(process.cwd(),"preview-evidence");
  fs.rmSync(evidence,{recursive:true,force:true});
  fs.mkdirSync(evidence,{recursive:true});
  try{
    for(const vp of viewports){
      const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},serviceWorkers:"block",locale:"nl-NL",reducedMotion:"reduce"});
      const page=await context.newPage(),pageErrors=[],weerVp=weerFixtureVoorViewport(vp.width);
      page.on("pageerror",e=>pageErrors.push(String(e)));

      /* Deze gate controleert het echte gedeployde HTML/CSS/JS-artifact en echte
         browserlayout, maar niet de beschikbaarheid of rate limits van externe
         providers. De live bronwaarheid draait direct hierna afzonderlijk in
         production-worldwide-browser.js. Houd daarom zowel weer- als zoekdata
         deterministisch en laat de browserklok aansluiten op dezelfde fixture. */
      await page.addInitScript(({epoch})=>{
        const NativeDate=Date,nativeStart=NativeDate.now();
        class PreviewFixtureDate extends NativeDate{
          constructor(...args){super(...(args.length?args:[epoch+(NativeDate.now()-nativeStart)]));}
          static now(){return epoch+(NativeDate.now()-nativeStart);}
        }
        window.Date=PreviewFixtureDate;
      },{epoch:fixtureEpoch});
      await page.route("https://api.open-meteo.com/**",route=>antwoord(route,weerVp));
      await page.route("https://air-quality-api.open-meteo.com/**",route=>antwoord(route,luchtFixture));
      await page.route("https://geocoding-api.open-meteo.com/**",route=>antwoord(route,zoekFixture));
      await page.route("https://api.bigdatacloud.net/**",route=>antwoord(route,{city:"Amsterdam",locality:"Amsterdam",principalSubdivision:"Noord-Holland",countryCode:"NL"}));
      await page.route("**/api/plaatsnaam**",route=>antwoord(route,{naam:"Amsterdam",land:"NL",bron:"test"}));
      await page.route("**/api/neerslag**",route=>antwoord(route,{beschikbaar:false,provider:"knmi",reden:"niet beschikbaar"}));
      await page.route("**/api/waarschuwingen**",route=>antwoord(route,{bron:"test",dekking:true,land:"NL",lijst:[]}));
      await page.route("**/api/luchtkwaliteit**",route=>antwoord(route,{beschikbaar:false,provider:"luchtmeetnet",reden:"niet beschikbaar"}));

      const params=new URLSearchParams({lat:"52.3676",lon:"4.9041",plaats:"Amsterdam",land:"NL"});
      const weatherUrl=ROOT+"/?"+params;
      const response=await page.goto(weatherUrl,{waitUntil:"domcontentloaded",timeout:30000});
      assert(response&&response.ok(),`${vp.naam}: homepage HTTP ${response&&response.status()}`);
      await page.waitForSelector("#app",{state:"visible",timeout:10000});
      await page.waitForFunction(()=>document.querySelectorAll("#days .row.day:not(.kop)").length===7,null,{timeout:10000});
      if(vp.width<=430){
        /* Reproduceer de live regressie waarin KNMI als late " · KNMI"-tekst
           naast de reeds gestructureerde bronnen belandt. De echte runtime-owner
           moet dit weer naar één bronitem normaliseren en, bij oneven aantallen,
           de laatste bron over beide kolommen centreren. */
        await page.evaluate(()=>{
          const bron=document.querySelector("footer .bron-bronnen");
          if(bron&&!/[\s>]KNMI(?:[\s<]|$)/i.test(bron.innerHTML))bron.appendChild(document.createTextNode(" · KNMI"));
          if(globalThis.WeatherNowMobileScreenshotPolish?.structureerBronnen)globalThis.WeatherNowMobileScreenshotPolish.structureerBronnen();
          if(typeof meters==="function")meters();
        });
        const add=page.locator("#chipadd");if(await add.count()&&await add.isVisible())await add.click();
        await page.waitForTimeout(500);
      }

      const basis=await page.evaluate(()=>{
        const plaats=(()=>{
          const nav=document.querySelector(".seo-plaatsnav"),grid=nav&&nav.querySelector(".seo-plaatsnav-links"),kop=nav&&nav.querySelector(".seo-plaatsnav-kop"),meer=grid&&grid.querySelector(".seo-plaatsnav-alles");
          if(!nav||!grid||!kop||!meer)return null;
          const cs=x=>getComputedStyle(x),zichtbaar=[...grid.querySelectorAll("a")].filter(x=>cs(x).display!=="none"),regulier=zichtbaar.filter(x=>x!==meer).slice(0,6);
          const tekstMidden=x=>{const range=document.createRange();range.selectNodeContents(x);const r=range.getBoundingClientRect();return (r.left+r.right)/2;};
          const gr=grid.getBoundingClientRect(),nr=nav.getBoundingClientRect(),mr=meer.getBoundingClientRect();
          const kopTekst=document.createRange(),eersteTekst=document.createRange();
          kopTekst.selectNodeContents(kop);
          if(regulier[0])eersteTekst.selectNodeContents(regulier[0]);
          const tekstDelta=regulier.length?Math.max(...regulier.map(x=>{const r=x.getBoundingClientRect();return Math.abs(tekstMidden(x)-((r.left+r.right)/2));})):999;
          return {
            display:cs(grid).display,
            columns:cs(grid).display==="grid"?(cs(grid).gridTemplateColumns||"").split(/\s+/).filter(Boolean).length:0,
            regularCount:regulier.length,
            minHeight:zichtbaar.length?Math.min(...zichtbaar.map(x=>x.getBoundingClientRect().height)):0,
            justify:regulier.length?cs(regulier[0]).justifyContent:"",
            textAlign:regulier.length?cs(regulier[0]).textAlign:"",
            textDelta:tekstDelta,
            moreWidthDelta:Math.max(Math.abs(mr.left-gr.left),Math.abs(mr.right-gr.right)),
            moreCenterDelta:Math.abs(tekstMidden(meer)-((mr.left+mr.right)/2)),
            moreJustify:cs(meer).justifyContent,
            moreTextAlign:cs(meer).textAlign,
            headingCenterDelta:Math.abs(tekstMidden(kop)-((nr.left+nr.right)/2)),
            headingLinkGap:regulier[0]?eersteTekst.getBoundingClientRect().left-kopTekst.getBoundingClientRect().right:null,
            overflow:Math.max(0,nr.right-innerWidth,-nr.left),
            background:cs(nav).backgroundColor
          };
        })();
        const mobilePolish=innerWidth<=430?(()=>{
          const svg=document.getElementById("chart"),g=typeof S!=="undefined"&&S.geo,summary=document.getElementById("final-rain-summary");
          const tempLabels=svg?[...svg.querySelectorAll('text[data-mobile-temp-index]')].filter(el=>!el.closest("#scrub")):[],tempBoxes=tempLabels.map(el=>el.getBoundingClientRect()),tempOverlap=[];
          const raakt=(a,b,p=0)=>!!a&&!!b&&a.left<b.right+p&&a.right+p>b.left&&a.top<b.bottom+p&&a.bottom+p>b.top;
          for(let i=0;i<tempBoxes.length;i++)for(let j=i+1;j<tempBoxes.length;j++)if(raakt(tempBoxes[i],tempBoxes[j],1))tempOverlap.push({a:{pos:i,index:Number(tempLabels[i].getAttribute("data-mobile-temp-index")),text:(tempLabels[i].textContent||"").trim(),rect:{left:tempBoxes[i].left,right:tempBoxes[i].right,top:tempBoxes[i].top,bottom:tempBoxes[i].bottom}},b:{pos:j,index:Number(tempLabels[j].getAttribute("data-mobile-temp-index")),text:(tempLabels[j].textContent||"").trim(),rect:{left:tempBoxes[j].left,right:tempBoxes[j].right,top:tempBoxes[j].top,bottom:tempBoxes[j].bottom}}});
          const tempPointDx=tempLabels.map(el=>{const i=el.getAttribute("data-mobile-temp-index"),p=svg.querySelector(`circle[data-temp-index="${i}"]`);return p?Math.abs(Number(el.getAttribute("x"))-Number(p.getAttribute("cx"))):999;});
          const hourLabels=svg?[...svg.querySelectorAll('text[data-mobile-hour-axis="1"]')]:[],hourX=hourLabels.map(el=>Number(el.getAttribute("x"))).filter(Number.isFinite),hourGaps=hourX.slice(1).map((x,i)=>x-hourX[i]),hourIndices=hourLabels.map(el=>Number(el.getAttribute("data-mobile-hour-index"))).filter(Number.isInteger);
          const ux=globalThis.WeatherNowMobileGraphUX20260828,expectedHourIndices=ux&&g?ux.kiesKalenderUurLabelIndices(g.TI,3,24):[];
          const expectedHourTexts=expectedHourIndices.map(i=>String(g.TI[i]||"").slice(11,13)+":00");
          const svgRect=svg&&svg.getBoundingClientRect(),binnenSvg=r=>!!svgRect&&r.left>=svgRect.left-1&&r.right<=svgRect.right+1&&r.top>=svgRect.top-1&&r.bottom<=svgRect.bottom+1;
          const tempInfo=tempLabels.map((el,k)=>({i:Number(el.getAttribute("data-mobile-temp-index")),tekst:(el.textContent||"").trim(),priority:el.getAttribute("data-mobile-temp-priority")||"",extremum:el.getAttribute("data-mobile-temp-extremum")||"",binnen:binnenSvg(tempBoxes[k])}));
          const nowText=svg?[...svg.querySelectorAll("text")].find(el=>/^nu(?:\s|$)/i.test(String(el.textContent||"").trim())):null,nowBox=nowText&&nowText.getBoundingClientRect();
          const nowOverlap=tempBoxes.filter(r=>raakt(r,nowBox,1)).length,nowAnchorRaw=nowText&&nowText.getAttribute("data-mobile-temp-anchor-index"),nowAnchor=nowAnchorRaw===null||nowAnchorRaw===undefined?NaN:Number(nowAnchorRaw);
          const anchorState=expectedHourIndices.map(i=>{
            const info=tempInfo.find(x=>x.i===i),verwacht=Number.isFinite(Number(g&&g.T&&g.T[i]))?Math.round(Number(g.T[i])):null;
            return {i,verwacht,tekst:info?info.tekst:"",priority:info?info.priority:"",viaNow:Number.isInteger(nowAnchor)&&nowAnchor===i};
          });
          const extraExtrema=ux&&g?ux.mobieleTemperatuurLabelPlan(g.TI,g.T,24).extrema:[],extremaState=extraExtrema.map(e=>({i:e.i,type:e.type,gelabeld:tempInfo.some(x=>x.i===e.i&&x.priority==="extremum")}));
          const missingAnchors=svg?.getAttribute("data-mobile-temp-missing-anchors")||"",droppedExtrema=svg?.getAttribute("data-mobile-temp-dropped-extrema")||"";
          const hourBoxes=hourLabels.map(el=>el.getBoundingClientRect()),hourOverlap=[];
          for(let i=0;i<hourBoxes.length;i++)for(let j=i+1;j<hourBoxes.length;j++)if(raakt(hourBoxes[i],hourBoxes[j],0))hourOverlap.push(i+"-"+j);
          const sunInChart=svg?[...svg.querySelectorAll("text")].filter(el=>/^zon (?:op|onder) \\d{2}:\\d{2}$/i.test(String(el.textContent||"").trim())).length:999;
          const bron=document.querySelector("footer .bron-bronnen"),items=bron?[...bron.querySelectorAll(".bronitem:not([hidden])")]:[],last=items[items.length-1]||null,br=bron&&bron.getBoundingClientRect(),lr=last&&last.getBoundingClientRect();
          const lines=items.map(el=>{const st=getComputedStyle(el.querySelector("a")||el);return {w:st.borderBottomWidth,c:st.borderBottomColor};});
          const footer=document.querySelector("footer"),direct=[...footer.querySelectorAll(":scope > span.bron")],disclaimer=direct.find(el=>/Weersinformatie is algemeen/.test(el.textContent||"")),contact=footer.querySelector(".footer-contact"),utilities=[direct.find(el=>el.querySelector('a[href="/over/"]')),direct.find(el=>el.querySelector('a[href="/privacy"]')),footer.querySelector(":scope > details.footer-details")].filter(Boolean);
          const utilityBottom=utilities.length?Math.max(...utilities.map(el=>el.getBoundingClientRect().bottom)):0;
          const chip=document.querySelector(".chip.on"),probe=document.createElement("i");probe.style.color="var(--accent-active)";document.body.appendChild(probe);const accent=getComputedStyle(probe).color;probe.remove();
          const metric=["gust","pop"].map(id=>document.getElementById(id)?.closest(".stat")?.querySelector(".eyebrow")).filter(Boolean).map(el=>{const st=getComputedStyle(el),rect=el.getBoundingClientRect();return {text:(el.textContent||"").trim(),lineHeight:parseFloat(st.lineHeight)||0,fontSize:parseFloat(st.fontSize)||0,minHeight:parseFloat(st.minHeight)||0,width:rect.width,scrollWidth:el.scrollWidth};});
          const sr=svg&&svg.getBoundingClientRect(),rr=summary&&!summary.hidden&&summary.getBoundingClientRect();
          const disclosure=sel=>{const el=document.querySelector(sel);if(!el||el.hidden||getComputedStyle(el).display==="none")return null;const r=el.getBoundingClientRect(),st=getComputedStyle(el);return {height:r.height,width:r.width,expanded:el.getAttribute("aria-expanded")||"",controls:el.getAttribute("aria-controls")||"",display:st.display,pointerEvents:st.pointerEvents,visibility:st.visibility,after:getComputedStyle(el,"::after").content};};
          const nightRow=document.querySelector("#nights .row.night:not(.kop):not([hidden])");
          return {
            tempCount:tempLabels.length,tempOverlap:tempOverlap.length,tempOverlapPairs:tempOverlap,tempPointDx,tempInfo,nowOverlap,anchorState,extremaState,missingAnchors,droppedExtrema,
            tempClipped:tempInfo.filter(x=>!x.binnen).length,hourClipped:hourBoxes.filter(r=>!binnenSvg(r)).length,hourOverlap:hourOverlap.length,
            hourCount:hourLabels.length,hourTexts:hourLabels.map(el=>(el.textContent||"").trim()),hourTimes:hourIndices.map(i=>String(g&&g.TI&&g.TI[i]||"")),hourGaps,hourIndices,expectedHourIndices,expectedHourTexts,sunInChart,
            disclosures:{hours:disclosure(".wiw-hour-toggle"),nights:disclosure("#nights .nacht-meer")},
            nightOverflow:nightRow?Math.max(0,nightRow.scrollWidth-nightRow.clientWidth):0,nightHeight:nightRow?nightRow.getBoundingClientRect().height:0,
            compact:svg?.getAttribute("data-mobile-compact-height")||"",
            chartSummaryGap:sr&&rr?rr.top-sr.bottom:null,viewBox:svg?.getAttribute("viewBox")||"",plotBottom:g?Number(g.pt)+Number(g.ih):null,
            sourceCount:items.length,lastOdd:!!last&&last.classList.contains("wiw-source-last-odd"),lastText:last?(last.textContent||"").trim():"",
            lastCenterDelta:br&&lr?Math.abs((lr.left+lr.right-br.left-br.right)/2):999,lineWidths:lines.map(x=>x.w),lineColors:lines.map(x=>x.c),
            sourceDisclaimerGap:br&&disclaimer?disclaimer.getBoundingClientRect().top-br.bottom:0,utilityContactGap:contact?contact.getBoundingClientRect().top-utilityBottom:0,
            chipBorder:chip?getComputedStyle(chip).borderColor:"",chipShadow:chip?getComputedStyle(chip).boxShadow:"",accent,
            metric
          };
        })():null;
        return {
          plaats,mobilePolish,
          sha:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
          overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,
          pressureRetired:!document.getElementById("pres")&&!document.getElementById("pressub")&&!document.getElementById("wiw-pressure-diagnostic")&&!/\bLuchtdruk\b/i.test(document.body.innerText||""),
          searchRect:(()=>{const r=document.getElementById("q")?.getBoundingClientRect();return r?{left:r.left,right:r.right,width:r.width}:null;})(),
          topRects:[...document.querySelectorAll(".mast button,.mast input")]
            .filter(el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=="hidden")
            .map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height,label:el.getAttribute("aria-label")||el.textContent||el.id||el.tagName};}),
          legeNeerslag:[...document.querySelectorAll("#days .row.day:not(.kop) .drain")].filter(el=>!(el.textContent||el.getAttribute("aria-label")||"").trim()).length,
          hourTable:(()=>{const table=document.getElementById("wiw-hour-table"),panel=document.getElementById("wiw-hour-panel"),scroll=document.getElementById("wiw-hour-scroll"),main=document.querySelector(".wiw-chart-main");if(!table||!panel||!scroll||!main)return null;const rows=[...table.querySelectorAll("tbody tr")].filter(el=>el.getBoundingClientRect().height>0),tr=table.getBoundingClientRect(),pr=panel.getBoundingClientRect(),mr=main.getBoundingClientRect(),tbody=table.querySelector("tbody"),tbr=tbody&&tbody.getBoundingClientRect();return {fontSize:parseFloat(getComputedStyle(table).fontSize)||0,lineHeight:parseFloat(getComputedStyle(table).lineHeight)||0,rowCount:rows.length,overflowY:getComputedStyle(scroll).overflowY,lastFit:!rows.length||rows.at(-1).getBoundingClientRect().bottom<=pr.bottom+1,tableWidth:tr.width,panelWidth:pr.width,panelHeight:pr.height,mainHeight:mr.height,tableTop:rows.length?rows[0].getBoundingClientRect().top-pr.top:null,tbodyTop:tbr?tbr.top-pr.top:null,rowHeights:rows.map(r=>r.getBoundingClientRect().height),candidateHours:Number(panel.dataset.candidateHours||0),rowPad:getComputedStyle(panel).getPropertyValue("--wiw-hour-row-pad-extra").trim()};})(),
          appText:document.getElementById("app")?.textContent||""
        };
      });
      if(vp.width<=430){const preassert=path.join(evidence,`preview-${vp.width}-preassert.png`);await page.screenshot({path:preassert,fullPage:true});assert(fs.existsSync(preassert)&&fs.statSync(preassert).size>5000,`${vp.naam}: pre-assert screenshot ontbreekt of is verdacht klein`);}
      assert.equal(basis.sha,verwacht,`${vp.naam}: verkeerde preview-SHA ${basis.sha}`);
      assert(basis.overflow<=1,`${vp.naam}: ${basis.overflow}px horizontale pagina-overflow`);
      assert.equal(basis.pressureRetired,true,`${vp.naam}: luchtdrukfeature is niet volledig uit de gedeployde preview verwijderd`);
      assert.equal(basis.legeNeerslag,0,`${vp.naam}: lege neerslagpositie in dagtabel`);
      assert(!/(?:^|[^\d])-?1\s+graden\b/i.test(basis.appText),`${vp.naam}: enkelvoudtemperatuur gebruikt 'graden'`);
      assert(binnenViewport(basis.searchRect,vp.width),`${vp.naam}: zoekveld valt buiten viewport`);
      for(const r of basis.topRects)assert(binnenViewport(r,vp.width),`${vp.naam}: zichtbare bovenste bediening '${String(r.label).trim()}' valt buiten viewport`);
      if(vp.width>=1100){
        if(vp.width>=1300)assert(basis.plaats&&basis.plaats.headingLinkGap>=8,`${vp.naam}: plaatsenkop raakt de eerste link (${basis.plaats?.headingLinkGap}px)`);
        const u=basis.hourTable;assert(u,`${vp.naam}: desktop-uurtabel ontbreekt`);
        assert(u.fontSize>=13.4,`${vp.naam}: desktop-uurtabel blijft te klein (${u.fontSize}px)`);
        assert(u.rowCount>=8&&u.rowCount<=11,`${vp.naam}: desktop-uurtabel toont geen 8–11 volledige hoogtegestuurde uren (${u.rowCount})`);
        if(vp.width>=1440&&u.rowCount<10)console.log(`${vp.naam}: desktop-hour-diagnose ${JSON.stringify(u)}`);
        if(vp.width>=1440)assert(u.rowCount>=10,`${vp.naam}: ruime desktop toont minder dan circa 10 volledige uren (${u.rowCount}); ${JSON.stringify(u)}`);
        assert.equal(u.overflowY,"visible",`${vp.naam}: desktop-uurtabel heeft opnieuw een interne verticale scrollbar (${u.overflowY})`);
        assert.equal(u.lastFit,true,`${vp.naam}: laatste desktop-uurregel is niet volledig zichtbaar`);
      }
      if(vp.width<=430){
        const p=basis.plaats;
        assert(p,`${vp.naam}: populaire-plaatsennavigatie ontbreekt op gedeployde preview`);
        assert.equal(p.display,"grid",`${vp.naam}: populaire plaatsen gebruikt geen grid`);
        assert.equal(p.columns,2,`${vp.naam}: populaire plaatsen gebruikt ${p.columns} in plaats van 2 kolommen`);
        assert.equal(p.regularCount,6,`${vp.naam}: compacte mobiele selectie bevat ${p.regularCount} in plaats van 6 plaatsen`);
        assert(p.minHeight>=43.5,`${vp.naam}: plaatslink verliest 44px touch target (${p.minHeight}px)`);
        assert.equal(p.justify,"center",`${vp.naam}: plaatslink justify-content is ${p.justify}`);
        assert.equal(p.textAlign,"center",`${vp.naam}: plaatslink text-align is ${p.textAlign}`);
        assert(p.textDelta<=1,`${vp.naam}: plaatsnaam staat ${p.textDelta}px uit het midden van zijn kolom`);
        assert.equal(p.moreJustify,"center",`${vp.naam}: Meer plaatsen justify-content is ${p.moreJustify}`);
        assert.equal(p.moreTextAlign,"center",`${vp.naam}: Meer plaatsen text-align is ${p.moreTextAlign}`);
        assert(p.moreWidthDelta<=1.5,`${vp.naam}: Meer plaatsen spant niet over beide kolommen (delta ${p.moreWidthDelta}px)`);
        assert(p.moreCenterDelta<=1,`${vp.naam}: Meer plaatsen staat ${p.moreCenterDelta}px uit het midden`);
        assert(p.headingCenterDelta<=1.5,`${vp.naam}: sectietitel verspringt ${p.headingCenterDelta}px uit het midden`);
        assert(p.overflow<=1,`${vp.naam}: populaire plaatsen veroorzaakt ${p.overflow}px overflow`);
        const m=basis.mobilePolish;
        assert(m,`${vp.naam}: mobile-polishmeting ontbreekt`);
        assert(m.tempCount>=m.hourCount-1,`${vp.naam}: mobiele grafiek mist verplichte temperatuurankers (${m.tempCount}/${m.hourCount})`);
        assert.equal(m.tempOverlap,0,`${vp.naam}: temperatuurlabels overlappen geometrisch ${JSON.stringify(m.tempOverlapPairs)}`);
        assert.equal(m.nowOverlap,0,`${vp.naam}: temperatuurlabel botst met de actuele nu-markering`);
        assert.equal(m.tempClipped,0,`${vp.naam}: temperatuurtekst valt buiten de SVG-rand`);
        assert.equal(m.hourClipped,0,`${vp.naam}: uurtekst valt buiten de SVG-rand`);
        assert.equal(m.hourOverlap,0,`${vp.naam}: drie-uurslabels overlappen geometrisch`);
        assert(m.tempPointDx.every(dx=>dx<=18),`${vp.naam}: temperatuurcijfer wijkt meer dan licht horizontaal van het datapunt af (${m.tempPointDx.join("/")})`);
        assert.equal(m.hourCount,m.expectedHourIndices.length,`${vp.naam}: mobiele uuras heeft ${m.hourCount} labels, verwacht ${m.expectedHourIndices.length} echte drie-uursankers`);
        assert.deepEqual(m.hourIndices,m.expectedHourIndices,`${vp.naam}: mobiele uuras volgt niet exact de forecasttijd-gedreven drie-uurscadans`);
        assert.deepEqual(m.hourTexts,m.expectedHourTexts,`${vp.naam}: zichtbare kloklabels horen niet bij dezelfde forecastpunten`);
        assert.equal(m.missingAnchors,"",`${vp.naam}: verplicht temperatuurlabel kon niet collisionvrij worden geplaatst (${m.missingAnchors})`);
        for(const a of m.anchorState){
          assert(a.viaNow||a.priority==="anchor",`${vp.naam}: verplicht drie-uursanker ${a.i} mist een temperatuurlabel`);
          if(!a.viaNow)assert.equal(a.tekst,String(a.verwacht)+"°",`${vp.naam}: temperatuur bij anker ${a.i} hoort niet bij hetzelfde forecastpunt (${a.tekst}/${a.verwacht}°)`);
        }
        assert(m.extremaState.every(e=>e.gelabeld),`${vp.naam}: geplande piek/dal ontbreekt terwijl de browsergeometrie ruimte biedt (${JSON.stringify(m.extremaState)}; vervallen=${m.droppedExtrema})`);
        assert.equal(m.sunInChart,0,`${vp.naam}: dubbele zon-op/zon-ondertekst staat nog in de SVG`);
        assert.equal(m.compact,"1",`${vp.naam}: grafiekhoogte is niet mobiel gecompacteerd`);
        if(m.chartSummaryGap!==null)assert(m.chartSummaryGap>=0&&m.chartSummaryGap<=18,`${vp.naam}: grafiek-samenvatting heeft ${m.chartSummaryGap}px tussenruimte`);
        assert(m.sourceCount>=3,`${vp.naam}: te weinig zichtbare bronitems (${m.sourceCount})`);
        assert(m.lineWidths.every(x=>Math.abs(parseFloat(x)-1)<=.1),`${vp.naam}: bronlijnen zijn niet overal 1px (${m.lineWidths.join("/")})`);
        assert.equal(new Set(m.lineColors).size,1,`${vp.naam}: bronlijnen gebruiken verschillende kleuren (${m.lineColors.join(" / ")})`);
        if(m.sourceCount%2===1){
          assert.equal(m.lastOdd,true,`${vp.naam}: laatste oneven bron spant niet over beide kolommen`);
          assert(m.lastCenterDelta<=1.5,`${vp.naam}: laatste oneven bron staat ${m.lastCenterDelta}px uit het midden`);
        }
        assert(!/^[·/]/.test(m.lastText),`${vp.naam}: losse middot/slash staat nog vóór laatste bron: ${m.lastText}`);
        assert(m.sourceDisclaimerGap>=3,`${vp.naam}: disclaimer staat te dicht op bronnen (${m.sourceDisclaimerGap}px)`);
        assert(m.utilityContactGap>=7,`${vp.naam}: supportregel staat te dicht op utilitylinks (${m.utilityContactGap}px)`);
        assert(m.nightOverflow<=1,`${vp.naam}: Nachtzicht veroorzaakt ${m.nightOverflow}px interne horizontale overflow`);
        for(const [naam,d] of Object.entries(m.disclosures)){
          assert(d,`${vp.naam}: disclosure '${naam}' is niet zichtbaar`);
          assert(d.height>=43.5,`${vp.naam}: disclosure '${naam}' verliest 44px touch target (${d.height}px)`);
          assert.equal(d.display,"flex",`${vp.naam}: disclosure '${naam}' gebruikt niet het gedeelde flexpatroon`);
          assert(["true","false"].includes(d.expanded),`${vp.naam}: disclosure '${naam}' mist aria-expanded`);
          assert.notEqual(d.pointerEvents,"none",`${vp.naam}: disclosure '${naam}' accepteert geen pointer-events`);
          assert.notEqual(d.visibility,"hidden",`${vp.naam}: disclosure '${naam}' is verborgen`);
          assert(/›/.test(d.after),`${vp.naam}: disclosure '${naam}' mist de subtiele chevron`);
        }
        assert(m.disclosures.hours.controls,`${vp.naam}: Alle uren bekijken mist aria-controls`);

        /* Native buttons moeten niet alleen bestaan: Enter/Space moeten de echte
           disclosure activeren, aria-expanded synchroniseren en de knop zelf
           geometrisch stabiel laten. De inhoud mag de pagina langer maken,
           maar niet horizontaal verschuiven of de actie laten springen. */
        for(const [naam,selector] of [["uren",".wiw-hour-toggle"],["nachten","#nights .nacht-meer"]]){
          const knop=page.locator(selector);
          await knop.scrollIntoViewIfNeeded();
          const voor=await knop.boundingBox(),begin=await knop.getAttribute("aria-expanded");
          const pointerHit=await page.evaluate(sel=>{const el=document.querySelector(sel);if(!el)return false;const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(x<0||x>innerWidth||y<0||y>innerHeight)return false;const hit=document.elementFromPoint(x,y);return hit===el||el.contains(hit);},selector);
          assert(voor&&["true","false"].includes(begin||""),`${vp.naam}: ${naam}-disclosure is niet toetsenbordklaar`);
          assert.equal(pointerHit,true,`${vp.naam}: ${naam}-disclosure is na scrollIntoView niet werkelijk raakbaar in het midden`);
          await knop.focus();await knop.press("Enter");
          const naEnter=await knop.getAttribute("aria-expanded"),boxEnter=await knop.boundingBox();
          assert.notEqual(naEnter,begin,`${vp.naam}: Enter toggelt ${naam}-disclosure niet`);
          assert(boxEnter&&Math.abs(boxEnter.width-voor.width)<=1&&Math.abs(boxEnter.height-voor.height)<=1,`${vp.naam}: ${naam}-disclosure verandert van afmeting bij openen`);
          assert((await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth))<=1,`${vp.naam}: ${naam}-disclosure introduceert horizontale overflow`);
          await knop.press("Space");
          const terug=await knop.getAttribute("aria-expanded"),boxTerug=await knop.boundingBox();
          assert.equal(terug,begin,`${vp.naam}: Space herstelt ${naam}-disclosure niet`);
          assert(boxTerug&&Math.abs(boxTerug.width-voor.width)<=1&&Math.abs(boxTerug.height-voor.height)<=1,`${vp.naam}: ${naam}-disclosure is geometrisch niet stabiel na sluiten`);
        }

        assert(m.chipBorder&&m.chipBorder!==m.accent,`${vp.naam}: actieve opgeslagen plaats gebruikt nog warning-accent`);
        assert(m.chipShadow&&m.chipShadow!=="none",`${vp.naam}: actieve opgeslagen plaats is niet meer herkenbaar als selectie`);
        assert(m.metric.length>=2,`${vp.naam}: lange metrieklabels ontbreken in fixture`);
        for(const metric of m.metric){
          assert(metric.lineHeight<=metric.fontSize*1.25,`${vp.naam}: metrieklabel '${metric.text}' heeft te ruime regelhoogte`);
          assert(metric.minHeight>=metric.lineHeight*1.9,`${vp.naam}: metrieklabel '${metric.text}' heeft geen stabiele tweeregelige kopruimte`);
          assert(metric.scrollWidth<=metric.width+1,`${vp.naam}: metrieklabel '${metric.text}' veroorzaakt interne overflow`);
        }
      }

      await page.locator("#thema").scrollIntoViewIfNeeded();
      const themaVoor=await page.evaluate(()=>{
        const groep=document.getElementById("thema"),auto=document.getElementById("thema-auto"),schakelaar=document.getElementById("thema-switch"),zon=schakelaar?.querySelector(".wiw-theme-sun"),maan=schakelaar?.querySelector(".wiw-theme-moon"),r=groep?.getBoundingClientRect(),track=schakelaar?.querySelector(".wiw-theme-track")?.getBoundingClientRect(),thumb=schakelaar?.querySelector(".wiw-theme-thumb")?.getBoundingClientRect();
        const ar=auto?.getBoundingClientRect(),zr=zon?.getBoundingClientRect(),mr=maan?.getBoundingClientRect();
        const raakbaar=el=>{if(!el)return false;const q=el.getBoundingClientRect(),hit=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);return hit===el||el.contains(hit);};
        const stijl=el=>{if(!el)return null;const s=getComputedStyle(el);return {fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,alignItems:s.alignItems,color:s.color,background:s.backgroundColor};};
        return {
          role:groep?.getAttribute("role")||"",
          popup:groep?.getAttribute("aria-haspopup")||"",
          expanded:groep?.getAttribute("aria-expanded")||"",
          keuze:groep?.dataset.actieveThemaKeuze||"",
          actief:document.documentElement.getAttribute("data-thema")||"",
          autoPressed:auto?.getAttribute("aria-pressed")||"",
          switchRole:schakelaar?.getAttribute("role")||"",
          checked:schakelaar?.getAttribute("aria-checked")||"",
          menu:!!document.getElementById("themamenu"),
          icons:!!zon&&!!maan,
          toggleWidth:schakelaar?.getBoundingClientRect().width||0,
          segmentHit:{licht:raakbaar(zon),auto:raakbaar(auto),donker:raakbaar(maan)},
          trackWidth:track?.width||0,
          thumbWidth:thumb?.width||0,
          rect:r?{left:r.left,right:r.right,width:r.width,height:r.height,top:r.top}:null,
          segmenten:ar&&zr&&mr?{
            auto:{left:ar.left,width:ar.width,height:ar.height,top:ar.top},
            licht:{left:zr.left,width:zr.width,height:zr.height,top:zr.top,label:getComputedStyle(zon,"::after").content,icoonLabelGap:getComputedStyle(zon,"::after").marginLeft},
            donker:{left:mr.left,width:mr.width,height:mr.height,top:mr.top,label:getComputedStyle(maan,"::after").content,icoonLabelGap:getComputedStyle(maan,"::after").marginLeft},
            stijlen:{auto:stijl(auto),licht:stijl(zon),donker:stijl(maan)}
          }:null
        };
      });
      assert.equal(themaVoor.role,"group",`${vp.naam}: Weergavegroep heeft niet de verwachte semantische group-rol`);
      assert.equal(themaVoor.popup,"",`${vp.naam}: Weergave kondigt nog een uitklapmenu aan`);
      assert.equal(themaVoor.expanded,"",`${vp.naam}: Weergavegroep draagt nog een menu-expanded-status`);
      assert.equal(themaVoor.keuze,"auto",`${vp.naam}: verse sessie start niet in Auto`);
      assert.equal(themaVoor.autoPressed,"true",`${vp.naam}: Auto is initieel niet als actieve keuze gemarkeerd`);
      assert.equal(themaVoor.switchRole,"switch",`${vp.naam}: Licht/donker-bediening heeft geen switch-rol`);
      assert(["true","false"].includes(themaVoor.checked),`${vp.naam}: Licht/donker-bediening heeft geen geldige checked-status`);
      assert.equal(themaVoor.menu,false,`${vp.naam}: oude Auto/Licht/Donker-menu is nog aanwezig`);
      assert.equal(themaVoor.icons,true,`${vp.naam}: zon- en maansymbool ontbreken in de toggle`);
      assert(themaVoor.toggleWidth>=60,`${vp.naam}: Licht/donker-toggle is te smal (${themaVoor.toggleWidth}px)`);
      assert(Math.abs(themaVoor.toggleWidth-themaVoor.rect.width)<=2,`${vp.naam}: Licht/donker-switch spant niet over de volledige driewegbediening (${themaVoor.toggleWidth}/${themaVoor.rect.width}px)`);
      assert.equal(themaVoor.segmentHit.licht,true,`${vp.naam}: Licht-segment is geometrisch aanwezig maar niet raakbaar/zichtbaar`);
      assert.equal(themaVoor.segmentHit.auto,true,`${vp.naam}: Auto-segment is geometrisch aanwezig maar niet raakbaar/zichtbaar`);
      assert.equal(themaVoor.segmentHit.donker,true,`${vp.naam}: Donker-segment is geometrisch aanwezig maar niet raakbaar/zichtbaar`);
      assert(themaVoor.trackWidth>=24&&themaVoor.trackWidth<=34,`${vp.naam}: toggle-track heeft onverwachte breedte (${themaVoor.trackWidth}px)`);
      assert(themaVoor.thumbWidth>=10&&themaVoor.thumbWidth<=16,`${vp.naam}: toggle-thumb heeft onverwachte breedte (${themaVoor.thumbWidth}px)`);
      assert(binnenViewport(themaVoor.rect,vp.width),`${vp.naam}: Weergavegroep valt buiten viewport`);
      const s=themaVoor.segmenten;
      assert(s,`${vp.naam}: driewegsegmenten ontbreken`);
      const minimaleHoogte=vp.width<=430?45.5:vp.width<=900?43.5:35.5;
      const minimaleSegmentHoogte=vp.width<=430?43.5:vp.width<=900?43.5:35;
      assert(themaVoor.rect.height>=minimaleHoogte,`${vp.naam}: themarij is te laag (${themaVoor.rect.height}px)`);
      for(const [naam,seg] of [["licht",s.licht],["auto",s.auto],["donker",s.donker]])assert(seg.height>=minimaleSegmentHoogte,`${vp.naam}: ${naam}-touchdoel is te laag (${seg.height}px)`);
      const breedtes=[s.auto.width,s.licht.width,s.donker.width];
      assert(Math.max(...breedtes)-Math.min(...breedtes)<=2,`${vp.naam}: Auto/Licht/Donker zijn niet gelijk verdeeld (${breedtes.map(x=>x.toFixed(1)).join("/")}px)`);
      assert(s.licht.left<s.auto.left&&s.auto.left<s.donker.left,`${vp.naam}: volgorde is niet Licht | Auto | Donker`);
      assert(Math.max(Math.abs(s.auto.top-s.licht.top),Math.abs(s.auto.top-s.donker.top))<=1,`${vp.naam}: thema-opties delen niet één rij`);
      assert(/Licht/i.test(s.licht.label),`${vp.naam}: zichtbaar Licht-label ontbreekt`);
      assert(/Donker/i.test(s.donker.label),`${vp.naam}: zichtbaar Donker-label ontbreekt`);
      assert(parseFloat(s.licht.icoonLabelGap)>=6&&parseFloat(s.donker.icoonLabelGap)>=6,`${vp.naam}: icoon-labelafstand is te klein (${s.licht.icoonLabelGap}/${s.donker.icoonLabelGap})`);
      for(const eigenschap of ["fontFamily","fontSize","fontWeight","lineHeight","letterSpacing","alignItems"]){
        const waarden=[s.stijlen.auto[eigenschap],s.stijlen.licht[eigenschap],s.stijlen.donker[eigenschap]];
        assert.equal(new Set(waarden).size,1,`${vp.naam}: typografische basis '${eigenschap}' verschilt (${waarden.join(" / ")})`);
      }

      await page.locator('[data-thema-handmatig="licht"]').click();
      const lichtNa=await page.evaluate(()=>{
        const groep=document.getElementById("thema"),auto=document.getElementById("thema-auto"),zon=document.querySelector('[data-thema-handmatig="licht"]'),maan=document.querySelector('[data-thema-handmatig="donker"]');
        return {keuze:groep?.dataset.actieveThemaKeuze||"",actief:document.documentElement.getAttribute("data-thema")||"",gewichten:[auto,zon,maan].map(el=>getComputedStyle(el).fontWeight)};
      });
      assert.equal(lichtNa.keuze,"licht",`${vp.naam}: expliciete Licht-keuze wordt niet actief`);
      assert.equal(lichtNa.actief,"licht",`${vp.naam}: gerenderd thema volgt Licht-keuze niet`);
      assert.equal(new Set(lichtNa.gewichten).size,1,`${vp.naam}: actieve Licht-keuze verandert de typografische zwaarte`);

      await page.locator('[data-thema-handmatig="donker"]').click();
      const themaNa=await page.evaluate(()=>{
        const lees=key=>{try{const raw=localStorage.getItem(key);return raw==null?null:JSON.parse(raw);}catch(e){return null;}};
        const leesSessie=key=>{try{const raw=sessionStorage.getItem(key);return raw==null?null:JSON.parse(raw);}catch(e){return null;}};
        const groep=document.getElementById("thema"),schakelaar=document.getElementById("thema-switch");
        return {
          keuze:groep?.dataset.actieveThemaKeuze||"",
          actief:document.documentElement.getAttribute("data-thema")||"",
          autoPressed:document.getElementById("thema-auto")?.getAttribute("aria-pressed")||"",
          checked:schakelaar?.getAttribute("aria-checked")||"",
          sessie:leesSessie("weerbriefing.thema.sessie"),
          legacyMirror:lees("weerbriefing.thema"),
          actiefBewaar:lees("weerbriefing.actiefThema"),
          label:schakelaar?.getAttribute("aria-label")||"",
          title:schakelaar?.getAttribute("title")||"",
          gewichten:[document.getElementById("thema-auto"),document.querySelector('[data-thema-handmatig="licht"]'),document.querySelector('[data-thema-handmatig="donker"]')].map(el=>getComputedStyle(el).fontWeight)
        };
      });
      assert.equal(themaNa.keuze,"donker",`${vp.naam}: expliciete Donker-keuze wordt niet actief`);
      assert.equal(themaNa.actief,"donker",`${vp.naam}: gerenderd thema volgt Donker-keuze niet`);
      assert.equal(themaNa.autoPressed,"false",`${vp.naam}: Auto blijft actief na handmatige Donker-keuze`);
      assert.equal(themaNa.checked,"true",`${vp.naam}: Donker-stand wordt niet zichtbaar aangezet`);
      assert.equal(themaNa.sessie,"donker",`${vp.naam}: expliciete themakeuze wordt niet sessiegebonden opgeslagen`);
      assert.equal(themaNa.legacyMirror,"donker",`${vp.naam}: compatibiliteitsmirror volgt de sessiekeuze niet`);
      assert.equal(themaNa.actiefBewaar,"donker",`${vp.naam}: actieve themastaat wordt niet opgeslagen`);
      assert(themaNa.label&&themaNa.title,`${vp.naam}: Licht/donker-toggle mist toegankelijke toestandstekst`);
      assert.equal(new Set(themaNa.gewichten).size,1,`${vp.naam}: actieve Donker-keuze verandert de typografische zwaarte`);
      if(vp.width<=430){
        const donkerPlaats=await page.evaluate(()=>{
          const nav=document.querySelector(".seo-plaatsnav"),grid=nav&&nav.querySelector(".seo-plaatsnav-links"),meer=grid&&grid.querySelector(".seo-plaatsnav-alles"),eerste=grid&&[...grid.querySelectorAll("a")].find(x=>x!==meer&&getComputedStyle(x).display!=="none");
          return nav&&grid&&meer&&eerste?{background:getComputedStyle(nav).backgroundColor,justify:getComputedStyle(eerste).justifyContent,textAlign:getComputedStyle(eerste).textAlign,moreJustify:getComputedStyle(meer).justifyContent,moreTextAlign:getComputedStyle(meer).textAlign}:null;
        });
        assert(donkerPlaats,`${vp.naam}: donkere populaire-plaatsennavigatie ontbreekt`);
        assert.notEqual(donkerPlaats.background,"rgb(255, 255, 255)",`${vp.naam}: donkere populaire-plaatsensectie valt terug naar wit`);
        assert.equal(donkerPlaats.justify,"center",`${vp.naam}: plaatsnamen verliezen centrering in dark mode`);
        assert.equal(donkerPlaats.textAlign,"center",`${vp.naam}: plaatsnamen verliezen text-align in dark mode`);
        assert.equal(donkerPlaats.moreJustify,"center",`${vp.naam}: Meer plaatsen verliest centrering in dark mode`);
        assert.equal(donkerPlaats.moreTextAlign,"center",`${vp.naam}: Meer plaatsen verliest text-align in dark mode`);
        const donkerPolish=await page.evaluate(()=>{
          const bron=document.querySelector("footer .bron-bronnen"),items=bron?[...bron.querySelectorAll(".bronitem:not([hidden])")]:[],chip=document.querySelector(".chip.on");
          return {lineColors:items.map(el=>getComputedStyle(el.querySelector("a")||el).borderBottomColor),chipBorder:chip?getComputedStyle(chip).borderColor:"",overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth};
        });
        assert.equal(new Set(donkerPolish.lineColors).size,1,`${vp.naam}: bronlijnen worden inconsistent in dark mode`);
        assert(donkerPolish.chipBorder,`${vp.naam}: actieve opgeslagen plaats verliest dark-mode selectie`);
        assert(donkerPolish.overflow<=1,`${vp.naam}: dark mode introduceert horizontale overflow (${donkerPolish.overflow}px)`);
        const darkPng=path.join(evidence,`preview-${vp.width}-dark.png`);
        await page.screenshot({path:darkPng,fullPage:true});
        assert(fs.existsSync(darkPng)&&fs.statSync(darkPng).size>5000,`${vp.naam}: dark-mode screenshot ontbreekt of is verdacht klein`);
      }

      if([320,375,390].includes(vp.width)){
        /* Text-only zoom: vergroot de werkelijk zichtbare HTML-tekst met 125%,
           terwijl viewport en kaarten gelijk blijven. SVG-labels zijn al op
           hun eigen geometrie gecontroleerd. Bewaar een apart bewijsbeeld. */
        const zoom=await page.evaluate(()=>{
          const wortel=document.querySelector(".sheet"),walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
          const elementen=new Set();let tekst;
          while((tekst=walker.nextNode())){
            const el=tekst.parentElement;
            if(!el||!tekst.textContent.trim()||el.closest("svg,script,style")||!(wortel?.contains(el)||el.closest(".seo-plaatsnav")))continue;
            if(el.getClientRects().length)elementen.add(el);
          }
          const fonts=[...elementen].map(el=>({el,size:parseFloat(getComputedStyle(el).fontSize)})).filter(x=>Number.isFinite(x.size)&&x.size>0);
          fonts.forEach(x=>x.el.style.setProperty("font-size",`${(x.size*1.25).toFixed(2)}px`,"important"));
          const selectors=[".wiw-hour-toggle","#nights .nacht-meer","footer .footer-contact a",".seo-plaatsnav-alles"];
          const headers=[...document.querySelectorAll("#wiw-hour-table thead th")].map(el=>({text:el.textContent.trim(),scroll:el.scrollWidth,client:el.clientWidth}));
          return {count:fonts.length,overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,headers,
            doelen:selectors.map(selector=>{const r=document.querySelector(selector)?.getBoundingClientRect();return {selector,width:r?.width||0,left:r?.left??-1,right:r?.right??Infinity};})};
        });
        assert(zoom.count>60,`${vp.naam}: tekstzoom raakte te weinig zichtbare tekst (${zoom.count})`);
        assert(zoom.overflow<=1,`${vp.naam}: 125% tekstzoom introduceert ${zoom.overflow}px horizontale overflow`);
        assert(zoom.headers.length===4&&zoom.headers.every(h=>h.scroll<=h.client+1),`${vp.naam}: uurtabelkop wordt bij 125% tekstzoom afgeknipt (${JSON.stringify(zoom.headers)})`);
        for(const doel of zoom.doelen)assert(doel.width>=43.5&&doel.left>=-1&&doel.right<=vp.width+1,`${vp.naam}: 125% tekstzoom duwt ${doel.selector} buiten beeld (${JSON.stringify(doel)})`);
        const zoomPng=path.join(evidence,`preview-${vp.width}-dark-textzoom-125.png`);
        await page.screenshot({path:zoomPng,fullPage:true});
        assert(fs.existsSync(zoomPng)&&fs.statSync(zoomPng).size>5000,`${vp.naam}: tekstzoom-screenshot ontbreekt`);
      }

      /* Navigatie in dezelfde tab houdt sessionStorage bewust vast. Daarmee
         bewijzen we het nieuwe contract zonder de oude permanente localStorage-
         voorkeur opnieuw tot bron van waarheid te maken. */
      const hubResponse=await page.goto(ROOT+"/weer/",{waitUntil:"domcontentloaded",timeout:30000});
      assert(hubResponse&&hubResponse.ok(),`${vp.naam}: /weer/ HTTP ${hubResponse&&hubResponse.status()}`);
      await page.waitForSelector("#thema",{state:"visible",timeout:5000});
      const hubState=await page.evaluate(()=>{
        const knop=document.getElementById("thema"),r=knop?.getBoundingClientRect(),script=document.querySelector('script[src="/theme-hub.js"]'),eersteCss=document.querySelector('style,link[rel="stylesheet"]');
        const zon=knop?.querySelector(".wiw-theme-sun")?.getBoundingClientRect(),track=knop?.querySelector(".wiw-theme-track")?.getBoundingClientRect(),maan=knop?.querySelector(".wiw-theme-moon")?.getBoundingClientRect();
        return {
          actief:document.documentElement.getAttribute("data-thema")||"licht",
          checked:knop?.getAttribute("aria-checked")||"",
          role:knop?.getAttribute("role")||"",
          menu:!!document.getElementById("themamenu"),
          zonNaarTrack:zon&&track?track.left-zon.right:-1,
          trackNaarMaan:track&&maan?maan.left-track.right:-1,
          rect:r?{left:r.left,right:r.right,width:r.width}:null,
          scriptVoorCss:!!script&&!!eersteCss&&!!(script.compareDocumentPosition(eersteCss)&Node.DOCUMENT_POSITION_FOLLOWING)
        };
      });
      assert.equal(hubState.actief,"donker",`${vp.naam}: sessiegebonden Donker-keuze valt terug bij navigatie naar /weer/`);
      assert.equal(hubState.checked,"true",`${vp.naam}: /weer/-switch weerspiegelt de sessiegebonden Donker-keuze niet`);
      assert.equal(hubState.role,"switch",`${vp.naam}: /weer/ gebruikt geen semantische switch`);
      assert.equal(hubState.menu,false,`${vp.naam}: /weer/ bevat ten onrechte het weather-themamenu`);
      assert(hubState.zonNaarTrack>=7.5&&hubState.zonNaarTrack<=10.5,`${vp.naam}: /weer/ zon-switchafstand ${hubState.zonNaarTrack}px valt buiten 8–10px richtlijn`);
      assert(hubState.trackNaarMaan>=9.5&&hubState.trackNaarMaan<=12.5,`${vp.naam}: /weer/ switch-maanafstand ${hubState.trackNaarMaan}px valt buiten 10–12px richtlijn`);
      assert(binnenViewport(hubState.rect,vp.width),`${vp.naam}: /weer/-switch valt buiten viewport`);
      assert.equal(hubState.scriptVoorCss,true,`${vp.naam}: /weer/ themascript staat niet vóór de eerste inline of externe CSS`);
      await page.reload({waitUntil:"domcontentloaded",timeout:30000});
      assert.equal(await page.evaluate(()=>document.documentElement.getAttribute("data-thema")||"licht"),"donker",`${vp.naam}: sessiegebonden thema blijft niet behouden na reload van /weer/`);

      const terug=await page.goto(weatherUrl,{waitUntil:"domcontentloaded",timeout:30000});
      assert(terug&&terug.ok(),`${vp.naam}: terugkeer naar weatherpagina HTTP ${terug&&terug.status()}`);
      await page.waitForSelector("#app",{state:"visible",timeout:10000});
      await page.waitForFunction(()=>document.querySelectorAll("#days .row.day:not(.kop)").length===7,null,{timeout:10000});
      assert.equal(await page.evaluate(()=>document.getElementById("thema")?.dataset.actieveThemaKeuze||""),"donker",`${vp.naam}: weatherpagina verliest sessiegebonden Donker-keuze na terugnavigatie`);

      await page.locator("#thema-auto").click();
      const autoNa=await page.evaluate(()=>{
        const lees=(store,key)=>{try{const raw=store.getItem(key);return raw==null?null:JSON.parse(raw);}catch(e){return null;}};
        const groep=document.getElementById("thema"),auto=document.getElementById("thema-auto");
        return {keuze:groep?.dataset.actieveThemaKeuze||"",actief:document.documentElement.getAttribute("data-thema")||"",autoPressed:auto?.getAttribute("aria-pressed")||"",sessie:lees(sessionStorage,"weerbriefing.thema.sessie"),legacyMirror:lees(localStorage,"weerbriefing.thema")};
      });
      assert.equal(autoNa.keuze,"auto",`${vp.naam}: Auto-knop zet de automatische standaard niet terug`);
      assert.equal(autoNa.autoPressed,"true",`${vp.naam}: Auto-knop markeert Auto niet als actief`);
      assert.equal(autoNa.sessie,"auto",`${vp.naam}: Auto-reset wordt niet in de sessie opgeslagen`);
      assert.equal(autoNa.legacyMirror,"auto",`${vp.naam}: legacy mirror volgt Auto-reset niet`);
      /* Een oude/per ongeluk geschreven localStorage-voorkeur mag de sessiestand
         niet meer overnemen; dit is precies de nachtelijke 'blind door Licht'-regressie. */
      const legacyGenegeerd=await page.evaluate(()=>{
        localStorage.setItem("weerbriefing.thema",JSON.stringify("donker"));
        themaToepassen();
        let sessie=null;try{sessie=JSON.parse(sessionStorage.getItem("weerbriefing.thema.sessie"));}catch(e){}
        return {keuze:document.getElementById("thema")?.dataset.actieveThemaKeuze||"",actief:document.documentElement.getAttribute("data-thema")||"",sessie};
      });
      assert.equal(legacyGenegeerd.keuze,"auto",`${vp.naam}: legacy localStorage overschrijft de Auto-sessiestand`);
      assert.equal(legacyGenegeerd.sessie,"auto",`${vp.naam}: legacy localStorage verandert sessionStorage`);
      assert.equal(legacyGenegeerd.actief,autoNa.actief,`${vp.naam}: legacy localStorage verandert het effectieve Auto-thema`);

      const q=page.locator("#q");
      await q.fill("Singapore");
      await page.locator('#res [role="option"]').first().waitFor({state:"visible",timeout:5000});
      const zoek=await page.evaluate(()=>{
        const res=document.getElementById("res"),r=res?.getBoundingClientRect(),q=document.getElementById("q"),opties=[...document.querySelectorAll('#res [role="option"]')];
        return {rect:r?{left:r.left,right:r.right,width:r.width}:null,aantal:opties.length,expanded:q?.getAttribute("aria-expanded")||"",active:q?.getAttribute("aria-activedescendant")||""};
      });
      assert.equal(zoek.aantal,2,`${vp.naam}: geografische zoekdeduplicatie leverde ${zoek.aantal} in plaats van 2 opties`);
      assert(binnenViewport(zoek.rect,vp.width),`${vp.naam}: zoekresultaten vallen buiten viewport`);
      assert.equal(zoek.expanded,"true",`${vp.naam}: zoekveld meldt geopende lijst niet`);
      await q.press("ArrowDown");
      const actief=await q.getAttribute("aria-activedescendant");
      assert(actief&&await page.locator("#"+actief).getAttribute("aria-selected")==="true",`${vp.naam}: ArrowDown activeert geen optie`);

      const png=path.join(evidence,`preview-${vp.width}-auto.png`);
      await page.screenshot({path:png,fullPage:true});
      assert(fs.existsSync(png)&&fs.statSync(png).size>5000,`${vp.naam}: screenshot ontbreekt of is verdacht klein`);
      const hash=crypto.createHash("sha256").update(fs.readFileSync(png)).digest("hex").slice(0,12);
      console.log(`${vp.naam}: gedeployde preview zonder overflow; topcontrols/Auto-Licht-Donker-segmenten/sessiethema/zoeklijst/pressure-retirement/neerslag/a11y correct; screenshot sha256 ${hash}.`);
      assert.deepEqual(pageErrors,[],`${vp.naam}: pageerrors ${pageErrors.join(" | ")}`);
      await context.close();
    }
    console.log(`PREVIEW RESPONSIVE VISUAL GESLAAGD: ${verwacht}; 9 echte viewports, inclusief 320/360/375/390/430px met forecasttijd-gedreven drie-uursankers, verplichte temperaturen, plateau-veilige extrema, bbox-collisionchecks, compacte Nachtzicht/disclosures/footer, desktop-uurtabel, dark mode en bewaarde full-page screenshots.`);
  }finally{
    await browser.close();
  }
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

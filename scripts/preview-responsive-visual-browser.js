"use strict";

const assert=require("assert");
const fs=require("fs");
const os=require("os");
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
const fixtureEpoch=Date.parse("2026-07-22T12:30:00Z");

function binnenViewport(rect,width){return !!rect&&rect.left>=-1&&rect.right<=width+1&&rect.width>0;}
const antwoord=(route,data)=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});

(async()=>{
  const browser=await chromium.launch({headless:true});
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-preview-visual-"));
  try{
    for(const vp of viewports){
      const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},serviceWorkers:"block",locale:"nl-NL",reducedMotion:"reduce"});
      const page=await context.newPage(),pageErrors=[];
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
      await page.route("https://api.open-meteo.com/**",route=>antwoord(route,weerFixture));
      await page.route("https://air-quality-api.open-meteo.com/**",route=>antwoord(route,luchtFixture));
      await page.route("https://geocoding-api.open-meteo.com/**",route=>antwoord(route,zoekFixture));
      await page.route("https://api.bigdatacloud.net/**",route=>antwoord(route,{city:"Amsterdam",locality:"Amsterdam",principalSubdivision:"Noord-Holland",countryCode:"NL"}));
      await page.route("**/api/plaatsnaam**",route=>antwoord(route,{naam:"Amsterdam",land:"NL",bron:"test"}));
      await page.route("**/api/neerslag**",route=>antwoord(route,{beschikbaar:false,provider:"knmi",reden:"niet beschikbaar"}));
      await page.route("**/api/waarschuwingen**",route=>antwoord(route,{bron:"test",dekking:true,land:"NL",lijst:[]}));
      await page.route("**/api/luchtkwaliteit**",route=>antwoord(route,{beschikbaar:false,provider:"luchtmeetnet",reden:"niet beschikbaar"}));

      const params=new URLSearchParams({lat:"52.3676",lon:"4.9041",plaats:"Amsterdam",land:"NL"});
      const response=await page.goto(ROOT+"/?"+params,{waitUntil:"domcontentloaded",timeout:30000});
      assert(response&&response.ok(),`${vp.naam}: homepage HTTP ${response&&response.status()}`);
      await page.waitForSelector("#app",{state:"visible",timeout:10000});
      await page.waitForFunction(()=>document.querySelectorAll("#days .row.day:not(.kop)").length===7,null,{timeout:10000});

      const basis=await page.evaluate(()=>({
        sha:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
        overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,
        pressure:[...document.querySelectorAll(".eyebrow")].find(e=>(e.textContent||"").includes("Luchtdruk"))?.textContent?.trim()||"",
        searchRect:(()=>{const r=document.getElementById("q")?.getBoundingClientRect();return r?{left:r.left,right:r.right,width:r.width}:null;})(),
        topRects:[...document.querySelectorAll(".mast button,.mast input")]
          .filter(el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=="hidden")
          .map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height,label:el.getAttribute("aria-label")||el.textContent||el.id||el.tagName};}),
        legeNeerslag:[...document.querySelectorAll("#days .row.day:not(.kop) .drain")].filter(el=>!(el.textContent||el.getAttribute("aria-label")||"").trim()).length,
        drukAria:document.getElementById("pres")?.closest(".stat")?.getAttribute("aria-label")||"",
        appText:document.getElementById("app")?.textContent||""
      }));
      assert.equal(basis.sha,verwacht,`${vp.naam}: verkeerde preview-SHA ${basis.sha}`);
      assert(basis.overflow<=1,`${vp.naam}: ${basis.overflow}px horizontale pagina-overflow`);
      assert.equal(basis.pressure,"Luchtdruk op zeeniveau",`${vp.naam}: druklabel is niet ondubbelzinnig`);
      assert(/Luchtdruk op zeeniveau/.test(basis.drukAria),`${vp.naam}: toegankelijke druksoort ontbreekt`);
      assert.equal(basis.legeNeerslag,0,`${vp.naam}: lege neerslagpositie in dagtabel`);
      assert(!/(?:^|[^\d])-?1\s+graden\b/i.test(basis.appText),`${vp.naam}: enkelvoudtemperatuur gebruikt 'graden'`);
      assert(binnenViewport(basis.searchRect,vp.width),`${vp.naam}: zoekveld valt buiten viewport`);
      for(const r of basis.topRects)assert(binnenViewport(r,vp.width),`${vp.naam}: zichtbare bovenste bediening '${String(r.label).trim()}' valt buiten viewport`);

      const thema=page.locator("#thema"),themaMenu=page.locator("#themamenu");
      await thema.click();
      await themaMenu.waitFor({state:"visible",timeout:3000});
      const themaUit=await page.evaluate(()=>{
        const menu=document.getElementById("themamenu"),r=menu?.getBoundingClientRect();
        const opties=[...document.querySelectorAll('#themamenu [role="menuitemradio"]')].filter(el=>el.getClientRects().length>0).map(el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,width:b.width,label:(el.textContent||"").trim()};});
        return {rect:r?{left:r.left,right:r.right,width:r.width}:null,opties,expanded:document.getElementById("thema")?.getAttribute("aria-expanded")||""};
      });
      assert.equal(themaUit.expanded,"true",`${vp.naam}: Weergave-menu meldt geopend niet`);
      assert(binnenViewport(themaUit.rect,vp.width),`${vp.naam}: Weergave-menu valt buiten viewport`);
      assert.equal(themaUit.opties.length,3,`${vp.naam}: Weergave-menu toont niet exact drie keuzes`);
      for(const r of themaUit.opties)assert(binnenViewport(r,vp.width),`${vp.naam}: zichtbare Weergave-keuze '${r.label}' valt buiten viewport`);
      await page.keyboard.press("Escape");
      assert.equal(await thema.getAttribute("aria-expanded"),"false",`${vp.naam}: Escape sluit Weergave-menu niet`);
      assert.equal(await themaMenu.isHidden(),true,`${vp.naam}: Weergave-menu blijft zichtbaar na Escape`);

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

      const png=path.join(tmp,`preview-${vp.width}.png`);
      await page.screenshot({path:png,fullPage:true});
      assert(fs.existsSync(png)&&fs.statSync(png).size>5000,`${vp.naam}: screenshot ontbreekt of is verdacht klein`);
      const hash=crypto.createHash("sha256").update(fs.readFileSync(png)).digest("hex").slice(0,12);
      console.log(`${vp.naam}: gedeployde preview zonder overflow; topcontrols/Weergave/zoeklijst/druk/neerslag/a11y correct; screenshot sha256 ${hash}.`);
      assert.deepEqual(pageErrors,[],`${vp.naam}: pageerrors ${pageErrors.join(" | ")}`);
      await context.close();
    }
    console.log(`PREVIEW RESPONSIVE VISUAL GESLAAGD: ${verwacht}; 8 echte viewports met gecontroleerde data en tijdelijke screenshots.`);
  }finally{
    fs.rmSync(tmp,{recursive:true,force:true});
    await browser.close();
  }
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

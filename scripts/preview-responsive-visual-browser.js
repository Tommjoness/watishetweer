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

      const basis=await page.evaluate(()=>{
        return {
          sha:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
          overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth,
          pressureRetired:!document.getElementById("pres")&&!document.getElementById("pressub")&&!document.getElementById("wiw-pressure-diagnostic")&&!/\bLuchtdruk\b/i.test(document.body.innerText||""),
          searchRect:(()=>{const r=document.getElementById("q")?.getBoundingClientRect();return r?{left:r.left,right:r.right,width:r.width}:null;})(),
          topRects:[...document.querySelectorAll(".mast button,.mast input")]
            .filter(el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=="hidden")
            .map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,height:r.height,label:el.getAttribute("aria-label")||el.textContent||el.id||el.tagName};}),
          legeNeerslag:[...document.querySelectorAll("#days .row.day:not(.kop) .drain")].filter(el=>!(el.textContent||el.getAttribute("aria-label")||"").trim()).length,
          appText:document.getElementById("app")?.textContent||""
        };
      });
      assert.equal(basis.sha,verwacht,`${vp.naam}: verkeerde preview-SHA ${basis.sha}`);
      assert(basis.overflow<=1,`${vp.naam}: ${basis.overflow}px horizontale pagina-overflow`);
      assert.equal(basis.pressureRetired,true,`${vp.naam}: luchtdrukfeature is niet volledig uit de gedeployde preview verwijderd`);
      assert.equal(basis.legeNeerslag,0,`${vp.naam}: lege neerslagpositie in dagtabel`);
      assert(!/(?:^|[^\d])-?1\s+graden\b/i.test(basis.appText),`${vp.naam}: enkelvoudtemperatuur gebruikt 'graden'`);
      assert(binnenViewport(basis.searchRect,vp.width),`${vp.naam}: zoekveld valt buiten viewport`);
      for(const r of basis.topRects)assert(binnenViewport(r,vp.width),`${vp.naam}: zichtbare bovenste bediening '${String(r.label).trim()}' valt buiten viewport`);

      const themaVoor=await page.evaluate(()=>{
        const groep=document.getElementById("thema"),auto=document.getElementById("thema-auto"),schakelaar=document.getElementById("thema-switch"),r=groep?.getBoundingClientRect(),track=schakelaar?.querySelector(".wiw-theme-track")?.getBoundingClientRect(),thumb=schakelaar?.querySelector(".wiw-theme-thumb")?.getBoundingClientRect();
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
          icons:!!schakelaar?.querySelector(".wiw-theme-sun")&&!!schakelaar?.querySelector(".wiw-theme-moon"),
          toggleWidth:schakelaar?.getBoundingClientRect().width||0,
          trackWidth:track?.width||0,
          thumbWidth:thumb?.width||0,
          rect:r?{left:r.left,right:r.right,width:r.width}:null
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
      assert(themaVoor.trackWidth>=24&&themaVoor.trackWidth<=34,`${vp.naam}: toggle-track heeft onverwachte breedte (${themaVoor.trackWidth}px)`);
      assert(themaVoor.thumbWidth>=10&&themaVoor.thumbWidth<=16,`${vp.naam}: toggle-thumb heeft onverwachte breedte (${themaVoor.thumbWidth}px)`);
      assert(binnenViewport(themaVoor.rect,vp.width),`${vp.naam}: Weergavegroep valt buiten viewport`);

      await page.evaluate(()=>{ls.set("weerbriefing.thema","licht");themaToepassen();});
      await page.locator("#thema-switch").click();
      const themaNa=await page.evaluate(()=>{
        const lees=key=>{try{const raw=localStorage.getItem(key);return raw==null?null:JSON.parse(raw);}catch(e){return null;}};
        const groep=document.getElementById("thema"),schakelaar=document.getElementById("thema-switch");
        return {
          keuze:groep?.dataset.actieveThemaKeuze||"",
          actief:document.documentElement.getAttribute("data-thema")||"",
          autoPressed:document.getElementById("thema-auto")?.getAttribute("aria-pressed")||"",
          checked:schakelaar?.getAttribute("aria-checked")||"",
          voorkeur:lees("weerbriefing.thema"),
          actiefBewaar:lees("weerbriefing.actiefThema"),
          label:schakelaar?.getAttribute("aria-label")||"",
          title:schakelaar?.getAttribute("title")||""
        };
      });
      assert.equal(themaNa.keuze,"donker",`${vp.naam}: expliciete Donker-keuze wordt niet actief`);
      assert.equal(themaNa.actief,"donker",`${vp.naam}: gerenderd thema volgt Donker-keuze niet`);
      assert.equal(themaNa.autoPressed,"false",`${vp.naam}: Auto blijft actief na handmatige Donker-keuze`);
      assert.equal(themaNa.checked,"true",`${vp.naam}: Donker-stand wordt niet zichtbaar aangezet`);
      assert.equal(themaNa.voorkeur,"donker",`${vp.naam}: expliciete themakeuze wordt niet persistent opgeslagen`);
      assert.equal(themaNa.actiefBewaar,"donker",`${vp.naam}: actieve themastaat wordt niet persistent opgeslagen`);
      assert(themaNa.label&&themaNa.title,`${vp.naam}: Licht/donker-toggle mist toegankelijke toestandstekst`);

      await page.locator("#thema-auto").click();
      const autoNa=await page.evaluate(()=>{
        const groep=document.getElementById("thema"),auto=document.getElementById("thema-auto");
        let voorkeur=null;try{voorkeur=JSON.parse(localStorage.getItem("weerbriefing.thema"));}catch(e){}
        return {keuze:groep?.dataset.actieveThemaKeuze||"",autoPressed:auto?.getAttribute("aria-pressed")||"",voorkeur};
      });
      assert.deepEqual(autoNa,{keuze:"auto",autoPressed:"true",voorkeur:"auto"},`${vp.naam}: Auto-knop zet de automatische standaard niet terug`);
      await page.evaluate(()=>{ls.set("weerbriefing.thema","donker");themaToepassen();});

      const hub=await context.newPage(),hubErrors=[];
      hub.on("pageerror",e=>hubErrors.push(String(e)));
      const hubResponse=await hub.goto(ROOT+"/weer/",{waitUntil:"domcontentloaded",timeout:30000});
      assert(hubResponse&&hubResponse.ok(),`${vp.naam}: /weer/ HTTP ${hubResponse&&hubResponse.status()}`);
      await hub.waitForSelector("#thema",{state:"visible",timeout:5000});
      const hubState=await hub.evaluate(()=>{
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
      assert.equal(hubState.actief,themaNa.actief,`${vp.naam}: thema valt terug bij navigatie naar /weer/`);
      assert.equal(hubState.checked,themaNa.actief==="donker"?"true":"false",`${vp.naam}: /weer/-switch weerspiegelt opgeslagen thema niet`);
      assert.equal(hubState.role,"switch",`${vp.naam}: /weer/ gebruikt geen semantische switch`);
      assert.equal(hubState.menu,false,`${vp.naam}: /weer/ bevat ten onrechte het weather-themamenu`);
      assert(hubState.zonNaarTrack>=7.5&&hubState.zonNaarTrack<=10.5,`${vp.naam}: /weer/ zon-switchafstand ${hubState.zonNaarTrack}px valt buiten 8–10px richtlijn`);
      assert(hubState.trackNaarMaan>=9.5&&hubState.trackNaarMaan<=12.5,`${vp.naam}: /weer/ switch-maanafstand ${hubState.trackNaarMaan}px valt buiten 10–12px richtlijn`);
      assert(binnenViewport(hubState.rect,vp.width),`${vp.naam}: /weer/-switch valt buiten viewport`);
      assert.equal(hubState.scriptVoorCss,true,`${vp.naam}: /weer/ themascript staat niet vóór de eerste inline of externe CSS`);
      await hub.reload({waitUntil:"domcontentloaded",timeout:30000});
      assert.equal(await hub.evaluate(()=>document.documentElement.getAttribute("data-thema")||"licht"),themaNa.actief,`${vp.naam}: thema blijft niet behouden na reload van /weer/`);
      assert.deepEqual(hubErrors,[],`${vp.naam}: /weer/ pageerrors ${hubErrors.join(" | ")}`);
      await hub.close();

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
      console.log(`${vp.naam}: gedeployde preview zonder overflow; topcontrols/Auto-Licht-Donker-toggle/themapersistentie/zoeklijst/pressure-retirement/neerslag/a11y correct; screenshot sha256 ${hash}.`);
      assert.deepEqual(pageErrors,[],`${vp.naam}: pageerrors ${pageErrors.join(" | ")}`);
      await context.close();
    }
    console.log(`PREVIEW RESPONSIVE VISUAL GESLAAGD: ${verwacht}; 8 echte viewports met gecontroleerde data, thema-navigatiepersistentie en tijdelijke screenshots.`);
  }finally{
    fs.rmSync(tmp,{recursive:true,force:true});
    await browser.close();
  }
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

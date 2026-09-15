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
      const weatherUrl=ROOT+"/?"+params;
      const response=await page.goto(weatherUrl,{waitUntil:"domcontentloaded",timeout:30000});
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
        const groep=document.getElementById("thema"),auto=document.getElementById("thema-auto"),schakelaar=document.getElementById("thema-switch"),zon=schakelaar?.querySelector(".wiw-theme-sun"),maan=schakelaar?.querySelector(".wiw-theme-moon"),r=groep?.getBoundingClientRect(),track=schakelaar?.querySelector(".wiw-theme-track")?.getBoundingClientRect(),thumb=schakelaar?.querySelector(".wiw-theme-thumb")?.getBoundingClientRect();
        const ar=auto?.getBoundingClientRect(),zr=zon?.getBoundingClientRect(),mr=maan?.getBoundingClientRect();
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
      assert(themaVoor.trackWidth>=24&&themaVoor.trackWidth<=34,`${vp.naam}: toggle-track heeft onverwachte breedte (${themaVoor.trackWidth}px)`);
      assert(themaVoor.thumbWidth>=10&&themaVoor.thumbWidth<=16,`${vp.naam}: toggle-thumb heeft onverwachte breedte (${themaVoor.thumbWidth}px)`);
      assert(binnenViewport(themaVoor.rect,vp.width),`${vp.naam}: Weergavegroep valt buiten viewport`);
      if(vp.width<=430){
        const s=themaVoor.segmenten;
        assert(s,`${vp.naam}: mobiele driewegsegmenten ontbreken`);
        assert(themaVoor.rect.height>=45.5,`${vp.naam}: themarij is te laag (${themaVoor.rect.height}px)`);
        for(const [naam,seg] of [["licht",s.licht],["auto",s.auto],["donker",s.donker]])assert(seg.height>=43.5,`${vp.naam}: ${naam}-touchdoel is te laag (${seg.height}px)`);
        const breedtes=[s.auto.width,s.licht.width,s.donker.width];
        assert(Math.max(...breedtes)-Math.min(...breedtes)<=2,`${vp.naam}: Auto/Licht/Donker zijn niet gelijk verdeeld (${breedtes.map(x=>x.toFixed(1)).join("/")}px)`);
        assert(s.licht.left<s.auto.left&&s.auto.left<s.donker.left,`${vp.naam}: mobiele volgorde is niet Licht | Auto | Donker`);
        assert(Math.max(Math.abs(s.auto.top-s.licht.top),Math.abs(s.auto.top-s.donker.top))<=1,`${vp.naam}: thema-opties delen niet één rij`);
        assert(/Licht/i.test(s.licht.label),`${vp.naam}: zichtbaar Licht-label ontbreekt`);
        assert(/Donker/i.test(s.donker.label),`${vp.naam}: zichtbaar Donker-label ontbreekt`);
        assert(parseFloat(s.licht.icoonLabelGap)>=6&&parseFloat(s.donker.icoonLabelGap)>=6,`${vp.naam}: icoon-labelafstand is te klein (${s.licht.icoonLabelGap}/${s.donker.icoonLabelGap})`);
        for(const eigenschap of ["fontFamily","fontSize","fontWeight","lineHeight","letterSpacing","alignItems"]){
          const waarden=[s.stijlen.auto[eigenschap],s.stijlen.licht[eigenschap],s.stijlen.donker[eigenschap]];
          assert.equal(new Set(waarden).size,1,`${vp.naam}: typografische basis '${eigenschap}' verschilt (${waarden.join(" / ")})`);
        }
      }

      await page.locator('[data-thema-handmatig="licht"]').click();
      const lichtNa=await page.evaluate(()=>{
        const groep=document.getElementById("thema"),auto=document.getElementById("thema-auto"),zon=document.querySelector('[data-thema-handmatig="licht"]'),maan=document.querySelector('[data-thema-handmatig="donker"]');
        return {keuze:groep?.dataset.actieveThemaKeuze||"",actief:document.documentElement.getAttribute("data-thema")||"",gewichten:[auto,zon,maan].map(el=>getComputedStyle(el).fontWeight)};
      });
      assert.equal(lichtNa.keuze,"licht",`${vp.naam}: expliciete Licht-keuze wordt niet actief`);
      assert.equal(lichtNa.actief,"licht",`${vp.naam}: gerenderd thema volgt Licht-keuze niet`);
      if(vp.width<=430)assert.equal(new Set(lichtNa.gewichten).size,1,`${vp.naam}: actieve Licht-keuze verandert de typografische zwaarte`);

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
      if(vp.width<=430)assert.equal(new Set(themaNa.gewichten).size,1,`${vp.naam}: actieve Donker-keuze verandert de typografische zwaarte`);

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

      const png=path.join(tmp,`preview-${vp.width}.png`);
      await page.screenshot({path:png,fullPage:true});
      assert(fs.existsSync(png)&&fs.statSync(png).size>5000,`${vp.naam}: screenshot ontbreekt of is verdacht klein`);
      const hash=crypto.createHash("sha256").update(fs.readFileSync(png)).digest("hex").slice(0,12);
      console.log(`${vp.naam}: gedeployde preview zonder overflow; topcontrols/Auto-Licht-Donker-segmenten/sessiethema/zoeklijst/pressure-retirement/neerslag/a11y correct; screenshot sha256 ${hash}.`);
      assert.deepEqual(pageErrors,[],`${vp.naam}: pageerrors ${pageErrors.join(" | ")}`);
      await context.close();
    }
    console.log(`PREVIEW RESPONSIVE VISUAL GESLAAGD: ${verwacht}; 8 echte viewports met gecontroleerde data, sessiegebonden thema-navigatie en tijdelijke screenshots.`);
  }finally{
    fs.rmSync(tmp,{recursive:true,force:true});
    await browser.close();
  }
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

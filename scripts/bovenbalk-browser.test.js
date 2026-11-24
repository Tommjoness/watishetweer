"use strict";

/* Bovenbalk (18 november; K2 24 november) op het finale artifact, met de echte runtime.
   Sinds K2 (eigenaar 24 november) staan in de smalle balk boven de kop, buiten
   #app, het menu en daarnaast het logo met de naam "watishetweer.nl"; de
   weergavekeuze (Licht, Auto, Donker) staat in het menu onder de groepen en de
   snelkoppeling "☾ Nachtzicht" is weg (Nachtzicht staat in het menu).
   Gecontroleerd per breedte, in licht en donker en in het Engels:
   - plaats: balk vóór de kop, menu vooraan, logo ernaast op dezelfde rij,
     #thema in het menu, geen Weergave-regel onder de footer; vanaf 901px op het
     papier boven het vel zonder dat de kop verschuift;
   - maat: logo minstens 44px (aanraken, tot 900px) of 36px (muis) hoog,
     weergaverij in het open menu volgens preview-responsive-visual-browser.js,
     geen afgeknipte tekst, geen overflow;
   - eerste scherm: temperatuur hoogstens op 380px tot en met 900px (eigenaar
     18 november; vanaf 360px, de breedtes van die regel) en grafiekkop (desktop) binnen de grens van
     first-screen-browser.test.js;
   - gedrag: in het open menu zet de schakelaar echt donker en licht, Auto zet
     terug; toetsenbordvolgorde begint bovenin (menu, logo, dan de zoekbalk);
   - leesbaarheid: contrast van de naam naast het logo minstens 4,5:1.

   Draait na: npm test of npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fixture(){
  const d=bouw({som:2.4,pp:(u,dag)=>dag===0&&u>=19&&u<=22?60:8,pr:(u,dag)=>dag===0&&u>=19&&u<=22?0.8:0});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});


function lum(rgb){const c=rgb.match(/\d+(\.\d+)?/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*c[0]+.7152*c[1]+.0722*c[2];}
function contrast(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  const regels=[];
  try{
    const gevallen=[
      [320,640,"light","nl"],[360,740,"light","nl"],[390,844,"light","nl"],[390,844,"dark","nl"],[430,932,"light","en"],[481,900,"light","nl"],
      [768,1024,"light","nl"],[1100,800,"light","nl"],[1366,768,"dark","nl"],[1440,900,"light","nl"],[1440,900,"light","en"]
    ];
    for(const [w,h,schema,taal] of gevallen){
      const context=await browser.newContext({viewport:{width:w,height:h},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",colorScheme:schema,isMobile:w<700,hasTouch:w<700});
      const page=await context.newPage(),fouten=[];
      page.on("pageerror",e=>fouten.push(String(e)));
      await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T15:39:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
      await page.route("**/*",async r=>{
        const u=new URL(r.request().url());
        if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture()});
        if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T17:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
        if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
        if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
        if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
        if(u.origin!==root)return r.fulfill({status:204,body:""});
        return r.continue();
      });
      const label=`${w}px ${schema}${taal==="en"?" EN":""}`;
      try{
        await page.goto(root+"/weer/utrecht/"+(taal==="en"?"?taal=en":""),{waitUntil:"domcontentloaded"});
        await page.waitForSelector("#app",{state:"visible",timeout:10000});
        await page.waitForFunction(()=>!document.getElementById("here")?.disabled,null,{timeout:10000});
        await sleep(800);
        const m=await page.evaluate(()=>{
          const r=e=>{if(typeof e==="string")e=document.querySelector(e);if(!e)return null;const b=e.getBoundingClientRect();return {top:b.top+scrollY,bottom:b.bottom+scrollY,left:b.left,right:b.right,width:b.width,height:b.height};};
          const balk=document.querySelector(".wiw-bovenbalk"),thema=document.getElementById("thema"),link=balk&&balk.querySelector(":scope > .wiw-weer-merk"),mast=document.querySelector(".mast"),menu=document.querySelector("#wiw-menu > summary");
          const knoppen=thema?[...thema.querySelectorAll("button")].map(b=>({naam:b.getAttribute("aria-label")||"",...r(b)})):[];
          const geknipt=[thema,...(thema?thema.querySelectorAll("*"):[]),link].filter(Boolean).filter(e=>!e.closest(".sr-only")&&e.checkVisibility()&&getComputedStyle(e).overflow!=="visible"&&e.scrollWidth>e.clientWidth+1).map(e=>e.id||e.className);
          const sheet=document.querySelector(".sheet");
          /* Achtergrond achter het logo: vanaf 901px het papier (body), anders het vel. */
          let achter=innerWidth>=901?getComputedStyle(document.body).backgroundColor:getComputedStyle(sheet).backgroundColor;if(/rgba\(0, 0, 0, 0\)|transparent/.test(achter))achter=getComputedStyle(document.body).backgroundColor;
          const sh=getComputedStyle(sheet),shr=sheet.getBoundingClientRect();
          return {
            sheetTop:shr.top+scrollY,sheetBinnen:parseFloat(sh.paddingTop)+parseFloat(sh.borderTopWidth),sheetLinks:shr.left+parseFloat(sh.borderLeftWidth)+parseFloat(sh.paddingLeft),sheetRechts:shr.right-parseFloat(sh.borderRightWidth)-parseFloat(sh.paddingRight),
            balk:r(balk),thema:r(thema),link:r(link),mast:r(mast),menu:r(menu),balkGat:balk?parseFloat(getComputedStyle(balk).columnGap)||0:0,knoppen,geknipt,
            linkTekst:(link?.textContent||"").replace(/\s+/g," ").trim(),label:(balk?.querySelector(".wiw-weergave-label")?.textContent||"").trim(),snelNacht:document.querySelectorAll(".wiw-snel-nachtzicht").length,
            themaInMenu:!!(thema&&document.getElementById("wiw-menu")?.contains(thema)),/* Inhoud van een dichte <details> heeft in Chromium nog vakken (content-visibility), dus checkVisibility. */themaZicht:!!(thema&&thema.checkVisibility()),
            groepNaam:thema?.getAttribute("aria-label")||"",
            themaInBalk:!!(thema&&balk&&balk.contains(thema)),balkVoorKop:!!(balk&&mast&&balk.compareDocumentPosition(mast)&Node.DOCUMENT_POSITION_FOLLOWING),
            balkBuitenApp:!!(balk&&!balk.closest("#app")),voet:!!document.querySelector(".wiw-weergave-voet"),
            hero:r(".hero"),chartkop:r(".dashrow-chart .chartkop")||r(".chartkop"),
            linkKleur:link?getComputedStyle(link.querySelector("span")||link).color:"",achter,linkZichtbaar:!!(link&&link.getClientRects().length),
            nachtNav:!![...document.querySelectorAll('.mobile-section-nav a[href="#nights"]')].find(a=>a.getClientRects().length),
            overflow:document.documentElement.scrollWidth-innerWidth
          };
        });
        assert(m.balk&&m.themaInBalk&&m.themaInMenu&&m.balkVoorKop&&m.balkBuitenApp,`${label}: weergavekeuze staat niet in het menu van de bovenbalk boven de kop buiten #app ${JSON.stringify({b:!!m.balk,i:m.themaInBalk,mn:m.themaInMenu,k:m.balkVoorKop,a:m.balkBuitenApp})}`);
        assert(!m.voet,`${label}: er staat nog een Weergave-regel onder de footer`);
        assert.equal(m.snelNacht,0,`${label}: snelkoppeling Nachtzicht staat nog in de bovenbalk`);
        assert(!m.themaZicht,`${label}: weergavekeuze zichtbaar terwijl het menu dicht is`);
        assert(m.balk.top<=90,`${label}: bovenbalk is niet de eerste rij (begint op ${Math.round(m.balk.top)}px)`);
        /* Logo als doel: 44px (aanraken, tot 900px) of 36px (muis); naast de menuknop op één rij. */
        const minDoel=w<=900?44:36,minThema=w<=430?45.5:w<=900?43.5:35.5;
        const telefoon=w<=480;
        assert(m.link&&m.linkZichtbaar&&m.link.height>=minDoel-0.5&&m.link.width>=44,`${label}: logo is geen ${minDoel}px-doel (${m.link&&Math.round(m.link.width)}x${m.link&&Math.round(m.link.height)})`);
        /* Tot 900px begint de balk met de menuknop; vanaf 901px heeft de balk de binnenmarge van het vel (zie de uitlijning hieronder). */
        assert(m.menu&&(w>=901||Math.abs(m.menu.left-m.balk.left)<=1)&&m.link.left>=m.menu.right&&Math.abs((m.link.top+m.link.bottom)/2-(m.menu.top+m.menu.bottom)/2)<=3,`${label}: menuknop niet vooraan of logo niet ernaast op dezelfde rij`);
        assert.equal(m.linkTekst,"watishetweer.nl",`${label}: naam naast het logo '${m.linkTekst}'`);
        if(telefoon)assert(m.nachtNav,`${label}: Nachtzicht is op telefoon niet bereikbaar via de snelnavigatie`);
        if(w>=901){
          /* Op het papier boven het vel, op de lijnen van de inhoud, zonder de kop te verschuiven. */
          assert(m.balk.bottom<=m.sheetTop+1&&m.balk.top>=-1,`${label}: balk staat niet in de marge boven het vel (${Math.round(m.balk.top)}–${Math.round(m.balk.bottom)}, vel op ${Math.round(m.sheetTop)})`);
          /* Zonder balk begon de kop op 73px (901–1099px) of 81px (vanaf 1100px); dat blijft zo. */
          const kopZonderBalk=w>=1100?81:73;
          assert(Math.abs(m.mast.top-kopZonderBalk)<=1,`${label}: de kop verschuift door de balk (${Math.round(m.mast.top)} tegen ${kopZonderBalk}px)`);
          assert(Math.abs(m.menu.left-m.sheetLinks)<=1,`${label}: balk lijnt niet uit met de inhoud (${Math.round(m.menu.left)} tegen ${Math.round(m.sheetLinks)})`);
        }
        assert.deepEqual(m.geknipt,[],`${label}: tekst in de bovenbalk wordt afgeknipt: ${m.geknipt.join(", ")}`);
        assert(m.overflow<=1,`${label}: horizontale overflow ${m.overflow}px`);
        /* Eigenaar 18 november: de balk kost op telefoon en tablet één rij; de temperatuur begint dan hoogstens op 380px. */
        if(w<=900)assert(m.hero&&m.hero.top<=(w>=360?380:560),`${label}: temperatuur begint pas op ${m.hero&&Math.round(m.hero.top)}px`);
        else if(w>=1100)assert(m.chartkop&&m.chartkop.top<=h-100,`${label}: grafiek begint pas op ${m.chartkop&&Math.round(m.chartkop.top)}px (vouw ${h}px)`);
        if(taal==="en"){
          assert(/^Choose (appearance|display)/.test(m.groepNaam),`${label}: groepsnaam niet vertaald: '${m.groepNaam}'`);
          assert(/appearance/i.test(m.label),`${label}: label Weergave niet vertaald: '${m.label}'`);
        }else{
          assert(m.groepNaam.startsWith("Weergave kiezen"),`${label}: groepsnaam van de weergavekeuze gewijzigd: '${m.groepNaam}'`);
          assert.equal(m.label,"Weergave",`${label}: label Weergave in het menu gewijzigd: '${m.label}'`);
        }
        const c=contrast(m.linkKleur,m.achter);
        assert(c>=4.5,`${label}: contrast van de naam naast het logo ${c.toFixed(2)}:1 (${m.linkKleur} op ${m.achter})`);
        /* In het open menu: weergaverij volgens het contract, knoppen als doel, niets afgeknipt. */
        await page.click("#wiw-menu > summary");await sleep(150);
        const o=await page.evaluate(()=>{const r=e=>{const b=e.getBoundingClientRect();return {width:b.width,height:b.height};};const t=document.getElementById("thema");
          return {thema:t&&t.getClientRects().length?r(t):null,knoppen:t?[...t.querySelectorAll("button")].map(b=>({naam:b.getAttribute("aria-label")||"",...r(b)})):[],
            geknipt:[t,...(t?t.querySelectorAll("*"):[])].filter(Boolean).filter(e=>!e.closest(".sr-only")&&e.checkVisibility()&&getComputedStyle(e).overflow!=="visible"&&e.scrollWidth>e.clientWidth+1).map(e=>e.id||e.className),
            label:t?(t.closest(".wiw-weergave-boven")?.querySelector(".wiw-weergave-label")?.textContent||"").trim():"",overflow:document.documentElement.scrollWidth-innerWidth};});
        assert(o.thema&&o.thema.height>=minThema,`${label}: weergaverij in het menu is ${o.thema&&o.thema.height}px hoog (minstens ${minThema}px)`);
        assert(o.knoppen.length>=2,`${label}: knoppen van de weergavekeuze ontbreken`);
        for(const k of o.knoppen)assert(k.height>=minDoel&&k.width>=44,`${label}: weergaveknop '${k.naam}' is geen ${minDoel}px-doel (${Math.round(k.width)}x${Math.round(k.height)})`);
        assert.deepEqual(o.geknipt,[],`${label}: tekst in de weergavekeuze wordt afgeknipt: ${o.geknipt.join(", ")}`);
        assert(o.overflow<=1,`${label}: horizontale overflow met open menu ${o.overflow}px`);
        /* Gedrag: schakelaar zet donker of licht, Auto zet terug op het systeem. */
        /* Themaknoppen tonen alleen tekst: geen zon- of maansymbool, wel het label (eigenaar 22 nov). */
        const knop=await page.evaluate(()=>{const z=document.querySelector("#thema .wiw-theme-sun"),m=document.querySelector("#thema .wiw-theme-moon"),tk=e=>e?e.textContent.trim():null;return {tekst:document.getElementById("thema").textContent,zon:tk(z),maan:tk(m)};});
        assert(!/[\u2600\u263e]/.test(knop.tekst),`${label}: themaknoppen tonen nog een zon- of maansymbool: '${knop.tekst.trim()}'`);
        assert.deepEqual([knop.zon,knop.maan],taal==="en"?["Light","Dark"]:["Licht","Donker"],`${label}: labels van de themaknoppen ontbreken`);
        const begin=await page.evaluate(()=>document.documentElement.getAttribute("data-thema"));
        const thema=()=>page.evaluate(()=>document.documentElement.getAttribute("data-thema"));
        await page.click("#thema .wiw-theme-moon");
        assert.equal(await thema(),"donker",`${label}: Donker in het menu zet het thema niet op donker`);
        await page.click("#thema .wiw-theme-sun");
        assert.equal(await thema(),"licht",`${label}: Licht in het menu zet het thema niet op licht`);
        await page.click("#thema-auto");
        const na2=await page.evaluate(()=>document.documentElement.getAttribute("data-thema"));
        assert.equal(na2,begin,`${label}: Auto zet het thema niet terug (${begin} → ${na2})`);
        /* Nachtzicht vanuit het menu brengt de kop in beeld (menu-browser.test.js test alle menulinks). */
        if(!await page.evaluate(()=>document.querySelector('.wiw-menu-groep:nth-of-type(2)').open))await page.click(".wiw-menu-paneel > .wiw-menu-groep:nth-of-type(2) > summary");
        await page.click('.wiw-menu-paneel a[href="#nachtzicht"]');await sleep(400);
        const doel=await page.evaluate(()=>{const e=document.getElementById("nachtzicht");const b=e.getBoundingClientRect();return {top:b.top,zicht:b.top>=0&&b.bottom<=innerHeight,hash:location.hash};});
        assert(doel.zicht&&doel.top<=140&&doel.hash==="#nachtzicht",`${label}: Nachtzicht vanuit het menu brengt de kop niet in beeld (${JSON.stringify(doel)})`);
        /* Toetsenbord: na de skiplink komen eerst menu en logo en dan de zoekbalk. */
        await page.evaluate(()=>{scrollTo(0,0);document.activeElement&&document.activeElement.blur();});
        await page.goto(root+"/weer/utrecht/"+(taal==="en"?"?taal=en":""),{waitUntil:"domcontentloaded"});
        await page.waitForFunction(()=>!document.getElementById("here")?.disabled,null,{timeout:10000});
        const volgorde=[];for(let i=0;i<5;i++){await page.keyboard.press("Tab");volgorde.push(await page.evaluate(()=>{const a=document.activeElement;return a.id||a.className||a.tagName;}));}
        const iM=volgorde.indexOf("wiw-menu-knop"),iL=volgorde.findIndex(x=>/wiw-weer-merk/.test(x)),iT=volgorde.findIndex(x=>x==="thema-auto"||x==="thema-switch"),iQ=volgorde.indexOf("q");
        assert(iM>=0&&iL===iM+1&&iT<0&&(iQ<0||iQ>iL),`${label}: toetsenbordvolgorde begint niet met menu en logo (of de dichte weergavekeuze is bereikbaar): ${volgorde.join(" → ")}`);
        assert.deepEqual(fouten,[],`${label}: runtimefouten ${fouten.join(" | ")}`);
        regels.push(`${label}: balk op ${Math.round(m.balk.top)}px, hoogte ${Math.round(m.balk.height)}px, ${w<=900?"temperatuur op "+Math.round(m.hero.top)+"px":"grafiekkop op "+Math.round(m.chartkop.top)+"px"}, menu + logo, contrast naam ${c.toFixed(1)}:1`);
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  regels.forEach(r=>console.log("BOVENBALK "+r));
  console.log("Bovenbalk OK: menu en logo bovenaan op 320–1440px, weergavekeuze in het menu, geen Nachtzicht-snelkoppeling; licht en donker, NL en EN; tapdoelen, eerste scherm, gedrag, anker en toetsenbord.");
})().catch(e=>{console.error(e);process.exit(1);});

"use strict";

/* Bovenbalk (18 november) op het finale artifact, met de echte runtime.
   De weergavekeuze (Licht, Auto, Donker) en een snelkoppeling naar Nachtzicht
   staan in één smalle balk boven de kop, buiten #app, op telefoon en desktop.
   Gecontroleerd per breedte, in licht en donker en in het Engels:
   - plaats: balk vóór de kop, #thema erin, geen Weergave-regel onder de footer;
     sinds UI PR #2 (19 november) begint de balk met de menuknop (menu-browser.test.js
     test het menu zelf); op telefoon vullen menuknop en keuze samen de balk;
     vanaf 901px op het papier boven het vel zonder dat de kop verschuift;
   - maat: link minstens 44px (aanraken, tot 900px) of 36px (muis), weergaverij
     volgens preview-responsive-visual-browser.js, geen afgeknipte tekst, geen overflow, link en keuze op één
     rij op iedere breedte;
   - eerste scherm: temperatuur hoogstens op 380px tot en met 900px (eigenaar
     18 november; vanaf 360px, de breedtes van die regel) en grafiekkop (desktop) binnen de grens van
     first-screen-browser.test.js;
   - gedrag: de schakelaar zet echt donker en licht, Auto zet terug, de link
     brengt de kop van Nachtzicht in beeld, toetsenbordvolgorde begint bovenin;
   - leesbaarheid: contrast van de link minstens 4,5:1.

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
          const balk=document.querySelector(".wiw-bovenbalk"),thema=document.getElementById("thema"),link=document.querySelector(".wiw-snel-nachtzicht"),mast=document.querySelector(".mast"),menu=document.querySelector("#wiw-menu > summary");
          const knoppen=thema?[...thema.querySelectorAll("button")].map(b=>({naam:b.getAttribute("aria-label")||"",...r(b)})):[];
          const geknipt=[thema,...(thema?thema.querySelectorAll("*"):[]),link].filter(Boolean).filter(e=>!e.closest(".sr-only")&&e.getClientRects().length&&getComputedStyle(e).overflow!=="visible"&&e.scrollWidth>e.clientWidth+1).map(e=>e.id||e.className);
          const sheet=document.querySelector(".sheet");
          /* Achtergrond achter de link: vanaf 901px het papier (body), anders het vel. */
          let achter=innerWidth>=901?getComputedStyle(document.body).backgroundColor:getComputedStyle(sheet).backgroundColor;if(/rgba\(0, 0, 0, 0\)|transparent/.test(achter))achter=getComputedStyle(document.body).backgroundColor;
          const sh=getComputedStyle(sheet),shr=sheet.getBoundingClientRect();
          return {
            sheetTop:shr.top+scrollY,sheetBinnen:parseFloat(sh.paddingTop)+parseFloat(sh.borderTopWidth),sheetLinks:shr.left+parseFloat(sh.borderLeftWidth)+parseFloat(sh.paddingLeft),sheetRechts:shr.right-parseFloat(sh.borderRightWidth)-parseFloat(sh.paddingRight),
            balk:r(balk),thema:r(thema),link:r(link),mast:r(mast),menu:r(menu),balkGat:balk?parseFloat(getComputedStyle(balk).columnGap)||0:0,knoppen,geknipt,
            linkTekst:(link?.textContent||"").replace(/\s+/g," ").trim(),label:(balk?.querySelector(".wiw-weergave-label")?.textContent||"").trim(),
            groepNaam:thema?.getAttribute("aria-label")||"",
            themaInBalk:!!(thema&&balk&&balk.contains(thema)),balkVoorKop:!!(balk&&mast&&balk.compareDocumentPosition(mast)&Node.DOCUMENT_POSITION_FOLLOWING),
            balkBuitenApp:!!(balk&&!balk.closest("#app")),voet:!!document.querySelector(".wiw-weergave-voet"),
            hero:r(".hero"),chartkop:r(".dashrow-chart .chartkop")||r(".chartkop"),
            linkKleur:link?getComputedStyle(link).color:"",achter,linkZichtbaar:!!(link&&link.getClientRects().length),
            nachtNav:!![...document.querySelectorAll('.mobile-section-nav a[href="#nights"]')].find(a=>a.getClientRects().length),
            overflow:document.documentElement.scrollWidth-innerWidth
          };
        });
        assert(m.balk&&m.themaInBalk&&m.balkVoorKop&&m.balkBuitenApp,`${label}: weergavekeuze staat niet in de bovenbalk boven de kop buiten #app ${JSON.stringify({b:!!m.balk,i:m.themaInBalk,k:m.balkVoorKop,a:m.balkBuitenApp})}`);
        assert(!m.voet,`${label}: er staat nog een Weergave-regel onder de footer`);
        assert(m.balk.top<=90,`${label}: bovenbalk is niet de eerste rij (begint op ${Math.round(m.balk.top)}px)`);
        /* Hoogtes volgens het contract van preview-responsive-visual-browser.js: weergaverij ≥45,5px tot 430px,
           ≥43,5px tot 900px en ≥35,5px op desktop; de link minstens even hoog als een aanraakdoel (44px) of 36px met muis. */
        const minDoel=w<=900?44:36,minThema=w<=430?45.5:w<=900?43.5:35.5;
        assert(m.thema.height>=minThema,`${label}: weergaverij is ${m.thema.height}px hoog (minstens ${minThema}px)`);
        /* Telefoon (tot en met 480px, eigenaar 18 november): geen Nachtzicht-link (die zit in de snelnavigatie).
           Sinds UI PR #2 (eigenaar 19 november) staat de menuknop vooraan en vult de keuze de rest van de rij;
           op 320px (tot 345px) staat het menu op een eigen rij en vult de keuze de volle breedte.
           Daarboven menu, link en keuze naast elkaar. */
        const telefoon=w<=480;
        if(telefoon){
          assert(!m.linkZichtbaar,`${label}: Nachtzicht-link staat op telefoon toch in de bovenbalk`);
          assert(m.menu&&Math.abs(m.menu.left-m.balk.left)<=1,`${label}: menuknop staat niet vooraan in de bovenbalk`);
          if(w<=345)assert(Math.abs(m.thema.width-m.balk.width)<=1&&m.thema.top>=m.menu.bottom-1,`${label}: weergavekeuze vult op een eigen rij de breedte niet (${Math.round(m.thema.width)} van ${Math.round(m.balk.width)}px)`);
          else assert(Math.abs(m.thema.top-m.menu.top)<=2&&Math.abs(m.thema.right-m.balk.right)<=1&&Math.abs(m.thema.width-(m.balk.width-m.menu.width-m.balkGat))<=1,`${label}: menuknop en weergavekeuze vullen samen de breedte niet (keuze ${Math.round(m.thema.width)}, knop ${Math.round(m.menu.width)}, balk ${Math.round(m.balk.width)}px)`);
          assert(m.nachtNav,`${label}: Nachtzicht is op telefoon niet bereikbaar via de snelnavigatie`);
        }else assert(m.link&&m.linkZichtbaar&&m.link.height>=minDoel&&m.link.width>=44,`${label}: Nachtzicht-link is geen ${minDoel}px-doel (${m.link&&Math.round(m.link.width)}x${m.link&&Math.round(m.link.height)})`);
        assert(m.knoppen.length>=2,`${label}: knoppen van de weergavekeuze ontbreken`);
        for(const k of m.knoppen)assert(k.height>=minDoel&&k.width>=44,`${label}: weergaveknop '${k.naam}' is geen ${minDoel}px-doel (${Math.round(k.width)}x${Math.round(k.height)})`);
        if(w>=901){
          /* Op het papier boven het vel, op de lijnen van de inhoud, zonder de kop te verschuiven. */
          assert(m.balk.bottom<=m.sheetTop+1&&m.balk.top>=-1,`${label}: balk staat niet in de marge boven het vel (${Math.round(m.balk.top)}–${Math.round(m.balk.bottom)}, vel op ${Math.round(m.sheetTop)})`);
          /* Zonder balk begon de kop op 73px (901–1099px) of 81px (vanaf 1100px); dat blijft zo. */
          const kopZonderBalk=w>=1100?81:73;
          assert(Math.abs(m.mast.top-kopZonderBalk)<=1,`${label}: de kop verschuift door de balk (${Math.round(m.mast.top)} tegen ${kopZonderBalk}px)`);
          assert(m.menu&&Math.abs(m.menu.left-m.sheetLinks)<=1&&Math.abs(m.thema.right-m.sheetRechts)<=1&&m.link.left>=m.menu.right,`${label}: balk lijnt niet uit met de inhoud (${m.menu&&Math.round(m.menu.left)}/${Math.round(m.thema.right)} tegen ${Math.round(m.sheetLinks)}/${Math.round(m.sheetRechts)})`);
        }
        assert.deepEqual(m.geknipt,[],`${label}: tekst in de bovenbalk wordt afgeknipt: ${m.geknipt.join(", ")}`);
        assert(m.overflow<=1,`${label}: horizontale overflow ${m.overflow}px`);
        if(!telefoon)assert(Math.abs(m.link.top-m.thema.top)<=2,`${label}: Nachtzicht en de weergavekeuze staan niet op één rij (${Math.round(m.link.top)} tegen ${Math.round(m.thema.top)})`);
        /* Eigenaar 18 november: de balk kost op telefoon en tablet één rij; de temperatuur begint dan hoogstens op 380px. */
        if(w<=900)assert(m.hero&&m.hero.top<=(w>=360?380:560),`${label}: temperatuur begint pas op ${m.hero&&Math.round(m.hero.top)}px`);
        else if(w>=1100)assert(m.chartkop&&m.chartkop.top<=h-100,`${label}: grafiek begint pas op ${m.chartkop&&Math.round(m.chartkop.top)}px (vouw ${h}px)`);
        if(taal==="en"){
          assert(/Stargazing/.test(m.linkTekst),`${label}: Nachtzicht-link niet vertaald: '${m.linkTekst}'`);
          assert(/^Choose (appearance|display)/.test(m.groepNaam),`${label}: groepsnaam niet vertaald: '${m.groepNaam}'`);
          if(w>430)assert(/appearance/i.test(m.label),`${label}: label Weergave niet vertaald: '${m.label}'`);
        }else{
          assert(/Nachtzicht/.test(m.linkTekst),`${label}: linktekst '${m.linkTekst}'`);
          assert(m.groepNaam.startsWith("Weergave kiezen"),`${label}: groepsnaam van de weergavekeuze gewijzigd: '${m.groepNaam}'`);
        }
        const c=telefoon?null:contrast(m.linkKleur,m.achter);
        if(!telefoon)assert(c>=4.5,`${label}: contrast Nachtzicht-link ${c.toFixed(2)}:1 (${m.linkKleur} op ${m.achter})`);
        /* Gedrag: schakelaar zet donker of licht, Auto zet terug op het systeem. */
        /* Themaknoppen tonen alleen tekst: geen zon- of maansymbool, wel het label (eigenaar 22 nov). */
        const knop=await page.evaluate(()=>{const z=document.querySelector("#thema .wiw-theme-sun"),m=document.querySelector("#thema .wiw-theme-moon"),tk=e=>e?e.textContent.trim():null;return {tekst:document.getElementById("thema").textContent,zon:tk(z),maan:tk(m)};});
        assert(!/[\u2600\u263e]/.test(knop.tekst),`${label}: themaknoppen tonen nog een zon- of maansymbool: '${knop.tekst.trim()}'`);
        assert.deepEqual([knop.zon,knop.maan],taal==="en"?["Light","Dark"]:["Licht","Donker"],`${label}: labels van de themaknoppen ontbreken`);
        const begin=await page.evaluate(()=>document.documentElement.getAttribute("data-thema"));
        const thema=()=>page.evaluate(()=>document.documentElement.getAttribute("data-thema"));
        await page.click("#thema .wiw-theme-moon");
        assert.equal(await thema(),"donker",`${label}: ☾ in de bovenbalk zet het thema niet op donker`);
        await page.click("#thema .wiw-theme-sun");
        assert.equal(await thema(),"licht",`${label}: ☀ in de bovenbalk zet het thema niet op licht`);
        await page.click("#thema-auto");
        const na2=await page.evaluate(()=>document.documentElement.getAttribute("data-thema"));
        assert.equal(na2,begin,`${label}: Auto zet het thema niet terug (${begin} → ${na2})`);
        /* Nachtzicht: de kop komt in beeld, onder een eventuele vaste balk. */
        if(!telefoon){await page.click(".wiw-snel-nachtzicht");await sleep(400);
        const doel=await page.evaluate(()=>{const e=document.getElementById("nachtzicht");const b=e.getBoundingClientRect();return {top:b.top,zicht:b.top>=0&&b.bottom<=innerHeight,hash:location.hash};});
        assert(doel.zicht&&doel.top<=140&&doel.hash==="#nachtzicht",`${label}: Nachtzicht-link brengt de kop niet in beeld (${JSON.stringify(doel)})`);}
        /* Toetsenbord: na de skiplink komen eerst de bovenbalk en dan de zoekbalk. */
        await page.evaluate(()=>{scrollTo(0,0);document.activeElement&&document.activeElement.blur();});
        await page.goto(root+"/weer/utrecht/"+(taal==="en"?"?taal=en":""),{waitUntil:"domcontentloaded"});
        await page.waitForFunction(()=>!document.getElementById("here")?.disabled,null,{timeout:10000});
        const volgorde=[];for(let i=0;i<5;i++){await page.keyboard.press("Tab");volgorde.push(await page.evaluate(()=>{const a=document.activeElement;return a.id||a.className||a.tagName;}));}
        const iM=volgorde.indexOf("wiw-menu-knop"),iN=volgorde.indexOf("wiw-snel-nachtzicht"),iT=volgorde.findIndex(x=>x==="thema-auto"||x==="thema-switch"),iQ=volgorde.indexOf("q");
        assert(iM>=0&&iT>iM&&(telefoon||iN>iM&&iT>iN)&&iT>=0&&(iQ<0||iQ>iT),`${label}: toetsenbordvolgorde begint niet met de bovenbalk: ${volgorde.join(" → ")}`);
        assert.deepEqual(fouten,[],`${label}: runtimefouten ${fouten.join(" | ")}`);
        regels.push(`${label}: balk op ${Math.round(m.balk.top)}px, hoogte ${Math.round(m.balk.height)}px, ${w<=900?"temperatuur op "+Math.round(m.hero.top)+"px":"grafiekkop op "+Math.round(m.chartkop.top)+"px"}, ${telefoon?"menu en weergave":"contrast link "+c.toFixed(1)+":1"}`);
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  regels.forEach(r=>console.log("BOVENBALK "+r));
  console.log("Bovenbalk OK: weergavekeuze en Nachtzicht bovenaan op 320–1440px, licht en donker, NL en EN; tapdoelen, eerste scherm, gedrag, anker en toetsenbord.");
})().catch(e=>{console.error(e);process.exit(1);});

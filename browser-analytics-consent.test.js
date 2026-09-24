"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {chromium,webkit}=require("playwright");

const analytics=fs.readFileSync(path.join(__dirname,"posthog-analytics.js"),"utf8");
const html=`<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Consentfixture</title><style>:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;font:16px system-ui}main{min-height:1400px;padding:24px}</style></head>
<body>
<label>Zoek <input id="q"></label><div id="res"><button type="button">Resultaat</button></div>
<button id="here" type="button">Mijn locatie</button><button id="ververs" type="button">Ververs</button><button id="thema" type="button">Thema</button>
<div id="state" class="msg">Gegevens ophalen.</div>
<main id="app" style="display:none;visibility:hidden">
  <span id="t">–</span><span id="stamp"></span>
  <div id="chips"><span class="chip"><button class="chipplaats" type="button">Utrecht</button></span><button id="chipadd" class="chip add" type="button">Plaats bewaren</button><button id="chipdeel" class="chip add deel" type="button">Delen</button></div>
  <div id="days"><button class="row day" type="button">Morgen</button></div>
  <button class="wiw-hour-toggle" type="button">Alle uren bekijken</button>
  <div id="nights"><button class="nacht-meer" type="button">Meer nachten bekijken</button></div>
</main>
<script src="/posthog-analytics.js"></script>
<script>
/* Net als de echte site: een klik op een dag tekent de dagenlijst opnieuw, zodat
   het aangeklikte element losgekoppeld is voordat de klik het document bereikt. */
document.getElementById("days").addEventListener("click",event=>{const rij=event.target.closest(".row.day");if(rij)rij.replaceWith(rij.cloneNode(true));});
</script>
</body></html>`;

const wacht=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wachtOpEvent(events,naam,timeout=2500){
  const start=Date.now();
  while(Date.now()-start<timeout){
    if(events.some(event=>event&&event.event===naam))return;
    await wacht(25);
  }
  throw new Error(`analytics-event ${naam} niet ontvangen; gezien=${events.map(event=>event&&event.event).join(",")}`);
}

async function maakPagina(browserType,opt={}){
  const browser=await browserType.launch({headless:true});
  const context=await browser.newContext({
    viewport:opt.viewport||{width:390,height:844},
    colorScheme:opt.colorScheme||"light",
    locale:"nl-NL",
    serviceWorkers:"block",
    /* Playwright is zelf een geautomatiseerde browser; de productie-analytics
       sluit die bewust uit. Deze fixture speelt daarom een gewone bezoeker,
       tenzij de test juist de uitsluiting controleert. */
    userAgent:opt.automatisering?undefined:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
  });
  if(!opt.automatisering)await context.addInitScript(()=>Object.defineProperty(Navigator.prototype,"webdriver",{configurable:true,get:()=>false}));
  if(opt.gpc)await context.addInitScript(()=>Object.defineProperty(navigator,"globalPrivacyControl",{configurable:true,value:true}));
  const events=[],google=[];
  await context.route("https://watishetweer.nl/**",async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==="/posthog-analytics.js"){
      await route.fulfill({status:200,contentType:"application/javascript; charset=utf-8",body:analytics});return;
    }
    await route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:html});
  });
  await context.route("https://eu.i.posthog.com/**",async route=>{
    const request=route.request();
    const headers={
      "access-control-allow-origin":"https://watishetweer.nl",
      "access-control-allow-methods":"POST, OPTIONS",
      "access-control-allow-headers":"content-type",
      "content-type":"application/json"
    };
    if(request.method()==="OPTIONS"){await route.fulfill({status:204,headers,body:""});return;}
    const body=request.postData();
    if(body)events.push(JSON.parse(body));
    await route.fulfill({status:200,headers,body:"{}"});
  });
  await context.route("https://www.googletagmanager.com/**",async route=>{
    google.push(route.request().url());
    await route.fulfill({status:200,contentType:"application/javascript",body:""});
  });
  const page=await context.newPage();
  await page.goto("https://watishetweer.nl/",{waitUntil:"load",referer:opt.referer});
  return {browser,context,page,events,google};
}

function luminantie(rgb){
  const delen=String(rgb).match(/[\d.]+/g)?.slice(0,3).map(Number)||[];
  if(delen.length!==3)return null;
  const kanalen=delen.map(v=>{const s=v/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4);});
  return .2126*kanalen[0]+.7152*kanalen[1]+.0722*kanalen[2];
}
function contrast(a,b){
  const la=luminantie(a),lb=luminantie(b);
  if(la===null||lb===null)return 0;
  return (Math.max(la,lb)+.05)/(Math.min(la,lb)+.05);
}

async function meetBanner(browserType,naam,viewport,colorScheme){
  const sessie=await maakPagina(browserType,{viewport,colorScheme});
  const {browser,page,events,google}=sessie;
  try{
    await page.locator("#analytics-toestemming").waitFor({state:"visible"});
    const meting=await page.evaluate(()=>{
      const banner=document.getElementById("analytics-toestemming"),knoppen=[...banner.querySelectorAll("button")],r=banner.getBoundingClientRect();
      const br=knoppen.map(knop=>{const rect=knop.getBoundingClientRect(),stijl=getComputedStyle(knop);return {left:rect.left,width:rect.width,height:rect.height,color:stijl.color,background:stijl.backgroundColor,border:stijl.borderColor};});
      const stijl=getComputedStyle(banner);
      return {
        rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},
        viewport:{width:innerWidth,height:innerHeight},
        overflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
        role:banner.getAttribute("role"),modal:banner.getAttribute("aria-modal"),labelledby:banner.getAttribute("aria-labelledby"),describedby:banner.getAttribute("aria-describedby"),
        titel:document.getElementById("analytics-toestemming-titel")?.textContent||"",
        uitleg:document.getElementById("analytics-toestemming-uitleg")?.textContent||"",
        privacy:banner.querySelector("a")?.getAttribute("href")||"",
        kleur:stijl.color,achtergrond:stijl.backgroundColor,knoppen:br
      };
    });
    assert.equal(meting.role,"dialog",`${naam}: banner mist dialogsemantiek`);
    assert.equal(meting.modal,"false",`${naam}: niet-blokkerende keuze is ten onrechte modaal`);
    assert.equal(meting.labelledby,"analytics-toestemming-titel",`${naam}: titelrelatie ontbreekt`);
    assert.equal(meting.describedby,"analytics-toestemming-uitleg",`${naam}: uitlegrelatie ontbreekt`);
    assert.equal(meting.titel,"Bezoekstatistieken",`${naam}: compacte titel ontbreekt`);
    assert(/pas na toestemming/i.test(meting.uitleg),`${naam}: vooraf geblokkeerde Google-tag wordt niet uitgelegd`);
    assert.equal(meting.privacy,"/privacy",`${naam}: banner gebruikt niet de canonieke privacyroute`);
    assert(meting.rect.left>=7&&meting.rect.right<=meting.viewport.width-7,`${naam}: banner valt buiten viewport ${JSON.stringify(meting.rect)}`);
    assert(meting.rect.top>=7&&meting.rect.bottom<=meting.viewport.height-7,`${naam}: banner valt verticaal buiten viewport ${JSON.stringify(meting.rect)}`);
    assert(meting.overflow<=1,`${naam}: consent veroorzaakt ${meting.overflow}px horizontale overflow`);
    assert(contrast(meting.kleur,meting.achtergrond)>=4.5,`${naam}: bannertekst haalt geen 4,5:1 contrast (${meting.kleur} op ${meting.achtergrond})`);
    assert.equal(meting.knoppen.length,2,`${naam}: weigeren en toestaan moeten beide zichtbaar zijn`);
    assert(meting.knoppen[0].left<meting.knoppen[1].left,`${naam}: keuzes hebben geen voorspelbare visuele volgorde`);
    assert.deepEqual(
      meting.knoppen.map(k=>[k.color,k.background,k.border]),
      [meting.knoppen[0],meting.knoppen[0]].map(k=>[k.color,k.background,k.border]),
      `${naam}: weigeren en toestaan hebben geen gelijke visuele prioriteit`
    );
    if(viewport.width<=620){
      assert(meting.knoppen.every(k=>k.height>=43.5),`${naam}: mobiel consentdoel is kleiner dan 44px`);
      assert(Math.abs(meting.knoppen[0].width-meting.knoppen[1].width)<=1,`${naam}: mobiele keuzes zijn niet even breed`);
      assert(meting.rect.height/viewport.height<=.22,`${naam}: mobiele banner bedekt te veel van het weer (${meting.rect.height}px)`);
    }else{
      assert(meting.knoppen.every(k=>k.height>=39.5),`${naam}: desktop consentdoel is kleiner dan 40px`);
      assert(meting.rect.height/viewport.height<=.12,`${naam}: desktopbanner is nog te hoog (${meting.rect.height}px)`);
    }
    await wachtOpEvent(events,"$pageview");
    assert.equal(google.length,0,`${naam}: Google-tag geladen vóór toestemming`);
  }finally{await browser.close();}
}

async function controleerTaakmetingEnKeuze(){
  const sessie=await maakPagina(chromium,{viewport:{width:390,height:844},colorScheme:"dark"});
  const {browser,page,events,google}=sessie;
  try{
    await wachtOpEvent(events,"$pageview");
    await page.evaluate(()=>{
      const app=document.getElementById("app");app.style.display="block";app.style.visibility="visible";
      document.getElementById("state").style.display="none";
      document.getElementById("t").textContent="19";
      document.getElementById("stamp").textContent="Gegevens opgehaald om 12:34 · minder dan 1 min geleden";
    });
    await wachtOpEvent(events,"weather_view_ready");
    await page.locator("#q").fill("Niet meesturen");
    await page.locator("#res button").click();
    await page.locator("#chipadd").click();
    await page.locator("#chips .chipplaats").click();
    await page.locator("#chipdeel").click();
    await page.locator("#days .row.day").click();
    await page.locator(".wiw-hour-toggle").click();
    await page.locator("#nights .nacht-meer").click();
    for(const naam of ["weather_search_started","weather_search_result_selected","saved_location_added","saved_location_opened","location_share_requested","forecast_day_selected","hourly_details_toggled","night_details_toggled"])await wachtOpEvent(events,naam);
    const klaar=events.find(event=>event.event==="weather_view_ready");
    assert.equal(klaar.properties.saved_locations,"some","zichtbare bewaarde plaatsen horen alleen als ja/nee-signaal mee te gaan");
    for(const event of events){
      assert.equal(event.properties.entry_source,"none","direct geopende pagina hoort herkomst none te hebben");
      assert.equal(event.properties.launch_mode,"browser","browserweergave hoort startmodus browser te hebben");
    }
    assert(["under_1s","1_to_2s","2_to_5s","5_to_10s","over_10s"].includes(klaar.properties.load_time_bucket),"weeruitkomst mist begrensde laadduurgroep");
    const serialisatie=JSON.stringify(events);
    for(const verboden of ["Niet meesturen","52.35","Almere","19 graden","Utrecht"]){
      assert(!serialisatie.includes(verboden),`analytics lekt verboden inhoud: ${verboden}`);
    }
    await page.locator('[data-keuze="denied"]').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem("weerbriefing.ga4.consent.v1")),"denied","weigering wordt niet lokaal gerespecteerd");
    assert.equal(await page.locator("#analytics-toestemming").count(),0,"banner blijft na weigeren zichtbaar");
    assert.equal(google.length,0,"Google-tag geladen ondanks weigering");
  }finally{await browser.close();}
}

async function controleerToestaan(){
  const sessie=await maakPagina(chromium,{viewport:{width:390,height:844}});
  const {browser,page,google}=sessie;
  try{
    await page.locator('[data-keuze="granted"]').click();
    const start=Date.now();while(!google.length&&Date.now()-start<2000)await wacht(25);
    assert.equal(await page.evaluate(()=>localStorage.getItem("weerbriefing.ga4.consent.v1")),"granted","toestemming wordt niet lokaal bewaard");
    assert.equal(google.length,1,"Google-tag wordt na toestemming niet exact één keer geladen");
  }finally{await browser.close();}
}

async function controleerHerkomst(){
  for(const [referer,verwacht] of [["https://www.google.nl/search?q=weer+almere","search"],["https://chatgpt.com/c/geheim123","ai_assistant"]]){
    const sessie=await maakPagina(chromium,{referer});
    const {browser,page,events}=sessie;
    try{
      await wachtOpEvent(events,"$pageview");
      assert.equal(await page.evaluate(()=>document.referrer),referer,"browserfixture zet de verwijzer niet echt");
      assert.equal(events[0].properties.entry_source,verwacht,"echte browser: herkomstcategorie voor "+referer);
      const serialisatie=JSON.stringify(events).toLowerCase();
      for(const verboden of ["google","chatgpt","almere","geheim123","q="])assert(!serialisatie.includes(verboden),"echte browser lekt verwijzer-inhoud: "+verboden);
    }finally{await browser.close();}
  }
}

async function controleerAutomatisering(){
  const sessie=await maakPagina(chromium,{automatisering:true});
  const {browser,page,events}=sessie;
  try{
    assert.equal(await page.evaluate(()=>navigator.webdriver),true,"fixture draait niet als geautomatiseerde browser");
    await page.waitForTimeout(300);
    assert.deepEqual(events,[],"eigen geautomatiseerde controles horen geen PostHog-data te sturen");
  }finally{await browser.close();}
}

async function controleerGpc(){
  const sessie=await maakPagina(chromium,{gpc:true});
  const {browser,page,events,google}=sessie;
  try{
    await page.waitForTimeout(150);
    assert.equal(await page.locator("#analytics-toestemming").count(),0,"GPC hoort de toestemmingsvraag volledig over te slaan");
    assert.deepEqual(events,[],"GPC hoort PostHog volledig uit te schakelen");
    assert.deepEqual(google,[],"GPC hoort Google Analytics volledig uit te schakelen");
  }finally{await browser.close();}
}

(async()=>{
  await meetBanner(chromium,"Chromium 320 licht",{width:320,height:844},"light");
  await meetBanner(chromium,"Chromium 390 donker",{width:390,height:844},"dark");
  await meetBanner(chromium,"Chromium 1440 donker",{width:1440,height:1000},"dark");
  await meetBanner(webkit,"WebKit 390 licht",{width:390,height:844},"light");
  await controleerTaakmetingEnKeuze();
  await controleerToestaan();
  await controleerHerkomst();
  await controleerAutomatisering();
  await controleerGpc();
  console.log("Analytics-consentbrowsercontract groen: compacte toegankelijke banner, gelijke keuzes, GPC, vooraf geblokkeerde GA4, privacyveilige taakuitkomsten, herkomstcategorie zonder verwijzer en uitsluiting van geautomatiseerde browsers in Chromium en WebKit.");
})().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});

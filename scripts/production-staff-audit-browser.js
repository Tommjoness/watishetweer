"use strict";

const assert=require("assert");
const {chromium}=require("playwright");

const ROOT=String(process.env.PRODUCTION_ROOT||"https://watishetweer.nl").replace(/\/$/,"");
const verwacht=String(process.env.EXPECTED_SHA||"").trim();
if(!/^[0-9a-f]{7,40}$/i.test(verwacht))throw new Error("EXPECTED_SHA ontbreekt of is ongeldig.");

function verwachteCloudflareAnalyticsCspFout(tekst){
  const s=String(tekst||"");
  return s.includes("static.cloudflareinsights.com/beacon.min.js")
    && /Content Security Policy/i.test(s)
    && /script-src 'self' 'unsafe-inline'/.test(s)
    && /blocked/i.test(s);
}

async function wachtVolledig(page,naam){
  try{
    await page.waitForFunction(n=>{
      const app=document.getElementById("app");
      if(!app)return false;
      const stijl=getComputedStyle(app);
      const zichtbaar=stijl.display!=="none"&&stijl.visibility!=="hidden";
      const plaats=document.getElementById("place")?.getAttribute("aria-label")||"";
      const dagen=document.querySelectorAll("#days .row.day:not(.kop)").length;
      return zichtbaar&&plaats===n&&dagen===7;
    },naam,{timeout:25000});
  }catch(err){
    const diagnose=await page.evaluate(()=>{
      const app=document.getElementById("app"),state=document.getElementById("state");
      const stijl=app?getComputedStyle(app):null;
      return {
        href:location.href,
        build:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
        appAanwezig:!!app,
        appDisplay:stijl&&stijl.display||null,
        appVisibility:stijl&&stijl.visibility||null,
        appClass:app&&app.className||"",
        appBusy:app&&app.getAttribute("aria-busy")||null,
        plaats:document.getElementById("place")?.getAttribute("aria-label")||"",
        dagen:document.querySelectorAll("#days .row.day:not(.kop)").length,
        state:(state?.textContent||"").trim(),
        stateClass:state&&state.className||""
      };
    }).catch(()=>({diagnose:"browser-evaluatie mislukt"}));
    const netwerk=Array.isArray(page.__wnNetwerk)?page.__wnNetwerk.slice(-12):[];
    throw new Error(`Productie werd niet volledig voor ${naam}: ${JSON.stringify(diagnose)}; netwerk=${JSON.stringify(netwerk)}; oorzaak=${err&&err.message||err}`);
  }
}
async function kiesZoekresultaat(page,naam){
  const q=page.locator("#q");await q.fill(naam);
  await page.waitForSelector("#res.on div[data-lat]",{timeout:10000});
  const exact=page.locator("#res div[data-lat]").filter({hasText:new RegExp("^"+naam.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i")}).first();
  if(await exact.count())await exact.click();else await page.locator("#res div[data-lat]").first().click();
  await wachtVolledig(page,naam);
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},locale:"nl-NL",serviceWorkers:"block"});
    const page=await context.newPage(),errors=[];
    let cloudflareAnalyticsCspBlokkades=0;
    page.__wnNetwerk=[];
    const noteerNetwerk=(soort,url,detail)=>{
      if(!/open-meteo\.com|bigdatacloud\.net|\/api\//i.test(String(url||"")))return;
      page.__wnNetwerk.push({soort,url:String(url),detail:String(detail||"")});
      if(page.__wnNetwerk.length>30)page.__wnNetwerk.shift();
    };
    page.on("requestfailed",r=>noteerNetwerk("requestfailed",r.url(),r.failure()&&r.failure().errorText));
    page.on("response",r=>{if(r.status()>=400)noteerNetwerk("http",r.url(),r.status());});
    page.on("pageerror",e=>errors.push(String(e)));
    page.on("console",m=>{
      if(m.type()!=="error")return;
      const tekst=m.text();
      /* Cloudflare Web Analytics kan buiten het build-artifact om een beacon
         injecteren. De site-CSP staat bewust alleen eigen scripts toe en blokkeert
         die derde-partijscript. Negeer uitsluitend deze exacte CSP-handhaving;
         iedere andere console-error blijft de productie-audit hard laten falen. */
      if(verwachteCloudflareAnalyticsCspFout(tekst)){cloudflareAnalyticsCspBlokkades++;return;}
      errors.push(tekst);
    });

    /* Gebruik hier een wereldlocatie die ook door de aparte wereldwijde
       productie-monitor wordt gecontroleerd. Zo blijft deze test gericht op
       de staff-auditinteracties in plaats van een extra, unieke afhankelijkheid
       van één externe forecastrequest toe te voegen. */
    const start=ROOT+"/?lat=-33.8688&lon=151.2093&plaats=Sydney&land=AU";
    const response=await page.goto(start,{waitUntil:"domcontentloaded",timeout:30000});
    assert(response&&response.ok(),`Sydney start HTTP ${response&&response.status()}`);
    await wachtVolledig(page,"Sydney");
    await page.evaluate(()=>document.fonts&&document.fonts.ready);
    const eerste=await page.evaluate(()=>({
      sha:document.querySelector('meta[name="weather-build-sha"]')?.content||"",
      uur:[...document.querySelectorAll("#chart text")].filter(el=>/^\d{2}$/.test((el.textContent||"").trim())).length,
      tabel:document.querySelectorAll("#chartdata tbody tr").length,
      main:document.querySelectorAll("main#app").length,
      skip:!!document.querySelector('.skiplink[href="#app"]'),
      og:document.querySelector('meta[property="og:image"]')?.content||"",
      twitter:document.querySelector('meta[name="twitter:image"]')?.content||"",
      csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content||""
    }));
    assert.equal(eerste.sha,verwacht,`verkeerde productiebuild ${eerste.sha}`);
    assert(eerste.uur>0,"uurlabels ontbreken op de eerste mobiele render");
    assert(eerste.tabel>0,"toegankelijke grafiektabel is leeg");
    assert.equal(eerste.main,1,"productie heeft niet exact één main-landmark");
    assert(eerste.skip,"skiplink ontbreekt op productie");
    assert.equal(eerste.og,ROOT+"/icon-512.png","og:image wijkt af");
    assert.equal(eerste.twitter,ROOT+"/icon-512.png","twitter:image wijkt af");
    assert(!/cloudflareinsights/i.test(eerste.csp),"document-CSP mag Cloudflare Analytics niet impliciet toestaan");

    const grafiekSummary=page.locator("#chartdata > summary");
    await grafiekSummary.focus();await page.keyboard.press("Enter");
    assert(await page.locator("#chartdata").evaluate(el=>el.open),"grafiekgegevens openen niet met toetsenbord");

    await kiesZoekresultaat(page,"Amsterdam");
    assert(/plaats=Amsterdam/.test(page.url()),`Amsterdam-keuze synchroniseert URL niet: ${page.url()}`);
    await page.goBack({waitUntil:"domcontentloaded"});await wachtVolledig(page,"Sydney");
    assert(/plaats=Sydney/.test(page.url()),`Back herstelt Sydney-URL niet: ${page.url()}`);
    await page.goForward({waitUntil:"domcontentloaded"});await wachtVolledig(page,"Amsterdam");
    assert(/plaats=Amsterdam/.test(page.url()),`Forward herstelt Amsterdam-URL niet: ${page.url()}`);
    assert.equal(await page.title(),"Amsterdam · Wat is het weer?","Forward synchroniseert titel niet");

    const add=page.locator("#chipadd");if(await add.count())await add.click();
    const del=page.locator(".chip .x").first();
    assert(await del.count(),"bewaarde locatie heeft geen verwijderknop");
    for(const width of [320,360,375,390,430]){
      await page.setViewportSize({width,height:844});await page.waitForTimeout(50);
      const box=await del.boundingBox();
      assert(box&&box.width>=39.5&&box.height>=39.5,`${width}px: verwijdertarget ${box&&box.width}x${box&&box.height}`);
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert(overflow<=2,`${width}px: ${overflow}px pagina-overflow`);
    }

    await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(100);
    const resized=await page.evaluate(()=>({
      uur:[...document.querySelectorAll("#chart text")].filter(el=>/^\d{2}$/.test((el.textContent||"").trim())).length,
      tabel:document.querySelectorAll("#chartdata tbody tr").length,
      overflow:document.documentElement.scrollWidth-window.innerWidth
    }));
    assert(resized.uur>0&&resized.tabel>0,"resize verloor grafieklabels of toegankelijke data");
    assert(resized.overflow<=2,`1280px: ${resized.overflow}px pagina-overflow`);

    /* Zelfde context behoudt Amsterdam als persoonlijke laatst-gebruikte plaats.
       Een beschadigde gedeelde URL moet desondanks fail-closed blijven. */
    const invalid=await context.newPage();
    const invalidResponse=await invalid.goto(ROOT+"/?lat=52abc&lon=5&plaats=KapotteLink",{waitUntil:"domcontentloaded",timeout:30000});
    assert(invalidResponse&&invalidResponse.ok(),`kapotte share-URL HTTP ${invalidResponse&&invalidResponse.status()}`);
    await invalid.waitForFunction(()=>/ongeldig/i.test(document.getElementById("state")?.textContent||""),null,{timeout:8000});
    const fout=await invalid.evaluate(()=>({
      state:(document.getElementById("state")?.textContent||"").trim(),
      app:getComputedStyle(document.getElementById("app")).display,
      plaats:document.getElementById("place")?.getAttribute("aria-label")||""
    }));
    assert(/gedeelde locatie is ongeldig/i.test(fout.state),`kapotte link mist expliciete melding: ${fout.state}`);
    assert.equal(fout.app,"none","kapotte link toont weerdata");
    assert.notEqual(fout.plaats,"Amsterdam","kapotte link toont oude plaatsidentiteit");
    await invalid.close();

    assert.deepEqual(errors,[],`productie-browserfouten: ${errors.join(" | ")}`);
    console.log(`PRODUCTIE STAFF-AUDIT GESLAAGD: ${verwacht}; eerste grafiekstate, tabel/keyboard, Sydney→Amsterdam Back/Forward, 320–430px targets, resize, metadata en invalid deep link op Cloudflare-productie. Bewust door CSP geblokkeerde Cloudflare Analytics-beacons: ${cloudflareAnalyticsCspBlokkades}.`);
    await context.close();
  }finally{await browser.close();}
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

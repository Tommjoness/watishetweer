"use strict";

/* Verversingsbeleid van de informatiepagina's (Nachtzicht-park, -overzicht, Maan en de vakantiepagina), met een
   gecontroleerde klok op het finale artifact (public/):
   - het oordeel wordt bij een nieuw uur lokaal opnieuw berekend, zonder nieuwe aanvraag;
   - de opgehaalde verwachting wordt hoogstens een uur oud: daarna precies één nieuwe aanvraag, zonder betaalde reserve;
   - mislukt verversen, dan blijft het getoonde staan, met oplopende wachttijd en een eerlijke regel;
   - een verborgen tabblad rekent en vraagt niets; terugkeer verversen meteen als de gegevens te oud zijn;
   - nooit meer dan één timer en nooit overlappende aanvragen;
   - de maanpagina gaat bij een datumwissel mee, en een ongewijzigde uitkomst laat de DOM met rust;
   - de vakantiepagina ververst stil en vervangt de verwachting alleen als de uitkomst verandert. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");
const {SEIZOENSPAGINAS}=require("./seizoenspagina.config.js");

const PUBLIC=path.join(__dirname,"..","public");
for(const f of ["nachtzicht/index.html","nachtzicht/alde-feanen/index.html","maan/index.html","herfstvakantie/index.html"])
  if(!fs.existsSync(path.join(PUBLIC,f)))throw new Error("public/"+f+" ontbreekt; draai eerst de build.");
const herfst=SEIZOENSPAGINAS.find(p=>p.slug==="herfstvakantie");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".css":"text/css; charset=utf-8"};
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  const rel=(pathname.endsWith("/")?pathname+"index.html":pathname).replace(/^\//,"");
  const file=path.join(PUBLIC,rel);
  if(file.startsWith(PUBLIC+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.writeHead(200,{"content-type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","cache-control":"no-store"});
    fs.createReadStream(file).pipe(res);return;
  }
  res.writeHead(404);res.end("not found");
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const UUR=3600000,MIN=60000;

const VARIANT={goed:{cc:()=>8},slecht:{cc:()=>95,pr:()=>0.6,zicht:1500,wc:()=>61}};
function nacht(lat,lon,soort){
  const d=bouw({geenKwartier:true,...VARIANT[soort]});
  const i=d.hourly.time.indexOf("2026-07-22T21:00"),c=d.current,h=d.hourly;
  c.time="2026-07-22T21:30";
  for(const v of ["temperature_2m","relative_humidity_2m","precipitation","weather_code","cloud_cover","wind_gusts_10m","is_day"])c[v]=h[v][i];
  c.visibility=h.visibility?h.visibility[i]:null;
  d.latitude=lat;d.longitude=lon;d.elevation=2;
  return d;
}
function vakantie(maxTemp){
  const dagen=[];for(let i=0;i<7;i++)dagen.push(new Date(Date.parse("2026-10-12T00:00:00Z")+i*864e5).toISOString().slice(0,10));
  return {daily:{time:dagen,temperature_2m_min:dagen.map(()=>7.6),temperature_2m_max:dagen.map(()=>maxTemp),precipitation_sum:dagen.map(()=>0.4),snowfall_sum:dagen.map(()=>0),precipitation_probability_max:dagen.map(()=>20),sunshine_duration:dagen.map(()=>null)}};
}

/* Eén testpagina met een besturingsobject: soort weer, of de bron faalt, en een telling van alle aanvragen. */
async function open(browser,pad,klok,opt={}){
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  const ctl={soort:"goed",faalt:false,maxTemp:15.4,primair:0,reserve:0,gelijktijdig:0,maxGelijktijdig:0};
  await page.clock.install({time:new Date(klok)});
  await page.addInitScript(()=>{
    /* telt hoeveel intervallen de pagina zelf aanmaakt (dubbele timers); na de klok, zodat de nepklok wordt omwikkeld */
    const orig=window.setInterval;window.__intervallen=0;
    window.setInterval=function(...a){window.__intervallen++;return orig.apply(this,a);};
  });
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"){
      ctl.primair++;ctl.gelijktijdig++;ctl.maxGelijktijdig=Math.max(ctl.maxGelijktijdig,ctl.gelijktijdig);
      await sleep(20);ctl.gelijktijdig--;
      if(ctl.faalt)return r.fulfill({status:503,body:"{}"});
      if(pad.startsWith("/herfstvakantie"))return r.fulfill({json:herfst.plaatsen.map(()=>vakantie(ctl.maxTemp))});
      const A=String(u.searchParams.get("latitude")).split(",").map(Number),B=String(u.searchParams.get("longitude")).split(",").map(Number);
      const lijst=A.map((x,i)=>nacht(x,B[i],ctl.soort));
      return r.fulfill({json:A.length>1?lijst:lijst[0]});
    }
    if(u.pathname==="/api/forecast"){ctl.reserve++;return r.fulfill({status:503,json:{beschikbaar:false}});}
    if(u.pathname.startsWith("/api/"))return r.fulfill({status:503,json:{beschikbaar:false}});
    if(u.hostname!=="127.0.0.1")return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto("http://127.0.0.1:"+server.address().port+pad,{waitUntil:"load"});
  return {context,page,fouten,ctl};
}
const rust=()=>sleep(250);
/* Een sprong vooruit (een kwartier, of een laptop die een uur dicht was): de minutentimer vuurt daarna precies één keer.
   Bewust geen runFor: dat laat ook de 8-seconden-afbreektimer van een lopende aanvraag in één klap aflopen. */
async function sprong(page,ms){await page.clock.fastForward(ms);await rust();}
async function verberg(page,ja){
  await page.evaluate(h=>{Object.defineProperty(document,"hidden",{value:h,configurable:true});Object.defineProperty(document,"visibilityState",{value:h?"hidden":"visible",configurable:true});document.dispatchEvent(new Event("visibilitychange"));},ja);
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    /* ===== park ===== */
    {
      const {context,page,fouten,ctl}=await open(browser,"/nachtzicht/alde-feanen/","2026-07-22T19:30:00Z");
      try{
        await page.waitForFunction(()=>{const u=document.getElementById("nz-vannacht");return u&&!u.hidden;},null,{timeout:20000});
        await rust();
        assert.equal(ctl.primair,1,"park: één aanvraag bij het laden");
        assert.equal(await page.evaluate(()=>window.__intervallen),1,"park: precies één timer");
        const bijgewerkt=()=>page.locator("#nz-bijgewerkt").innerText();
        assert.equal(await bijgewerkt(),"Verwachting van 21:30.");
        const eerste=await page.locator("#nz-vannacht .nz-cijfer").innerText();
        const eersteTijd=await page.locator(".nz-gegevens tbody tr:first-child th").innerText();

        /* Uitklaptabel openen en de focus op de samenvatting zetten: een nieuw uur laat beide staan. */
        await page.locator(".nz-gegevens summary").focus();
        await page.keyboard.press("Enter");
        assert.equal(await page.locator(".nz-gegevens").evaluate(d=>d.open),true,"uurtabel opent met het toetsenbord");

        /* Een kwartier later: nieuw uur (22:00 → 22:30 lokaal): lokaal herberekend, geen nieuwe aanvraag. */
        await sprong(page,UUR/2);
        assert.equal(ctl.primair,1,"park: herberekenen kost geen aanvraag");
        const na=await page.locator(".nz-gegevens tbody tr:first-child th").innerText();
        assert.notEqual(na,eersteTijd,"park: de uurtabel schuift mee met de klok ("+eersteTijd+" → "+na+")");
        assert.equal(await page.locator(".nz-gegevens").evaluate(d=>d.open),true,"park: de open uurtabel blijft open");
        assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.tagName),"SUMMARY","park: de focus blijft op de samenvatting");
        assert.equal(await bijgewerkt(),"Verwachting van 21:30.");

        /* Een uur na de aanvraag: precies één nieuwe aanvraag, geen reserve; de regel noemt het nieuwe moment. */
        ctl.soort="slecht";
        await sprong(page,UUR);
        assert.equal(ctl.primair,2,"park: na een uur precies één verversing");
        assert.equal(ctl.reserve,0,"park: de verversing gebruikt geen betaalde reserve");
        assert.match(await bijgewerkt(),/^Verwachting van 2[23]:\d\d\.$/);
        assert.notEqual(await page.locator("#nz-vannacht .nz-cijfer").innerText(),eerste,"park: nieuwe verwachting (slecht weer) verandert het oordeel");

        /* Mislukt verversen: het getoonde blijft, de regel zegt het, de wachttijd loopt op (5, dan 15 minuten). */
        ctl.faalt=true;
        const getoond=await page.locator("#nz-vannacht .nz-cijfer").innerText();
        await sprong(page,UUR);
        assert.equal(ctl.primair,3,"park: mislukte verversing is één aanvraag");
        assert.equal(await page.locator("#nz-vannacht .nz-cijfer").innerText(),getoond,"park: werkende gegevens blijven staan");
        assert.match(await bijgewerkt(),/Verversen lukt nu niet\.$/);
        for(let i=0;i<4;i++){await sprong(page,MIN);}
        assert.equal(ctl.primair,3,"park: binnen de wachttijd (5 minuten) geen nieuwe aanvraag");
        await sprong(page,2*MIN);
        assert.equal(ctl.primair,4,"park: na de wachttijd één nieuwe poging");
        for(let i=0;i<10;i++){await sprong(page,MIN);}
        assert.equal(ctl.primair,4,"park: de tweede wachttijd is langer (15 minuten)");
        assert.equal(ctl.maxGelijktijdig,1,"park: nooit overlappende aanvragen");

        /* Herstel: de bron werkt weer; de volgende poging slaagt en de waarschuwing verdwijnt. */
        ctl.faalt=false;ctl.soort="goed";
        await sprong(page,6*MIN);
        assert.equal(ctl.primair,5,"park: herstel na de wachttijd");
        assert.doesNotMatch(await bijgewerkt(),/lukt nu niet/);

        /* Verborgen tabblad: niets doen; terugkeer na lange tijd ververst direct. */
        await verberg(page,true);
        await page.clock.fastForward(3*UUR);await sprong(page,MIN);
        assert.equal(ctl.primair,5,"park: een verborgen tabblad vraagt niets");
        await verberg(page,false);await rust();
        assert.equal(ctl.primair,6,"park: terugkeer naar het tabblad ververst verouderde gegevens meteen");
        assert.equal(await page.evaluate(()=>window.__intervallen),1,"park: nog steeds precies één timer");
        assert.deepEqual(fouten,[],"park: scriptfouten");
      }finally{await context.close();}
    }
    console.log("Verversing park: lokaal herberekenen, uurgrens, leeftijdsgrens, mislukken met wachttijd, verborgen tabblad en herstel kloppen.");

    /* ===== overzicht ===== */
    {
      const {context,page,fouten,ctl}=await open(browser,"/nachtzicht/","2026-07-22T19:30:00Z");
      try{
        await page.waitForFunction(()=>{const a=document.getElementById("nz-antwoord");return a&&!a.hidden&&a.textContent.trim();},null,{timeout:20000});
        await rust();
        assert.equal(ctl.primair,1,"overzicht: één aanvraag voor alle parken");
        assert.equal(await page.evaluate(()=>window.__intervallen),1,"overzicht: precies één timer");
        assert.match(await page.locator("#nz-antwoord").innerText(),/gunstig/);
        /* De antwoordzin wordt niet opnieuw geschreven als de uitkomst gelijk blijft (voorgelezen tekst, focus op links). */
        await page.evaluate(()=>{document.getElementById("nz-antwoord").dataset.merk="blijft";});
        await sprong(page,UUR/2);
        assert.equal(await page.locator("#nz-antwoord").getAttribute("data-merk"),"blijft","overzicht: ongewijzigd antwoord blijft staan");
        assert.equal(ctl.primair,1);
        ctl.soort="slecht";
        await sprong(page,UUR);
        assert.equal(ctl.primair,2,"overzicht: na een uur één verversing (alle parken in één aanvraag)");
        assert.equal(ctl.reserve,0,"overzicht: nooit een reeks betaalde reserveaanvragen");
        assert.match(await page.locator("#nz-antwoord").innerText(),/geen park met gunstige omstandigheden/,"overzicht: antwoord volgt de nieuwe verwachting");
        assert.equal(await page.locator("tr[data-park] .nz-n .nz-w").first().innerText().then(t=>/0\/10/.test(t)),true,"overzicht: rijen volgen de nieuwe verwachting");
        ctl.faalt=true;
        await sprong(page,UUR);
        assert.equal(ctl.primair,3);
        assert.equal(ctl.reserve,0,"overzicht: ook bij een storing geen reserveaanvragen");
        assert.match(await page.locator("#nz-antwoord").innerText(),/geen park met gunstige omstandigheden/,"overzicht: bij een storing blijft het laatste antwoord staan");
        assert.match(await page.locator("#nz-bijgewerkt").innerText(),/Verversen lukt nu niet\.$/);
        assert.equal(ctl.maxGelijktijdig,1,"overzicht: nooit overlappende aanvragen");
        assert.deepEqual(fouten,[],"overzicht: scriptfouten");
      }finally{await context.close();}
    }
    console.log("Verversing overzicht: één aanvraag voor negentien parken, geen reserve, stabiel antwoord en behoud bij storing kloppen.");

    /* ===== maan ===== */
    {
      const {context,page,fouten}=await open(browser,"/maan/","2026-07-22T21:50:00Z");/* 23:50 lokaal */
      try{
        await page.waitForFunction(()=>/Vandaag/.test((document.getElementById("nz-maan-tijden")||{}).textContent||""),null,{timeout:20000});
        const avond=await page.locator("#nz-maan-tijden").innerText();
        assert.equal(await page.evaluate(()=>window.__intervallen),1,"maan: precies één timer");
        await page.evaluate(()=>{document.getElementById("nz-maan-naam").dataset.merk="blijft";});
        await sprong(page,MIN);
        assert.equal(await page.locator("#nz-maan-naam").getAttribute("data-merk"),"blijft","maan: een ongewijzigde uitkomst raakt de DOM niet");
        /* Over middernacht heen (23:50 → 00:30): de tijden van vandaag volgen de nieuwe datum. */
        await sprong(page,40*MIN);
        const ochtend=await page.locator("#nz-maan-tijden").innerText();
        const verwacht=await page.evaluate(()=>{
          const K=window.WeatherNowNachtzichtKern,c=JSON.parse(document.getElementById("nz-config").textContent),r=c.referentie;
          const m=K.maanOverzicht(Date.now(),r.lat,r.lon,"Europe/Amsterdam");
          return [["op",m.op],["onder",m.onder]].filter(x=>x[1]).sort((a,b)=>a[1]<b[1]?-1:1).map(x=>x[0]+" "+x[1]).join(", ");
        });
        assert(ochtend.includes(verwacht),"maan: na middernacht kloppen de tijden met de nieuwe dag ("+ochtend+" vs "+verwacht+")");
        assert.notEqual(ochtend,avond,"maan: de tijden van vandaag zijn na middernacht veranderd");
        assert.deepEqual(fouten,[],"maan: scriptfouten");
      }finally{await context.close();}
    }
    console.log("Verversing maan: één timer, stabiele DOM en een datumwissel kloppen.");

    /* ===== vakantiepagina ===== */
    {
      const {context,page,fouten,ctl}=await open(browser,"/herfstvakantie/","2026-10-12T10:00:00Z");
      try{
        await page.waitForFunction(()=>!document.querySelector("#seizoen-verwachting[aria-busy]")&&document.querySelector(".seizoen-vakantie tbody tr"),null,{timeout:30000});
        await rust();
        const eerste=ctl.primair;
        assert(eerste>=1,"vakantie: eerste ophaalronde");
        const intervallen=await page.evaluate(()=>window.__intervallen);
        assert.equal(intervallen,1,"vakantie: precies één timer");
        await page.evaluate(()=>{document.querySelector("#seizoen-verwachting").firstElementChild.dataset.merk="blijft";});
        await sprong(page,UUR/2);
        assert.equal(ctl.primair,eerste,"vakantie: binnen een uur geen nieuwe aanvraag");
        /* Na een uur: één stille aanvraag; gelijke uitkomst laat de pagina staan. */
        await sprong(page,UUR);
        const tweede=ctl.primair;
        assert(tweede>eerste,"vakantie: na een uur een verversing");
        assert.equal(await page.locator("#seizoen-verwachting").evaluate(e=>e.firstElementChild.dataset.merk),"blijft","vakantie: ongewijzigde verwachting wordt niet opnieuw opgebouwd");
        assert.equal(await page.locator("#seizoen-verwachting .seizoen-opnieuw").count(),0);
        /* Nieuwe uitkomst: de tabel verandert. */
        ctl.maxTemp=19.6;
        const voor=await page.locator("#seizoen-verwachting .seizoen-vakantie td.temp").first().innerText();
        await sprong(page,UUR);
        assert(ctl.primair>tweede,"vakantie: volgende verversing");
        const na=await page.locator("#seizoen-verwachting .seizoen-vakantie td.temp").first().innerText();
        assert.notEqual(na,voor,"vakantie: een nieuwe uitkomst vervangt de verwachting ("+voor+" → "+na+")");
        /* Storing: het getoonde blijft, geen foutblok, geen laadmelding. */
        ctl.faalt=true;
        const stand=await page.locator("#seizoen-verwachting .seizoen-vakantie td.temp").first().innerText();
        const voorFout=ctl.primair;
        await sprong(page,UUR);
        assert(ctl.primair>voorFout,"vakantie: poging bij storing");
        assert.equal(await page.locator("#seizoen-verwachting .seizoen-vakantie td.temp").first().innerText(),stand,"vakantie: werkende gegevens blijven bij een storing staan");
        assert.equal(await page.locator("#seizoen-verwachting .seizoen-opnieuw").count(),0,"vakantie: een stille verversing toont geen foutblok");
        assert.equal(await page.locator("#seizoen-verwachting").getAttribute("aria-busy"),null,"vakantie: niet blijven laden");
        /* De gewone bron probeert bij een storing zelf nog één keer na twee seconden; daarna begint de wachttijd. */
        await sprong(page,MIN);
        const naFout=ctl.primair;
        for(let i=0;i<3;i++)await sprong(page,MIN);
        assert.equal(ctl.primair,naFout,"vakantie: binnen de wachttijd geen nieuwe aanvraag");
        assert.equal(await page.evaluate(()=>window.__intervallen),1,"vakantie: nog steeds precies één timer");
        assert.deepEqual(fouten,[],"vakantie: scriptfouten");
      }finally{await context.close();}
    }
    console.log("Verversing vakantiepagina: stille verversing na een uur, alleen vervangen bij verandering, behoud en wachttijd bij storing kloppen.");
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

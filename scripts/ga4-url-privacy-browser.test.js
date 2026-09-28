"use strict";

/* Google Analytics 4 na toestemming: gaan er plaatsnamen of coördinaten mee?

   De app zet bij een gekozen plaats ?lat=…&lon=…&plaats=… in de adresbalk
   (history.pushState/replaceState). posthog-analytics.js stuurt GA bij het
   laden alleen de route zonder querystring, maar GA4 kan met "uitgebreide
   metingen" zelf een paginaweergave sturen bij elke wijziging in de
   browsergeschiedenis, met de volledige URL. Of dat aan staat, is een
   instelling van de GA-gegevensstroom; die zit in het openbare gtag.js dat
   iedere bezoeker na toestemming laadt.

   Deze test laadt het echte gtag.js voor ons meet-ID en emuleert een gewone
   bezoeker op https://watishetweer.nl met toestemming (GA start alleen daar,
   niet in geautomatiseerde browsers). Het finale artifact wordt lokaal
   geserveerd. Elk verzoek naar Google Analytics wordt onderschept en
   afgebroken: er gaat niets naar het echte GA-account.

   Eis: geen enkele GA-hit bevat lat=, lon=, plaats= of de coördinaten, ook
   niet na een plaatswissel via de eigen laadfunctie van de app.
   Kan gtag.js niet geladen worden, dan faalt de test met een aparte melding
   (externe bron), zodat dat niet als productregressie wordt gelezen.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const HOST="https://watishetweer.nl";
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webmanifest":"application/manifest+json"};
function lokaalBestand(pathname){
  let p=decodeURIComponent(pathname);if(p.endsWith("/"))p+="index.html";
  let f=path.join(OUT,p);if(!fs.existsSync(f)&&fs.existsSync(f+".html"))f+=".html";
  return f.startsWith(OUT+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()?f:null;
}
function fixture(){
  const d=bouw({});d.latitude=52.37;d.longitude=4.9;d.daily.sunshine_duration=d.daily.time.map(()=>20000);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  return d;
}
const GA_HOST=/(^|\.)google-analytics\.com$|(^|\.)analytics\.google\.com$|(^|\.)doubleclick\.net$|^www\.google\.com$/;
/* In de URL die GA ontvangt (dl) of als verwijzer (dr): querystring met locatie of de coördinaten zelf. */
const VERBODEN=[/[?&]lat=/i,/[?&]lon=/i,/[?&]plaats=/i,/52\.0?9\d*/,/5\.12/,/52\.37/,/4\.90/];

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  let fout=null;
  try{
    const ua=(await (await browser.newPage()).evaluate(()=>navigator.userAgent)).replace(/HeadlessChrome/g,"Chrome");
    const context=await browser.newContext({viewport:{width:1366,height:900},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",userAgent:ua});
    await context.addInitScript(()=>{
      try{Object.defineProperty(navigator,"webdriver",{get:()=>false});}catch(e){}
      try{if(!sessionStorage.getItem("ga4-test-init")){sessionStorage.setItem("ga4-test-init","1");localStorage.setItem("weerbriefing.ga4.consent.v1","granted");}}catch(e){}
      /* sendBeacon vastleggen en niet versturen. */
      window.__gaHits=[];
      const origineel=navigator.sendBeacon&&navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon=function(url,data){
        try{const u=new URL(String(url),location.href);if(/google-analytics\.com$|analytics\.google\.com$/.test(u.hostname)){window.__gaHits.push({url:String(url),body:typeof data==="string"?data:""});return true;}}catch(e){}
        return origineel?origineel(url,data):false;
      };
    });
    const page=await context.newPage(),hits=[],paginafouten=[];let gtagGeladen=false;
    page.on("pageerror",e=>paginafouten.push(String(e)));
    await page.route("**/*",async r=>{
      const req=r.request(),u=new URL(req.url());
      if(u.origin===HOST){
        if(u.pathname.startsWith("/api/")){
          if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
          if(u.pathname==="/api/forecast")return r.fulfill({json:fixture()});
          return r.fulfill({json:{beschikbaar:false}});
        }
        const f=lokaalBestand(u.pathname);
        if(!f)return r.fulfill({status:404,body:""});
        return r.fulfill({status:200,headers:{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"},body:fs.readFileSync(f)});
      }
      if(u.hostname==="api.open-meteo.com")return r.fulfill({json:fixture()});
      if(u.hostname.endsWith("open-meteo.com"))return r.fulfill({json:{}});
      if(u.hostname==="www.googletagmanager.com"&&u.pathname==="/gtag/js"){
        const resp=await r.fetch().catch(()=>null);
        if(resp&&resp.ok()){gtagGeladen=true;return r.fulfill({response:resp});}
        return r.abort();
      }
      if(GA_HOST.test(u.hostname)||u.hostname==="www.googletagmanager.com"){
        hits.push({url:req.url(),body:req.postData()||""});
        return r.abort();
      }
      /* Overige externe bronnen (PostHog, Cloudflare) niet bereiken. */
      return r.fulfill({status:204,body:""});
    });
    await page.goto(HOST+"/?lat=52.370&lon=4.900&plaats=Amsterdam&land=NL",{waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>typeof S!=="undefined"&&S.d&&document.querySelectorAll("#days .row.day").length>=7,null,{timeout:20000});
    await page.waitForFunction(()=>!!window.google_tag_manager||!!(window.dataLayer&&window.dataLayer.some(x=>x&&x[0]==="config")),null,{timeout:20000}).catch(()=>{});
    if(!gtagGeladen){
      fout=new Error("EXTERN: gtag.js kon niet worden geladen vanaf www.googletagmanager.com; GA-privacy niet vast te stellen (geen productregressie).");
    }else{
      /* Eerste paginaweergave afwachten, dan een plaatswissel via de eigen laadfunctie
         van de app (dezelfde weg als een gekozen zoekresultaat). */
      await page.waitForFunction(()=>window.__gaHits.length>0,null,{timeout:10000}).catch(()=>{});
      const voor=hits.length+await page.evaluate(()=>window.__gaHits.length);
      await page.evaluate(()=>load(52.09,5.12,"Utrecht",false,true,"NL"));
      await page.waitForFunction(()=>/plaats=Utrecht/.test(location.search),null,{timeout:15000});
      /* Een eventuele geschiedenis-hit volgt direct; ruim afwachten om afwezigheid te bewijzen. */
      await page.waitForTimeout(4000);
      const alle=hits.concat(await page.evaluate(()=>window.__gaHits));
      const regels=alle.flatMap(h=>{const u=new URL(h.url);const basis=Object.fromEntries(u.searchParams);return (h.body?h.body.split("\n").filter(Boolean):[""]).map(b=>({...basis,...Object.fromEntries(new URLSearchParams(b))}));});
      const pageviews=regels.filter(x=>x.en==="page_view");
      const lek=regels.filter(x=>VERBODEN.some(re=>re.test(String(x.dl||""))||re.test(String(x.dr||""))));
      console.log("GA4-HITS: "+alle.length+" verzoeken, "+regels.length+" events ("+(alle.length-voor)+" na de plaatswissel), page_view: "+pageviews.map(x=>String(x.dl||"")).join(" | "));
      assert(regels.length>0,"geen GA-hit gezien terwijl toestemming is gegeven; de test meet niets");
      assert.deepEqual(lek.map(x=>(x.en||"?")+" dl="+(x.dl||"")),[],"GA4 ontvangt locatiegegevens in de URL");
    }
    assert.deepEqual(paginafouten,[],"runtimefouten: "+paginafouten.join(" | "));
    await context.close();
  }finally{await browser.close();}
  if(fout)throw fout;
  console.log("GA4 URL-privacy OK: geen lat, lon of plaats in wat Google Analytics na toestemming ontvangt, ook niet na een plaatswissel.");
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

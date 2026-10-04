"use strict";

/* Privacykeuzes in een ander tabblad gelden direct (hercontrole 4 oktober):
   - R01: wie in tabblad B afmeldt (PostHog en Google Analytics uit), stopt ook
     een al geopend tabblad A: geen nieuwe PostHog-meldingen, Google Analytics
     uitgeschakeld (ga-disable-vlag, consent denied);
   - R01: wie in tabblad B Google Analytics weigert, stopt GA in tabblad A;
   - R02: de toestemmingsbanner is in het Engels volledig Engels.
   Bezoeker op https://watishetweer.nl (analytics start alleen daar); het finale
   artifact wordt lokaal geserveerd. Niets bereikt PostHog of Google: alle
   verzoeken worden onderschept. Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const HOST="https://watishetweer.nl";
const GA4_ID="G-H498VPZ9Z1";
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

async function context(browser,{ga4,taal}={}){
  const ua=(await (await browser.newPage()).evaluate(()=>navigator.userAgent)).replace(/HeadlessChrome/g,"Chrome");
  const ctx=await browser.newContext({viewport:{width:1366,height:900},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",userAgent:ua});
  await ctx.addInitScript(({ga4,taal})=>{
    try{Object.defineProperty(navigator,"webdriver",{get:()=>false});}catch(e){}
    try{if(!localStorage.getItem("test-init")){localStorage.setItem("test-init","1");if(ga4)localStorage.setItem("weerbriefing.ga4.consent.v1",ga4);if(taal)localStorage.setItem("weerbriefing.taal.v1",JSON.stringify(taal));}}catch(e){}
  },{ga4,taal});
  const posthog=[];
  await ctx.route("**/*",async r=>{
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
    if(u.hostname==="eu.i.posthog.com"){
      let event="?";try{event=JSON.parse(req.postData()||"{}").event;}catch(e){}
      posthog.push({event,page:req.frame()&&req.frame().page()});
      return r.fulfill({status:200,body:"{}"});
    }
    /* Google: gtag.js niet echt laden (een lege tag volstaat voor de dataLayer). */
    if(u.hostname==="www.googletagmanager.com")return r.fulfill({status:200,headers:{"content-type":"application/javascript"},body:""});
    return r.fulfill({status:204,body:""});
  });
  return {ctx,posthog};
}
async function open(ctx){
  const page=await ctx.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.goto(HOST+"/?lat=52.370&lon=4.900&plaats=Amsterdam&land=NL",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof S!=="undefined"&&S.d&&document.querySelectorAll("#days .row.day").length>=7,null,{timeout:20000});
  return {page,fouten};
}
const ga4Uit=page=>page.evaluate(id=>({vlag:window["ga-disable-"+id]===true,
  denied:(window.dataLayer||[]).some(x=>x&&x[0]==="consent"&&x[1]==="update"&&x[2]&&x[2].analytics_storage==="denied")}),GA4_ID);

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    /* R01a: afmelden in tabblad B stopt tabblad A. */
    {
      const {ctx,posthog}=await context(browser,{ga4:"granted"});
      const A=await open(ctx);
      await A.page.waitForFunction(()=>window.__weatherNowGa4Started===true,null,{timeout:10000});
      assert(posthog.some(x=>x.event==="$pageview"),"PostHog meet vóór afmelden (de test meet iets)");
      const B=await open(ctx);
      await B.page.evaluate(()=>localStorage.setItem("weerbriefing.analytics.uit.v1","1"));
      await A.page.waitForTimeout(300);
      const voor=posthog.length;
      await A.page.fill("#q","Utr");
      await A.page.click("#ververs").catch(()=>{});
      await A.page.waitForTimeout(1500);
      const na=posthog.slice(voor).map(x=>x.event);
      assert.deepEqual(na,[],"na afmelden in een ander tabblad nog PostHog-meldingen: "+na.join(", "));
      const ga=await ga4Uit(A.page);
      assert(ga.vlag&&ga.denied,"Google Analytics in het al geopende tabblad niet uitgeschakeld: "+JSON.stringify(ga));
      assert.deepEqual(A.fouten.concat(B.fouten),[],"paginafouten");
      await ctx.close();
    }
    /* R01b: Google Analytics weigeren in tabblad B stopt GA in tabblad A. */
    {
      const {ctx}=await context(browser,{ga4:"granted"});
      const A=await open(ctx);
      await A.page.waitForFunction(()=>window.__weatherNowGa4Started===true,null,{timeout:10000});
      const B=await open(ctx);
      await B.page.evaluate(()=>window.WeatherNowGA4Consent.deny());
      await A.page.waitForTimeout(500);
      const ga=await ga4Uit(A.page);
      assert(ga.vlag&&ga.denied,"GA weigeren in een ander tabblad stopt GA hier niet: "+JSON.stringify(ga));
      await ctx.close();
    }
    /* R02: banner in het Engels volledig Engels; keuze in B haalt de banner in A weg. */
    {
      const {ctx}=await context(browser,{taal:"en"});
      const A=await open(ctx);
      await A.page.waitForSelector("#analytics-toestemming",{timeout:10000});
      await A.page.waitForTimeout(600);
      const tekst=await A.page.$eval("#analytics-toestemming",el=>el.textContent.replace(/\s+/g," ").trim());
      assert.equal(tekst,"Visitor statistics — May Google Analytics measure how this site is used? The Google tag loads only after you give consent. Privacy.DeclineAllow","banner niet volledig Engels: "+tekst);
      assert(!/Bezoekstatistieken|Weigeren|Toestaan|toestemming/.test(tekst),"Nederlandse resten in de banner");
      const B=await open(ctx);
      await B.page.evaluate(()=>window.WeatherNowGA4Consent.deny());
      await A.page.waitForTimeout(500);
      assert.equal(await A.page.$("#analytics-toestemming"),null,"keuze in een ander tabblad haalt de banner hier weg");
      await ctx.close();
    }
  }finally{await browser.close();}
  console.log("Analytics in meerdere tabbladen: afmelden en GA weigeren stoppen een al geopend tabblad direct; banner volledig Engels en verdwijnt na een keuze elders.");
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

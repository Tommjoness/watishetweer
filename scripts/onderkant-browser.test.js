"use strict";

/* Onderkant van de pagina op het finale artifact, met de echte runtime.
   - Bronnen: één links uitgelijnde regel met alleen de gebruikte bronnen.
     Visual Crossing en WeatherAPI.com verschijnen alleen als de getoonde
     verwachting van die bron komt.
   - Voet: disclaimer, links en contact links uitgelijnd, onderstreept direct
     onder de tekst; tapdoelen 44px op touch en 24px met muis.
   - SEO-blok en populaire plaatsen beginnen op dezelfde lijn als de inhoud
     van het vel, op iedere breedte.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fixture(){
  const d=bouw({som:0});
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

/* bron "openmeteo": gewone load. bron "visualcrossing": Open-Meteo faalt, de
   same-origin providerroute levert de verwachting zoals de server dat doet. */
async function open(browser,root,w,h,bron,colorScheme){
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700,colorScheme:colorScheme||"light"});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T15:39:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com")return bron==="visualcrossing"?r.fulfill({status:503,json:{error:true}}):r.fulfill({json:fixture()});
    if(u.pathname==="/api/forecast")return r.fulfill({json:{...fixture(),provider:bron==="visualcrossing"?"visualcrossing":"weatherapi"},headers:{"X-WIW-Weather-Source":bron==="visualcrossing"?"visualcrossing":"weatherapi"}});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T17:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:15000});
  await page.waitForFunction(()=>document.querySelectorAll("#days .row.day:not(.kop)").length===7,null,{timeout:15000});
  await sleep(1700);
  return {context,page,fouten};
}

function meet(){
  const zichtbaar=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=="hidden";
  const rect=e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top+scrollY,b:r.bottom+scrollY,w:r.width,h:r.height};};
  const tekstLinks=e=>{if(!e)return null;const rg=document.createRange();rg.selectNodeContents(e);const r=[...rg.getClientRects()].filter(x=>x.width>0);return r.length?Math.min(...r.map(x=>x.left)):null;};
  const app=document.getElementById("app"),footer=document.querySelector("footer"),bron=footer.querySelector(".bron-bronnen");
  const bronLinks=[...bron.querySelectorAll(".bronitem a")].filter(zichtbaar);
  const disclaimer=[...footer.querySelectorAll(":scope>span.bron")].find(e=>/Weersinformatie is algemeen/.test(e.textContent||""));
  const doelen=[footer.querySelector('a[href="/over/"]'),footer.querySelector('a[href="/privacy"]'),footer.querySelector("details.footer-details>summary"),footer.querySelector(".footer-contact a"),...bronLinks].filter(zichtbaar);
  const seo=document.querySelector(".seo-route-context"),nav=document.querySelector(".seo-plaatsnav");
  const navLinks=nav?[...nav.querySelectorAll(".seo-plaatsnav-links a")].filter(zichtbaar):[];
  return {
    appLinks:app.getBoundingClientRect().left,
    footer:rect(footer),
    bronnen:bronLinks.map(a=>({t:(a.textContent||"").trim(),l:a.getBoundingClientRect().left,top:Math.round(a.getBoundingClientRect().top),h:a.getBoundingClientRect().height})),
    bronDisplay:getComputedStyle(bron).display,
    labelLinks:tekstLinks(bron.querySelector(".bronlabel")),
    disclaimer:disclaimer?{l:tekstLinks(disclaimer),align:getComputedStyle(disclaimer).textAlign}:null,
    doelen:doelen.map(e=>{const s=getComputedStyle(e);return {t:(e.textContent||"").trim().slice(0,28),h:e.getBoundingClientRect().height,l:e.getBoundingClientRect().left,deco:s.textDecorationLine,rand:s.borderBottomWidth,schaduw:s.boxShadow};}),
    seo:seo?{kruimel:tekstLinks(seo.querySelector(".seo-breadcrumb")),kop:tekstLinks(seo.querySelector("h2")),kopGrootte:parseFloat(getComputedStyle(seo.querySelector("h2")).fontSize),tekst:tekstLinks(seo.querySelector("p")),buurt:tekstLinks(seo.querySelector(".seo-route-nearby-kop"))}:null,
    plaatsen:nav?{kop:tekstLinks(nav.querySelector(".seo-plaatsnav-kop")),eerste:navLinks[0]?tekstLinks(navLinks[0]):null,aantal:navLinks.length,hoogte:Math.min(...navLinks.map(a=>a.getBoundingClientRect().height)),hoogteBlok:nav.getBoundingClientRect().height}:null,
    overflow:document.documentElement.scrollWidth-innerWidth
  };
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h] of [[390,844],[768,1024],[1100,800],[1440,900],[1920,1080]]){
      const {context,page,fouten}=await open(browser,root,w,h,"openmeteo");
      const label=w+"px";
      try{
        const m=await page.evaluate(meet);
        const touch=w<=900,minDoel=touch?43.5:23.5;
        assert(m.overflow<=1,label+": horizontale overflow "+m.overflow+"px");
        /* Bronnen: doorlopende regel, alleen wat gebruikt is. */
        assert.equal(m.bronDisplay,"flex",label+": bronnen staan niet als doorlopende regel");
        const namen=m.bronnen.map(b=>b.t);
        assert(namen.includes("Open-Meteo")&&namen.includes("CAMS"),label+": kernbronnen ontbreken: "+JSON.stringify(namen));
        assert(!namen.some(n=>/Visual Crossing|WeatherAPI/.test(n)),label+": Visual Crossing of WeatherAPI.com staat vermeld bij Open-Meteo-data: "+JSON.stringify(namen));
        assert(Math.abs(m.labelLinks-m.appLinks)<=1.5,label+": bronlabel begint niet op de lijn van de pagina ("+m.labelLinks+" tegen "+m.appLinks+")");
        /* Touch: label op een eigen regel, bronnen eronder vanaf de paginalijn.
           Muis: bronnen direct achter het label op dezelfde regel. */
        if(touch)assert(Math.abs(Math.min(...m.bronnen.map(b=>b.l))-m.appLinks)<=1.5,label+": eerste bron begint niet op de lijn van de pagina: "+JSON.stringify(m.bronnen));
        else assert(m.bronnen[0].l>m.labelLinks&&m.bronnen[0].l-m.labelLinks<260,label+": bronnen staan niet direct achter het label: "+JSON.stringify(m.bronnen));
        assert(new Set(m.bronnen.map(b=>b.top)).size<=(touch?2:1),label+": bronnen beslaan te veel regels: "+JSON.stringify(m.bronnen));
        /* Voet: links uitgelijnd, onderstreept, tapdoelen. */
        assert(m.disclaimer&&Math.abs(m.disclaimer.l-m.appLinks)<=1.5&&m.disclaimer.align!=="center",label+": disclaimer staat niet links in de kolom: "+JSON.stringify(m.disclaimer));
        assert(m.doelen.length>=6,label+": te weinig voetlinks gevonden: "+JSON.stringify(m.doelen));
        for(const d of m.doelen){
          assert(d.h>=minDoel,label+": voetlink '"+d.t+"' is lager dan "+Math.ceil(minDoel)+"px ("+d.h+")");
          assert(/underline/.test(d.deco)&&d.rand==="0px"&&d.schaduw==="none",label+": voetlink '"+d.t+"' heeft geen onderstreping direct onder de tekst: "+JSON.stringify(d));
        }
        assert(Math.abs(Math.min(...m.doelen.map(d=>d.l))-m.appLinks)<=1.5,label+": voetlinks beginnen niet op de lijn van de pagina");
        /* SEO-blok en plaatsen op de lijn van de pagina. */
        for(const [n,x] of Object.entries({kruimelpad:m.seo.kruimel,kop:m.seo.kop,tekst:m.seo.tekst,buurt:m.seo.buurt,plaatsenkop:m.plaatsen.kop}))
          assert(x!==null&&Math.abs(x-m.appLinks)<=1.5,label+": SEO-"+n+" begint op "+x+"px in plaats van op de lijn van de pagina ("+m.appLinks+"px)");
        assert(m.seo.kopGrootte<=12,label+": SEO-kop herhaalt de h1 als grote kop ("+m.seo.kopGrootte+"px)");
        assert(m.plaatsen.hoogte>=minDoel,label+": plaatslink lager dan "+Math.ceil(minDoel)+"px");
        if(touch){
          assert(Math.abs(m.plaatsen.eerste-m.appLinks)<=1.5,label+": eerste populaire plaats begint niet op de lijn van de pagina");
          assert.equal(m.plaatsen.aantal,7,label+": verwacht zes plaatsen plus Meer plaatsen op touchbreedte");
        }
        if(w===390){
          assert(m.footer.h<=330,label+": voet is "+Math.round(m.footer.h)+"px hoog, verwacht hooguit 330px");
          assert(m.plaatsen.hoogteBlok<=150,label+": populaire plaatsen beslaan "+Math.round(m.plaatsen.hoogteBlok)+"px");
        }
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("ONDERKANT "+label+": voet "+Math.round(m.footer.h)+"px, bronnen "+namen.join(", ")+"; alles op x="+Math.round(m.appLinks)+".");
      }finally{await context.close();}
    }
    /* Visual Crossing levert: dan hoort de verplichte vermelding zichtbaar te zijn, WeatherAPI.com niet. */
    for(const [w,h] of [[390,844],[1440,900]]){
      const {context,page,fouten}=await open(browser,root,w,h,"visualcrossing");
      try{
        await page.waitForFunction(()=>S&&S.d&&S.d.provider==="visualcrossing",null,{timeout:15000});
        await sleep(600);
        const namen=await page.evaluate(()=>[...document.querySelectorAll("footer .bron-bronnen .bronitem a")].filter(a=>a.getClientRects().length).map(a=>(a.textContent||"").trim()));
        assert(namen.includes("Weather Data Provided by Visual Crossing"),w+"px: Visual Crossing-vermelding ontbreekt terwijl Visual Crossing de data levert: "+JSON.stringify(namen));
        assert(!namen.includes("WeatherAPI.com"),w+"px: WeatherAPI.com staat vermeld terwijl Visual Crossing de data levert");
        assert.deepEqual(fouten,[],w+"px: runtimefouten "+fouten.join(" | "));
        console.log("ONDERKANT "+w+"px via Visual Crossing: "+namen.join(", ")+".");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Onderkant OK op 390, 768, 1100, 1440 en 1920px, en met Visual Crossing als bron.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

"use strict";

/* Webfontwissel zonder layoutverschuiving.
   Op een trage koude load toont de browser eerst een systeemfont en wisselt
   pas later naar Instrument Sans en Bodoni Moda (font-display:swap). Zonder
   reservefonts op maat breekt de tekst na de wissel anders af: op productie
   schoof /weer/utrecht/ op 390px daardoor ~24px (CLS 0,10). Deze test houdt
   de webfonts bewust 2,5 s tegen en eist dat de wissel vrijwel niets
   verschuift, op mobiel en desktop. Kleine verschillen in regelafbreking
   blijven mogelijk; het budget laat die toe, een hele regel extra niet.

   Draait op het finale artifact: npm run build:cloudflare, daarna
   node scripts/font-swap-cls-browser.test.js */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const FONT_VERTRAGING_MS=2500;
const CLS_BUDGET=0.01;
const routes=["/weer/utrecht/","/"];
const breedtes=[390,1366];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* Bron en artifact: elke reserve heeft size-adjust en verticale overrides en
   staat direct na het webfont in de stapel. */
const reserves=["Instrument Sans Fallback","Bodoni Moda Fallback Georgia","Bodoni Moda Fallback","Bodoni Moda Fallback Noto","DM Mono Fallback"];
for(const bestand of [path.join(ROOT,"index.html"),path.join(OUT,"index.html"),path.join(OUT,"weer","utrecht","index.html")]){
  const html=fs.readFileSync(bestand,"utf8"),naam=path.relative(ROOT,bestand);
  for(const familie of reserves){
    const regel=html.match(new RegExp(`@font-face\\{font-family:'${familie}';src:local\\([^}]*\\}`));
    assert(regel,`${naam}: reservefont ${familie} ontbreekt`);
    for(const descriptor of ["size-adjust","ascent-override","descent-override","line-gap-override"])
      assert(regel[0].includes(descriptor+":"),`${naam}: ${familie} mist ${descriptor}`);
    assert(!/url\(/.test(regel[0]),`${naam}: ${familie} mag alleen lokale systeemfonts gebruiken`);
  }
  assert(html.includes("--sans:'Instrument Sans','Instrument Sans Fallback',"),`${naam}: --sans zet de reserve niet direct na Instrument Sans`);
  assert(html.includes("--serif:'Bodoni Moda','Bodoni Moda Fallback Georgia','Bodoni Moda Fallback','Bodoni Moda Fallback Noto',"),`${naam}: --serif zet de reserves niet direct na Bodoni Moda`);
  assert(html.includes("--mono:'DM Mono','DM Mono Fallback',"),`${naam}: --mono zet de reserve niet direct na DM Mono`);
}

function fixture(url){
  const u=new URL(url),d=bouw({som:0,pp:()=>0,pr:()=>0});
  d.latitude=Number(u.searchParams.get("latitude")||52.35);
  d.longitude=Number(u.searchParams.get("longitude")||5.26);
  d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){
    const i=h.time.length,vorige=h.time[i-1];
    for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);
    h.time.push(new Date(Date.parse(vorige+"Z")+3600000).toISOString().slice(0,16));
  }
  return d;
}

const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;
  if(p.endsWith("/"))p+="index.html";
  const file=path.join(OUT,p);
  if(!file.startsWith(OUT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end("not found");return;}
  const stuur=()=>{res.writeHead(200,{"content-type":types[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(file).pipe(res);};
  if(file.endsWith(".woff2"))setTimeout(stuur,FONT_VERTRAGING_MS);else stuur();
});

function cls(entries){
  let max=0,som=0,start=-Infinity,vorig=-Infinity;
  for(const e of entries.filter(e=>!e.hadRecentInput).sort((a,b)=>a.startTime-b.startTime)){
    if(e.startTime-vorig>1000||e.startTime-start>5000){start=e.startTime;som=0;}
    som+=e.value;vorig=e.startTime;max=Math.max(max,som);
  }
  return max;
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  /* Zonder hinting rekent Chromium met fractionele letterbreedtes, zoals
     iOS, Android, macOS en Windows. Linux-hinting in headless Chromium rondt
     elke letter af op hele pixels; dan is Instrument Sans op 13px ~3% breder
     dan elk systeemfont en zegt de meting niets over echte bezoekers. */
  const browser=await chromium.launch({headless:true,args:["--font-render-hinting=none"],...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const breedte of breedtes)for(const route of routes){
      const context=await browser.newContext({viewport:{width:breedte,height:breedte<500?844:1000},locale:"nl-NL",serviceWorkers:"block"});
      const page=await context.newPage(),fouten=[];
      page.on("pageerror",e=>fouten.push(String(e)));
      await page.addInitScript(()=>{
        const NativeDate=Date,start=NativeDate.now(),epoch=NativeDate.parse("2026-07-22T12:00:00Z");
        class FixtureDate extends NativeDate{constructor(...a){super(...(a.length?a:[epoch+NativeDate.now()-start]));}static now(){return epoch+NativeDate.now()-start;}}
        window.Date=FixtureDate;
        window.__shifts=[];
        new PerformanceObserver(l=>{for(const e of l.getEntries())window.__shifts.push({value:e.value,startTime:e.startTime,hadRecentInput:e.hadRecentInput,bronnen:e.sources.map(s=>{const n=s.node;return n&&n.nodeType===1?(n.id?"#"+n.id:n.className||n.tagName):"#text:"+String(n&&n.textContent||"").trim().slice(0,30);})});}).observe({type:"layout-shift",buffered:true});
      });
      await page.route("**/*",async r=>{
        const u=new URL(r.request().url());
        if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast"){await sleep(300);return r.fulfill({json:fixture(u.href)});}
        if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T14:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
        if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
        if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
        if(u.pathname==="/api/luchtkwaliteit")return r.fulfill({json:{beschikbaar:false,provider:"luchtmeetnet",reden:"test"}});
        if(u.pathname==="/api/plaatsnaam")return r.fulfill({json:{beschikbaar:false}});
        if(u.origin!==root)return r.fulfill({json:{}});
        return r.continue();
      });
      try{
        await page.goto(root+route+(route==="/"?"?lat=52.09&lon=5.12&plaats=Utrecht&land=NL":""),{waitUntil:"domcontentloaded"});
        await page.waitForSelector("#app",{state:"visible",timeout:10000});
        /* Controle dat de meting echt over een wissel gaat: de brief staat er
           al terwijl het webfont nog onderweg is. */
        const voorWissel=await page.evaluate(()=>({
          brief:(document.getElementById("brief")?.textContent||"").trim().length,
          webfont:[...document.fonts].some(f=>f.family.replace(/["']/g,"")==="Instrument Sans"&&f.status==="loaded")
        }));
        await page.waitForFunction(()=>[...document.fonts].some(f=>f.family.replace(/["']/g,"")==="Instrument Sans"&&f.status==="loaded"),null,{timeout:15000});
        await page.waitForTimeout(1200);
        const meting=await page.evaluate(()=>({
          shifts:window.__shifts,
          reserve:[...document.fonts].filter(f=>/Fallback/.test(f.family)&&f.status==="loaded").map(f=>f.family.replace(/["']/g,""))
        }));
        const label=`${route} op ${breedte}px`;
        assert(voorWissel.brief>40&&!voorWissel.webfont,`${label}: de brief moet al zichtbaar zijn vóór het webfont binnen is (brief ${voorWissel.brief} tekens, webfont ${voorWissel.webfont})`);
        assert(meting.reserve.includes("Instrument Sans Fallback"),`${label}: Instrument Sans Fallback vond geen lokaal systeemfont (${JSON.stringify(meting.reserve)})`);
        assert(meting.reserve.some(f=>f.startsWith("Bodoni Moda Fallback")),`${label}: geen Bodoni-reserve geladen (${JSON.stringify(meting.reserve)})`);
        assert(meting.reserve.includes("DM Mono Fallback"),`${label}: DM Mono Fallback vond geen lokaal systeemfont (${JSON.stringify(meting.reserve)})`);
        const waarde=cls(meting.shifts);
        const grootste=meting.shifts.slice().sort((a,b)=>b.value-a.value).slice(0,3).map(s=>({waarde:+s.value.toFixed(4),tijd:Math.round(s.startTime),bronnen:s.bronnen}));
        assert(waarde<CLS_BUDGET,`${label}: fontwissel verschuift de layout, CLS ${waarde.toFixed(4)} (budget < ${CLS_BUDGET}); ${JSON.stringify(grootste)}`);
        assert.deepEqual(fouten,[],`${label}: runtimefouten ${fouten.join(" | ")}`);
        console.log(`FONTWISSEL ${label}: CLS ${waarde.toFixed(4)} met webfonts ${FONT_VERTRAGING_MS} ms vertraagd; reserves ${meting.reserve.join(", ")}`);
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log(`Fontwissel OK: ${routes.length*breedtes.length} koude loads met trage webfonts, CLS telkens < ${CLS_BUDGET}.`);
})().catch(e=>{console.error(e);server.close();process.exit(1);});

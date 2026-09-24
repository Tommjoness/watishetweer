"use strict";

/* Eerste scherm op het finale artifact, met de echte runtime.
   Mobiel: bediening in één rij, temperatuur hoger in beeld, thema-keuze onder
   de footer. Desktop: grafiek begint boven de vouw, plaatsnaam op de lijn van
   de h1, tegelkoppen blijven binnen hun tegel.

   Draait na: npm run build:cloudflare */

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

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h] of [[390,844],[768,1024],[1100,800],[1366,768],[1440,900]]){
      const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700});
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
      const label=`${w}px`;
      try{
        await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
        await page.waitForSelector("#app",{state:"visible",timeout:10000});
        await page.waitForFunction(()=>!document.getElementById("here")?.disabled,null,{timeout:10000});
        await sleep(800);
        const m=await page.evaluate(()=>{
          const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {top:b.top+scrollY,bottom:b.bottom+scrollY,left:b.left,right:b.right,width:b.width,height:b.height};};
          const thema=document.getElementById("thema"),voet=thema&&thema.closest(".wiw-weergave-voet");
          const tegels=[...document.querySelectorAll(".stats .stat")].filter(e=>e.getClientRects().length).map(t=>{const tb=t.getBoundingClientRect(),k=t.querySelector(".eyebrow");const kb=k?k.getBoundingClientRect():tb;return {tekst:(k?.textContent||"").trim(),over:Math.max(0,tb.left-kb.left,kb.right-tb.right,k?k.scrollWidth-k.clientWidth:0)};});
          const titel=document.getElementById("wiw-hour-title");
          return {
            q:r("#q"),here:r("#here"),ververs:r("#ververs"),hero:r(".hero"),chartkop:r(".dashrow-chart .chartkop")||r(".chartkop"),
            h1:r(".mast h1"),place:r("#place"),placeTekst:r("#place")&&(()=>{const range=document.createRange();const n=document.getElementById("place").firstChild;if(!n)return null;range.selectNodeContents(document.getElementById("place"));return range.getClientRects()[0]?.left??null;})(),
            themaInTools:!!(thema&&thema.closest(".tools")),themaInVoet:!!voet,voetNaFooter:!!(voet&&voet.previousElementSibling&&voet.previousElementSibling.id==="app"&&voet.previousElementSibling.lastElementChild?.tagName==="FOOTER"),
            hereNaam:document.getElementById("here")?.getAttribute("aria-label")||"",verversNaam:(document.getElementById("ververs")?.textContent||"").trim(),
            tegels,titelTekst:titel?.textContent||"",titelBreed:titel?titel.getBoundingClientRect().width:0,
            overflow:document.documentElement.scrollWidth-innerWidth
          };
        });
        assert(!m.themaInTools&&m.themaInVoet&&m.voetNaFooter,`${label}: thema-keuze staat niet in de Weergave-regel direct onder de footer`);
        assert(m.overflow<=1,`${label}: horizontale overflow ${m.overflow}px`);
        assert.equal(m.hereNaam,"Mijn locatie",`${label}: locatieknop verliest zijn toegankelijke naam`);
        assert.equal(m.verversNaam,"Ververs",`${label}: verversknop verliest zijn toegankelijke naam`);
        for(const t of m.tegels)assert(t.over<=1,`${label}: tegelkop '${t.tekst}' steekt ${t.over.toFixed(1)}px buiten de tegel`);
        if(w<=900){
          assert(Math.abs(m.q.top-m.here.top)<=1&&Math.abs(m.q.top-m.ververs.top)<=1,`${label}: zoeken, locatie en verversen staan niet op één rij`);
          for(const [n,k] of [["locatie",m.here],["verversen",m.ververs]])assert(k.width>=44&&k.height>=44,`${label}: ${n}knop is geen 44px-tapdoel (${k.width}x${k.height})`);
          if(w<=430)assert(m.hero.top<=560,`${label}: temperatuur begint pas op ${Math.round(m.hero.top)}px`);
        }else{
          assert(m.chartkop.top<=h-100,`${label}: grafiek begint pas op ${Math.round(m.chartkop.top)}px (vouw ${h}px)`);
          if(w>=1100){
            assert(Math.abs(m.placeTekst-m.h1.left)<=3,`${label}: plaatsnaam (${m.placeTekst}) staat niet op de lijn van de h1 (${m.h1.left})`);
            assert(m.titelTekst==="Komende uren"&&m.titelBreed<=1,`${label}: uurtabel toont de sectiekop Komende uren nog een tweede keer`);
          }
        }
        assert.deepEqual(fouten,[],`${label}: runtimefouten ${fouten.join(" | ")}`);
        console.log(`EERSTE SCHERM ${label}: ${w<=900?"temperatuur op "+Math.round(m.hero.top)+"px":"grafiekkop op "+Math.round(m.chartkop.top)+"px"}; thema-keuze onder de footer.`);
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Eerste scherm OK op 390, 768, 1100, 1366 en 1440px.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

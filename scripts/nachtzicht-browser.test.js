"use strict";

/* Nachtzicht op mobiel, op het finale artifact met de echte runtime.
   - Iedere nacht beslaat twee regels; scores staan onder elkaar.
   - De uitklapper is een tapdoel van 44px met de naam "Zicht en maan"; openen
     laat de pijl staan en toont de details onder de tekst.
   - Telefoon en tablet tonen alleen vannacht; de andere nachten blijven
     verborgen tot "Meer nachten bekijken".

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

async function open(browser,root,w,h,colorScheme){colorScheme=colorScheme||"light";
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700,colorScheme});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  /* 21:30 lokaal: na zonsondergang. Auto hoort toch het systeem te volgen. */
  await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T19:30:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture()});
    if(u.hostname==="geocoding-api.open-meteo.com")return r.fulfill({json:{results:[{name:"Amsterdam",latitude:52.37,longitude:4.89,country_code:"NL",admin1:"Noord-Holland",country:"Nederland"},{name:"Amstelveen",latitude:52.3,longitude:4.86,country_code:"NL",admin1:"Noord-Holland",country:"Nederland"}]}});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T21:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:10000});
  await page.waitForFunction(()=>!document.getElementById("q")?.disabled,null,{timeout:10000});
  await sleep(700);
  return {context,page,fouten};
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const meet=()=>{
    const rijen=[...document.querySelectorAll("#nights .row.night:not(.kop)")].filter(r=>!r.hidden&&r.getClientRects().length);
    return rijen.map(r=>{
      const b=r.getBoundingClientRect(),s=r.querySelector(".score").getBoundingClientRect(),sum=r.querySelector("details.nacht-meta-details>summary"),sb=sum.getBoundingClientRect(),v=r.querySelector(".nachtvenster").getBoundingClientRect(),o=r.querySelector(".nachtadvies").getBoundingClientRect(),m=r.querySelector(".nachtmaan");
      return {h:b.height,top:b.top,bottom:b.bottom,scoreL:s.left,scoreT:s.top,sum:{w:sb.width,h:sb.height,l:sb.left,t:sb.top,naam:(sum.textContent||"").trim()},venster:{l:v.left,r:v.right,t:v.top,b:v.bottom},oordeel:{r:o.right,t:o.top},maan:m&&m.getClientRects().length?{t:m.getBoundingClientRect().top}:null,rechts:b.right};
    });
  };
  try{
    for(const [w,h] of [[320,700],[390,844],[768,1024]]){
      const {context,page,fouten}=await open(browser,root,w,h);
      const label=w+"px";
      try{
        await page.evaluate(()=>document.querySelectorAll("#nights details").forEach(d=>d.open=false));
        await page.locator("#nights").scrollIntoViewIfNeeded();await sleep(200);
        const dicht=await page.evaluate(meet);
        assert.equal(dicht.length,1,label+": verwacht alleen vannacht vóór Meer nachten, kreeg "+dicht.length);
        for(const r of dicht){
          /* Twee regels: de nacht eindigt direct na oordeel/periode en de pijl;
             geen aparte regel meer voor "Zicht en maan". */
          assert(r.bottom<=Math.max(r.venster.b,r.sum.t+r.sum.h)+2,label+": nacht heeft onder de tweede regel nog een extra regel: "+JSON.stringify(r));
          assert(r.sum.t<=r.venster.t+2,label+": uitklapper staat niet op de regel van de periode: "+JSON.stringify(r));
          assert(r.sum.w>=43.5&&r.sum.h>=43.5&&/Zicht en maan/.test(r.sum.naam),label+": uitklapper is geen 44px-tapdoel met naam Zicht en maan: "+JSON.stringify(r.sum));
          assert(r.sum.l>=r.venster.r-0.5&&r.sum.l>=r.oordeel.r,label+": uitklapper overlapt oordeel of periode: "+JSON.stringify(r));
          assert(Math.abs(r.venster.t-r.oordeel.t)<=6,label+": oordeel en periode staan niet op één regel: "+JSON.stringify(r));
        }
        assert(Math.max(...dicht.map(r=>r.scoreL))-Math.min(...dicht.map(r=>r.scoreL))<=1,label+": scores staan niet onder elkaar: "+JSON.stringify(dicht.map(r=>r.scoreL)));
        /* Openen: pijl blijft staan, details onder de tekst. */
        const voor=dicht[0].sum;
        await page.locator("#nights .row.night:not(.kop) details.nacht-meta-details>summary").first().click();
        await sleep(250);
        const open1=(await page.evaluate(meet))[0];
        assert(Math.abs(open1.sum.t-voor.t)<=1&&Math.abs(open1.sum.l-voor.l)<=1,label+": uitklapper verspringt bij openen: "+JSON.stringify({voor,na:open1.sum}));
        assert(open1.maan&&open1.maan.t>=open1.venster.b-1,label+": details staan niet onder de tekst: "+JSON.stringify(open1));
        /* Meer nachten: extra nachten in dezelfde opbouw. */
        await page.locator("#nights .nacht-meer").click();await sleep(300);
        const alle=await page.evaluate(meet);
        assert(alle.length>1,label+": Meer nachten toont geen extra nachten");
        assert(Math.max(...alle.map(r=>r.scoreL))-Math.min(...alle.map(r=>r.scoreL))<=1,label+": scores staan niet onder elkaar: "+JSON.stringify(alle.map(r=>r.scoreL)));
        for(const r of alle.slice(1))assert(r.bottom<=Math.max(r.venster.b,r.sum.t+r.sum.h)+2,label+": extra nacht volgt de compacte opbouw niet: "+JSON.stringify(r));
        const over=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
        assert(over<=1,label+": horizontale overflow "+over+"px");
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("NACHTZICHT "+label+": "+dicht.map(r=>Math.round(r.h)).join("/")+"px per nacht, uitklapper 44px, "+alle.length+" nachten na Meer nachten.");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Nachtzicht OK op 320, 390 en 768px.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

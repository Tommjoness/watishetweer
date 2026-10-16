"use strict";

/* Iconenset stijl A (akkoord eigenaar 15 oktober), op het finale artifact met
   de echte runtime. De betekenis hangt nooit alleen van het icoon af:
   - Telefoon en tablet (≤900px): de weeromschrijving van iedere dag staat
     zichtbaar onder de dagnaam, in kleine grijze tekst van minstens 11px,
     hoogstens twee regels, zonder overlap met de neerslag rechts en zonder
     horizontale overloop. Ook de langste omschrijvingen passen.
   - Desktop: de omschrijving blijft in haar eigen kolom staan.
   - Uurtabel (desktop): het icoon krijgt de omschrijving als tooltip (title),
     gelijk aan het label, zodat schermlezers haar maar één keer horen.
   - Iconen zelf zijn voor schermlezers verborgen.
   - Engels: de omschrijving is vertaald.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* Zware codes met kansen in alle klassen: dit levert de langste
   omschrijvingen op ("Zeer grote kans op zwaar onweer met hagel …"). */
const CODES=[99,99,57,67,86,82,56],KANS=[5,95,15,8,92,25,3];
function fixture(){
  const d=bouw({pp:()=>0,pr:()=>0,som:0,cc:()=>80,wc:()=>CODES[0],wcNu:CODES[0]});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>7200);
  d.daily.weather_code=d.daily.time.map((_,k)=>CODES[k%7]);
  d.daily.precipitation_probability_max=d.daily.time.map((_,k)=>KANS[k%7]);
  d.daily.precipitation_sum=d.daily.time.map((_,k)=>KANS[k%7]>=50?3.2:0.3);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  for(let i=0;i<h.time.length;i++){const dag=d.daily.time.indexOf(h.time[i].slice(0,10));if(dag<0)continue;
    h.weather_code[i]=CODES[dag%7];const u=+h.time[i].slice(11,13);
    if(u>=17&&u<=20){h.precipitation_probability[i]=KANS[dag%7];h.precipitation[i]=KANS[dag%7]>=50?0.8:0.1;}}
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,w,h,taal,thema){
  const mob=w<760;
  const context=await browser.newContext({viewport:{width:w,height:h},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:mob,hasTouch:mob,colorScheme:thema||"light"});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T10:39:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture()});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T12:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/"+(taal==="en"?"?taal=en":""),{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:10000});
  await page.waitForFunction(()=>!document.getElementById("here")?.disabled,null,{timeout:10000});
  await page.waitForSelector("#days .row.day:not(.kop) .dcond",{timeout:10000});
  if(taal==="en")await page.waitForFunction(()=>document.documentElement.lang==="en-GB",null,{timeout:10000});
  await sleep(1000);
  return {context,page,fouten};
}

const meet=page=>page.evaluate(()=>{
  const rijen=[...document.querySelectorAll("#days .row.day:not(.kop)")].map(rij=>{
    const b=s=>{const e=s===":scope"?rij:rij.querySelector(s);if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top,b:r.bottom,h:r.height};};
    const c=rij.querySelector(".dcond"),cs=getComputedStyle(c),lh=parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.35;
    return {tekst:c.textContent.trim(),cond:b(".dcond"),naam:b(".dname"),regen:b(".drain"),rij:b(":scope"),
      letter:parseFloat(cs.fontSize),regels:c.getClientRects().length?Math.round(c.getBoundingClientRect().height/lh):0,
      afgekapt:c.scrollHeight>c.clientHeight+1,icoonVerborgen:rij.querySelector(".dico svg")?.getAttribute("aria-hidden")};});
  return {rijen,overflow:document.documentElement.scrollWidth-innerWidth};
});

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h,thema] of [[360,780,"light"],[360,780,"dark"],[390,844,"light"],[768,1024,"light"],[900,1000,"light"],[1366,768,"light"]]){
      const label=`${w}px ${thema}`;
      const {context,page,fouten}=await open(browser,root,w,h,"nl",thema);
      try{
        const m=await meet(page);
        assert.equal(m.rijen.length,7,`${label}: niet zeven dagen`);
        for(const [i,r] of m.rijen.entries()){
          const dag=`${label} dag ${i}`;
          assert(r.tekst&&r.tekst!=="Verwachting",`${dag}: geen omschrijving`);
          assert(r.cond,`${dag}: omschrijving "${r.tekst}" is niet zichtbaar`);
          assert(r.letter>=11,`${dag}: omschrijving kleiner dan 11px (${r.letter})`);
          assert.equal(r.icoonVerborgen,"true",`${dag}: icoon niet verborgen voor schermlezers`);
          if(w<=900){
            assert(r.regels>=1&&r.regels<=2,`${dag}: "${r.tekst}" beslaat ${r.regels} regels`);
            assert(!r.afgekapt,`${dag}: "${r.tekst}" wordt afgekapt`);
            assert(r.cond.t>=r.naam.b-1,`${dag}: omschrijving staat niet onder de dagnaam`);
            assert(Math.abs(r.cond.l-r.naam.l)<=1,`${dag}: omschrijving lijnt niet uit met de dagnaam`);
            assert(r.cond.r<=r.regen.l+1,`${dag}: omschrijving loopt onder de neerslag door`);
            assert(r.cond.b<=r.rij.b+1,`${dag}: omschrijving valt buiten de rij`);
          }
        }
        assert(m.overflow<=1,`${label}: horizontale overflow ${m.overflow}px`);
        if(w>=1100){
          const uur=await page.evaluate(()=>[...document.querySelectorAll("#wiw-hour-table td.wiw-hour-weather")].map(td=>({title:td.getAttribute("title"),aria:td.getAttribute("aria-label"),
            verborgen:td.querySelector(".wiw-hour-weather-icon")?.getAttribute("aria-hidden"),icoon:!!td.querySelector("svg.ico")})));
          assert(uur.length>0,`${label}: uurtabel heeft geen weercellen`);
          for(const u of uur.filter(x=>x.icoon)){
            assert(u.title&&u.title===u.aria,`${label}: tooltip "${u.title}" wijkt af van label "${u.aria}"`);
            assert.equal(u.verborgen,"true",`${label}: uuricoon niet verborgen voor schermlezers`);
          }
        }
        assert.deepEqual(fouten,[],`${label}: runtimefouten ${fouten.join(" | ")}`);
        const langste=m.rijen.reduce((a,b)=>b.tekst.length>a.tekst.length?b:a);
        console.log(`ICONEN OMSCHRIJVING ${label}: 7 dagen zichtbaar; langste "${langste.tekst}" in ${langste.regels} regel(s), ${langste.letter}px.`);
      }finally{await context.close();}
    }

    /* Engels: de omschrijving is vertaald. */
    {
      const {context,page,fouten}=await open(browser,root,390,844,"en");
      try{
        const m=await meet(page);
        const nl=m.rijen.filter(r=>/\b(kans|onweer|motregen|ijzel|regen|sneeuw|buien|mogelijk)\b/i.test(r.tekst));
        assert.deepEqual(nl.map(r=>r.tekst),[],"EN: omschrijving niet vertaald");
        assert(m.rijen.every(r=>r.cond),"EN: omschrijving niet zichtbaar");
        assert.deepEqual(fouten,[],`EN: runtimefouten ${fouten.join(" | ")}`);
        console.log(`ICONEN OMSCHRIJVING EN 390px: ${m.rijen.map(r=>r.tekst).join(" | ")}`);
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

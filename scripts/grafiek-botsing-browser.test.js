"use strict";

/* Botsingen in de grafiek, op het finale artifact met de echte runtime, in
   lastige maar echte weersituaties: strenge vorst (aswaarden met minteken),
   stortregen, regen onder een nachtelijk dal, "nu" op de piek of op het dal,
   een koufront, een steile daling aan de rand en late avond. Op 320, 390, 768,
   1024 en 1366px, vandaag en een gekozen dag.
   Gemeten op de schermvormen (getBoundingClientRect en de getekende lijn):
   - geen tekst op andere tekst, op de temperatuurlijn, op een stip, op een
     regenstaaf, op een weericoon of op de rode nu-lijn;
   - geen regenstaaf door de temperatuurlijn;
   - geen tekst of icoon buiten de grafiek (bijvoorbeeld een afgesneden
     minteken bij -16°).

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sin=(u,a,b,fase=9)=>+(a+b*Math.sin((u-fase)/24*Math.PI*2)).toFixed(1);

const SCENARIO={
  vorst:{klok:"2026-07-22T12:39:00Z",meting:"2026-07-22T14:30",temp:(u,d)=>sin(u,-9,5)-d,pp:u=>u>=16?80:10,pr:u=>u>=16?1.5:0,wc:u=>u>=16?73:3},
  stortregen:{klok:"2026-07-22T12:39:00Z",meting:"2026-07-22T14:30",temp:u=>sin(u,12,3,3),pp:()=>100,pr:u=>[18,32,45,12,27,8][u%6],wc:()=>65},
  nuPiek:{klok:"2026-07-22T13:05:00Z",meting:"2026-07-22T15:00",temp:u=>sin(u,18,6,9),pp:u=>u>=14&&u<=16?90:5,pr:u=>u>=14&&u<=16?4:0,wc:u=>u>=14&&u<=16?63:3},
  nuDal:{klok:"2026-07-22T02:20:00Z",meting:"2026-07-22T04:15",temp:u=>sin(u,14,6,10),pp:u=>u<=7?85:5,pr:u=>u<=7?3.5:0,wc:u=>u<=7?63:3},
  laat:{klok:"2026-07-22T21:50:00Z",meting:"2026-07-22T23:45",temp:u=>sin(u,15,5),pp:(u,d)=>d===1&&u<=3?70:5,pr:(u,d)=>d===1&&u<=3?2:0,wc:(u,d)=>d===1&&u<=3?61:3},
  randPiek:{klok:"2026-07-22T12:39:00Z",meting:"2026-07-22T14:30",temp:(u,d)=>d===0?(u<=14?25:25-(u-14)*1.1):d===1?(u<=14?14+u*0.05:14.7+(u-14)*1.2):sin(u,16,5)},
  sprong:{klok:"2026-07-22T12:39:00Z",meting:"2026-07-22T14:30",temp:(u,d)=>d===0?(u<17?27:15):d===1?(u<11?14:u<12?24:23):sin(u,16,5),
    pp:(u,d)=>(d===0&&u>=17&&u<=18)||(d===1&&u===11)?95:5,pr:(u,d)=>(d===0&&u>=17&&u<=18)||(d===1&&u===11)?22:0,wc:(u,d)=>(d===0&&u>=17&&u<=18)||(d===1&&u===11)?95:3},
  woestijn:{klok:"2026-07-22T12:39:00Z",meting:"2026-07-22T14:30",temp:u=>sin(u,15,15,9)}
};
const BREEDTES=[320,390,768,1024,1366];

function fixture(sc){
  const d=bouw({temp:sc.temp,pp:sc.pp||(()=>5),pr:sc.pr||(()=>0),wc:sc.wc||(()=>3),som:2});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  const nu=h.time.indexOf(sc.meting.slice(0,14)+"00");
  d.current.time=sc.meting;d.current.temperature_2m=h.temperature_2m[nu];d.current.apparent_temperature=h.temperature_2m[nu]-1;
  d.current.precipitation=h.precipitation[nu];d.current.weather_code=h.weather_code[nu];
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,sc,w){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:mobiel?844:900},deviceScaleFactor:mobiel?2:1,locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(k=>{const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;},sc.klok);
  const data=fixture(sc);
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:data});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:[sc.meting.slice(0,14)+"00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:15000});
  await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelector("#chart #hit")&&document.querySelectorAll("#chart circle").length>0,null,{timeout:15000});
  await sleep(1500);
  return {context,page,fouten};
}

function meet(){
  const svg=document.getElementById("chart"),sr=svg.getBoundingClientRect();
  const zicht=el=>{let e=el;while(e&&e!==svg){if(e.getAttribute&&e.getAttribute("display")==="none")return false;const cs=getComputedStyle(e);if(cs.display==="none"||cs.visibility==="hidden"||Number(cs.opacity)===0)return false;e=e.parentNode;}return el.getClientRects().length>0;};
  const buitenScrub=el=>!el.closest("#scrub")&&!el.closest("#hit");
  const naam=el=>{const a=[...el.attributes].map(x=>x.name).filter(n=>n.startsWith("data-")&&!/base|adjusted|priority|covers|index$/.test(n)).map(n=>n.replace(/^data-(mobile-|desktop-)?/,""));return a.slice(0,2).join("+")||el.tagName;};
  const R=r=>({l:r.left,r:r.right,t:r.top,b:r.bottom});
  const teksten=[...svg.querySelectorAll("text")].filter(el=>buitenScrub(el)&&zicht(el)&&el.textContent.trim()).map(el=>({s:el.textContent.trim(),k:naam(el),...R(el.getBoundingClientRect())}));
  const iconen=[...svg.querySelectorAll("g[data-mobile-weather-icon],g[data-desktop-weather-icon]")].filter(el=>buitenScrub(el)&&zicht(el)).map(el=>({s:"icoon",k:"icoon",...R(el.getBoundingClientRect())}));
  const staven=[...svg.querySelectorAll("path.regenstaaf")].filter(zicht).map(el=>({s:"staaf "+el.getAttribute("data-uur"),...R(el.getBoundingClientRect())}));
  const stippen=[...svg.querySelectorAll("circle")].filter(el=>buitenScrub(el)&&zicht(el)&&Number(el.getAttribute("r"))>0).map(el=>({s:el.getAttribute("fill")==="var(--carmine)"?"nu-stip":"stip",...R(el.getBoundingClientRect())}));
  const lijnEl=svg.querySelector("path[data-mobile-smooth-line]")||[...svg.querySelectorAll("polyline")].find(zicht);
  const m=svg.getScreenCTM(),pt=svg.createSVGPoint(),lijn=[];
  if(lijnEl&&zicht(lijnEl)){const L=lijnEl.getTotalLength(),lm=lijnEl.getScreenCTM();for(let s=0;s<=L;s+=1.5){const p=lijnEl.getPointAtLength(s);pt.x=p.x;pt.y=p.y;const q=pt.matrixTransform(lm);lijn.push([q.x,q.y]);}}
  const nuLijnen=[...svg.querySelectorAll("line")].filter(el=>buitenScrub(el)&&zicht(el)&&/carmine/.test(el.getAttribute("stroke")||getComputedStyle(el).stroke)).map(el=>R(el.getBoundingClientRect()));
  const ov=(a,b,m=1)=>Math.min(a.r,b.r)-Math.max(a.l,b.l)>m&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>m;
  const uit=[];
  for(let i=0;i<teksten.length;i++)for(let j=i+1;j<teksten.length;j++)if(ov(teksten[i],teksten[j]))uit.push(["tekst-tekst",teksten[i].s+" ("+teksten[i].k+") × "+teksten[j].s+" ("+teksten[j].k+")"]);
  teksten.forEach(t=>iconen.forEach(c=>{if(ov(t,c))uit.push(["tekst-icoon",t.s+" ("+t.k+")"]);}));
  for(let i=0;i<iconen.length;i++)for(let j=i+1;j<iconen.length;j++)if(ov(iconen[i],iconen[j]))uit.push(["icoon-icoon",""]);
  teksten.forEach(t=>staven.forEach(b=>{if(ov(t,b))uit.push(["tekst-staaf",t.s+" ("+t.k+") × "+b.s]);}));
  iconen.forEach(c=>staven.forEach(b=>{if(ov(c,b))uit.push(["icoon-staaf",b.s]);}));
  teksten.forEach(t=>{const i={l:t.l+1.5,r:t.r-1.5,t:t.t+1.5,b:t.b-1.5};if(lijn.some(([x,y])=>x>i.l&&x<i.r&&y>i.t&&y<i.b))uit.push(["tekst-lijn",t.s+" ("+t.k+")"]);});
  iconen.forEach(c=>{const i={l:c.l+1,r:c.r-1,t:c.t+1,b:c.b-1};if(lijn.some(([x,y])=>x>i.l&&x<i.r&&y>i.t&&y<i.b))uit.push(["icoon-lijn",""]);});
  teksten.forEach(t=>stippen.forEach(c=>{if(ov(t,c,0.5))uit.push(["tekst-stip",t.s+" ("+t.k+") × "+c.s]);}));
  teksten.forEach(t=>nuLijnen.forEach(n=>{const bb={l:n.l-0.5,r:n.r+0.5,t:n.t,b:n.b};if(ov(t,bb,0.5)&&!/^nu/.test(t.s))uit.push(["tekst-nulijn",t.s+" ("+t.k+")"]);}));
  staven.forEach(b=>{if(lijn.some(([x,y])=>x>b.l+0.5&&x<b.r-0.5&&y>b.t+1.5&&y<b.b))uit.push(["staaf-lijn",b.s]);});
  [...teksten,...iconen].forEach(t=>{if(t.l<sr.left-0.5||t.r>sr.right+0.5||t.t<sr.top-0.5||t.b>sr.bottom+0.5)uit.push(["buiten-grafiek",t.s+" ("+t.k+")"]);});
  return {uit,view:S.dag==null?"vandaag":"dag"+S.dag,n:teksten.length};
}
(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const alle=[];let metingen=0;
  try{
    for(const [naam,sc] of Object.entries(SCENARIO))for(const w of BREEDTES){
      const {context,page,fouten}=await open(browser,root,sc,w);
      try{
        for(const dag of [null,1]){
          if(dag!==null){
            const rij=page.locator("#days .row.day:not(.kop)").nth(dag);
            await rij.scrollIntoViewIfNeeded();await rij.click();
            await page.waitForFunction(d=>S.dag===d&&S.geo,dag,{timeout:5000});
            await sleep(800);
          }
          const r=await page.evaluate(meet);metingen++;
          r.uit.forEach(([soort,wat])=>alle.push(naam+" "+w+"px "+r.view+": "+soort+" "+wat));
        }
        assert.deepEqual(fouten,[],naam+" "+w+"px: runtimefouten "+fouten.join(" | "));
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  assert.deepEqual(alle,[],"Botsingen in de grafiek:\n"+alle.join("\n"));
  console.log("Grafiekbotsingen OK: "+metingen+" grafieken ("+Object.keys(SCENARIO).length+" weersituaties, "+BREEDTES.join("/")+"px, vandaag en een gekozen dag) zonder tekst op tekst, lijn, stip, staaf, icoon of nu-lijn, zonder staaf door de lijn en zonder tekst buiten beeld.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

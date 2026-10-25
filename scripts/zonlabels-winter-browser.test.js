"use strict";

/* Zon-op- en zon-onder-labels in de grafiek bij een korte winterdag (zon op 07:25, zon onder 17:22, venster vanaf 00:13).
   De labels staan naar elkaar toe gericht. Fase 2a (25 oktober 2026) zette alle grafiektekst op 12px vanaf een grafiek van
   350px; daardoor overlapten "sunrise 07:25" en "sunset 17:22" in het Engels op 375 en 390px meer dan op main en op 430px
   voor het eerst (main: 9,5px vrij). Deze test legt vast dat de labels hun oude ondergrens van 11px houden (onder 1440px) en
   dat de ruimte ertussen nergens kleiner is dan op main. De bestaande overlap op 320 tot 390px in het Engels blijft een
   bekend, apart te verbeteren punt: de grenswaarden hieronder zijn de gemeten waarden van main met 1px speling. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};

const d=bouw({tempNu:11,wcNu:3,ccNu:60,rh:80,pp:()=>10,pr:()=>0,wc:()=>3,cc:()=>60,som:2});
d.latitude=52.3676;d.longitude=4.9041;d.elevation=3;d.minutely_15=null;
Object.assign(d.current,{time:"2026-07-22T00:13",interval:900,visibility:16000});
d.daily.sunshine_duration=d.daily.time.map(()=>2*3600);
d.daily.sunrise=d.daily.time.map(t=>t+"T07:25");d.daily.sunset=d.daily.time.map(t=>t+"T17:22");
const air={current:{european_aqi:30,us_aqi:40},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const NU=Date.UTC(2026,6,21,22,13,0);

function bouwServer(){
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const stub=`<script>Date.now=()=>${NU};window.fetch=async function(url){const u=String(url);
    const payload=u.includes('/api/neerslag')?${JSON.stringify({beschikbaar:false,reden:"test"})}:u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[]})}:u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Amsterdam",land:"NL",bron:"test"})}:${JSON.stringify(d)};
    return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};};
    try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
  html=html.replace("</head>",stub+"</head>");
  return http.createServer((req,res)=>{
    const p=(req.url||"").split("?")[0];
    if(p==="/"||p==="/index.html"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}
    const f=path.join(PUBLIC,p.replace(/^\//,""));
    if(f.startsWith(PUBLIC+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()){res.writeHead(200,{"content-type":mime[path.extname(f).toLowerCase()]||"application/octet-stream"});fs.createReadStream(f).pipe(res);}
    else{res.writeHead(404);res.end("not found");}
  });
}

/* Gemeten op main (03c6e968, 11px): kleinste tussenruimte tussen de twee zon-labels, in px. Nederlands heeft op de telefoon
   geen zon-labels in de SVG; op 768px zijn "zon op" en "zon onder" breder dan "sunrise" en "sunset". */
const MAIN_TUSSENRUIMTE={en:{320:-29.1,360:-15,375:-10,390:-4.4,430:9.5,768:137.1},nl:{768:123.8}};

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  const srv=bouwServer();await new Promise(r=>srv.listen(0,"127.0.0.1",r));
  let n=0;
  try{
    for(const taal of ["en","nl"])for(const breedte of [320,360,375,390,430,768]){
      const L=`${taal} ${breedte}px`;
      const context=await browser.newContext({viewport:{width:breedte,height:900},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
      try{
        const page=await context.newPage(),fouten=[];
        page.on("pageerror",e=>fouten.push(String(e)));
        if(taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
        await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL`,{waitUntil:"networkidle"});
        await page.waitForSelector("#chart text",{state:"attached",timeout:15000});
        await page.waitForTimeout(1000);
        const r=await page.evaluate(()=>{
          const svg=document.querySelector("#chart"),sr=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal,sc=vb&&vb.width?sr.width/vb.width:1;
          const zon=[...svg.querySelectorAll("text")].filter(t=>/^(sunrise|sunset|zon op|zon onder)\b/i.test(t.textContent.trim())&&t.getBoundingClientRect().width>0)
            .map(t=>{const q=t.getBoundingClientRect();return {t:t.textContent.trim(),l:q.left,r:q.right,px:parseFloat(getComputedStyle(t).fontSize)*sc};}).sort((a,b)=>a.l-b.l);
          return {zon,gap:zon.length>1?zon[1].l-zon[0].r:null};
        });
        if(taal==="nl"&&breedte<=430){
          /* Op de telefoon staan de zon-tijden in het Nederlands buiten de SVG. */
          assert.equal(r.zon.length,0,`${L}: zon-labels in de SVG`);
        }else{
          assert.equal(r.zon.length,2,`${L}: ${r.zon.length} zon-labels in de grafiek`);
          r.zon.forEach(z=>assert.ok(z.px<=11.2,`${L}: zon-label "${z.t}" is ${z.px.toFixed(2)}px (ondergrens 11px)`));
          const main=MAIN_TUSSENRUIMTE[taal][breedte];
          assert.ok(r.gap>=main-1,`${L}: tussenruimte tussen de zon-labels ${r.gap.toFixed(1)}px, op main ${main}px`);
          if(taal==="en"&&breedte>=430)assert.ok(r.gap>=0,`${L}: zon-labels overlappen (${r.gap.toFixed(1)}px)`);
        }
        assert.deepEqual(fouten,[],`${L}: scriptfouten`);
        n++;
      }finally{await context.close();}
    }
    console.log(`Zon-labels winter: ${n} situaties (EN/NL, 320 tot 768px): labels houden 11px en de ruimte ertussen is nergens kleiner dan op main (EN 430px en breder: geen overlap).`);
  }finally{srv.close();await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

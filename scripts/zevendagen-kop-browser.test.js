"use strict";

/* Kolomkop "Wind" van Zeven dagen op ieder breekpunt (31 oktober 2026).
   Regressie: tussen 760 en 900px stonden "Wind max" (de verborgen tekst, 13px) en "Wind" (::after) tegelijk in de kop
   ("WIND MAXWIND"). Oorzaak: senior-semantiek verbergt de tekst met font-size:0 tot en met 900px, terwijl de
   leesbaarheidslaag vanaf 760px alle kolomkoppen op de rolmaat zette en de verborgen tekst daarmee weer zichtbaar maakte.
   Bewaakt op het gebouwde artifact, in Nederlands en Engels:
   - de kop van de windkolom heeft op iedere breedte precies één zichtbare bron (de tekst zelf of de ::after), of geen als de
     kolom op een smalle telefoon niet getoond wordt;
   - van 760 tot en met 900px heeft die ::after de rolmaat van de andere koppen (minstens 12px);
   - vanaf 901px staat "Wind max" zichtbaar en is de ::after weg;
   - de zichtbare kopcellen overlappen elkaar niet.
   Telefoons (tot 759px) blijven bewust ongewijzigd; daar is alleen het aantal zichtbare bronnen vastgelegd.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};
const NU=Date.UTC(2026,6,22,12,10,0),TIJD="2026-07-22T14:10";

function bouwServer(){
  const d=bouw({tempNu:18,wcNu:3,ccNu:60,rh:80,pp:u=>u>=16&&u<=19?60:10,pr:u=>u>=16&&u<=19?0.6:0,wc:u=>u>=16&&u<=19?61:3,cc:()=>60,som:2});
  d.latitude=52.3676;d.longitude=4.9041;d.elevation=3;d.minutely_15=null;
  Object.assign(d.current,{time:TIJD,interval:900,visibility:16000});
  d.daily.sunshine_duration=d.daily.time.map(()=>6*3600);
  const air={current:{european_aqi:30,us_aqi:40},hourly:{time:[TIJD],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const stub=`<script>Date.now=()=>${NU};window.fetch=async function(url){const u=String(url);
    const payload=u.includes('/api/neerslag')?${JSON.stringify({beschikbaar:false,reden:"test"})}:u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[]})}:u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Amsterdam",land:"NL",bron:"test"})}:${JSON.stringify(d)};
    return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};};
    try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
  html=html.replace("</head>",stub+"</head>");
  return http.createServer((req,res)=>{
    const p=(req.url||"").split("?")[0];
    if(p==="/"||p==="/index.html"){res.writeHead(200,{"content-type":mime[".html"]});res.end(html);return;}
    const f=path.join(PUBLIC,p.replace(/^\//,""));
    if(f.startsWith(PUBLIC+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()){res.writeHead(200,{"content-type":mime[path.extname(f).toLowerCase()]||"application/octet-stream"});fs.createReadStream(f).pipe(res);}
    else{res.writeHead(404);res.end("not found");}
  });
}

function meet(){
  const kop=document.querySelector("#days .row.kop"),wind=kop&&kop.querySelector(".dwind");
  if(!wind)return {fout:"kop van Zeven dagen of de windkolom ontbreekt"};
  const cs=getComputedStyle(wind),na=getComputedStyle(wind,"::after");
  const weergegeven=cs.display!=="none"&&cs.visibility!=="hidden";
  const tekstZichtbaar=weergegeven&&parseFloat(cs.fontSize)>0&&wind.textContent.trim().length>0;
  const afterZichtbaar=weergegeven&&na.content!=="none"&&na.content!=='""'&&parseFloat(na.fontSize)>0;
  const cellen=[...kop.children].map(c=>({k:c.className,r:c.getBoundingClientRect(),d:getComputedStyle(c).display,fs:parseFloat(getComputedStyle(c).fontSize)}))
    .filter(c=>c.d!=="none"&&c.r.width>0&&c.fs>0||(c.k.includes("dwind")&&afterZichtbaar&&c.r.width>0));
  const overlap=[];
  for(let i=0;i<cellen.length;i++)for(let j=i+1;j<cellen.length;j++){
    const a=cellen[i].r,b=cellen[j].r,ox=Math.min(a.right,b.right)-Math.max(a.left,b.left);
    if(ox>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlap.push(cellen[i].k+" x "+cellen[j].k);
  }
  return {weergegeven,bronnen:(tekstZichtbaar?1:0)+(afterZichtbaar?1:0),tekstZichtbaar,afterZichtbaar,afterPx:parseFloat(na.fontSize),overlap};
}

(async()=>{
  const srv=bouwServer();await new Promise(r=>srv.listen(0,"127.0.0.1",r));
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let n=0;
  try{
    const breedtes=[390,600,759,760,768,820,900,901,980,1024,1100,1440];
    for(const taal of ["nl","en"])for(const w of breedtes){
      if(taal==="en"&&![390,760,768,900,901,1440].includes(w))continue;
      const context=await browser.newContext({viewport:{width:w,height:900},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
      const page=await context.newPage(),fouten=[];
      page.on("pageerror",e=>fouten.push(String(e)));
      if(taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
      try{
        await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL`,{waitUntil:"networkidle"});
        await page.waitForSelector("#days .row.kop .dwind",{state:"attached",timeout:15000});
        await page.waitForTimeout(500);
        const r=await page.evaluate(meet),wat=`${taal} ${w}px`;
        assert(!r.fout,`${wat}: ${r.fout}`);
        assert.deepEqual(fouten,[],`${wat}: scriptfouten`);
        assert.equal(r.bronnen,r.weergegeven?1:0,`${wat}: de windkop heeft ${r.bronnen} zichtbare bronnen (tekst: ${r.tekstZichtbaar}, ::after: ${r.afterZichtbaar}); verwacht ${r.weergegeven?1:0}`);
        if(w>=760&&w<=900)assert(r.afterZichtbaar&&r.afterPx>=12,`${wat}: de ::after-kop "Wind" is ${r.afterPx}px; minimaal 12px verwacht`);
        if(w>=901)assert(r.tekstZichtbaar&&!r.afterZichtbaar,`${wat}: vanaf 901px hoort alleen de tekst "Wind max" zichtbaar te zijn`);
        assert.deepEqual(r.overlap,[],`${wat}: kopcellen overlappen: ${r.overlap.join(", ")}`);
        n++;
      }finally{await context.close();}
    }
    console.log(`Zeven dagen, kop "Wind": ${n} breedte-/taalcombinaties, één zichtbare bron, geen overlap.`);
  }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});

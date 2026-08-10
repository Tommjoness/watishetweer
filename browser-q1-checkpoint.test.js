"use strict";
const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const d=bouw({pp:()=>0,pr:()=>0,som:0,cc:()=>35,wc:()=>3,wcNu:3});
delete d.current.interval; // expliciet het fysieke randgeval: kwartierkop mag hier niet van afhangen
d.current.visibility=16000;d.elevation=3;d.latitude=52.35;d.longitude=5.26;
d.daily.sunshine_duration=d.daily.time.map(()=>7*3600);
d.daily.precipitation_probability_max=[65,25,0,10,40,70,5];
d.daily.precipitation_sum=[4.8,0,0,0,0.2,7.3,0];
for(let i=0;i<d.hourly.time.length;i++){
  const t=d.hourly.time[i];
  if(t==="2026-07-22T17:00"){d.hourly.precipitation_probability[i]=65;d.hourly.precipitation[i]=1.4;}
  if(t==="2026-07-22T19:00"){d.hourly.precipitation_probability[i]=25;d.hourly.precipitation[i]=0;}
  if(t==="2026-07-22T20:00"){d.hourly.precipitation_probability[i]=0;d.hourly.precipitation[i]=0;}
}
const air={current:{european_aqi:30,us_aqi:40},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};

let html=fs.readFileSync(path.join(__dirname,"public/index.html"),"utf8");
const stub=`<script>
window.__q1ForecastDelay=0;
window.fetch=async function(url){
  const u=String(url);
  if(u.includes('api.open-meteo.com/v1/forecast')&&window.__q1ForecastDelay) await new Promise(r=>setTimeout(r,window.__q1ForecastDelay));
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Amsterdam",latitude:52.37,longitude:4.90,admin1:"Noord-Holland",country_code:"NL"}]})}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Browsertest",land:"NL",bron:"test"})
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const server=http.createServer((req,res)=>{
  const p=(req.url||"").split("?")[0];
  if(p==="/"||p==="/index.html"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}
  const rel=p.startsWith("/")?p.slice(1):p,f=path.join(__dirname,"public",rel);
  if(fs.existsSync(f)&&fs.statSync(f).isFile()){
    const ext=path.extname(f).toLowerCase(),types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(f).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

async function tooltip(page,tijd){
  return page.evaluate(tijd=>{
    const G=S.geo,hit=document.getElementById("hit"),scrub=document.getElementById("scrub"),svg=document.getElementById("chart");
    const i=G.TI.findIndex(t=>String(t).slice(11,16)===tijd);if(i<0)return [];
    const r=svg.getBoundingClientRect(),x=r.left+(G.x(i)/(G.W||900))*r.width,y=r.top+((G.pt+30)/(G.H||450))*r.height;
    hit.dispatchEvent(new PointerEvent("pointermove",{clientX:x,clientY:y,pointerType:"mouse",bubbles:true}));
    return [...scrub.querySelectorAll("text")].map(el=>(el.textContent||"").trim());
  },tijd);
}

async function controleer(type,naam){
  const browser=await type.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),fouten=[];
    page.on("pageerror",e=>fouten.push(String(e)));
    page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
    await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Browsertest&land=NL`,{waitUntil:"networkidle"});
    await page.waitForSelector("#app",{state:"visible"});

    const basis=await page.evaluate(()=>({
      recent:[...document.querySelectorAll(".stat")].find(x=>x.querySelector("#prec"))?.querySelector(".eyebrow")?.textContent.trim()||"",
      dagMm:[...document.querySelectorAll("#days .q1-dag-mm")].map(x=>x.textContent.trim()),
      over:document.documentElement.scrollWidth-window.innerWidth
    }));
    const diagnose=await page.evaluate(()=>({
      polishApi:!!window.WeatherNowMobileScreenshotPolish,
      q1Api:!!window.WeatherNowQ1,
      precClass:document.getElementById("prec")?.className||"",
      precParentClass:document.getElementById("prec")?.parentElement?.className||"",
      precHeading:document.getElementById("prec")?.parentElement?.querySelector(".eyebrow")?.textContent.trim()||"",
      bodyHasPolishMarker:document.documentElement.innerHTML.includes("MOBILE SCREENSHOT POLISH 20260810B")
    }));
    console.log("DIAG "+naam+" "+JSON.stringify({basis,diagnose}));
    assert.equal(basis.recent,"Afgelopen kwartier",naam+": kwartierkop zonder current.interval");
    assert.ok(basis.dagMm.length>=1,naam+": minstens één neerslagdag toont mm");
    assert.ok(!basis.dagMm.includes("0,0 mm"),naam+": droge dagen tonen geen 0,0 mm");
    assert.ok(basis.over<=2,naam+": geen horizontale overflow");

    const nat=await tooltip(page,"17:00"),droog=await tooltip(page,"19:00"),nul=await tooltip(page,"20:00");
    const tipBron=await page.evaluate(()=>["17:00","19:00","20:00"].map(t=>{
      const i=S.geo.TI.findIndex(x=>String(x).slice(11,16)===t);
      return {t,i,kans:i>=0&&S.geo.P?S.geo.P[i]:null,mm:i>=0&&S.geo.Q1MM?S.geo.Q1MM[i]:null,x:i>=0?S.geo.x(i):null,W:S.geo.W,cw:S.geo.cw,pl:S.geo.pl};
    }));
    console.log("TOOLTIP "+naam+" "+JSON.stringify({nat,droog,nul,tipBron}));
    assert.ok(nat.includes("neerslagkans")&&nat.includes("65% · 1,4 mm"),naam+": nat uur toont kans + mm");
    assert.ok(droog.includes("neerslagkans")&&droog.includes("25%"),naam+": 0 mm behoudt echte 25%-kans");
    assert.ok(!droog.some(t=>/mm/.test(t)),naam+": 0 mm krijgt geen mm-regel");
    assert.ok(nul.includes("neerslagkans")&&nul.includes("0%"),naam+": echte nul-kans blijft 0%");
    assert.ok(!nul.some(t=>/mm/.test(t)),naam+": nul-kans/nul-mm blijft compact");

    // Cacheprestatie: eerst een tweede plaats laden, daarna terug naar de reeds
    // gecachte eerste plaats terwijl de netwerkforecast kunstmatig 700 ms wacht.
    await page.evaluate(()=>load(51.92,4.48,"Rotterdam",false,true,"NL"));
    await page.evaluate(()=>{window.__q1ForecastDelay=700;load(52.35,5.26,"Browsertest",false,true,"NL");});
    await page.waitForTimeout(80);
    const snel=await page.evaluate(()=>({label:S.label,cacheHits:WeatherNowQ1Performance.cacheHits,paint:WeatherNowQ1Performance.lastCachePaintMs,network:WeatherNowQ1Performance.lastNetworkMs}));
    assert.equal(snel.label,"Browsertest",naam+": recente plaats staat vóór vertraagde netwerkrefresh alweer op scherm");
    assert.ok(snel.cacheHits>=1,naam+": recente-plaatscache is daadwerkelijk gebruikt");
    assert.ok(Number.isFinite(snel.paint)&&snel.paint<100,naam+": cached paint gebeurt binnen 100 ms in gecontroleerde test");
    await page.waitForTimeout(750);
    const na=await page.evaluate(()=>WeatherNowQ1Performance.lastNetworkMs);
    assert.ok(na>=650,naam+": test bevestigt dat de netwerkrefresh werkelijk vertraagd was en cache dus verschil maakte");

    // Exact dezelfde geocodingvraag wordt binnen dezelfde tab hergebruikt.
    const geoHits=await page.evaluate(async()=>{
      const u="https://geocoding-api.open-meteo.com/v1/search?name=Am&count=6&language=nl&format=json";
      await j(u);await j(u);return WeatherNowQ1Performance.geocodeCacheHits;
    });
    assert.ok(geoHits>=1,naam+": identieke geocodingvraag gebruikt cache");
    assert.deepEqual(fouten,[],naam+": console/page errors: "+fouten.join(" | "));
    console.log("OK "+naam+" checkpoint 25%");
    await page.close();
  }finally{await browser.close();}
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  try{await controleer(chromium,"Chromium");await controleer(webkit,"WebKit");}
  finally{server.close();}
})().catch(e=>{console.error(e&&e.stack||e);server.close();process.exit(1);});

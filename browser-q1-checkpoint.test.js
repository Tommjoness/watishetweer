"use strict";
const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const d=bouw({pp:()=>0,pr:()=>0,som:0,cc:()=>35,wc:()=>3,wcNu:3});
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
const artifactDiagnose={
  oud15:html.includes('<div class="eyebrow">Afgelopen 15 minuten</div><div class="sval" id="prec">'),
  oudKwartier:html.includes("Afgelopen kwartier"),
  trend:html.includes('<div class="eyebrow">Temperatuurtrend</div><div class="sval" id="prec">'),
  legacyBerekening:html.includes("const recenteNeerslag=eindigGetal(c.precipitation)"),
  oudeWrapper:html.includes("compactRecentLabel"),
  polish:html.includes("MOBILE SCREENSHOT POLISH 20260810B"),
  q1:html.includes("CHECKPOINT 25 Q1")
};
const stub=`<script>
window.__q1ForecastDelay=0;
window.__q1Nu=Date.UTC(2026,6,22,12,17,0); // 14:17 Europe/Amsterdam
Date.now=()=>window.__q1Nu;
window.fetch=async function(url,opt){
  const u=String(url),delay=window.__q1ForecastDelay;
  if(u.includes('api.open-meteo.com/v1/forecast')&&delay) await new Promise(r=>setTimeout(r,delay));
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Amsterdam",latitude:52.37,longitude:4.90,admin1:"Noord-Holland",country_code:"NL"}]})}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Browsertest",land:"NL",bron:"test"})}
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
      trendKop:document.getElementById("prec")?.parentElement?.querySelector(".eyebrow")?.textContent.trim()||"",
      trendWaarde:document.getElementById("prec")?.textContent.trim()||"",
      trendSub:document.getElementById("precsub")?.textContent.trim()||"",
      popDisplay:getComputedStyle(document.getElementById("pop").parentElement).display,
      popAria:document.getElementById("pop").parentElement.getAttribute("aria-hidden"),
      gridClass:document.getElementById("pop").parentElement.parentElement.className,
      neerslagSectieDisplay:getComputedStyle(document.getElementById("nchint").previousElementSibling).display,
      dag:[...document.querySelectorAll("#days .row.day:not(.kop)")].map(r=>({kans:r.querySelector(".drain")?.childNodes[0]?.textContent?.trim()||"",mm:r.querySelector(".q1-dag-mm")?.textContent.trim()||""})),
      over:document.documentElement.scrollWidth-window.innerWidth
    }));
    const diagnose=await page.evaluate(()=>({
      polishApi:!!window.WeatherNowMobileScreenshotPolish,
      q1Api:!!window.WeatherNowQ1,
      metersBron:String(meters).slice(0,400),
      klokBron:String(klokBijwerken).slice(0,300),
      bodyHasPolishMarker:document.documentElement.innerHTML.includes("MOBILE SCREENSHOT POLISH 20260810B")
    }));
    const diag=JSON.stringify({artifact:artifactDiagnose,basis,diagnose,fouten});
    console.log("DIAG "+naam+" "+diag);
    assert.deepEqual(artifactDiagnose,{oud15:false,oudKwartier:false,trend:true,legacyBerekening:false,oudeWrapper:false,polish:true,q1:true},naam+": artifact bevat uitsluitend nieuwe trendroute | DIAG="+diag);
    assert.equal(basis.trendKop,"Temperatuurtrend",naam+": nieuwe tegelkop");
    assert.match(basis.trendWaarde,/^-?\d+\s*→\s*-?\d+°C$/,naam+": trend toont uitsluitend twee temperaturen");
    assert.ok(["Stijgt de komende drie uur.","Daalt de komende drie uur.","Blijft vrijwel gelijk."].includes(basis.trendSub),naam+": trendtekst is beperkt tot temperatuur");
    assert.equal(basis.popDisplay,"none",naam+": droge korte termijn toont geen dubbele droogtegel");
    assert.equal(basis.popAria,"true",naam+": verborgen droogtegel is ook uit toegankelijkheidsweergave");
    assert.match(basis.gridClass,/q1-pop-hidden/,naam+": raster wordt zonder lege placeholder herverdeeld");
    assert.equal(basis.neerslagSectieDisplay,"none",naam+": volledig droge twee-uurssectie dupliceert de briefing niet");
    assert.equal(basis.dag[0].kans,"65%",naam+": daily kans komt uit probability_max");
    assert.equal(basis.dag[0].mm,"4,8 mm",naam+": daily hoeveelheid komt uit precipitation_sum");
    assert.equal(basis.dag[1].kans,"25%",naam+": 25% blijft staan bij 0 mm");
    assert.equal(basis.dag[1].mm,"",naam+": droge 0,0 mm wordt niet getoond");
    assert.ok(basis.over<=2,naam+": geen horizontale overflow op 390 px");

    /* De bestaande lokale minuutklok moet de trend kunnen doorschuiven zonder
       nieuwe fetch. We zetten twee echte uurpunten bewust uit elkaar en verplaatsen
       alleen het lokale instant; klokBijwerken() moet daarna de trend opnieuw tekenen. */
    const trendKlok=await page.evaluate(()=>{
      const i17=S.d.hourly.time.indexOf("2026-07-22T17:00"),i19=S.d.hourly.time.indexOf("2026-07-22T19:00");
      const oud17=S.d.hourly.temperature_2m[i17],oud19=S.d.hourly.temperature_2m[i19];
      S.d.hourly.temperature_2m[i17]=11;S.d.hourly.temperature_2m[i19]=22;
      S.klokInstantOverride=new Date(window.__q1Nu);klokBijwerken();
      const voor=document.getElementById("prec").textContent.trim();
      S.klokInstantOverride=new Date(window.__q1Nu+98*60000);klokBijwerken();
      const na=document.getElementById("prec").textContent.trim();
      S.d.hourly.temperature_2m[i17]=oud17;S.d.hourly.temperature_2m[i19]=oud19;S.klokInstantOverride=null;klokBijwerken();
      return {voor,na};
    });
    assert.match(trendKlok.voor,/→\s*11°C$/,naam+": 14:17 lokale tijd kiest echt uurpunt rond 17:17");
    assert.match(trendKlok.na,/→\s*22°C$/,naam+": lokale klokverschuiving kiest nieuw echt uurpunt zonder fetch");

    /* Relevante neerslag maakt dezelfde tegel én de twee-uurssectie weer zichtbaar.
       De uurvelden zijn onafhankelijke kans/hoeveelheidsbronnen; daarna herstellen
       we het droge scenario om de rest van de test niet te beïnvloeden. */
    const popNat=await page.evaluate(()=>{
      const i15=S.d.hourly.time.indexOf("2026-07-22T15:00"),i16=S.d.hourly.time.indexOf("2026-07-22T16:00");
      S.d.hourly.precipitation_probability[i15]=65;S.d.hourly.precipitation[i15]=1.4;
      S.d.hourly.precipitation_probability[i16]=0;S.d.hourly.precipitation[i16]=0;
      meters();nowcast();
      const stat=document.getElementById("pop").parentElement;
      const uit={display:getComputedStyle(stat).display,kop:stat.querySelector(".eyebrow").textContent.trim(),waarde:document.getElementById("pop").textContent.trim(),sub:document.getElementById("popsub").textContent.trim(),sectie:getComputedStyle(document.getElementById("nchint").previousElementSibling).display};
      S.d.hourly.precipitation_probability[i15]=0;S.d.hourly.precipitation[i15]=0;meters();nowcast();
      return uit;
    });
    assert.notEqual(popNat.display,"none",naam+": relevante neerslag toont tegel");
    assert.notEqual(popNat.sectie,"none",naam+": relevante neerslag toont twee-uurssectie");
    assert.equal(popNat.kop,"Neerslag komend uur",naam+": zichtbare tegel heeft expliciete scope");
    assert.match(popNat.waarde,/65%/,naam+": zichtbare tegel behoudt bronkans");
    assert.match(popNat.waarde,/mm/,naam+": meetbare hoeveelheid staat naast kans");

    const nat=await tooltip(page,"17:00"),droog=await tooltip(page,"19:00"),nul=await tooltip(page,"20:00");
    const tipBron=await page.evaluate(()=>["17:00","19:00","20:00"].map(t=>{
      const i=S.geo.TI.findIndex(x=>String(x).slice(11,16)===t);
      return {t,i,kans:i>=0&&S.geo.P?S.geo.P[i]:null,mm:i>=0&&S.geo.Q1MM?S.geo.Q1MM[i]:null};
    }));
    console.log("TOOLTIP "+naam+" "+JSON.stringify({nat,droog,nul,tipBron}));
    assert.ok(nat.includes("neerslagkans")&&nat.includes("65% · 1,4 mm"),naam+": nat uur toont kans + mm");
    assert.ok(droog.includes("neerslagkans")&&droog.includes("25%"),naam+": 0 mm behoudt echte 25%-kans");
    assert.ok(!droog.some(t=>/mm/.test(t)),naam+": 0 mm krijgt geen nutteloze hoeveelheid");
    assert.ok(nul.includes("neerslagkans")&&nul.includes("0%"),naam+": echte nul-kans blijft 0%");
    assert.ok(!nul.some(t=>/mm/.test(t)),naam+": nul-kans/nul-mm blijft compact");

    for(const breedte of [320,360,375,390,430]){
      await page.setViewportSize({width:breedte,height:844});await page.waitForTimeout(80);
      const over=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
      assert.ok(over<=2,naam+": geen horizontale overflow op "+breedte+" px");
    }
    await page.setViewportSize({width:390,height:844});

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
    assert.ok(na>=650,naam+": netwerkrefresh was werkelijk vertraagd; cache maakte dus meetbaar verschil");

    /* Racebewijs zonder fetch-abort: de stub negeert AbortSignal bewust. Zelfs dan
       mag de 700 ms trage plaats A na een snelle plaats B nooit de state terugzetten. */
    await page.evaluate(()=>{
      window.__q1ForecastDelay=700;
      load(40.71,-74.01,"Langzaam A",false,true,"US");
      setTimeout(()=>{window.__q1ForecastDelay=0;load(35.68,139.69,"Snel B",false,true,"JP");},20);
    });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>S.label),"Snel B",naam+": snelle B wint terwijl A nog loopt");
    await page.waitForTimeout(700);
    const race=await page.evaluate(()=>({label:S.label,lat:S.lat,lon:S.lon}));
    assert.equal(race.label,"Snel B",naam+": late A mag B niet overschrijven");
    assert.ok(Math.abs(race.lat-35.68)<0.001&&Math.abs(race.lon-139.69)<0.001,naam+": coördinaten blijven bij B");

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

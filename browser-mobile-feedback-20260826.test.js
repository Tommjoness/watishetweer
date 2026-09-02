"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

/* Reproduceert de fysieke iPhone-feedback van 26 augustus 2026 om 01:55 in
   Amsterdam: vandaag heeft 6% neerslagkans en een bekende dagsom van 0,0 mm. */
const d=bouw({temp:(u)=>13+13*Math.max(0,Math.sin((u-6)/24*Math.PI)),tempNu:15,pp:(u,dag)=>dag===0?6:5,som:0});
function verschuifIso(waarde,dagen){
  const s=String(waarde||""),m=/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/.exec(s);if(!m)return waarde;
  const dt=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+dagen));
  const datum=dt.getUTCFullYear()+"-"+String(dt.getUTCMonth()+1).padStart(2,"0")+"-"+String(dt.getUTCDate()).padStart(2,"0");
  return datum+(m[4]||"");
}
function verschuifArray(a,dagen){return Array.isArray(a)?a.map(v=>verschuifIso(v,dagen)):a;}
const plus=35; // 22 juli -> 26 augustus
d.hourly.time=verschuifArray(d.hourly.time,plus);
d.daily.time=verschuifArray(d.daily.time,plus);
d.daily.sunrise=verschuifArray(d.daily.sunrise,plus);
d.daily.sunset=verschuifArray(d.daily.sunset,plus);
if(d.minutely_15)d.minutely_15.time=verschuifArray(d.minutely_15.time,plus);
d.current.time="2026-08-26T01:55";
d.current.temperature_2m=15;d.current.apparent_temperature=15;d.current.is_day=0;d.current.weather_code=0;d.current.precipitation=0;
d.daily.precipitation_probability_max[0]=6;
d.daily.precipitation_sum[0]=0;
d.daily.precipitation_probability_max[1]=42;
d.daily.precipitation_sum[1]=0.001;
d.daily.precipitation_probability_max[2]=88;
d.daily.precipitation_sum[2]=0.049;
d.daily.precipitation_probability_max[3]=75;
d.daily.precipitation_sum[3]=0.05;
d.daily.temperature_2m_min[0]=13;
d.daily.temperature_2m_max[0]=26;
d.daily.weather_code[0]=1;

const air={current:{european_aqi:20,us_aqi:25},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
let html=fs.readFileSync(path.join(__dirname,"public/index.html"),"utf8");
const fixedNow=Date.UTC(2026,7,25,23,55); // 01:55 CEST op 26 augustus
const stub=`<script>
Date.now=()=>${fixedNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Amsterdam",latitude:52.3676,longitude:4.9041,admin1:"Noord-Holland",country_code:"NL"}]})}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Amsterdam",land:"NL",bron:"test"})}
    :u.includes('/api/neerslag')?${JSON.stringify({beschikbaar:false,provider:"knmi",reden:"KNMI-neerslag tijdelijk niet beschikbaar"})}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const server=http.createServer((req,res)=>{
  const pathname=(req.url||"").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;
  }
  const rel=pathname.startsWith("/")?pathname.slice(1):pathname,file=path.join(__dirname,"public",rel);
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const ext=path.extname(file).toLowerCase(),types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(file).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

async function telUurAs(page){
  return page.evaluate(()=>{
    const chart=document.getElementById("chart"),g=S.geo||{},plotOnder=Number(g.pt)+Number(g.ih);
    if(!chart||!Number.isFinite(plotOnder))return 0;
    return [...chart.querySelectorAll("text")].filter(el=>{
      const tekst=String(el.textContent||"").trim(),y=Number(el.getAttribute("y"));
      return /^(?:[01]?\d|2[0-3])$/.test(tekst)&&Number.isFinite(y)&&y>=plotOnder+6&&!(el.closest&&el.closest('g[data-q4-rain-periods]'));
    }).length;
  });
}

async function controleer(browserType,naam){
  const browser=await browserType.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3});
    const page=await context.newPage(),fouten=[];
    page.on("pageerror",e=>fouten.push(String(e)));
    page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
    await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL`,{waitUntil:"networkidle"});
    await page.waitForSelector("#app",{state:"visible"});
    await page.evaluate(()=>document.fonts&&document.fonts.ready);
    await page.waitForTimeout(400);

    const voor=await page.evaluate(()=>{
      const zichtbaarTekst=el=>[...el.children].filter(c=>getComputedStyle(c).display!=="none").map(c=>c.textContent.trim()).join("")||el.textContent.trim();
      const plaats=document.getElementById("place"),rijen=[...document.querySelectorAll("#days .row.day:not(.kop)")],eerste=rijen[0],drain=eerste.querySelector(".drain"),chart=document.getElementById("chart");
      const tempLabels=[...chart.querySelectorAll("text")].filter(el=>/^-?\d+°$/.test((el.textContent||"").trim())&&/Bodoni/i.test(el.getAttribute("font-family")||""));
      const notities=[...document.querySelectorAll("#days .dag-neerslagnotitie")].map(el=>el.textContent.trim());
      const todayDescId=eerste.getAttribute("aria-describedby")||"",todayDesc=todayDescId&&document.getElementById(todayDescId);
      return {
        plaats:plaats.childNodes[0]&&plaats.childNodes[0].nodeValue?plaats.childNodes[0].nodeValue.trim():plaats.textContent.trim(),
        textTransform:getComputedStyle(plaats).textTransform,
        dag:zichtbaarTekst(eerste.querySelector(".dname")),
        neerslag:drain.innerText.replace(/\s+/g," ").trim(),
        neerslagRijen:rijen.slice(0,4).map(r=>(r.querySelector(".drain")?.innerText||"").replace(/\s+/g," ").trim()),
        dagenTekst:(document.getElementById("days").innerText||"").replace(/\s+/g," ").trim(),
        dagenHint:(document.getElementById("dagenhint").textContent||"").trim(),
        todayNote:(document.getElementById("final-today-window-note")?.textContent||"").trim(),
        losseUitleg:!!document.getElementById("dagenneerslaguitleg"),
        notities,
        describedBy:rijen.map(r=>r.getAttribute("aria-describedby")),
        todayDesc:todayDesc?(todayDesc.textContent||"").replace(/\s+/g," ").trim():"",
        todayAriaLabel:eerste.getAttribute("aria-label"),
        pressed:rijen.map(r=>r.getAttribute("aria-pressed")),
        tempLabels:tempLabels.length,
        overflow:document.documentElement.scrollWidth-window.innerWidth
      };
    });
    assert.deepEqual(fouten,[],`${naam}: geen runtimefouten`);
    assert.equal(voor.plaats,"Amsterdam",`${naam}: broncasing van plaatsnaam blijft intact`);
    assert.equal(voor.textTransform,"none",`${naam}: locatie erft geen uppercase h2-stijl`);
    assert.equal(voor.dag,"Vandaag",`${naam}: eerste lokale kalenderdag heet op mobiel Vandaag`);
    assert(/6%/.test(voor.neerslag)&&/0,0 mm/.test(voor.neerslag),`${naam}: 6% en bekende 0,0 mm staan samen zichtbaar (${voor.neerslag})`);
    assert(/42%/.test(voor.neerslagRijen[1])&&/88%/.test(voor.neerslagRijen[2])&&/75%/.test(voor.neerslagRijen[3]),`${naam}: neerslagkansen van bijzondere vervolgdagen blijven in de tabel zichtbaar (${voor.neerslagRijen.join(" | ")})`);
    assert.equal(voor.dagenHint,"Kies een dag om die verwachting in de grafiek te bekijken.",`${naam}: weekbedieningshint blijft een korte instructie (${voor.dagenHint})`);
    assert.equal(voor.todayNote,"Vandaag: neerslag geldt vanaf nu; minimum en maximum gelden voor de volledige dag.",`${naam}: zichtbare Vandaag-uitleg ontbreekt of wijkt af (${voor.todayNote})`);
    assert.equal(voor.losseUitleg,false,`${naam}: de oude algemene neerslaguitleg staat niet meer los boven de tabel`);
    assert.deepEqual(voor.notities,[],`${naam}: lange daggebonden neerslagnotities zijn volledig uit de weektabel verwijderd`);
    assert(!!voor.describedBy[0],`${naam}: Vandaag heeft aanvullende aria-describedby-uitleg`);
    assert(voor.describedBy.slice(1).every(v=>v===null),`${naam}: toekomstige dagen behouden hun bestaande toegankelijke naam zonder nieuwe beschrijving`);
    assert.equal(voor.todayAriaLabel,null,`${naam}: Vandaag krijgt geen vervangend aria-label`);
    assert(/6 procent; 0,0 millimeter/i.test(voor.todayDesc),`${naam}: kans en hoeveelheid worden gescheiden uitgesproken (${voor.todayDesc})`);
    assert(/minimum en maximum gelden voor de volledige kalenderdag/i.test(voor.todayDesc),`${naam}: aanvullende kalenderdaguitleg ontbreekt (${voor.todayDesc})`);
    for(const technisch of ["hoogste neerslagkans in één uur","berekende dagsom","verschillende modelwaarden","één op één samen te vallen"]){
      assert(!voor.dagenTekst.toLowerCase().includes(technisch.toLowerCase()),`${naam}: technische weekuitleg blijft verborgen: ${technisch}`);
    }
    assert(voor.pressed.every(v=>v==="false"),`${naam}: vóór selectie is geen dag als actief aangekondigd`);
    assert.ok(voor.tempLabels>=4,`${naam}: etmaalgrafiek toont meer dan alleen minimum en maximum (${voor.tempLabels})`);
    assert.ok(await telUurAs(page)>=4,`${naam}: eerste mobiele render toont minimaal vier gewone tijdlabels`);
    assert.ok(voor.overflow<=2,`${naam}: geen horizontale overflow (${voor.overflow}px)`);

    const dagRijen=page.locator("#days .row.day:not(.kop)");
    await dagRijen.nth(1).click();
    await page.waitForTimeout(400);
    assert.ok(await telUurAs(page)>=4,`${naam}: tijdlabels blijven zichtbaar na wisselen naar een andere dag`);

    await dagRijen.first().click();
    await page.waitForTimeout(400);
    assert.ok(await telUurAs(page)>=4,`${naam}: tijdlabels blijven zichtbaar na terugkeer naar Vandaag`);
    const na=await page.evaluate(()=>({
      kop:(document.getElementById("chartlab").textContent||"").trim(),
      hint:(document.getElementById("charthint").textContent||"").trim(),
      geselecteerd:document.querySelector("#days .row.day.on .dname")?.textContent||"",
      pressed:document.querySelector("#days .row.day.on")?.getAttribute("aria-pressed")||"",
      beschreven:document.querySelector("#days .row.day.on")?.getAttribute("aria-describedby")||""
    }));
    assert(/^Vandaag 26 augustus, per uur$/i.test(na.kop),`${naam}: gekozen lokale dag wordt als Vandaag benoemd (${na.kop})`);
    assert(/Kans op neerslag:\s*6%/i.test(na.hint)&&/verwachte hoeveelheid:\s*0,0 mm/i.test(na.hint),`${naam}: aangeklikte dag toont kans én hoeveelheid (${na.hint})`);
    assert(na.geselecteerd,`${naam}: aangeklikte dag blijft geselecteerd`);
    assert.equal(na.pressed,"true",`${naam}: geselecteerde dag wordt ook semantisch als actief aangekondigd`);
    assert.equal(na.beschreven,voor.describedBy[0],`${naam}: geselecteerde Vandaag-rij behoudt uitsluitend zijn nieuwe aanvullende aria-beschrijving`);
    await context.close();
  }finally{await browser.close();}
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    await controleer(chromium,"Chromium");
    await controleer(webkit,"WebKit");
    console.log("Mobiele feedback 26-08 groen: compacte weektabel, zichtbare Vandaag-uitleg, beschreven kans/hoeveelheid, mobiele tijdas, actieve dagstate en grafieklabels in Chromium/WebKit.");
  }finally{server.close();}
})().catch(err=>{console.error(err);process.exit(1);});

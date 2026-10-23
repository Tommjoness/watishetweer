"use strict";

/* Twee verschillende officiële meldingen zijn uit elkaar te houden. Aanleiding: Miami. De bron (NWS Miami) gaf op
   23 oktober 2026 twee afzonderlijke meldingen voor hetzelfde punt: een Rip Current Statement en een Coastal Flood
   Advisory (andere gebeurtenis, ander VTEC-nummer, andere ernst) met één gedeelde brontekst. De app kende voor
   beide geen Nederlandse titel en toonde daarom twee kaarten met dezelfde algemene kop, dezelfde uitleg en dezelfde
   geldigheid: twee vrijwel identieke blokken. Er was dus geen dubbel verwerkt object, maar wel twee kaarten die niet
   te onderscheiden waren. Gecontroleerd op het finale artifact (public/) in een echte browser, in Nederlands en Engels:
   - elke afzonderlijke melding blijft zichtbaar, met haar volledige officiële tekst (niets wordt samengevoegd);
   - Rip Current Statement en Coastal Flood Advisory hebben een eigen Nederlandse titel; rip current krijgt een korte uitleg;
   - zonder eigen titel krijgen meerdere meldingen elk hun officiële titel in de kop, een enkele melding blijft zoals hij was;
   - een werkelijk identiek object (zelfde titel, einde en gebied) blijft één kaart;
   - de briefing noemt de melding kort en eenmaal; er ontbreekt geen Engelse vertaling. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};

const d=bouw({temp:()=>22,tempNu:22,pp:()=>12,pr:()=>0,som:0,ws:2,wsNu:2,cc:()=>55,ccNu:55,wg:()=>8,wc:()=>3,wcNu:53});
Object.assign(d.current,{time:"2026-07-22T14:17",interval:900,temperature_2m:22,apparent_temperature:22,is_day:1,precipitation:0,weather_code:3,cloud_cover:55,wind_speed_10m:2,wind_direction_10m:225,wind_gusts_10m:8,pressure_msl:1014,visibility:16000});
d.elevation=3;d.latitude=25.77;d.longitude=-80.19;d.minutely_15=null;
d.daily.precipitation_probability_max=d.daily.time.map(()=>12);d.daily.precipitation_sum=d.daily.time.map(()=>0);d.daily.weather_code=d.daily.time.map(()=>3);d.daily.sunshine_duration=d.daily.time.map(()=>6*3600);
const air={current:{european_aqi:30,us_aqi:40},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const NU=Date.UTC(2026,6,22,12,17,0);

/* De gedeelde brontekst van het NWS-bulletin van Miami (CFW), zoals api/waarschuwingen hem teruggaf. */
const MIAMI_TEKST="* WHAT...For the Coastal Flood Advisory, moderate coastal flooding. For the High Rip Current Risk, dangerous rip currents. * WHERE...Coastal Broward County and Coastal Miami Dade County. * WHEN...For the Coastal Flood Advisory, until 8 PM EDT Saturday. For the High Rip Current Risk, until 8 PM EDT Saturday. * IMPACTS...Minor coastal flooding is expected.";
const nws=(titel,extra)=>Object.assign({titel,tekst:MIAMI_TEKST,niveau:"geel",niveauIsOfficieel:false,bronErnst:"Moderate",van:"2026-07-22T04:36:00Z",tot:"2026-07-23T00:00:00Z",gebied:"Coastal Broward County; Coastal Miami Dade County",plaatsSpecifiek:true,scope:"punt"},extra||{});

function bouwServer(lijst){
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const stub=`<script>Date.now=()=>${NU};window.fetch=async function(url){const u=String(url);
    const payload=u.includes('/api/neerslag')?${JSON.stringify({beschikbaar:false,reden:"test"})}:u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"National Weather Service",dekking:true,lijst,plaatsSpecifiek:true,land:"US"})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Miami",latitude:25.77,longitude:-80.19,admin1:"Florida",country_code:"US"}]})}:u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Miami",land:"US",bron:"test"})}:${JSON.stringify(d)};
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

const NL_ZONDER_VERTALING=/waarschuw|rip|coastal|beach|surf|stroming|overstroming|national weather|officiële/i;

const SITUATIES=[
  {naam:"Miami: Rip Current Statement en Coastal Flood Advisory",lijst:[nws("Rip Current Statement",{bronErnst:"Moderate"}),nws("Coastal Flood Advisory",{bronErnst:"Minor"})],
    kaarten:2,
    nl:{titels:["Melding over gevaarlijke stromingen (rip currents)","Advies voor overstroming aan de kust"],
      uitleg:[/een melding over gevaarlijke stromingen \(rip currents\) uitgegeven\. Een rip current is een sterke, smalle stroming die van de kust af loopt/,/een advies voor overstroming aan de kust uitgegeven\.$/],
      briefing:/^Officiële weerwaarschuwing: Melding over gevaarlijke stromingen \(rip currents\)\. /},
    en:{titels:["Rip current statement","Coastal flood advisory"],
      uitleg:[/has issued a rip current statement for this location\. A rip current is a strong, narrow current that flows away from the shore/,/has issued a coastal flood advisory for this location\./],
      briefing:/^Official weather warning: Rip current statement\. /},
    officieel:["Rip Current Statement","Coastal Flood Advisory"]},
  {naam:"twee meldingen zonder eigen Nederlandse titel",lijst:[nws("Beach Hazards Statement"),nws("High Surf Advisory")],
    kaarten:2,
    nl:{titels:["Officiële weerwaarschuwing: Beach Hazards Statement","Officiële weerwaarschuwing: High Surf Advisory"],
      uitleg:[/een officiële waarschuwing uitgegeven\.$/,/een officiële waarschuwing uitgegeven\.$/],
      briefing:/^Officiële weerwaarschuwing: Beach Hazards Statement\. /},
    en:{titels:["Official weather warning: Beach Hazards Statement","Official weather warning: High Surf Advisory"],
      uitleg:[/has issued an official warning for this location\./,/has issued an official warning for this location\./],
      briefing:/^Official weather warning: Beach Hazards Statement\. /},
    officieel:["Beach Hazards Statement","High Surf Advisory"]},
  {naam:"één melding zonder eigen titel blijft zoals hij was",lijst:[nws("Beach Hazards Statement")],
    kaarten:1,
    nl:{titels:["Officiële weerwaarschuwing"],uitleg:[/een officiële waarschuwing uitgegeven\.$/],briefing:/^Officiële weerwaarschuwing: Beach Hazards Statement\. /},
    en:{titels:["Official weather warning"],uitleg:[/has issued an official warning for this location\./],briefing:/^Official weather warning: Beach Hazards Statement\. /},
    officieel:["Beach Hazards Statement"]},
  {naam:"één titel met Nederlandse naam en één zonder: alleen de onbekende houdt de algemene kop",lijst:[nws("Rip Current Statement"),nws("Beach Hazards Statement")],
    kaarten:2,
    nl:{titels:["Melding over gevaarlijke stromingen (rip currents)","Officiële weerwaarschuwing"],uitleg:[/Een rip current is een sterke, smalle stroming/,/een officiële waarschuwing uitgegeven\.$/],briefing:/^Officiële weerwaarschuwing: Melding over gevaarlijke stromingen \(rip currents\)\. /},
    en:{titels:["Rip current statement","Official weather warning"],uitleg:[/A rip current is a strong, narrow current/,/has issued an official warning for this location\./],briefing:/^Official weather warning: Rip current statement\. /},
    officieel:["Rip Current Statement","Beach Hazards Statement"]},
  {naam:"werkelijk identiek object (zelfde titel, einde en gebied) wordt één kaart",lijst:[nws("Rip Current Statement"),nws("Rip Current Statement")],
    kaarten:1,
    nl:{titels:["Melding over gevaarlijke stromingen (rip currents)"],uitleg:[/Een rip current is een sterke, smalle stroming/],briefing:/^Officiële weerwaarschuwing: Melding over gevaarlijke stromingen \(rip currents\)\. /},
    en:{titels:["Rip current statement"],uitleg:[/A rip current is a strong, narrow current/],briefing:/^Official weather warning: Rip current statement\. /},
    officieel:["Rip Current Statement"]},
  {naam:"zelfde titel, ander einde: afzonderlijke meldingen blijven afzonderlijk",lijst:[nws("Rip Current Statement"),nws("Rip Current Statement",{tot:"2026-07-24T00:00:00Z"})],
    kaarten:2,
    nl:{titels:["Melding over gevaarlijke stromingen (rip currents)","Melding over gevaarlijke stromingen (rip currents)"],uitleg:[/Een rip current/,/Een rip current/],briefing:/^Officiële weerwaarschuwing: Melding over gevaarlijke stromingen \(rip currents\)\. /},
    en:{titels:["Rip current statement","Rip current statement"],uitleg:[/A rip current/,/A rip current/],briefing:/^Official weather warning: Rip current statement\. /},
    officieel:["Rip Current Statement","Rip Current Statement"]}
];

async function meet(page){
  return page.evaluate(()=>{
    const t=el=>((el&&el.textContent)||"").replace(/\s+/g," ").trim();
    const kaarten=[...document.querySelectorAll("#waarschuwingen .waarsch")].map(k=>({
      titel:t(k.querySelector("h3")),severity:k.getAttribute("data-ui-severity"),
      uitleg:t(k.querySelector(".final-warning-explanation")),
      officieleTitel:t(k.querySelector(".final-warning-official-meta span")),
      officieleTekst:t(k.querySelector(".final-warning-official-text")),
      geldig:t(k.querySelector(".waarsch-meta"))}));
    return {kaarten,brief:t(document.getElementById("brief")),actief:(S.actieveWaarschuwingen||[]).length,
      /* Alleen wat na de laatste render nog onvertaald op de pagina staat; een tussenstand die direct door de
         verrijkte kaart wordt vervangen telt niet. */
      ontbreekt:[...(window.__WIW_TAAL_ONTBREEKT__||[])].filter(x=>document.body.textContent.replace(/\s+/g," ").includes(x))};
  });
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let n=0;
  try{
    for(const taal of ["nl","en"])for(const sit of SITUATIES){
      const en=taal==="en",L=`${taal}: ${sit.naam}`,verwacht=sit[taal];
      const srv=bouwServer(sit.lijst);await new Promise(r=>srv.listen(0,"127.0.0.1",r));
      const context=await browser.newContext({viewport:{width:1280,height:900},locale:en?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
      try{
        const page=await context.newPage(),fouten=[];
        page.on("pageerror",e=>fouten.push(String(e)));
        if(en)await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
        await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=25.77&lon=-80.19&plaats=Miami&land=US`,{waitUntil:"networkidle"});
        await page.waitForFunction(()=>document.querySelectorAll("#waarschuwingen .waarsch .final-warning-explanation").length>0,null,{timeout:10000});
        await page.waitForTimeout(1500);
        const r=await meet(page);

        assert.equal(r.kaarten.length,sit.kaarten,`${L}: aantal kaarten (${r.kaarten.map(k=>k.titel)})`);
        assert.equal(r.actief,sit.kaarten,`${L}: de actieve waarschuwingen in de app`);
        assert.deepEqual(r.kaarten.map(k=>k.titel),verwacht.titels,`${L}: titels`);
        r.kaarten.forEach((k,i)=>{
          assert.match(k.uitleg,verwacht.uitleg[i],`${L}: uitleg van kaart ${i+1}: "${k.uitleg}"`);
          /* Niets wordt samengevoegd of ingekort: de volledige officiële tekst en de officiële titel blijven bij elke kaart. */
          assert.equal(k.officieleTekst,MIAMI_TEKST,`${L}: officiële tekst van kaart ${i+1} blijft volledig`);
          assert.equal(k.officieleTitel,sit.officieel[i],`${L}: officiële titel van kaart ${i+1} blijft letterlijk`);
          assert.equal(k.severity,"geel",`${L}: ernst van kaart ${i+1} blijft`);
          assert(k.geldig.length>0,`${L}: geldigheid van kaart ${i+1} blijft`);
        });
        assert.match(r.brief,verwacht.briefing,`${L}: de briefing noemt de melding kort: "${r.brief}"`);
        assert.equal((r.brief.match(/Officiële weerwaarschuwing|Official weather warning/g)||[]).length,1,`${L}: de briefing noemt de melding één keer`);
        r.kaarten.forEach((k,i)=>assert.match(k.uitleg,en?/^Explanation from watishetweer\.nl: /:/^Uitleg van watishetweer\.nl: /,`${L}: kaart ${i+1} behoudt het uitlegkopje`));
        if(en){
          const weg=r.ontbreekt.filter(s=>NL_ZONDER_VERTALING.test(s));
          assert.deepEqual(weg,[],`${L}: geen onvertaalde waarschuwingstekst: ${JSON.stringify(weg)}`);
          r.kaarten.forEach((k,i)=>assert.doesNotMatch(k.titel+" "+k.uitleg,/Officiële|Uitleg van|weerdienst|gevaarlijke|overstroming/,`${L}: kaart ${i+1} is volledig Engels`));
        }
        assert.deepEqual(fouten,[],`${L}: scriptfouten`);
        n++;
      }finally{await context.close();srv.close();}
    }
    console.log(`Waarschuwingen onderscheiden: ${n} situaties (NL/EN): afzonderlijke meldingen blijven elk volledig zichtbaar met eigen titel, rip current heeft een korte uitleg, identieke objecten blijven één kaart, briefing noemt de melding eenmaal.`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

"use strict";

/* Mobiele detailkaart (#tip-strook, tot en met 429 px): toegankelijkheid van alle acht gegevens.
   Gecontroleerd op DOM, ARIA-attributen en de toegankelijkheidsboom van Playwright (ariaSnapshot; dat is een afgeleide boom en GEEN echte
   schermlezer; echte NVDA-, VoiceOver- of TalkBack-tests vallen hier buiten):
   A. een gevulde kaart is een groep met de naam "Details voor <kop>" (dezelfde tijdcontext als de kop: dagnaam, "morgen", zomer-/wintertijd) en
      bevat acht term/definitie-paren met de verwachte teksten; een ontbrekende waarde klinkt als "niet beschikbaar" (nooit "–");
   B. de richting is zichtbaar een afkorting (WZW) en voor hulptechnologie uitsluitend de volledige naam (westzuidwesten), voor alle zestien vakken in NL en EN;
      de windroos is decoratief en komt niet in de boom;
   C. geldige HTML: een dl bevat alleen div's met dt+dd, vier dl's, unieke id's voor de naam, geen aria-live in de kaart, de live-region en de
      aria-valuetext van de slider blijven de korte tekst (geen dubbele aankondiging);
   D. aria-details op de slider alleen als de kaart zichtbaar, gevuld en toegankelijk is: niet bij een lege kaart, niet bij de melding "Geen uurgegevens",
      niet bij 430 px of breder, en het volgt een resize over de grens 429/430 px in beide richtingen;
   E. overgangen: een ander uur, een verversing met andere gegevens (ook andere plaats), en leeg naar gevuld en terug laten geen oude gegevens of attributen staan.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");

const OUT=process.env.WIW_PUBLIC||path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(OUT,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const UUR=3600000,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const iso=(ms,off)=>new Date(ms+off*1000).toISOString().slice(0,16);

/* Zes weerscenario's, gekozen op het UTC-uur (u % 6): normaal, extreem (langste waarden), droog, kleine hoeveelheid, ontbrekende waarden, vorst met sneeuw. */
const SC=[
  {T:12.4,A:10.2,P:8,MM:0.2,W:19,WD:0,G:35,C:30,code:2},
  {T:-40.4,A:-45.2,P:100,MM:123.4,W:250.4,WD:250,G:250.2,C:100,code:99},
  {T:3.2,A:1.1,P:0,MM:0,W:8,WD:90,G:20,C:0,code:0},
  {T:7.6,A:5.9,P:30,MM:0.04,W:22,WD:180,G:48,C:55,code:3},
  {T:9.4,A:7.4,P:40,MM:null,W:14,WD:null,G:null,C:80,code:61},
  {T:-5.4,A:-9.6,P:65,MM:1.46,W:105,WD:200,G:118.4,C:100,code:71}];
/* Verwachte kaartwaarden per scenario (Nederlands): temperatuur, voelt als, neerslagkans, neerslag, windstoten, bewolking. */
const VERWACHT=[
  ["12°C","10°C","8%","0,2 mm","35 km/u","30%"],
  ["-40°C","-45°C","100%","123,4 mm","250 km/u","100%"],
  ["3°C","1°C","0%","0,0 mm","20 km/u","0%"],
  ["8°C","6°C","30%","<0,1 mm","48 km/u","55%"],
  ["9°C","7°C","40%","–","–","80%"],
  ["-5°C","-10°C","65%","1,5 mm","118 km/u","100%"]];
/* Verwachte windkracht en kompasrichting (NL) per scenario; de windroos krijgt de graden uit SC (null: geen windroos). */
const WIND=[["19 km/u · 3 Bft","N"],["250 km/u · 12 Bft","WZW"],["8 km/u · 2 Bft","O"],["22 km/u · 4 Bft","Z"],["14 km/u · 3 Bft","–"],["105 km/u · 11 Bft","ZZW"]];
const RICHTING_EN={N:"N",WZW:"WSW",O:"E",Z:"S",ZZW:"SSW","–":"–"};
/* Open-Meteo-vormig antwoord op één vaste offset, met scenario-gestuurde uurwaarden. */
function antwoord(nuMs,offsetS,opties){
  const o=opties||{};
  const lokaalNu=iso(nuMs,offsetS),vandaag=lokaalNu.slice(0,10);
  const dag0=Date.parse(vandaag+"T00:00:00Z")-offsetS*1000,start=dag0-24*UUR,uren=8*24;
  const h={time:[],temperature_2m:[],apparent_temperature:[],relative_humidity_2m:[],dew_point_2m:[],precipitation_probability:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[],cloud_cover:[],wind_speed_10m:[],wind_direction_10m:[],wind_gusts_10m:[],visibility:[],uv_index:[],pressure_msl:[],is_day:[]};
  for(let i=0;i<uren;i++){
    const ms=start+i*UUR,u=new Date(ms).getUTCHours(),s=SC[u%6],vorig=SC[(u+5)%6];
    h.time.push(iso(ms,offsetS));
    h.temperature_2m.push(s.T);h.apparent_temperature.push(s.A);h.relative_humidity_2m.push(80);h.dew_point_2m.push(s.T-4);
    /* Kans en hoeveelheid horen bij het uur dat op TI[k] begint: bronindex +1 (zie etmaal). */
    h.precipitation_probability.push(vorig.P);h.precipitation.push(vorig.MM);h.rain.push(vorig.MM);h.showers.push(0);h.snowfall.push(0);
    h.weather_code.push(s.code);h.cloud_cover.push(s.C);
    h.wind_speed_10m.push(s.W);h.wind_direction_10m.push(o.wd?o.wd(u):s.WD);h.wind_gusts_10m.push(s.G);h.visibility.push(20000);h.uv_index.push(0);h.pressure_msl.push(1015);h.is_day.push(u>=6&&u<16?1:0);
  }
  const dagen=Array.from({length:7},(_,k)=>new Date(Date.parse(vandaag+"T00:00:00Z")+k*86400000).toISOString().slice(0,10));
  const uurIndex=h.time.indexOf(iso(Math.floor(nuMs/UUR)*UUR,offsetS)),kwartier=Math.floor(nuMs/900000)*900000;
  return {latitude:52.37,longitude:4.9,timezone:"Europe/Amsterdam",timezone_abbreviation:offsetS===7200?"GMT+2":"GMT+1",utc_offset_seconds:offsetS,
    current:{time:iso(kwartier,offsetS),temperature_2m:h.temperature_2m[uurIndex]==null?10:h.temperature_2m[uurIndex],apparent_temperature:9,relative_humidity_2m:80,is_day:h.is_day[uurIndex],precipitation:0,rain:0,showers:0,snowfall:0,weather_code:2,cloud_cover:30,pressure_msl:1015,wind_speed_10m:12,wind_direction_10m:240,wind_gusts_10m:25,visibility:20000},
    minutely_15:{time:Array.from({length:20},(_,k)=>iso(kwartier+(k-4)*900000,offsetS)),precipitation:Array(20).fill(0),rain:Array(20).fill(0),showers:Array(20).fill(0),snowfall:Array(20).fill(0),weather_code:Array(20).fill(2)},
    hourly:h,
    daily:{time:dagen,weather_code:dagen.map(()=>2),temperature_2m_max:dagen.map(()=>14),temperature_2m_min:dagen.map(()=>6),sunrise:dagen.map(d=>iso(Date.parse(d+"T05:30:00Z"),offsetS)),sunset:dagen.map(d=>iso(Date.parse(d+"T16:30:00Z"),offsetS)),
      precipitation_probability_max:dagen.map(()=>20),precipitation_sum:dagen.map(()=>0),uv_index_max:dagen.map(()=>1),wind_speed_10m_max:dagen.map(()=>20),wind_gusts_10m_max:dagen.map(()=>30),wind_direction_10m_dominant:dagen.map(()=>240),sunshine_duration:dagen.map(()=>18000)}};
}

const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,"http://localhost").pathname);if(p.endsWith("/"))p+="index.html";
  let f=path.join(OUT,p);if(!fs.existsSync(f)&&fs.existsSync(f+".html"))f+=".html";
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,{w,h,nuIso,offsetS,taal,opties}){
  const nuMs=Date.parse(nuIso),mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:h||900},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(([e,taal])=>{const N=Date,s=N.now();class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;
    try{if(taal)localStorage.setItem("weerbriefing.taal.v1",JSON.stringify(taal));}catch(x){}},[nuMs,taal==="en"?"en":null]);
  const bron={data:antwoord(nuMs,offsetS,opties)};
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:bron.data});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:[bron.data.current.time.slice(0,13)+":00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],olive_pollen:[0],ragweed_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/amsterdam/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:20000});
  await page.waitForFunction(()=>document.querySelectorAll("#days .row.day").length>=7&&document.getElementById("scrub")&&(((document.getElementById("scrub").dataset.modus)&&document.querySelectorAll("#wiw-hour-table tbody tr").length>0)||((document.getElementById("tip-strook")||{}).dataset&&document.getElementById("tip-strook").dataset.leeg)),null,{timeout:20000});
  await sleep(500);
  return {context,page,fouten,bron};
}


const geoXY=(page,ms)=>page.evaluate(ms=>{
  const G=S.geo,svg=document.getElementById("chart");svg.scrollIntoView({block:"center"});
  const k=WeatherNowInterpretatie.indexVoorInstant(G.TI,S.d.utc_offset_seconds,ms);if(k<0)return null;
  const r=svg.getBoundingClientRect(),sc=r.width/(G.W||900);return {k,x:r.left+G.x(k)*sc,y:r.top+G.y(G.T[k])*sc};
},ms);

const eerlijk=async (page,fouten,wat)=>{assert.deepEqual(fouten,[],wat+": scriptfouten "+fouten.join(" | "));};
let n=0;const ok=(c,m)=>{assert(c,m);n++;};const gelijk=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};
const enGetal=t=>t.replace(",",".").replace("km/u","km/h");
const DIRSKORT=["N","NNO","NO","ONO","O","OZO","ZO","ZZO","Z","ZZW","ZW","WZW","W","WNW","NW","NNW"];
const DIRSVOL=["noorden","noordnoordoosten","noordoosten","oostnoordoosten","oosten","oostzuidoosten","zuidoosten","zuidzuidoosten","zuiden","zuidzuidwesten","zuidwesten","westzuidwesten","westen","westnoordwesten","noordwesten","noordnoordwesten"];
const DIRSVOL_EN=["north","north-north-east","north-east","east-north-east","east","east-south-east","south-east","south-south-east","south","south-south-west","south-west","west-south-west","west","west-north-west","north-west","north-north-west"];
const DIRSKORT_EN=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const VOL_VAN={nl:{N:DIRSVOL[0],WZW:DIRSVOL[11],O:DIRSVOL[4],Z:DIRSVOL[8],ZZW:DIRSVOL[9],"–":null},en:{N:DIRSVOL_EN[0],WZW:DIRSVOL_EN[11],O:DIRSVOL_EN[4],Z:DIRSVOL_EN[8],ZZW:DIRSVOL_EN[9],"–":null}};

/* Leest de toegankelijkheidsboom van Playwright (ariaSnapshot) van een element en zet hem om in naam, tekst en term/definitie-paren. */
async function boom(page,selector){
  const t=await page.locator(selector).ariaSnapshot({timeout:3000}).catch(()=>"");
  const regels=t.split("\n").map(r=>r.replace(/^\s*-\s*/,"").trim()).filter(Boolean);
  const groep=regels.map(r=>/^group(?: "(.*)")?:?$/.exec(r)).find(Boolean);
  /* ariaSnapshot zet waarden die als YAML-getal of -teken beginnen tussen aanhalingstekens ("-40°C"). */
  const los=x=>/^".*"$/.test(x)?x.slice(1,-1):x;
  const termen=regels.filter(r=>r.startsWith("term: ")).map(r=>los(r.slice(6))),defs=regels.filter(r=>r.startsWith("definition: ")).map(r=>los(r.slice(12)));
  const tekst=regels.filter(r=>r.startsWith("text: ")).map(r=>los(r.slice(6)));
  return {ruw:t,leeg:t.trim()==="",groepNaam:groep?(groep[1]||""):null,termen,defs,tekst,regels};
}
const lees=page=>page.evaluate(()=>{
  const st=document.getElementById("tip-strook"),hit=document.getElementById("hit"),kop=st.querySelector(".tip-kop");
  const dls=[...st.querySelectorAll("dl")];
  return {aria:st.getAttribute("aria-hidden"),rol:st.getAttribute("role"),labelledby:st.getAttribute("aria-labelledby"),details:hit?hit.getAttribute("aria-details"):"geen hit",
    display:getComputedStyle(st).display,kinderen:st.childElementCount,leegVlag:st.dataset.leeg||null,kop:kop?kop.textContent:null,
    titelId:document.querySelectorAll('[id="tip-titel"]').length,kopId:document.querySelectorAll('[id="tip-kop"]').length,
    live:st.querySelectorAll("[aria-live],[role=status],[role=alert],[role=log]").length+(st.closest("[aria-live]")?1:0),
    status:(document.getElementById("wiw-uur-status")||{}).textContent||"",valuetext:hit?hit.getAttribute("aria-valuetext"):null,
    dlAantal:dls.length,dlGeneste:dls.filter(d=>d.querySelector("dl")||d.parentElement.closest("dl")).length,
    dlGeldig:dls.every(d=>[...d.children].every(c=>c.tagName==="DIV"&&c.children.length===2&&c.children[0].tagName==="DT"&&c.children[1].tagName==="DD")),
    dlKinderen:dls.map(d=>d.children.length),
    wrapper:(st.querySelector(".tip-rijen")||{tagName:null}).tagName,
    zichtbareAfk:[...st.querySelectorAll("dd>span[aria-hidden='true']")].map(e=>e.textContent),srTeksten:[...st.querySelectorAll(".sr-only")].map(e=>e.textContent),
    roosAria:[...st.querySelectorAll(".tip-roos")].map(e=>e.getAttribute("aria-hidden"))};
});
const tik=async(page,iso)=>{
  const pv=await geoXY(page,Date.parse(iso));assert(pv,"uur staat in de grafiek: "+iso);
  await page.touchscreen.tap(pv.x,pv.y);await sleep(350);
};
const SPEECH_MISSING={nl:"niet beschikbaar",en:"not available"};
const verwachtDefs=(sc,taal)=>{
  const v=VERWACHT[sc].map(x=>taal==="en"?enGetal(x):x),w=taal==="en"?enGetal(WIND[sc][0]):WIND[sc][0],rKort=WIND[sc][1];
  const alles=[v[0],v[1],v[2],v[3],w,rKort==="–"?"–":(VOL_VAN[taal][rKort]),v[4],v[5]];
  return alles.map(x=>x==="–"?SPEECH_MISSING[taal]:x);
};
const termenVan=taal=>taal==="en"?["temperature","feels like","precip. chance","precip.","wind","direction","gusts","cloud cover"]:["temperatuur","voelt als","neerslagkans","neerslag","wind","richting","windstoten","bewolking"];

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    const NU="2026-07-22T12:10:00Z",OFFSET=7200;
    /* A, B, C: groep, term/definitie-paren, ontbrekend, richting, geldige HTML, geen live-regio's; 320, 390 en 429 px, NL en EN. */
    for(const w of [320,390,429])for(const taal of ["nl","en"]){
      const L=w+"px "+taal;
      const {context,page,fouten}=await open(browser,root,{w,nuIso:NU,offsetS:OFFSET,taal:taal==="en"?"en":undefined});
      try{
        for(const u of [18,13,16]){
          const sc=u%6;await tik(page,"2026-07-22T"+String(u).padStart(2,"0")+":00:00Z");
          const m=await lees(page),b=await boom(page,"#tip-strook"),T=L+" uur "+u+": ";
          /* A. groep met naam = "Details voor" + de kop; acht paren; ontbrekend = niet beschikbaar */
          gelijk([m.aria,m.rol,m.labelledby],[null,"group","tip-titel tip-kop"],T+"gevulde kaart is een toegankelijke groep");
          gelijk(b.groepNaam,(taal==="en"?"Details for ":"Details voor ")+m.kop,T+"groepsnaam gebruikt de volledige tijdcontext van de kop ("+b.groepNaam+")");
          gelijk(b.termen,termenVan(taal),T+"termen");
          gelijk(b.defs,verwachtDefs(sc,taal),T+"definities (waarden, 'niet beschikbaar', volledige richting)");
          ok(b.regels.every(r=>!/\b(img|button|link)\b/.test(r)),T+"geen onverwachte elementen in de kaart (windroos hoort er niet in): "+b.regels.join(" | "));
          ok(!b.ruw.includes("–"),T+"het streepje wordt niet voorgelezen");
          ok(!b.defs.some(x=>x===(WIND[sc][1]==="–"?"?":(taal==="en"?RICHTING_EN[WIND[sc][1]]:WIND[sc][1]))),T+"de afkorting van de richting staat niet in de boom ("+b.defs.join(",")+")");
          /* B. afkorting zichtbaar maar verborgen voor hulptechnologie; volledige tekst alleen voor hulptechnologie; windroos decoratief */
          if(WIND[sc][1]!=="–"){
            gelijk(m.zichtbareAfk.includes(taal==="en"?RICHTING_EN[WIND[sc][1]]:WIND[sc][1]),true,T+"de afkorting blijft zichtbaar");
            gelijk(m.roosAria,["true"],T+"windroos is aria-hidden");
          }else gelijk(m.roosAria,[],T+"zonder richting geen windroos");
          /* C. geldige HTML */
          gelijk([m.wrapper,m.dlAantal,m.dlGeneste,m.dlGeldig,m.dlKinderen.join()],["DIV",4,0,true,"2,2,2,2"],T+"vier geldige dl's (dl > div > dt+dd), geen geneste dl");
          gelijk([m.titelId,m.kopId],[1,1],T+"unieke id's voor de naam van de groep");
          gelijk(m.live,0,T+"geen aria-live, status of alert in de kaart");
          ok(taal==="en"||new RegExp("^Geselecteerd: "+String(u+2).padStart(2,"0")+":00, -?\\d+ graden, \\d+ procent neerslagkans$").test(m.status),T+"de live-region blijft de korte tekst ("+m.status+")");
          ok(!/wind|gust|bewolk|richting|km\/u/i.test(m.status+m.valuetext),T+"geen details in de korte aankondiging ("+m.status+" / "+m.valuetext+")");
          /* D. verwijzing van de slider */
          gelijk(m.details,"tip-strook",T+"aria-details verwijst naar de gevulde kaart");
        }
        await eerlijk(page,fouten,L);
      }finally{await context.close();}
    }

    /* B. alle zestien kompasvakken, NL en EN: zichtbaar de afkorting, in de boom alleen de volledige naam */
    for(const taal of ["nl","en"]){
      const WD16=Array.from({length:16},(_,k)=>k*22.5);
      const wd=u=>WD16[(u>=13?u-13:u+11)%16];   // uur 13Z is k=0; na middernacht (0Z) is dat k=11
      const {context,page,fouten}=await open(browser,root,{w:390,nuIso:NU,offsetS:OFFSET,taal:taal==="en"?"en":undefined,opties:{wd}});
      try{
        for(let k=0;k<16;k++){
          const instant=new Date(Date.parse("2026-07-22T13:00:00Z")+k*UUR).toISOString();await tik(page,instant);
          const b=await boom(page,"#tip-strook"),m=await lees(page),T=taal+" richting "+k*22.5+"°: ";
          const afk=(taal==="en"?DIRSKORT_EN:DIRSKORT)[k],vol=(taal==="en"?DIRSVOL_EN:DIRSVOL)[k];
          gelijk(b.defs[5],vol,T+"in de boom staat alleen de volledige richting");
          ok(!b.defs.includes(afk)&&!b.regels.some(r=>new RegExp("(^|[^A-Za-z-])"+afk+"([^A-Za-z-]|$)").test(r.replace(/^\w+: /,"")))||afk===vol,T+"de afkorting "+afk+" staat niet in de boom ("+b.regels.join(" | ")+")");
          gelijk(m.zichtbareAfk.includes(afk),true,T+"de afkorting is zichtbaar");
          gelijk(m.srTeksten.filter(t=>t===vol).length,1,T+"de volledige richting staat precies één keer in de kaart");
        }
        await eerlijk(page,fouten,"zestien richtingen "+taal);
      }finally{await context.close();}
    }

    /* A. tijdcontext in de groepsnaam: morgen, en een dubbel klokuur bij de najaarswissel */
    for(const taal of ["nl","en"]){
      const {context,page,fouten}=await open(browser,root,{w:390,nuIso:NU,offsetS:OFFSET,taal:taal==="en"?"en":undefined});
      try{
        await tik(page,"2026-07-23T05:00:00Z");
        let m=await lees(page),b=await boom(page,"#tip-strook");
        ok(/^(Morgen|Tomorrow)\b/i.test(m.kop),taal+": de kop heeft de dagaanduiding ("+m.kop+")");
        gelijk(b.groepNaam,(taal==="en"?"Details for ":"Details voor ")+m.kop,taal+": de groepsnaam behoudt 'morgen' ("+b.groepNaam+")");
      }finally{await context.close();}
      const w2=await open(browser,root,{w:390,nuIso:"2026-10-24T23:30:00Z",offsetS:OFFSET,taal:taal==="en"?"en":undefined});
      try{
        const page=w2.page,winter=String(Date.parse("2026-10-25T01:00:00Z"));
        let m=await lees(page),b=await boom(page,"#tip-strook");
        ok(/02:00 \(/.test(m.kop),taal+": het eerste 02:00-uur heeft een aanduiding ("+m.kop+")");
        gelijk(b.groepNaam,(taal==="en"?"Details for ":"Details voor ")+m.kop,taal+": groepsnaam eerste 02:00 ("+b.groepNaam+")");
        const eerste=b.groepNaam;
        await page.locator('#wiw-hour-table tbody tr[data-instant="'+winter+'"] .wiw-hour-pick').click();await sleep(350);
        m=await lees(page);b=await boom(page,"#tip-strook");
        gelijk(b.groepNaam,(taal==="en"?"Details for ":"Details voor ")+m.kop,taal+": groepsnaam tweede 02:00 ("+b.groepNaam+")");
        ok(b.groepNaam!==eerste,taal+": de twee klokuren 02:00 zijn in de groepsnaam te onderscheiden ("+eerste+" tegen "+b.groepNaam+")");
        ok(/\(.+\)/.test(b.groepNaam),taal+": de aanduiding zomer-/wintertijd staat in de groepsnaam");
        await eerlijk(w2.page,w2.fouten,"najaarswissel "+taal);
      }finally{await w2.context.close();}
    }

    /* D. desktop en resize over de grens 429/430 px */
    {
      const {context,page,fouten}=await open(browser,root,{w:1440,nuIso:NU,offsetS:OFFSET});
      try{
        const m=await lees(page),b=await boom(page,"#tip-strook");
        gelijk([m.display,m.details],["none",null],"1440 px: kaart verborgen en geen aria-details");ok(b.leeg,"1440 px: de kaart staat niet in de toegankelijkheidsboom");
        await eerlijk(page,fouten,"desktop");
      }finally{await context.close();}
    }
    {
      const {context,page,fouten}=await open(browser,root,{w:429,nuIso:NU,offsetS:OFFSET});
      try{
        await tik(page,"2026-07-22T15:00:00Z");
        for(const [w,verwacht] of [[429,true],[430,false],[1000,false],[429,true],[320,true],[431,false],[390,true]]){
          await page.setViewportSize({width:w,height:900});await sleep(500);
          const m=await lees(page),b=await boom(page,"#tip-strook"),T="resize naar "+w+" px: ";
          gelijk(m.details,verwacht?"tip-strook":null,T+"aria-details alleen als de kaart zichtbaar is");
          gelijk(m.display!=="none",verwacht,T+"zichtbaarheid van de kaart");
          gelijk(!b.leeg,verwacht,T+"de kaart staat alleen in de toegankelijkheidsboom als hij zichtbaar is");
          if(verwacht)gelijk(b.termen.length,8,T+"acht termen na terugkeer");
        }
        await eerlijk(page,fouten,"resize");
      }finally{await context.close();}
    }

    /* D, E. leeg en gevuld: melding "Geen uurgegevens", terug naar een uur, een ander uur en een verversing met andere gegevens (andere plaats) */
    {
      const {context,page,fouten,bron}=await open(browser,root,{w:390,nuIso:NU,offsetS:OFFSET});
      try{
        await tik(page,"2026-07-22T15:00:00Z");
        let m=await lees(page),b=await boom(page,"#tip-strook");
        gelijk([m.rol,m.details,b.termen.length],["group","tip-strook",8],"E: begin gevuld");
        const eerste=b.defs.join("|"),eersteNaam=b.groepNaam;
        /* een ander uur: andere gegevens, geen oude attributen of dubbele id's */
        await tik(page,"2026-07-22T13:00:00Z");
        m=await lees(page);b=await boom(page,"#tip-strook");
        ok(b.defs.join("|")!==eerste&&b.groepNaam!==eersteNaam,"E: een ander uur geeft andere gegevens en een andere naam ("+b.groepNaam+")");
        gelijk([m.titelId,m.kopId,m.dlAantal,m.live],[1,1,4,0],"E: na een uurwissel één titel, één kop, vier dl's en geen live");
        /* de melding 'Geen uurgegevens' (zoals bij een dag zonder geldige uren) */
        await page.evaluate(()=>uurLegeToestand(document.getElementById("tip-strook"),true));await sleep(200);
        m=await lees(page);b=await boom(page,"#tip-strook");
        gelijk([m.aria,m.rol,m.labelledby,m.details,m.leegVlag],["true",null,null,null,"1"],"D: bij de melding geen groep, wel aria-hidden en geen aria-details van de slider");
        ok(b.leeg,"D: de melding staat niet in de toegankelijkheidsboom");ok(/Geen uurgegevens/.test(m.kop),"D: de melding is zichtbaar ("+m.kop+")");
        /* terug naar een uur: alles weer toegankelijk, niets van de melding blijft staan */
        await tik(page,"2026-07-22T16:00:00Z");
        m=await lees(page);b=await boom(page,"#tip-strook");
        gelijk([m.aria,m.rol,m.labelledby,m.details,m.leegVlag],[null,"group","tip-titel tip-kop","tip-strook",null],"E: na de melding weer een gevulde, toegankelijke kaart zonder resten van de melding");
        gelijk([b.termen.length,m.dlAantal],[8,4],"E: acht gegevens na de melding");
        /* verversing met andere gegevens en een andere plaats: de kaart volgt, geen oude waarden */
        const h=bron.data.hourly;h.temperature_2m=h.temperature_2m.map(()=>-7.4);h.apparent_temperature=h.apparent_temperature.map(()=>-12.4);
        await page.evaluate(()=>{S.lat=51.92;S.lon=4.48;S.op=0;});await page.evaluate(()=>weatherNowVerversTick());await sleep(1200);
        m=await lees(page);b=await boom(page,"#tip-strook");
        ok(b.defs[0]==="-7°C"&&b.defs[1]==="-12°C","E: na een verversing met andere gegevens staan de nieuwe waarden in de kaart, niet de oude ("+b.defs.slice(0,2)+")");
        gelijk([m.rol,m.details,m.aria,m.titelId,m.kopId,m.live],["group","tip-strook",null,1,1,0],"E: na de verversing consistente attributen en geen dubbele id's");
        gelijk(b.groepNaam,"Details voor "+m.kop,"E: de groepsnaam volgt de kop na de verversing");
        await eerlijk(page,fouten,"leeg en gevuld");
      }finally{await context.close();}
    }
    console.log(`Detailkaart toegankelijkheid: ${n} controles geslaagd (groep met volledige tijdcontext, acht term/definitie-paren, ontbrekend, zestien richtingen in NL en EN, geldige HTML, geen live-regio's, aria-details alleen bij een zichtbare gevulde kaart, resize over 429/430 px, leeg en gevuld). Toegankelijkheidsboom van Playwright; geen echte schermlezer.`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

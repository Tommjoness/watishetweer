"use strict";
const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
const {bouw}=require("./data.js");

function vindBrowser(){
  for(const naam of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync("sh",["-lc","command -v "+naam],{encoding:"utf8"});
    if(r.status===0&&r.stdout.trim())return r.stdout.trim();
  }
  return null;
}
const browser=vindBrowser();
if(!browser){
  if(process.env.CI){console.error("FOUT gedeelde plaatsidentiteit: Chrome/Chromium ontbreekt op CI.");process.exit(1);}
  console.log("SKIP gedeelde plaatsidentiteit: lokaal geen Chrome/Chromium gevonden.");process.exit(0);
}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt voor gedeelde plaatsidentiteit.");
const basisHtml=fs.readFileSync(productie,"utf8");
if(!basisHtml.includes("/* ===== GEDEELDE URL PLAATSIDENTITEIT ===== */"))throw new Error("Gedeelde plaatsidentiteitslaag ontbreekt in artifact.");

function weerVoor(geval){
  const d=bouw({tempNu:geval.temp||18,wcNu:1,ccNu:25});
  d.current.interval=900;d.current.visibility=16000;d.latitude=geval.lat;d.longitude=geval.lon;d.elevation=10;
  d.timezone=geval.tz||"UTC";d.timezone_abbreviation="TEST";d.utc_offset_seconds=0;
  d.daily.sunshine_duration=d.daily.time.map(()=>7*3600);
  return d;
}
const antwoord=data=>`{ok:true,status:200,json:async()=>(${JSON.stringify(data)}),text:async()=>JSON.stringify(${JSON.stringify(data)})}`;

function fixture(geval){
  let html=basisHtml;const weer=weerVoor(geval);
  const air={current:{european_aqi:22,us_aqi:45},hourly:{time:[weer.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
  const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
window.__identity={reverse:0,forward:0,warningUrl:''};
window.fetch=function(url){
  const u=String(url);
  if(u.includes('/api/plaatsnaam')){window.__identity.reverse++;return Promise.resolve(${antwoord({naam:geval.reverseNaam,land:geval.land,bron:"test"})});}
  if(u.includes('geocoding-api.open-meteo.com')){window.__identity.forward++;return Promise.resolve(${antwoord({results:[]})});}
  if(u.includes('/api/waarschuwingen')){window.__identity.warningUrl=u;return Promise.resolve(${antwoord({bron:"test",dekking:false,lijst:[],land:geval.land,plaatsSpecifiek:false,reden:"geen plaats-specifieke dekking"})});}
  if(u.includes('air-quality-api.open-meteo.com'))return Promise.resolve(${antwoord(air)});
  if(u.includes('api.open-meteo.com/v1/forecast'))return Promise.resolve(${antwoord(weer)});
  return Promise.resolve(${antwoord({})});
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
  html=html.replace("</head>",stub+"</head>");
  const reporter=`<script>
setTimeout(()=>{
  const zet=(k,v)=>document.body.setAttribute('data-'+k,String(v));
  try{
    const place=document.getElementById('place'),q=document.getElementById('q');
    const kop=place&&place.firstChild&&place.firstChild.nodeType===3?place.firstChild.nodeValue.trim():'';
    const verwacht=${JSON.stringify(geval.explicit?geval.naam:geval.reverseNaam)};
    const ok=typeof S!=='undefined'&&S.label===verwacht&&kop===verwacht&&q&&q.value===verwacht
      &&document.title.startsWith(verwacht+' · ')
      &&Math.abs(S.lat-${geval.lat})<1e-6&&Math.abs(S.lon-${geval.lon})<1e-6
      &&S.land===${JSON.stringify(geval.land)}
      &&window.__identity.forward===0
      &&(${geval.explicit?"true":"window.__identity.reverse===1"});
    zet('result',ok?'ok':'fout');zet('label',typeof S!=='undefined'?S.label:'geen-S');zet('kop',kop);zet('q',q&&q.value);
    zet('title',document.title);zet('land',typeof S!=='undefined'?S.land:'');zet('reverse',window.__identity.reverse);zet('forward',window.__identity.forward);
  }catch(e){zet('result','exception');zet('exception',e&&e.message||e);}
},900);
</script>`;
  return html.replace("</body>",reporter+"</body>");
}

function draai(geval){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-shared-place-"));
  try{
    const pad=path.join(dir,"index.html");fs.writeFileSync(pad,fixture(geval));
    const params=new URLSearchParams({lat:String(geval.lat),lon:String(geval.lon)});
    if(geval.explicit)params.set("plaats",geval.naam);
    if(geval.land)params.set("land",geval.land);
    const url="file://"+pad+"?"+params.toString();
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=390,844","--virtual-time-budget=1800","--dump-dom",url],{encoding:"utf8",maxBuffer:25*1024*1024});
    if(r.status!==0)throw new Error(geval.naam+": browser exit "+r.status+" "+(r.stderr||"").slice(-1200));
    const dom=r.stdout||"";const waarde=k=>{const m=new RegExp('data-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
    if(waarde("result")!=="ok")throw new Error(`${geval.naam}: result=${waarde("result")} label=${waarde("label")} kop=${waarde("kop")} q=${waarde("q")} title=${waarde("title")} land=${waarde("land")} reverse=${waarde("reverse")} forward=${waarde("forward")} exception=${waarde("exception")}`);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

const gevallen=[
  {naam:"Dubai",explicit:true,lat:25.2048,lon:55.2708,land:"AE",reverseNaam:"ديرة",tz:"Asia/Dubai",temp:33},
  {naam:"京都",explicit:true,lat:35.0116,lon:135.7681,land:"JP",reverseNaam:"中京区",tz:"Asia/Tokyo",temp:27},
  {naam:"Kathmandu fallback",explicit:false,lat:27.7172,lon:85.3240,land:"NP",reverseNaam:"काठमाडौं",tz:"Asia/Kathmandu",temp:24}
];
for(const geval of gevallen)draai(geval);
console.log("Gedeelde plaatsidentiteit browser: Dubai en expliciet niet-Latijns schrift blijven exact gekozen; zonder expliciete naam bezit reverse de fallback; forward geocoding blokkeert geen expliciete share-load.");
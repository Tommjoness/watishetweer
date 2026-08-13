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

const weer=bouw({tempNu:18,wcNu:1,ccNu:25});
weer.current.interval=900;weer.current.visibility=16000;
weer.latitude=40.7128;weer.longitude=-74.006;weer.elevation=10;
weer.timezone="America/New_York";weer.timezone_abbreviation="EDT";weer.utc_offset_seconds=-14400;
weer.daily.sunshine_duration=weer.daily.time.map(()=>7*3600);
const air={current:{european_aqi:22,us_aqi:45},hourly:{time:[weer.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const testNow=Date.parse(weer.current.time+"Z")-(Number(weer.utc_offset_seconds)||0)*1000+20*60000;
const antwoord=data=>`{ok:true,status:200,json:async()=>(${JSON.stringify(data)}),text:async()=>JSON.stringify(${JSON.stringify(data)})}`;

function fixture(naam){
  let html=basisHtml;
  const reverseNaam=naam===null?null:String(naam);
  const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
Date.now=()=>${testNow};
window.__sharedIdentity={reverse:0,warningUrl:''};
window.fetch=function(url){
  const u=String(url);
  if(u.includes('/api/plaatsnaam')){window.__sharedIdentity.reverse++;return Promise.resolve(${antwoord({naam:reverseNaam,land:"US",bron:"test"})});}
  if(u.includes('/api/waarschuwingen')){window.__sharedIdentity.warningUrl=u;return Promise.resolve(${antwoord({bron:"test",dekking:false,lijst:[],land:"US",plaatsSpecifiek:false,reden:"geen plaats-specifieke dekking"})});}
  if(u.includes('air-quality-api.open-meteo.com'))return Promise.resolve(${antwoord(air)});
  if(u.includes('api.open-meteo.com/v1/forecast'))return Promise.resolve(${antwoord(weer)});
  return Promise.resolve(${antwoord({})});
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
  html=html.replace("</head>",stub+"</head>");
  const verwacht=reverseNaam||"Gedeelde locatie";
  const reporter=`<script>
setTimeout(()=>{
  const zet=(k,v)=>document.body.setAttribute('data-'+k,String(v));
  try{
    const place=document.getElementById('place'),q=document.getElementById('q');
    const kop=place&&place.firstChild&&place.firstChild.nodeType===3?place.firstChild.nodeValue.trim():'';
    const ok=typeof S!=='undefined'&&S.label===${JSON.stringify(verwacht)}
      &&kop===${JSON.stringify(verwacht)}&&q&&q.value===${JSON.stringify(verwacht)}
      &&document.title.startsWith(${JSON.stringify(verwacht+" · ")})
      &&window.__sharedIdentity.reverse===1
      &&Math.abs(S.lat-40.7128)<1e-9&&Math.abs(S.lon+74.006)<1e-9
      &&!window.__sharedIdentity.warningUrl.includes('land=NL');
    zet('shared-place',ok?'ok':'fout');
    zet('shared-label',typeof S!=='undefined'?S.label:'geen-S');
    zet('shared-kop',kop);zet('shared-q',q&&q.value);zet('shared-title',document.title);
    zet('shared-reverse',window.__sharedIdentity.reverse);zet('shared-warning',window.__sharedIdentity.warningUrl);
  }catch(e){zet('shared-place','exception');zet('shared-exception',e&&e.message||e);}
},700);
</script>`;
  return html.replace("</body>",reporter+"</body>");
}

function draai(naam){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-shared-place-"));
  try{
    const pad=path.join(dir,"index.html");fs.writeFileSync(pad,fixture(naam));
    const url="file://"+pad+"?lat=40.7128&lon=-74.0060&plaats=Amsterdam&land=NL";
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1440,1000","--virtual-time-budget=1400","--dump-dom",url],{encoding:"utf8",maxBuffer:20*1024*1024});
    if(r.status!==0)throw new Error("browser exit "+r.status+" "+(r.stderr||"").slice(-1200));
    const dom=r.stdout||"";const waarde=k=>{const m=new RegExp('data-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
    if(waarde("shared-place")!=="ok")throw new Error("gedeelde plaats fout: result="+waarde("shared-place")+", label="+waarde("shared-label")+", kop="+waarde("shared-kop")+", q="+waarde("shared-q")+", title="+waarde("shared-title")+", reverse="+waarde("shared-reverse")+", warning="+waarde("shared-warning")+", exception="+waarde("shared-exception"));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

draai("New York");
draai(null);
console.log("Gedeelde plaatsidentiteit browser: verkeerde URL-naam wordt canoniek New York en ontbrekende reverse-naam valt neutraal terug zonder landcode-regressie.");

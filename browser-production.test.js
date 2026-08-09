"use strict";

/*
 * Echte browser-smoke tegen exact public/index.html, zonder externe npm-pakketten.
 * GitHub-hosted Ubuntu runners leveren Chrome. Lokaal zonder browser wordt deze
 * aanvullende controle overgeslagen; op CI is het ontbreken van Chrome fataal.
 */
const fs=require("fs");
const os=require("os");
const path=require("path");
const {spawnSync}=require("child_process");
const {bouw}=require("./data.js");

function vindBrowser(){
  for(const naam of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync("sh",["-lc","command -v "+naam],{encoding:"utf8"});
    if(r.status===0&&r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

const browser=vindBrowser();
if(!browser){
  if(process.env.CI){console.error("FOUT echte browsertest: Chrome/Chromium ontbreekt op CI.");process.exit(1);}
  console.log("SKIP echte browsertest: lokaal geen Chrome/Chromium gevonden.");
  process.exit(0);
}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie)){console.error("FOUT echte browsertest: public/index.html ontbreekt.");process.exit(1);}

const d=bouw({
  temp:(u,dag)=>18+8*Math.sin((u-7)/24*Math.PI*2)+(u===18&&dag===0?3:0),
  pp:(u,dag)=>dag===0&&u>=16&&u<=18?65:8,
  pr:(u,dag)=>dag===0&&u===17?0.5:0,
  cc:(u,dag)=>dag===0&&u>=17&&u<=19?75:25,
  wg:(u,dag)=>dag===0&&u===18?72:30
});
d.current.interval=900;
d.current.visibility=16000;
d.elevation=3;
d.latitude=52.35;d.longitude=5.26;
d.daily.sunshine_duration=d.daily.time.map(()=>7.5*3600);
d.minutely_15={time:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[]};
{
  const start=Date.UTC(2026,6,22,14,0);
  for(let i=1;i<=20;i++){
    const t=new Date(start+i*15*60000).toISOString().slice(0,16);
    const nat=i>=9&&i<=11?0.12:0;
    d.minutely_15.time.push(t);d.minutely_15.precipitation.push(nat);d.minutely_15.rain.push(nat);
    d.minutely_15.showers.push(0);d.minutely_15.snowfall.push(0);d.minutely_15.weather_code.push(nat?61:3);
  }
}
const air={current:{european_aqi:22,us_aqi:45},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[4],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};

let html=fs.readFileSync(productie,"utf8");
const stub=`<script>
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[]})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Browsertest",bron:"test"})}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const reporter=`<script>
setTimeout(()=>{
  try{
    const chart=document.getElementById('chart');
    const labels=[...chart.querySelectorAll('text')].filter(el=>/^-?\\d+°$/.test((el.textContent||'').trim())&&String(el.getAttribute('font-family')||'').includes('Bodoni'));
    let botsingen=0;
    for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
      const a=labels[i].getBoundingClientRect(),b=labels[j].getBoundingClientRect();
      if(a.width&&b.width&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)botsingen++;
    }
    const svgBox=chart.getBoundingClientRect();
    const buiten=labels.filter(el=>{const r=el.getBoundingClientRect();return r.left<svgBox.left-1||r.right>svgBox.right+1||r.top<svgBox.top-1||r.bottom>svgBox.bottom+1;}).length;
    const hit=document.getElementById('hit'),scrub=document.getElementById('scrub');
    let scrubOk=true;
    if(hit&&scrub){
      const r=hit.getBoundingClientRect();
      hit.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:r.left+r.width*0.72,clientY:r.top+r.height*0.3,pointerType:'touch'}));
      const s=scrub.getBoundingClientRect();
      if(scrub.style.display!=='none'&&s.width>0) scrubOk=s.left>=svgBox.left-2&&s.right<=svgBox.right+2&&s.top>=svgBox.top-2&&s.bottom<=svgBox.bottom+2;
    }
    const brief=(document.getElementById('brief')||{}).textContent||'';
    const dagen=document.querySelectorAll('#days .row.day:not(.kop)').length;
    document.body.dataset.browserTestResult=(brief&&dagen>=7&&labels.length>=5&&botsingen===0&&buiten===0&&scrubOk)?'ok':'fout';
    document.body.dataset.browserLabels=String(labels.length);
    document.body.dataset.browserBotsingen=String(botsingen);
    document.body.dataset.browserBuiten=String(buiten);
    document.body.dataset.browserScrub=String(scrubOk);
  }catch(e){document.body.dataset.browserTestResult='exception';document.body.dataset.browserException=String(e&&e.message||e);}
},900);
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-browser-"));
const fixture=path.join(dir,"index.html");fs.writeFileSync(fixture,html);
const url="file://"+fixture+"?lat=52.3500&lon=5.2600&plaats=Browsertest";
const r=spawnSync(browser,[
  "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",
  "--window-size=390,844","--virtual-time-budget=3000","--dump-dom",url
],{encoding:"utf8",maxBuffer:16*1024*1024});
fs.rmSync(dir,{recursive:true,force:true});

if(r.status!==0){console.error("FOUT echte browsertest: browser exit "+r.status+"\n"+(r.stderr||"").slice(-2000));process.exit(1);}
const dom=r.stdout||"";
const waarde=naam=>{const m=new RegExp('data-'+naam+'="([^"]*)"').exec(dom);return m&&m[1];};
const resultaat=waarde("browser-test-result");
if(resultaat!=="ok"){
  console.error("FOUT echte browsertest: resultaat="+resultaat+", labels="+waarde("browser-labels")+", botsingen="+waarde("browser-botsingen")+", buiten="+waarde("browser-buiten")+", scrub="+waarde("browser-scrub")+", exception="+waarde("browser-exception"));
  process.exit(1);
}
console.log("Echte browserproductietest geslaagd: "+waarde("browser-labels")+" temperatuurlabels, 0 botsingen, tooltip binnen beeld.");

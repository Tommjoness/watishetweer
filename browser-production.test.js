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
/* De fixture moet werkelijk in zijn eigen huidige modeluur staan. Anders schuift
   een later uitgevoerde CI-run vanzelf weken voorbij deze vaste testdata en zijn
   zowel de nu-lijn als alle toekomstige kanswaarden terecht verlopen. */
const testNow=Date.parse(d.current.time+"Z")-(Number(d.utc_offset_seconds)||0)*1000+30*60000;

let html=fs.readFileSync(productie,"utf8");
const stub=`<script>
Date.now=()=>${testNow};
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
    let botsingen=0,dubbelNabij=0;
    for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
      const a=labels[i].getBoundingClientRect(),b=labels[j].getBoundingClientRect();
      if(a.width&&b.width&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)botsingen++;
      const ac=(a.left+a.right)/2,bc=(b.left+b.right)/2,ay=(a.top+a.bottom)/2,by=(b.top+b.bottom)/2;
      if(labels[i].textContent.trim()===labels[j].textContent.trim()&&Math.abs(ac-bc)<55&&Math.abs(ay-by)<38)dubbelNabij++;
    }
    const svgBox=chart.getBoundingClientRect();
    const buiten=labels.filter(el=>{const r=el.getBoundingClientRect();return r.left<svgBox.left-1||r.right>svgBox.right+1||r.top<svgBox.top-1||r.bottom>svgBox.bottom+1;}).length;

    /* De rode actuele meting moet een eigen visuele zone hebben. In deze fixture
       ligt het huidige punt ruim boven de onderrand, dus het nu-label hoort onder
       de rode stip te staan en mag geen zwart temperatuurcijfer overlappen. */
    const nuLabel=[...chart.querySelectorAll('text')].find(el=>/^nu\\s+-?\\d+°$/i.test((el.textContent||'').trim()));
    const nuPunt=[...chart.querySelectorAll('circle')].find(el=>String(el.getAttribute('fill')||'')==='var(--carmine)'&&Math.abs(Number(el.getAttribute('r'))-3)<0.2);
    let nuRustig=false;
    if(nuLabel&&nuPunt){
      const ny=Number(nuLabel.getAttribute('y')),cy=Number(nuPunt.getAttribute('cy'));
      const nr=nuLabel.getBoundingClientRect();
      const botst=labels.some(el=>{const r=el.getBoundingClientRect();return nr.width&&r.width&&nr.left<r.right&&nr.right>r.left&&nr.top<r.bottom&&nr.bottom>r.top;});
      nuRustig=Number.isFinite(ny)&&Number.isFinite(cy)&&ny>=cy+14&&!botst&&nuLabel.getAttribute('paint-order')==='stroke';
    }

    const hit=document.getElementById('hit'),scrub=document.getElementById('scrub');
    let scrubOk=true,scrubKort=true,kansCompact=true;
    if(hit&&scrub){
      const r=hit.getBoundingClientRect();
      /* Kies bewust een uur met neerslagkans >0. Zo bewaakt de browsertest exact
         de gemelde lange labelvorm, in plaats van toevallig een droge regel. */
      let clientX=r.left+r.width*0.72;
      try{
        const idx=S.geo&&Array.isArray(S.geo.P)?S.geo.P.findIndex(v=>Number(v)>0):-1;
        if(idx>=0&&S.geo&&typeof S.geo.x==='function'&&Number.isFinite(S.geo.W)){
          clientX=svgBox.left+(S.geo.x(idx)/S.geo.W)*svgBox.width;
        }
      }catch(e){}
      hit.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:clientX,clientY:r.top+r.height*0.3,pointerType:'touch'}));
      const s=scrub.getBoundingClientRect();
      if(scrub.style.display!=='none'&&s.width>0) scrubOk=s.left>=svgBox.left-2&&s.right<=svgBox.right+2&&s.top>=svgBox.top-2&&s.bottom<=svgBox.bottom+2;
      const scrubTekst=scrub.textContent||'';
      scrubKort=!/geen neerslag verwacht/i.test(scrubTekst);
      kansCompact=!/kans\\s+\\d{2}:00[–-]\\d{2}:00/i.test(scrubTekst)&&/kans\\s+\\d{2}–\\d{2}u/i.test(scrubTekst);
    }
    const klok=((document.getElementById('plaatstijd')||{}).textContent||'').trim();
    const klokOk=/^\\d{2}:\\d{2}:\\d{2}$/.test(klok);
    const desktop=window.innerWidth>=1100,stats=document.querySelector('.dashrow-hero .stats');
    const cols=stats?getComputedStyle(stats).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length:0;
    const statOverflow=desktop&&stats?[...stats.querySelectorAll('.stat')].some(el=>el.scrollWidth>el.clientWidth+1):false;
    const nightWide=[...document.querySelectorAll('#nights .row.night .nmeta.wide')];
    let nightAligned=true;
    if(desktop&&nightWide.length>1){
      const r0=nightWide[0].getBoundingClientRect();
      nightAligned=nightWide.slice(1).every(el=>{const r=el.getBoundingClientRect();return Math.abs(r.left-r0.left)<=1&&Math.abs(r.width-r0.width)<=1;});
    }
    const brief=(document.getElementById('brief')||{}).textContent||'';
    const dagen=document.querySelectorAll('#days .row.day:not(.kop)').length;
    const gridOk=desktop?cols===3:cols===2;
    document.body.dataset.browserTestResult=(brief&&dagen>=7&&labels.length>=5&&botsingen===0&&dubbelNabij===0&&buiten===0&&nuRustig&&scrubOk&&scrubKort&&kansCompact&&klokOk&&gridOk&&!statOverflow&&nightAligned)?'ok':'fout';
    document.body.dataset.browserLabels=String(labels.length);
    document.body.dataset.browserBotsingen=String(botsingen);
    document.body.dataset.browserDubbel=String(dubbelNabij);
    document.body.dataset.browserBuiten=String(buiten);
    document.body.dataset.browserNu=String(nuRustig);
    document.body.dataset.browserScrub=String(scrubOk);
    document.body.dataset.browserScrubKort=String(scrubKort);
    document.body.dataset.browserKans=String(kansCompact);
    document.body.dataset.browserKlok=String(klokOk);
    document.body.dataset.browserGrid=String(gridOk);
    document.body.dataset.browserOverflow=String(statOverflow);
    document.body.dataset.browserNight=String(nightAligned);
  }catch(e){document.body.dataset.browserTestResult='exception';document.body.dataset.browserException=String(e&&e.message||e);}
},1100);
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-browser-"));
const fixture=path.join(dir,"index.html");fs.writeFileSync(fixture,html);
const url="file://"+fixture+"?lat=52.3500&lon=5.2600&plaats=Browsertest";
function voerBrowserUit(maat,naam){
  const r=spawnSync(browser,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",
    "--window-size="+maat,"--virtual-time-budget=3500","--dump-dom",url
  ],{encoding:"utf8",maxBuffer:16*1024*1024});
  if(r.status!==0)throw new Error(naam+": browser exit "+r.status+" "+(r.stderr||"").slice(-1000));
  const dom=r.stdout||"";
  const waarde=veld=>{const m=new RegExp('data-'+veld+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(waarde("browser-test-result")!=="ok")throw new Error(naam+": resultaat="+waarde("browser-test-result")+", labels="+waarde("browser-labels")+", botsingen="+waarde("browser-botsingen")+", dubbel="+waarde("browser-dubbel")+", buiten="+waarde("browser-buiten")+", nu="+waarde("browser-nu")+", scrub="+waarde("browser-scrub")+", scrubKort="+waarde("browser-scrub-kort")+", kans="+waarde("browser-kans")+", klok="+waarde("browser-klok")+", grid="+waarde("browser-grid")+", overflow="+waarde("browser-overflow")+", night="+waarde("browser-night")+", exception="+waarde("browser-exception"));
  console.log("Echte browserproductietest "+naam+" geslaagd: "+waarde("browser-labels")+" labels, rustige nu-markering, compact kanstijdvak, tooltip en live klok correct.");
}
try{voerBrowserUit("390,844","mobiel Chromium");voerBrowserUit("1440,1000","desktop Chromium");}
finally{fs.rmSync(dir,{recursive:true,force:true});}

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
    const tempPunten=[...chart.querySelectorAll('circle[data-temp-index]')];
    const lossePunten=Math.max(0,tempPunten.length-labels.length);
    let botsingen=0,dubbelNabij=0;
    for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
      const a=labels[i].getBoundingClientRect(),b=labels[j].getBoundingClientRect();
      if(a.width&&b.width&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)botsingen++;
      const ac=(a.left+a.right)/2,bc=(b.left+b.right)/2,ay=(a.top+a.bottom)/2,by=(b.top+b.bottom)/2;
      if(labels[i].textContent.trim()===labels[j].textContent.trim()&&Math.abs(ac-bc)<55&&Math.abs(ay-by)<38)dubbelNabij++;
    }
    const svgBox=chart.getBoundingClientRect();
    const buiten=labels.filter(el=>{const r=el.getBoundingClientRect();return r.left<svgBox.left-1||r.right>svgBox.right+1||r.top<svgBox.top-1||r.bottom>svgBox.bottom+1;}).length;

    const nuLabel=[...chart.querySelectorAll('text')].find(el=>/^nu\\s+-?\\d+°$/i.test((el.textContent||'').trim()));
    const nuPunt=[...chart.querySelectorAll('circle')].find(el=>String(el.getAttribute('fill')||'')==='var(--carmine)'&&Math.abs(Number(el.getAttribute('r'))-3)<0.2);
    let nuRustig=false,nuAfstand=null,nuBotst=null,nuHalo=null;
    if(nuLabel&&nuPunt){
      const ny=Number(nuLabel.getAttribute('y')),cy=Number(nuPunt.getAttribute('cy'));
      const nr=nuLabel.getBoundingClientRect();
      nuBotst=labels.some(el=>{const r=el.getBoundingClientRect();return nr.width&&r.width&&nr.left<r.right&&nr.right>r.left&&nr.top<r.bottom&&nr.bottom>r.top;});
      nuAfstand=Number.isFinite(ny)&&Number.isFinite(cy)?Math.abs(ny-cy):null;
      nuHalo=nuLabel.getAttribute('paint-order')==='stroke';
      nuRustig=nuAfstand!==null&&nuAfstand>=12&&!nuBotst&&nuHalo;
    }

    const hit=document.getElementById('hit'),scrub=document.getElementById('scrub');
    let scrubOk=true,scrubKort=true,neerslagkansVast=false,scrubDebug='',tooltipCompact=true,tooltipW=null;
    if(hit&&scrub){
      const r=hit.getBoundingClientRect();
      const kandidaten=[];
      try{
        if(S.geo&&Array.isArray(S.geo.P)) S.geo.P.forEach((v,i)=>{if(Number(v)>0) kandidaten.push(i);});
      }catch(e){}
      if(!kandidaten.length) kandidaten.push(Math.max(0,Math.floor((S.geo&&S.geo.n||1)/2)));
      for(const idx of kandidaten){
        let clientX=r.left+r.width*0.5;
        try{
          if(S.geo&&typeof S.geo.x==='function'&&Number.isFinite(S.geo.W)) clientX=svgBox.left+(S.geo.x(idx)/S.geo.W)*svgBox.width;
        }catch(e){}
        hit.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,clientX:clientX,clientY:r.top+r.height*0.3,pointerType:'touch'}));
        const teksten=[...scrub.querySelectorAll('text')].map(el=>(el.textContent||'').trim()).filter(Boolean);
        scrubDebug=teksten.join('|');
        const oudLabel=teksten.some(t=>/^kans\\s+\\d{2}(?::00)?[–-]\\d{2}/i.test(t));
        const vastLabel=teksten.some(t=>t.toLowerCase()==='neerslagkans');
        const percentage=teksten.some(t=>/^\\d+\\s*%$/.test(t));
        if(vastLabel&&percentage&&!oudLabel){neerslagkansVast=true;break;}
      }
      const s=scrub.getBoundingClientRect();
      if(scrub.style.display!=='none'&&s.width>0) scrubOk=s.left>=svgBox.left-2&&s.right<=svgBox.right+2&&s.top>=svgBox.top-2&&s.bottom<=svgBox.bottom+2;
      scrubKort=!/geen neerslag verwacht/i.test(scrubDebug);
      const tooltipRect=scrub.querySelector('rect');
      tooltipW=tooltipRect?Number(tooltipRect.getAttribute('width')):null;
      tooltipCompact=Number.isFinite(tooltipW)&&(window.innerWidth>=1100?(tooltipW>=200&&tooltipW<=203):(tooltipW>=190&&tooltipW<=194));
    }
    const klok=((document.getElementById('plaatstijd')||{}).textContent||'').trim();
    const klokOk=/^\\d{2}:\\d{2}:\\d{2}$/.test(klok);
    const desktop=window.innerWidth>=1100,stats=document.querySelector('.dashrow-hero .stats');
    const cols=stats?getComputedStyle(stats).gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length:0;
    const statOverflow=desktop&&stats?[...stats.querySelectorAll('.stat')].some(el=>el.scrollWidth>el.clientWidth+1):false;
    const zichtbareStats=stats?[...stats.querySelectorAll('.stat')].filter(el=>getComputedStyle(el).display!=='none'):[];
    const statsStabiel=zichtbareStats.length===9;
    const statsCentraal=!desktop||zichtbareStats.every(el=>getComputedStyle(el).textAlign==='center'&&getComputedStyle(el.querySelector('.sval')).justifyContent==='center');
    const dagenKop=document.querySelector('.dashrow-days .dashcol h2'),dagenRij=document.querySelector('#days .row.day.kop');
    let dagenLijnOk=false;
    if(dagenKop&&dagenRij){const a=dagenKop.getBoundingClientRect(),b=dagenRij.getBoundingClientRect();dagenLijnOk=Math.abs(a.left-b.left)<=1&&Math.abs(a.right-b.right)<=1;}
    const dagMm=document.querySelector('#days .q1-dag-mm'),dagMmLeesbaar=!!(dagMm&&parseFloat(getComputedStyle(dagMm).fontSize)>=(desktop?12:11));
    const aq=document.getElementById('aq'),aqStats=aq?[...aq.querySelectorAll('.stat')]:[];
    let aqVult=false;
    if(aq&&aqStats.length){
      const a=aq.getBoundingClientRect(),laatste=aqStats.at(-1).getBoundingClientRect();
      const aqStijl=getComputedStyle(aq),aqCols=aqStijl.gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length;
      const padL=parseFloat(aqStijl.paddingLeft)||0,padR=parseFloat(aqStijl.paddingRight)||0;
      const inhoudBreed=a.width-padL-padR;
      aqVult=desktop?(aqCols===aqStats.length&&Math.abs(laatste.right+padR-a.right)<=1):(aqStats.length%2===0||Math.abs(laatste.width-inhoudBreed)<=2);
    }
    const nightWide=[...document.querySelectorAll('#nights .row.night .nmeta.wide')];
    let nightAligned=true,nightRuim=true;
    if(desktop&&nightWide.length>1){
      const r0=nightWide[0].getBoundingClientRect();
      nightAligned=nightWide.slice(1).every(el=>{const r=el.getBoundingClientRect();return Math.abs(r.left-r0.left)<=1&&Math.abs(r.width-r0.width)<=1;});
      nightRuim=r0.width>=260;
    }

    const chartKop=document.querySelector('.chartkop'),sun=document.getElementById('suntimes');
    const uv=document.querySelector('.dashrow-hero .stat.breed');
    const zonRijen=sun?[...sun.querySelectorAll('.zonregel')]:[];
    let mobileKopOk=true,uvOk=true,zonSemantiekOk=false;
    if(sun&&zonRijen.length){
      zonSemantiekOk=sun.scrollWidth<=sun.clientWidth+1&&zonRijen.every(rij=>{
        const dag=rij.querySelector('.zondag'),items=[...rij.children].filter(el=>!el.classList.contains('zondag'));
        const stijl=dag&&getComputedStyle(dag);
        return !!(dag&&dag.textContent.trim()&&items.length>=1&&stijl&&parseFloat(stijl.fontSize)>=10);
      });
    }
    if(!desktop){
      const kopStijl=chartKop&&getComputedStyle(chartKop),sunStijl=sun&&getComputedStyle(sun),uvStijl=uv&&getComputedStyle(uv);
      const kopCols=kopStijl?kopStijl.gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length:0;
      const sunCols=sunStijl?sunStijl.gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length:0;
      const uvCols=uvStijl?uvStijl.gridTemplateColumns.trim().split(/\\s+/).filter(Boolean).length:0;
      const kopBreed=chartKop&&chartKop.getBoundingClientRect().width,sunBreed=sun&&sun.getBoundingClientRect().width;
      mobileKopOk=!!(chartKop&&sun&&kopStijl&&kopStijl.display==='grid'&&kopCols===1&&sunCols===1&&Math.abs(kopBreed-sunBreed)<=2&&sun.scrollWidth<=sun.clientWidth+1);
      uvOk=!!(uv&&uvStijl&&uvStijl.display==='grid'&&uvCols===3);
    }

    const brief=(document.getElementById('brief')||{}).textContent||'';
    const dagen=document.querySelectorAll('#days .row.day:not(.kop)').length;
    const gridOk=desktop?cols===3:cols===2;
    const briefingDagOk=!/Morgen wordt het maximaal/i.test(brief);
    document.body.dataset.browserTestResult=(brief&&briefingDagOk&&dagen>=7&&labels.length>=5&&botsingen===0&&dubbelNabij===0&&buiten===0&&lossePunten===0&&nuRustig&&scrubOk&&scrubKort&&neerslagkansVast&&tooltipCompact&&klokOk&&gridOk&&!statOverflow&&statsStabiel&&statsCentraal&&dagenLijnOk&&dagMmLeesbaar&&aqVult&&nightAligned&&nightRuim&&mobileKopOk&&uvOk&&zonSemantiekOk)?'ok':'fout';
    document.body.dataset.browserLabels=String(labels.length);
    document.body.dataset.browserPunten=String(tempPunten.length);
    document.body.dataset.browserLossePunten=String(lossePunten);
    document.body.dataset.browserBotsingen=String(botsingen);
    document.body.dataset.browserDubbel=String(dubbelNabij);
    document.body.dataset.browserBuiten=String(buiten);
    document.body.dataset.browserNu=String(nuRustig);
    document.body.dataset.browserNuAfstand=String(nuAfstand);
    document.body.dataset.browserNuBotst=String(nuBotst);
    document.body.dataset.browserNuHalo=String(nuHalo);
    document.body.dataset.browserScrub=String(scrubOk);
    document.body.dataset.browserScrubKort=String(scrubKort);
    document.body.dataset.browserKans=String(neerslagkansVast);
    document.body.dataset.browserScrubDebug=scrubDebug;
    document.body.dataset.browserTooltip=String(tooltipCompact);
    document.body.dataset.browserTooltipW=String(tooltipW);
    document.body.dataset.browserKlok=String(klokOk);
    document.body.dataset.browserGrid=String(gridOk);
    document.body.dataset.browserOverflow=String(statOverflow);
    document.body.dataset.browserStatsStabiel=String(statsStabiel);
    document.body.dataset.browserStatsCentraal=String(statsCentraal);
    document.body.dataset.browserDagenLijn=String(dagenLijnOk);
    document.body.dataset.browserDagMm=String(dagMmLeesbaar);
    document.body.dataset.browserAq=String(aqVult);
    document.body.dataset.browserNight=String(nightAligned);
    document.body.dataset.browserNightRuim=String(nightRuim);
    document.body.dataset.browserBriefingDag=String(briefingDagOk);
    document.body.dataset.browserMobileKop=String(mobileKopOk);
    document.body.dataset.browserUv=String(uvOk);
    document.body.dataset.browserZon=String(zonSemantiekOk);
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
  if(waarde("browser-test-result")!=="ok")throw new Error(naam+": resultaat="+waarde("browser-test-result")+", labels="+waarde("browser-labels")+", punten="+waarde("browser-punten")+", lossePunten="+waarde("browser-losse-punten")+", botsingen="+waarde("browser-botsingen")+", dubbel="+waarde("browser-dubbel")+", buiten="+waarde("browser-buiten")+", nu="+waarde("browser-nu")+", nuAfstand="+waarde("browser-nu-afstand")+", nuBotst="+waarde("browser-nu-botst")+", nuHalo="+waarde("browser-nu-halo")+", scrub="+waarde("browser-scrub")+", scrubKort="+waarde("browser-scrub-kort")+", neerslagkans="+waarde("browser-kans")+", scrubTekst="+waarde("browser-scrub-debug")+", tooltip="+waarde("browser-tooltip")+", tooltipW="+waarde("browser-tooltip-w")+", klok="+waarde("browser-klok")+", grid="+waarde("browser-grid")+", overflow="+waarde("browser-overflow")+", statsStabiel="+waarde("browser-stats-stabiel")+", statsCentraal="+waarde("browser-stats-centraal")+", dagenLijn="+waarde("browser-dagen-lijn")+", dagMm="+waarde("browser-dag-mm")+", aq="+waarde("browser-aq")+", night="+waarde("browser-night")+", nightRuim="+waarde("browser-night-ruim")+", briefingDag="+waarde("browser-briefing-dag")+", mobileKop="+waarde("browser-mobile-kop")+", uv="+waarde("browser-uv")+", zon="+waarde("browser-zon")+", exception="+waarde("browser-exception"));
  console.log("Echte browserproductietest "+naam+" geslaagd: "+waarde("browser-labels")+" temperatuurmarkeringen zonder losse stippen, rustige nu-markering, daggebonden zoninformatie, compacte tooltip, vast neerslagkanslabel en live klok correct.");
}
try{voerBrowserUit("390,844","mobiel Chromium");voerBrowserUit("1440,1000","desktop Chromium");}
finally{fs.rmSync(dir,{recursive:true,force:true});}

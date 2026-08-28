"use strict";
const fs=require("fs"),path=require("path"),os=require("os"),{spawnSync}=require("child_process");
const browser=process.env.CHROME_PATH||process.env.CHROMIUM_PATH||"google-chrome";
const bron=path.join(__dirname,"public","index.html");
if(!fs.existsSync(bron))throw new Error("public/index.html ontbreekt; voer eerst de build uit");
let html=fs.readFileSync(bron,"utf8");

/* Browserproductietest: het echte gebouwde artifact wordt in Chromium geladen.
   De test meet uitsluitend zichtbare/layoutcontracten en gebruikt dezelfde
   deterministic browserfixture als de bestaande productietests. */
const reporter=`<script>
(function(){
  let afgerond=false;
  function weerweergaveGereed(){
    const app=document.getElementById('app'),chart=document.getElementById('chart');
    return !!(app&&getComputedStyle(app).display!=='none'
      &&chart&&chart.querySelector('circle[data-temp-index]')
      &&document.querySelectorAll('#days .row.day:not(.kop)').length>=7
      &&document.querySelectorAll('#nights .row.night:not(.kop)').length>=3
      &&document.querySelectorAll('#suntimes .zonregel').length>=1
      &&document.querySelectorAll('#aq .stat').length>=1);
  }
  function probeer(definitief){
    if(afgerond)return;
    if(weerweergaveGereed()){
      afgerond=true;
      meet();
      return;
    }
    if(definitief){
      afgerond=true;
      document.body.dataset.browserTestResult='niet-gereed';
      document.body.dataset.browserException='weerweergave niet binnen 5 seconden gereed';
    }
  }
  function meet(){
  try{
    const chart=document.getElementById('chart'),svgBox=chart.getBoundingClientRect();
    const labels=[...chart.querySelectorAll('text')].filter(el=>{
      const ff=String(el.getAttribute('font-family')||'');
      return ff.includes('Bodoni Moda')&&/^-?\\d+°$/.test((el.textContent||'').trim());
    });
    const tempPunten=[...chart.querySelectorAll('circle[data-temp-index]')];
    const lossePunten=tempPunten.filter(p=>{
      const i=Number(p.getAttribute('data-temp-index'));
      return !labels.some(el=>{
        const m=/^-?\\d+°$/.test((el.textContent||'').trim());
        if(!m)return false;
        const x=Number(el.getAttribute('x')),px=Number(p.getAttribute('cx'));
        return Number.isFinite(x)&&Number.isFinite(px)&&Math.abs(x-px)<=Math.max(72,(S.geo&&S.geo.cw||36)*2.5);
      });
    }).length;
    const botsingen=labels.filter((a,i)=>labels.slice(i+1).some(b=>{
      const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();
      return ra.width&&rb.width&&ra.left<rb.right&&ra.right>rb.left&&ra.top<rb.bottom&&ra.bottom>rb.top;
    })).length;
    const dubbelNabij=labels.filter((a,i)=>labels.slice(i+1).some(b=>{
      if((a.textContent||'').trim()!==(b.textContent||'').trim())return false;
      const ax=Number(a.getAttribute('x')),ay=Number(a.getAttribute('y')),bx=Number(b.getAttribute('x')),by=Number(b.getAttribute('y'));
      return [ax,ay,bx,by].every(Number.isFinite)&&Math.abs(ax-bx)<=Math.max(38,(S.geo&&S.geo.cw||36)*1.3)&&Math.abs(ay-by)<=34;
    })).length;
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
    const klokOk=/^\\d{2}:\\d{2}$/.test(klok);
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

    /* Nachtzicht is op ieder schermformaat bewust compact: maximaal drie rijen
       zijn initieel zichtbaar, terwijl alle rijen in de DOM blijven en de
       bestaande toegankelijke knop de rest kan uitklappen. Meet alleen de
       werkelijk zichtbare rijen voor layout; hidden rijen hebben terecht een
       nulrechthoek en zijn dus geen uitlijningsfout. */
    const nightRijen=[...document.querySelectorAll('#nights .row.night:not(.kop)')],nightKnop=document.querySelector('#nights .nacht-meer');
    const nightZichtbaar=nightRijen.filter(el=>!el.hidden&&getComputedStyle(el).display!=='none');
    const nightWide=nightZichtbaar.map(el=>el.querySelector('.nmeta.wide')).filter(Boolean);
    let nightAligned=true,nightRuim=true,nightCompact=true,nightExpand=true;
    if(desktop&&nightWide.length>1){
      const r0=nightWide[0].getBoundingClientRect();
      nightAligned=nightWide.slice(1).every(el=>{const r=el.getBoundingClientRect();return Math.abs(r.left-r0.left)<=1&&Math.abs(r.width-r0.width)<=1;});
      nightRuim=r0.width>=260;
    }
    if(nightRijen.length>3){
      nightCompact=nightZichtbaar.length===3&&!!nightKnop&&nightKnop.getAttribute('aria-expanded')==='false'&&getComputedStyle(nightKnop).display!=='none';
      if(nightKnop){
        nightKnop.click();
        const naUitklap=nightRijen.filter(el=>!el.hidden&&getComputedStyle(el).display!=='none');
        nightExpand=naUitklap.length===nightRijen.length&&nightKnop.getAttribute('aria-expanded')==='true';
      }else nightExpand=false;
    }else{
      nightCompact=nightZichtbaar.length===nightRijen.length;
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
    /* Desktop houdt de rijkere drie-uursreferenties. Mobiel toont een rustiger
       middenniveau: zes-uursreferenties plus echte lokale/globale extrema. Dat
       moet duidelijk meer context geven dan alleen min/max, zonder weer tien
       permanente cijfers op een smalle grafiek te zetten. */
    const labelDichtheidOk=desktop?labels.length>=5:(labels.length>=4&&labels.length<=8&&labels.length===tempPunten.length);
    document.body.dataset.browserTestResult=(brief&&briefingDagOk&&dagen>=7&&labelDichtheidOk&&botsingen===0&&dubbelNabij===0&&buiten===0&&lossePunten===0&&nuRustig&&scrubOk&&scrubKort&&neerslagkansVast&&tooltipCompact&&klokOk&&gridOk&&!statOverflow&&statsStabiel&&statsCentraal&&dagenLijnOk&&dagMmLeesbaar&&aqVult&&nightAligned&&nightRuim&&nightCompact&&nightExpand&&mobileKopOk&&uvOk&&zonSemantiekOk)?'ok':'fout';
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
    document.body.dataset.browserNightCompact=String(nightCompact);
    document.body.dataset.browserNightExpand=String(nightExpand);
    document.body.dataset.browserBriefingDag=String(briefingDagOk);
    document.body.dataset.browserMobileKop=String(mobileKopOk);
    document.body.dataset.browserUv=String(uvOk);
    document.body.dataset.browserZon=String(zonSemantiekOk);
  }catch(e){document.body.dataset.browserTestResult='exception';document.body.dataset.browserException=String(e&&e.message||e);}
  }
  setTimeout(()=>probeer(false),1400);
  setTimeout(()=>probeer(false),2800);
  setTimeout(()=>probeer(true),5000);
})();
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-browser-"));
const fixture=path.join(dir,"index.html");fs.writeFileSync(fixture,html);
const url="file://"+fixture+"?lat=52.3500&lon=5.2600&plaats=Browsertest";
function voerBrowserUit(maat,naam){
  const r=spawnSync(browser,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",
    "--window-size="+maat,"--virtual-time-budget=7000","--dump-dom",url
  ],{encoding:"utf8",maxBuffer:16*1024*1024});
  if(r.status!==0)throw new Error(naam+": browser exit "+r.status+" "+(r.stderr||"").slice(-1000));
  const dom=r.stdout||"";
  const waarde=veld=>{const m=new RegExp('data-'+veld+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(waarde("browser-test-result")!=="ok")throw new Error(naam+": resultaat="+waarde("browser-test-result")+", labels="+waarde("browser-labels")+", punten="+waarde("browser-punten")+", lossePunten="+waarde("browser-losse-punten")+", botsingen="+waarde("browser-botsingen")+", dubbel="+waarde("browser-dubbel")+", buiten="+waarde("browser-buiten")+", nu="+waarde("browser-nu")+", nuAfstand="+waarde("browser-nu-afstand")+", nuBotst="+waarde("browser-nu-botst")+", nuHalo="+waarde("browser-nu-halo")+", scrub="+waarde("browser-scrub")+", scrubKort="+waarde("browser-scrub-kort")+", neerslagkans="+waarde("browser-kans")+", scrubTekst="+waarde("browser-scrub-debug")+", tooltip="+waarde("browser-tooltip")+", tooltipW="+waarde("browser-tooltip-w")+", klok="+waarde("browser-klok")+", grid="+waarde("browser-grid")+", overflow="+waarde("browser-overflow")+", statsStabiel="+waarde("browser-stats-stabiel")+", statsCentraal="+waarde("browser-stats-centraal")+", dagenLijn="+waarde("browser-dagen-lijn")+", dagMm="+waarde("browser-dag-mm")+", aq="+waarde("browser-aq")+", night="+waarde("browser-night")+", nightRuim="+waarde("browser-night-ruim")+", nightCompact="+waarde("browser-night-compact")+", nightExpand="+waarde("browser-night-expand")+", briefingDag="+waarde("browser-briefing-dag")+", mobileKop="+waarde("browser-mobile-kop")+", uv="+waarde("browser-uv")+", zon="+waarde("browser-zon")+", exception="+waarde("browser-exception"));
  console.log("Echte browserproductietest "+naam+" geslaagd: "+waarde("browser-labels")+" temperatuurmarkeringen zonder losse stippen, rustige nu-markering, daggebonden zoninformatie, compacte tooltip, vast neerslagkanslabel, compact uitklapbaar Nachtzicht en minuutprecieze lokale klok correct.");
}
try{voerBrowserUit("390,844","mobiel Chromium");voerBrowserUit("1440,1000","desktop Chromium");}
finally{fs.rmSync(dir,{recursive:true,force:true});}
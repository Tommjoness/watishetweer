"use strict";
const fs=require("fs"),path=require("path"),os=require("os"),{chromium}=require("playwright-core"),{bouw}=require("./data.js");
const browserNaam=require("./scripts/vind-browser.js").vindBrowser()||"google-chrome";
const browserPad=browserNaam.includes(path.sep)?browserNaam:(process.env.PATH||"").split(path.delimiter).map(dir=>path.join(dir,browserNaam)).find(p=>fs.existsSync(p))||browserNaam;
const bron=path.join(__dirname,"public","index.html");
if(!fs.existsSync(bron))throw new Error("public/index.html ontbreekt; voer eerst de build uit");
let html=fs.readFileSync(bron,"utf8");

/* Deze test beoordeelt het echte gebouwde UI-artifact, niet de beschikbaarheid
   van externe providers. Gebruik daarom vaste geldige weer- en AQ-fixtures;
   live providerwerking heeft eigen productie-smokes. */
const fixtureData=bouw({tempNu:17,wcNu:1,ccNu:30,pp:()=>22,som:2.4});
fixtureData.latitude=52.35;fixtureData.longitude=5.26;fixtureData.timezone="Europe/Amsterdam";fixtureData.utc_offset_seconds=7200;
fixtureData.daily.sunshine_duration=fixtureData.daily.time.map(()=>7*3600);
const fixtureAir={current:{european_aqi:24,us_aqi:40},hourly:{time:[fixtureData.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const fetchStub=`<script>
const BROWSER_FIXTURE=${JSON.stringify(fixtureData)};
const BROWSER_AIR=${JSON.stringify(fixtureAir)};
const BROWSER_NATIVE_DATE=Date;
const BROWSER_NATIVE_START=BROWSER_NATIVE_DATE.now();
const BROWSER_FIXTURE_START=BROWSER_NATIVE_DATE.parse('2026-07-22T12:30:00Z');
class BrowserFixtureDate extends BROWSER_NATIVE_DATE{
  constructor(...args){
    super(...(args.length?args:[BROWSER_FIXTURE_START+(BROWSER_NATIVE_DATE.now()-BROWSER_NATIVE_START)]));
  }
  static now(){return BROWSER_FIXTURE_START+(BROWSER_NATIVE_DATE.now()-BROWSER_NATIVE_START);}
}
window.Date=BrowserFixtureDate;
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?{bron:'test',dekking:true,land:'NL',lijst:[]}
    :u.includes('/api/neerslag')?{beschikbaar:false,provider:'knmi',reden:'niet beschikbaar'}
    :u.includes('/api/plaatsnaam')?{naam:'Browsertest',land:'NL',bron:'test'}
    :u.includes('air-quality-api.open-meteo.com')?BROWSER_AIR:BROWSER_FIXTURE;
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",fetchStub+"</head>");

/* Browserproductietest: het echte gebouwde artifact wordt in Chromium geladen.
   De test meet uitsluitend zichtbare/layoutcontracten met bovenstaande
   deterministische browserfixture. */
const reporter=`<script>
(function(){
  function meet(){
  try{
    const desktop=window.innerWidth>=1100;
    const chart=document.getElementById('chart'),svgBox=chart.getBoundingClientRect();
    const alleLabels=[...chart.querySelectorAll('text')].filter(el=>{
      const ff=String(el.getAttribute('font-family')||'');
      return ff.includes('Bodoni Moda')&&/^-?\\d+°$/.test((el.textContent||'').trim());
    });
    /* Piek en dal hebben een eigen stip (data-mobile-temp-marker-dot); alleen de
       gewone temperatuurlabels horen één op één bij een forecastpunt. Botsingen,
       randen en het nu-label worden wel over alle labels bewaakt. */
    const labels=alleLabels.filter(el=>!el.hasAttribute('data-mobile-temp-marker'));
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
    const botsingen=alleLabels.filter((a,i)=>alleLabels.slice(i+1).some(b=>{
      const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();
      return ra.width&&rb.width&&ra.left<rb.right&&ra.right>rb.left&&ra.top<rb.bottom&&ra.bottom>rb.top;
    })).length;
    /* Gelijke afgeronde temperaturen op naburige echte forecastpunten zijn
       inhoudelijk geldig. Bewaak de eerdere idempotencyregressie daarom via de
       stabiele data-index (en op desktop via exacte positie), niet via alleen
       gelijke tekst binnen een willekeurige afstand. */
    const labelSleutels=labels.map(el=>{
      const i=el.getAttribute('data-mobile-temp-index');
      return i!==null?'i:'+i:'p:'+el.getAttribute('x')+':'+el.getAttribute('y')+':'+(el.textContent||'').trim();
    });
    const dubbelNabij=labelSleutels.length-new Set(labelSleutels).size;
    const buiten=alleLabels.filter(el=>{const r=el.getBoundingClientRect();return r.left<svgBox.left-1||r.right>svgBox.right+1||r.top<svgBox.top-1||r.bottom>svgBox.bottom+1;}).length;

    const nuLabel=[...chart.querySelectorAll('text')].find(el=>/^nu\\s+-?\\d+°$/i.test((el.textContent||'').trim()));
    const nuPunt=[...chart.querySelectorAll('circle')].find(el=>String(el.getAttribute('fill')||'')==='var(--carmine)'&&Math.abs(Number(el.getAttribute('r'))-3)<0.2);
    let nuRustig=desktop?!nuLabel&&!!nuPunt:false,nuAfstand=null,nuBotst=null,nuHalo=null;
    if(nuLabel&&nuPunt){
      const ny=Number(nuLabel.getAttribute('y')),cy=Number(nuPunt.getAttribute('cy'));
      const nr=nuLabel.getBoundingClientRect();
      nuBotst=alleLabels.some(el=>{const r=el.getBoundingClientRect();return nr.width&&r.width&&nr.left<r.right&&nr.right>r.left&&nr.top<r.bottom&&nr.bottom>r.top;});
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
    const stats=document.querySelector('.dashrow-hero .stats');
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
    let nightAligned=true,nightRuim=true,nightCompact=true,nightExpand=true,nightDividerOk=true,nightDividerWidth='';
    if(nightKnop&&nightZichtbaar.length){
      const knopRand=parseFloat(getComputedStyle(nightKnop).borderTopWidth)||0;
      const rijRand=parseFloat(getComputedStyle(nightZichtbaar[nightZichtbaar.length-1]).borderBottomWidth)||0;
      nightDividerWidth=rijRand+'+'+knopRand;
      nightDividerOk=knopRand===0&&rijRand<=1.5&&(!desktop||rijRand>0);
    }
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
      uvOk=!!(uv&&uvStijl&&uvStijl.display==='grid'&&uvCols===2&&uvStijl.gridTemplateAreas==='"label value" "sub sub"');
    }

    const brief=(document.getElementById('brief')||{}).textContent||'';
    const dagen=document.querySelectorAll('#days .row.day:not(.kop)').length;
    const gridOk=desktop?cols===3:cols===2;
    const briefingDagOk=!/Morgen wordt het maximaal/i.test(brief);
    const graphUx=globalThis.WeatherNowMobileGraphUX20260828,compactMobile=window.innerWidth<=430;
    const mobileAnchors=compactMobile&&graphUx&&S.geo?graphUx.kiesKalenderUurLabelIndices(S.geo.TI,3,24):[];
    const nowAnchorRaw=nuLabel&&nuLabel.getAttribute('data-mobile-temp-anchor-index'),nowAnchor=nowAnchorRaw==null?NaN:Number(nowAnchorRaw);
    const anchorLabels=new Map(labels.map(el=>[Number(el.getAttribute('data-mobile-temp-index')),el]));
    /* Een anker naast piek, dal of nu heeft daar al een temperatuur staan: dat
       moet dan ook echt zo zijn (nu-label of markering wijst naar dit anker). */
    const gedektDoor=i=>(Number.isInteger(nowAnchor)&&nowAnchor===i)
      ||[...chart.querySelectorAll('text[data-mobile-temp-marker]')].some(el=>Number(el.getAttribute('data-mobile-temp-covers-anchor'))===i);
    const anchorOk=!compactMobile||mobileAnchors.every(i=>{
      if(gedektDoor(i))return true;
      const el=anchorLabels.get(i),verwacht=Number.isFinite(Number(S.geo&&S.geo.T&&S.geo.T[i]))?Math.round(Number(S.geo.T[i]))+'°':'';
      return !!el&&(el.textContent||'').trim()===verwacht&&el.getAttribute('data-mobile-temp-priority')==='anchor';
    });
    const missingAnchors=compactMobile?(chart.getAttribute('data-mobile-temp-missing-anchors')||''):'';
    /* Iedere temperatuur op de mobiele lijn staat boven haar eigen punt: onder
       de lijn leest een getal als de temperatuur van het vlak eronder. */
    const onderPunt=!compactMobile?[]:alleLabels.filter(el=>{
      const marker=el.getAttribute('data-mobile-temp-marker'),i=el.getAttribute('data-mobile-temp-index');
      const punt=marker?chart.querySelector('circle[data-mobile-temp-marker-dot="'+marker+'"]'):(i!==null?chart.querySelector('circle[data-temp-index="'+i+'"]'):null);
      const cy=punt?Number(punt.getAttribute('cy')):NaN,y=Number(el.getAttribute('y'));
      return !Number.isFinite(cy)||!Number.isFinite(y)||y>=cy-2;
    }).map(el=>(el.textContent||'').trim());

    /* Iedere temperatuur in de grafiek heeft een uurtijd onder haar punt. */
    const zonderTijd=(()=>{
      const g=S.geo;if(!g||Number(g.n)>25)return [];
      const tijden=[...chart.querySelectorAll('text')].filter(el=>!el.closest('#scrub')&&!el.closest('g[data-q4-rain-periods]')&&/^\\d{2}:00$/.test((el.textContent||'').trim()));
      const heeftTijd=i=>tijden.some(t=>Number(t.getAttribute('data-mobile-hour-index'))===i||Math.abs(Number(t.getAttribute('x'))-g.x(i))<3);
      return alleLabels.map(el=>{
        let i=null;
        for(const a of ['data-mobile-temp-marker-index','data-desktop-temp-marker-index','data-mobile-temp-index']){const v=el.getAttribute(a);if(v!==null&&v!==''){i=Number(v);break;}}
        if(i===null){
          const lx=Number(el.getAttribute('x')),w=Number((el.textContent||'').trim().replace('°',''));let d=Infinity;
          g.T.forEach((v,k)=>{if(Number.isFinite(Number(v))&&Math.round(Number(v))===w&&Math.abs(g.x(k)-lx)<d){d=Math.abs(g.x(k)-lx);i=k;}});
        }
        return i!==null&&heeftTijd(i)?null:(el.textContent||'').trim()+'@'+(i===null?'?':String(g.TI[i]).slice(11,16));
      }).filter(Boolean);
    })();

    /* Desktop draagt dezelfde accenten als mobiel: zacht vlak onder de lijn, een
       weericoon boven iedere uurtijd (vrij van plot en uurtijden, binnen de
       viewBox) en bij een uitgelicht hoogste/laagste cijfer een stip op
       precies het punt dat dat cijfer draagt. */
    let desktopAccent=!desktop,desktopAccentInfo='';
    if(desktop){
      const g=S.geo,onder=Number(g.pt)+Number(g.ih),vb=chart.viewBox.baseVal;
      const vlak=!!chart.querySelector('path[data-desktop-temp-area="1"]');
      const iconen=[...chart.querySelectorAll('g[data-desktop-weather-icon]')];
      const uurTijden=[...chart.querySelectorAll('text')].filter(el=>!el.closest('#scrub')&&!el.closest('g[data-q4-rain-periods]')&&/^\\d{2}:00$/.test((el.textContent||'').trim()));
      const iconTop=iconen.map(el=>Number((/translate\\([^,]+,([^)]+)\\)/.exec(el.getAttribute('transform')||'')||[])[1]));
      const vrijVanPlot=iconTop.every(y=>Number.isFinite(y)&&y>=onder+2);
      const ir=iconen.map(el=>el.getBoundingClientRect()),tr=[...chart.querySelectorAll('text')].filter(el=>!el.closest('#scrub')).map(el=>el.getBoundingClientRect()).filter(r=>r.width);
      const iconOverlap=ir.some(a=>tr.some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));
      const binnen=uurTijden.every(el=>Number(el.getAttribute('y'))+3<=vb.height);
      const markers=[...chart.querySelectorAll('text[data-desktop-temp-marker]')];
      const markersOp=markers.every(el=>{
        const i=el.getAttribute('data-desktop-temp-marker-index'),dot=chart.querySelector('circle[data-desktop-temp-marker-dot][data-desktop-temp-marker-index="'+i+'"]');
        return dot&&Math.round(Number(g.T[Number(i)]))===Number((el.textContent||'').trim().replace('°',''))&&Math.abs(Number(dot.getAttribute('cx'))-Number(el.getAttribute('x')))<=Number(g.cw)*1.2;
      });
      /* Geen cijfer zweeft los van zijn punt (derde laag = 82px). */
      const stippen=[...chart.querySelectorAll('circle[data-temp-index]')].map(c=>({x:Number(c.getAttribute('cx')),y:Number(c.getAttribute('cy'))}));
      const zwevend=alleLabels.filter(el=>{
        const x=Number(el.getAttribute('x')),y=Number(el.getAttribute('y'));let best=null;
        stippen.forEach(d=>{if(!best||Math.abs(d.x-x)<Math.abs(best.x-x))best=d;});
        return best&&Math.abs(best.y-y)>52;
      }).length;
      /* In een tussenbuild zijn regenperiodes nog zichtbaar; dan laat de desktoplaag
         de iconen bewust weg en blijven de uurtijden onaangeroerd. */
      const regenSkip=chart.getAttribute('data-desktop-weather-icons-skip')==='regen';
      const iconenOk=regenSkip?iconen.length===0&&!chart.querySelector('text[data-desktop-base-y]'):iconen.length>=Math.max(1,uurTijden.length-1);
      desktopAccent=zwevend===0&&vlak&&iconenOk&&vrijVanPlot&&!iconOverlap&&binnen&&markersOp;
      desktopAccentInfo=['zwevend:'+zwevend,'skip:'+regenSkip,vlak,iconen.length+'/'+uurTijden.length,vrijVanPlot,iconOverlap,binnen,markers.length+':'+markersOp].join(',');
    }

    /* Het nieuwe vaste drie-uurscontract geldt voor de compacte 320–430px
       grafiekowner en wordt daar hard afgedwongen. Tussen 431–1099px blijft de
       bestaande responsieve selectie gelden; desktop houdt zijn rijke labelset. */
    const labelDichtheidOk=desktop?labels.length>=5:compactMobile
      ?(anchorOk&&!missingAnchors&&labels.length===tempPunten.length)
      :(labels.length>=4&&labels.length===tempPunten.length);
    document.body.dataset.browserTestResult=(zonderTijd.length===0&&desktopAccent&&brief&&briefingDagOk&&dagen>=7&&labelDichtheidOk&&onderPunt.length===0&&botsingen===0&&dubbelNabij===0&&buiten===0&&lossePunten===0&&nuRustig&&scrubOk&&scrubKort&&neerslagkansVast&&tooltipCompact&&klokOk&&gridOk&&!statOverflow&&statsStabiel&&statsCentraal&&dagenLijnOk&&dagMmLeesbaar&&aqVult&&nightAligned&&nightRuim&&nightCompact&&nightExpand&&nightDividerOk&&mobileKopOk&&uvOk&&zonSemantiekOk)?'ok':'fout';
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
    document.body.dataset.browserNightDivider=String(nightDividerOk)+':'+nightDividerWidth;
    document.body.dataset.browserBriefingDag=String(briefingDagOk);
    document.body.dataset.browserMobileKop=String(mobileKopOk);
    document.body.dataset.browserUv=String(uvOk);
    document.body.dataset.browserZon=String(zonSemantiekOk);
    document.body.dataset.browserAnchors=String(anchorOk);
    document.body.dataset.browserCompactMobile=String(compactMobile);
    document.body.dataset.browserInnerWidth=String(window.innerWidth);
    document.body.dataset.browserMissingAnchors=missingAnchors;
    document.body.dataset.browserOnderPunt=onderPunt.join('|');
    document.body.dataset.browserDesktopAccent=desktopAccentInfo;
    document.body.dataset.browserZonderTijd=zonderTijd.join('|');
  }catch(e){document.body.dataset.browserTestResult='exception';document.body.dataset.browserException=String(e&&e.message||e);}
  }
  /* Meet na de deterministische fixture-render rechtstreeks de echte UI-state.
     Ontbrekende of onjuiste onderdelen falen daardoor via dezelfde inhoudelijke
     assertions, zonder een tweede readiness-contract ervoor te zetten. */
  setTimeout(meet,10000);
})();
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-browser-"));
const fixture=path.join(dir,"index.html");fs.writeFileSync(fixture,html);
const url="file://"+fixture+"?lat=52.3500&lon=5.2600&plaats=Browsertest";
async function voerBrowserUit(breedte,hoogte,naam){
  /* Chromium handhaaft sinds recente runner-versies een minimale native
     vensterbreedte van 500px. Playwrights CDP-viewport houdt deze browser-smoke
     daarom deterministisch op de bedoelde CSS-viewport, inclusief 390px. */
  const browser=await chromium.launch({executablePath:browserPad,headless:true,args:[
    "--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files"
  ]});
  let dom="";
  try{
    const page=await browser.newPage({viewport:{width:breedte,height:hoogte}});
    await page.goto(url,{waitUntil:"load"});
    await page.waitForFunction(()=>!!document.body.dataset.browserTestResult,null,{timeout:15000});
    dom=await page.content();
  }finally{
    await browser.close();
  }
  const waarde=veld=>{const m=new RegExp('data-'+veld+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(waarde("browser-night-divider")?.startsWith("false"))throw new Error(naam+": Nachtzicht-scheiding="+waarde("browser-night-divider"));
  if(waarde("browser-test-result")!=="ok")throw new Error(naam+": resultaat="+waarde("browser-test-result")+", labels="+waarde("browser-labels")+", punten="+waarde("browser-punten")+", lossePunten="+waarde("browser-losse-punten")+", botsingen="+waarde("browser-botsingen")+", dubbel="+waarde("browser-dubbel")+", buiten="+waarde("browser-buiten")+", nu="+waarde("browser-nu")+", nuAfstand="+waarde("browser-nu-afstand")+", nuBotst="+waarde("browser-nu-botst")+", nuHalo="+waarde("browser-nu-halo")+", scrub="+waarde("browser-scrub")+", scrubKort="+waarde("browser-scrub-kort")+", neerslagkans="+waarde("browser-kans")+", scrubTekst="+waarde("browser-scrub-debug")+", tooltip="+waarde("browser-tooltip")+", tooltipW="+waarde("browser-tooltip-w")+", klok="+waarde("browser-klok")+", grid="+waarde("browser-grid")+", overflow="+waarde("browser-overflow")+", statsStabiel="+waarde("browser-stats-stabiel")+", statsCentraal="+waarde("browser-stats-centraal")+", dagenLijn="+waarde("browser-dagen-lijn")+", dagMm="+waarde("browser-dag-mm")+", aq="+waarde("browser-aq")+", night="+waarde("browser-night")+", nightRuim="+waarde("browser-night-ruim")+", nightCompact="+waarde("browser-night-compact")+", nightExpand="+waarde("browser-night-expand")+", briefingDag="+waarde("browser-briefing-dag")+", mobileKop="+waarde("browser-mobile-kop")+", uv="+waarde("browser-uv")+", zon="+waarde("browser-zon")+", compactMobile="+waarde("browser-compact-mobile")+", innerWidth="+waarde("browser-inner-width")+", anchors="+waarde("browser-anchors")+", missingAnchors="+waarde("browser-missing-anchors")+", onderPunt="+waarde("browser-onder-punt")+", desktopAccent="+waarde("browser-desktop-accent")+", zonderTijd="+waarde("browser-zonder-tijd")+", exception="+waarde("browser-exception"));
  console.log("Echte browserproductietest "+naam+" geslaagd: "+waarde("browser-labels")+" temperatuurmarkeringen zonder losse stippen, rustige nu-markering, daggebonden zoninformatie, compacte tooltip, vast neerslagkanslabel, compact uitklapbaar Nachtzicht en minuutprecieze lokale klok correct.");
}
Promise.resolve().then(async()=>{
  await voerBrowserUit(390,844,"mobiel Chromium");
  await voerBrowserUit(1440,1000,"desktop Chromium");
}).finally(()=>fs.rmSync(dir,{recursive:true,force:true})).catch(err=>{console.error(err&&err.stack||err);process.exit(1);});

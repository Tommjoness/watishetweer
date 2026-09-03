"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
const {bouw}=require("./data.js");

function vindBrowser(){
  for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync("sh",["-lc","command -v "+n],{encoding:"utf8"});
    if(r.status===0&&r.stdout.trim())return r.stdout.trim();
  }
  return null;
}
const browser=vindBrowser();
if(!browser){
  if(process.env.CI){console.error("FOUT final-release browsertest: Chrome/Chromium ontbreekt.");process.exit(1);}
  console.log("SKIP final-release browsertest: lokaal geen Chrome/Chromium.");process.exit(0);
}
const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
const basisHtml=fs.readFileSync(productie,"utf8");
const fixture=bouw({geenKwartier:true});
fixture.daily.sunshine_duration=fixture.daily.time.map(()=>6*3600);
fixture.current.visibility=20000;

function injecteerBasis(html){
  const stub=`<script>
(function(){
  try{localStorage.clear();sessionStorage.clear();}catch(e){}
  window.__wiwFixture=${JSON.stringify(fixture)};
  window.__wiwPlan={mode:'success',delay:0,perLat:null};window.__wiwOffline=false;window.__wiwAccelerateTimeouts=false;
  const echteSetTimeout=window.setTimeout.bind(window);window.__wiwEchteSetTimeout=echteSetTimeout;
  window.setTimeout=function(fn,ms){
    const args=[].slice.call(arguments,2);
    const versneld=window.__wiwAccelerateTimeouts?(ms===10000?45:ms===7000?35:ms):ms;
    return echteSetTimeout(()=>fn.apply(null,args),versneld);
  };
  try{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>!window.__wiwOffline});}catch(e){}
  try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
  const abortFout=()=>{try{return new DOMException('Aborted','AbortError');}catch(e){const x=new Error('Aborted');x.name='AbortError';return x;}};
  const antwoord=(ok,data,status)=>({ok:!!ok,status:status||200,json:async()=>JSON.parse(JSON.stringify(data)),text:async()=>JSON.stringify(data)});
  window.fetch=function(input,opt){
    const url=String(input||''),signal=opt&&opt.signal;
    if(url.includes('/api/waarschuwingen'))return Promise.resolve(antwoord(true,{dekking:false,reden:'niet beschikbaar'},200));
    if(url.includes('air-quality-api.open-meteo.com'))return Promise.resolve(antwoord(false,{},503));
    if(url.includes('/api/plaatsnaam'))return Promise.resolve(antwoord(true,{naam:'Kansas City',bron:'test'},200));
    if(url.includes('geocoding-api.open-meteo.com'))return Promise.resolve(antwoord(true,{results:[{name:'Kansas City',latitude:39.0997,longitude:-94.5786,country_code:'US'}]},200));
    if(!url.includes('api.open-meteo.com/v1/forecast'))return Promise.resolve(antwoord(false,{},404));
    let lat='';try{lat=new URL(url).searchParams.get('latitude')||'';}catch(e){}
    const plan=window.__wiwPlan||{},per=plan.perLat&&plan.perLat[lat],mode=per&&per.mode||plan.mode||'success',delay=per&&per.delay!=null?per.delay:(plan.delay||0);
    return new Promise((resolve,reject)=>{
      let klaar=false,timer=null;
      const afbreken=()=>{if(klaar)return;klaar=true;if(timer)clearTimeout(timer);reject(abortFout());};
      if(signal){if(signal.aborted)return afbreken();signal.addEventListener('abort',afbreken,{once:true});}
      if(mode==='timeout')return;
      timer=echteSetTimeout(()=>{if(klaar)return;klaar=true;if(signal)signal.removeEventListener('abort',afbreken);if(mode==='provider-error')resolve(antwoord(false,{},503));else resolve(antwoord(true,window.__wiwFixture,200));},delay);
    });
  };
})();
</script>`;
  return html.replace("</head>",stub+"</head>");
}
function chromeDump(html,w,h,budget){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-final-release-"));
  try{
    const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${w},${h}`,`--virtual-time-budget=${budget||1800}`,"--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:48*1024*1024,timeout:30000});
    if(r.status!==0)throw new Error(`${w}x${h}: browser exit ${r.status}: `+String(r.stderr||"").slice(-1200));
    return r.stdout||"";
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function attr(dom,k,prefix){const m=new RegExp(`data-${prefix||'case'}-${k}="([^"]*)"`).exec(dom);return m&&m[1];}
function eis(v,msg){if(!v)throw new Error(msg);}

function scenarioHtml(code){
  let html=injecteerBasis(basisHtml);
  const reporter=`<script>
(async()=>{
  const zet=(k,v)=>document.body.setAttribute('data-case-'+k,String(v));
  const slaap=ms=>new Promise(r=>window.__wiwEchteSetTimeout(r,ms));
  const app=document.getElementById('app'),st=document.getElementById('state'),q=document.getElementById('q');
  const status=document.getElementById('locatie-laadstatus');
  const statusTekst=()=>{
    const tekst=status&&status.querySelector('.locatie-status-tekst');
    return String(status&&status.hidden===false&&tekst?tekst.textContent:(st&&st.textContent)||'');
  };
  const retryAanwezig=()=>{
    const compact=status&&status.querySelector('.locatie-status-retry');
    return !!((compact&&!compact.hidden)||(st&&st.querySelector('.wiw-location-retry')));
  };
  const reset=(wisOpslag=true)=>{
    try{clearNuTimer();clearKlokTimer();}catch(e){}
    if(wisOpslag){try{localStorage.clear();sessionStorage.clear();}catch(e){}}
    window.__wiwOffline=false;window.__wiwAccelerateTimeouts=false;window.__wiwPlan={mode:'success',delay:0,perLat:null};
    document.documentElement.classList.remove('wn-progressief');app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');
    S.lat=null;S.lon=null;S.label='';S.land=null;S.d=null;S.air=null;S.op=0;S.luchtOp=0;S.dag=null;S.verversMislukt=false;S.actieveWaarschuwingen=[];
    app.style.display='none';st.style.display='none';q.value='';
    try{history.replaceState(null,'',location.pathname);}catch(e){}
  };
  const plan=(mode,delay,perLat)=>{window.__wiwPlan={mode,delay:delay||0,perLat:perLat||null};window.__wiwOffline=false;window.__wiwAccelerateTimeouts=mode==='timeout';};
  const goed=(naam,lat,lon)=>S.d&&S.label===naam&&Math.abs(Number(S.lat)-lat)<.00001&&Math.abs(Number(S.lon)-lon)<.00001&&q.value===naam&&document.title.startsWith(naam+' · ');
  const laadGoed=async(naam,lat,lon,delay,land)=>{q.value=naam;plan('success',delay||0);await load(lat,lon,naam,false,true,land||null);await slaap(40);return goed(naam,lat,lon);};
  const snapshot=()=>{zet('label',S.label);zet('lat',S.lat);zet('lon',S.lon);zet('q',q.value);zet('title',document.title);zet('state',statusTekst());zet('retry',retryAanwezig());zet('data',!!S.d);zet('app',getComputedStyle(app).display);};
  try{
    await slaap(80);reset();
    ${code}
    snapshot();zet('done','ok');
  }catch(e){snapshot();zet('error',e&&e.stack||e);zet('done','fout');}
})();
</script>`;
  return html.replace("</body>",reporter+"</body>");
}
function draaiScenario(naam,code,budget){
  const dom=chromeDump(scenarioHtml(code),1363,936,budget||1800);
  const v=k=>attr(dom,k,'case');
  if(v('done')!=="ok")throw new Error(naam+" reporter faalde: "+v('error'));
  if(v('result')!=="ok")throw new Error(naam+" faalde: label="+v('label')+", lat="+v('lat')+", lon="+v('lon')+", q="+v('q')+", title="+v('title')+", retry="+v('retry')+", data="+v('data')+", app="+v('app')+", state="+v('state'));
  console.log(naam+": OK");
}

draaiScenario("snelle forecast",`
  ls.set(KEY_D,null);
  zet('result',await laadGoed('Amsterdam',52.3676,4.9041,0,'NL')?'ok':'fout');
`);

draaiScenario("trage succesvolle forecast",`
  ls.set(KEY_D,null);
  zet('result',await laadGoed('Kansas City',39.0997,-94.5786,300,'US')?'ok':'fout');
`,2200);

draaiScenario("timeout herstelt vorige locatie",`
  ls.set(KEY_D,null);
  if(!await laadGoed('Amsterdam',52.3676,4.9041,0,'NL'))throw new Error('Amsterdam start faalde');
  q.value='Kansas City';plan('timeout',0);await load(39.0997,-94.5786,'Kansas City',false,true,'US');await slaap(40);
  zet('result',goed('Amsterdam',52.3676,4.9041)&&getComputedStyle(app).display!=='none'&&/Kansas City/.test(statusTekst())&&retryAanwezig()?'ok':'fout');
`,2200);

draaiScenario("providerfout herstelt vorige locatie",`
  ls.set(KEY_D,null);
  if(!await laadGoed('Amsterdam',52.3676,4.9041,0,'NL'))throw new Error('Amsterdam start faalde');
  q.value='Kansas City';plan('provider-error',0);await load(39.0997,-94.5786,'Kansas City',false,true,'US');await slaap(40);
  zet('result',goed('Amsterdam',52.3676,4.9041)&&getComputedStyle(app).display!=='none'&&/Kansas City/.test(statusTekst())&&retryAanwezig()?'ok':'fout');
`);

draaiScenario("offline herstelt vorige locatie",`
  ls.set(KEY_D,null);
  if(!await laadGoed('Amsterdam',52.3676,4.9041,0,'NL'))throw new Error('Amsterdam start faalde');
  q.value='Kathmandu';plan('provider-error',0);window.__wiwOffline=true;await load(27.7172,85.3240,'Kathmandu',false,true,'NP');await slaap(40);
  zet('result',goed('Amsterdam',52.3676,4.9041)&&getComputedStyle(app).display!=='none'&&/Geen internetverbinding/.test(statusTekst())&&/Kathmandu/.test(statusTekst())?'ok':'fout');
`);

draaiScenario("passende cache wordt gebruikt",`
  const op=Date.now()-60000;
  ls.set(KEY_D,{d:window.__wiwFixture,air:null,airOp:0,label:'Kansas City',lat:39.100,lon:-94.579,op,land:'US'});
  q.value='Kansas City';plan('provider-error',0);await load(39.0997,-94.5786,'Kansas City',false,true,'US');await slaap(40);
  zet('result',goed('Kansas City',39.0997,-94.5786)&&S.verversMislukt&&getComputedStyle(app).display!=='none'&&/laatst opgehaalde gegevens voor Kansas City/.test(statusTekst())?'ok':'fout');
`);

draaiScenario("verkeerde cache wordt geweigerd",`
  const op=Date.now()-60000;
  ls.set(KEY_D,{d:window.__wiwFixture,air:null,airOp:0,label:'Amsterdam',lat:52.368,lon:4.904,op,land:'NL'});
  q.value='Kansas City';plan('provider-error',0);await load(39.0997,-94.5786,'Kansas City',false,true,'US');await slaap(40);
  zet('result',S.d===null&&S.label==='Kansas City'&&q.value==='Kansas City'&&getComputedStyle(app).display==='none'&&/geen weergegevens van een andere locatie/i.test(statusTekst())?'ok':'fout');
`);

draaiScenario("race laat nieuwste locatie winnen",`
  ls.set(KEY_D,null);window.__wiwAccelerateTimeouts=false;
  window.__wiwPlan={mode:'success',delay:0,perLat:{'52.3676':{mode:'success',delay:400},'39.0997':{mode:'success',delay:250},'27.7172':{mode:'success',delay:60}}};
  q.value='Amsterdam';const p1=load(52.3676,4.9041,'Amsterdam',false,true,'NL');await slaap(10);
  q.value='Kansas City';const p2=load(39.0997,-94.5786,'Kansas City',false,true,'US');await slaap(10);
  q.value='Kathmandu';const p3=load(27.7172,85.3240,'Kathmandu',false,true,'NP');
  await Promise.allSettled([p1,p2,p3]);await slaap(60);
  zet('result',goed('Kathmandu',27.7172,85.3240)?'ok':'fout');
`,2400);

draaiScenario("directe URL weigert cache van andere locatie",`
  const op=Date.now()-60000;
  ls.set(KEY_D,{d:window.__wiwFixture,air:null,airOp:0,label:'Amsterdam',lat:52.368,lon:4.904,op,land:'NL'});
  history.replaceState(null,'','?lat=39.100&lon=-94.579&plaats=Kansas%20City&land=US');q.value='Kansas City';plan('provider-error',0);
  await load(39.0997,-94.5786,'Kansas City',false,false,'US');await slaap(60);
  zet('result',S.d===null&&S.label==='Kansas City'&&q.value==='Kansas City'&&getComputedStyle(app).display==='none'&&document.title.startsWith('Kansas City · ')?'ok':'fout');
`,2200);

draaiScenario("reload gebruikt passende cache",`
  ls.set(KEY_D,null);
  if(!await laadGoed('Kathmandu',27.7172,85.3240,0,'NP'))throw new Error('Kathmandu start faalde');
  const bewaard=ls.get(KEY_D,null);reset(false);ls.set(KEY_D,bewaard);q.value='Kathmandu';plan('provider-error',0);
  await load(27.7172,85.3240,'Kathmandu',false,true,'NP');await slaap(40);
  zet('result',goed('Kathmandu',27.7172,85.3240)&&S.verversMislukt&&/laatst opgehaalde gegevens voor Kathmandu/.test(statusTekst())?'ok':'fout');
`);

console.log("Final-release locatiehardening: 10 cache/fout/racescenario's elk in een vers Chromium-proces geslaagd.");

/* Exact afgesproken responsive breedtes, eveneens ieder met een vers proces. */
const viewports=[[320,844],[360,844],[390,844],[430,932],[1100,900],[1280,800],[1363,936],[1440,900],[1600,900],[1920,1080]];
for(const [w,h] of viewports){
  let html=injecteerBasis(basisHtml);
  const reporter=`<script>window.__wiwEchteSetTimeout(()=>{const viewportWidth=window.innerWidth;const zet=(k,v)=>document.body.setAttribute('data-layout-'+k,String(v));try{
    const stats=[...document.querySelectorAll('.final-top-grid>.stats .stat')].filter(e=>getComputedStyle(e).display!=='none');
    const tops=[...new Set(stats.map(e=>Math.round(e.getBoundingClientRect().top)))];
    const table=document.getElementById('wiw-hour-table'),th3=table&&table.querySelector('thead th:nth-child(3)'),scroll=document.getElementById('wiw-hour-scroll');
    zet('tiles',stats.length);zet('rows',tops.length);zet('head',th3?.textContent?.trim()||'');zet('head-aria',th3?.getAttribute('aria-label')||'');
    zet('head-clip',th3&&th3.scrollWidth<=th3.clientWidth+1?'ok':'fout');zet('table-overflow',scroll?Math.max(0,scroll.scrollWidth-scroll.clientWidth):999);
    zet('page-overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-document.documentElement.clientWidth);
    const minTouch=[...document.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect(),s=getComputedStyle(b);return r.width>0&&r.height>0&&s.display!=='none';}).map(b=>Math.min(b.getBoundingClientRect().width,b.getBoundingClientRect().height));
    zet('min-touch',viewportWidth<=430?Math.round(Math.min(...minTouch.filter(Number.isFinite))):44);zet('done','ok');
  }catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},700);</script>`;
  html=html.replace("</body>",reporter+"</body>");
  const dom=chromeDump(html,w,h,1800),v=k=>attr(dom,k,'layout');
  eis(v('done')==='ok',`${w}px layout reporter faalde: ${v('exception')}`);
  eis(v('tiles')==='8',`${w}px: verwacht 8 zichtbare hoofdtegels, kreeg ${v('tiles')}`);
  if(w>=1100&&w<1600)eis(v('rows')==='3',`${w}px: 3+3+2 moet drie rijen geven, kreeg ${v('rows')}`);
  if(w>=1600)eis(v('rows')==='2',`${w}px: 4x2 moet twee rijen geven, kreeg ${v('rows')}`);
  eis(v('head')==='Gevoel'&&v('head-aria')==='Gevoelstemperatuur'&&v('head-clip')==='ok',`${w}px: gevoelstemperatuurkop niet compact/toegankelijk/passend`);
  eis(Number(v('table-overflow'))<=1,`${w}px: uurtabel heeft ${v('table-overflow')}px horizontale overflow`);
  eis(Number(v('page-overflow'))<=1,`${w}px: pagina heeft ${v('page-overflow')}px horizontale overflow`);
  if(w<=430)eis(Number(v('min-touch'))>=44,`${w}px: kleinste zichtbare touchdoel is ${v('min-touch')}px`);
  console.log(`${w}x${h}: layout groen; ${v('rows')} tegelrijen, Gevoel-kop past, pagina-overflow ${v('page-overflow')}px${w<=430?', touch ≥'+v('min-touch')+'px':''}.`);
}
console.log("Final-release browsertest geslaagd: geïsoleerde cache/fout/racescenario's plus 10 afgesproken viewports.");
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
fixture.latitude=52.3676;fixture.longitude=4.9041;
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
    const versneld=window.__wiwAccelerateTimeouts?(ms===10000?45:ms===7000?35:ms===5000?25:ms):ms;
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
  const tekst=statusTekst();
  zet('result',goed('Amsterdam',52.3676,4.9041)&&getComputedStyle(app).display!=='none'&&/Kathmandu/.test(tekst)&&/Amsterdam/.test(tekst)&&/niet geladen|blijven staan/i.test(tekst)&&retryAanwezig()?'ok':'fout');
`);

draaiScenario("passende cache wordt gebruikt",`
  const op=Date.now()-60000;
  ls.set(KEY_D,{d:window.__wiwFixture,air:null,airOp:0,label:'Kansas City',lat:39.100,lon:-94.579,op,land:'US'});
  q.value='Kansas City';plan('provider-error',0);await load(39.0997,-94.5786,'Kansas City',false,true,'US');await slaap(40);
  const tekst=statusTekst();
  zet('result',goed('Kansas City',39.0997,-94.5786)&&S.verversMislukt&&getComputedStyle(app).display!=='none'&&/Kansas City/.test(tekst)&&/niet vernieuwd|blijven staan/i.test(tekst)&&retryAanwezig()?'ok':'fout');
`);

draaiScenario("verkeerde cache wordt geweigerd",`
  const op=Date.now()-60000;
  ls.set(KEY_D,{d:window.__wiwFixture,air:null,airOp:0,label:'Amsterdam',lat:52.368,lon:4.904,op,land:'NL'});
  q.value='Kansas City';plan('provider-error',0);await load(39.0997,-94.5786,'Kansas City',false,true,'US');await slaap(40);
  const tekst=statusTekst();
  zet('result',S.d===null&&S.label==='Kansas City'&&q.value==='Kansas City'&&getComputedStyle(app).display==='none'&&/Kansas City/.test(tekst)&&/niet geladen|geen weergegevens/i.test(tekst)&&retryAanwezig()?'ok':'fout');
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
  const c=ls.get(KEY_D);reset(false);ls.set(KEY_D,c);q.value='Kathmandu';plan('provider-error',0);await load(27.7172,85.3240,'Kathmandu',false,true,'NP');await slaap(40);
  zet('result',goed('Kathmandu',27.7172,85.3240)&&S.verversMislukt&&getComputedStyle(app).display!=='none'?'ok':'fout');
`);

draaiScenario("browser back URL/history-state blijft coherent",`
  ls.set(KEY_D,null);
  if(!await laadGoed('Amsterdam',52.3676,4.9041,0,'NL'))throw new Error('Amsterdam start faalde');
  history.pushState({lat:39.100,lon:-94.579,label:'Kansas City',land:'US'},'', '?lat=39.100&lon=-94.579&plaats=Kansas%20City&land=US');
  history.pushState({lat:27.717,lon:85.324,label:'Kathmandu',land:'NP'},'', '?lat=27.717&lon=85.324&plaats=Kathmandu&land=NP');
  plan('success',0);history.back();await slaap(180);
  zet('result',goed('Kansas City',39.100,-94.579)?'ok':'fout');
`,2200);

/* Visuele state-contracten op echt gerenderde fout- en cachedata-paden. */
{
  let html=injecteerBasis(basisHtml);
  const rep=`<script>(async()=>{const z=(k,v)=>document.body.setAttribute('data-visual-'+k,String(v));try{await new Promise(r=>window.__wiwEchteSetTimeout(r,60));try{localStorage.clear();sessionStorage.clear();}catch(e){}try{clearNuTimer();clearKlokTimer();}catch(e){}const app=document.getElementById('app'),st=document.getElementById('state'),q=document.getElementById('q');S.lat=null;S.lon=null;S.label='';S.land=null;S.d=null;S.air=null;S.op=0;S.luchtOp=0;S.dag=null;S.verversMislukt=false;S.actieveWaarschuwingen=[];document.documentElement.classList.remove('wn-progressief');app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');app.style.display='none';st.style.display='none';q.value='';window.__wiwPlan={mode:'provider-error',delay:0,perLat:null};window.__wiwOffline=false;q.value='Kansas City';await load(39.0997,-94.5786,'Kansas City',false,true,'US');await new Promise(r=>window.__wiwEchteSetTimeout(r,40));const status=document.getElementById('locatie-laadstatus'),tekst=status&&status.querySelector('.locatie-status-tekst'),retry=status&&status.querySelector('.locatie-status-retry');z('app',getComputedStyle(app).display);z('state',tekst&&tekst.textContent||'');z('retry',retry&&!retry.hidden);z('data',!!S.d);z('done','ok');}catch(e){z('error',e&&e.stack||e);z('done','fout');}})();</script>`;
  html=html.replace('</body>',rep+'</body>');const dom=chromeDump(html,390,844,1800),v=k=>attr(dom,k,'visual');
  eis(v('done')==='ok','visuele foutstate reporter faalde: '+v('error'));eis(v('app')==='none'&&v('data')==='false','lege foutstate moet dashboard en forecastdata leeg houden; app='+v('app')+', data='+v('data')+', state='+v('state')+', retry='+v('retry'));eis(/Kansas City/.test(v('state')||''),'foutstate moet doellocatie benoemen; state='+v('state'));eis(v('retry')==='true','foutstate mist zichtbare retry; state='+v('state'));
  console.log('visuele lege foutstate mobiel: OK');
}

console.log("Final-release browsertest: snelle/trage forecast, timeout/provider/offline, cache passend/verkeerd, race, directe URL, reload, browser-back en mobiele lege foutstate groen.");
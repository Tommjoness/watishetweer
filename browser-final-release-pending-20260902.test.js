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
  if(process.env.CI){console.error("FOUT final-release pending-state: Chrome/Chromium ontbreekt.");process.exit(1);}
  console.log("SKIP final-release pending-state: lokaal geen Chrome/Chromium.");process.exit(0);
}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt voor pending-state regressie.");
const fixture=bouw({geenKwartier:true});
fixture.daily.sunshine_duration=fixture.daily.time.map(()=>6*3600);
fixture.current.visibility=20000;

function antwoord(payload,ok,status){
  return `{ok:${ok!==false},status:${status||200},json:async()=>(${JSON.stringify(payload)}),text:async()=>JSON.stringify(${JSON.stringify(payload)})}`;
}

let html=fs.readFileSync(productie,"utf8");
const stub=`<script>
(function(){
  try{localStorage.clear();sessionStorage.clear();}catch(e){}
  window.__wiwFixture=${JSON.stringify(fixture)};
  window.__wiwPlan={delay:0};
  window.__wiwForecastRequests=0;
  const echt=window.setTimeout.bind(window);window.__wiwEchtSetTimeout=echt;
  try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
  window.fetch=function(input,opt){
    const url=String(input||''),signal=opt&&opt.signal;
    if(url.includes('/api/waarschuwingen'))return Promise.resolve(${antwoord({dekking:false,reden:"niet beschikbaar"})});
    if(url.includes('air-quality-api.open-meteo.com'))return Promise.resolve(${antwoord({},false,503)});
    if(!url.includes('api.open-meteo.com/v1/forecast'))return Promise.resolve(${antwoord({},false,404)});
    window.__wiwForecastRequests++;
    const delay=Number(window.__wiwPlan&&window.__wiwPlan.delay)||0;
    return new Promise((resolve,reject)=>{
      let klaar=false,timer=echt(()=>{if(klaar)return;klaar=true;resolve(${antwoord(fixture)});},delay);
      const abort=()=>{if(klaar)return;klaar=true;clearTimeout(timer);const e=new Error('aborted');e.name='AbortError';reject(e);};
      if(signal){if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});}
    });
  };
})();
</script>`;
html=html.replace("</head>",stub+"</head>");

const reporter=`<script>
(async()=>{
  const zet=(k,v)=>document.body.setAttribute('data-pending-'+k,String(v));
  const slaap=ms=>new Promise(r=>window.__wiwEchtSetTimeout(r,ms));
  const q=document.getElementById('q'),st=document.getElementById('state'),app=document.getElementById('app'),place=document.getElementById('place');
  const identiteit=(naam,lat,lon)=>S.d&&S.label===naam&&Math.abs(Number(S.lat)-lat)<.00001&&Math.abs(Number(S.lon)-lon)<.00001&&q.value===naam&&document.title.startsWith(naam+' · ');
  const urlIs=(naam,lat,lon)=>{try{const u=new URL(location.href),a=Number(u.searchParams.get('lat')),b=Number(u.searchParams.get('lon'));return u.searchParams.get('plaats')===naam&&Math.abs(a-lat)<.001&&Math.abs(b-lon)<.001;}catch(_){return false;}};
  try{
    /* Laat alleen de normale startup-microtasks afronden; deze test gebruikt daarna
       uitsluitend zijn eigen twee expliciete locatieverzoeken. */
    await slaap(60);
    try{localStorage.clear();sessionStorage.clear();}catch(e){}
    q.value='Amsterdam';window.__wiwPlan.delay=0;
    await load(52.3676,4.9041,'Amsterdam',false,true,'NL');await slaap(30);
    if(!identiteit('Amsterdam',52.3676,4.9041))throw new Error('Amsterdam-startstate niet coherent');

    const aanvragenVoorSwitch=window.__wiwForecastRequests;
    q.value='Kansas City';window.__wiwPlan.delay=600;
    const pendingBelofte=load(39.0997,-94.5786,'Kansas City',false,true,'US');
    await slaap(180);

    const laadstatus=document.getElementById('locatie-laadstatus');
    const laadtekst=laadstatus&&laadstatus.querySelector('.locatie-status-tekst');
    const retry=laadstatus&&laadstatus.querySelector('.locatie-status-retry');
    const pendingOk=identiteit('Amsterdam',52.3676,4.9041)
      &&getComputedStyle(app).display!=='none'
      &&!document.documentElement.classList.contains('wn-progressief')
      &&!app.classList.contains('wn-progressief')
      &&app.getAttribute('aria-busy')==='true'
      &&q.getAttribute('aria-busy')==='true'
      &&place.getAttribute('aria-label')==='Amsterdam'
      &&urlIs('Amsterdam',52.368,4.904)
      &&(!st.textContent||getComputedStyle(st).display==='none')
      &&!!laadstatus&&laadstatus.hidden===false
      &&!!laadtekst&&/Weer voor Kansas City ophalen/.test(laadtekst.textContent||'')
      &&!!retry&&retry.hidden
      &&window.__wiwForecastRequests===aanvragenVoorSwitch+1;
    zet('pending',pendingOk?'ok':'fout');
    zet('pending-label',S.label);zet('pending-lat',S.lat);zet('pending-lon',S.lon);zet('pending-q',q.value);
    zet('pending-title',document.title);zet('pending-place',place.getAttribute('aria-label')||'');zet('pending-url',location.href);
    zet('pending-state',st.textContent);zet('pending-status',laadtekst&&laadtekst.textContent||'');
    zet('pending-app',getComputedStyle(app).display);zet('pending-busy',app.getAttribute('aria-busy'));
    zet('pending-q-busy',q.getAttribute('aria-busy'));zet('pending-progressief',document.documentElement.classList.contains('wn-progressief'));
    zet('pending-requests',window.__wiwForecastRequests-aanvragenVoorSwitch);

    await pendingBelofte;await slaap(30);
    const successOk=identiteit('Kansas City',39.0997,-94.5786)
      &&getComputedStyle(app).display!=='none'
      &&place.getAttribute('aria-label')==='Kansas City'
      &&urlIs('Kansas City',39.100,-94.579)
      &&!document.documentElement.classList.contains('wn-progressief')
      &&!app.classList.contains('wn-progressief')
      &&app.getAttribute('aria-busy')!=='true'
      &&q.getAttribute('aria-busy')!=='true'
      &&(!laadstatus||laadstatus.hidden===true);
    zet('success',successOk?'ok':'fout');
    zet('success-label',S.label);zet('success-lat',S.lat);zet('success-lon',S.lon);zet('success-q',q.value);
    zet('success-title',document.title);zet('success-place',place.getAttribute('aria-label')||'');zet('success-url',location.href);
    zet('success-status',laadtekst&&laadtekst.textContent||'');zet('success-busy',app.getAttribute('aria-busy'));
    zet('done','ok');
  }catch(e){zet('error',e&&e.stack||e);zet('done','fout');}
})();
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-final-pending-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1363,936","--virtual-time-budget=2200","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:48*1024*1024,timeout:30000});
  if(r.status!==0)throw new Error("browser exit "+r.status+": "+String(r.stderr||"").slice(-1600));
  const dom=r.stdout||"";
  const v=k=>{const m=new RegExp('data-pending-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(v('done')!=="ok")throw new Error("pending-state reporter faalde: "+v('error'));
  if(v('pending')!=="ok")throw new Error("pending-state niet coherent: label="+v('pending-label')+", lat="+v('pending-lat')+", lon="+v('pending-lon')+", q="+v('pending-q')+", title="+v('pending-title')+", place="+v('pending-place')+", app="+v('pending-app')+", busy="+v('pending-busy')+", qBusy="+v('pending-q-busy')+", progressief="+v('pending-progressief')+", requests="+v('pending-requests')+", state="+v('pending-state')+", status="+v('pending-status')+", url="+v('pending-url'));
  if(v('success')!=="ok")throw new Error("successtate niet atomair: label="+v('success-label')+", lat="+v('success-lat')+", lon="+v('success-lon')+", q="+v('success-q')+", title="+v('success-title')+", place="+v('success-place')+", busy="+v('success-busy')+", status="+v('success-status')+", url="+v('success-url'));
  console.log("Final-release pending-state groen: tijdens wachten blijft Amsterdam volledig zichtbaar en coherent met één compacte Kansas City-laadstatus; na volledige forecast schakelt alle locatie-identiteit atomair naar Kansas City.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}

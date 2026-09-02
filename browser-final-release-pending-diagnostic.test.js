"use strict";
const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
const {bouw}=require("./data.js");
function browserPad(){for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){const r=spawnSync("sh",["-lc","command -v "+n],{encoding:"utf8"});if(r.status===0&&r.stdout.trim())return r.stdout.trim();}return null;}
const browser=browserPad();if(!browser){if(process.env.CI)throw new Error("Chrome ontbreekt voor pendingdiagnose");process.exit(0);}
const fixture=bouw({geenKwartier:true});fixture.daily.sunshine_duration=fixture.daily.time.map(()=>21600);fixture.current.visibility=20000;
let html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
const stub=`<script>(function(){
try{localStorage.clear();sessionStorage.clear();}catch(e){}
window.__wiwFixture=${JSON.stringify(fixture)};const echt=window.setTimeout.bind(window);window.__echt=echt;
window.setTimeout=function(fn,ms){const a=[].slice.call(arguments,2),m=ms===10000?45:ms===7000?35:ms;return echt(()=>fn.apply(null,a),m);};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
const antwoord=(ok,data,status)=>({ok:!!ok,status:status||200,json:async()=>JSON.parse(JSON.stringify(data))});
window.__plan={delay:0};
window.fetch=function(input,opt){const url=String(input||''),signal=opt&&opt.signal;if(url.includes('/api/waarschuwingen'))return Promise.resolve(antwoord(true,{dekking:false},200));if(url.includes('air-quality-api.open-meteo.com'))return Promise.resolve(antwoord(false,{},503));if(!url.includes('api.open-meteo.com/v1/forecast'))return Promise.resolve(antwoord(false,{},404));return new Promise((resolve,reject)=>{let klaar=false,t=echt(()=>{if(klaar)return;klaar=true;resolve(antwoord(true,window.__wiwFixture,200));},window.__plan.delay||0);const abort=()=>{if(klaar)return;klaar=true;clearTimeout(t);const e=new Error('aborted');e.name='AbortError';reject(e);};if(signal){if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});}});};
})();</script>`;
html=html.replace("</head>",stub+"</head>");
const reporter=`<script>(async()=>{const z=(k,v)=>document.body.setAttribute('data-pd-'+k,String(v)),slaap=ms=>new Promise(r=>window.__echt(r,ms)),q=document.getElementById('q'),st=document.getElementById('state'),app=document.getElementById('app');
try{
 await slaap(30);
 q.value='Amsterdam';window.__plan.delay=0;await load(52.3676,4.9041,'Amsterdam',false,true,'NL');await slaap(15);
 q.value='Kansas City';window.__plan.delay=100;const p=load(39.0997,-94.5786,'Kansas City',false,true,'US');await slaap(20);
 z('label',S.label);z('lat',S.lat);z('lon',S.lon);z('q',q.value);z('title',document.title);z('state',st.textContent);z('app',getComputedStyle(app).display);z('progressief',document.documentElement.classList.contains('wn-progressief'));z('place',document.getElementById('place')?.getAttribute('aria-label')||'');z('url',location.href);z('data',!!S.d);z('done','ok');
 await p;
}catch(e){z('error',e&&e.stack||e);z('done','fout');}})();</script>`;
html=html.replace("</body>",reporter+"</body>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-pending-diag-"));
try{const f=path.join(dir,"index.html");fs.writeFileSync(f,html);const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1363,936","--virtual-time-budget=1800","--dump-dom","file://"+f],{encoding:"utf8",maxBuffer:40*1024*1024,timeout:30000});if(r.status!==0)throw new Error(String(r.stderr||r.stdout).slice(-2000));const dom=r.stdout||"",v=k=>{const m=new RegExp('data-pd-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};console.log("PENDING_DIAGNOSTIC",JSON.stringify({done:v('done'),label:v('label'),lat:v('lat'),lon:v('lon'),q:v('q'),title:v('title'),state:v('state'),app:v('app'),progressief:v('progressief'),place:v('place'),url:v('url'),data:v('data'),error:v('error')}));if(v('done')!=='ok')throw new Error("Pendingdiagnose faalde: "+v('error'));}finally{fs.rmSync(dir,{recursive:true,force:true});}

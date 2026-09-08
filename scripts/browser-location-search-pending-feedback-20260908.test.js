"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");

function vindBrowser(){
  for(const naam of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync("sh",["-lc","command -v "+naam],{encoding:"utf8"});
    if(r.status===0&&r.stdout.trim())return r.stdout.trim();
  }
  return null;
}
const browser=vindBrowser();
if(!browser){
  console.log("SKIP location-search pending browser: lokaal geen Chrome/Chromium gevonden.");
  process.exit(0);
}

const p=path.join(__dirname,"..","public","index.html");
if(!fs.existsSync(p))throw new Error("public/index.html ontbreekt voor location-search browsertest.");
let html=fs.readFileSync(p,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");

const antwoord=payload=>`{ok:true,status:200,json:async()=>(${JSON.stringify(payload)}),text:async()=>JSON.stringify(${JSON.stringify(payload)})}`;
const geocoderAntwoord=antwoord({results:[{name:"Amsterdam",latitude:52.3676,longitude:4.9041,country_code:"NL",admin1:"Noord-Holland"}]});
const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
window.__resolveSearch=null;
window.fetch=function(url){
  const u=String(url);
  if(u.includes('geocoding-api.open-meteo.com')){
    return new Promise(resolve=>{window.__resolveSearch=()=>resolve(${geocoderAntwoord});});
  }
  return Promise.resolve(${antwoord({})});
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const reporter=`<script>
document.addEventListener('DOMContentLoaded',()=>{
  const zet=(k,v)=>document.body.setAttribute('data-search-pending-'+k,String(v));
  const q=document.getElementById('q'),melding=document.getElementById('zoekmelding'),res=document.getElementById('res'),status=document.getElementById('zoekstatus');
  try{
    q.value='Am';q.dispatchEvent(new Event('input',{bubbles:true}));
  }catch(e){zet('start','exception:'+e.message);}
  setTimeout(()=>{
    try{
      const requestOpen=typeof window.__resolveSearch==='function';
      const ok=requestOpen&&melding&&melding.classList.contains('on')&&melding.textContent.trim()==='Plaatsen zoeken…'
        &&res&&!res.classList.contains('on')&&q.getAttribute('aria-expanded')==='false';
      zet('pending',ok?'ok':'fout');zet('pending-text',melding&&melding.textContent.trim());zet('request-open',requestOpen?'ok':'fout');
      if(requestOpen)window.__resolveSearch();
    }catch(e){zet('pending','exception:'+e.message);}
  },470);
  setTimeout(()=>{
    try{
      const optie=res&&res.querySelector('div[data-lat]');
      const ok=melding&&!melding.classList.contains('on')&&melding.textContent.trim()===''
        &&res&&res.classList.contains('on')&&!!optie&&/Amsterdam/.test(optie.textContent||'')
        &&q.getAttribute('aria-expanded')==='true'&&status&&status.textContent.trim()==='1 plaats gevonden.';
      zet('result',ok?'ok':'fout');zet('result-message',melding&&melding.textContent.trim());
      q.value='A';q.dispatchEvent(new Event('input',{bubbles:true}));
    }catch(e){zet('result','exception:'+e.message);}
  },650);
  setTimeout(()=>{
    try{
      const ok=melding&&!melding.classList.contains('on')&&melding.textContent.trim()===''
        &&res&&!res.classList.contains('on')&&!res.querySelector('div[data-lat]')&&q.getAttribute('aria-expanded')==='false';
      zet('short-query-clean',ok?'ok':'fout');zet('done','ok');
    }catch(e){zet('short-query-clean','exception:'+e.message);zet('done','fout');}
  },780);
},{once:true});
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-search-pending-"));
try{
  const bestand=path.join(dir,"index.html");fs.writeFileSync(bestand,html);
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=390,844","--virtual-time-budget=1300","--dump-dom","file://"+bestand],{encoding:"utf8",maxBuffer:24*1024*1024});
  if(r.status!==0)throw new Error("browser exit "+r.status+" "+String(r.stderr||"").slice(-1200));
  const dom=r.stdout||"";
  const waarde=k=>{const m=new RegExp('data-search-pending-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(waarde("done")!=="ok"||waarde("request-open")!=="ok"||waarde("pending")!=="ok"||waarde("result")!=="ok"||waarde("short-query-clean")!=="ok"){
    throw new Error(`Location-search browsercheck fout: request=${waarde("request-open")} pending=${waarde("pending")} pendingText=${waarde("pending-text")} result=${waarde("result")} resultMessage=${waarde("result-message")} short=${waarde("short-query-clean")} done=${waarde("done")}`);
  }
  console.log("Location-search browser 390px: open geocoderrequest toont Plaatsen zoeken, opgelost request toont resultaat en korte query ruimt alles op.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}

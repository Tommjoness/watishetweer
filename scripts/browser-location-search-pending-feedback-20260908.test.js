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
const headStub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
window.fetch=function(){return Promise.resolve(${antwoord({})});};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",headStub+"</head>");

const geocoderPayload={results:[{name:"Amsterdam",latitude:52.3676,longitude:4.9041,country_code:"NL",admin1:"Noord-Holland"}]};
const reporter=`<script>
document.addEventListener('DOMContentLoaded',()=>{
  const zet=(k,v)=>document.body.setAttribute('data-search-pending-'+k,String(v));
  const q=document.getElementById('q'),melding=document.getElementById('zoekmelding'),res=document.getElementById('res'),status=document.getElementById('zoekstatus');
  const origineleJ=window.j;
  let zoekResolver=null,zoekRequests=0,resultaatGezien=false;
  zet('j-global',typeof origineleJ==='function'?'ok':'fout');
  window.j=function(url,opt){
    if(String(url).includes('geocoding-api.open-meteo.com')){
      zoekRequests++;
      return new Promise(resolve=>{zoekResolver=resolve;});
    }
    return typeof origineleJ==='function'?origineleJ(url,opt):Promise.resolve({});
  };
  const controleerResultaat=()=>{
    if(resultaatGezien)return;
    try{
      const optie=res&&res.querySelector('div[data-lat]');
      const ok=melding&&!melding.classList.contains('on')&&melding.textContent.trim()===''
        &&res&&res.classList.contains('on')&&!!optie&&/Amsterdam/.test(optie.textContent||'')
        &&q.getAttribute('aria-expanded')==='true'&&status&&status.textContent.trim()==='1 plaats gevonden.';
      if(!ok)return;
      resultaatGezien=true;
      zet('result','ok');zet('result-message',melding.textContent.trim());
      q.value='A';q.dispatchEvent(new Event('input',{bubbles:true}));
      const schoon=melding&&!melding.classList.contains('on')&&melding.textContent.trim()===''
        &&res&&!res.classList.contains('on')&&!res.querySelector('div[data-lat]')&&q.getAttribute('aria-expanded')==='false';
      zet('short-query-clean',schoon?'ok':'fout');zet('done','ok');
    }catch(e){zet('result','exception:'+e.message);zet('done','fout');}
  };
  const observer=new MutationObserver(controleerResultaat);
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});
  try{
    q.value='Am';q.dispatchEvent(new Event('input',{bubbles:true}));
  }catch(e){zet('start','exception:'+e.message);}
  setTimeout(()=>{
    try{
      const requestOpen=typeof zoekResolver==='function'&&zoekRequests===1;
      const ok=requestOpen&&melding&&melding.classList.contains('on')&&melding.textContent.trim()==='Plaatsen zoeken…'
        &&res&&!res.classList.contains('on')&&q.getAttribute('aria-expanded')==='false';
      zet('pending',ok?'ok':'fout');zet('pending-text',melding&&melding.textContent.trim());zet('request-open',requestOpen?'ok':'fout');zet('request-count',zoekRequests);
      if(requestOpen)zoekResolver(${JSON.stringify(geocoderPayload)});
      queueMicrotask(controleerResultaat);
    }catch(e){zet('pending','exception:'+e.message);}
  },470);
  setTimeout(()=>{
    if(resultaatGezien)return;
    controleerResultaat();
    if(resultaatGezien)return;
    zet('result','fout');zet('result-message',melding&&melding.textContent.trim());
    zet('result-panel',res&&res.className);zet('result-count',res?res.querySelectorAll('div[data-lat]').length:-1);
    zet('result-expanded',q&&q.getAttribute('aria-expanded'));zet('result-status',status&&status.textContent.trim());
    zet('done','fout');
  },1200);
},{once:true});
</script>`;
html=html.replace("</body>",reporter+"</body>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-search-pending-"));
try{
  const bestand=path.join(dir,"index.html");fs.writeFileSync(bestand,html);
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=390,844","--virtual-time-budget=1500","--dump-dom","file://"+bestand],{encoding:"utf8",maxBuffer:24*1024*1024});
  if(r.status!==0)throw new Error("browser exit "+r.status+" "+String(r.stderr||"").slice(-1200));
  const dom=r.stdout||"";
  const waarde=k=>{const m=new RegExp('data-search-pending-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(waarde("done")!=="ok"||waarde("j-global")!=="ok"||waarde("request-open")!=="ok"||waarde("pending")!=="ok"||waarde("result")!=="ok"||waarde("short-query-clean")!=="ok"){
    throw new Error(`Location-search browsercheck fout: j=${waarde("j-global")} request=${waarde("request-open")} requests=${waarde("request-count")} pending=${waarde("pending")} pendingText=${waarde("pending-text")} result=${waarde("result")} resultMessage=${waarde("result-message")} panel=${waarde("result-panel")} count=${waarde("result-count")} expanded=${waarde("result-expanded")} status=${waarde("result-status")} short=${waarde("short-query-clean")} done=${waarde("done")}`);
  }
  console.log("Location-search browser 390px: één open geocoderrequest toont Plaatsen zoeken, opgelost j()-resultaat verschijnt en korte query ruimt alles direct op.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}

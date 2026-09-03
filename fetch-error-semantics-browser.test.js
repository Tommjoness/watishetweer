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
  if(process.env.CI){console.error("FOUT fetch-error-semantics: Chrome/Chromium ontbreekt op CI.");process.exit(1);}
  console.log("SKIP fetch-error-semantics: lokaal geen Chrome/Chromium gevonden.");process.exit(0);
}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt voor fetch-error-semantics-browsertest.");
const basisHtml=fs.readFileSync(productie,"utf8");

const gevallen=[
  {
    naam:"AbortError",
    fout:`new DOMException("Fetch is aborted","AbortError")`,
    verwacht:"Het ophalen duurt te lang. Controleer je verbinding en probeer het opnieuw.",
    verboden:["Fetch is aborted","AbortError"]
  },
  {
    naam:"generieke netwerkfout",
    fout:`new TypeError("Load failed")`,
    verwacht:"Ophalen mislukt. Controleer je verbinding en probeer het opnieuw.",
    verboden:["Load failed","TypeError"]
  }
];

function fixture(geval){
  let html=basisHtml;
  const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
window.fetch=function(url){
  const u=String(url);
  if(u.includes('/api/waarschuwingen'))return Promise.resolve({ok:true,status:200,json:async()=>({bron:'test',dekking:true,lijst:[]}),text:async()=>''});
  if(u.includes('/api/plaatsnaam'))return Promise.resolve({ok:true,status:200,json:async()=>({naam:'Amsterdam',land:'NL',bron:'test'}),text:async()=>''});
  if(u.includes('geocoding-api.open-meteo.com'))return Promise.resolve({ok:true,status:200,json:async()=>({results:[]}),text:async()=>''});
  if(u.includes('open-meteo.com'))return Promise.reject(${geval.fout});
  return Promise.resolve({ok:true,status:200,json:async()=>({}),text:async()=>''});
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
  html=html.replace("</head>",stub+"</head>");
  const reporter=`<script>
setTimeout(()=>{
  const state=document.getElementById('state');
  const status=document.getElementById('locatie-laadstatus');
  const statusTekst=status&&status.querySelector('.locatie-status-tekst');
  const retry=status&&status.querySelector('.locatie-status-retry');
  document.body.setAttribute('data-state',(state&&state.textContent||'').trim());
  document.body.setAttribute('data-state-visible',state&&getComputedStyle(state).display!=='none'?'true':'false');
  document.body.setAttribute('data-status',(statusTekst&&statusTekst.textContent||'').trim());
  document.body.setAttribute('data-status-visible',status&&status.hidden===false?'true':'false');
  document.body.setAttribute('data-retry-visible',retry&&!retry.hidden?'true':'false');
},900);
</script>`;
  return html.replace("</body>",reporter+"</body>");
}

function draai(geval){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-fetch-error-"));
  try{
    const pad=path.join(dir,"index.html");fs.writeFileSync(pad,fixture(geval));
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=390,844","--virtual-time-budget=1600","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:20*1024*1024});
    if(r.status!==0)throw new Error(geval.naam+": browser exit "+r.status+" "+(r.stderr||"").slice(-1200));
    return r.stdout||"";
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function attr(dom,naam){const m=new RegExp('data-'+naam+'="([^"]*)"').exec(dom);return m?m[1].replace(/&amp;/g,"&"):null;}

/* De compacte locatiestatus is bij een cold-loadfout bewust de enige zichtbare
   fout-owner. #state mag dus leeg/verborgen zijn, maar nooit daarnaast nog een
   tweede technische of dubbele gebruikersmelding tonen. */
for(const geval of gevallen){
  const dom=draai(geval),tekst=attr(dom,"status");
  if(attr(dom,"status-visible")!=="true")throw new Error(geval.naam+": compacte foutstatus is niet zichtbaar");
  if(attr(dom,"retry-visible")!=="true")throw new Error(geval.naam+": retry ontbreekt bij compacte foutstatus");
  if(attr(dom,"state-visible")==="true"&&attr(dom,"state"))throw new Error(geval.naam+": oude foutstate bleef als tweede fout-owner zichtbaar");
  if(tekst!==geval.verwacht)throw new Error(geval.naam+": onverwachte fouttekst: "+tekst);
  for(const verboden of geval.verboden)if(String(tekst).includes(verboden))throw new Error(geval.naam+": technische fouttekst lekt naar UI: "+tekst);
}

console.log("Fetch-error-semantics browser: AbortError en generieke netwerkfout tonen één zichtbare compacte retry-status met stabiele menselijke producttekst zonder browserdetails.");

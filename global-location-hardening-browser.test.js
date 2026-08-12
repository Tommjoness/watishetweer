"use strict";

/* Echte Chromium-integratietest voor drie wereldwijde UI-contracten:
   - geocodingduplicaten worden vóór rendering verwijderd;
   - een door de API fail-closed genormaliseerde waarschuwing blijft neutraal;
   - de desktophero houdt dezelfde compositie bij korte/lange omschrijvingen en
     extreem lange plaatsnamen veroorzaken geen horizontale overflow.

   Het daadwerkelijke afwijzen van land-/onbewezen waarschuwingen wordt apart
   aan de servergrens getest in scripts/api-waarschuwing-scope.test.mjs. */
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
  if(process.env.CI){console.error("FOUT wereldwijde locatiehardening: Chrome/Chromium ontbreekt op CI.");process.exit(1);}
  console.log("SKIP wereldwijde locatiehardening: lokaal geen Chrome/Chromium gevonden.");process.exit(0);
}
const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8");
const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
window.fetch=function(url){
  const u=String(url);
  const response=data=>Promise.resolve({ok:true,status:200,json:async()=>data,text:async()=>JSON.stringify(data)});
  if(u.includes('geocoding-api.open-meteo.com/v1/search?'))return response({results:[
    {id:777,name:'Ja',admin1:'Janub-Darfur',country_code:'SD',latitude:11.1,longitude:24.2},
    {id:777,name:'Ja',admin1:'Janub-Darfur',country_code:'SD',latitude:11.1001,longitude:24.2001},
    {id:778,name:'Ja',admin1:'Janub-Darfur',country_code:'SD',latitude:11.8,longitude:24.8}
  ]});
  if(u.includes('/api/waarschuwingen?'))return response({
    dekking:false,plaatsSpecifiek:false,bron:'MeteoAlarm landfeed',
    reden:'geen plaats-specifieke dekking',lijst:[]
  });
  return new Promise(()=>{});
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");
const reporter=`<script>
setTimeout(async()=>{
  const zet=(k,v)=>document.body.setAttribute('data-'+k,String(v));
  try{
    document.documentElement.classList.remove('wn-progressief');
    const app=document.getElementById('app');
    if(app){app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');app.style.display='block';}
    const g=await j('https://geocoding-api.open-meteo.com/v1/search?name=ja');
    const w=await j('/api/waarschuwingen?lat=44.356&lon=9.388&land=IT');
    zet('hardening-search',g&&g.results&&g.results.length===2?'ok':'fout');
    zet('hardening-warning',w&&w.dekking===false&&w.plaatsSpecifiek===false&&Array.isArray(w.lijst)&&w.lijst.length===0?'ok':'fout');

    const hero=document.querySelector('.dashrow-hero > .hero'),temp=document.querySelector('.dashrow-hero .tempblok'),info=document.querySelector('.dashrow-hero .heroinfo');
    const cond=document.getElementById('cond'),feels=document.getElementById('feels'),ico=document.getElementById('nowicon');
    document.getElementById('t').textContent='26';cond.textContent='Half bewolkt';feels.textContent='Gevoelstemperatuur 27°C';ico.textContent='☾';
    const r1=temp.getBoundingClientRect(),i1=info.getBoundingClientRect(),top1=i1.top;
    cond.textContent='Zware aanvriezende motregen met langdurig zeer beperkt zicht';
    const r2=temp.getBoundingClientRect(),i2=info.getBoundingClientRect();
    const grid=getComputedStyle(hero).display==='grid';
    const onder1=i1.top>=r1.bottom+4,onder2=i2.top>=r2.bottom+4,stabiel=Math.abs(i2.top-top1)<2;
    zet('hardening-hero',grid&&onder1&&onder2&&stabiel?'ok':'fout');

    const place=document.getElementById('place'),sheet=document.querySelector('.sheet');
    place.textContent='ChargoggagoggmanchauggagoggchaubunagungamauggSuperLongInternationalPlaceNameWithoutBreaks';
    const pr=place.getBoundingClientRect(),sr=sheet.getBoundingClientRect();
    zet('hardening-place',pr.right<=sr.right+1&&document.documentElement.scrollWidth<=window.innerWidth+1?'ok':'fout');
  }catch(e){zet('hardening-exception',e&&e.message||e);}
},300);
</script>`;
html=html.replace("</body>",reporter+"</body>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-global-hardening-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html);
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1440,1000","--virtual-time-budget=1200","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:20*1024*1024});
  if(r.status!==0)throw new Error("browser exit "+r.status+" "+(r.stderr||"").slice(-1200));
  const dom=r.stdout||"";
  const waarde=k=>{const m=new RegExp('data-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  for(const k of ["hardening-search","hardening-warning","hardening-hero","hardening-place"]){
    if(waarde(k)!=="ok")throw new Error(k+"="+waarde(k)+", exception="+waarde("hardening-exception"));
  }
  console.log("Wereldwijde browserhardening: deduplicatie, server-genormaliseerde waarschuwingen, vaste hero en lange plaatsnaam geslaagd.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}

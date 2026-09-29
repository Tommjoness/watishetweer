"use strict";
/* Uurtabel naast de desktopgrafiek met lange live waarden, gemeten op het
   definitieve artifact (na de desktoplaag van 29 september).
   Aanleiding: na #450 faalde de productiecontrole op 1660px omdat regels als
   "12,4 mm 100% kans" en "WZW 9 Bft 88 km/u" niet meer op één regel pasten en
   de tabel 28px buiten haar kolom liep. Gewone waarden staan per uur op één
   regel; lange waarden breken netjes af naar een tweede regel, zonder overloop. */
const fs=require("fs"),path=require("path"),{spawnSync}=require("child_process"),{bouw}=require("../data.js");
const chrome=require("./vind-browser.js").vindBrowser();
if(!chrome){if(process.env.CI)throw new Error("Chrome/Chromium ontbreekt voor de uurtabeltest met lange waarden.");console.log("SKIP uurtabel lange waarden: lokaal geen Chrome/Chromium.");process.exit(0);}
const publicDir=path.join(__dirname,".."+path.sep+"public"),bron=fs.readFileSync(path.join(publicDir,"index.html"),"utf8");
if(!bron.includes('id="wiw-desktop-premium-20260929"'))throw new Error("Uurtabeltest verwacht het artifact met de desktoplaag van 29 september.");

function fixture(storm){
  const d=bouw(storm
    ?{tempNu:18,wcNu:65,ccNu:100,rh:95,pp:()=>100,pr:()=>12.4,wc:()=>65,cc:()=>100,ws:88,wg:()=>131,som:60}
    :{tempNu:18,wcNu:3,ccNu:100,rh:80,pp:()=>0,pr:()=>0,wc:()=>3,cc:()=>100,som:0});
  if(storm)d.hourly.wind_direction_10m=d.hourly.wind_direction_10m.map(()=>247);
  d.latitude=52.3676;d.longitude=4.9041;d.timezone="Europe/Amsterdam";d.utc_offset_seconds=7200;d.daily.sunshine_duration=d.daily.time.map(()=>7*3600);
  return d;
}
const lucht={current:{european_aqi:24,us_aqi:40},hourly:{time:["2026-07-22T14:00"],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};

function pagina(d){
  /* Vaste klok op het actuele fixtuur-uur (14:10 lokale tijd), zodat de tabel de
     eerstvolgende uren van de fixture toont. */
  const klok=`<script>(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T12:10:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;})();</script>`;
  const vroeg=`<script>window.__uurFouten=[];addEventListener('error',e=>window.__uurFouten.push(String(e.message||e.error)));window.fetch=async function(url){const u=String(url),payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,land:"NL",lijst:[]})}:u.includes('/api/')?${JSON.stringify({beschikbaar:false})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(lucht)}:${JSON.stringify(d)};return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload),headers:{get:()=>null}};};try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
  const rapport=`<script>setTimeout(()=>{const zet=(k,v)=>document.body.setAttribute('data-uur-'+k,String(v));try{
    const s=document.getElementById('wiw-hour-scroll'),t=document.getElementById('wiw-hour-table'),kop=t&&t.querySelector('thead th:nth-child(3)'),rijen=t?[...t.querySelectorAll('tbody tr')]:[];
    const eenRegel=rijen.slice(0,3).every(r=>[...r.querySelectorAll('.wiw-hour-rain,.wiw-hour-wind')].every(c=>{const p=c.querySelector('.wiw-hour-primary'),q=c.querySelector('.wiw-hour-secondary');if(!p||!q)return true;return Math.abs(p.getBoundingClientRect().top-q.getBoundingClientRect().top)<4;}));
    zet('rows',rijen.length);zet('overflow',s?s.scrollWidth-s.clientWidth:-1);zet('thclip',kop?kop.scrollWidth-kop.clientWidth:-1);
    zet('page',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);zet('eenregel',eenRegel?'ja':'nee');
    zet('regen',(rijen[0]&&rijen[0].querySelector('.wiw-hour-rain')||{textContent:''}).textContent.replace(/\\s+/g,' ').trim());
    zet('wind',(rijen[0]&&rijen[0].querySelector('.wiw-hour-wind')||{textContent:''}).textContent.replace(/\\s+/g,' ').trim());
    zet('app',((document.getElementById('app')&&getComputedStyle(document.getElementById('app')).display)+' '+(document.getElementById('state')||{}).textContent).replace(/\\s+/g,' ').replace(/"/g,''));zet('fouten',(window.__uurFouten||[]).join(' | ').slice(0,600));zet('klaar','ok');
  }catch(e){zet('fouten',String(e&&e.stack||e).slice(0,600));zet('klaar','fout');}},2600);</script>`;
  return bron.replace("<head>","<head>"+klok).replace("</head>",vroeg+"</head>").replace("</body>",rapport+"</body>").replace(/src="\/((?:app|bootstrap)-[0-9a-f]{12}\.min\.js)"/g,'src="../$1"');
}

const tmp=fs.mkdtempSync(path.join(publicDir,".uurtabel-lang-"));
try{
  for(const storm of [false,true]){
    const pad=path.join(tmp,(storm?"storm":"normaal")+".html");fs.writeFileSync(pad,pagina(fixture(storm)));
    for(const [w,h] of [[1100,900],[1366,768],[1600,900],[1660,900],[1920,1080]]){
      const r=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${w},${h}`,"--virtual-time-budget=4000","--dump-dom","file://"+pad+"?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL"],{encoding:"utf8",maxBuffer:36*1024*1024});
      if(r.status!==0)throw new Error(`${w}px: Chrome exit ${r.status}: `+String(r.stderr||"").slice(-800));
      const dom=r.stdout||"",v=k=>{const m=new RegExp('data-uur-'+k+'="([^"]*)"').exec(dom);return m?m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&'):"";};
      const naam=`${w}px ${storm?"storm":"normaal"}`;
      if(v('klaar')!=='ok')throw new Error(`${naam}: meting mislukt: ${v('fouten')||"geen rapport"}`);
      if(v('fouten'))throw new Error(`${naam}: browserfouten: ${v('fouten')}`);
      if(!(Number(v('rows'))>=6))throw new Error(`${naam}: maar ${v('rows')} uurregels in de tabel (app: ${v('app').slice(0,200)})`);
      if(!(Number(v('overflow'))<=1))throw new Error(`${naam}: uurtabel loopt ${v('overflow')}px buiten haar kolom (${v('regen')} · ${v('wind')})`);
      if(!(Number(v('thclip'))<=1))throw new Error(`${naam}: kolomkop Temperatuur afgeknipt (${v('thclip')}px)`);
      if(!(Number(v('page'))<=1))throw new Error(`${naam}: ${v('page')}px horizontale pagina-overloop`);
      if(storm&&!/12,4\s*mm/.test(v('regen')))throw new Error(`${naam}: stormfixture niet in de tabel (${v('regen')})`);
      if(!storm&&w>=1600&&v('eenregel')!=='ja')throw new Error(`${naam}: gewone waarden staan niet meer op één regel per uur`);
      console.log(`${naam}: ${v('rows')} uurregels, overloop ${v('overflow')}px (${v('regen')} · ${v('wind')}).`);
    }
  }
  console.log("Uurtabel met lange waarden groen: storm- en gewone waarden blijven op 1100–1920px binnen de kolom; gewone waarden staan vanaf 1600px op één regel.");
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

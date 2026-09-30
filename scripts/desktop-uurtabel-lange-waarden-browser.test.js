"use strict";
/* Uurtabel naast de desktopgrafiek met lange live waarden, gemeten op het
   definitieve artifact (na de desktoplaag van 29 september).
   Aanleiding: na #450 faalde de productiecontrole op 1660px omdat regels als
   "12,4 mm 100% kans" en "WZW 9 Bft 88 km/u" niet meer op één regel pasten en
   de tabel 28px buiten haar kolom liep; afbreken naar twee regels kostte op
   1920px weer uren (9 i.p.v. minstens 10). Gewone en realistisch brede waarden
   ("-17,6° voelt -18,6°", "0,4 mm 45% kans", "ZZW 4 Bft 25 km/u") staan vanaf
   1600px per uur op één regel; nog langere waarden breken hooguit netjes af,
   nooit buiten de kolom. */
const fs=require("fs"),path=require("path"),{spawnSync}=require("child_process"),{bouw}=require("../data.js");
const chrome=require("./vind-browser.js").vindBrowser();
if(!chrome){if(process.env.CI)throw new Error("Chrome/Chromium ontbreekt voor de uurtabeltest met lange waarden.");console.log("SKIP uurtabel lange waarden: lokaal geen Chrome/Chromium.");process.exit(0);}
const publicDir=path.join(__dirname,".."+path.sep+"public"),bron=fs.readFileSync(path.join(publicDir,"index.html"),"utf8");
if(!bron.includes('id="wiw-desktop-premium-20260929"'))throw new Error("Uurtabeltest verwacht het artifact met de desktoplaag van 29 september.");

const SCENARIO={
  normaal:{opties:{tempNu:18,wcNu:3,ccNu:100,rh:80,pp:()=>0,pr:()=>0,wc:()=>3,cc:()=>100,som:0},richting:315,eenRegel:true},
  breed:{opties:{tempNu:-12,wcNu:73,ccNu:100,rh:80,temp:u=>+(-16+2*Math.sin(u/24*2*Math.PI)).toFixed(1),pp:()=>45,pr:()=>0.4,wc:()=>73,cc:()=>100,ws:25,wg:()=>40,som:5},richting:202,eenRegel:true},
  storm:{opties:{tempNu:18,wcNu:65,ccNu:100,rh:95,pp:()=>100,pr:()=>12.4,wc:()=>65,cc:()=>100,ws:88,wg:()=>131,som:60,zicht:400},richting:247,eenRegel:false,zicht:400}
};
function fixture(naam){
  const {opties,richting}=SCENARIO[naam],d=bouw(opties);
  d.hourly.wind_direction_10m=d.hourly.wind_direction_10m.map(()=>richting);
  if(SCENARIO[naam].zicht)d.current.visibility=SCENARIO[naam].zicht;
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
    zet('app',((document.getElementById('app')&&getComputedStyle(document.getElementById('app')).display)+' '+(document.getElementById('state')||{}).textContent).replace(/\\s+/g,' ').replace(/"/g,''));zet('fouten',(window.__uurFouten||[]).join(' | ').slice(0,600));
    zet('tegels',[...document.querySelectorAll('#app .stats:not(#aq)>.stat')].filter(t=>!t.hidden&&t.getClientRects().length).length);zet('wolk',((document.getElementById('cloudsub')||{}).textContent||'').replace(/\s+/g,' ').trim());
    /* Een render die rijen toevoegt zonder in te korten (september 2026: 24 uren
       over Zeven dagen heen): binnen korte tijd steekt er niets meer onder de
       grafiek uit, en het paneel tekent nooit buiten zijn vak. */
    const tb=t&&t.querySelector('tbody');if(tb&&tb.lastElementChild)for(let i=0;i<14;i++)tb.appendChild(tb.lastElementChild.cloneNode(true));
    setTimeout(()=>{try{const main=document.querySelector('.wiw-chart-main'),panel=document.getElementById('wiw-hour-panel'),last=tb&&tb.lastElementChild;
      zet('injectie-uitsteek',last&&main?Math.round(last.getBoundingClientRect().bottom-main.getBoundingClientRect().bottom):-999);zet('paneel-overflow',panel?getComputedStyle(panel).overflowY:'');zet('klaar','ok');
    }catch(e){zet('fouten',String(e&&e.stack||e).slice(0,600));zet('klaar','fout');}},700);
  }catch(e){zet('fouten',String(e&&e.stack||e).slice(0,600));zet('klaar','fout');}},2600);</script>`;
  return bron.replace("<head>","<head>"+klok).replace("</head>",vroeg+"</head>").replace("</body>",rapport+"</body>").replace(/src="\/((?:app|bootstrap)-[0-9a-f]{12}\.min\.js)"/g,'src="../$1"');
}

const tmp=fs.mkdtempSync(path.join(publicDir,".uurtabel-lang-"));
try{
  for(const scenario of Object.keys(SCENARIO)){
    const pad=path.join(tmp,scenario+".html");fs.writeFileSync(pad,pagina(fixture(scenario)));
    for(const [w,h] of [[1100,900],[1366,768],[1600,900],[1660,900],[1920,1080]]){
      const r=spawnSync(chrome,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${w},${h}`,"--virtual-time-budget=5000","--dump-dom","file://"+pad+"?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL"],{encoding:"utf8",maxBuffer:36*1024*1024});
      if(r.status!==0)throw new Error(`${w}px: Chrome exit ${r.status}: `+String(r.stderr||"").slice(-800));
      const dom=r.stdout||"",v=k=>{const m=new RegExp('data-uur-'+k+'="([^"]*)"').exec(dom);return m?m[1].replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&'):"";};
      const naam=`${w}px ${scenario}`;
      if(v('klaar')!=='ok')throw new Error(`${naam}: meting mislukt: ${v('fouten')||"geen rapport"}`);
      if(v('fouten'))throw new Error(`${naam}: browserfouten: ${v('fouten')}`);
      if(!(Number(v('rows'))>=6))throw new Error(`${naam}: maar ${v('rows')} uurregels in de tabel (app: ${v('app').slice(0,200)})`);
      if(!(Number(v('overflow'))<=1))throw new Error(`${naam}: uurtabel loopt ${v('overflow')}px buiten haar kolom (${v('regen')} · ${v('wind')})`);
      if(!(Number(v('thclip'))<=1))throw new Error(`${naam}: kolomkop Temperatuur afgeknipt (${v('thclip')}px)`);
      if(!(Number(v('page'))<=1))throw new Error(`${naam}: ${v('page')}px horizontale pagina-overloop`);
      if(!(Number(v('injectie-uitsteek'))<=1))throw new Error(`${naam}: na een render zonder inkorting steekt de uurtabel ${v('injectie-uitsteek')}px onder de grafiek uit`);
      if(!/^(clip|hidden)$/.test(v('paneel-overflow')))throw new Error(`${naam}: uurpaneel mag buiten het grafiekvak tekenen (overflow ${v('paneel-overflow')})`);
      /* Altijd zes tegels; slecht zicht staat als regel in de tegel Bewolking (eigenaar, 29 september). */
      if(Number(v('tegels'))!==6)throw new Error(`${naam}: ${v('tegels')} tegels bovenin in plaats van 6`);
      if(SCENARIO[scenario].zicht&&!/Slecht zicht: 0,4\s*km\./.test(v('wolk')))throw new Error(`${naam}: slecht zicht staat niet in de tegel Bewolking (${v('wolk')})`);
      if(!SCENARIO[scenario].zicht&&/zicht/i.test(v('wolk')))throw new Error(`${naam}: zicht staat in de tegel Bewolking terwijl het zicht goed is (${v('wolk')})`);
      if(scenario==="storm"&&!/12,4\s*mm/.test(v('regen')))throw new Error(`${naam}: stormfixture niet in de tabel (${v('regen')})`);
      if(scenario==="breed"&&!/45%/.test(v('regen')))throw new Error(`${naam}: brede fixture niet in de tabel (${v('regen')})`);
      if(SCENARIO[scenario].eenRegel&&w>=1600&&v('eenregel')!=='ja')throw new Error(`${naam}: waarden staan niet meer op één regel per uur (${v('regen')} · ${v('wind')})`);
      if(SCENARIO[scenario].eenRegel&&w>=1600&&Number(v('rows'))<10)throw new Error(`${naam}: ruime desktop toont minder dan 10 uren (${v('rows')})`);
      console.log(`${naam}: ${v('rows')} uurregels, overloop ${v('overflow')}px (${v('regen')} · ${v('wind')}).`);
    }
  }
  console.log("Uurtabel met lange waarden groen: gewone, brede en stormwaarden blijven op 1100–1920px binnen de kolom; gewone en brede waarden staan vanaf 1600px op één regel; extra rijen zonder inkorting worden weggehaald, het paneel tekent nooit buiten het grafiekvak, en er staan altijd zes tegels met slecht zicht in de tegel Bewolking.");
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

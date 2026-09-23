"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
function vindBrowser(){return require("./scripts/vind-browser.js").vindBrowser();}
const browser=vindBrowser();
if(!browser){if(process.env.CI){console.error("FOUT mobile-axis-rhythm: Chrome/Chromium ontbreekt.");process.exit(1);}console.log("SKIP mobile-axis-rhythm: lokaal geen Chrome/Chromium.");process.exit(0);}

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
if(!html.includes("WeatherNowMobileGraphUX20260828"))throw new Error("Mobiele grafiek-UX ontbreekt in finale artifact.");
/* Headless Chromium houdt een minimale CSS-windowbreedte van circa 500 px aan,
   ook bij --window-size=402. De productiecode gebruikt innerWidth alleen om de
   smalle <=430px-axispolish te kiezen. We zetten hier daarom uitsluitend die
   runtime-meting op de echte iPhone-breedte uit de live screenshot. */
const stub=`<script>try{localStorage.clear();sessionStorage.clear();Object.defineProperty(window,'innerWidth',{value:402,configurable:true});}catch(e){}window.fetch=()=>new Promise(()=>{});window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),16);try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
html=html.replace("</head>",stub+"</head>");
const reporter=`<script>
window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{const zet=(k,v)=>document.body.setAttribute('data-axis-rhythm-'+k,String(v));try{
  document.documentElement.classList.remove('wn-progressief');const app=document.getElementById('app');if(app){app.style.display='block';app.style.visibility='visible';app.classList.remove('wn-progressief');}const state=document.getElementById('state');if(state)state.style.display='none';
  if(typeof S==='undefined'||typeof etmaal!=='function')throw new Error('grafiekruntime ontbreekt');
  const tijden=Array.from({length:25},(_,i)=>{const uur=(22+i)%24,dag=i<2?'2026-09-17':'2026-09-18';return dag+'T'+String(uur).padStart(2,'0')+':00';});
  /* Late-avondvorm uit de productie-screenshot: dicht minimum in de nacht,
     steile ochtendstijging en een breed middagmaximum. Juist deze vorm liet
     de oude post-pass van zeven kandidaten naar vier zichtbare labels zakken. */
  const temp=[13.0,12.2,11.6,11.3,11.1,11.0,11.2,12.0,12.1,12.2,12.3,12.8,14.6,16.6,18.0,19.0,19.1,19.6,20.0,20.0,19.5,18.8,17.8,16.0,15.0];
  const zeros=tijden.map(()=>0),wind=tijden.map(()=>12),richting=tijden.map(()=>220),code=tijden.map(()=>3),daglicht=tijden.map((_,i)=>i>=9&&i<=20?1:0);
  S.d={timezone:'Europe/Amsterdam',utc_offset_seconds:7200,current:{time:'2026-09-17T22:06',temperature_2m:13.0,is_day:0},hourly:{time:tijden,temperature_2m:temp,apparent_temperature:temp.map(v=>v-.3),precipitation_probability:zeros,precipitation:zeros,wind_speed_10m:wind,wind_gusts_10m:wind.map(v=>v+4),cloud_cover:tijden.map(()=>55),weather_code:code,is_day:daglicht,wind_direction_10m:richting},daily:{time:['2026-09-17','2026-09-18'],sunrise:['2026-09-17T07:17','2026-09-18T07:19'],sunset:['2026-09-17T19:51','2026-09-18T19:48']}};
  S.dag=null;S.bereik=24;S.i0=0;S.klokInstantOverride=new Date('2026-09-17T20:06:00Z');
  etmaal(0,24);
  setTimeout(()=>{try{
    const svg=document.getElementById('chart'),g=S.geo;if(!svg||!g)throw new Error('chart/geometrie ontbreekt');
    const pb=Number(g.pt)+Number(g.ih),labels=[...svg.querySelectorAll('text')].filter(el=>/^\\d{2}:00$/.test(String(el.textContent||'').trim())&&Number(el.getAttribute('y'))>=pb+6).sort((a,b)=>Number(a.getAttribute('x'))-Number(b.getAttribute('x')));
    const teksten=labels.map(el=>String(el.textContent||'').trim()),fonts=labels.map(el=>String(el.getAttribute('font-family')||'')),stijlen=labels.map(el=>String(el.getAttribute('font-style')||''));
    const W=Number(g.W),buiten=labels.filter(el=>{const b=el.getBBox();return b.x<-.5||b.x+b.width>W+.5;});
    const tempLabels=[...svg.querySelectorAll('text[data-mobile-temp-index]')].filter(el=>!el.closest('#scrub')),tempBoxes=tempLabels.map(el=>({el,b:el.getBBox()})),tempBots=[];
    for(let i=0;i<tempBoxes.length;i++)for(let j=i+1;j<tempBoxes.length;j++){const a=tempBoxes[i].b,b=tempBoxes[j].b;if(a.x<b.x+b.width+2&&a.x+a.width+2>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)tempBots.push(tempBoxes[i].el.textContent+'|'+tempBoxes[j].el.textContent);}
    const vb=svg.viewBox.baseVal,onderruimte=vb.height-pb;
    zet('labels',teksten.join(','));zet('count',labels.length);zet('inner-width',window.innerWidth);zet('geo-n',g.n);zet('font-ok',fonts.every(v=>/Instrument Sans/.test(v))?'ja':'nee');zet('style-ok',stijlen.every(v=>v==='normal')?'ja':'nee');zet('overflow',buiten.length?buiten.map(el=>el.textContent).join(','):'geen');
    const nuTekst=[...svg.querySelectorAll('text')].find(el=>/^nu(?:\\s|$)/i.test(String(el.textContent||'').trim()));
    const zonTeksten=[...svg.querySelectorAll('text')].filter(el=>/^zon (?:op|onder) \\d{2}:\\d{2}$/i.test(String(el.textContent||'').trim()));
    zet('temp-count',tempLabels.length);zet('temp-overlap',tempBots.length?tempBots.join(','):'geen');zet('temp-missing',svg.getAttribute('data-mobile-temp-missing-anchors')||'');zet('temp-visible',svg.getAttribute('data-mobile-temp-visible')||'');zet('hour-rhythm',svg.getAttribute('data-mobile-hour-rhythm')||'');zet('now-text',nuTekst?String(nuTekst.textContent||'').trim():'');zet('sun-count',zonTeksten.length);zet('compact-height',svg.getAttribute('data-mobile-compact-height')||'');zet('under-space',onderruimte.toFixed(2));zet('chart-aria',svg.getAttribute('aria-label')||'');zet('done','ok');
  }catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},700);
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},180),{once:true});
</script>`;
html=html.replace("</body>",reporter+"</body>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-mobile-axis-rhythm-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=402,900","--virtual-time-budget=3800","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:36*1024*1024,timeout:30000});
  if(r.status!==0)throw new Error("browser exit "+r.status+": "+String(r.stderr||"").slice(-1200));
  const dom=r.stdout||"",v=k=>{const m=new RegExp('data-axis-rhythm-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(v('done')!=='ok')throw new Error("reporter: "+v('exception'));
  if(Number(v('inner-width'))!==402)throw new Error("fixture emuleert geen echte 402px runtimebreedte: "+v('inner-width'));
  if(Number(v('geo-n'))>25)throw new Error("fixture is geen 24-uursgrafiek/rechtergrensgeval: geo.n="+v('geo-n'));
  const verwacht='22:00,01:00,04:00,07:00,10:00,13:00,16:00,19:00';
  if(v('labels')!==verwacht)throw new Error("mobiele uuras volgt niet de forecasttijd-gedreven drie-uurscadans: kreeg "+v('labels')+", verwacht "+verwacht);
  if(Number(v('count'))!==8)throw new Error("mobiele 24-uursas moet exact acht echte drie-uursankers tonen; kreeg "+v('count'));
  if(v('hour-rhythm')!=='three-hour')throw new Error("mobiele uuras mist de three-hour owner-marker: "+v('hour-rhythm'));
  if(!v('chart-aria').includes('Verloop van 17 september 2026 om 22:00 tot 18 september 2026 om 22:00'))throw new Error('toegankelijk grafieklabel mist kalenderdatums over middernacht: '+v('chart-aria'));
  if(v('font-ok')!=='ja'||v('style-ok')!=='ja')throw new Error("mobiele uuras gebruikt niet overal het rechte Instrument Sans-letterbeeld");
  if(v('overflow')!=='geen')throw new Error("mobiele uuras valt buiten de SVG: "+v('overflow'));
  if(v('temp-missing'))throw new Error("mobiele grafiek mist verplichte drie-uurs-temperatuurankers: "+v('temp-missing'));
  if(Number(v('temp-count'))<7)throw new Error("mobiele grafiek toont te weinig vaste drie-uurs-temperatuurwaarden: "+v('temp-count'));
  if(Number(v('temp-count'))>10)throw new Error("mobiele grafiek bevat onverwacht veel vaste/extrema-temperatuurlabels: "+v('temp-count'));
  if(v('temp-overlap')!=='geen')throw new Error("mobiele temperatuurlabels overlappen nog: "+v('temp-overlap'));
  if(v('now-text')!=='nu 13°')throw new Error("actuele rode markering mist de temperatuurwaarde: "+v('now-text'));
  if(Number(v('sun-count'))!==0)throw new Error("dubbele zonlabels staan nog in de mobiele SVG: "+v('sun-count'));
  if(v('compact-height')!=='1')throw new Error("mobiele 24-uursgrafiek is niet post-render gecompacteerd");
  if(Number(v('under-space'))>50)throw new Error("mobiele grafiek houdt nog te veel reserve onder de plot: "+v('under-space')+" SVG-px");
  console.log("Mobiele uuras-regressie groen: echte 402px runtime toont acht forecasttijd-gedreven drie-uurslabels, alle verplichte temperatuurankers collision-vrij en compacte onderruimte; geo.n="+v('geo-n')+".");
}finally{fs.rmSync(dir,{recursive:true,force:true});}

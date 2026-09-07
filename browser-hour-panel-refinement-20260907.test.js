"use strict";

const fs=require("fs");
const os=require("os");
const path=require("path");
const {spawnSync}=require("child_process");

function vindBrowser(){
  for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync(n,["--version"],{encoding:"utf8"});if(r.status===0)return n;
  }
  return null;
}
const browser=vindBrowser();
if(!browser){
  if(process.env.CI){console.error("FOUT uurpaneelrefinement browsertest: Chrome/Chromium ontbreekt.");process.exit(1);}
  console.log("SKIP uurpaneelrefinement browsertest: lokaal geen Chrome/Chromium.");process.exit(0);
}
const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8");
html=html.replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
const stub=`<script>try{localStorage.clear();sessionStorage.clear();}catch(e){}window.fetch=()=>new Promise(()=>{});window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),16);window.cancelAnimationFrame=clearTimeout;try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
html=html.replace("</head>",stub+"</head>");
const reporter=`<script>
document.addEventListener('DOMContentLoaded',async()=>{const zet=(k,v)=>document.body.setAttribute('data-hour-refine-'+k,String(v));try{
 document.documentElement.classList.remove('wn-progressief');const app=document.getElementById('app');if(app){app.classList.remove('wn-progressief');app.removeAttribute('aria-busy');app.style.display='block';app.style.visibility='visible';}const state=document.getElementById('state');if(state)state.style.display='none';
 const place=document.getElementById('place');if(place)place.innerHTML='Almere<span id="plaatstijd" aria-hidden="true">23:18</span>';
 let seo=document.querySelector('.seo-plaatsnav');if(!seo){seo=document.createElement('nav');seo.className='seo-plaatsnav';seo.innerHTML='<div class="seo-plaatsnav-inner"><strong class="seo-plaatsnav-kop">Populaire plaatsen in Nederland</strong><div class="seo-plaatsnav-links"><a href="#">Almere</a></div></div>';document.body.appendChild(seo);}
 const nights=document.getElementById('nights');if(nights)nights.innerHTML='<div class="row night"><div class="dname">vannacht</div><div class="score">0/10</div><div class="sbar"></div><div class="nmeta"><span class="perc">100%</span></div><div class="nmeta wide"><span class="nachtadvies">Ongunstig · Geen gunstig kijkvenster door bewolking.</span><span class="nachtmaan">◯ Maanopkomst om 03:08.</span></div></div>';
 const TI=Array.from({length:24},(_,i)=>i<11?'2026-09-02T'+String(i+13).padStart(2,'0')+':00':'2026-09-03T'+String(i-11).padStart(2,'0')+':00');
 const precipitation=TI.map(()=>0);precipitation[2]=null;
 S.d={timezone:'Europe/Amsterdam',utc_offset_seconds:7200,current:{time:'2026-09-02T13:27'},hourly:{time:TI,temperature_2m:TI.map((_,i)=>18-i*.1),apparent_temperature:TI.map((_,i)=>18-i*.1),precipitation_probability:TI.map(()=>0),precipitation}};
 S.klokInstantOverride=new Date('2026-09-02T11:27:00Z');S.geo={TI,T:S.d.hourly.temperature_2m,A:S.d.hourly.apparent_temperature,P:S.d.hourly.precipitation_probability,MM:S.d.hourly.precipitation};S.dag=null;
 const kandidaten=WeatherNowFinalDesktopUI20260902.komendeUurRijen(S.d,S.klokInstantOverride.getTime(),12);
 WeatherNowFinalDesktopUI20260902.render();
 await new Promise(resolve=>setTimeout(resolve,160));WeatherNowFinalDesktopUI20260902.render();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const rows=[...document.querySelectorAll('#wiw-hour-table tbody tr')];const panel=document.getElementById('wiw-hour-panel');const last=rows.at(-1);const tijden=rows.map(r=>r.querySelector('time')?.textContent.trim()||'');const mm=rows.map(r=>r.children[3]?.textContent.trim()||'');
 const pr=panel?.getBoundingClientRect(),lr=last?.getBoundingClientRect();
 const placeRect=place?.getBoundingClientRect(),timeRect=document.getElementById('plaatstijd')?.getBoundingClientRect();let naamRect=null;if(place&&place.firstChild&&place.firstChild.nodeType===Node.TEXT_NODE){const range=document.createRange();range.selectNode(place.firstChild);naamRect=range.getBoundingClientRect();}
 const seoStyle=getComputedStyle(seo),wide=document.querySelector('#nights .row.night .nmeta.wide'),advies=document.querySelector('#nights .nachtadvies'),maan=document.querySelector('#nights .nachtmaan'),wr=wide?.getBoundingClientRect(),ar=advies?.getBoundingClientRect(),mr=maan?.getBoundingClientRect();
 zet('candidates',kandidaten.length);zet('candidate-first',kandidaten[0]?String(kandidaten[0].tijd).slice(11,16):'');zet('candidate-last',kandidaten.at(-1)?String(kandidaten.at(-1).tijd).slice(11,16):'');
 zet('rows',rows.length);zet('first',tijden[0]||'');zet('last',tijden.at(-1)||'');zet('zero-first',mm[0]||'');zet('missing-second',mm[1]||'');zet('fits',pr&&lr&&lr.bottom<=pr.bottom+1?'ok':'fout');zet('panel-bottom',pr?pr.bottom.toFixed(1):'');zet('last-bottom',lr?lr.bottom.toFixed(1):'');
 zet('place-left-inset',placeRect&&naamRect?(naamRect.left-placeRect.left).toFixed(1):'0');zet('place-right-inset',placeRect&&timeRect?(placeRect.right-timeRect.right).toFixed(1):'0');zet('seo-left-padding',parseFloat(seoStyle.paddingLeft)||0);zet('seo-right-padding',parseFloat(seoStyle.paddingRight)||0);
 zet('night-display',wide?getComputedStyle(wide).display:'');zet('night-moon-right-gap',wr&&mr?(wr.right-mr.right).toFixed(1):'999');zet('night-separated',ar&&mr&&ar.right<=mr.left+1?'ok':'fout');zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}},{once:true});
</script>`;
const bodyEinde=/<\/body>\s*<\/html>\s*$/i;if(!bodyEinde.test(html))throw new Error("public/index.html heeft geen afgesloten body voor browserfixture");html=html.replace(bodyEinde,reporter+"</body>\n</html>");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-hour-refine-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html);
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files","--window-size=1600,900","--virtual-time-budget=3000","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:36*1024*1024});
  if(r.status!==0)throw new Error(`browser exit ${r.status}: `+String(r.stderr||"").slice(-800));
  const dom=r.stdout||"",v=k=>{const m=new RegExp('data-hour-refine-'+k+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(v('done')!=='ok')throw new Error("reporter: "+v('exception'));
  if(v('candidates')!=='12'||v('candidate-first')!=='14:00'||v('candidate-last')!=='01:00')throw new Error(`12-uurskandidaatset fout: count=${v('candidates')} first=${v('candidate-first')} last=${v('candidate-last')}`);
  // De kandidaatset is exact twaalf uur; de bestaande hoogtesync bepaalt daarna
  // hoeveel volledige rijen werkelijk naast de grafiek passen. Geen halve rij
  // en geen geforceerde paneelhoogte om kunstmatig alle twaalf zichtbaar te maken.
  const zichtbaar=Number(v('rows'));if(!(zichtbaar>=1&&zichtbaar<=12)||v('first')!=='14:00')throw new Error(`zichtbare uurselectie fout: rows=${v('rows')} first=${v('first')} last=${v('last')}`);
  if(v('zero-first')!=='0,0 mm'||v('missing-second')!=='–')throw new Error(`0 mm/missing-semantiek fout: first=${v('zero-first')} second=${v('missing-second')}`);
  if(v('fits')!=='ok')throw new Error(`laatste volledige uurregel valt buiten paneel: row=${v('last-bottom')} panel=${v('panel-bottom')}`);
  if(Number(v('place-left-inset'))<26||Number(v('place-right-inset'))<26)throw new Error(`plaats/tijd staan nog tegen de buitenzijden: links=${v('place-left-inset')} rechts=${v('place-right-inset')}`);
  if(Number(v('seo-left-padding'))<24||Number(v('seo-right-padding'))<24)throw new Error(`SEO-plaatsnavigatie mist veilige inset: links=${v('seo-left-padding')} rechts=${v('seo-right-padding')}`);
  if(v('night-display')!=='grid'||v('night-separated')!=='ok'||Math.abs(Number(v('night-moon-right-gap')))>2)throw new Error(`Nachtzicht benut brede rechterruimte niet: display=${v('night-display')} separated=${v('night-separated')} rightGap=${v('night-moon-right-gap')}`);
  console.log(`Desktoprefinement groen op 1600×900: 12 uur beschikbaar, ${zichtbaar} volledige uurregels passen; plaats/tijd en SEO-footer hebben veilige insets, Nachtzicht gebruikt de brede rechterkolom en 0 mm blijft numeriek.`);
}finally{fs.rmSync(dir,{recursive:true,force:true});}

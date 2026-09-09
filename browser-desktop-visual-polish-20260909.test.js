"use strict";

const fs=require("fs");
const os=require("os");
const path=require("path");
const {spawnSync}=require("child_process");
const {bouw}=require("./data.js");

function vindBrowser(){
  for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
    const r=spawnSync(n,["--version"],{encoding:"utf8"});if(r.status===0)return n;
  }
  return null;
}
const browser=vindBrowser();
if(!browser){
  if(process.env.CI){console.error("FOUT desktop-polish browsertest: Chrome/Chromium ontbreekt.");process.exit(1);}
  console.log("SKIP desktop-polish browsertest: lokaal geen Chrome/Chromium.");process.exit(0);
}

const d=bouw({
  temp:(u,dag)=>+(18-u*.08+(dag||0)*.1).toFixed(1),
  tempNu:17.4,pp:u=>u%4?35:0,pr:u=>u===17?.4:0,som:.4,
  cc:u=>u>=20||u<=5?44:32,wc:u=>u===17?61:3,ws:14,wsNu:13,wg:()=>28
});
d.current.time="2026-07-22T14:17";
d.current.interval=900;
d.current.temperature_2m=17.4;
d.current.apparent_temperature=16.8;
d.current.is_day=1;
d.current.precipitation=0;
d.current.weather_code=3;
d.current.cloud_cover=32;
d.current.wind_speed_10m=13;
d.current.wind_direction_10m=250;
d.current.wind_gusts_10m=28;
d.current.pressure_msl=1014;
d.current.visibility=18000;
d.elevation=3;
d.latitude=52.35;
d.longitude=5.26;
d.daily.sunrise=d.daily.time.map(t=>t+"T05:46");
d.daily.sunset=d.daily.time.map(t=>t+"T21:44");
d.daily.sunshine_duration=d.daily.time.map(()=>9.3*3600);
d.minutely_15={time:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[]};
for(let i=0;i<9;i++){
  const ms=Date.UTC(2026,6,22,12,15)+i*15*60000;
  const t=new Date(ms+2*3600000).toISOString().slice(0,16);
  d.minutely_15.time.push(t);d.minutely_15.precipitation.push(0);d.minutely_15.rain.push(0);
  d.minutely_15.showers.push(0);d.minutely_15.snowfall.push(0);d.minutely_15.weather_code.push(3);
}
const air={current:{european_aqi:24,us_aqi:33},hourly:{
  time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[4],mugwort_pollen:[1],ragweed_pollen:[0],olive_pollen:[0]
}};

const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(productie,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
if(!html.includes("DESKTOP VISUAL POLISH 20260909"))throw new Error("Desktop-polish ontbreekt in artifact.");
html=html.replace('function set(id,html){document.getElementById(id).innerHTML=nbsp(html);}','function set(id,html){const el=document.getElementById(id);if(!el)throw new Error("ontbrekend renderdoel: "+id);el.innerHTML=nbsp(html);}')
html=html.replace(/<body([^>]*)>/i,'<body$1><div hidden aria-hidden="true"><span id="pres"></span><span id="pressub"></span></div>');
const fixedNow=Date.UTC(2026,6,22,12,17);
const stub=`<script>
try{localStorage.clear();sessionStorage.clear();}catch(e){}
const POLISH_NATIVE_DATE=Date;
class PolishFixtureDate extends POLISH_NATIVE_DATE{
  constructor(...args){super(...(args.length?args:[${fixedNow}]));}
  static now(){return ${fixedNow};}
}
window.Date=PolishFixtureDate;
window.__POLISH_ERRORS=[];
window.addEventListener('error',e=>window.__POLISH_ERRORS.push(String(e.error&&e.error.stack||e.message)));
window.addEventListener('unhandledrejection',e=>window.__POLISH_ERRORS.push(String(e.reason&&e.reason.stack||e.reason)));
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('/api/luchtkwaliteit')?${JSON.stringify(air)}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Almere",land:"NL",bron:"test"})}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload),headers:{get:()=>null}};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const reporter=`<script>
(function(){
const zet=(k,v)=>document.body.setAttribute("data-polish-"+k,String(v));
zet("injected","1");
function baseline(el){
  const m=document.createElement("i");m.style.cssText="display:inline-block;width:0;height:0;padding:0;margin:0;border:0";
  el.appendChild(m);const y=m.getBoundingClientRect().top;m.remove();return y;
}
function meet(){
  try{
    if(window.WeatherNowFinalDesktopUI20260902)window.WeatherNowFinalDesktopUI20260902.render();
    if(window.WeatherNowDesktopVisualPolish20260909)window.WeatherNowDesktopVisualPolish20260909.sync();
    document.documentElement.getBoundingClientRect();
    const R=e=>e.getBoundingClientRect(),C=e=>getComputedStyle(e);
    const layout=document.getElementById("wiw-chart-layout"),main=layout.querySelector(".wiw-chart-main"),panel=document.getElementById("wiw-hour-panel"),scroll=document.getElementById("wiw-hour-scroll"),allRows=[...document.querySelectorAll("#wiw-hour-table tbody tr")],rows=allRows.filter(e=>R(e).height>0);
    const days=document.getElementById("days"),nights=document.getElementById("nights"),dHead=days.querySelector(".row.kop"),dRow=days.querySelector(".row:not(.kop)"),nHead=nights.querySelector(".row.kop"),nRow=nights.querySelector(".row:not(.kop)"),dTitle=document.querySelector(".dashrow-days .dashcol:first-child>h2"),nTitle=document.querySelector(".nachtkop"),aqTitle=document.querySelector(".dashrow-days + h2");
    const primEls=[nRow.querySelector(".dname"),nRow.querySelector(".score"),nRow.querySelector(".nmeta:not(.wide)"),nRow.querySelector(".nachtoordeel"),nRow.querySelector(".nachtvenster")].filter(Boolean),prim=primEls.map(baseline);
    const dPos=[...dHead.children].slice(3,8).map(e=>R(e).left),drPos=[...dRow.children].slice(3,8).map(e=>R(e).left);
    zet("desktop",innerWidth>=1100?1:0);
    zet("overflow",Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
    zet("rows",rows.length);zet("all-rows",allRows.length);zet("first",rows[0]?.querySelector("time")?.textContent.trim()||"");
    zet("chart-count",typeof S!=="undefined"&&S.geo&&S.geo.TI?S.geo.TI.length:0);zet("chart-first",typeof S!=="undefined"&&S.geo&&S.geo.TI&&S.geo.TI[0]?S.geo.TI[0].slice(11,16):"");
    zet("internal",C(scroll).overflowY);zet("panel-balance",Math.abs(R(main).height-R(panel).height));
    zet("last-fit",rows.length&&R(rows.at(-1)).bottom<=R(panel).bottom+1?"ok":"fout");
    zet("panel-height",R(panel).height);zet("table-top",R(rows[0]).top-R(panel).top);zet("row-height",R(rows[0]).height);zet("candidate-hours",panel.dataset.candidateHours||"");
    zet("days-head-align",Math.max(...dPos.map((x,i)=>Math.abs(x-drPos[i]))));
    zet("days-group-start",dPos[0]-R(dHead).left);zet("days-last-right",R(dHead.children[7]).right-R(dHead).left);
    zet("night-columns",C(nRow).gridTemplateColumns.split(" ").length);
    zet("night-head",[...nHead.children].filter(e=>C(e).display!=="none").sort((a,b)=>R(a).left-R(b).left).map(e=>e.innerText.replace(/\\s+/g," ").trim()).filter(Boolean).join(" "));
    zet("night-dom-head",[...nHead.children].filter(e=>C(e).display!=="none").map(e=>e.innerText.replace(/\\s+/g," ").trim()).filter(Boolean).join(" "));
    zet("night-baseline",Math.max(...prim)-Math.min(...prim));
    zet("night-baselines",prim.join("/"));zet("night-primary-parents",primEls.map(e=>e.className+">"+e.parentElement.className).join("/"));
    const venster=nRow.querySelector(".nachtvenster"),maan=nRow.querySelector(".nachtmaan");
    zet("night-detail-axis",Math.abs(R(venster).left-R(maan).left));zet("night-detail-debug",[R(venster).left,R(maan).left,R(venster).width,R(maan).width,C(venster).gridColumnStart,C(maan).gridColumnStart,C(venster).gridColumnEnd,C(maan).gridColumnEnd,C(venster).gridRowStart,C(maan).gridRowStart,C(maan).marginLeft,C(maan).order,C(maan).position,C(maan).transform,C(venster.parentElement).display,C(venster.parentElement).direction,C(venster.parentElement).gridTemplateColumns].join("/"));
    zet("night-wrap",R(nRow.querySelector(".nachtvenster")).height>22?1:0);
    zet("gap-chart-days",R(dTitle).top-R(layout).bottom);zet("gap-days-night",R(nTitle).top-R(days).bottom);zet("gap-night-air",R(aqTitle).top-R(nights).bottom);
    zet("assessment-visible",C(nHead.querySelector(".wiw-night-assessment-head")).display!=="none"?1:0);
    zet("done","ok");
  }catch(e){zet("exception",e&&e.stack||e);zet("done","fout");}
}
setTimeout(meet,500);
})();
</script>`;
const bodyEinde=/<\/body>\s*<\/html>\s*$/i;
if(!bodyEinde.test(html))throw new Error("public/index.html heeft geen afgesloten body.");
html=html.replace(bodyEinde,reporter+"</body>\n</html>");

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-desktop-polish-"));
try{
  const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
  for(const [w,h] of [[320,900],[360,900],[390,900],[400,900],[430,932],[1366,900],[1600,900],[1920,1080]]){
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${w},${h}`,"--virtual-time-budget=12000","--dump-dom","file://"+pad+"?lat=52.35&lon=5.26&plaats=Almere&land=NL"],{encoding:"utf8",maxBuffer:40*1024*1024});
    if(r.status!==0)throw new Error(`${w}px browser exit ${r.status}: `+String(r.stderr||"").slice(-800));
    const dom=r.stdout||"",v=k=>{const m=new RegExp('data-polish-'+k+'="([^"]*)"').exec(dom);return m&&m[1];},n=k=>Number(v(k));
    if(v("done")!=="ok")throw new Error(`${w}px reporter: ${v("exception")}; injected=${v("injected")}`);
    if(n("overflow")>2)throw new Error(`${w}px: ${n("overflow")}px horizontale overflow`);
    if(w>=1100){
      if(n("rows")!==11||n("chart-count")!==11)throw new Error(`${w}px: grafiek/tabel delen geen 11 uren (${v("chart-count")}/${v("rows")}); paneel=${v("panel-height")}, tabeltop=${v("table-top")}, rij=${v("row-height")}, kandidaten=${v("candidate-hours")}`);
      if(v("first")!==v("chart-first")||v("first")!=="15:00")throw new Error(`${w}px: eerste uur verschoof of verschilt (${v("chart-first")}/${v("first")})`);
      if(v("internal")!=="visible"||v("last-fit")!=="ok")throw new Error(`${w}px: interne scrollbar of onvolledige laatste rij (${v("internal")}/${v("last-fit")})`);
      if(n("panel-balance")>1)throw new Error(`${w}px: grafiek/paneelhoogte uit balans (${v("panel-balance")}px)`);
      if(n("days-head-align")>1)throw new Error(`${w}px: weekkop en waarden niet uitgelijnd (${v("days-head-align")}px)`);
      if(n("days-group-start")>620)throw new Error(`${w}px: weekmetriekgroep staat nog te ver rechts (${v("days-group-start")}px)`);
      if(n("days-last-right")>=w-100)throw new Error(`${w}px: weekmetriekgroep wordt nog over de hele rij uitgerekt`);
      if(n("night-columns")!==5)throw new Error(`${w}px: Nachtzicht heeft ${v("night-columns")} kolommen i.p.v. vijf`);
      if(v("night-head")!=="NACHT ZICHTSCORE BEWOLKING BEOORDELING BESTE ZICHTPERIODE")throw new Error(`${w}px: Nachtzicht-header onjuist: ${v("night-head")}`);
      if(v("night-dom-head")!==v("night-head"))throw new Error(`${w}px: semantische Nachtzicht-kopvolgorde wijkt visueel af (${v("night-dom-head")})`);
      if(n("assessment-visible")!==1)throw new Error(`${w}px: Beoordeling-header is niet zichtbaar`);
      if(n("night-baseline")>1.1)throw new Error(`${w}px: primaire Nachtzicht-baseline wijkt ${v("night-baseline")}px af (${v("night-baselines")}; ${v("night-primary-parents")})`);
      if(n("night-detail-axis")>1)throw new Error(`${w}px: rechter Nachtzicht-details starten ${v("night-detail-axis")}px ongelijk (${v("night-detail-debug")})`);
      if(n("night-wrap")!==0)throw new Error(`${w}px: zichtperiode wrapt onnodig`);
      const gaps=["gap-chart-days","gap-days-night","gap-night-air"].map(n);
      if(Math.max(...gaps)-Math.min(...gaps)>1.1||gaps.some(g=>g<27||g>29))throw new Error(`${w}px: sectieritme ongelijk (${gaps.join("/")})`);
    }else{
      if(n("assessment-visible")!==0)throw new Error(`${w}px: desktopheader lekt naar mobiel`);
      if(n("all-rows")!==24)throw new Error(`${w}px: mobiele uurtabel wijzigde inhoudelijk (${v("all-rows")} rijen)`);
    }
    console.log(`${w}px desktop-polish groen: overflow ${v("overflow")}px${w>=1100?", 11 gedeelde uren, vijf Nachtzicht-kolommen en sectiegap "+v("gap-chart-days")+"px":", mobiele layout intact"}.`);
  }
  console.log("Desktop-polish browsematrix geslaagd op 320/360/390/400/430/1366/1600/1920 px.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}

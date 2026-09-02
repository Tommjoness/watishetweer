(function(root){
"use strict";

const MARKER="final-desktop-ui-20260902";
const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const esc=t=>String(t==null?"":t).replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[c]));
const formatTemp=v=>{const n=num(v);if(n===null)return "–";const s=(Math.round(n*10)/10).toFixed(1).replace(".",",").replace(/,0$/,"");return s+" °C";};
const formatPct=v=>{const n=num(v);return n===null?null:Math.round(Math.max(0,Math.min(100,n)))+"%";};
const formatMm=v=>{const n=num(v);if(n===null||n<0)return null;if(n>0&&n<0.1)return "<0,1 mm";return n.toFixed(1).replace(".",",")+" mm";};
const hhmm=t=>{const m=/T(\d{2}):(\d{2})/.exec(String(t||""));return m?m[1]+":"+m[2]:"–";};
const datum=t=>String(t||"").slice(0,10);
const dagLabel=t=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(t||""));if(!m)return "";const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return ["zo","ma","di","wo","do","vr","za"][d.getUTCDay()]+" "+Number(m[3])+" "+["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"][Number(m[2])-1];};

function uurRijenUitGeo(g,currentTime,dagGeselecteerd){
  const tijden=g&&Array.isArray(g.TI)?g.TI:[],T=g&&Array.isArray(g.T)?g.T:[],A=g&&Array.isArray(g.A)?g.A:[];
  const n=Math.min(24,tijden.length,T.length||tijden.length,A.length||tijden.length),rijen=[];
  let mark=-1;
  if(!dagGeselecteerd&&currentTime&&tijden.length){mark=tijden.findIndex(t=>String(t)>=String(currentTime));if(mark<0&&String(currentTime)<=String(tijden[tijden.length-1]))mark=tijden.length-1;}
  for(let i=0;i<n;i++){
    const tijd=tijden[i],temp=num(T[i]),gevoel=num(A[i]);
    if(!tijd||temp===null||gevoel===null)continue;
    const vorige=i>0?datum(tijden[i-1]):null,nieuweDag=i>0&&datum(tijd)!==vorige;
    const zelfdeUur=mark===i&&String(currentTime||"").slice(0,13)===String(tijd).slice(0,13);
    rijen.push({tijd,temp,gevoel,datumLabel:nieuweDag?dagLabel(tijd):"",marker:mark===i?(zelfdeUur?"Nu":"Eerstvolgend"):""});
  }
  return rijen;
}

function regenVelden(a,isNat){
  if(!a||typeof a!=="object")return [];
  const velden=[{label:"Huidige status",waarde:isNat?"Neerslag":"Droog"}];
  const eersteTijd=String(a.eersteTijd||"").trim();
  if(isNat&&a.droogVanafTijd)velden.push({label:"Verwacht droog rond",waarde:String(a.droogVanafTijd)});
  if(!isNat&&eersteTijd)velden.push({label:"Verwacht begin rond",waarde:eersteTijd});
  const kansNum=num(a.kans),hoeveelheidNum=num(a.hoeveelheid);
  const heeftNeerslagsignaal=!!(isNat||eersteTijd||(kansNum!==null&&kansNum>0)||(hoeveelheidNum!==null&&hoeveelheidNum>0));
  const kans=heeftNeerslagsignaal?formatPct(a.kans):null;if(kans)velden.push({label:"Hoogste neerslagkans",waarde:kans});
  const mm=a.genoeg===false||!heeftNeerslagsignaal?null:formatMm(a.hoeveelheid);if(mm)velden.push({label:"Verwachte totale hoeveelheid",waarde:mm});
  const soort=String(a.soort||"").trim();if(heeftNeerslagsignaal&&soort&&soort.toLowerCase()!=="neerslag")velden.push({label:"Neerslagtype",waarde:soort.charAt(0).toUpperCase()+soort.slice(1)});
  return velden;
}

if(typeof module!=="undefined"&&module.exports)module.exports={uurRijenUitGeo,regenVelden,formatTemp,formatPct,formatMm,hhmm,dagLabel};
if(typeof document==="undefined")return;

function voegStijlToe(){
  if(document.getElementById(MARKER))return;
  const style=document.createElement("style");style.id=MARKER;style.textContent=`
/* Finale desktop-UI 2026-09-02: uitsluitend layout/presentatie. */
.final-top-grid>.stats .stat{display:flex!important;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:118px}
.final-top-grid>.stats .stat .eyebrow,.final-top-grid>.stats .stat .sval,.final-top-grid>.stats .stat .ssub{width:100%;text-align:center}
.final-top-grid>.stats .stat .ssub{max-width:28ch;margin-left:auto;margin-right:auto}
.final-top-grid>.stats .stat .sval s,.final-top-grid>.stats .stat .sval svg{vertical-align:baseline}
.wiw-short-copy{max-width:920px!important;margin-left:auto!important;margin-right:auto!important}
.wiw-short-copy.wiw-short-center{text-align:center!important}
.wiw-chart-layout{display:grid;grid-template-columns:minmax(0,2.125fr) minmax(280px,1fr);gap:32px;align-items:stretch;min-width:0}
.wiw-chart-main,.wiw-hour-panel{min-width:0}
.wiw-chart-main{display:flex;flex-direction:column}
.wiw-chart-main .dagmod{max-width:none!important;width:100%;margin-left:0!important;margin-right:0!important}
.wiw-chart-main #chart{margin-bottom:-14px}
.wiw-hour-panel{border-left:1px solid var(--rule);padding-left:24px;display:flex;flex-direction:column;box-sizing:border-box;min-height:0}
.wiw-hour-panel h3{font-family:var(--serif);font-weight:400;font-size:20px;line-height:1.2;margin:0 0 10px;color:var(--ink)}
.wiw-hour-table-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;border-top:1px solid var(--ink);border-bottom:1px solid var(--rule);outline-offset:3px}
.wiw-hour-table{width:100%;border-collapse:collapse;table-layout:fixed;font-family:var(--sans);font-size:12.5px;font-variant-numeric:tabular-nums}
.wiw-hour-table caption{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.wiw-hour-table th,.wiw-hour-table td{padding:8px 7px;border-bottom:1px solid var(--rule-soft);text-align:right;vertical-align:middle}
.wiw-hour-table th:first-child,.wiw-hour-table td:first-child{text-align:left}
.wiw-hour-table thead th{position:sticky;top:0;z-index:2;background:var(--sheet);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-45);border-bottom:1px solid var(--ink)}
.wiw-hour-table tbody tr[data-current="1"]{font-weight:600;box-shadow:inset 3px 0 0 var(--ink)}
.wiw-hour-marker{display:inline-block;margin-left:6px;font-size:9px;line-height:1.4;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-70);font-weight:600}
.wiw-hour-date{display:block;margin-top:2px;font-size:9.5px;color:var(--ink-45);font-weight:400}
.wiw-all-data-button{appearance:none;background:none;border:0;border-bottom:1px solid var(--rule);padding:10px 0 5px;margin-top:8px;align-self:flex-start;color:var(--ink-70);font:500 11px/1.4 var(--sans);cursor:pointer;text-align:left}
.wiw-all-data-button:hover,.wiw-all-data-button:focus-visible{color:var(--ink);border-bottom-color:var(--ink)}
.wiw-full-chart-data{grid-column:1/-1;margin-top:4px}
.wiw-full-chart-data>details{max-width:100%;margin:0}
.wiw-full-chart-data>details>summary{max-width:920px;margin-left:auto;margin-right:auto;text-align:center}
.wiw-rain-section{margin-top:var(--s4)}
.wiw-rain-section>h2{margin-top:0}
.wiw-rain-layout{display:grid;grid-template-columns:minmax(0,1.86fr) minmax(250px,1fr);gap:32px;align-items:stretch;min-width:0}
.wiw-rain-main,.wiw-rain-summary{min-width:0}
.wiw-rain-main{display:flex;flex-direction:column;justify-content:center}
.wiw-rain-main #nc{width:100%;margin-left:0}
.wiw-rain-main #nctext,.wiw-rain-main #nchint{max-width:920px;margin-left:auto;margin-right:auto;text-align:center}
.wiw-rain-main .data-uitleg{align-self:center;text-align:center}
.wiw-rain-summary{border-left:1px solid var(--rule);padding-left:24px;display:flex;flex-direction:column;justify-content:center}
.wiw-rain-summary dl{margin:0}
.wiw-rain-summary .wiw-rain-item{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(90px,.85fr);gap:12px;padding:8px 0;border-bottom:1px solid var(--rule-soft);align-items:baseline}
.wiw-rain-summary .wiw-rain-item:first-child{border-top:1px solid var(--ink)}
.wiw-rain-summary dt{font-size:11px;color:var(--ink-45)}
.wiw-rain-summary dd{margin:0;text-align:right;font-size:13px;color:var(--ink);font-variant-numeric:tabular-nums}
.wiw-rain-summary-empty{font-size:12px;line-height:1.5;color:var(--ink-45);text-align:center;max-width:28ch;margin:auto}
footer{margin-top:24px!important;padding-top:10px!important;display:flex!important;flex-direction:row!important;flex-wrap:wrap!important;justify-content:center!important;align-items:center!important;gap:4px 16px!important;text-align:center!important;line-height:1.45!important}
footer .bron,footer .footer-details{display:inline-flex!important;align-items:center!important;min-height:28px}
footer .footer-details[open]{flex-basis:100%;justify-content:center;flex-wrap:wrap}
footer details #coords{margin:2px 0 0 8px!important}
.seo-plaatsnav{margin-top:14px!important;padding:12px 0!important;min-height:80px;display:flex;align-items:center}
.seo-plaatsnav-inner{width:100%;grid-template-columns:minmax(130px,.45fr) minmax(0,2.55fr)!important;gap:16px!important;align-items:center!important}
.seo-plaatsnav-kop{text-align:center}
.seo-plaatsnav p{display:none!important}
.seo-plaatsnav-links{justify-content:center;align-items:center;gap:6px 14px!important}
.seo-plaatsnav a{display:inline-flex;align-items:center;min-height:32px}
@media(max-width:1099px){
 .wiw-chart-layout,.wiw-rain-layout{grid-template-columns:1fr;gap:20px}
 .wiw-hour-panel,.wiw-rain-summary{border-left:0;padding-left:0;border-top:1px solid var(--rule);padding-top:16px;height:auto!important}
 .wiw-hour-table-scroll{max-height:360px}
 .wiw-chart-main #chart{margin-bottom:0}
 .wiw-full-chart-data{grid-column:1}
}
@media(max-width:900px){
 .final-top-grid>.stats .stat{min-height:126px}
 .final-top-grid>.stats .stat .ssub{max-width:24ch}
 .wiw-rain-main #nc{width:calc(100% + 34px);margin-left:-17px}
 footer{gap:2px 10px!important}
 footer .bron,footer .footer-details{min-height:44px}
 .seo-plaatsnav{min-height:auto;padding:10px 0 4px!important}
 .seo-plaatsnav-inner{grid-template-columns:1fr!important;gap:8px!important}
 .seo-plaatsnav a{min-height:44px}
}
@media(max-width:430px){
 .wiw-hour-table{font-size:12px}
 .wiw-hour-table th,.wiw-hour-table td{padding:8px 5px}
 .wiw-hour-panel h3{text-align:center}
 .wiw-rain-summary .wiw-rain-item{grid-template-columns:1fr auto;gap:8px}
}
`;
  document.head.appendChild(style);
}

function herstelVerborgenDruk(){
  const details=document.getElementById("wiw-more-measurements"),pres=document.getElementById("pres"),diag=document.getElementById("wiw-pressure-diagnostic"),stat=pres&&pres.closest(".stat");
  if(stat&&diag&&!diag.contains(stat))diag.appendChild(stat);
  if(details)details.remove();
  const betekenis=stat&&stat.querySelector(".wiw-pressure-meaning");if(betekenis)betekenis.remove();
}

function maakUurPaneel(){
  let paneel=document.getElementById("wiw-hour-panel");if(paneel)return paneel;
  const rij=document.querySelector(".dashrow-chart"),kolom=rij&&rij.querySelector(":scope > .dashcol"),dagmod=kolom&&kolom.querySelector(".dagmod");if(!rij||!kolom||!dagmod)return null;
  const grid=document.createElement("div");grid.className="wiw-chart-layout";grid.id="wiw-chart-layout";
  const main=document.createElement("div");main.className="wiw-chart-main";
  paneel=document.createElement("aside");paneel.className="wiw-hour-panel";paneel.id="wiw-hour-panel";paneel.setAttribute("aria-labelledby","wiw-hour-title");
  const h=document.createElement("h3");h.id="wiw-hour-title";h.textContent="Temperatuur per uur";
  const scroll=document.createElement("div");scroll.className="wiw-hour-table-scroll";scroll.id="wiw-hour-scroll";scroll.tabIndex=0;scroll.setAttribute("role","region");scroll.setAttribute("aria-label","Temperatuur per uur, verticaal scrollbaar");
  const table=document.createElement("table");table.className="wiw-hour-table";table.id="wiw-hour-table";
  table.innerHTML='<caption>Temperatuur en gevoelstemperatuur per uur voor de uren in de grafiek</caption><thead><tr><th scope="col">Tijd</th><th scope="col">Temperatuur</th><th scope="col">Gevoelstemperatuur</th></tr></thead><tbody></tbody>';
  scroll.appendChild(table);
  const knop=document.createElement("button");knop.type="button";knop.className="wiw-all-data-button";knop.id="wiw-all-data-button";knop.textContent="Alle grafiekgegevens bekijken";knop.hidden=true;
  paneel.append(h,scroll,knop);
  dagmod.parentNode.insertBefore(grid,dagmod);main.appendChild(dagmod);grid.append(main,paneel);
  const volledig=document.createElement("div");volledig.className="wiw-full-chart-data";volledig.id="wiw-full-chart-data";grid.insertAdjacentElement("afterend",volledig);
  knop.addEventListener("click",()=>{const d=volledig.querySelector("details");if(!d)return;d.open=!d.open;knop.setAttribute("aria-expanded",String(d.open));if(d.open){const s=d.querySelector("summary");if(s)s.focus({preventScroll:true});}});
  return paneel;
}

function vindVolledigeGrafiekTabel(){
  const houder=document.getElementById("wiw-full-chart-data"),knop=document.getElementById("wiw-all-data-button");if(!houder||!knop)return;
  let details=houder.querySelector("details");
  if(!details){
    details=[...document.querySelectorAll("details")].find(d=>{const s=d.querySelector(":scope > summary");return s&&/grafiekgegevens.*tabel|gegevens.*grafiek.*tabel/i.test(String(s.textContent||""));});
    if(details){details.id=details.id||"wiw-complete-chart-data";houder.appendChild(details);}
  }
  if(details){knop.hidden=false;knop.setAttribute("aria-controls",details.id||"wiw-complete-chart-data");knop.setAttribute("aria-expanded",String(!!details.open));const s=details.querySelector(":scope > summary");if(s)s.classList.add("wiw-short-copy","wiw-short-center");}
  else knop.hidden=true;
}

function werkUurTabelBij(){
  const paneel=maakUurPaneel(),tbody=document.querySelector("#wiw-hour-table tbody");if(!paneel||!tbody||typeof S==="undefined")return;
  const rijen=uurRijenUitGeo(S.geo,S.d&&S.d.current&&S.d.current.time,S.dag!=null);tbody.replaceChildren();
  for(const r of rijen){
    const tr=document.createElement("tr");if(r.marker){tr.dataset.current="1";tr.setAttribute("aria-current","time");}
    const tijd=document.createElement("td"),tm=document.createElement("time");tm.dateTime=r.tijd;tm.textContent=hhmm(r.tijd);tijd.appendChild(tm);
    if(r.marker){const m=document.createElement("span");m.className="wiw-hour-marker";m.textContent=r.marker;tijd.appendChild(m);}
    if(r.datumLabel){const d=document.createElement("span");d.className="wiw-hour-date";d.textContent=r.datumLabel;tijd.appendChild(d);}
    const t=document.createElement("td");t.textContent=formatTemp(r.temp);const a=document.createElement("td");a.textContent=formatTemp(r.gevoel);tr.append(tijd,t,a);tbody.appendChild(tr);
  }
  vindVolledigeGrafiekTabel();planHoogteSync();
}

function maakRegenLayout(){
  let aside=document.getElementById("wiw-rain-summary");if(aside)return aside;
  const hint=document.getElementById("nchint"),tekst=document.getElementById("nctext"),svg=document.getElementById("nc"),uitleg=hint&&hint.nextElementSibling&&hint.nextElementSibling.matches("details.data-uitleg")?hint.nextElementSibling:document.querySelector("details.data-uitleg");
  const h2=hint&&hint.previousElementSibling&&hint.previousElementSibling.tagName==="H2"?hint.previousElementSibling:null;if(!hint||!tekst||!svg||!h2||!h2.parentNode)return null;
  const section=document.createElement("section");section.className="wiw-rain-section";section.id="wiw-rain-section";h2.parentNode.insertBefore(section,h2);section.appendChild(h2);
  const grid=document.createElement("div");grid.className="wiw-rain-layout";const main=document.createElement("div");main.className="wiw-rain-main";
  main.appendChild(hint);main.appendChild(tekst);if(uitleg)main.appendChild(uitleg);main.appendChild(svg);
  aside=document.createElement("aside");aside.className="wiw-rain-summary";aside.id="wiw-rain-summary";aside.setAttribute("aria-label","Samenvatting neerslag komende twee uur");
  grid.append(main,aside);section.appendChild(grid);return aside;
}

function werkRegenSamenvattingBij(){
  const aside=maakRegenLayout();if(!aside)return;
  const p=root.WeatherNowNeerslagPresentatieV2;let a=null,isNat=false;
  try{a=p&&typeof p.analyse==="function"?p.analyse(120):null;isNat=!!(p&&typeof p.meetbareNeerslagNu==="function"&&p.meetbareNeerslagNu(a));}catch(_){a=null;}
  const velden=regenVelden(a,isNat);aside.replaceChildren();
  if(!velden.length){const leeg=document.createElement("p");leeg.className="wiw-rain-summary-empty";leeg.textContent="Geen betrouwbare aanvullende samenvatting beschikbaar.";aside.appendChild(leeg);return;}
  const dl=document.createElement("dl");for(const v of velden){const item=document.createElement("div");item.className="wiw-rain-item";const dt=document.createElement("dt");dt.textContent=v.label;const dd=document.createElement("dd");dd.textContent=v.waarde;item.append(dt,dd);dl.appendChild(item);}aside.appendChild(dl);
}

function centraliseerKorteTeksten(){
  const ids=["charthint","final-rain-summary","dagenhint","final-today-window-note","nachthint","pollenhint","nchint","nctext"];
  for(const id of ids){const el=document.getElementById(id);if(!el)continue;el.classList.add("wiw-short-copy");if(String(el.textContent||"").trim().length<=220)el.classList.add("wiw-short-center");}
  const waarschuwingen=document.getElementById("waarschuwingen");if(waarschuwingen&&!waarschuwingen.querySelector(".waarsch")){const msg=waarschuwingen.querySelector(".msg");if(msg&&String(msg.textContent||"").trim().length<=180)msg.classList.add("wiw-short-copy","wiw-short-center");}
}

let hoogteToken=0;
function syncHoogte(){
  const main=document.querySelector(".wiw-chart-main"),aside=document.getElementById("wiw-hour-panel");if(!main||!aside)return;
  if(window.innerWidth<1100){aside.style.height="";return;}
  const h=Math.round(main.getBoundingClientRect().height);if(h>180)aside.style.height=h+"px";
}
function planHoogteSync(){const t=++hoogteToken;const run=()=>{if(t===hoogteToken)syncHoogte();};if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>requestAnimationFrame(run));else setTimeout(run,0);}

function naRender(basis,fn){return function(){const r=basis.apply(this,arguments);fn();return r;};}
function installeer(){
  voegStijlToe();herstelVerborgenDruk();maakUurPaneel();maakRegenLayout();centraliseerKorteTeksten();
  if(typeof etmaal==="function"&&!etmaal.__finalDesktop20260902){const w=naRender(etmaal,()=>{werkUurTabelBij();centraliseerKorteTeksten();vindVolledigeGrafiekTabel();});w.__finalDesktop20260902=true;etmaal=w;}
  if(typeof nowcast==="function"&&!nowcast.__finalDesktop20260902){const w=naRender(nowcast,()=>{werkRegenSamenvattingBij();centraliseerKorteTeksten();});w.__finalDesktop20260902=true;nowcast=w;}
  if(typeof dagen==="function"&&!dagen.__finalDesktop20260902){const w=naRender(dagen,centraliseerKorteTeksten);w.__finalDesktop20260902=true;dagen=w;}
  werkUurTabelBij();werkRegenSamenvattingBij();vindVolledigeGrafiekTabel();planHoogteSync();
  window.addEventListener("resize",planHoogteSync,{passive:true});
}

root.WeatherNowFinalDesktopUI20260902={uurRijenUitGeo,regenVelden,werkUurTabelBij,werkRegenSamenvattingBij,centraliseerKorteTeksten,herstelVerborgenDruk,render:()=>{werkUurTabelBij();werkRegenSamenvattingBij();centraliseerKorteTeksten();vindVolledigeGrafiekTabel();planHoogteSync();}};
installeer();
})(typeof globalThis!=="undefined"?globalThis:this);
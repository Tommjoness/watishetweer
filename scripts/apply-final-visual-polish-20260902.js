"use strict";

const fs=require("fs"),path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== FINAL VISUAL POLISH 20260902 ===== */";
const RUNTIME_ID="final-visual-polish-runtime-20260903";
const STYLE=`
${MARKER}
/* Laatste visuele polish: gecentreerde meetwaarden, rustige scrollbars en een
   optisch uitgebalanceerd Nachtzicht-raster. Dezelfde eindlaag bewaakt nu ook
   mobiele scroll-UX, safe areas en een rustigere headerhiërarchie. */
.final-top-grid>.stats .stat .sval{justify-content:center!important;align-items:baseline!important;margin-left:auto!important;margin-right:auto!important}

/* Zoek + locatie blijven primaire taken; handmatig verversen en weergave zijn secundair. */
.tools #here{color:var(--ink);border-color:var(--ink);font-weight:600}
.tools #ververs,.tools #thema{color:var(--ink-45);opacity:.72;font-size:9.5px;letter-spacing:.1em}
.tools #ververs:hover,.tools #ververs:focus-visible,.tools #thema:hover,.tools #thema:focus-visible{color:var(--ink);opacity:1}

html{scrollbar-width:thin;scrollbar-color:var(--ink-45) var(--paper)}
html::-webkit-scrollbar{width:10px;height:10px}
html::-webkit-scrollbar-track{background:var(--paper)}
html::-webkit-scrollbar-thumb{background:var(--ink-45);border:3px solid var(--paper);border-radius:999px}
html::-webkit-scrollbar-thumb:hover{background:var(--ink-70)}
.wiw-hour-table-scroll{scrollbar-width:thin;scrollbar-color:var(--ink-45) transparent;scrollbar-gutter:stable}
.wiw-hour-table-scroll::-webkit-scrollbar{width:8px}
.wiw-hour-table-scroll::-webkit-scrollbar-track{background:transparent}
.wiw-hour-table-scroll::-webkit-scrollbar-thumb{background:var(--ink-45);border:2px solid var(--sheet);border-radius:999px}
.wiw-hour-table-scroll::-webkit-scrollbar-thumb:hover{background:var(--ink-70)}
.wiw-hour-toggle{appearance:none;background:none;border:0;border-bottom:1px solid var(--rule);padding:10px 0 6px;margin-top:8px;align-self:flex-start;color:var(--ink-70);font:500 11px/1.4 var(--sans);letter-spacing:normal;text-transform:none;cursor:pointer;text-align:left}
.wiw-hour-toggle:hover,.wiw-hour-toggle:focus-visible{color:var(--ink);border-bottom-color:var(--ink)}

@media(min-width:1100px){
  #nights .row.night{grid-template-columns:112px 72px minmax(220px,1fr) 112px minmax(300px,360px)!important;column-gap:20px!important}
  #nights .row.night .score,#nights .row.night .nmeta:not(.wide){justify-self:stretch;text-align:center}
  #nights .row.night .sbar{align-self:center;min-width:0;width:100%}
  #nights .row.night .nmeta .perc{min-width:0;text-align:center}
  #nights .row.night .nmeta.wide{display:flex;flex-direction:column;align-items:center;justify-content:center;justify-self:stretch;min-width:0;width:100%;max-width:none;text-align:center;white-space:normal;overflow-wrap:break-word}
  #nights .row.night.kop .nmeta.wide{display:flex}
  #nights .row.night .nachtadvies,#nights .row.night .nachtmaan{width:100%;max-width:32ch;margin-left:auto;margin-right:auto}
  #nights .row.night .nachtadvies{text-align:left}
  #nights .row.night .nachtmaan{text-align:center;white-space:normal}
}

@media(max-width:900px){
  body{padding-top:calc(14px + env(safe-area-inset-top));padding-bottom:calc(14px + env(safe-area-inset-bottom));padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right))}
  #minibar{top:env(safe-area-inset-top)!important;left:max(8px,env(safe-area-inset-left))!important;right:max(8px,env(safe-area-inset-right))!important}
  .wiw-hour-table-scroll{max-height:none!important;overflow-y:visible!important;overflow-x:hidden!important;overscroll-behavior:auto!important;scrollbar-gutter:auto!important}
  .wiw-hour-mobile-hidden{display:none!important}
  .wiw-hour-toggle{min-height:44px}
}

@media(max-width:430px){
  body{padding-left:max(8px,env(safe-area-inset-left));padding-right:max(8px,env(safe-area-inset-right))}
  .sheet{padding-left:16px!important;padding-right:16px!important}
}

@media(forced-colors:active){
  html,.wiw-hour-table-scroll{scrollbar-color:auto}
  .tools #here{border-color:ButtonText}
}
`;

const RUNTIME=`<script id="${RUNTIME_ID}">
(function(){
"use strict";
const mq=window.matchMedia("(max-width:900px)");
let urenUitgeklapt=false,gepland=false;

function synchroniseerUren(){
  const scroll=document.getElementById("wiw-hour-scroll"),table=document.getElementById("wiw-hour-table"),paneel=document.getElementById("wiw-hour-panel");
  if(!scroll||!table||!paneel)return;
  const rijen=Array.from(table.querySelectorAll("tbody tr"));
  let knop=document.getElementById("wiw-hour-toggle");
  if(!knop){
    knop=document.createElement("button");knop.type="button";knop.id="wiw-hour-toggle";knop.className="wiw-hour-toggle";knop.setAttribute("aria-controls","wiw-hour-table");
    knop.addEventListener("click",function(){urenUitgeklapt=!urenUitgeklapt;synchroniseerUren();});
    paneel.insertBefore(knop,scroll.nextSibling);
  }
  const mobiel=mq.matches;
  if(mobiel){
    scroll.removeAttribute("role");scroll.removeAttribute("aria-label");scroll.removeAttribute("tabindex");
    const heeftMeer=rijen.length>8;
    rijen.forEach(function(rij,i){rij.classList.toggle("wiw-hour-mobile-hidden",heeftMeer&&!urenUitgeklapt&&i>=8);});
    knop.hidden=!heeftMeer;knop.setAttribute("aria-expanded",urenUitgeklapt?"true":"false");
    const label=urenUitgeklapt?"Minder uren tonen":"Alle uren bekijken";
    if(knop.textContent!==label)knop.textContent=label;
  }else{
    rijen.forEach(function(rij){rij.classList.remove("wiw-hour-mobile-hidden");});
    knop.hidden=true;knop.setAttribute("aria-expanded","false");
    scroll.tabIndex=0;scroll.setAttribute("role","region");scroll.setAttribute("aria-label","Temperatuur per uur, verticaal scrollbaar");
  }
}

function synchroniseerNachtzicht(){
  const kop=document.querySelector("#nights .row.night.kop .score");
  if(kop&&kop.textContent.trim()==="Indicatie")kop.textContent="Zichtscore";
}

function synchroniseerZichttekst(){
  const waarde=document.getElementById("vis"),sub=document.getElementById("vissub");
  if(!waarde||!sub)return;
  if(waarde.textContent.trim().startsWith("10+")&&/meer dan tien kilometer|tien kilometer of meer/i.test(sub.textContent))sub.textContent="Goed zicht.";
}

function synchroniseerAlles(){synchroniseerUren();synchroniseerNachtzicht();synchroniseerZichttekst();}
function plan(){if(gepland)return;gepland=true;queueMicrotask(function(){gepland=false;synchroniseerAlles();});}
function start(){
  synchroniseerAlles();
  const observer=new MutationObserver(plan);observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  const wijzig=function(){urenUitgeklapt=false;synchroniseerAlles();};
  if(mq.addEventListener)mq.addEventListener("change",wijzig);else if(mq.addListener)mq.addListener(wijzig);
}
window.WeatherNowFinalVisualPolish20260903={sync:synchroniseerAlles};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
</script>`;

function htmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmlBestanden(p));
    else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function pasToe(pad){
  let html=fs.readFileSync(pad,"utf8");
  if(!html.includes("/* ===== FINAL RELEASE HARDENING 20260902 ===== */"))return false;
  if(html.includes(MARKER)||html.includes(`id="${RUNTIME_ID}"`))throw new Error("Final visual polish staat al in "+pad);
  const stylePos=html.lastIndexOf("</style>");
  if(stylePos<0)throw new Error("Geen stijlblok gevonden in "+pad);
  html=html.slice(0,stylePos)+STYLE+"\n"+html.slice(stylePos);
  const bodyPos=html.lastIndexOf("</body>");
  if(bodyPos<0)throw new Error("Geen body-einde gevonden in "+pad);
  html=html.slice(0,bodyPos)+RUNTIME+"\n"+html.slice(bodyPos);
  fs.writeFileSync(pad,html,"utf8");
  return true;
}

function main(){
  let n=0;
  for(const p of htmlBestanden(OUT))if(pasToe(p))n++;
  if(!n)throw new Error("Geen finale weerartifacts gevonden voor visual polish.");
  const cache=vernieuwServiceworkerCache(OUT,"final-visual-polish-20260903");
  console.log(`Final visual polish toegepast op ${n} weerpagina's: mobiele urenpreview, safe areas, headerhiërarchie en Nachtzicht-semantiek geborgd; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,RUNTIME_ID,STYLE,RUNTIME,htmlBestanden,pasToe,main};

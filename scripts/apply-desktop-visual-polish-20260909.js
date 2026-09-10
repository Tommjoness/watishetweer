"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const BASIS_MARKER="/* ===== HOUR PANEL CLEANUP 20260909 ===== */";
const MARKER="/* ===== DESKTOP VISUAL POLISH 20260909 ===== */";
const RUNTIME_ID="desktop-visual-polish-runtime-20260909";

const STYLE=`
${MARKER}
/* Gerichte polish van uitsluitend de finale presentatielaag. Onder 1100px
   blijven de bestaande mobiele en tabletregels eigenaar van de layout. */
@media(min-width:1100px){
  :root{--wiw-section-gap:28px}

  /* De uurhoogte en het aantal zichtbare uren worden volledig beheerd door
     apply-hour-panel-refinement-20260907. Deze laag wijzigt alleen typografie. */
  .wiw-hour-table .wiw-hour-primary{line-height:1.15!important}

  /* De verwachtingskolom krijgt een begrensde breedte. De vijf metriekvelden
     blijven als één compacte groep bij elkaar; vrije breedte valt pas ná de
     neerslagkolom en trekt de groep dus niet opnieuw uit elkaar. */
  #days .row.day{
    grid-template-columns:
      100px 26px minmax(260px,380px)
      92px 56px minmax(180px,260px) 52px 72px minmax(0,1fr)!important;
    column-gap:16px!important;
    justify-content:start!important
  }
  #days .row.day>*{min-width:0}

  /* Eén vast sectieritme voor de drie overgangen in de onderste helft. De
     Nachtzicht-kop zelf draagt de marge; zijn interne h2 krijgt er geen tweede. */
  .dashrow-days .dashcol:first-child>h2,
  .dashrow-days .nachtkop,
  .dashrow-days + h2{margin-top:var(--wiw-section-gap)!important}
  .dashrow-days .nachtkop h2{margin-top:0!important}

  /* Expliciete vijfkoloms Nachtzicht-structuur:
     Nacht | Zichtscore | Bewolking | Beoordeling | Beste zichtperiode. */
  #nights .row.night{
    grid-template-columns:
      112px minmax(140px,180px) 112px minmax(118px,148px) minmax(360px,1fr)!important;
    grid-template-rows:auto auto!important;
    column-gap:20px!important;
    row-gap:3px!important;
    justify-content:stretch!important;
    align-items:baseline!important
  }
  #nights .row.night:not(.kop)>.dname{grid-column:1;grid-row:1}
  #nights .row.night:not(.kop)>.score{grid-column:2;grid-row:1;justify-self:start!important;text-align:left!important}
  #nights .row.night:not(.kop)>.sbar{
    grid-column:2;grid-row:1;width:88px!important;
    justify-self:end!important;align-self:center!important
  }
  #nights .row.night:not(.kop)>.nmeta:not(.wide){grid-column:3;grid-row:1;justify-self:start!important;text-align:left!important}
  #nights .row.night:not(.kop)>.nmeta.wide{display:none!important}
  #nights .row.night:not(.kop)>.nachtadvies{
    grid-column:4!important;grid-row:1!important;
    display:block!important;
    width:auto!important;max-width:none!important;margin:0!important;
    color:var(--ink);font-size:13px;line-height:20px!important;
    text-align:left!important;white-space:nowrap
  }
  #nights .row.night:not(.kop)>.nachtvenster{
    grid-column:5!important;grid-row:1!important;
    display:block!important;
    width:100%!important;min-width:0;margin:0!important;justify-self:stretch!important;
    color:var(--ink-70);font-size:13px;line-height:20px!important;
    text-align:left!important;white-space:nowrap
  }
  #nights .row.night:not(.kop)>.nachtmaan{
    grid-column:5!important;grid-row:2!important;
    display:block!important;
    width:100%!important;max-width:none!important;min-width:0;justify-self:stretch!important;
    margin:0!important;color:var(--ink-25);font-size:11.5px;line-height:1.35!important;
    text-align:left!important;white-space:normal!important
  }
  #nights .row.night:not(.kop)>.dname,
  #nights .row.night:not(.kop)>.score,
  #nights .row.night:not(.kop)>.nmeta:not(.wide){line-height:20px!important}

  #nights .row.night.kop{grid-template-rows:auto!important;align-items:end!important}
  #nights .row.night.kop>.dname{grid-column:1;grid-row:1}
  #nights .row.night.kop>.score{grid-column:2;grid-row:1;text-align:left!important}
  #nights .row.night.kop>.nmeta:not(.wide){grid-column:3;grid-row:1;text-align:left!important}
  #nights .row.night.kop>.sbar{
    grid-column:4;grid-row:1;
    display:block!important;height:auto!important;background:none!important;
    text-align:left!important
  }
  #nights .row.night.kop>.nmeta.wide{
    grid-column:5;grid-row:1;
    display:block!important;width:auto!important;
    align-items:initial!important;text-align:left!important
  }
  .wiw-night-assessment-head{display:block}
  .wiw-night-moon-head{display:none}
}

/* Op echt brede desktops gebruikt de bestaande maancontext de anders lege
   rechterzone. De 1100–1599px-layout houdt bewust het bewezen vijfkolomsraster;
   vanaf 1600px krijgt Maan een eigen, semantisch gelabelde zesde kolom. */
@media(min-width:1600px){
  #nights .row.night{
    grid-template-columns:
      112px minmax(140px,180px) 112px minmax(118px,148px)
      minmax(320px,.9fr) minmax(220px,.65fr)!important
  }
  #nights .row.night:not(.kop)>.nachtvenster{
    grid-column:5!important;grid-row:1!important;
    white-space:normal!important
  }
  #nights .row.night:not(.kop)>.nachtmaan{
    grid-column:6!important;grid-row:1!important;
    width:100%!important;align-self:baseline!important;justify-self:stretch!important;
    text-align:left!important
  }
  #nights .row.night.kop>.nmeta.wide{grid-column:5}
  #nights .row.night.kop>.wiw-night-moon-head{
    grid-column:6;grid-row:1;display:block;
    text-align:left!important
  }
}

@media(max-width:1099px){
  .wiw-night-assessment-head,.wiw-night-moon-head{display:none!important}
}
`;

const RUNTIME=`<script id="${RUNTIME_ID}">
(function(){
"use strict";
let gepland=false;
function synchroniseerNachtkop(){
  const kop=document.querySelector("#nights .row.night.kop");
  if(!kop)return;
  const desktop=window.matchMedia("(min-width:1100px)").matches;
  const score=kop.querySelector(":scope > .score");
  if(score&&score.textContent.trim()!=="Zichtscore")score.textContent="Zichtscore";
  const vak=kop.querySelector(":scope > .sbar");
  if(vak&&!vak.querySelector(".wiw-night-assessment-head")){
    const label=document.createElement("span");
    label.className="wiw-night-assessment-head";
    label.textContent="Beoordeling";
    vak.appendChild(label);
  }
  const bewolking=kop.querySelector(":scope > .nmeta:not(.wide)");
  const periode=kop.querySelector(":scope > .nmeta.wide");
  if(vak&&bewolking&&periode){
    if(desktop&&vak.nextElementSibling!==periode)kop.insertBefore(vak,periode);
    else if(!desktop&&vak.nextElementSibling!==bewolking)kop.insertBefore(vak,bewolking);
  }
  if(!kop.querySelector(":scope > .wiw-night-moon-head")){
    const label=document.createElement("span");
    label.className="wiw-night-moon-head";
    label.textContent="Maan";
    kop.appendChild(label);
  }
}
function synchroniseerNachtrijen(){
  const desktop=window.matchMedia("(min-width:1100px)").matches;
  for(const rij of document.querySelectorAll("#nights .row.night:not(.kop)")){
    const wide=rij.querySelector(":scope > .nmeta.wide");
    if(!wide)continue;
    if(desktop){
      const onderdelen=[".nachtadvies",".nachtvenster",".nachtmaan"].map(selector=>wide.querySelector(selector));
      for(const el of onderdelen){if(el)rij.insertBefore(el,wide);}
    }else{
      for(const selector of [".nachtadvies",".nachtvenster",".nachtmaan"]){
        const el=rij.querySelector(":scope > "+selector);
        if(el)wide.appendChild(el);
      }
    }
  }
}
function plan(){
  if(gepland)return;
  gepland=true;
  queueMicrotask(function(){gepland=false;synchroniseerNachtkop();synchroniseerNachtrijen();});
}
function start(){
  synchroniseerNachtkop();
  synchroniseerNachtrijen();
  const nights=document.getElementById("nights");
  if(nights)new MutationObserver(plan).observe(nights,{childList:true,subtree:true});
  window.addEventListener("resize",plan,{passive:true});
}
window.WeatherNowDesktopVisualPolish20260909={sync:function(){synchroniseerNachtkop();synchroniseerNachtrijen();}};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
</script>`;

function htmlBestanden(dir){
  const uit=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())uit.push(...htmlBestanden(p));
    else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function pasTekstAan(html,label="artifact"){
  let bron=String(html||"");
  if(!bron.includes(BASIS_MARKER))return {html:bron,geraakt:false};
  const headEinde=bron.indexOf("</head>");
  if(headEinde<0)throw new Error(`${label}: </head> ontbreekt voor desktop-polish.`);
  if(bron.includes(MARKER)){
    const styleStart=bron.indexOf(MARKER),styleEnd=bron.indexOf("</style>",styleStart);
    if(styleEnd<0)throw new Error(`${label}: einde desktop-polishstijl ontbreekt.`);
    bron=bron.slice(0,styleStart)+STYLE.trimStart()+"\n"+bron.slice(styleEnd);
  }else{
    const stylePos=bron.lastIndexOf("</style>",headEinde);
    if(stylePos<0)throw new Error(`${label}: actief head-stijlblok ontbreekt.`);
    bron=bron.slice(0,stylePos)+STYLE+"\n"+bron.slice(stylePos);
  }
  if(bron.includes(`id="${RUNTIME_ID}"`)){
    const runtimeStart=bron.indexOf(`<script id="${RUNTIME_ID}">`),runtimeEnd=bron.indexOf("</script>",runtimeStart);
    if(runtimeEnd<0)throw new Error(`${label}: einde desktop-polishruntime ontbreekt.`);
    bron=bron.slice(0,runtimeStart)+RUNTIME+bron.slice(runtimeEnd+9);
  }else{
    const bodyEinde=bron.lastIndexOf("</body>");
    if(bodyEinde<0)throw new Error(`${label}: </body> ontbreekt voor desktop-polishruntime.`);
    bron=bron.slice(0,bodyEinde)+RUNTIME+"\n"+bron.slice(bodyEinde);
  }
  return {html:bron,geraakt:true};
}
function main(){
  let geraakt=0,geschreven=0;
  for(const p of htmlBestanden(OUT)){
    const voor=fs.readFileSync(p,"utf8"),r=pasTekstAan(voor,path.relative(OUT,p));
    if(!r.geraakt)continue;
    geraakt++;
    if(r.html!==voor){fs.writeFileSync(p,r.html,"utf8");geschreven++;}
  }
  if(!geraakt)throw new Error("Geen finale weerartifacts gevonden voor desktop-polish.");
  const cache=vernieuwServiceworkerCache(OUT,"desktop-visual-polish-20260909");
  console.log(`Desktop-polish toegepast op ${geraakt} weerartifacts (${geschreven} gewijzigd): compacte weekmetriekgroep, brede Nachtzicht-maanverdeling en één sectieritme; uurhoogte blijft eigendom van hour-panel-refinement; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,BASIS_MARKER,MARKER,RUNTIME_ID,STYLE,RUNTIME,htmlBestanden,pasTekstAan,main};

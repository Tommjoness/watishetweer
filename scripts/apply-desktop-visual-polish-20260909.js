"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const BASIS_MARKER="/* ===== HOUR PANEL CLEANUP 20260909 ===== */";
const MARKER="/* ===== DESKTOP VISUAL POLISH 20260909 ===== */";
const RUNTIME_ID="desktop-visual-polish-runtime-20260909";
const UREN_OUD="const MAX_DESKTOP_UREN=12;/* maximaal venster; de grafiekhoogte kiest 8–12 volledige rijen */";
const UREN_NIEUW="const MAX_DESKTOP_UREN=11;/* rustig desktopvenster: maximaal 11 uren; hoogtefilter synchroniseert de zichtbare reeks */";
const GRAFIEK_START_OUD='if(Number.isInteger(start)&&S.chartStart!==start){basisGrafiek(start,24);desktopGrafiek=true;}';
const GRAFIEK_START_NIEUW='if(Number.isInteger(start)&&(S.chartStart!==start||S.chartBereik!==MAX_DESKTOP_UREN)){basisGrafiek(start,MAX_DESKTOP_UREN);desktopGrafiek=true;}';
const GRAFIEK_SYNC_OUD='if(basisGrafiek&&S.geo&&typeof S.geo.x==="function"&&Number.isInteger(start)&&S.chartStart!==start){\n    basisGrafiek(start,24);desktopGrafiek=true;\n  }';
const GRAFIEK_SYNC_NIEUW='const grafiekUren=Math.max(1,Math.min(MAX_DESKTOP_UREN,rows.length));\n  if(basisGrafiek&&S.geo&&typeof S.geo.x==="function"&&Number.isInteger(start)&&rows.length&&(S.chartStart!==start||S.chartBereik!==grafiekUren)){\n    basisGrafiek(start,grafiekUren);desktopGrafiek=true;\n  }';

const STYLE=`
${MARKER}
/* Gerichte polish van uitsluitend de finale presentatielaag. Onder 1100px
   blijven de bestaande mobiele en tabletregels eigenaar van de layout. */
@media(min-width:1100px){
  :root{--wiw-section-gap:28px}

  /* Tot elf uren vullen dezelfde natuurlijke grafiekhoogte. De bestaande
     hoogte-owner blijft de rijpadding/resthoogte beheren; deze polish verhoogt
     alleen de primaire leesregel licht. */
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
     Nacht | Zichtscore | Bewolking | Beoordeling | Beste zichtperiode.
     Score en balk delen de scorekolom zonder overlap; maan-/zichtdetails vormen
     de tweede regel in de rechter kolom. Alle primaire waarden delen één baseline. */
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

  #nights .row.night.kop{
    grid-template-rows:auto!important;
    align-items:end!important
  }
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
}

/* Op de kleinste contractdesktop ontbreekt slechts enkele pixels voor elf
   comfortabele regels. Win die terug uit de vaste titel-/tabelkopchrome, niet
   uit de inhoudsregels en niet door de natuurlijke grafiekhoogte te vergroten. */
@media(min-width:1366px) and (max-width:1499px){
  #wiw-hour-panel h3{margin-bottom:2px!important}
  .wiw-hour-table th{padding:1px 4px!important}
}
@media(min-width:1500px){
  #wiw-hour-panel h3{margin-bottom:8px!important}
  .wiw-hour-table th{padding:4px 4px!important}
}

@media(max-width:1099px){
  /* De lege bestaande scorebalkkop behoudt zijn mobiele gridplaats; alleen het
     nieuwe desktoplabel verdwijnt. Daardoor schuift geen mobiele kolom op. */
  .wiw-night-assessment-head{display:none!important}
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
}
function synchroniseerNachtrijen(){
  const desktop=window.matchMedia("(min-width:1100px)").matches;
  for(const rij of document.querySelectorAll("#nights .row.night:not(.kop)")){
    const wide=rij.querySelector(":scope > .nmeta.wide");
    if(!wide)continue;
    if(desktop){
      const onderdelen=[".nachtadvies",".nachtvenster",".nachtmaan"].map(selector=>wide.querySelector(selector));
      for(const el of onderdelen){
        if(el)rij.insertBefore(el,wide);
      }
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

function tel(bron,zoek){return String(bron).split(zoek).length-1;}
function htmlBestanden(dir){
  const uit=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())uit.push(...htmlBestanden(p));
    else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function vervangEen(bron,oud,nieuw,label){
  const oudN=tel(bron,oud),nieuwN=tel(bron,nieuw);
  if(oudN===1&&nieuwN===0)return bron.replace(oud,nieuw);
  if(oudN===0&&nieuwN===1)return bron;
  throw new Error(`${label}: verwacht precies één oude of nieuwe variant; oud=${oudN}, nieuw=${nieuwN}.`);
}
function pasTekstAan(html,label="artifact"){
  let bron=String(html||"");
  if(!bron.includes(BASIS_MARKER))return {html:bron,geraakt:false};
  bron=vervangEen(bron,UREN_OUD,UREN_NIEUW,`${label} desktopuren`);
  bron=vervangEen(bron,GRAFIEK_START_OUD,GRAFIEK_START_NIEUW,`${label} eerste grafiekrange`);
  bron=vervangEen(bron,GRAFIEK_SYNC_OUD,GRAFIEK_SYNC_NIEUW,`${label} gesynchroniseerde grafiekrange`);
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
  console.log(`Desktop-polish toegepast op ${geraakt} weerartifacts (${geschreven} gewijzigd): maximaal 11 gedeelde uren, compactere weekmetriekgroep, vijf expliciete Nachtzicht-kolommen en één sectieritme; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={
  OUT,BASIS_MARKER,MARKER,RUNTIME_ID,STYLE,RUNTIME,
  UREN_OUD,UREN_NIEUW,GRAFIEK_START_OUD,GRAFIEK_START_NIEUW,GRAFIEK_SYNC_OUD,GRAFIEK_SYNC_NIEUW,
  tel,htmlBestanden,vervangEen,pasTekstAan,main
};
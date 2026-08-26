/* Laatste mobiele interactielaag voor de fysieke iPhone-bevindingen van 26 augustus.
   Geen weerdata of berekeningen worden gewijzigd: deze laag herstelt uitsluitend
   render-timing, modusduiding en compacte presentatie van bestaande informatie. */
(function(root){
"use strict";

function tekstVan(item){
  if(typeof item==="string")return item.trim();
  return String(item&&item.textContent||"").trim();
}
function grafiekHeeftUurlabels(items){
  return Array.from(items||[]).some(item=>{
    const tekst=tekstVan(item);
    if(!/^\d{2}$/.test(tekst))return false;
    if(typeof item==="string")return true;
    const familie=String(item&&item.getAttribute&&item.getAttribute("font-family")||"");
    return !familie||/DM Mono/i.test(familie);
  });
}
function grafiekHerstelNodig(mobiel,bereik,items){
  return !!mobiel&&Number(bereik)<=48&&!grafiekHeeftUurlabels(items);
}
function terugNaarBereikLabel(bereik){
  const n=Number(bereik);
  return n===48?"Komende 48 uur":n>48?"Komende zeven dagen":"Komende 24 uur";
}
function weekUitlegSamenvatting(tekst){
  const m=/^(\d+)%\s+kans/i.exec(String(tekst||"").trim());
  return m?"Waarom "+m[1]+"% kans en 0,0 mm?":"Waarom kans en 0,0 mm?";
}

const api={grafiekHeeftUurlabels,grafiekHerstelNodig,terugNaarBereikLabel,weekUitlegSamenvatting};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowMobileStateUX=api;

if(typeof document==="undefined"||typeof window==="undefined"||typeof S==="undefined")return;

const mobiel=()=>typeof window.matchMedia==="function"
  ?window.matchMedia("(max-width:900px)").matches
  :window.innerWidth<=900;

function chartUurTeksten(svg){
  return svg?[...svg.querySelectorAll("text")].filter(el=>/^\d{2}$/.test(tekstVan(el))):[];
}
function pasEtmaalContextToe(){
  const back=document.getElementById("back");
  if(back){
    const label=terugNaarBereikLabel(S.bereik);
    back.textContent=label;
    back.setAttribute("aria-label","Toon "+label.toLowerCase()+" vanaf nu");
  }
  const hint=document.getElementById("charthint");
  if(!hint)return;
  const huidige=tekstVan(hint);
  if(S.dag!=null){
    const detail=/Kans op neerslag:|verwachte hoeveelheid:/i.test(huidige)
      ?huidige.replace(/^Deze kalenderdag per uur\.\s*/i,"")
      :"Selecteer een punt in de grafiek voor details.";
    hint.textContent="Deze kalenderdag per uur. "+detail;
  }else{
    /* De resetknop benoemt hierboven al expliciet het rollende bereik. De hint
       blijft daarom invoermethode-neutraal en behoudt de bestaande Q4-copy. */
    hint.textContent="Selecteer een punt in de grafiek voor details.";
  }
}

/* De mobiele postbuild-collisionlaag gebruikt echte SVG-fontboxes. Op de eerste
   paginarender kan Safari die met fallback-fontmetrics meten, waarna uurlabels
   destructief worden verwijderd. Een latere dagselectie werkt wél omdat de fonts
   dan gereed zijn. Daarom controleren we na document.fonts.ready dezelfde render
   nog één keer en tekenen we alleen opnieuw als de uuras daadwerkelijk leeg is. */
const basisEtmaalMobieleState=typeof etmaal==="function"?etmaal:null;
let etmaalHerstelToken=0;
if(basisEtmaalMobieleState){
  etmaal=function(start,n){
    const token=++etmaalHerstelToken,dagBijRender=S.dag;
    basisEtmaalMobieleState(start,n);
    pasEtmaalContextToe();
    const svg=document.getElementById("chart");
    if(!svg||!grafiekHerstelNodig(mobiel(),n,chartUurTeksten(svg)))return;
    const gereed=document.fonts&&document.fonts.ready;
    if(!gereed)return;
    gereed.then(()=>{
      if(token!==etmaalHerstelToken||S.dag!==dagBijRender||S.chartStart!==start||S.chartBereik!==n)return;
      const huidig=document.getElementById("chart");
      if(!huidig||!grafiekHerstelNodig(mobiel(),n,chartUurTeksten(huidig)))return;
      basisEtmaalMobieleState(start,n);
      pasEtmaalContextToe();
    }).catch(()=>{});
  };
}

/* De vaste contextbalk blijft de bestaande, trillingsvrije fixed implementatie.
   Hij verdwijnt al bij neerwaarts scrollen; na opwaarts scrollen verdwijnt hij nu
   ook weer na korte rust, zodat hij niet blijvend over een sectiekop blijft liggen. */
(function installeerMinibarRust(){
  const bar=document.getElementById("minibar");if(!bar||!window.addEventListener)return;
  let timer=null;
  const plan=()=>{
    if(timer!==null)clearTimeout(timer);
    if(!mobiel())return;
    timer=setTimeout(()=>{
      timer=null;
      if(bar.classList.contains("aan"))bar.classList.add("senior-verstopt");
    },650);
  };
  window.addEventListener("scroll",plan,{passive:true});
  window.addEventListener("touchend",plan,{passive:true});
})();

function maakWeekUitlegCompact(){
  const uitleg=document.getElementById("dagenneerslaguitleg");if(!uitleg)return;
  const tekst=tekstVan(uitleg);if(!tekst)return;
  const wasOpen=uitleg.tagName==="DETAILS"&&uitleg.open;
  let details=uitleg;
  if(uitleg.tagName!=="DETAILS"){
    details=document.createElement("details");
    details.id="dagenneerslaguitleg";
    uitleg.replaceWith(details);
  }
  details.className="data-uitleg dagenneerslaguitleg-compact";
  const summary=document.createElement("summary");summary.textContent=weekUitlegSamenvatting(tekst);
  const p=document.createElement("p");p.textContent=tekst;
  details.replaceChildren(summary,p);
  details.open=wasOpen;
}

/* De finale neerslagowner maakt de uitleg pas tijdens dagen(). Deze laatste
   wrapper verandert alleen de presentatie naar een ingeklapte toelichting. */
const basisDagenMobieleState=typeof dagen==="function"?dagen:null;
if(basisDagenMobieleState){
  dagen=function(){basisDagenMobieleState();maakWeekUitlegCompact();};
}

function zetNachtMetaBreedte(details){
  if(!details)return;
  details.open=!mobiel();
}
function maakNachtMetaCompact(){
  document.querySelectorAll("#nights .row.night:not(.kop) .nmeta.wide").forEach(wide=>{
    const maan=wide.querySelector(":scope > .nachtmaan");
    if(!maan||wide.querySelector(":scope > .nacht-meta-details"))return;
    const details=document.createElement("details");details.className="nacht-meta-details";
    const summary=document.createElement("summary");summary.textContent="Zicht en maan";
    wide.insertBefore(details,maan);details.append(summary,maan);
    zetNachtMetaBreedte(details);
  });
}

/* Score, oordeel en reden blijven altijd zichtbaar. Alleen de secundaire zicht-
   en maangegevens zijn op telefoon inklapbaar; desktop houdt ze standaard open. */
const basisNachtenMobieleState=typeof nachten==="function"?nachten:null;
if(basisNachtenMobieleState){
  nachten=function(){basisNachtenMobieleState();maakNachtMetaCompact();};
}
if(typeof window.matchMedia==="function"){
  const mq=window.matchMedia("(max-width:900px)");
  const wissel=()=>document.querySelectorAll("#nights .nacht-meta-details").forEach(zetNachtMetaBreedte);
  if(typeof mq.addEventListener==="function")mq.addEventListener("change",wissel);
}

})(typeof globalThis!=="undefined"?globalThis:this);
/* Laatste mobiele interactielaag voor de fysieke iPhone-bevindingen van 26 augustus.
   Geen weerdata of berekeningen worden gewijzigd: deze laag herstelt uitsluitend
   render-timing, modusduiding en compacte presentatie van bestaande informatie. */
(function(root){
"use strict";

function tekstVan(item){
  if(typeof item==="string")return item.trim();
  return String(item&&item.textContent||"").trim();
}
function getal(v){
  return v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
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
function dagNeerslagNuance(kans,hoeveelheid,dagLabel,spoorMm){
  const k=getal(kans),mm=getal(hoeveelheid);
  if(k===null||k<=0||mm===null||mm<0)return null;
  const spoor=getal(spoorMm),spoorgrens=spoor===null?0.005:Math.max(0,spoor);
  const pct=Math.round(Math.max(0,Math.min(100,k)))+"%";
  const dag=String(dagLabel||"Deze dag").trim()||"Deze dag";
  if(mm===0)return {
    mmTekst:"0,0 mm",
    tekst:dag+" · "+pct+" kans met 0,0 mm. "+pct+" is de hoogste neerslagkans in één uur; de berekende dagsom is 0,0 mm en wordt op één decimaal weergegeven."
  };
  if(mm<=spoorgrens)return {
    mmTekst:"spoor",
    tekst:dag+" · "+pct+" is de hoogste neerslagkans in één uur; het model geeft alleen een spoorhoeveelheid aan."
  };
  if(mm<0.05)return {
    mmTekst:"<0,05 mm",
    tekst:dag+" · "+pct+" is de hoogste neerslagkans in één uur; de berekende dagsom is <0,05 mm."
  };
  return null;
}
function dagNeerslagTitel(kans,zichtbareTekst,dagLabel,isVandaag){
  const dag=String(dagLabel||"Deze dag").trim()||"Deze dag";
  if(isVandaag){
    /* De Vandaag-rij wordt door de weather-truth-owner bewust herschreven naar
       alleen de nog resterende lokale uren. Het raw daily-maximum kan ook een
       al verstreken uur bevatten en mag daarom niet in deze tooltip belanden. */
    const zichtbaar=/(\d{1,3})\s*%/.exec(String(zichtbareTekst||""));
    if(!zichtbaar)return "";
    const pct=Math.round(Math.max(0,Math.min(100,Number(zichtbaar[1]))));
    return pct+"% is de hoogste neerslagkans in één uur in de resterende uren van vandaag.";
  }
  const k=getal(kans);if(k===null)return "";
  return Math.round(Math.max(0,Math.min(100,k)))+"% is de hoogste neerslagkans in één uur op "+dag+".";
}

const api={grafiekHeeftUurlabels,grafiekHerstelNodig,terugNaarBereikLabel,dagNeerslagNuance,dagNeerslagTitel};
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

function dagLabelUitRij(rij,i,daily){
  const datum=daily&&Array.isArray(daily.time)?daily.time[i]:null;
  if(typeof weatherNowDagNaam==="function"&&datum)return weatherNowDagNaam(datum,false);
  const kort=rij&&rij.querySelector(".dkort"),lang=rij&&rij.querySelector(".dlang");
  return tekstVan(kort)||tekstVan(lang)||"Deze dag";
}
function centraleSpoorgrens(){
  const cfg=root.WeatherNowInterpretatie&&root.WeatherNowInterpretatie.INTERPRETATIE_CONFIG;
  const spoor=cfg&&getal(cfg.spoorMm);
  return spoor===null?0.005:Math.max(0,spoor);
}
function verbindWeekNeerslagAanRijen(){
  /* De oude uitleg stond los boven de hele weektabel. Dat suggereerde ten onrechte
     dat één percentage voor de hele week gold. Elke nuance wordt nu uitsluitend
     bij de dag geplaatst waarop precipitation_probability_max en precipitation_sum
     betrekking hebben. De kans is dus expliciet de hoogste uurkans van die dag. */
  document.querySelectorAll("#days .dag-neerslagnotitie").forEach(el=>el.remove());
  const losseUitleg=document.getElementById("dagenneerslaguitleg");
  if(losseUitleg)losseUitleg.remove();
  const daily=S.d&&S.d.daily;if(!daily)return;
  const kansen=daily.precipitation_probability_max,hoeveelheden=daily.precipitation_sum;
  const spoor=centraleSpoorgrens();
  document.querySelectorAll("#days .row.day:not(.kop)").forEach(rij=>{
    const i=Number(rij.dataset.i),actief=S.dag===i;
    rij.setAttribute("aria-pressed",actief?"true":"false");
    rij.classList.remove("heeft-neerslagnotitie");
    rij.removeAttribute("aria-describedby");
    if(!Number.isInteger(i)||i<0)return;
    const kans=getal(kansen&&kansen[i]),mm=getal(hoeveelheden&&hoeveelheden[i]);
    const dag=dagLabelUitRij(rij,i,daily),datum=Array.isArray(daily.time)?String(daily.time[i]||""):"";
    const vandaag=!!datum&&datum===String(S.d&&S.d.current&&S.d.current.time||"").slice(0,10);
    const nuance=dagNeerslagNuance(kans,mm,dag,spoor);
    const drain=rij.querySelector(".drain");
    if(drain){
      const titel=dagNeerslagTitel(kans,drain.textContent,dag,vandaag);
      if(titel)drain.title=titel;else drain.removeAttribute("title");
    }
    if(!nuance)return;
    const klein=drain&&drain.querySelector("small");
    if(klein)klein.textContent=nuance.mmTekst;
    const note=document.createElement("div");
    note.className="dag-neerslagnotitie";
    note.id="dag-neerslagnotitie-"+i;
    note.setAttribute("role","note");
    note.textContent=nuance.tekst;
    rij.classList.add("heeft-neerslagnotitie");
    rij.setAttribute("aria-describedby",note.id);
    rij.after(note);
  });
}

/* De finale neerslagowner maakt de weekrijen tijdens dagen(). Deze laatste
   wrapper verbindt kans/hoeveelheidsnuance met de juiste rij en verwijdert de
   vroegere globale uitleg. */
const basisDagenMobieleState=typeof dagen==="function"?dagen:null;
if(basisDagenMobieleState){
  dagen=function(){basisDagenMobieleState();verbindWeekNeerslagAanRijen();};
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

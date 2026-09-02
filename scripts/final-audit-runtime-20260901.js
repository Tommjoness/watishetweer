/* Finale gecombineerde audit-runtime 2026-09-01. */
(function(root){
"use strict";
const A=root.WeatherNowFinalAudit20260901;
if(!A||typeof document==="undefined")return;

function bouwTopGrid(){
  if(document.querySelector(".final-top-grid"))return;
  const brief=document.getElementById("brief"),warnings=document.getElementById("waarschuwingen"),dash=document.querySelector(".dashrow-hero"),hero=dash&&dash.querySelector(":scope > .hero"),stats=dash&&dash.querySelector(":scope > .stats");
  if(!brief||!warnings||!dash||!hero||!stats||!brief.parentNode)return;
  const grid=document.createElement("div"),left=document.createElement("div");
  grid.className="final-top-grid";left.className="final-top-left";
  brief.parentNode.insertBefore(grid,brief);
  left.appendChild(brief);left.appendChild(warnings);left.appendChild(hero);
  grid.appendChild(left);grid.appendChild(stats);
  if(dash.parentNode)dash.remove();
}

function regenSamenvattingBijwerken(){
  const svg=document.getElementById("chart"),g=typeof S!=="undefined"&&S.geo,h=typeof S!=="undefined"&&S.d&&S.d.hourly;
  if(!svg||!g||!h||!Array.isArray(g.TI))return;
  let el=document.getElementById("final-rain-summary");
  if(!el){el=document.createElement("p");el.id="final-rain-summary";el.className="final-rain-summary";svg.insertAdjacentElement("afterend",el);}
  const perioden=A.regenperiodenVoorGrafiek({
    grafiekTijden:g.TI,bronTijden:h.time,neerslag:h.precipitation,
    bronStart:Number.isInteger(S.chartStart)?S.chartStart:null,
    actueelBronIndex:Number.isInteger(S.i0)?S.i0:null,
    toonVerstreken:S.dag!=null,meetbaarMm:0.1
  });
  const tekst=A.regenSamenvatting(perioden,2);
  el.textContent=tekst;el.hidden=!tekst;
  if(tekst)el.setAttribute("role","note");else el.removeAttribute("role");
}

function gesprokenNeerslag(zichtbaar){
  const t=String(zichtbaar||"").replace(/\s+/g," ").trim(),delen=[];
  const kans=/(\d{1,3})\s*%/.exec(t);if(kans)delen.push(kans[1]+" procent");
  const mm=/([<>]?\s*\d+(?:[.,]\d+)?)\s*mm\b/i.exec(t);
  if(mm){let v=mm[1].replace(/\s+/g,"").replace("<","minder dan ").replace(">","meer dan ");delen.push(v+" millimeter");}
  return delen.join("; ");
}

/* De weektabel heeft historisch meerdere dagen()-wrappers. De finale globale
   correctheidslaag voegt bij een bekende kans zonder zichtbare hoeveelheid
   terecht "hoeveelheid onzeker" toe, maar een latere/directe dagen()-render kan
   de inhoud van .drain opnieuw opbouwen. Deze audit-runtime is de laatste
   dagen()-owner en borgt daarom dezelfde eindstate na iedere weekrender. Er
   verandert niets aan providerdata, kans, dagsom of drempels. */
function herstelWeekNeerslagEindstate(){
  document.querySelectorAll("#days .row.day:not(.kop)").forEach(rij=>{
    const vak=rij.querySelector(".drain");if(!vak)return;
    const match=/(\d{1,3})%/.exec(vak.textContent||""),kans=match?Number(match[1]):null;
    let hoeveelheid=vak.querySelector("small,.q1-dag-mm");
    if(kans!==null&&kans>0&&!hoeveelheid){
      hoeveelheid=document.createElement("small");
      hoeveelheid.className="wiw-dag-onzeker";
      hoeveelheid.textContent="hoeveelheid onzeker";
      vak.appendChild(hoeveelheid);
    }
    const delen=[];
    if(kans!==null)delen.push("Neerslagkans "+kans+" procent");
    if(hoeveelheid&&hoeveelheid.textContent.trim())delen.push(hoeveelheid.textContent.trim());
    if(!delen.length&&/^[-–—]$/.test(vak.textContent.trim()))delen.push("Neerslaggegevens niet beschikbaar");
    if(delen.length)vak.setAttribute("aria-label",delen.join("; "));
  });
}

function verduidelijkVandaag(){
  const hint=document.getElementById("dagenhint"),day=typeof S!=="undefined"&&S.d&&S.d.daily,current=typeof S!=="undefined"&&S.d&&S.d.current;
  if(hint&&!hint.dataset.finalTodayWindow){
    hint.textContent="Kies een dag om die verwachting in de grafiek te bekijken.";
    hint.dataset.finalTodayWindow="1";
  }
  if(!day||!current||!Array.isArray(day.time))return;
  const vandaag=String(current.time||"").slice(0,10),i=day.time.indexOf(vandaag);
  if(i<0)return;
  const rij=document.querySelector('#days .row.day[data-i="'+i+'"]'),drain=rij&&rij.querySelector(".drain");
  if(!rij||!drain)return;
  let zichtbaar=document.getElementById("final-today-window-note");
  if(!zichtbaar){
    zichtbaar=document.createElement("p");zichtbaar.id="final-today-window-note";zichtbaar.className="final-today-window-note";
    zichtbaar.textContent="Vandaag: neerslag geldt vanaf nu; minimum en maximum gelden voor de volledige dag.";
    if(hint&&hint.parentNode)hint.insertAdjacentElement("afterend",zichtbaar);else rij.insertAdjacentElement("afterend",zichtbaar);
  }
  let beschrijving=document.getElementById("final-today-row-description");
  if(!beschrijving){beschrijving=document.createElement("span");beschrijving.id="final-today-row-description";beschrijving.className="sr-only";rij.insertAdjacentElement("afterend",beschrijving);}
  const neerslag=gesprokenNeerslag(drain.textContent);
  beschrijving.textContent=(neerslag?"Neerslag vandaag vanaf nu: "+neerslag+". ":"")+"Minimum en maximum gelden voor de volledige kalenderdag.";
  const bestaand=String(rij.getAttribute("aria-describedby")||"").trim().split(/\s+/).filter(Boolean).filter(x=>x!==beschrijving.id);
  bestaand.push(beschrijving.id);rij.setAttribute("aria-describedby",bestaand.join(" "));
  /* Bewust géén aria-label op de rij: de bestaande rij-inhoud/naam blijft
     daardoor verwachting, wind, minimum, maximum, kans en hoeveelheid bevatten. */
  drain.title=zichtbaar.textContent;
}

function finaliseerWeekNaRender(){herstelWeekNeerslagEindstate();verduidelijkVandaag();}

function isNwsWaarschuwing(w){
  if(/^(US|PR|VI|GU|MP|AS)$/i.test(String(typeof S!=="undefined"&&S.land||"")))return true;
  return /\*\s*(?:WHAT|WHERE|WHEN|IMPACTS)\.\.\./i.test(String(w&&w.tekst||""));
}
function officiëleNwsUrl(waarde){
  try{const u=new URL(String(waarde||""));const h=u.hostname.toLowerCase();return u.protocol==="https:"&&(h==="weather.gov"||h.endsWith(".weather.gov"))?u.href:"";}catch(_){return "";}
}
function verrijkNwsWaarschuwingen(){
  if(typeof S==="undefined"||!Array.isArray(S.actieveWaarschuwingen))return;
  const cards=[...document.querySelectorAll("#waarschuwingen .waarsch")],items=S.actieveWaarschuwingen.slice(0,3);
  cards.forEach((card,i)=>{
    const w=items[i];if(!w||!isNwsWaarschuwing(w))return;
    const tekst=String(w.tekst||"").trim(),titel=String(w.titel||"").trim(),u=A.nwsUitleg(titel,tekst);
    const nlTitel=u.titel&&u.titel!==titel?u.titel:"Officiële weerwaarschuwing";
    const geldig=w.tot&&typeof waarschuwingGeldigTot==="function"?waarschuwingGeldigTot(w.tot):null;
    const niveau=card.getAttribute("data-ui-severity");card.replaceChildren();if(niveau)card.setAttribute("data-ui-severity",niveau);
    const h3=document.createElement("h3");h3.textContent=nlTitel;card.appendChild(h3);
    const meta=[];if(geldig)meta.push("Geldig tot "+geldig+".");if(w.landelijk)meta.push("Geldt voor een groter gebied, niet per se voor deze plaats.");
    if(meta.length){const p=document.createElement("p");p.className="waarsch-meta";p.textContent=meta.join(" ");card.appendChild(p);}
    const uitleg=document.createElement("p");uitleg.className="final-warning-explanation";
    const strong=document.createElement("strong");strong.textContent="Uitleg van watishetweer.nl: ";uitleg.appendChild(strong);uitleg.appendChild(document.createTextNode(u.uitleg));card.appendChild(uitleg);
    /* Behoud naast de finale class ook het al bestaande staff-auditcontract.
       Zo blijft officiële titel/bron via dezelfde semantische container vindbaar,
       terwijl de uitgebreide officiële NWS-tekst dezelfde details gebruikt. */
    const details=document.createElement("details");details.className="waarsch-details waarsch-officieel-details";
    const summary=document.createElement("summary");summary.textContent="Officiële tekst van de National Weather Service";details.appendChild(summary);
    const bron=document.createElement("p");bron.className="final-warning-official-meta";bron.appendChild(document.createTextNode("Officiële titel: "));
    const officiëleTitel=document.createElement("span");officiëleTitel.lang="en";officiëleTitel.textContent=titel||"Weather alert";bron.appendChild(officiëleTitel);bron.appendChild(document.createTextNode(" · Bron: National Weather Service"));details.appendChild(bron);
    const officieel=document.createElement("p");officieel.lang="en";officieel.className="final-warning-official-text";officieel.textContent=tekst||"Official warning text unavailable.";details.appendChild(officieel);card.appendChild(details);
    const url=officiëleNwsUrl(w.url);if(url){const link=document.createElement("a");link.className="final-warning-source";link.href=url;link.target="_blank";link.rel="noopener";link.textContent="Bekijk deze waarschuwing bij de officiële bron";card.appendChild(link);}
  });
}

let warningUiRun=0,warningUiTimer=null;
function wrapWaarschuwingen(){
  if(typeof waarschuwingen!=="function"||waarschuwingen.__finalAuditWrapped)return;
  const basis=waarschuwingen;
  const wrapped=async function(){
    const run=++warningUiRun;if(warningUiTimer!==null){clearTimeout(warningUiTimer);warningUiTimer=null;}
    let resultaat;
    try{
      resultaat=basis.apply(this,arguments);
      warningUiTimer=setTimeout(()=>{
        if(run!==warningUiRun)return;
        const root=document.getElementById("waarschuwingen");if(!root)return;
        const loading=root.querySelector('[data-ui-warning-loading="1"]')||[...root.children].find(el=>el.classList&&el.classList.contains("msg")&&/waarschuwingen controleren/i.test(el.textContent||""));
        if(loading&&/controleren/i.test(loading.textContent||""))loading.textContent="Officiële weerwaarschuwingen controleren; dit kan even duren.";
      },3000);
      return await resultaat;
    }finally{
      if(run===warningUiRun){if(warningUiTimer!==null)clearTimeout(warningUiTimer);warningUiTimer=null;verrijkNwsWaarschuwingen();}
    }
  };
  wrapped.__finalAuditWrapped=true;waarschuwingen=wrapped;
}

let drukResizeGebonden=false;
function bouwMeetgegevens(){
  const pres=document.getElementById("pres");if(!pres)return;
  let details=document.getElementById("wiw-more-measurements");
  if(!details){
    const stat=pres.closest(".stat"),diag=document.getElementById("wiw-pressure-diagnostic"),anker=document.querySelector(".final-top-grid")||document.querySelector(".dashrow-hero");if(!stat||!anker||!anker.parentNode)return;
    details=document.createElement("details");details.id="wiw-more-measurements";details.className="wiw-more-measurements";
    const summary=document.createElement("summary");summary.textContent="Meer meetgegevens";details.appendChild(summary);
    const body=document.createElement("div");body.className="wiw-more-measurements-body";body.appendChild(stat);details.appendChild(body);anker.insertAdjacentElement("afterend",details);
    if(diag&&diag.parentNode)diag.remove();
    const betekenis=document.createElement("p");betekenis.className="wiw-pressure-meaning";betekenis.textContent="Herleid tot zeeniveau zodat luchtdruk tussen locaties vergelijkbaar is.";stat.appendChild(betekenis);
    details.addEventListener("toggle",()=>{if(details.dataset.syncing!=="1")details.dataset.userChoice="1";});
  }
  const sync=()=>{if(details.dataset.userChoice==="1")return;details.dataset.syncing="1";details.open=window.innerWidth>=901;delete details.dataset.syncing;};sync();
  if(!drukResizeGebonden){drukResizeGebonden=true;window.addEventListener("resize",sync,{passive:true});}
}

function naRender(basis,fn){return function(){const r=basis.apply(this,arguments);fn();return r;};}

bouwTopGrid();bouwMeetgegevens();wrapWaarschuwingen();
if(typeof etmaal==="function")etmaal=naRender(etmaal,regenSamenvattingBijwerken);
if(typeof dagen==="function")dagen=naRender(dagen,finaliseerWeekNaRender);
if(typeof tekenAlles==="function")tekenAlles=naRender(tekenAlles,finaliseerWeekNaRender);
regenSamenvattingBijwerken();finaliseerWeekNaRender();verrijkNwsWaarschuwingen();
})(typeof globalThis!=="undefined"?globalThis:this);

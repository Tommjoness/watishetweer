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
  const zichtbaar=String(drain.textContent||"").replace(/\s+/g," ").trim();
  const uitleg="Vandaag: resterende neerslagkans vanaf nu"+(zichtbaar?" "+zichtbaar:"")+". Minimum en maximum zijn voor de volledige kalenderdag.";
  drain.title=uitleg;
  const bestaand=String(rij.getAttribute("aria-label")||"").trim();
  rij.setAttribute("aria-label",bestaand?bestaand+". "+uitleg:uitleg);
}

function verrijkNwsWaarschuwingen(){
  if(typeof S==="undefined"||!Array.isArray(S.actieveWaarschuwingen))return;
  const cards=[...document.querySelectorAll("#waarschuwingen .waarsch")],items=S.actieveWaarschuwingen.slice(0,3);
  cards.forEach((card,i)=>{
    const w=items[i];if(!w||card.querySelector(".final-warning-explanation"))return;
    const tekst=String(w.tekst||""),titel=String(w.titel||"");
    const nws=/^(US|PR|VI|GU|MP|AS)$/i.test(String(S.land||""))||/\*\s*(?:WHAT|WHERE|WHEN|IMPACTS)\.\.\./i.test(tekst);
    if(!nws)return;
    const u=A.nwsUitleg(titel,tekst),p=document.createElement("p");
    p.className="final-warning-explanation";
    const strong=document.createElement("strong");strong.textContent="Uitleg van watishetweer.nl: ";p.appendChild(strong);p.appendChild(document.createTextNode(u.uitleg));
    const details=card.querySelector(".waarsch-details");
    if(details){const summary=details.querySelector("summary");if(summary)summary.textContent="Officiële tekst van de National Weather Service";card.insertBefore(p,details);}
    else card.appendChild(p);
    const url=String(w.url||"").trim();
    if(/^https:\/\//i.test(url)){
      const link=document.createElement("a");link.className="final-warning-source";link.href=url;link.target="_blank";link.rel="noopener";link.textContent="Bekijk deze waarschuwing bij de officiële bron";card.appendChild(link);
    }
  });
}

function wrapWaarschuwingen(){
  if(typeof waarschuwingen!=="function"||waarschuwingen.__finalAuditWrapped)return;
  const basis=waarschuwingen;
  const wrapped=async function(){
    const timer=setTimeout(()=>{
      const loading=document.querySelector('#waarschuwingen [data-ui-warning-loading="1"]');
      if(loading)loading.textContent="Officiële waarschuwingen controleren; dit kan even duren.";
    },3000);
    try{return await basis.apply(this,arguments);}
    finally{clearTimeout(timer);verrijkNwsWaarschuwingen();}
  };
  wrapped.__finalAuditWrapped=true;waarschuwingen=wrapped;
}

function naRender(basis,fn){return function(){const r=basis.apply(this,arguments);fn();return r;};}

bouwTopGrid();wrapWaarschuwingen();
if(typeof etmaal==="function")etmaal=naRender(etmaal,regenSamenvattingBijwerken);
if(typeof dagen==="function")dagen=naRender(dagen,verduidelijkVandaag);
regenSamenvattingBijwerken();verduidelijkVandaag();verrijkNwsWaarschuwingen();
})(typeof globalThis!=="undefined"?globalThis:this);

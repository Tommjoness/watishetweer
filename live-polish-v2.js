/* Tweede gerichte live-polishlaag: kleine browsercorrecties die niet in de
   weerinterpretatie thuishoren. Pure helpers blijven los testbaar in Node. */
(function(root){
"use strict";

const eindig=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;

function klokTekstMetSeconden(delen){
  const p=delen||{};
  if(![p.hour,p.minute,p.second].every(Number.isFinite)) return "--:--:--";
  return String(p.hour).padStart(2,"0")+":"+String(p.minute).padStart(2,"0")+":"+String(p.second).padStart(2,"0");
}

function tooltipWaardeKort(waarde){
  const t=String(waarde==null?"":waarde).trim();
  return /^geen neerslag verwacht\.?$/i.test(t)?"droog":t;
}

function temperatuurLabelsBotsen(a,b,maxDx){
  if(!a||!b||String(a.text)!==String(b.text)) return false;
  const ax=eindig(a.x),ay=eindig(a.y),bx=eindig(b.x),by=eindig(b.y),lim=eindig(maxDx);
  if([ax,ay,bx,by,lim].some(v=>v===null)) return false;
  return Math.abs(ax-bx)<=lim&&Math.abs(ay-by)<=34;
}

const api={klokTekstMetSeconden,tooltipWaardeKort,temperatuurLabelsBotsen};
if(typeof module!=="undefined"&&module.exports) module.exports=api;
root.WeatherNowPolishV2=api;

if(typeof document==="undefined"||typeof S==="undefined") return;

/* De klok is puur presentatie. Elke seconde worden alleen de twee klokteksten
   bijgewerkt. De bestaande dagwisselcontrole blijft via klokBijwerken() actief;
   weerdata of grafieken worden dus niet iedere seconde opnieuw opgehaald/getekend. */
const basisKlokBijwerken=klokBijwerken;
const basisClearKlokTimer=clearKlokTimer;
let liveKlokTimer=null,liveKlokUitlijnTimer=null;
function liveKlokTik(){
  basisKlokBijwerken();
  const tijd=klokTekstMetSeconden(plaatsTijdDelen());
  const pt=document.getElementById("plaatstijd");if(pt)pt.textContent=tijd;
  const mt=document.getElementById("minitijd");if(mt)mt.textContent=tijd;
}
clearKlokTimer=function(){
  basisClearKlokTimer();
  if(liveKlokUitlijnTimer!==null){clearTimeout(liveKlokUitlijnTimer);liveKlokUitlijnTimer=null;}
  if(liveKlokTimer!==null){clearInterval(liveKlokTimer);liveKlokTimer=null;}
};
klokTimerStart=function(){
  clearKlokTimer();
  liveKlokTik();
  const wacht=1000-(Date.now()%1000);
  liveKlokUitlijnTimer=setTimeout(()=>{
    liveKlokTik();
    liveKlokTimer=setInterval(liveKlokTik,1000);
  },wacht);
};

/* In de SVG-tooltip staan label en waarde als twee losse tekstnodes. De lange
   waarde "geen neerslag verwacht" paste op desktop tegen het label "neerslag"
   aan. "droog" zegt daar exact hetzelfde, maar leest in één oogopslag. */
const basisScrubKoppel=scrubKoppel;
scrubKoppel=function(){
  basisScrubKoppel();
  const hit=document.getElementById("hit");
  if(!hit) return;
  const maakKort=()=>{
    const g=document.getElementById("scrub");if(!g)return;
    [...g.querySelectorAll("text")].forEach(el=>{
      const kort=tooltipWaardeKort(el.textContent);
      if(kort!==el.textContent.trim()) el.textContent=kort;
    });
  };
  hit.addEventListener("pointermove",maakKort);
  hit.addEventListener("pointerdown",maakKort);
};

/* Twee opeenvolgende uren met dezelfde afgeronde temperatuur kunnen beide als
   relevant label uit de bestaande grafiek komen. De lijn en punten blijven
   onaangetast; alleen een visueel dubbel label vlak naast zijn tweeling vervalt. */
function ontdubbelTemperatuurlabels(svg){
  if(!svg) return;
  const cw=S.geo&&Number.isFinite(S.geo.cw)?S.geo.cw:36;
  const maxDx=Math.max(38,cw*1.3),gehouden=[];
  const labels=[...svg.querySelectorAll("text")].filter(el=>{
    const ff=String(el.getAttribute("font-family")||"");
    return ff.includes("Bodoni Moda")&&/^-?\d+°$/.test(String(el.textContent||"").trim());
  }).map(el=>({el,text:el.textContent.trim(),x:eindig(el.getAttribute("x")),y:eindig(el.getAttribute("y"))}))
    .filter(x=>x.x!==null&&x.y!==null).sort((a,b)=>a.x-b.x);
  for(const lab of labels){
    if(gehouden.some(v=>temperatuurLabelsBotsen(v,lab,maxDx))) lab.el.remove();
    else gehouden.push(lab);
  }
}

const basisEtmaalPolishV2=etmaal;
etmaal=function(start,n){
  basisEtmaalPolishV2(start,n);
  ontdubbelTemperatuurlabels(document.getElementById("chart"));
};

})(typeof globalThis!=="undefined"?globalThis:this);

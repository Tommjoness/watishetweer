/* Mobiele waarheid + informatiehierarchie 2026-08-28.
   Deze laag verandert geen providerdata. Hij corrigeert uitsluitend het nog
   geldige deel van een lopend modeluur in de regenperiodepresentatie en maakt
   de bestaande mobiele informatie sneller leesbaar. */
(function(root){
"use strict";

const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const begrens=(v,a,b)=>Math.max(a,Math.min(b,v));
const DAGEN_KORT=["zo","ma","di","wo","do","vr","za"];

function lokaleSerieleMinuten(tijd){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(tijd||""));
  if(!m)return null;
  return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])/60000;
}
function corrigeerLopendModeluur(waarde,eindTijd,nuTijd){
  const mm=getal(waarde),eind=lokaleSerieleMinuten(eindTijd),nu=lokaleSerieleMinuten(nuTijd);
  if(mm===null||mm<0||eind===null||nu===null)return mm;
  const begin=eind-60;
  if(eind<=nu)return null;
  if(nu<=begin)return mm;
  return mm*begrens((eind-nu)/60,0,1);
}
function regenperiodenGecorrigeerd(mm,tijden,nuTijd,drempel=0.1){
  const waarden=Array.from(mm||[]),T=Array.from(tijden||[]),grens=Math.max(0,getal(drempel)??0.1),perioden=[];
  const nu=lokaleSerieleMinuten(nuTijd);
  let lopend=null;
  for(let i=1;i<waarden.length&&i<T.length;i++){
    const ruw=getal(waarden[i]),eind=lokaleSerieleMinuten(T[i]),begin=eind===null?null:eind-60;
    const waarde=ruw===null?null:corrigeerLopendModeluur(ruw,T[i],nuTijd);
    const actief=waarde!==null&&eind!==null&&nu!==null&&begin<nu&&nu<eind;
    if(waarde!==null&&waarde>=grens){
      if(!lopend)lopend={van:i-1,tot:i,som:0,actiefStart:actief};
      lopend.tot=i;lopend.som+=waarde;
    }else if(lopend){perioden.push(lopend);lopend=null;}
  }
  if(lopend)perioden.push(lopend);
  return perioden;
}
function mmTekst(v){
  const n=getal(v);if(n===null||n<0)return "–";
  if(n>0&&n<0.1)return "<0,1";
  return n.toFixed(1).replace(".",",");
}
function dagKortUitIso(tijd){
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(tijd||""));if(!m)return null;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],12));
  return DAGEN_KORT[d.getUTCDay()]||null;
}
function nachtPaarLabel(daily,index){
  const i=Math.max(0,Math.floor(Number(index)||0)),ss=daily&&daily.sunset&&daily.sunset[i],sr=daily&&daily.sunrise&&daily.sunrise[i+1];
  const a=dagKortUitIso(ss),b=dagKortUitIso(sr);return a&&b?a+"–"+b:null;
}

const api={lokaleSerieleMinuten,corrigeerLopendModeluur,regenperiodenGecorrigeerd,mmTekst,nachtPaarLabel};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowMobileTruthUX20260828=api;

if(typeof document==="undefined"||typeof window==="undefined"||typeof S==="undefined")return;
const mobiel=()=>typeof window.matchMedia==="function"?window.matchMedia("(max-width:900px)").matches:window.innerWidth<=900;

/* De grote uurtegel bevat twee verschillende grootheden. Op touchscreens bestaat
   geen hover om die betekenis te ontdekken, dus staat er een korte zichtbare
   sleutel direct onder de waarde. */
function neerslagUurBetekenis(){
  const waarde=document.getElementById("pop"),stat=waarde&&waarde.closest(".stat");if(!waarde||!stat)return;
  const kop=stat.querySelector(".eyebrow");if(kop)kop.textContent="Neerslag komend uur";
  let sleutel=stat.querySelector(".mobile-neerslag-sleutel");
  if(!sleutel){sleutel=document.createElement("div");sleutel.className="mobile-neerslag-sleutel";waarde.insertAdjacentElement("afterend",sleutel);}
  sleutel.textContent="kans · verwachte hoeveelheid";
  const tekst=(waarde.textContent||"").trim();
  if(tekst&&tekst!=="--"&&tekst!=="–")waarde.setAttribute("aria-label","Komend uur: "+tekst+". Eerst de neerslagkans, daarna de verwachte hoeveelheid.");
}

/* Vier secundaire verklaringszinnen blijven beschikbaar, maar nemen niet langer
   permanent twee volledige mobiele rijen in. De waarden zelf blijven altijd in
   het raster staan. */
const SECUNDAIR=[
  ["humsub","Luchtvochtigheid"],["pressub","Luchtdruk"],["cloudsub","Bewolking"],["vissub","Zicht"]
];
function meetdetailUitleg(){
  const stats=document.querySelector(".dashrow-hero .stats");if(!stats)return;
  let details=document.getElementById("mobile-meetdetails");
  if(!details){
    details=document.createElement("details");details.id="mobile-meetdetails";details.className="mobile-meetdetails";
    const summary=document.createElement("summary");summary.textContent="Uitleg meetwaarden";
    const body=document.createElement("div");body.className="mobile-meetdetails-body";details.append(summary,body);
    stats.insertAdjacentElement("afterend",details);
  }
  const body=details.querySelector(".mobile-meetdetails-body");if(!body)return;
  body.replaceChildren();
  SECUNDAIR.forEach(([id,label])=>{
    const sub=document.getElementById(id),stat=sub&&sub.closest(".stat");if(!sub||!stat)return;
    stat.classList.add("mobile-secundaire-stat");
    const p=document.createElement("p"),sterk=document.createElement("strong");sterk.textContent=label+": ";p.append(sterk,document.createTextNode((sub.textContent||"").trim()));body.appendChild(p);
  });
}

/* Rond middernacht bestaat de actieve rest van de lopende nacht naast de
   volgende volledige nacht. Als beide door een oudere presentatielaag dezelfde
   naam 'vannacht' krijgen, maken we het onderscheid expliciet. */
function herstelNachtlabels(){
  const rijen=[...document.querySelectorAll("#nights .row.night:not(.kop)")];if(rijen.length<2)return;
  const labels=rijen.map(r=>r.querySelector(".dname"));
  for(let i=1;i<labels.length;i++){
    const a=labels[i-1],b=labels[i];if(!a||!b)continue;
    if((a.textContent||"").trim().toLowerCase()!==(b.textContent||"").trim().toLowerCase())continue;
    if(i===1){
      a.textContent="nu";
      const op=S.d&&S.d.daily&&S.d.daily.sunrise&&S.d.daily.sunrise[0];
      if(op)a.title="Actieve nacht tot zonsopkomst "+String(op).slice(11,16);
    }
    const paar=nachtPaarLabel(S.d&&S.d.daily||{},Math.max(0,i-1));
    b.textContent=paar||"volgende nacht";
    b.title="Volgende volledige nacht";
  }
}

/* Q4 tekent hourly precipitation als intervalhoeveelheid. Een interval dat om
   01:00 eindigt is om 00:23 nog maar voor 37/60 deel toekomst. De centrale
   daganalyse weegt die overlap al proportioneel; deze laatste presentatielaag
   doet hetzelfde voor de regenbrackets en hun tooltip-array. */
function corrigeerRegenperiodenInGrafiek(){
  if(S.dag!=null)return;
  const svg=document.getElementById("chart"),g=S.geo,groep=svg&&svg.querySelector('g[data-q4-rain-periods]');
  if(!svg||!g||!groep||!Array.isArray(g.TI)||!Array.isArray(g.MM))return;
  const nu=typeof weatherNowActueleLokaleTijd==="function"?weatherNowActueleLokaleTijd():(S.d&&S.d.current&&S.d.current.time)||"";
  const perioden=regenperiodenGecorrigeerd(g.MM,g.TI,nu,0.1);
  const bedragen=[...groep.querySelectorAll("[data-q4-rain-period-amount]")];
  const lijnen=[...groep.querySelectorAll("line[aria-label]")];
  if(perioden.length!==bedragen.length||perioden.length!==lijnen.length)return;

  /* Werk ook de door de bestaande tooltip gebruikte compatibiliteitsarray bij.
     Alleen het ene gedeeltelijk verstreken uur kan veranderen. */
  for(let i=1;i<g.MM.length&&i<g.TI.length;i++){
    const ruw=getal(g.MM[i]);if(ruw===null)continue;
    const gecorrigeerd=corrigeerLopendModeluur(ruw,g.TI[i],nu);
    if(gecorrigeerd!==null&&Math.abs(gecorrigeerd-ruw)>1e-9){g.MM[i]=gecorrigeerd;if(Array.isArray(g.Q1MM))g.Q1MM[i]=gecorrigeerd;break;}
  }

  perioden.forEach((p,index)=>{
    const bedrag=mmTekst(p.som);bedragen[index].textContent=bedrag+" mm";
    const einde=String(g.TI[p.tot]||"").slice(11,16),begin=String(g.TI[p.van]||"").slice(11,16);
    const tijdvak=p.actiefStart?"nu–"+einde:begin+"–"+einde;
    lijnen[index].setAttribute("aria-label",tijdvak+" · "+bedrag+" mm");
    if(p.actiefStart){
      const start=groep.querySelector('[data-q4-rain-period-start="'+index+'"]');if(start)start.textContent="nu";
      const range=groep.querySelector('[data-q4-rain-period-range="'+index+'"]');if(range)range.textContent="nu–"+einde;
    }
  });
}

function grafiekHint(){
  if(!mobiel()||S.dag!=null)return;
  const hint=document.getElementById("charthint");
  if(hint)hint.textContent="Temperatuur boven, neerslagperioden onder. Selecteer een punt voor details.";
}
function botsen(a,b,marge){
  return a.x-marge<b.x+b.width&&a.x+a.width+marge>b.x&&a.y-marge<b.y+b.height&&a.y+a.height+marge>b.y;
}
function ruimNuLabelOp(){
  if(!mobiel())return;
  const svg=document.getElementById("chart");if(!svg||typeof svg.querySelectorAll!=="function")return;
  const teksten=[...svg.querySelectorAll("text")];
  const nu=teksten.find(el=>/^nu\s+-?\d+°/i.test((el.textContent||"").trim()));if(!nu||typeof nu.getBBox!=="function")return;
  let nb;try{nb=nu.getBBox();}catch(_){return;}
  teksten.filter(el=>/^-?\d+°$/.test((el.textContent||"").trim())&&typeof el.getBBox==="function").forEach(el=>{
    let b;try{b=el.getBBox();}catch(_){return;}
    if(botsen(nb,b,10)){el.style.visibility="hidden";el.dataset.mobileNuCollision="1";}
  });
}
let grafiekToken=0;
function planGrafiekPolish(){
  const token=++grafiekToken;
  const doe=()=>{if(token===grafiekToken){corrigeerRegenperiodenInGrafiek();grafiekHint();ruimNuLabelOp();}};
  if(typeof requestAnimationFrame==="function")requestAnimationFrame(doe);else setTimeout(doe,0);
  const fonts=document.fonts&&document.fonts.ready;if(fonts)fonts.then(doe).catch(()=>{});
}

/* Mobiel: actuele kern -> twee-uursneerslag -> zeven dagen -> verdiepende 24-uursgrafiek.
   Desktop houdt exact de bestaande dashboardvolgorde. De echte nodes worden
   verplaatst, niet gekloond, zodat state, events en toegankelijkheidsrelaties één
   eigenaar houden. */
function installeerMobieleVolgorde(){
  const app=document.getElementById("app"),hero=app&&app.querySelector(".dashrow-hero"),chart=app&&app.querySelector(".dashrow-chart"),days=document.getElementById("days");
  const dagenKolom=days&&days.closest(".dashcol"),dagenRij=dagenKolom&&dagenKolom.parentElement;
  const regenKop=app&&[...app.querySelectorAll("h2")].find(h=>/^Neerslag komende twee uur$/i.test((h.textContent||"").trim()));
  const regenHint=document.getElementById("nchint"),regenTekst=document.getElementById("nctext"),regenSvg=document.getElementById("nc");
  const regenUitleg=regenHint&&regenHint.nextElementSibling&&regenHint.nextElementSibling.matches("details.data-uitleg")?regenHint.nextElementSibling:null;
  if(!app||!hero||!chart||!dagenKolom||!dagenRij||!regenKop||!regenHint||!regenTekst||!regenSvg)return;
  const regenNodes=[regenKop,regenHint,regenUitleg,regenTekst,regenSvg].filter(Boolean);
  const regenSlot=document.createComment("mobile-rain-return"),dagenSlot=document.createComment("mobile-days-return");
  regenKop.parentNode.insertBefore(regenSlot,regenKop);dagenRij.insertBefore(dagenSlot,dagenKolom);
  const blok=document.createElement("section");blok.className="mobile-priority-rain";blok.setAttribute("aria-label","Neerslag komende twee uur");
  dagenKolom.classList.add("mobile-priority-week");
  const pasToe=()=>{
    if(mobiel()){
      if(!blok.isConnected)hero.insertAdjacentElement("afterend",blok);
      regenNodes.forEach(n=>blok.appendChild(n));
      blok.insertAdjacentElement("afterend",dagenKolom);
    }else{
      let cursor=regenSlot;regenNodes.forEach(n=>{cursor.after(n);cursor=n;});
      dagenSlot.after(dagenKolom);if(blok.isConnected)blok.remove();
    }
  };
  pasToe();
  if(typeof window.matchMedia==="function"){
    const mq=window.matchMedia("(max-width:900px)");
    if(typeof mq.addEventListener==="function")mq.addEventListener("change",pasToe);else if(typeof mq.addListener==="function")mq.addListener(pasToe);
  }else window.addEventListener("resize",pasToe,{passive:true});
}

if(typeof meters==="function"){
  const basisMeters=meters;meters=function(){const r=basisMeters.apply(this,arguments);neerslagUurBetekenis();meetdetailUitleg();return r;};
}
if(typeof nachten==="function"){
  const basisNachten=nachten;nachten=function(){const r=basisNachten.apply(this,arguments);herstelNachtlabels();return r;};
}
if(typeof etmaal==="function"){
  const basisEtmaal=etmaal;etmaal=function(){const r=basisEtmaal.apply(this,arguments);planGrafiekPolish();return r;};
}
installeerMobieleVolgorde();
neerslagUurBetekenis();meetdetailUitleg();

})(typeof globalThis!=="undefined"?globalThis:this);

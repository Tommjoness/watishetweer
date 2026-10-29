/* Tweede gerichte live-polishlaag: kleine browsercorrecties die niet in de
   weerinterpretatie thuishoren. Pure helpers blijven los testbaar in Node. */
(function(root){
"use strict";

const eindig=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;

function tooltipWaardeKort(waarde){
  const t=String(waarde==null?"":waarde).trim();
  if(/^geen neerslag verwacht\.?$/i.test(t)) return "droog";
  /* Het tijdstip staat al in de kop van de tooltip. De linker kolom houdt
     daarom één stabiel label; alleen het percentage rechts verandert. */
  if(/^kans(?:\s+\d{2}:00[–-]\d{2}:00|\s+\d{2}–\d{2}u)?$/i.test(t)) return "neerslagkans";
  return t;
}

function temperatuurLabelsBotsen(a,b,maxDx){
  if(!a||!b||String(a.text)!==String(b.text)) return false;
  const ax=eindig(a.x),ay=eindig(a.y),bx=eindig(b.x),by=eindig(b.y),lim=eindig(maxDx);
  if([ax,ay,bx,by,lim].some(v=>v===null)) return false;
  return Math.abs(ax-bx)<=lim&&Math.abs(ay-by)<=34;
}

/* Een temperatuurcijfer kan door botsingspolish horizontaal verschoven zijn.
   Om bij het verwijderen toch precies het bijbehorende zwarte datapunt mee weg
   te halen, zoeken we alleen tussen punten met dezelfde afgeronde temperatuur
   en kiezen we daarvan het dichtstbijzijnde x-punt binnen een veilige marge. */
function temperatuurPuntIndex(label,punten,temperaturen,maxDx){
  if(!label||!Array.isArray(punten)||!Array.isArray(temperaturen)) return null;
  const m=/^(-?\d+)°$/.exec(String(label.text||"").trim());
  const lx=eindig(label.x),lim=eindig(maxDx);
  if(!m||lx===null||lim===null||lim<0) return null;
  const doel=Number(m[1]);
  let beste=null,besteAfstand=Infinity;
  for(const punt of punten){
    const i=Number(punt&&punt.i),x=eindig(punt&&punt.x),t=Number.isInteger(i)?eindig(temperaturen[i]):null;
    if(!Number.isInteger(i)||x===null||t===null||Math.round(t)!==doel) continue;
    const afstand=Math.abs(x-lx);
    if(afstand<besteAfstand){beste=i;besteAfstand=afstand;}
  }
  return beste!==null&&besteAfstand<=lim?beste:null;
}

/* Het rode nu-label hoort visueel bij de rode stip, niet bij de zwarte
   temperatuurcijfers van de modelcurve. Normaal staat het daarom duidelijk
   onder de stip. Alleen dicht bij de onderrand wijkt het naar boven uit. */
function nuLabelPositie(puntY,plotTop,plotBottom,mobiel){
  const py=eindig(puntY),top=eindig(plotTop),bottom=eindig(plotBottom);
  if([py,top,bottom].some(v=>v===null)||bottom<=top) return null;
  const onderAfstand=mobiel?21:30,bovenAfstand=mobiel?18:24,marge=mobiel?8:10;
  const onder=py+onderAfstand;
  if(onder<=bottom-marge) return {y:onder,onder:true};
  return {y:Math.max(top+marge+3,py-bovenAfstand),onder:false};
}

/* Rond de rode actuele meting is één duidelijke bron van waarheid gewenst.
   Een zwart modeluurlabel dat binnen deze compacte zone valt, concurreert met
   de actuele temperatuur en wordt daarom niet getoond. De zone schaalt mee met
   de uurafstand van de grafiek, maar heeft ook een minimum voor smalle plots. */
function nuLabelConcurreert(punt,label,cw,mobiel){
  const px=eindig(punt&&punt.x),py=eindig(punt&&punt.y),lx=eindig(label&&label.x),ly=eindig(label&&label.y);
  if([px,py,lx,ly].some(v=>v===null)) return false;
  const stap=Math.max(0,eindig(cw)||0);
  const dx=Math.max(mobiel?52:60,stap*1.55);
  const dy=mobiel?46:50;
  return Math.abs(lx-px)<=dx&&Math.abs(ly-py)<=dy;
}

/* In de 24-uursweergave is de regelmatige temperatuurcontext belangrijker dan
   het wegpoetsen van twee gelijke afgeronde waarden. De basisrenderer heeft al
   botsingsdetectie en verschuiflagen; deze late polish mag die referenties dus
   alleen op langere, veel dichtere horizons ontdubbelen. */
function temperatuurOntdubbelToegestaan(bereik){
  const n=eindig(bereik);
  return n===null||n>24;
}

/* Relatieve vochtigheid alleen zegt weinig over hoe de lucht aanvoelt. Het
   dauwpunt combineert de actuele temperatuur en RH tot één bruikbare maat voor
   de hoeveelheid waterdamp. Magnus is hier alleen presentatie-afleiding: de
   ruwe Open-Meteo-waarden blijven zichtbaar en worden nergens gemuteerd. */
function dauwpuntCelsius(temperatuur,relatieveVochtigheid){
  const t=eindig(temperatuur),rh=eindig(relatieveVochtigheid);
  if(t===null||rh===null||rh<=0||rh>100||t<-80||t>60)return null;
  const a=17.62,b=243.12,g=Math.log(rh/100)+(a*t)/(b+t),d=b*g/(a-g);
  return Number.isFinite(d)?d:null;
}
function luchtvochtigheidDuiding(temperatuur,relatieveVochtigheid){
  const rh=eindig(relatieveVochtigheid);
  if(rh===null||rh<0||rh>100)return "Luchtvochtigheid niet beschikbaar.";
  const dp=dauwpuntCelsius(temperatuur,rh);
  if(dp===null){
    return rh<35?"Lage relatieve luchtvochtigheid."
      :rh<=65?"Gemiddelde relatieve luchtvochtigheid."
      :rh<=80?"Hoge relatieve luchtvochtigheid."
      :"Zeer hoge relatieve luchtvochtigheid.";
  }
  const d=Math.round(dp),basis="Dauwpunt circa "+d+"\u00a0°C · ";
  if(dp<10)return basis+"voelt doorgaans niet klam.";
  if(dp<15)return basis+"meestal aangenaam.";
  if(dp<18)return basis+"kan wat klam aanvoelen.";
  if(dp<21)return basis+"voelt klam aan.";
  return basis+"voelt zeer klam aan.";
}

function temperatuurProminentie(temperaturen,index){
  const T=Array.isArray(temperaturen)?temperaturen:[],i=Number(index),v=Number.isInteger(i)?eindig(T[i]):null;
  if(v===null)return -Infinity;
  const l=i>0?eindig(T[i-1]):null,r=i+1<T.length?eindig(T[i+1]):null;
  let p=0;
  if(l!==null&&r!==null)p=Math.min(Math.abs(v-l),Math.abs(v-r));
  else if(l!==null)p=Math.abs(v-l);else if(r!==null)p=Math.abs(v-r);
  const geldig=T.map(eindig).filter(x=>x!==null);
  if(geldig.length&&(v===Math.max(...geldig)||v===Math.min(...geldig)))p+=100;
  return p;
}

/* Dagcontext bij een punt in de grafiek. Na middernacht staat in de grafiek en in de gesproken waarde alleen "00:00", zonder dat
   duidelijk is dat dit morgen is. Leeg voor vandaag, "morgen " of "gisteren " voor de dag ernaast en daarna de korte dagnaam
   ("wo "). Beide tijden zijn lokale tijden van de plaats ("YYYY-MM-DDTHH:MM"); zonder tweede tijd geen voorvoegsel. */
const DAGEN_KORT=["zo","ma","di","wo","do","vr","za"];
function grafiekDagVoorvoegsel(lokaleTijd,nuLokaleTijd){
  const dag=t=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(t||""));return m?Date.UTC(+m[1],+m[2]-1,+m[3]):null;};
  const a=dag(lokaleTijd),b=dag(nuLokaleTijd);
  if(a===null||b===null)return "";
  const verschil=Math.round((a-b)/86400000);
  if(verschil===0)return "";
  if(verschil===1)return "morgen ";
  if(verschil===-1)return "gisteren ";
  return DAGEN_KORT[new Date(a).getUTCDay()]+" ";
}

function grafiekPuntBeschrijving(geo,index,nuLokaleTijd){
  const G=geo&&typeof geo==="object"?geo:null,i=Number(index);
  if(!G||!Number.isInteger(i)||i<0||i>=Number(G.n)||!Array.isArray(G.TI)||!G.TI[i])return "";
  /* G.TI staat op de Open-Meteo-as: voorlezen in de echte lokale tijd. */
  const lokaal=typeof globalThis.weatherNowLokaleTijd==="function"?globalThis.weatherNowLokaleTijd(G.TI[i]):G.TI[i];
  const tijd=String(lokaal).slice(11,16),temp=Array.isArray(G.T)?eindig(G.T[i]):null;
  const kans=Array.isArray(G.P)?eindig(G.P[i]):null;
  return grafiekDagVoorvoegsel(lokaal,nuLokaleTijd)+tijd+(temp===null?"":", "+Math.round(temp)+" graden")+(kans===null?"":", "+Math.round(kans)+" procent neerslagkans");
}

/* Desktop houdt alle vaste drie-uursreferenties. Extra extrema zijn bonuscontext
   en mogen verdwijnen als ze vrijwel dezelfde afgeronde temperatuur tonen vlak
   naast zo'n vaste referentie. Twee resterende extra's met vrijwel dezelfde
   waarde worden op dezelfde manier teruggebracht tot de meest prominente. */
function etmaalExtraTemperaturenWeg(temperaturen,gelabeldeIndices,rasterStap){
  const T=Array.isArray(temperaturen)?temperaturen:[],stap=Math.max(1,Math.floor(eindig(rasterStap)||3));
  const ids=[...new Set((Array.isArray(gelabeldeIndices)?gelabeldeIndices:[]).map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<T.length&&eindig(T[i])!==null))];
  const raster=ids.filter(i=>i%stap===0),extra=ids.filter(i=>i%stap!==0),weg=new Set();
  for(const i of extra){
    if(raster.some(j=>Math.abs(i-j)<=2&&Math.abs(Math.round(T[i])-Math.round(T[j]))<=1))weg.add(i);
  }
  const over=extra.filter(i=>!weg.has(i)).sort((a,b)=>temperatuurProminentie(T,b)-temperatuurProminentie(T,a)||a-b),gehouden=[];
  for(const i of over){
    if(gehouden.some(j=>Math.abs(i-j)<=2&&Math.abs(Math.round(T[i])-Math.round(T[j]))<=1))weg.add(i);
    else gehouden.push(i);
  }
  return [...weg].sort((a,b)=>a-b);
}

/* De SVG-tooltip moet minimaal 12 px effectief leesbaar zijn. De tekens staan in SVG-eenheden en worden met
   de breedte van de grafiek geschaald; de factor maakt de hele doos (rechthoek, teksten, scheidingslijn)
   precies groot genoeg. Naar boven afgerond op drie decimalen, zodat de uitkomst nooit net onder de grens valt. */
const TOOLTIP_MIN_PX=12;
/* Typografie-ronde 29 oktober 2026 (live-audit 646673f: tooltip effectief 12,0 tot 12,6px): op een tablet (vanaf 760px) minimaal
   13px en op desktop (vanaf 1100px) minimaal 14px, met de tijd bovenin op 15 respectievelijk 16px. Smaller dan 760px blijft
   de ondergrens 12px en blijft de tijd zoals de tekening hem zet; tot en met 429px is er de informatiestrook. */
const TOOLTIP_MIN_TABLET_PX=13,TOOLTIP_MIN_DESKTOP_PX=14,TOOLTIP_TIJD_TABLET_PX=15,TOOLTIP_TIJD_DESKTOP_PX=16;
function tooltipMinPx(viewportBreedte){
  const w=eindig(viewportBreedte);
  return w!==null&&w>=1100?TOOLTIP_MIN_DESKTOP_PX:w!==null&&w>=760?TOOLTIP_MIN_TABLET_PX:TOOLTIP_MIN_PX;
}
function tooltipTijdPx(viewportBreedte){
  const w=eindig(viewportBreedte);
  return w!==null&&w>=1100?TOOLTIP_TIJD_DESKTOP_PX:w!==null&&w>=760?TOOLTIP_TIJD_TABLET_PX:null;
}
function tooltipSchaalFactor(kleinsteFont,pxPerEenheid,minPx){
  const f=eindig(kleinsteFont),p=eindig(pxPerEenheid),m=eindig(minPx);
  if(f===null||p===null||m===null||f<=0||p<=0||m<=0) return 1;
  const k=m/(f*p);
  return k>1.0005?Math.ceil(k*1000)/1000:1;
}

/* Plaatsing van de opgeschaalde doos: dezelfde kant van het punt als de basis (rechts, tenzij die niet past),
   dezelfde verticale verankering (boven of onder), en altijd binnen de tekening. */
function tooltipDoosPlaatsing(doos,punt,veld,k){
  const nw=doos.w*k,nh=doos.h*k,W=veld.W,H=veld.H,pr=eindig(veld.pr)||0;
  const links=doos.x+doos.w<=punt.x+1;
  let nx=links?doos.x+doos.w-nw:doos.x;
  if(!links&&punt.x+10+nw>W-pr) nx=punt.x-nw-10;
  nx=Math.max(2,Math.min(nx,W-nw-2));
  const onder=doos.y+doos.h/2>veld.pt+veld.ih/2;
  let ny=onder?doos.y+doos.h-nh:doos.y;
  ny=Math.max(2,Math.min(ny,H-nh-2));
  return {nx,ny,nw,nh};
}

const api={
  tooltipWaardeKort,temperatuurLabelsBotsen,temperatuurPuntIndex,nuLabelPositie,nuLabelConcurreert,temperatuurOntdubbelToegestaan,
  dauwpuntCelsius,luchtvochtigheidDuiding,temperatuurProminentie,etmaalExtraTemperaturenWeg,grafiekPuntBeschrijving,grafiekDagVoorvoegsel,
  tooltipSchaalFactor,tooltipDoosPlaatsing,tooltipMinPx,tooltipTijdPx,TOOLTIP_MIN_PX
};
if(typeof module!=="undefined"&&module.exports) module.exports=api;
root.WeatherNowPolishV2=api;

if(typeof document==="undefined"||typeof S==="undefined") return;

/* Lokale datum en tijd van de plaats nu ("YYYY-MM-DDTHH:MM"), uit dezelfde plaatsklok als de nu-lijn in de grafiek. */
function plaatsNuLokaal(){
  try{
    if(typeof plaatsNu!=="function")return "";
    const t=plaatsNu(),p=n=>String(n).padStart(2,"0");
    return Number.isFinite(t.getTime())?t.getFullYear()+"-"+p(t.getMonth()+1)+"-"+p(t.getDate())+"T"+p(t.getHours())+":"+p(t.getMinutes()):"";
  }catch(e){return "";}
}

/* De bestaande plaatsklok in de kernruntime is bewust minuutprecies en wordt
   exact op de minuutgrens bijgewerkt. Een eerdere polishlaag verving die door
   HH:MM:SS en schreef elke seconde naar de DOM; dat voegde geen weerwaarde toe
   en kon bij lange plaatsnamen op mobiel midden in de klok afbreken. Laat de
   centrale klokowner daarom weer ongewijzigd eigenaar van #plaatstijd/#minitijd. */

/* De procentwaarde blijft exact de actuele relative_humidity_2m. Alleen de
   uitlegregel krijgt een consumentgerichte dauwpuntduiding uit dezelfde actuele
   temperatuur/RH-combinatie. */
const basisMetersPolishV2=meters;
meters=function(){
  const r=basisMetersPolishV2.apply(this,arguments);
  const c=S.d&&S.d.current,sub=document.getElementById("humsub");
  if(c&&sub)sub.textContent=luchtvochtigheidDuiding(c.temperature_2m,c.relative_humidity_2m);
  return r;
};

/* In de SVG-tooltip staan label en waarde als twee losse tekstnodes. Lange
   consumententeksten worden hier alleen typografisch ingekort; de betekenis
   en brondata blijven ongewijzigd. */
const basisScrubKoppel=scrubKoppel;
scrubKoppel=function(){
  basisScrubKoppel();
  const hit=document.getElementById("hit"),svg=document.getElementById("chart");
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

  /* De grafiek was alleen met muis/aanraking te bedienen. Eén focusbaar
     scrubdoel houdt de DOM compact en laat de gebruiker met links/rechts exact
     dezelfde bestaande tooltip doorlopen. Data en selectie blijven eigendom
     van de basisrenderer; toetsenbordbediening simuleert alleen dezelfde
     pointerpositie en voegt een actuele gesproken waarde toe. */
  hit.setAttribute("tabindex","0");
  hit.setAttribute("role","slider");
  hit.setAttribute("aria-orientation","horizontal");
  hit.setAttribute("aria-label","Uur in de temperatuurgrafiek");
  hit.setAttribute("aria-valuemin","1");
  hit.setAttribute("aria-valuemax",String(Math.max(1,S.geo&&S.geo.n||1)));
  hit.setAttribute("aria-valuenow","1");
  hit.setAttribute("aria-valuetext",grafiekPuntBeschrijving(S.geo,0,plaatsNuLokaal()));
  if(svg){svg.setAttribute("role","group");svg.setAttribute("aria-describedby","charthint");}
  const wijsIndexAan=index=>{
    const G=S.geo;if(!G||!svg||!Number.isFinite(G.n)||G.n<1)return;
    const i=clamp(Math.round(index),0,G.n-1),r=svg.getBoundingClientRect();
    if(!r.width)return;
    hit.dataset.keyboardIndex=String(i);
    hit.setAttribute("aria-valuenow",String(i+1));
    hit.setAttribute("aria-valuetext",grafiekPuntBeschrijving(G,i,plaatsNuLokaal()));
    const schaal=r.width/(G.W||900),clientX=r.left+G.x(i)*schaal,clientY=r.top+G.y(G.T[i])*schaal;
    hit.dispatchEvent(new PointerEvent("pointerdown",{clientX,clientY,pointerType:"mouse"}));
  };
  /* Een tik of klik geeft het vlak ook focus. Dan kiest de gebruiker zelf een
     uur: de focus mag dat niet overschrijven met het toetsenborduur. Het
     getikte uur wordt wel het startpunt voor de pijltjestoetsen. */
  let laatstePointer=0;
  const onthoudPointer=ev=>{
    if(!ev.isTrusted)return;
    laatstePointer=Date.now();
    const G=S.geo;if(!G||!svg||!Number.isFinite(G.n)||G.n<1||typeof G.x!=="function")return;
    const r=svg.getBoundingClientRect();if(!r.width)return;
    const vx=(ev.clientX-r.left)/(r.width/(G.W||900));
    let beste=0;for(let k=1;k<G.n;k++)if(Math.abs(G.x(k)-vx)<Math.abs(G.x(beste)-vx))beste=k;
    hit.dataset.keyboardIndex=String(beste);
    hit.setAttribute("aria-valuenow",String(beste+1));
    hit.setAttribute("aria-valuetext",grafiekPuntBeschrijving(G,beste,plaatsNuLokaal()));
  };
  hit.addEventListener("pointerdown",onthoudPointer);
  hit.addEventListener("pointerup",ev=>{if(ev.isTrusted)laatstePointer=Date.now();});
  hit.addEventListener("focus",()=>{
    if(Date.now()-laatstePointer<1000)return;
    wijsIndexAan(Number(hit.dataset.keyboardIndex||0));
  });
  hit.addEventListener("keydown",ev=>{
    const G=S.geo;if(!G||!G.n)return;
    /* Escape sluit de tooltip zonder dat de focus of het gekozen uur verdwijnt (WCAG 1.4.13, sluitbaar). Een volgende
       pijltoets, Enter of spatie opent hem weer bij dat uur; een tooltip die al dicht is laat Escape ongemoeid. */
    if(ev.key==="Escape"){
      const g=document.getElementById("scrub");
      if(g&&g.style.display!=="none"){g.style.display="none";ev.preventDefault();}
      return;
    }
    let i=clamp(Number(hit.dataset.keyboardIndex||0),0,G.n-1),volgende=null;
    if(ev.key==="ArrowRight"||ev.key==="ArrowUp")volgende=i+1;
    else if(ev.key==="ArrowLeft"||ev.key==="ArrowDown")volgende=i-1;
    else if(ev.key==="Home")volgende=0;
    else if(ev.key==="End")volgende=G.n-1;
    else if(ev.key==="Enter"||ev.key===" ")volgende=i;
    if(volgende===null)return;
    ev.preventDefault();wijsIndexAan(clamp(volgende,0,G.n-1));
  });
  hit.addEventListener("blur",()=>{const g=document.getElementById("scrub");if(g)g.style.display="none";});
  koppelTooltipWeergave();
};

/* ---------- tooltipweergave: informatiestrook (tot en met 429 px, via CSS) en minimaal 12 px ----------
   De SVG-groep #scrub blijft de enige bron van waarheid; alle lagen die haar vullen of verplaatsen
   (basis, compactie, neerslagregel) draaien ongewijzigd. Deze laag leest het eindresultaat pas in het
   volgende frame (requestAnimationFrame), dus de volgorde van de lagen doet er niet toe:
   - de zes rijen worden in de HTML-strook #tip-strook gezet (CSS toont die alleen op smalle schermen);
   - bij >= 430 px wordt de doos zo opgeschaald dat de kleinste tekst minimaal 12 px effectief is. */
const SVG_NS="http://www.w3.org/2000/svg";
let tooltipObserver=null,tooltipRaf=0,tooltipTimer=0,tooltipBezig=false;

function tooltipTekstLezen(g){
  const kop=g.querySelector('text[data-tip="kop"]'),oms=g.querySelector('text[data-tip="omschrijving"]');
  const rij=n=>{
    const l=g.querySelector('text[data-tip-rij="'+n+'"][data-tip-kol="label"]'),w=g.querySelector('text[data-tip-rij="'+n+'"][data-tip-kol="waarde"]');
    return l&&w?{label:l.textContent.trim(),waarde:w.textContent.trim(),kleur:w.getAttribute("fill")}:null;
  };
  const rijen=[1,2,3,4,5,6].map(rij);
  if(!kop||rijen.some(r=>!r)) return null;
  return {kop:kop.textContent.trim(),omschrijving:oms?oms.textContent.trim():"",rijen,kopKleur:kop.getAttribute("fill")};
}

function vulTooltipStrook(strook,g){
  const d=g.style.display!=="none"?tooltipTekstLezen(g):null;
  if(!d){
    if(strook.firstChild){strook.replaceChildren();delete strook.dataset.sig;}
    return;
  }
  const sig=JSON.stringify(d);
  if(strook.dataset.sig===sig) return;
  const el=(tag,klasse,tekst)=>{const e=document.createElement(tag);if(klasse)e.className=klasse;if(tekst!=null)e.textContent=tekst;return e;};
  const item=r=>{
    const x=el("div","tip-rij");x.appendChild(el("dt",null,r.label));
    const dd=el("dd",null,r.waarde);if(r.kleur&&r.kleur!==d.kopKleur) dd.style.color=r.kleur;
    x.appendChild(dd);return x;
  };
  const duo=(a,b)=>{const x=el("div","tip-duo");x.appendChild(item(a));x.appendChild(item(b));return x;};
  const dl=el("dl","tip-rijen"),r=d.rijen;
  dl.appendChild(duo(r[0],r[1]));dl.appendChild(item(r[2]));dl.appendChild(item(r[3]));dl.appendChild(duo(r[4],r[5]));
  strook.replaceChildren(el("div","tip-kop",d.kop),el("div","tip-oms",d.omschrijving||"\u00a0"),dl);
  strook.dataset.sig=sig;
}

/* De SVG-tekstvakdelen krijgen een markering; de CSS verbergt ze alleen tot en met 429 px (visibility, geen
   display: geometrie en tekst blijven voor tests en hulptechnologie beschikbaar). */
function markeerTooltipSvg(g){
  g.querySelectorAll("rect,text,line").forEach(e=>{
    const tag=e.tagName.toLowerCase();
    if(tag==="line"&&e.getAttribute("y1")!==e.getAttribute("y2")) return;
    e.setAttribute("data-tip-verberg","");
  });
}

function schaalSvgTooltip(g,svg){
  const oud=g.querySelector(":scope > g[data-tip-schaal]");
  if(oud){while(oud.firstChild)g.insertBefore(oud.firstChild,oud);oud.remove();}
  if(g.style.display==="none"||!globalThis.matchMedia||!globalThis.matchMedia("(min-width:430px)").matches) return;
  const rect=g.querySelector("rect"),teksten=[...g.querySelectorAll("text")],vb=svg.viewBox&&svg.viewBox.baseVal,br=svg.getBoundingClientRect();
  if(!rect||!teksten.length||!vb||!vb.width||!br.width) return;
  const fonts=teksten.map(e=>eindig(e.getAttribute("font-size"))).filter(v=>v!==null&&v>0);
  if(!fonts.length) return;
  const pxPerEenheid=br.width/vb.width;
  const k=tooltipSchaalFactor(Math.min(...fonts),pxPerEenheid,tooltipMinPx(globalThis.innerWidth));
  if(k===1) return;
  /* De tijd bovenin krijgt een eigen effectieve maat (tablet 15, desktop 16px), onafhankelijk van de rijtekst. */
  const tijdPx=tooltipTijdPx(globalThis.innerWidth),kop=g.querySelector('text[data-tip="kop"]');
  if(kop&&tijdPx!==null){const f=Math.round(tijdPx/(k*pxPerEenheid)*10)/10;if(Number.isFinite(f)&&f>0)kop.setAttribute("font-size",String(f));}
  const lijnen=[...g.querySelectorAll("line")],sep=lijnen.find(l=>l.getAttribute("y1")===l.getAttribute("y2")),kruis=lijnen.find(l=>l!==sep);
  const doos={x:eindig(rect.getAttribute("x")),y:eindig(rect.getAttribute("y")),w:eindig(rect.getAttribute("width")),h:eindig(rect.getAttribute("height"))};
  const puntX=kruis?eindig(kruis.getAttribute("x1")):null,G=S.geo||{};
  if(Object.values(doos).some(v=>v===null)||puntX===null) return;
  const pl=tooltipDoosPlaatsing(doos,{x:puntX},{W:vb.width,H:vb.height,pr:G.pr,pt:eindig(G.pt)||0,ih:eindig(G.ih)||vb.height},k);
  if(![pl.nx,pl.ny].every(Number.isFinite)) return;
  const wrap=document.createElementNS(SVG_NS,"g");
  wrap.setAttribute("data-tip-schaal",String(k));
  wrap.setAttribute("transform","translate("+(pl.nx-k*doos.x)+" "+(pl.ny-k*doos.y)+") scale("+k+")");
  const leden=new Set([rect,...teksten,...(sep?[sep]:[])]);
  g.insertBefore(wrap,rect);
  [...g.children].forEach(c=>{if(leden.has(c))wrap.appendChild(c);});
  rect.setAttribute("vector-effect","non-scaling-stroke");
  if(sep) sep.setAttribute("vector-effect","non-scaling-stroke");
}

function synchroniseerTooltipWeergave(){
  tooltipRaf=0;clearTimeout(tooltipTimer);
  const g=document.getElementById("scrub"),svg=document.getElementById("chart"),strook=document.getElementById("tip-strook");
  if(!g||!svg) return;
  tooltipBezig=true;
  try{
    markeerTooltipSvg(g);
    if(strook) vulTooltipStrook(strook,g);
    schaalSvgTooltip(g,svg);
  }finally{
    tooltipBezig=false;
    if(tooltipObserver) tooltipObserver.takeRecords();
  }
}

function planTooltipWeergave(){
  if(tooltipBezig||tooltipRaf) return;
  tooltipRaf=requestAnimationFrame(synchroniseerTooltipWeergave);
  /* Reserve voor een pagina die geen frames tekent (verborgen tabblad): dan staat de tooltip er ook niet. */
  tooltipTimer=setTimeout(()=>{if(tooltipRaf){cancelAnimationFrame(tooltipRaf);synchroniseerTooltipWeergave();}},120);
}

function koppelTooltipWeergave(){
  const g=document.getElementById("scrub");
  if(!g||typeof MutationObserver==="undefined") return;
  if(tooltipObserver) tooltipObserver.disconnect();
  tooltipObserver=new MutationObserver(planTooltipWeergave);
  tooltipObserver.observe(g,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:["style"]});
}

function verwijderTemperatuurMarkering(svg,el){
  if(!svg||!el) return;
  const cw=S.geo&&Number.isFinite(S.geo.cw)?S.geo.cw:36;
  const punten=[...svg.querySelectorAll("circle[data-temp-index]")].map(p=>({
    el:p,i:Number(p.getAttribute("data-temp-index")),x:eindig(p.getAttribute("cx"))
  }));
  const i=temperatuurPuntIndex(
    {text:String(el.textContent||"").trim(),x:eindig(el.getAttribute("x"))},
    punten,S.geo&&Array.isArray(S.geo.T)?S.geo.T:[],Math.max(72,cw*2.5)
  );
  if(i!==null){
    const punt=punten.find(p=>p.i===i);
    if(punt&&punt.el) punt.el.remove();
  }
  el.remove();
}

/* Twee opeenvolgende uren met dezelfde afgeronde temperatuur kunnen beide als
   relevant label uit de bestaande grafiek komen. Op 24 uur blijven die waarden
   bewust staan: de regelmatige tijdcontext weegt daar zwaarder dan ontdubbeling.
   Op langere horizons blijft de bestaande reductie actief. */
function ontdubbelTemperatuurlabels(svg){
  if(!svg||!temperatuurOntdubbelToegestaan(S.geo&&S.geo.n)) return;
  const cw=S.geo&&Number.isFinite(S.geo.cw)?S.geo.cw:36;
  const maxDx=Math.max(38,cw*1.3),gehouden=[];
  const labels=[...svg.querySelectorAll("text")].filter(el=>{
    const ff=String(el.getAttribute("font-family")||"");
    return ff.includes("Bodoni Moda")&&/^-?\d+°$/.test(String(el.textContent||"").trim());
  }).map(el=>({el,text:el.textContent.trim(),x:eindig(el.getAttribute("x")),y:eindig(el.getAttribute("y"))}))
    .filter(x=>x.x!==null&&x.y!==null).sort((a,b)=>a.x-b.x);
  for(const lab of labels){
    if(gehouden.some(v=>temperatuurLabelsBotsen(v,lab,maxDx))) verwijderTemperatuurMarkering(svg,lab.el);
    else gehouden.push(lab);
  }
}

/* Binnen 24 uur zijn de i%3-rasterpunten verplicht. De extra piek/dal-labels
   worden pas na de basisplaatsing beoordeeld, zodat alleen redundante bonuscopy
   verdwijnt en nooit een vaste drie-uursreferentie. Mobiel houdt zijn bestaande
   compacte selectie ongewijzigd. */
function ruimEtmaalExtraTemperaturenOp(svg){
  if(!svg||!S.geo||S.geo.M||!Number.isFinite(S.geo.n)||S.geo.n>24||!Array.isArray(S.geo.T))return;
  const cw=Number.isFinite(S.geo.cw)?S.geo.cw:36;
  const punten=[...svg.querySelectorAll("circle[data-temp-index]")].map(p=>({
    el:p,i:Number(p.getAttribute("data-temp-index")),x:eindig(p.getAttribute("cx"))
  })).filter(p=>Number.isInteger(p.i)&&p.x!==null);
  const labels=[...svg.querySelectorAll("text")].filter(el=>{
    const ff=String(el.getAttribute("font-family")||"");
    return ff.includes("Bodoni Moda")&&/^-?\d+°$/.test(String(el.textContent||"").trim());
  }).map(el=>{
    const text=String(el.textContent||"").trim(),x=eindig(el.getAttribute("x"));
    const i=temperatuurPuntIndex({text,x},punten,S.geo.T,Math.max(72,cw*2.5));
    return {el,i};
  }).filter(x=>x.i!==null);
  const maxCompactUren=eindig(root.WeatherNowFinalDesktopUI20260902&&root.WeatherNowFinalDesktopUI20260902.MAX_DESKTOP_UREN);
  const rasterStap=!S.geo.M&&window.innerWidth>=1100&&maxCompactUren!==null&&S.geo.n<=maxCompactUren?1:3;
  const weg=new Set(etmaalExtraTemperaturenWeg(S.geo.T,labels.map(x=>x.i),rasterStap));
  labels.forEach(({el,i})=>{
    if(!weg.has(i))return;
    const punt=punten.find(p=>p.i===i);if(punt&&punt.el)punt.el.remove();
    el.remove();
  });
}

/* Het rode "nu 22°" is de actuele meting en krijgt daarom voorrang boven een
   zwart modeluurcijfer in zijn directe omgeving. Ook hier verdwijnen cijfer en
   bijbehorend zwart punt als één visuele markering. Daarna krijgt het actuele
   label een eigen positie en halo. */
function positioneerNuLabel(svg){
  if(!svg||!S.geo) return;
  const tekst=[...svg.querySelectorAll("text")].find(el=>/^nu\s+-?\d+°$/i.test(String(el.textContent||"").trim()));
  const punt=[...svg.querySelectorAll("circle")].find(el=>
    String(el.getAttribute("fill")||"")===String(CARMINE)
    &&Math.abs((eindig(el.getAttribute("r"))||0)-3)<0.2);
  if(!tekst||!punt) return;
  // Ook op desktop staat "nu 18°" bij de rode stip: zonder label is de rode
  // lijn een aanwijzer zonder waarde (verzoek van de eigenaar, 29 september).
  const px=eindig(punt.getAttribute("cx")),py=eindig(punt.getAttribute("cy"));
  const top=eindig(S.geo.pt),bottom=top===null||!Number.isFinite(S.geo.ih)?null:top+S.geo.ih;
  const pos=nuLabelPositie(py,top,bottom,!!S.geo.M);
  if(px===null||py===null||top===null||bottom===null||!pos) return;

  const gewoneLabels=[...svg.querySelectorAll("text")].filter(el=>{
    if(el===tekst) return false;
    const ff=String(el.getAttribute("font-family")||"");
    return ff.includes("Bodoni Moda")&&/^-?\d+°$/.test(String(el.textContent||"").trim());
  });
  gewoneLabels.forEach(el=>{
    const label={x:eindig(el.getAttribute("x")),y:eindig(el.getAttribute("y"))};
    if(nuLabelConcurreert({x:px,y:py},label,S.geo.cw,!!S.geo.M)) verwijderTemperatuurMarkering(svg,el);
  });

  /* Op desktop even goed leesbaar als de temperatuurcijfers ernaast. */
  if(!S.geo.M){
    const ref=gewoneLabels.find(el=>el.isConnected&&Number(el.getAttribute("font-size"))>0);
    const fs=ref?Number(ref.getAttribute("font-size")):null;
    if(fs&&fs*0.82>(Number(tekst.getAttribute("font-size"))||0))tekst.setAttribute("font-size",String(Math.round(fs*0.82*10)/10));
    tekst.setAttribute("font-weight","500");
  }
  tekst.setAttribute("stroke",SHEET);
  tekst.setAttribute("stroke-width",S.geo.M?"2.5":"3");
  tekst.setAttribute("paint-order","stroke");
  tekst.setAttribute("stroke-linejoin","round");

  let breed=54;
  try{const b=tekst.getComputedTextLength();if(Number.isFinite(b)&&b>0)breed=b;}catch(e){}
  const links=Number.isFinite(S.geo.pl)?S.geo.pl:2;
  const rechts=Number.isFinite(S.geo.W)&&Number.isFinite(S.geo.pr)?S.geo.W-S.geo.pr:null;
  const zijAfstand=S.geo.M?8:10;
  const pastRechts=rechts===null||px+zijAfstand+breed<=rechts;
  const naarRechts=pastRechts||px-zijAfstand-breed<links;
  tekst.setAttribute("x",String(px+(naarRechts?zijAfstand:-zijAfstand)));
  tekst.setAttribute("y",String(pos.y));
  tekst.setAttribute("text-anchor",naarRechts?"start":"end");
}

const basisEtmaalPolishV2=etmaal;
etmaal=function(start,n){
  basisEtmaalPolishV2(start,n);
  const svg=document.getElementById("chart");
  ontdubbelTemperatuurlabels(svg);
  positioneerNuLabel(svg);
  ruimEtmaalExtraTemperaturenOp(svg);
};

})(typeof globalThis!=="undefined"?globalThis:this);

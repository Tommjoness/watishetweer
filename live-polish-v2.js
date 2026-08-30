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
  const onderAfstand=mobiel?28:30,bovenAfstand=mobiel?22:24,marge=mobiel?8:10;
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
  const d=Math.round(dp),basis="Dauwpunt circa "+d+" °C · ";
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

const api={
  tooltipWaardeKort,temperatuurLabelsBotsen,temperatuurPuntIndex,nuLabelPositie,nuLabelConcurreert,temperatuurOntdubbelToegestaan,
  dauwpuntCelsius,luchtvochtigheidDuiding,temperatuurProminentie,etmaalExtraTemperaturenWeg
};
if(typeof module!=="undefined"&&module.exports) module.exports=api;
root.WeatherNowPolishV2=api;

if(typeof document==="undefined"||typeof S==="undefined") return;

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
  const weg=new Set(etmaalExtraTemperaturenWeg(S.geo.T,labels.map(x=>x.i),3));
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

  tekst.setAttribute("stroke",SHEET);
  tekst.setAttribute("stroke-width",S.geo.M?"2.5":"3");
  tekst.setAttribute("paint-order","stroke");
  tekst.setAttribute("stroke-linejoin","round");

  let breed=54;
  try{const b=tekst.getComputedTextLength();if(Number.isFinite(b)&&b>0)breed=b;}catch(e){}
  const links=Number.isFinite(S.geo.pl)?S.geo.pl:2;
  const rechts=Number.isFinite(S.geo.W)&&Number.isFinite(S.geo.pr)?S.geo.W-S.geo.pr:null;
  const pastRechts=rechts===null||px+10+breed<=rechts;
  const naarRechts=pastRechts||px-10-breed<links;
  tekst.setAttribute("x",String(px+(naarRechts?10:-10)));
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

/* Grafiek-, bron- en informatie-UX 2026-08-28.
   Deze laag verandert geen providerwaarden of weersformules. Hij bewaakt alleen
   presentatiesemantiek, bronprovenance en zeldzame grafiekbotsingen. */
(function(root){
"use strict";

const SVG_NS="http://www.w3.org/2000/svg";
const NWS_LANDEN=new Set(["US","PR","VI","GU","MP","AS"]);
const METEOALARM_LANDEN=new Set(["AD","AT","BE","BA","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IS","IE","IL","IT","LV","LT","LU","MT","MD","ME","NL","MK","NO","PL","PT","RO","RS","SK","SI","ES","SE","CH","UA","GB"]);

function uurUitIso(tijd){
  const m=/T(\d{2}):/.exec(String(tijd||""));
  return m?Number(m[1]):null;
}
function uurAsLabelTekst(tekst){
  const m=/^([01]?\d|2[0-3])(?::00)?$/.exec(String(tekst||"").trim());
  return m?String(Number(m[1])).padStart(2,"0")+":00":"";
}
function kiesUurLabelIndices(tijden,minimaal=4,cadans=3,rand=2){
  const T=Array.isArray(tijden)?tijden:[],min=Math.max(1,Math.floor(Number(minimaal)||4));
  const stap=Math.max(1,Math.floor(Number(cadans)||3)),inzet=Math.max(0,Math.floor(Number(rand)||0));
  if(T.length<3)return [];
  let basis=T.map((tijd,i)=>({i,uur:uurUitIso(tijd)}))
    .filter(x=>x.i>=inzet&&x.i<=T.length-1-inzet&&Number.isInteger(x.uur)&&x.uur%stap===0)
    .map(x=>x.i);
  if(basis.length<min)basis=T.map((_,i)=>i).filter(i=>i>=inzet&&i<=T.length-1-inzet);
  if(basis.length<=min)return basis;
  const uit=[];
  for(let k=0;k<min;k++){
    const pos=Math.round(k*(basis.length-1)/(min-1));
    const i=basis[pos];if(!uit.includes(i))uit.push(i);
  }
  return uit;
}
/* De compacte mobiele etmaalgrafiek volgt de echte lokale klok uit de
   forecastreeks. We nemen alleen bestaande punten waarvan het lokale uur op de
   gevraagde cadans valt; er worden dus geen synthetische/UTC-uren verzonnen.
   De 25e rechtergrens van een 24-uursplot telt niet als extra etmaalpunt. */
function kiesKalenderUurLabelIndices(tijden,cadans=3,maxPunten=24){
  const T=Array.isArray(tijden)?tijden:[],stap=Math.max(1,Math.floor(Number(cadans)||3));
  const limiet=Math.min(T.length,Math.max(0,Math.floor(Number(maxPunten)||24))),gezien=new Set(),uit=[];
  for(let i=0;i<limiet;i++){
    const tijd=String(T[i]||""),uur=uurUitIso(tijd);
    if(!Number.isInteger(uur)||uur%stap!==0||gezien.has(tijd))continue;
    gezien.add(tijd);uit.push(i);
  }
  return uit;
}

/* Gelijke opeenvolgende temperaturen vormen één plateau. Zo'n plateau telt
   alleen als extremum wanneer de waarde aan beide kanten strikt lager (piek)
   of strikt hoger (dal) is. We labelen exact één echt forecastpunt: het
   middelste punt van het plateau, bij een even lengte het linker middenpunt. */
function lokaleTemperatuurExtrema(temperaturen,maxPunten=24){
  const T=Array.isArray(temperaturen)?temperaturen:[],n=Math.min(T.length,Math.max(0,Math.floor(Number(maxPunten)||24))),uit=[];
  let i=1;
  while(i<n-1){
    if(!Number.isFinite(Number(T[i]))){i++;continue;}
    const waarde=Number(T[i]);let start=i,eind=i;
    while(eind+1<n&&Number.isFinite(Number(T[eind+1]))&&Number(T[eind+1])===waarde)eind++;
    const links=start-1,rechts=eind+1;
    if(links>=0&&rechts<n&&Number.isFinite(Number(T[links]))&&Number.isFinite(Number(T[rechts]))){
      const lv=Number(T[links]),rv=Number(T[rechts]);
      const type=lv<waarde&&rv<waarde?"piek":lv>waarde&&rv>waarde?"dal":null;
      if(type)uit.push({i:Math.floor((start+eind)/2),type,start,eind});
    }
    i=eind+1;
  }
  return uit;
}
function mobieleTemperatuurLabelPlan(tijden,temperaturen,maxPunten=24){
  const ankers=kiesKalenderUurLabelIndices(tijden,3,maxPunten),ankerSet=new Set(ankers);
  const extrema=lokaleTemperatuurExtrema(temperaturen,maxPunten).filter(e=>!ankerSet.has(e.i));
  return {ankers,extrema};
}

function isUurAsLabel(tekst,y,plotOnder,fontFamilie){
  const t=uurAsLabelTekst(tekst),py=Number(y),onder=Number(plotOnder),font=String(fontFamilie||"");
  return !!t&&Number.isFinite(py)&&Number.isFinite(onder)&&py>=onder+6&&!/Bodoni/i.test(font);
}
function waarschuwingBronnenVoorLand(land){
  const code=String(land||"").trim().toUpperCase();
  return {nws:NWS_LANDEN.has(code),meteoalarm:METEOALARM_LANDEN.has(code)};
}
function neerslagSleutelTekst(waarde,subtekst){
  const t=String(waarde||"").replace(/\s+/g," ").trim(),sub=String(subtekst||"").toLowerCase();
  if(!/%/.test(t))return "";
  if(/\bmm\b/i.test(t))return "kans · verwachte hoeveelheid";
  if(/onzeker|onvoldoende|niet beschikbaar|geen betrouwbare/i.test(sub))return "kans · hoeveelheid onzeker";
  return "kans";
}
function resourceNaam(r){return String(r&&typeof r==="object"?r.name:r||"");}
function bronGebruikUitResources(resources,land,opties={}){
  const namen=(Array.isArray(resources)?resources:[]).map(resourceNaam),waarschuwing=waarschuwingBronnenVoorLand(land);
  const heeft=patroon=>namen.some(n=>patroon.test(n));
  const waarschuwingen=heeft(/\/api\/waarschuwingen(?:[?#]|$)/i);
  return {
    /* Open-Meteo is de kernbron van iedere weerweergave. Deze attributie blijft
       daarom ook zichtbaar vóór/zonder een meetbare resource-entry; alleen de
       optionele aanvullende bronnen worden dynamisch gefilterd. */
    openmeteo:true,
    cams:!!opties.airBeschikbaar||heeft(/air-quality-api\.open-meteo\.com/i),
    bigdatacloud:heeft(/bigdatacloud\.net/i),
    osm:heeft(/\/api\/plaatsnaam(?:[?#]|$)|nominatim|openstreetmap/i),
    knmi:heeft(/\/api\/neerslag(?:[?#]|$)/i),
    meteoalarm:waarschuwingen&&waarschuwing.meteoalarm,
    nws:waarschuwingen&&waarschuwing.nws
  };
}
function rechthoekenBotsen(a,b,padding=0){
  if(!a||!b)return false;
  const p=Math.max(0,Number(padding)||0),ax=Number(a.x),ay=Number(a.y),aw=Number(a.width),ah=Number(a.height),bx=Number(b.x),by=Number(b.y),bw=Number(b.width),bh=Number(b.height);
  if(![ax,ay,aw,ah,bx,by,bw,bh].every(Number.isFinite))return false;
  return ax-p<bx+bw&&ax+aw+p>bx&&ay-p<by+bh&&ay+ah+p>by;
}

/* Alleen voor de botsingsbeslissing van korte SVG-temperatuurlabels is een
   browsergedreven getBBox()-meting onnodig duur: zo'n read kan na SVG-mutaties
   een volledige layout flush afdwingen. Deze helper reconstrueert daarom een
   conservatieve tekstbox uit de al bekende SVG-attributen. De schatting is
   bewust iets ruimer dan de gangbare glyphbreedte; een zeldzame extra 12px
   labelverschuiving is veiliger dan een gemiste visuele botsing. */
function geschatteSvgTekstBox(tekst,x,y,anker="start",fontGrootte=12){
  const inhoud=String(tekst||"").trim(),px=Number(x),py=Number(y),fs=Number(fontGrootte);
  if(!inhoud||![px,py,fs].every(Number.isFinite)||fs<=0)return null;
  const breed=Math.max(fs*.75,inhoud.length*fs*.66),hoogte=fs*1.18;
  const a=String(anker||"start").toLowerCase();
  const links=a==="middle"?px-breed/2:a==="end"?px-breed:px;
  return {x:links,y:py-fs*.92,width:breed,height:hoogte};
}
function svgTekstBoxUitElement(el){
  if(!el||typeof el.getAttribute!=="function")return null;
  const x=el.getAttribute("x"),y=el.getAttribute("y"),anker=el.getAttribute("text-anchor")||"start";
  const font=Number(el.getAttribute("font-size"));
  return geschatteSvgTekstBox(el.textContent,x,y,anker,Number.isFinite(font)&&font>0?font:12);
}

/* Mobiele SVG-tekst mag nooit buiten de eigen viewBox vallen. Vooral het laatste
   HH:00-label stond op het laatste datapunt gecentreerd en liep daardoor rechts
   uit de grafiek. Deze pure helper geeft alleen bij echte randoverschrijding een
   nieuwe x/anchor terug; labels die al veilig staan blijven onaangeraakt. */
function randCorrectieVoorTekstBox(box,svgBreedte,marge=4){
  if(!box)return null;
  const x=Number(box.x),breed=Number(box.width),w=Number(svgBreedte),m=Math.max(0,Number(marge)||0);
  if(![x,breed,w].every(Number.isFinite)||breed<0||w<=0)return null;
  if(x<m)return {x:m,anker:"start"};
  if(x+breed>w-m)return {x:w-m,anker:"end"};
  return null;
}

/* Een temperatuurcijfer hoort visueel bij zijn datapunt. De collision-lagen van
   de basisgrafiek mogen een label iets laten verspringen, maar op mobiel niet
   zo ver dat het als een los zwevend getal oogt. Alleen buitensporige verticale
   afwijkingen worden begrensd; normale labelplaatsing blijft exact intact. */
function begrensTemperatuurLabelY(labelY,puntY,plotTop,plotBottom,maxAfstand=42){
  const ly=Number(labelY),py=Number(puntY),top=Number(plotTop),bottom=Number(plotBottom),lim=Math.max(1,Number(maxAfstand)||42);
  if(![ly,py,top,bottom].every(Number.isFinite)||bottom<=top)return null;
  if(Math.abs(ly-py)<=lim)return ly;
  const marge=10,boven=py-18,onder=py+24;
  let doel=ly<=py?boven:onder;
  if(doel<top+marge)doel=onder;
  if(doel>bottom-marge)doel=boven;
  return Math.max(top+marge,Math.min(bottom-marge,doel));
}

function mobieleTemperatuurLabelLimiet(breedte){
  const w=Number(breedte);
  if(!Number.isFinite(w))return 5;
  if(w<=340)return 5;
  if(w<=375)return 6;
  if(w<=410)return 7;
  return 8;
}

/* Minimum, maximum en het laatste zichtbare punt worden eerst vastgezet. De
   resterende plekken gaan telkens naar de kandidaat met de meeste horizontale
   ruimte ten opzichte van de al gekozen punten. Zo blijft de hele lijn
   leesbaar zonder ieder uur een cijfer te geven. */
function kiesMobieleTemperatuurLabelIndices(temperaturen,gelabeldeIndices,maxLabels=5){
  const T=Array.isArray(temperaturen)?temperaturen:[],lim=Math.max(2,Math.floor(Number(maxLabels)||5));
  const ids=[...new Set((Array.isArray(gelabeldeIndices)?gelabeldeIndices:[]).map(Number)
    .filter(i=>Number.isInteger(i)&&i>=0&&i<T.length&&T[i]!==null&&T[i]!==undefined&&T[i]!==""&&Number.isFinite(Number(T[i]))))].sort((a,b)=>a-b);
  if(ids.length<=lim)return ids;
  const gekozen=[],voeg=i=>{if(Number.isInteger(i)&&ids.includes(i)&&!gekozen.includes(i)&&gekozen.length<lim)gekozen.push(i);};
  const waarden=ids.map(i=>Number(T[i])),min=Math.min(...waarden),max=Math.max(...waarden);
  voeg(ids.find(i=>Number(T[i])===min));
  voeg(ids.find(i=>Number(T[i])===max));
  voeg(ids.includes(T.length-1)?T.length-1:ids[ids.length-1]);
  while(gekozen.length<lim){
    const over=ids.filter(i=>!gekozen.includes(i));
    if(!over.length)break;
    const afstand=i=>gekozen.length?Math.min(...gekozen.map(j=>Math.abs(i-j))):Infinity;
    const prominentie=i=>{
      const v=Number(T[i]),l=i>0&&Number.isFinite(Number(T[i-1]))?Number(T[i-1]):v,r=i+1<T.length&&Number.isFinite(Number(T[i+1]))?Number(T[i+1]):v;
      return Math.abs(v-(l+r)/2);
    };
    const beste=over.reduce((a,b)=>afstand(b)!==afstand(a)?(afstand(b)>afstand(a)?b:a):(prominentie(b)>prominentie(a)?b:a),over[0]);
    voeg(beste);
  }
  return gekozen.sort((a,b)=>a-b);
}

function prioriteerMobieleTemperatuurLabelIndices(temperaturen,indices){
  const T=Array.isArray(temperaturen)?temperaturen:[],ids=[...new Set((Array.isArray(indices)?indices:[]).map(Number).filter(Number.isInteger))].filter(i=>i>=0&&i<T.length&&Number.isFinite(Number(T[i])));
  if(!ids.length)return [];
  const waarden=ids.map(i=>Number(T[i])),min=Math.min(...waarden),max=Math.max(...waarden),uit=[];
  const voeg=i=>{if(Number.isInteger(i)&&ids.includes(i)&&!uit.includes(i))uit.push(i);};
  voeg(ids.find(i=>Number(T[i])===min));
  voeg(ids.find(i=>Number(T[i])===max));
  voeg(ids.includes(T.length-1)?T.length-1:Math.max(...ids));
  ids.forEach(voeg);
  return uit;
}

function mobieleGrafiekCompactHoogte(plotBottom,huidigeHoogte,zichtbareOnderkant){
  const pb=Number(plotBottom),h=Number(huidigeHoogte),zicht=Number(zichtbareOnderkant);
  if(![pb,h,zicht].every(Number.isFinite)||pb<=0||h<=0)return null;
  const doel=Math.ceil(Math.max(pb+36,zicht+10));
  return Math.min(h,doel);
}

const api={uurUitIso,uurAsLabelTekst,kiesUurLabelIndices,kiesKalenderUurLabelIndices,lokaleTemperatuurExtrema,mobieleTemperatuurLabelPlan,isUurAsLabel,waarschuwingBronnenVoorLand,neerslagSleutelTekst,bronGebruikUitResources,rechthoekenBotsen,geschatteSvgTekstBox,randCorrectieVoorTekstBox,begrensTemperatuurLabelY,mobieleTemperatuurLabelLimiet,kiesMobieleTemperatuurLabelIndices,prioriteerMobieleTemperatuurLabelIndices,mobieleGrafiekCompactHoogte};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowMobileGraphUX20260828=api;

if(typeof document==="undefined"||typeof window==="undefined"||typeof S==="undefined")return;
const mobiel=()=>typeof window.matchMedia==="function"?window.matchMedia("(max-width:900px)").matches:window.innerWidth<=900;

function bestaandeUurLabels(svg,g){
  const plotOnder=Number(g&&g.pt)+Number(g&&g.ih);
  return svg?[...svg.querySelectorAll("text")].filter(el=>{
    if(el.closest&&el.closest('g[data-q4-rain-periods]'))return false;
    return isUurAsLabel(el.textContent,el.getAttribute("y"),plotOnder,el.getAttribute("font-family"));
  }):[];
}
function stileerUurAsLabel(el){
  if(!el)return;
  el.setAttribute("font-family","Instrument Sans,ui-sans-serif,system-ui,sans-serif");
  el.setAttribute("font-style","normal");
  el.setAttribute("font-weight","400");
  el.setAttribute("letter-spacing","0");
  if(el.style)el.style.fontVariantNumeric="tabular-nums";
}
function herstelUurAs(){
  if(!mobiel())return;
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||Number(g.n)>48||!Array.isArray(g.TI)||typeof g.x!=="function")return;
  const compact24=Number(g.n)<=25&&window.innerWidth<=430;
  let alle=bestaandeUurLabels(svg,g);
  alle.forEach(el=>{const expliciet=uurAsLabelTekst(el.textContent);if(expliciet)el.textContent=expliciet;});

  if(compact24){
    /* Eén mobiele eigenaar: echte lokale forecastpunten op 00/03/06/09/12/15/18/21.
       De rollende 25e rechtergrens wordt niet nogmaals gelabeld. */
    alle.forEach(el=>el.remove());
    const indices=kiesKalenderUurLabelIndices(g.TI,3,24),y=Number(g.pt)+Number(g.ih)+20;
    if(!Number.isFinite(y))return;
    const kleur=getComputedStyle(document.documentElement).getPropertyValue("--ink-45").trim()||"currentColor";
    indices.forEach(i=>{
      const x=Number(g.x(i)),uur=uurUitIso(g.TI[i]);if(!Number.isFinite(x)||!Number.isInteger(uur))return;
      const el=document.createElementNS(SVG_NS,"text");
      el.setAttribute("x",String(x));el.setAttribute("y",String(y));
      el.setAttribute("text-anchor","middle");
      el.setAttribute("fill",kleur);el.setAttribute("font-size","9");el.setAttribute("opacity",".82");
      stileerUurAsLabel(el);
      el.setAttribute("data-mobile-hour-axis","1");el.setAttribute("data-mobile-hour-index",String(i));
      el.textContent=uurAsLabelTekst(String(uur));
      const regen=svg.querySelector('g[data-q4-rain-periods]'),scrub=svg.querySelector("#scrub");
      svg.insertBefore(el,regen||scrub||null);
    });
    svg.setAttribute("data-mobile-hour-rhythm","three-hour");
    return;
  }

  const minimum=4,cadans=3,rand=2;
  let fallback=alle.filter(el=>el.hasAttribute("data-mobile-hour-axis")),canoniek=alle.filter(el=>!el.hasAttribute("data-mobile-hour-axis"));
  alle.forEach(stileerUurAsLabel);
  if(canoniek.length>=minimum){fallback.forEach(el=>el.remove());return;}
  if(alle.length>=minimum)return;
  const posities=alle.map(el=>Number(el.getAttribute("x"))).filter(Number.isFinite);
  const y=Number(g.pt)+Number(g.ih)+20;
  if(!Number.isFinite(y))return;
  const kleur=getComputedStyle(document.documentElement).getPropertyValue("--ink-45").trim()||"currentColor";
  for(const i of kiesUurLabelIndices(g.TI,minimum,cadans,rand)){
    if(bestaandeUurLabels(svg,g).length>=minimum)break;
    const x=Number(g.x(i)),uur=uurUitIso(g.TI[i]);
    if(!Number.isFinite(x)||!Number.isInteger(uur)||posities.some(p=>Math.abs(p-x)<18))continue;
    const el=document.createElementNS(SVG_NS,"text");
    el.setAttribute("x",String(x));el.setAttribute("y",String(y));
    el.setAttribute("text-anchor","middle");el.setAttribute("fill",kleur);
    el.setAttribute("font-size","8.5");stileerUurAsLabel(el);
    el.setAttribute("data-mobile-hour-axis","1");el.textContent=uurAsLabelTekst(String(uur));
    const regen=svg.querySelector('g[data-q4-rain-periods]'),scrub=svg.querySelector("#scrub");
    svg.insertBefore(el,regen||scrub||null);posities.push(x);
  }
}

function polishMobieleGrafiekRanden(){
  if(!mobiel())return;
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||!g.M||!Number.isFinite(Number(g.W)))return;
  const W=Number(g.W),top=Number(g.pt),bottom=top+Number(g.ih),marge=5;
  if(![W,top,bottom].every(Number.isFinite)||bottom<=top)return;

  /* De uur-as wordt eerst volledig opgebouwd en pas daarna tegen de viewBox
     begrensd. Zo blijft ook een fallback-label op het laatste uur volledig leesbaar. */
  bestaandeUurLabels(svg,g).forEach(el=>{
    const correctie=randCorrectieVoorTekstBox(svgTekstBoxUitElement(el),W,marge);
    if(!correctie)return;
    el.setAttribute("x",String(correctie.x));
    el.setAttribute("text-anchor",correctie.anker);
    el.setAttribute("data-mobile-edge-adjusted","1");
  });

  const temperaturen=Array.isArray(g.T)?g.T:[];
  const punten=[...svg.querySelectorAll("circle[data-temp-index]")].map(el=>({
    el,i:Number(el.getAttribute("data-temp-index")),x:Number(el.getAttribute("cx")),y:Number(el.getAttribute("cy"))
  })).filter(p=>Number.isInteger(p.i)&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(Number(temperaturen[p.i])));
  const labels=[...svg.querySelectorAll("text")].filter(el=>{
    const ff=String(el.getAttribute("font-family")||"");
    return /Bodoni/i.test(ff)&&/^-?\d+°$/.test(String(el.textContent||"").trim());
  }).sort((a,b)=>Number(a.getAttribute("x"))-Number(b.getAttribute("x")));
  const gebruikt=new Set(),maxDx=Math.max(54,(Number(g.cw)||0)*3);

  labels.forEach(el=>{
    const m=/^(-?\d+)°$/.exec(String(el.textContent||"").trim()),lx=Number(el.getAttribute("x"));
    if(!m||!Number.isFinite(lx))return;
    const doel=Number(m[1]);
    let beste=null,afstand=Infinity;
    for(const p of punten){
      if(gebruikt.has(p.i)||Math.round(Number(temperaturen[p.i]))!==doel)continue;
      const d=Math.abs(p.x-lx);
      if(d<afstand){beste=p;afstand=d;}
    }
    if(!beste||afstand>maxDx)return;
    gebruikt.add(beste.i);
    el.setAttribute("data-mobile-temp-index",String(beste.i));
    const huidigY=Number(el.getAttribute("y")),nieuwY=begrensTemperatuurLabelY(huidigY,beste.y,top,bottom,42);
    if(Number.isFinite(nieuwY)&&nieuwY!==huidigY){
      el.setAttribute("y",String(nieuwY));
      el.setAttribute("data-mobile-detached-temp-fixed","1");
    }
    const correctie=randCorrectieVoorTekstBox(svgTekstBoxUitElement(el),W,marge);
    if(correctie){
      el.setAttribute("x",String(correctie.x));
      el.setAttribute("text-anchor",correctie.anker);
      el.setAttribute("data-mobile-edge-adjusted","1");
    }
  });
}

function verminderMobieleTemperatuurlabels(){
  if(!mobiel()||window.innerWidth>430)return;
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||!g.M||Number(g.n)>25||!Array.isArray(g.T)||!Array.isArray(g.TI)||typeof g.x!=="function"||typeof g.y!=="function")return;
  const top=Number(g.pt),bottom=top+Number(g.ih),W=Number(g.W);
  if(![top,bottom,W].every(Number.isFinite)||bottom<=top)return;

  const alleTemperatuurTeksten=[...svg.querySelectorAll("text")].filter(el=>{
    const ff=String(el.getAttribute("font-family")||"");
    return !el.closest("#scrub")&&/Bodoni/i.test(ff)&&/^-?\\d+°$/.test(String(el.textContent||"").trim());
  });
  const tekstSjabloon=alleTemperatuurTeksten[0]||null,puntSjabloon=svg.querySelector("circle[data-temp-index]");
  const labelPerIndex=new Map();
  alleTemperatuurTeksten.forEach(el=>{
    const i=Number(el.getAttribute("data-mobile-temp-index"));
    if(Number.isInteger(i)&&!labelPerIndex.has(i))labelPerIndex.set(i,el);
  });
  const puntPerIndex=new Map([...svg.querySelectorAll("circle[data-temp-index]")].map(el=>[Number(el.getAttribute("data-temp-index")),el]).filter(([i])=>Number.isInteger(i)));
  const plan=mobieleTemperatuurLabelPlan(g.TI,g.T,24),ankerSet=new Set(plan.ankers);
  const extremaAlle=lokaleTemperatuurExtrema(g.T,24),extremumPerIndex=new Map(extremaAlle.map(e=>[e.i,e.type]));

  const nuPunt=[...svg.querySelectorAll("circle")].find(el=>String(el.getAttribute("fill")||"")===String(CARMINE)&&Math.abs(Number(el.getAttribute("r"))-3)<.2);
  const nuX=nuPunt?Number(nuPunt.getAttribute("cx")):NaN;
  const nuTekst=[...svg.querySelectorAll("text")].find(el=>/^nu(?:\s|$)/i.test(String(el.textContent||"").trim()));
  const actueleTemperatuur=S.d&&S.d.current&&S.d.current.temperature_2m;
  if(nuPunt&&nuTekst&&actueleTemperatuur!==null&&actueleTemperatuur!==undefined&&Number.isFinite(Number(actueleTemperatuur))){
    nuTekst.textContent="nu "+Math.round(Number(actueleTemperatuur))+"°";
  }
  const nuAnker=Number.isFinite(nuX)?plan.ankers.find(i=>Math.abs(Number(g.x(i))-nuX)<=.75):undefined;
  if(nuTekst){
    if(Number.isInteger(nuAnker))nuTekst.setAttribute("data-mobile-temp-anchor-index",String(nuAnker));
    else nuTekst.removeAttribute("data-mobile-temp-anchor-index");
  }

  const gewenste=[...plan.ankers.filter(i=>i!==nuAnker),...plan.extrema.map(e=>e.i).filter(i=>i!==nuAnker)],gewenstSet=new Set(gewenste);
  alleTemperatuurTeksten.forEach(el=>{
    const i=Number(el.getAttribute("data-mobile-temp-index"));
    if(!Number.isInteger(i)||!gewenstSet.has(i)||labelPerIndex.get(i)!==el)el.remove();
  });
  [...puntPerIndex].forEach(([i,el])=>{if(!gewenstSet.has(i))el.remove();});

  const ink=getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()||"currentColor";
  const sheet=getComputedStyle(document.documentElement).getPropertyValue("--sheet").trim()||"white";
  const invoegVoor=()=>svg.querySelector('g[data-q4-rain-periods]')||svg.querySelector("#scrub")||null;
  const zorgPunt=i=>{
    let el=puntPerIndex.get(i);
    if(!el||!el.isConnected){
      el=puntSjabloon?puntSjabloon.cloneNode(false):document.createElementNS(SVG_NS,"circle");
      svg.insertBefore(el,invoegVoor());
    }
    el.setAttribute("data-temp-index",String(i));el.setAttribute("data-mobile-temp-point","1");
    el.setAttribute("cx",String(Number(g.x(i))));el.setAttribute("cy",String(Number(g.y(Number(g.T[i])))));
    el.setAttribute("r","1.8");el.setAttribute("fill",el.getAttribute("fill")||ink);el.setAttribute("opacity",".62");
    return el;
  };
  const zorgLabel=i=>{
    let el=labelPerIndex.get(i);
    if(!el||!el.isConnected){
      el=tekstSjabloon?tekstSjabloon.cloneNode(false):document.createElementNS(SVG_NS,"text");
      svg.insertBefore(el,invoegVoor());
    }
    el.textContent=Math.round(Number(g.T[i]))+"°";
    el.setAttribute("data-mobile-temp-index",String(i));
    el.setAttribute("font-family",el.getAttribute("font-family")||"Bodoni Moda,Georgia,serif");
    el.setAttribute("font-size","10");el.setAttribute("opacity",".86");
    el.setAttribute("fill",el.getAttribute("fill")||ink);el.setAttribute("stroke",el.getAttribute("stroke")||sheet);
    el.setAttribute("stroke-width","2");el.setAttribute("paint-order","stroke");el.setAttribute("stroke-linejoin","round");
    el.setAttribute("text-anchor","middle");el.removeAttribute("dy");el.removeAttribute("data-mobile-detached-temp-fixed");el.removeAttribute("data-mobile-edge-adjusted");
    return el;
  };

  const vaste=[...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&!el.hasAttribute("data-mobile-temp-index"))
    .map(svgTekstBoxUitElement).filter(Boolean);
  if(Number.isFinite(nuX))vaste.push({x:nuX-3,y:top,width:6,height:bottom-top});
  const gehouden=[],behouden=new Set(),marge=5,minAfstand=3;
  const plaats=(i,verplicht,volgnummer)=>{
    if(!Number.isFinite(Number(g.T[i])))return false;
    const punt=zorgPunt(i),px=Number(punt.getAttribute("cx")),py=Number(punt.getAttribute("cy")),el=zorgLabel(i);
    const type=extremumPerIndex.get(i)||"",fs=10,probe=geschatteSvgTekstBox(el.textContent,px,py-14,"middle",fs),half=probe?probe.width/2:10;
    const klemX=x=>Math.max(marge+half,Math.min(W-marge-half,x));
    const xKandidaten=[px,px+12,px-12,px+18,px-18].map(klemX).filter((x,pos,arr)=>arr.findIndex(v=>Math.abs(v-x)<.1)===pos);
    const boven=[py-14,py-28,py-42,top+fs+5],onder=[py+20,py+34,py+48,bottom-5];
    const eerstBoven=type==="piek"?true:type==="dal"?false:volgnummer%2===0;
    const yKandidaten=(eerstBoven?[...boven,...onder]:[...onder,...boven])
      .filter((y,pos,arr)=>y-fs>=top+4&&y<=bottom-4&&arr.findIndex(v=>Math.abs(v-y)<.1)===pos);
    let gekozen=null;
    for(const y of yKandidaten){
      for(const x of xKandidaten){
        const box=geschatteSvgTekstBox(el.textContent,x,y,"middle",fs);
        if(!box||[...vaste,...gehouden].some(b=>rechthoekenBotsen(b,box,minAfstand)))continue;
        gekozen={x,y,box};break;
      }
      if(gekozen)break;
    }
    if(!gekozen){
      if(!verplicht){el.remove();punt.remove();return false;}
      /* Acht drie-uursankers liggen horizontaal ruim uit elkaar. Deze laatste
         lane is uitsluitend een fail-safe tegen andere vaste SVG-copy; hij
         blijft binnen de plot en maximaal licht horizontaal verschoven. */
      for(const y of [top+fs+5,bottom-5]){
        for(const x of xKandidaten){
          const box=geschatteSvgTekstBox(el.textContent,x,y,"middle",fs);
          if(!box||gehouden.some(b=>rechthoekenBotsen(b,box,minAfstand)))continue;
          gekozen={x,y,box};break;
        }
        if(gekozen)break;
      }
    }
    if(!gekozen){el.remove();punt.remove();return false;}
    el.setAttribute("x",String(gekozen.x));el.setAttribute("y",String(gekozen.y));
    el.setAttribute("data-mobile-temp-priority",verplicht?"anchor":"extremum");
    if(type)el.setAttribute("data-mobile-temp-extremum",type);else el.removeAttribute("data-mobile-temp-extremum");
    if(Math.abs(gekozen.x-px)<.1){el.setAttribute("data-mobile-point-aligned","1");el.removeAttribute("data-mobile-point-shifted");}
    else{el.removeAttribute("data-mobile-point-aligned");el.setAttribute("data-mobile-point-shifted","1");}
    gehouden.push(gekozen.box);behouden.add(i);return true;
  };

  plan.ankers.forEach((i,pos)=>{if(i!==nuAnker)plaats(i,true,pos);});
  plan.extrema.forEach((e,pos)=>{if(e.i!==nuAnker)plaats(e.i,false,plan.ankers.length+pos);});
  [...svg.querySelectorAll("text[data-mobile-temp-index]")].forEach(el=>{if(!behouden.has(Number(el.getAttribute("data-mobile-temp-index"))))el.remove();});
  [...svg.querySelectorAll("circle[data-mobile-temp-point]")].forEach(el=>{if(!behouden.has(Number(el.getAttribute("data-temp-index"))))el.remove();});
  svg.setAttribute("data-mobile-temp-anchor-count",String(plan.ankers.length));
  svg.setAttribute("data-mobile-temp-extrema-count",String(plan.extrema.length));
  svg.setAttribute("data-mobile-temp-visible",String(behouden.size+(Number.isInteger(nuAnker)?1:0)));
}
function vereenvoudigMobieleZonband(){
  if(!mobiel()||window.innerWidth>430)return;
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||!g.M||Number(g.n)>25)return;
  /* #suntimes boven de grafiek noemt opkomst/ondergang al volledig. De tweede
     tekstlaag ín de SVG voegde vooral drukte toe; de nachtband en exacte
     overgangslijnen blijven gewoon zichtbaar. */
  [...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&!el.closest('g[data-q4-rain-periods]')&&/^zon (?:op|onder) \d{2}:\d{2}$/i.test(String(el.textContent||"").trim())).forEach(el=>el.remove());
  svg.setAttribute("data-mobile-sun-band-compact","1");
}

function compactMobieleGrafiekHoogte(){
  if(!mobiel()||window.innerWidth>430)return;
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||!g.M||Number(g.n)>25)return;
  const delen=String(svg.getAttribute("viewBox")||"").trim().split(/\s+/).map(Number);
  if(delen.length!==4||!delen.every(Number.isFinite))return;
  const plotOnder=Number(g.pt)+Number(g.ih);if(!Number.isFinite(plotOnder))return;
  let zichtbaarOnder=plotOnder+24;
  /* Ook regenperiode-labels tellen mee voor de zichtbare onderrand. Anders kan
     een natte mobiele grafiek juist de bracket-tijden/bedragen afsnijden wanneer
     de algemene witruimte wordt gecompacteerd. Alleen de interactieve scrubtekst
     hoort niet bij de vaste layoutreserve. */
  [...svg.querySelectorAll("text")].forEach(el=>{
    if(el.closest("#scrub"))return;
    const box=svgTekstBoxUitElement(el);if(box)zichtbaarOnder=Math.max(zichtbaarOnder,box.y+box.height);
  });
  /* Een natte grafiek heeft vaste bracket-tijden en periodetotalen onder de
     temperatuurplot. Die zijn inhoud, geen lege witruimte: behoud daarvoor de
     canonieke 296px-reserve. Een droge grafiek mag wel verder comprimeren. */
  if(svg.querySelector('g[data-q4-rain-periods] text'))zichtbaarOnder=Math.max(zichtbaarOnder,286);
  const doel=mobieleGrafiekCompactHoogte(plotOnder,delen[3],zichtbaarOnder);
  if(doel!==null&&doel<delen[3]-4){
    svg.setAttribute("viewBox",[delen[0],delen[1],delen[2],doel].join(" "));
    svg.setAttribute("data-mobile-compact-height","1");
  }
}

let uurAsToken=0;
function planUurAsHerstel(){
  const token=++uurAsToken;
  const voer=()=>{if(token===uurAsToken){herstelUurAs();polishMobieleGrafiekRanden();vereenvoudigMobieleZonband();verminderMobieleTemperatuurlabels();compactMobieleGrafiekHoogte();}};
  const start=()=>{
    const r1=()=>{const r2=()=>voer();if(typeof requestAnimationFrame==="function")requestAnimationFrame(r2);else setTimeout(r2,0);};
    if(typeof requestAnimationFrame==="function")requestAnimationFrame(r1);else setTimeout(r1,0);
    setTimeout(voer,120);setTimeout(voer,350);
  };
  const fonts=document.fonts&&document.fonts.ready;
  if(fonts&&typeof fonts.then==="function")fonts.then(start).catch(start);else start();
}

function polishNuLabel(){
  const svg=document.getElementById("chart");if(!svg)return;
  const teksten=[...svg.querySelectorAll("text")],nu=teksten.find(el=>/^nu(?:\s|$)/i.test(String(el.textContent||"").trim()));
  if(!nu)return;
  nu.removeAttribute("data-now-collision-adjusted");nu.removeAttribute("dy");
  const vak=svgTekstBoxUitElement(nu);if(!vak)return;
  const temperatuurLabels=teksten.filter(el=>el!==nu&&/^-?\d+(?:[.,]\d+)?°$/.test(String(el.textContent||"").trim()));
  const botst=temperatuurLabels.some(el=>rechthoekenBotsen(vak,svgTekstBoxUitElement(el),3));
  if(botst){nu.setAttribute("dy","12");nu.setAttribute("data-now-collision-adjusted","1");}
}
let nuPolishToken=0;
function planNuLabelPolish(){
  const token=++nuPolishToken,voer=()=>{if(token===nuPolishToken)polishNuLabel();};
  if(typeof requestAnimationFrame==="function")requestAnimationFrame(()=>requestAnimationFrame(voer));else setTimeout(voer,0);
}

function werkNeerslagSleutelBij(){
  const waarde=document.getElementById("pop"),stat=waarde&&waarde.closest(".stat"),sleutel=stat&&stat.querySelector(".mobile-neerslag-sleutel"),sub=document.getElementById("popsub");
  if(!waarde||!sleutel)return;
  const tekst=neerslagSleutelTekst(waarde.textContent,sub&&sub.textContent),zichtbaar=String(waarde.textContent||"").replace(/\s+/g," ").trim();
  const zichtbareSleutel=tekst==="kans · verwachte hoeveelheid"?"kans · totaal komend uur":tekst;
  sleutel.textContent=zichtbareSleutel;sleutel.hidden=!zichtbareSleutel;
  if(/%/.test(zichtbaar)&&/\bmm\b/i.test(zichtbaar)){
    waarde.setAttribute("aria-label","Komend uur: "+zichtbaar+". Eerst de neerslagkans, daarna het verwachte totaal in het komende uur.");
  }else if(/%/.test(zichtbaar)){
    const pct=(zichtbaar.match(/\d+\s*%/)||[])[0]||zichtbaar;
    waarde.setAttribute("aria-label",tekst.includes("onzeker")?"Komend uur: "+pct+" kans. De verwachte hoeveelheid is onzeker.":"Komend uur: "+pct+" kans.");
  }
}
function resourceEntries(){
  try{return typeof performance!=="undefined"&&typeof performance.getEntriesByType==="function"?performance.getEntriesByType("resource"):[];}catch(_){return [];}
}
function werkBronnenBij(){
  /* Providerlagen kunnen KNMI pas ná de eerste footeropbouw toevoegen. Laat de
     structurele owner eerst losse middot/slash-tekst normaliseren naar een echt
     bronitem; daarna pas bepalen we zichtbaarheid en het oneven-gridritme. */
  const structureer=root.WeatherNowMobileScreenshotPolish&&root.WeatherNowMobileScreenshotPolish.structureerBronnen;
  if(typeof structureer==="function")structureer();
  const bron=document.querySelector("footer .bron-bronnen");if(!bron)return;
  const label=bron.querySelector(".bronlabel");if(label)label.textContent="Bronnen voor deze weergave";
  const gebruik=bronGebruikUitResources(resourceEntries(),S.land,{forecastBeschikbaar:!!S.d,airBeschikbaar:false});
  const items=[...bron.querySelectorAll(".bronitem")];
  items.forEach(item=>{
    const naam=String(item.textContent||"").replace(/\s+/g," ").trim();
    let actief=true;
    if(naam==="Open-Meteo")actief=gebruik.openmeteo;
    else if(naam==="CAMS")actief=gebruik.cams;
    else if(naam==="MeteoAlarm")actief=gebruik.meteoalarm;
    else if(naam==="National Weather Service")actief=gebruik.nws;
    else if(naam==="BigDataCloud")actief=gebruik.bigdatacloud;
    else if(/OpenStreetMap/i.test(naam))actief=gebruik.osm;
    else if(naam==="KNMI")actief=gebruik.knmi;
    item.hidden=!actief;
    item.classList.remove("wiw-source-last-odd");
  });
  const zichtbaar=items.filter(item=>!item.hidden);
  if(zichtbaar.length%2===1&&zichtbaar.length)zichtbaar[zichtbaar.length-1].classList.add("wiw-source-last-odd");
}
/* Windstootkop en -subtekst hebben één eigenaar in de base-build. Deze mobiele
   grafiek-/bronlaag raakt die tegel bewust niet meer aan. */
function werkContextBij(){werkNeerslagSleutelBij();werkBronnenBij();}
function naRender(basis,nawerk){
  return function(){const r=basis.apply(this,arguments);nawerk();return r;};
}

if(typeof etmaal==="function"){
  etmaal=naRender(etmaal,()=>{planUurAsHerstel();planNuLabelPolish();});
}
if(typeof meters==="function"){
  meters=naRender(meters,werkContextBij);
}
if(typeof lucht==="function"){
  lucht=naRender(lucht,werkBronnenBij);
}
werkContextBij();planUurAsHerstel();planNuLabelPolish();
setTimeout(werkBronnenBij,450);setTimeout(werkBronnenBij,1400);

})(typeof globalThis!=="undefined"?globalThis:this);

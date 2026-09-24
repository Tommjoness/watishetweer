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
/* De compacte mobiele etmaalgrafiek ankert op het eerste echte zichtbare
   forecastpunt en vervolgt daarna iedere drie lokale klokuren. De providerreeks
   zelf bepaalt welke punten bestaan: geen indexmodulo, geen UTC-verschuiving en
   geen synthetische DST-uren. De 25e rechtergrens valt buiten het rollende etmaal. */
function lokaleForecastMinuten(tijd){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(tijd||""));
  if(!m)return null;
  const ms=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]));
  return Number.isFinite(ms)?Math.round(ms/60000):null;
}
function kiesKalenderUurLabelIndices(tijden,cadans=3,maxPunten=24){
  const T=Array.isArray(tijden)?tijden:[],stap=Math.max(1,Math.floor(Number(cadans)||3))*60;
  const limiet=Math.min(T.length,Math.max(0,Math.floor(Number(maxPunten)||24)));
  let eerste=null;
  for(let i=0;i<limiet;i++){const m=lokaleForecastMinuten(T[i]);if(Number.isFinite(m)){eerste=m;break;}}
  if(!Number.isFinite(eerste))return [];
  const gezien=new Set(),uit=[];
  for(let i=0;i<limiet;i++){
    const minuut=lokaleForecastMinuten(T[i]);if(!Number.isFinite(minuut)||gezien.has(minuut))continue;
    const delta=minuut-eerste;
    if(delta<0||delta>=24*60||delta%stap!==0)continue;
    gezien.add(minuut);uit.push(i);
  }
  return uit;
}

/* Mobiele etmaalgrafiek (<=430px): getallen en lijn zijn gescheiden. Iedere
   drie uur staat de temperatuur in een vaste rij direct boven de uuras. De lijn
   zelf draagt alleen de nu-markering en hooguit twee markeringen: het hoogste
   en het laagste punt van het zichtbare etmaal. Zo kan geen getal met de lijn
   of met een ander getal botsen, bij welk weerverloop dan ook. */
const MOBIEL_ICOON_Y=4,MOBIEL_ICOON_GROOTTE=16,MOBIEL_LIJNLABEL_GROOTTE=12,MOBIELE_UURAS_Y=34,NU_MARKERING_BEREIK_UREN=3;
function mobieleGrafiekMarkeringen(temperaturen,maxPunten=24,nu=null){
  const T=Array.isArray(temperaturen)?temperaturen:[],n=Math.min(T.length,Math.max(0,Math.floor(Number(maxPunten)||24)));
  const geldig=[];for(let i=0;i<n;i++)if(Number.isFinite(Number(T[i])))geldig.push(i);
  if(!geldig.length)return [];
  const r=i=>Math.round(Number(T[i]));
  const hoog=Math.max(...geldig.map(r)),laag=Math.min(...geldig.map(r));
  if(hoog===laag)return [];
  /* Een plateau (gelijke afgeronde waarden achter elkaar) krijgt één markering
     op het middelste punt van het eerste plateau met die waarde. */
  const midden=v=>{
    const begin=geldig.find(i=>r(i)===v);let eind=begin;
    while(eind+1<n&&Number.isFinite(Number(T[eind+1]))&&r(eind+1)===v)eind++;
    return Math.floor((begin+eind)/2);
  };
  const nuIndex=nu&&nu.index!==null&&nu.index!==undefined&&Number.isFinite(Number(nu.index))?Number(nu.index):null;
  const nuWaarde=nu&&nu.waarde!==null&&nu.waarde!==undefined&&Number.isFinite(Number(nu.waarde))?Math.round(Number(nu.waarde)):null;
  return [{type:"max",waarde:hoog,i:midden(hoog)},{type:"min",waarde:laag,i:midden(laag)}]
    /* "nu 20°" maakt een max of min van 20° vlak ernaast overbodig. */
    .filter(m=>!(nuIndex!==null&&nuWaarde===m.waarde&&Math.abs(m.i-nuIndex)<=NU_MARKERING_BEREIK_UREN))
    .sort((a,b)=>a.i-b.i);
}

/* Vloeiende lijn door exact dezelfde datapunten (monotone kubische interpolatie,
   Fritsch-Carlson). Tussen twee punten blijft de curve binnen hun waarden: er
   ontstaan geen verzonnen pieken of dalen, en een vlak stuk blijft vlak. */
function monotoonPad(punten){
  const P=(Array.isArray(punten)?punten:[]).filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
  if(P.length<2)return "";
  const f=v=>String(Math.round(v*100)/100);
  if(P.length===2)return `M${f(P[0][0])},${f(P[0][1])} L${f(P[1][0])},${f(P[1][1])}`;
  const n=P.length,d=[],m=new Array(n);
  for(let k=0;k<n-1;k++){const dx=P[k+1][0]-P[k][0];d.push(dx?(P[k+1][1]-P[k][1])/dx:0);}
  m[0]=d[0];m[n-1]=d[n-2];
  for(let k=1;k<n-1;k++)m[k]=d[k-1]*d[k]<=0?0:(d[k-1]+d[k])/2;
  for(let k=0;k<n-1;k++){
    if(d[k]===0){m[k]=0;m[k+1]=0;continue;}
    const a=m[k]/d[k],b=m[k+1]/d[k],som=a*a+b*b;
    if(som>9){const t=3/Math.sqrt(som);m[k]=t*a*d[k];m[k+1]=t*b*d[k];}
  }
  let pad=`M${f(P[0][0])},${f(P[0][1])}`;
  for(let k=0;k<n-1;k++){
    const h=P[k+1][0]-P[k][0];
    pad+=` C${f(P[k][0]+h/3)},${f(P[k][1]+m[k]*h/3)} ${f(P[k+1][0]-h/3)},${f(P[k+1][1]-m[k+1]*h/3)} ${f(P[k+1][0])},${f(P[k+1][1])}`;
  }
  return pad;
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
function lijnRaaktTekstBox(punten,box,marge=3){
  if(!box||!Array.isArray(punten))return false;
  for(let i=1;i<punten.length;i++){
    const a=punten[i-1],b=punten[i];
    if(!Array.isArray(a)||!Array.isArray(b)||![...a,...b].every(Number.isFinite))continue;
    const links=Math.max(box.x-marge,Math.min(a[0],b[0]));
    const rechts=Math.min(box.x+box.width+marge,Math.max(a[0],b[0]));
    if(links>rechts)continue;
    const yLinks=a[1]+(b[1]-a[1])*(links-a[0])/(b[0]-a[0]||1);
    const yRechts=a[1]+(b[1]-a[1])*(rechts-a[0])/(b[0]-a[0]||1);
    if(Math.min(yLinks,yRechts)<=box.y+box.height+marge&&Math.max(yLinks,yRechts)>=box.y-marge)return true;
  }
  return false;
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

const api={uurUitIso,uurAsLabelTekst,kiesUurLabelIndices,kiesKalenderUurLabelIndices,lokaleForecastMinuten,mobieleGrafiekMarkeringen,monotoonPad,MOBIEL_ICOON_Y,MOBIEL_ICOON_GROOTTE,MOBIEL_LIJNLABEL_GROOTTE,MOBIELE_UURAS_Y,isUurAsLabel,waarschuwingBronnenVoorLand,neerslagSleutelTekst,bronGebruikUitResources,rechthoekenBotsen,lijnRaaktTekstBox,geschatteSvgTekstBox,randCorrectieVoorTekstBox,begrensTemperatuurLabelY,mobieleTemperatuurLabelLimiet,kiesMobieleTemperatuurLabelIndices,prioriteerMobieleTemperatuurLabelIndices,mobieleGrafiekCompactHoogte};
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
    /* Eén mobiele eigenaar: het eerste echte zichtbare forecastpunt en daarna
       iedere drie lokale klokuren; de 25e rechtergrens telt niet nogmaals mee. */
    alle.forEach(el=>el.remove());
    const indices=kiesKalenderUurLabelIndices(g.TI,3,24),y=Number(g.pt)+Number(g.ih)+MOBIELE_UURAS_Y;
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
    return !el.hasAttribute("data-mobile-temp-label")&&!el.hasAttribute("data-mobile-temp-marker")&&/Bodoni/i.test(ff)&&/^-?\d+°$/.test(String(el.textContent||"").trim());
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

function bouwMobieleTemperatuurRij(){
  if(!mobiel()||window.innerWidth>430)return;
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||!g.M||Number(g.n)>25||!Array.isArray(g.T)||!Array.isArray(g.TI)||typeof g.x!=="function"||typeof g.y!=="function")return;
  const top=Number(g.pt),bottom=top+Number(g.ih),W=Number(g.W),marge=5;
  if(![top,bottom,W].every(Number.isFinite)||bottom<=top)return;
  const wortel=getComputedStyle(document.documentElement);
  const ink=wortel.getPropertyValue("--ink").trim()||"currentColor",sheet=wortel.getPropertyValue("--sheet").trim()||"white";
  const voorScrub=el=>svg.insertBefore(el,svg.querySelector('g[data-q4-rain-periods]')||svg.querySelector("#scrub")||null);

  /* Idempotent: iedere pass (rAF, timers, fontload) bouwt labels, markeringen,
     vlak en iconen opnieuw op. Temperatuurcijfers van de basisgrafiek verdwijnen. */
  [...svg.querySelectorAll("text")].filter(el=>{
    if(el.closest("#scrub"))return false;
    const ff=String(el.getAttribute("font-family")||""),tekst=String(el.textContent||"").trim();
    return el.hasAttribute("data-mobile-temp-index")||el.hasAttribute("data-mobile-temp-marker")||(/Bodoni/i.test(ff)&&/^-?\d+°$/.test(tekst));
  }).forEach(el=>el.remove());
  svg.querySelectorAll("circle[data-mobile-temp-marker-dot],[data-mobile-temp-area],[data-mobile-weather-icon]").forEach(el=>el.remove());

  const ankers=kiesKalenderUurLabelIndices(g.TI,3,24).filter(i=>Number.isFinite(Number(g.T[i])));
  const puntSjabloon=svg.querySelector("circle[data-temp-index]");
  const puntPerIndex=new Map([...svg.querySelectorAll("circle[data-temp-index]")].map(el=>[Number(el.getAttribute("data-temp-index")),el]));

  /* Vloeiende lijn: dezelfde punten, monotone curve. De punten blijven als
     attribuut beschikbaar voor de botsingscontrole van labels en nu-label. */
  [...svg.querySelectorAll("polyline")].filter(el=>!el.closest("#scrub")).forEach(lijn=>{
    const punten=String(lijn.getAttribute("points")||"").trim();
    const d=monotoonPad(punten.split(/\s+/).map(p=>p.split(",").map(Number)));
    if(!d)return;
    const pad=document.createElementNS(SVG_NS,"path");
    for(const a of [...lijn.attributes])if(a.name!=="points")pad.setAttribute(a.name,a.value);
    pad.setAttribute("d",d);pad.setAttribute("stroke-linecap","round");
    pad.setAttribute("data-mobile-line-points",punten);pad.setAttribute("data-mobile-smooth-line","1");
    lijn.replaceWith(pad);
  });

  /* Zacht vlak onder de lijn: inktkleur die naar onderen wegvalt. Zo werkt het
     in licht, donker en rood nachtlicht zonder eigen kleur. */
  const hoofdlijn=svg.querySelector("path[data-mobile-smooth-line]");
  if(hoofdlijn){
    const punten=String(hoofdlijn.getAttribute("data-mobile-line-points")||"").trim().split(/\s+/).map(p=>p.split(",").map(Number)).filter(p=>p.length===2&&p.every(Number.isFinite));
    if(punten.length>1){
      const defs=document.createElementNS(SVG_NS,"defs");defs.setAttribute("data-mobile-temp-area","defs");
      const verloop=document.createElementNS(SVG_NS,"linearGradient");
      verloop.setAttribute("id","mobielTempVlak");verloop.setAttribute("x1","0");verloop.setAttribute("y1","0");verloop.setAttribute("x2","0");verloop.setAttribute("y2","1");
      [["0",".13"],["1","0"]].forEach(([offset,dekking])=>{const stop=document.createElementNS(SVG_NS,"stop");stop.setAttribute("offset",offset);stop.setAttribute("stop-color",ink);stop.setAttribute("stop-opacity",dekking);verloop.appendChild(stop);});
      defs.appendChild(verloop);svg.insertBefore(defs,svg.firstChild);
      const vlak=document.createElementNS(SVG_NS,"path");
      vlak.setAttribute("d",hoofdlijn.getAttribute("d")+` L${punten[punten.length-1][0]},${bottom} L${punten[0][0]},${bottom} Z`);
      vlak.setAttribute("fill","url(#mobielTempVlak)");vlak.setAttribute("stroke","none");vlak.setAttribute("data-mobile-temp-area","1");
      hoofdlijn.parentNode.insertBefore(vlak,hoofdlijn);
    }
  }

  /* Weericoon per drie-uursanker, tussen plot en uuras. Dezelfde lijniconen
     als bovenaan de pagina; zonder weercode voor dat uur geen icoon. */
  const uren=S.d&&S.d.hourly,uurIndex=new Map(uren&&Array.isArray(uren.time)?uren.time.map((t,k)=>[t,k]):[]);
  if(typeof icon==="function"&&uren&&Array.isArray(uren.weather_code))ankers.forEach(i=>{
    const k=uurIndex.get(g.TI[i]),code=k===undefined?null:uren.weather_code[k];
    if(code===null||code===undefined||!Number.isFinite(Number(code)))return;
    const dag=!Array.isArray(uren.is_day)||uren.is_day[k]!==0;
    const markup=String(icon(Number(code),dag,MOBIEL_ICOON_GROOTTE)).replace(/^<svg[^>]*>/,"").replace(/<\/svg>$/,"");
    const x=Math.min(Math.max(Number(g.x(i)),Number(g.x(0))),W-marge-MOBIEL_ICOON_GROOTTE/2);
    const groep=document.createElementNS(SVG_NS,"g");groep.innerHTML=markup;
    groep.setAttribute("transform",`translate(${x-MOBIEL_ICOON_GROOTTE/2},${bottom+MOBIEL_ICOON_Y}) scale(${MOBIEL_ICOON_GROOTTE/24})`);
    groep.setAttribute("color",ink);groep.setAttribute("opacity",".78");groep.setAttribute("aria-hidden","true");
    groep.setAttribute("data-mobile-weather-icon",String(i));voorScrub(groep);
  });

  /* Nu-markering: waarde en (fractionele) uurpositie van de rode lijn. */
  const nuPunt=[...svg.querySelectorAll("circle")].find(el=>String(el.getAttribute("fill")||"")===String(CARMINE)&&Math.abs(Number(el.getAttribute("r"))-3)<.2);
  const nuX=nuPunt?Number(nuPunt.getAttribute("cx")):NaN;
  const nuTekst=[...svg.querySelectorAll("text")].find(el=>/^nu(?:\s|$)/i.test(String(el.textContent||"").trim()));
  const actueel=S.d&&S.d.current&&S.d.current.temperature_2m;
  const actueelGeldig=actueel!==null&&actueel!==undefined&&Number.isFinite(Number(actueel));
  if(nuPunt&&nuTekst&&actueelGeldig)nuTekst.textContent="nu "+Math.round(Number(actueel))+"°";
  if(nuTekst)nuTekst.removeAttribute("data-mobile-temp-anchor-index");
  const uurBreedte=Number(g.x(1))-Number(g.x(0));
  const nuIndex=Number.isFinite(nuX)&&uurBreedte>0?(nuX-Number(g.x(0)))/uurBreedte:null;

  /* Alle temperatuurlabels op de lijn delen één stijl met de grote temperatuur
     bovenaan. Een positie telt alleen als ze vrij is van de lijn, de nu-lijn en
     alle bestaande tekst (nu-label, asgetallen, regenperiodes); past ze nergens,
     dan vervalt het label liever dan te botsen. */
  const vast=[...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")).map(svgTekstBoxUitElement).filter(Boolean);
  /* Plafond: een label mag boven de plotrand uitsteken tot net onder de dag/
     nachtband. Anders valt de temperatuur bij een piek vlak onder de bovenste
     asgrens onder de lijn, waar ze niet meer bij haar punt hoort. Alleen wat
     duidelijk boven de plot ligt telt als band, niet de bovenste rasterlijn. */
  const bandOnderkanten=[...svg.querySelectorAll("rect,line")].filter(el=>!el.closest("#scrub")).map(el=>el.tagName.toLowerCase()==="rect"
    ?Number(el.getAttribute("y"))+Number(el.getAttribute("height"))
    :Math.max(Number(el.getAttribute("y1")),Number(el.getAttribute("y2")))).filter(b=>Number.isFinite(b)&&b<top-4);
  const plafond=(bandOnderkanten.length?Math.max(...bandOnderkanten):0)+3;
  if(Number.isFinite(nuX))vast.push({x:nuX-3,y:plafond,width:6,height:bottom-plafond});
  /* Links van het eerste uur staan de asgetallen; een label daar leest als asgetal. */
  const asKolom=Number(g.x(0))-4;
  const lijnen=[...svg.querySelectorAll("path[data-mobile-line-points]")]
    .map(el=>String(el.getAttribute("data-mobile-line-points")||"").trim().split(/\s+/).map(p=>p.split(",").map(Number)));
  const fs=MOBIEL_LIJNLABEL_GROOTTE;
  const plaats=(tekst,kandidaten,schuif)=>{
    for(const [x0,y,anker] of kandidaten){
      if(y-fs<plafond||y>bottom-3)continue;
      let box=geschatteSvgTekstBox(tekst,x0,y,anker,fs);if(!box)continue;
      let x=x0;
      if(box.x<marge)x+=marge-box.x;else if(box.x+box.width>W-marge)x-=box.x+box.width-(W-marge);
      box=geschatteSvgTekstBox(tekst,x,y,anker,fs);
      if(box&&box.x<asKolom){if(!schuif)continue;x+=asKolom-box.x;box=geschatteSvgTekstBox(tekst,x,y,anker,fs);}
      if(box&&!vast.some(b=>rechthoekenBotsen(b,box,3))&&!lijnen.some(punten=>lijnRaaktTekstBox(punten,box,1)))return {x,y,anker,box};
    }
    return null;
  };
  const label=(tekst,pos)=>{
    const el=document.createElementNS(SVG_NS,"text");el.textContent=tekst;
    el.setAttribute("x",String(pos.x));el.setAttribute("y",String(pos.y));el.setAttribute("text-anchor",pos.anker);
    el.setAttribute("font-family","Bodoni Moda,Georgia,serif");el.setAttribute("font-size",String(fs));el.setAttribute("fill",ink);
    el.setAttribute("stroke",sheet);el.setAttribute("stroke-width","3");el.setAttribute("paint-order","stroke");el.setAttribute("stroke-linejoin","round");
    vast.push(pos.box);return el;
  };

  /* 1. Piek en dal gaan voor: eerst recht boven (piek) of onder (dal) het punt,
     dan licht verschoven, dan links of rechts ernaast. Alleen de waarde: "min 3°"
     leest als min 3 graden (-3°); stip en plaats zeggen al wat het is. */
  const getoond=[],vervallen=[],markeringen=[];
  mobieleGrafiekMarkeringen(g.T,24,{index:nuIndex,waarde:actueelGeldig?Number(actueel):null}).forEach(m=>{
    const px=Number(g.x(m.i)),py=Number(g.y(Number(g.T[m.i])));if(!Number.isFinite(px)||!Number.isFinite(py))return;
    const boven=py-9,onder=py+18,naast=py+4;
    const verticaal=y=>[[px,y,"middle"],[px+14,y,"middle"],[px-14,y,"middle"]];
    const pos=plaats(m.waarde+"°",[...verticaal(m.type==="max"?boven:onder),[px+7,naast,"start"],[px-7,naast,"end"],...verticaal(m.type==="max"?onder:boven)],false);
    if(!pos){vervallen.push(m.type);return;}
    const dot=document.createElementNS(SVG_NS,"circle");
    dot.setAttribute("cx",String(px));dot.setAttribute("cy",String(py));dot.setAttribute("r","2.2");dot.setAttribute("fill",ink);
    dot.setAttribute("data-mobile-temp-marker-dot",m.type);voorScrub(dot);
    const el=label(m.waarde+"°",pos);
    el.setAttribute("data-mobile-temp-marker",m.type);el.setAttribute("data-mobile-temp-marker-index",String(m.i));
    voorScrub(el);getoond.push(m.type+":"+m.i);markeringen.push({i:m.i,el});
  });

  /* 2. Temperatuur per drie-uursanker, boven het punt op de lijn. Een anker
     binnen een uur van piek of dal, of binnen anderhalf uur van "nu", heeft
     daar al een temperatuur staan en krijgt geen tweede label. */
  const gelabeld=[],gedekt=[],ontbrekend=[];
  ankers.forEach(i=>{
    const x=Number(g.x(i)),y=Number(g.y(Number(g.T[i])));
    let punt=puntPerIndex.get(i);
    const zonderPunt=()=>{if(punt&&punt.isConnected)punt.remove();};
    if(!Number.isFinite(x)||!Number.isFinite(y)){zonderPunt();return;}
    const markering=markeringen.find(m=>Math.abs(m.i-i)<=1);
    if(markering){markering.el.setAttribute("data-mobile-temp-covers-anchor",String(i));gedekt.push(i);zonderPunt();return;}
    if(nuTekst&&Number.isFinite(nuIndex)&&Math.abs(i-nuIndex)<1.5){nuTekst.setAttribute("data-mobile-temp-anchor-index",String(i));gedekt.push(i);zonderPunt();return;}
    const tekst=Math.round(Number(g.T[i]))+"°";
    /* Boven het punt; loopt de lijn daar steil, dan schuin ernaast aan de open
       kant (stijgend: linksboven, dalend: rechtsboven); anders eronder. */
    const pos=plaats(tekst,[[x,y-9,"middle"],[x,y-15,"middle"],[x+6,y-5,"start"],[x-6,y-5,"end"],[x+8,y-9,"middle"],[x-8,y-9,"middle"],
      [x,y+19,"middle"],[x,y+25,"middle"],[x+6,y+15,"start"],[x-6,y+15,"end"]],true);
    if(!pos){ontbrekend.push(i);zonderPunt();return;}
    if(!punt||!punt.isConnected){
      punt=puntSjabloon?puntSjabloon.cloneNode(false):document.createElementNS(SVG_NS,"circle");
      voorScrub(punt);
    }
    punt.setAttribute("data-temp-index",String(i));punt.setAttribute("data-mobile-temp-point","1");
    punt.setAttribute("cx",String(x));punt.setAttribute("cy",String(y));
    punt.setAttribute("r","1.5");punt.setAttribute("fill",ink);punt.setAttribute("opacity",".45");
    const el=label(tekst,pos);
    el.setAttribute("data-mobile-temp-index",String(i));el.setAttribute("data-mobile-temp-label","1");el.setAttribute("data-mobile-temp-priority","anchor");
    if(pos.x!==x)el.setAttribute("data-mobile-edge-adjusted","1");
    voorScrub(el);gelabeld.push(i);
  });
  puntPerIndex.forEach((el,i)=>{if(el.isConnected&&!gelabeld.includes(i))el.remove();});

  svg.setAttribute("data-mobile-temp-line-labels","1");
  svg.setAttribute("data-mobile-temp-anchor-count",String(ankers.length));
  svg.setAttribute("data-mobile-temp-visible",String(gelabeld.length));
  svg.setAttribute("data-mobile-temp-covered",gedekt.join(","));
  svg.setAttribute("data-mobile-temp-markers",getoond.join(","));
  if(vervallen.length)svg.setAttribute("data-mobile-temp-dropped-markers",vervallen.join(","));else svg.removeAttribute("data-mobile-temp-dropped-markers");
  if(ontbrekend.length)svg.setAttribute("data-mobile-temp-missing-anchors",ontbrekend.join(","));else svg.removeAttribute("data-mobile-temp-missing-anchors");
  ["data-mobile-temp-row","data-mobile-temp-dropped-extrema","data-mobile-temp-extrema-count"].forEach(a=>svg.removeAttribute(a));
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
  if(doel===null)return;
  const hoogte=doel<delen[3]-4?doel:delen[3];
  if(hoogte!==delen[3])svg.setAttribute("viewBox",[delen[0],delen[1],delen[2],hoogte].join(" "));
  /* De marker betekent: de hoogte sluit aan op de zichtbare inhoud en alle
     inhoud valt erbinnen. Dat geldt ook wanneer de inhoud (bijv. met de
     temperatuurrij) de canonieke hoogte al vult en er niets in te korten viel. */
  if(zichtbaarOnder<=hoogte)svg.setAttribute("data-mobile-compact-height","1");
  else svg.removeAttribute("data-mobile-compact-height");
}

let uurAsToken=0;
function planUurAsHerstel(){
  const token=++uurAsToken;
  const voer=()=>{if(token===uurAsToken){herstelUurAs();polishMobieleGrafiekRanden();vereenvoudigMobieleZonband();bouwMobieleTemperatuurRij();polishNuLabel();compactMobieleGrafiekHoogte();}};
  const start=()=>{
    const r1=()=>{const r2=()=>voer();if(typeof requestAnimationFrame==="function")requestAnimationFrame(r2);else setTimeout(r2,0);};
    if(typeof requestAnimationFrame==="function")requestAnimationFrame(r1);else setTimeout(r1,0);
    setTimeout(voer,120);setTimeout(voer,350);
  };
  /* De geometrie gebruikt conservatieve attribuutboxen en mag daarom direct
     worden opgebouwd. Wacht niet exclusief op webfonts: file/offline/browser-
     smokes kunnen document.fonts.ready later of niet afronden. Na fontload volgt
     nog één idempotente hercontrole voor echte browserlayout. */
  start();
  const fonts=document.fonts&&document.fonts.ready;
  if(fonts&&typeof fonts.then==="function")fonts.then(()=>{if(token===uurAsToken)voer();}).catch(()=>{});
}

function polishNuLabel(){
  const svg=document.getElementById("chart");if(!svg)return;
  const teksten=[...svg.querySelectorAll("text")],nu=teksten.find(el=>/^nu(?:\s|$)/i.test(String(el.textContent||"").trim()));
  if(!nu)return;
  nu.removeAttribute("data-now-collision-adjusted");nu.removeAttribute("dy");
  if(!mobiel()||window.innerWidth>430){
    const vak=svgTekstBoxUitElement(nu);
    if(vak&&teksten.some(el=>el!==nu&&/^-?\d+(?:[.,]\d+)?°$/.test(String(el.textContent||"").trim())&&rechthoekenBotsen(vak,svgTekstBoxUitElement(el),3))){
      nu.setAttribute("dy","12");nu.setAttribute("data-now-collision-adjusted","1");
    }
    return;
  }
  if(!nu.hasAttribute("data-now-base-x")){
    nu.setAttribute("data-now-base-x",nu.getAttribute("x"));nu.setAttribute("data-now-base-y",nu.getAttribute("y"));
  }
  const oorspronkelijkX=Number(nu.getAttribute("data-now-base-x")),oorspronkelijkY=Number(nu.getAttribute("data-now-base-y"));
  const g=typeof S!=="undefined"&&S.geo,breed=svg.viewBox.baseVal.width;
  if(!Number.isFinite(oorspronkelijkX)||!Number.isFinite(oorspronkelijkY)||!g)return;
  const punt=svg.querySelector('circle[fill="var(--carmine)"][r="3"]');
  const puntY=punt?Number(punt.getAttribute("cy")):NaN;
  const vast=teksten.filter(el=>el!==nu&&!el.closest("#scrub")).map(svgTekstBoxUitElement).filter(Boolean);
  const lijnen=[...svg.querySelectorAll("polyline,path[data-mobile-line-points]")].filter(el=>!el.closest("#scrub"))
    .map(el=>String(el.getAttribute("points")||el.getAttribute("data-mobile-line-points")||"").trim().split(/\s+/).map(p=>p.split(",").map(Number)));
  const vrij=(x,y)=>{
    const box=geschatteSvgTekstBox(nu.textContent,x,y,"start",Number(nu.getAttribute("font-size"))||10);
    return box&&box.x>=g.pl-2&&box.x+box.width<=breed-g.pr+3
      &&box.y>=g.pt-18&&box.y+box.height<=g.pt+g.ih-3
      &&(!Number.isFinite(puntY)||Math.abs(y-puntY)>=12)
      &&!vast.some(b=>rechthoekenBotsen(box,b,3))
      &&!lijnen.some(punten=>lijnRaaktTekstBox(punten,box));
  };
  /* Laatste uitwijkplek: bovenaan de rode nu-lijn, net boven de plot. Die plek
     is vrij van de temperatuurlijn wanneer die vlak naast "nu" steil loopt. */
  const posities=[[0,0],[0,-16],[0,16],[0,-24],[0,24],[12,-16],[12,16],[-12,-16],[-12,16],[0,-30],[0,30],[0,Number(g.pt)-4-oorspronkelijkY]];
  const gevonden=posities.find(([dx,dy])=>vrij(oorspronkelijkX+dx,oorspronkelijkY+dy));
  if(gevonden){
    nu.setAttribute("x",String(oorspronkelijkX+gevonden[0]));nu.setAttribute("y",String(oorspronkelijkY+gevonden[1]));
    if(gevonden[0]||gevonden[1])nu.setAttribute("data-now-collision-adjusted","1");
  }
  /* Bij een uitzonderlijk volle curve blijft tekst ook zonder vrije positie
     leesbaar doordat de achtergrond de onderliggende lijn vrijhoudt. */
  nu.setAttribute("stroke",getComputedStyle(document.documentElement).getPropertyValue("--sheet").trim()||"white");
  nu.setAttribute("stroke-width","3");nu.setAttribute("paint-order","stroke");nu.setAttribute("stroke-linejoin","round");
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
/* De KNMI-attributie komt soms pas na deze timers vanuit de providerlaag. */
const bronFooter=document.querySelector("footer .bron-bronnen");
if(bronFooter&&typeof MutationObserver!=="undefined"){
  const bronObserver=new MutationObserver(()=>{
    if(bronFooter.querySelector(":scope > #knmi-bron-inline"))werkBronnenBij();
  });
  bronObserver.observe(bronFooter,{childList:true});
}

})(typeof globalThis!=="undefined"?globalThis:this);

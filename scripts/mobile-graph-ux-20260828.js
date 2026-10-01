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
const DESKTOP_ICOON_Y=8,DESKTOP_ICOON_GROOTTE=18;
/* rand: de temperatuur direct vóór en na het getoonde venster, als die bekend
   is. Een hoogste of laagste punt op de rand is alleen een piek of dal als de
   reeks daarbuiten niet verder stijgt of daalt; anders is het slechts het
   eind van het venster en krijgt het geen markering. */
function mobieleGrafiekMarkeringen(temperaturen,maxPunten=24,nu=null,rand=null){
  const T=Array.isArray(temperaturen)?temperaturen:[],n=Math.min(T.length,Math.max(0,Math.floor(Number(maxPunten)||24)));
  const geldig=[];for(let i=0;i<n;i++)if(Number.isFinite(Number(T[i])))geldig.push(i);
  if(!geldig.length)return [];
  /* Het echte hoogste en laagste punt, op de ongeronde waarde: 16,4° en 15,6°
     tonen allebei "16°", maar alleen 15,6° is het laagste punt van de lijn. */
  const v=i=>Number(T[i]);
  const hoog=Math.max(...geldig.map(v)),laag=Math.min(...geldig.map(v));
  if(Math.round(hoog)===Math.round(laag))return [];
  /* Een plateau (gelijke waarden achter elkaar) krijgt één markering op het
     middelste punt van het eerste plateau met die waarde. */
  const midden=w=>{
    const begin=geldig.find(i=>v(i)===w);let eind=begin;
    while(eind+1<n&&Number.isFinite(Number(T[eind+1]))&&v(eind+1)===w)eind++;
    return Math.floor((begin+eind)/2);
  };
  const nuIndex=nu&&nu.index!==null&&nu.index!==undefined&&Number.isFinite(Number(nu.index))?Number(nu.index):null;
  const nuWaarde=nu&&nu.waarde!==null&&nu.waarde!==undefined&&Number.isFinite(Number(nu.waarde))?Math.round(Number(nu.waarde)):null;
  const buiten=k=>{const v=rand&&rand[k];return v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;};
  const links=buiten("links"),rechts=buiten("rechts"),eerste=geldig[0],laatste=geldig[geldig.length-1];
  const loopDoor=m=>{
    const verder=v=>v!==null&&(m.type==="max"?v>=m.ruw:v<=m.ruw);
    const w=m.ruw;let l=m.i,r=m.i;
    while(l-1>=0&&v(l-1)===w)l--;while(r+1<n&&Number.isFinite(Number(T[r+1]))&&v(r+1)===w)r++;
    return (l===eerste&&verder(links))||(r===laatste&&verder(rechts));
  };
  return [{type:"max",waarde:Math.round(hoog),i:midden(hoog),ruw:hoog},{type:"min",waarde:Math.round(laag),i:midden(laag),ruw:laag}]
    .filter(m=>!loopDoor(m))
    /* "nu 20°" maakt een max of min van 20° vlak ernaast overbodig. */
    .filter(m=>!(nuIndex!==null&&nuWaarde===m.waarde&&Math.abs(m.i-nuIndex)<=NU_MARKERING_BEREIK_UREN))
    .map(({type,waarde,i})=>({type,waarde,i}))
    .sort((a,b)=>a.i-b.i);
}
/* Temperatuur direct vóór en na het getoonde venster, uit de volledige uurreeks. */
function grafiekRandWaarden(g,n){
  const T=g&&Array.isArray(g.T)?g.T:[],TI=g&&Array.isArray(g.TI)?g.TI:[];
  const getal=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v):null;
  let links=null,rechts=n<T.length?getal(T[n]):null;
  const uren=typeof S!=="undefined"&&S&&S.d&&S.d.hourly;
  if(uren&&Array.isArray(uren.time)&&Array.isArray(uren.temperature_2m)&&TI.length&&n>0){
    const k0=uren.time.indexOf(TI[0]);if(k0>0)links=getal(uren.temperature_2m[k0-1]);
    if(rechts===null){const k1=uren.time.indexOf(TI[n-1]);if(k1>=0&&k1+1<uren.time.length)rechts=getal(uren.temperature_2m[k1+1]);}
  }
  return {links,rechts};
}
/* Kleinste leesbare grafiektekst: 11 css-pixels na schaling van de viewBox. */
const GRAFIEK_MIN_PX=11;
function leesbareGrootte(svg,grootte){
  const vb=svg&&svg.viewBox&&svg.viewBox.baseVal,breed=svg&&typeof svg.getBoundingClientRect==="function"?svg.getBoundingClientRect().width:0;
  const schaal=vb&&vb.width&&breed?breed/vb.width:1;
  return Math.max(Number(grootte)||0,Math.ceil(GRAFIEK_MIN_PX/schaal*10)/10);
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
    nws:waarschuwingen&&waarschuwing.nws,
    /* De serverfallback levert de weerdata met provider "visualcrossing" of
       "weatherapi". Die bron krijgt alleen een vermelding als de getoonde
       verwachting echt van haar komt; bij Open-Meteo-data blijven beide weg. */
    visualcrossing:opties.forecastProvider==="visualcrossing",
    weatherapi:opties.forecastProvider==="weatherapi"
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
/* Omhullende rechthoek van een pad met absolute M/L/H/V/Q/C-commando's, zoals
   de regenstaven. Zonder getBBox: dat werkt niet op een verborgen grafiek. */
function padBox(d){
  const delen=String(d||"").match(/[MLHVQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);if(!delen)return null;
  let cmd="",x=NaN,y=NaN,k=0;const xs=[],ys=[];
  const getal=()=>Number(delen[k++]);
  while(k<delen.length){
    if(/^[A-Za-z]$/.test(delen[k])){cmd=delen[k++].toUpperCase();if(cmd==="Z")continue;}
    if(cmd==="H")x=getal();else if(cmd==="V")y=getal();
    else if(cmd==="M"||cmd==="L"){x=getal();y=getal();}
    else if(cmd==="Q"){xs.push(getal());ys.push(getal());x=getal();y=getal();}
    else if(cmd==="C"){xs.push(getal());ys.push(getal());xs.push(getal());ys.push(getal());x=getal();y=getal();}
    else return null;
    if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    xs.push(x);ys.push(y);
  }
  if(!xs.length)return null;
  const l=Math.min(...xs),t=Math.min(...ys);
  return {x:l,y:t,width:Math.max(...xs)-l,height:Math.max(...ys)-t};
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

const api={bewakingsKandidaten,padBox,padPunten,bewakingsTekstBox,afstandVakTotPunt,kiesVrijeVerschuiving,uurUitIso,uurAsLabelTekst,kiesUurLabelIndices,kiesKalenderUurLabelIndices,lokaleForecastMinuten,mobieleGrafiekMarkeringen,monotoonPad,MOBIEL_ICOON_Y,MOBIEL_ICOON_GROOTTE,MOBIEL_LIJNLABEL_GROOTTE,MOBIELE_UURAS_Y,isUurAsLabel,waarschuwingBronnenVoorLand,neerslagSleutelTekst,bronGebruikUitResources,rechthoekenBotsen,lijnRaaktTekstBox,geschatteSvgTekstBox,randCorrectieVoorTekstBox,begrensTemperatuurLabelY,mobieleTemperatuurLabelLimiet,kiesMobieleTemperatuurLabelIndices,prioriteerMobieleTemperatuurLabelIndices,mobieleGrafiekCompactHoogte};
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
/* Het uur onder iedere zichtbare tijd op de as: de mobiele as noemt haar
   index; elders het uur van de tekst (een venster van 25 uur noemt een uur
   twee keer: neem het dichtste), anders het dichtste punt. */
function asTijdIndices(svg,g){
  const uit=new Map();
  if(!svg||!g||!Array.isArray(g.TI)||typeof g.x!=="function")return uit;
  const n=g.TI.length,x=i=>Number(g.x(i));
  const dichtst=(px,past)=>{let b=null;for(let i=0;i<n;i++){if(past&&!past(i))continue;if(b===null||Math.abs(x(i)-px)<Math.abs(x(b)-px))b=i;}return b;};
  bestaandeUurLabels(svg,g).filter(el=>!el.closest("#scrub")&&el.getAttribute("display")!=="none").forEach(el=>{
    let i;
    if(el.hasAttribute("data-mobile-hour-index"))i=Number(el.getAttribute("data-mobile-hour-index"));
    else{
      const t=String(el.textContent||"").trim(),px=Number(el.getAttribute("x"));
      const opTekst=dichtst(px,k=>String(g.TI[k]).slice(11,16)===t);
      i=opTekst!==null?opTekst:dichtst(px);
    }
    if(Number.isInteger(i))uit.set(i,el);
  });
  return uit;
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
    const kleur="var(--ink-45)";
    indices.forEach(i=>{
      const x=Number(g.x(i)),uur=uurUitIso(g.TI[i]);if(!Number.isFinite(x)||!Number.isInteger(uur))return;
      const el=document.createElementNS(SVG_NS,"text");
      el.setAttribute("x",String(x));el.setAttribute("y",String(y));
      el.setAttribute("text-anchor","middle");
      el.setAttribute("fill",kleur);el.setAttribute("font-size",String(leesbareGrootte(svg,9)));el.setAttribute("opacity",".82");
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
  const kleur="var(--ink-45)";
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
  /* Kleuren als CSS-variabele, niet als eenmalig uitgelezen waarde: dan
     volgen stippen, cijfers, iconen en verloop een themawissel direct, zonder
     opnieuw te tekenen. */
  const ink="var(--ink)",sheet="var(--sheet)";
  const voorScrub=el=>svg.insertBefore(el,svg.querySelector('g[data-q4-rain-periods]')||svg.querySelector("#scrub")||null);

  /* Idempotent: iedere pass (rAF, timers, fontload) bouwt labels, markeringen,
     vlak en iconen opnieuw op. Temperatuurcijfers van de basisgrafiek verdwijnen. */
  [...svg.querySelectorAll("text")].filter(el=>{
    if(el.closest("#scrub"))return false;
    const ff=String(el.getAttribute("font-family")||""),tekst=String(el.textContent||"").trim();
    return el.hasAttribute("data-mobile-temp-index")||el.hasAttribute("data-mobile-temp-marker")||el.hasAttribute("data-mobile-temp-marker-time")||(/Bodoni/i.test(ff)&&/^-?\d+°$/.test(tekst));
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
  /* Het nu-label telt hier niet mee: het wijkt zelf voor de cijfers (polishNuLabel). */
  const vast=[...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&el!==nuTekst).map(svgTekstBoxUitElement).filter(Boolean);
  /* Plafond: een label mag boven de plotrand uitsteken tot net onder de dag/
     nachtband. Anders valt de temperatuur bij een piek vlak onder de bovenste
     asgrens onder de lijn, waar ze niet meer bij haar punt hoort. Alleen wat
     duidelijk boven de plot ligt telt als band, niet de bovenste rasterlijn. */
  const bandOnderkanten=[...svg.querySelectorAll("rect,line")].filter(el=>!el.closest("#scrub")).map(el=>el.tagName.toLowerCase()==="rect"
    ?Number(el.getAttribute("y"))+Number(el.getAttribute("height"))
    :Math.max(Number(el.getAttribute("y1")),Number(el.getAttribute("y2")))).filter(b=>Number.isFinite(b)&&b<top-4);
  const plafond=(bandOnderkanten.length?Math.max(...bandOnderkanten):0)+3;
  const nuLijnVak=Number.isFinite(nuX)?{x:nuX-3,y:plafond,width:6,height:bottom-plafond}:null;
  if(nuLijnVak)vast.push(nuLijnVak);
  /* Links van het eerste uur staan de asgetallen; een label daar leest als asgetal. */
  const asKolom=Number(g.x(0))-4;
  const lijnen=[...svg.querySelectorAll("path[data-mobile-line-points]")]
    .map(el=>String(el.getAttribute("data-mobile-line-points")||"").trim().split(/\s+/).map(p=>p.split(",").map(Number)));
  const fs=leesbareGrootte(svg,MOBIEL_LIJNLABEL_GROOTTE);
  /* Het tekstvak van Bodoni loopt van 1,1 lettergrootte boven de basislijn tot
     0,4 eronder; de algemene schatting rekent met 0,92 en 0,26. Bij 11px-cijfers
     valt dat verschil buiten de marge, dus rekenen de cijfers met de echte
     hoogte; de ruime marge die de schatting compenseerde, wordt dan 1,5. */
  const cel=b=>b&&{x:b.x,y:b.y-fs*.18,width:b.width,height:b.height+fs*.32};
  /* Neerslagstaven zijn ook bezet: een temperatuur op een staaf leest als
     een getal bij de regen, niet bij de lijn. */
  const staven=[...svg.querySelectorAll("path.regenstaaf")].map(el=>padBox(el.getAttribute("d"))).filter(Boolean);
  const plaats=(tekst,kandidaten,schuif)=>{
    for(const [x0,y,anker] of kandidaten){
      if(y-fs<plafond||y>bottom-3)continue;
      let box=geschatteSvgTekstBox(tekst,x0,y,anker,fs);if(!box)continue;
      let x=x0;
      if(box.x<marge)x+=marge-box.x;else if(box.x+box.width>W-marge)x-=box.x+box.width-(W-marge);
      box=geschatteSvgTekstBox(tekst,x,y,anker,fs);
      if(box&&box.x<asKolom){if(!schuif)continue;x+=asKolom-box.x;box=geschatteSvgTekstBox(tekst,x,y,anker,fs);}
      if(box&&!vast.some(b=>rechthoekenBotsen(b,cel(box),1.5))&&!staven.some(b=>rechthoekenBotsen(b,cel(box),1))&&!lijnen.some(punten=>lijnRaaktTekstBox(punten,box,1)))return {x,y,anker,box};
    }
    return null;
  };
  const label=(tekst,pos)=>{
    const el=document.createElementNS(SVG_NS,"text");el.textContent=tekst;
    el.setAttribute("x",String(pos.x));el.setAttribute("y",String(pos.y));el.setAttribute("text-anchor",pos.anker);
    el.setAttribute("font-family","Bodoni Moda,Georgia,serif");el.setAttribute("font-size",String(fs));el.setAttribute("fill",ink);
    el.setAttribute("stroke",sheet);el.setAttribute("stroke-width","3");el.setAttribute("paint-order","stroke");el.setAttribute("stroke-linejoin","round");
    vast.push(cel(pos.box));return el;
  };

  /* Piek en dal krijgen geen eigen tijd boven het cijfer: een losse "17:00"
     boven "27°" oogde onrustig. De stip en het vette cijfer tonen het hoogste
     en laagste punt; de tijd staat op de uuras eronder en bij aantikken. */

  /* Iedere tijd op de uuras houdt haar stip en temperatuur, ook het eerste uur
     naast "nu" en een uur vlak naast piek of dal (verzoek van de eigenaar,
     1 oktober: "waarom mist 12:00 een stip met temperatuur?"). Volgorde:
     1. piek of dal precies op een astijd: het vette cijfer is dan het cijfer
        van die astijd;
     2. de overige drie-uursankers;
     3. piek of dal tussen twee astijden: noemt de astijd ernaast afgerond
        dezelfde waarde, dan wordt dat cijfer het vette cijfer (geen tweede
        "13°" vlak naast "13°"). Anders een eigen cijfer vlak bij het punt, als
        dat past zonder een astijdcijfer of -stip te raken. Past het niet, dan
        wordt het cijfer van de dichtstbijzijnde astijd met dezelfde afgeronde
        waarde het vette cijfer: een cijfer noemt altijd de waarde van zijn
        eigen punt.
     Iedere temperatuur staat BOVEN haar punt, ook het dal: onder de lijn leest
     een getal als de temperatuur van het vlak eronder. Eerst recht erboven, dan
     licht verschoven, dan schuin erboven, dan hoger. Alleen de waarde: "min 3°"
     leest als min 3 graden (-3°); de stip zegt al wat het is. Het nu-label
     zoekt daarna zelf een vrije plek (polishNuLabel). */
  const getoond=[],vervallen=[],markeringen=[];
  const markeringDot=(m,px,py)=>{
    const dot=document.createElementNS(SVG_NS,"circle");
    dot.setAttribute("cx",String(px));dot.setAttribute("cy",String(py));dot.setAttribute("r","2.2");dot.setAttribute("fill",ink);
    dot.setAttribute("data-mobile-temp-marker-dot",m.type);voorScrub(dot);
  };
  const plaatsMarkering=(m,alleenVlakBij)=>{
    const px=Number(g.x(m.i)),py=Number(g.y(Number(g.T[m.i])));if(!Number.isFinite(px)||!Number.isFinite(py))return false;
    const verticaal=y=>[[px,y,"middle"],[px+14,y,"middle"],[px-14,y,"middle"]];
    /* Tussen twee astijden alleen vlak bij het eigen punt: hoger of opzij
       leest het cijfer als een ander uur. */
    const dichtbij=alleenVlakBij?[[px,py-9,"middle"],[px,py-15,"middle"],[px+7,py-5,"start"],[px-7,py-5,"end"]]
      :[...verticaal(py-9),...verticaal(py-15),[px+7,py-5,"start"],[px-7,py-5,"end"],...verticaal(py-21),...verticaal(py-27),
      [px,py-33,"middle"],[px,py-39,"middle"],[px,py-45,"middle"]];
    const pos=plaats(m.waarde+"°",dichtbij,false);
    if(!pos)return false;
    markeringDot(m,px,py);
    const el=label(m.waarde+"°",pos);
    el.setAttribute("data-mobile-temp-marker",m.type);el.setAttribute("data-mobile-temp-marker-index",String(m.i));
    if(ankers.includes(m.i))el.setAttribute("data-mobile-temp-covers-anchor",String(m.i));
    voorScrub(el);getoond.push(m.type+":"+m.i);markeringen.push({i:m.i,el,px,py,pos});
    return true;
  };
  const alleMarkeringen=mobieleGrafiekMarkeringen(g.T,24,{index:nuIndex,waarde:actueelGeldig?Number(actueel):null},grafiekRandWaarden(g,Math.min(24,g.T.length)));
  /* Past het vette cijfer niet, dan krijgt de astijd hieronder gewoon haar
     cijfer en wordt dat daarna het vette cijfer. */
  const uitgesteld=alleMarkeringen.filter(m=>ankers.includes(m.i)&&!plaatsMarkering(m));

  /* 2. Temperatuur per drie-uursanker, boven het punt op de lijn. Alleen een
     anker waar piek of dal zelf staat, heeft zijn cijfer al. */
  const gelabeld=[],gedekt=[],ontbrekend=[],ankerLabels=new Map();
  /* Altijd boven het punt. Loopt de lijn daar steil, dan schuin erboven aan de
     open kant (stijgend: linksboven, dalend: rechtsboven), en anders hoger: in
     een smal, steil dal is er pas ruimte waar het dal naar boven breder wordt.
     Pas als er boven het punt nergens plek is, staat het cijfer eronder: een
     astijd blijft nooit zonder temperatuur. */
  const ankerKandidaten=(x,y)=>[[x,y-9,"middle"],[x,y-15,"middle"],[x+6,y-5,"start"],[x-6,y-5,"end"],[x+8,y-9,"middle"],[x-8,y-9,"middle"],
    [x,y-21,"middle"],[x+10,y-14,"start"],[x-10,y-14,"end"],[x,y-27,"middle"],[x,y-33,"middle"],[x,y-39,"middle"],[x,y-45,"middle"],
    [x,y+fs+4,"middle"],[x+8,y+fs+4,"middle"],[x-8,y+fs+4,"middle"]];
  const gedektDoorMarkering=i=>markeringen.find(m=>m.i===i);
  /* Op een smal scherm liggen twee drie-uursankers maar anderhalve
     cijferbreedte uit elkaar. Een cijfer dat schuin naast zijn punt uitwijkt,
     kan dan de plek van het volgende anker innemen, dat daardoor tot 36px
     boven zijn punt belandt. Daarom telt de eerste vrije plek van het
     volgende anker (als die dicht bij zijn punt ligt) als bezet; alleen als
     dit cijfer dan niet binnen 21px van zijn eigen punt past, geldt de
     gewone volgorde. */
  const buurPlek=i=>{
    const j=ankers[ankers.indexOf(i)+1];if(j===undefined||gedektDoorMarkering(j))return null;
    const x=Number(g.x(j)),y=Number(g.y(Number(g.T[j])));if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    const p=plaats(Math.round(Number(g.T[j]))+"°",ankerKandidaten(x,y),true);
    return p&&p.y>=y-21?p:null;
  };
  const ankerPunt=(i,x,y)=>{
    let punt=puntPerIndex.get(i);
    if(!punt||!punt.isConnected){
      punt=puntSjabloon&&puntSjabloon.isConnected?puntSjabloon.cloneNode(false):document.createElementNS(SVG_NS,"circle");
      voorScrub(punt);puntPerIndex.set(i,punt);
    }
    punt.setAttribute("data-temp-index",String(i));punt.setAttribute("data-mobile-temp-point","1");
    punt.setAttribute("cx",String(x));punt.setAttribute("cy",String(y));
    /* Elk temperatuurpunt dezelfde volle stip als piek en dal (2,2 op de telefoon);
       piek en dal onderscheiden zich met hun vette cijfer. */
    punt.setAttribute("r","2.2");punt.setAttribute("fill",ink);punt.removeAttribute("opacity");
    /* Een stip is ook bezet: een later cijfer (piek of dal ertussen) mag er niet op staan. */
    vast.push({x:x-3,y:y-3,width:6,height:6});
    return punt;
  };
  ankers.forEach(i=>{
    const x=Number(g.x(i)),y=Number(g.y(Number(g.T[i])));
    if(!Number.isFinite(x)||!Number.isFinite(y)){const p=puntPerIndex.get(i);if(p&&p.isConnected)p.remove();return;}
    const markering=gedektDoorMarkering(i);
    /* Piek of dal staat hier zelf, met eigen stip en cijfer: geen tweede stip. */
    if(markering){gedekt.push(i);const p=puntPerIndex.get(i);if(p&&p.isConnected)p.remove();vast.push({x:x-3,y:y-3,width:6,height:6});return;}
    const tekst=Math.round(Number(g.T[i]))+"°",kandidaten=ankerKandidaten(x,y),buur=buurPlek(i);
    let pos=null;
    if(buur){vast.push(cel(buur.box));pos=plaats(tekst,kandidaten,true);vast.pop();if(pos&&pos.y<y-21)pos=null;}
    if(!pos)pos=plaats(tekst,kandidaten,true);
    /* Het eerste uur ligt soms zo dicht bij de nu-lijn dat er tussen de
       asgetallen en die lijn geen cijfer past. Dan mag het cijfer over de dunne
       lijn heen staan; de rand in papierkleur onderbreekt haar daar even. */
    let overNuLijn=false;
    if(!pos&&nuLijnVak){vast.splice(vast.indexOf(nuLijnVak),1);pos=plaats(tekst,kandidaten,true);vast.push(nuLijnVak);overNuLijn=!!pos;}
    if(!pos){ontbrekend.push(i);const p=puntPerIndex.get(i);if(p&&p.isConnected)p.remove();return;}
    ankerPunt(i,x,y);
    const el=label(tekst,pos);
    el.setAttribute("data-mobile-temp-index",String(i));el.setAttribute("data-mobile-temp-label","1");el.setAttribute("data-mobile-temp-priority","anchor");
    if(pos.x!==x)el.setAttribute("data-mobile-edge-adjusted","1");
    if(overNuLijn)el.setAttribute("data-over-nu-lijn","1");
    voorScrub(el);gelabeld.push(i);ankerLabels.set(i,el);
  });
  puntPerIndex.forEach((el,i)=>{if(el.isConnected&&!gelabeld.includes(i))el.remove();});

  /* 3. Piek of dal tussen twee astijden: een eigen cijfer als het past (de
     astijdcijfers en hun stippen zijn nu bezet). Anders neemt het cijfer van
     de dichtstbijzijnde astijd met dezelfde afgeronde waarde de rol over. */
  const maakAnkerMarkering=(m,j)=>{
    const el=ankerLabels.get(j);
    ["data-mobile-temp-index","data-mobile-temp-label","data-mobile-temp-priority"].forEach(a=>el.removeAttribute(a));
    el.setAttribute("data-mobile-temp-marker",m.type);el.setAttribute("data-mobile-temp-marker-index",String(j));el.setAttribute("data-mobile-temp-covers-anchor",String(j));
    markeringDot(m,Number(g.x(j)),Number(g.y(Number(g.T[j]))));
    const p=puntPerIndex.get(j);if(p&&p.isConnected)p.remove();
    ankerLabels.delete(j);gedekt.push(j);getoond.push(m.type+":"+j);
    markeringen.push({i:j,el});
  };
  uitgesteld.forEach(m=>{if(ankerLabels.has(m.i))maakAnkerMarkering(m,m.i);else vervallen.push(m.type);});
  const ankerMetWaarde=(m,max)=>[...ankerLabels.keys()].filter(j=>Math.round(Number(g.T[j]))===m.waarde&&!gedektDoorMarkering(j)&&Math.abs(j-m.i)<=max)
    .sort((a,b)=>Math.abs(a-m.i)-Math.abs(b-m.i))[0];
  alleMarkeringen.filter(m=>!ankers.includes(m.i)).forEach(m=>{
    const naast=ankers.reduce((b,j)=>b===null||Math.abs(j-m.i)<Math.abs(b-m.i)?j:b,null);
    let kandidaat=naast!==null&&Math.abs(naast-m.i)<=1.5?ankerMetWaarde(m,1.5):undefined;
    if(kandidaat===undefined){
      if(plaatsMarkering(m,true))return;
      kandidaat=ankerMetWaarde(m,3);
    }
    if(kandidaat===undefined){vervallen.push(m.type);return;}
    maakAnkerMarkering(m,kandidaat);
  });

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

/* Desktop (>900px): dezelfde uitstraling als de mobiele grafiek, met behoud van
   het cijfer per uur. Een zacht vlak onder de lijn, het weericoon boven iedere
   uurtijd op de as en een subtiel uitgelicht hoogste en laagste punt. De
   uurtijden schuiven alleen omlaag als daar binnen de viewBox ruimte is. */
/* Een temperatuurcijfer hoort bij zijn punt. Eerdere passes stapelen een label
   soms twee lagen hoog om een buurlabel te ontwijken dat daarna nog vervalt
   (bijvoorbeeld omdat er geen tijd naast paste); dan zweefde het cijfer ver
   boven zijn punt. Staat een cijfer verder dan 34px van zijn punt, dan gaat
   het naar de dichtstbijzijnde plek die vrij is van andere tekst en van de
   lijn: 14px boven, net onder of 32px boven het punt. Is geen enkele plek
   vrij, dan blijft het staan. Alleen voor de niet-mobiele grafiek; de mobiele
   grafiek heeft haar eigen temperatuurrij. */
function trekTemperatuurLabelsNaarPunt(svg,g){
  const top=Number(g.pt),bottom=top+Number(g.ih),cw=Number(g.cw);
  if(![top,bottom,cw].every(Number.isFinite)||cw<=0)return;
  const isTemp=el=>!el.closest("#scrub")&&/Bodoni/i.test(String(el.getAttribute("font-family")||""))&&/^-?\d+°$/.test(String(el.textContent||"").trim());
  const alleTekst=[...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&!el.closest('g[data-q4-rain-periods]'));
  const punten=[...svg.querySelectorAll("circle[data-temp-index]")].map(c=>({i:Number(c.getAttribute("data-temp-index")),x:Number(c.getAttribute("cx")),y:Number(c.getAttribute("cy"))})).filter(p=>[p.i,p.x,p.y].every(Number.isFinite));
  const lijnen=[...svg.querySelectorAll("polyline")].filter(el=>!el.closest("#scrub")).map(l=>String(l.getAttribute("points")||"").trim().split(/\s+/).map(p=>p.split(",").map(Number)));
  alleTekst.filter(isTemp).forEach(el=>{
    const lx=Number(el.getAttribute("x")),ly=Number(el.getAttribute("y")),fs=Number(el.getAttribute("font-size"))||12;
    const waarde=Number(String(el.textContent).trim().replace("°",""));
    const vastIndex=Number(el.getAttribute("data-desktop-temp-marker-index"));
    let punt=null,afstand=Infinity;
    punten.forEach(p=>{
      if(Number.isInteger(vastIndex)&&el.hasAttribute("data-desktop-temp-marker-index")&&p.i!==vastIndex)return;
      if(Math.round(Number(g.T[p.i]))!==waarde)return;
      const dx=Math.abs(p.x-lx);if(dx<=Math.max(cw*.75,24)&&dx<afstand){afstand=dx;punt=p;}
    });
    if(!punt)return;
    const bovenAfstand=punt.y-ly,onderAfstand=ly-fs*.92-punt.y;
    if(Math.max(bovenAfstand,onderAfstand)<=34)return;
    const anderen=alleTekst.filter(t=>t!==el&&t.isConnected).map(svgTekstBoxUitElement).filter(Boolean);
    for(const kandidaat of [punt.y-14,punt.y+fs+6,punt.y-32]){
      if(kandidaat-fs<top-2||kandidaat>bottom-3)continue;
      const box=geschatteSvgTekstBox(el.textContent,lx,kandidaat,el.getAttribute("text-anchor")||"middle",fs);
      if(!box||anderen.some(b=>rechthoekenBotsen(box,b,2))||lijnen.some(pt=>lijnRaaktTekstBox(pt,box,1)))continue;
      el.setAttribute("y",kandidaat.toFixed(1));el.setAttribute("data-label-naar-punt","1");break;
    }
  });
}

function bouwDesktopGrafiekAccenten(){
  /* Volgt de grafiekmodus (g.M) en niet de paginabreedte: vanaf 760px tekent
     de grafiek desktopgeometrie op haar werkelijke breedte, dus ook tablet
     krijgt vlak, iconen en gemarkeerde piek en dal. */
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||g.M||!Array.isArray(g.T)||!Array.isArray(g.TI)||typeof g.x!=="function"||typeof g.y!=="function")return;
  /* Idempotent: zet wat een vorige pass voor piek en dal verplaatste, toevoegde
     of liet wijken eerst terug. */
  svg.querySelectorAll("[data-desktop-temp-added]").forEach(el=>el.remove());
  svg.querySelectorAll("[data-desktop-temp-moved]").forEach(el=>{
    try{Object.entries(JSON.parse(el.getAttribute("data-desktop-temp-moved"))).forEach(([a,v])=>el.setAttribute(a,v));}catch(_){}
    el.removeAttribute("data-desktop-temp-moved");
  });
  svg.querySelectorAll("[data-desktop-temp-yield]").forEach(el=>{el.removeAttribute("display");el.removeAttribute("data-desktop-temp-yield");});
  trekTemperatuurLabelsNaarPunt(svg,g);
  const top=Number(g.pt),bottom=top+Number(g.ih),W=Number(g.W),cw=Number(g.cw);
  const delen=String(svg.getAttribute("viewBox")||"").trim().split(/\s+/).map(Number);
  const H=delen.length===4&&Number.isFinite(delen[3])?delen[3]:Number(g.H);
  if(![top,bottom,W,H,cw].every(Number.isFinite)||bottom<=top||cw<=0)return;
  const ink="var(--ink)";
  const voorScrub=el=>svg.insertBefore(el,svg.querySelector('g[data-q4-rain-periods]')||svg.querySelector("#scrub")||null);

  /* Idempotent: iedere pass begint vanaf de basisgrafiek. */
  svg.querySelectorAll("[data-desktop-temp-area],[data-desktop-weather-icon],[data-desktop-temp-marker-dot]").forEach(el=>el.remove());
  svg.querySelectorAll("text[data-desktop-temp-marker]").forEach(el=>{
    el.removeAttribute("data-desktop-temp-marker");el.removeAttribute("data-desktop-temp-marker-index");el.removeAttribute("font-weight");
    if(el.hasAttribute("data-desktop-base-opacity"))el.setAttribute("opacity",el.getAttribute("data-desktop-base-opacity"));
    el.removeAttribute("data-desktop-base-opacity");
  });
  svg.querySelectorAll("text[data-desktop-base-y]").forEach(el=>{el.setAttribute("y",el.getAttribute("data-desktop-base-y"));el.removeAttribute("data-desktop-base-y");});

  /* 1. Zacht vlak onder ieder lijnstuk, in inktkleur die naar onderen wegvalt. */
  const lijnen=[...svg.querySelectorAll("polyline")].filter(el=>!el.closest("#scrub"));
  if(lijnen.length){
    const defs=document.createElementNS(SVG_NS,"defs");defs.setAttribute("data-desktop-temp-area","defs");
    const verloop=document.createElementNS(SVG_NS,"linearGradient");
    verloop.setAttribute("id","desktopTempVlak");verloop.setAttribute("x1","0");verloop.setAttribute("y1","0");verloop.setAttribute("x2","0");verloop.setAttribute("y2","1");
    [["0",".13"],["1","0"]].forEach(([offset,dekking])=>{const stop=document.createElementNS(SVG_NS,"stop");stop.setAttribute("offset",offset);stop.setAttribute("stop-color",ink);stop.setAttribute("stop-opacity",dekking);verloop.appendChild(stop);});
    defs.appendChild(verloop);svg.insertBefore(defs,svg.firstChild);
    lijnen.forEach(lijn=>{
      const punten=String(lijn.getAttribute("points")||"").trim().split(/\s+/).map(p=>p.split(",").map(Number)).filter(p=>p.length===2&&p.every(Number.isFinite));
      if(punten.length<2)return;
      const vlak=document.createElementNS(SVG_NS,"path");
      vlak.setAttribute("d","M"+punten.map(p=>p.join(",")).join(" L")+` L${punten[punten.length-1][0]},${bottom} L${punten[0][0]},${bottom} Z`);
      vlak.setAttribute("fill","url(#desktopTempVlak)");vlak.setAttribute("stroke","none");vlak.setAttribute("data-desktop-temp-area","1");
      lijn.parentNode.insertBefore(vlak,lijn);
    });
  }

  /* 2. Weericoon boven iedere uurtijd op de as. Eerst ruimte maken: alle tekst
     onder de plot schuift zo ver omlaag als het icoon vraagt, maar nooit uit de
     viewBox. Past het niet, dan liever geen iconen dan overlap. */
  const nuPunt=[...svg.querySelectorAll("circle")].find(el=>String(el.getAttribute("fill")||"")===String(CARMINE)&&Math.abs(Number(el.getAttribute("r"))-3)<.2);
  const nuX=nuPunt?Number(nuPunt.getAttribute("cx")):NaN;
  const uurLabels=bestaandeUurLabels(svg,g).filter(el=>!el.closest("#scrub"));
  const uren=S.d&&S.d.hourly,uurIndex=new Map(uren&&Array.isArray(uren.time)?uren.time.map((t,k)=>[t,k]):[]);
  const iconen=[];
  if(typeof icon==="function"&&uren&&Array.isArray(uren.weather_code))uurLabels.forEach(el=>{
    const x=Number(el.getAttribute("x"));if(!Number.isFinite(x))return;
    const i=Math.round((x-Number(g.x(0)))/cw);
    if(!Number.isInteger(i)||i<0||i>=g.TI.length||Math.abs(Number(g.x(i))-x)>cw/2)return;
    const k=uurIndex.get(g.TI[i]),code=k===undefined?null:uren.weather_code[k];
    if(code===null||code===undefined||!Number.isFinite(Number(code)))return;
    iconen.push({i,x,code:Number(code),dag:!Array.isArray(uren.is_day)||uren.is_day[k]!==0});
  });
  const icoonTop=bottom+DESKTOP_ICOON_Y,icoonOnder=icoonTop+DESKTOP_ICOON_GROOTTE;
  const onderPlot=[...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&!el.closest('g[data-q4-rain-periods]')&&Number(el.getAttribute("y"))>bottom+4);
  const boxen=onderPlot.map(svgTekstBoxUitElement).filter(Boolean);
  const schuif=boxen.length?Math.max(0,icoonOnder+3-Math.min(...boxen.map(b=>b.y))):0;
  /* Zichtbare regenperiodes onder de plot bezetten die ruimte al. Die groep kan
     ná deze pass verschijnen; vraag daarom de stylesheet zelf of hij zichtbaar
     zou zijn, met een lege proefgroep, en ga uit van regen zodra er een kans is. */
  const regenGroepZou=()=>{
    const proef=document.createElementNS(SVG_NS,"g");proef.setAttribute("data-q4-rain-periods","1");svg.appendChild(proef);
    const zichtbaar=getComputedStyle(proef).display!=="none";proef.remove();return zichtbaar;
  };
  const regenMogelijk=!!svg.querySelector('g[data-q4-rain-periods] *')||(Array.isArray(g.P)&&g.P.some(p=>Number(p)>0));
  const regenZichtbaar=regenMogelijk&&regenGroepZou();
  const pastInViewBox=!regenZichtbaar&&(!boxen.length||Math.max(...boxen.map(b=>b.y+b.height))+schuif<=H-2);
  if(iconen.length&&pastInViewBox){
    if(schuif>0)onderPlot.forEach(el=>{el.setAttribute("data-desktop-base-y",el.getAttribute("y"));el.setAttribute("y",String(Number(el.getAttribute("y"))+schuif));});
    iconen.forEach(({i,x,code,dag})=>{
      const markup=String(icon(code,dag,DESKTOP_ICOON_GROOTTE)).replace(/^<svg[^>]*>/,"").replace(/<\/svg>$/,"");
      const groep=document.createElementNS(SVG_NS,"g");groep.innerHTML=markup;
      groep.setAttribute("transform",`translate(${x-DESKTOP_ICOON_GROOTTE/2},${icoonTop}) scale(${DESKTOP_ICOON_GROOTTE/24})`);
      groep.setAttribute("color",ink);groep.setAttribute("opacity",".78");groep.setAttribute("aria-hidden","true");
      groep.setAttribute("data-desktop-weather-icon",String(i));voorScrub(groep);
    });
  }
  svg.setAttribute("data-desktop-weather-icons",String(pastInViewBox?iconen.length:0));
  if(regenZichtbaar)svg.setAttribute("data-desktop-weather-icons-skip","regen");else svg.removeAttribute("data-desktop-weather-icons-skip");

  /* 3. Hoogste en laagste punt: een volle stip op het echte punt en het cijfer
     daarboven iets zwaarder en volledig dekkend. Heeft dat uur geen eigen
     cijfer (piek of dal tussen twee astijden), dan komt er een cijfer bij,
     maar alleen als dat past zonder een astijdcijfer of astijdstip te raken:
     een astijd houdt altijd haar eigen stip en temperatuur (eigenaar,
     1 oktober). Past het niet, dan wordt het cijfer van de dichtstbijzijnde
     astijd met dezelfde afgeronde waarde het vette cijfer; een cijfer noemt
     altijd de waarde van zijn eigen punt. Een gewoon tussencijfer dat het
     raakt, wijkt. Dezelfde keuze als mobiel: een plateau krijgt één
     markering, naast "nu" met dezelfde waarde vervalt ze, en een rand van het
     venster telt niet als de reeks daarbuiten verder stijgt of daalt. */
  const actueel=S.d&&S.d.current&&S.d.current.temperature_2m;
  const nuIndex=Number.isFinite(nuX)?(nuX-Number(g.x(0)))/cw:null;
  const isTempLabel=el=>!el.closest("#scrub")&&el.getAttribute("display")!=="none"&&/Bodoni/i.test(String(el.getAttribute("font-family")||""))&&/^-?\d+°$/.test(String(el.textContent||"").trim());
  const bewaar=(el,attrs)=>{if(!el.hasAttribute("data-desktop-temp-moved"))el.setAttribute("data-desktop-temp-moved",JSON.stringify(Object.fromEntries(attrs.map(a=>[a,el.getAttribute(a)]))));};
  const puntBij=(lx,waarde)=>{
    let beste=null,d=Infinity;
    svg.querySelectorAll("circle[data-temp-index]").forEach(c=>{
      const j=Number(c.getAttribute("data-temp-index"));if(!Number.isInteger(j)||Math.round(Number(g.T[j]))!==waarde)return;
      const dx=Math.abs(Number(c.getAttribute("cx"))-lx);if(dx<d&&dx<=cw*.5){d=dx;beste=c;}
    });
    return beste;
  };
  const getoond=[];
  /* Zelfde contract als de basisgrafiek (desktopUurLabels): tot 24 uur en
     minstens 36px per uur krijgt ieder uur een eigen cijfer. */
  const iederUurEenCijfer=g.T.length<=24&&cw>=36;
  const isAnker=el=>el.hasAttribute("data-desktop-temp-anker");
  const lijnPuntenAccent=[...svg.querySelectorAll("polyline")].filter(el=>!el.closest("#scrub")).map(l=>String(l.getAttribute("points")||"").trim().split(/\s+/).map(p=>p.split(",").map(Number)));
  mobieleGrafiekMarkeringen(g.T,g.T.length,{index:nuIndex,waarde:actueel!==null&&actueel!==undefined&&Number.isFinite(Number(actueel))?Number(actueel):null},grafiekRandWaarden(g,g.T.length)).forEach(m=>{
    let idx=m.i,px=Number(g.x(m.i)),py=Number(g.y(Number(g.T[m.i])));if(!Number.isFinite(px)||!Number.isFinite(py))return;
    const tekst=m.waarde+"°",temperatuurLabels=[...svg.querySelectorAll("text")].filter(isTempLabel);
    let label=null,afstand=Infinity;
    temperatuurLabels.forEach(el=>{
      if(String(el.textContent).trim()!==tekst)return;
      const d=Math.abs(Number(el.getAttribute("x"))-px);if(d<afstand){afstand=d;label=el;}
    });
    /* Een astijdcijfer met dezelfde afgeronde waarde, hooguit max uur ernaast. */
    const ankerMetWaarde=max=>temperatuurLabels.filter(el=>isAnker(el)&&String(el.textContent).trim()===tekst)
      .map(el=>({el,i:Number(el.getAttribute("data-desktop-temp-anker"))})).filter(a=>Number.isInteger(a.i)&&Math.abs(a.i-m.i)<=max)
      .sort((a,b)=>Math.abs(a.i-m.i)-Math.abs(b.i-m.i))[0];
    const naarAnker=a=>{label=a.el;idx=a.i;px=Number(g.x(idx));py=Number(g.y(Number(g.T[idx])));};
    if(!label||afstand>cw*.35){
      label=null;
      /* Noemt de astijd ernaast al dezelfde waarde, dan wordt dat het vette
         cijfer: geen tweede "13°" vlak naast "13°". */
      const ankerIdx=[...temperatuurLabels].filter(isAnker).map(el=>Number(el.getAttribute("data-desktop-temp-anker"))).filter(Number.isInteger);
      const naast=ankerIdx.reduce((b,j)=>b===null||Math.abs(j-m.i)<Math.abs(b-m.i)?j:b,null);
      const buur=naast!==null&&Math.abs(naast-m.i)<=1.5?ankerMetWaarde(1.5):null;
      if(buur)naarAnker(buur);
    }
    if(!label){
      const sjabloon=temperatuurLabels[0];if(!sjabloon)return;
      const nieuw=sjabloon.cloneNode(false);nieuw.textContent=tekst;
      [...nieuw.attributes].filter(a=>/^data-/.test(a.name)&&a.name!=="data-basis-font-size").forEach(a=>nieuw.removeAttribute(a.name));
      nieuw.removeAttribute("display");
      const fs=Number(nieuw.getAttribute("font-size"))||12;
      nieuw.setAttribute("x",String(px));nieuw.setAttribute("text-anchor","middle");nieuw.setAttribute("data-desktop-temp-added","1");
      /* Bezet: alle zichtbare tekst behalve het nu-label (dat wijkt zelf), de
         stippen op de astijden en de lijn. */
      const bezet=[...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&el.getAttribute("display")!=="none"&&!/^nu(?:\s|$)/i.test(String(el.textContent||"").trim())).map(svgTekstBoxUitElement).filter(Boolean)
        .concat([...svg.querySelectorAll("circle[data-temp-index]")].filter(c=>!c.closest("#scrub")&&c.getAttribute("display")!=="none").map(c=>({x:Number(c.getAttribute("cx"))-4,y:Number(c.getAttribute("cy"))-4,width:8,height:8})));
      voorScrub(nieuw);
      const vrij=y=>{
        if(y-fs<top-2)return false;
        nieuw.setAttribute("y",String(y));const b=svgTekstBoxUitElement(nieuw);
        return !!b&&!bezet.some(a=>rechthoekenBotsen(a,b,2))&&!lijnPuntenAccent.some(p=>lijnRaaktTekstBox(p,b,1));
      };
      if([py-8,py-14,py+fs+4,py-20].some(vrij)){
        label=nieuw;
        /* Net als ieder ander uurcijfer een klein puntje op de lijn. */
        const puntSjabloon=svg.querySelector("circle[data-temp-index]");
        if(puntSjabloon){
          const punt=puntSjabloon.cloneNode(false);
          punt.setAttribute("cx",String(px));punt.setAttribute("cy",String(py));punt.setAttribute("data-temp-index",String(m.i));
          ["display","data-desktop-temp-moved","data-desktop-temp-yield","data-desktop-temp-anker"].forEach(a=>punt.removeAttribute(a));
          punt.setAttribute("data-desktop-temp-added","1");puntSjabloon.parentNode.insertBefore(punt,puntSjabloon.nextSibling);
        }
      }else{
        nieuw.remove();
        const anker=ankerMetWaarde(3);
        if(!anker)return;
        naarAnker(anker);
      }
    }
    /* Een gewoon tussencijfer binnen een uur ernaast of dat het cijfer raakt,
       wijkt, zodat piek of dal ruimte heeft. Een astijdcijfer wijkt nooit; de
       desktopgrafiek met een cijfer bij ieder uur houdt al haar buren. */
    const nieuwCijfer=label.hasAttribute("data-desktop-temp-added");
    const box=svgTekstBoxUitElement(label),uurVan=el=>Math.round((Number(el.getAttribute("x"))-Number(g.x(0)))/cw);
    if(box&&(nieuwCijfer||!iederUurEenCijfer))[...svg.querySelectorAll("text")].filter(el=>el!==label&&isTempLabel(el)&&!isAnker(el)).forEach(el=>{
      const b=svgTekstBoxUitElement(el);if(Math.abs(uurVan(el)-idx)>1&&(!b||!rechthoekenBotsen(box,b,2)))return;
      el.setAttribute("display","none");el.setAttribute("data-desktop-temp-yield","1");
      const p=puntBij(Number(el.getAttribute("x")),Number(String(el.textContent).trim().replace("°","")));
      if(p&&Number(p.getAttribute("data-temp-index"))!==idx&&!p.hasAttribute("data-desktop-temp-anker")){p.setAttribute("display","none");p.setAttribute("data-desktop-temp-yield","1");}
    });
    label.setAttribute("data-desktop-base-opacity",label.getAttribute("opacity")||"1");
    label.setAttribute("opacity","1");label.setAttribute("font-weight","500");label.setAttribute("data-desktop-temp-marker",m.type);
    const dot=document.createElementNS(SVG_NS,"circle");
    dot.setAttribute("cx",String(px));dot.setAttribute("cy",String(py));dot.setAttribute("r","3");dot.setAttribute("fill",ink);
    dot.setAttribute("data-desktop-temp-marker-dot",m.type);dot.setAttribute("data-desktop-temp-marker-index",String(idx));voorScrub(dot);
    label.setAttribute("data-desktop-temp-marker-index",String(idx));
    getoond.push(m.type+":"+idx);
  });
  /* Geen temperatuurcijfer op een neerslagstaaf: zo'n cijfer leest als een
     getal bij de regen. Een cijfer dat een staaf raakt, schuift in kleine
     stappen omhoog (eerst per eenheid, zodat het zo dicht mogelijk bij zijn
     punt blijft) of iets opzij, tot hooguit 18 eenheden, naar een plek vrij
     van staven, andere tekst en de lijn. De staaf krijgt 2 eenheden marge:
     het tekstvak van Bodoni valt onderaan ruimer uit dan de schatting. Is er
     geen vrije plek, dan blijft het cijfer staan. */
  const staafBoxen=[...svg.querySelectorAll("path.regenstaaf")].map(el=>padBox(el.getAttribute("d"))).filter(Boolean);
  if(staafBoxen.length){
    const lijnPunten=[...svg.querySelectorAll("polyline")].filter(el=>!el.closest("#scrub")).map(l=>String(l.getAttribute("points")||"").trim().split(/\s+/).map(p=>p.split(",").map(Number)));
    [...svg.querySelectorAll("text")].filter(isTempLabel).forEach(el=>{
      const box0=svgTekstBoxUitElement(el);if(!box0||!staafBoxen.some(b=>rechthoekenBotsen(b,box0,2)))return;
      const x0=Number(el.getAttribute("x")),y0=Number(el.getAttribute("y"));if(!Number.isFinite(x0)||!Number.isFinite(y0))return;
      const anderen=[...svg.querySelectorAll("text")].filter(t=>t!==el&&!t.closest("#scrub")&&t.getAttribute("display")!=="none").map(svgTekstBoxUitElement).filter(Boolean);
      bewaar(el,["x","y"]);
      for(const [dx,dy] of [[0,-1],[0,-2],[0,-3],[0,-4],[0,-6],[0,-9],[8,-6],[-8,-6],[0,-12],[10,-10],[-10,-10],[0,-15],[0,-18]]){
        el.setAttribute("x",String(x0+dx));el.setAttribute("y",String(y0+dy));
        const box=svgTekstBoxUitElement(el);
        if(box&&!staafBoxen.some(b=>rechthoekenBotsen(b,box,2))&&!anderen.some(b=>rechthoekenBotsen(b,box,1.5))&&!lijnPunten.some(p=>lijnRaaktTekstBox(p,box,1)))return;
      }
      el.setAttribute("x",String(x0));el.setAttribute("y",String(y0));
    });
  }
  svg.setAttribute("data-desktop-temp-markers",getoond.join(","));
  svg.setAttribute("data-desktop-chart-accents","1");
}

/* De uuras houdt op iedere breedte haar vaste ritme (op de telefoon en de
   desktop om de drie uur): geen extra tijd tussen de vaste tijden, want "07:00
   08:00" vlak naast elkaar oogt rommelig en breekt het ritme (verzoek van de
   eigenaar, 29 september). Piek en dal staan met stip en vet cijfer op hun
   echte punt, ook tussen twee vaste tijden; hun tijd staat bij aantikken, in de
   uurtabel en in de samenvatting. Een piek of dal op een plateau (gelijke
   waarden) schuift eerst naar het plateaupunt dat al een tijd heeft. Een gewoon
   tussencijfer zonder eigen tijd op de as vervalt: het staat dan los tussen de
   vaste tijden. Tot 25 uur. Buiten de vaste as (het oude gedrag, alleen nog als
   er geen as met ritme is) krijgt iedere temperatuur een tijd onder haar punt. */
function koppelTijdAanTemperatuur(){
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||!Array.isArray(g.T)||!Array.isArray(g.TI)||typeof g.x!=="function"||typeof g.y!=="function"||Number(g.n)>25)return;
  svg.querySelectorAll("text[data-temp-time]").forEach(el=>el.remove());
  const W=Number(g.W),cw=Number(g.cw);if(!Number.isFinite(W)||!Number.isFinite(cw)||cw<=0)return;
  const n=g.TI.length,x=i=>Number(g.x(i));
  const idxVanX=px=>{let b=0;for(let i=1;i<n;i++)if(Math.abs(x(i)-px)<Math.abs(x(b)-px))b=i;return b;};
  const ticks=bestaandeUurLabels(svg,g).filter(el=>!el.closest("#scrub"));
  if(!ticks.length)return;
  const tickIndex=el=>el.hasAttribute("data-mobile-hour-index")?Number(el.getAttribute("data-mobile-hour-index")):idxVanX(Number(el.getAttribute("x")));
  const waardeVan=el=>Number(String(el.textContent||"").trim().replace("°",""));
  const rond=i=>Number.isFinite(Number(g.T[i]))?Math.round(Number(g.T[i])):null;
  const labels=[...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&el.getAttribute("display")!=="none"&&/Bodoni/i.test(String(el.getAttribute("font-family")||""))&&/^-?\d+°$/.test(String(el.textContent||"").trim()));
  const labelIndex=el=>{
    for(const a of ["data-mobile-temp-marker-index","data-desktop-temp-marker-index","data-mobile-temp-index"]){
      const v=el.getAttribute(a);if(v!==null&&v!==""&&Number.isInteger(Number(v)))return Number(v);
    }
    /* Basislabels staan soms naast hun punt (bij de nu-lijn): neem het dichtste
       punt met dezelfde afgeronde waarde. */
    const lx=Number(el.getAttribute("x")),w=waardeVan(el);let beste=null,d=Infinity;
    for(let i=0;i<n;i++){if(rond(i)!==w)continue;const dx=Math.abs(x(i)-lx);if(dx<d){d=dx;beste=i;}}
    return beste!==null&&d<=cw*2.5?beste:idxVanX(lx);
  };
  const isMarker=el=>el.hasAttribute("data-mobile-temp-marker")||el.hasAttribute("data-desktop-temp-marker");
  const vasteMobieleAs=ticks.some(el=>el.hasAttribute("data-mobile-hour-axis"));
  /* Ook de desktop- en tabletas heeft een vast ritme zolang ieder uur niet
     een eigen cijfer draagt (dat is alleen zo bij hooguit 12 uur). */
  const vasteAs=vasteMobieleAs||(!g.M&&n>12);
  const vrijVanTijd=els=>vasteAs&&els.every(isMarker);
  const markerStip=i=>[...svg.querySelectorAll("circle[data-mobile-temp-marker-dot],circle[data-desktop-temp-marker-dot]")].filter(c=>Math.abs(Number(c.getAttribute("cx"))-x(i))<1);
  const metTijd=new Map();ticks.forEach(el=>metTijd.set(tickIndex(el),el));
  const perIndex=new Map();
  labels.forEach(el=>{const i=labelIndex(el);if(!Number.isInteger(i))return;if(!perIndex.has(i))perIndex.set(i,[]);perIndex.get(i).push(el);});

  /* 1. Piek/dal op een plateau: verplaats naar het plateaupunt met een tijd. */
  [...perIndex.entries()].forEach(([i,els])=>{
    /* Alleen de mobiele markering staat los van de uurlabels; op desktop draagt
       ieder uur zijn eigen cijfer en wijst de desktoplaag alleen aan. */
    if(metTijd.has(i)||!els.some(el=>el.hasAttribute("data-mobile-temp-marker")))return;
    const ruw=j=>Number.isFinite(Number(g.T[j]))?Number(g.T[j]):null;
    const w=ruw(i);let l=i,r=i;
    while(l-1>=0&&ruw(l-1)===w)l--;while(r+1<n&&ruw(r+1)===w)r++;
    let doel=null;for(let j=l;j<=r;j++)if(metTijd.has(j)&&!perIndex.has(j)&&(doel===null||Math.abs(j-i)<Math.abs(doel-i)))doel=j;
    if(doel===null)return;
    const dx=x(doel)-x(i),dy=Number(g.y(Number(g.T[doel])))-Number(g.y(Number(g.T[i])));
    els.forEach(el=>{
      el.setAttribute("x",String(Number(el.getAttribute("x"))+dx));el.setAttribute("y",String(Number(el.getAttribute("y"))+dy));
      for(const a of ["data-mobile-temp-marker-index","data-desktop-temp-marker-index"])if(el.hasAttribute(a))el.setAttribute(a,String(doel));
    });
    markerStip(i).forEach(c=>{c.setAttribute("cx",String(x(doel)));c.setAttribute("cy",String(g.y(Number(g.T[doel]))));});
    /* Op het anker noemt de uuras de tijd al. */
    svg.querySelectorAll(`text[data-mobile-temp-marker-time="${i}"]`).forEach(el=>el.remove());
    perIndex.delete(i);perIndex.set(doel,els);
  });

  /* 2. Tijd toevoegen waar die ontbreekt; piek/dal eerst. */
  const verwijder=i=>{
    (perIndex.get(i)||[]).forEach(el=>el.remove());perIndex.delete(i);
    svg.querySelectorAll(`circle[data-temp-index="${i}"]`).forEach(c=>c.remove());markerStip(i).forEach(c=>c.remove());
  };
  const sjabloon=ticks[0];
  const nodig=[...perIndex.keys()].filter(i=>!metTijd.has(i)&&!vrijVanTijd(perIndex.get(i))).sort((a,b)=>{
    const ma=perIndex.get(a).some(isMarker),mb=perIndex.get(b).some(isMarker);return ma!==mb?(ma?-1:1):a-b;
  });
  nodig.forEach(i=>{
    if(vasteAs){verwijder(i);return;}
    const tijd=uurAsLabelTekst(String(uurUitIso(g.TI[i])));if(!tijd){verwijder(i);return;}
    const el=sjabloon.cloneNode(false);el.textContent=tijd;
    ["data-mobile-edge-adjusted","data-mobile-hour-index"].forEach(a=>el.removeAttribute(a));
    el.setAttribute("x",String(x(i)));el.setAttribute("text-anchor","middle");el.setAttribute("data-temp-time","1");
    if(sjabloon.hasAttribute("data-mobile-hour-index"))el.setAttribute("data-mobile-hour-index",String(i));
    let box=svgTekstBoxUitElement(el);
    const rand=box&&randCorrectieVoorTekstBox(box,W,2);
    if(rand){el.setAttribute("x",String(rand.x));el.setAttribute("text-anchor",rand.anker);box=svgTekstBoxUitElement(el);}
    if(!box){verwijder(i);return;}
    const botsers=[...metTijd.values()].filter(t=>{const b=svgTekstBoxUitElement(t);return b&&rechthoekenBotsen(box,b,2);});
    const marker=(perIndex.get(i)||[]).some(isMarker);
    if(botsers.length&&!(marker&&botsers.every(t=>!perIndex.has(tickIndex(t))))){verwijder(i);return;}
    botsers.forEach(t=>{metTijd.delete(tickIndex(t));t.remove();});
    /* In tijdsvolgorde in de SVG: voorleessoftware leest de as dan op volgorde. */
    const na=[...metTijd.entries()].filter(([j])=>j>i).sort((a,b)=>a[0]-b[0])[0];
    if(na)na[1].parentNode.insertBefore(el,na[1]);
    else{const voor=[...metTijd.entries()].sort((a,b)=>b[0]-a[0])[0];if(voor)voor[1].parentNode.insertBefore(el,voor[1].nextSibling);else svg.insertBefore(el,svg.querySelector('g[data-q4-rain-periods]')||svg.querySelector("#scrub")||null);}
    metTijd.set(i,el);
  });
  /* 3. Een uurtijd zonder eigen cijfer binnen een uur van piek of dal wijkt:
     twee tijden vlak naast elkaar ("02:00 03:00") lezen als ruis. De vaste
     telefoonas houdt haar drie-uursritme. */
  if(!vasteAs)[...perIndex.entries()].filter(([i,els])=>metTijd.has(i)&&els.some(isMarker)).forEach(([i])=>{
    [i-1,i+1].forEach(j=>{
      if(perIndex.has(j)||!metTijd.has(j))return;
      metTijd.get(j).remove();metTijd.delete(j);
    });
  });
  /* 4. Desktop en tablet met een vaste as: iedere tijd op de as heeft een
     stip en een temperatuur, zoals de drie-uursankers op de telefoon. Ook het
     eerste uur naast "nu" en een uur vlak naast piek of dal (verzoek van de
     eigenaar, 1 oktober): het nu-label en piek of dal wijken voor dit cijfer,
     niet andersom. Ieder astijdcijfer krijgt data-desktop-temp-anker, zodat
     de latere lagen het nooit laten wijken of verplaatsen. Het cijfer staat
     liefst boven het punt, anders schuin erboven of eronder; is nergens een
     vrije plek, dan zoekt de laatste botsingscontrole er een. */
  if(vasteAs&&!vasteMobieleAs){
    const sjabloonCijfer=labels.find(el=>!isMarker(el)&&el.isConnected)||labels.find(el=>el.isConnected);
    const puntSjabloon=svg.querySelector("circle[data-temp-index]");
    const lijnPunten=[...svg.querySelectorAll("polyline")].filter(el=>!el.closest("#scrub")).map(l=>String(l.getAttribute("points")||"").trim().split(/\s+/).map(p=>p.split(",").map(Number)));
    const nuLabel=[...svg.querySelectorAll("text")].find(el=>/^nu(?:\s|$)/i.test(String(el.textContent||"").trim()));
    if(sjabloonCijfer)[...metTijd.keys()].sort((a,b)=>a-b).forEach(i=>{
      const w=rond(i);if(w===null)return;
      if(perIndex.has(i)){perIndex.get(i).forEach(el=>el.setAttribute("data-desktop-temp-anker",String(i)));return;}
      const px=x(i),py=Number(g.y(Number(g.T[i])));if(!Number.isFinite(px)||!Number.isFinite(py))return;
      const el=sjabloonCijfer.cloneNode(false);el.textContent=w+"°";
      [...el.attributes].filter(a=>/^data-/.test(a.name)&&a.name!=="data-basis-font-size").forEach(a=>el.removeAttribute(a.name));
      el.removeAttribute("display");el.setAttribute("text-anchor","middle");el.setAttribute("x",String(px));el.setAttribute("data-desktop-temp-anker",String(i));
      const fs=Number(el.getAttribute("font-size"))||12;
      const anderen=[...svg.querySelectorAll("text")].filter(t=>t!==nuLabel&&!t.closest("#scrub")&&t.getAttribute("display")!=="none").map(svgTekstBoxUitElement).filter(Boolean);
      const vrij=([dx,y])=>{el.setAttribute("x",String(px+dx));el.setAttribute("y",String(y));const b=svgTekstBoxUitElement(el);return !!b&&b.y>=1&&!anderen.some(a=>rechthoekenBotsen(a,b,2))&&!lijnPunten.some(p=>lijnRaaktTekstBox(p,b,1));};
      sjabloonCijfer.parentNode.insertBefore(el,sjabloonCijfer.nextSibling);
      if(![[0,py-9],[0,py-15],[8,py-9],[-8,py-9],[0,py+fs+5],[0,py-21]].some(vrij)){el.setAttribute("x",String(px));el.setAttribute("y",String(py-9));}
      perIndex.set(i,[el]);
      if(puntSjabloon){
        const punt=puntSjabloon.cloneNode(false);
        punt.setAttribute("cx",String(px));punt.setAttribute("cy",String(py));punt.setAttribute("data-temp-index",String(i));
        ["display","data-desktop-temp-moved","data-desktop-temp-yield","data-desktop-temp-added"].forEach(a=>punt.removeAttribute(a));
        punt.setAttribute("data-desktop-temp-anker",String(i));puntSjabloon.parentNode.insertBefore(punt,puntSjabloon.nextSibling);
      }
    });
  }
  svg.setAttribute("data-temp-time-complete",[...perIndex.keys()].every(i=>metTijd.has(i)||vrijVanTijd(perIndex.get(i)))?"1":"0");
}

/* Geen grafiektekst kleiner dan 11px op het scherm, op iedere breedte: de
   telefoongrafiek wordt verkleind getekend, de desktop- en tabletgrafiek op
   ware grootte met uurtijden van 9,2px. Draait vóór het plaatsen van labels,
   zodat de botsingscontroles met de echte maat rekenen. */
/* Op een breed scherm (vanaf 1440px) staat de grafiek naast de uurtabel in een
   kolom waarin de rest van de pagina groter is gezet: daar is grafiektekst 15%
   groter en minimaal 13 css-pixels. Rekent vanaf de oorspronkelijke grootte,
   zodat herhaalde rondes niet steeds verder vergroten. */
const GRAFIEK_BREED_PX=1440,GRAFIEK_BREED_MIN_PX=13,GRAFIEK_BREED_FACTOR=1.15;
function maakGrafiekTekstLeesbaar(){
  const svg=document.getElementById("chart");if(!svg)return;
  const breed=typeof window!=="undefined"&&window.innerWidth>=GRAFIEK_BREED_PX&&!(S.geo&&S.geo.M);
  const vb=svg.viewBox&&svg.viewBox.baseVal,schaal=vb&&vb.width&&svg.getBoundingClientRect().width?svg.getBoundingClientRect().width/vb.width:1;
  svg.querySelectorAll("text[font-size]").forEach(el=>{
    if(el.closest("#scrub"))return;
    if(!el.hasAttribute("data-basis-font-size"))el.setAttribute("data-basis-font-size",el.getAttribute("font-size"));
    const basis=Number(el.getAttribute("data-basis-font-size")),fs=Number(el.getAttribute("font-size"));if(!Number.isFinite(fs)||fs<=0||!Number.isFinite(basis)||basis<=0)return;
    let doel=leesbareGrootte(svg,basis);
    if(breed)doel=Math.max(doel,Math.round(basis*GRAFIEK_BREED_FACTOR*10)/10,Math.ceil(GRAFIEK_BREED_MIN_PX/schaal*10)/10);
    if(doel>fs)el.setAttribute("font-size",String(doel));
  });
}

/* Laatste botsingscontrole voor de cijfers in de grafiek. Draait na alle
   plaatsingslagen en rekent met de vormen zoals ze getekend zijn: de vloeiende
   temperatuurlijn (niet de rechte stukken tussen de uurpunten), de stippen, de
   regenstaven, de nu-lijn, de weericonen, alle andere tekst en de rand van de
   grafiek. De eerdere lagen keken elk naar een deel daarvan en konden elkaars
   correctie terugdraaien: een cijfer aan de rand schoof terug op een steile
   lijn, en "nu 25°" bleef op de lijn staan als geen van de vaste plekken vrij
   was. Een temperatuurcijfer of het nu-label dat iets raakt of los van zijn
   punt zweeft, krijgt hier de dichtstbijzijnde vrije plek bij dat punt; een
   tijd die bij het cijfer hoort (piek of dal) schuift mee. Wat al vrij en
   dichtbij staat, blijft staan. */
const BEWAKING_DX=[0,-4,4,-8,8,-12,12,-16,16,-22,22,-28,28];
const BEWAKING_DY=[0,-3,3,-6,6,-9,9,-12,12,-15,15,-19,19,-23,23];
/* Verschuivingen rond de huidige plek, plus de andere kant van het eigen punt:
   een cijfer aan de rand kan rechts van het laatste punt staan, en "nu 8°"
   links van de nu-lijn als rechts de lijn of de regen in de weg zit. */
function bewakingsKandidaten(box,punt){
  const dxs=[...BEWAKING_DX];
  if(box&&punt&&Number.isFinite(punt.x)){
    [(punt.x-4)-(box.x+box.width),(punt.x+4)-box.x].forEach(d=>[d-3,d,d+3].forEach(v=>dxs.push(Math.round(v*10)/10)));
  }
  return [...new Set(dxs)].flatMap(dx=>BEWAKING_DY.map(dy=>[dx,dy]))
    .sort((a,b)=>(a[0]*a[0]+a[1]*a[1])-(b[0]*b[0]+b[1]*b[1]));
}
/* Afstand van een tekstvak tot een punt: 0 als het punt erin ligt. */
function afstandVakTotPunt(box,px,py){
  if(!box)return Infinity;
  const dx=Math.max(box.x-px,0,px-(box.x+box.width)),dy=Math.max(box.y-py,0,py-(box.y+box.height));
  return Math.hypot(dx,dy);
}
/* De dichtstbijzijnde verschuiving waarbij vrij(dx,dy) klopt; null als geen enkele. */
function kiesVrijeVerschuiving(vrij,kandidaten=bewakingsKandidaten(null,null)){
  for(const k of kandidaten)if(vrij(k[0],k[1]))return k;
  return null;
}
/* Zichtbaarheid uit attributen: geen getComputedStyle of layoutread. */
function zichtbaarInGrafiek(el,svg){
  for(let e=el;e&&e!==svg;e=e.parentNode){
    if(!e.getAttribute)continue;
    if(e.getAttribute("display")==="none"||e.getAttribute("visibility")==="hidden"||e.getAttribute("opacity")==="0")return false;
    if(e.style&&(e.style.display==="none"||e.style.visibility==="hidden"))return false;
  }
  return true;
}
/* Tekstvak uit de attributen, op de maat van de grafiekletters: gemeten zijn
   cijfers 0,50 tot 0,53 van de lettergrootte breed, hier ruim 0,58, plus 1
   eenheid voor de rand in de kleur van het vel. Geen getBBox: dat dwingt een
   layout af. */
function bewakingsTekstBox(tekst,x,y,anker="start",fontGrootte=12){
  const inhoud=String(tekst||"").trim(),px=Number(x),py=Number(y),fs=Number(fontGrootte);
  if(!inhoud||![px,py,fs].every(Number.isFinite)||fs<=0)return null;
  const breed=inhoud.length*fs*0.58+2,a=String(anker||"start").toLowerCase();
  const links=a==="middle"?px-breed/2:a==="end"?px-breed:px;
  return {x:links,y:py-fs*0.8-1,width:breed,height:fs*0.95+2};
}
function bewakingsBox(el){
  const tag=el.tagName&&el.tagName.toLowerCase();
  if(tag==="text"){
    const fs=Number(el.getAttribute("font-size")),dy=Number(el.getAttribute("dy"))||0;
    return bewakingsTekstBox(el.textContent,el.getAttribute("x"),Number(el.getAttribute("y"))+dy,el.getAttribute("text-anchor")||"start",Number.isFinite(fs)&&fs>0?fs:12);
  }
  /* Weericoon: translate(x,y) scale(s) op een 24-eenhedenraster. */
  const m=/translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)\s*scale\(\s*([\d.]+)\s*\)/.exec(String(el.getAttribute("transform")||""));
  if(!m)return null;
  const s=Number(m[3]);return {x:Number(m[1]),y:Number(m[2]),width:24*s,height:24*s};
}
/* Punten langs een pad met M/L/C-commando's (zoals monotoonPad ze maakt):
   de vloeiende lijn zoals ze getekend is, niet de rechte stukken ertussen. */
function padPunten(d,stappen=10){
  const delen=String(d||"").match(/[MLC]|-?\d*\.?\d+(?:e-?\d+)?/gi);if(!delen)return [];
  const uit=[];let cmd="",k=0,x=NaN,y=NaN;
  const getal=()=>Number(delen[k++]);
  while(k<delen.length){
    if(/^[MLC]$/i.test(delen[k]))cmd=delen[k++].toUpperCase();
    if(cmd==="M"||cmd==="L"){x=getal();y=getal();uit.push([x,y]);}
    else if(cmd==="C"){
      const x1=getal(),y1=getal(),x2=getal(),y2=getal(),x3=getal(),y3=getal();
      for(let i=1;i<=stappen;i++){const t=i/stappen,u=1-t;
        uit.push([u*u*u*x+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,u*u*u*y+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3]);}
      x=x3;y=y3;
    }else return uit;
    if(!Number.isFinite(x)||!Number.isFinite(y))return [];
  }
  return uit;
}
/* De temperatuurlijn en de gestippelde aanloop naar nu, als puntenreeksen. */
function getekendeLijnPunten(svg){
  const uit=[];
  svg.querySelectorAll("path[data-mobile-smooth-line],polyline").forEach(el=>{
    if(el.closest("#scrub")||!zichtbaarInGrafiek(el,svg))return;
    const p=el.tagName.toLowerCase()==="polyline"
      ?String(el.getAttribute("points")||"").trim().split(/\s+/).map(q=>q.split(",").map(Number)).filter(q=>q.length===2&&q.every(Number.isFinite))
      :padPunten(el.getAttribute("d"));
    if(p.length>1)uit.push(p);
  });
  svg.querySelectorAll("line[data-nu-aanloop]").forEach(el=>{
    if(!zichtbaarInGrafiek(el,svg))return;
    const a=["x1","y1","x2","y2"].map(k=>Number(el.getAttribute(k)));
    if(a.every(Number.isFinite))uit.push([[a[0],a[1]],[a[2],a[3]]]);
  });
  return uit;
}
/* Iedere temperatuurstip staat boven een tijd op de as (verzoek van de
   eigenaar, 29 september: "niet alle stippen staan boven de tijd"). Valt piek
   of dal tussen twee astijden, dan blijft het vette cijfer bij de top van de
   lijn staan, maar zonder stip: een stip zonder tijd eronder leest als een
   meetpunt op een uur dat de as niet noemt. Geldt op iedere breedte en draait
   na de desktopaccenten, die de piek/dal-stip op desktop plaatsen. De rode
   nu-stip hoort bij de nu-lijn en blijft staan. */
function stippenAlleenBovenTijd(){
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||!Array.isArray(g.TI)||typeof g.x!=="function")return;
  const n=g.TI.length,x=i=>Number(g.x(i));
  const metTijd=new Set(asTijdIndices(svg,g).keys());
  if(!metTijd.size)return;
  const dichtst=px=>{let b=null;for(let i=0;i<n;i++)if(b===null||Math.abs(x(i)-px)<Math.abs(x(b)-px))b=i;return b;};
  svg.querySelectorAll("circle[data-temp-index],circle[data-mobile-temp-marker-dot],circle[data-desktop-temp-marker-dot]").forEach(c=>{
    if(c.closest("#scrub"))return;
    const i=dichtst(Number(c.getAttribute("cx")));
    if(i!==null&&!metTijd.has(i))c.remove();
  });
}

function bewaakGrafiekLabels(){
  const svg=document.getElementById("chart"),g=typeof S!=="undefined"&&S.geo;
  if(!svg||!g)return;
  const vb=svg.viewBox&&svg.viewBox.baseVal,W=vb&&vb.width,H=vb&&vb.height;
  if(!Number.isFinite(W)||!Number.isFinite(H)||W<=0||H<=0)return;
  const teksten=[...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&String(el.textContent||"").trim()&&zichtbaarInGrafiek(el,svg));
  const isWaarde=el=>/Bodoni/i.test(String(el.getAttribute("font-family")||""))&&/^-?\d+°$/.test(String(el.textContent||"").trim());
  const isNu=el=>/^nu(?:\s|$)/i.test(String(el.textContent||"").trim());
  const isTijd=el=>el.hasAttribute("data-temp-time")||el.hasAttribute("data-mobile-temp-marker-time");
  const beweegbaar=teksten.filter(el=>isWaarde(el)||isNu(el));
  if(!beweegbaar.length)return;
  const lijnen=getekendeLijnPunten(svg);
  const cirkels=[...svg.querySelectorAll("circle")].filter(el=>!el.closest("#scrub")&&Number(el.getAttribute("r"))>0&&zichtbaarInGrafiek(el,svg))
    .map(el=>({el,x:Number(el.getAttribute("cx")),y:Number(el.getAttribute("cy")),r:Number(el.getAttribute("r"))})).filter(c=>[c.x,c.y,c.r].every(Number.isFinite));
  const stipVakken=cirkels.map(c=>({x:c.x-c.r-0.5,y:c.y-c.r-0.5,width:2*c.r+1,height:2*c.r+1}));
  const staven=[...svg.querySelectorAll("path.regenstaaf")].filter(el=>zichtbaarInGrafiek(el,svg)).map(el=>padBox(el.getAttribute("d"))).filter(Boolean);
  const nuLijnen=[...svg.querySelectorAll("line")].filter(el=>!el.closest("#scrub")&&!el.hasAttribute("data-nu-aanloop")&&/carmine/i.test(String(el.getAttribute("stroke")||""))&&zichtbaarInGrafiek(el,svg))
    .map(el=>{const x1=Number(el.getAttribute("x1")),y1=Number(el.getAttribute("y1")),y2=Number(el.getAttribute("y2"));return {x:x1-0.75,y:Math.min(y1,y2),width:1.5,height:Math.abs(y2-y1)};})
    .filter(b=>Object.values(b).every(Number.isFinite));
  const iconen=[...svg.querySelectorAll("g[data-mobile-weather-icon],g[data-desktop-weather-icon]")].filter(el=>zichtbaarInGrafiek(el,svg)).map(bewakingsBox).filter(Boolean);
  const vakken=new Map(teksten.map(el=>[el,bewakingsBox(el)]));
  /* Een tijd bij piek of dal hoort bij het cijfer direct eronder. */
  const tijdBij=new Map();
  teksten.filter(isTijd).forEach(t=>{
    const bt=vakken.get(t);if(!bt)return;
    let beste=null,d=Infinity;
    beweegbaar.filter(isWaarde).forEach(v=>{
      const bv=vakken.get(v);if(!bv)return;
      const dx=Math.abs((bt.x+bt.width/2)-(bv.x+bv.width/2)),dy=bv.y-(bt.y+bt.height);
      if(dx<=16&&dy>=-4&&dy<=18&&dx+Math.abs(dy)<d){d=dx+Math.abs(dy);beste=v;}
    });
    if(beste&&!tijdBij.has(beste))tijdBij.set(beste,t);
  });
  /* Het punt waar een cijfer bij hoort: de stip met dezelfde index, anders de dichtstbijzijnde. */
  const nuStip=cirkels.find(c=>/carmine/i.test(String(c.el.getAttribute("fill")||"")));
  const puntVan=el=>{
    if(isNu(el))return nuStip||null;
    for(const a of ["data-mobile-temp-marker-index","data-desktop-temp-marker-index","data-mobile-temp-index"]){
      const v=el.getAttribute(a);if(v===null||v==="")continue;
      const c=cirkels.find(k=>k.el.getAttribute("data-temp-index")===v||k.el.getAttribute("data-mobile-temp-marker-dot")&&k.el.getAttribute("data-mobile-temp-marker-index")===v||k.el.getAttribute("data-desktop-temp-marker-index")===v);
      if(c)return c;
      const i=Number(v);if(Number.isInteger(i)&&typeof g.x==="function"&&typeof g.y==="function"&&Number.isFinite(Number(g.T&&g.T[i])))return {x:Number(g.x(i)),y:Number(g.y(Number(g.T[i])))};
    }
    const b=vakken.get(el);if(!b)return null;
    let beste=null,d=Infinity;
    cirkels.forEach(c=>{if(/carmine/i.test(String(c.el.getAttribute("fill")||"")))return;const a=afstandVakTotPunt(b,c.x,c.y);if(a<d){d=a;beste=c;}});
    return beste;
  };
  const verschoven=(b,dx,dy)=>b&&{x:b.x+dx,y:b.y+dy,width:b.width,height:b.height};
  /* Astijdcijfers en piek of dal gaan voor het nu-label: dat wijkt zelf, als
     laatste. Daarom kijken zij niet naar waar "nu" nu staat. */
  const isAnker=el=>el.hasAttribute("data-desktop-temp-anker")||el.hasAttribute("data-mobile-temp-label")||el.hasAttribute("data-mobile-temp-covers-anchor");
  const isMarkering=el=>el.hasAttribute("data-mobile-temp-marker")||el.hasAttribute("data-desktop-temp-marker");
  const botst=(el,box,groep)=>{
    if(!box)return false;
    const negeerNu=!isNu(el)&&(isAnker(el)||isMarkering(el));
    if(box.x<1||box.x+box.width>W-1||box.y<1||box.y+box.height>H-1)return true;
    if(lijnen.some(p=>lijnRaaktTekstBox(p,box,1)))return true;
    if(stipVakken.some(s=>rechthoekenBotsen(box,s,0.5)))return true;
    if(staven.some(s=>rechthoekenBotsen(box,s,1)))return true;
    if(iconen.some(s=>rechthoekenBotsen(box,s,1)))return true;
    if(!isNu(el)&&!el.hasAttribute("data-over-nu-lijn")&&nuLijnen.some(s=>rechthoekenBotsen(box,s,1)))return true;
    for(const [ander,b] of vakken){if(groep.includes(ander)||!b||negeerNu&&isNu(ander))continue;if(rechthoekenBotsen(box,b,1))return true;}
    return false;
  };
  /* Eerst de astijdcijfers, dan piek en dal, dan het nu-label, dan de overige cijfers. */
  const rang=el=>isNu(el)?2:isAnker(el)?0:isMarkering(el)?1:3;
  beweegbaar.sort((a,b)=>rang(a)-rang(b)).forEach(el=>{
    const tijd=tijdBij.get(el)||null,groep=tijd?[el,tijd]:[el];
    const box=vakken.get(el),tbox=tijd?vakken.get(tijd):null;
    if(!box)return;
    const punt=puntVan(el),maxAfstand=isNu(el)?16:14;
    /* Ook een cijfer dat vrij staat maar los van zijn punt zweeft, krijgt een
       plek dichterbij als die er is; lukt dat niet, dan blijft het staan. */
    const teVer=!!punt&&afstandVakTotPunt(box,punt.x,punt.y)>maxAfstand;
    const raakt=botst(el,box,groep)||!!(tbox&&botst(tijd,tbox,groep));
    if(!raakt&&!teVer)return;
    const keuze=kiesVrijeVerschuiving((dx,dy)=>{
      const nb=verschoven(box,dx,dy);
      if(punt&&afstandVakTotPunt(nb,punt.x,punt.y)>maxAfstand)return false;
      return !botst(el,nb,groep)&&!(tbox&&botst(tijd,verschoven(tbox,dx,dy),groep));
    },bewakingsKandidaten(box,punt));
    let zet=keuze;
    /* Het nu-label mag als laatste uitwijkplek bovenaan de rode nu-lijn staan,
       net boven de plot: daar is het nog steeds duidelijk de nu-waarde. */
    if(!zet&&isNu(el)&&nuLijnen.length&&Number.isFinite(Number(g.pt))){
      const lx=nuLijnen[0].x+0.75+3,basisY=Number(el.getAttribute("y"))+(Number(el.getAttribute("dy"))||0);
      zet=[Number(g.pt)-4,Number(g.pt)-16].map(ty=>[lx-box.x,ty-basisY]).find(([dx,dy])=>!botst(el,verschoven(box,dx,dy),groep))||null;
    }
    /* Een gewoon tussencijfer zonder vrije plek vervalt, zoals in de basisgrafiek:
       de waarde blijft in de lijn, het aantikken en de uurtabel. Het nu-label,
       piek en dal en de cijfers op de astijden blijven altijd. */
    if(!zet&&!raakt)return;
    if(!zet){
      const vast=isNu(el)||isAnker(el)||isMarkering(el);
      if(!vast){groep.forEach(t=>{t.setAttribute("display","none");t.setAttribute("data-label-verborgen","botsing");vakken.set(t,null);});}
      return;
    }
    if(!zet[0]&&!zet[1])return;
    const keuzeXY=zet;
    groep.forEach(t=>{
      const x=Number(t.getAttribute("x")),y=Number(t.getAttribute("y"));
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      t.setAttribute("x",String(Math.round((x+keuzeXY[0])*10)/10));t.setAttribute("y",String(Math.round((y+keuzeXY[1])*10)/10));
      t.setAttribute("data-label-bewaakt","1");
      vakken.set(t,verschoven(vakken.get(t),keuzeXY[0],keuzeXY[1]));
    });
  });
}

let uurAsToken=0;
function planUurAsHerstel(){
  const token=++uurAsToken;
  const voer=()=>{if(token===uurAsToken){maakGrafiekTekstLeesbaar();herstelUurAs();polishMobieleGrafiekRanden();vereenvoudigMobieleZonband();bouwMobieleTemperatuurRij();polishNuLabel();compactMobieleGrafiekHoogte();koppelTijdAanTemperatuur();bouwDesktopGrafiekAccenten();stippenAlleenBovenTijd();bewaakGrafiekLabels();}};
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
  const puntX=punt?Number(punt.getAttribute("cx")):NaN;
  const stipVak=Number.isFinite(puntX)&&Number.isFinite(puntY)?{x:puntX-4,y:puntY-4,width:8,height:8}:null;
  const vrij=(x,y)=>{
    const box=geschatteSvgTekstBox(nu.textContent,x,y,"start",Number(nu.getAttribute("font-size"))||10);
    return box&&box.x>=g.pl-2&&box.x+box.width<=breed-g.pr+3
      &&box.y>=g.pt-18&&box.y+box.height<=g.pt+g.ih-3
      &&(!stipVak||!rechthoekenBotsen(box,stipVak,1))
      &&!vast.some(b=>rechthoekenBotsen(box,b,3))
      &&!lijnen.some(punten=>lijnRaaktTekstBox(punten,box));
  };
  /* Laatste uitwijkplek: bovenaan de rode nu-lijn, net boven de plot. Die plek
     is vrij van de temperatuurlijn wanneer die vlak naast "nu" steil loopt. */
  /* Eerst vlak naast de rode stip (rechts van de nu-lijn, erboven of eronder),
     zodat "nu 19°" leest als de waarde van die stip; pas daarna verder weg. */
  const bijStip=Number.isFinite(puntY)?[-5,11,-12,17,-19,23,-26,29].map(dy=>[0,puntY+dy-oorspronkelijkY]):[];
  const posities=[...bijStip,[0,0],[0,-16],[0,16],[0,-24],[0,24],[12,-16],[12,16],[-12,-16],[-12,16],[0,-30],[0,30],[0,Number(g.pt)-4-oorspronkelijkY]];
  const gevonden=posities.find(([dx,dy])=>vrij(oorspronkelijkX+dx,oorspronkelijkY+dy));
  if(gevonden){
    nu.setAttribute("x",String(oorspronkelijkX+gevonden[0]));nu.setAttribute("y",String(oorspronkelijkY+gevonden[1]));
    if(gevonden[0]||gevonden[1])nu.setAttribute("data-now-collision-adjusted","1");
  }
  /* Bij een uitzonderlijk volle curve blijft tekst ook zonder vrije positie
     leesbaar doordat de achtergrond de onderliggende lijn vrijhoudt. */
  nu.setAttribute("stroke","var(--sheet)");
  nu.setAttribute("stroke-width","3");nu.setAttribute("paint-order","stroke");nu.setAttribute("stroke-linejoin","round");
}
let nuPolishToken=0;
function planNuLabelPolish(){
  const token=++nuPolishToken,voer=()=>{if(token===nuPolishToken){polishNuLabel();bewaakGrafiekLabels();}};
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
  const gebruik=bronGebruikUitResources(resourceEntries(),S.land,{forecastBeschikbaar:!!S.d,airBeschikbaar:false,forecastProvider:S.d&&S.d.provider||""});
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
    else if(/Visual Crossing/i.test(naam))actief=gebruik.visualcrossing;
    else if(naam==="WeatherAPI.com")actief=gebruik.weatherapi;
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

/* ===== Q4 REGENPERIODEN 20260811 ===== */
(function(){
"use strict";
const q4Getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const q4Mm=v=>{const n=q4Getal(v);return n===null?"–":n.toFixed(1).replace(".",",");};
const q4Tijd=t=>String(t||"").slice(11,16);
const q4DagKort=t=>{try{const d=new Date(String(t).slice(0,10)+"T12:00:00");return DAGEN[d.getDay()]+" "+d.getDate();}catch(e){return "";}};
const Q4_SVG_NS="http://www.w3.org/2000/svg";

/* De grafiekhint hoort bij de interactieve Q4-presentatielaag. Een tekstuele
   postbuild-replace bleek geen betrouwbare runtime-eigenaar: de geassembleerde
   artifact kan historische functiebron bevatten waarvan de uitvoervolgorde niet
   overeenkomt met de laatste tekstmatch. Omdat Q4 vóór iedere startup-route
   activeert, krijgt de globale binding hier één expliciete runtime-owner. */
chartHint=function(){
  const el=document.getElementById("charthint");
  if(el)el.textContent="Selecteer een punt in de grafiek voor details.";
};

/* Bewolkingspercentages komen uit een model en suggereren bij 0–4% meer
   meetprecisie dan de hoofdtegel nodig heeft. De categorie eronder blijft de
   betekenis geven; in de grote waarde groeperen we alleen dit vrijwel wolkeloze
   randgebied tot <5%. Hogere waarden blijven ongewijzigd. */
function q4BewolkingPresentatie(){
  const c=S.d&&S.d.current,el=document.getElementById("cloud");
  if(!c||!el)return;
  const cc=q4Getal(c.cloud_cover);
  if(cc!==null&&cc>=0&&cc<5)el.innerHTML="&lt;5<s>%</s>";
}
/* De grote kans/hoeveelheidswaarde in #pop wordt door Q1 uit een 60-minutenanalyse
   opgebouwd. Als het op dit moment regent veranderde Q1 alleen de kop naar
   "Neerslag nu", waardoor een uurkans en uurhoeveelheid als momentopname konden
   worden gelezen. De subtekst mag de actuele toestand blijven noemen; de kop
   benoemt voortaan altijd eerlijk het tijdvak van de cijfers. */
function q4NeerslagTegelPresentatie(){
  const waarde=document.getElementById("pop"),stat=waarde&&waarde.parentElement,kop=stat&&stat.querySelector(".eyebrow");
  if(kop&&/^Neerslag (?:nu|komend uur)$/i.test((kop.textContent||"").trim()))kop.textContent="Neerslag komend uur";
}
const q4BasisMeters=meters;
meters=function(){
  q4BasisMeters();
  q4BewolkingPresentatie();
  q4NeerslagTegelPresentatie();
};

/* Nachtzicht toont het gemiddelde van een hele nacht. Ook daar is 0–4% een
   modeluitkomst, geen meting met procentpuntprecisie. De score blijft met de
   ongewijzigde ruwe cw rekenen; uitsluitend de al gerenderde presentatie wordt
   na de bestaande nachten()-owner genormaliseerd naar dezelfde <5%-notatie. */
function q4NachtzichtPresentatie(){
  document.querySelectorAll("#nights .perc").forEach(el=>{
    const m=/^(\d+(?:[.,]\d+)?)%$/.exec((el.textContent||"").trim());
    if(!m)return;
    const waarde=Number(m[1].replace(",","."));
    if(Number.isFinite(waarde)&&waarde<5)el.textContent="<5%";
  });
}
const q4BasisNachten=nachten;
nachten=function(){
  q4BasisNachten();
  q4NachtzichtPresentatie();
};

/* De schaal staat al in de AQI-kop. De subregel hoeft die niet nogmaals te
   herhalen ("redelijk · Europese AQI"). De classificatie zelf blijft exact
   dezelfde; alleen de redundante suffix verdwijnt en begint als zelfstandig
   statuswoord met een hoofdletter. */
function q4LuchtkwaliteitPresentatie(){
  const sub=document.querySelector("#aq .stat:first-child .ssub");
  if(!sub)return;
  const schoon=(sub.textContent||"").replace(/\s*·\s*(Europese|Amerikaanse) AQI\s*$/i,"").trim();
  if(schoon)sub.textContent=schoon.charAt(0).toUpperCase()+schoon.slice(1);
}
const q4BasisLucht=lucht;
lucht=function(){
  q4BasisLucht();
  q4LuchtkwaliteitPresentatie();
};

function q4SvgLijn(x1,y1,x2,y2,dikte){
  const el=document.createElementNS(Q4_SVG_NS,"line");
  el.setAttribute("x1",String(x1));el.setAttribute("y1",String(y1));
  el.setAttribute("x2",String(x2));el.setAttribute("y2",String(y2));
  el.setAttribute("stroke",TEAL);el.setAttribute("stroke-width",String(dikte));
  return el;
}
function q4SvgTekst(x,y,waarde,font,samenvatting){
  const el=document.createElementNS(Q4_SVG_NS,"text");
  el.setAttribute("x",String(x));el.setAttribute("y",String(y));
  el.setAttribute("fill",INK45);el.setAttribute("font-family","DM Mono,monospace");
  el.setAttribute("font-size",String(font));
  if(samenvatting)el.setAttribute("data-q4-rain-summary",samenvatting);
  el.textContent=waarde;
  return el;
}

function q4Regenperioden(g){
  const h=S.d&&S.d.hourly||{},tijden=Array.isArray(g&&g.TI)?g.TI:[];
  const bronStart=Number.isInteger(S.chartStart)?S.chartStart:null;
  const mm=tijden.map((tijd,i)=>{
    /* hourly precipitation op TI[i] beschrijft het voorafgaande interval.
       De eerste waarde ligt dus buiten het zichtbare grafiekvenster. */
    if(i===0)return null;
    /* Gebruik de exacte bronindex van etmaal(), niet indexOf(tijd). Rond de
       najaars-DST-omslag kan dezelfde lokale kloktekst namelijk twee keer
       voorkomen. S.chartStart+i blijft dan één-op-één in forecastvolgorde. */
    const bron=bronStart===null?-1:bronStart+i;
    if(bron<0||!Array.isArray(h.time)||bron>=h.time.length||h.time[bron]!==tijd)return null;
    const waarde=q4Getal(h.precipitation&&h.precipitation[bron]);
    if(waarde===null||waarde<0)return null;
    if(S.dag==null&&globalThis.WeatherNowInterpretatie&&typeof globalThis.WeatherNowInterpretatie.lokaalNaarMinuten==="function"){
      const eind=globalThis.WeatherNowInterpretatie.lokaalNaarMinuten(tijd);
      const nu=globalThis.WeatherNowInterpretatie.lokaalNaarMinuten(weatherNowActueleLokaleTijd());
      if(Number.isFinite(eind)&&Number.isFinite(nu)&&eind<=nu)return null;
    }
    return waarde;
  });
  /* Q4 is vanaf dit punt eigenaar van de definitief uitgelijnde uurhoeveelheid.
     De regenstrook gebruikt g.MM. De oudere Q1-tooltip verwacht nog Q1MM; die
     naam blijft tijdelijk als compatibiliteitsalias bestaan, maar wijst bewust
     naar EXACT dezelfde array. Daardoor kan tooltip en strip niet meer uit twee
     los berekende reeksen lezen. Een latere architectuuropschoning kan de alias
     verwijderen zonder de releasefix nu breder te maken. */
  g.MM=mm;
  g.Q1MM=mm;
  const perioden=[];let lopend=null;
  for(let i=1;i<mm.length;i++){
    const waarde=mm[i];
    if(waarde!==null&&waarde>=0.1){
      if(!lopend)lopend={van:i-1,tot:i,som:0,piek:i,piekMm:waarde};
      lopend.tot=i;lopend.som+=waarde;
      if(waarde>lopend.piekMm){lopend.piek=i;lopend.piekMm=waarde;}
    }else if(lopend){perioden.push(lopend);lopend=null;}
  }
  if(lopend)perioden.push(lopend);
  return perioden;
}

function q4KansIndex(g,x){
  const midden=q4Getal(x)===null?null:q4Getal(x)+g.cw/2;
  if(midden===null||!Number.isFinite(g.n))return {i:-1,midden:null};
  let beste=-1,afstand=Infinity;
  for(let i=0;i<g.n;i++){
    const d=Math.abs(g.x(i)-midden);
    if(d<afstand){beste=i;afstand=d;}
  }
  return {i:afstand<=Math.max(0.75,g.cw*.12)?beste:-1,midden};
}

function q4PeriodeBedragLabels(g,perioden,y,font){
  const links=q4Getal(g.pl)||0,rechts=g.W-(q4Getal(g.pr)||0),rijen=[],labels=[];
  perioden.forEach((p,index)=>{
    const tekst=q4Mm(p.som)+" mm",x1=g.x(p.van),x2=g.x(p.tot);
    const geschat=Math.max(28,tekst.length*font*.62),midden=(x1+x2)/2;
    const x=Math.max(links+geschat/2,Math.min(rechts-geschat/2,midden));
    const vak={links:x-geschat/2-4,rechts:x+geschat/2+4};
    let rij=0;
    while((rijen[rij]||[]).some(b=>!(vak.rechts<b.links||vak.links>b.rechts)))rij++;
    if(!rijen[rij])rijen[rij]=[];rijen[rij].push(vak);
    labels.push({index,tekst,x,rij});
  });
  return {labels,rijen:Math.max(1,rijen.length),eersteY:y+14,stap:11};
}

/* Een bracket is visueel snel te scannen, maar bij meerdere perioden hoort de
   exacte timing ook als tekst onder de grafiek te staan. Dat voorkomt dat de
   gebruiker de x-as moet terugrekenen. Bij een kalendergrens noemen we beide
   dagen expliciet, zodat 23:00–02:00 nooit dubbelzinnig wordt. */
function q4PeriodeTijdvak(g,p){
  const van=g&&Array.isArray(g.TI)?g.TI[p.van]:null,tot=g&&Array.isArray(g.TI)?g.TI[p.tot]:null;
  const vanDatum=String(van||"").slice(0,10),totDatum=String(tot||"").slice(0,10);
  const vanDag=q4DagKort(van),totDag=q4DagKort(tot);
  if(vanDatum&&totDatum&&vanDatum!==totDatum)return vanDag+" "+q4Tijd(van)+"–"+totDag+" "+q4Tijd(tot);
  return (vanDag?vanDag+" ":"")+q4Tijd(van)+"–"+q4Tijd(tot);
}

function q4TekenRegenperioden(svg,g,perioden){
  svg.querySelectorAll('g[data-q4-rain-periods]').forEach(el=>el.remove());

  /* De oude hoeveelheidstaven en losse mm-cijfers verdwijnen volledig. Een
     statisch kanspercentage hoort voortaan alleen bij een uur waarvoor dezelfde
     definitief uitgelijnde Q4-array ook meetbare neerslag bevat. Zo staat een
     losse 19%-kans niet meer visueel onder een droog stuk alsof daar al een
     regenperiode loopt. De tooltip behoudt ALLE kansen, ook bij 0 mm en <10%. */
  [...svg.querySelectorAll("rect")].forEach(el=>{
    if(el.getAttribute("fill")===TEAL&&el.getAttribute("fill-opacity")===".16")el.remove();
  });
  [...svg.querySelectorAll("text")].forEach(el=>{
    if(/ millimeter neerslag$/.test(el.getAttribute("aria-label")||""))el.remove();
  });
  [...svg.querySelectorAll("text")].forEach(el=>{
    if(el.getAttribute("fill")!==TEAL||!/^\d+%$/.test((el.textContent||"").trim()))return;
    const kans=Number((el.textContent||"").trim().replace("%",""));
    const positie=q4KansIndex(g,el.getAttribute("x"));
    const mm=positie.i>=0&&Array.isArray(g.MM)?q4Getal(g.MM[positie.i]):null;
    if(!Number.isFinite(kans)||kans<10||mm===null||mm<0.1){el.remove();return;}
    if(el.dataset.q4ProbabilityCentered==="1")return;
    el.setAttribute("x",String(positie.midden));el.dataset.q4ProbabilityCentered="1";
  });

  const basisH=q4Getal(g.H)||296;
  const oudeAria=(svg.getAttribute("aria-label")||"")
    /* Deze door de eerdere correctheidslaag toegevoegde uitleg is één volledige
       zin met een puntkomma. Verwijder de hele zin; stoppen bij het eerste woord
       'modeluur' liet eerder een losse '; een deels verstreken …' achter. */
    .replace(/ Neerslagbalken zijn[^.]*\./g,"").trim();
  if(!perioden.length){
    svg.setAttribute("viewBox","0 0 "+g.W+" "+basisH);
    svg.setAttribute("aria-label",oudeAria);
    return;
  }

  /* Iedere aaneengesloten periode houdt zijn eigen bracket op de werkelijke
     uurpositie en krijgt direct eronder de som van exact diezelfde intervallen.
     Korte perioden kunnen op mobiel dicht bij elkaar liggen; de bedragen worden
     daarom automatisch over meerdere compacte regels verdeeld als ze botsen. */
  const pb=g.pt+g.ih,y=pb+48,regel=g.M?14:16,bedragFont=g.M?8.8:9.4;
  const bedragen=q4PeriodeBedragLabels(g,perioden,y,bedragFont);
  const laatsteBedragY=bedragen.eersteY+(bedragen.rijen-1)*bedragen.stap;
  const samenvattingY=laatsteBedragY+20;
  /* Exacte periode-regels zijn vooral nodig bij de 24-uursgrafiek, waar de
     gebruiker de komende regenmomenten praktisch wil kunnen plannen. Op 48 uur
     of zeven dagen kunnen er veel afzonderlijke natte blokken zijn; alle regels
     uitschrijven zou de SVG daar onnodig hoog maken. Brackets, totalen en piek
     blijven in die langere weergaven wel gewoon bestaan. */
  const detailRegels=perioden.length>1&&g.n<=25?perioden.map(p=>q4PeriodeTijdvak(g,p)+" · "+q4Mm(p.som)+" mm"):[];
  const piekY=samenvattingY+regel*(detailRegels.length+1);
  const nieuwH=Math.max(basisH,piekY+17+8);
  svg.setAttribute("viewBox","0 0 "+g.W+" "+nieuwH);g.H=nieuwH;

  const groep=document.createElementNS(Q4_SVG_NS,"g");
  groep.setAttribute("data-q4-rain-periods","1");
  groep.setAttribute("aria-label","Neerslagperioden met tijdvak en hoeveelheid per periode");
  /* De bracketlaag is puur informatief. Het transparante #hit-vlak blijft de
     exclusieve eigenaar van muis/touchinteractie; de regenlaag kan daardoor ook
     na toekomstige DOM-herordening nooit een pointerevent onderscheppen. */
  groep.setAttribute("pointer-events","none");
  perioden.forEach(p=>{
    const x1=g.x(p.van),x2=g.x(p.tot);
    const horizontaal=q4SvgLijn(x1,y,x2,y,3);
    horizontaal.setAttribute("stroke-linecap","square");
    groep.appendChild(horizontaal);
    groep.appendChild(q4SvgLijn(x1,y-4,x1,y+4,1));
    groep.appendChild(q4SvgLijn(x2,y-4,x2,y+4,1));
  });
  bedragen.labels.forEach(item=>{
    const label=q4SvgTekst(item.x,bedragen.eersteY+item.rij*bedragen.stap,item.tekst,bedragFont);
    label.setAttribute("text-anchor","middle");
    label.setAttribute("data-q4-rain-period-amount",String(item.index));
    groep.appendChild(label);
  });

  const totaal=perioden.reduce((som,p)=>som+p.som,0);
  let piek=perioden[0];for(const p of perioden)if(p.piekMm>piek.piekMm)piek=p;
  const één=perioden.length===1,eerste=perioden[0];
  const periodeTekst=één
    ? q4Tijd(g.TI[eerste.van])+"–"+q4Tijd(g.TI[eerste.tot])+" · totaal "+q4Mm(totaal)+" mm"
    : perioden.length+" regenperiodes · totaal "+q4Mm(totaal)+" mm";
  const basisDatum=String(g.TI&&g.TI[0]||"").slice(0,10),piekDatum=String(g.TI&&g.TI[piek.piek]||"").slice(0,10);
  const dag=(g.n>49||(basisDatum&&piekDatum&&basisDatum!==piekDatum))?q4DagKort(g.TI[piek.piek])+" ":"";
  const piekTekst="Meeste regen "+dag+q4Tijd(g.TI[piek.piek-1])+"–"+q4Tijd(g.TI[piek.piek])+" · "+q4Mm(piek.piekMm)+" mm";
  const font=g.M?9.3:10.2;
  groep.appendChild(q4SvgTekst(g.pl,samenvattingY,periodeTekst,font,"total"));
  detailRegels.forEach((tekst,i)=>{
    const detail=q4SvgTekst(g.pl,samenvattingY+regel*(i+1),tekst,font);
    detail.setAttribute("data-q4-rain-period-detail",String(i));
    groep.appendChild(detail);
  });
  groep.appendChild(q4SvgTekst(g.pl,piekY,piekTekst,font,"peak"));

  const scrub=svg.querySelector("#scrub");svg.insertBefore(groep,scrub||null);
  const detailAria=g.n<=25?" Onder de grafiek staan tijdvak en verwachte hoeveelheid per regenperiode.":"";
  svg.setAttribute("aria-label",(oudeAria+" Meetbare neerslag staat als aaneengesloten perioden onder de temperatuurcurve."+detailAria+" Kanswaarden zonder meetbare hoeveelheid blijven via de details beschikbaar.").trim());
}

/* De kwartiergrafiek tekent in de historische owner ieder positief getal. Een
   interpolatie van bijvoorbeeld 0,04 mm krijgt daardoor een echte staaf, waarna
   de formattering op één decimaal er zichtbaar "0,0" van maakt. Dat is precies
   strijdig met de centrale interpretatiedrempel: WeatherNow noemt pas 0,1 mm
   meetbaar. We veranderen de brondata niet. Na de gewone render verwijderen we
   uitsluitend de statische staaf, toplijn en hoeveelheidtekst van intervallen
   die volgens DEZELFDE centrale drempel nog een spoorhoeveelheid zijn. De analyse
   en eventuele consumententekst houden de onbewerkte waarden beschikbaar. */
function q4KwartierMeetbaarPresentatie(){
  const svg=document.getElementById("nc"),api=globalThis.WeatherNowInterpretatie;
  if(!svg||!api||typeof api.analyseerNeerslagData!=="function")return;
  const analyse=api.analyseerNeerslagData(S.d,120,weatherNowActueleLokaleTijd());
  const grens=q4Getal(api.INTERPRETATIE_CONFIG&&api.INTERPRETATIE_CONFIG.meetbaarMm);
  if(!analyse||analyse.bronHoeveelheid!=="kwartierdata"||!Array.isArray(analyse.minutelyItems)||!analyse.minutelyItems.length)return;
  const meetbaar=grens===null?0.1:grens,items=analyse.minutelyItems;
  const M=typeof window!=="undefined"&&window.innerWidth<760,W=M?380:900,pl=M?26:44,pr=M?8:20,iw=W-pl-pr,cw=iw/items.length;
  const tolerantie=Math.max(0.6,cw*.03);
  items.forEach((item,k)=>{
    const p=q4Getal(item&&item.precipitation),fractie=q4Getal(item&&item.fractie);
    const waarde=p===null||fractie===null?null:p*fractie;
    if(waarde===null||waarde<=0||waarde>=meetbaar)return;
    const midden=pl+k*cw+cw/2;
    [...svg.querySelectorAll("rect")].forEach(el=>{
      if(el.getAttribute("fill")!==TEAL||el.getAttribute("fill-opacity")!==".2")return;
      const x=q4Getal(el.getAttribute("x")),breedte=q4Getal(el.getAttribute("width"));
      if(x!==null&&breedte!==null&&Math.abs(x+breedte/2-midden)<=tolerantie)el.remove();
    });
    [...svg.querySelectorAll("line")].forEach(el=>{
      if(el.getAttribute("stroke")!==TEAL||el.getAttribute("stroke-width")!=="1.2")return;
      const x1=q4Getal(el.getAttribute("x1")),x2=q4Getal(el.getAttribute("x2"));
      if(x1!==null&&x2!==null&&Math.abs((x1+x2)/2-midden)<=tolerantie)el.remove();
    });
    [...svg.querySelectorAll("text")].forEach(el=>{
      if(el.getAttribute("fill")!==TEAL||!/^-?\d+(?:[.,]\d+)?$/.test((el.textContent||"").trim()))return;
      const x=q4Getal(el.getAttribute("x"));
      if(x!==null&&Math.abs(x-midden)<=tolerantie)el.remove();
    });
  });
}
const q4BasisNowcast=nowcast;
nowcast=function(){
  q4BasisNowcast();
  q4KwartierMeetbaarPresentatie();
};

const q4BasisEtmaal=etmaal;
etmaal=function(start,n){
  q4BasisEtmaal(start,n);
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||typeof g.x!=="function"||!Array.isArray(g.TI))return;
  q4TekenRegenperioden(svg,g,q4Regenperioden(g));
};
})();

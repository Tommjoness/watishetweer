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

function q4TekenRegenperioden(svg,g,perioden){
  svg.querySelectorAll('g[data-q4-rain-periods]').forEach(el=>el.remove());

  /* De oude hoeveelheidstaven en losse mm-cijfers verdwijnen volledig. */
  [...svg.querySelectorAll("rect")].forEach(el=>{
    if(el.getAttribute("fill")===TEAL&&el.getAttribute("fill-opacity")===".16")el.remove();
  });
  [...svg.querySelectorAll("text")].forEach(el=>{
    if(/ millimeter neerslag$/.test(el.getAttribute("aria-label")||""))el.remove();
  });

  /* De vorige correctheidslaag verplaatste alle teal teksten een halve kolom om
     de oude intervalstaven te corrigeren. Daardoor schoven ook de procentlabels
     van hun eigen tijdstip. Alleen die kanslabels worden exact teruggezet. */
  [...svg.querySelectorAll("text")].forEach(el=>{
    if(el.getAttribute("fill")!==TEAL||!/^\d+%$/.test((el.textContent||"").trim()))return;
    if(el.dataset.q4ProbabilityCentered==="1")return;
    const x=q4Getal(el.getAttribute("x"));
    if(x!==null){el.setAttribute("x",String(x+g.cw/2));el.dataset.q4ProbabilityCentered="1";}
  });

  const basisH=q4Getal(g.H)||296;
  const oudeAria=(svg.getAttribute("aria-label")||"")
    .replace(/ Neerslagbalken zijn[^.]*?(?:modeluur|omgerekend)\.?/g,"").trim();
  if(!perioden.length){
    svg.setAttribute("viewBox","0 0 "+g.W+" "+basisH);
    svg.setAttribute("aria-label",oudeAria);
    return;
  }

  /* Iedere aaneengesloten periode houdt zijn eigen bracket op de werkelijke
     uurpositie. De tekst wordt bewust NIET per bracket herhaald: op een buiige
     dag zou dat zes of meer regels kunnen opleveren. Eén totaalsom en één
     zwaarste uurvak zijn de informatie die de gebruiker daadwerkelijk vroeg. */
  const pb=g.pt+g.ih,y=pb+48,regel=g.M?14:16;
  const nieuwH=Math.max(basisH,y+17+regel+17+8);
  svg.setAttribute("viewBox","0 0 "+g.W+" "+nieuwH);g.H=nieuwH;

  const groep=document.createElementNS(Q4_SVG_NS,"g");
  groep.setAttribute("data-q4-rain-periods","1");
  groep.setAttribute("aria-label","Neerslagperioden");
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

  const totaal=perioden.reduce((som,p)=>som+p.som,0);
  let piek=perioden[0];for(const p of perioden)if(p.piekMm>piek.piekMm)piek=p;
  const één=perioden.length===1,eerste=perioden[0];
  const periodeTekst=één
    ? q4Tijd(g.TI[eerste.van])+"–"+q4Tijd(g.TI[eerste.tot])+" · totaal "+q4Mm(totaal)+" mm"
    : perioden.length+" regenperiodes · totaal "+q4Mm(totaal)+" mm";
  const dag=g.n>49?q4DagKort(g.TI[piek.piek])+" ":"";
  const piekTekst="Meeste regen "+dag+q4Tijd(g.TI[piek.piek-1])+"–"+q4Tijd(g.TI[piek.piek])+" · "+q4Mm(piek.piekMm)+" mm";
  const font=g.M?9.3:10.2;
  groep.appendChild(q4SvgTekst(g.pl,y+17,periodeTekst,font,"total"));
  groep.appendChild(q4SvgTekst(g.pl,y+17+regel,piekTekst,font,"peak"));

  const scrub=svg.querySelector("#scrub");svg.insertBefore(groep,scrub||null);
  svg.setAttribute("aria-label",(oudeAria+" Meetbare neerslag staat als aaneengesloten perioden onder de temperatuurcurve.").trim());
}

const q4BasisEtmaal=etmaal;
etmaal=function(start,n){
  q4BasisEtmaal(start,n);
  const svg=document.getElementById("chart"),g=S.geo;
  if(!svg||!g||typeof g.x!=="function"||!Array.isArray(g.TI))return;
  q4TekenRegenperioden(svg,g,q4Regenperioden(g));
};
})();

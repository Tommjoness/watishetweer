/* ===== UI POLISH RUNTIME 20260813 ===== */
(function(){
"use strict";

const uiGetal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;

/* Zichtbare microcopy hoort bij de runtime die het betreffende UI-onderdeel
   bezit. Daarmee hoeft een late artifactpatch geen wind-, druk-, zon- of
   briefingtekst meer te herschrijven. */
function uiWindstootTekst(pg,nu,dag,vak){
  if(!pg||uiGetal(pg.v)===null||!pg.t)return "Geen uurgegevens beschikbaar.";
  const waarde=Math.round(Number(pg.v));
  const dagNaam=String(dag||"").trim();
  const tijdvak=String(vak||"").trim();
  const dagInZin=dagNaam?dagNaam.charAt(0).toLowerCase()+dagNaam.slice(1):"eerder";
  if(String(pg.t)>String(nu||"")){
    if(/^Vandaag$/i.test(dagNaam))return `Later vandaag kunnen rond ${tijdvak} windstoten tot ${waarde} km/u voorkomen.`;
    if(/^Morgen$/i.test(dagNaam))return `Morgen kunnen rond ${tijdvak} windstoten tot ${waarde} km/u voorkomen.`;
    return `${dagNaam||"Later"} kunnen rond ${tijdvak} windstoten tot ${waarde} km/u voorkomen.`;
  }
  if(/^Vandaag$/i.test(dagNaam))return `Volgens de verwachting kwam de sterkste windstoot vandaag rond ${tijdvak} uit op ${waarde} km/u.`;
  if(/^Gisteren$/i.test(dagNaam))return `Volgens de verwachting kwam de sterkste windstoot gisteren rond ${tijdvak} uit op ${waarde} km/u.`;
  return `Volgens de verwachting kwam de sterkste windstoot ${dagInZin} rond ${tijdvak} uit op ${waarde} km/u.`;
}

function uiZonurenWoord(uur,daglichtUur){
  const zon=uiGetal(uur),daglicht=uiGetal(daglichtUur);
  if(zon===null)return "Zonuren niet beschikbaar.";
  if(daglicht!==null&&daglicht>0){
    const aandeel=Math.max(0,Math.min(1,zon/daglicht));
    if(aandeel>=0.8)return "De zon schijnt bijna de hele dag.";
    if(aandeel>=0.6)return "Vandaag is er veel zon.";
    if(aandeel>=0.35)return "Vandaag zijn er meerdere uren zon.";
    if(aandeel>=0.15)return "Vandaag zijn er enkele uren zon.";
    return "Vandaag is er weinig zon.";
  }
  if(zon>=8)return "Vandaag is er veel zon.";
  if(zon>=4)return "Vandaag zijn er meerdere uren zon.";
  if(zon>=1)return "Vandaag zijn er enkele uren zon.";
  return "Vandaag is er weinig zon.";
}

function uiLuchtdrukTekst(tekst){
  const t=String(tekst||"").trim();
  let m=/^Licht (gestegen|gedaald) in de afgelopen drie uur\.$/i.exec(t);
  if(m)return "De luchtdruk is in de afgelopen drie uur licht "+m[1].toLowerCase()+".";
  m=/^In de afgelopen drie uur ([0-9]+(?:[.,][0-9]+)? hPa) (gestegen|gedaald)\.$/i.exec(t);
  if(m)return "De luchtdruk is in de afgelopen drie uur "+m[1]+" "+m[2].toLowerCase()+".";
  return t;
}

/* Rond middernacht mag de taal niet alleen naar de klok kijken. Als de genoemde
   nachtminimumtemperatuur al bereikt is (of binnen de afrondmarge ligt), is
   "koelt later af naar" feitelijk onjuist. Dan benoemen we het minimum zonder
   een toekomstige daling te suggereren. Alleen bij een echte resterende daling
   gebruiken we "Later vannacht". */
function uiBriefingTijdtaal(html,nuLokaal,huidigeTemperatuur){
  const bron=String(html||"");
  const m=/T(\d{2}):(\d{2})/.exec(String(nuLokaal||""));
  if(!m)return bron;
  const uur=Number(m[1]);
  if(!Number.isFinite(uur)||uur<0||uur>=5)return bron;
  const huidige=uiGetal(huidigeTemperatuur);
  return bron.replace(/Vannacht koelt het af naar\s*(<b>)?(-?\d+(?:[.,]\d+)?) graden(<\/b>)?\./gi,(volledig,open,doelTekst,sluit)=>{
    const doel=Number(String(doelTekst).replace(",","."));
    const waarde=(open||"")+doelTekst+" graden"+(sluit||"");
    if(huidige!==null&&Number.isFinite(doel)&&doel>=huidige-0.75)
      return "De minimumtemperatuur vannacht ligt rond "+waarde+".";
    return "Later vannacht koelt het af naar "+waarde+".";
  });
}

function uiDagNeerslagTekst(kans,som){
  const k=uiGetal(kans),mm=uiGetal(som);
  if(k===null)return null;
  const pct=Math.round(Math.max(0,Math.min(100,k)));
  if(pct<10&&(mm===null||mm<0.1))return "Droog";
  return pct+"%";
}

function uiIsNwsStructuur(tekst){
  return /\*\s*(?:WHAT|WHERE|WHEN|IMPACTS)\.\.\./i.test(String(tekst||""));
}

/* Exporteer alleen zuivere presentatieregels voor regressietests. */
globalThis.WeatherNowUiPolish20260813=Object.freeze({
  windstootTekst:uiWindstootTekst,
  zonurenWoord:uiZonurenWoord,
  luchtdrukTekst:uiLuchtdrukTekst,
  briefingTijdtaal:uiBriefingTijdtaal,
  dagNeerslagTekst:uiDagNeerslagTekst,
  isNwsStructuur:uiIsNwsStructuur
});

if(typeof zonurenTegel==="function"){
  const uiBasisZonurenTegel=zonurenTegel;
  zonurenTegel=function(){
    const day=S.d&&S.d.daily;
    const idx=day&&Array.isArray(day.time)?day.time.indexOf(plaatsVandaag()):-1;
    const sec=idx>=0&&day&&Array.isArray(day.sunshine_duration)?uiGetal(day.sunshine_duration[idx]):null;
    if(sec===null||sec<0)return uiBasisZonurenTegel();
    const uur=sec/3600;
    let daglichtUur=null;
    const sr=day&&Array.isArray(day.sunrise)?day.sunrise[idx]:null;
    const ss=day&&Array.isArray(day.sunset)?day.sunset[idx]:null;
    if(sr&&ss&&typeof mins==="function"){
      const minuten=mins(ss)-mins(sr);
      if(Number.isFinite(minuten)&&minuten>0)daglichtUur=minuten/60;
    }
    const woord=uiZonurenWoord(uur,daglichtUur);
    return `<div class="stat zon"><div class="eyebrow">Zonuren</div>
      <div class="sval">${nl(uur)}<s>uur</s></div><div class="ssub">${woord}</div></div>`;
  };
}

if(typeof meters==="function"){
  const uiBasisMeters=meters;
  meters=function(){
    uiBasisMeters();
    const druk=document.getElementById("pressub");
    if(druk)druk.textContent=uiLuchtdrukTekst(druk.textContent);
    const pgRuw=typeof piek==="function"?piek("wind_gusts_10m"):null;
    const pg=pgRuw&&uiGetal(pgRuw.v)!==null&&Number(pgRuw.v)>=0?pgRuw:null;
    if(!pg)return;
    const nu=(S.d&&S.d.current&&S.d.current.time)||"";
    const dag=typeof dagAanduiding==="function"?dagAanduiding(pg.t,true):"";
    const vak=typeof weatherNowUurvak==="function"?weatherNowUurvak(pg.t):String(pg.t).slice(11,16);
    if(typeof zetTekst==="function")zetTekst("gustsub",uiWindstootTekst(pg,nu,dag,vak));
  };
}

function uiPolishDagen(){
  const c=document.getElementById("days"),day=S.d&&S.d.daily;
  if(!c||!day)return;
  const kop=c.querySelector(".row.day.kop");
  if(kop){
    const bereik=kop.querySelector(".bar");if(bereik)bereik.textContent="Bereik";
    const regen=kop.querySelector(".drain");if(regen)regen.textContent="Neerslag";
  }
  const rijen=[...c.querySelectorAll(".day:not(.kop)")];
  rijen.forEach((rij,i)=>{
    const oms=rij.querySelector(".dcond");
    if(oms)oms.textContent=(oms.textContent||"").replace(/,\s*\d+(?:[.,]\d+)?\s*mm\s*$/i,"");
    const kans=uiGetal(day.precipitation_probability_max&&day.precipitation_probability_max[i]);
    const som=uiGetal(day.precipitation_sum&&day.precipitation_sum[i]);
    const tekst=uiDagNeerslagTekst(kans,som);
    const regen=rij.querySelector(".drain");
    if(regen&&tekst==="Droog")regen.textContent="Droog";
  });
}

if(typeof dagen==="function"){
  const uiBasisDagen=dagen;
  dagen=function(){const uit=uiBasisDagen.apply(this,arguments);uiPolishDagen();return uit;};
}

function uiPolishRegenperiodeKansen(){
  const groep=document.querySelector('g[data-q4-rain-periods="1"]');
  if(!groep)return;
  const svg=groep.closest("svg"),g=S&&S.geo;if(!svg||!g||typeof g.x!=="function"||!Array.isArray(g.P)||!Array.isArray(g.MM))return;
  const perioden=[...groep.querySelectorAll("line")].filter(el=>{
    const x1=uiGetal(el.getAttribute("x1")),x2=uiGetal(el.getAttribute("x2"));
    const y1=uiGetal(el.getAttribute("y1")),y2=uiGetal(el.getAttribute("y2"));
    return x1!==null&&x2!==null&&y1!==null&&y2!==null&&Math.abs(y1-y2)<0.2&&Math.abs(x2-x1)>1;
  });
  if(!perioden.length)return;

  /* De historische etmaalrenderer tekent kanspercentages alleen op het vaste
     3-uursraster. Een echte regenperiode kan volledig tussen twee rasterpunten
     vallen en kreeg dan geen kanslabel. Q4 is al eigenaar van de uitgelijnde
     MM/P-reeksen en van de periodebrackets; leid de statische kans daarom uit
     diezelfde data af in plaats van toevallig aanwezige rasterlabels te hergebruiken. */
  [...svg.querySelectorAll("text")].forEach(el=>{
    if(/^\d+%$/.test((el.textContent||"").trim())&&(el.getAttribute("fill")===TEAL||el.getAttribute("data-ui-rain-period-probability")==="1"))el.remove();
  });

  const ns="http://www.w3.org/2000/svg";
  perioden.forEach(lijn=>{
    const a=Number(lijn.getAttribute("x1")),b=Number(lijn.getAttribute("x2"));
    const links=Math.min(a,b)-0.75,rechts=Math.max(a,b)+0.75;
    const kansen=g.P.map((p,i)=>({
      kans:uiGetal(p),mm:uiGetal(g.MM[i]),x:uiGetal(g.x(i))
    })).filter(item=>item.kans!==null&&item.mm!==null&&item.mm>=0.1&&item.x!==null&&item.x>=links&&item.x<=rechts);
    if(!kansen.length)return;
    const hoogste=Math.round(Math.max(...kansen.map(item=>item.kans)));
    if(hoogste<10)return;
    const label=document.createElementNS(ns,"text");
    label.setAttribute("x",String((a+b)/2));
    label.setAttribute("y",String((uiGetal(g.pt)||0)+(uiGetal(g.ih)||0)+(g.M?35:37)));
    label.setAttribute("text-anchor","middle");
    label.setAttribute("fill",TEAL);
    label.setAttribute("font-family","DM Mono,monospace");
    label.setAttribute("font-size",String(g.M?10:9.5));
    label.setAttribute("data-ui-rain-period-probability","1");
    label.setAttribute("aria-label","Hoogste neerslagkans in deze periode: "+hoogste+" procent");
    label.textContent=hoogste+"%";
    groep.appendChild(label);
  });
}

if(typeof etmaal==="function"){
  const uiBasisEtmaal=etmaal;
  etmaal=function(){const uit=uiBasisEtmaal.apply(this,arguments);uiPolishRegenperiodeKansen();return uit;};
}

function uiPolishWaarschuwingen(){
  const el=document.getElementById("waarschuwingen");if(!el)return;
  const melding=el.querySelector(".msg");
  if(melding){
    const t=(melding.textContent||"").trim();
    if(t==="Officiële weerwaarschuwingen zijn voor deze locatie niet beschikbaar.")melding.textContent="Waarschuwingsdienst niet beschikbaar voor deze locatie.";
    else if(t==="Officiële weerwaarschuwingen konden niet worden gecontroleerd.")melding.textContent="Waarschuwingsdienst kon niet worden gecontroleerd.";
  }
  const waarschuwingenLijst=Array.isArray(S.actieveWaarschuwingen)?S.actieveWaarschuwingen:[];
  [...el.querySelectorAll(".waarsch")].forEach((kaart,i)=>{
    const w=waarschuwingenLijst[i]||{};
    kaart.setAttribute("data-ui-severity",String(w.niveau||"").toLowerCase());
    const tekst=String(w.tekst||"").trim();
    if(!uiIsNwsStructuur(tekst))return;
    const bestaand=kaart.querySelector("p");if(bestaand)bestaand.remove();
    const geldig=w.tot&&typeof waarschuwingGeldigTot==="function"?waarschuwingGeldigTot(w.tot):null;
    const meta=document.createElement("p");meta.className="waarsch-meta";
    const delen=[];if(geldig)delen.push("Geldig tot "+geldig+".");
    if(w.landelijk)delen.push("Geldt voor een groter gebied, niet per se voor deze plaats.");
    meta.textContent=delen.join(" ");if(meta.textContent)kaart.appendChild(meta);
    const details=document.createElement("details");details.className="waarsch-details";
    const samenvatting=document.createElement("summary");samenvatting.textContent="Details van de waarschuwing";
    const bron=document.createElement("p");bron.lang="en";bron.textContent=tekst;
    details.appendChild(samenvatting);details.appendChild(bron);kaart.appendChild(details);
  });
}

if(typeof briefing==="function"){
  const uiBasisBriefing=briefing;
  briefing=function(){
    const uit=uiBasisBriefing.apply(this,arguments);
    const el=document.getElementById("brief");
    if(el){
      el.innerHTML=(el.innerHTML||"").replace(/\s*De officiële waarschuwing heeft voorrang op de modelverwachting\.\s*/g," ");
      const nu=typeof weatherNowActueleLokaleTijd==="function"?weatherNowActueleLokaleTijd():(S.d&&S.d.current&&S.d.current.time)||"";
      const huidige=S.d&&S.d.current?uiGetal(S.d.current.temperature_2m):null;
      el.innerHTML=uiBriefingTijdtaal(el.innerHTML,nu,huidige);
    }
    return uit;
  };
}

if(typeof waarschuwingen==="function"){
  const uiBasisWaarschuwingen=waarschuwingen;
  waarschuwingen=async function(){const uit=await uiBasisWaarschuwingen.apply(this,arguments);uiPolishWaarschuwingen();return uit;};
}

})();
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
    if(/^Vandaag$/i.test(dagNaam))return `Later vandaag worden rond ${tijdvak} windstoten tot ${waarde} km/u verwacht.`;
    if(/^Morgen$/i.test(dagNaam))return `Morgen worden rond ${tijdvak} windstoten tot ${waarde} km/u verwacht.`;
    return `${dagNaam||"Later"} worden rond ${tijdvak} windstoten tot ${waarde} km/u verwacht.`;
  }
  if(/^Vandaag$/i.test(dagNaam))return `Voor vandaag lag de hoogste verwachte windstoot rond ${tijdvak} op ${waarde} km/u.`;
  if(/^Gisteren$/i.test(dagNaam))return `Voor gisteren lag de hoogste verwachte windstoot rond ${tijdvak} op ${waarde} km/u.`;
  return `De hoogste verwachte windstoot lag ${dagInZin} rond ${tijdvak} op ${waarde} km/u.`;
}

function uiZonurenWoord(uur,daglichtUur){
  const zon=uiGetal(uur),daglicht=uiGetal(daglichtUur);
  if(zon===null)return "Zonuren niet beschikbaar.";
  if(daglicht!==null&&daglicht>0){
    const aandeel=Math.max(0,Math.min(1,zon/daglicht));
    if(aandeel>=0.8)return "Naar verwachting bijna de hele dag zon.";
    if(aandeel>=0.6)return "Naar verwachting veel zon vandaag.";
    if(aandeel>=0.35)return "Naar verwachting meerdere uren zon vandaag.";
    if(aandeel>=0.15)return "Naar verwachting enkele uren zon vandaag.";
    return "Naar verwachting weinig zon vandaag.";
  }
  if(zon>=8)return "Naar verwachting veel zon vandaag.";
  if(zon>=4)return "Naar verwachting meerdere uren zon vandaag.";
  if(zon>=1)return "Naar verwachting enkele uren zon vandaag.";
  return "Naar verwachting weinig zon vandaag.";
}

function uiLuchtdrukTekst(tekst){
  const t=String(tekst||"").trim();
  let m=/^Licht (gestegen|gedaald) in de afgelopen drie uur\.$/i.exec(t);
  if(m)return "De luchtdruk is in de afgelopen drie uur licht "+m[1].toLowerCase()+".";
  m=/^In de afgelopen drie uur ([0-9]+(?:[.,][0-9]+)? hPa) (gestegen|gedaald)\.$/i.exec(t);
  if(m)return "De luchtdruk is in de afgelopen drie uur "+m[1]+" "+m[2].toLowerCase()+".";
  return t;
}

/* Modelvelden mogen ook nadat hun klokmoment verstreken is niet als gemeten
   historie worden geformuleerd. Deze normalisatie verandert geen waarde of
   tijdstip; alleen de epistemische status van de zichtbare zin wordt expliciet. */
function uiBriefingBronSemantiek(html){
  return String(html||"")
    .replace(/Vandaag was het rond (\d{2}:\d{2}) het warmst,?\s+met (<b>-?\d+(?:[.,]\d+)?(?:\s|&nbsp;|\u00a0)+graden<\/b>)\./gi,
      (_m,t,waarde)=>"Het verwachte maximum lag vandaag rond "+t+" op "+waarde+".")
    .replace(/Vandaag wordt het rond (\d{2}:\d{2}) het warmst, met maximaal (<b>-?\d+(?:[.,]\d+)?(?:\s|&nbsp;|\u00a0)+graden<\/b>)\./gi,
      (_m,t,waarde)=>"Het verwachte maximum ligt vandaag rond "+t+" op "+waarde+".")
    .replace(/Morgen wordt het rond (\d{2}:\d{2}) het warmst, met maximaal (<b>-?\d+(?:[.,]\d+)?(?:\s|&nbsp;|\u00a0)+graden<\/b>)\./gi,
      (_m,t,waarde)=>"Het verwachte maximum ligt morgen rond "+t+" op "+waarde+".")
    .replace(/Morgen wordt het maximaal (<b>-?\d+(?:[.,]\d+)?(?:\s|&nbsp;|\u00a0)+graden<\/b>)\./gi,
      (_m,waarde)=>"Het verwachte maximum voor morgen is "+waarde+".");
}

function uiUvOordeel(waarde){
  const v=uiGetal(waarde);
  if(v===null)return "onbekend";
  const n=Math.max(0,Math.round(v));
  return n<=2?"laag":n<=5?"matig":n<=7?"hoog":n<=10?"zeer hoog":"extreem";
}
function uiUvPiekTekst(pu,nu){
  if(!pu||uiGetal(pu.v)===null||Number(pu.v)<0)return "UV-piek niet beschikbaar.";
  if(Number(pu.v)<0.5)return "Nauwelijks UV verwacht vandaag.";
  const tijd=String(pu.t||"").slice(11,16),bron=String(pu.t||""),huidig=String(nu||"");
  const verstreken=bron&&huidig&&bron.slice(0,10)===huidig.slice(0,10)&&bron<huidig;
  const oordeel=uiUvOordeel(pu.v);
  if(!/^\d{2}:\d{2}$/.test(tijd))return "Verwachte UV-piek · "+oordeel+".";
  return (verstreken?"Verwachte UV-piek lag rond ":"Verwachte UV-piek rond ")+tijd+" · "+oordeel+".";
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

function uiPollenTekst(aanwezig){
  return aanwezig?"Modelverwachting voor dit uur.":"Model verwacht geen pollen voor dit uur.";
}

function uiRegenperiodeDagprefix(periodeDatum,basisDatum){
  const datum=String(periodeDatum||"").slice(0,10),basis=String(basisDatum||"").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(datum)||datum===basis)return "";
  const d=new Date(datum+"T12:00:00");
  if(!Number.isFinite(d.getTime()))return "";
  return ["zo","ma","di","wo","do","vr","za"][d.getDay()]+" ";
}

/* Exporteer alleen zuivere presentatieregels voor regressietests. */
globalThis.WeatherNowUiPolish20260813=Object.freeze({
  windstootTekst:uiWindstootTekst,
  zonurenWoord:uiZonurenWoord,
  luchtdrukTekst:uiLuchtdrukTekst,
  briefingBronSemantiek:uiBriefingBronSemantiek,
  briefingTijdtaal:uiBriefingTijdtaal,
  uvPiekTekst:uiUvPiekTekst,
  dagNeerslagTekst:uiDagNeerslagTekst,
  pollenTekst:uiPollenTekst,
  regenperiodeDagprefix:uiRegenperiodeDagprefix,
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
    const nu=(S.d&&S.d.current&&S.d.current.time)||"";
    const uvPiek=typeof piek==="function"?piek("uv_index"):null,uvSub=document.getElementById("uvsub");
    if(uvSub&&uvPiek)uvSub.textContent=uiUvPiekTekst(uvPiek,nu);
    const pgRuw=typeof piek==="function"?piek("wind_gusts_10m"):null;
    const pg=pgRuw&&uiGetal(pgRuw.v)!==null&&Number(pgRuw.v)>=0?pgRuw:null;
    if(!pg)return;
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

function uiPolishLuchtModelstatus(){
  const c=document.getElementById("aq");if(!c)return;
  [...c.querySelectorAll(".stat")].forEach(stat=>{
    const kop=stat.querySelector(".eyebrow"),val=stat.querySelector(".sval"),sub=stat.querySelector(".ssub");
    if(!kop||!sub||!/pollen/i.test(kop.textContent||""))return;
    const getalMatch=String(val&&val.textContent||"").replace(",",".").match(/-?\d+(?:\.\d+)?/);
    const concentratie=getalMatch?Number(getalMatch[0]):null;
    const aanwezig=Number.isFinite(concentratie)?concentratie>0:!/\bgeen\b/i.test(sub.textContent||"");
    sub.textContent=uiPollenTekst(aanwezig);
  });
}
if(typeof lucht==="function"){
  const uiBasisLucht=lucht;
  lucht=function(){const uit=uiBasisLucht.apply(this,arguments);uiPolishLuchtModelstatus();return uit;};
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

function uiPolishRegenperiodeDaglabel(){
  const groep=document.querySelector('g[data-q4-rain-periods="1"]'),g=S&&S.geo;
  const label=groep&&groep.querySelector('text[data-q4-rain-summary="total"]');
  if(!label||!g||!Array.isArray(g.MM)||!Array.isArray(g.TI))return;
  if(!/^\d{2}:\d{2}–\d{2}:\d{2}\s+·\s+totaal\b/.test((label.textContent||"").trim()))return;
  let eersteNat=-1;
  for(let i=1;i<g.MM.length;i++){
    const mm=uiGetal(g.MM[i]);
    if(mm!==null&&mm>=0.1){eersteNat=i;break;}
  }
  if(eersteNat<1)return;
  const periodeStart=String(g.TI[eersteNat-1]||""),basis=String(g.TI[0]||"");
  const prefix=uiRegenperiodeDagprefix(periodeStart.slice(0,10),basis.slice(0,10));
  if(prefix)label.textContent=prefix+label.textContent;
}

if(typeof etmaal==="function"){
  const uiBasisEtmaal=etmaal;
  etmaal=function(){
    const uit=uiBasisEtmaal.apply(this,arguments);
    uiPolishRegenperiodeKansen();
    uiPolishRegenperiodeDaglabel();
    return uit;
  };
}

function uiPolishWaarschuwingen(){
  const el=document.getElementById("waarschuwingen");if(!el)return;
  const melding=el.querySelector(".msg");
  if(melding){
    const t=(melding.textContent||"").trim();
    if(t==="Officiële weerwaarschuwingen zijn voor deze locatie niet beschikbaar.")melding.textContent="Voor deze locatie kunnen we geen officiële weerwaarschuwingen tonen.";
    else if(t==="Officiële weerwaarschuwingen konden niet worden gecontroleerd.")melding.textContent="Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald.";
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
      el.innerHTML=uiBriefingBronSemantiek(uiBriefingTijdtaal(el.innerHTML,nu,huidige));
    }
    return uit;
  };
}

if(typeof waarschuwingen==="function"){
  const uiBasisWaarschuwingen=waarschuwingen;
  waarschuwingen=async function(){const uit=await uiBasisWaarschuwingen.apply(this,arguments);uiPolishWaarschuwingen();return uit;};
}

})();
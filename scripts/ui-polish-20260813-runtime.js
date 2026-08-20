/* ===== UI POLISH RUNTIME 20260813 ===== */
(function(){
"use strict";

const uiGetal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;

/* Zichtbare microcopy hoort bij de runtime die het betreffende UI-onderdeel
   bezit. Zonuren-, windstoot-, luchtdruk- en zeven-dagencopy horen inmiddels
   bij pure base-build owners; deze brede UI-polish bezit hier alleen nog
   briefingcopy en zijn expliciete presentatienormalisaties. */

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

function uiIsNwsStructuur(tekst){
  return /\*\s*(?:WHAT|WHERE|WHEN|IMPACTS)\.\.\./i.test(String(tekst||""));
}

function uiRegenperiodeDagprefix(periodeDatum,basisDatum){
  const datum=String(periodeDatum||"").slice(0,10),basis=String(basisDatum||"").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(datum)||datum===basis)return "";
  const d=new Date(datum+"T12:00:00");
  if(!Number.isFinite(d.getTime()))return "";
  return ["zo","ma","di","wo","do","vr","za"][d.getDay()]+" ";
}

/* Exporteer alleen zuivere presentatieregels voor regressietests. UV-copy hoort
   bij Q3/senior meters, pollen-modelcopy bij de pure pollen-owner,
   luchtdrukcopy bij pressure-copy-owner, windstootcopy bij wind-gust-copy-owner,
   zonurencopy bij sunshine-copy-owner en de zeven-dagenpresentatie bij
   daily-forecast-owner. Geen van die domeinen wordt hier herhaald. */
globalThis.WeatherNowUiPolish20260813=Object.freeze({
  briefingBronSemantiek:uiBriefingBronSemantiek,
  briefingTijdtaal:uiBriefingTijdtaal,
  regenperiodeDagprefix:uiRegenperiodeDagprefix,
  isNwsStructuur:uiIsNwsStructuur
});

/* Zonurencopy is al definitief wanneer deze runtime wordt ingevoegd.
   UI-polish wrapt zonurenTegel() daarom niet meer. */

/* Windstoot- en luchtdrukcopy zijn al definitief wanneer deze runtime wordt
   ingevoegd. UI-polish wrapt meters() daarom niet meer. */

/* De zeven-dagenpresentatie is al definitief wanneer deze runtime wordt
   ingevoegd. UI-polish wrapt dagen() daarom niet meer. */

/* Regenperiodepresentatie wordt volledig beheerd door Q4. */

/* De base-build waarschuwingrenderer bezit loading en de expliciete lege
   eindstate. UI-polish beperkt zich hier tot presentatienormalisatie van een
   reeds afgeronde basisuitkomst en kaartdetails. */
function uiPolishWaarschuwingen(){
  const el=document.getElementById("waarschuwingen");if(!el)return;
  const waarschuwingenLijst=Array.isArray(S.actieveWaarschuwingen)?S.actieveWaarschuwingen:[];
  const melding=el.querySelector(".msg");
  if(melding){
    const t=(melding.textContent||"").trim();
    if(t==="Officiële weerwaarschuwingen zijn voor deze locatie niet beschikbaar.")melding.textContent="Voor deze locatie kunnen we geen officiële weerwaarschuwingen tonen.";
    else if(t==="Officiële weerwaarschuwingen konden niet worden gecontroleerd.")melding.textContent="Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald.";
  }
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
  waarschuwingen=async function(){
    const uit=await uiBasisWaarschuwingen.apply(this,arguments);
    uiPolishWaarschuwingen();
    return uit;
  };
}

})();
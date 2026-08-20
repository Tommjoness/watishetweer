/* ===== UI POLISH RUNTIME 20260813 ===== */
(function(){
"use strict";

/* Zichtbare microcopy hoort bij de runtime die het betreffende UI-onderdeel
   bezit. Zonuren-, windstoot-, luchtdruk-, zeven-dagen- en briefingcopy horen
   inmiddels bij pure base-build owners; deze brede UI-polish bezit hier alleen
   nog expliciete waarschuwingpresentatie. */

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
   zonurencopy bij sunshine-copy-owner, de zeven-dagenpresentatie bij
   daily-forecast-owner en briefingcopy bij briefing-copy-owner. Geen van die
   domeinen wordt hier herhaald. */
globalThis.WeatherNowUiPolish20260813=Object.freeze({
  regenperiodeDagprefix:uiRegenperiodeDagprefix,
  isNwsStructuur:uiIsNwsStructuur
});

/* Zonurencopy is al definitief wanneer deze runtime wordt ingevoegd.
   UI-polish wrapt zonurenTegel() daarom niet meer. */

/* Windstoot- en luchtdrukcopy zijn al definitief wanneer deze runtime wordt
   ingevoegd. UI-polish wrapt meters() daarom niet meer. */

/* De zeven-dagenpresentatie is al definitief wanneer deze runtime wordt
   ingevoegd. UI-polish wrapt dagen() daarom niet meer. */

/* Bron- en tijdsemantiek van de weerbriefing zijn al definitief wanneer deze
   runtime wordt ingevoegd. UI-polish wrapt briefing() daarom niet meer. */

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

if(typeof waarschuwingen==="function"){
  const uiBasisWaarschuwingen=waarschuwingen;
  waarschuwingen=async function(){
    const uit=await uiBasisWaarschuwingen.apply(this,arguments);
    uiPolishWaarschuwingen();
    return uit;
  };
}

})();
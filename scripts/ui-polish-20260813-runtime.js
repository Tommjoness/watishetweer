/* ===== UI POLISH RUNTIME 20260813 ===== */
(function(){
"use strict";

/* Zichtbare microcopy hoort bij de runtime die het betreffende UI-onderdeel
   bezit. Zonuren-, windstoot-, luchtdruk-, zeven-dagen-, briefing- én
   waarschuwingpresentatie horen inmiddels bij pure base-build owners. Deze
   historische UI-polish runtime wrapt daarom geen inhoudelijke renderer meer. */

function uiRegenperiodeDagprefix(periodeDatum,basisDatum){
  const datum=String(periodeDatum||"").slice(0,10),basis=String(basisDatum||"").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(datum)||datum===basis)return "";
  const d=new Date(datum+"T12:00:00");
  if(!Number.isFinite(d.getTime()))return "";
  return ["zo","ma","di","wo","do","vr","za"][d.getDay()]+" ";
}

/* Alleen de historische, zuivere regressiehelper blijft geëxporteerd. De
   productiepresentatie van regenperioden wordt volledig door Q4 beheerd. */
globalThis.WeatherNowUiPolish20260813=Object.freeze({
  regenperiodeDagprefix:uiRegenperiodeDagprefix
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

/* De waarschuwingrenderer bezit loading, lege/foutstatus, severity en de
   NWS-detailpresentatie al in de base-build. UI-polish wrapt waarschuwingen()
   daarom niet meer en leest de actieve warninglijst hier niet opnieuw uit. */

})();

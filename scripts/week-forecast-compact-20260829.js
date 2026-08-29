/* Compacte weekverwachting 2026-08-29.
 *
 * Kans en hoeveelheid blijven zichtbaar in de bestaande Neerslag-kolom. De
 * lange daggebonden uitleg herhaalde die waarden en maakte de weektabel vooral
 * op desktop onnodig hoog. Deze laatste presentatie-owner verwijdert uitsluitend
 * die verklarende notities en hun eigen aria-koppeling. Andere aria-describedby-
 * doelen op de dagrij blijven intact. Weerdata, daghorizon, neerslagkans,
 * hoeveelheid, tooltips en dagselectie blijven onaangeraakt.
 */
(function(root){
"use strict";

function ruimWeekNeerslagNotitiesOp(){
  if(typeof document==="undefined")return 0;
  const days=document.getElementById("days");
  if(!days)return 0;
  const notities=[...days.querySelectorAll(".dag-neerslagnotitie")];
  notities.forEach(el=>el.remove());
  days.querySelectorAll(".row.day:not(.kop)").forEach(rij=>{
    rij.classList.remove("heeft-neerslagnotitie");
    const ids=(rij.getAttribute("aria-describedby")||"").split(/\s+/).filter(Boolean);
    const over=ids.filter(id=>!id.startsWith("dag-neerslagnotitie-"));
    if(over.length)rij.setAttribute("aria-describedby",over.join(" "));
    else rij.removeAttribute("aria-describedby");
  });
  const uitleg=document.getElementById("dagenneerslaguitleg");
  if(uitleg)uitleg.remove();
  return notities.length;
}

const api={ruimWeekNeerslagNotitiesOp};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowWeekForecastCompact20260829=api;

if(typeof document==="undefined"||typeof S==="undefined")return;
if(typeof dagen==="function"){
  const basisDagenWeekForecastCompact=dagen;
  dagen=function(){
    const r=basisDagenWeekForecastCompact.apply(this,arguments);
    ruimWeekNeerslagNotitiesOp();
    return r;
  };
}

})(typeof globalThis!=="undefined"?globalThis:this);
/* ===== EINDE COMPACTE WEEKVERWACHTING 20260829 ===== */

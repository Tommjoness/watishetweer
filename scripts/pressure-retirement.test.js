"use strict";

const assert=require("assert");
const {retirePressure,verifieerPressureRetired}=require("./pressure-retirement.js");

const bron=`<style>
.wiw-more-measurements{margin:14px 0 0}
.wiw-more-measurements>summary{min-height:44px}
.wiw-more-measurements-body{max-width:540px}
.wiw-pressure-meaning{font-size:11px}
</style>
<main>
<div class="stat"><div class="eyebrow">Luchtdruk op zeeniveau</div><div class="sval" id="pres">--</div><div class="ssub" id="pressub">&nbsp;</div></div>
</main>
<script>
const basis="x&current=temperature_2m,cloud_cover,pressure_msl,wind_speed_10m";
const f=basis+"&hourly=uv_index,pressure_msl,is_day";
function meters(){
  const drukRuw=eindigGetal(c.pressure_msl);
  const luchtdruk=drukRuw!==null&&drukRuw>0?drukRuw:null;
  set("pres",luchtdruk===null?"–":Math.round(luchtdruk)+"<s>hPa</s>");
  const p3Ruw=weatherNowUurWaardeOp("pressure_msl",weatherNowMinutenNu()-180);
  const p3=p3Ruw!==null&&p3Ruw>0?p3Ruw:null;
  const dp=(p3!==null&&luchtdruk!==null)?luchtdruk-p3:null;
  zetTekst("pressub", dp==null ? "Geen tendens beschikbaar."
    : Math.abs(dp)<1 ? "Vrijwel stabiel."
    : Math.abs(dp)<2 ? "De luchtdruk is in de afgelopen drie uur licht "+(dp>0?"gestegen":"gedaald")+"."
    : "De luchtdruk is in de afgelopen drie uur "+nl(Math.abs(dp))+" hPa "+(dp>0?"gestegen":"gedaald")+".");

  const cc=eindigGetal(c.cloud_cover);
}
function corrigeerDrukSemantiek(){
  document.querySelectorAll(".eyebrow").forEach(el=>{if(el.textContent.trim()==="Luchtdruk")el.textContent="Luchtdruk op zeeniveau";});
  const pres=document.getElementById("pres");if(pres)pres.setAttribute("title","Luchtdruk herleid tot zeeniveau (MSL).");
}
function finaliseerDagNeerslag(){return true;}
function finaleDomCorrecties(){finaliseerDagNeerslag();corrigeerDrukSemantiek();renderModelRisico();}
let drukResizeGebonden=false;
function bouwMeetgegevens(){
  const pres=document.getElementById("pres");if(!pres)return;
  const betekenis=document.createElement("p");betekenis.className="wiw-pressure-meaning";betekenis.textContent="Herleid tot zeeniveau zodat luchtdruk tussen locaties vergelijkbaar is.";
}

function naRender(basis,fn){return function(){const r=basis.apply(this,arguments);fn();return r;};}
bouwTopGrid();bouwMeetgegevens();wrapWaarschuwingen();
function herstelVerborgenDruk(){
  const pres=document.getElementById("pres"),diag=document.getElementById("wiw-pressure-diagnostic"),stat=pres&&pres.closest(".stat");
  if(stat&&diag&&!diag.contains(stat))diag.appendChild(stat);
}

function maakUurPaneel(){return true;}
function installeer(){voegStijlToe();herstelVerborgenDruk();maakUurPaneel();}
root.WeatherNowFinalDesktopUI20260902={maakUurPaneel,herstelVerborgenDruk,render:maakUurPaneel};
</script>`;

const uit=retirePressure(bron);
assert(!/pressure_msl/i.test(uit));
assert(!/getElementById\(["']pres["']\)/i.test(uit));
assert(!/getElementById\(["']pressub["']\)/i.test(uit));
assert(!/\bluchtdruk\b/i.test(uit));
assert(!/corrigeerDrukSemantiek|bouwMeetgegevens|herstelVerborgenDruk|wiw-pressure/i.test(uit));
assert(uit.includes("current=temperature_2m,cloud_cover,wind_speed_10m"));
assert(uit.includes("hourly=uv_index,is_day"));
assert(uit.includes("const cc=eindigGetal(c.cloud_cover);"));
assert(uit.includes("function finaliseerDagNeerslag"));
assert(uit.includes("function maakUurPaneel"));
assert.equal(verifieerPressureRetired(uit),true);
assert.equal(retirePressure(uit),uit,"pressure-retirement moet op een al schoon artifact idempotent zijn");
assert.throws(()=>verifieerPressureRetired('<div id="pres"></div>'),/#pres-element/);
assert.equal(retirePressure('<html><body>Geen pressurefeature</body></html>'),'<html><body>Geen pressurefeature</body></html>');

console.log("Pressure-retirement: tegel, providerquery, basisruntime en late pressure-only owners volledig verwijderd.");

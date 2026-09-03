"use strict";

const assert=require("assert");
const {retirePressure,verifieerPressureRetired}=require("./pressure-retirement.js");

const bron=`<main>
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
</script>`;

const uit=retirePressure(bron);
assert(!uit.includes("pressure_msl"));
assert(!uit.includes('id="pres"'));
assert(!uit.includes('id="pressub"'));
assert(!/Luchtdruk/i.test(uit));
assert(uit.includes("current=temperature_2m,cloud_cover,wind_speed_10m"));
assert(uit.includes("hourly=uv_index,is_day"));
assert(uit.includes("const cc=eindigGetal(c.cloud_cover);"));
assert.equal(verifieerPressureRetired(uit),true);
assert.throws(()=>retirePressure(uit),/exact één luchtdruktegel/);
assert.throws(()=>verifieerPressureRetired('<div id="pres"></div>'),/#pres/);

console.log("Pressure-retirement: tegel, providerquery en runtime volledig verwijderd.");

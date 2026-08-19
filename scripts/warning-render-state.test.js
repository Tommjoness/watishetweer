"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  START_BRON,START_PRODUCTIE,EIND_BRON,EIND_PRODUCTIE,pasWarningRenderStateToe
}=require("./warning-render-state.js");

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert.equal(bron.split(START_BRON).length-1,1,"ontwikkeltemplate moet exact één oude laadstatusanker hebben");
assert.equal(bron.split(EIND_BRON).length-1,1,"ontwikkeltemplate moet exact één oude leegstatusanker hebben");

const uit=pasWarningRenderStateToe(bron);
assert.equal(uit.split(START_PRODUCTIE).length-1,1,"base-build moet exact één zichtbare laadstatus bezitten");
assert.equal(uit.split(EIND_PRODUCTIE).length-1,1,"base-build moet exact één expliciete lege eindstate bezitten");
assert(!uit.includes(START_BRON),"oude lege startstate mag niet in het base-artifact blijven");
assert(!uit.includes(EIND_BRON),"oude impliciete lege eindstate mag niet in het base-artifact blijven");
assert(uit.includes('data-ui-warning-loading="1">Officiële weerwaarschuwingen controleren…'),"laadstatuscopy ontbreekt");
assert(uit.includes("Geen officiële weerwaarschuwingen voor deze locatie."),"lege eindstatecopy ontbreekt");

/* De owner mag niet stil nogmaals op een reeds gemigreerd artifact muteren. */
assert.throws(()=>pasWarningRenderStateToe(uit),/bronanker ontbreekt of is dubbel/);

console.log("Warning-render-state contract groen: laad- en leegstatus hebben één pure base-build owner.");

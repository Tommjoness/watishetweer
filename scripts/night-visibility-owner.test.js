"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  weatherNowMaanGeschiktVoorNachtvenster,
  pasNightVisibilityOwnerToe,
  HELPER_PRODUCTIE,VENSTER_BRON,VENSTER_PRODUCTIE,REDEN_BRON,REDEN_PRODUCTIE
}=require("./night-visibility-owner.js");

/* De bestaande 0,2-grens blijft behouden, maar een duidelijk verlichte maan
   mag niet meer alleen doordat hij laag boven de horizon staat als 'beste'
   sterrenkijkperiode gelden. */
assert.equal(weatherNowMaanGeschiktVoorNachtvenster(true,0.82),false,"82% maan boven horizon blokkeert beste venster");
assert.equal(weatherNowMaanGeschiktVoorNachtvenster(false,0.82),true,"82% maan onder horizon laat beste venster toe");
assert.equal(weatherNowMaanGeschiktVoorNachtvenster(true,0.10),true,"zwakke sikkel mag boven horizon staan");
assert.equal(weatherNowMaanGeschiktVoorNachtvenster(true,0.199),true,"bestaande 0,2-grens blijft inclusief ondergrensgedrag behouden");
assert.equal(weatherNowMaanGeschiktVoorNachtvenster(true,0.20),false,"vanaf de bestaande 0,2-grens telt horizonstatus");
assert.equal(weatherNowMaanGeschiktVoorNachtvenster(false,0.20),true,"maan onder horizon is bij 20% geen blokkade");
assert.equal(weatherNowMaanGeschiktVoorNachtvenster(true,null),false,"ongeldige verlichting faalt gesloten");
assert.equal(weatherNowMaanGeschiktVoorNachtvenster(true,1.2),false,"onmogelijke verlichting faalt gesloten");

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert.equal(bron.split(VENSTER_BRON).length-1,1,"canonieke beste-vensterconditie ontbreekt of is dubbel");
assert.equal(bron.split(REDEN_BRON).length-1,1,"canonieke maan-redenanalyse ontbreekt of is dubbel");
assert(!bron.includes("function weatherNowMaanGeschiktVoorNachtvenster(maanOp,verlichting){"),"ontwikkeltemplate bevat de productiehelper al");

const uit=pasNightVisibilityOwnerToe(bron);
assert.equal(uit.split(HELPER_PRODUCTIE).length-1,1,"Nachtzicht-maanhelper ontbreekt of is dubbel");
assert.equal(uit.split(VENSTER_PRODUCTIE).length-1,1,"beste venster gebruikt helper niet exact één keer");
assert.equal(uit.split(REDEN_PRODUCTIE).length-1,1,"redenanalyse gebruikt niet dezelfde maanregel");
assert(!uit.includes(VENSTER_BRON),"oude hoogte-gewogen vensterconditie bleef actief");
assert(!uit.includes(REDEN_BRON),"oude redenconditie bleef actief");

/* De continue totaalscore blijft bewust identiek: deze fix verandert alleen de
   selectie en verklaring van het expliciete beste kijkvenster. */
assert(uit.includes("sc-=2.2*mn.ill*maanDeel*(1-cw/140);"),"bestaande continue maanstraf in totaalscore is onbedoeld gewijzigd");
assert(uit.includes("let sc=(1-cw/100)*10;"),"basis Nachtzicht-score is onbedoeld gewijzigd");

assert.throws(()=>pasNightVisibilityOwnerToe(uit),/staat al in het aangeleverde artifact/,
  "owner moet fail-fast zijn op reeds gemigreerd artifact");

console.log("Nachtzicht-maanowner groen: score blijft continu; beste venster respecteert fel maanlicht tot maanondergang.");

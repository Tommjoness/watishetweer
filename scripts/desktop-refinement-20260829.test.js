"use strict";

const assert=require("assert");
const {
  MARKER,NAV_MARKER,MOTREGEN_BRON,MOTREGEN_PRODUCTIE,STIJL,pasDesktopRefinementToe
}=require("./desktop-refinement-20260829.js");

const links=["Almere","Amsterdam","Rotterdam","Utrecht","Meer plaatsen"]
  .map((naam,i)=>`<a href="/weer/test-${i}/">${naam}</a>`).join("");
const bron=`<!doctype html><html><head><style>.night{grid-template-columns:104px 52px minmax(40px,1fr) 104px minmax(180px,218px)}</style></head><body>
<script>const CODES={${MOTREGEN_BRON}61:["Lichte regen","regen"],65:["Zware regen","regen"],82:["Zware buien","regen"]};</script>
${NAV_MARKER}<nav class="seo-plaatsnav">${links}</nav></body></html>`;

const uit=pasDesktopRefinementToe(bron,"unit");
assert.ok(uit.includes(`id="${MARKER}"`),"verfijningsstijl moet worden ingevoegd");
assert.ok(uit.includes(MOTREGEN_PRODUCTIE),"motregenlabels moeten natuurlijk worden genormaliseerd");
assert.ok(!uit.includes("Zware motregen"),"zichtbare zware-motregenformulering mag niet terugkomen");
assert.ok(!uit.includes("Zware aanvriezende motregen"),"zichtbare zware-aanvriezende-motregenformulering mag niet terugkomen");
assert.ok(uit.includes('65:["Zware regen","regen"]')&&uit.includes('82:["Zware buien","regen"]'),"andere intensiteitslabels moeten behouden blijven");
assert.strictEqual((uit.match(/<a\s+[^>]*href=/g)||[]).length,5,"crawlbare plaatslinks moeten exact behouden blijven");
assert.ok(STIJL.includes("@media(min-width:701px)")&&STIJL.includes("@media(min-width:1000px)")&&STIJL.includes("@media(min-width:1100px)"),"verfijning moet responsief begrensd zijn");
assert.ok(STIJL.includes("border-top:0")&&STIJL.includes("background:var(--sheet)"),"plaatsnav moet visueel op het hoofdvlak aansluiten");
assert.ok(STIJL.includes("grid-template-columns:104px 52px minmax(180px,1fr) 104px minmax(220px,280px)"),"Nachtzicht moet op desktop de resterende breedte via de scorebalk vullen");
assert.ok(!STIJL.includes("minmax(180px,420px)")&&!STIJL.includes("justify-content:start"),"oude breedtecap die rechts lege ruimte veroorzaakte mag niet terugkomen");
assert.ok(STIJL.includes("padding-left:0!important")&&STIJL.includes("padding-right:0!important"),"desktopbody mag geen zichtbare zijgoten meer toevoegen");
assert.ok(STIJL.includes(".sheet,.seo-plaatsnav")&&STIJL.includes("width:100%!important")&&STIJL.includes("max-width:none!important"),"hoofdvlak en plaatsnav moeten op desktop altijd de volledige viewportbreedte gebruiken");
assert.ok(STIJL.includes(".dashrow-chart,.dashrow-days")&&STIJL.includes("display:block!important"),"grafiek, Zeven dagen en Nachtzicht mogen op desktop niet in een historische tweekolomscontext blijven hangen");
assert.ok(STIJL.includes(".dashrow-chart>.dashcol,.dashrow-days>.dashcol,#days,#nights"),"onderste desktopsecties moeten hun eigen breedteoverride krijgen");
assert.ok(STIJL.includes("min-width:0!important")&&STIJL.includes("max-width:none!important"),"onderste desktopsecties mogen geen oude breedtecap behouden");
assert.ok(STIJL.includes("margin-left:0!important")&&STIJL.includes("margin-right:0!important"),"historische auto-marges mogen op desktop geen zijruimte terugbrengen");
assert.ok(STIJL.includes("#minibar{")&&STIJL.includes("left:0!important")&&STIJL.includes("right:0!important"),"desktop-minibalk moet exact aan beide viewportranden worden verankerd");
assert.ok(STIJL.includes("width:auto!important")&&STIJL.includes("transform:none!important"),"oude vaste/gecentreerde minibalkbreedte of transform mag de viewportbreedte niet meer beperken");
assert.strictEqual(pasDesktopRefinementToe(uit,"unit-herhaling"),uit,"postbuildverfijning moet idempotent zijn");

assert.throws(()=>pasDesktopRefinementToe(bron.replace(NAV_MARKER,""),"zonder-nav"),/plaatsnavigatie ontbreekt of is dubbel/);
assert.throws(()=>pasDesktopRefinementToe(bron.replace(MOTREGEN_BRON,""),"zonder-codes"),/motregencodetabel ontbreekt of is dubbel/);

console.log("Desktopverfijning unit-test geslaagd: viewportbreed zonder zijgoten, onderste secties vullen de inhoudsbreedte, minibalk sluit aan, links behouden, Nachtzicht vult de desktopbreedte en motregencopy blijft natuurlijk.");

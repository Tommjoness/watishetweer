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
assert.ok(STIJL.includes("@media(min-width:701px)")&&STIJL.includes("@media(min-width:1000px)"),"verfijning moet responsief begrensd zijn");
assert.ok(STIJL.includes("border-top:0")&&STIJL.includes("background:var(--sheet)"),"plaatsnav moet visueel op het hoofdvlak aansluiten");
assert.ok(STIJL.includes("grid-template-columns:104px 52px minmax(180px,1fr) 104px minmax(220px,280px)"),"Nachtzicht moet op desktop de resterende breedte via de scorebalk vullen");
assert.ok(!STIJL.includes("minmax(180px,420px)")&&!STIJL.includes("justify-content:start"),"oude breedtecap die rechts lege ruimte veroorzaakte mag niet terugkomen");
assert.strictEqual(pasDesktopRefinementToe(uit,"unit-herhaling"),uit,"postbuildverfijning moet idempotent zijn");

assert.throws(()=>pasDesktopRefinementToe(bron.replace(NAV_MARKER,""),"zonder-nav"),/plaatsnavigatie ontbreekt of is dubbel/);
assert.throws(()=>pasDesktopRefinementToe(bron.replace(MOTREGEN_BRON,""),"zonder-codes"),/motregencodetabel ontbreekt of is dubbel/);

console.log("Desktopverfijning unit-test geslaagd: links behouden, Nachtzicht vult de desktopbreedte en motregencopy blijft natuurlijk zonder andere intensiteiten te wijzigen.");

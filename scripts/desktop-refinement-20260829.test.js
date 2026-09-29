"use strict";

const assert=require("assert");
const pkg=require("../package.json");
const {
  MARKER,RUNTIME_MARKER,START_MARKER,NAV_MARKER,MOTREGEN_BRON,MOTREGEN_PRODUCTIE,STIJL,RUNTIME,pasDesktopRefinementToe
}=require("./desktop-refinement-20260829.js");
const {zonPresentatie,volgendZonmoment,vochtigheidPresentatie,dauwpuntUit,lokaleIsoNaarUtcMs}=require("./final-consumer-polish-20260831-runtime.js");

const links=["Almere","Amsterdam","Rotterdam","Utrecht","Meer plaatsen"]
  .map((naam,i)=>`<a href="/weer/test-${i}/">${naam}</a>`).join("");
const bron=`<!doctype html><html><head><style>.night{grid-template-columns:104px 52px minmax(40px,1fr) 104px minmax(180px,218px)}</style></head><body>
<script>const CODES={${MOTREGEN_BRON}61:["Lichte regen","regen"],65:["Zware regen","regen"],82:["Zware buien","regen"]};
${START_MARKER}</script>
${NAV_MARKER}<nav class="seo-plaatsnav">${links}</nav></body></html>`;

const uit=pasDesktopRefinementToe(bron,"unit");
assert.ok(uit.includes(`id="${MARKER}"`),"verfijningsstijl moet worden ingevoegd");
assert.ok(uit.includes(RUNTIME_MARKER),"finale consumentencorrectie moet vóór startup worden ingevoegd");
assert.ok(uit.indexOf(RUNTIME_MARKER)<uit.indexOf(START_MARKER),"consumentenruntime moet vóór de app-start actief zijn");
assert.ok(uit.includes(MOTREGEN_PRODUCTIE),"motregenlabels moeten natuurlijk worden genormaliseerd");
assert.ok(!uit.includes("Zware motregen"),"zichtbare zware-motregenformulering mag niet terugkomen");
assert.ok(!uit.includes("Zware aanvriezende motregen"),"zichtbare zware-aanvriezende-motregenformulering mag niet terugkomen");
assert.ok(uit.includes('65:["Zware regen","regen"]')&&uit.includes('82:["Zware buien","regen"]'),"andere intensiteitslabels moeten behouden blijven");
assert.strictEqual((uit.match(/<a\s+[^>]*href=/g)||[]).length,5,"crawlbare plaatslinks moeten exact behouden blijven");
assert.ok(STIJL.includes("@media(min-width:701px)")&&STIJL.includes("@media(min-width:1000px)")&&STIJL.includes("@media(min-width:1100px)"),"verfijning moet responsief begrensd zijn");
assert.ok(STIJL.includes("border-top:0")&&STIJL.includes("background:var(--sheet)"),"plaatsnav moet visueel op het hoofdvlak aansluiten");
assert.ok(STIJL.includes("padding-left:0!important")&&STIJL.includes("padding-right:0!important"),"desktopbody mag geen zichtbare zijgoten meer toevoegen");
assert.ok(STIJL.includes(".sheet,.seo-plaatsnav")&&STIJL.includes("width:100%!important")&&STIJL.includes("max-width:none!important"),"hoofdvlak en plaatsnav moeten op desktop altijd de volledige viewportbreedte gebruiken");
assert.ok(STIJL.includes(".dashrow-chart,.dashrow-days")&&STIJL.includes("display:block!important"),"grafiek, Zeven dagen en Nachtzicht mogen niet in een historische tweekolomscontext blijven hangen");
assert.ok(STIJL.includes(".dashrow-chart>.dashcol,.dashrow-days>.dashcol,#days,#nights"),"onderste desktopsecties moeten hun eigen breedteoverride krijgen");
assert.ok(STIJL.includes("#days .row.day")&&STIJL.includes("minmax(260px,1.4fr)"),"weekverwachting moet extra breedte over meerdere informatiekolommen verdelen");
assert.ok(STIJL.includes("#nights .row.night")&&STIJL.includes("minmax(220px,320px)")&&STIJL.includes("minmax(360px,520px)"),"Nachtzicht moet zijn data in begrensde leesbare desktopkolommen groeperen");
assert.ok(STIJL.includes(".data-uitleg p{max-width:min(110ch,100%)}"),"bronuitleg mag niet in de oude halve-kolombreedte blijven steken");
assert.ok(STIJL.includes("footer{")&&STIJL.includes("grid-template-columns:minmax(0,1fr) max-content max-content"),"desktopfooter moet de breedte als drie rustige kolommen benutten");
assert.ok(STIJL.includes(".dashrow-hero>.hero")&&STIJL.includes("align-self:start!important"),"hero mag niet onnodig laag naast de metriekentabel hangen");
assert.ok(STIJL.includes("#minibar{")&&STIJL.includes("left:0!important")&&STIJL.includes("right:0!important"),"desktop-minibalk moet exact aan beide viewportranden worden verankerd");
assert.ok(RUNTIME.includes("verfijnGrafiekTypografie")&&RUNTIME.includes("0.80")&&RUNTIME.includes("0.88"),"desktopgrafiek moet zijn tekst subtieler schalen zonder dataplot te herschrijven");
assert.ok(RUNTIME.includes("herordeneerNeerslagContext"),"de zichtbare neerslagconclusie moet vóór technische bronuitleg kunnen staan");

/* Wereldwijde zonnecyclus: dezelfde tegel moet vóór zonsondergang naar ondergang
   wijzen en erna vanzelf naar de eerstvolgende zonsopkomst omschakelen. */
const almere={
  timezone:"Europe/Amsterdam",utc_offset_seconds:7200,current:{is_day:0},
  daily:{
    sunrise:["2026-08-31T06:50","2026-09-01T06:50","2026-09-02T06:52"],
    sunset:["2026-08-31T20:27","2026-09-01T20:25","2026-09-02T20:22"]
  }
};
const voorOnder=zonPresentatie(almere,Date.UTC(2026,7,31,17,0));
assert.equal(voorOnder.type,"ondergang");
assert.equal(voorOnder.kop,"Tijd tot zonsondergang");
assert.equal(voorOnder.sub,"Vandaag om 20:27.");
assert.equal(voorOnder.uren,1);assert.equal(voorOnder.minuten,27);
const naOnder=zonPresentatie(almere,Date.UTC(2026,7,31,21,4));
assert.equal(naOnder.type,"opkomst");
assert.equal(naOnder.kop,"Tijd tot zonsopkomst");
assert.equal(naOnder.sub,"Morgen om 06:50.");
assert.equal(naOnder.uren,7);assert.equal(naOnder.minuten,46);

const tokio={
  timezone:"Asia/Tokyo",utc_offset_seconds:32400,current:{is_day:0},
  daily:{sunrise:["2026-09-01T05:13","2026-09-02T05:14"],sunset:["2026-09-01T18:08","2026-09-02T18:06"]}
};
const tokioNu=Date.UTC(2026,7,31,14,30);
assert.equal(volgendZonmoment(tokio,tokioNu).type,"opkomst","ook buiten Europa moet lokale tijdzone de eerstvolgende zonnegebeurtenis bepalen");
assert.equal(zonPresentatie(tokio,tokioNu).sub,"Morgen om 05:13.");
assert.equal(lokaleIsoNaarUtcMs("2026-09-01T05:13","Asia/Tokyo",32400),Date.UTC(2026,7,31,20,13),"lokale zonnetijd moet naar het juiste instant worden omgerekend");

const pool={timezone:"Arctic/Longyearbyen",utc_offset_seconds:7200,current:{is_day:1},daily:{sunrise:["2026-06-21T00:00"],sunset:["2026-06-21T00:00"]}};
assert.equal(zonPresentatie(pool,Date.UTC(2026,5,21,10)).type,"pooldag","identieke pool-sentinels mogen geen nep-zonmoment opleveren");

/* De zin onder het percentage zegt in gewone taal of het plakkerig is; het
   woord dauwpunt staat er niet in. Het dauwpunt bepaalt achter de schermen hoe
   plakkerig warme lucht is en komt uit dezelfde temperatuur en vochtigheid. */
assert.equal(vochtigheidPresentatie({relative_humidity_2m:43,dew_point_2m:25,temperature_2m:40}),"Zeer benauwd en plakkerig.","Dubai mag bij hoog dauwpunt nooit droog heten");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:67,dew_point_2m:-52,temperature_2m:-49}),"IJskoude lucht.","poollucht heet niet vochtig");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:95,temperature_2m:16}),"Zeer vochtig, maar niet plakkerig.","de ochtend van de eigenaar: 16 °C en 95%");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:87,dew_point_2m:14}),"Vochtig, maar niet plakkerig.","87% mag niet aangenaam heten");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:85,temperature_2m:9}),"Vochtig, maar niet plakkerig.","85% bij 9 °C mag niet droog heten");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:82,temperature_2m:7.5}),"Vochtig, maar niet plakkerig.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:92,temperature_2m:19}),"Voelt wat plakkerig aan.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:80,temperature_2m:22}),"Voelt plakkerig aan.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:94,temperature_2m:24}),"Benauwd en plakkerig.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:90,temperature_2m:28}),"Zeer benauwd en plakkerig.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:60,temperature_2m:20}),"Aangenaam, niet plakkerig.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:40,temperature_2m:30}),"Niet plakkerig.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:75,temperature_2m:8}),"Fris, niet plakkerig.","75% bij 8 °C mag niet droog heten");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:30,temperature_2m:25}),"Droge lucht, niet plakkerig.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:20,temperature_2m:40}),"Droge hitte, niet plakkerig.","20% bij 40 °C is niet aangenaam");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:25,temperature_2m:40}),"Droge hitte, niet plakkerig.","25% bij 40 °C is niet plakkerig");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:95,temperature_2m:2}),"Koude, vochtige lucht.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:60,temperature_2m:5}),"Koude lucht.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:40,temperature_2m:0}),"Koude, droge lucht.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:90,temperature_2m:-20}),"IJskoude, vochtige lucht.","90% bij strenge vorst mag niet droog heten");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:95}),"Zeer vochtige lucht.","zonder temperatuur alleen de relatieve vochtigheid");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:87,dew_point_2m:null}),"Vochtige lucht.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:55}),"Normale luchtvochtigheid.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:null}),"Luchtvochtigheid niet beschikbaar.");
/* Alle combinaties van -40 tot 45 °C en 1 tot 100%: geen dauwpunt in de zin, en de zin
   spreekt het percentage niet tegen. */
for(let t=-40;t<=45;t+=0.5)for(let rh=1;rh<=100;rh++){
  const z=vochtigheidPresentatie({temperature_2m:t,relative_humidity_2m:rh}),m=t+" °C en "+rh+"%: "+z;
  assert(!/dauwpunt|\d/i.test(z)&&/\.$/.test(z)&&z.length<=36,m);
  if(rh>=80)assert(!/droog|droge|aangenaam|fris/i.test(z),m);
  if(rh>=60)assert(!/droge/i.test(z),m);
  if(rh<50)assert(!/vochtig/i.test(z),m);
  if(rh<30)assert(!/voelt/i.test(z),m);
  if(t<=7)assert(!/plakkerig/i.test(z),m);
}
/* Dauwpunt uit de actuele temperatuur en luchtvochtigheid (Magnus). */
const bijna=(a,b,m)=>assert(Math.abs(a-b)<=0.15,m+": "+a+" ≠ "+b);
bijna(dauwpuntUit(16,95),15.2,"16 °C en 95%");bijna(dauwpuntUit(20,50),9.3,"20 °C en 50%");bijna(dauwpuntUit(30,70),23.9,"30 °C en 70%");bijna(dauwpuntUit(-10,80),-12.9,"-10 °C en 80%");
assert.equal(dauwpuntUit(16,100).toFixed(6),"16.000000","verzadigd: dauwpunt is de temperatuur");
assert.equal(dauwpuntUit(16,0),null);assert.equal(dauwpuntUit(null,80),null);assert.equal(dauwpuntUit(16,101),null);
for(let t=-40;t<=45;t+=5)for(let rh=5;rh<=100;rh+=5)assert(dauwpuntUit(t,rh)<=t+1e-9,"dauwpunt nooit boven de temperatuur ("+t+" °C, "+rh+"%)");

const uitvoerStap="node scripts/desktop-refinement-20260829.js";
assert.ok(pkg.scripts.test.includes(uitvoerStap),"npm test moet de finale verfijning op de artifact uitvoeren vóór browserchecks");
assert.ok(pkg.scripts.postbuild.includes(uitvoerStap),"npm postbuild moet de finale verfijning op productie uitvoeren");
assert.ok(pkg.scripts.test.indexOf(uitvoerStap)<pkg.scripts.test.indexOf("npm run test:browser-smoke"),"browserchecks moeten de echte verfijnde artifact zien");
assert.strictEqual(pasDesktopRefinementToe(uit,"unit-herhaling"),uit,"finale verfijning moet idempotent zijn");

assert.throws(()=>pasDesktopRefinementToe(bron.replace(NAV_MARKER,""),"zonder-nav"),/plaatsnavigatie ontbreekt of is dubbel/);
assert.throws(()=>pasDesktopRefinementToe(bron.replace(MOTREGEN_BRON,""),"zonder-codes"),/motregencodetabel ontbreekt of is dubbel/);
assert.throws(()=>pasDesktopRefinementToe(bron.replace(START_MARKER,""),"zonder-start"),/startmarker ontbreekt of is dubbel/);

console.log("Finale productverfijning unit-test geslaagd: locatiebewuste zonnecyclus, dauwpuntgestuurd vochtcomfort, compactere grafiektypografie, brede broncopy, compacte Nachtzicht-kolommen en desktopfooter zijn geborgd.");
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

/* De procentwaarde blijft RH, maar de comfortzin volgt primair het dauwpunt. */
assert.equal(vochtigheidPresentatie({relative_humidity_2m:43,dew_point_2m:25,temperature_2m:40}),"Zeer benauwde lucht. Dauwpunt circa 25\u00a0°C.","Dubai mag bij hoog dauwpunt nooit droog heten");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:67,dew_point_2m:-52,temperature_2m:-49}),"Extreem droge lucht. Dauwpunt circa -52\u00a0°C.","koude poollucht mag door hoge RH niet als vochtig worden verkocht");
/* Vanaf 80% heet de lucht nooit aangenaam of droog, vanaf 90% zeer vochtig
   (bijna verzadigd); een hoog dauwpunt blijft daarbij benoemd. */
assert.equal(vochtigheidPresentatie({relative_humidity_2m:87,dew_point_2m:14}),"Vochtige lucht. Dauwpunt circa 14\u00a0°C.","87% mag niet aangenaam heten");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:85,dew_point_2m:6.6,temperature_2m:9}),"Vochtige lucht. Dauwpunt circa 7\u00a0°C.","85% bij 9 °C mag niet vrij droog heten");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:95,dew_point_2m:15.6,temperature_2m:16.4}),"Zeer vochtige lucht. Dauwpunt circa 16\u00a0°C.","95% is bijna verzadigd");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:92,dew_point_2m:17.6,temperature_2m:19}),"Zeer vochtige, klamme lucht. Dauwpunt circa 18\u00a0°C.","klam blijft zichtbaar bij bijna verzadigde lucht");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:94,dew_point_2m:23,temperature_2m:24}),"Benauwde lucht. Dauwpunt circa 23\u00a0°C.","benauwd gaat voor zeer vochtig");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:95,dew_point_2m:1.3,temperature_2m:2}),"Zeer hoge relatieve luchtvochtigheid; koude lucht bevat weinig waterdamp. Dauwpunt circa 1\u00a0°C.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:95,dew_point_2m:null}),"Zeer hoge relatieve luchtvochtigheid.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:79,dew_point_2m:12,temperature_2m:15.5}),"Aangename lucht. Dauwpunt circa 12\u00a0°C.","onder 80% volgt het oordeel het dauwpunt");
/* De zin spreekt het percentage nooit tegen: koele lucht vanaf 60% is fris,
   niet droog; strenge vorst met veel procenten krijgt de koude-luchtuitleg. */
assert.equal(vochtigheidPresentatie({relative_humidity_2m:75,dew_point_2m:3.8,temperature_2m:8}),"Frisse lucht. Dauwpunt circa 4\u00a0°C.","75% bij 8 °C mag niet droog heten");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:65,dew_point_2m:3.7,temperature_2m:10}),"Frisse lucht. Dauwpunt circa 4\u00a0°C.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:82,dew_point_2m:4.6,temperature_2m:7.5}),"Vochtige lucht. Dauwpunt circa 5\u00a0°C.","82% net boven 7 °C mag niet droog heten");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:30,dew_point_2m:6.2,temperature_2m:25}),"Vrij droge lucht. Dauwpunt circa 6\u00a0°C.","lage procenten blijven droog");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:20,dew_point_2m:12.9,temperature_2m:40}),"Vrij droge lucht. Dauwpunt circa 13\u00a0°C.","20% bij 40 °C is niet aangenaam");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:25,dew_point_2m:16.6,temperature_2m:40}),"Vrij droge lucht. Dauwpunt circa 17\u00a0°C.","25% bij 40 °C is niet klam");
/* Alle combinaties van -40 tot 45 °C en 1 tot 100%: de zin spreekt het percentage niet tegen. */
for(let t=-40;t<=45;t+=0.5)for(let rh=1;rh<=100;rh++){
  const z=vochtigheidPresentatie({temperature_2m:t,relative_humidity_2m:rh,dew_point_2m:dauwpuntUit(t,rh)}),b=z.split(/[.;]/)[0],m=t+" °C en "+rh+"%: "+z;
  assert(/Dauwpunt circa -?\d+\u00a0°C\.$/.test(z),m);
  if(rh>=80)assert(!/droog|droge|aangenaam|aangename|fris/i.test(b),m);
  if(rh>=60&&!(t<=7&&dauwpuntUit(t,rh)<-15))assert(!/droge/i.test(b),m);
  if(rh<50)assert(!/vochtig/i.test(b)||/benauwd/i.test(b),m);
  if(rh<60)assert(!/hoge relatieve/i.test(b),m);
  if(rh<30)assert(!/aangename|klam/i.test(b),m);
}
assert.equal(vochtigheidPresentatie({relative_humidity_2m:90,dew_point_2m:-21.2,temperature_2m:-20}),"Zeer hoge relatieve luchtvochtigheid; koude lucht bevat weinig waterdamp. Dauwpunt circa -21\u00a0°C.","90% bij strenge vorst mag niet extreem droog heten");
/* Dauwpunt uit de actuele temperatuur en luchtvochtigheid (Magnus). */
const bijna=(a,b,m)=>assert(Math.abs(a-b)<=0.15,m+": "+a+" ≠ "+b);
bijna(dauwpuntUit(16,95),15.2,"16 °C en 95%");bijna(dauwpuntUit(20,50),9.3,"20 °C en 50%");bijna(dauwpuntUit(30,70),23.9,"30 °C en 70%");bijna(dauwpuntUit(-10,80),-12.9,"-10 °C en 80%");
assert.equal(dauwpuntUit(16,100).toFixed(6),"16.000000","verzadigd: dauwpunt is de temperatuur");
assert.equal(dauwpuntUit(16,0),null);assert.equal(dauwpuntUit(null,80),null);assert.equal(dauwpuntUit(16,101),null);
for(let t=-40;t<=45;t+=5)for(let rh=5;rh<=100;rh+=5)assert(dauwpuntUit(t,rh)<=t+1e-9,"dauwpunt nooit boven de temperatuur ("+t+" °C, "+rh+"%)");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:52,dew_point_2m:9}),"Vrij droge lucht. Dauwpunt circa 9\u00a0°C.");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:87,dew_point_2m:null}),"Hoge relatieve luchtvochtigheid.","zonder dauwpunt mag alleen relatieve vochtigheid worden geduid");
assert.equal(vochtigheidPresentatie({relative_humidity_2m:null}),"Luchtvochtigheid niet beschikbaar.");

const uitvoerStap="node scripts/desktop-refinement-20260829.js";
assert.ok(pkg.scripts.test.includes(uitvoerStap),"npm test moet de finale verfijning op de artifact uitvoeren vóór browserchecks");
assert.ok(pkg.scripts.postbuild.includes(uitvoerStap),"npm postbuild moet de finale verfijning op productie uitvoeren");
assert.ok(pkg.scripts.test.indexOf(uitvoerStap)<pkg.scripts.test.indexOf("npm run test:browser-smoke"),"browserchecks moeten de echte verfijnde artifact zien");
assert.strictEqual(pasDesktopRefinementToe(uit,"unit-herhaling"),uit,"finale verfijning moet idempotent zijn");

assert.throws(()=>pasDesktopRefinementToe(bron.replace(NAV_MARKER,""),"zonder-nav"),/plaatsnavigatie ontbreekt of is dubbel/);
assert.throws(()=>pasDesktopRefinementToe(bron.replace(MOTREGEN_BRON,""),"zonder-codes"),/motregencodetabel ontbreekt of is dubbel/);
assert.throws(()=>pasDesktopRefinementToe(bron.replace(START_MARKER,""),"zonder-start"),/startmarker ontbreekt of is dubbel/);

console.log("Finale productverfijning unit-test geslaagd: locatiebewuste zonnecyclus, dauwpuntgestuurd vochtcomfort, compactere grafiektypografie, brede broncopy, compacte Nachtzicht-kolommen en desktopfooter zijn geborgd.");
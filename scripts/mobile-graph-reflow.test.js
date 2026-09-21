"use strict";
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const api=require("./mobile-graph-ux-20260828.js");

assert.equal(api.uurAsLabelTekst("16"),"16:00","Een kaal mobiel uur moet expliciet als kloktijd worden getoond.");
assert.equal(api.uurAsLabelTekst("6"),"06:00","Een enkelcijferig uur krijgt een voorloopnul.");
assert.equal(api.uurAsLabelTekst("06:00"),"06:00","Een al expliciete kloktijd blijft stabiel.");
assert.equal(api.uurAsLabelTekst("24"),"","24 is geen geldig uur-aslabel.");
assert.equal(api.isUurAsLabel("16:00",224,204,"DM Mono,monospace"),true,"De expliciete mobiele kloktijd blijft herkenbaar als uur-aslabel.");

const etmaalVanaf22=Array.from({length:25},(_,i)=>{
  const uur=(22+i)%24,dag=i<2?"2026-09-17":"2026-09-18";
  return dag+"T"+String(uur).padStart(2,"0")+":00";
});
const drieUursIndices=api.kiesKalenderUurLabelIndices(etmaalVanaf22,3,24);
assert.deepEqual(drieUursIndices,[0,3,6,9,12,15,18,21],"Smalle etmaalgrafiek moet vanaf het eerste echte forecastpunt acht drie-uursankers kiezen.");
assert.deepEqual(drieUursIndices.map(i=>api.uurUitIso(etmaalVanaf22[i])),[22,1,4,7,10,13,16,19],"Drie-uursritme volgt het eerste zichtbare lokale forecastpunt en niet vaste modulo-klokuren.");
assert(!drieUursIndices.includes(24),"De 25e rechtergrens mag geen negende etmaalanker worden.");

const etmaalVanaf18=Array.from({length:25},(_,i)=>{
  const uur=(18+i)%24,dag=i<6?"2026-09-17":"2026-09-18";
  return dag+"T"+String(uur).padStart(2,"0")+":00";
});
assert.deepEqual(api.kiesKalenderUurLabelIndices(etmaalVanaf18,3,24),[0,3,6,9,12,15,18,21],"Een drie-uursanker op de linkergrens blijft behouden.");
assert.deepEqual(api.kiesKalenderUurLabelIndices(etmaalVanaf18,3,24).map(i=>api.uurUitIso(etmaalVanaf18[i])),[18,21,0,3,6,9,12,15],"Rollend etmaal gebruikt echte klokwaarden en geen afgeronde indices.");

const dstVoorjaar=[
  "2026-03-29T00:00","2026-03-29T01:00","2026-03-29T03:00","2026-03-29T04:00",
  "2026-03-29T05:00","2026-03-29T06:00","2026-03-29T07:00","2026-03-29T08:00",
  "2026-03-29T09:00","2026-03-29T10:00","2026-03-29T11:00","2026-03-29T12:00"
];
assert.deepEqual(api.kiesKalenderUurLabelIndices(dstVoorjaar,3,24),[0,2,5,8,11],"DST-sprong kiest alleen werkelijk aanwezige lokale forecastpunten op de civiele drie-uurscadans.");
assert(!api.kiesKalenderUurLabelIndices(dstVoorjaar,3,24).some(i=>dstVoorjaar[i].includes("T02:")),"DST-logica mag geen ontbrekend lokaal uur synthetiseren.");
const dstNajaar=["2026-10-25T00:00","2026-10-25T01:00","2026-10-25T02:00","2026-10-25T02:00","2026-10-25T03:00","2026-10-25T04:00","2026-10-25T05:00","2026-10-25T06:00","2026-10-25T07:00","2026-10-25T08:00","2026-10-25T09:00"];
assert.deepEqual(api.kiesKalenderUurLabelIndices(dstNajaar,3,24),[0,4,7,10],"Dubbel lokaal najaarsuur wordt niet dubbel gelabeld en de echte 03/06/09-punten blijven de cadans dragen.");

assert.deepEqual(api.lokaleTemperatuurExtrema([20,19,18,17],24),[],"Monotoon dalende curve heeft geen lokale extrema.");
assert.deepEqual(api.lokaleTemperatuurExtrema([17,18,19,20],24),[],"Monotoon stijgende curve heeft geen lokale extrema.");
assert.deepEqual(api.lokaleTemperatuurExtrema([10,12,11,9,10,13,12],24).map(e=>[e.i,e.type]),[[1,"piek"],[3,"dal"],[5,"piek"]],"Meerdere echte pieken en dalen worden deterministisch gevonden.");
assert.deepEqual(api.lokaleTemperatuurExtrema([10,12,12,11],24).map(e=>[e.i,e.type,e.start,e.eind]),[[1,"piek",1,2]],"Een vlakke top krijgt exact één label op het linker middenpunt.");
assert.deepEqual(api.lokaleTemperatuurExtrema([12,10,10,11],24).map(e=>[e.i,e.type,e.start,e.eind]),[[1,"dal",1,2]],"Een vlak dal krijgt exact één label op het linker middenpunt.");
assert.deepEqual(api.lokaleTemperatuurExtrema([10,11,11,12],24),[],"Een gelijk plateau in een doorlopende stijging is geen vals extremum.");

const planTijden=Array.from({length:8},(_,i)=>"2026-09-17T"+String(18+i).padStart(2,"0")+":00");
const plan=api.mobieleTemperatuurLabelPlan(planTijden,[10,11,12,14,13,15,16,17],8);
assert.deepEqual(plan.ankers,[0,3,6],"Plan bewaart alle verplichte drie-uursankers.");
assert.deepEqual(plan.extrema.map(e=>[e.i,e.type]),[[4,"dal"]],"Een extremum op een drie-uursanker wordt niet dubbel opgenomen; een buur-extremum wel.");
const start=api.geschatteSvgTekstBox("nu 19°",100,80,"start",12);
assert(start&&start.x===100,"Start-anchor moet op de opgegeven x beginnen.");
assert(start.y<80&&start.height>12,"Tekstbox moet de SVG-baseline conservatief omvatten.");

const midden=api.geschatteSvgTekstBox("19°",100,80,"middle",12);
assert(midden&&midden.x<100&&midden.x+midden.width>100,"Middle-anchor moet rond x centreren.");
const eind=api.geschatteSvgTekstBox("19°",100,80,"end",12);
assert(eind&&Math.abs((eind.x+eind.width)-100)<1e-9,"End-anchor moet op x eindigen.");
assert.strictEqual(api.geschatteSvgTekstBox("",100,80,"start",12),null,"Leeg label mag geen box opleveren.");

const dichtbij=api.geschatteSvgTekstBox("20°",118,80,"middle",12);
const verweg=api.geschatteSvgTekstBox("20°",220,80,"middle",12);
assert.strictEqual(api.rechthoekenBotsen(start,dichtbij,3),true,"Nabije temperatuurlabels moeten als botsing gelden.");
assert.strictEqual(api.rechthoekenBotsen(start,verweg,3),false,"Verre temperatuurlabels mogen niet als botsing gelden.");

assert.deepEqual(api.randCorrectieVoorTekstBox({x:360,y:0,width:28,height:10},380,5),{x:375,anker:"end"},"Rechter tijdlabel moet volledig binnen de mobiele SVG worden getrokken.");
assert.deepEqual(api.randCorrectieVoorTekstBox({x:1,y:0,width:28,height:10},380,5),{x:5,anker:"start"},"Linker randlabel moet volledig binnen de mobiele SVG worden getrokken.");
assert.strictEqual(api.randCorrectieVoorTekstBox({x:120,y:0,width:28,height:10},380,5),null,"Veilig label mag niet onnodig verschuiven.");
assert.equal(api.begrensTemperatuurLabelY(118,136,59,204,42),118,"Normale temperatuur-labelafstand blijft intact.");
assert.equal(api.begrensTemperatuurLabelY(62,150,59,204,42),132,"Los zwevend label boven het datapunt wordt teruggebracht naar de curve.");
assert.equal(api.begrensTemperatuurLabelY(203,180,59,204,18),162,"Los zwevend label onder het datapunt wijkt naar boven uit wanneer onderruimte ontbreekt.");

const runtime=fs.readFileSync(path.join(__dirname,"mobile-graph-ux-20260828.js"),"utf8");
assert(!/\.getBBox\s*\(/.test(runtime),"Mobiele grafiekpolish mag geen uitvoerbare SVG getBBox-layoutread meer bevatten.");
assert(runtime.includes("svgTekstBoxUitElement"),"Mobiele grafiekpolish moet de attribuutgebaseerde boxhelper gebruiken.");
assert(runtime.includes("const compact24=Number(g.n)<=25&&window.innerWidth<=430"),"Drie-uursritme moet uitsluitend de smalle mobiele 24-uursweergave raken, inclusief de 25e rechtergrens.");
assert(runtime.includes("alle.forEach(el=>el.remove())")&&runtime.includes("kiesKalenderUurLabelIndices(g.TI,3,24)"),"Smalle mobiele uur-as moet oude basis/fallbacklabels volledig vervangen door vanaf het eerste zichtbare forecastpunt bepaalde drie-uursankers.");
assert(runtime.includes('data-mobile-hour-rhythm","three-hour"'),"Mobiele uur-as moet zijn drie-uurscontract expliciet markeren.");
assert(runtime.includes("Instrument Sans,ui-sans-serif,system-ui,sans-serif"),"Mobiele uuras moet een rustig recht sans-letterbeeld gebruiken.");
assert(runtime.includes("el.setAttribute(\"font-style\",\"normal\")"),"Mobiele uur-as mag geen schuin letterbeeld erven.");
assert(runtime.includes("alle.forEach(el=>{const expliciet=uurAsLabelTekst(el.textContent);if(expliciet)el.textContent=expliciet;});"),"Bestaande canonieke mobiele uurlabels moeten na render naar HH:00 worden genormaliseerd.");
assert(runtime.includes("el.textContent=uurAsLabelTekst(String(uur));"),"Ook fallback-uurlabels moeten expliciete HH:00-kloktijden gebruiken.");
assert(runtime.includes("function polishMobieleGrafiekRanden()"),"Mobiele grafiek mist de gerichte rechterrand-/zwevend-labelpolish.");
assert(runtime.includes("data-mobile-edge-adjusted"),"Mobiele randcorrectie is niet traceerbaar in de SVG.");
assert(runtime.includes("data-mobile-point-aligned"),"Mobiele temperatuurcijfers zijn niet aantoonbaar exact aan hun datapunt teruggekoppeld.");
assert(runtime.includes("herstelUurAs();polishMobieleGrafiekRanden();vereenvoudigMobieleZonband();verminderMobieleTemperatuurlabels();"),"Mobiele eindpass moet de dubbele zontekst vóór de temperatuurcollision-pass verwijderen.");
assert(runtime.includes("mobieleTemperatuurLabelPlan(g.TI,g.T,24)"),"Mobiele temperatuurselectie moet verplichte drie-uursankers en extra extrema uit één deterministisch plan halen.");
assert(runtime.includes('data-mobile-temp-priority",verplicht?"anchor":"extremum"'),"Temperatuurlabels moeten hun collision-prioriteit expliciet markeren.");
assert(runtime.includes("plan.ankers.forEach")&&runtime.includes("plan.extrema.forEach"),"Verplichte ankers moeten vóór optionele extrema worden geplaatst.");
assert(runtime.includes('data-mobile-temp-missing-anchors')&&runtime.includes('data-mobile-temp-dropped-extrema'),"Runtime moet onplaatsbare verplichte ankers en optionele extrema afzonderlijk traceerbaar maken.");
assert(runtime.includes("const xKandidaten=[px,px+12,px-12,px+18,px-18]"),"Mobiele temperatuurwaarden mogen alleen licht horizontaal uitwijken.");
assert(!runtime.includes("mobieleTemperatuurLabelLimiet(window.innerWidth)"),"De mobiele 24-uursgrafiek mag verplichte ankers niet langer via een viewport-limiet uitdunnen.");

const checkpoint=fs.readFileSync(path.join(__dirname,"apply-mobile-screenshot-polish.js"),"utf8");
assert(!/['\"]\s*const A=a\.getBBox\s*\(/.test(checkpoint),"Checkpoint-50 owner mag geen SVG-fontboxmeting meer injecteren.");
assert(checkpoint.includes("geschatteTekstBox=el=>"),"Checkpoint-50 owner moet de attribuutgebaseerde tekstbox injecteren.");
assert(checkpoint.includes("const fs=Number.isFinite(attrFont)&&attrFont>0?attrFont:(/Bodoni Moda/.test(familie)?F.temp:F.uur);"),"Checkpoint-50 tekstbox gebruikt de bestaande grafiekfontmaten als veilige fallback.");
console.log("Mobiele grafiek reflow-test groen: echte lokale drie-uursankers, plateau-veilige extrema en verplichte anchor-first collisionprioriteit.");

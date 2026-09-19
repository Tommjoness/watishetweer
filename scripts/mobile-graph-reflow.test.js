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

const etmaalVanaf22=Array.from({length:24},(_,i)=>{
  const uur=(22+i)%24,dag=i<2?"2026-09-17":"2026-09-18";
  return dag+"T"+String(uur).padStart(2,"0")+":00";
});
const etmaalMetRechtergrens=[...etmaalVanaf22,"2026-09-18T22:00"];
const rustigeIndices=api.kiesUurLabelIndices(etmaalMetRechtergrens,6,4,1);
assert.deepEqual(rustigeIndices,[2,6,10,14,18,22],"Smalle 25-punts etmaalgrafiek moet exact zes kalendergebonden vier-uursankers kiezen.");
assert.deepEqual(rustigeIndices.map(i=>api.uurUitIso(etmaalMetRechtergrens[i])),[0,4,8,12,16,20],"Vier-uursritme blijft onafhankelijk van het startuur van de forecast.");

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
assert(runtime.includes("const compact24=Number(g.n)<=25&&window.innerWidth<=430"),"Vier-uursritme moet uitsluitend de smalle mobiele 24-uursweergave raken, inclusief de 25e rechtergrens.");
assert(runtime.includes("alle.forEach(el=>el.remove())")&&runtime.includes("kiesUurLabelIndices(g.TI,6,4,1)"),"Smalle mobiele uur-as moet oude basis/fallbacklabels volledig vervangen door één deterministische vier-uurslaag.");
assert(runtime.includes("Instrument Sans,ui-sans-serif,system-ui,sans-serif"),"Mobiele uuras moet een rustig recht sans-letterbeeld gebruiken.");
assert(runtime.includes("el.setAttribute(\"font-style\",\"normal\")"),"Mobiele uur-as mag geen schuin letterbeeld erven.");
assert(runtime.includes("alle.forEach(el=>{const expliciet=uurAsLabelTekst(el.textContent);if(expliciet)el.textContent=expliciet;});"),"Bestaande canonieke mobiele uurlabels moeten na render naar HH:00 worden genormaliseerd.");
assert(runtime.includes("el.textContent=uurAsLabelTekst(String(uur));"),"Ook fallback-uurlabels moeten expliciete HH:00-kloktijden gebruiken.");
assert(runtime.includes("function polishMobieleGrafiekRanden()"),"Mobiele grafiek mist de gerichte rechterrand-/zwevend-labelpolish.");
assert(runtime.includes("data-mobile-edge-adjusted"),"Mobiele randcorrectie is niet traceerbaar in de SVG.");
assert(runtime.includes("data-mobile-point-aligned"),"Mobiele temperatuurcijfers zijn niet aantoonbaar exact aan hun datapunt teruggekoppeld.");
assert(runtime.includes("herstelUurAs();polishMobieleGrafiekRanden();verminderMobieleTemperatuurlabels();vereenvoudigMobieleZonband();"),"Mobiele eindpass moet uuras, puntuitlijning en compacte zonband in vaste volgorde toepassen.");

const checkpoint=fs.readFileSync(path.join(__dirname,"apply-mobile-screenshot-polish.js"),"utf8");
assert(!/['\"]\s*const A=a\.getBBox\s*\(/.test(checkpoint),"Checkpoint-50 owner mag geen SVG-fontboxmeting meer injecteren.");
assert(checkpoint.includes("geschatteTekstBox=el=>"),"Checkpoint-50 owner moet de attribuutgebaseerde tekstbox injecteren.");
assert(checkpoint.includes("const fs=Number.isFinite(attrFont)&&attrFont>0?attrFont:(/Bodoni Moda/.test(familie)?F.temp:F.uur);"),"Checkpoint-50 tekstbox gebruikt de bestaande grafiekfontmaten als veilige fallback.");
console.log("Mobiele grafiek reflow-test groen: zes rustige kalendergebonden vier-uursankers op de smalle 24-uursweergave, expliciete HH:00-kloktijden en maximaal vier temperatuurcijfers die exact aan hun datapunt gekoppeld blijven.");

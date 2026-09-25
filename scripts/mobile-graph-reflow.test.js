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

/* Mobiele markeringen: alleen het hoogste en laagste punt van het zichtbare
   etmaal, elk één keer (midden van het eerste plateau met die waarde). Hoogste
   en laagste gaan op de ongeronde waarde. */
const mk=(T,n=24,nu=null)=>api.mobieleGrafiekMarkeringen(T,n,nu).map(m=>[m.type,m.waarde,m.i]);
assert.deepEqual(mk([10,12,11,9,10,13,12]),[["min",9,3],["max",13,5]],"Alleen het hoogste en het laagste punt krijgen een markering, niet iedere lokale piek.");
assert.deepEqual(mk([15,15,15,15]),[],"Een volledig vlak etmaal krijgt geen max/min-markering.");
assert.deepEqual(mk([12,10,10,10,11]),[["max",12,0],["min",10,2]],"Een plateau krijgt één markering op het middenpunt.");
assert.deepEqual(mk([20,19,18,17]),[["max",20,0],["min",17,3]],"Ook randpunten tellen als hoogste of laagste waarde.");
assert.deepEqual(api.mobieleGrafiekMarkeringen([20,19,18,17],24,null,{links:21,rechts:16}).map(m=>[m.type,m.i]),[],"Loopt de reeks buiten het venster verder omhoog of omlaag, dan is de rand geen piek of dal.");
assert.deepEqual(api.mobieleGrafiekMarkeringen([20,19,18,17],24,null,{links:19,rechts:18}).map(m=>[m.type,m.i]),[["max",0],["min",3]],"Keert de reeks buiten het venster om, dan is de rand wel een piek of dal.");
assert.deepEqual(api.mobieleGrafiekMarkeringen([14,12,11,11,13],24,null,{links:15,rechts:14}).map(m=>[m.type,m.i]),[["min",2]],"Een dal binnen het venster blijft gemarkeerd; de dalende linkerrand is geen piek.");
assert.deepEqual(mk([19.6,20,20,20,19,18,17,16,15,15,15,15],24,{index:.5,waarde:20.2}),[["min",15,9]],"Een max gelijk aan 'nu' vlak naast de nu-lijn vervalt; 'nu 20°' zegt het al.");
assert.deepEqual(mk([19.6,20,20,20,19,18,17,16,15,15,15,15],24,{index:.5,waarde:19}),[["max",20,2],["min",15,9]],"Wijkt de nu-waarde af, dan blijft de max staan, op het midden van het echte plateau 1-3 (19,6 is lager dan 20).");
assert.deepEqual(mk([17,16.4,16.4,16.4,17,16.2,15.6,16.4,18,21]),[["min",16,6],["max",21,9]],"Het laagste punt is 15,6° en niet het eerdere plateau van 16,4°, ook al tonen beide 16°.");
assert.deepEqual(mk([20,21.4,20,19,21.6,20]),[["min",19,3],["max",22,4]],"Het hoogste punt is 21,6° (toont 22°), niet het eerdere 21,4°.");
assert.deepEqual(mk([15.6,16.4,16.2,15.8]),[],"Binnen één afgeronde graad krijgt het etmaal geen max/min-markering.");
[[12.3,11.8,11.1,11.4,12.9,14.7,16.2,17.5,18.1,18.4,18.2,17.3,15.9,14.8,14.1,13.2,12.7,12.8,12.4,12.1,11.7,11.3,11.2,11.6],
 [16.4,16.3,16.2,16.1,16.4,15.9,15.6,15.8,16.3,17.2,18.4,19.6,20.1,20.4,20.3,19.9,19.1,18.3,17.6,17.1,16.8,16.6,16.5,16.4]].forEach((T,k)=>{
  const plan=api.mobieleGrafiekMarkeringen(T,24);
  plan.forEach(m=>{
    const w=T[m.i];
    assert(T.every(t=>m.type==="max"?t<=w:t>=w),"Reeks "+k+": de "+m.type+"-markering op "+m.i+" ("+w+"°) ligt nooit "+(m.type==="max"?"lager":"hoger")+" dan een ander punt.");
    assert.equal(m.waarde,Math.round(w),"Reeks "+k+": het getal hoort bij het gemarkeerde punt.");
  });
});
assert.deepEqual(mk([14,15,null,18,16],24).map(m=>m[0]),["min","max"],"Ontbrekende uren worden overgeslagen, niet als nul gelezen.");

/* Vloeiende lijn: loopt door exact dezelfde punten en schiet nergens voorbij. */
const lijnPunten=[[0,100],[10,80],[20,80],[30,40],[40,60],[50,60]];
const pad=api.monotoonPad(lijnPunten);
assert(pad.startsWith("M0,100 C"),"Pad begint op het eerste datapunt.");
const segmenten=pad.slice(pad.indexOf("C")+1).split(" C").map(seg=>seg.trim().split(/\s+/).map(p=>p.split(",").map(Number)));
assert.equal(segmenten.length,lijnPunten.length-1,"Eén curvestuk per interval.");
segmenten.forEach(([c1,c2,eind],k)=>{
  const [a,b]=[lijnPunten[k],lijnPunten[k+1]],lo=Math.min(a[1],b[1]),hi=Math.max(a[1],b[1]);
  assert.deepEqual(eind,b,"Elk curvestuk eindigt exact op het volgende datapunt.");
  assert(c1[1]>=lo-1e-9&&c1[1]<=hi+1e-9&&c2[1]>=lo-1e-9&&c2[1]<=hi+1e-9,"Controlepunten blijven tussen de twee datapunten: geen verzonnen pieken of dalen (interval "+k+").");
});
assert(segmenten[1].every(p=>p[1]===80),"Een vlak stuk in de data blijft vlak.");
assert.equal(api.monotoonPad([[0,1]]),"","Eén punt levert geen lijn.");
assert.equal(api.monotoonPad([[0,1],[5,3]]),"M0,1 L5,3","Twee punten worden een rechte lijn.");
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
const rood={x:48,y:115,width:36,height:12};
assert.strictEqual(api.lijnRaaktTekstBox([[34,100],[84,140]],rood),true,"Dalende temperatuurcurve door het rode nu-label moet als botsing tellen.");
assert.strictEqual(api.lijnRaaktTekstBox([[34,80],[84,90]],rood),false,"Vrije ruimte boven de curve mag het nu-label behouden.");
assert.strictEqual(api.lijnRaaktTekstBox([[34,100],[34,140]],rood),false,"Een segment buiten het tekstvak mag geen valse botsing geven.");

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
assert(runtime.includes("herstelUurAs();polishMobieleGrafiekRanden();vereenvoudigMobieleZonband();bouwMobieleTemperatuurRij();"),"Mobiele eindpass moet de dubbele zontekst vóór de temperatuurrij verwijderen.");
assert(runtime.includes("${bottom+MOBIEL_ICOON_Y}")&&runtime.includes("y=Number(g.pt)+Number(g.ih)+MOBIELE_UURAS_Y;"),"Weericonen staan tussen plot en mobiele uuras.");
assert(api.MOBIEL_ICOON_Y+api.MOBIEL_ICOON_GROOTTE<api.MOBIELE_UURAS_Y-8,"De weericonen blijven vrij van de uurlabels.");
assert(runtime.includes('el.setAttribute("data-mobile-temp-label","1")')&&runtime.includes('el.setAttribute("data-mobile-temp-priority","anchor")'),"Lijnlabels zijn traceerbaar als drie-uursankers.");
assert(runtime.includes("Math.abs(m.i-i)<=1")&&runtime.includes("Math.abs(i-nuIndex)<1.5"),"Een anker naast piek, dal of nu krijgt geen tweede temperatuur.");
assert(runtime.includes("mobieleGrafiekMarkeringen(g.T,24,")&&runtime.includes('data-mobile-temp-marker'),"Max/min op de lijn komen uit het pure markeringenplan.");
assert(!runtime.includes("opAnker")&&runtime.includes("grafiekRandWaarden(g,Math.min(24,g.T.length))).forEach(m=>{"),"Een mobiele max/min-markering staat op het echte hoogste of laagste punt, ook tussen twee drie-uursankers; de uuras houdt haar drie-uursritme.");
assert(runtime.includes("const vrijVanTijd=els=>vasteMobieleAs&&els.every(el=>el.hasAttribute(\"data-mobile-temp-marker\"))"),"Op de telefoon krijgt piek of dal geen eigen uurtijd die het drie-uursritme breekt.");
assert(runtime.includes('plaats(m.waarde+"°",')&&!runtime.includes('m.type+" "+m.waarde'),"Max/min-markering toont alleen de waarde: \"min 3°\" leest als -3°.");
assert(runtime.includes("const asKolom=Number(g.x(0))-4;")&&runtime.includes("if(box&&box.x<asKolom){if(!schuif)continue;"),"Een kale markering staat nooit in de kolom van de asgetallen; een ankerlabel schuift ervan weg.");
assert(runtime.includes("if(y-fs<plafond||y>bottom-3)continue;")&&runtime.includes("filter(b=>Number.isFinite(b)&&b<top-4)"),"Een label bij een piek vlak onder de bovenste asgrens mag boven de plotrand uitsteken tot net onder de dag/nachtband, zodat het boven zijn punt blijft.");
assert(runtime.includes("monotoonPad(")&&runtime.includes('data-mobile-line-points'),"Mobiele lijn is vloeiend en houdt haar punten beschikbaar voor botsingscontrole.");
assert(runtime.includes('path[data-mobile-line-points]'),"Nu-labelpolish controleert ook tegen de vloeiende lijn.");
assert(runtime.includes('!el.hasAttribute("data-mobile-temp-label")&&!el.hasAttribute("data-mobile-temp-marker")&&/Bodoni/i'),"Randpolish mag de geplaatste lijnlabels en markeringen niet verschuiven.");
assert(!runtime.includes("verminderMobieleTemperatuurlabels"),"De oude op-de-lijn-labelplaatser is volledig vervangen.");
assert(!runtime.includes("mobieleTemperatuurLabelLimiet(window.innerWidth)"),"De mobiele 24-uursgrafiek mag verplichte ankers niet langer via een viewport-limiet uitdunnen.");

/* Desktop: dezelfde accenten, met behoud van het uurcijfer. */
assert(/compactMobieleGrafiekHoogte\(\);koppelTijdAanTemperatuur\(\);bouwDesktopGrafiekAccenten\(\);herplaatsRegengetallen\(\);\}/.test(runtime),"Tijdkoppeling en desktopaccenten draaien in dezelfde idempotente grafiekpass, de tijden vóór de iconen; de regengetallen komen als laatste, rond de definitieve temperaturen.");
assert(runtime.includes("function koppelTijdAanTemperatuur(){")&&runtime.includes('data-temp-time')&&runtime.includes('data-temp-time-complete'),"Iedere temperatuur in de grafiek krijgt een tijd onder haar punt, of vervalt.");
{
  const accenten=runtime.slice(runtime.indexOf("function bouwDesktopGrafiekAccenten(){"),runtime.indexOf("function koppelTijdAanTemperatuur(){"));
  assert(accenten&&!accenten.includes("if(mobiel())return;")&&/if\(!svg\|\|!g\|\|g\.M\|\|/.test(accenten),"Desktopaccenten volgen de grafiekmodus: iedere niet-mobiele grafiek (vanaf 760px, ook tablet) krijgt ze; de mobiele grafiek houdt haar eigen owner.");
}
assert(runtime.includes('data-desktop-temp-area')&&runtime.includes('url(#desktopTempVlak)'),"Desktop krijgt het zachte vlak onder de lijn.");
assert(runtime.includes('data-desktop-weather-icon')&&runtime.includes("bestaandeUurLabels(svg,g)")&&runtime.includes("<=H-2"),"Desktopiconen staan bij de bestaande uurtijden en alleen als alles binnen de viewBox past.");
assert(runtime.includes('mobieleGrafiekMarkeringen(g.T,g.T.length,')&&runtime.includes('data-desktop-temp-marker-dot'),"Desktop licht hoogste en laagste punt uit met hetzelfde markeringenplan als mobiel.");
assert(!runtime.includes("De stip hoort bij het punt")&&runtime.includes('dot.setAttribute("cx",String(px));dot.setAttribute("cy",String(py));dot.setAttribute("r","3")')&&runtime.includes("data-desktop-temp-moved")&&runtime.includes("data-desktop-temp-added"),"De desktopstip staat op het echte hoogste of laagste punt; heeft dat uur geen cijfer, dan verhuist het gelijke cijfer mee of komt er een bij, herstelbaar per pass.");

const basisGrafiek=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert(basisGrafiek.includes("const MAXLAAG=M?(n<=24?4:3):2;"),"Een desktopcijfer zweeft hooguit twee lagen van zijn punt; verder weg leest het als een ander punt.");

const checkpoint=fs.readFileSync(path.join(__dirname,"apply-mobile-screenshot-polish.js"),"utf8");
assert(!/['\"]\s*const A=a\.getBBox\s*\(/.test(checkpoint),"Checkpoint-50 owner mag geen SVG-fontboxmeting meer injecteren.");
assert(checkpoint.includes("geschatteTekstBox=el=>"),"Checkpoint-50 owner moet de attribuutgebaseerde tekstbox injecteren.");
assert(checkpoint.includes("const fs=Number.isFinite(attrFont)&&attrFont>0?attrFont:(/Bodoni Moda/.test(familie)?F.temp:F.uur);"),"Checkpoint-50 tekstbox gebruikt de bestaande grafiekfontmaten als veilige fallback.");
console.log("Mobiele grafiek reflow-test groen: echte lokale drie-uursankers, temperaturen op de lijn, weericonen, max/min-markeringen en monotone vloeiende lijn; desktop met vlak, iconen en uitgelichte piek/dal.");

"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {
  SPLIT_BRON,SPLIT_PRODUCTIE,HELPER_PRODUCTIE,RANDEN_PRODUCTIE,BEDRAGEN_PRODUCTIE,
  MOBIEL_LABEL_MIN_MM,MOBIEL_LABEL_MAX,q4MobieleGelabeldePerioden,pasQ4MobieleRegenlabelsToe
}=require("./q4-mobile-rain-label-owner.js");

assert.equal(MOBIEL_LABEL_MIN_MM,0.1,"Q4-perioden beginnen bij de centrale 0,1-mm drempel");
assert.equal(MOBIEL_LABEL_MAX,24,"een 24-uursgrafiek kan hoogstens 24 losse uurperioden bevatten");

const perioden=[
  {van:0,tot:5,som:2.6},
  {van:8,tot:9,som:0.1},
  {van:11,tot:12,som:0.1},
  {van:13,tot:15,som:1.0}
];
assert.deepStrictEqual(
  q4MobieleGelabeldePerioden(perioden),
  perioden,
  "iedere zichtbare bracket houdt op mobiel zijn tijdvak- en hoeveelheidcontext"
);
assert.notStrictEqual(q4MobieleGelabeldePerioden(perioden),perioden,"helper geeft een veilige kopie terug");
const alleenMini=[{som:0.1},{som:0.1},{som:0.1}];
assert.deepStrictEqual(q4MobieleGelabeldePerioden(alleenMini),alleenMini,"ook kleine meetbare perioden blijven allemaal gelabeld");
const veel=Array.from({length:24},(_,i)=>({som:0.1+(i%4)/10}));
assert.equal(q4MobieleGelabeldePerioden(veel).length,24,"zelfs het theoretische 24-periodenrandgeval verliest geen bracketcontext");
assert.deepStrictEqual(q4MobieleGelabeldePerioden(null),[],"ontbrekende periodereeks is null-safe");

/* De helper wordt letterlijk in de browserbundle gezet. Test hem daarom ook in
   een lege VM zonder Node-modulebindings. */
assert(!HELPER_PRODUCTIE.includes("MOBIEL_LABEL_MIN_MM"),"browserhelper mag de Node-drempelconstante niet refereren");
assert(!HELPER_PRODUCTIE.includes("MOBIEL_LABEL_MAX"),"browserhelper mag de Node-maxconstante niet refereren");
const browserUitkomst=new vm.Script(
  HELPER_PRODUCTIE+"\nq4MobieleGelabeldePerioden([{som:2.6},{som:0.1},{som:0.1},{som:1.0}]).map(p=>p.som);"
).runInNewContext({});
assert.deepStrictEqual(Array.from(browserUitkomst),[2.6,0.1,0.1,1.0],"geïsoleerde browserhelper bewaart alle perioden zonder modulebindings");

const bron=fs.readFileSync(path.join(__dirname,"q4-rain-runtime.js"),"utf8");
assert.equal(bron.split(SPLIT_BRON).length-1,1,"Q4-runtime mist exact één brede-periode splitanker");
assert(!bron.includes(SPLIT_PRODUCTIE),"Q4-runtime bevat de mobiele owner al vóór assemblage");
assert(!bron.includes(HELPER_PRODUCTIE),"Q4-runtime bevat de mobiele labelselectie al vóór assemblage");

const uit=pasQ4MobieleRegenlabelsToe(bron);
assert.equal(uit.split(SPLIT_PRODUCTIE).length-1,1,"mobiele compacte-rangeregel ontbreekt of is dubbel");
assert(!uit.includes(SPLIT_BRON),"oude mobiele/desktop gedeelde splitregel bleef actief");
assert.equal(uit.split(HELPER_PRODUCTIE).length-1,1,"mobiele volledige labelset ontbreekt of is dubbel");
assert(uit.includes(RANDEN_PRODUCTIE),"tijdlabels gebruiken mobiel de volledige Q4-periodenset");
assert(uit.includes(BEDRAGEN_PRODUCTIE),"mm-labels gebruiken mobiel exact dezelfde volledige periodenset");
for(const invariant of [
  'const compactTekst=tekst.van+"–"+tekst.tot',
  'groep.setAttribute("data-q4-rain-periods","1")',
  'q4Mm(p.som)+" mm"',
  'q4PeriodeTijdvak(g,p)',
  'perioden.forEach(p=>{'
])assert(uit.includes(invariant),"regenperiode-invariant onbedoeld geraakt: "+invariant);

assert.throws(()=>pasQ4MobieleRegenlabelsToe(uit),/staat al in de runtime/,
  "owner moet fail-fast zijn bij dubbele assemblage");

console.log("Q4 mobiele regenlabels groen: iedere zichtbare bracket houdt op mobiel zijn tijdvak en hoeveelheid; compacte rangegeometrie en browserisolatie blijven intact.");

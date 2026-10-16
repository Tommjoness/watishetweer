"use strict";

/* Contract nachtvenster: een getoond venster duurt minstens twee uur, ofwel
   minstens drie opeenvolgende uurpunten. Eén contract voor de app (index.html),
   de rekenlaag (senior-correctness-v2.js), de tekstlaag (corrigeerNachtVensterBron)
   en de Nachtzicht-pagina's, die de rekenlaag letterlijk overnemen. */

const assert=require("assert"),fs=require("fs"),path=require("path");
const v2=require("../senior-correctness-v2.js");
const polish=require("./mobile-screenshot-polish.js");

const lees=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const UUR=3600000;
const goed=ms=>({ms,cloud:10,visibility:20000,precip:0,code:0,moon:0,humidity:70,spread:5,gust:10});
const slecht=ms=>({ms,cloud:90,visibility:20000,precip:0,code:3,moon:0,humidity:70,spread:5,gust:10});
const reeks=(start,patroon)=>patroon.split("").map((c,i)=>(c==="g"?goed:slecht)(start+i*UUR));
const beste=(start,patroon)=>v2.nachtzichtScore(reeks(start,patroon)).beste;

const start=Date.UTC(2026,9,10,20);
assert.equal(beste(start,"sssggsss"),null,"twee uurpunten (één uur) zijn geen venster");
assert.equal(beste(start,"ssggsss"),null,"twee uurpunten midden in de nacht zijn geen venster");
assert.equal(beste(start,"sssgggss").length,3,"drie uurpunten (twee uur) zijn wel een venster");
assert.equal(beste(start,"gggggggg").length,8,"een heldere nacht blijft één venster");
assert.equal(beste(start,"ggsggsgg"),null,"losse paren van twee tellen niet bij elkaar op");

/* Lopende nacht: het gunstige venster is al als minstens twee uur vastgesteld; het
   resterende uur "nu tot ..." blijft getoond en wordt niet afgekeurd. */
assert.equal(
  polish.corrigeerNachtVensterBron("Beste periode 04:30–07:00",0,8,{zonsopkomst:"08:10",actief:true,nuTijd:"04:30"}),
  "Beste periode: nu tot 06:00.",
  "lopende nacht: het getoonde einde blijft het laatste goede uurpunt"
);
assert.equal(
  polish.corrigeerNachtVensterBron("Beste periode 05:30–07:00",0,8,{zonsopkomst:"08:10",actief:true,nuTijd:"05:45"}),
  "Beste periode: nu tot 06:00.",
  "lopende nacht: een laatste kwartier blijft zichtbaar zolang het venster loopt"
);

/* Zonsopkomst: afkappen op de zonsopkomst mag geen venster onder de twee uur geven. */
assert.equal(
  polish.corrigeerNachtVensterBron("Beste periode 04:00–08:30",1,8,{zonsopkomst:"07:15"}),
  "Beste periode: 04:00–07:15.",
  "afkappen op de zonsopkomst met ruim twee uur blijft staan"
);
assert.equal(
  polish.corrigeerNachtVensterBron("Beste periode 06:00–08:30",1,8,{zonsopkomst:"07:15"}),
  "Geen gunstig kijkvenster.",
  "afkappen op de zonsopkomst tot 75 minuten is geen venster"
);

/* Wintertijd (nacht van 24 op 25 oktober 2026): 02:00 komt twee keer voor. Echte
   uurpunten tellen, niet klokminuten. */
const w=Date.UTC(2026,9,24,22); /* 00:00 CEST */
const winterRijen=patroon=>reeks(w,patroon);
assert.equal(v2.nachtzichtScore(winterRijen("ssggssss")).beste,null,"wintertijd: 02:00 (CEST) en 02:00 (CET) zijn samen één uur");
assert.equal(v2.nachtzichtScore(winterRijen("ssgggsss")).beste.length,3,"wintertijd: drie echte uurpunten over het herhaalde uur zijn twee uur");
assert.equal(
  polish.corrigeerNachtVensterBron("Beste periode 02:00–04:00",0,8,{zonsopkomst:"07:45"}),
  "Beste periode: 02:00–03:00.",
  "wintertijd: de tekstlaag wijst een echt tweeuursvenster in het herhaalde uur niet af"
);

/* Engels: de korte venstertekst van het Nachtzicht-overzicht (kortVenster). */
const {maakVertaler,isNeutraal}=require("../taal/vertaalkern.js");
const en=maakVertaler(require("../taal/en.js"));
for(const [nl,eng] of [
  ["nu tot 05:00","now until 05:00"],
  ["geen (bewolking)","none (cloud)"],
  ["geen (neerslag en bewolking)","none (precipitation and cloud)"],
  ["geen (neerslag, bewolking en maanlicht)","none (precipitation, cloud and moonlight)"],
  ["geen (onvoldoende data)","none (insufficient data)"],
  ["geen (korter dan twee uur)","none (shorter than two hours)"]
])assert.equal(en.vertaal(nl),eng,"EN venstertekst: "+nl);
assert(isNeutraal("04:00–06:00"),"een tijdspanne is taalneutraal");
assert.equal(en.vertaal("geen (onbekende reden)"),null,"onbekende reden blijft onvertaald in plaats van half vertaald");
assert(/"geen \(" \+ \(n\.reden \|\| "korter dan twee uur"\) \+ "\)"/.test(lees("scripts/nachtzicht-runtime.js")),"overzicht: een lege reden toont 'korter dan twee uur'");

/* De Nachtzicht-pagina's nemen de rekenlaag letterlijk over (nachtzicht-bron.js):
   de grens moet daar meekomen, anders breekt de pagina bij het rekenen. */
const vm=require("vm");
const paginaRekenlaag=vm.runInNewContext(require("./nachtzicht-bron.js").seniorBron());
assert.equal(paginaRekenlaag.nachtzichtScore(reeks(start,"sssggsss")).beste,null,"pagina-rekenlaag: twee uurpunten zijn geen venster");
assert.equal(paginaRekenlaag.nachtzichtScore(reeks(start,"sssgggss")).beste.length,3,"pagina-rekenlaag: drie uurpunten zijn een venster");

/* Eén grens in alle lagen. */
const html=lees("index.html");
assert(/const MIN_VENSTER_RIJEN=3;/.test(html),"index.html: MIN_VENSTER_RIJEN is 3");
assert(/const MIN_VENSTER_RIJEN=3;/.test(lees("senior-correctness-v2.js")),"rekenlaag: MIN_VENSTER_RIJEN is 3");
assert(/if\(br>=MIN_VENSTER_RIJEN&&bstart>=0\)/.test(html),"index.html: het venster volgt MIN_VENSTER_RIJEN");
assert(!/langsteRun\([^)]*\)>=2/.test(html)&&!/br>=2/.test(html),"index.html: geen losse grens van twee uurpunten meer");

console.log("Nachtvenster-contract groen: minstens twee uur (drie uurpunten) in app, rekenlaag en tekstlaag; lopende nacht, zonsopkomst en wintertijd kloppen.");

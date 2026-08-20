"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const p=require("./mobile-screenshot-polish.js");

const mobileCss=fs.readFileSync(path.join(__dirname,"mobile-screenshot-polish.css"),"utf8");
const apply=fs.readFileSync(path.join(__dirname,"apply-mobile-screenshot-polish.js"),"utf8");
assert(/#nights \.row\.night\{[\s\S]*?row-gap:5px;[\s\S]*?\}/.test(mobileCss),"Nachtzicht houdt op mobiel extra verticale ademruimte");
assert(/#nights \.row\.night\.kop > \.nmeta:not\(\.wide\)\{[\s\S]*?font-size:10px!important;[\s\S]*?\}/.test(mobileCss),"Mobiele Nachtzicht-kop blijft minimaal 10 px op normale telefoonbreedte");
assert(/#nights \.row\.night \.nachtadvies\{[\s\S]*?font-size:13px;[\s\S]*?line-height:1\.4;[\s\S]*?\}/.test(mobileCss),"Mobiel Nachtzicht-advies gebruikt leesbare 13 px tekst");
assert(/#nights \.row\.night \.nachtmaan\{[\s\S]*?font-size:12px;[\s\S]*?line-height:1\.4;[\s\S]*?\}/.test(mobileCss),"Mobiele maantoelichting zakt niet onder 12 px");
assert(/@media\(max-width:360px\)[\s\S]*?#nights \.row\.night\.kop > \.nmeta:not\(\.wide\)\{font-size:9\.5px!important;/.test(mobileCss),"Ook op 320–360 px blijft de Nachtzicht-kop leesbaar zonder kolomoverflow");
assert(mobileCss.includes(".nachtzichtregel")&&mobileCss.includes(".nachtmaanregel"),"zicht en maan hebben afzonderlijke presentatie-regels");
assert(mobileCss.includes("#nights .nacht-meer")&&mobileCss.includes('#nights .row.night[hidden]'),"Nachtzicht heeft een mobiele uitklapbediening zonder rijen uit de DOM te verwijderen");
assert(/#days \.row\.day:not\(\.kop\) \.dname\{font-size:13\.5px\}/.test(mobileCss),"Mobiele dagnaam blijft minimaal 13,5 px");
assert(/#days \.row\.day:not\(\.kop\) \.dwind,[\s\S]*?#days \.row\.day:not\(\.kop\) \.drain\{font-size:13px\}/.test(mobileCss),"Mobiele wind- en neerslagtekst blijven minimaal 13 px");
assert(apply.includes("M?kandidatenRuw.filter(k=>k.rang===3):kandidatenRuw"),"Mobiel etmaal toont permanent alleen globale extrema naast het aparte nu-label");

/* De mobiele header is één compositie: zoekveld over de volle breedte en drie
   gelijke acties eronder. Alle semantiek blijft in de bestaande DOM; deze test
   bewaakt uitsluitend de fysieke mobiele presentatie en tapdoelen. */
assert(/@media\(max-width:430px\)[\s\S]*?\.tools\{[\s\S]*?display:grid;[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\);/.test(mobileCss),"Mobiele topbediening heeft drie gelijke actiekolommen");
assert(/\.tools > input\[type=text\]\{[\s\S]*?grid-column:1 \/ -1;[\s\S]*?min-height:46px;/.test(mobileCss),"Mobiele zoekinvoer staat op een eigen volle rij met ruim tapdoel");
assert(/\.tools > #here,\.tools > #ververs,\.tools > #thema\{[\s\S]*?min-height:42px;[\s\S]*?border-right:1px solid var\(--rule\);/.test(mobileCss),"Locatie, verversen en weergave delen één rustige actierij");
assert(/\.results\{top:46px;left:-1px;right:-1px\}/.test(mobileCss),"Zoekresultaten blijven direct onder de zoekinvoer verankerd");
assert(/\.chip\.add\{[\s\S]*?min-height:44px;[\s\S]*?border:0;[\s\S]*?box-shadow:inset 0 -1px 0 var\(--rule\);/.test(mobileCss),"Plaats bewaren is een rustige 44px-tekstactie in plaats van een gestippelde chip");

assert.equal(p.nachtzichtCompactAantal(6,true),3);
assert.equal(p.nachtzichtCompactAantal(2,true),2);
assert.equal(p.nachtzichtCompactAantal(6,false),6);

const afnemend=p.maanFaseUitBeschrijving("afnemende sikkel, 7 procent verlicht");
const wassend=p.maanFaseUitBeschrijving("wassende sikkel, 7 procent verlicht");
assert(afnemend>0.75&&afnemend<1);
assert(wassend>0&&wassend<0.25);
assert(Math.abs((1-afnemend)-wassend)<0.0001);
assert.equal(p.maanFaseUitBeschrijving("nieuwe maan, 0 procent verlicht"),0);
assert.equal(p.maanFaseUitBeschrijving("volle maan, 100 procent verlicht"),0.5);
assert.equal(p.maanFaseUitBeschrijving("geen fase"),null);

const nieuw=p.maanFaseSvgV2(0,14),vol=p.maanFaseSvgV2(0.5,14),eerste=p.maanFaseSvgV2(0.25,14),laatste=p.maanFaseSvgV2(0.75,14),wassendeSikkel=p.maanFaseSvgV2(0.08,14),afnemendeSikkel=p.maanFaseSvgV2(0.92,14);
assert(nieuw.includes('class="maan-schaduw"'));
assert(!nieuw.includes("maan-licht-vol"));
assert(vol.includes("maan-licht-vol"));
assert.notEqual(nieuw,vol);assert.notEqual(eerste,laatste);assert.notEqual(wassendeSikkel,afnemendeSikkel);
for(const svg of [nieuw,vol,eerste,laatste,wassendeSikkel,afnemendeSikkel]){
  assert(svg.includes("maan-fase-svg-v2"));assert(svg.includes("var(--moon-unlit)"));assert(!/[🌑🌒🌓🌔🌕🌖🌗🌘]/u.test(svg));
}

for(const [score,oordeel] of [[0,"Ongunstig"],[3,"Ongunstig"],[4,"Matig"],[5,"Redelijk"],[6,"Redelijk"],[7,"Goed"],[8,"Goed"],[9,"Uitstekend"],[10,"Uitstekend"]])assert.equal(p.nachtOordeelGetoond(score),oordeel);
assert.equal(p.nachtBalkPercentageGetoond(6.4),60);
assert.equal(p.nachtBalkPercentageGetoond(6.6),70);
assert.deepEqual(p.nachtLabelVarianten("ma op di"),{lang:"ma op di",kort:"ma–di"});
assert.equal(p.nachtAdviesMetHorizon("Goed",2),"Goed");
assert.equal(p.nachtAdviesMetHorizon("Goed",3),"Voorlopig goed");
assert.equal(p.nachtAdviesMetHorizon("Goed",5),"Voorlopig goed");

/* Midnight rollover: vóór zonsopkomst moet de eerste Nachtzicht-rij de lopende
   nacht blijven, niet alvast de komende avond. De brondata zelf mag niet wijzigen. */
const bron={
  current:{time:"2026-08-16T00:04",is_day:0},
  daily:{
    time:["2026-08-16","2026-08-17","2026-08-18"],
    sunrise:["2026-08-16T06:25","2026-08-17T06:27","2026-08-18T06:29"],
    sunset:["2026-08-16T21:02","2026-08-17T20:59","2026-08-18T20:57"],
    temperature_2m_max:[24,20,20]
  }
};
const genormaliseerd=p.normaliseerNachtDagdata(bron,"2026-08-16T00:04");
assert.notStrictEqual(genormaliseerd,bron);
assert.equal(genormaliseerd.daily.time[0],"2026-08-15");
assert.equal(genormaliseerd.daily.sunset[0],"2026-08-15T23:59");
assert.equal(genormaliseerd.daily.sunrise[1],"2026-08-16T06:25");
assert.equal(genormaliseerd.daily.sunset[1],"2026-08-16T21:02");
assert.equal(bron.daily.time[0],"2026-08-16","normalisatie muteert de providerdata niet");
assert.equal(genormaliseerd.daily.temperature_2m_max[0],null,"parallelle daily arrays blijven indexmatig uitgelijnd");
assert.equal(genormaliseerd.daily.temperature_2m_max[1],24);
assert.equal(p.nachtIsActiefNu(bron,"2026-08-16T00:04"),true);
assert.strictEqual(p.normaliseerNachtDagdata({...bron,current:{time:"2026-08-16T07:00",is_day:1}},"2026-08-16T07:00").daily,bron.daily,"na zonsopkomst geen kunstmatige nacht toevoegen");
assert.strictEqual(p.normaliseerNachtDagdata({...bron,current:{time:"2026-08-16T22:00",is_day:0}},"2026-08-16T22:00").daily,bron.daily,"na zonsondergang is de normale today->tomorrow-nacht al correct");
assert.equal(p.datumVerschuif("2026-03-29",-1),"2026-03-28","kalenderrekenen is DST-onafhankelijk");
assert.equal(p.datumVerschuif("2026-10-25",-1),"2026-10-24","najaarsomslag verandert civiele datum niet");

/* Beste periode: astronomische zonsopkomst is een harde bovengrens; alleen een
   niet-goed uurpunt wordt één modeluur teruggezet. Actieve/passeerde perioden
   worden in de tijdstaal ook echt als nu/verleden benoemd. */
assert.equal(p.corrigeerNachtVensterBron("Beste periode 00:00–06:25",0,10,{zonsopkomst:"06:25",actief:true,nuTijd:"00:03"}),"Beste periode: nu tot 06:25.");
assert.equal(p.corrigeerNachtVensterBron("Beste periode 22:00–00:00",0,8,{zonsopkomst:"06:25"}),"Beste periode: 22:00–23:00.");
assert.equal(p.corrigeerNachtVensterBron("Beste periode 22:00–00:00",0,8,{zonsopkomst:"06:25",actief:true,nuTijd:"22:30"}),"Beste periode: nu tot 23:00.");
assert.equal(p.corrigeerNachtVensterBron("Beste periode 22:00–00:00",0,8,{zonsopkomst:"06:25",actief:true,nuTijd:"00:30"}),"Beste periode was 22:00–23:00.");
assert.equal(p.corrigeerNachtVensterBron("Beste periode 23:00–02:00",1,3,{zonsopkomst:"06:25"}),"Relatief beste periode: 23:00–01:00.");
assert.equal(p.corrigeerNachtVensterBron("Beste periode 23:00–02:00",5,8,{zonsopkomst:"06:25"}),"Waarschijnlijk beste periode van de avond tot de nacht.");
assert.equal(p.corrigeerNachtVensterBron("Geen gunstig kijkvenster door bewolking en maanlicht",0),"Geen gunstig kijkvenster door bewolking en maanlicht.");

assert.equal(p.formatteerMaanTekst("maan onder 22:03"),"Maanondergang om 22:03.");
assert.equal(p.formatteerMaanTekst("de maan blijft onder de horizon"),"Maan blijft onder de horizon.");
assert.equal(p.formatteerMaanTekst("maan op 21:10 · onder 04:20"),"Maanopkomst om 21:10 · maanondergang om 04:20.");
assert.deepEqual(p.nachtMetaDelen("Gem. zicht 10+ km · maan onder 22:03"),{zicht:"Gemiddeld zicht: 10+ km",maan:"Maanondergang om 22:03."});

assert.equal(p.pollenKop("Pollen gras"),"Graspollen");
assert.equal(p.pollenKop("Pollen bijvoet"),"Bijvoetpollen");
assert.equal(p.pollenEenheid(1),"korrel/m³");
assert.equal(p.pollenEenheid(1.4),"korrel/m³");
assert.equal(p.pollenEenheid(1.5),"korrels/m³");
assert.equal(p.pollenEenheid(0),"korrels/m³");
assert.equal(p.pollenEenheid(4),"korrels/m³");

console.log("Mobiele screenshot-polish: topbediening, compacte etmaallabels, uitklapbaar Nachtzicht, kalendergrens, maanfase, natuurlijke maancopy, weekleesbaarheid en pollenregressies geslaagd.");

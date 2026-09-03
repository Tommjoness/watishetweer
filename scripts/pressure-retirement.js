"use strict";

/*
 * Finale retirement van de oude luchtdrukfeature.
 *
 * Deze helper draait uitsluitend in de delivery-laag, dus nadat alle historische
 * UI/runtime-owners hun werk hebben gedaan. Hij verwijdert de complete verweesde
 * productfeature uit het werkelijk te leveren artifact: tegel, providerdata,
 * basisrenderer én late compatibility/diagnostic owners.
 */
const TEGEL_RE=/<div class="stat"><div class="eyebrow">Luchtdruk(?: op zeeniveau)?<\/div><div class="sval" id="pres">[\s\S]*?<\/div><div class="ssub" id="pressub">[\s\S]*?<\/div><\/div>\s*/g;
const RUNTIME_RE=/\n  const drukRuw=eindigGetal\(c\.pressure_msl\);[\s\S]*?\n\n  const cc=/g;
const GLOBAL_SEMANTIEK_RE=/\nfunction corrigeerDrukSemantiek\(\)\{[\s\S]*?\n\}\nfunction finaliseerDagNeerslag/g;
const AUDIT_MEETGEGEVENS_RE=/\nlet drukResizeGebonden=false;\nfunction bouwMeetgegevens\(\)\{[\s\S]*?\n\}\n\nfunction naRender/g;
const DESKTOP_DRUK_RE=/\nfunction herstelVerborgenDruk\(\)\{[\s\S]*?\n\}\n\nfunction maakUurPaneel/g;
const MOBILE_SECUNDAIR_DRUK_RE=/\[\s*["']pressub["']\s*,\s*["']Luchtdruk["']\s*\]\s*,?/g;
const DIAGNOSTIC_RE=/<div id="wiw-pressure-diagnostic"[^>]*><\/div>\s*/g;
const PRESSURE_CSS_RE=/\s*\.wiw-(?:more-measurements[^\{]*|pressure-meaning)\{[^}]*\}/g;
const PRESSURE_SIGNAAL_RE=/id="pres"|id="pressub"|pressure_msl|corrigeerDrukSemantiek|bouwMeetgegevens|herstelVerborgenDruk|wiw-pressure|["']pressub["']\s*,\s*["']Luchtdruk["']/i;

function tel(bron,re){return (String(bron||"").match(re)||[]).length;}
function context(bron,re){const m=re.exec(String(bron||""));re.lastIndex=0;if(!m)return "";const i=m.index;return String(bron).slice(Math.max(0,i-120),Math.min(String(bron).length,i+260)).replace(/\s+/g," ");}

function verifieerPressureRetired(html,label="artifact"){
  const bron=String(html||"");
  for(const [re,naam] of [
    [/id="pres"/i,"#pres-element"],
    [/id="pressub"/i,"#pressub-element"],
    [/getElementById\(["']pres["']\)/i,"#pres-runtime"],
    [/getElementById\(["']pressub["']\)/i,"#pressub-runtime"],
    [/pressure_msl/i,"pressure_msl"],
    [/\bluchtdruk\b/i,"luchtdrukcopy"],
    [/id="wiw-pressure-diagnostic"/i,"pressure diagnostic container"],
    [/corrigeerDrukSemantiek|bouwMeetgegevens|herstelVerborgenDruk|wiw-pressure/i,"pressure compatibility-runtime"]
  ]){
    if(re.test(bron))throw new Error(label+": pressure-retirement incompleet; "+naam+" staat nog in artifact. Context: "+context(bron,re));
  }
  return true;
}

function retirePressure(html){
  let bron=String(html||"");
  if(!PRESSURE_SIGNAAL_RE.test(bron)){
    verifieerPressureRetired(bron,"pressure-vrij artifact");
    return bron;
  }

  const tegels=tel(bron,TEGEL_RE),runtimes=tel(bron,RUNTIME_RE);
  if(tegels!==1)throw new Error("Pressure-retirement verwacht exact één luchtdruktegel; gevonden "+tegels+". Context: "+context(bron,/Luchtdruk/i));
  if(runtimes!==1)throw new Error("Pressure-retirement verwacht exact één luchtdrukruntime; gevonden "+runtimes+". Context: "+context(bron,/pressure_msl/i));

  bron=bron.replace(TEGEL_RE,"");
  bron=bron.replace(RUNTIME_RE,"\n\n  const cc=");
  bron=bron.replace(/,pressure_msl/g,"").replace(/pressure_msl,/g,"");

  /* Late owners die de inmiddels verwijderde tegel alleen nog labelden,
     verplaatsten of als extra meetgegeven probeerden terug te zetten. */
  bron=bron.replace(GLOBAL_SEMANTIEK_RE,"\nfunction finaliseerDagNeerslag");
  bron=bron.replace(/corrigeerDrukSemantiek\(\);/g,"");
  bron=bron.replace(AUDIT_MEETGEGEVENS_RE,"\nfunction naRender");
  bron=bron.replace(/bouwMeetgegevens\(\);/g,"");
  bron=bron.replace(DESKTOP_DRUK_RE,"\nfunction maakUurPaneel");
  bron=bron.replace(/herstelVerborgenDruk\(\);/g,"");
  bron=bron.replace(/,herstelVerborgenDruk(?=[,}])/g,"");
  /* De mobiele detail-uitleg blijft bestaan voor vocht, bewolking en zicht;
     alleen het verweesde pressub-item verdwijnt uit de secundaire lijst. */
  bron=bron.replace(MOBILE_SECUNDAIR_DRUK_RE,"");
  /* De finale desktoplaag liet nog een lege verborgen diagnostiekcontainer achter.
     Ook die heeft zonder pressurefeature geen eigenaar of functie meer. */
  bron=bron.replace(DIAGNOSTIC_RE,"");
  bron=bron.replace(PRESSURE_CSS_RE,"");

  verifieerPressureRetired(bron,"delivery artifact");
  return bron;
}

module.exports={
  TEGEL_RE,RUNTIME_RE,GLOBAL_SEMANTIEK_RE,AUDIT_MEETGEGEVENS_RE,DESKTOP_DRUK_RE,
  MOBILE_SECUNDAIR_DRUK_RE,DIAGNOSTIC_RE,PRESSURE_CSS_RE,PRESSURE_SIGNAAL_RE,retirePressure,verifieerPressureRetired
};

"use strict";

/*
 * Finale retirement van de oude luchtdrukfeature.
 *
 * De historische brontemplate en enkele oudere regressietests kennen de feature
 * nog, maar het publieke product niet meer. Deze pure stap verwijdert daarom
 * uitsluitend het definitieve, reeds geassembleerde artifact-contract:
 * - de luchtdruktegel;
 * - pressure_msl uit current/hourly providerqueries;
 * - de bijbehorende runtimeberekening en drie-uursdelta.
 *
 * Daardoor kan geen verborgen/semantisch restje of ongebruikte providerdata meer
 * in het uitgeleverde HTML-artifact achterblijven.
 */
const TEGEL_RE=/<div class="stat"><div class="eyebrow">Luchtdruk(?: op zeeniveau)?<\/div><div class="sval" id="pres">[\s\S]*?<\/div><div class="ssub" id="pressub">[\s\S]*?<\/div><\/div>\s*/g;
const RUNTIME_RE=/\n  const drukRuw=eindigGetal\(c\.pressure_msl\);[\s\S]*?\n\n  const cc=/g;

function tel(bron,re){return (String(bron||"").match(re)||[]).length;}

function retirePressure(html){
  let bron=String(html||"");
  const tegels=tel(bron,TEGEL_RE),runtimes=tel(bron,RUNTIME_RE);
  if(tegels!==1)throw new Error("Pressure-retirement verwacht exact één luchtdruktegel; gevonden "+tegels+".");
  if(runtimes!==1)throw new Error("Pressure-retirement verwacht exact één luchtdrukruntime; gevonden "+runtimes+".");

  bron=bron.replace(TEGEL_RE,"");
  bron=bron.replace(RUNTIME_RE,"\n\n  const cc=");
  bron=bron.replace(/,pressure_msl/g,"").replace(/pressure_msl,/g,"");

  const verboden=[
    ['id="pres"',"pres-element"],
    ['id="pressub"',"pressub-element"],
    ["pressure_msl","provider/runtime pressure_msl"],
    ["Luchtdruk","luchtdrukcopy"]
  ];
  for(const [naald,label] of verboden){
    if(bron.includes(naald))throw new Error("Pressure-retirement liet "+label+" achter.");
  }
  return bron;
}

function verifieerPressureRetired(html,label="artifact"){
  const bron=String(html||"");
  for(const [re,naam] of [
    [/id="pres"/,"#pres"],[/id="pressub"/,"#pressub"],[/pressure_msl/,"pressure_msl"],[/Luchtdruk/i,"luchtdrukcopy"]
  ]){
    if(re.test(bron))throw new Error(label+": pressure-retirement incompleet; "+naam+" staat nog in HTML.");
  }
  return true;
}

module.exports={TEGEL_RE,RUNTIME_RE,retirePressure,verifieerPressureRetired};

"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");

const MARK="<!-- ===== NEDERLANDSE MICROCOPY 20260815 ===== -->";
if(html.includes(MARK))throw new Error("Nederlandse microcopy is al toegepast.");

function vervangAlles(oud,nieuw,label,{vereist=true}={}){
  const aantal=html.split(oud).length-1;
  if(vereist&&aantal<1)throw new Error("Microcopy-anchor ontbreekt: "+label);
  if(aantal)html=html.split(oud).join(nieuw);
  return aantal;
}

function vervangExact(oud,nieuw,label){
  const aantal=html.split(oud).length-1;
  if(aantal!==1)throw new Error("Microcopy-anchor moet exact één keer voorkomen ("+label+"): "+aantal);
  html=html.replace(oud,nieuw);
}

/*
 * Eén laatste taalnormalisatie na alle inhoudelijke weerlagen.
 * Geen kansgrens, hoeveelheid, tijd, providerwaarde, score of layout wordt hier
 * gewijzigd. Alleen bestaande zichtbare Nederlandse tekst wordt natuurlijker
 * gemaakt. Daardoor kan een latere inhoudelijke laag de gecorrigeerde copy niet
 * opnieuw met een oudere formulering overschrijven.
 */

/* Nederlandse inversie: bij een voorafgeplaatste tijdsbepaling klinkt het
   voornaamwoordelijke 'er' natuurlijker en voorkomt het de ambtelijke toon van
   bijvoorbeeld 'De komende twee uur wordt geen neerslag verwacht'. Dit geldt
   ook voor de dagzin 'Voor vandaag wordt ...'. */
vervangAlles(" wordt geen neerslag verwacht."," wordt er geen neerslag verwacht.","ontbrekend 'er' bij droge verwachting");

/* Komend uur: maak telegramstijl tot volledige, natuurlijk lopende zinnen.
   De zekerheidscategorie blijft woordelijk hetzelfde. */
vervangAlles("Neerslag wordt verwacht het komende uur.","Het komende uur wordt neerslag verwacht.","woordvolgorde neerslag komend uur");
vervangAlles("Enkele druppels zijn mogelijk het komende uur.","Het komende uur zijn enkele druppels mogelijk.","woordvolgorde druppels komend uur",{vereist:false});
vervangAlles("Enkele druppels mogelijk het komende uur.","Het komende uur zijn enkele druppels mogelijk.","ontbrekend werkwoord druppels komend uur",{vereist:false});
vervangAlles("Zeer kleine kans op neerslag het komende uur.","Het komende uur is er een zeer kleine kans op neerslag.","zeer kleine kans komend uur");
vervangAlles("Kleine kans op neerslag het komende uur.","Het komende uur is er een kleine kans op neerslag.","kleine kans komend uur");
vervangAlles("Neerslag is mogelijk het komende uur.","Het komende uur is neerslag mogelijk.","mogelijke neerslag komend uur");
vervangAlles("Grote kans op neerslag het komende uur.","Het komende uur is er een grote kans op neerslag.","grote kans komend uur",{vereist:false});
vervangAlles("Zeer grote kans op neerslag het komende uur.","Het komende uur is er een zeer grote kans op neerslag.","zeer grote kans komend uur",{vereist:false});

/* Windstoten: 'de hoogste verwachte windstoot lag op' leest onnatuurlijk en
   suggereert tegelijk observatie en verwachting. Benoem expliciet dat dit de
   verwachting was; toekomstige zinnen krijgen de tijd vóór de windstootclaim. */
const WIND_OUD=[
  'function uiWindstootTekst(pg,nu,dag,vak){',
  '  if(!pg||uiGetal(pg.v)===null||!pg.t)return "Geen uurgegevens beschikbaar.";',
  '  const waarde=Math.round(Number(pg.v));',
  '  const dagNaam=String(dag||"").trim();',
  '  const tijdvak=String(vak||"").trim();',
  '  if(String(pg.t)>String(nu||"")){',
  '    if(/^Vandaag$/i.test(dagNaam))return `Later vandaag kunnen windstoten tot ${waarde} km/u voorkomen, rond ${tijdvak}.`;',
  '    if(/^Morgen$/i.test(dagNaam))return `Morgen kunnen windstoten tot ${waarde} km/u voorkomen, rond ${tijdvak}.`;',
  '    return `${dagNaam||"Later"} kunnen windstoten tot ${waarde} km/u voorkomen, rond ${tijdvak}.`;',
  '  }',
  '  if(/^Vandaag$/i.test(dagNaam))return `Eerder vandaag lag de hoogste verwachte windstoot rond ${tijdvak} op ${waarde} km/u.`;',
  '  if(/^Gisteren$/i.test(dagNaam))return `Gisteren lag de hoogste verwachte windstoot rond ${tijdvak} op ${waarde} km/u.`;',
  '  return `${dagNaam||"Eerder"} lag de hoogste verwachte windstoot rond ${tijdvak} op ${waarde} km/u.`;',
  '}'
].join("\n");
const WIND_NIEUW=[
  'function uiWindstootTekst(pg,nu,dag,vak){',
  '  if(!pg||uiGetal(pg.v)===null||!pg.t)return "Geen uurgegevens beschikbaar.";',
  '  const waarde=Math.round(Number(pg.v));',
  '  const dagNaam=String(dag||"").trim();',
  '  const tijdvak=String(vak||"").trim();',
  '  const dagInZin=dagNaam?dagNaam.charAt(0).toLowerCase()+dagNaam.slice(1):"eerder";',
  '  if(String(pg.t)>String(nu||"")){',
  '    if(/^Vandaag$/i.test(dagNaam))return `Later vandaag kunnen rond ${tijdvak} windstoten tot ${waarde} km/u voorkomen.`;',
  '    if(/^Morgen$/i.test(dagNaam))return `Morgen kunnen rond ${tijdvak} windstoten tot ${waarde} km/u voorkomen.`;',
  '    return `${dagNaam||"Later"} kunnen rond ${tijdvak} windstoten tot ${waarde} km/u voorkomen.`;',
  '  }',
  '  if(/^Vandaag$/i.test(dagNaam))return `Volgens de verwachting kwam de sterkste windstoot vandaag rond ${tijdvak} uit op ${waarde} km/u.`;',
  '  if(/^Gisteren$/i.test(dagNaam))return `Volgens de verwachting kwam de sterkste windstoot gisteren rond ${tijdvak} uit op ${waarde} km/u.`;',
  '  return `Volgens de verwachting kwam de sterkste windstoot ${dagInZin} rond ${tijdvak} uit op ${waarde} km/u.`;',
  '}'
].join("\n");
vervangExact(WIND_OUD,WIND_NIEUW,"windstoot-microcopy");

/* Luchtdruk: alleen de twee veranderingszinnen waren telegramstijl. De bestaande
   'Vrijwel stabiel.' blijft bewust intact: die is compact, natuurlijk en wordt
   al door browserregressies als juiste weergave van een minieme verandering
   bewaakt. */
const DRUK_OUD=[
  '  zetTekst("pressub", dp==null ? "Geen tendens beschikbaar."',
  '    : Math.abs(dp)<1 ? "Vrijwel stabiel."',
  '    : Math.abs(dp)<2 ? "Licht "+(dp>0?"gestegen":"gedaald")+" in de afgelopen drie uur."',
  '    : "In de afgelopen drie uur "+nl(Math.abs(dp))+" hPa "+(dp>0?"gestegen":"gedaald")+".");'
].join("\n");
const DRUK_NIEUW=[
  '  zetTekst("pressub", dp==null ? "Geen tendens beschikbaar."',
  '    : Math.abs(dp)<1 ? "Vrijwel stabiel."',
  '    : Math.abs(dp)<2 ? "De luchtdruk is in de afgelopen drie uur licht "+(dp>0?"gestegen":"gedaald")+"."',
  '    : "De luchtdruk is in de afgelopen drie uur "+nl(Math.abs(dp))+" hPa "+(dp>0?"gestegen":"gedaald")+".");'
].join("\n");
vervangExact(DRUK_OUD,DRUK_NIEUW,"luchtdruktendens");

/* Zonuren: de waarde zelf staat al erboven. Maak de toelichting een normale zin
   en vermijd woorden als 'regelmatig' wanneer alleen de totale zonneduur bekend
   is; die zouden een verdeling over de dag suggereren die de tegel niet berekent. */
vervangAlles("Weinig zon vandaag","Vandaag is er weinig zon.","zonuren weinig");
vervangAlles("Een aantal zonuren vandaag","Vandaag zijn er enkele uren zon.","zonuren enkele uren");
vervangAlles("Vandaag redelijk wat zon","Vandaag is er veel zon.","zonuren veel");
vervangAlles("Veel zon vandaag","Vandaag is er veel zon.","zonuren veel alternatief",{vereist:false});
vervangAlles("Regelmatig zon vandaag","Vandaag zijn er meerdere uren zon.","zonuren regelmatig",{vereist:false});
vervangAlles("Af en toe zon vandaag","Vandaag zijn er enkele uren zon.","zonuren af en toe",{vereist:false});
vervangAlles("Bijna de hele dag zon","De zon schijnt bijna de hele dag.","zonuren bijna hele dag",{vereist:false});

/* Nachtzicht: maak afkortingen en kale astronomische labels leesbaar zonder de
   berekening, horizon of score te wijzigen. Een dubbelepunt werkt hier als
   compacte verklaring en voorkomt de lange 'door ...'-constructie. */
vervangAlles("Gem. zicht ","Gemiddeld zicht: ","nachtzicht afkorting");
vervangAlles("Geen gunstig kijkvenster door ","Geen gunstig kijkvenster: ","nachtzicht reden");
vervangAlles('e.type==="op"?"maan op "+naarLokaal(e.ms):"maan onder "+naarLokaal(e.ms)',
  'e.type==="op"?"de maan komt op om "+naarLokaal(e.ms):"de maan gaat onder om "+naarLokaal(e.ms)',
  "maanmomenten senior renderer");
vervangAlles('?"maan blijft boven de horizon":"maan blijft onder de horizon"',
  '?"de maan blijft boven de horizon":"de maan blijft onder de horizon"',
  "maan hele nacht");

const MAAN_BASIS_OUD=[
  '    if(mt.op!=null&&mt.onder!=null) maanTekst="maan op "+naarLokaal(mt.op)+" \\u00b7 onder "+naarLokaal(mt.onder);',
  '    else if(mt.op!=null) maanTekst="maan op "+naarLokaal(mt.op);',
  '    else if(mt.onder!=null) maanTekst="maan onder "+naarLokaal(mt.onder);'
].join("\n");
const MAAN_BASIS_NIEUW=[
  '    if(mt.op!=null&&mt.onder!=null) maanTekst="de maan komt op om "+naarLokaal(mt.op)+" \\u00b7 gaat onder om "+naarLokaal(mt.onder);',
  '    else if(mt.op!=null) maanTekst="de maan komt op om "+naarLokaal(mt.op);',
  '    else if(mt.onder!=null) maanTekst="de maan gaat onder om "+naarLokaal(mt.onder);'
].join("\n");
vervangExact(MAAN_BASIS_OUD,MAAN_BASIS_NIEUW,"maanmomenten basisrenderer");

vervangAlles('return (relatief?"Relatief gunstigste modeluren ":"Beste modeluren ")+start+"–"+werkelijkEind;',
  'return (relatief?"Relatief beste periode: ":"Beste periode: ")+start+"–"+werkelijkEind;',
  "nachtzicht modeluren");

/* De marker staat buiten de runtime en bewijst uitsluitend dat deze laatste
   taalnormalisatie het artifact heeft geraakt. */
if((html.match(/<\/body>/g)||[]).length!==1)throw new Error("Exact één </body> vereist voor microcopy-marker.");
html=html.replace("</body>",MARK+"\n</body>");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden na microcopy-normalisatie.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:nederlandse-microcopy-"+(i+1)}));

fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"nederlandse-microcopy");
console.log("Nederlandse microcopy toegepast: grammatica, windstoten, luchtdruk, zonuren en Nachtzicht genormaliseerd; cache "+versie+".");

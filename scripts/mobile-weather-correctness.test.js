"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const css=fs.readFileSync(path.join(__dirname,"mobile-screenshot-polish.css"),"utf8");
const bron=fs.readFileSync(path.join(root,"index.html"),"utf8");
const q4=fs.readFileSync(path.join(__dirname,"q4-rain-runtime.js"),"utf8");

/* De mobiele grafieken moeten intrinsiek binnen de contentkolom vallen. Dit is
   bewust geen overflow:hidden-pleister: de te brede SVG krijgt zelf 100% breedte. */
assert(/@media\(max-width:900px\)[\s\S]*?#chart,#nc\{width:100%;max-width:100%;margin-left:0\}/.test(css),
  "mobiele SVG's hebben een intrinsiek viewport-veilige breedte");
assert(/\.dagmod,\.dashcol\{min-width:0;max-width:100%\}/.test(css),
  "grafiekowners mogen binnen hun grid/flexcontainer daadwerkelijk krimpen");

/* De bronberekening van Nachtzicht weegt niet alleen de maanfase, maar ook of en
   hoe hoog de maan werkelijk boven de horizon staat. Houd dit als contract vast;
   een UI-polish mag die inhoudelijke koppeling niet stil verwijderen. */
assert(bron.includes("const maanWeging=maanH.map(h2=>h2<=0?0:Math.min(1,Math.sin(h2*Math.PI/180)/Math.sin(45*Math.PI/180)));"),
  "Nachtzicht gebruikt maanhoogte als effectieve lichtweging");
assert(bron.includes("sc-=2.2*mn.ill*maanDeel*(1-cw/140);"),
  "Nachtzicht-score bevat een expliciete maanlichtstraf");
assert(bron.includes("const goed = C[i]<35 && (maanWeging[i]*mn.ill < 0.2);"),
  "beste kijkvenster vereist weinig effectief maanlicht naast lage bewolking");

const maanWeging=hoogte=>hoogte<=0?0:Math.min(1,Math.sin(hoogte*Math.PI/180)/Math.sin(45*Math.PI/180));
const kijkuurGoed=(bewolking,verlicht,hoogte)=>bewolking<35&&maanWeging(hoogte)*verlicht<0.2;
const maanStraf=(verlicht,hoogtes,bewolking)=>{
  const deel=hoogtes.map(maanWeging).reduce((a,b)=>a+b,0)/hoogtes.length;
  return 2.2*verlicht*deel*(1-bewolking/140);
};

assert.equal(kijkuurGoed(5,1,45),false,"volle maan hoog aan de hemel blokkeert een verder helder kijkuur");
assert.equal(kijkuurGoed(5,0.82,30),false,"82% verlichte maan op 30° blijft inhoudelijk relevant");
assert.equal(kijkuurGoed(5,0.82,-1),true,"na maanondergang vervalt de maanlichtbelemmering");
assert.equal(kijkuurGoed(70,0,-10),false,"zware bewolking blijft ongunstig zonder maanlicht");
assert(maanStraf(1,[45,45,45],5)>maanStraf(0,[45,45,45],5),"volle maan verlaagt de score meer dan nieuwe maan");
assert.equal(maanStraf(1,[-5,-10,-20],5),0,"maan onder de horizon geeft geen kunstmatige scorestraf");

/* De huidige formule laat een zeer laag staande heldere maan bewust geleidelijk
   minder zwaar wegen. Daardoor kan een beste venster kort vóór de geometrische
   maanondergang beginnen; dat is modelgedrag en geen tijdzonefout. */
assert.equal(kijkuurGoed(5,0.82,5),true,"een zeer lage 82%-maan kan onder de effectieve lichtdrempel vallen");

/* Mobiele Q4-presentatie houdt de volledige informatie, maar niet langer in twee
   gestapelde labelrijen. Desktop behoudt de rijkere split-layout. */
assert(q4.includes("function q4MobielePeriodeLabels(g,perioden,y,font)"),"Q4 heeft een expliciete mobiele labelowner");
assert(q4.includes('tijdKort(van)+"–"+tijdKort(tot)+" · "+q4Mm(p.som)+" mm"'),"mobiel combineert klokrange en hoeveelheid");
assert(q4.includes('data-q4-rain-period-mobile'),"mobiele regenlabels zijn regressie-testbaar herkenbaar");
assert(q4.includes('if(g.M){\n    mobiel.labels.forEach'),"mobiel rendert slechts de gecombineerde labelset");
assert(q4.includes('horizontaal.setAttribute("aria-label",q4PeriodeTijdvak(g,p)+" · "+q4Mm(p.som)+" mm")'),
  "volledige tijdvak en hoeveelheid blijven toegankelijk op iedere bracket");

console.log("Mobiele correctheidsregressie groen: intrinsieke breedte, compacte regenlabels en Nachtzicht-maanbeleid geborgd.");

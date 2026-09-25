"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-kleur-20260925";
const OWNER_ID="wiw-typografie-20260925";

/* Kleur met één betekenis per kleur. De pagina is neutraal (inkt); blauw is
   neerslag, amber/oranje/rood zijn waarschuwingsniveaus en karmijn is "nu" of
   "let op" (nu-lijn, code rood, foutmelding, verouderde gegevens).
   Karmijn werd daarnaast gebruikt voor een keuze en voor een slechte waarde:
   - de gekozen dag in de weeklijst kreeg een karmijnen streep: een selectie is
     geen signaal, dus het streepje wordt inkt;
   - luchtkwaliteit "slecht" en pollen "hoog" kregen een karmijnen getal. Het
     oordeel staat er als woord onder; het getal wordt inkt en iets zwaarder,
     zodat het opvalt zonder een tweede betekenis aan karmijn te geven.
   De classificatie zelf (kleur:"carmine" als ernstniveau) blijft ongewijzigd;
   deze laag verandert alleen de weergave. */
const CSS=`
html body #days .day.on::before,html body #days .row.day.on::before{background:var(--ink)!important}
html body #aq .sval[style*="--carmine"]{color:var(--ink)!important;font-weight:600!important}
`;

function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": kleurlaag staat al in artifact.");
  if(!html.includes("</head>"))throw new Error(rel+": headafsluiting ontbreekt.");
  return html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8");
    if(!html.includes(`id="${OWNER_ID}"`))continue;
    fs.writeFileSync(p,pasToe(html,path.relative(OUT,p)),"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door kleurlaag.");
  const cache=vernieuwServiceworkerCache(OUT,"kleur-20260925");
  console.log("Kleurlaag toegepast op "+geraakt+" weerartifacts: selectie en slechte waarden in inkt, karmijn alleen voor nu en let op; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CSS,htmlBestanden,pasToe,main};

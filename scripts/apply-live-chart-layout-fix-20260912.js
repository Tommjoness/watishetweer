"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER_LABEL="LIVE CHART LABEL FIX 20260912";
const MARKER_RAIN="LIVE Q4 CHART COMPACTION 20260912";

/* Deze runtimepatch moet vóór platform-output-cleanup draaien: daarna is de
   hoofdclient uit de HTML gehaald en in de gedeelde/minified app-bundle gezet.
   We matchen bewust op de semantische codevorm en niet op whitespace, maar
   eisen per weerartifact exact één match. */
const LABEL_RE=/if\s*\(nuX\s*!=\s*null\)\s*\{\s*for\s*\(const\s*\[idx\]\s*of\s*\[\.\.\.kandKaart\.entries\(\)\]\)\s*\{\s*if\s*\(Math\.abs\(x\(idx\)\s*-\s*nuX\)\s*<\s*cw\s*\*\s*1\.05\)\s*kandKaart\.delete\(idx\);\s*\}\s*\}/g;
const LABEL_NIEUW=`/* ${MARKER_LABEL} */
  if(nuX!=null&&kandKaart.size){
    let dichtst=null,afstand=Infinity;
    for(const [idx] of kandKaart.entries()){
      const d=Math.abs(x(idx)-nuX);
      if(d<afstand){afstand=d;dichtst=idx;}
    }
    /* Alleen het modelpunt dat werkelijk met de rode nu-positie samenvalt is
       redundant. Het aangrenzende toekomstige uur blijft forecastinformatie. */
    if(dichtst!==null&&afstand<cw*.6) kandKaart.delete(dichtst);
  }`;

const REGEN_RE=/const\s+pb\s*=\s*g\.pt\s*\+\s*g\.ih\s*,\s*y\s*=\s*pb\s*\+\s*48\s*,\s*randFont\s*=\s*g\.M\s*\?\s*8\.3\s*:\s*8\.9\s*,\s*bedragFont\s*=\s*g\.M\s*\?\s*8\.8\s*:\s*9\.4\s*;/g;
const REGEN_NIEUW=`/* ${MARKER_RAIN} */
  const pb=g.pt+g.ih;
  const compactDesktop=typeof window!=="undefined"&&window.innerWidth>=1100&&!g.M&&g.n<=25;
  const y=pb+(compactDesktop?30:48),randFont=g.M?8.3:8.9,bedragFont=g.M?8.8:9.4;`;

const HOOGTE_RE=/const\s+nieuwH\s*=\s*Math\.max\(basisH\s*,\s*laatsteBedragY\s*\+\s*17\s*\+\s*8\s*\)\s*;/g;
const HOOGTE_NIEUW='const nieuwH=Math.max(basisH,laatsteBedragY+(compactDesktop?14:25));';

function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function vervangRegexExactEen(bron,re,nieuw,label,rel){
  re.lastIndex=0;
  const hits=[...bron.matchAll(re)];
  if(hits.length!==1)throw new Error(rel+": "+label+" ontbreekt of is dubbel: "+hits.length);
  re.lastIndex=0;
  return bron.replace(re,nieuw);
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    let html=fs.readFileSync(p,"utf8");
    if(!html.includes('id="chart"')||!html.includes('data-q4-rain-periods'))continue;
    const rel=path.relative(OUT,p);
    if(html.includes(MARKER_LABEL)||html.includes(MARKER_RAIN))throw new Error(rel+": live chart/layout-fix staat al in artifact.");
    html=vervangRegexExactEen(html,LABEL_RE,LABEL_NIEUW,"nu/modeluur-labelsuppressie",rel);
    html=vervangRegexExactEen(html,REGEN_RE,REGEN_NIEUW,"Q4 desktop regenoffset",rel);
    html=vervangRegexExactEen(html,HOOGTE_RE,HOOGTE_NIEUW,"Q4 desktop grafiekhoogte",rel);
    fs.writeFileSync(p,html,"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door live chart/layout-fix.");
  const cache=vernieuwServiceworkerCache(OUT,"live-chart-layout-fix-20260912");
  console.log("Live chart/layout-fix vóór delivery-cleanup toegepast op "+geraakt+" weerartifacts; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,MARKER_LABEL,MARKER_RAIN,LABEL_RE,LABEL_NIEUW,REGEN_RE,REGEN_NIEUW,HOOGTE_RE,HOOGTE_NIEUW,htmlBestanden,vervangRegexExactEen,main};

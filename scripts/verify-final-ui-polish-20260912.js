"use strict";

const fs=require("fs");
const path=require("path");
const {
  OUT,STYLE_ID,POLLEN_OUD,POLLEN_NIEUW,CSS,htmlBestanden
}=require("./apply-final-ui-polish-20260912.js");

function tel(bron,zoek){return bron.split(zoek).length-1;}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8");
    if(!html.includes(POLLEN_NIEUW)&&!html.includes(`id="${STYLE_ID}"`))continue;
    const rel=path.relative(OUT,p);
    if(tel(html,POLLEN_NIEUW)!==1)throw new Error(rel+": nieuwe pollentoelichting niet exact één keer aanwezig.");
    if(html.includes(POLLEN_OUD))throw new Error(rel+": oude pollentoelichting is nog aanwezig.");
    if(tel(html,`id="${STYLE_ID}"`)!==1)throw new Error(rel+": finale UI-polish niet exact één keer aanwezig.");

    const vereisten=[
      "#aq{",
      "padding-inline:18px",
      "#chart g[data-q4-rain-periods]",
      "transform:translateY(-6px)",
      "@media(min-width:1100px)",
      "body > .sheet{border-bottom-color:var(--rule-soft)}",
      "body > .seo-plaatsnav{margin-top:18px!important}",
      "footer .footer-details>summary{",
      "box-shadow:inset 0 -1px 0 var(--rule)",
      "footer > .bron:nth-of-type(2){",
      "flex-basis:100%",
      "justify-content:center",
      "#aq.aq-cols-3 .stat:nth-child(3n)",
      "body > .seo-plaatsnav{margin-top:14px!important}"
    ];
    for(const fragment of vereisten){
      if(!html.includes(fragment))throw new Error(rel+": UI-contract ontbreekt: "+fragment);
    }
    if(html.includes("margin-bottom:-6px!important"))throw new Error(rel+": afgekeurde negatieve grafiekmarge staat nog in artifact.");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen finale UI-polish-artifacts gevonden.");
  if(!CSS.includes("#aq")||!CSS.includes("#chart g[data-q4-rain-periods]")||!CSS.includes("transform:translateY(-6px)"))throw new Error("CSS-export wijkt af van verifiercontract.");
  if(!CSS.includes("footer .footer-details>summary")||!CSS.includes("footer > .bron:nth-of-type(2)"))throw new Error("CSS-export mist footerhulprijcontract.");
  if(CSS.includes("margin-bottom:-6px!important"))throw new Error("CSS-export bevat nog de afgekeurde negatieve grafiekmarge.");
  console.log("Finale UI-polish geverifieerd op "+geraakt+" weerartifacts; footerhulplinks staan als compacte desktoprij met onderstreepte technische details, grafiekbox blijft onaangeroerd.");
  return {geraakt};
}

if(require.main===module)main();
module.exports={main,tel};

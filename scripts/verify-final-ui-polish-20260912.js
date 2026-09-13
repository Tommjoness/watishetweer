"use strict";

const fs=require("fs");
const path=require("path");
const {
  OUT,STYLE_ID,POLLEN_OUD,POLLEN_NIEUW,FOOTER_DISCLAIMER,
  FOOTER_DISCLAIMER_CLASS,FOOTER_UTILITY_CLASS,CSS,htmlBestanden
}=require("./apply-final-ui-polish-20260912.js");

function tel(bron,zoek){return bron.split(zoek).length-1;}

function main(){
  let geraakt=0,gestructureerd=0;
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
      `footer > .${FOOTER_DISCLAIMER_CLASS}{`,
      `footer > .${FOOTER_UTILITY_CLASS}{`,
      "flex-wrap:wrap",
      "display:flex!important",
      "flex-direction:column!important",
      `footer > .${FOOTER_UTILITY_CLASS}{justify-content:center}`,
      "#aq.aq-cols-3 .stat:nth-child(3n)",
      "body > .seo-plaatsnav{margin-top:14px!important}"
    ];
    for(const fragment of vereisten){
      if(!html.includes(fragment))throw new Error(rel+": UI-contract ontbreekt: "+fragment);
    }
    if(html.includes("grid-template-columns:max-content max-content max-content"))throw new Error(rel+": verouderde footer-gridlayout staat nog in artifact.");
    if(html.includes("margin-bottom:-6px!important"))throw new Error(rel+": afgekeurde negatieve grafiekmarge staat nog in artifact.");

    if(html.includes('href="/over/">Over deze site</a>')){
      if(tel(html,`class="${FOOTER_DISCLAIMER_CLASS}"`)!==1)throw new Error(rel+": disclaimer heeft geen exact één eigen footerblokrij.");
      if(tel(html,`class="${FOOTER_UTILITY_CLASS}"`)!==1)throw new Error(rel+": utility-links hebben geen exact één eigen footerblokrij.");
      const disclaimerNode=`<div class="${FOOTER_DISCLAIMER_CLASS}"><span class="bron">${FOOTER_DISCLAIMER}</span></div>`;
      if(!html.includes(disclaimerNode))throw new Error(rel+": disclaimertekst is gewijzigd of niet volledig in de eigen rij opgenomen.");
      const utilityStart=html.indexOf(`<div class="${FOOTER_UTILITY_CLASS}">`),utilityEnd=html.indexOf("</div>",utilityStart);
      if(utilityStart<0||utilityEnd<0)throw new Error(rel+": utilityblok kan niet eenduidig worden gelezen.");
      const utility=html.slice(utilityStart,utilityEnd);
      if(!utility.includes('href="/over/">Over deze site</a>'))throw new Error(rel+": utilityblok mist Over deze site.");
      if(!/href="\/privacy(?:\.html)?">Privacy &amp; gegevens<\/a>/.test(utility))throw new Error(rel+": utilityblok mist Privacy & gegevens.");
      if(!utility.includes("<summary>Technische locatiegegevens</summary>"))throw new Error(rel+": utilityblok mist Technische locatiegegevens.");
      if(html.includes("watishetweer.nl · Over deze site"))throw new Error(rel+": oude samengestelde Over-link staat nog in footerartifact.");
      gestructureerd++;
    }
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen finale UI-polish-artifacts gevonden.");
  if(!gestructureerd)throw new Error("Geen artifact met structureel gescheiden footer-disclaimer en utilityrij gevonden.");
  if(!CSS.includes("#aq")||!CSS.includes("#chart g[data-q4-rain-periods]")||!CSS.includes("transform:translateY(-6px)"))throw new Error("CSS-export wijkt af van verifiercontract.");
  if(!CSS.includes(`footer > .${FOOTER_DISCLAIMER_CLASS}`)||!CSS.includes(`footer > .${FOOTER_UTILITY_CLASS}`)||!CSS.includes("flex-wrap:wrap")||!CSS.includes("flex-direction:column!important"))throw new Error("CSS-export mist structureel footer-rijcontract.");
  if(CSS.includes("grid-template-columns:max-content max-content max-content"))throw new Error("CSS-export bevat nog de verouderde footer-gridlayout.");
  if(CSS.includes("margin-bottom:-6px!important"))throw new Error("CSS-export bevat nog de afgekeurde negatieve grafiekmarge.");
  console.log(`Finale UI-polish geverifieerd op ${geraakt} weerartifacts; ${gestructureerd} footers hebben aparte disclaimer- en utilityblokrijen met behoud van bestaande linkstijlen.`);
  return {geraakt,gestructureerd};
}

if(require.main===module)main();
module.exports={main,tel};

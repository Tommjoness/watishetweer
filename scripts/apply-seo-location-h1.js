"use strict";

const fs=require("fs");
const path=require("path");
const {LOCATIES}=require("./seo-locations.config.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const GENERIEKE_H1="<h1>Wat is het weer?</h1>";
const ROUTE_EXIT_HAAK='        const context=document.querySelector(".seo-route-context");\n        if(context)context.hidden=true;';
const H1_RESET='        const hoofdkop=document.querySelector(".mast h1");\n        if(hoofdkop)hoofdkop.textContent="Wat is het weer?";';
const NAV_ARIA_OUD='aria-label="Weer per plaats"';
const NAV_ARIA_NIEUW='aria-label="Populaire plaatsen in Nederland"';
const NAV_KOP_OUD='<div class="seo-plaatsnav-kop">Weer per plaats</div>';
const NAV_KOP_NIEUW='<div class="seo-plaatsnav-kop">Populaire plaatsen in Nederland</div>';
const NAV_TEKST_OUD='<p>Bekijk direct het actuele weer en de verwachting voor veelgekozen plaatsen.</p>';
const NAV_TEKST_NIEUW='<p>Bekijk direct het actuele weer en de verwachting voor populaire plaatsen in Nederland.</p>';
const tel=(tekst,zoek)=>String(tekst).split(zoek).length-1;
const escHtml=v=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function plaatsH1(loc){return `<h1>Weer in ${escHtml(loc.naam)} vandaag</h1>`;}

function pasPlaatsNavLabelToe(html,label){
  let bron=String(html||"");
  for(const [oud,nieuw,naam] of [
    [NAV_ARIA_OUD,NAV_ARIA_NIEUW,"aria-label"],
    [NAV_KOP_OUD,NAV_KOP_NIEUW,"kop"],
    [NAV_TEKST_OUD,NAV_TEKST_NIEUW,"uitleg"]
  ]){
    if(tel(bron,oud)!==1)throw new Error(`${label}: plaatsnav-${naam} ontbreekt of is dubbel.`);
    bron=bron.replace(oud,nieuw);
  }
  return bron;
}

function pasPlaatsH1Toe(html,loc){
  let bron=String(html||"");
  const verwacht=plaatsH1(loc);
  const h1Aantal=(bron.match(/<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/g)||[]).length;
  if(h1Aantal!==1)throw new Error(`${loc.slug}: verwacht exact één H1, gevonden ${h1Aantal}.`);
  if(!bron.includes(verwacht)){
    if(tel(bron,GENERIEKE_H1)!==1)throw new Error(`${loc.slug}: generieke H1 ontbreekt of is dubbel.`);
    bron=bron.replace(GENERIEKE_H1,verwacht);
  }
  if(tel(bron,verwacht)!==1||bron.includes(GENERIEKE_H1))throw new Error(`${loc.slug}: plaats-H1 kon niet eenduidig worden toegepast.`);

  if(!bron.includes(H1_RESET)){
    if(tel(bron,ROUTE_EXIT_HAAK)!==1)throw new Error(`${loc.slug}: route-exit-haak voor H1-reset ontbreekt of is dubbel.`);
    bron=bron.replace(ROUTE_EXIT_HAAK,`${ROUTE_EXIT_HAAK}\n${H1_RESET}`);
  }
  if(tel(bron,H1_RESET)!==1)throw new Error(`${loc.slug}: H1-reset na route-exit ontbreekt of is dubbel.`);
  return bron;
}

function main(){
  const rootPad=path.join(OUT,"index.html");
  if(!fs.existsSync(rootPad))throw new Error("public/index.html ontbreekt vóór plaats-H1-stap.");
  let root=fs.readFileSync(rootPad,"utf8");
  if(tel(root,GENERIEKE_H1)!==1)throw new Error("Homepage-H1 moet exact 'Wat is het weer?' blijven.");
  if(root.includes(H1_RESET))throw new Error("Homepage mag geen routegebonden H1-reset bevatten.");
  root=pasPlaatsNavLabelToe(root,"homepage");
  fs.writeFileSync(rootPad,root,"utf8");

  for(const loc of LOCATIES){
    const pad=path.join(OUT,"weer",loc.slug,"index.html");
    if(!fs.existsSync(pad))throw new Error(`${loc.slug}: plaatsroute ontbreekt vóór H1-stap.`);
    let aangepast=pasPlaatsH1Toe(fs.readFileSync(pad,"utf8"),loc);
    aangepast=pasPlaatsNavLabelToe(aangepast,loc.slug);
    fs.writeFileSync(pad,aangepast,"utf8");
    if(tel(aangepast,plaatsH1(loc))!==1||tel(aangepast,H1_RESET)!==1)throw new Error(`${loc.slug}: plaats-H1 of route-exit-reset ontbreekt na schrijven.`);
  }

  const rootNa=fs.readFileSync(rootPad,"utf8");
  if(tel(rootNa,GENERIEKE_H1)!==1)throw new Error("Plaats-H1-stap mag de homepage-H1 niet wijzigen.");
  if(tel(rootNa,NAV_KOP_NIEUW)!==1)throw new Error("Homepage mist het contextuele Nederlandse plaatsnavlabel.");
  const versie=vernieuwServiceworkerCache(OUT,"seo-location-h1");
  console.log(`SEO-plaats-H1 en plaatsnav toegepast voor ${LOCATIES.length} routes; homepage, route-exit en Nederlandse navigatiecontext correct; cache ${versie}.`);
}

if(require.main===module)main();
module.exports={
  GENERIEKE_H1,ROUTE_EXIT_HAAK,H1_RESET,plaatsH1,pasPlaatsH1Toe,pasPlaatsNavLabelToe,
  NAV_ARIA_OUD,NAV_ARIA_NIEUW,NAV_KOP_OUD,NAV_KOP_NIEUW,NAV_TEKST_OUD,NAV_TEKST_NIEUW
};
"use strict";

const fs=require("fs");
const path=require("path");
const {LOCATIES}=require("./seo-locations.config.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MERK_H1="<h1>watishetweer.nl</h1>";
const ROUTE_EXIT_HAAK='        const context=document.querySelector(".seo-route-context");\n        if(context)context.hidden=true;';
const H1_RESET='        const hoofdkop=document.querySelector(".mast h1");\n        if(hoofdkop)hoofdkop.textContent="watishetweer.nl";';
const TITLE_OUD='document.title=S.label+" · Wat is het weer?";';
const TITLE_NIEUW='document.title=S.label+" · watishetweer.nl";';
const TITLE_WRITERS=2;
const HUB_TITLE_OUD="Weer per plaats in Nederland | Wat is het weer?";
const HUB_TITLE_NIEUW="Weer per plaats in Nederland | watishetweer.nl";
const HUB_BRAND_OUD='<a class="brand" href="/">Wat is het weer?</a>';
const HUB_BRAND_NIEUW='<a class="brand" href="/">watishetweer.nl</a>';
const NAV_ARIA_OUD='aria-label="Weer per plaats"';
const NAV_ARIA_NIEUW='aria-label="Populaire plaatsen in Nederland"';
const NAV_KOP_OUD='<div class="seo-plaatsnav-kop">Weer per plaats</div>';
const NAV_KOP_NIEUW='<div class="seo-plaatsnav-kop">Populaire plaatsen in Nederland</div>';
const NAV_TEKST_OUD='<p>Bekijk direct het actuele weer en de verwachting voor veelgekozen plaatsen.</p>';
const NAV_TEKST_NIEUW='<p>Bekijk direct het actuele weer en de verwachting voor populaire plaatsen in Nederland.</p>';
const tel=(tekst,zoek)=>String(tekst).split(zoek).length-1;
const escHtml=v=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function plaatsH1(loc){return `<h1>Weer in ${escHtml(loc.naam)} vandaag</h1>`;}

function pasMerkTitelToe(html,label){
  let bron=String(html||"");
  const aantal=tel(bron,TITLE_OUD);
  if(aantal!==TITLE_WRITERS)throw new Error(`${label}: verwacht exact ${TITLE_WRITERS} oude dynamische title-writers, gevonden ${aantal}.`);
  bron=bron.split(TITLE_OUD).join(TITLE_NIEUW);
  if(tel(bron,TITLE_NIEUW)!==TITLE_WRITERS||bron.includes(TITLE_OUD))throw new Error(`${label}: dynamische title-writers zijn niet eenduidig merkgebonden.`);
  return bron;
}

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
    if(tel(bron,MERK_H1)!==1)throw new Error(`${loc.slug}: merk-H1 ontbreekt of is dubbel.`);
    bron=bron.replace(MERK_H1,verwacht);
  }
  if(tel(bron,verwacht)!==1||bron.includes(MERK_H1))throw new Error(`${loc.slug}: plaats-H1 kon niet eenduidig worden toegepast.`);

  if(!bron.includes(H1_RESET)){
    if(tel(bron,ROUTE_EXIT_HAAK)!==1)throw new Error(`${loc.slug}: route-exit-haak voor H1-reset ontbreekt of is dubbel.`);
    bron=bron.replace(ROUTE_EXIT_HAAK,`${ROUTE_EXIT_HAAK}\n${H1_RESET}`);
  }
  if(tel(bron,H1_RESET)!==1)throw new Error(`${loc.slug}: H1-reset na route-exit ontbreekt of is dubbel.`);
  return bron;
}

function pasHubMerkToe(html){
  let bron=String(html||"");
  if(tel(bron,HUB_TITLE_OUD)!==2)throw new Error("Plaatsindex verwacht de oude hubtitel exact in title en og:title.");
  if(tel(bron,HUB_BRAND_OUD)!==1)throw new Error("Plaatsindex mist de oude zichtbare merklink.");
  bron=bron.split(HUB_TITLE_OUD).join(HUB_TITLE_NIEUW).replace(HUB_BRAND_OUD,HUB_BRAND_NIEUW);
  if(tel(bron,HUB_TITLE_NIEUW)!==2||tel(bron,HUB_BRAND_NIEUW)!==1)throw new Error("Plaatsindex kon niet eenduidig aan watishetweer.nl worden gekoppeld.");
  return bron;
}

function main(){
  const rootPad=path.join(OUT,"index.html");
  if(!fs.existsSync(rootPad))throw new Error("public/index.html ontbreekt vóór plaats-H1-stap.");
  let root=fs.readFileSync(rootPad,"utf8");
  if(tel(root,MERK_H1)!==1)throw new Error("Homepage-H1 moet exact 'watishetweer.nl' zijn.");
  if(root.includes(H1_RESET))throw new Error("Homepage mag geen routegebonden H1-reset bevatten.");
  root=pasMerkTitelToe(root,"homepage");
  root=pasPlaatsNavLabelToe(root,"homepage");
  fs.writeFileSync(rootPad,root,"utf8");

  const hubPad=path.join(OUT,"weer","index.html");
  if(!fs.existsSync(hubPad))throw new Error("Plaatsindex ontbreekt vóór merkstap.");
  const hub=pasHubMerkToe(fs.readFileSync(hubPad,"utf8"));
  fs.writeFileSync(hubPad,hub,"utf8");

  for(const loc of LOCATIES){
    const pad=path.join(OUT,"weer",loc.slug,"index.html");
    if(!fs.existsSync(pad))throw new Error(`${loc.slug}: plaatsroute ontbreekt vóór H1-stap.`);
    let aangepast=pasPlaatsH1Toe(fs.readFileSync(pad,"utf8"),loc);
    aangepast=pasMerkTitelToe(aangepast,loc.slug);
    aangepast=pasPlaatsNavLabelToe(aangepast,loc.slug);
    fs.writeFileSync(pad,aangepast,"utf8");
    if(tel(aangepast,plaatsH1(loc))!==1||tel(aangepast,H1_RESET)!==1||tel(aangepast,TITLE_NIEUW)!==TITLE_WRITERS)throw new Error(`${loc.slug}: plaats-H1, route-exit-reset of merktitel ontbreekt na schrijven.`);
  }

  const rootNa=fs.readFileSync(rootPad,"utf8");
  if(tel(rootNa,MERK_H1)!==1)throw new Error("Plaats-H1-stap mag de homepage-merk-H1 niet wijzigen.");
  if(tel(rootNa,NAV_KOP_NIEUW)!==1)throw new Error("Homepage mist het contextuele Nederlandse plaatsnavlabel.");
  if(tel(rootNa,TITLE_NIEUW)!==TITLE_WRITERS)throw new Error("Homepage mist merkgebonden dynamische titels.");
  const versie=vernieuwServiceworkerCache(OUT,"seo-location-h1");
  console.log(`SEO-plaats-H1 en merkpresentatie toegepast voor ${LOCATIES.length} routes; homepage, dynamische titels, hub, route-exit en Nederlandse navigatiecontext correct; cache ${versie}.`);
}

if(require.main===module)main();
module.exports={
  MERK_H1,ROUTE_EXIT_HAAK,H1_RESET,TITLE_OUD,TITLE_NIEUW,TITLE_WRITERS,HUB_TITLE_OUD,HUB_TITLE_NIEUW,HUB_BRAND_OUD,HUB_BRAND_NIEUW,
  plaatsH1,pasPlaatsH1Toe,pasMerkTitelToe,pasHubMerkToe,pasPlaatsNavLabelToe,
  NAV_ARIA_OUD,NAV_ARIA_NIEUW,NAV_KOP_OUD,NAV_KOP_NIEUW,NAV_TEKST_OUD,NAV_TEKST_NIEUW
};

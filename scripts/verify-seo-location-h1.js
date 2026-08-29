"use strict";

const fs=require("fs");
const path=require("path");
const {LOCATIES}=require("./seo-locations.config.js");
const {
  MERK_H1,H1_RESET,TITLE_OUD,TITLE_NIEUW,TITLE_WRITERS,HUB_TITLE_NIEUW,HUB_BRAND_NIEUW,plaatsH1,
  NAV_ARIA_OUD,NAV_ARIA_NIEUW,NAV_KOP_OUD,NAV_KOP_NIEUW,NAV_TEKST_OUD,NAV_TEKST_NIEUW
}=require("./apply-seo-location-h1.js");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const tel=(tekst,zoek)=>String(tekst).split(zoek).length-1;

function controleerNav(html,label){
  if(tel(html,NAV_ARIA_NIEUW)!==1)throw new Error(`${label}: contextueel plaatsnav-aria-label ontbreekt of is dubbel.`);
  if(tel(html,NAV_KOP_NIEUW)!==1)throw new Error(`${label}: 'Populaire plaatsen in Nederland'-kop ontbreekt of is dubbel.`);
  if(tel(html,NAV_TEKST_NIEUW)!==1)throw new Error(`${label}: Nederlandse plaatsnav-uitleg ontbreekt of is dubbel.`);
  if(html.includes(NAV_ARIA_OUD)||html.includes(NAV_KOP_OUD)||html.includes(NAV_TEKST_OUD))
    throw new Error(`${label}: oude contextloze plaatsnavtekst is blijven staan.`);
}

const rootPad=path.join(OUT,"index.html");
if(!fs.existsSync(rootPad))throw new Error("Homepage-artifact ontbreekt voor H1-verificatie.");
const root=fs.readFileSync(rootPad,"utf8");
if(tel(root,MERK_H1)!==1)throw new Error("Homepage moet exact één H1 'watishetweer.nl' behouden.");
if(root.includes(H1_RESET))throw new Error("Homepage bevat ten onrechte routegebonden H1-resetlogica.");
if(tel(root,TITLE_NIEUW)!==TITLE_WRITERS||root.includes(TITLE_OUD))throw new Error("Homepage gebruikt niet uitsluitend merkgebonden dynamische titels.");
controleerNav(root,"homepage");

const hubPad=path.join(OUT,"weer","index.html");
if(!fs.existsSync(hubPad))throw new Error("Plaatsindex ontbreekt voor merkverificatie.");
const hub=fs.readFileSync(hubPad,"utf8");
if(tel(hub,HUB_TITLE_NIEUW)!==2||tel(hub,HUB_BRAND_NIEUW)!==1)throw new Error("Plaatsindex gebruikt niet consequent watishetweer.nl als merknaam.");

for(const loc of LOCATIES){
  const pad=path.join(OUT,"weer",loc.slug,"index.html");
  if(!fs.existsSync(pad))throw new Error(`${loc.slug}: plaatsroute ontbreekt voor H1-verificatie.`);
  const html=fs.readFileSync(pad,"utf8");
  const verwacht=plaatsH1(loc);
  const h1s=html.match(/<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/g)||[];
  if(h1s.length!==1)throw new Error(`${loc.slug}: verwacht exact één H1, gevonden ${h1s.length}.`);
  if(h1s[0]!==verwacht)throw new Error(`${loc.slug}: H1 is niet locatiegericht: ${h1s[0]}`);
  if(html.includes(MERK_H1))throw new Error(`${loc.slug}: homepage-merk-H1 lekt naar de plaatsroute.`);
  if(tel(html,H1_RESET)!==1)throw new Error(`${loc.slug}: H1-reset na verlaten van de statische route ontbreekt of is dubbel.`);
  if(tel(html,TITLE_NIEUW)!==TITLE_WRITERS||html.includes(TITLE_OUD))throw new Error(`${loc.slug}: dynamische titel gebruikt nog de generieke vraag als productnaam.`);
  controleerNav(html,loc.slug);
}

const cache=verifieerServiceworkerCache(OUT,"seo-location-h1-verifier");
console.log(`SEO-plaats-H1 geverifieerd: ${LOCATIES.length} unieke locatiekoppen, vaste homepage-merknaam, merkgebonden dynamische titels, hub, route-exit-reset en Nederlandse plaatsnavigatie; cache ${cache}.`);

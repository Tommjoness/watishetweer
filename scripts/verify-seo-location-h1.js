"use strict";

const fs=require("fs");
const path=require("path");
const {LOCATIES}=require("./seo-locations.config.js");
const {
  GENERIEKE_H1,H1_RESET,plaatsH1,
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
if(tel(root,GENERIEKE_H1)!==1)throw new Error("Homepage moet exact één H1 'Wat is het weer?' behouden.");
if(root.includes(H1_RESET))throw new Error("Homepage bevat ten onrechte routegebonden H1-resetlogica.");
controleerNav(root,"homepage");

for(const loc of LOCATIES){
  const pad=path.join(OUT,"weer",loc.slug,"index.html");
  if(!fs.existsSync(pad))throw new Error(`${loc.slug}: plaatsroute ontbreekt voor H1-verificatie.`);
  const html=fs.readFileSync(pad,"utf8");
  const verwacht=plaatsH1(loc);
  const h1s=html.match(/<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/g)||[];
  if(h1s.length!==1)throw new Error(`${loc.slug}: verwacht exact één H1, gevonden ${h1s.length}.`);
  if(h1s[0]!==verwacht)throw new Error(`${loc.slug}: H1 is niet locatiegericht: ${h1s[0]}`);
  if(html.includes(GENERIEKE_H1))throw new Error(`${loc.slug}: generieke homepage-H1 lekt naar de plaatsroute.`);
  if(tel(html,H1_RESET)!==1)throw new Error(`${loc.slug}: H1-reset na verlaten van de statische route ontbreekt of is dubbel.`);
  controleerNav(html,loc.slug);
}

const cache=verifieerServiceworkerCache(OUT,"seo-location-h1-verifier");
console.log(`SEO-plaats-H1 geverifieerd: ${LOCATIES.length} unieke locatiekoppen, homepagekop behouden, route-exit-reset aanwezig en plaatsnavigatie expliciet als Nederlandse selectie gelabeld; cache ${cache}.`);

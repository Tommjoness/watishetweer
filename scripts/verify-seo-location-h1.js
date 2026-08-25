"use strict";

const fs=require("fs");
const path=require("path");
const {LOCATIES}=require("./seo-locations.config.js");
const {GENERIEKE_H1,H1_RESET,plaatsH1}=require("./apply-seo-location-h1.js");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const tel=(tekst,zoek)=>String(tekst).split(zoek).length-1;

const rootPad=path.join(OUT,"index.html");
if(!fs.existsSync(rootPad))throw new Error("Homepage-artifact ontbreekt voor H1-verificatie.");
const root=fs.readFileSync(rootPad,"utf8");
if(tel(root,GENERIEKE_H1)!==1)throw new Error("Homepage moet exact één H1 'Wat is het weer?' behouden.");
if(root.includes(H1_RESET))throw new Error("Homepage bevat ten onrechte routegebonden H1-resetlogica.");

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
}

const cache=verifieerServiceworkerCache(OUT,"seo-location-h1-verifier");
console.log(`SEO-plaats-H1 geverifieerd: ${LOCATIES.length} unieke locatiekoppen, homepagekop behouden en route-exit-reset aanwezig; cache ${cache}.`);

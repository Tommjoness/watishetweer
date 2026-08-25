"use strict";

const fs=require("fs");
const path=require("path");
const {LOCATIES}=require("./seo-locations.config.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const GENERIEKE_H1="<h1>Wat is het weer?</h1>";
const tel=(tekst,zoek)=>String(tekst).split(zoek).length-1;
const escHtml=v=>String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

function plaatsH1(loc){return `<h1>Weer in ${escHtml(loc.naam)} vandaag</h1>`;}

function pasPlaatsH1Toe(html,loc){
  let bron=String(html||"");
  const verwacht=plaatsH1(loc);
  const h1Aantal=(bron.match(/<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/g)||[]).length;
  if(h1Aantal!==1)throw new Error(`${loc.slug}: verwacht exact één H1, gevonden ${h1Aantal}.`);
  if(bron.includes(verwacht))return bron;
  if(tel(bron,GENERIEKE_H1)!==1)throw new Error(`${loc.slug}: generieke H1 ontbreekt of is dubbel.`);
  bron=bron.replace(GENERIEKE_H1,verwacht);
  if(tel(bron,verwacht)!==1||bron.includes(GENERIEKE_H1))throw new Error(`${loc.slug}: plaats-H1 kon niet eenduidig worden toegepast.`);
  return bron;
}

function main(){
  const rootPad=path.join(OUT,"index.html");
  if(!fs.existsSync(rootPad))throw new Error("public/index.html ontbreekt vóór plaats-H1-stap.");
  const root=fs.readFileSync(rootPad,"utf8");
  if(tel(root,GENERIEKE_H1)!==1)throw new Error("Homepage-H1 moet exact 'Wat is het weer?' blijven.");

  for(const loc of LOCATIES){
    const pad=path.join(OUT,"weer",loc.slug,"index.html");
    if(!fs.existsSync(pad))throw new Error(`${loc.slug}: plaatsroute ontbreekt vóór H1-stap.`);
    const aangepast=pasPlaatsH1Toe(fs.readFileSync(pad,"utf8"),loc);
    fs.writeFileSync(pad,aangepast,"utf8");
    if(tel(aangepast,plaatsH1(loc))!==1)throw new Error(`${loc.slug}: plaats-H1 ontbreekt na schrijven.`);
  }

  const rootNa=fs.readFileSync(rootPad,"utf8");
  if(tel(rootNa,GENERIEKE_H1)!==1)throw new Error("Plaats-H1-stap mag de homepage-H1 niet wijzigen.");
  const versie=vernieuwServiceworkerCache(OUT,"seo-location-h1");
  console.log(`SEO-plaats-H1 toegepast en geverifieerd voor ${LOCATIES.length} routes; homepage ongemoeid; cache ${versie}.`);
}

if(require.main===module)main();
module.exports={GENERIEKE_H1,plaatsH1,pasPlaatsH1Toe};

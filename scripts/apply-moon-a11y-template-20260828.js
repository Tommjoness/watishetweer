"use strict";

const fs=require("fs");
const path=require("path");

const bestand=path.join(__dirname,"..","public","index.html");
if(!fs.existsSync(bestand))throw new Error("public/index.html ontbreekt; voer build eerst uit.");
let html=fs.readFileSync(bestand,"utf8");

/* Lighthouse accepteert aria-label op deze gewone span pas wanneer het element
   een rol heeft die die toegankelijke naam ondersteunt. Voeg de rol daarom toe
   aan iedere Nachtzicht-template zelf, niet pas via een latere DOM-mutatie. De
   definitieve artifact bevat meerdere renderpaden; elk pad moet dezelfde
   semantiek opleveren. */
const alleMaanTags=()=>html.match(/<span class="maanbij"[^>]*>/g)||[];
const voor=alleMaanTags();
if(voor.length<1)throw new Error("Geen maan-template gevonden.");

html=html.replace(/<span class="maanbij"(?![^>]*\brole\s*=)[^>]*>/g,tag=>
  tag.replace('<span class="maanbij"','<span class="maanbij" role="img"')
);

const na=alleMaanTags();
if(na.length!==voor.length)throw new Error("Maan-templateaantal veranderde onverwacht: "+voor.length+" -> "+na.length);
if(!na.every(tag=>/\brole="img"/.test(tag)))throw new Error("Niet iedere maan-template heeft role=img na toegankelijkheidspatch.");

fs.writeFileSync(bestand,html,"utf8");
console.log("Maan-toegankelijkheid op template-niveau geborgd voor "+na.length+" renderpad(en): iedere .maanbij wordt direct als role=img gerenderd.");

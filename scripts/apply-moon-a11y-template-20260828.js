"use strict";

const fs=require("fs");
const path=require("path");

const bestand=path.join(__dirname,"..","public","index.html");
if(!fs.existsSync(bestand))throw new Error("public/index.html ontbreekt; voer build eerst uit.");
let html=fs.readFileSync(bestand,"utf8");

/* Lighthouse accepteert aria-label op deze gewone span pas wanneer het element
   een rol heeft die die toegankelijke naam ondersteunt. Voeg de rol daarom toe
   aan de Nachtzicht-template zelf, niet pas via een latere DOM-mutatie. Zo kan
   geen render- of lifecyclepad ooit een .maanbij zonder geldige rol opleveren. */
const alleMaanTags=()=>html.match(/<span class="maanbij"[^>]*>/g)||[];
const voor=alleMaanTags();
if(voor.length!==1)throw new Error("Maan-template ontbreekt of is dubbel: "+voor.length);

html=html.replace(/<span class="maanbij"(?![^>]*\brole\s*=)[^>]*>/g,tag=>
  tag.replace('<span class="maanbij"','<span class="maanbij" role="img"')
);

const na=alleMaanTags();
if(na.length!==1)throw new Error("Maan-templateaantal veranderde onverwacht: "+na.length);
if(!na.every(tag=>/\brole="img"/.test(tag)))throw new Error("Maan-template mist role=img na toegankelijkheidspatch.");

fs.writeFileSync(bestand,html,"utf8");
console.log("Maan-toegankelijkheid op template-niveau geborgd: .maanbij wordt direct als role=img gerenderd.");

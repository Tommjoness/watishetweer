"use strict";

const fs=require("fs");
const path=require("path");

/* Owner-verifier voor de maan-toegankelijkheid. De rol hoort in de bron-
   templates zelf (index.html en senior-correctness-v2.js): Lighthouse
   accepteert aria-label op deze span pas met een rol die een toegankelijke
   naam ondersteunt. Voorheen voegde een late postbuildlaag role="img" via een
   tekstpatch toe; die laag is vervangen door deze alleen-lezende controle, zodat
   een bronwijziging die de rol verliest de build direct laat falen. */
const ROOT=path.join(__dirname,"..");
const bestand=path.join(ROOT,"public","index.html");
if(!fs.existsSync(bestand))throw new Error("public/index.html ontbreekt; voer build eerst uit.");
const html=fs.readFileSync(bestand,"utf8");

const tags=html.match(/<span class="maanbij"[^>]*>/g)||[];
if(tags.length<2)throw new Error("Verwacht beide maan-renderpaden (Nachtzicht-tabel en nachtregel) in de artifact; gevonden: "+tags.length);
const zonderRol=tags.filter(tag=>!/\brole="img"/.test(tag));
if(zonderRol.length)throw new Error("Maan-template zonder role=img in de artifact: "+zonderRol.join(" | "));

for(const bron of ["index.html","senior-correctness-v2.js"]){
  const tekst=fs.readFileSync(path.join(ROOT,bron),"utf8");
  const bronTags=tekst.match(/<span class="maanbij"[^>]*>/g)||[];
  if(!bronTags.length)throw new Error(bron+" bevat geen maan-template meer; werk deze verifier bij.");
  if(bronTags.some(tag=>!/\brole="img"/.test(tag)))throw new Error(bron+" is niet langer de owner van role=img op .maanbij.");
}
if(fs.existsSync(path.join(__dirname,"apply-moon-a11y-template-20260828.js"))){
  throw new Error("De oude maan-postbuildpatch hoort niet terug te komen; de bron-templates zijn owner.");
}

console.log("Maan-toegankelijkheid geverifieerd: "+tags.length+" renderpaden in de artifact en beide bron-templates dragen zelf role=img.");

"use strict";

const fs=require("fs");
const path=require("path");
const {OUT,STYLE_ID,OWNER_ID,htmlBestanden}=require("./apply-desktop-premium-20260929.js");

/* Controleert het artifact na de desktoplaag van 29 september: iedere
   weerpagina draagt de laag precies één keer, na de samenhanglaag, en de
   afspraken staan erin. */
let aantal=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8"),rel=path.relative(OUT,p);
  if(!html.includes(`id="${OWNER_ID}"`))continue;
  const n=html.split(`id="${STYLE_ID}"`).length-1;
  if(n!==1)throw new Error(rel+": desktoplaag staat er "+n+" keer in.");
  if(html.indexOf(`id="${STYLE_ID}"`)<html.indexOf(`id="${OWNER_ID}"`))throw new Error(rel+": desktoplaag staat vóór de samenhanglaag.");
  const css=html.slice(html.indexOf(`id="${STYLE_ID}"`),html.indexOf("</style>",html.indexOf(`id="${STYLE_ID}"`)));
  for(const vereist of [
    "@media (min-width:1100px)","@media (min-width:1440px)",
    ">.sheet:not(#wiw-desktop-premium){max-width:1600px!important;margin-left:auto!important;margin-right:auto!important}",
    ".seo-plaatsnav-inner:not(#wiw-desktop-premium){max-width:1600px!important",
    "#nights .row.night:not(#wiw-desktop-premium){grid-template-columns:112px minmax(150px,190px) 100px minmax(120px,150px) minmax(0,1fr) max-content!important",
    "#app #aq.stats:not(#wiw-desktop-premium){max-width:none!important",
    "minmax(0,1.85fr) minmax(470px,1fr)","#wiw-hour-table.wiw-hour-table:not(#wiw-desktop-premium){table-layout:auto!important}"
  ])if(!css.includes(vereist))throw new Error(rel+": desktoplaag mist "+vereist);
  aantal++;
}
if(!aantal)throw new Error("Geen weerpagina met de desktoplaag gevonden.");
const app=fs.readdirSync(OUT).filter(f=>/^app-.*\.min\.js$/.test(f)).map(f=>fs.readFileSync(path.join(OUT,f),"utf8")).join("\n");
for(const vereist of ["356:296","220:160","MAX_TABEL_UREN","data-desktop-temp-anker","data-basis-font-size"]){
  if(!app.includes(vereist))throw new Error("App-bundel mist "+vereist+".");
}
console.log("Desktoplaag geverifieerd op "+aantal+" weerpagina's: één kolom van hooguit 1600px, grotere letters, Nachtzicht zonder lege kolom, uurtabel op één regel vanaf 1440px, vaste uuras en hogere grafiek op breed scherm.");

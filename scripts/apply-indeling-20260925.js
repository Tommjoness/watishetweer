"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-indeling-20260925";
const OWNER_ID="wiw-kleur-20260925";

/* Indeling van het eerste scherm.
   - Desktop (vanaf 1100px): links briefing, waarschuwing en temperatuur,
     rechts de tegels. De linkerkolom is hoger; rechts onder de tegels bleef
     een lege strook en het modelsignaal stond daaronder over de volle
     breedte, zodat de grafiek op een laptop (1366x768) pas op y=699 begon.
     De runtime zet het modelsignaal als laatste in het raster; hier komt het
     rechts onder de tegels. De grafiek schuift zo'n 60px omhoog.
   - Tegels: de inhoud stond verticaal gecentreerd, dus bij een label over
     twee regels stonden labels en getallen in één rij op verschillende
     hoogtes (tot 19px). Inhoud bovenaan; de runtime geeft labels in één rij
     dezelfde hoogte, met de tekst onderaan, zodat de getallen op één lijn
     staan. */
/* Afwerking na de review van 25 september.
   - "Komende 24 uur" (terug uit de dagweergave) stond op 9,5px en was op de
     telefoon 21px hoog: minstens 11px en op de telefoon 44px tikhoogte.
   - Weergave-schakelaar in de voet (vanaf 431px): drie vakjes van 72px waren
     te krap voor "☾ Donker"; het maantje lag tegen "Auto" en de tekst tegen
     de rand. Drie vakjes van 92px.
   - Luchtkwaliteit "goed" en "redelijk" stonden in een grijsgroen dat zwakker
     oogt dan "slecht" (inkt). Lucht en pollen staan in inkt; het oordeel
     staat eronder als woord.
   - De zoeklijst lag zonder schaduw op de tekst eronder en liep erin over.
   - Lijnen over de volle breedte: de luchttegels sprongen 10-18px in ten
     opzichte van hun eigen bovenlijn, en onder 1100px stopte de lijn boven
     het modelsignaal op 720px.
   - Geen tekst onder 11px: het label "Modelsignaal" (10px) en de tegelkoppen
     tussen 1000 en 1099px (10,5px). */

const CSS=`
@media(min-width:1100px){
  html body #app>.final-top-grid{row-gap:0}
  html body .final-top-grid>.final-top-left{grid-column:1;grid-row:1 / span 2}
  html body .final-top-grid>.stats{grid-column:2;grid-row:1}
  html body .final-top-grid>#modelrisico{grid-column:2;grid-row:2;align-self:start;margin:14px 0 0!important;max-width:none}
}
html body .stats>.stat{justify-content:flex-start!important}
html body .stats>.stat>.eyebrow{display:flex;align-items:flex-end;justify-content:center}
html body .chartkop #back:not(#wiw-indeling){font-size:11px;padding:6px 12px;letter-spacing:.1em}
@media(max-width:759px){
  html body .chartkop #back:not(#wiw-indeling){min-height:44px;padding:0 16px;margin-top:6px}
}
@media(min-width:431px){
  html body .wiw-weergave-voet #thema.wiw-theme-control.wiw-theme-segmented-20260915:not(#wiw-indeling){width:276px!important;min-width:276px!important}
}
html body #aq .sval[style*="--teal"]{color:var(--ink)!important}
html body .results{box-shadow:0 10px 24px -12px rgba(0,0,0,.35)}
html body #aq.stats:not(#wiw-indeling){padding-left:0!important;padding-right:0!important}
html body .final-top-grid>#modelrisico:not(#wiw-indeling){max-width:none!important}
html body #modelrisico .modelrisico-label{font-size:11px}
@media(min-width:600px) and (max-width:1099px){
  html body .stats>.stat>.eyebrow{font-size:11px}
}
`;

function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": indelingslaag staat al in artifact.");
  if(!html.includes("</head>"))throw new Error(rel+": headafsluiting ontbreekt.");
  return html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8");
    if(!html.includes(`id="${OWNER_ID}"`))continue;
    fs.writeFileSync(p,pasToe(html,path.relative(OUT,p)),"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door indelingslaag.");
  const cache=vernieuwServiceworkerCache(OUT,"indeling-20260925");
  console.log("Indelingslaag toegepast op "+geraakt+" weerartifacts: modelsignaal rechts onder de tegels op desktop, tegellabels en getallen op één lijn, terugknop, weergave-schakelaar, luchtkleur, zoeklijst en lijnen; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CSS,htmlBestanden,pasToe,main};

"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-leesbaarheid-20260924";
const OWNER_ID="wiw-bediening-20260924";

/* Leesbaarheid. Veel labels en waarden stonden op 9 tot 11,5px: tegelkoppen op
   mobiel 9,5px, "8% kans" en "do 23 jul" in de desktop-uurtabel 9 tot 9,5px.
   Regel in deze laag:
   - labels in kapitalen met letterspatiëring minstens 11px;
   - gewone tekst en waarden minstens 12px.
   Alleen font-size; kleur, volgorde en data blijven bij hun eigen lagen.
   Daarnaast is de nachtband in het donkere thema lichter: #142C4C op het
   donkere vel (#141414) was nauwelijks te zien. */
const CSS=`
html[data-thema="donker"]{--accent-night:#2B4A74}
/* Kapitalen-labels: minstens 11px */
html body .row.kop>*,html body #nights .row.kop>*,html body #nights .row.night.kop>.nmeta:not(.wide),html body #days .row.kop>*,html body #app h2>span:not([id]),html body .bronlabel,html body #chartlab,html body .chartkop h2,html body .zondag,html body .wiw-hour-table thead th{font-size:11px!important}
html body #thema.wiw-theme-segmented-20260915 .wiw-theme-auto,html body #thema.wiw-theme-segmented-20260915 .wiw-theme-icon{font-size:11px!important}
@media(max-width:900px){
  html body .stats .stat .eyebrow{font-size:11px!important}
  html body .wiw-hour-table .wiw-hour-secondary,html body .wiw-hour-table .wiw-hour-date,html body .wiw-hour-date{font-size:12px!important}
}
/* Desktop-uurtabel: 11px in plaats van 9 tot 9,5px. Twaalf past niet binnen de
   comfortabele rijhoogte (29 tot 46px) naast een grafiek met weinig rijen. */
@media(min-width:901px){
  html body .wiw-hour-table .wiw-hour-secondary,html body .wiw-hour-table .wiw-hour-date,html body .wiw-hour-date{font-size:11px!important}
}
@media(min-width:901px){
  html body .tools>#ververs,html body .tools>#here{font-size:11px!important}
}
/* Gewone tekst en waarden: minstens 12px */
html body .mobile-neerslag-sleutel,
html body small.q1-dag-mm,
html body #stamp,
html body #final-rain-summary,
html body #nights .nacht-meta-details>summary,
html body #nights .nachtvenster,
html body #moonlab span,
html body #suntimes span:not(.zondag),
html body footer a,
html body footer > span.bron,
html body footer > span.bron:nth-of-type(2),
html body .footer-contact,
html body .footer-contact-question,
html body .footer-contact-mail,
html body #place #plaatstijd{font-size:12px!important}
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
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": leesbaarheidslaag staat al in artifact.");
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
  if(!geraakt)throw new Error("Geen weerartifact geraakt door leesbaarheidslaag.");
  const cache=vernieuwServiceworkerCache(OUT,"leesbaarheid-20260924");
  console.log("Leesbaarheidslaag toegepast op "+geraakt+" weerartifacts: labels minstens 11px, tekst minstens 12px, zichtbare nachtband in donker; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CSS,htmlBestanden,pasToe,main};

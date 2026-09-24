"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-typografie-20260925";
const OWNER_ID="wiw-nachtzicht-20260925";

/* Typografie en kleine punten.
   - Data stond in drie letters door elkaar: schreef, schreefloos en DM Mono
     (ophaaltijd, uurtabel, 7-dagen, grafieklabels). --mono wordt de gewone
     schreefloze letter; waar cijfers onder elkaar staan krijgen ze cijfers van
     gelijke breedte (tabular-nums). Grafieklabels die de runtime als
     font-family="DM Mono" tekent, volgen via CSS, die voorgaat op het
     presentatieattribuut. Lopende tekst houdt proportionele cijfers.
   - Sectiekoppen stonden deels op 10,5px; de basisregel wordt 11px.
   - Uitleggende hints zijn gewone tekst, links uitgelijnd, in plaats van
     cursief en gecentreerd.
   - De kop Temp.bereik stond in een cel van 1px hoog en daardoor lager dan
     de andere kolomkoppen.
   - Mobiel en tablet: zon onder en zon op op één links uitgelijnde regel.
   - Tablet (600-900px): tegels in vier kolommen in plaats van twee. */
const CSS=`
/* Eén letter voor data: de gewone schreefloze letter met cijfers van gelijke
   breedte, zodat kolommen uitlijnen zonder monospace */
:root:not(#wiw-typo){--mono:var(--sans)}
html body :is(#stamp,#plaatstijd,.stats,.hero,.wiw-hour-table,#days,#nights,#aq,#final-rain-summary,#suntimes){font-variant-numeric:tabular-nums}
html body #chart text[font-family*="Mono"],html body svg text[font-family*="Mono"]{font-family:var(--sans)!important;font-variant-numeric:tabular-nums}
/* Sectielabels: de basisregel stond op 10,5px; specifiekere koppen houden hun
   eigen maat */
h2{font-size:11px}
.chips .chipskop{font-size:11px}
/* Uitleggende hints: gewoon en links in plaats van cursief en gecentreerd */
html body #app p.hint:not(#wiw-typo){font-style:normal!important;text-align:left!important;margin-left:0!important;margin-right:0!important;max-width:none!important;color:var(--ink-45)!important}
/* Kop Temp.bereik op de lijn van de andere kolomkoppen */
html body #days .row.kop>.bar:not(#wiw-typo){height:auto!important;align-self:center!important;background:none!important;border:0!important}
/* Zon onder en zon op op één regel, links uitgelijnd */
@media(max-width:900px){
  html body #suntimes.senior-zoninfo:not(#wiw-typo){display:flex!important;flex-wrap:wrap!important;column-gap:18px!important;row-gap:2px!important;justify-content:flex-start!important;text-align:left!important;width:100%!important}
  html body #suntimes.senior-zoninfo .zonregel{width:auto!important;justify-content:flex-start!important;text-align:left!important}
  html body #suntimes.senior-zoninfo .zonregel .zondag{min-width:0!important;text-align:left!important;margin-right:6px!important}
}
/* Tablet: tegels in vier kolommen */
@media(min-width:600px) and (max-width:900px){
  html body #app .stats:not(#aq):not(#wiw-typo){grid-template-columns:repeat(4,minmax(0,1fr))!important}
  html body #app .stats:not(#aq):not(#wiw-typo)>.stat{border-right:1px solid var(--rule)!important}
  html body #app .stats:not(#aq):not(#wiw-typo)>.stat:nth-child(4n){border-right:0!important}
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
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": typografielaag staat al in artifact.");
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
  if(!geraakt)throw new Error("Geen weerartifact geraakt door typografielaag.");
  const cache=vernieuwServiceworkerCache(OUT,"typografie-20260925");
  console.log("Typografielaag toegepast op "+geraakt+" weerartifacts: één letter voor data, rustige hints, zon op één regel, tablettegels in vier kolommen; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CSS,htmlBestanden,pasToe,main};

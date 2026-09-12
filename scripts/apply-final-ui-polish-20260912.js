"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-final-ui-polish-20260912";
const POLLEN_OUD="Pollen is een CAMS-modelconcentratie; lokale blootstelling en persoonlijke gevoeligheid kunnen afwijken.";
const POLLEN_NIEUW="Pollenwaarden zijn een verwachting van CAMS; de werkelijke blootstelling kan lokaal verschillen.";

/* Uitsluitend visuele/tekstuele polish. Geen provider-, data-, interpretatie- of
   interactielogica. Deze late laag wint bewust van eerdere gedateerde UI-owners
   zonder hun functionele contracten te wijzigen. */
const CSS=`
/* Luchtkwaliteit/pollen: één rustige rij met echte buitenruimte en gelijk ritme. */
#aq{
  box-sizing:border-box;
  padding-inline:18px;
}
#aq .stat{
  box-sizing:border-box;
  min-width:0;
  padding:15px 18px 17px!important;
  text-align:center;
}
#aq .stat .eyebrow,
#aq .stat .sval,
#aq .stat .ssub{
  width:100%;
  text-align:center;
}
#aq .stat .sval{
  justify-content:center;
  margin-top:6px;
}
#aq .stat .ssub{
  margin-top:5px;
  line-height:1.4;
}

/* De grafiekbox zelf blijft exact binnen .wiw-chart-main. Alleen de visuele
   regenannotatie onder de x-as schuift op desktop zes pixels omhoog. Daardoor
   wordt de bedoelde interne gap compacter zonder overflow of hoogtecontracten
   van grafiek en uurpaneel te veranderen. Mobiel behoudt zijn bestaande ritme. */
@media(min-width:1100px){
  #chart g[data-q4-rain-periods]{
    transform:translateY(-6px);
    transform-box:view-box;
    transform-origin:0 0;
  }
}

/* De overgang naar de plaatsnavigatie gebruikt dezelfde rand, maar zachter en
   met iets meer ademruimte. Geen nieuw scheidingselement of extra blok. */
body > .sheet{border-bottom-color:var(--rule-soft)}
body > .seo-plaatsnav{margin-top:18px!important}

/* Footerhulplinks horen als één compacte afsluitende rij te lezen. De lange
   veiligheidsdisclaimer krijgt op desktop daarom zijn eigen regel; vervolgens
   passen Over, Privacy en Technische locatiegegevens samen op de volgende rij.
   De summary krijgt exact dezelfde subtiele onderstreping als gewone footerlinks. */
footer .footer-details>summary{
  color:inherit;
  box-shadow:inset 0 -1px 0 var(--rule);
}
footer .footer-details>summary:hover,
footer .footer-details>summary:focus-visible{
  color:var(--ink);
  box-shadow:inset 0 -1px 0 var(--ink);
}

@media(min-width:901px){
  footer > .bron:nth-of-type(2){
    flex-basis:100%;
    justify-content:center;
  }
}

@media(min-width:901px){
  #aq .stat .ssub{min-height:2.8em}
  #aq.aq-cols-1 .stat:nth-child(n),
  #aq.aq-cols-2 .stat:nth-child(2n),
  #aq.aq-cols-3 .stat:nth-child(3n),
  #aq.aq-cols-4 .stat:nth-child(4n){border-right:0}
}

@media(max-width:900px){
  #aq{padding-inline:10px}
  #aq .stat{padding:14px 12px 15px!important}
  #aq .stat:nth-child(2n){border-right:0}
  #aq.aq-cols-1 .stat,
  #aq.aq-cols-3 .stat:last-child,
  #aq > .stat:last-child:nth-child(odd){border-right:0}
  body > .seo-plaatsnav{margin-top:14px!important}
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

function exactEen(bron,oud,nieuw,label,rel){
  const n=bron.split(oud).length-1;
  if(n!==1)throw new Error(rel+": "+label+" ontbreekt of is dubbel: "+n);
  return bron.replace(oud,nieuw);
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    let html=fs.readFileSync(p,"utf8");
    if(!html.includes(POLLEN_OUD))continue;
    const rel=path.relative(OUT,p);
    if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": finale UI-polish staat al in artifact.");
    if(!html.includes('id="aq"')||!html.includes('id="chart"'))throw new Error(rel+": verwachte UI-hooks ontbreken.");
    if(!html.includes("</head>"))throw new Error(rel+": </head> ontbreekt.");

    html=exactEen(html,POLLEN_OUD,POLLEN_NIEUW,"pollentoelichting",rel);
    html=html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
    fs.writeFileSync(p,html,"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door finale UI-polish.");
  const cache=vernieuwServiceworkerCache(OUT,"final-ui-polish-20260912");
  console.log("Finale UI-polish toegepast op "+geraakt+" weerartifacts; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();

module.exports={OUT,STYLE_ID,POLLEN_OUD,POLLEN_NIEUW,CSS,htmlBestanden,exactEen,main};

"use strict";

const fs=require("fs");
const path=require("path");
const {LOCATIES}=require("./seo-locations.config.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="weather-now-desktop-refinement-20260829";
const NAV_MARKER="<!-- WEATHER NOW INDEXEERBARE PLAATSEN -->";

/* WMO-code 55/57 beschrijft een hogere intensiteit van (aanvriezende) motregen.
   De letterlijke combinatie 'zware motregen' leest in consumententaal echter
   onnatuurlijk en wordt in kanszinnen nog sterker ('zeer grote kans op zware
   motregen'). De meteorologische soort blijft behouden; alleen de zichtbare
   intensiteitsbijvoeging vervalt. Regen, buien, sneeuw en onweer houden hun
   bestaande lichte/zware onderscheid ongewijzigd. */
const MOTREGEN_BRON='55:["Zware motregen","regen"],56:["Aanvriezende motregen","ijzel"],57:["Zware aanvriezende motregen","ijzel"],';
const MOTREGEN_PRODUCTIE='55:["Motregen","regen"],56:["Aanvriezende motregen","ijzel"],57:["Aanvriezende motregen","ijzel"],';

/* Desktop-only verfijning. De plaatslinks blijven exact dezelfde crawlbare
   ankers, maar sluiten visueel aan op het witte hoofdvlak. Nachtzicht houdt op
   brede schermen vaste compacte labelkolommen en een begrensde uitlegkolom,
   terwijl de scorebalk de resterende breedte vult. Vanaf het echte desktop-
   breakpoint is het witte productvlak bovendien altijd viewportbreed. Daarmee
   kan een historische max-width of brede/uitgezoomde browser nooit opnieuw
   grijze zijgoten zichtbaar maken. De fixed contextbalk volgt vanaf hetzelfde
   breakpoint exact die viewportgeometrie; oude gecentreerde breedte- of
   transformregels worden daar expliciet geneutraliseerd. Onder 1100 px blijft
   de bestaande responsieve layout volledig eigenaar. */
const STIJL=`<style id="${MARKER}">
@media(min-width:701px){
  .seo-plaatsnav{
    box-sizing:border-box;
    margin:0 auto;
    padding:20px 48px 24px;
    border:1px solid var(--rule);
    border-top:0;
    background:var(--sheet)
  }
}
@media(min-width:1000px){
  #nights .row.night{
    grid-template-columns:104px 52px minmax(180px,1fr) 104px minmax(220px,280px)
  }
}
@media(min-width:1100px){
  body{
    padding-left:0!important;
    padding-right:0!important
  }
  .sheet,.seo-plaatsnav{
    box-sizing:border-box;
    width:100%!important;
    max-width:none!important;
    margin-left:0!important;
    margin-right:0!important
  }
  #minibar{
    left:0!important;
    right:0!important;
    width:auto!important;
    max-width:none!important;
    margin-left:0!important;
    margin-right:0!important;
    transform:none!important
  }
}
</style>`;

function tel(tekst,zoek){return String(tekst).split(zoek).length-1;}

function pasDesktopRefinementToe(html,label="artifact"){
  let bron=String(html||"");
  if(bron.includes(`id="${MARKER}"`))return bron;
  if(tel(bron,NAV_MARKER)!==1)throw new Error(`${label}: indexeerbare plaatsnavigatie ontbreekt of is dubbel.`);
  if(tel(bron,MOTREGEN_BRON)!==1)throw new Error(`${label}: verwachte motregencodetabel ontbreekt of is dubbel.`);
  if(tel(bron,"</head>")!==1)throw new Error(`${label}: verwacht exact één head-einde.`);

  const linksVoor=(bron.match(/<a\s+[^>]*href=/g)||[]).length;
  bron=bron.replace(MOTREGEN_BRON,MOTREGEN_PRODUCTIE);
  bron=bron.replace("</head>",STIJL+"\n</head>");
  const linksNa=(bron.match(/<a\s+[^>]*href=/g)||[]).length;

  if(linksNa!==linksVoor)throw new Error(`${label}: plaatsverfijning wijzigde onverwacht het aantal links (${linksVoor} -> ${linksNa}).`);
  if(tel(bron,MOTREGEN_PRODUCTIE)!==1||bron.includes(MOTREGEN_BRON))throw new Error(`${label}: motregencopy is niet eenduidig genormaliseerd.`);
  if(tel(bron,`id="${MARKER}"`)!==1)throw new Error(`${label}: desktopverfijningsstijl ontbreekt of is dubbel.`);
  return bron;
}

function main(){
  const doelen=[
    {pad:path.join(OUT,"index.html"),label:"homepage"},
    ...LOCATIES.map(loc=>({pad:path.join(OUT,"weer",loc.slug,"index.html"),label:loc.slug}))
  ];
  for(const doel of doelen){
    if(!fs.existsSync(doel.pad))throw new Error(`${doel.label}: HTML-artifact ontbreekt vóór desktopverfijning.`);
    const bron=fs.readFileSync(doel.pad,"utf8");
    fs.writeFileSync(doel.pad,pasDesktopRefinementToe(bron,doel.label),"utf8");
  }
  const versie=vernieuwServiceworkerCache(OUT,"desktop-refinement-20260829");
  console.log(`Desktopverfijning toegepast op ${doelen.length} weerpagina's: viewportbreed productvlak en minibalk, plaatsnav geïntegreerd, Nachtzicht breedtevullend en motregencopy genormaliseerd; cache ${versie}.`);
}

if(require.main===module)main();
module.exports={MARKER,NAV_MARKER,MOTREGEN_BRON,MOTREGEN_PRODUCTIE,STIJL,pasDesktopRefinementToe};

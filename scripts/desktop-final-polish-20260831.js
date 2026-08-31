"use strict";

const fs=require("fs");
const path=require("path");
const {LOCATIES}=require("./seo-locations.config.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="weather-now-desktop-final-polish-20260831";
const NAV_MARKER="<!-- WEATHER NOW INDEXEERBARE PLAATSEN -->";

/* Finale desktop-polish naar aanleiding van de verkoop-/overdrachtsaudit.
   Uitsluitend presentatie: geen weerwaarden, providerkeuze, interpretatie,
   routing of indexeerbare links worden gewijzigd. */
const STIJL=`<style id="${MARKER}">
@media(min-width:701px){
  .seo-plaatsnav{
    box-sizing:border-box;
    max-width:min(1180px,calc(100% - 44px));
    margin:0 auto;
    padding:20px 48px 24px;
    border:1px solid var(--rule);
    border-top:0;
    background:var(--sheet)
  }
}
@media(min-width:1000px){
  /* De twee-uurs-neerslagmodule hoeft op breed desktop niet over de volle
     contentbreedte uit te waaieren. De SVG behoudt zijn eigen aspect-ratio en
     wordt alleen begrensd, zodat rustige/droge scenario's minder leeg ogen. */
  #nc{width:min(960px,100%);margin-right:auto}
  #nctext{margin-bottom:4px}

  /* Zeven dagen blijft inhoudelijk identiek, maar de vaste kolommen en gaps
     worden dichter bij elkaar gezet. De verwachtingskolom houdt de rekbare
     ruimte, terwijl de hele tabel een leesbare krantenbreedte krijgt. */
  #days{max-width:1000px}
  #days .row.day{
    grid-template-columns:92px 24px minmax(260px,1fr) 62px 46px 104px 44px 54px;
    gap:10px;
    padding:10px 0
  }

  /* Nachtzicht gebruikt dezelfde compacte leesbreedte. Score, bewolking en
     advies blijven op vaste assen staan, maar hoeven niet meer de volle
     paginabreedte te overbruggen. */
  #nights{max-width:1000px}
  #nights .row.night{
    grid-template-columns:88px 52px minmax(190px,1fr) 82px minmax(230px,260px);
    gap:12px;
    padding:10px 0
  }
  #nights .row.night > .nmeta.wide{max-width:260px}
}
</style>`;

function tel(tekst,zoek){return String(tekst).split(zoek).length-1;}

function pasDesktopFinalPolishToe(html,label="artifact"){
  let bron=String(html||"");
  if(bron.includes(`id="${MARKER}"`))return bron;
  if(tel(bron,NAV_MARKER)!==1)throw new Error(`${label}: indexeerbare plaatsnavigatie ontbreekt of is dubbel.`);
  if(tel(bron,"</head>")!==1)throw new Error(`${label}: verwacht exact één head-einde.`);

  const linksVoor=(bron.match(/<a\s+[^>]*href=/g)||[]).length;
  bron=bron.replace("</head>",STIJL+"\n</head>");
  const linksNa=(bron.match(/<a\s+[^>]*href=/g)||[]).length;

  if(linksNa!==linksVoor)throw new Error(`${label}: desktop-polish wijzigde onverwacht het aantal links (${linksVoor} -> ${linksNa}).`);
  if(tel(bron,`id="${MARKER}"`)!==1)throw new Error(`${label}: desktop-polishstijl ontbreekt of is dubbel.`);
  return bron;
}

function main(){
  const doelen=[
    {pad:path.join(OUT,"index.html"),label:"homepage"},
    ...LOCATIES.map(loc=>({pad:path.join(OUT,"weer",loc.slug,"index.html"),label:loc.slug}))
  ];
  for(const doel of doelen){
    if(!fs.existsSync(doel.pad))throw new Error(`${doel.label}: HTML-artifact ontbreekt vóór desktop-polish.`);
    const bron=fs.readFileSync(doel.pad,"utf8");
    fs.writeFileSync(doel.pad,pasDesktopFinalPolishToe(bron,doel.label),"utf8");
  }
  const versie=vernieuwServiceworkerCache(OUT,"desktop-final-polish-20260831");
  console.log(`Desktop-final-polish toegepast op ${doelen.length} weerpagina's: neerslag compacter, weektabel en Nachtzicht strakker, plaatsnavigatie geïntegreerd; cache ${versie}.`);
}

if(require.main===module)main();
module.exports={MARKER,NAV_MARKER,STIJL,pasDesktopFinalPolishToe};

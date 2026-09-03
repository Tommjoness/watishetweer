"use strict";

const fs=require("fs"),path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== FINAL SPACING POLISH 20260903 ===== */";
const VOORGAANDE_MARKER="/* ===== FINAL VISUAL POLISH 20260902 ===== */";
const STYLE=`
${MARKER}
/* Laatste ritmepolish op basis van echte desktopproductiebeelden. Alleen
   spacing en uitlijning: geen data-, state-, cache- of forecastlogica. */
@media(min-width:1100px){
  /* Masthead en primaire metriekgrid delen exact dezelfde twee kolommen. Zo
     begint zoeken op dezelfde linkeras als de statistieken eronder in plaats
     van als een los blok naar rechts te zweven. */
  .mast{
    display:grid!important;
    grid-template-columns:minmax(0,.95fr) minmax(480px,1.05fr)!important;
    gap:48px!important;
    align-items:start!important;
    justify-content:stretch!important
  }
  .mast>div:first-child{min-width:0!important}
  .mast>.mastright{
    width:100%!important;
    min-width:0!important;
    align-items:stretch!important;
    text-align:right!important
  }
  .mast>.mastright .tools{width:100%!important;min-width:0!important}
  .mast>.mastright .tools input[type=text]{flex:1 1 auto!important;width:auto!important;min-width:0!important}
  .mast>.mastright #stamp{text-align:right!important}

  /* De onderste secties stapelden elk een volledige --s4 (40 px) marge. Dat
     maakt Zeven dagen -> Nachtzicht -> Luchtkwaliteit optisch te los. */
  .dashrow-days h2,.dashrow-days + h2{margin-top:28px!important}
  #dagenhint,#nachthint,#pollenhint{margin-top:6px!important;margin-bottom:8px!important}

  /* Nachtzicht: de scorebalk krijgt een echte bovengrens. Op brede desktops
     gaat extra ruimte naar de tekstkolom, zodat advies minder vaak breekt en
     de rijen vanzelf compacter worden. */
  #nights .row.night{
    grid-template-columns:112px 72px minmax(260px,620px) 112px minmax(340px,1fr)!important;
    column-gap:20px!important
  }
  #nights .row.night .nmeta.wide{
    display:flex!important;
    flex-direction:column!important;
    align-items:flex-start!important;
    justify-content:center!important;
    justify-self:stretch!important;
    width:100%!important;
    max-width:none!important;
    min-width:0!important;
    text-align:left!important;
    gap:2px!important
  }
  #nights .row.night.kop .nmeta.wide{align-items:flex-start!important;text-align:left!important}
  #nights .row.night .nachtadvies,#nights .row.night .nachtmaan{
    width:100%!important;
    max-width:none!important;
    margin-left:0!important;
    margin-right:0!important;
    text-align:left!important
  }
  #nights .row.night .nachtmaan{margin-top:0!important;white-space:normal!important}
  #nights .row.night:not(.kop){padding-top:8px!important;padding-bottom:8px!important}

  /* Luchtkwaliteit en de twee footerlagen vormen één compacte afsluiting. */
  #aq{padding-top:10px!important;padding-bottom:10px!important}
  footer{
    margin-top:10px!important;
    padding-top:7px!important;
    padding-bottom:0!important;
    gap:2px 14px!important;
    line-height:1.35!important
  }
  footer .bron,footer .footer-details{min-height:24px!important}
  /* Bronvermeldingen mogen als geheel naar een nieuwe flexregel, maar niet
     intern afbreken. Dat voorkomt een losse ': KNMI'- of '· KNMI'-weesregel. */
  footer .bron:first-child{white-space:nowrap!important;max-width:100%!important}
  .seo-plaatsnav{
    margin-top:0!important;
    padding:7px 0!important;
    min-height:58px!important;
    border-top:1px solid var(--rule)!important;
    background:var(--sheet)!important;
    box-shadow:none!important
  }
  .seo-plaatsnav-inner{gap:14px!important}
  .seo-plaatsnav-links{gap:4px 12px!important}
  .seo-plaatsnav a{min-height:28px!important}
}

@media(min-width:1300px){
  /* Op echte laptop/desktopbreedtes hoort de SEO-footerkop geen onnodige
     tweeregelaar te zijn. De links mogen wél normaal doorlopen. */
  .seo-plaatsnav-inner{grid-template-columns:250px minmax(0,1fr)!important;gap:20px!important}
  .seo-plaatsnav-kop{text-align:left!important;white-space:nowrap!important}
}

@media(max-width:900px){
  /* Op touch blijft de bestaande 44 px hit-area onaangeraakt; alleen het gat
     tussen inhoud en footer wordt iets rustiger. Desktop-nowrap wordt hier
     expliciet teruggedraaid zodat bronlinks nooit mobiele overflow geven. */
  footer{margin-top:16px!important;padding-top:8px!important}
  footer .bron,footer .footer-details{min-height:44px!important}
  footer .bron:first-child{white-space:normal!important}
  .seo-plaatsnav{margin-top:6px!important}
  .seo-plaatsnav a{min-height:44px!important}
}
`;

function htmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmlBestanden(p));
    else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function pasToe(pad){
  let html=fs.readFileSync(pad,"utf8");
  if(!html.includes(VOORGAANDE_MARKER))return false;
  if(html.includes(MARKER))throw new Error("Final spacing polish staat al in "+pad);
  const stylePos=html.lastIndexOf("</style>");
  if(stylePos<0)throw new Error("Geen stijlblok gevonden in "+pad);
  html=html.slice(0,stylePos)+STYLE+"\n"+html.slice(stylePos);
  fs.writeFileSync(pad,html,"utf8");
  return true;
}

function main(){
  let n=0;
  for(const p of htmlBestanden(OUT))if(pasToe(p))n++;
  if(!n)throw new Error("Geen finale weerartifacts gevonden voor spacing polish.");
  const cache=vernieuwServiceworkerCache(OUT,"final-spacing-polish-20260903");
  console.log(`Final spacing polish toegepast op ${n} weerpagina's: masthead/grid-as, Nachtzicht-breedte, onderritme en footerwrap aangescherpt; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,VOORGAANDE_MARKER,STYLE,htmlBestanden,pasToe,main};

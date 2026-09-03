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
  /* De onderste secties stapelden elk een volledige --s4 (40 px) marge. Dat
     maakt Zeven dagen -> Nachtzicht -> Luchtkwaliteit optisch te los. */
  .dashrow-days h2,.dashrow-days + h2{margin-top:28px!important}
  #dagenhint,#nachthint,#pollenhint{margin-top:6px!important;margin-bottom:8px!important}

  /* Eén uitlijningsas voor Beste zichtperiode. De vorige eindlaag centreerde
     de container en maanregel, maar zette de adviesregel links: zichtbaar
     onrustig zodra tekst over meerdere regels loopt. */
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
  #nights .row.night:not(.kop){padding-top:9px!important;padding-bottom:9px!important}

  /* Luchtkwaliteit en de twee footerlagen vormen één compacte afsluiting. */
  #aq{padding-top:10px!important;padding-bottom:10px!important}
  footer{
    margin-top:12px!important;
    padding-top:8px!important;
    padding-bottom:0!important;
    gap:2px 14px!important;
    line-height:1.35!important
  }
  footer .bron,footer .footer-details{min-height:24px!important}
  .seo-plaatsnav{
    margin-top:4px!important;
    padding:8px 0!important;
    min-height:64px!important
  }
  .seo-plaatsnav-inner{gap:12px!important}
  .seo-plaatsnav-links{gap:4px 12px!important}
  .seo-plaatsnav a{min-height:28px!important}
}

@media(max-width:900px){
  /* Op touch blijft de bestaande 44 px hit-area onaangeraakt; alleen het gat
     tussen inhoud en footer wordt iets rustiger. */
  footer{margin-top:16px!important;padding-top:8px!important}
  footer .bron,footer .footer-details{min-height:44px!important}
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
  console.log(`Final spacing polish toegepast op ${n} weerpagina's: onderritme, Nachtzicht-uitlijning en footercompactheid aangescherpt; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,VOORGAANDE_MARKER,STYLE,htmlBestanden,pasToe,main};

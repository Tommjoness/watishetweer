"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== HOUR PANEL REFINEMENT 20260907 ===== */";
const STYLE_MARKER="/* ===== DESKTOP FINISHING 20260907 ===== */";
const UREN_OUD="const MAX_DESKTOP_UREN=10;";
const UREN_NIEUW="const MAX_DESKTOP_UREN=12;";
const MM_OUD='mm.textContent=num(r.hoeveelheid)===0&&(num(r.kans)===null||num(r.kans)<=0)?"–":formatMm(r.hoeveelheid)||"–";';
const MM_NIEUW='mm.textContent=formatMm(r.hoeveelheid)||"–";';
const STYLE=`
${STYLE_MARKER}
/* Gerichte desktopafronding op basis van productiebeelden. Mobiele layout,
   data-interpretatie en providerlogica blijven onaangeraakt. */
@media(min-width:1100px){
  /* De plaats en lokale tijd blijven aan weerszijden van dezelfde kopregel,
     maar krijgen aan beide kanten dezelfde binnenruimte. De onderstreping van
     de kop blijft daardoor over de volledige mastkolom lopen. */
  #place{
    padding-left:clamp(28px,3.5vw,56px)!important;
    padding-right:clamp(28px,3.5vw,56px)!important
  }

  /* De SEO-plaatsnavigatie is viewportbreed; geef de kop en links dezelfde
     veilige desktop-inset als de hoofdinhoud in plaats van tegen de rand. */
  .seo-plaatsnav{
    padding-left:clamp(24px,3.5vw,56px)!important;
    padding-right:clamp(24px,3.5vw,56px)!important;
    box-sizing:border-box!important
  }

  /* De bestaande hoogte-sync blijft leidend en verwijdert nog steeds iedere
     rij die niet volledig naast de grafiek past. Eén pixel minder verticale
     celpadding per zijde maakt op de normale desktophoogtes de twaalfde
     volledige rij passend zonder de grafiek kunstmatig hoger te maken. */
  .wiw-hour-table th,.wiw-hour-table td{
    padding-top:7px!important;
    padding-bottom:7px!important
  }
}

@media(min-width:1500px){
  /* Op brede desktops is de laatste Nachtzicht-kolom al volledig breed, maar
     de maantijd stond direct onder het advies waardoor rechts visueel leeg
     bleef. Gebruik die bestaande kolom in twee delen: advies links, maaninfo
     rechts. Er wordt geen nieuwe informatie toegevoegd. */
  #nights .row.night:not(.kop) .nmeta.wide{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) minmax(180px,230px)!important;
    column-gap:24px!important;
    align-items:center!important
  }
  #nights .row.night:not(.kop) .nachtadvies{
    grid-column:1!important;
    width:100%!important;
    max-width:none!important;
    margin:0!important;
    text-align:left!important
  }
  #nights .row.night:not(.kop) .nachtmaan{
    grid-column:2!important;
    width:100%!important;
    max-width:none!important;
    margin:0!important;
    justify-self:end!important;
    text-align:right!important;
    white-space:normal!important
  }
}
`;

function tel(bron,zoek){return String(bron).split(zoek).length-1;}
function htmlBestanden(dir){
  const uit=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())uit.push(...htmlBestanden(p));
    else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function vervangEen(bron,oud,nieuw,label){
  const oudN=tel(bron,oud),nieuwN=tel(bron,nieuw);
  if(oudN===1&&nieuwN===0)return bron.replace(oud,nieuw);
  if(oudN===0&&nieuwN===1)return bron;
  throw new Error(`${label}: verwacht precies één oude of nieuwe variant; oud=${oudN}, nieuw=${nieuwN}.`);
}
function voegStijlInHeadToe(bron,label){
  const headEinde=bron.indexOf("</head>");
  if(headEinde<0)throw new Error(`${label}: </head> ontbreekt voor desktopafronding.`);
  const bestaand=bron.indexOf(STYLE_MARKER);
  if(bestaand>=0){
    if(bestaand>headEinde)throw new Error(`${label}: desktop-finishing-stijl staat buiten de actieve <head>.`);
    return bron;
  }
  /* release-recovery-finalize voegt later in de body een <noscript><style>
     toe. Een globale lastIndexOf('</style>') koos daardoor dat niet-actieve
     stijlblok en liet de desktopregels bij normale JavaScript-runs ongemerkt
     buiten werking. Zoek daarom uitsluitend vóór </head> naar het laatste
     echte head-stijlblok. */
  const stylePos=bron.lastIndexOf("</style>",headEinde);
  if(stylePos<0)throw new Error(`${label}: geen actief stijlblok in <head> gevonden voor desktopafronding.`);
  return bron.slice(0,stylePos)+STYLE+"\n"+bron.slice(stylePos);
}
function pasTekstAan(html,label="artifact"){
  let bron=String(html||"");
  if(!bron.includes("WeatherNowFinalDesktopUI20260902"))return {html:bron,geraakt:false};
  bron=vervangEen(bron,UREN_OUD,UREN_NIEUW,`${label} desktopuren`);
  bron=vervangEen(bron,MM_OUD,MM_NIEUW,`${label} neerslagnul`);
  if(!bron.includes(MARKER)){
    const anker='const MARKER="final-desktop-ui-20260902";';
    if(tel(bron,anker)!==1)throw new Error(`${label}: runtime-marker ontbreekt of is dubbel.`);
    bron=bron.replace(anker,`${MARKER}\n${anker}`);
  }
  bron=voegStijlInHeadToe(bron,label);
  return {html:bron,geraakt:true};
}
function main(){
  let geraakt=0,geschreven=0;
  for(const p of htmlBestanden(OUT)){
    const voor=fs.readFileSync(p,"utf8"),r=pasTekstAan(voor,path.relative(OUT,p));
    if(!r.geraakt)continue;
    geraakt++;
    if(r.html!==voor){fs.writeFileSync(p,r.html,"utf8");geschreven++;}
  }
  if(!geraakt)throw new Error("Geen WeatherNow-artifacts gevonden voor uurpaneelrefinement.");
  const cache=vernieuwServiceworkerCache(OUT,"hour-panel-refinement-20260907");
  console.log(`Uurpaneelrefinement toegepast op ${geraakt} weerartifacts (${geschreven} gewijzigd): maximaal 12 passende desktopuren, numerieke 0 mm blijft zichtbaar en desktopspacing is aangescherpt; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,STYLE_MARKER,STYLE,UREN_OUD,UREN_NIEUW,MM_OUD,MM_NIEUW,tel,htmlBestanden,vervangEen,voegStijlInHeadToe,pasTekstAan,main};

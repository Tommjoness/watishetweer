"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-live-screenshot-polish-20260912";
const OWNER_ID="wiw-final-ui-polish-20260912";

/* De compacte desktop-uurgrafiek zet 'nu' tijdens het lopende uur bewust op de
   linker grafiekrand. De oudere suppressieregel verwijderde vervolgens ALLE
   modeluurlabels binnen 1,05 kolombreedte. Daarmee verdwenen zowel het uur bij
   de nu-lijn als het eerstvolgende uur (live: 18:00). Alleen het modelpunt dat
   werkelijk het dichtst bij de nu-lijn ligt is redundant; het aangrenzende
   toekomstige uur blijft nuttige forecastinformatie en moet zichtbaar blijven. */
const LABEL_OUD=`  if(nuX!=null){
    for(const [idx] of [...kandKaart.entries()]){
      if(Math.abs(x(idx)-nuX)<cw*1.05) kandKaart.delete(idx);
    }
  }`;
const LABEL_NIEUW=`  if(nuX!=null&&kandKaart.size){
    let dichtst=null,afstand=Infinity;
    for(const [idx] of kandKaart.entries()){
      const d=Math.abs(x(idx)-nuX);
      if(d<afstand){afstand=d;dichtst=idx;}
    }
    /* Verwijder hooguit het ene modeluur dat visueel dezelfde positie als
       'nu' inneemt. Het eerstvolgende uur blijft altijd kandidaat. */
    if(dichtst!==null&&afstand<cw*.6) kandKaart.delete(dichtst);
  }`;

/* Q4 reserveerde op desktop 48 SVG-eenheden tussen plotbodem en regenbracket,
   plus nog 25 eenheden onder het laatste bedraglabel. Bij één regenperiode werd
   een 900x296-grafiek daardoor circa 900x336; de x-as stopte rond y=258 en er
   bleef zichtbaar ~80 px dood vlak over. De bracket/labels krijgen nu alleen op
   het gekoppelde desktopvenster een compact, nog steeds gescheiden ritme. Mobiel,
   tablet, 48 uur en week blijven op de bewezen oude geometrie. */
const REGEN_OUD='  const pb=g.pt+g.ih,y=pb+48,randFont=g.M?8.3:8.9,bedragFont=g.M?8.8:9.4;';
const REGEN_NIEUW=`  const pb=g.pt+g.ih;
  const compactDesktop=typeof window!=="undefined"&&window.innerWidth>=1100&&!g.M&&g.n<=25;
  const y=pb+(compactDesktop?30:48),randFont=g.M?8.3:8.9,bedragFont=g.M?8.8:9.4;`;
const HOOGTE_OUD='  const nieuwH=Math.max(basisH,laatsteBedragY+17+8);';
const HOOGTE_NIEUW='  const nieuwH=Math.max(basisH,laatsteBedragY+(compactDesktop?14:25));';

/* Alleen de resterende screenshot-polish. AQI/pollen wordt hier bewust niet
   aangeraakt: de zojuist gemergede rij en CAMS-copy zijn live goed. */
const CSS=`
@media(min-width:1100px){
  /* De echte Q4-layout bezit nu zelf de compacte hoogte. Neutraliseer uitsluitend
     de historische visuele -6px-transform zodat geometrie en pixels weer één
     bron van waarheid hebben. */
  #chart g[data-q4-rain-periods]{transform:none!important}

  /* Bovenaan iets minder lucht, zonder de rustige masthead te comprimeren. */
  .chips{margin-top:12px!important}
  .brief{margin-top:18px!important;padding-top:18px!important}

  /* De bron/disclaimerregels waren op grote desktop kleiner dan de rest van de
     informatieve microcopy. Een halve stap groter + iets meer regelritme, zonder
     een extra footerblok of nieuwe visuele hiërarchie. */
  footer{font-size:13px!important;line-height:1.5!important;gap:4px 16px!important}
  footer .bron,footer .bron b,footer details,footer details summary,footer a{line-height:1.5!important}

  /* Behoud de zachte overgang, maar halveer ongeveer de lege papierstrook die
     op de live 1600px-screenshot nog als afzonderlijke band leest. */
  body > .seo-plaatsnav{margin-top:10px!important}
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
function aantal(bron,zoek){return String(bron).split(zoek).length-1;}
function vervangExactEen(bron,oud,nieuw,label,rel){
  const n=aantal(bron,oud);
  if(n!==1)throw new Error(rel+": "+label+" ontbreekt of is dubbel: "+n);
  return bron.replace(oud,nieuw);
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    let html=fs.readFileSync(p,"utf8");
    if(!html.includes(`id="${OWNER_ID}"`))continue;
    const rel=path.relative(OUT,p);
    if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": live-screenshot-polish staat al in artifact.");
    if(!html.includes('id="chart"')||!html.includes('id="aq"')||!html.includes("</head>"))throw new Error(rel+": verwachte UI-hooks ontbreken.");

    html=vervangExactEen(html,LABEL_OUD,LABEL_NIEUW,"nu/modeluur-labelsuppressie",rel);
    html=vervangExactEen(html,REGEN_OUD,REGEN_NIEUW,"Q4 desktop regenoffset",rel);
    html=vervangExactEen(html,HOOGTE_OUD,HOOGTE_NIEUW,"Q4 desktop grafiekhoogte",rel);
    html=html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
    fs.writeFileSync(p,html,"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door live-screenshot-polish.");
  const cache=vernieuwServiceworkerCache(OUT,"live-screenshot-polish-20260912");
  console.log("Live-screenshot-polish toegepast op "+geraakt+" weerartifacts; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,LABEL_OUD,LABEL_NIEUW,REGEN_OUD,REGEN_NIEUW,HOOGTE_OUD,HOOGTE_NIEUW,CSS,htmlBestanden,vervangExactEen,main};

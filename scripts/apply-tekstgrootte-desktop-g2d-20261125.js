"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const {OUT,htmlBestanden}=require("./apply-kleur-20261012.js");

/* G2-D: tekst groter op desktop (eigenaar 25 november, optie B; fase G2 van #641).
   Aanleiding: de eigenaar vond de tekst op desktop "erg klein" (24 november).
   Vanaf DESKTOP_VANAF (1100px, het bestaande desktopbreekpunt van de site) wordt
   iedere vaste lettergrootte in px met FACTOR (12,5%) vergroot: gewone tekst
   16 -> 18px, labels 14 -> 16px, de samenvatting 20 -> 22,5px.
   Mobiel en tablet (< 1100px) blijven exact gelijk.

   Werkwijze, generiek en zonder losse uitzonderingen per onderdeel: in iedere
   <style> van iedere pagina krijgt elke regel met een font-size (of font) in px
   direct na zich een kopie met dezelfde selector binnen
   @media (min-width:1100px), met alleen de vergrote waarden. Dezelfde selector
   betekent dezelfde specificiteit en de kopie staat direct na het origineel,
   dus de onderlinge volgorde van alle regels blijft gelijk: wat nu wint, wint
   straks ook, alleen groter. Een vaste line-height in px in dezelfde regel
   schaalt mee, zodat regels niet over elkaar vallen.

   Bewust ongewijzigd:
   - maten vanaf GROOT_VANAF (36px): de grote displaymaten (temperatuur,
     plaatsnaam, aftelgetal, titels) schalen al met de schermbreedte of zijn een
     eerdere keuze van de eigenaar;
   - maten onder KLEIN_TOT (11px): alleen voor schermlezers (sr-only) en
     technische regels;
   - clamp(), vw, em, rem en %: die schalen al mee of volgen hun ouder;
   - regels in @media die op desktop nooit gelden (max-width < 1100px, print),
     @keyframes en @font-face;
   - de grafieken: hun tekst staat als SVG-attribuut met eigen maatvoering.
   De tekstmaattokens --wiw-t-* (gebruikt via font-size:var()) schalen op
   dezelfde manier mee. */
const STYLE_MARKER="wiw-g2d-tekstgrootte-20261125";
const DESKTOP_VANAF=1100;
const FACTOR=1.125;
const KLEIN_TOT=11;
const GROOT_VANAF=36;
const MEDIA=`@media (min-width:${DESKTOP_VANAF}px)`;
const UURTABEL_CSS=`@media (min-width:${DESKTOP_VANAF}px){html body #wiw-hour-table td:first-child,html body #wiw-hour-table th:first-child{width:17%!important}html body #wiw-hour-table td:nth-child(3),html body #wiw-hour-table th:nth-child(3){width:26%!important}}`;

function schaal(px){
  if(!(px>=KLEIN_TOT&&px<GROOT_VANAF))return null;
  const n=Math.round(px*FACTOR*2)/2;
  return n===px?null:n;
}
const getal=n=>String(Math.round(n*100)/100);

/* Splits CSS in topniveau-items, met kennis van commentaar en strings. */
function items(css){
  const uit=[];let i=0,start=0;
  const n=css.length;
  while(i<n){
    const c=css[i];
    if(c==="/"&&css[i+1]==="*"){const e=css.indexOf("*/",i+2);i=e<0?n:e+2;continue;}
    if(c==='"'||c==="'"){i=eindString(css,i);continue;}
    if(c===";"){uit.push({soort:"stmt",tekst:css.slice(start,i+1)});i++;start=i;continue;}
    if(c==="{"){
      const kopEind=i;const e=eindBlok(css,i);
      uit.push({soort:"blok",kop:css.slice(start,kopEind),body:css.slice(kopEind+1,e),tekst:css.slice(start,e+1)});
      i=e+1;start=i;continue;
    }
    if(c==="}")throw new Error("G2-D: onverwachte } in CSS op positie "+i);
    i++;
  }
  if(css.slice(start).trim())uit.push({soort:"rest",tekst:css.slice(start)});
  return uit;
}
function eindString(css,i){
  const q=css[i];let j=i+1;
  while(j<css.length){if(css[j]==="\\"){j+=2;continue;}if(css[j]===q)return j+1;if(css[j]==="\n")return j+1;j++;}
  return j;
}
function eindBlok(css,i){
  let diepte=0,j=i;
  while(j<css.length){
    const c=css[j];
    if(c==="/"&&css[j+1]==="*"){const e=css.indexOf("*/",j+2);j=e<0?css.length:e+2;continue;}
    if(c==='"'||c==="'"){j=eindString(css,j);continue;}
    if(c==="{")diepte++;
    else if(c==="}"){diepte--;if(diepte===0)return j;}
    j++;
  }
  throw new Error("G2-D: CSS-blok zonder sluitende }");
}
/* Declaraties van één regel, gesplitst op ; buiten strings en haakjes. */
function declaraties(body){
  const uit=[];let i=0,start=0,haak=0;
  while(i<body.length){
    const c=body[i];
    if(c==="/"&&body[i+1]==="*"){const e=body.indexOf("*/",i+2);i=e<0?body.length:e+2;continue;}
    if(c==='"'||c==="'"){i=eindString(body,i);continue;}
    if(c==="(")haak++;else if(c===")")haak--;
    else if(c===";"&&haak===0){uit.push(body.slice(start,i));start=i+1;}
    i++;
  }
  uit.push(body.slice(start));
  return uit.map(d=>d.trim()).filter(Boolean);
}

const PX=/^(-?\d*\.?\d+)px$/i;
const TOKEN=/^--wiw-t-[a-z-]+$/;
/* Geeft de vergrote declaraties van een regel terug, of [] als er niets te doen is. */
function vergroteDeclaraties(body){
  const decls=declaraties(body);
  const uit=[];let groter=null;
  for(const d of decls){
    const m=/^([a-z-]+)\s*:\s*([\s\S]*?)\s*(!important)?$/i.exec(d);
    if(!m)continue;
    const eig=m[1].toLowerCase(),waarde=m[2].trim(),imp=m[3]?"!important":"";
    if(TOKEN.test(eig)){
      /* Tekstmaattokens (--wiw-t-*, tokens-PR #653) gebruikt via font-size:var(). */
      const p=PX.exec(waarde);if(!p)continue;
      const s=schaal(parseFloat(p[1]));if(s===null)continue;
      uit.push(`${eig}:${getal(s)}px${imp}`);continue;
    }
    if(eig==="font-size"){
      const p=PX.exec(waarde);if(!p)continue;
      const s=schaal(parseFloat(p[1]));if(s===null)continue;
      uit.push(`font-size:${getal(s)}px${imp}`);groter=true;
    }else if(eig==="font"){
      /* font: [stijl] [gewicht] <maat>[/<regelhoogte>] <familie> */
      const f=/^(.*?)(\d*\.?\d+)px(\s*\/\s*(\d*\.?\d+)(px)?)?(\s+[\s\S]+)$/i.exec(waarde);
      if(!f)continue;
      const s=schaal(parseFloat(f[2]));if(s===null)continue;
      let lh=f[3]||"";
      if(f[3]&&f[5])lh="/"+getal(parseFloat(f[4])*s/parseFloat(f[2]))+"px";
      uit.push(`font:${f[1]}${getal(s)}px${lh}${f[6]}${imp}`);groter=true;
    }
  }
  if(!groter)return uit;
  /* Een vaste regelhoogte in px schaalt mee met de lettergrootte van deze regel. */
  for(const d of decls){
    const m=/^line-height\s*:\s*(-?\d*\.?\d+)px\s*(!important)?$/i.exec(d);
    if(m)uit.push(`line-height:${getal(Math.round(parseFloat(m[1])*FACTOR*2)/2)}px${m[2]?"!important":""}`);
  }
  return uit;
}

/* Kan een @media-voorwaarde op desktop (>= 1100px, scherm) ooit gelden? */
function mediaKanOpDesktop(prelude){
  const p=prelude.toLowerCase();
  if(/\bprint\b/.test(p)&&!/\bscreen\b|\ball\b/.test(p))return false;
  return p.split(",").some(deel=>{
    const max=[...deel.matchAll(/max-width\s*:\s*(\d+(?:\.\d+)?)px/g)].map(x=>parseFloat(x[1]));
    if(max.some(m=>m<DESKTOP_VANAF))return false;
    if(/\bprint\b/.test(deel)&&!/\bscreen\b/.test(deel))return false;
    return true;
  });
}

/* Voegt na iedere regel met een vaste px-lettergrootte de desktopkopie in. */
function vergroot(css){
  let uit="",aantal=0;
  for(const it of items(css)){
    if(it.soort!=="blok"){uit+=it.tekst;continue;}
    /* Commentaar vóór een regel hoort niet bij de selector of de @-regel. */
    const kop=it.kop.replace(/\/\*[\s\S]*?\*\//g,"").trim();
    if(kop.startsWith("@")){
      const naam=(/^@([a-z-]+)/i.exec(kop)||[])[1]?.toLowerCase();
      if(naam==="media"){
        if(!mediaKanOpDesktop(kop.slice(6))){uit+=it.tekst;continue;}
        const r=vergroot(it.body);aantal+=r.aantal;
        uit+=it.kop+"{"+r.css+"}";continue;
      }
      if(naam==="supports"||naam==="layer"||naam==="container"){
        const r=vergroot(it.body);aantal+=r.aantal;
        uit+=it.kop+"{"+r.css+"}";continue;
      }
      uit+=it.tekst;continue; /* @keyframes, @font-face, @page, ... */
    }
    uit+=it.tekst;
    const d=vergroteDeclaraties(it.body);
    if(d.length){uit+=`${MEDIA}{${kop}{${d.join(";")}}}`;aantal++;}
  }
  return {css:uit,aantal};
}

function pasToe(html){
  if(html.includes(STYLE_MARKER))return {html,aantal:0,al:true};
  let totaal=0;
  const nieuw=html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,(m,open,css,sluit)=>{
    const r=vergroot(css);totaal+=r.aantal;return open+r.css+sluit;
  });
  if(!totaal)return {html,aantal:0};
  /* Merkteken voor idempotentie en verificatie, met de enige lay-outaanpassing die
     de grotere tekst nodig heeft: in de uurtabel (vaste kolomverdeling in %) past
     de datum onder middernacht ("do 23 jul") niet meer in de tijdkolom (14%) bij
     1280-1536px. De tijdkolom krijgt 3 procentpunt van de ruime temperatuurkolom
     (29%); de som blijft gelijk. Gemeten met de reviewscripts van G2-D. */
  const metMarker=nieuw.replace("</head>",`<style id="${STYLE_MARKER}">/* G2-D: vaste px-lettergroottes vanaf ${DESKTOP_VANAF}px x${FACTOR}, direct na iedere regel */${UURTABEL_CSS}</style></head>`);
  return {html:metMarker,aantal:totaal};
}

function main(){
  let paginas=0,regels=0;
  for(const p of htmlBestanden(OUT)){
    const rel=path.relative(OUT,p);
    if(rel.startsWith("admin"+path.sep))continue;
    const oud=fs.readFileSync(p,"utf8");
    const r=pasToe(oud);
    if(r.al)continue;
    if(!r.aantal)continue;
    fs.writeFileSync(p,r.html);paginas++;regels+=r.aantal;
  }
  if(paginas<100)throw new Error("G2-D: te weinig pagina's aangepast ("+paginas+"); controleer de build");
  const cache=vernieuwServiceworkerCache(OUT,"tekstgrootte-g2d-20261125");
  console.log(`G2-D tekstgrootte desktop: ${paginas} pagina's, ${regels} regels vanaf ${DESKTOP_VANAF}px x${FACTOR} vergroot; cache ${cache}.`);
  return {paginas,regels,cache};
}

module.exports={main,STYLE_MARKER,UURTABEL_CSS,DESKTOP_VANAF,FACTOR,KLEIN_TOT,GROOT_VANAF,schaal,vergroot,vergroteDeclaraties,mediaKanOpDesktop,pasToe,items};
if(require.main===module)main();

"use strict";

const fs=require("fs"),path=require("path");
const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const MARKER="/* ===== FINAL SPACING POLISH 20260903 ===== */";
const VOORGAANDE_MARKER="/* ===== FINAL VISUAL POLISH 20260902 ===== */";
function eis(c,m){if(!c)throw new Error("Final spacing polish-verificatie: "+m);}
function htmlBestanden(dir){const uit=[];for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())uit.push(...htmlBestanden(p));else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);}return uit;}

const weer=htmlBestanden(OUT).filter(p=>fs.readFileSync(p,"utf8").includes(VOORGAANDE_MARKER));
eis(weer.length>0,"geen finale weerartifacts gevonden");
for(const p of weer){
  const html=fs.readFileSync(p,"utf8"),rel=path.relative(OUT,p);
  eis((html.split(MARKER).length-1)===1,rel+": spacingmarker ontbreekt of staat dubbel");
  eis(html.includes('.dashrow-days h2,.dashrow-days + h2{margin-top:28px!important}'),rel+": ondersectieritme ontbreekt");
  eis(html.includes('#dagenhint,#nachthint,#pollenhint{margin-top:6px!important;margin-bottom:8px!important}'),rel+": onderste hints stapelen nog onnodige ruimte");
  eis(html.includes('align-items:flex-start!important'),rel+": Beste zichtperiode gebruikt geen vaste linkeras");
  eis(html.includes('#nights .row.night .nachtadvies,#nights .row.night .nachtmaan{'),rel+": Nachtzicht-subregels missen gedeelde uitlijning");
  eis(html.includes('text-align:left!important'),rel+": Nachtzicht-subregels zijn niet links geborgd");
  eis(html.includes('footer{\n    margin-top:12px!important;'),rel+": desktopfooter is niet compact gemaakt");
  eis(html.includes('footer .bron,footer .footer-details{min-height:24px!important}'),rel+": desktopfooterhoogte ontbreekt");
  eis(html.includes('min-height:64px!important'),rel+": populaire-plaatsenstrook blijft onnodig hoog");
  eis(html.includes('.seo-plaatsnav a{min-height:28px!important}'),rel+": desktop plaatslinkhoogte ontbreekt");
  eis(html.includes('footer .bron,footer .footer-details{min-height:44px!important}'),rel+": mobiele footertouchdoelen zijn niet 44 px geborgd");
  eis(html.includes('.seo-plaatsnav a{min-height:44px!important}'),rel+": mobiele plaatstouchdoelen zijn niet 44 px geborgd");
}
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,"package.json"),"utf8"));
eis(pkg.scripts.test.includes("apply-final-spacing-polish-20260903.js")&&pkg.scripts.test.includes("browser-final-spacing-polish-20260903.test.js"),"testscript is niet volledig bedraad");
eis(pkg.scripts.postbuild.includes("apply-final-spacing-polish-20260903.js")&&pkg.scripts.postbuild.includes("verify-final-spacing-polish-20260903.js"),"postbuild is niet volledig bedraad");
console.log(`Final spacing polish artifact groen op ${weer.length} weerpagina's: compact onderritme, consistente Nachtzicht-uitlijning en mobiele 44px touchdoelen geborgd.`);

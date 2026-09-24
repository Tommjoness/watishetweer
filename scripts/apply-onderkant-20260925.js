"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-onderkant-20260925";
const OWNER_ID="wiw-leesbaarheid-20260924";

/* Onderkant van de pagina. De voet was een gecentreerd raster: vijf bronnen als
   tegels van 44px in twee kolommen, links met een lijn onderaan hun tapvlak en
   een gecentreerde contactregel. Het SEO-blok en de plaatsenlijst liepen niet op
   de lijnen van de pagina (desktop x=130 tegen x=57, mobiel 8px van de rand) en
   herhaalden de h1 als grote kop. Deze laag maakt er één rustige, links
   uitgelijnde kolom van:
   - bronnen als doorlopende regel achter het label (alleen de gebruikte; dat
     regelt werkBronnenBij in de runtime);
   - disclaimer, links en contact als gewone regels, onderstreept direct onder
     de tekst;
   - SEO-tekst en plaatsen op dezelfde binnenmarge als het vel, met de kop als
     sectielabel zoals Zeven dagen en Nachtzicht.
   Tapdoelen blijven 44px op touch en 24px met muis. De binnenmarges volgen de
   breekpunten van .sheet (16/20/48/56/64px plus 1px rand). Een id-selector in
   :not() geeft deze laatste laag een vaste voorrang op de oudere
   footer:nth-of-type(n)-regels. */
const CSS=`
/* ---------- Voet: één rustige kolom, links uitgelijnd ---------- */
html body footer:not(#wiw-onderkant){display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:flex-start!important;column-gap:20px!important;row-gap:0!important;text-align:left!important;padding:14px 0 6px!important;margin-top:18px!important}
html body footer:not(#wiw-onderkant)>*{margin:0!important;text-align:left!important;justify-content:flex-start!important}
html body footer:not(#wiw-onderkant)>span.bron.bron-bronnen{display:flex!important;flex-wrap:wrap!important;align-items:center!important;column-gap:16px!important;row-gap:0!important;width:100%!important;flex:0 0 100%!important;grid-template-columns:none!important;padding:0!important;border:0!important}
html body footer:not(#wiw-onderkant) .bron-bronnen .bronlabel{display:inline-flex!important;align-items:center;min-height:24px;margin:0!important;padding:0!important;font-size:11px!important;font-weight:500;letter-spacing:.12em!important;text-transform:uppercase!important;color:var(--ink-70)!important;grid-column:auto!important;width:auto!important;border:0!important}
html body footer:not(#wiw-onderkant) .bron-bronnen .bronitem{display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;width:auto!important;min-height:24px!important;margin:0!important;padding:0!important;border:0!important;grid-column:auto!important}
html body footer:not(#wiw-onderkant) .bron-bronnen .bronitem[hidden]{display:none!important}
html body footer:not(#wiw-onderkant) .bron-bronnen .bronitem a{display:inline-flex!important;align-items:center;min-height:24px!important;padding:0!important;border:0!important;width:auto!important;justify-content:flex-start!important}
html body footer:not(#wiw-onderkant)>span.bron:nth-of-type(2){flex:0 0 100%!important;width:100%!important;margin:6px 0 4px!important;font-size:12px!important;line-height:1.45!important;color:var(--ink-45)!important;max-width:none!important}
html body footer:not(#wiw-onderkant)>span.bron:nth-of-type(n+3),html body footer:not(#wiw-onderkant)>details.footer-details,html body footer:not(#wiw-onderkant)>.footer-contact{flex:0 0 auto!important;width:auto!important;display:inline-flex!important;align-items:center!important;min-height:24px!important;border:0!important;padding:0!important}
html body footer:not(#wiw-onderkant)>span.bron:nth-of-type(n+3) a,html body footer:not(#wiw-onderkant)>details.footer-details>summary,html body footer:not(#wiw-onderkant) .footer-contact a{display:inline-flex!important;align-items:center;min-height:24px!important;border:0!important;padding:0!important;width:auto!important}
html body footer:not(#wiw-onderkant)>.footer-contact{flex-wrap:wrap!important;column-gap:4px!important}
html body footer:not(#wiw-onderkant)>.footer-contact .footer-contact-question,html body footer:not(#wiw-onderkant)>.footer-contact .footer-contact-mail{display:inline!important;width:auto!important}
html body footer:not(#wiw-onderkant)>details.footer-details[open]{flex:0 0 100%!important;flex-wrap:wrap}
html body footer:not(#wiw-onderkant)>details.footer-details #coords{display:block;width:100%;font-size:12px!important}
/* Weergave: op dezelfde lijn als de voet */
html body .wiw-weergave-voet:not(#wiw-onderkant){justify-content:flex-start!important;margin-top:6px!important;padding-top:10px!important;padding-bottom:0!important}
@media (pointer:coarse),(max-width:900px){
  html body footer:not(#wiw-onderkant) .bron-bronnen .bronlabel{flex:0 0 100%!important;min-height:0!important;margin-top:2px!important}
  html body footer:not(#wiw-onderkant) .bron-bronnen .bronitem,html body footer:not(#wiw-onderkant) .bron-bronnen .bronitem a,
  html body footer:not(#wiw-onderkant)>span.bron:nth-of-type(n+3),html body footer:not(#wiw-onderkant)>span.bron:nth-of-type(n+3) a,
  html body footer:not(#wiw-onderkant)>details.footer-details,html body footer:not(#wiw-onderkant)>details.footer-details>summary,
  html body footer:not(#wiw-onderkant)>.footer-contact,html body footer:not(#wiw-onderkant) .footer-contact a{min-height:44px!important}
}

/* ---------- SEO-blok en plaatsen: zelfde kolom als de pagina ---------- */
html body .seo-route-context,html body .seo-plaatsnav{box-sizing:border-box!important}
html body .seo-route-context{padding-left:49px!important;padding-right:49px!important;padding-top:18px!important;padding-bottom:10px!important}
html body .seo-plaatsnav-inner{padding-left:48px!important;padding-right:48px!important}
@media(max-width:900px){html body .seo-route-context{padding-left:21px!important;padding-right:21px!important}html body .seo-plaatsnav-inner{padding-left:21px!important;padding-right:21px!important}}
@media(max-width:430px){html body .seo-route-context{padding-left:17px!important;padding-right:17px!important}html body .seo-plaatsnav-inner{padding-left:17px!important;padding-right:17px!important}}
@media(min-width:1100px){html body .seo-route-context{max-width:none!important;width:100%!important;margin-left:0!important;margin-right:0!important;padding-left:57px!important;padding-right:57px!important}html body .seo-plaatsnav-inner{padding-left:56px!important;padding-right:56px!important}}
@media(min-width:1500px){html body .seo-route-context{padding-left:65px!important;padding-right:65px!important}html body .seo-plaatsnav-inner{padding-left:64px!important;padding-right:64px!important}}
/* Kop als sectielabel, zoals Zeven dagen en Nachtzicht: de h1 staat al bovenaan */
html body .seo-route-context h2{font-family:var(--sans)!important;font-size:11px!important;font-weight:500!important;letter-spacing:.14em!important;text-transform:uppercase!important;color:var(--ink-70)!important;line-height:1.3!important;margin:10px 0 4px!important;padding:0!important;border:0!important}
html body .seo-breadcrumb{max-width:none!important;margin:0!important}
html body .seo-route-context p{max-width:72ch!important;color:var(--ink-70)!important}
html body .seo-route-nearby{display:flex!important;flex-wrap:wrap!important;align-items:center!important;column-gap:16px!important;margin-top:8px!important}
html body .seo-route-nearby-kop{font-size:12px!important;font-weight:600!important;margin:0!important}
html body .seo-route-nearby-links{display:flex!important;flex-wrap:wrap!important;column-gap:16px!important;row-gap:0!important}
/* Populaire plaatsen: één doorlopende rij links */
html body .seo-plaatsnav-kop{font-family:var(--sans)!important;font-size:11px!important;font-weight:500!important;letter-spacing:.14em!important;text-transform:uppercase!important;color:var(--ink-70)!important;text-align:left!important}
@media(max-width:900px){
  html body .seo-plaatsnav-links{display:flex!important;flex-wrap:wrap!important;justify-content:flex-start!important;column-gap:18px!important;row-gap:0!important;grid-template-columns:none!important}
  html body .seo-plaatsnav-links a{justify-content:flex-start!important;text-align:left!important;width:auto!important;border:0!important;padding:0!important;min-height:44px!important;display:inline-flex!important;align-items:center!important}
  html body .seo-plaatsnav-links a:nth-child(n+7):not(.seo-plaatsnav-alles){display:none!important}
  html body .seo-plaatsnav-links a.seo-plaatsnav-alles{grid-column:auto!important;font-weight:600!important}
  html body .seo-plaatsnav-inner>div:first-child{text-align:left!important}
}
/* Links in de voet: onderstreping direct onder de tekst in plaats van een rand
   onderaan een tapvlak van 44px */
html body footer:not(#wiw-onderkant) a,html body footer:not(#wiw-onderkant)>details.footer-details>summary{border-bottom:0!important;box-shadow:none!important;text-decoration:underline!important;text-decoration-color:var(--rule)!important;text-decoration-thickness:1px!important;text-underline-offset:3px!important;font-size:12px!important;color:var(--ink-70)!important}
html body footer:not(#wiw-onderkant) a:hover,html body footer:not(#wiw-onderkant)>details.footer-details>summary:hover{text-decoration-color:currentColor!important;color:var(--ink)!important}
html body footer:not(#wiw-onderkant)>details.footer-details>summary{list-style:none;cursor:pointer}
html body .wiw-weergave-voet:not(#wiw-onderkant) .wiw-weergave-label{text-align:left!important}
@media(max-width:900px){html body .wiw-weergave-voet:not(#wiw-onderkant) .wiw-weergave-label{flex:0 0 100%}}
html body .seo-route-nearby-links a,html body .seo-plaatsnav-links a,html body .seo-breadcrumb a{text-underline-offset:3px}
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
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": onderkantlaag staat al in artifact.");
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
  if(!geraakt)throw new Error("Geen weerartifact geraakt door onderkantlaag.");
  const cache=vernieuwServiceworkerCache(OUT,"onderkant-20260925");
  console.log("Onderkantlaag toegepast op "+geraakt+" weerartifacts: compacte links uitgelijnde voet, bronnen op één regel, SEO-blok en plaatsen in de paginakolom; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CSS,htmlBestanden,pasToe,main};

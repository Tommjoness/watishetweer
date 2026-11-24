"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const {OUT,htmlBestanden,gebundeldeWeerpagina}=require("./apply-kleur-20261012.js");
const {LOGO}=require("./apply-sitekop-20261124.js");
const VOET_STYLE_ID=require("./apply-voet.js").STYLE_ID;
const MENU_STYLE_ID=require("./apply-menu-20261119.js").STYLE_ID;

/* Kop van de weerpagina's (K2, eigenaar 24 november; fase E van #641).
   Dezelfde opbouw als de gedeelde kop van de subpagina's (K1):
   - in de bovenbalk links het menu en daarnaast het logo (zonneboog met rode
     stip, optie D) met de naam "watishetweer.nl";
   - de snelkoppeling "☾ Nachtzicht" verdwijnt uit de bovenbalk (eigenaar
     24 november): Nachtzicht staat in het menu onder "Sterren en nacht";
   - Licht/Auto/Donker verhuist ongewijzigd (zelfde #thema-blok, ids, labels,
     themaruntime en opslag) van de bovenbalk naar het menu, onder de vier
     groepen (keuze 1a);
   - op de homepage blijft de h1 "watishetweer.nl" voor zoekmachines en
     schermlezers, maar is hij niet meer zichtbaar: het logo staat er al;
   - de zijbalk vanaf 1904px heet "Snel naar", is breder (276px: drie vakjes
     van minstens 86px voor Licht/Auto/Donker, indeling-browser.test.js) en
     toont alle groepen uitgeklapt (menuruntime); de weergavekeuze staat eronder;
   - het uitklapmenu (onder 1904px) krijgt een schaduw en dimt de pagina
     erachter, zodat het niet meer los over de inhoud hangt (eigenaar 24 nov.).
   Werkt zonder JavaScript: het menu is een <details>. */
const STYLE_ID="wiw-weerkop-k2-20261124";
const BALK_OPEN='<div class="wiw-bovenbalk">';
const SNEL=/<a class="wiw-snel-nachtzicht" href="#nachtzicht"><span class="wiw-snel-icoon" aria-hidden="true">☾<\/span>Nachtzicht<\/a>/;
const WEERGAVE_OPEN='<div class="wiw-weergave-boven">';
const MENU_EIND="</nav></details>";
const NAV_OPEN='<nav class="wiw-menu-paneel" aria-label="Menu">';
const RAIL_KOP='<p class="wiw-rail-kop" aria-hidden="true">Snel naar</p>';
const MERK=`<a class="wiw-sk-merk wiw-weer-merk" href="/" translate="no" aria-label="watishetweer.nl">${LOGO}<span>watishetweer.nl</span></a>`;
const H1_HOME="<h1>watishetweer.nl</h1>";
const H1_HOME_VERBORGEN='<h1 class="wiw-h1-verborgen">watishetweer.nl</h1>';

const CSS=`
/* Bovenbalk: menu links, logo ernaast; geen weergavekeuze en geen Nachtzicht-link meer in de balk. */
.wiw-bovenbalk{--wiw-sk-lijn:var(--rule,#cfd6d0);--wiw-sk-stip:var(--carmine,#a0203a);justify-content:flex-start!important;flex-wrap:nowrap!important;column-gap:14px!important}
html[data-thema="donker"] .wiw-bovenbalk{--wiw-sk-stip:#d2455d}
@media(prefers-color-scheme:dark){html:not([data-thema="licht"]) .wiw-bovenbalk{--wiw-sk-stip:#d2455d}}
.wiw-weer-merk{display:inline-flex;align-items:center;gap:9px;min-height:44px;color:var(--ink);text-decoration:none;font:500 21px/1 var(--display,"Newsreader",Georgia,serif);letter-spacing:-.01em;white-space:nowrap}
.wiw-weer-merk:hover span{text-decoration:underline;text-underline-offset:4px}
.wiw-weer-merk .wiw-sk-logo{flex:none;display:block}
@media(min-width:901px){.wiw-weer-merk{min-height:36px}}
@media(min-width:901px) and (pointer:coarse){.wiw-weer-merk{min-height:44px}}
@media(max-width:600px){.wiw-weer-merk{font-size:19px}}
@media(max-width:345px){.wiw-weer-merk{font-size:17px}.wiw-weer-merk .wiw-sk-logo{width:28px}}
/* Weergavekeuze in het menupaneel, onder de groepen (zelfde opmaak als de gedeelde kop van de subpagina's). */
html body .wiw-bovenbalk .wiw-menu-paneel .wiw-weergave-boven{display:block;flex:none;margin:0;min-width:0;border-top:1px solid var(--rule);padding:12px 0 14px}
html body .wiw-bovenbalk .wiw-menu-paneel .wiw-weergave-label{display:block;margin:0 0 8px;font:600 13px/1 var(--sans);letter-spacing:0;text-transform:none;color:var(--ink-70)}
/* Breedte zo dat de binnenmaat (zonder de rand van 2 × 1px) deelbaar is door drie: drie gelijke vakjes
   zonder afrondingsrest, zodat de licht/donker-schakelaar precies de hele driewegbediening overspant
   (preview-responsive-visual-browser.js, ≤2px verschil). Zonder round() blijft width:100% gelden. */
html body .wiw-bovenbalk .wiw-menu-paneel #thema.wiw-theme-control.wiw-theme-segmented-20260915{width:100%!important;width:calc(round(down,100% - 2px,3px) + 2px)!important;min-width:0!important;max-width:100%!important}
/* 320px: smallere binnenmarge in het paneel, zodat Licht/Auto/Donker met woorden minstens 242px breed blijft
   (contract menu-browser.test.js, zoals voorheen in de bovenbalk). */
@media(max-width:345px){html body .wiw-bovenbalk .wiw-menu-paneel{padding-left:10px;padding-right:10px}}
/* Homepage: h1 blijft in de pagina (zoekmachines, schermlezers), het logo is de zichtbare naam. */
.wiw-h1-verborgen{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important}
/* Uitklapmenu: schaduw en een gedimde pagina erachter (niet in de zijbalk). Klik erbuiten sluit (menuruntime). */
html:not(.wiw-menu-rail) .wiw-bovenbalk .wiw-menu-paneel{box-shadow:0 18px 48px rgba(20,32,25,.18),0 2px 6px rgba(20,32,25,.08)}
html:not(.wiw-menu-rail) .wiw-bovenbalk .wiw-menu[open]::after{content:"";position:fixed;inset:0;z-index:55;background:rgba(20,32,25,.22);pointer-events:none}
html[data-thema="donker"]:not(.wiw-menu-rail) .wiw-bovenbalk .wiw-menu[open]::after{background:rgba(0,0,0,.5)}
@media(prefers-color-scheme:dark){html:not([data-thema="licht"]):not(.wiw-menu-rail) .wiw-bovenbalk .wiw-menu[open]::after{background:rgba(0,0,0,.5)}}
.wiw-bovenbalk .wiw-menu>summary{position:relative;z-index:61}
/* Zijbalk vanaf 1904px: "Snel naar", 276px breed, alle groepen open (menuruntime). */
.wiw-rail-kop{display:none}
@media(min-width:1904px){
  html.wiw-menu-rail .wiw-rail-kop{display:block;margin:4px 0 6px;font:500 22px/1.2 var(--display,"Newsreader",Georgia,serif);color:var(--ink)}
  html.wiw-menu-rail .wiw-menu-paneel{width:276px}
  html.wiw-menu-rail .wiw-menu-kop{cursor:default}
  html.wiw-menu-rail .wiw-menu-kop::before{display:none}
  html.wiw-menu-rail .wiw-menu-paneel ul{padding-left:0}
  html.wiw-menu-rail body>.sheet:not(#wiw-desktop-premium),
  html.wiw-menu-rail body>.seo-plaatsnav:not(#wiw-desktop-premium),
  html.wiw-menu-rail body>.seo-route-context:not(#wiw-desktop-premium){margin-left:max(292px,calc(50vw - 800px))!important}
}
`;

function eenmaal(html,deel,rel,naam){
  const n=html.split(deel).length-1;
  if(n!==1)throw new Error(`${rel}: ${naam} komt ${n} keer voor (verwacht 1).`);
}

/* Het blok <div class="wiw-weergave-boven">…</div> (met geneste divs) uit de bovenbalk knippen. */
function knipWeergave(html,rel){
  const start=html.indexOf(WEERGAVE_OPEN);
  let diepte=0,i=start;
  const re=/<div\b|<\/div>/g;re.lastIndex=start;
  let m;
  while((m=re.exec(html))){
    diepte+=m[0]==="</div>"?-1:1;
    if(diepte===0){i=m.index+6;break;}
  }
  if(diepte!==0)throw new Error(rel+": weergaveblok in de bovenbalk niet afgesloten.");
  const blok=html.slice(start,i);
  if(!blok.includes('id="thema"'))throw new Error(rel+": weergaveblok bevat #thema niet.");
  return {blok,rest:html.slice(0,start)+html.slice(i)};
}

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": weerkop K2 staat al in artifact.");
  eenmaal(html,BALK_OPEN,rel,"bovenbalk");
  eenmaal(html,WEERGAVE_OPEN,rel,"weergaveblok");
  eenmaal(html,NAV_OPEN,rel,"menupaneel");
  eenmaal(html,`<style id="${VOET_STYLE_ID}">`,rel,"voetlaag");
  eenmaal(html,`<style id="${MENU_STYLE_ID}">`,rel,"menulaag");
  if((html.match(new RegExp(SNEL.source,"g"))||[]).length!==1)throw new Error(rel+": Nachtzicht-snelkoppeling niet precies eenmaal.");
  const balk=html.indexOf(BALK_OPEN),weergave=html.indexOf(WEERGAVE_OPEN),menuEind=html.indexOf(MENU_EIND,balk);
  if(!(balk<menuEind&&menuEind<weergave))throw new Error(rel+": verwacht menu vóór de weergavekeuze in de bovenbalk.");
  let {blok,rest:uit}=knipWeergave(html,rel);
  uit=uit.replace(SNEL,"");
  uit=uit.replace(NAV_OPEN,NAV_OPEN+RAIL_KOP);
  const eind=uit.indexOf(MENU_EIND,uit.indexOf(BALK_OPEN));
  uit=uit.slice(0,eind)+blok+MENU_EIND+MERK+uit.slice(eind+MENU_EIND.length);
  if(uit.includes(H1_HOME))uit=uit.replace(H1_HOME,H1_HOME_VERBORGEN);
  /* Na de menulaag, vóór de voetlaag (die blijft de laatste stijllaag). */
  uit=uit.replace(`<style id="${VOET_STYLE_ID}">`,`<style id="${STYLE_ID}">\n${CSS}\n</style>\n<style id="${VOET_STYLE_ID}">`);
  return uit;
}

function main(){
  let geraakt=0,home=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8");
    if(!gebundeldeWeerpagina(html))continue;
    const uit=pasToe(html,path.relative(OUT,p));
    if(uit.includes(H1_HOME_VERBORGEN))home++;
    fs.writeFileSync(p,uit,"utf8");
    geraakt++;
  }
  if(geraakt<100)throw new Error("Te weinig weerpagina's geraakt door de weerkop (K2): "+geraakt);
  if(home<1)throw new Error("Homepage-h1 niet gevonden.");
  const cache=vernieuwServiceworkerCache(OUT,"weerkop-k2-20261124");
  console.log(`Weerkop K2 toegepast op ${geraakt} weerpagina's: menu en logo in de bovenbalk, weergavekeuze in het menu, Nachtzicht-snelkoppeling weg, h1 alleen voor zoekmachines op ${home} pagina('s); cache ${cache}.`);
  return {geraakt,home,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,CSS,MERK,RAIL_KOP,pasToe,main};

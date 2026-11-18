"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const {OUT,htmlBestanden,gebundeldeWeerpagina}=require("./apply-kleur-20261012.js");
const {knipThema}=require("./apply-first-screen-20260924.js");
const VOET_STYLE_ID=require("./apply-voet.js").STYLE_ID;

/* Bovenbalk (18 november, eigenaarsbesluit). De weergavekeuze stond sinds
   24 september onder de footer (wiw-first-screen-20260924): bezoekers moesten
   helemaal naar beneden scrollen om licht of donker te kiezen, en Nachtzicht
   stond op desktop pas onder de vouw. Beide staan nu in één smalle balk boven
   de kop van iedere weerpagina.

   - De balk staat in .sheet, vóór de kop en buiten #app: #app is onzichtbaar
     tot de weerdata er is, en ook bij een laadfout moet je de weergave kunnen
     kiezen (dezelfde reden als bij de voet).
   - Het bestaande #thema-blok verhuist ongewijzigd: ids, rollen, labels en
     gedrag (themaruntime, sessieopslag, vertaling) blijven gelijk.
   - "Nachtzicht" springt naar de kop van het blok Nachtzicht, die daarvoor het
     anker #nachtzicht krijgt. De linktekst is het bestaande woord, zodat de
     Engelse vertaling ("Stargazing") vanzelf meegaat.
   - Tot en met 900px staat de balk bovenaan in het vel en kost hij één rij
     van 44px; op een telefoon valt het label "Weergave" weg en zijn licht en
     donker symbolen, zodat link en keuze naast elkaar passen.
   - Vanaf 901px heeft de pagina 32px papier boven het vel. Daar staat de balk,
     absoluut ten opzichte van .sheet: hij neemt geen ruimte in, dus kop,
     tegels en grafiek staan exact waar ze stonden (indeling-browser.test.js
     eist de grafiek bij 1366×768 met waarschuwing op hooguit y=690). De
     binnenmarge erft hij van .sheet, zodat hij op elke breedte op dezelfde
     lijnen uitlijnt. Met muis zijn de knoppen 28px hoog (huisregel ≥24px), met 2px lucht boven en onder;
     op een aanraakscherm 44px, en dan wordt het papier boven het vel
     zo veel hoger als nodig. */
const STYLE_ID="wiw-bovenbalk-20261118";
const BALK_CLASS="wiw-bovenbalk";
const VOET_LEEG='<div class="wiw-weergave-voet"><span class="wiw-weergave-label" aria-hidden="true">Weergave</span></div>';
const MAST='<div class="mast" role="banner">';
const NACHTKOP='<div class="chartkop nachtkop">';

const CSS=`
.${BALK_CLASS}{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px 16px;margin:0 0 12px;padding:0 0 8px;border-bottom:1px solid var(--rule-soft)}
.${BALK_CLASS} .wiw-snel-nachtzicht{display:inline-flex;align-items:center;gap:7px;min-height:44px;font-family:var(--sans);font-size:14px;font-weight:500;line-height:1.2;color:var(--ink-70);text-decoration:none}
.${BALK_CLASS} .wiw-snel-nachtzicht:hover{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.${BALK_CLASS} .wiw-snel-icoon{font-size:15px;line-height:1}
.${BALK_CLASS} .wiw-weergave-boven{display:flex;align-items:center;gap:12px;margin-left:auto}
.${BALK_CLASS} .wiw-weergave-label{font-family:var(--sans);font-size:13px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-45)}
.${BALK_CLASS} #thema{color:var(--ink-70)!important;opacity:1!important}
html body .${BALK_CLASS} #thema.wiw-theme-control.wiw-theme-segmented-20260915{width:276px!important;min-width:276px!important;min-height:44px!important;outline:1px solid var(--rule);outline-offset:-1px}
.${BALK_CLASS} #thema.wiw-theme-segmented-20260915 #thema-switch,.${BALK_CLASS} #thema.wiw-theme-segmented-20260915 .wiw-theme-auto{min-height:44px!important}
.${BALK_CLASS} #thema.wiw-theme-segmented-20260915 .wiw-theme-icon{height:44px!important}
#nachtzicht{scroll-margin-top:72px}
@media(max-width:430px){
  /* Telefoon: label weg en licht/donker als symbool (☀/☾), zodat link en keuze
     op één rij passen. De toegankelijke namen staan op de knoppen zelf en
     veranderen niet; de woorden waren alleen zichtbare opmaak (::after). */
  .${BALK_CLASS} .wiw-weergave-label{display:none}
  html body .${BALK_CLASS} #thema.wiw-theme-control.wiw-theme-segmented-20260915{width:180px!important;min-width:180px!important}
  html body .${BALK_CLASS} #thema.wiw-theme-segmented-20260915 .wiw-theme-sun::after,html body .${BALK_CLASS} #thema.wiw-theme-segmented-20260915 .wiw-theme-moon::after{content:none!important;display:none!important}
}
@media(min-width:901px){
  .sheet{position:relative}
  .${BALK_CLASS}{position:absolute;top:-33px;left:0;right:0;height:32px;margin:0;padding:0;padding-left:inherit;padding-right:inherit;border:0;flex-wrap:nowrap}
  .${BALK_CLASS} .wiw-snel-nachtzicht{min-height:28px}
  html body .${BALK_CLASS} #thema.wiw-theme-control.wiw-theme-segmented-20260915{min-height:28px!important;height:28px!important}
  html body .${BALK_CLASS} #thema.wiw-theme-segmented-20260915 #thema-switch,html body .${BALK_CLASS} #thema.wiw-theme-segmented-20260915 .wiw-theme-auto{min-height:28px!important;height:28px!important}
  html body .${BALK_CLASS} #thema.wiw-theme-segmented-20260915 .wiw-theme-icon{height:28px!important}
}
@media(min-width:901px) and (pointer:coarse){
  html body{padding-top:46px!important}
  .${BALK_CLASS}{top:-45px;height:44px}
  .${BALK_CLASS} .wiw-snel-nachtzicht{min-height:44px}
  html body .${BALK_CLASS} #thema.wiw-theme-control.wiw-theme-segmented-20260915,html body .${BALK_CLASS} #thema.wiw-theme-segmented-20260915 #thema-switch,html body .${BALK_CLASS} #thema.wiw-theme-segmented-20260915 .wiw-theme-auto{min-height:44px!important;height:44px!important}
  html body .${BALK_CLASS} #thema.wiw-theme-segmented-20260915 .wiw-theme-icon{height:44px!important}
}
@media(max-width:340px){
  /* Op de smalste telefoons past de keuze niet naast de link: eigen rij, volle breedte. */
  .${BALK_CLASS} .wiw-weergave-boven{flex:1 1 100%}
  html body .${BALK_CLASS} #thema.wiw-theme-control.wiw-theme-segmented-20260915{width:100%!important;min-width:0!important}
}
`;

function balk(themaBlok){
  return `<div class="${BALK_CLASS}"><a class="wiw-snel-nachtzicht" href="#nachtzicht"><span class="wiw-snel-icoon" aria-hidden="true">☾</span>Nachtzicht</a><div class="wiw-weergave-boven"><span class="wiw-weergave-label" aria-hidden="true">Weergave</span>${themaBlok}</div></div>`;
}

function eenmaal(html,deel,rel,naam){
  const n=html.split(deel).length-1;
  if(n!==1)throw new Error(`${rel}: ${naam} komt ${n} keer voor (verwacht 1).`);
}

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": bovenbalk staat al in artifact.");
  eenmaal(html,MAST,rel,"kop (.mast)");
  eenmaal(html,NACHTKOP,rel,"Nachtzichtkop");
  eenmaal(html,`<style id="${VOET_STYLE_ID}">`,rel,"voetlaag");
  if(html.includes('id="nachtzicht"'))throw new Error(rel+": anker #nachtzicht bestaat al.");
  const {blok,rest}=knipThema(html,rel);
  eenmaal(rest,VOET_LEEG,rel,"lege Weergave-regel onder de footer");
  let uit=rest.replace(VOET_LEEG,"");
  uit=uit.replace(MAST,`${balk(blok)}\n  ${MAST}`);
  uit=uit.replace(NACHTKOP,'<div class="chartkop nachtkop" id="nachtzicht">');
  /* Vóór de voetlaag, zodat die de laatste stijllaag blijft (verify-voet). */
  uit=uit.replace(`<style id="${VOET_STYLE_ID}">`,`<style id="${STYLE_ID}">\n${CSS}\n</style>\n<style id="${VOET_STYLE_ID}">`);
  return uit;
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8");
    if(!gebundeldeWeerpagina(html))continue;
    fs.writeFileSync(p,pasToe(html,path.relative(OUT,p)),"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerpagina geraakt door de bovenbalk.");
  const cache=vernieuwServiceworkerCache(OUT,"bovenbalk-20261118");
  console.log(`Bovenbalk toegepast op ${geraakt} weerpagina's: weergavekeuze en Nachtzicht bovenaan; cache ${cache}.`);
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,BALK_CLASS,CSS,balk,pasToe,main};

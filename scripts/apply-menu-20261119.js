"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const {OUT,START,htmlBestanden,weerBestand,gebundeldeWeerpagina}=require("./apply-kleur-20261012.js");
const {seizoenRang}=require("./seo-foundation.js");
const {SEIZOENSPAGINAS}=require("./seizoenspagina.config.js");
const NZ=require("./nachtzicht.config.js");
const BOVENBALK_STYLE_ID=require("./apply-bovenbalk-20261118.js").STYLE_ID;
const VOET_STYLE_ID=require("./apply-voet.js").STYLE_ID;

/* Menu en zijbalk (UI PR #2, ontwerpgoedkeuring eigenaar 19 november).

   Fase "runtime" (vóór de bundeling, net als de kleurlaag): zet het kleine
   menugedrag (Escape, buiten klikken, zijbalkmodus) in het inline script,
   zodat het in de gedeelde app-bundle meegaat (CSP script-src 'self').

   Fase "stijl" (na de bovenbalk): op iedere gebundelde weerpagina
   - één menu (<details id="wiw-menu">) als eerste element van de bovenbalk,
     met vier groepen: Weer en plaatsen, Sterren en nacht, Seizoenen en
     feestdagen, Over en informatie. Alleen bestaande routes en ankers;
   - de seizoenslinks en de links naar Sterren kijken en De maan vandaag gaan
     uit de footer naar het menu. Bronnen, disclaimer, Over, Privacy,
     technische locatiegegevens en contact blijven in de footer. Plaatscontext
     en populaire plaatsen blijven ongewijzigd.
   - Licht/Auto/Donker blijft op dezelfde plek in de bovenbalk.
   Alle menulinks staan als gewone <a href> in de statische HTML (crawlbaar). */
const MARKER="/* ===== MENU 20261119 ===== */";
const RUNTIME=fs.readFileSync(path.join(__dirname,"menu-20261119.js"),"utf8");
const STYLE_ID="wiw-menu-20261119";
const BALK_OPEN='<div class="wiw-bovenbalk">';
const SEIZOEN_SPAN=/[ \t]*<span class="bron seizoen-link[^"]*"><a href="[^"]+">[^<]+<\/a><\/span>\s*/g;

function esc(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

/* Seizoenen in dezelfde volgorde als de footer ze tot nu toe kreeg: lopend of
   eerstvolgend bovenaan (seo-foundation.js, op de builddag). */
function seizoenen(vandaag){
  return [...SEIZOENSPAGINAS].map((p,i)=>({p,i,r:seizoenRang(p,vandaag)}))
    .sort((a,b)=>a.r-b.r||a.i-b.i).map(({p})=>({href:`/${p.slug}/`,naam:p.naam}));
}

function groep(id,kop,links){
  return `<div class="wiw-menu-groep"><p class="wiw-menu-kop" id="wiw-menu-${id}">${esc(kop)}</p><ul aria-labelledby="wiw-menu-${id}">`+
    links.map(l=>`<li><a href="${esc(l.href)}">${esc(l.naam)}</a></li>`).join("")+`</ul></div>`;
}

function menuHtml(vandaag){
  return `<details class="wiw-menu" id="wiw-menu"><summary class="wiw-menu-knop"><span class="wiw-menu-icoon" aria-hidden="true">☰</span><span class="wiw-menu-tekst">Menu</span></summary>`+
    `<nav class="wiw-menu-paneel" aria-label="Menu">`+
    groep("weer","Weer en plaatsen",[{href:"/",naam:"Actueel weer"},{href:"/weer/",naam:"Weer per plaats"}])+
    groep("nacht","Sterren en nacht",[{href:"#nachtzicht",naam:"Nachtzicht vanavond"},{href:NZ.BASIS,naam:"Sterren kijken"},{href:NZ.MAAN,naam:"De maan vandaag"}])+
    groep("seizoen","Seizoenen en feestdagen",seizoenen(vandaag))+
    groep("info","Over en informatie",[{href:"/over/",naam:"Over deze site"},{href:"/privacy",naam:"Privacy & gegevens"},{href:"mailto:support@watishetweer.nl",naam:"Contact"}])+
    `</nav></details>`;
}

const CSS=`
/* Tot 900px staat de bovenbalk in het vel; vanaf 901px blijft hij absoluut op het papier (bovenbalklaag). */
@media(max-width:900px){.wiw-bovenbalk{position:relative}}
.wiw-menu{flex:0 0 auto}
.wiw-menu>summary{list-style:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:46px;min-height:46px;padding:0 14px;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);font-family:var(--sans);font-size:14px;font-weight:500;line-height:1;cursor:pointer;-webkit-user-select:none;user-select:none}
.wiw-menu>summary::-webkit-details-marker{display:none}
.wiw-menu>summary::marker{content:""}
.wiw-menu>summary:hover{border-color:var(--ink-45)}
.wiw-menu[open]>summary{border-color:var(--ink)}
.wiw-menu-icoon{font-size:17px;line-height:1}
.wiw-menu-paneel{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:60;display:grid;grid-template-columns:minmax(0,1fr);gap:16px 28px;padding:16px 18px 18px;background:var(--sheet);border:1px solid var(--rule);max-height:calc(100vh - 140px);max-height:calc(100dvh - 140px);overflow:auto;overscroll-behavior:contain;text-align:left}
.wiw-menu-kop{margin:0 0 4px;font-family:var(--sans);font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-45)}
.wiw-menu-paneel ul{list-style:none;margin:0;padding:0}
.wiw-menu-paneel a{display:flex;align-items:center;min-height:44px;color:var(--ink);text-decoration:none;font-family:var(--sans);font-size:15px;line-height:1.25;overflow-wrap:anywhere}
.wiw-menu-paneel a:hover,.wiw-menu-paneel a:focus-visible{text-decoration:underline;text-underline-offset:3px}
@media(max-width:480px){
  /* Telefoon: menuknop naast Licht/Auto/Donker op één rij; de keuze vult de rest. */
  html body .wiw-bovenbalk .wiw-weergave-boven{flex:1 1 0%;min-width:0}
}
@media(max-width:419px),(min-width:481px) and (max-width:559px){
  /* Waar Licht/Auto/Donker (met woorden minstens 242px) anders niet meer naast de knop past: alleen het symbool; "Menu" blijft de naam van de knop. */
  .wiw-menu-tekst{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
  .wiw-menu>summary{padding:0}
}
@media(max-width:345px){
  /* 320px: de keuze heeft met woorden minstens 242px nodig; menu op een eigen rij (eigenaar 19 november). */
  html body .wiw-bovenbalk .wiw-weergave-boven{flex:1 1 100%}
}
@media(min-width:481px){
  .wiw-menu-paneel{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(min-width:481px) and (max-width:900px){
  /* Menu, Nachtzicht en de keuze naast elkaar: de keuze mag tot 242px smaller worden. */
  .wiw-bovenbalk{column-gap:12px}
  html body .wiw-bovenbalk #thema.wiw-theme-control.wiw-theme-segmented-20260915{width:auto!important;min-width:242px!important;flex:0 1 276px}
  html body .wiw-bovenbalk .wiw-weergave-boven{min-width:0;flex:0 1 auto}
}
@media(min-width:901px){
  /* Het uitklappaneel hangt onder de knop (niet onder de rand van het vel). */
  .wiw-menu{position:relative}
  .wiw-menu>summary{min-height:36px;height:36px}
  .wiw-menu-paneel{right:auto;top:calc(100% + 4px);width:780px;max-width:calc(100vw - 48px);grid-template-columns:repeat(4,minmax(0,1fr))}
  .wiw-menu-paneel a{min-height:34px}
}
@media(min-width:901px) and (pointer:coarse){
  /* Aanraakscherm op desktopbreedte: dezelfde 44px-doelen als Licht/Auto/Donker in de 48px-balk. */
  .wiw-menu>summary{min-height:44px;height:44px}
  .wiw-menu-paneel a{min-height:44px}
}
@media(min-width:1904px){
  /* Zijbalk: hetzelfde menu, permanent open (wiw-menu-rail via de menulaag). */
  .wiw-menu>summary{display:none}
  html.wiw-menu-rail .wiw-menu-paneel{position:fixed;top:48px;left:8px;right:auto;width:136px;display:block;padding:3px;border:0;box-sizing:border-box;background:transparent;max-height:calc(100vh - 64px);max-height:calc(100dvh - 64px);overflow:auto}
  html.wiw-menu-rail .wiw-menu-groep+.wiw-menu-groep{margin-top:22px}
  html.wiw-menu-rail .wiw-menu-kop{font-size:12px;letter-spacing:.08em;line-height:1.35;margin-bottom:2px}
  html.wiw-menu-rail .wiw-menu-paneel a{min-height:30px;font-size:14px;color:var(--ink-70)}
  html.wiw-menu-rail .wiw-menu-paneel a:hover{color:var(--ink)}
}
@media(min-width:1904px) and (pointer:coarse){
  html.wiw-menu-rail .wiw-menu-paneel a{min-height:44px}
}
`;

function eenmaal(html,deel,rel,naam){const n=html.split(deel).length-1;if(n!==1)throw new Error(`${rel}: ${naam} komt ${n} keer voor (verwacht 1).`);}

function pasRuntimeToe(html,rel){
  if(html.includes(MARKER))throw new Error(rel+": menuruntime staat al in artifact.");
  eenmaal(html,START,rel,"startmarker");
  const uit=html.replace(START,MARKER+"\n"+RUNTIME+"\n"+START);
  [...uit.matchAll(/<script(?![^>]*\ssrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g)]
    .forEach((m,i)=>new vm.Script(m[1],{filename:rel+":menu-"+(i+1)}));
  return uit;
}

function pasStijlToe(html,rel,menu){
  if(html.includes(`id="${STYLE_ID}"`)||html.includes('id="wiw-menu"'))throw new Error(rel+": menu staat al in artifact.");
  eenmaal(html,BALK_OPEN,rel,"bovenbalk");
  eenmaal(html,`<style id="${VOET_STYLE_ID}">`,rel,"voetlaag");
  eenmaal(html,`<style id="${BOVENBALK_STYLE_ID}">`,rel,"bovenbalklaag");
  const voetStart=html.indexOf("<footer"),voetEind=html.indexOf("</footer>",voetStart);
  if(voetStart<0||voetEind<0||html.indexOf("<footer",voetStart+1)>=0)throw new Error(rel+": footer ontbreekt of is dubbel.");
  const voet=html.slice(voetStart,voetEind);
  const weg=voet.match(SEIZOEN_SPAN)||[];
  if(weg.length!==SEIZOENSPAGINAS.length+2)throw new Error(`${rel}: verwacht ${SEIZOENSPAGINAS.length+2} seizoens/nachtlinks in de footer, gevonden ${weg.length}.`);
  for(const v of ["Over deze site","Privacy &amp; gegevens","footer-details","mailto:support@watishetweer.nl","Weersinformatie is algemeen"])
    if(!voet.includes(v))throw new Error(`${rel}: footer mist '${v}'.`);
  let uit=html.slice(0,voetStart)+voet.replace(SEIZOEN_SPAN,"")+html.slice(voetEind);
  uit=uit.replace(BALK_OPEN,BALK_OPEN+menu);
  /* Na de bovenbalklaag, vóór de voetlaag (die blijft de laatste stijllaag). */
  uit=uit.replace(`<style id="${VOET_STYLE_ID}">`,`<style id="${STYLE_ID}">\n${CSS}\n</style>\n<style id="${VOET_STYLE_ID}">`);
  return uit;
}

function main(fase){
  if(fase!=="runtime"&&fase!=="stijl")throw new Error("Gebruik: apply-menu-20261119.js runtime|stijl");
  const menu=fase==="stijl"?menuHtml():null;
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8"),rel=path.relative(OUT,p);
    if(fase==="runtime"){if(!weerBestand(html))continue;fs.writeFileSync(p,pasRuntimeToe(html,rel),"utf8");}
    else{if(!gebundeldeWeerpagina(html))continue;fs.writeFileSync(p,pasStijlToe(html,rel,menu),"utf8");}
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerpagina geraakt door de menulaag ("+fase+").");
  if(fase==="runtime"){console.log(`Menuruntime toegevoegd aan ${geraakt} weerpagina's.`);return {geraakt};}
  const cache=vernieuwServiceworkerCache(OUT,"menu-20261119");
  console.log(`Menu toegepast op ${geraakt} weerpagina's: vier groepen in de bovenbalk, zijbalk vanaf 1904px, seizoens- en nachtlinks uit de footer; cache ${cache}.`);
  return {geraakt,cache};
}

if(require.main===module)main(process.argv[2]);
module.exports={OUT,MARKER,RUNTIME,STYLE_ID,CSS,menuHtml,seizoenen,pasRuntimeToe,pasStijlToe,main};

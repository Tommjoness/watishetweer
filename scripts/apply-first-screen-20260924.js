"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-first-screen-20260924";
const OWNER_ID="wiw-ui-ux-audit-polish-20260913";
const VOET_CLASS="wiw-weergave-voet";
const VOET_OPEN=`<div class="${VOET_CLASS}"><span class="wiw-weergave-label" aria-hidden="true">Weergave</span>`;

/* Eerste scherm. Op een telefoon stond boven de temperatuur eerst een blok
   bediening: zoeken, Mijn locatie en Ververs op twee rijen, de thema-keuze op
   een derde rij, dan tijdstempel en bewaren/delen. Op desktop begon de grafiek
   pas onder de vouw, na drie rijen hoge tegels en een lege band boven de tegels.

   - De thema-keuze is een instelling, geen dagelijkse handeling. Ze verhuist
     bij de build (niet in de browser, dus zonder layoutverschuiving) naar een
     eigen regel "Weergave" direct onder de footer, buiten #app zodat hij ook
     bij een laadfout bruikbaar blijft. Ids, rollen en gedrag blijven gelijk.
   - Mobiel: Mijn locatie en Ververs worden icoonknoppen van 44px naast het
     zoekveld. Hun toegankelijke naam blijft de bestaande tekst of aria-label.
   - Desktop: tegels compacter, minder lucht boven de grafiek, plaatsnaam links
     uitgelijnd onder de h1, en de uurtabel herhaalt de sectiekop "Komende uren"
     alleen nog voor schermlezers. */
const ICOON_LOCATIE="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round'%3E%3Ccircle cx='12' cy='12' r='6.5'/%3E%3Ccircle cx='12' cy='12' r='2' fill='black' stroke='none'/%3E%3Cpath d='M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3'/%3E%3C/svg%3E";
const ICOON_VERVERS="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M19.5 12a7.5 7.5 0 1 1-2.2-5.3'/%3E%3Cpath d='M19.5 4.5v4.2h-4.2'/%3E%3C/svg%3E";

const CSS=`
.${VOET_CLASS}{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px 14px;margin:18px auto 6px;padding-top:14px;border-top:1px solid var(--rule-soft)}
.${VOET_CLASS} .wiw-weergave-label{font-family:var(--sans);font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-45)}
.${VOET_CLASS} #thema{color:var(--ink-70)!important;opacity:1!important}
@media(max-width:430px){
  .${VOET_CLASS}{flex-direction:column;gap:8px}
  html body .${VOET_CLASS} #thema.wiw-theme-control.wiw-theme-segmented-20260915{width:100%!important;max-width:340px!important;outline:1px solid var(--rule);outline-offset:-1px}
}
@media(min-width:431px){
  html body .${VOET_CLASS} #thema.wiw-theme-control.wiw-theme-segmented-20260915{width:216px!important;min-height:44px!important;outline:1px solid var(--rule);outline-offset:-1px}
  .${VOET_CLASS} #thema.wiw-theme-segmented-20260915 #thema-switch,.${VOET_CLASS} #thema.wiw-theme-segmented-20260915 .wiw-theme-auto{min-height:44px!important}
  .${VOET_CLASS} #thema.wiw-theme-segmented-20260915 .wiw-theme-icon{height:44px!important}
}
@media(max-width:900px){
  html body .tools{grid-template-columns:minmax(0,1fr) 46px 46px!important}
  html body .tools>input[type=text]{grid-column:1!important;grid-row:1!important;border-bottom:0!important;border-right:1px solid var(--rule)!important;min-width:0}
  html body .tools>#here,html body .tools>#ververs{grid-row:1!important;display:flex!important;align-items:center!important;justify-content:center!important;width:46px!important;min-width:46px!important;min-height:46px!important;padding:0!important;font-size:0!important;letter-spacing:0!important;border:0!important;background:transparent!important;color:var(--ink)!important;opacity:1!important}
  html body .tools>#here{grid-column:2!important;border-right:1px solid var(--rule)!important}
  html body .tools>#ververs{grid-column:3!important}
  html body .tools>#here::before,html body .tools>#ververs::before{content:"";display:block;width:21px;height:21px;background:currentColor;-webkit-mask:var(--wiw-icoon) center/contain no-repeat;mask:var(--wiw-icoon) center/contain no-repeat}
  html body .tools>#here{--wiw-icoon:url("${ICOON_LOCATIE}")}
  html body .tools>#ververs{--wiw-icoon:url("${ICOON_VERVERS}")}
  html body .tools>#here .here-prefix{display:none!important}
  html body .tools>#here:disabled,html body .tools>#ververs:disabled{color:var(--ink-25)!important}
}
@media(min-width:1100px){
  /* Plaatsnaam en h1 delen één linkerlijn; de tijd blijft er compact naast. */
  html body #place{justify-content:flex-start!important;padding-left:0!important;padding-right:0!important}
  /* Tegels: minder verticale lucht, zelfde inhoud en volgorde. */
  html body .final-top-grid>.stats .stat{min-height:0!important;padding-top:11px!important;padding-bottom:12px!important}
  html body .final-top-grid>.stats .stat .eyebrow{margin-bottom:4px!important;letter-spacing:.06em!important}
  /* Het langste woord, LUCHTVOCHTIGHEID, is bij 12px en .06em 136px breed. */
  html body .final-top-grid>.stats .stat{padding-left:10px!important;padding-right:10px!important}
  html body .dashrow-chart .chartkop{margin-top:22px!important}
  /* De sectiekop boven grafiek en uurtabel zegt al "Komende uren". */
  html body #wiw-hour-title{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important}
}
@media(min-width:1360px) and (max-width:1599px){
  /* Vanaf 1360px passen vier tegels per rij (tegelkop minstens 142px breed),
     zoals al vanaf 1600px: twee rijen in plaats van drie, zodat de grafiek
     boven de vouw begint. */
  html body .final-top-grid>.stats{grid-template-columns:repeat(4,minmax(0,1fr))!important}
  html body .final-top-grid>.stats .stat{grid-column:auto!important;padding-left:8px!important;padding-right:8px!important;border-right:1px solid var(--rule)!important}
  html body .final-top-grid>.stats .stat:nth-child(3n){border-right:1px solid var(--rule)!important}
  html body .final-top-grid>.stats .stat:nth-child(4n){border-right:none!important}
  html body .final-top-grid>.stats .stat:nth-child(7),html body .final-top-grid>.stats .stat:nth-child(8){grid-column:auto!important}
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

/* Knipt het volledige <div id="thema">…</div>-blok uit, inclusief geneste divs. */
function knipThema(html,rel){
  const start=html.indexOf('<div id="thema"');
  if(start<0||html.indexOf('<div id="thema"',start+1)>=0)throw new Error(rel+": thema-blok ontbreekt of is dubbel.");
  const tag=/<\/?div\b[^>]*>/g;tag.lastIndex=start;
  let diepte=0,m;
  while((m=tag.exec(html))){
    diepte+=m[0][1]==="/"?-1:1;
    if(diepte===0)return {blok:html.slice(start,tag.lastIndex),rest:html.slice(0,start).replace(/[ \t]*$/,"")+html.slice(tag.lastIndex)};
  }
  throw new Error(rel+": thema-blok sluit niet.");
}

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": eerste-schermlaag staat al in artifact.");
  for(const hook of ['class="tools"','id="here"','id="ververs"','id="place"']){
    if(!html.includes(hook))throw new Error(rel+": verwachte UI-hook ontbreekt: "+hook);
  }
  if((html.split("</footer>").length-1)!==1)throw new Error(rel+": footereinde ontbreekt of is dubbel.");
  if((html.split("</main>").length-1)!==1)throw new Error(rel+": einde van main ontbreekt of is dubbel.");
  const {blok,rest}=knipThema(html,rel);
  const tools=rest.indexOf('<div class="tools">'),res=rest.indexOf('<div class="results" id="res"');
  if(tools<0||res<0||res<tools)throw new Error(rel+": zoekbalk heeft onverwachte opbouw.");
  /* Na </main>, niet in de footer: #app blijft onzichtbaar tot de weerdata er
     is, en ook bij een laadfout moet je de weergave kunnen kiezen. */
  let uit=rest.replace("</main>",`</main>\n  ${VOET_OPEN}${blok}</div>`);
  uit=uit.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
  return uit;
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8");
    if(!html.includes(`id="${OWNER_ID}"`))continue;
    fs.writeFileSync(p,pasToe(html,path.relative(OUT,p)),"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door eerste-schermlaag.");
  const cache=vernieuwServiceworkerCache(OUT,"first-screen-20260924");
  console.log("Eerste-schermlaag toegepast op "+geraakt+" weerartifacts: thema-keuze onder de footer, mobiele icoonknoppen, compacte desktoptegels; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,VOET_CLASS,CSS,htmlBestanden,knipThema,pasToe,main};

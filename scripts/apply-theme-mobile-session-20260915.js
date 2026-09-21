"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const {autoThemaOpZon}=require("./theme-solar.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-theme-mobile-session-20260915";
const THEMA_START="/* ---------- thema ---------- */";
const THEMA_EIND="/* ---------- stempel en verversen ---------- */";
const THEMA_SESSIE_KEY="weerbriefing.thema.sessie";
const THEMA_LEGACY_KEY="weerbriefing.thema";

/*
 * De bestaande Auto + licht/donker-switch blijft semantisch intact voor alle
 * viewports en voor bestaande release-/toegankelijkheidscontracten. De bediening
 * wordt visueel als één duidelijke driewegkeuze gepresenteerd: ☀ LICHT | AUTO |
 * ☾ DONKER. De zon- en maanhelft zijn al afzonderlijk klikbaar via
 * data-thema-handmatig; de verborgen track blijft alleen het bestaande
 * switchcontract dragen.
 *
 * Een handmatige keuze is voortaan sessiegebonden. De oude localStorage-key wordt
 * bij iedere nieuwe documentstart genegeerd/verwijderd, zodat een Licht-keuze van
 * gisteren een bezoeker 's nachts niet opnieuw in licht opent. Binnen dezelfde
 * browsersessie blijft de keuze via sessionStorage behouden. localStorage krijgt
 * alleen een compatibiliteitsmirror voor bestaande subnavigatie en tests; die
 * mirror is nooit de bron voor de weather-pagina en wordt bij de volgende
 * documentstart eerst verwijderd.
 */
const CSS=`
/* Desktop en tablet krijgen dezelfde rustige driewegcompositie als mobiel. De
   bestaande DOM/runtime blijft bewust ongewijzigd: Auto blijft een eigen knop,
   Licht en Donker blijven de twee klikzones binnen de semantische switch. */
@media(min-width:431px){
  html body #thema.wiw-theme-control.wiw-theme-segmented-20260915{
    display:grid!important;
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
    align-items:stretch!important;
    justify-content:stretch!important;
    width:192px!important;
    min-width:0!important;
    min-height:36px!important;
    padding:0!important;
    border:1px solid var(--rule)!important;
    border-radius:0!important;
    overflow:hidden!important;
    background:var(--sheet)!important;
    vertical-align:middle!important;
    position:relative!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-auto{
    grid-column:2!important;
    grid-row:1!important;
    z-index:2!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    min-width:0!important;
    min-height:36px!important;
    padding:0 6px!important;
    border:0!important;
    border-left:1px solid var(--rule)!important;
    border-right:1px solid var(--rule)!important;
    background:transparent!important;
    color:var(--ink-45)!important;
    font-family:var(--sans)!important;
    font-size:10px!important;
    font-weight:500!important;
    letter-spacing:.055em!important;
    line-height:1!important;
    text-align:center!important;
    text-transform:uppercase!important;
    white-space:nowrap!important;
    box-shadow:none!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-auto:hover,
  #thema.wiw-theme-segmented-20260915 .wiw-theme-auto:focus-visible{
    background:var(--paper)!important;
    color:var(--ink)!important;
  }
  #thema.wiw-theme-segmented-20260915 #thema-switch{
    grid-column:1!important;
    grid-row:1!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    position:relative!important;
    align-items:stretch!important;
    justify-content:stretch!important;
    min-width:0!important;
    min-height:36px!important;
    padding:0!important;
    gap:0!important;
    border:0!important;
    background:transparent!important;
    color:var(--ink-45)!important;
    font-family:var(--sans)!important;
    font-size:10px!important;
    font-weight:500!important;
    letter-spacing:.055em!important;
    line-height:1!important;
    text-align:center!important;
    text-transform:uppercase!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    box-shadow:none!important;
  }
  #thema.wiw-theme-segmented-20260915 #thema-switch:hover,
  #thema.wiw-theme-segmented-20260915 #thema-switch:focus-visible{
    background:transparent!important;
    color:var(--ink)!important;
  }
  #thema.wiw-theme-segmented-20260915:has(#thema-switch:focus-visible){
    outline:2px solid var(--ink)!important;
    outline-offset:2px!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-icon{
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    width:auto!important;
    height:36px!important;
    min-width:0!important;
    margin:0!important;
    padding:0 6px!important;
    color:var(--ink-45)!important;
    font-family:var(--sans)!important;
    font-size:10px!important;
    font-weight:500!important;
    letter-spacing:.055em!important;
    line-height:1!important;
    text-transform:uppercase!important;
    white-space:nowrap!important;
    box-shadow:none!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-icon:hover{
    background:var(--paper)!important;
    color:var(--ink)!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-sun{grid-column:1!important}
  #thema.wiw-theme-segmented-20260915 .wiw-theme-moon{
    position:absolute!important;
    left:200%!important;
    top:0!important;
    width:100%!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-sun::after{content:"Licht";margin-left:8px}
  #thema.wiw-theme-segmented-20260915 .wiw-theme-moon::after{content:"Donker";margin-left:8px}
  /* De track blijft meetbaar voor het bestaande switch-/a11y-contract, maar is
     visueel niet meer nodig zodra de twee expliciete segmenten zichtbaar zijn. */
  #thema.wiw-theme-segmented-20260915 .wiw-theme-track{
    position:absolute!important;
    left:50%!important;
    top:50%!important;
    width:32px!important;
    height:18px!important;
    margin:0!important;
    transform:translate(-50%,-50%)!important;
    opacity:0!important;
    pointer-events:none!important;
  }
  #thema.wiw-theme-segmented-20260915[data-actieve-thema-keuze="auto"] .wiw-theme-auto,
  #thema.wiw-theme-segmented-20260915[data-actieve-thema-keuze="licht"] .wiw-theme-sun,
  #thema.wiw-theme-segmented-20260915[data-actieve-thema-keuze="donker"] .wiw-theme-moon{
    background:var(--paper)!important;
    color:var(--ink)!important;
    font-weight:500!important;
    box-shadow:inset 0 -1px 0 var(--ink-45)!important;
  }
}
@media(min-width:431px) and (max-width:900px){
  /* Tabletbreedtes blijven volwaardig tappable, zonder de compacte desktopmaat
     te laten terugvallen op een krappe 36px-rij. */
  html body #thema.wiw-theme-control.wiw-theme-segmented-20260915{
    width:180px!important;
    min-height:44px!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-auto,
  #thema.wiw-theme-segmented-20260915 #thema-switch{min-height:44px!important}
  #thema.wiw-theme-segmented-20260915 .wiw-theme-icon{height:44px!important}
}
@media(max-width:430px){
  .tools{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
  }
  .tools > input[type=text]{grid-column:1 / -1!important}
  .tools > #here{grid-column:1!important}
  .tools > #ververs{grid-column:2!important;border-right:0!important}
  html body #thema.wiw-theme-control.wiw-theme-segmented-20260915{
    grid-column:1 / -1!important;
    display:grid!important;
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
    align-items:stretch!important;
    justify-content:stretch!important;
    width:100%!important;
    min-width:0!important;
    min-height:46px!important;
    padding:0!important;
    border:0!important;
    border-top:1px solid var(--rule)!important;
    border-radius:0!important;
    overflow:hidden!important;
    background:var(--sheet)!important;
    position:relative!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-auto{
    grid-column:2!important;
    grid-row:1!important;
    z-index:2!important;
    min-width:0!important;
    min-height:46px!important;
    padding:0 10px!important;
    border:0!important;
    border-left:1px solid var(--rule)!important;
    border-right:1px solid var(--rule)!important;
    background:transparent!important;
    color:var(--ink-45)!important;
    font-family:var(--sans)!important;
    font-size:11px!important;
    font-weight:500!important;
    letter-spacing:.055em!important;
    line-height:1!important;
    text-transform:uppercase!important;
    white-space:nowrap!important;
    box-shadow:none!important;
  }
  #thema.wiw-theme-segmented-20260915 #thema-switch{
    grid-column:1!important;
    grid-row:1!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    position:relative!important;
    min-width:0!important;
    min-height:46px!important;
    padding:0!important;
    gap:0!important;
    border:0!important;
    background:transparent!important;
    overflow:hidden!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-icon{
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    width:auto!important;
    height:46px!important;
    min-width:0!important;
    margin:0!important;
    padding:0 8px!important;
    color:var(--ink-45)!important;
    font-family:var(--sans)!important;
    font-size:11px!important;
    font-weight:500!important;
    letter-spacing:.055em!important;
    line-height:1!important;
    text-transform:uppercase!important;
    white-space:nowrap!important;
    box-shadow:none!important;
  }
  #thema.wiw-theme-segmented-20260915:has(#thema-switch:focus-visible){
    outline:2px solid var(--ink)!important;
    outline-offset:2px!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-sun{grid-column:1!important}
  #thema.wiw-theme-segmented-20260915 .wiw-theme-moon{
    position:absolute!important;
    left:200%!important;
    top:0!important;
    width:100%!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-sun::after{content:"Licht";margin-left:8px}
  #thema.wiw-theme-segmented-20260915 .wiw-theme-moon::after{content:"Donker";margin-left:8px}
  /* De track blijft meetbaar voor het bestaande switch-/a11y-contract, maar is
     visueel niet meer nodig zodra de twee expliciete segmenten zichtbaar zijn. */
  #thema.wiw-theme-segmented-20260915 .wiw-theme-track{
    position:absolute!important;
    left:50%!important;
    top:50%!important;
    width:32px!important;
    height:18px!important;
    margin:0!important;
    transform:translate(-50%,-50%)!important;
    opacity:0!important;
    pointer-events:none!important;
  }
  #thema.wiw-theme-segmented-20260915[data-actieve-thema-keuze="auto"] .wiw-theme-auto,
  #thema.wiw-theme-segmented-20260915[data-actieve-thema-keuze="licht"] .wiw-theme-sun,
  #thema.wiw-theme-segmented-20260915[data-actieve-thema-keuze="donker"] .wiw-theme-moon{
    background:var(--paper)!important;
    color:var(--ink)!important;
    font-weight:500!important;
    box-shadow:inset 0 -1px 0 var(--ink-45)!important;
  }
}
@media(max-width:350px){
  #thema.wiw-theme-segmented-20260915 .wiw-theme-icon{
    padding-inline:5px!important;
    font-size:10px!important;
    letter-spacing:.035em!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-auto{
    padding-inline:5px!important;
    font-size:10px!important;
    letter-spacing:.035em!important;
  }
  #thema.wiw-theme-segmented-20260915 .wiw-theme-sun::after,
  #thema.wiw-theme-segmented-20260915 .wiw-theme-moon::after{margin-left:6px}
}
`;

const autoThemaRuntime=autoThemaOpZon.toString();
const WEATHER_RUNTIME=`${THEMA_START}
const THEMA_KEUZES=["auto","licht","donker"];
const THEMA_SESSIE_KEY=${JSON.stringify(THEMA_SESSIE_KEY)};
const THEMA_LEGACY_KEY=${JSON.stringify(THEMA_LEGACY_KEY)};
const THEMA_ACTIEF_KEY="weerbriefing.actiefThema";
${autoThemaRuntime}
try{localStorage.removeItem(THEMA_LEGACY_KEY);}catch(e){}
function themaKeuze(){
  let keuze="auto";
  try{
    const raw=sessionStorage.getItem(THEMA_SESSIE_KEY);
    keuze=raw==null?"auto":JSON.parse(raw);
  }catch(e){keuze="auto";}
  if(THEMA_KEUZES.includes(keuze))return keuze;
  try{sessionStorage.removeItem(THEMA_SESSIE_KEY);}catch(e){}
  return "auto";
}
function themaKeuzeOpslaan(keuze){
  const veilig=THEMA_KEUZES.includes(keuze)?keuze:"auto";
  try{sessionStorage.setItem(THEMA_SESSIE_KEY,JSON.stringify(veilig));}catch(e){}
  /* Compatibiliteitsmirror voor de bestaande /weer/-subnavigatie. Deze waarde
     wordt bij iedere nieuwe weather-documentstart vóór uitlezen verwijderd. */
  try{ls.set(THEMA_LEGACY_KEY,veilig);}catch(e){}
  return veilig;
}
function themaActief(keuze){
  if(keuze==="licht"||keuze==="donker")return keuze;
  return autoThemaOpZon(S.d,weatherNowActueleLokaleTijd());
}
function themaStatusBijwerken(keuze,actief){
  const groep=document.getElementById("thema");
  if(!groep)return;
  const autoKnop=document.getElementById("thema-auto"),schakelaar=document.getElementById("thema-switch");
  groep.dataset.actieveThemaKeuze=keuze;
  groep.dataset.effectieveThema=actief;
  const stand=actief==="donker"?"Donker":"Licht";
  groep.setAttribute("aria-label","Weergave kiezen. Huidige stand: "+(keuze==="auto"?"automatisch ("+stand+")":stand)+".");
  if(autoKnop)autoKnop.setAttribute("aria-pressed",keuze==="auto"?"true":"false");
  if(schakelaar){
    const donker=actief==="donker";
    schakelaar.setAttribute("aria-checked",donker?"true":"false");
    schakelaar.setAttribute("aria-label",keuze==="auto"
      ?"Automatisch; nu "+stand+". Kies Licht of Donker voor deze browsersessie."
      :"Handmatig "+stand+" voor deze browsersessie. Klik om "+(donker?"Licht":"Donker")+" te kiezen.");
    schakelaar.title=keuze==="auto"
      ?"Automatisch; nu "+stand+". Kies Licht of Donker voor deze browsersessie."
      :"Huidige handmatige keuze: "+stand+" (deze browsersessie).";
  }
}
function themaToepassen(){
  const keuze=themaKeuze(),actief=themaActief(keuze);
  document.documentElement.setAttribute("data-thema",actief);
  try{localStorage.setItem(THEMA_ACTIEF_KEY,JSON.stringify(actief));}catch(e){}
  /* Houd de bestaande subnavigatie binnen deze sessie synchroon, zonder deze
     mirror ooit als bron voor een volgende sessie te gebruiken. */
  try{ls.set(THEMA_LEGACY_KEY,keuze);}catch(e){}
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute("content",actief==="donker"?"#0B120F":"#F4F5F3");
  themaStatusBijwerken(keuze,actief);
}
const themaGroep=document.getElementById("thema"),themaAutoKnop=document.getElementById("thema-auto"),themaSchakelaar=document.getElementById("thema-switch");
if(themaGroep&&themaAutoKnop&&themaSchakelaar){
  themaAutoKnop.addEventListener("click",()=>{
    themaKeuzeOpslaan("auto");
    themaToepassen();
    themaAutoKnop.focus();
  });
  themaSchakelaar.addEventListener("click",e=>{
    const expliciet=e.target.closest("[data-thema-handmatig]");
    const handmatig=expliciet?expliciet.dataset.themaHandmatig:null;
    const huidig=themaActief(themaKeuze());
    themaKeuzeOpslaan(handmatig||(huidig==="donker"?"licht":"donker"));
    themaToepassen();
  });
  themaGroep.addEventListener("keydown",e=>{
    const opties=[themaAutoKnop,themaSchakelaar],i=opties.indexOf(document.activeElement);
    if(i<0)return;
    if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
      e.preventDefault();
      opties[(i+(e.key==="ArrowRight"?1:-1)+opties.length)%opties.length].focus();
    }else if(e.key==="Home"){e.preventDefault();opties[0].focus();
    }else if(e.key==="End"){e.preventDefault();opties[opties.length-1].focus();}
  });
}
themaToepassen();`;

const HUB_RUNTIME=`(()=>{"use strict";
  const PREF="weerbriefing.thema",SESSIE=${JSON.stringify(THEMA_SESSIE_KEY)},ACTIEF="weerbriefing.actiefThema";
  const leesLocal=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw==null?fallback:JSON.parse(raw);}catch(e){return fallback;}};
  const schrijfLocal=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}};
  const leesSessie=()=>{try{const raw=sessionStorage.getItem(SESSIE);const v=raw==null?"auto":JSON.parse(raw);return ["auto","licht","donker"].includes(v)?v:"auto";}catch(e){return "auto";}};
  const schrijfSessie=value=>{try{sessionStorage.setItem(SESSIE,JSON.stringify(value));}catch(e){}};
  try{localStorage.removeItem(PREF);}catch(e){}
  const voorkeur=leesSessie();
  const systeemDonker=typeof matchMedia==="function"&&matchMedia("(prefers-color-scheme: dark)").matches;
  const begin=voorkeur==="donker"?"donker":voorkeur==="licht"?"licht":systeemDonker?"donker":"licht";
  const zet=(actief,bewaar)=>{
    if(actief==="donker")document.documentElement.setAttribute("data-thema","donker");else document.documentElement.removeAttribute("data-thema");
    schrijfLocal(ACTIEF,actief);
    if(bewaar)schrijfSessie(actief);
    schrijfLocal(PREF,bewaar?actief:voorkeur);
    const knop=document.getElementById("thema");
    if(knop){const donker=actief==="donker";knop.setAttribute("aria-checked",donker?"true":"false");knop.title=donker?"Schakel lichte weergave in":"Schakel donkere weergave in";knop.setAttribute("aria-label",donker?"Donkere weergave, schakel licht in":"Lichte weergave, schakel donker in");}
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",actief==="donker"?"#0B120F":"#F4F5F3");
  };
  zet(begin,false);
  document.addEventListener("DOMContentLoaded",()=>{const knop=document.getElementById("thema");if(!knop)return;zet(document.documentElement.getAttribute("data-thema")==="donker"?"donker":"licht",false);knop.addEventListener("click",()=>zet(document.documentElement.getAttribute("data-thema")==="donker"?"licht":"donker",true));},{once:true});
})();\n`;

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
function patchWeatherHtml(bron,rel){
  let html=String(bron||"");
  if(!html.includes('id="app"')||!html.includes('id="thema-auto"')||!html.includes('id="thema-switch"'))return {html,geraakt:false};
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": mobiele themalaag staat al in artifact.");
  const groep='<div id="thema" class="wiw-theme-control" role="group" aria-label="Weergave kiezen">';
  if(tel(html,groep)!==1)throw new Error(rel+": verwachte themagroep ontbreekt of is dubbel.");
  html=html.replace(groep,'<div id="thema" class="wiw-theme-control wiw-theme-segmented-20260915" role="group" aria-label="Weergave kiezen">');
  const s=html.indexOf(THEMA_START),e=html.indexOf(THEMA_EIND);
  if(s<0||e<=s)throw new Error(rel+": themaruntime-ankers ontbreken of staan in verkeerde volgorde.");
  if(html.indexOf(THEMA_START,s+1)!==-1||html.indexOf(THEMA_EIND,e+1)!==-1)throw new Error(rel+": themaruntime-ankers zijn dubbel.");
  html=html.slice(0,s)+WEATHER_RUNTIME+"\n"+html.slice(e);
  if(!html.includes("</head>"))throw new Error(rel+": headafsluiting ontbreekt.");
  html=html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
  return {html,geraakt:true};
}
function valideerWeatherHtml(html,rel){
  const segment=String(html).slice(String(html).indexOf(THEMA_START),String(html).indexOf(THEMA_EIND));
  if(!segment.includes(`const THEMA_SESSIE_KEY=${JSON.stringify(THEMA_SESSIE_KEY)}`))throw new Error(rel+": sessiekey ontbreekt.");
  if(!segment.includes("sessionStorage.getItem(THEMA_SESSIE_KEY)")||!segment.includes("sessionStorage.setItem(THEMA_SESSIE_KEY"))throw new Error(rel+": handmatige voorkeur is niet sessiegebonden.");
  if(segment.includes('ls.get("weerbriefing.thema"'))throw new Error(rel+": oude localStorage-voorkeur wordt nog gelezen.");
  if(!segment.includes("localStorage.removeItem(THEMA_LEGACY_KEY)"))throw new Error(rel+": oude persistente voorkeur wordt niet geneutraliseerd.");
  if(!segment.includes("return autoThemaOpZon(S.d,weatherNowActueleLokaleTijd());"))throw new Error(rel+": Auto gebruikt niet langer locatiegebonden zonetijden.");
  for(const marker of [
    'grid-template-columns:repeat(2,minmax(0,1fr))!important',
    'grid-column:1 / -1!important',
    'grid-template-columns:repeat(3,minmax(0,1fr))!important',
    'grid-template-columns:subgrid!important',
    '@media(min-width:431px)',
    'width:192px!important',
    'grid-column:1 / 4!important',
    '.wiw-theme-auto{\n    grid-column:2!important',
    '.wiw-theme-moon{\n    grid-column:3!important',
    '.wiw-theme-sun::after{content:"Licht";margin-left:8px}',
    '.wiw-theme-moon::after{content:"Donker";margin-left:8px}',
    'min-height:46px!important'
  ])if(!html.includes(marker))throw new Error(rel+": mobiele segmented-control invariant ontbreekt: "+marker);
  new vm.Script(segment,{filename:rel+":theme-mobile-session"});
}
function patchHub(){
  const p=path.join(OUT,"theme-hub.js");
  if(!fs.existsSync(p))return false;
  const oud=fs.readFileSync(p,"utf8");
  if(oud===HUB_RUNTIME)return false;
  if(!oud.includes('const PREF="weerbriefing.thema"')||!oud.includes('getElementById("thema")'))throw new Error("theme-hub.js heeft een onbekend contract.");
  new vm.Script(HUB_RUNTIME,{filename:"theme-hub.js"});
  fs.writeFileSync(p,HUB_RUNTIME,"utf8");
  return true;
}
function main(){
  new vm.Script(WEATHER_RUNTIME,{filename:"theme-mobile-session-runtime"});
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const voor=fs.readFileSync(p,"utf8"),rel=path.relative(OUT,p),r=patchWeatherHtml(voor,rel);
    if(!r.geraakt)continue;
    valideerWeatherHtml(r.html,rel);
    fs.writeFileSync(p,r.html,"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door mobiele themalaag.");
  const hub=patchHub();
  const cache=vernieuwServiceworkerCache(OUT,"theme-mobile-session-20260915");
  console.log(`Themakeuze toegepast op ${geraakt} weerpagina's: LICHT | AUTO | DONKER als gedeelde segmented control voor desktop en mobiel; handmatige voorkeur sessiegebonden${hub?", /weer/-hub sessieveilig":""}; cache ${cache}.`);
  return {geraakt,hub,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,THEMA_START,THEMA_EIND,THEMA_SESSIE_KEY,THEMA_LEGACY_KEY,CSS,WEATHER_RUNTIME,HUB_RUNTIME,tel,htmlBestanden,patchWeatherHtml,valideerWeatherHtml,patchHub,main};

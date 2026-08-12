"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const pad=path.join(OUT,"index.html");
if(!fs.existsSync(pad))throw new Error("Definitieve WeatherNow-artifact ontbreekt voor UI-shellcorrectie.");
let html=fs.readFileSync(pad,"utf8");

function vervangEen(bron,doel,label){
  const aantal=html.split(bron).length-1;
  if(aantal!==1)throw new Error(label+" ontbreekt of is dubbel: "+aantal+" keer gevonden.");
  html=html.replace(bron,doel);
}

/* Edge/Chrome toonde een generiek wereldbolletje omdat de pagina wel PWA- en
   Apple-iconen had, maar geen faviconrelatie voor een normale browsertab. Een
   kleine inline SVG houdt dit onafhankelijk van extra netwerkverzoeken en past
   bij de bestaande haarlijn-iconen van WeatherNow. */
const faviconSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#12211C" stroke-width="4" stroke-linecap="round"><circle cx="32" cy="32" r="11"/><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13.6 13.6l5.7 5.7M44.7 44.7l5.7 5.7M50.4 13.6l-5.7 5.7M19.3 44.7l-5.7 5.7"/></g></svg>';
const faviconHref="data:image/svg+xml,"+encodeURIComponent(faviconSvg);
vervangEen(
  '<link rel="apple-touch-icon" href="icon-192.png">',
  '<link rel="apple-touch-icon" href="icon-192.png">\n<!-- WEATHERNOW TABICOON -->\n<link rel="icon" type="image/svg+xml" href="'+faviconHref+'">',
  "Apple-touch-iconanker voor favicon"
);

/* De oude themaknop cyclde blind door auto -> licht -> donker -> rood. In de
   avond is auto zelf al donker, waardoor donker visueel twee keer in dezelfde
   cyclus voorkwam. De knop opent nu een expliciete keuze: auto blijft bestaan,
   maar is niet langer een extra visuele stap waar je doorheen moet klikken. */
vervangEen(
  '<button id="thema" title="Wissel tussen licht, donker en rood licht">Auto</button>',
  '<button id="thema" type="button" title="Verander de weergave" aria-haspopup="menu" aria-expanded="false">Weergave · auto</button>\n        <div id="themamenu" role="menu" aria-label="Weergave kiezen" hidden>\n          <button type="button" role="menuitemradio" data-thema-keuze="auto" aria-checked="true">Automatisch (dag/nacht)</button>\n          <button type="button" role="menuitemradio" data-thema-keuze="licht" aria-checked="false">Licht</button>\n          <button type="button" role="menuitemradio" data-thema-keuze="donker" aria-checked="false">Donker</button>\n          <button type="button" role="menuitemradio" data-thema-keuze="rood" aria-checked="false">Rood licht</button>\n        </div>',
  "oude cyclische themaknop"
);

const menuCss=`
<style id="ui-shell-controls">
#themamenu{position:absolute;top:calc(100% + 6px);right:0;z-index:40;width:236px;background:var(--sheet);border:1px solid var(--ink);text-align:left}
#themamenu[hidden]{display:none}
#themamenu button{display:flex;flex:none;align-items:center;justify-content:space-between;width:100%;margin:0;padding:9px 11px;border:0;border-bottom:1px solid var(--rule-soft);background:var(--sheet);color:var(--ink-70);font-family:var(--sans);font-size:13px;font-weight:400;letter-spacing:0;text-transform:none;text-align:left;white-space:normal;overflow:visible;text-overflow:clip}
#themamenu button:last-child{border-bottom:0}
#themamenu button:hover,#themamenu button:focus-visible{background:var(--paper);color:var(--ink)}
#themamenu button[aria-checked="true"]{font-weight:600;color:var(--ink)}
#themamenu button[aria-checked="true"]::after{content:"✓";margin-left:12px;flex:0 0 auto}
@media(max-width:430px){#themamenu{left:0;right:0;width:auto}}
</style>`;
vervangEen("</head>",menuCss+"\n</head>","headafsluiting voor weergavemenu");

const themaBron=`/* ---------- thema ---------- */
const THEMAS=["auto","licht","donker","rood"];
function themaToepassen(){
  const keuze=ls.get("weerbriefing.thema","auto");
  let actief=keuze;
  if(keuze==="auto") actief = (S.d&&S.d.current&&S.d.current.is_day===0)?"donker":"licht";
  document.documentElement.setAttribute("data-thema",actief);
  document.querySelector('meta[name="theme-color"]').setAttribute("content",
    actief==="donker"?"#0B120F":actief==="rood"?"#080202":"#F4F5F3");
  const knop=document.getElementById("thema");
  knop.textContent=keuze.charAt(0).toUpperCase()+keuze.slice(1);
  knop.title="Weergave: "+keuze+". Klik voor de volgende stand.";
}
document.getElementById("thema").addEventListener("click",()=>{
  const nu=ls.get("weerbriefing.thema","auto");
  ls.set("weerbriefing.thema",THEMAS[(THEMAS.indexOf(nu)+1)%THEMAS.length]);
  themaToepassen();
});
themaToepassen();`;

const themaNieuw=`/* ---------- thema ---------- */
const THEMA_KEUZES=["auto","licht","donker","rood"];
const THEMA_KNOP_LABEL={auto:"auto",licht:"licht",donker:"donker",rood:"rood"};
function themaKeuze(){
  const keuze=ls.get("weerbriefing.thema","auto");
  return THEMA_KEUZES.includes(keuze)?keuze:"auto";
}
function themaMenuSluit(){
  const menu=document.getElementById("themamenu"),knop=document.getElementById("thema");
  if(menu)menu.hidden=true;
  if(knop)knop.setAttribute("aria-expanded","false");
}
function themaToepassen(){
  const keuze=themaKeuze();
  let actief=keuze;
  if(keuze==="auto") actief=(S.d&&S.d.current&&S.d.current.is_day===0)?"donker":"licht";
  document.documentElement.setAttribute("data-thema",actief);
  document.querySelector('meta[name="theme-color"]').setAttribute("content",
    actief==="donker"?"#0B120F":actief==="rood"?"#080202":"#F4F5F3");
  const knop=document.getElementById("thema"),menu=document.getElementById("themamenu");
  if(knop){
    knop.textContent="Weergave · "+THEMA_KNOP_LABEL[keuze];
    knop.title=keuze==="auto"
      ?"Weergave staat op automatisch (nu "+actief+"). Klik om te kiezen."
      :"Weergave staat op "+THEMA_KNOP_LABEL[keuze]+". Klik om te kiezen.";
    knop.setAttribute("aria-label",knop.title);
  }
  if(menu)menu.querySelectorAll("[data-thema-keuze]").forEach(optie=>{
    optie.setAttribute("aria-checked",optie.dataset.themaKeuze===keuze?"true":"false");
  });
}
const themaKnop=document.getElementById("thema"),themaMenu=document.getElementById("themamenu");
if(themaKnop&&themaMenu){
  themaKnop.addEventListener("click",e=>{
    e.stopPropagation();
    const openen=themaMenu.hidden;
    themaMenu.hidden=!openen;
    themaKnop.setAttribute("aria-expanded",openen?"true":"false");
    if(openen){
      const gekozen=themaMenu.querySelector('[aria-checked="true"]')||themaMenu.querySelector("button");
      if(gekozen)gekozen.focus();
    }
  });
  themaMenu.addEventListener("click",e=>{
    const optie=e.target.closest("[data-thema-keuze]");
    if(!optie)return;
    const keuze=optie.dataset.themaKeuze;
    if(!THEMA_KEUZES.includes(keuze))return;
    ls.set("weerbriefing.thema",keuze);
    themaToepassen();
    themaMenuSluit();
    themaKnop.focus();
  });
  document.addEventListener("click",e=>{
    if(!e.target.closest("#thema")&&!e.target.closest("#themamenu"))themaMenuSluit();
  });
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&!themaMenu.hidden){themaMenuSluit();themaKnop.focus();}
  });
}
themaToepassen();`;
vervangEen(themaBron,themaNieuw,"oude cyclische themalogica");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline WeatherNow-runtime gevonden na UI-shellcorrectie.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:ui-shell-"+(i+1)}));

fs.writeFileSync(pad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"UI-shell");
console.log("UI-shell toegepast: expliciet weergavemenu, unieke themakeuze en zon-favicon; serviceworker "+versie+".");

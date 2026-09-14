"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const {autoThemaOpZon}=require("./theme-solar.js");

const OUT=path.join(__dirname,"..","public");
const pad=path.join(OUT,"index.html");
if(!fs.existsSync(pad))throw new Error("Definitieve WeatherNow-artifact ontbreekt voor UI-shellcorrectie.");
let html=fs.readFileSync(pad,"utf8");

function vervangEen(bron,doel,label){
  const aantal=html.split(bron).length-1;
  if(aantal!==1)throw new Error(label+" ontbreekt of is dubbel: "+aantal+" keer gevonden.");
  html=html.replace(bron,doel);
}

/* De ruwe HTML bevat één crawlbare PNG-favicon voor zoekmachines. In de echte
   browser wordt exact diezelfde link na het parsen omgezet naar het bestaande
   zon-icoon. De visuele tabicoonwissel is niet nodig voor de eerste paint en
   draait daarom bewust in de gewone, later deferred runtime. Zo veroorzaakt
   dit kleine cosmetische script geen synchrone early-bundle in het kritieke
   renderpad, terwijl er nog steeds maar één rel=icon-element bestaat. */
const faviconSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#12211C" stroke-width="4" stroke-linecap="round"><circle cx="32" cy="32" r="11"/><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13.6 13.6l5.7 5.7M44.7 44.7l5.7 5.7M50.4 13.6l-5.7 5.7M19.3 44.7l-5.7 5.7"/></g></svg>';
const faviconHref="data:image/svg+xml,"+encodeURIComponent(faviconSvg);
const crawlFavicon='<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png">';
vervangEen(
  crawlFavicon,
  '<!-- WEATHERNOW TABICOON -->\n'+crawlFavicon,
  "crawlbare faviconanker voor dynamisch tabicoon"
);
const faviconRuntime='<script>!function(){const f=document.querySelector("link[rel=icon]");if(f)f.setAttribute("href","'+faviconHref+'")}();</script>';
vervangEen("</body>",faviconRuntime+"\n</body>","body-einde voor uitgestelde tabicoonruntime");

/* De vorige themabediening was een uitklapmenu. De finale shell toont nu
   Auto als aparte resetkeuze en een compacte zon/maan-toggle voor handmatig
   Licht/Donker. Auto blijft de standaard wanneer er geen geldige voorkeur is;
   bestaande expliciete Licht/Donker-keuzes blijven behouden. */
vervangEen(
  "<button id=\"thema\" title=\"Wissel tussen licht, donker en rood licht\">Auto</button>",
  "<div id=\"thema\" class=\"wiw-theme-control\" role=\"group\" aria-label=\"Weergave kiezen\">\n          <button type=\"button\" id=\"thema-auto\" class=\"wiw-theme-auto\" data-thema-keuze=\"auto\" aria-pressed=\"true\" aria-label=\"Automatisch (dag/nacht)\" title=\"Automatisch (dag/nacht)\">Auto</button>\n          <button type=\"button\" id=\"thema-switch\" class=\"wiw-theme-switch\" role=\"switch\" aria-checked=\"false\" aria-label=\"Schakel donkere weergave in\" title=\"Schakel donkere weergave in\">\n            <span class=\"wiw-theme-icon wiw-theme-sun\" data-thema-handmatig=\"licht\" aria-hidden=\"true\">☀</span>\n            <span class=\"wiw-theme-track\" aria-hidden=\"true\"><span class=\"wiw-theme-thumb\"></span></span>\n            <span class=\"wiw-theme-icon wiw-theme-moon\" data-thema-handmatig=\"donker\" aria-hidden=\"true\">☾</span>\n            <span class=\"sr-only\">Licht of donker</span>\n          </button>\n        </div>",
  "oude cyclische themaknop"
);
const toggleCss=`
<style id="ui-shell-controls">
/* Donkere modus blijft rustig, maar secundaire tekst mag niet wegvallen op
   schermen met lager contrast. Alleen de twee secundaire tekstniveaus worden
   iets lichter; primaire tekst, grafieken en semantische kleuren blijven gelijk. */
html[data-thema="donker"]{--ink-45:#A8A8A8;--ink-25:#959595}

/* De bediening blijft compact in de bestaande header, maar maakt de drie
   mogelijke voorkeuren begrijpelijk: Auto reset de voorkeur, de zon/maan-
   schakelaar kiest of wisselt de handmatige stand. */
#thema.wiw-theme-control{display:inline-flex;align-items:stretch;min-height:32px;border:1px solid var(--rule);border-radius:999px;overflow:hidden;background:var(--sheet);vertical-align:middle}
#thema .wiw-theme-auto{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border:0;border-right:1px solid var(--rule);background:transparent;color:var(--ink-45);font-family:var(--sans);font-size:9.5px;font-weight:500;letter-spacing:.08em;line-height:1;text-transform:uppercase;white-space:nowrap}
#thema .wiw-theme-auto:hover,#thema .wiw-theme-auto:focus-visible{background:var(--paper);color:var(--ink)}
#thema[data-actieve-thema-keuze="auto"] .wiw-theme-auto{background:var(--ink);color:var(--sheet);font-weight:600}
#thema[data-actieve-thema-keuze="auto"] .wiw-theme-auto:hover,#thema[data-actieve-thema-keuze="auto"] .wiw-theme-auto:focus-visible{background:var(--ink);color:var(--sheet)}
#thema #thema-switch{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:78px;padding:6px 9px;border:0;background:var(--sheet);color:var(--ink-25);font-family:var(--sans);font-size:13px;letter-spacing:0;line-height:1;text-transform:none}
#thema #thema-switch:hover,#thema #thema-switch:focus-visible{background:var(--paper);color:var(--ink)}
#thema .wiw-theme-icon{display:inline-grid;place-items:center;width:13px;height:18px;flex:0 0 auto;color:var(--ink-25);font-family:var(--serif);font-size:14px;line-height:1}
#thema .wiw-theme-track{position:relative;display:inline-block;width:32px;height:18px;border:1px solid var(--rule);border-radius:999px;background:var(--paper);flex:0 0 auto}
#thema .wiw-theme-thumb{position:absolute;top:2px;left:2px;width:12px;height:12px;border:0;border-radius:50%;background:var(--ink-45);transform:translateX(0);transition:transform .16s ease,background-color .16s ease}
#thema[data-effectieve-thema="donker"] .wiw-theme-thumb{transform:translateX(14px);background:var(--ink)}
#thema[data-effectieve-thema="licht"] .wiw-theme-thumb{transform:translateX(0);background:var(--ink-45)}
#thema[data-effectieve-thema="licht"] .wiw-theme-sun,#thema[data-effectieve-thema="donker"] .wiw-theme-moon{color:var(--ink)}
#thema[data-actieve-thema-keuze="auto"] #thema-switch{background:var(--paper)}
#thema[data-actieve-thema-keuze="auto"] #thema-switch:hover,#thema[data-actieve-thema-keuze="auto"] #thema-switch:focus-visible{background:var(--paper)}
#thema .wiw-theme-icon[data-thema-handmatig]{cursor:pointer}
@media(max-width:430px){
  #thema.wiw-theme-control{flex:1 1 0;min-width:0}
  #thema .wiw-theme-auto{padding-inline:8px}
  #thema #thema-switch{flex:1 1 auto;min-width:0;gap:3px;padding-inline:6px}
  #thema .wiw-theme-icon{width:12px;font-size:13px}
  #thema .wiw-theme-track{width:28px}
  #thema[data-effectieve-thema="donker"] .wiw-theme-thumb{transform:translateX(12px)}
}
@media(max-width:340px){
  #thema .wiw-theme-auto{padding-inline:6px;font-size:9px}
  #thema #thema-switch{padding-inline:4px}
  #thema .wiw-theme-track{width:26px}
  #thema[data-effectieve-thema="donker"] .wiw-theme-thumb{transform:translateX(10px)}
}
@media(prefers-reduced-motion:reduce){#thema .wiw-theme-thumb{transition:none}}

/* De weektabel houdt op desktop een kleine veilige rechterinset. Percentages
   en mm-waarden staan daardoor niet strak tegen de rand van de module. */
@media(min-width:901px){#days .row.day,#days .row.kop{padding-right:8px}}
</style>`;
vervangEen("</head>",toggleCss+"\n</head>","headafsluiting voor weergavetoggle");


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

/* Eén pure bron voor de zonnegrens: dezelfde functie wordt in Node getest en
   hier letterlijk in de finale browserruntime opgenomen. Zo kan de UI-shell
   niet ongemerkt een andere dag/nachtdefinitie krijgen dan de verifier. */
const autoThemaRuntime=autoThemaOpZon.toString();
const themaNieuw=`/* ---------- thema ---------- */
const THEMA_KEUZES=["auto","licht","donker"];
${autoThemaRuntime}
function themaKeuze(){
  const keuze=ls.get("weerbriefing.thema","auto");
  if(THEMA_KEUZES.includes(keuze))return keuze;
  /* Oude of ongeldige opgeslagen waarden (waaronder de verwijderde rode
     stand) migreren één keer naar de veilige standaard Auto. */
  ls.set("weerbriefing.thema","auto");
  return "auto";
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
      ?"Automatisch; nu "+stand+". Klik op de zon of maan voor een handmatige keuze."
      :stand+". Klik om "+(donker?"Licht":"Donker")+" te kiezen.");
    schakelaar.title=keuze==="auto"
      ?"Automatisch; nu "+stand+". Klik om handmatig te wisselen."
      :"Huidige handmatige keuze: "+stand+". Klik om te wisselen.";
  }
}
function themaToepassen(){
  const keuze=themaKeuze(),actief=themaActief(keuze);
  document.documentElement.setAttribute("data-thema",actief);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute("content",actief==="donker"?"#0B120F":"#F4F5F3");
  themaStatusBijwerken(keuze,actief);
}
const themaGroep=document.getElementById("thema"),themaAutoKnop=document.getElementById("thema-auto"),themaSchakelaar=document.getElementById("thema-switch");
if(themaGroep&&themaAutoKnop&&themaSchakelaar){
  themaAutoKnop.addEventListener("click",()=>{
    ls.set("weerbriefing.thema","auto");
    themaToepassen();
    themaAutoKnop.focus();
  });
  themaSchakelaar.addEventListener("click",e=>{
    const expliciet=e.target.closest("[data-thema-handmatig]");
    const handmatig=expliciet?expliciet.dataset.themaHandmatig:null;
    const huidig=themaActief(themaKeuze());
    ls.set("weerbriefing.thema",handmatig|| (huidig==="donker"?"licht":"donker"));
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
themaToepassen();`
vervangEen(themaBron,themaNieuw,"oude cyclische themalogica");

/* De plaatsklok is al uitgelijnd op iedere lokale minuutgrens. Auto gebruikt
   precies die bestaande tik om een open pagina op de minuut van zonsopkomst of
   zonsondergang om te schakelen; er komt dus geen tweede timer bij. */
const klokBron=`function klokBijwerken(){
  const tijd=plaatsKlok(),dag=plaatsVandaag();
  const pt=document.getElementById("plaatstijd"); if(pt) pt.textContent=tijd;
  const mt=document.getElementById("minitijd"); if(mt) mt.textContent=tijd;
  const plaatsSleutel=String(S.lat)+","+String(S.lon);
  if(klokPlaatsSleutel!==plaatsSleutel){klokPlaatsSleutel=plaatsSleutel;klokKalenderdag=dag;return;}
  if(klokKalenderdag===null){klokKalenderdag=dag;return;}
  if(dag!==klokKalenderdag){klokKalenderdag=dag;if(S.lat!=null&&S.d)load(S.lat,S.lon,S.label,true,false);}
}`;
const klokNieuw=`function klokBijwerken(){
  const tijd=plaatsKlok(),dag=plaatsVandaag();
  const pt=document.getElementById("plaatstijd"); if(pt) pt.textContent=tijd;
  const mt=document.getElementById("minitijd"); if(mt) mt.textContent=tijd;
  if(typeof themaKeuze==="function"&&themaKeuze()==="auto")themaToepassen();
  const plaatsSleutel=String(S.lat)+","+String(S.lon);
  if(klokPlaatsSleutel!==plaatsSleutel){klokPlaatsSleutel=plaatsSleutel;klokKalenderdag=dag;return;}
  if(klokKalenderdag===null){klokKalenderdag=dag;return;}
  if(dag!==klokKalenderdag){klokKalenderdag=dag;if(S.lat!=null&&S.d)load(S.lat,S.lon,S.label,true,false);}
}`;
vervangEen(klokBron,klokNieuw,"bestaande minuutklok voor automatische zonnegrens");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline WeatherNow-runtime gevonden na UI-shellcorrectie.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:ui-shell-"+(i+1)}));

fs.writeFileSync(pad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"UI-shell");
console.log("UI-shell toegepast: Auto/Licht/Donker-toggle met exacte lokale zonnegrenzen, dark-mode contrast, weekinset en één crawlbare/dynamische favicon zonder renderblokkerende early-runtime; serviceworker "+versie+".");

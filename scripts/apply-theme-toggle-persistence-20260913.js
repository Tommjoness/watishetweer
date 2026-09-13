"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-theme-toggle-persistence-20260913";
const HUB_SCRIPT="theme-hub.js";
const THEMA_START="/* ---------- thema ---------- */";
const THEMA_EIND="/* ---------- stempel en verversen ---------- */";

/* De bestaande weergaveknop was functioneel een menu met drie standen. Voor de
   primaire bediening is een echte licht/donker-switch duidelijker: de knop
   toont beide kanten visueel en aria-checked beschrijft dezelfde toestand voor
   assistieve technologie. Een bestaande 'auto'-voorkeur blijft gerespecteerd
   totdat de gebruiker de switch gebruikt; daarna wordt expliciet licht of
   donker opgeslagen. */
const SWITCH_HTML=`<button id="thema" type="button" class="wiw-theme-switch" role="switch" aria-checked="false" aria-label="Donkere weergave" title="Schakel donkere weergave in">
          <span class="wiw-theme-icon wiw-theme-sun" aria-hidden="true">☀</span>
          <span class="wiw-theme-track" aria-hidden="true"><span class="wiw-theme-thumb thema-status"></span></span>
          <span class="wiw-theme-icon wiw-theme-moon" aria-hidden="true">☾</span>
          <span class="sr-only">Weergave</span>
        </button>`;

const CSS=`
#thema.wiw-theme-switch{
  display:inline-flex;align-items:center;justify-content:center;gap:5px;
  min-width:78px;padding:7px 9px;letter-spacing:0;text-transform:none;
  color:var(--ink-70);background:var(--sheet)
}
#thema .wiw-theme-icon{display:inline-grid;place-items:center;width:13px;height:18px;font-size:13px;line-height:1;color:var(--ink-25)}
#thema .wiw-theme-track{position:relative;display:inline-block;width:32px;height:18px;border:1px solid var(--rule);border-radius:999px;background:var(--paper);flex:0 0 auto}
#thema .wiw-theme-thumb{position:absolute;top:2px;left:2px;width:12px;height:12px;min-width:0;margin:0;border:0;border-radius:50%;background:var(--ink-70);transform:translateX(0);transition:transform .16s ease,background-color .16s ease}
#thema[aria-checked="true"] .wiw-theme-thumb{transform:translateX(14px);background:var(--ink)}
#thema[aria-checked="false"] .wiw-theme-sun,#thema[aria-checked="true"] .wiw-theme-moon{color:var(--ink)}
#thema:hover .wiw-theme-track{border-color:var(--ink)}
@media(max-width:430px){#thema.wiw-theme-switch{min-width:72px;padding-inline:7px;gap:4px}}
@media(prefers-reduced-motion:reduce){#thema .wiw-theme-thumb{transition:none}}
`;

const WEATHER_RUNTIME=`/* ---------- thema ---------- */
const THEMA_KEUZES=["auto","licht","donker"];
const THEMA_ACTIEF_KEY="weerbriefing.actiefThema";
function themaKeuze(){
  const keuze=ls.get("weerbriefing.thema","auto");
  if(THEMA_KEUZES.includes(keuze))return keuze;
  ls.set("weerbriefing.thema","auto");
  return "auto";
}
function themaActief(keuze){
  if(keuze==="licht"||keuze==="donker")return keuze;
  return (S.d&&S.d.current&&S.d.current.is_day===0)?"donker":"licht";
}
function themaSchakelaarBij(actief){
  const knop=document.getElementById("thema");if(!knop)return;
  const donker=actief==="donker";
  knop.setAttribute("aria-checked",donker?"true":"false");
  knop.dataset.actieveThemakeuze=themaKeuze();
  knop.title=donker?"Schakel lichte weergave in":"Schakel donkere weergave in";
  knop.setAttribute("aria-label",donker?"Donkere weergave, schakel licht in":"Lichte weergave, schakel donker in");
}
function themaToepassen(){
  const keuze=themaKeuze(),actief=themaActief(keuze);
  document.documentElement.setAttribute("data-thema",actief);
  try{localStorage.setItem(THEMA_ACTIEF_KEY,JSON.stringify(actief));}catch(e){}
  document.querySelector('meta[name="theme-color"]').setAttribute("content",actief==="donker"?"#0B120F":"#F4F5F3");
  themaSchakelaarBij(actief);
}
document.getElementById("thema").addEventListener("click",()=>{
  const actief=document.documentElement.getAttribute("data-thema")==="donker"?"donker":"licht";
  ls.set("weerbriefing.thema",actief==="donker"?"licht":"donker");
  themaToepassen();
});
themaToepassen();

`;

const HUB_SCRIPT_BRON=`(()=>{"use strict";
  const PREF="weerbriefing.thema",ACTIEF="weerbriefing.actiefThema";
  const lees=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw==null?fallback:JSON.parse(raw);}catch(e){return fallback;}};
  const schrijf=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch(e){}};
  const voorkeur=lees(PREF,"auto");
  const fallback=lees(ACTIEF,(typeof matchMedia==="function"&&matchMedia("(prefers-color-scheme: dark)").matches)?"donker":"licht");
  const begin=voorkeur==="donker"?"donker":voorkeur==="licht"?"licht":fallback==="donker"?"donker":"licht";
  const zet=(actief,bewaar)=>{
    if(actief==="donker")document.documentElement.setAttribute("data-thema","donker");else document.documentElement.removeAttribute("data-thema");
    schrijf(ACTIEF,actief);
    if(bewaar)schrijf(PREF,actief);
    const knop=document.getElementById("thema");
    if(knop){const donker=actief==="donker";knop.setAttribute("aria-checked",donker?"true":"false");knop.title=donker?"Schakel lichte weergave in":"Schakel donkere weergave in";knop.setAttribute("aria-label",donker?"Donkere weergave, schakel licht in":"Lichte weergave, schakel donker in");}
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",actief==="donker"?"#0B120F":"#F4F5F3");
  };
  zet(begin,false);
  document.addEventListener("DOMContentLoaded",()=>{const knop=document.getElementById("thema");if(!knop)return;zet(document.documentElement.getAttribute("data-thema")==="donker"?"donker":"licht",false);knop.addEventListener("click",()=>zet(document.documentElement.getAttribute("data-thema")==="donker"?"licht":"donker",true));},{once:true});
})();\n`;

const HUB_CSS=`
html[data-thema="donker"]{--paper:#0A0A0A;--sheet:#141414;--ink:#EDEDED;--muted:#A8A8A8;--rule:#2A2A2A}
.hub-top{display:flex;align-items:center;justify-content:space-between;gap:18px}
.wiw-theme-switch{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:78px;padding:7px 9px;border:1px solid var(--rule);background:var(--sheet);color:var(--muted);cursor:pointer}
.wiw-theme-switch:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.wiw-theme-icon{display:inline-grid;place-items:center;width:13px;height:18px;font-size:13px;line-height:1;color:var(--muted)}
.wiw-theme-track{position:relative;display:inline-block;width:32px;height:18px;border:1px solid var(--rule);border-radius:999px;background:var(--paper);flex:0 0 auto}
.wiw-theme-thumb{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--muted);transform:translateX(0);transition:transform .16s ease,background-color .16s ease}
.wiw-theme-switch[aria-checked="true"] .wiw-theme-thumb{transform:translateX(14px);background:var(--ink)}
.wiw-theme-switch[aria-checked="false"] .wiw-theme-sun,.wiw-theme-switch[aria-checked="true"] .wiw-theme-moon{color:var(--ink)}
.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
@media(prefers-reduced-motion:reduce){.wiw-theme-thumb{transition:none}}
`;

function tel(bron,zoek){return String(bron).split(zoek).length-1;}
function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function patchWeatherHtml(html,rel){
  let bron=String(html||"");
  if(!bron.includes('id="thema"')||!bron.includes('id="themamenu"'))return {html:bron,geraakt:false};
  if(bron.includes(`id="${STYLE_ID}"`))throw new Error(rel+": theme-togglepatch staat al in artifact.");
  if(tel(bron,THEMA_START)!==1||tel(bron,THEMA_EIND)!==1)throw new Error(rel+": themaruntime-ankers ontbreken of zijn dubbel.");
  const bediening=/<button id="thema"[\s\S]*?<\/button>\s*<div id="themamenu"[\s\S]*?<\/div>/;
  const matches=bron.match(bediening);
  if(!matches)throw new Error(rel+": bestaande weergavemenu-opbouw niet gevonden.");
  bron=bron.replace(bediening,SWITCH_HTML);
  const start=bron.indexOf(THEMA_START),eind=bron.indexOf(THEMA_EIND,start);
  if(start<0||eind<=start)throw new Error(rel+": themaruntimebereik ongeldig.");
  bron=bron.slice(0,start)+WEATHER_RUNTIME+bron.slice(eind);
  if(tel(bron,"</head>")!==1)throw new Error(rel+": head-einde ontbreekt voor switchstijl.");
  bron=bron.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
  return {html:bron,geraakt:true};
}

function patchHubHtml(html){
  let bron=String(html||"");
  if(!bron.includes("<h1>Weer per plaats</h1>"))throw new Error("/weer/-hub mist verwachte H1.");
  if(bron.includes(`id="${STYLE_ID}"`))throw new Error("/weer/-hub theme-togglepatch staat al in artifact.");
  if(tel(bron,'<a class="brand" href="/">Wat is het weer?</a>')!==1)throw new Error("/weer/-hub mist uniek merkanker.");
  if(tel(bron,"</style>")!==1)throw new Error("/weer/-hub verwacht exact één stijlblok.");
  const stylesheet=/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/i;
  if(!stylesheet.test(bron))throw new Error("/weer/-hub mist stylesheetanker voor vroege themaruntime.");
  bron=bron.replace(stylesheet,'<meta name="theme-color" content="#F4F5F3">\n<script src="/'+HUB_SCRIPT+'"></script>\n$&');
  bron=bron.replace("</style>",HUB_CSS+"\n/* "+STYLE_ID+" */\n</style>");
  bron=bron.replace('<a class="brand" href="/">Wat is het weer?</a>',`<div class="hub-top"><a class="brand" href="/">Wat is het weer?</a>${SWITCH_HTML}</div>`);
  return bron;
}

function valideerScripts(html,rel){
  const scripts=[...String(html).matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:rel+":theme-toggle-"+(i+1)}));
}

function main(){
  let weer=0;
  for(const p of htmlBestanden(OUT)){
    const voor=fs.readFileSync(p,"utf8"),rel=path.relative(OUT,p),r=patchWeatherHtml(voor,rel);
    if(!r.geraakt)continue;
    valideerScripts(r.html,rel);fs.writeFileSync(p,r.html,"utf8");weer++;
  }
  if(!weer)throw new Error("Geen weerartifacts met bestaand weergavemenu gevonden.");
  const hub=path.join(OUT,"weer","index.html");
  if(!fs.existsSync(hub))throw new Error("public/weer/index.html ontbreekt voor themapersistentie.");
  fs.writeFileSync(hub,patchHubHtml(fs.readFileSync(hub,"utf8")),"utf8");
  fs.writeFileSync(path.join(OUT,HUB_SCRIPT),HUB_SCRIPT_BRON,"utf8");
  new vm.Script(HUB_SCRIPT_BRON,{filename:HUB_SCRIPT});
  const cache=vernieuwServiceworkerCache(OUT,"theme-toggle-persistence-20260913");
  console.log(`Weergaveswitch toegepast op ${weer} weerartifacts en /weer/: licht/donker-toggle en themapersistentie over navigatie geborgd; cache ${cache}.`);
  return {weer,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,HUB_SCRIPT,SWITCH_HTML,CSS,WEATHER_RUNTIME,HUB_SCRIPT_BRON,HUB_CSS,tel,htmlBestanden,patchWeatherHtml,patchHubHtml,valideerScripts,main};

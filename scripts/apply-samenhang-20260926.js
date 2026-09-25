"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-samenhang-20260926";
const OWNER_ID="wiw-indeling-20260925";
const HUB_STYLE_ID="wiw-hub-samenhang-20260926";

/* Samenhang na de kritische review van 25 september.
   Weerpagina's (CSS; het gedrag zit in de runtime):
   - Zes tegels: de runtime verbergt "Tijd tot zonsondergang" (zon op en onder
     staan boven de grafiek) en "Zicht" zolang het zicht niet beperkt is, en
     zet het aantal zichtbare tegels op de rij. Zes tegels staan vanaf 600px
     in drie kolommen (twee rijen van drie), met de randen per rij van drie.
   Plaatsindex /weer/:
   - Dezelfde Licht | Auto | Donker-keuze als op de weerpagina's, in plaats
     van de oude aan/uit-schakelaar.
   - "Terug naar het weer" bovenaan, zoals op Over en Privacy.
   - Een zoekveld dat de lijst van plaatsen filtert; wie een andere plaats
     zoekt, gaat naar de zoekfunctie op de weerpagina. */
const CSS=`
html body #app .stats>.stat[hidden]{display:none!important}
html body #aq .sval[data-pollen-niveau="hoog"],html body #aq .sval[data-pollen-niveau="zeer hoog"]{font-weight:600!important}
@media(min-width:600px){
  html body #app .stats[data-tegels="6"]:not(#aq):not(#wiw-samenhang){grid-template-columns:repeat(3,minmax(0,1fr))!important}
  html body #app .stats[data-tegels="6"]:not(#aq):not(#wiw-samenhang)>.stat{grid-column:auto!important;border-right:1px solid var(--rule)!important}
  html body #app .stats[data-tegels="6"]:not(#aq):not(#wiw-samenhang)>.stat:nth-child(3n){border-right:0!important}
}
`;

const HUB_KNOP_OUD_START='<button id="thema" type="button" class="wiw-theme-switch" role="switch"';
const HUB_KNOP_NIEUW='<div id="thema" class="hub-weergave" role="group" aria-label="Weergave kiezen">'
  +'<button type="button" data-keuze="licht" aria-pressed="false"><span aria-hidden="true">☀</span> Licht</button>'
  +'<button type="button" data-keuze="auto" aria-pressed="true" title="Automatisch: volgt de licht/donker-instelling van je apparaat">Auto</button>'
  +'<button type="button" data-keuze="donker" aria-pressed="false"><span aria-hidden="true">☾</span> Donker</button></div>';
const HUB_INTRO='<p>Kies een plaats voor het actuele weer, neerslag in de komende uren en de 7-daagse verwachting.</p>';
const HUB_ZOEK='<label class="hub-zoek"><span class="sr-only">Zoek een plaats in de lijst</span>'
  +'<input type="search" id="hub-zoek" placeholder="Zoek een plaats" autocomplete="off" spellcheck="false"></label>'
  +'<p class="hub-leeg" id="hub-leeg" role="status" hidden>Deze plaats staat niet in de lijst. <a href="/">Zoek haar op de weerpagina</a>; daar vind je elke plaats ter wereld.</p>';
const HUB_TERUG_ONDER='<a class="terug" href="/">← Terug naar het actuele weer</a>\n';
const HUB_TERUG_BOVEN='<p class="terug-boven"><a href="/">← Terug naar het weer</a></p>\n';
const HUB_CSS=`
.hub-top{margin-bottom:6px}
.terug-boven{margin:18px 0 0;font-size:14px;max-width:none}
.hub-weergave{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:276px;border:1px solid var(--rule);background:var(--sheet)}
.hub-weergave button{min-height:44px;padding:0 8px;border:0;border-left:1px solid var(--rule);background:transparent;color:var(--muted);font:500 11px/1 var(--sans);letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
.hub-weergave button:first-child{border-left:0}
.hub-weergave button[aria-pressed="true"]{background:var(--paper);color:var(--ink);box-shadow:inset 0 -2px 0 var(--ink)}
.hub-weergave button:hover{color:var(--ink)}
.hub-weergave button:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}
.hub-zoek{display:block;margin:22px 0 0}
.hub-zoek input{width:100%;max-width:420px;min-height:44px;padding:10px 12px;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);font:15px var(--sans);border-radius:0}
.hub-zoek input:focus{outline:0;border-color:var(--ink)}
.hub-leeg{margin:14px 0 0}
.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
@media(max-width:430px){.hub-top{flex-wrap:wrap}.hub-weergave{width:100%}}
`;

/* Themakeuze op /weer/: hetzelfde contract als de weerpagina's. De keuze
   Licht of Donker geldt voor deze browsersessie; Auto volgt het apparaat. */
const HUB_RUNTIME=`(()=>{"use strict";
  const PREF="weerbriefing.thema",SESSIE="weerbriefing.thema.sessie",ACTIEF="weerbriefing.actiefThema";
  const leesSessie=()=>{try{const raw=sessionStorage.getItem(SESSIE);const v=raw==null?"auto":JSON.parse(raw);return ["auto","licht","donker"].includes(v)?v:"auto";}catch(e){return "auto";}};
  const schrijfSessie=v=>{try{sessionStorage.setItem(SESSIE,JSON.stringify(v));}catch(e){}};
  const schrijfLocal=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}};
  try{localStorage.removeItem(PREF);}catch(e){}
  const query=typeof matchMedia==="function"?matchMedia("(prefers-color-scheme: dark)"):null;
  let keuze=leesSessie();
  const actief=()=>keuze==="donker"?"donker":keuze==="licht"?"licht":query&&query.matches?"donker":"licht";
  const pas=()=>{
    const a=actief();
    if(a==="donker")document.documentElement.setAttribute("data-thema","donker");else document.documentElement.removeAttribute("data-thema");
    schrijfLocal(ACTIEF,a);
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",a==="donker"?"#0B120F":"#F4F5F3");
    document.querySelectorAll("#thema [data-keuze]").forEach(k=>k.setAttribute("aria-pressed",k.getAttribute("data-keuze")===keuze?"true":"false"));
  };
  pas();
  if(query){const volg=()=>{if(keuze==="auto")pas();};if(typeof query.addEventListener==="function")query.addEventListener("change",volg);else if(typeof query.addListener==="function")query.addListener(volg);}
  document.addEventListener("DOMContentLoaded",()=>{
    pas();
    document.querySelectorAll("#thema [data-keuze]").forEach(k=>k.addEventListener("click",()=>{keuze=k.getAttribute("data-keuze");schrijfSessie(keuze);pas();}));
    const veld=document.getElementById("hub-zoek"),leeg=document.getElementById("hub-leeg");
    if(!veld)return;
    const plat=t=>String(t||"").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
    /* Zoeken op de plaatsnaam; de provincie eronder telt niet mee. */
    const items=[...document.querySelectorAll(".plaatsen li")].map(li=>({li,tekst:plat((li.querySelector("a")||li).textContent)}));
    veld.addEventListener("input",()=>{
      const q=plat(veld.value);let zichtbaar=0;
      items.forEach(({li,tekst})=>{const ja=!q||tekst.includes(q);li.hidden=!ja;if(ja)zichtbaar++;});
      if(leeg)leeg.hidden=zichtbaar>0;
    });
  },{once:true});
})();
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

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": samenhanglaag staat al in artifact.");
  if(!html.includes("</head>"))throw new Error(rel+": headafsluiting ontbreekt.");
  return html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
}

function pasHubToe(html){
  if(html.includes(`id="${HUB_STYLE_ID}"`))throw new Error("weer/index.html: hub-samenhang staat al in artifact.");
  const s=html.indexOf(HUB_KNOP_OUD_START),e=s<0?-1:html.indexOf("</button>",s);
  if(s<0||e<0||tel(html,HUB_KNOP_OUD_START)!==1)throw new Error("weer/index.html: oude weergaveschakelaar niet exact eenmaal gevonden.");
  html=html.slice(0,s)+HUB_KNOP_NIEUW+html.slice(e+"</button>".length);
  if(tel(html,HUB_INTRO)!==1)throw new Error("weer/index.html: introductie niet exact eenmaal gevonden.");
  html=html.replace(HUB_INTRO,HUB_INTRO+"\n"+HUB_ZOEK);
  if(tel(html,HUB_TERUG_ONDER)!==1)throw new Error("weer/index.html: terug-link onderaan niet exact eenmaal gevonden.");
  html=html.replace(HUB_TERUG_ONDER,"");
  if(tel(html,"<h1>Weer per plaats</h1>")!==1)throw new Error("weer/index.html: hoofdkop niet exact eenmaal gevonden.");
  html=html.replace("<h1>Weer per plaats</h1>",HUB_TERUG_BOVEN+"<h1>Weer per plaats</h1>");
  return html.replace("</head>",`<style id="${HUB_STYLE_ID}">\n${HUB_CSS}\n</style>\n</head>`);
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8");
    if(!html.includes(`id="${OWNER_ID}"`))continue;
    fs.writeFileSync(p,pasToe(html,path.relative(OUT,p)),"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door samenhanglaag.");
  const hubPad=path.join(OUT,"weer","index.html"),hubScript=path.join(OUT,"theme-hub.js");
  if(!fs.existsSync(hubPad)||!fs.existsSync(hubScript))throw new Error("Plaatsindex of theme-hub.js ontbreekt.");
  fs.writeFileSync(hubPad,pasHubToe(fs.readFileSync(hubPad,"utf8")),"utf8");
  new vm.Script(HUB_RUNTIME,{filename:"theme-hub.js"});
  fs.writeFileSync(hubScript,HUB_RUNTIME,"utf8");
  const cache=vernieuwServiceworkerCache(OUT,"samenhang-20260926");
  console.log("Samenhanglaag toegepast op "+geraakt+" weerartifacts en de plaatsindex (Licht | Auto | Donker, terug bovenaan, zoekveld); cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,HUB_STYLE_ID,HUB_RUNTIME,htmlBestanden,pasToe,pasHubToe,main};

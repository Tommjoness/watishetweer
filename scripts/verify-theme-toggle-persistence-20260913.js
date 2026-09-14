"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");
const {autoThemaOpZon}=require("./theme-solar.js");
const {OUT,STYLE_ID,HUB_SCRIPT,THEMA_ACTIEF_CONST,THEMA_PERSIST_HAAK}=require("./apply-theme-toggle-persistence-20260913.js");

function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

let weer=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8"),rel=path.relative(OUT,p);
  if(!html.includes('id="app"')||!html.includes('id="thema"'))continue;
  assert(!html.includes('class="wiw-theme-switch"'),rel+": verouderde binaire switch overschrijft de weather UI-shell");
  assert(html.includes('id="themamenu"'),rel+": Auto/Licht/Donker-menu ontbreekt na late SEO/themapersistentielaag");
  assert(html.includes('data-thema-keuze="auto"'),rel+": Auto-keuze ontbreekt in finale weather UI");
  assert(html.includes('data-thema-keuze="licht"'),rel+": Licht-keuze ontbreekt in finale weather UI");
  assert(html.includes('data-thema-keuze="donker"'),rel+": Donker-keuze ontbreekt in finale weather UI");
  assert(html.includes('autoThemaOpZon'),rel+": exacte zonnegrenshelper is uit finale weather runtime verdwenen");
  assert(html.includes('autoThemaOpZon(S.d,weatherNowActueleLokaleTijd())'),rel+": Auto gebruikt niet meer de lokale tijd van de gekozen plaats");
  assert(html.includes(THEMA_ACTIEF_CONST),rel+": actieve Auto-uitkomst wordt niet bewaard voor subnavigatie");
  assert(html.includes(THEMA_PERSIST_HAAK),rel+": actieve Auto-uitkomst wordt niet naar de gedeelde themastaat geschreven");
  assert(html.includes('ls.set("weerbriefing.thema",keuze)'),rel+": expliciete Licht/Donker/Auto-keuze kan niet meer worden opgeslagen");
  assert(!html.includes('ls.set("weerbriefing.thema",actief==="donker"?"licht":"donker")'),rel+": oude binary switch-writer lekt terug in finale weather runtime");
  assert.strictEqual((html.match(new RegExp(`id="${STYLE_ID}"`,`g`))||[]).length,0,rel+": hub-only switchstijl lekt naar een weather artifact");
  weer++;
}
assert(weer>0,"Geen finale weerartifacts met Auto/Licht/Donker-menu gevonden.");

/* Regressie voor de concrete productiebug: dezelfde Auto-voorkeur moet voor
   twee locaties op hetzelfde moment een ander actief thema kunnen opleveren.
   De invoertijden zijn al lokaal voor de gekozen plaats. */
const almere={
  current:{is_day:1},
  daily:{time:["2026-09-14"],sunrise:["2026-09-14T07:14"],sunset:["2026-09-14T19:58"]}
};
const tokio={
  current:{is_day:0},
  daily:{time:["2026-09-14"],sunrise:["2026-09-14T05:25"],sunset:["2026-09-14T17:49"]}
};
assert.strictEqual(autoThemaOpZon(almere,"2026-09-14T14:15"),"licht","Almere overdag hoort in Auto licht te zijn");
assert.strictEqual(autoThemaOpZon(tokio,"2026-09-14T21:15"),"donker","Tokio na lokale zonsondergang hoort in Auto donker te zijn");

const hubPath=path.join(OUT,"weer","index.html");
assert(fs.existsSync(hubPath),"public/weer/index.html ontbreekt.");
const hub=fs.readFileSync(hubPath,"utf8");
assert(hub.includes('html[data-thema="donker"]{--paper:#0A0A0A'),"/weer/ mist donkere themavariabelen");
assert(hub.includes(`src="/${HUB_SCRIPT}"`),"/weer/ laadt de vroege themapersistentieruntime niet");
assert(hub.includes('class="hub-top"'),"/weer/ mist koprij met weergaveswitch");
assert(hub.includes('id="thema" type="button" class="wiw-theme-switch" role="switch"'),"/weer/ mist zijn compacte licht/donker-switch");
assert(hub.includes('<meta name="theme-color" content="#F4F5F3">'),"/weer/ mist theme-color metadata");
const hubScriptPos=hub.indexOf(`src="/${HUB_SCRIPT}"`);
const hubStylePos=hub.search(/<style(?:\s[^>]*)?>/i);
const hubSheetPos=hub.search(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/i);
const cssPosities=[hubStylePos,hubSheetPos].filter(pos=>pos>=0);
assert(cssPosities.length>0,"/weer/ mist CSS waarop de vroege themaruntime kan voorgaan");
const eersteCssPos=Math.min(...cssPosities);
assert(hubScriptPos>=0&&hubScriptPos<eersteCssPos,"/weer/ themaruntime moet vóór de eerste inline of externe CSS staan om een verkeerde eerste paint te voorkomen");

const hubScriptPath=path.join(OUT,HUB_SCRIPT);
assert(fs.existsSync(hubScriptPath),"Hub-themascript ontbreekt uit public.");
const script=fs.readFileSync(hubScriptPath,"utf8");
assert(script.includes('const PREF="weerbriefing.thema",ACTIEF="weerbriefing.actiefThema"'),"Hub-themascript leest niet dezelfde voorkeur-/actiefsleutels");
assert(script.includes('voorkeur==="donker"?"donker":voorkeur==="licht"?"licht"'),"Hub respecteert expliciete licht/donkervoorkeur niet");
assert(script.includes('if(bewaar)schrijf(PREF,actief)'),"Hub-switch bewaart een bewuste hubkeuze niet");
assert(script.includes('document.documentElement.setAttribute("data-thema","donker")'),"Hub kan donkere weergave niet vóór paint activeren");
assert(script.includes('typeof matchMedia==="function"'),"Hub-themascript moet ook zonder matchMedia veilig naar licht kunnen terugvallen");

const cache=verifieerServiceworkerCache(OUT,"theme-toggle-persistence-verifier");
assert(/^watishetweer-[0-9a-f]{12}$/.test(cache),"serviceworker-cache hoort bij de gewijzigde artifact");
console.log(`Themapersistentie geverifieerd voor ${weer} weerartifacts + /weer/: weather Auto/Licht/Donker en exacte locatiezon blijven finale owner; Almere-dag/Tokio-nacht regressie groen; hubprepaint en bewuste hubkeuze behouden; cache ${cache}.`);

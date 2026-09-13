"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");
const {OUT,STYLE_ID,HUB_SCRIPT}=require("./apply-theme-toggle-persistence-20260913.js");

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
  assert.strictEqual((html.match(new RegExp(`id="${STYLE_ID}"`,`g`))||[]).length,1,rel+": switchstijl niet exact eenmaal aanwezig");
  assert(html.includes('id="thema" type="button" class="wiw-theme-switch" role="switch"'),rel+": weergavebediening is geen echte switch");
  assert(!html.includes('id="themamenu"'),rel+": oud weergavemenu staat nog in finale artifact");
  assert(html.includes('class="wiw-theme-thumb thema-status"'),rel+": switchthumb/statushook ontbreekt");
  assert(html.includes('const THEMA_ACTIEF_KEY="weerbriefing.actiefThema"'),rel+": actieve themastaat wordt niet bewaard voor subnavigatie");
  assert(html.includes('ls.set("weerbriefing.thema",actief==="donker"?"licht":"donker")'),rel+": switch schrijft geen expliciete licht/donkerkeuze");
  assert(html.includes('knop.setAttribute("aria-checked",donker?"true":"false")'),rel+": aria-checked volgt de werkelijke themastaat niet");
  assert(!html.includes('data-thema-keuze="auto"'),rel+": oud driestandenmenu lekt nog in finale UI");
  weer++;
}
assert(weer>0,"Geen finale weerartifacts met themaswitch gevonden.");

const hubPath=path.join(OUT,"weer","index.html");
assert(fs.existsSync(hubPath),"public/weer/index.html ontbreekt.");
const hub=fs.readFileSync(hubPath,"utf8");
assert(hub.includes('html[data-thema="donker"]{--paper:#0A0A0A'),"/weer/ mist donkere themavariabelen");
assert(hub.includes(`src="/${HUB_SCRIPT}"`),"/weer/ laadt de vroege themapersistentieruntime niet");
assert(hub.includes('class="hub-top"'),"/weer/ mist koprij met weergaveswitch");
assert(hub.includes('id="thema" type="button" class="wiw-theme-switch" role="switch"'),"/weer/ mist dezelfde licht/donker-switch");
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
assert(script.includes('if(bewaar)schrijf(PREF,actief)'),"Hub-switch bewaart de gekozen stand niet");
assert(script.includes('document.documentElement.setAttribute("data-thema","donker")'),"Hub kan donkere weergave niet vóór paint activeren");
assert(script.includes('typeof matchMedia==="function"'),"Hub-themascript moet ook zonder matchMedia veilig naar licht kunnen terugvallen");

const cache=verifieerServiceworkerCache(OUT,"theme-toggle-persistence-verifier");
assert(/^watishetweer-[0-9a-f]{12}$/.test(cache),"serviceworker-cache hoort bij de gewijzigde artifact");
console.log(`Themapersistentie geverifieerd voor ${weer} weerartifacts + /weer/: echte licht/donker-switch, bewaarde keuze, prepaint-runtime vóór de eerste CSS en consistente aria-state; cache ${cache}.`);

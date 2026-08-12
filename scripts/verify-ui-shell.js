"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const pad=path.join(OUT,"index.html");
if(!fs.existsSync(pad))throw new Error("Definitieve WeatherNow-artifact ontbreekt voor UI-shellcontrole.");
const html=fs.readFileSync(pad,"utf8");
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log("OK  "+m);};

ok(html.includes("<!-- WEATHERNOW TABICOON -->"),"normale browsertab heeft een expliciet faviconanker");
ok(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,/.test(html),"favicon is een zelfstandige SVG-data-URI");
ok(html.includes('id="thema" type="button"')&&html.includes('aria-haspopup="menu"'),"weergaveknop kondigt een keuzemenu aan");
ok(html.includes('id="themamenu" role="menu" aria-label="Weergave kiezen" hidden'),"weergavemenu is standaard gesloten en toegankelijk gelabeld");
for(const keuze of ["auto","licht","donker","rood"])ok(html.includes('data-thema-keuze="'+keuze+'"'),"themakeuze "+keuze+" is expliciet beschikbaar");
ok(html.includes("Automatisch (dag/nacht)"),"automatische stand legt het dag/nachtgedrag uit");
ok(html.includes('knop.textContent="Weergave · "+THEMA_KNOP_LABEL[keuze]'),"knop benoemt functie én huidige voorkeur");
ok(html.includes('optie.setAttribute("aria-checked",optie.dataset.themaKeuze===keuze?"true":"false")'),"actieve keuze wordt in het menu gemarkeerd");
ok(html.includes('if(zoek)zoek.classList.remove("on")')&&html.includes('if(invoer)invoer.setAttribute("aria-expanded","false")'),"weergavemenu sluit een eventueel open zoekresultatenpaneel");
ok(html.includes('e.key==="ArrowDown"')&&html.includes('e.key==="ArrowUp"')&&html.includes('e.key==="Home"')&&html.includes('e.key==="End"'),"weergavemenu ondersteunt standaard toetsenbordnavigatie");
ok(html.includes('if(e.key==="Escape"&&!themaMenu.hidden)'),"weergavemenu sluit via Escape");
ok(!html.includes('THEMAS[(THEMAS.indexOf(nu)+1)%THEMAS.length]'),"oude cyclische themalogica is verwijderd");
ok(!html.includes("Klik voor de volgende stand."),"oude onduidelijke cyclusinstructie is verwijderd");
const versie=verifieerServiceworkerCache(OUT,"UI-shellcontrole");
ok(/^watishetweer-[0-9a-f]{12}$/.test(versie),"serviceworker hoort exact bij de UI-shellartifact");
console.log("UI-shellcontrole: "+n+" invarianten geslaagd.");

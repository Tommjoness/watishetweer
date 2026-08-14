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
for(const keuze of ["auto","licht","donker"])ok(html.includes('data-thema-keuze="'+keuze+'"'),"themakeuze "+keuze+" is expliciet beschikbaar");
ok(!html.includes('data-thema-keuze="rood"'),"rode weergavestand is niet langer een productkeuze");
ok(html.includes('const THEMA_KEUZES=["auto","licht","donker"]'),"runtime kent uitsluitend de drie ondersteunde weergavestanden");
ok(html.includes('ls.set("weerbriefing.thema","auto");')&&html.includes('return "auto";'),"oude of ongeldige opgeslagen themakeuzes migreren naar automatisch");
ok(html.includes("Automatisch (dag/nacht)"),"automatische stand legt het dag/nachtgedrag uit");
ok(html.includes('knop.textContent="Weergave"'),"knop benoemt de functie compact zonder afgekapt statuslabel");
ok(html.includes('html[data-thema="donker"]{--ink-45:#A8A8A8;--ink-25:#959595}'),"secundaire dark-mode tekst heeft versterkt contrast");
ok(html.includes('#themamenu button[aria-checked="true"]{background:var(--paper);'),"actieve weergavekeuze krijgt een rustige geselecteerde staat");
ok(html.includes('@media(min-width:901px){#days .row.day,#days .row.kop{padding-right:8px}}'),"weekneerslag houdt op desktop afstand tot de rechterrand");
ok(html.includes('optie.setAttribute("aria-checked",optie.dataset.themaKeuze===keuze?"true":"false")'),"actieve keuze wordt in het menu gemarkeerd");
ok(html.includes('document.querySelectorAll("#res.on,#zoekmelding.on")')&&html.includes('zoekpanelen.forEach(paneel=>paneel.classList.remove("on"))')&&html.includes('if(invoer)invoer.setAttribute("aria-expanded","false")'),"weergavemenu sluit zowel zoekresultaten als zoekmeldingen");
ok(html.includes('e.key==="ArrowDown"')&&html.includes('e.key==="ArrowUp"')&&html.includes('e.key==="Home"')&&html.includes('e.key==="End"'),"weergavemenu ondersteunt standaard toetsenbordnavigatie");
ok(html.includes('if(e.key==="Escape"&&!themaMenu.hidden)'),"weergavemenu sluit via Escape");
ok(!html.includes('THEMAS[(THEMAS.indexOf(nu)+1)%THEMAS.length]'),"oude cyclische themalogica is verwijderd");
ok(!html.includes("Klik voor de volgende stand."),"oude onduidelijke cyclusinstructie is verwijderd");
ok(!html.includes('actief==="rood"'),"rode stand zit niet meer in de actieve themalogica");
const versie=verifieerServiceworkerCache(OUT,"UI-shellcontrole");
ok(/^watishetweer-[0-9a-f]{12}$/.test(versie),"serviceworker hoort exact bij de UI-shellartifact");
console.log("UI-shellcontrole: "+n+" invarianten geslaagd.");

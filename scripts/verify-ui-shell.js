"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");
const {autoThemaOpZon}=require("./theme-solar.js");

const OUT=path.join(__dirname,"..","public");
const pad=path.join(OUT,"index.html");
if(!fs.existsSync(pad))throw new Error("Definitieve WeatherNow-artifact ontbreekt voor UI-shellcontrole.");
const html=fs.readFileSync(pad,"utf8");
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log("OK  "+m);};

/* Pure grensgevallen: exact dezelfde functie wordt door apply-ui-shell letterlijk
   in de browserruntime geïnjecteerd. */
const zonData={
  current:{is_day:1},
  daily:{
    time:["2026-09-13","2026-09-14"],
    sunrise:["2026-09-13T06:56","2026-09-14T06:58"],
    sunset:["2026-09-13T19:55","2026-09-14T19:52"]
  }
};
ok(autoThemaOpZon(zonData,"2026-09-14T06:57")==="donker","auto is minuut vóór lokale zonsopkomst donker");
ok(autoThemaOpZon(zonData,"2026-09-14T06:58")==="licht","auto schakelt exact op lokale zonsopkomst naar licht");
ok(autoThemaOpZon(zonData,"2026-09-14T19:51")==="licht","auto blijft minuut vóór lokale zonsondergang licht");
ok(autoThemaOpZon(zonData,"2026-09-14T19:52")==="donker","auto schakelt exact op lokale zonsondergang naar donker");
ok(autoThemaOpZon(zonData,"2026-09-14T12:00")==="licht","auto gebruikt de zonnegrenzen van de juiste kalenderdag");
ok(autoThemaOpZon({current:{is_day:0},daily:{time:["2026-12-21"],sunrise:[null],sunset:[null]}},"2026-12-21T12:00")==="donker","poolnacht of ontbrekende zondata valt veilig terug op current.is_day");
ok(autoThemaOpZon({current:{is_day:1},daily:{time:["2026-06-21"],sunrise:[null],sunset:[null]}},"2026-06-21T12:00")==="licht","pooldag of ontbrekende zondata behoudt de provider-dagstatus");

ok(html.includes("<!-- WEATHERNOW TABICOON -->"),"normale browsertab heeft een expliciet faviconanker");
ok((html.match(/rel="icon"/g)||[]).length===1,"artifact bevat exact één faviconrelatie");
ok(html.includes('<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png">'),"ruwe HTML publiceert een crawlbare 192px PNG-favicon");
ok(html.includes('document.querySelector("link[rel=icon]")')&&html.includes('f.setAttribute("href","data:image/svg+xml,'),"browser zet dezelfde faviconrelatie om naar het zon-icoon");
ok(html.includes('id="thema" type="button"')&&html.includes('aria-haspopup="menu"'),"weergaveknop kondigt een keuzemenu aan");
ok(html.includes('id="themamenu" role="menu" aria-label="Weergave kiezen" hidden'),"weergavemenu is standaard gesloten en toegankelijk gelabeld");
for(const keuze of ["auto","licht","donker"])ok(html.includes('data-thema-keuze="'+keuze+'"'),"themakeuze "+keuze+" is expliciet beschikbaar");
ok(!html.includes('data-thema-keuze="rood"'),"rode weergavestand is niet langer een productkeuze");
ok(html.includes('const THEMA_KEUZES=["auto","licht","donker"]'),"runtime kent uitsluitend de drie ondersteunde weergavestanden");
ok(html.includes('ls.set("weerbriefing.thema","auto");')&&html.includes('return "auto";'),"oude of ongeldige opgeslagen themakeuzes migreren naar automatisch");
ok(html.includes("Automatisch (dag/nacht)"),"automatische stand legt het dag/nachtgedrag uit");
ok(html.includes("function autoThemaOpZon(data,lokaleTijd)"),"pure zonnegrensfunctie zit in de finale browserruntime");
ok(html.includes('actief=autoThemaOpZon(S.d,weatherNowActueleLokaleTijd())'),"Auto gebruikt gekozen-locatie tijd plus exacte dagelijkse zonnegrenzen");
ok(html.includes('Automatisch volgt zonsopkomst en zonsondergang (nu '),"Auto legt de exacte zonnegrenssemantiek uit in de bediening");
ok(html.includes('if(typeof themaKeuze==="function"&&themaKeuze()==="auto")themaToepassen();'),"bestaande minuutklok herberekent alleen Auto op een zonnegrens");
ok((html.match(/klokMinuutTimer=setInterval\(klokBijwerken,60000\)/g)||[]).length===1,"Auto hergebruikt exact één bestaande minuutklok zonder extra timer");
ok(!html.includes('if(keuze==="auto") actief=(S.d&&S.d.current&&S.d.current.is_day===0)?"donker":"licht";'),"finale UI-shell gebruikt current.is_day niet meer als normale Auto-omschakelgrens");
ok(html.includes('knop.innerHTML=\'Weergave <span class="thema-status" aria-hidden="true">\'+zichtbaar+"</span>"'),"knop toont naast de functie een compacte, decoratieve themastatus");
ok(html.includes('knop.dataset.actieveThemakeuze=keuze'),"actuele themakeuze is ook als stylinghook beschikbaar zonder de menuselector te dupliceren");
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

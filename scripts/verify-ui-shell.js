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
ok(html.includes('id="thema" class="wiw-theme-control" role="group" aria-label="Weergave kiezen"'),"weergavegroep is compact en toegankelijk gelabeld");
ok(html.includes('id="thema-auto" class="wiw-theme-auto" data-thema-keuze="auto" aria-pressed="true"'),"Auto is als zichtbare standaardkeuze beschikbaar");
ok(html.includes('id="thema-switch" class="wiw-theme-switch" role="switch" aria-checked="false"'),"licht/donker heeft een semantische schakelaar");
ok(html.includes('data-thema-handmatig="licht"')&&html.includes('data-thema-handmatig="donker"'),"zon en maan bieden directe handmatige keuzes");
ok(html.includes('class="wiw-theme-track"')&&html.includes('class="wiw-theme-thumb"'),"toggle-track en thumb zijn visueel aanwezig");
ok(html.includes("wiw-theme-sun")&&html.includes("wiw-theme-moon"),"toggle toont zon en maan naast de schakelaar");
ok(html.includes('const THEMA_KEUZES=["auto","licht","donker"]'),"runtime kent uitsluitend de drie ondersteunde weergavestanden");
ok(html.includes('ls.set("weerbriefing.thema","auto");')&&html.includes('return "auto";'),"oude of ongeldige opgeslagen themakeuzes migreren naar automatisch");
ok(html.includes("Automatisch (dag/nacht)"),"automatische stand legt het dag/nachtgedrag uit");
ok(html.includes("function autoThemaOpZon(data,lokaleTijd)"),"pure zonnegrensfunctie zit in de finale browserruntime");
ok(html.includes('return autoThemaOpZon(S.d,weatherNowActueleLokaleTijd());'),"Auto gebruikt gekozen-locatie tijd plus exacte dagelijkse zonnegrenzen");
ok(html.includes('groep.dataset.actieveThemaKeuze=keuze')&&html.includes('groep.dataset.effectieveThema=actief'),"voorkeur en effectieve stand zijn afzonderlijk beschikbaar voor UI-status");
ok(html.includes('autoKnop.setAttribute("aria-pressed",keuze==="auto"?"true":"false")'),"Auto wordt als geselecteerde voorkeur gemarkeerd");
ok(html.includes('schakelaar.setAttribute("aria-checked",donker?"true":"false")'),"zon/maan-toggle toont de effectieve licht/donker-stand");
ok(html.includes('themaAutoKnop.addEventListener("click"')&&html.includes('themaSchakelaar.addEventListener("click"'),"Auto-reset en handmatige toggle hebben eigen bediening");
ok(html.includes('if(typeof themaKeuze==="function"&&themaKeuze()==="auto")themaToepassen();'),"bestaande minuutklok herberekent alleen Auto op een zonnegrens");
ok((html.match(/klokMinuutTimer=setInterval\(klokBijwerken,60000\)/g)||[]).length===1,"Auto hergebruikt exact één bestaande minuutklok zonder extra timer");
ok(!html.includes('if(keuze==="auto") actief=(S.d&&S.d.current&&S.d.current.is_day===0)?"donker":"licht";'),"finale UI-shell gebruikt current.is_day niet meer als normale Auto-omschakelgrens");
ok(html.includes('#thema.wiw-theme-control{')&&html.includes('#thema .wiw-theme-track{')&&html.includes('#thema .wiw-theme-thumb{'),"toggle gebruikt een rustige passende track/thumb-vorm");
ok(html.includes('#thema[data-effectieve-thema="donker"] .wiw-theme-thumb{transform:translateX(14px)'),"donkere effectieve stand schuift de thumb zichtbaar naar de maan");
ok(html.includes('@media(max-width:430px){\\n  #thema.wiw-theme-control'),"toggle schaalt mee op compacte mobiele viewports");
ok(html.includes('html[data-thema="donker"]{--ink-45:#A8A8A8;--ink-25:#959595}'),"secundaire dark-mode tekst heeft versterkt contrast");
ok(html.includes('@media(min-width:901px){#days .row.day,#days .row.kop{padding-right:8px}}'),"weekneerslag houdt op desktop afstand tot de rechterrand");
ok(html.includes('e.key==="ArrowLeft"')&&html.includes('e.key==="ArrowRight"')&&html.includes('e.key==="Home"')&&html.includes('e.key==="End"'),"toggle ondersteunt standaard toetsenbordnavigatie");
ok(!html.includes("themamenu")&&!html.includes("aria-haspopup=\"menu\""),"oude uitklapmenu is volledig verwijderd");
ok(!html.includes('THEMAS[(THEMAS.indexOf(nu)+1)%THEMAS.length]'),"oude cyclische themalogica is verwijderd");
ok(!html.includes("Klik voor de volgende stand."),"oude onduidelijke cyclusinstructie is verwijderd");
ok(!html.includes('actief==="rood"'),"rode stand zit niet meer in de actieve themalogica");
const versie=verifieerServiceworkerCache(OUT,"UI-shellcontrole");
ok(/^watishetweer-[0-9a-f]{12}$/.test(versie),"serviceworker hoort exact bij de UI-shellartifact");
console.log("UI-shellcontrole: "+n+" invarianten geslaagd.");

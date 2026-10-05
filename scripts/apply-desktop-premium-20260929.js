"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-desktop-premium-20260929";
const OWNER_ID="wiw-samenhang-20260926";

/* Desktop na de review van de eigenaar op 29 september (breed scherm):
   "de kwaliteit is teruggevallen door de uitlijning, kleine letters, missende
   data en vele open ruimtes".
   - Eén kolom: het vel met kop, grafiek, tabellen, Nachtzicht, bronnen en
     voet is hooguit 1600px breed en staat in het midden; de plaatsnavigatie
     eronder lijnt op dezelfde randen uit. Op een breed scherm stond alles tot
     aan de schermranden, met grote gaten tussen de kolommen en de bronnen en
     voet helemaal links.
   - Letters: vanaf 1100px zijn labels minimaal 12px, uitleg en voet 14px en
     tabelwaarden 15px; vanaf 1440px (breed scherm) 12,5, 15 en 16px. De
     uurtabel naast de grafiek houdt tot 1600px haar maat (de kolom is daar
     smal); daarboven staat ieder uur op één regel in een iets bredere kolom
     (grafiek 1,9 : tabel 1).
   - Nachtzicht: de kolom Maan is zo breed als haar tekst, zodat er rechts
     geen lege kolom meer staat; Beste zichtperiode neemt de ruimte.
   - Lucht, pollen en zon beslaat dezelfde breedte als de rest, in plaats van
     een smaller blok in het midden.
   - De plaatsnavigatie begint direct na haar kop, in plaats van midden in de
     regel. */
const NIET=":not(#wiw-desktop-premium)";
const CSS=`
@media (min-width:1100px){
  html body>.sheet${NIET}{max-width:1600px!important;margin-left:auto!important;margin-right:auto!important}
  html body .seo-plaatsnav-inner${NIET}{max-width:1600px!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}
  html body .seo-route-context${NIET}{max-width:1600px!important;margin-left:auto!important;margin-right:auto!important}
  html body .seo-plaatsnav-links${NIET}{justify-content:flex-start!important}
  /* De kop "Populaire plaatsen in Nederland" kreeg een vaste kolom van 275px;
     de langere Engelse kop ("Popular places in the Netherlands") liep daardoor
     over de eerste plaatsnaam heen (3 oktober). De kolom is nu zo breed als de
     kop zelf, in iedere taal, met vaste ruimte tot de eerste link. */
  html body>.seo-plaatsnav .seo-plaatsnav-inner${NIET}{grid-template-columns:max-content minmax(0,1fr)!important;column-gap:24px!important}
  html body #app #aq.stats${NIET}{max-width:none!important;width:auto!important;margin-left:0!important;margin-right:0!important}
  html body #app footer .bron${NIET}{white-space:normal!important}
  html body #nights .row.night${NIET}{grid-template-columns:112px minmax(150px,190px) 100px minmax(120px,150px) minmax(0,1fr) max-content!important;justify-content:stretch!important}
  /* De uurtabel naast de grafiek tekent nooit buiten het grafiekvak: steekt er
     door een onvolledige hoogtemeting toch een rij uit, dan valt die weg in
     plaats van over Zeven dagen heen te vallen. */
  html body .wiw-chart-layout:not([data-hour-paired="0"]) #wiw-hour-panel${NIET}{overflow:hidden!important;overflow:clip!important}

  /* Labels in hoofdletters */
  html body #app .stat .eyebrow${NIET},html body #app h2>span${NIET},
  html body #chartlab${NIET},html body #days .row.kop>div${NIET},html body #nights .row.kop>*${NIET},html body #nights .row.kop span${NIET},
  html body footer .bronlabel${NIET},html body .wiw-weergave-label${NIET},html body .seo-plaatsnav-kop${NIET},
  html body #here${NIET},html body #here span${NIET},html body #ververs${NIET},html body .wiw-theme-auto${NIET}{font-size:12px!important}
  /* Tweede regels en eenheden */
  html body #stamp${NIET},html body #plaatstijd${NIET},html body #app .sval>s${NIET},
  html body #moonlab${NIET},html body #moonlab span${NIET},html body #nights .nachtmaanregel${NIET},html body #days .row:not(.kop) small${NIET}{font-size:13px!important}
  /* Uitleg, tegelzinnen, voet en navigatie */
  html body #app .stat .ssub${NIET},html body #app p.hint${NIET},html body #waarschuwingen .msg${NIET},
  html body #app footer .bron${NIET},html body #app footer a${NIET},html body #app footer summary${NIET},html body #app footer .footer-contact${NIET},html body #app footer .footer-contact span${NIET},
  html body .seo-plaatsnav-links a${NIET},html body #nights .perc${NIET},html body #nights .nacht-meer${NIET},html body .chip${NIET}{font-size:14px!important}
  /* Tabelwaarden */
  html body #nights .nachtoordeel${NIET},html body #nights .nachtvenster${NIET},
  html body #days .dlang${NIET},html body #nights .nachtlabel-lang${NIET},html body #feels${NIET},
  html body #days .row:not(.kop)>.dcond${NIET},html body #days .row:not(.kop)>.dwind${NIET},html body #days .row:not(.kop)>.dmin${NIET},html body #days .row:not(.kop)>.dmax${NIET},html body #days .row:not(.kop)>.drain${NIET}{font-size:15px!important}
}
@media (min-width:1440px){
  html body #app .stat .eyebrow${NIET},html body #app h2>span${NIET},
  html body #chartlab${NIET},html body #days .row.kop>div${NIET},html body #nights .row.kop>*${NIET},html body #nights .row.kop span${NIET},
  html body footer .bronlabel${NIET},html body .wiw-weergave-label${NIET},html body .seo-plaatsnav-kop${NIET},
  html body #here${NIET},html body #here span${NIET},html body #ververs${NIET},html body .wiw-theme-auto${NIET}{font-size:12.5px!important}
  html body #stamp${NIET},html body #plaatstijd${NIET},html body #app .sval>s${NIET},
  html body #moonlab${NIET},html body #moonlab span${NIET},html body #nights .nachtmaanregel${NIET},html body #days .row:not(.kop) small${NIET}{font-size:13.5px!important}
  html body #app .stat .ssub${NIET},html body #app p.hint${NIET},html body #waarschuwingen .msg${NIET},
  html body #app footer .bron${NIET},html body #app footer a${NIET},html body #app footer summary${NIET},html body #app footer .footer-contact${NIET},html body #app footer .footer-contact span${NIET},
  html body .seo-plaatsnav-links a${NIET},html body #nights .perc${NIET},html body #nights .nacht-meer${NIET},html body .chip${NIET}{font-size:15px!important}
  html body #nights .nachtoordeel${NIET},html body #nights .nachtvenster${NIET},
  html body #days .dlang${NIET},html body #nights .nachtlabel-lang${NIET},html body #feels${NIET},
  html body #days .row:not(.kop)>.dcond${NIET},html body #days .row:not(.kop)>.dwind${NIET},html body #days .row:not(.kop)>.dmin${NIET},html body #days .row:not(.kop)>.dmax${NIET},html body #days .row:not(.kop)>.drain${NIET}{font-size:16px!important}
  html body #app .stat .sval${NIET}{font-size:34px!important}
}
@media (min-width:1600px){
  /* Uurtabel (vanaf 1600px, waar de kolom breed genoeg is): één regel per uur ("0,4 mm 45% kans", "ZZW 4 Bft 25 km/u") in
     een iets bredere kolom, zodat naast de (hogere) grafiek meer uren passen.
     De kolommen volgen hun inhoud. Grafiek 1,9 : tabel 1 (grafiek ruim 65%)
     met krappe celmarges: ook lange waarden zoals "12,4 mm 100% kans" en
     "WZW 9 Bft 88 km/u" passen dan op één regel. */
  html body .wiw-chart-layout:not([data-hour-paired="0"])${NIET}{grid-template-columns:minmax(0,1.9fr) minmax(460px,1fr)!important}
  html body #wiw-hour-table.wiw-hour-table${NIET}{table-layout:auto!important}
  html body #wiw-hour-table th${NIET},html body #wiw-hour-table td${NIET}{width:auto!important}
  /* Vangnet voor uitzonderlijk lange waarden: iedere waarde blijft heel
     ("12,4 mm", "100% kans"), maar tussen de twee waarden mag de regel breken.
     De tweede waarde is daarvoor een inline-blok, want in de HTML staat er
     geen spatie tussen. Zo'n regel gaat netjes naar een tweede regel in
     plaats van buiten de tabel te lopen. */
  html body #wiw-hour-table td>span${NIET},html body #wiw-hour-table td time${NIET}{white-space:nowrap!important}
  html body #wiw-hour-table tbody td${NIET}{padding:calc(3px + var(--wiw-hour-row-pad-extra,0px)) 4px!important;line-height:1.25!important}
  html body #wiw-hour-table .wiw-hour-weather-icon svg${NIET}{width:18px!important;height:18px!important}
  html body #wiw-hour-table .wiw-hour-rain>span${NIET},html body #wiw-hour-table .wiw-hour-wind>span${NIET}{display:inline!important}
  html body #wiw-hour-table .wiw-hour-rain>.wiw-hour-secondary${NIET},html body #wiw-hour-table .wiw-hour-wind>.wiw-hour-secondary${NIET}{display:inline-block!important;margin-left:.3em!important;font-size:13px!important}
  html body #wiw-hour-table .wiw-hour-primary${NIET},html body #wiw-hour-table time${NIET}{font-size:15px!important}
  html body #wiw-hour-table thead th${NIET}{font-size:12.5px!important;padding-left:4px!important;padding-right:4px!important}
  html body #wiw-hour-table .wiw-hour-secondary${NIET}{font-size:13px!important}
}
@media (min-width:1100px){
  /* Zeven dagen: de temperatuurbalk krijgt de ruimte, niet een lege strook
     achter de korte verwachtingstekst. */
  html body #days .row.day${NIET}{grid-template-columns:150px 28px minmax(200px,1fr) minmax(84px,.35fr) 52px minmax(200px,1.25fr) 52px 96px!important;column-gap:16px!important}
  /* De kopregel krijgt rechts dezelfde ruimte als de dagrijen (die houden
     plaats voor het pijltje): anders krijgen de kolommen in de kop een andere
     breedte en staan Wind max, Min en Max 7 tot 16px naast hun waarden. De
     balk spreekt voor zich; het woord "Temp.bereik" vervalt, min en max staan
     er al naast. */
  html body #days .row.day.kop${NIET}{padding-right:24px!important}
  html body #days .row.day.kop>.bar${NIET}{visibility:hidden!important}
  html body #days .row.day>.dwind${NIET},html body #days .row.day>.dmin${NIET},html body #days .row.day>.dmax${NIET}{text-align:center!important;justify-self:stretch!important}

  /* Uurtabel: Wind gecentreerd, kop en waarden, zoals Temperatuur. */
  html body #wiw-hour-table thead th:nth-child(5)${NIET},html body #wiw-hour-table td.wiw-hour-wind${NIET}{text-align:center!important}

  /* Nachtzicht: de kop Zichtscore staat gecentreerd; het scorecijfer staat
     precies onder dat midden en het balkje direct rechts ernaast. Een leeg
     balkje (score 0) is bijna onzichtbaar; met de groep als midden leek het
     cijfer dan links van de kop te staan (eigenaar, 5 oktober). */
  html body #nights .row.night.kop>.score${NIET}{text-align:center!important}
  html body #nights .row.night.kop>.score${NIET}{padding-left:0!important;padding-right:0!important}
  html body #nights .row.night:not(.kop)>.score${NIET}{justify-self:stretch!important;text-align:center!important;padding-left:0!important;padding-right:0!important}
  html body #nights .row.night:not(.kop)>.sbar${NIET}{width:calc(50% - 34px)!important;margin-right:0!important}

  /* Nachtzicht: Beoordeling gecentreerd, kop en oordeel, zoals de kolommen
     eromheen. De kop Bewolking past zonder binnenmarge precies in zijn kolom;
     met marge liep hij rechts over en stond hij 4px uit het midden. */
  html body #nights .row.night.kop>.sbar${NIET},html body #nights .row.night:not(.kop)>.nachtadvies${NIET}{text-align:center!important}
  html body #nights .row.night.kop>.nmeta:not(.wide)${NIET}{padding-left:0!important;padding-right:0!important}

  /* Nachtzicht: Beste zichtperiode en Maan staan gecentreerd, kop en tekst,
     net als Bewolking. */
  html body #nights .row.night.kop>.nmeta.wide${NIET},html body #nights .row.night.kop>.wiw-night-moon-head${NIET},
  html body #nights .row.night:not(.kop)>.nachtvenster${NIET},html body #nights .row.night:not(.kop)>.nachtmaan${NIET}{text-align:center!important;padding-left:10px!important;padding-right:10px!important}

  /* Voet: bronnen, disclaimer, links en de weergaveknop gecentreerd onder de
     pagina; de disclaimer in een leesbare breedte. */
  html body #app footer${NIET},html body #app footer>.bron${NIET},html body #app footer>.footer-contact${NIET},
  html body .wiw-weergave-voet${NIET}{justify-content:center!important;text-align:center!important}
  html body #app footer>span.bron:not(.bron-bronnen):not(:has(a))${NIET}{flex:0 0 100%!important;max-width:none!important;box-sizing:border-box!important;padding-left:max(0px,calc((100% - 900px) / 2))!important;padding-right:max(0px,calc((100% - 900px) / 2))!important}
}
@media (min-width:1360px){
  /* Vanaf 1360px heeft Maan een eigen kolom. Iedere Nachtzicht-rij is een
     eigen grid: met een kolom zo breed als de inhoud was de kolom in de
     kopregel smaller dan in de nachten, zodat "Beste zichtperiode" en "Maan"
     niet boven hun tekst stonden. Een vaste maat houdt kop en nachten gelijk. */
  html body #nights .row.night${NIET}{grid-template-columns:112px minmax(150px,190px) 100px minmax(120px,150px) minmax(0,1fr) minmax(220px,260px)!important}
}
`;

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
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": desktoplaag staat al in artifact.");
  if(!html.includes("</head>"))throw new Error(rel+": headafsluiting ontbreekt.");
  return html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8");
    if(!html.includes(`id="${OWNER_ID}"`))continue;
    fs.writeFileSync(p,pasToe(html,path.relative(OUT,p)),"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door de desktoplaag.");
  const cache=vernieuwServiceworkerCache(OUT,"desktop-premium-20260929");
  console.log("Desktoplaag toegepast op "+geraakt+" weerartifacts (één kolom van hooguit 1600px, grotere letters, Nachtzicht zonder lege kolom); cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CSS,htmlBestanden,pasToe,main};

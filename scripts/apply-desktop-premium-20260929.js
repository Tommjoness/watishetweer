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
     (grafiek twee derde, tabel een derde).
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
  html body #app #aq.stats${NIET}{max-width:none!important;width:auto!important;margin-left:0!important;margin-right:0!important}
  html body #app footer .bron${NIET}{white-space:normal!important}
  html body #nights .row.night${NIET}{grid-template-columns:112px minmax(150px,190px) 100px minmax(120px,150px) minmax(0,1fr) max-content!important;justify-content:stretch!important}

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
  /* Uurtabel (vanaf 1600px, waar de kolom breed genoeg is): één regel per uur ("0,0 mm 0% kans", "NW 3 Bft 14 km/u") in
     een iets bredere kolom, zodat naast de (hogere) grafiek meer uren passen.
     De kolommen volgen hun inhoud. */
  html body .wiw-chart-layout:not([data-hour-paired="0"])${NIET}{grid-template-columns:minmax(0,2fr) minmax(440px,1fr)!important}
  html body #wiw-hour-table.wiw-hour-table${NIET}{table-layout:auto!important}
  html body #wiw-hour-table th${NIET},html body #wiw-hour-table td${NIET}{width:auto!important;white-space:nowrap!important}
  html body #wiw-hour-table tbody td${NIET}{padding:calc(3px + var(--wiw-hour-row-pad-extra,0px)) 6px!important;line-height:1.25!important}
  html body #wiw-hour-table .wiw-hour-weather-icon svg${NIET}{width:18px!important;height:18px!important}
  html body #wiw-hour-table .wiw-hour-rain>span${NIET},html body #wiw-hour-table .wiw-hour-wind>span${NIET}{display:inline!important}
  html body #wiw-hour-table .wiw-hour-rain>.wiw-hour-secondary${NIET},html body #wiw-hour-table .wiw-hour-wind>.wiw-hour-secondary${NIET}{margin-left:.4em!important;font-size:13px!important}
  html body #wiw-hour-table .wiw-hour-primary${NIET},html body #wiw-hour-table time${NIET}{font-size:15px!important}
  html body #wiw-hour-table thead th${NIET}{font-size:12.5px!important}
  html body #wiw-hour-table .wiw-hour-secondary${NIET}{font-size:13px!important}
}
@media (min-width:1100px){
  /* Zeven dagen: de temperatuurbalk krijgt de ruimte, niet een lege strook
     achter de korte verwachtingstekst. */
  html body #days .row.day${NIET}{grid-template-columns:150px 28px minmax(200px,1fr) minmax(84px,.35fr) 52px minmax(200px,1.25fr) 52px 96px!important;column-gap:16px!important}
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

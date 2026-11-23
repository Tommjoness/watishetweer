"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const {OUT,htmlBestanden}=require("./apply-kleur-20261012.js");

/* G2-A typografie (eigenaar 22 en 23 november, ontwerp "G2" akkoord).
   - Eén letter: koppen, plaatsnaam en grote cijfers stonden in Bodoni Moda.
     --serif wijst nu naar --sans (Instrument Sans). Koppen krijgen 600 met
     iets strakkere letterafstand (-0,02em); de grote temperatuur en de grote
     aftelcijfers blijven dun (400); de weersomschrijving (#cond) 500.
   - SVG-tekst met font-family="Bodoni Moda" (temperatuurlabels in de
     grafiek) houdt dat attribuut, omdat runtime en tests die labels eraan
     herkennen. CSS gaat voor op het presentatieattribuut, dus ook die
     labels staan in Instrument Sans.
   - Kopjes in hoofdletters met wijde letterafstand worden gewone
     schrijfwijze, letterafstand 0, gewicht 600. Dat geldt alleen voor de
     regels die nu hoofdletters afdwingen; de hoofdletter aan het begin van
     een dagnaam (::first-letter) blijft.
   - "Mijn Locatie" wordt "Mijn locatie" (zie de regel voor #here).
   - Geen zichtbare tekst onder 12px: de weergaveknoppen op /weer/ en het
     statuskopje van Witte kerst stonden op 11px.
   - Bodoni wordt niet meer gepreload (platform-output-cleanup); de 600 van
     Instrument Sans wel, omdat de koppen die nu gebruiken.
   Alle regels hebben :not(#wiw-g2) en !important, omdat ze bestaande lagen
   met hogere specificiteit moeten overschrijven. */
const STYLE_ID="wiw-g2-typografie-20261123";

const HOOFDLETTERS=[
  ".eyebrow","button",".chips .chipskop","h2","#suntimes .zondag",".row.kop>*",
  "#nights .nacht-meer",".bron-bronnen .bronlabel","footer .bron-bronnen .bronlabel","#thema .wiw-theme-auto",
  "#modelrisico .modelrisico-label","#thema #thema-switch","#thema .wiw-theme-icon",
  ".wiw-weergave-label",".seo-route-context h2",".seo-plaatsnav-kop",".wiw-menu-kop",
  ".hub-weergave button",".wk-page .wk-note h2",".nz-feiten dt",
  ".wiw-hour-table thead th",".wiw-hour-marker"
];
const KOPPEN=[
  "h1","#place",".brand","#miniplaats",".tip-kop","#wiw-hour-title",
  ".seo-plaatsnav-kop",".seo-route-context h2",'h2[id^="kop-"]',".nz-maan .groot",
  ".wk-page .wk-guide>h2",".wk-page .wk-related>h2",".wk-page .wk-qa h2"
];
const DUN=["#t","#t *",".deg","#plaatstijd",".seizoen-aftellen",".seizoen-aftellen *"];
/* Een gewone selectorlijst (geen :is()), zodat iedere selector zijn eigen
   specificiteit houdt en specifiekere koppen voorgaan op de basisregel h2. */
const lijst=a=>a.map(s=>"html body "+s+":not(#wiw-g2)").join(",");

const CSS=`
html:root:not(#wiw-g2){--serif:var(--sans)!important}
html body svg text[font-family*="Bodoni"]:not(#wiw-g2){font-family:var(--sans)!important}
${lijst(HOOFDLETTERS)}{text-transform:none!important;letter-spacing:0!important;font-weight:600!important}
${lijst(KOPPEN)}{font-weight:600!important;letter-spacing:-.02em!important}
${lijst(DUN)}{font-weight:400!important;letter-spacing:-.02em!important}
html body #cond:not(#wiw-g2),html body #minicond:not(#wiw-g2){font-weight:500!important;letter-spacing:0!important}
html body .hub-weergave button:not(#wiw-g2),html body #wk-status-kop:not(#wiw-g2){font-size:12px!important}
/* De locatieknop is "<span>Mijn </span>Locatie", omdat tot 900px alleen het
   tweede woord past. In hoofdletters viel de hoofdletter L niet op; in gewone
   schrijfwijze wordt het "Mijn locatie" (EN "My location"), en zonder
   voorvoegsel "Locatie". Tekst, vertaling en toegankelijke naam blijven gelijk. */
html body #here:not(#wiw-g2){text-transform:lowercase!important}
html body #here:not(#wiw-g2)::first-letter{text-transform:uppercase!important}
`;

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": G2-typografie staat al in artifact.");
  if(!html.includes("</head>"))throw new Error(rel+": headafsluiting ontbreekt.");
  return html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
}
/* Admin en de losse 404 (eigen, kale opmaak) vallen buiten de sitelaag. */
const doelpagina=rel=>!rel.split(path.sep).includes("admin")&&rel!=="404.html";

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const rel=path.relative(OUT,p);
    if(!doelpagina(rel))continue;
    fs.writeFileSync(p,pasToe(fs.readFileSync(p,"utf8"),rel),"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen pagina geraakt door de G2-typografielaag.");
  const cache=vernieuwServiceworkerCache(OUT,"g2-typografie-20261123");
  console.log("G2-typografie toegepast op "+geraakt+" pagina's: één letter, koppen 600, grote cijfers 400, geen hoofdletterkopjes, minimaal 12px; cache "+cache+".");
  return {geraakt};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,CSS,HOOFDLETTERS,KOPPEN,DUN,pasToe,doelpagina,main};

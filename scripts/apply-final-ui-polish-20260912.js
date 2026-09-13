"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-final-ui-polish-20260912";
const POLLEN_OUD="Pollen is een CAMS-modelconcentratie; lokale blootstelling en persoonlijke gevoeligheid kunnen afwijken.";
const POLLEN_NIEUW="Pollenwaarden zijn een verwachting van CAMS; de werkelijke blootstelling kan lokaal verschillen.";
const FOOTER_DISCLAIMER="Weersinformatie is algemeen en probabilistisch. Gebruik deze niet als enige basis voor persoonlijke veiligheid, luchtvaart, scheepvaart of noodplanning; raadpleeg daarvoor officiële meteorologische diensten en autoriteiten.";
const FOOTER_DISCLAIMER_CLASS="footer-disclaimer-row";
const FOOTER_UTILITY_CLASS="footer-utility-row";

/* Uitsluitend visuele/tekstuele polish. Geen provider-, data-, interpretatie- of
   interactielogica. Deze late laag wint bewust van eerdere gedateerde UI-owners
   zonder hun functionele contracten te wijzigen. */
const CSS=`
/* Luchtkwaliteit/pollen: één rustige rij met echte buitenruimte en gelijk ritme. */
#aq{
  box-sizing:border-box;
  padding-inline:18px;
}
#aq .stat{
  box-sizing:border-box;
  min-width:0;
  padding:15px 18px 17px!important;
  text-align:center;
}
#aq .stat .eyebrow,
#aq .stat .sval,
#aq .stat .ssub{
  width:100%;
  text-align:center;
}
#aq .stat .sval{
  justify-content:center;
  margin-top:6px;
}
#aq .stat .ssub{
  margin-top:5px;
  line-height:1.4;
}

/* De grafiekbox zelf blijft exact binnen .wiw-chart-main. Alleen de visuele
   regenannotatie onder de x-as schuift op desktop zes pixels omhoog. Daardoor
   wordt de bedoelde interne gap compacter zonder overflow of hoogtecontracten
   van grafiek en uurpaneel te veranderen. Mobiel behoudt zijn bestaande ritme. */
@media(min-width:1100px){
  #chart g[data-q4-rain-periods]{
    transform:translateY(-6px);
    transform-box:view-box;
    transform-origin:0 0;
  }
}

/* De overgang naar de plaatsnavigatie gebruikt dezelfde rand, maar zachter en
   met iets meer ademruimte. Geen nieuw scheidingselement of extra blok. */
body > .sheet{border-bottom-color:var(--rule-soft)}
body > .seo-plaatsnav{margin-top:18px!important}

/* Footer: disclaimer en utility-items zijn echte, afzonderlijke blokrijen.
   Daardoor is de scheiding structureel en niet afhankelijk van tekstlengte,
   grid-autoplacement of een toevallige regelafbreking. Linkkleuren, hover en
   focus blijven volledig van de bestaande footerstijlen erven. */
footer .footer-details>summary{
  color:inherit;
  box-shadow:inset 0 -1px 0 var(--rule);
}
footer .footer-details>summary:hover,
footer .footer-details>summary:focus-visible{
  color:var(--ink);
  box-shadow:inset 0 -1px 0 var(--ink);
}
footer > .${FOOTER_DISCLAIMER_CLASS}{
  display:block;
  width:100%;
}
footer > .${FOOTER_UTILITY_CLASS}{
  display:flex;
  width:100%;
  min-width:0;
  flex-wrap:wrap;
  align-items:baseline;
  gap:2px 16px;
}
footer > .${FOOTER_UTILITY_CLASS} > .bron{
  min-width:0;
}
footer > .${FOOTER_UTILITY_CLASS} > details.footer-details[open]{
  flex-basis:100%;
}

@media(min-width:901px){
  /* Desktop blijft drie rustige visuele lagen: bronnen, disclaimer, utilities. */
  footer{
    display:flex!important;
    flex-direction:column!important;
    align-items:center!important;
    gap:3px!important;
  }
  footer > .bron,
  footer > .${FOOTER_DISCLAIMER_CLASS}{text-align:center}
  footer > .${FOOTER_UTILITY_CLASS}{justify-content:center}
  footer > .${FOOTER_UTILITY_CLASS} > details.footer-details[open]{justify-content:center}
}

@media(min-width:901px){
  #aq .stat .ssub{min-height:2.8em}
  #aq.aq-cols-1 .stat:nth-child(n),
  #aq.aq-cols-2 .stat:nth-child(2n),
  #aq.aq-cols-3 .stat:nth-child(3n),
  #aq.aq-cols-4 .stat:nth-child(4n){border-right:0}
}

@media(max-width:900px){
  #aq{padding-inline:10px}
  #aq .stat{padding:14px 12px 15px!important}
  #aq .stat:nth-child(2n){border-right:0}
  #aq.aq-cols-1 .stat,
  #aq.aq-cols-3 .stat:last-child,
  #aq > .stat:last-child:nth-child(odd){border-right:0}
  body > .seo-plaatsnav{margin-top:14px!important}
  footer > .${FOOTER_UTILITY_CLASS}{justify-content:flex-start}
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

function exactEen(bron,oud,nieuw,label,rel){
  const n=bron.split(oud).length-1;
  if(n!==1)throw new Error(rel+": "+label+" ontbreekt of is dubbel: "+n);
  return bron.replace(oud,nieuw);
}

function matches(bron,re){return [...String(bron).matchAll(new RegExp(re.source,re.flags.includes("g")?re.flags:re.flags+"g"))];}

function structureerFooter(html,rel){
  const bron=String(html);
  const heeftOver=/href="\/over\/"[^>]*>Over deze site<\/a>/.test(bron);
  if(!heeftOver)return bron;
  if(bron.includes(`class="${FOOTER_DISCLAIMER_CLASS}"`)||bron.includes(`class="${FOOTER_UTILITY_CLASS}"`))throw new Error(rel+": footer-rijstructuur staat al in artifact.");

  const footers=matches(bron,/<footer>[\s\S]*?<\/footer>/);
  if(footers.length!==1)throw new Error(rel+": verwacht exact één footer voor rijstructuur; gevonden "+footers.length+".");
  const footer=footers[0][0];
  const disclaimerRe=new RegExp(`<span class="bron">${FOOTER_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}</span>`);
  const overRe=/<span class="bron"><a href="\/over\/">Over deze site<\/a><\/span>/;
  const privacyRe=/<span class="bron"><a href="\/privacy(?:\.html)?">Privacy &amp; gegevens<\/a><\/span>/;
  const detailsRe=/<details class="bron footer-details">[\s\S]*?<\/details>/;
  const disclaimer=matches(footer,disclaimerRe),over=matches(footer,overRe),privacy=matches(footer,privacyRe),details=matches(footer,detailsRe);
  for(const [naam,gevonden] of [["disclaimer",disclaimer],["Over deze site",over],["Privacy & gegevens",privacy],["Technische locatiegegevens",details]]){
    if(gevonden.length!==1)throw new Error(rel+": footer verwacht exact één "+naam+"-item; gevonden "+gevonden.length+".");
  }
  const d=disclaimer[0],o=over[0],p=privacy[0],t=details[0];
  if(!(d.index<o.index&&o.index<p.index&&p.index<t.index))throw new Error(rel+": footer-items staan niet in de verwachte bronvolgorde.");
  if(footer.slice(o.index+o[0].length,p.index).trim()||footer.slice(p.index+p[0].length,t.index).trim())throw new Error(rel+": onverwachte inhoud tussen footer-utility-items; niet veilig om te groeperen.");

  const innerStart="<footer>".length;
  const innerEnd=footer.length-"</footer>".length;
  const inner=footer.slice(innerStart,innerEnd);
  const di=d.index-innerStart,oi=o.index-innerStart,ti=t.index-innerStart;
  const naDetails=ti+t[0].length;
  const nieuwInner=
    inner.slice(0,di)+
    `<div class="${FOOTER_DISCLAIMER_CLASS}">${d[0]}</div>`+
    inner.slice(di+d[0].length,oi)+
    `<div class="${FOOTER_UTILITY_CLASS}">\n        ${o[0]}\n        ${p[0]}\n        ${t[0]}\n      </div>`+
    inner.slice(naDetails);
  const nieuweFooter="<footer>"+nieuwInner+"</footer>";
  return bron.slice(0,footers[0].index)+nieuweFooter+bron.slice(footers[0].index+footer.length);
}

function main(){
  let geraakt=0,gestructureerd=0;
  for(const p of htmlBestanden(OUT)){
    let html=fs.readFileSync(p,"utf8");
    if(!html.includes(POLLEN_OUD))continue;
    const rel=path.relative(OUT,p);
    if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": finale UI-polish staat al in artifact.");
    if(!html.includes('id="aq"')||!html.includes('id="chart"'))throw new Error(rel+": verwachte UI-hooks ontbreken.");
    if(!html.includes("</head>"))throw new Error(rel+": </head> ontbreekt.");

    html=exactEen(html,POLLEN_OUD,POLLEN_NIEUW,"pollentoelichting",rel);
    const voorFooter=html;
    html=structureerFooter(html,rel);
    if(html!==voorFooter)gestructureerd++;
    html=html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
    fs.writeFileSync(p,html,"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door finale UI-polish.");
  if(!gestructureerd)throw new Error("Geen footer met Over-link structureel in disclaimer- en utilityrij gescheiden.");
  const cache=vernieuwServiceworkerCache(OUT,"final-ui-polish-20260912");
  console.log(`Finale UI-polish toegepast op ${geraakt} weerartifacts; ${gestructureerd} footers structureel in drie lagen gezet; cache ${cache}.`);
  return {geraakt,gestructureerd,cache};
}

if(require.main===module)main();

module.exports={OUT,STYLE_ID,POLLEN_OUD,POLLEN_NIEUW,FOOTER_DISCLAIMER,FOOTER_DISCLAIMER_CLASS,FOOTER_UTILITY_CLASS,CSS,htmlBestanden,exactEen,structureerFooter,main};

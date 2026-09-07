"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {OUT,MARKER,STYLE_MARKER,UREN_OUD,UREN_NIEUW,MM_OUD,MM_NIEUW,htmlBestanden}=require("./apply-hour-panel-refinement-20260907.js");

function eis(ok,msg){if(!ok)throw new Error(msg);}
let geraakt=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes("WeatherNowFinalDesktopUI20260902"))continue;
  geraakt++;
  const rel=path.relative(OUT,p);
  eis(html.includes(MARKER),`${rel}: uurpaneelrefinement-marker ontbreekt`);
  const headEinde=html.indexOf("</head>"),stijlPos=html.indexOf(STYLE_MARKER);
  eis(stijlPos>=0,`${rel}: desktop-finishing-marker ontbreekt`);
  eis(headEinde>=0&&stijlPos<headEinde,`${rel}: desktop-finishing-stijl staat niet in de actieve head`);
  const openStyle=html.lastIndexOf("<style",stijlPos),dichtStyle=html.lastIndexOf("</style>",stijlPos);
  eis(openStyle>=0&&openStyle>dichtStyle,`${rel}: desktop-finishing-marker staat niet binnen een actief style-element`);
  eis(!html.slice(headEinde).includes(STYLE_MARKER),`${rel}: desktop-finishing-stijl lekt naar body/noscript`);
  eis(html.includes(UREN_NIEUW)&&!html.includes(UREN_OUD),`${rel}: desktoplimiet is niet exact 12 uur`);
  eis(html.includes(MM_NIEUW)&&!html.includes(MM_OUD),`${rel}: numerieke 0 mm wordt nog als ontbrekende waarde behandeld`);
  eis(/#place\{[\s\S]*?padding-left:clamp\(28px,3\.5vw,56px\)!important;[\s\S]*?padding-right:clamp\(28px,3\.5vw,56px\)!important/.test(html),`${rel}: masthead-inset ontbreekt`);
  eis(/\.seo-plaatsnav\{[\s\S]*?padding-left:clamp\(24px,3\.5vw,56px\)!important;[\s\S]*?padding-right:clamp\(24px,3\.5vw,56px\)!important/.test(html),`${rel}: SEO-footerinset ontbreekt`);
  eis(/\.wiw-hour-table th,\.wiw-hour-table td\{[\s\S]*?padding-top:7px!important;[\s\S]*?padding-bottom:7px!important/.test(html),`${rel}: compacte desktop-uurrij ontbreekt`);
  eis(/#nights \.row\.night:not\(\.kop\) \.nmeta\.wide\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) minmax\(180px,230px\)!important/.test(html),`${rel}: brede Nachtzicht-verdeling ontbreekt`);
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:`${rel}:hour-panel-${i+1}`}));
}
eis(geraakt>0,"Geen WeatherNow-artifacts gevonden om uurpaneelrefinement te verifiëren.");
console.log(`Uurpaneelrefinement geverifieerd op ${geraakt} weerartifacts: maximaal 12 desktopuren, 0 mm blijft 0 mm, desktop-CSS staat actief in head, masthead/footer hebben veilige insets en Nachtzicht gebruikt brede ruimte.`);

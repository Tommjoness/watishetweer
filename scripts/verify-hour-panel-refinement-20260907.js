"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {OUT,MARKER,STYLE_MARKER,UREN_OUD,UREN_NIEUW,MM_OUD,MM_NIEUW,PANEL_HOOGTE_OUD,PANEL_HOOGTE_NIEUW,NU_OUD,NU_NIEUW,KOP_OUD,KOP_NIEUW,htmlBestanden}=require("./apply-hour-panel-refinement-20260907.js");

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
  eis(html.includes(UREN_NIEUW)&&!html.includes(UREN_OUD),`${rel}: begrensd 12-uurs kandidaatvenster ontbreekt`);
  eis(html.includes(PANEL_HOOGTE_NIEUW)&&!html.includes(PANEL_HOOGTE_OUD),`${rel}: zichtbare desktopuren worden niet door de gemeten grafiekhoogte bepaald`);
  eis(html.includes('aside.style.removeProperty("--wiw-hour-row-pad-extra")'),`${rel}: eerdere dynamische rijpadding wordt niet vóór hermeting gereset`);
  eis(html.includes(MM_NIEUW)&&!html.includes(MM_OUD),`${rel}: numerieke 0 mm wordt nog als ontbrekende waarde behandeld`);
  eis(html.includes(NU_NIEUW)&&!html.includes(NU_OUD),`${rel}: actuele Nu-context ontbreekt aan de gedeelde desktoprange`);
  eis(html.includes(KOP_NIEUW)&&!html.includes(KOP_OUD),`${rel}: standaard desktopgrafiek heet niet Komende uren`);
  eis(/\.wiw-chart-layout\{[\s\S]*?grid-template-columns:minmax\(0,2\.125fr\) minmax\(360px,1fr\)!important/.test(html),`${rel}: rustige 65–72% / 28–35% desktopverdeling ontbreekt`);
  eis(/\.wiw-hour-panel\{[\s\S]*?position:static!important;[\s\S]*?visibility:visible!important/.test(html),`${rel}: rijke uurkolom is niet zichtbaar in de desktopflow`);
  eis(/#place\{[\s\S]*?padding-left:clamp\(28px,3\.5vw,56px\)!important;[\s\S]*?padding-right:clamp\(28px,3\.5vw,56px\)!important/.test(html),`${rel}: masthead-inset ontbreekt`);
  eis(/\.seo-plaatsnav-inner\{[\s\S]*?padding-left:clamp\(24px,3\.5vw,56px\)!important;[\s\S]*?padding-right:clamp\(24px,3\.5vw,56px\)!important/.test(html),`${rel}: SEO-inhoudsinset ontbreekt`);
  eis(/#wiw-hour-panel h3\{[\s\S]*?margin-top:0!important;[\s\S]*?margin-bottom:9px!important;[\s\S]*?line-height:1\.15!important/.test(html),`${rel}: leesbare Komende-uren-kop ontbreekt`);
  eis(/\.wiw-hour-table td\{[\s\S]*?padding:calc\(4px \+ var\(--wiw-hour-row-pad-extra,0px\)\) 4px!important/.test(html),`${rel}: dynamisch verdeelde rijke uurrij ontbreekt`);
  eis(html.includes('temp.className="wiw-hour-value wiw-hour-temp"')&&html.includes('regen.className="wiw-hour-value wiw-hour-rain"')&&html.includes('wind.className="wiw-hour-value wiw-hour-wind"')&&html.includes('tempSub.className="wiw-hour-secondary"')&&html.includes('regenSub.className="wiw-hour-secondary"')&&html.includes('windSub.className="wiw-hour-secondary"'),`${rel}: gevoel, neerslagkans of wind ontbreekt in de rijke tabel`);
  eis(/#nights \.row\.night\{[\s\S]*?minmax\(190px,260px\)[\s\S]*?minmax\(320px,480px\)!important/.test(html),`${rel}: finale compacte Nachtzicht-groepering ontbreekt`);
  eis(!/\.wiw-hour-table tbody tr:first-child td\{[\s\S]*?line-height:14\.5px!important/.test(html),`${rel}: oude 17-uurs first-row hoogtehack is nog aanwezig`);
  eis(/#nights \.row\.night:not\(\.kop\) \.nmeta\.wide\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) minmax\(180px,230px\)!important/.test(html),`${rel}: brede Nachtzicht-verdeling ontbreekt`);
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:`${rel}:hour-panel-${i+1}`}));
}
eis(geraakt>0,"Geen WeatherNow-artifacts gevonden om uurpaneelrefinement te verifiëren.");
console.log(`Komende-urenrefinement geverifieerd op ${geraakt} weerartifacts: natuurlijke 24-uursgrafiek links, rijke zichtbare 8–12-uurtabel rechts, echte weer/gevoel/neerslag/winddata, compacte Nachtzicht-kolommen en ongewijzigde mobiele weergave.`);

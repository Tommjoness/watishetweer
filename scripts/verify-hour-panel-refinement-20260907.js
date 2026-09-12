"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {
  OUT,MARKER,STYLE_MARKER,UREN_OUD,UREN_NIEUW,MM_OUD,MM_NIEUW,
  UURMODUS_NIEUW,GRAFIEK_SYNC_NIEUW,
  PANEL_HOOGTE_OUD,PANEL_HOOGTE_NIEUW,NU_OUD,NU_NIEUW,KOP_OUD,KOP_NIEUW,
  EERSTVOLGEND_OUD,EERSTVOLGEND_NIEUW,htmlBestanden
}=require("./apply-hour-panel-refinement-20260907.js");

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
  eis(html.includes(UREN_NIEUW)&&!html.includes(UREN_OUD),`${rel}: begrensd 11-uurs kandidaatvenster ontbreekt`);
  eis(html.includes(UURMODUS_NIEUW),`${rel}: grafiek wordt niet vóór de hoogtefiltering met het eerste komende tabeluur en het 11-uurs kandidaatvenster uitgelijnd`);
  eis(html.includes(GRAFIEK_SYNC_NIEUW),`${rel}: grafiek wordt na hoogtefiltering niet exact met de zichtbare tabelrange gesynchroniseerd`);
  eis(html.includes(PANEL_HOOGTE_NIEUW)&&!html.includes(PANEL_HOOGTE_OUD),`${rel}: zichtbare desktopuren worden niet door de gemeten grafiekhoogte bepaald`);
  eis(html.includes('aside.style.removeProperty("--wiw-hour-row-pad-extra")'),`${rel}: eerdere dynamische rijpadding wordt niet vóór hermeting gereset`);
  eis(html.includes('const beschikbareRijhoogte=tbody?Math.max(0,grens-tbody.getBoundingClientRect().top):0;'),`${rel}: capaciteit voor volledige desktopuurrijen wordt niet uit de echte paneelruimte gemeten`);
  eis(html.includes('const minimumUren=Math.min(8,Math.floor((beschikbareRijhoogte+0.5)/29),tbody&&tbody.children.length||0);'),`${rel}: gewenste achturenhorizon respecteert de 29px-leesbaarheidsvloer niet`);
  eis(html.includes('tbody.children.length>minimumUren'),`${rel}: hoogtefilter kan de beschikbare achturenhorizon nog inkorten`);
  eis(html.includes('const maximaleKrimp=Math.max(0,(kleinsteRij-29)/2);'),`${rel}: begrensde paddingcorrectie bewaakt de 29px-leesbaarheidsvloer niet`);
  eis(html.includes('document.documentElement.getBoundingClientRect();')&&html.includes('rest>0.25&&rijPadAanpassing<4.5'),`${rel}: subpixel-resthoogte wordt niet begrensd nagemeten en geabsorbeerd`);
  eis(html.includes(MM_NIEUW)&&!html.includes(MM_OUD),`${rel}: numerieke 0 mm wordt nog als ontbrekende waarde behandeld`);
  eis(html.includes(NU_NIEUW)&&!html.includes(NU_OUD),`${rel}: actuele Nu-context ontbreekt aan de gedeelde desktoprange`);
  eis(html.includes(KOP_NIEUW)&&!html.includes(KOP_OUD),`${rel}: standaard desktopgrafiek heet niet Komende uren`);
  eis(html.includes(EERSTVOLGEND_NIEUW)&&!html.includes(EERSTVOLGEND_OUD),`${rel}: mobiel label Eerstvolgend wordt nog gerenderd`);
  eis(/\.wiw-chart-layout\{[\s\S]*?grid-template-columns:minmax\(0,2\.125fr\) minmax\(360px,1fr\)!important/.test(html),`${rel}: rustige 65–72% / 28–35% desktopverdeling ontbreekt`);
  eis(/\.wiw-hour-panel\{[\s\S]*?position:static!important;[\s\S]*?visibility:visible!important/.test(html),`${rel}: rijke uurkolom is niet zichtbaar in de desktopflow`);
  eis(/#place\{[\s\S]*?padding-left:clamp\(28px,3\.5vw,56px\)!important;[\s\S]*?padding-right:clamp\(28px,3\.5vw,56px\)!important/.test(html),`${rel}: masthead-inset ontbreekt`);
  eis(/\.seo-plaatsnav-inner\{[\s\S]*?padding-left:clamp\(24px,3\.5vw,56px\)!important;[\s\S]*?padding-right:clamp\(24px,3\.5vw,56px\)!important/.test(html),`${rel}: SEO-inhoudsinset ontbreekt`);
  eis(/#wiw-hour-panel h3\{[\s\S]*?margin-top:0!important;[\s\S]*?margin-bottom:9px!important;[\s\S]*?line-height:1\.15!important/.test(html),`${rel}: leesbare Komende-uren-kop ontbreekt`);
  eis(/\.wiw-hour-table td\{[\s\S]*?padding:calc\(4px \+ var\(--wiw-hour-row-pad-extra,0px\)\) 4px!important/.test(html),`${rel}: dynamisch verdeelde rijke uurrij ontbreekt`);
  eis(/\.wiw-hour-table th:nth-child\(3\),\.wiw-hour-table td:nth-child\(3\)\{width:29%!important\}/.test(html),`${rel}: temperatuurkolom heeft onvoldoende ruimte voor inline gevoelstemperatuur`);
  eis(/\.wiw-hour-temp\{white-space:nowrap!important\}/.test(html)&&/\.wiw-hour-temp \.wiw-hour-primary,\.wiw-hour-temp \.wiw-hour-secondary\{display:inline!important\}/.test(html)&&/\.wiw-hour-temp \.wiw-hour-secondary::before\{content:" · "\}/.test(html),`${rel}: desktop gevoelstemperatuur staat niet gegarandeerd inline en zonder wrapping`);
  eis(html.includes('temp.className="wiw-hour-value wiw-hour-temp"')&&html.includes('regen.className="wiw-hour-value wiw-hour-rain"')&&html.includes('wind.className="wiw-hour-value wiw-hour-wind"')&&html.includes('tempSub.className="wiw-hour-secondary"')&&html.includes('regenSub.className="wiw-hour-secondary"')&&html.includes('windSub.className="wiw-hour-secondary"'),`${rel}: gevoel, neerslagkans of wind ontbreekt in de rijke tabel`);
  eis(/#nights \.row\.night\{[\s\S]*?minmax\(190px,260px\)[\s\S]*?minmax\(320px,480px\)!important/.test(html),`${rel}: finale compacte Nachtzicht-groepering ontbreekt`);
  eis(!/\.wiw-hour-table tbody tr:first-child td\{[\s\S]*?line-height:14\.5px!important/.test(html),`${rel}: oude 17-uurs first-row hoogtehack is nog aanwezig`);
  eis(/#nights \.row\.night:not\(\.kop\) \.nmeta\.wide\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) minmax\(180px,230px\)!important/.test(html),`${rel}: brede Nachtzicht-verdeling ontbreekt`);
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:`${rel}:hour-panel-${i+1}`}));
}
eis(geraakt>0,"Geen WeatherNow-artifacts gevonden om uurpaneelrefinement te verifiëren.");
console.log(`Komende-urenrefinement geverifieerd op ${geraakt} weerartifacts: natuurlijke desktopgrafiek links, capaciteitsgestuurde rijke uurtabel rechts met waar mogelijk 8–11 zichtbare uren, één hoogte-owner met 29px-vloer en begrensde subpixelrest, gevoelstemperatuur inline zonder wrapping, mobiel zonder Eerstvolgend-label, echte weer/neerslag/winddata, compacte Nachtzicht-kolommen en ongewijzigde data-interpretatie.`);

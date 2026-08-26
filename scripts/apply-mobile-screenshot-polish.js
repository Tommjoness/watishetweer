"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
const mobileCss=fs.readFileSync(path.join(__dirname,"mobile-screenshot-polish.css"),"utf8");
const q1Css=fs.readFileSync(path.join(__dirname,"q1-precip-performance.css"),"utf8");
const mobileJs=fs.readFileSync(path.join(__dirname,"mobile-screenshot-polish.js"),"utf8");
let q1Js=fs.readFileSync(path.join(__dirname,"q1-precip-performance.js"),"utf8");
let html=fs.readFileSync(htmlPad,"utf8");

const CSS_MARK="/* ===== MOBILE SCREENSHOT POLISH 20260810B CSS ===== */";
const Q1_CSS_MARK="/* ===== CHECKPOINT 25 Q1 CSS ===== */";
const JS_MARK="/* ===== MOBILE SCREENSHOT POLISH 20260810B ===== */";
const Q1_JS_MARK="/* ===== CHECKPOINT 25 Q1 ===== */";
const START="/* ---------- start ---------- */";
const RECENT_OLD='<div class="eyebrow">Afgelopen 15 minuten</div><div class="sval" id="prec">';
const TREND_NEW='<div class="eyebrow">Temperatuur komende 3 uur</div><div class="sval" id="prec">';
const LEGACY_RECENT_START='  const recenteNeerslag=eindigGetal(c.precipitation);';
const LEGACY_RECENT_END='  /* De tegel toont de kans voor precies het eerstvolgende uur (i+1). De subtekst';
const ENGINE_RECENT_START='      zetEyebrow("prec","Afgelopen 15 minuten");\n      const c=S.d.current||{};';
const ENGINE_RECENT_END='      // Bewolkingswoorden zijn tijdsafhankelijk.';

/* Checkpoint 50: Nachtzicht had na de canonieke renderer twee opeenvolgende
   presentatie-wrappers. De senior-wrapper wordt op assemblagetijd verwijderd;
   WeatherNowMobileScreenshotPolish is daarna de enige presentatie-owner. */
const SENIOR_NACHT_START='const basisNachten=nachten;\nnachten=function(){';
const SENIOR_NACHT_END='\n\n/* Verstreken uurwaarden zijn forecast/modelwaarden';
const SENIOR_NACHT_SIGNATURE='const basisNachten=nachten;\nnachten=function(){\n  basisNachten();\n  const rijen=[...document.querySelectorAll("#nights .row.night:not(.kop)")]';

const GRAFIEK_MOBIEL_OUD='  const W=M?380:900, H=M?292:296, pl=M?34:44, pr=M?10:20, iw=W-pl-pr;\n  const by=M?20:22, bh=M?11:16;\n  const pt=M?72:76, ih=M?166:160, pb=pt+ih;';
const GRAFIEK_MOBIEL_NIEUW='  const W=M?380:900, H=M?250:296, pl=M?34:44, pr=M?10:20, iw=W-pl-pr;\n  const by=M?18:22, bh=M?10:16;\n  const pt=M?59:76, ih=M?145:160, pb=pt+ih;';
const GRAFIEK_LABEL_PAST_OUD='      const past=(val,bv)=> bv ? val-F.temp>=by+bh+6 : val<=pb-3;';
const GRAFIEK_LABEL_PAST_NIEUW='      const past=(val,bv)=> bv ? val-F.temp>=by+bh+6 : val+labelHoogte/2+4<=pb;';
const GRAFIEK_TICK_OUD='    if(toonAs){\n      ticks+=';
const GRAFIEK_TICK_NIEUW='    if(toonAs){\n      const tijdLabelVrij=nuX==null||Math.abs(x(i)-nuX)>Math.max(18,F.uur*2.2);\n      if(tijdLabelVrij) ticks+=';
/* Op mobiel is drie labels te karig voor een etmaalcurve. De canonieke renderer
   selecteert al de vaste drie-uursmomenten plus echte extrema; bestaande
   fontbox-, duplicaat- en nu-labelcontroles ruimen alleen daadwerkelijke botsingen
   op. Daarom krijgt mobiel voor n<=24 dezelfde kandidaatset als desktop. */
const GRAFIEK_MOBIELE_LABELS_OUD='  let kandidaten=n<=24?kandidatenRuw:kandidatenRuw.filter((k,pos)=>{';
const GRAFIEK_MOBIELE_LABELS_NIEUW='  let kandidaten=n<=24?kandidatenRuw:kandidatenRuw.filter((k,pos)=>{';
const GRAFIEK_GEO_ANCHOR='  S.geo={x:x,y:y,pl:pl,pr:pr,pt:pt,ih:ih,cw:cw,n:T.length,T:T,A:A,P:P,W_:W_,G:G,C:C,D:D,ND:ND,TI:TI,WD:WD,W:W,H:H,M:M};';
const GRAFIEK_AS_CLEANUP=[
  '  /* Checkpoint 50: controleer op mobiele grafieken de werkelijke SVG-fontboxes',
  '     en verwijder uitsluitend een tijdlabel dat een temperatuurcijfer echt raakt.',
  '     Desktop heeft voldoende ruimte en behoudt bewust het volledige drie-uursraster. */',
  '  const ruimBotsendeAslabelsOp=()=>{',
  '    if(!M)return;',
  '    const teksten=[...svg.querySelectorAll("text")];',
  '    const temperatuurLabels=teksten.filter(el=>/Bodoni Moda/.test(el.getAttribute("font-family")||"")&&/°$/.test((el.textContent||"").trim()));',
  '    const asY=pb+(M?20:22);',
  '    const tijdLabels=teksten.filter(el=>Math.abs(Number(el.getAttribute("y"))-asY)<0.1);',
  '    const raakt=(a,b)=>{',
  '      try{',
  '        const A=a.getBBox(),B=b.getBBox();',
  '        const ox=Math.min(A.x+A.width,B.x+B.width)-Math.max(A.x,B.x);',
  '        const oy=Math.min(A.y+A.height,B.y+B.height)-Math.max(A.y,B.y);',
  '        return ox>-1.5&&oy>-1.5;',
  '      }catch(_){return false;}',
  '    };',
  '    tijdLabels.forEach(el=>{if(temperatuurLabels.some(t=>raakt(el,t)))el.remove();});',
  '  };',
  '  ruimBotsendeAslabelsOp();',
  '  if(document.fonts&&document.fonts.ready){',
  '    const verwachteViewBox="0 0 "+W+" "+H;',
  '    document.fonts.ready.then(()=>{if(svg.getAttribute("viewBox")===verwachteViewBox)ruimBotsendeAslabelsOp();});',
  '  }',
  GRAFIEK_GEO_ANCHOR
].join('\n');

/* Q1 herschrijft de weekcel na dagen(). Een bekende dagelijkse hoeveelheid van
   exact nul moet daar niet verdwijnen: 6% kans en 0,0 mm zijn verschillende
   grootheden en mogen naast elkaar staan. Onbekende/negatieve hoeveelheden
   blijven leeg; zeer kleine positieve hoeveelheden blijven <0,1 mm. */
const Q1_DAG_MM_OUD='  const hoeveelheid=mm!==null&&mm>=MM_MEETBAAR\n    ? (typeof hoeveelheidFn==="function"?hoeveelheidFn(mm):mmTekst(mm)) : "";';
const Q1_DAG_MM_NIEUW='  const hoeveelheid=mm!==null&&mm>=0\n    ? (typeof hoeveelheidFn==="function"?hoeveelheidFn(mm):mmTekst(mm)) : "";';
const q1DagMmAantal=q1Js.split(Q1_DAG_MM_OUD).length-1;
if(q1DagMmAantal!==1)throw new Error("Q1 dagelijkse hoeveelheid-owner ontbreekt of is dubbel: "+q1DagMmAantal);
q1Js=q1Js.replace(Q1_DAG_MM_OUD,Q1_DAG_MM_NIEUW);

if(html.includes(CSS_MARK)||html.includes(JS_MARK)||html.includes(Q1_CSS_MARK)||html.includes(Q1_JS_MARK))throw new Error("Post-build polish is al geïnjecteerd.");
if((html.match(/<\/style>/g)||[]).length!==1)throw new Error("Exact één stijlblok vereist voor mobiele polish.");
if((html.split(START).length-1)!==1)throw new Error("Startmarker ontbreekt of is dubbel voor mobiele polish.");
if((html.split(RECENT_OLD).length-1)!==1)throw new Error("Legacy recente-neerslagtegel ontbreekt of is dubbel in de bronartifact.");
if((html.split(LEGACY_RECENT_START).length-1)!==1||(html.split(LEGACY_RECENT_END).length-1)!==1)throw new Error("Legacy recente-neerslaglogica ontbreekt of is dubbel in de bronartifact.");
if((html.split(ENGINE_RECENT_START).length-1)!==1||(html.split(ENGINE_RECENT_END).length-1)!==1)throw new Error("Interpretatie-engine recente-neerslaglogica ontbreekt of is dubbel in de bronartifact.");
if((html.split(SENIOR_NACHT_START).length-1)!==1||(html.split(SENIOR_NACHT_END).length-1)!==1)throw new Error("Senior Nachtzicht-wrapper ontbreekt of is dubbel vóór consolidatie.");
if((html.split(SENIOR_NACHT_SIGNATURE).length-1)!==1)throw new Error("Specifieke senior Nachtzicht-wrapper ontbreekt of is dubbel vóór consolidatie.");
if((html.split(GRAFIEK_MOBIEL_OUD).length-1)!==1)throw new Error("Canonieke mobiele grafiekmaten ontbreken of zijn dubbel.");
if((html.split(GRAFIEK_LABEL_PAST_OUD).length-1)!==1)throw new Error("Canonieke grafiek-labelgrens ontbreekt of is dubbel.");
if((html.split(GRAFIEK_TICK_OUD).length-1)!==1)throw new Error("Canonieke grafiek-tickrenderer ontbreekt of is dubbel.");
if((html.split(GRAFIEK_MOBIELE_LABELS_OUD).length-1)!==1)throw new Error("Canonieke etmaallabelselectie ontbreekt of is dubbel.");
if((html.split(GRAFIEK_GEO_ANCHOR).length-1)!==1)throw new Error("Canonieke grafiek-geometrieanchor ontbreekt of is dubbel.");

html=html.replace(RECENT_OLD,TREND_NEW);
const legacyStart=html.indexOf(LEGACY_RECENT_START),legacyEind=html.indexOf(LEGACY_RECENT_END,legacyStart);
if(legacyStart<0||legacyEind<=legacyStart)throw new Error("Legacy recente-neerslaglogica kon niet veilig worden afgebakend.");
html=html.slice(0,legacyStart)+'  /* Recente-neerslagterugblik verwijderd; #prec is exclusief van temperatuurtrend. */\n\n'+html.slice(legacyEind);

const engineStart=html.indexOf(ENGINE_RECENT_START),engineEind=html.indexOf(ENGINE_RECENT_END,engineStart);
if(engineStart<0||engineEind<=engineStart)throw new Error("Interpretatie-engine recente-neerslaglogica kon niet veilig worden afgebakend.");
html=html.slice(0,engineStart)+'      const c=S.d.current||{};\n\n'+html.slice(engineEind);
const engineKop='      zetEyebrow("prec","Afgelopen 15 minuten");';
if((html.split(engineKop).length-1)!==1)throw new Error("Interpretatie-engine tekenAlles-kop ontbreekt of is dubbel.");
html=html.replace(engineKop,'      /* #prec-kop is exclusief van temperatuurtrend. */');

const seniorNachtStart=html.indexOf(SENIOR_NACHT_START),seniorNachtEind=html.indexOf(SENIOR_NACHT_END,seniorNachtStart);
if(seniorNachtStart<0||seniorNachtEind<=seniorNachtStart)throw new Error("Senior Nachtzicht-wrapper kon niet veilig worden afgebakend.");
html=html.slice(0,seniorNachtStart)+'/* Nachtzicht-presentatie geconsolideerd in WeatherNowMobileScreenshotPolish. */'+html.slice(seniorNachtEind);

html=html.replace(GRAFIEK_MOBIEL_OUD,GRAFIEK_MOBIEL_NIEUW);
html=html.replace(GRAFIEK_LABEL_PAST_OUD,GRAFIEK_LABEL_PAST_NIEUW);
html=html.replace(GRAFIEK_TICK_OUD,GRAFIEK_TICK_NIEUW);
html=html.replace(GRAFIEK_MOBIELE_LABELS_OUD,GRAFIEK_MOBIELE_LABELS_NIEUW);
html=html.replace(GRAFIEK_GEO_ANCHOR,GRAFIEK_AS_CLEANUP);

html=html.replace("</style>","\n"+CSS_MARK+"\n"+mobileCss+"\n/* ===== EINDE MOBILE SCREENSHOT POLISH 20260810B CSS ===== */\n"+Q1_CSS_MARK+"\n"+q1Css+"\n/* ===== EINDE CHECKPOINT 25 Q1 CSS ===== */\n</style>");
html=html.replace(START,JS_MARK+"\n"+mobileJs+"\n/* ===== EINDE MOBILE SCREENSHOT POLISH 20260810B ===== */\n\n"+Q1_JS_MARK+"\n"+q1Js+"\n/* ===== EINDE CHECKPOINT 25 Q1 ===== */\n\n"+START);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline script na mobiele polish.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:postbuild-"+(i+1)}));
for(const vereist of [
  "WeatherNowMobileScreenshotPolish","maan-fase-svg-v2","Temperatuur komende 3 uur","bron-bronnen",
  "WeatherNowQ1","q1-dag-mm","weerbriefing.plaatscache.q1","neerslagkans",
  "temperatuurTrend","q1-pop-hidden","normaliseerNachtDagdata","nachtIsActiefNu","corrigeerNachtVensterBron","verbeterNachtzicht",
  "nachtzichtCompactAantal","Meer nachten bekijken","nacht-meer",
  "H=M?250:296","pt=M?59:76, ih=M?145:160","tijdLabelVrij=nuX==null",
  "let kandidaten=n<=24?kandidatenRuw:","mm!==null&&mm>=0",
  "val+labelHoogte/2+4<=pb","ruimBotsendeAslabelsOp","if(!M)return;","getBBox()"
]){
  if(!html.includes(vereist))throw new Error("Post-build invariant ontbreekt: "+vereist);
}
if(html.includes("M?kandidatenRuw.filter(k=>k.rang===3):kandidatenRuw"))throw new Error("Mobiele etmaallabels zijn nog beperkt tot alleen extrema.");
if(html.includes(Q1_DAG_MM_OUD))throw new Error("Q1 verbergt bekende 0,0 mm nog in de productieartifact.");
if(html.includes("Afgelopen 15 minuten")||html.includes("Afgelopen kwartier"))throw new Error("Verwijderde recente-neerslagfunctie staat nog in de productieartifact.");
if(html.includes(LEGACY_RECENT_START)||html.includes('zetEyebrow("prec"'))throw new Error("Een oude eigenaar van #prec staat nog in de productieartifact.");
if(html.includes(SENIOR_NACHT_SIGNATURE))throw new Error("Patch-op-patch: specifieke oude senior Nachtzicht-wrapper staat nog in de productieartifact.");
if((html.split('const basisNachten=nachten;').length-1)!==1)throw new Error("Nachtzicht moet exact één presentatie-wrapper hebben na consolidatie.");
if(html.includes("Beste modeluren")||html.includes("Relatief gunstigste modeluren"))throw new Error("Nachtzicht bevat nog modeljargon in de presentatie-owner.");
fs.writeFileSync(htmlPad,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"mobiele");
console.log("Mobiele polish + checkpoint 50% geïnjecteerd; etmaal behoudt bruikbare temperatuurpunten, 0,0 mm blijft zichtbaar en Nachtzicht blijft compact; cache "+versie+".");

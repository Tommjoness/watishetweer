"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const crypto=require("crypto");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
const mobileCss=fs.readFileSync(path.join(__dirname,"mobile-screenshot-polish.css"),"utf8");
const q1Css=fs.readFileSync(path.join(__dirname,"q1-precip-performance.css"),"utf8");
const mobileJs=fs.readFileSync(path.join(__dirname,"mobile-screenshot-polish.js"),"utf8");
const q1Js=fs.readFileSync(path.join(__dirname,"q1-precip-performance.js"),"utf8");
let html=fs.readFileSync(htmlPad,"utf8");

const CSS_MARK="/* ===== MOBILE SCREENSHOT POLISH 20260810B CSS ===== */";
const Q1_CSS_MARK="/* ===== CHECKPOINT 25 Q1 CSS ===== */";
const JS_MARK="/* ===== MOBILE SCREENSHOT POLISH 20260810B ===== */";
const Q1_JS_MARK="/* ===== CHECKPOINT 25 Q1 ===== */";
const START="/* ---------- start ---------- */";
const RECENT_OLD='<div class="eyebrow">Afgelopen 15 minuten</div><div class="sval" id="prec">';
const TREND_NEW='<div class="eyebrow">Temperatuurtrend</div><div class="sval" id="prec">';
const LEGACY_RECENT_START='  const recenteNeerslag=eindigGetal(c.precipitation);';
const LEGACY_RECENT_END='  /* De tegel toont de kans voor precies het eerstvolgende uur (i+1). De subtekst';
const ENGINE_RECENT_START='      zetEyebrow("prec","Afgelopen 15 minuten");\n      const c=S.d.current||{};';
const ENGINE_RECENT_END='      // Bewolkingswoorden zijn tijdsafhankelijk.';

/* Checkpoint 50: Nachtzicht had na de canonieke renderer twee opeenvolgende
   presentatie-wrappers: de seniorlaag en daarna mobiele screenshot-polish.
   Dat is precies het soort patch-op-patch dat we niet willen behouden. De
   senior-wrapper wordt daarom op assemblagetijd verwijderd; zijn pure helpers
   blijven staan. De mobiele polish hieronder is daarna de ENIGE presentatie-
   owner bovenop de canonieke nachtbewerking. */
const SENIOR_NACHT_START='const basisNachten=nachten;\nnachten=function(){';
const SENIOR_NACHT_END='\n\n/* Verstreken uurwaarden zijn forecast/modelwaarden';
const SENIOR_NACHT_SIGNATURE='const basisNachten=nachten;\nnachten=function(){\n  basisNachten();\n  const rijen=[...document.querySelectorAll("#nights .row.night:not(.kop)")]';

/* Checkpoint 50: de mobiele grafiek blijft compacter dan de oorspronkelijke
   292px, maar niet ten koste van labelruimte. Daarnaast worden twee bronregels
   in de canonieke renderer exact aangescherpt: temperatuurlabels mogen niet in
   de x-aszone zakken en het tijdlabel direct onder de rode nu-lijn vervalt. */
const GRAFIEK_MOBIEL_OUD='  const W=M?380:900, H=M?292:296, pl=M?34:44, pr=M?10:20, iw=W-pl-pr;\n  const by=M?20:22, bh=M?11:16;\n  const pt=M?72:76, ih=M?166:160, pb=pt+ih;';
const GRAFIEK_MOBIEL_NIEUW='  const W=M?380:900, H=M?284:296, pl=M?34:44, pr=M?10:20, iw=W-pl-pr;\n  const by=M?20:22, bh=M?11:16;\n  const pt=M?70:76, ih=M?158:160, pb=pt+ih;';
const GRAFIEK_LABEL_PAST_OUD='      const past=(val,bv)=> bv ? val-F.temp>=by+bh+6 : val<=pb-3;';
const GRAFIEK_LABEL_PAST_NIEUW='      const past=(val,bv)=> bv ? val-F.temp>=by+bh+6 : val+labelHoogte/2+4<=pb;';
const GRAFIEK_TICK_OUD='    if(toonAs){\n      ticks+=';
const GRAFIEK_TICK_NIEUW='    if(toonAs){\n      const tijdLabelVrij=nuX==null||Math.abs(x(i)-nuX)>Math.max(18,F.uur*2.2);\n      if(tijdLabelVrij) ticks+=';
const GRAFIEK_GEO_ANCHOR='  S.geo={x:x,y:y,pl:pl,pr:pr,pt:pt,ih:ih,cw:cw,n:T.length,T:T,A:A,P:P,W_:W_,G:G,C:C,D:D,ND:ND,TI:TI,WD:WD,W:W,H:H,M:M};';
const GRAFIEK_AS_CLEANUP=[
  '  /* Checkpoint 50: temperatuurcijfers worden pas na de tijdas definitief',
  '     geplaatst en mogen horizontaal uitwijken. Vaste marges kunnen daardoor',
  '     nooit volledig voorspellen waar een Bodoni-label eindigt. Controleer na',
  '     het renderen de werkelijke SVG-tekstboxen en verwijder uitsluitend een',
  '     tijdlabel dat een temperatuurcijfer echt raakt. Neerslagpercentages en',
  '     alle overige tijdlabels blijven staan; de tooltip houdt de exacte tijd. */',
  '  const ruimBotsendeAslabelsOp=()=>{',
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
if((html.split(GRAFIEK_GEO_ANCHOR).length-1)!==1)throw new Error("Canonieke grafiek-geometrieanchor ontbreekt of is dubbel.");

/* Productbeslissing checkpoint 25: de terugblik op recente neerslag bestaat niet
   meer in de definitieve runtime. De twee op dit assemblagemoment aantoonbare
   historische eigenaars van dezelfde tegel — de canonieke meters() en de
   browserintegratie van de centrale interpretatie-engine — worden volledig
   verwijderd vóór Q1 wordt geïnjecteerd. */
html=html.replace(RECENT_OLD,TREND_NEW);
const legacyStart=html.indexOf(LEGACY_RECENT_START),legacyEind=html.indexOf(LEGACY_RECENT_END,legacyStart);
if(legacyStart<0||legacyEind<=legacyStart)throw new Error("Legacy recente-neerslaglogica kon niet veilig worden afgebakend.");
html=html.slice(0,legacyStart)
  +'  /* Recente-neerslagterugblik verwijderd; #prec is exclusief van temperatuurtrend. */\n\n'
  +html.slice(legacyEind);

const engineStart=html.indexOf(ENGINE_RECENT_START),engineEind=html.indexOf(ENGINE_RECENT_END,engineStart);
if(engineStart<0||engineEind<=engineStart)throw new Error("Interpretatie-engine recente-neerslaglogica kon niet veilig worden afgebakend.");
html=html.slice(0,engineStart)
  +'      const c=S.d.current||{};\n\n'
  +html.slice(engineEind);

const engineKop='      zetEyebrow("prec","Afgelopen 15 minuten");';
if((html.split(engineKop).length-1)!==1)throw new Error("Interpretatie-engine tekenAlles-kop ontbreekt of is dubbel.");
html=html.replace(engineKop,'      /* #prec-kop is exclusief van temperatuurtrend. */');

/* Nachtzicht-owner consolideren vóór de uiteindelijke mobiele laag wordt
   geïnjecteerd. Alleen de runtime-wrapper verdwijnt; de pure seniorhelpers en
   overige seniorcorrecties blijven exact staan. */
const seniorNachtStart=html.indexOf(SENIOR_NACHT_START),seniorNachtEind=html.indexOf(SENIOR_NACHT_END,seniorNachtStart);
if(seniorNachtStart<0||seniorNachtEind<=seniorNachtStart)throw new Error("Senior Nachtzicht-wrapper kon niet veilig worden afgebakend.");
html=html.slice(0,seniorNachtStart)
  +'/* Nachtzicht-presentatie geconsolideerd in WeatherNowMobileScreenshotPolish. */'
  +html.slice(seniorNachtEind);

/* Grafiek: echt compacter, maar met een gereserveerde x-aszone. Het tijdlabel
   op het huidige uur is redundant naast `nu 21°` en wordt alleen daar onderdrukt;
   overige tijdlabels, temperatuurpunten en data blijven intact. De laatste
   botsingscontrole gebruikt daarna de werkelijk gerenderde fontboxes. */
html=html.replace(GRAFIEK_MOBIEL_OUD,GRAFIEK_MOBIEL_NIEUW);
html=html.replace(GRAFIEK_LABEL_PAST_OUD,GRAFIEK_LABEL_PAST_NIEUW);
html=html.replace(GRAFIEK_TICK_OUD,GRAFIEK_TICK_NIEUW);
html=html.replace(GRAFIEK_GEO_ANCHOR,GRAFIEK_AS_CLEANUP);

html=html.replace("</style>",
  "\n"+CSS_MARK+"\n"+mobileCss+"\n/* ===== EINDE MOBILE SCREENSHOT POLISH 20260810B CSS ===== */\n"
  +Q1_CSS_MARK+"\n"+q1Css+"\n/* ===== EINDE CHECKPOINT 25 Q1 CSS ===== */\n</style>");
html=html.replace(START,
  JS_MARK+"\n"+mobileJs+"\n/* ===== EINDE MOBILE SCREENSHOT POLISH 20260810B ===== */\n\n"
  +Q1_JS_MARK+"\n"+q1Js+"\n/* ===== EINDE CHECKPOINT 25 Q1 ===== */\n\n"
  +START);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline script na mobiele polish.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:postbuild-"+(i+1)}));
for(const vereist of [
  "WeatherNowMobileScreenshotPolish","maan-fase-svg-v2","Temperatuurtrend","bron-bronnen",
  "WeatherNowQ1","q1-dag-mm","weerbriefing.plaatscache.q1","neerslagkans",
  "temperatuurTrend","q1-pop-hidden","Beste modeluren","verbeterNachtzicht",
  "H=M?284:296","pt=M?70:76, ih=M?158:160","tijdLabelVrij=nuX==null",
  "val+labelHoogte/2+4<=pb","ruimBotsendeAslabelsOp","getBBox()"
]){
  if(!html.includes(vereist))throw new Error("Post-build invariant ontbreekt: "+vereist);
}
if(html.includes("Afgelopen 15 minuten")||html.includes("Afgelopen kwartier"))throw new Error("Verwijderde recente-neerslagfunctie staat nog in de productieartifact.");
if(html.includes(LEGACY_RECENT_START)||html.includes('zetEyebrow("prec"'))throw new Error("Een oude eigenaar van #prec staat nog in de productieartifact.");
if(html.includes(SENIOR_NACHT_SIGNATURE))throw new Error("Patch-op-patch: specifieke oude senior Nachtzicht-wrapper staat nog in de productieartifact.");
if((html.split('const basisNachten=nachten;').length-1)!==1)throw new Error("Nachtzicht moet exact één presentatie-wrapper hebben na consolidatie.");
fs.writeFileSync(htmlPad,html,"utf8");

/* build-weather.js maakt de serviceworker-cacheversie vóór deze gerichte laag.
   Omdat index.html nu bewust is gewijzigd, berekenen we exact dezelfde shellhash
   opnieuw en vervangen uitsluitend de versie-id in sw.js. */
const CACHE_BRONNEN=[
  "index.html","manifest.json","icon-192.png","icon-512.png","icon-maskable-512.png",
  "bodoni-moda-latin-400-normal.woff2","bodoni-moda-latin-500-normal.woff2",
  "instrument-sans-latin-400-normal.woff2","instrument-sans-latin-500-normal.woff2",
  "instrument-sans-latin-600-normal.woff2","dm-mono-latin-400-normal.woff2","dm-mono-latin-500-normal.woff2"
];
const hash=crypto.createHash("sha256");
for(const naam of CACHE_BRONNEN){
  const p=path.join(OUT,naam);
  if(!fs.existsSync(p))throw new Error("App-shellbestand ontbreekt voor mobiele cachehash: "+naam);
  hash.update(naam+"\0");hash.update(fs.readFileSync(p));hash.update("\0");
}
const versie="watishetweer-"+hash.digest("hex").slice(0,12);
const swPad=path.join(OUT,"sw.js");
let sw=fs.readFileSync(swPad,"utf8");
const aantal=(sw.match(/watishetweer-[0-9a-f]{12}/g)||[]).length;
if(aantal<1)throw new Error("Geen bestaande serviceworker-cachehash gevonden.");
sw=sw.replace(/watishetweer-[0-9a-f]{12}/g,versie);
if(!sw.includes(versie))throw new Error("Nieuwe mobiele cachehash niet toegepast.");
fs.writeFileSync(swPad,sw,"utf8");

console.log("Mobiele polish + checkpoint 50% geïnjecteerd; Nachtzicht-owner geconsolideerd; cache "+versie+".");

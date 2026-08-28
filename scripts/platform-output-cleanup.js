"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const vm=require("vm");
const {minify}=require("terser");
const CleanCSS=require("clean-css");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const PUBLIC=path.join(ROOT,"public");
const BRON_SNAPSHOT=path.join(ROOT,".weather-runtime-source.tmp");
const RAIN_ARIA_OUD='groep.setAttribute("aria-label","Neerslagperioden met tijdvak en hoeveelheid per periode");';
const RAIN_ARIA_NIEUW='groep.setAttribute("aria-hidden","true");';
const RAIN_LINE_OUD='    horizontaal.setAttribute("aria-label",q4PeriodeTijdvak(g,p)+" · "+q4Mm(p.som)+" mm");\n';
const RAIN_SVG_OUD='  svg.setAttribute("aria-label",(oudeAria+" Meetbare neerslag staat als aaneengesloten perioden onder de temperatuurcurve."+detailAria+" Neerslagkansen blijven via de details beschikbaar.").trim());';
const RAIN_SVG_NIEUW='  const periodeAria=g.n<=25?perioden.map(p=>q4PeriodeTijdvak(g,p)+" · "+q4Mm(p.som)+" mm").join("; "):"";\n  const periodeDetail=periodeAria?" Neerslagperioden: "+periodeAria+".":"";\n  svg.setAttribute("aria-label",(oudeAria+" Meetbare neerslag staat als aaneengesloten perioden onder de temperatuurcurve."+periodeDetail+detailAria+" Neerslagkansen blijven via de details beschikbaar.").trim());';
const CSP_META=/<meta http-equiv="Content-Security-Policy" content="[^"]*">\s*/gi;
const PRELOADS='<link rel="preload" href="/instrument-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="preload" href="/bodoni-moda-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>\n';
const DELIVERY_META='<meta name="weather-delivery" content="external-minified-v1">';
const SCRIPT_RE=/<script([^>]*)>([\s\S]*?)<\/script>/gi;
const ROUTE_BOOTSTRAP=/^\s*window\.__WEATHERNOW_ROUTE_LOCATION__=Object\.freeze\((\{[\s\S]*\})\);\s*$/;
const BEWAAR_COMMENTS=/NEERSLAGPRESENTATIE V2|CHECKPOINT 25 Q1|GEDEELDE URL PLAATSIDENTITEIT/;

function htmlBestanden(dir){
  const uit=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())uit.push(...htmlBestanden(p));
    else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function isDataScript(attrs){
  return /\btype\s*=\s*["'](?:application\/ld\+json|application\/json)["']/i.test(String(attrs||""));
}
function isExternScript(attrs){return /\bsrc\s*=/i.test(String(attrs||""));}
function vervangExact(bron,oud,nieuw,label){
  const aantal=bron.split(oud).length-1;
  if(aantal!==1)throw new Error(label+" verwacht exact één bronanker; gevonden "+aantal);
  return bron.replace(oud,nieuw);
}
function hardenRuntime(html){
  let bron=String(html||"");
  if(!bron.includes('rel="preload" href="/instrument-sans-latin-400-normal.woff2"')){
    const anker="</head>";
    if((bron.split(anker).length-1)!==1)throw new Error("Head-einde ontbreekt of is dubbel voor fontpreload.");
    bron=bron.replace(anker,PRELOADS+anker);
  }
  const heeftQ4=bron.includes("function q4Regenperioden")||bron.includes(RAIN_ARIA_OUD);
  if(heeftQ4){
    bron=vervangExact(bron,RAIN_ARIA_OUD,RAIN_ARIA_NIEUW,"regenperiodegroep-ARIA");
    bron=vervangExact(bron,RAIN_LINE_OUD,"","regenperiodelijn-ARIA");
    bron=vervangExact(bron,RAIN_SVG_OUD,RAIN_SVG_NIEUW,"regenperiode-SVG-samenvatting");
  }
  return bron;
}
function cssMinify(html){
  let fout=null;
  const uit=String(html).replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi,(vol,attrs,css)=>{
    const resultaat=new CleanCSS({level:{1:{all:true},2:false},rebase:false}).minify(css);
    if(resultaat.errors&&resultaat.errors.length){fout=new Error("CSS-minificatie mislukt: "+resultaat.errors.join("; "));return vol;}
    return "<style"+attrs+">"+resultaat.styles+"</style>";
  });
  if(fout)throw fout;
  return uit;
}
function routeDataScript(json){
  return '<script type="application/json" id="weather-now-route">'+JSON.stringify(json).replace(/</g,"\\u003c")+'</script>';
}
function verzamelRuntime(html){
  const bron=String(html);
  const eersteStijl=bron.search(/<style\b/i);
  const scripts=[];const earlyScripts=[];let routeData=null;
  const zonder=bron.replace(SCRIPT_RE,(vol,attrs,body,offset)=>{
    if(isDataScript(attrs)||isExternScript(attrs))return vol;
    const route=ROUTE_BOOTSTRAP.exec(body);
    if(route){
      try{routeData=JSON.parse(route[1]);}catch(e){throw new Error("Ongeldige routebootstrap: "+e.message);}
      return routeDataScript(routeData);
    }
    /* Een klein executable script dat bewust vóór het eerste stijlblok staat,
       heeft pre-paintsemantiek. Dat mag niet naar de deferred bodybundle worden
       verplaatst: dan kan bijvoorbeeld een opgeslagen donker thema één frame
       in het lichte thema renderen. We externaliseren zo'n script wél voor de
       strikte CSP, maar bewaren zijn exacte positie en synchrone uitvoervolgorde. */
    if(eersteStijl>=0&&offset<eersteStijl){
      const token=`<!-- WEATHER EARLY SCRIPT ${earlyScripts.length} -->`;
      earlyScripts.push({token,body});
      return token;
    }
    scripts.push(body);
    return "";
  });
  return {html:zonder,scripts,earlyScripts,routeData};
}
function routePrelude(){
  return '(function(){const el=document.getElementById("weather-now-route");if(!el)return;try{window.__WEATHERNOW_ROUTE_LOCATION__=Object.freeze(JSON.parse(el.textContent||"null"));}catch(e){window.__WEATHERNOW_ROUTE_LOCATION__=null;}})();\n';
}
async function minifyRuntime(scripts,routeData){
  const bron=(routeData?routePrelude():"")+scripts.join("\n;\n");
  if(!bron.trim())return null;
  new vm.Script(bron,{filename:"delivery-runtime-source.js"});
  const resultaat=await minify(bron,{
    ecma:2020,
    compress:{passes:2,defaults:true},
    mangle:{toplevel:false},
    format:{comments:BEWAAR_COMMENTS,semicolons:true}
  });
  if(!resultaat||!resultaat.code)throw new Error("Terser leverde geen runtime op.");
  new vm.Script(resultaat.code,{filename:"delivery-runtime-min.js"});
  return {bron,code:resultaat.code};
}
function hash12(v){return crypto.createHash("sha256").update(v).digest("hex").slice(0,12);}
function verwijderOudeBundles(){
  for(const naam of fs.readdirSync(PUBLIC))if(/^(?:app|early)-[0-9a-f]{12}\.min\.js$/.test(naam))fs.rmSync(path.join(PUBLIC,naam),{force:true});
}
function migreerCspNaarHeader(html){
  let bron=String(html),aantal=(bron.match(CSP_META)||[]).length;
  if(aantal>1)throw new Error("CSP-meta komt meer dan één keer voor: "+aantal);
  if(aantal===1)bron=bron.replace(CSP_META,"");
  if(!bron.includes(DELIVERY_META)&&bron.includes("</head>"))bron=bron.replace("</head>",DELIVERY_META+"\n</head>");
  return bron;
}
function voegBundleToe(html,naam){
  let bron=migreerCspNaarHeader(html);
  if((bron.split("</body>").length-1)!==1)throw new Error("body-einde ontbreekt of is dubbel bij delivery.");
  return bron.replace("</body>",'<script src="/'+naam+'" defer></script>\n</body>');
}
async function vervangVroegeScripts(html,earlyScripts,cache){
  let bron=String(html);
  for(const vroeg of earlyScripts||[]){
    const runtime=await minifyRuntime([vroeg.body],null);
    if(!runtime)throw new Error("Lege vroege runtime kan pre-paintvolgorde niet bewaren.");
    let naam=cache.get(runtime.code);
    if(!naam){
      naam="early-"+hash12(runtime.code)+".min.js";
      fs.writeFileSync(path.join(PUBLIC,naam),runtime.code,"utf8");
      cache.set(runtime.code,naam);
    }
    const tag='<script src="/'+naam+'"></script>';
    bron=vervangExact(bron,vroeg.token,tag,"vroege-scriptpositie");
  }
  return bron;
}
function werkServiceworkerBij(rootBundle){
  const swPad=path.join(PUBLIC,"sw.js");
  if(!fs.existsSync(swPad)||!rootBundle)return;
  let sw=fs.readFileSync(swPad,"utf8");
  const shellAnker='  "./", "./index.html", "./manifest.json"';
  if((sw.split(shellAnker).length-1)!==1)throw new Error("Serviceworker-shellanker ontbreekt of is dubbel.");
  sw=sw.replace(shellAnker,'  "./", "./index.html", "./'+rootBundle+'", "./manifest.json"');
  fs.writeFileSync(swPad,sw,"utf8");
}
async function optimaliseerPublic(publicDir=PUBLIC){
  if(path.resolve(publicDir)!==path.resolve(PUBLIC))throw new Error("Delivery-optimalisatie werkt uitsluitend op de definitieve public-map.");
  for(const naam of ["functions","cloudflare"])fs.rmSync(path.join(PUBLIC,naam),{recursive:true,force:true});
  verwijderOudeBundles();
  const bestanden=htmlBestanden(PUBLIC).sort();
  if(!bestanden.includes(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt voor delivery-optimalisatie.");
  const bundleCache=new Map();const earlyCache=new Map();let rootBundle=null,rootBron=null;
  for(const bestand of bestanden){
    let html=fs.readFileSync(bestand,"utf8");
    if(!/<script/i.test(html)){fs.writeFileSync(bestand,cssMinify(migreerCspNaarHeader(html)),"utf8");continue;}
    html=hardenRuntime(html);
    const verzameld=verzamelRuntime(html);
    let geleverd=await vervangVroegeScripts(verzameld.html,verzameld.earlyScripts,earlyCache);
    if(!verzameld.scripts.length){
      fs.writeFileSync(bestand,cssMinify(migreerCspNaarHeader(geleverd)),"utf8");
      continue;
    }
    const runtime=await minifyRuntime(verzameld.scripts,verzameld.routeData);
    if(bestand===path.join(PUBLIC,"index.html")){rootBron=runtime.bron;fs.writeFileSync(BRON_SNAPSHOT,rootBron,"utf8");}
    const sleutel=runtime.code;
    let naam=bundleCache.get(sleutel);
    if(!naam){
      naam="app-"+hash12(runtime.code)+".min.js";
      fs.writeFileSync(path.join(PUBLIC,naam),runtime.code,"utf8");
      bundleCache.set(sleutel,naam);
    }
    if(bestand===path.join(PUBLIC,"index.html"))rootBundle=naam;
    let uit=voegBundleToe(geleverd,naam);
    uit=cssMinify(uit);
    fs.writeFileSync(bestand,uit,"utf8");
  }
  if(!rootBundle||!rootBron)throw new Error("Homepage-runtime is niet verpakt.");
  werkServiceworkerBij(rootBundle);
  vernieuwServiceworkerCache(PUBLIC,"delivery");
  const rootHtml=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  if(/<script(?![^>]*\bsrc=)(?![^>]*\btype=["'](?:application\/ld\+json|application\/json)["'])[^>]*>[\s\S]*?<\/script>/i.test(rootHtml))throw new Error("Executable inline script bleef achter op homepage.");
  if(/http-equiv="Content-Security-Policy"/i.test(rootHtml))throw new Error("CSP-meta bleef achter na header-migratie.");
  if(rootHtml.includes('horizontaal.setAttribute("aria-label"'))throw new Error("Ongeldige line-ARIA bleef achter in delivery-runtime.");
  return {htmlBestanden:bestanden.length,bundles:bundleCache.size,earlyBundles:earlyCache.size,rootBundle};
}

if(require.main===module){
  optimaliseerPublic().then(r=>console.log(`Platform/delivery cleanup: ${r.htmlBestanden} HTML-bestanden, ${r.bundles} minified runtimebundles, ${r.earlyBundles} vroege bundles; homepage ${r.rootBundle}.`))
    .catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
}

module.exports={hardenRuntime,cssMinify,verzamelRuntime,minifyRuntime,hash12,migreerCspNaarHeader,optimaliseerPublic,BRON_SNAPSHOT};

"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const {LOCATIES}=require("./seo-locations.config.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const PUBLIC=path.join(ROOT,"public");
const MANIFEST_NAAM="release-client-manifest.json";
const MANIFEST_META='<meta name="weather-client-manifest" content="/'+MANIFEST_NAAM+'">';
const APP_RE=/<script src="\/(app-[0-9a-f]{12}\.min\.js)" defer><\/script>/g;
const BUILD_RE=/<meta name="weather-build-sha" content="([^"]+)">/;

function hash(v){return crypto.createHash("sha256").update(v).digest("hex");}
function hash12(v){return hash(v).slice(0,12);}
function htmlBestanden(dir){
  const uit=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())uit.push(...htmlBestanden(p));
    else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function mainScript(html,label){
  const matches=[...String(html).matchAll(APP_RE)];
  if(matches.length!==1)throw new Error(`${label}: verwacht exact één hoofdclient, gevonden ${matches.length}.`);
  return matches[0][1];
}
function voegManifestMetaToe(html){
  let bron=String(html);
  bron=bron.replace(/<meta name="weather-client-manifest" content="[^"]+">\s*/g,"");
  if((bron.split("</head>").length-1)!==1)throw new Error("HTML zonder eenduidig head-einde bij clientmanifest.");
  return bron.replace("</head>",MANIFEST_META+"\n</head>");
}

function main(){
  const rootPad=path.join(PUBLIC,"index.html");
  if(!fs.existsSync(rootPad))throw new Error("public/index.html ontbreekt na platform cleanup.");
  let rootHtml=fs.readFileSync(rootPad,"utf8");
  const rootBundle=mainScript(rootHtml,"homepage");
  const build=(BUILD_RE.exec(rootHtml)||[])[1];
  if(!build||!/^[0-9a-f]{40}$/i.test(build))throw new Error("Homepage mist een geldige weather-build-sha.");
  const rootBundlePad=path.join(PUBLIC,rootBundle);
  if(!fs.existsSync(rootBundlePad))throw new Error(`Homepagebundle ontbreekt: ${rootBundle}.`);

  const routeRuntime='(function(){const el=document.getElementById("weather-now-route");if(!el)return;try{window.__WEATHERNOW_ROUTE_LOCATION__=Object.freeze(JSON.parse(el.textContent||"null"));}catch(e){window.__WEATHERNOW_ROUTE_LOCATION__=null;}})();';
  const routeBootstrap="route-bootstrap-"+hash12(routeRuntime)+".min.js";
  fs.writeFileSync(path.join(PUBLIC,routeBootstrap),routeRuntime,"utf8");

  for(const loc of LOCATIES){
    const pad=path.join(PUBLIC,"weer",loc.slug,"index.html");
    if(!fs.existsSync(pad))throw new Error(`${loc.slug}: plaatsroute ontbreekt na platform cleanup.`);
    let html=fs.readFileSync(pad,"utf8");
    if(!html.includes('id="weather-now-route"'))throw new Error(`${loc.slug}: route-data ontbreekt na platform cleanup.`);
    const oud=mainScript(html,loc.slug);
    const oudTag=`<script src="/${oud}" defer></script>`;
    const nieuwTag=`<script src="/${routeBootstrap}"></script>\n<script src="/${rootBundle}" defer></script>`;
    if((html.split(oudTag).length-1)!==1)throw new Error(`${loc.slug}: hoofdclienttag ontbreekt of is dubbel.`);
    html=html.replace(oudTag,nieuwTag);
    fs.writeFileSync(pad,html,"utf8");
  }

  const alleHtml=htmlBestanden(PUBLIC);
  for(const bestand of alleHtml){
    const html=voegManifestMetaToe(fs.readFileSync(bestand,"utf8"));
    fs.writeFileSync(bestand,html,"utf8");
  }

  const referenties=new Set();
  for(const bestand of alleHtml){
    const html=fs.readFileSync(bestand,"utf8");
    for(const m of html.matchAll(/src="\/(app-[0-9a-f]{12}\.min\.js)"/g))referenties.add(m[1]);
  }
  for(const naam of fs.readdirSync(PUBLIC)){
    if(/^app-[0-9a-f]{12}\.min\.js$/.test(naam)&&!referenties.has(naam))fs.rmSync(path.join(PUBLIC,naam),{force:true});
  }

  const manifest={
    schema:1,
    buildSha:build,
    mainScript:"/"+rootBundle,
    mainScriptSha256:hash(fs.readFileSync(rootBundlePad)),
    routeBootstrap:"/"+routeBootstrap,
    weatherHtmlRoutes:LOCATIES.length+1
  };
  fs.writeFileSync(path.join(PUBLIC,MANIFEST_NAAM),JSON.stringify(manifest,null,2)+"\n","utf8");

  const swPad=path.join(PUBLIC,"sw.js");
  if(!fs.existsSync(swPad))throw new Error("Serviceworker ontbreekt bij client-unificatie.");
  let sw=fs.readFileSync(swPad,"utf8");
  if(/app-[0-9a-f]{12}\.min\.js/.test(sw)&&!sw.includes(rootBundle))throw new Error("Serviceworker verwijst vóór unificatie naar een andere hoofdclient.");
  if(!sw.includes(`"./${MANIFEST_NAAM}"`)){
    const anker=`"./${rootBundle}", "./manifest.json"`;
    if((sw.split(anker).length-1)!==1)throw new Error("Serviceworker-shellanker voor hoofdclient ontbreekt of is dubbel.");
    sw=sw.replace(anker,`"./${rootBundle}", "./${MANIFEST_NAAM}", "./manifest.json"`);
    fs.writeFileSync(swPad,sw,"utf8");
  }

  const versie=vernieuwServiceworkerCache(PUBLIC,"release-client-unify-20260904");
  console.log(`Release-client unificatie: ${LOCATIES.length+1} weerroutes gebruiken /${rootBundle}; build ${build}; manifest /${MANIFEST_NAAM}; cache ${versie}.`);
}

if(require.main===module)main();
module.exports={MANIFEST_NAAM,MANIFEST_META,APP_RE,BUILD_RE,htmlBestanden,mainScript,voegManifestMetaToe};

"use strict";

const fs=require("fs");
const path=require("path");

const CONNECT_SOURCE="https://eu.i.posthog.com";
const GOOGLE_SCRIPT_SOURCE="https://www.googletagmanager.com";
const GOOGLE_CONNECT_SOURCES=["https://*.google-analytics.com","https://*.analytics.google.com",GOOGLE_SCRIPT_SOURCE];
const GOOGLE_IMG_SOURCES=["https://*.google-analytics.com",GOOGLE_SCRIPT_SOURCE];
const SCRIPT_SRC="/posthog-analytics.js";
const SCRIPT_TAG=`<script src="${SCRIPT_SRC}" defer data-analytics="posthog"></script>`;
const DELIVERY_META='<meta name="weather-delivery" content="external-minified-v1">';

function ontleedRichtlijn(deel){
  const trim=String(deel||"").trim();
  if(!trim)return {naam:"",bronnen:[]};
  const stukken=trim.split(/\s+/);
  return {naam:String(stukken.shift()||"").toLowerCase(),bronnen:stukken};
}

function voegBronnenToe(policy,richtlijn,bronnen){
  const origineel=String(policy||"");
  const delen=origineel.split(";");
  const info=delen.map(ontleedRichtlijn);
  const index=info.findIndex(x=>x.naam===richtlijn);
  const defaultIndex=info.findIndex(x=>x.naam==="default-src");
  const nodig=bronnen.filter(bron=>index<0||!info[index].bronnen.includes(bron));
  if(!nodig.length)return origineel;

  if(index>=0){
    const trim=delen[index].trim();
    const prefix=delen[index].slice(0,delen[index].indexOf(trim));
    delen[index]=`${prefix}${trim} ${nodig.join(" ")}`;
    return delen.join(";");
  }
  if(defaultIndex>=0){
    const defaults=info[defaultIndex].bronnen;
    if(!defaults.length)throw new Error(`HTML-CSP heeft een ongeldige lege default-src; ${richtlijn} kan niet veilig worden uitgebreid.`);
    delen.splice(defaultIndex+1,0,` ${richtlijn} ${defaults.join(" ")} ${nodig.join(" ")}`);
    return delen.join(";");
  }
  return origineel;
}

function verruimConnectSrc(policy){
  return voegBronnenToe(policy,"connect-src",[CONNECT_SOURCE]);
}

function verruimGoogleAnalyticsCsp(policy){
  let uit=String(policy||"");
  uit=voegBronnenToe(uit,"script-src",[GOOGLE_SCRIPT_SOURCE]);
  uit=voegBronnenToe(uit,"connect-src",GOOGLE_CONNECT_SOURCES);
  uit=voegBronnenToe(uit,"img-src",GOOGLE_IMG_SOURCES);
  return uit;
}

function pasHtmlAan(html){
  let metas=0;
  let uit=String(html).replace(/(<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*\bcontent=)(["'])(.*?)\2([^>]*>)/gi,(match,voor,quote,policy,na)=>{
    metas++;
    const verruimd=verruimGoogleAnalyticsCsp(verruimConnectSrc(policy));
    return voor+quote+verruimd+quote+na;
  });

  const bestaande=(uit.match(/<script\b[^>]*\bsrc=["']\/posthog-analytics\.js["'][^>]*><\/script>/gi)||[]).length;
  if(bestaande>1)throw new Error("Analytics-script staat dubbel in HTML-artifact.");
  if(bestaande===0&&/<\/body>/i.test(uit))uit=uit.replace(/<\/body>/i,`${SCRIPT_TAG}\n</body>`);
  return {html:uit,metas,scriptAanwezig:bestaande===1||uit.includes(SCRIPT_TAG)};
}

function htmlBestanden(root){
  const uit=[];
  if(!fs.existsSync(root))return uit;
  for(const item of fs.readdirSync(root,{withFileTypes:true})){
    const volledig=path.join(root,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(volledig));
    else if(item.isFile()&&item.name.toLowerCase().endsWith(".html"))uit.push(volledig);
  }
  return uit;
}

function productieHeaderStaatToe(){
  const headerPad=path.join(__dirname,"..","cloudflare","_headers");
  if(!fs.existsSync(headerPad))return false;
  return fs.readFileSync(headerPad,"utf8").includes(CONNECT_SOURCE);
}

function productieHeaderStaatGoogleToe(){
  const headerPad=path.join(__dirname,"..","cloudflare","_headers");
  if(!fs.existsSync(headerPad))return false;
  const header=fs.readFileSync(headerPad,"utf8");
  return header.includes(GOOGLE_SCRIPT_SOURCE)
    &&GOOGLE_CONNECT_SOURCES.every(bron=>header.includes(bron))
    &&GOOGLE_IMG_SOURCES.every(bron=>header.includes(bron));
}

function pasArtifactAan(root=path.join(__dirname,"..","public")){
  const asset=path.join(root,"posthog-analytics.js");
  if(!fs.existsSync(asset))throw new Error("posthog-analytics.js ontbreekt in publieke buildoutput.");
  const bestanden=htmlBestanden(root);
  if(!bestanden.length)throw new Error(`Geen HTML-artifact gevonden in ${root}.`);

  let gewijzigd=0,metas=0,scripts=0;
  for(const bestand of bestanden){
    const bron=fs.readFileSync(bestand,"utf8");
    const resultaat=pasHtmlAan(bron);
    metas+=resultaat.metas;
    if(resultaat.scriptAanwezig)scripts++;
    if(resultaat.html!==bron){fs.writeFileSync(bestand,resultaat.html,"utf8");gewijzigd++;}
  }

  const index=path.join(root,"index.html");
  if(!fs.existsSync(index))throw new Error("public/index.html ontbreekt.");
  const indexHtml=fs.readFileSync(index,"utf8");
  if(!indexHtml.includes(SCRIPT_TAG))throw new Error("Analytics-script ontbreekt na artifactbewerking in index.html.");

  const deliveryActief=indexHtml.includes(DELIVERY_META);
  const metaPosthog=indexHtml.includes(CONNECT_SOURCE);
  const metaGoogle=indexHtml.includes(GOOGLE_SCRIPT_SOURCE)&&GOOGLE_CONNECT_SOURCES.every(bron=>indexHtml.includes(bron));
  if(!metaPosthog){
    if(!deliveryActief)throw new Error("PostHog EU capture-origin ontbreekt in de meta-CSP van index.html.");
    if(!productieHeaderStaatToe())throw new Error("PostHog EU capture-origin ontbreekt in de productie-CSP-header na deliverymigratie.");
  }
  if(!metaGoogle){
    if(!deliveryActief)throw new Error("Google Analytics-origins ontbreken in de meta-CSP van index.html.");
    if(!productieHeaderStaatGoogleToe())throw new Error("Google Analytics-origins ontbreken in de productie-CSP-header na deliverymigratie.");
  }

  console.log(`analytics: ${bestanden.length} HTML-bestanden gecontroleerd, ${scripts} scripts actief, ${metas} meta-CSP's gezien, ${gewijzigd} bestanden aangepast.`);
  return {bestanden:bestanden.length,scripts,metas,gewijzigd,deliveryActief};
}

if(require.main===module){
  try{pasArtifactAan();}
  catch(e){console.error(e&&e.stack||e);process.exit(1);}
}

module.exports={CONNECT_SOURCE,GOOGLE_SCRIPT_SOURCE,GOOGLE_CONNECT_SOURCES,GOOGLE_IMG_SOURCES,SCRIPT_SRC,SCRIPT_TAG,DELIVERY_META,ontleedRichtlijn,voegBronnenToe,verruimConnectSrc,verruimGoogleAnalyticsCsp,pasHtmlAan,htmlBestanden,productieHeaderStaatToe,productieHeaderStaatGoogleToe,pasArtifactAan};

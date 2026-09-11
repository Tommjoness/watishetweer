"use strict";

const fs=require("fs");
const path=require("path");

const CONNECT_SOURCE="https://eu.i.posthog.com";
const SCRIPT_SRC="/posthog-analytics.js";
const SCRIPT_TAG=`<script src="${SCRIPT_SRC}" defer data-analytics="posthog"></script>`;
const DELIVERY_META='<meta name="weather-delivery" content="external-minified-v1">';

function ontleedRichtlijn(deel){
  const trim=String(deel||"").trim();
  if(!trim)return {naam:"",bronnen:[]};
  const stukken=trim.split(/\s+/);
  return {naam:String(stukken.shift()||"").toLowerCase(),bronnen:stukken};
}

function verruimConnectSrc(policy){
  const origineel=String(policy||"");
  const delen=origineel.split(";");
  const info=delen.map(ontleedRichtlijn);
  const connectIndex=info.findIndex(x=>x.naam==="connect-src");
  const defaultIndex=info.findIndex(x=>x.naam==="default-src");

  if(connectIndex>=0){
    if(info[connectIndex].bronnen.includes(CONNECT_SOURCE))return origineel;
    const trim=delen[connectIndex].trim();
    const prefix=delen[connectIndex].slice(0,delen[connectIndex].indexOf(trim));
    delen[connectIndex]=`${prefix}${trim} ${CONNECT_SOURCE}`;
    return delen.join(";");
  }
  if(defaultIndex>=0){
    const bronnen=info[defaultIndex].bronnen;
    if(!bronnen.length)throw new Error("HTML-CSP heeft een ongeldige lege default-src; PostHog capture kan niet veilig worden toegestaan.");
    delen.splice(defaultIndex+1,0,` connect-src ${bronnen.join(" ")} ${CONNECT_SOURCE}`);
    return delen.join(";");
  }

  /* Zonder connect-src én zonder default-src is netwerkverkeer in deze meta-CSP
     niet beperkt. Voeg dan geen nieuwe beperking toe die bestaande pagina's kan
     breken; de geserveerde Cloudflare-header blijft productie wel afbakenen. */
  return origineel;
}

function pasHtmlAan(html){
  let metas=0;
  let uit=String(html).replace(/(<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*\bcontent=)(["'])(.*?)\2([^>]*>)/gi,(match,voor,quote,policy,na)=>{
    metas++;
    return voor+quote+verruimConnectSrc(policy)+quote+na;
  });

  const bestaande=(uit.match(/<script\b[^>]*\bsrc=["']\/posthog-analytics\.js["'][^>]*><\/script>/gi)||[]).length;
  if(bestaande>1)throw new Error("PostHog analytics-script staat dubbel in HTML-artifact.");
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
  if(!indexHtml.includes(SCRIPT_TAG))throw new Error("PostHog analytics-script ontbreekt na artifactbewerking in index.html.");

  const deliveryActief=indexHtml.includes(DELIVERY_META);
  const metaStaatToe=indexHtml.includes(CONNECT_SOURCE);
  if(!metaStaatToe){
    if(!deliveryActief)throw new Error("PostHog EU capture-origin ontbreekt in de meta-CSP van index.html.");
    if(!productieHeaderStaatToe())throw new Error("PostHog EU capture-origin ontbreekt in de productie-CSP-header na deliverymigratie.");
  }

  console.log(`posthog-analytics: ${bestanden.length} HTML-bestanden gecontroleerd, ${scripts} scripts actief, ${metas} meta-CSP's gezien, ${gewijzigd} bestanden aangepast.`);
  return {bestanden:bestanden.length,scripts,metas,gewijzigd,deliveryActief};
}

if(require.main===module){
  try{pasArtifactAan();}
  catch(e){console.error(e&&e.stack||e);process.exit(1);}
}

module.exports={CONNECT_SOURCE,SCRIPT_SRC,SCRIPT_TAG,DELIVERY_META,ontleedRichtlijn,verruimConnectSrc,pasHtmlAan,htmlBestanden,productieHeaderStaatToe,pasArtifactAan};

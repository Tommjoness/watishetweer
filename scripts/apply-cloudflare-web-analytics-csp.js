"use strict";

const fs=require("fs");
const path=require("path");
const CSP_SOURCE="https://static.cloudflareinsights.com";

function ontleedRichtlijn(deel){
  const trim=String(deel||"").trim();
  if(!trim)return {naam:"",bronnen:[]};
  const stukken=trim.split(/\s+/);
  return {naam:String(stukken.shift()||"").toLowerCase(),bronnen:stukken};
}

function voegBronToe(deel){
  const tekst=String(deel||"");
  const trim=tekst.trim();
  if(!trim||trim.split(/\s+/).includes(CSP_SOURCE))return tekst;
  const prefix=tekst.slice(0,tekst.indexOf(trim));
  return `${prefix}${trim} ${CSP_SOURCE}`;
}

function verruimCsp(policy){
  const origineel=String(policy||"");
  const delen=origineel.split(";");
  const info=delen.map(ontleedRichtlijn);
  const elemIndex=info.findIndex(x=>x.naam==="script-src-elem");
  const scriptIndex=info.findIndex(x=>x.naam==="script-src");
  const defaultIndex=info.findIndex(x=>x.naam==="default-src");

  /* Automatische Cloudflare Web Analytics kan een versiepad achter
     beacon.min.js injecteren. Een CSP-bron die exact op beacon.min.js eindigt
     blokkeert zo'n URL. Sta daarom uitsluitend de officiële Cloudflare Insights-
     origin toe in de werkelijk effectieve script-richtlijn. */
  if(elemIndex>=0){
    delen[elemIndex]=voegBronToe(delen[elemIndex]);
    return delen.join(";");
  }
  if(scriptIndex>=0){
    delen[scriptIndex]=voegBronToe(delen[scriptIndex]);
    return delen.join(";");
  }
  if(defaultIndex>=0){
    const bronnen=info[defaultIndex].bronnen;
    if(!bronnen.length)throw new Error("HTML-CSP heeft een ongeldige lege default-src; Web Analytics kan niet veilig worden toegestaan.");
    const nieuw=` script-src ${bronnen.join(" ")} ${CSP_SOURCE}`;
    delen.splice(defaultIndex+1,0,nieuw);
    return delen.join(";");
  }

  /* Zonder script-src(-elem) én zonder default-src beperkt deze meta-CSP
     externe scripts niet. Extra beleid toevoegen zou de bestaande pagina juist
     strenger kunnen maken en onverwacht breken, dus dit is bewust een noop. */
  return origineel;
}

function pasHtmlAan(html){
  let gezien=0;
  const uit=String(html).replace(/(<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*\bcontent=)(["'])(.*?)\2([^>]*>)/gi,(match,voor,quote,policy,na)=>{
    gezien++;
    return voor+quote+verruimCsp(policy)+quote+na;
  });
  return {html:uit,gevonden:gezien};
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

function pasArtifactAan(root=path.join(__dirname,"..","public")){
  const bestanden=htmlBestanden(root);
  if(!bestanden.length)throw new Error(`Geen HTML-artifact gevonden in ${root}.`);
  let metas=0,gewijzigd=0;
  for(const bestand of bestanden){
    const bron=fs.readFileSync(bestand,"utf8");
    const uit=pasHtmlAan(bron);
    metas+=uit.gevonden;
    if(uit.html!==bron){fs.writeFileSync(bestand,uit.html);gewijzigd++;}
  }
  const index=path.join(root,"index.html");
  if(!fs.existsSync(index))throw new Error("public/index.html ontbreekt.");
  const indexHtml=fs.readFileSync(index,"utf8");
  if(!indexHtml.includes(CSP_SOURCE))throw new Error("Cloudflare Web Analytics CSP-bron ontbreekt na artifactbewerking in index.html.");
  console.log(`cloudflare-web-analytics-csp: ${bestanden.length} HTML-bestanden gecontroleerd, ${metas} meta-CSP's gezien, ${gewijzigd} bestanden aangepast.`);
  return {bestanden:bestanden.length,metas,gewijzigd};
}

if(require.main===module){
  try{pasArtifactAan();}
  catch(e){console.error(e&&e.stack||e);process.exit(1);}
}

module.exports={CSP_SOURCE,ontleedRichtlijn,voegBronToe,verruimCsp,pasHtmlAan,htmlBestanden,pasArtifactAan};

"use strict";

const fs=require("fs");
const path=require("path");
const CSP_SOURCE="https://static.cloudflareinsights.com/beacon.min.js";

function verruimCsp(policy){
  const delen=String(policy||"").split(";");
  let gevonden=false;
  const nieuw=delen.map(deel=>{
    const trim=deel.trim();
    if(!/^script-src(?:\s|$)/.test(trim))return deel;
    gevonden=true;
    if(trim.includes(CSP_SOURCE))return deel;
    const prefix=deel.slice(0,deel.indexOf(trim));
    return `${prefix}${trim} ${CSP_SOURCE}`;
  });
  if(!gevonden)throw new Error("HTML-CSP mist script-src; automatische Cloudflare Web Analytics kan niet veilig worden toegestaan.");
  return nieuw.join(";");
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

module.exports={CSP_SOURCE,verruimCsp,pasHtmlAan,htmlBestanden,pasArtifactAan};

"use strict";
const fs=require("fs"),path=require("path");
const ROOT=path.join(__dirname,".."),OUT=path.join(ROOT,"public"),htmlPad=path.join(OUT,"index.html");
const html=fs.readFileSync(htmlPad,"utf8");
function eis(cond,msg){if(!cond)throw new Error("Finale auditverificatie: "+msg);}
function lum(hex){const rgb=hex.replace("#","").match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
function contrast(a,b){const x=lum(a),y=lum(b),hi=Math.max(x,y),lo=Math.min(x,y);return (hi+.05)/(lo+.05);}

eis(html.includes("/* ===== FINAL AUDIT 20260901 ===== */"),"auditmarker ontbreekt");
eis(html.includes('id="weather-final-audit-20260901"'),"auditstijl ontbreekt");
eis(html.includes(".final-top-grid"),"desktop topgrid ontbreekt");
eis(html.includes("grid-template-columns:minmax(0,.95fr) minmax(480px,1.05fr)"),"desktop topgrid heeft niet de geborgde twee kolommen");
eis(html.includes("#chart g[data-q4-rain-periods]{display:none!important}"),"oude regenbrackets zijn niet visueel uitgezet");
eis(html.includes("Verwachte meetbare neerslag:"),"nieuwe broncorrecte regenperiodecopy ontbreekt");
eis(html.includes("Kies een dag om die verwachting in de grafiek te bekijken."),"weekhint is niet kort en consumentgericht");
eis(html.includes("Vandaag: resterende neerslagkans vanaf nu"),"Vandaag-horizon is niet rijgebonden uitgelegd");
eis(html.includes("Officiële waarschuwingen controleren; dit kan even duren."),"trage waarschuwingstatus ontbreekt");
eis(html.includes("Uitleg van watishetweer.nl:"),"Nederlandse waarschuwinguitleg ontbreekt");
eis(html.includes("Officiële tekst van de National Weather Service"),"officiële NWS-tekst is niet expliciet gelabeld");
eis(html.includes("--ink-25:#606C67"),"contrasttoken ontbreekt");
eis(contrast("#606C67","#F4F5F3")>=4.7,"licht contrast heeft minder dan 4,7:1 marge");
eis(html.includes("Bronnen voor deze weergave"),"dynamische bronlabel ontbreekt");

const privacy=fs.readFileSync(path.join(OUT,"privacy.html"),"utf8");
eis(privacy.includes('<link rel="canonical" href="https://watishetweer.nl/privacy">'),"privacycanonical is niet /privacy");
eis(privacy.includes('<meta property="og:url" content="https://watishetweer.nl/privacy">'),"privacy og:url is niet /privacy");
for(const p of [htmlPad,path.join(OUT,"privacy.html"),path.join(OUT,"over","index.html")])if(fs.existsSync(p))eis(!/href=["'](?:\/)?privacy\.html["']/.test(fs.readFileSync(p,"utf8")),path.relative(OUT,p)+" bevat nog privacy.html-link");
const sitemap=fs.readFileSync(path.join(OUT,"sitemap.xml"),"utf8");
eis(sitemap.includes("<loc>https://watishetweer.nl/privacy</loc>"),"privacy ontbreekt in sitemap");

const headers=fs.readFileSync(path.join(ROOT,"cloudflare","_headers"),"utf8");
eis(/\/app-\*\.min\.js[\s\S]*max-age=31536000, immutable/.test(headers),"immutable cacheheader voor app-hash ontbreekt");
eis(/\/early-\*\.min\.js[\s\S]*max-age=31536000, immutable/.test(headers),"immutable cacheheader voor early-hash ontbreekt");
eis(/\/sw\.js[\s\S]*max-age=0, must-revalidate/.test(headers),"serviceworker is niet hervalidatiegericht");

console.log("Finale auditartifact groen: 2×4 desktop-topgrid, rustige regenpresentatie, rijgebonden Today-horizon, waarschuwingstatus, bronprovenance, contrast, privacycanonical en immutable hashes zijn geborgd.");

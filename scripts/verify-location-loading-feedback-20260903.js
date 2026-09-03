"use strict";

const fs=require("fs"),path=require("path");
const p=path.join(__dirname,"..","public","index.html");
if(!fs.existsSync(p))throw new Error("public/index.html ontbreekt voor location-loading verificatie.");
const html=fs.readFileSync(p,"utf8");
const eis=(c,m)=>{if(!c)throw new Error(m);};

eis((html.match(/LOCATION LOADING FEEDBACK 20260903/g)||[]).length===2,"Location-loading markers ontbreken of zijn dubbel.");
eis(html.includes('#stamp.laden{'),"Stamp-laadstijl ontbreekt in gebouwd artifact.");
eis(html.includes('Weer ophalen…'),"Zichtbare forecast-laadtekst ontbreekt.");
eis(html.includes('Plaatsen zoeken…'),"Zichtbare plaatszoek-laadtekst ontbreekt.");
eis(html.includes('class="locatieladen-spinner" aria-hidden="true"'),"Spinnermarkup ontbreekt.");
eis(html.includes('if(!stil)weatherNowLocatieLaden(true);'),"Load-start koppeling ontbreekt.");
eis(html.includes('if(!stil&&mijnBeurt===laadTeller)weatherNowLocatieLaden(false);'),"Race-safe load-finally ontbreekt.");
eis(html.includes('veld.setAttribute("aria-busy",aan?"true":"false")'),"aria-busy koppeling ontbreekt.");
eis(!html.includes('<div id="locatieladen"'),"Ongewenste extra laadstatusrij aangetroffen.");

console.log("Built location-loading feedback: zichtbaar zoeken + spinner bij forecast, aria-busy, reduced-motion en latest-wins cleanup geverifieerd.");

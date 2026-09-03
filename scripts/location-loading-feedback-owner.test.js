"use strict";

const fs=require("fs"),path=require("path");
const {MARKER,HELPER,pasHtmlToe}=require("./apply-location-loading-feedback-20260903.js");

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const html=pasHtmlToe(bron);

function eis(cond,msg){if(!cond)throw new Error(msg);}

eis(html!==bron,"Location-loading owner heeft de bron niet getransformeerd.");
eis((html.match(/LOCATION LOADING FEEDBACK 20260903/g)||[]).length===2,"CSS- en JS-marker ontbreken of zijn dubbel.");
eis(html.includes('#stamp.laden{'),"Zichtbare laadstatus op de bestaande stampregel ontbreekt.");
eis(html.includes('#stamp.laden::before{'),"Preview-veilige spinner via pseudo-element ontbreekt.");
eis(html.includes('#stamp.laden::after{'),"Preview-veilige laadtekst via pseudo-element ontbreekt.");
eis(html.includes('content:"Weer ophalen…"'),"Zichtbare forecast-laadtekst ontbreekt.");
eis(html.includes('prefers-reduced-motion:reduce'),"Reduced-motion fallback ontbreekt.");
eis(html.includes('if(!stil)weatherNowLocatieLaden(true);'),"Niet-stille load activeert de indicator niet.");
eis(html.includes('if(!stil&&mijnBeurt===laadTeller)weatherNowLocatieLaden(false);'),"Latest-wins guard bij uitschakelen ontbreekt.");
eis(html.includes('veld.setAttribute("aria-busy",aan?"true":"false")'),"aria-busy feedback ontbreekt.");
eis(html.includes('stamp.setAttribute("aria-label","Weer ophalen…")'),"Toegankelijke laadnaam ontbreekt.");
eis(html.includes('stamp.removeAttribute("aria-label")'),"Toegankelijke laadnaam wordt niet hersteld.");
eis(html.includes('zoekMeldingToon("Plaatsen zoeken…")'),"Zichtbare geocoder-feedback ontbreekt.");
eis(html.includes('zoekMelding.classList.remove("on");zoekMelding.textContent="";'),"Geocoder-laadmelding wordt na succes niet opgeruimd.");
eis(!html.includes('stamp.innerHTML='),"Laadfeedback mag niet meer door tekenAlles() overschrijfbaar DOM-markup gebruiken.");
eis(!html.includes('<div id="locatieladen"'),"De fix mag geen extra layoutrij toevoegen.");
new Function(HELPER);

let dubbel=false;
try{pasHtmlToe(html);}catch(e){dubbel=/al in artifact/.test(String(e&&e.message));}
eis(dubbel,"Dubbele toepassing wordt niet geblokkeerd.");

console.log("Location-loading owner: geocoderfeedback, preview-veilige forecastindicator, reduced motion, aria-busy, zero-layout-row en latest-wins guard aanwezig.");

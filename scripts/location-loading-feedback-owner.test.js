"use strict";

const fs=require("fs"),path=require("path");
const {MARKER,HELPER,pasHtmlToe}=require("./apply-location-loading-feedback-20260903.js");

function eis(cond,msg){if(!cond)throw new Error(msg);}

/* Deze owner hoort bewust ná final-release-hardening. De fixture bevat alleen
   de geharde load-vorm en de zoekankers die deze UX-laag mag aanraken. */
const bron=`<!doctype html><html><head><style>:root{--rule:#ccc;--ink-70:#222;--ink-45:#555;--sans:Arial}</style></head><body>
<input id="q"><span id="stamp"></span><div id="state"></div><div id="zoekmelding"></div>
<script>
/* ---------- ophalen ---------- */
async function load(lat,lon,label,stil,opslaan,land){
  const mijnBeurt=++laadTeller;
  const vorigeLocatie={d:{},label:"Oud"};
  const st=document.getElementById("state");
  const vorigeBlijftZichtbaar=!!(vorigeLocatie&&vorigeLocatie.d);
  if(!stil){st.style.display="block";st.className="msg";st.textContent=vorigeBlijftZichtbaar
    ?"Gegevens voor "+label+" ophalen. Tot die klaar zijn, zie je nog de gegevens voor "+vorigeLocatie.label+"."
    :"Gegevens ophalen.";}
  if(vorigeBlijftZichtbaar){
    void vorigeLocatie;
  }
  try{
    await Promise.resolve();
  }catch(err){
    if(mijnBeurt!==laadTeller)return;
    if(err)void err;
  }
  chips();
}
function zoek(){
  let timer,generatie=zoekGeneratie;
  timer=setTimeout(async()=>{
    try{
      const d=await Promise.resolve({results:[]});
      if(generatie!==zoekGeneratie)return;
      const resultaten=Array.isArray(d.results)?d.results:[];
      void resultaten;
    }catch(e){void e;}
  },0);
  return timer;
}
</script></body></html>`;

const html=pasHtmlToe(bron);
eis(html!==bron,"Location-loading owner heeft de geharde fixture niet getransformeerd.");
eis((html.match(/LOCATION LOADING FEEDBACK 20260903/g)||[]).length===2,"CSS- en JS-marker ontbreken of zijn dubbel.");
eis(html.includes('#stamp.laden{'),"Zichtbare laadstatus op de bestaande stampregel ontbreekt.");
eis(html.includes('#stamp.laden::before{'),"Preview-veilige spinner via pseudo-element ontbreekt.");
eis(html.includes('#stamp.laden::after{'),"Preview-veilige laadtekst via pseudo-element ontbreekt.");
eis(html.includes('content:"Weer ophalen…"'),"Zichtbare forecast-laadtekst ontbreekt.");
eis(html.includes('prefers-reduced-motion:reduce'),"Reduced-motion fallback ontbreekt.");
eis(html.includes('if(!stil)weatherNowLocatieLaden(true);'),"Niet-stille load activeert de indicator niet.");
eis(html.includes('}finally{'),"Race-safe cleanup staat niet in een finally-blok.");
eis(html.includes('if(!stil&&mijnBeurt===laadTeller)weatherNowLocatieLaden(false);'),"Latest-wins guard bij uitschakelen ontbreekt.");
eis(html.includes('veld.setAttribute("aria-busy",aan?"true":"false")'),"aria-busy feedback ontbreekt.");
eis(html.includes('stamp.setAttribute("aria-label","Weer ophalen…")'),"Toegankelijke laadnaam ontbreekt.");
eis(html.includes('stamp.removeAttribute("aria-label")'),"Toegankelijke laadnaam wordt niet hersteld.");
eis(html.includes('zoekMeldingToon("Plaatsen zoeken…")'),"Zichtbare geocoder-feedback ontbreekt.");
eis(html.includes('zoekMelding.classList.remove("on");zoekMelding.textContent="";'),"Geocoder-laadmelding wordt na succes niet opgeruimd.");
eis(!html.includes('stamp.innerHTML='),"Laadfeedback mag niet meer door tekenAlles() overschrijfbaar DOM-markup gebruiken.");
eis(!html.includes('<div id="locatieladen"'),"De fix mag geen extra layoutrij toevoegen.");
new Function(HELPER);
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
scripts.forEach((code,i)=>new Function(code+`\n//# sourceURL=location-loading-owner-fixture-${i}.js`));

let dubbel=false;
try{pasHtmlToe(html);}catch(e){dubbel=/al in artifact/.test(String(e&&e.message));}
eis(dubbel,"Dubbele toepassing wordt niet geblokkeerd.");

const ruw=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
let teVroeg=false;
try{pasHtmlToe(ruw);}catch(e){teVroeg=/vereist eerst/.test(String(e&&e.message));}
eis(teVroeg,"Owner weigert een nog niet geharde bron niet fail-fast.");

console.log("Location-loading owner: alleen na cachehardening, syntactisch geldige finally, geocoderfeedback, preview-veilige forecastindicator, aria-busy en latest-wins guard aanwezig.");

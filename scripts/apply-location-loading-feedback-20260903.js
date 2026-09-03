"use strict";

const fs=require("fs"),path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== LOCATION LOADING FEEDBACK 20260903 ===== */";
const HARDENED_MARKER="const vorigeBlijftZichtbaar=!!(";
const STYLE=`
${MARKER}
/* De bestaande #stamp-regel doet tijdelijk dienst als laadstatus. De zichtbare
   indicator komt uit pseudo-elementen, zodat een tussentijdse tekenAlles()-
   render de laadfeedback niet kan wegschrijven terwijl de volledige forecast
   nog onderweg is. Er wordt geen extra layoutrij toegevoegd. */
#stamp.laden{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:flex-end!important;
  gap:7px!important;
  min-height:18px;
  font-size:0!important
}
#stamp.laden::before{
  content:"";
  width:11px;
  height:11px;
  flex:0 0 11px;
  border:1.5px solid var(--rule);
  border-top-color:var(--ink-70);
  border-radius:50%;
  animation:wiw-locatie-laden .72s linear infinite
}
#stamp.laden::after{
  content:"Weer ophalen…";
  font:500 12px/1.3 var(--sans);
  letter-spacing:.01em;
  color:var(--ink-45);
  white-space:nowrap
}
@keyframes wiw-locatie-laden{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){
  #stamp.laden::before{animation:none}
}
`;

const HELPER=`
${MARKER.replace("/*","/* JS")}
let weatherNowStampAriaVoorLaden=null,weatherNowStampAtomicVoorLaden=null;
function weatherNowLocatieLaden(aan){
  const veld=document.getElementById("q"),stamp=document.getElementById("stamp");
  if(veld)veld.setAttribute("aria-busy",aan?"true":"false");
  if(!stamp)return;
  if(aan){
    if(!stamp.classList.contains("laden")){
      weatherNowStampAriaVoorLaden=stamp.getAttribute("aria-label");
      weatherNowStampAtomicVoorLaden=stamp.getAttribute("aria-atomic");
    }
    stamp.classList.add("laden");
    stamp.setAttribute("aria-label","Weer ophalen…");
    stamp.setAttribute("aria-atomic","true");
    return;
  }
  stamp.classList.remove("laden");
  if(weatherNowStampAriaVoorLaden===null)stamp.removeAttribute("aria-label");
  else stamp.setAttribute("aria-label",weatherNowStampAriaVoorLaden);
  if(weatherNowStampAtomicVoorLaden===null)stamp.removeAttribute("aria-atomic");
  else stamp.setAttribute("aria-atomic",weatherNowStampAtomicVoorLaden);
  weatherNowStampAriaVoorLaden=null;
  weatherNowStampAtomicVoorLaden=null;
}
`;

const LOAD_START='  if(!stil){st.style.display="block";st.className="msg";st.textContent=vorigeBlijftZichtbaar\n    ?"Gegevens voor "+label+" ophalen. Tot die klaar zijn, zie je nog de gegevens voor "+vorigeLocatie.label+"."\n    :"Gegevens ophalen.";}\n  if(vorigeBlijftZichtbaar){';
const LOAD_START_NIEUW='  if(!stil){st.style.display="block";st.className="msg";st.textContent=vorigeBlijftZichtbaar\n    ?"Gegevens voor "+label+" ophalen. Tot die klaar zijn, zie je nog de gegevens voor "+vorigeLocatie.label+"."\n    :"Gegevens ophalen.";}\n  if(!stil)weatherNowLocatieLaden(true);\n  if(vorigeBlijftZichtbaar){';
const ZOEK_START='  timer=setTimeout(async()=>{\n    try{';
const ZOEK_START_NIEUW='  timer=setTimeout(async()=>{\n    zoekMeldingToon("Plaatsen zoeken…");\n    try{';
const ZOEK_SUCCES='      if(generatie!==zoekGeneratie)return;\n      const resultaten=Array.isArray(d.results)?d.results:[];';
const ZOEK_SUCCES_NIEUW='      if(generatie!==zoekGeneratie)return;\n      zoekMelding.classList.remove("on");zoekMelding.textContent="";\n      const resultaten=Array.isArray(d.results)?d.results:[];';

function exactEen(html,zoek,vervang,label){
  const n=html.split(zoek).length-1;
  if(n!==1)throw new Error(`${label} ontbreekt of is dubbel: ${n}`);
  return html.replace(zoek,vervang);
}

function voegLoadFinallyToe(html){
  const loadAnker="async function load(lat,lon,label,stil,opslaan,land){";
  const loadPos=html.indexOf(loadAnker);
  if(loadPos<0)throw new Error("load()-anker ontbreekt voor location-loading cleanup.");
  const catchPos=html.indexOf("  }catch(err){",loadPos);
  if(catchPos<0)throw new Error("Hardened catch ontbreekt voor location-loading cleanup.");
  const eindAnker="\n  chips();\n}";
  const eindPos=html.indexOf(eindAnker,catchPos);
  if(eindPos<0)throw new Error("load()-eindanker ontbreekt voor location-loading cleanup.");
  const segment=html.slice(catchPos,eindPos);
  const sluitPos=segment.lastIndexOf("\n  }");
  if(sluitPos<0)throw new Error("Catch-sluitbrace ontbreekt voor location-loading cleanup.");
  const absoluut=catchPos+sluitPos;
  const invoeg='\n  }finally{\n    /* Een oude, ingehaalde aanvraag mag de indicator van de nieuwste locatie\n       nooit uitzetten. Refreshes met stil=true houden hun bestaande knopstatus. */\n    if(!stil&&mijnBeurt===laadTeller)weatherNowLocatieLaden(false);\n  }';
  return html.slice(0,absoluut)+invoeg+html.slice(absoluut+4);
}

function pasHtmlToe(html){
  if(!html.includes("async function load(lat,lon,label,stil,opslaan,land)"))return html;
  if(!html.includes(HARDENED_MARKER))throw new Error("Location-loading feedback vereist eerst de final-release locatie-cachehardening.");
  if(html.includes(MARKER))throw new Error("Location-loading feedback staat al in artifact.");
  html=exactEen(html,"</head>",`<style>${STYLE}\n</style>\n</head>`,"Head");
  html=exactEen(html,"/* ---------- ophalen ---------- */",HELPER+"\n/* ---------- ophalen ---------- */","Ophaalsectie");
  html=exactEen(html,LOAD_START,LOAD_START_NIEUW,"Hardened load-start");
  html=voegLoadFinallyToe(html);
  html=exactEen(html,ZOEK_START,ZOEK_START_NIEUW,"Zoek-start");
  html=exactEen(html,ZOEK_SUCCES,ZOEK_SUCCES_NIEUW,"Zoek-succes");
  return html;
}

function htmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmlBestanden(p));
    else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function main(){
  let n=0;
  for(const p of htmlBestanden(OUT)){
    const oud=fs.readFileSync(p,"utf8"),nieuw=pasHtmlToe(oud);
    if(nieuw===oud)continue;
    fs.writeFileSync(p,nieuw,"utf8");n++;
  }
  if(!n)throw new Error("Geen gehard interactief weerartifact gevonden voor location-loading feedback.");
  const cache=vernieuwServiceworkerCache(OUT,"location-loading-feedback-20260903");
  console.log(`Location-loading feedback na cachehardening toegepast op ${n} weerpagina's; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,HARDENED_MARKER,STYLE,HELPER,pasHtmlToe,htmlBestanden,main};

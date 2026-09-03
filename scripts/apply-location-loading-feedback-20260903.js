"use strict";

const fs=require("fs"),path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== LOCATION LOADING FEEDBACK 20260903 ===== */";
const STYLE=`
${MARKER}
/* De bestaande #stamp-regel doet tijdelijk dienst als laadstatus. Daardoor
   verschijnt er duidelijke feedback pal onder de zoekbediening zonder een
   extra rij, layoutshift of breder zoekblok te introduceren. */
#stamp.laden{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:flex-end!important;
  gap:7px!important;
  min-height:18px
}
#stamp .locatieladen-spinner{
  width:11px;
  height:11px;
  flex:0 0 11px;
  border:1.5px solid var(--rule);
  border-top-color:var(--ink-70);
  border-radius:50%;
  animation:wiw-locatie-laden .72s linear infinite
}
@keyframes wiw-locatie-laden{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){
  #stamp .locatieladen-spinner{animation:none}
}
`;

const HELPER=`
${MARKER.replace("/*","/* JS")}
let weatherNowStampVoorLaden=null;
function weatherNowLocatieLaden(aan){
  const veld=document.getElementById("q"),stamp=document.getElementById("stamp");
  if(veld)veld.setAttribute("aria-busy",aan?"true":"false");
  if(!stamp)return;
  if(aan){
    if(!stamp.classList.contains("laden"))weatherNowStampVoorLaden=stamp.textContent;
    stamp.classList.add("laden");
    stamp.setAttribute("aria-atomic","true");
    stamp.innerHTML='<span class="locatieladen-spinner" aria-hidden="true"></span><span>Weer ophalen…</span>';
    return;
  }
  if(stamp.classList.contains("laden")){
    stamp.classList.remove("laden");
    /* tekenAlles() vervangt de spinner bij succes of geldige cache al door de
       nieuwe timestamp. Alleen wanneer er helemaal niets kon worden getekend,
       staat de spinner hier nog en herstellen we de vorige timestamp. */
    if(stamp.querySelector(".locatieladen-spinner"))stamp.textContent=weatherNowStampVoorLaden||"";
  }
  weatherNowStampVoorLaden=null;
}
`;

const LOAD_START='  if(!stil){st.style.display="block";st.className="msg";st.textContent="Gegevens ophalen.";}';
const LOAD_START_NIEUW=LOAD_START+'\n  if(!stil)weatherNowLocatieLaden(true);';
const LOAD_EIND='    }\n  }\n  chips();\n}\n\n/* ---------- tekenen ---------- */';
const LOAD_EIND_NIEUW='    }\n  }finally{\n    /* Een oude, ingehaalde aanvraag mag de indicator van de nieuwste locatie\n       nooit uitzetten. Refreshes met stil=true houden hun bestaande knopstatus. */\n    if(!stil&&mijnBeurt===laadTeller)weatherNowLocatieLaden(false);\n  }\n  chips();\n}\n\n/* ---------- tekenen ---------- */';
const ZOEK_START='  timer=setTimeout(async()=>{\n    try{';
const ZOEK_START_NIEUW='  timer=setTimeout(async()=>{\n    zoekMeldingToon("Plaatsen zoeken…");\n    try{';
const ZOEK_SUCCES='      if(generatie!==zoekGeneratie)return;\n      const resultaten=Array.isArray(d.results)?d.results:[];';
const ZOEK_SUCCES_NIEUW='      if(generatie!==zoekGeneratie)return;\n      zoekMelding.classList.remove("on");zoekMelding.textContent="";\n      const resultaten=Array.isArray(d.results)?d.results:[];';

function exactEen(html,zoek,vervang,label){
  const n=html.split(zoek).length-1;
  if(n!==1)throw new Error(`${label} ontbreekt of is dubbel: ${n}`);
  return html.replace(zoek,vervang);
}

function pasHtmlToe(html){
  if(!html.includes("async function load(lat,lon,label,stil,opslaan,land)"))return html;
  if(html.includes(MARKER))throw new Error("Location-loading feedback staat al in artifact.");
  html=exactEen(html,"</style>",STYLE+"\n</style>","Stijlblok");
  html=exactEen(html,"/* ---------- ophalen ---------- */",HELPER+"\n/* ---------- ophalen ---------- */","Ophaalsectie");
  html=exactEen(html,LOAD_START,LOAD_START_NIEUW,"Load-start");
  html=exactEen(html,LOAD_EIND,LOAD_EIND_NIEUW,"Load-finally");
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
  if(!n)throw new Error("Geen interactief weerartifact gevonden voor location-loading feedback.");
  const cache=vernieuwServiceworkerCache(OUT,"location-loading-feedback-20260903");
  console.log(`Location-loading feedback toegepast op ${n} weerpagina's; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,STYLE,HELPER,pasHtmlToe,htmlBestanden,main};

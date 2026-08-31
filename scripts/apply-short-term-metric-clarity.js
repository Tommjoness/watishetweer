"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const PAD=path.join(OUT,"index.html");
const MARK="/* ===== SHORT TERM METRIC CLARITY 20260831 ===== */";

/* De late mobile-truthlaag draait bewust op alle viewports en was daardoor de
   laatste eigenaar van de kop boven #pop. Hij maakte van een precieze kans +
   hoeveelheid opnieuw het generieke 'Neerslag komend uur'. Vervang exact die
   kleine presentatie-owner; brondata, kansbeleid en Q1-horizon blijven intact. */
const NEERSLAG_UUR_OUD=`function neerslagUurBetekenis(){
  const waarde=document.getElementById("pop"),stat=waarde&&waarde.closest(".stat");if(!waarde||!stat)return;
  const kop=stat.querySelector(".eyebrow");if(kop)kop.textContent="Neerslag komend uur";
  let sleutel=stat.querySelector(".mobile-neerslag-sleutel");
  if(!sleutel){sleutel=document.createElement("div");sleutel.className="mobile-neerslag-sleutel";waarde.insertAdjacentElement("afterend",sleutel);}
  sleutel.textContent="kans · verwachte hoeveelheid";
  const tekst=(waarde.textContent||"").trim();
  if(tekst&&tekst!=="--"&&tekst!=="–")waarde.setAttribute("aria-label","Komend uur: "+tekst+". Eerst de neerslagkans, daarna de verwachte hoeveelheid.");
}`;

const NEERSLAG_UUR_NIEUW=`${MARK}
function neerslagUurBetekenis(){
  const waarde=document.getElementById("pop"),stat=waarde&&waarde.closest(".stat");if(!waarde||!stat)return;
  const kop=stat.querySelector(".eyebrow");
  let sleutel=stat.querySelector(".mobile-neerslag-sleutel");
  if(!sleutel){sleutel=document.createElement("div");sleutel.className="mobile-neerslag-sleutel";waarde.insertAdjacentElement("afterend",sleutel);}

  /* Q1 kan in een actuele natte situatie uit het centrale kansbeleid het woord
     'Neerslag' krijgen, terwijl dezelfde 60-minutenanalyse wél een percentage
     en/of hoeveelheid bevat. Presenteer dan de onderliggende getallen. Zo zegt
     de tegel altijd wat de gebruiker daadwerkelijk bekijkt. */
  const presentatie=root.WeatherNowNeerslagPresentatieV2;
  let a=null;
  try{a=presentatie&&typeof presentatie.analyse==="function"?presentatie.analyse(60):null;}catch(e){}
  const kans=presentatie&&typeof presentatie.kansKomendUur==="function"?presentatie.kansKomendUur(a):null;
  const mm=a&&a.hoeveelheid!==null&&a.hoeveelheid!==undefined&&Number.isFinite(Number(a.hoeveelheid))&&Number(a.hoeveelheid)>=0.1?Number(a.hoeveelheid):null;
  const huidigNat=!!(a&&(a.currentWet||a.status==="NEERSLAG_NU"));
  let tekst=(waarde.textContent||"").replace(/\\s+/g," ").trim();
  if(/^(?:Neerslag|Nu)(?:\\s*·.*)?$/i.test(tekst)){
    if(kans!==null&&mm!==null)waarde.innerHTML=String(Math.round(kans))+"<s>%</s><s> · "+mm.toFixed(1).replace(".",",")+" mm</s>";
    else if(kans!==null)waarde.innerHTML=String(Math.round(kans))+"<s>%</s>";
    else if(mm!==null)waarde.innerHTML=mm.toFixed(1).replace(".",",")+"<s> mm</s>";
    else if(huidigNat)waarde.textContent="Nu";
    tekst=(waarde.textContent||"").replace(/\\s+/g," ").trim();
  }

  const actueel=/\\bmm\\s*\\/\\s*u\\b/i.test(tekst);
  const heeftKans=/%/.test(tekst),heeftMm=!actueel&&/\\bmm\\b/i.test(tekst);
  if(kop)kop.textContent=actueel||(!heeftKans&&!heeftMm&&huidigNat)
    ?"Neerslag nu"
    :heeftKans&&heeftMm?"Neerslagverwachting komend uur"
    :heeftKans?"Neerslagkans komend uur"
    :heeftMm?"Verwachte neerslag komend uur"
    :"Neerslagverwachting komend uur";

  const sleutelTekst=heeftKans&&heeftMm?"kans · verwacht totaal":heeftKans?"kans":heeftMm?"verwacht totaal":"";
  sleutel.textContent=sleutelTekst;sleutel.hidden=!sleutelTekst;
  if(tekst&&tekst!=="--"&&tekst!=="–"){
    const uitleg=heeftKans&&heeftMm?" Eerst de neerslagkans, daarna het verwachte totaal in het komende uur."
      :heeftKans?" Dit is de neerslagkans voor het komende uur."
      :heeftMm?" Dit is het verwachte totaal in het komende uur.":"";
    waarde.setAttribute("aria-label",(actueel?"Nu: ":"Komend uur: ")+tekst+"."+uitleg);
  }
}`;

const GRAPH_SLEUTEL_OUD='  const zichtbareSleutel=tekst==="kans · verwachte hoeveelheid"?"kans · totaal komend uur":tekst;';
const GRAPH_SLEUTEL_NIEUW='  const zichtbareSleutel=tekst==="kans · verwachte hoeveelheid"?"kans · verwacht totaal":tekst;';

function pasKortetermijnMetricClarityToe(bron){
  let html=String(bron||"");
  if(html.includes(MARK))throw new Error("Kortetermijn-metric clarity is al toegepast.");
  const neerslagAantal=html.split(NEERSLAG_UUR_OUD).length-1;
  if(neerslagAantal!==1)throw new Error("Neerslag-uurowner ontbreekt of is dubbel: "+neerslagAantal);
  const sleutelAantal=html.split(GRAPH_SLEUTEL_OUD).length-1;
  if(sleutelAantal!==1)throw new Error("Neerslagsleutel-owner ontbreekt of is dubbel: "+sleutelAantal);
  html=html.replace(NEERSLAG_UUR_OUD,NEERSLAG_UUR_NIEUW).replace(GRAPH_SLEUTEL_OUD,GRAPH_SLEUTEL_NIEUW);
  if(!html.includes('"Neerslagverwachting komend uur"'))throw new Error("Expliciete neerslagverwachting ontbreekt na clarity-laag.");
  if(!html.includes('"kans · verwacht totaal"'))throw new Error("Expliciete kans/hoeveelheidsleutel ontbreekt na clarity-laag.");
  return html;
}

function voerUit(){
  let html=fs.readFileSync(PAD,"utf8");
  html=pasKortetermijnMetricClarityToe(html);
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  if(!scripts.length)throw new Error("Geen inline runtime na kortetermijn-metric clarity.");
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:short-term-metric-clarity-"+(i+1)}));
  fs.writeFileSync(PAD,html,"utf8");
  const versie=vernieuwServiceworkerCache(OUT,"short-term-metric-clarity-20260831");
  console.log("Kortetermijnmetingen verduidelijkt: windstootuurmaximum en neerslagkans/hoeveelheid zijn expliciet; cache "+versie+".");
}

if(require.main===module)voerUit();
module.exports={MARK,NEERSLAG_UUR_OUD,NEERSLAG_UUR_NIEUW,GRAPH_SLEUTEL_OUD,GRAPH_SLEUTEL_NIEUW,pasKortetermijnMetricClarityToe};

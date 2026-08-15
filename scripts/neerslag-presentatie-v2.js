/* Neerslagpresentatie v2.
 *
 * De provider- en interpretatielaag bepalen wat inhoudelijk waar is. Deze kleine
 * presentatielaag zorgt er alleen voor dat dezelfde waarheid ook overal zichtbaar
 * is: actuele mm/u als er een verse meting is, een expliciet gelabelde kans als
 * er geen actuele neerslag is, en één consistente actuele toestand in hero,
 * briefing en het twee-uursblok.
 */
(function(root){
"use strict";

if(typeof document==="undefined"||typeof S==="undefined")return;
if(typeof meters!=="function"||typeof briefing!=="function"||typeof nowcast!=="function")return;

const policy=root.WeatherNowKansbeleidV3;
const interpretatie=root.WeatherNowInterpretatie;
const ACTUEEL_DREMPEL_MMU=0.1;

const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
const fmt1=v=>Number(v).toFixed(1).replace(".",",");
const esc=t=>String(t==null?"":t).replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function lokaleNu(){
  return typeof weatherNowActueleLokaleTijd==="function"?weatherNowActueleLokaleTijd():undefined;
}

function analyse(duur){
  if(!interpretatie||typeof interpretatie.analyseerNeerslagData!=="function"||!S.d)return null;
  try{return interpretatie.analyseerNeerslagData(S.d,duur,lokaleNu());}
  catch(e){return null;}
}

function actueleIntensiteit(a){
  const v=num(a&&a.currentIntensiteit);
  return a&&a.bronActueel==="knmi-rtcor"&&v!==null&&v>=0?v:null;
}

function meetbareNeerslagNu(a){
  const v=actueleIntensiteit(a);
  return v!==null&&v>=ACTUEEL_DREMPEL_MMU&&!!(a.currentRadarWet||a.currentWet||a.status==="NEERSLAG_NU");
}

function waardeMetEenheid(v,eenheid){
  if(v>0&&v<0.1)return "&lt;0,1<s> "+eenheid+"</s>";
  return fmt1(Math.max(0,v))+"<s> "+eenheid+"</s>";
}

function statVoor(id){
  const el=document.getElementById(id);
  if(!el)return {el:null,stat:null,kop:null,sub:null};
  const stat=typeof el.closest==="function"?el.closest(".stat"):null;
  const kop=stat&&typeof stat.querySelector==="function"?stat.querySelector(".eyebrow"):null;
  return {el,stat,kop,sub:document.getElementById(id+"sub")};
}

function zetHtml(el,html){if(el)el.innerHTML=html;}
function zetTekst(el,tekst){if(el)el.textContent=tekst;}

function kansKomendUur(a){
  const k=num(a&&a.kans);
  return k===null?null:Math.round(clamp(k));
}

function werkNeerslagkaartBij(){
  const a=analyse(60),kaart=statVoor("pop");
  if(!kaart.el)return;
  const intensiteit=actueleIntensiteit(a);

  if(meetbareNeerslagNu(a)){
    if(kaart.kop)kaart.kop.textContent="Neerslag nu";
    zetHtml(kaart.el,waardeMetEenheid(intensiteit,"mm/u"));
    if(kaart.sub){
      if(a&&a.droogVanafTijd)kaart.sub.textContent="Actueel gemeten. Rond "+a.droogVanafTijd+" wordt het naar verwachting droog.";
      else kaart.sub.textContent="Actueel gemeten neerslagintensiteit.";
    }
    return;
  }

  /* Zonder meetbare actuele neerslag blijft het bestaande percentage staan.
     De kop maakt nu expliciet dat dit een kans is, zodat 49% nooit als een
     hoeveelheid of intensiteit gelezen kan worden. */
  if(kaart.kop)kaart.kop.textContent="Neerslagkans komend uur";
}

function actueleConditieTekst(a){
  if(!meetbareNeerslagNu(a))return null;
  const soort=String(a&&a.soort||"").trim();
  if(soort&&soort!=="neerslag")return soort.charAt(0).toUpperCase()+soort.slice(1);
  return "Neerslag";
}

function synchroniseerHero(){
  const a=analyse(120),tekst=actueleConditieTekst(a);
  if(!tekst)return;
  const cond=document.getElementById("cond"),mini=document.getElementById("minicond"),ico=document.getElementById("nowicon");
  zetTekst(cond,tekst);zetTekst(mini,tekst);
  if(ico&&typeof icon==="function"&&S.d&&S.d.current){
    const code=num(S.d.current.weather_code),regenCode=code!==null&&code>=51&&code<=99?code:61;
    ico.innerHTML=icon(regenCode,S.d.current.is_day===1,46);
  }
}

function actueleNeerslagZin(a,metCijfer){
  if(!meetbareNeerslagNu(a))return "";
  const v=actueleIntensiteit(a),basis=metCijfer
    ?"Er valt nu neerslag: "+fmt1(v)+" mm/u."
    :"Er valt nu neerslag.";
  return a&&a.droogVanafTijd?basis+" Rond "+a.droogVanafTijd+" wordt het naar verwachting droog.":basis;
}

function vervangEersteNeerslagzinInBriefing(a){
  if(!meetbareNeerslagNu(a))return;
  const el=document.getElementById("brief");
  if(!el||typeof el.innerHTML!=="string")return;
  const nieuw=actueleNeerslagZin(a,true);
  if(!nieuw)return;

  /* De neerslagzin staat bewust als eerste, onopgemaakte zin in de briefing.
     Vervang alleen dat voorste tekstdeel en laat temperatuur/windmarkup erna
     onaangeraakt. Als de structuur ooit verandert, doen we niets in plaats van
     willekeurige HTML te herschrijven. */
  const re=/^(?:(?:In|De|Er|Het)\s[^<]*?(?:neerslag|regen|buien)[^<]*?\.\s*)/i;
  if(re.test(el.innerHTML))el.innerHTML=el.innerHTML.replace(re,esc(nieuw)+" ");
}

function tweeUurTekst(a,bestaand){
  if(!a)return bestaand||"";
  const intensiteit=actueleIntensiteit(a);
  if(meetbareNeerslagNu(a)){
    let zin="Er valt nu neerslag: "+fmt1(intensiteit)+" mm/u.";
    if(a.droogVanafTijd)return zin+" Rond "+a.droogVanafTijd+" wordt het naar verwachting droog.";
    const mm=num(a.hoeveelheid);
    if(a.bronHoeveelheid==="knmi-nowcast"&&mm!==null&&mm>=0.1)
      zin+=" In de komende twee uur wordt daarna ongeveer "+fmt1(mm)+" mm verwacht.";
    return zin;
  }

  if(a.bronHoeveelheid==="knmi-nowcast"){
    const mm=num(a.hoeveelheid);
    if(a.status==="NEERSLAG_VERWACHT"){
      let zin=a.eersteTijd?"Het is nu droog. Vanaf ongeveer "+a.eersteTijd+" wordt neerslag verwacht.":"Het is nu droog. In de komende twee uur wordt neerslag verwacht.";
      if(mm!==null&&mm>=0.1)zin+=" Verwachte hoeveelheid: ongeveer "+fmt1(mm)+" mm.";
      return zin;
    }
    if(a.status==="SPOORHOEVEELHEID")return "Het is nu droog. In de komende twee uur kunnen enkele druppels vallen.";
  }
  return bestaand||"";
}

function werkTweeUurBij(){
  const a=analyse(120),tx=document.getElementById("nctext"),grafiek=document.getElementById("nc");
  if(!tx)return;
  const tekst=tweeUurTekst(a,tx.textContent);
  if(tekst)tx.textContent=tekst;
  if(grafiek&&tekst){
    const bestaand=grafiek.getAttribute&&grafiek.getAttribute("aria-label");
    grafiek.setAttribute("aria-label",tekst+(bestaand&&bestaand.indexOf(tekst)<0?" "+bestaand:""));
  }
}

const basisMeters=meters;
meters=function(){
  const r=basisMeters.apply(this,arguments);
  werkNeerslagkaartBij();
  synchroniseerHero();
  return r;
};

const basisBriefing=briefing;
briefing=function(){
  const r=basisBriefing.apply(this,arguments);
  const a=analyse(120);
  vervangEersteNeerslagzinInBriefing(a);
  synchroniseerHero();
  return r;
};

const basisNowcast=nowcast;
nowcast=function(){
  const r=basisNowcast.apply(this,arguments);
  werkTweeUurBij();
  synchroniseerHero();
  return r;
};

root.WeatherNowNeerslagPresentatieV2={
  analyse,actueleIntensiteit,meetbareNeerslagNu,kansKomendUur,
  actueleConditieTekst,actueleNeerslagZin,tweeUurTekst,
  werkNeerslagkaartBij,synchroniseerHero,werkTweeUurBij
};
})(typeof globalThis!=="undefined"?globalThis:this);

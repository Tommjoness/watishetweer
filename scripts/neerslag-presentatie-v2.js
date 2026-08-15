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

const ACTUEEL_DREMPEL_MMU=0.1;
const SPOOR_MM=0.005;

const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const clamp=v=>Math.max(0,Math.min(100,Number(v)||0));
const fmt1=v=>Number(v).toFixed(1).replace(".",",");
const esc=t=>String(t==null?"":t).replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function lokaleNu(){
  return typeof weatherNowActueleLokaleTijd==="function"?weatherNowActueleLokaleTijd():undefined;
}

function interpretatieNu(){return root.WeatherNowInterpretatie;}
function beleidNu(){return root.WeatherNowKansbeleidV3;}

function analyse(duur){
  const interpretatie=interpretatieNu(),beleid=beleidNu();
  if(!interpretatie||typeof interpretatie.analyseerNeerslagData!=="function"||!S.d)return null;
  try{
    const a=interpretatie.analyseerNeerslagData(S.d,duur,lokaleNu());
    if(!a)return a;
    /* In de normale build heeft het centrale kansbeleid de engine al verrijkt.
       Deze fallback maakt de presentatielaag echter ongevoelig voor injectie- of
       wrappervolgorde: als er wél KNMI-data op S.d staat maar de ontvangen analyse
       nog geen KNMI-bron draagt, verrijken we exact één keer met dezelfde officiële
       policy. Al verrijkte analyses worden nooit dubbel verwerkt. */
    const knmi=S.d&&S.d.__knmiNeerslag;
    const alVerrijkt=a.bronActueel==="knmi-rtcor"||a.bronHoeveelheid==="knmi-nowcast";
    if(knmi&&beleid&&typeof beleid.verrijkAnalyseMetKnmi==="function"&&!alVerrijkt){
      return beleid.verrijkAnalyseMetKnmi(a,S.d,duur,interpretatie,Date.now());
    }
    return a;
  }catch(e){return null;}
}

function actueleIntensiteit(a){
  const v=num(a&&a.currentIntensiteit);
  return a&&a.bronActueel==="knmi-rtcor"&&v!==null&&v>=0?v:null;
}

function meetbareNeerslagNu(a){
  const v=actueleIntensiteit(a);
  return v!==null&&v>=ACTUEEL_DREMPEL_MMU&&!!(a.currentRadarWet||a.currentWet||a.status==="NEERSLAG_NU");
}

/* Een verse officiële 0-meting is net zo betekenisvol als een natte meting.
   Dit expliciete predicaat voorkomt dat de presentatielaag alleen de natte helft
   van de providerwaarheid kan zien en een eerder getekende modelregen laat staan. */
function officieleDrogeMeting(a){
  const v=actueleIntensiteit(a);
  return v!==null&&v<ACTUEEL_DREMPEL_MMU&&a&&a.currentRadarWet===false;
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

function betrouwbareKomendUurHoeveelheid(a){
  if(!a||a.bronHoeveelheid!=="knmi-nowcast")return null;
  const mm=num(a.hoeveelheid);
  return mm!==null&&mm>SPOOR_MM?mm:null;
}

function werkNeerslagkaartBij(){
  const a=analyse(60),kaart=statVoor("pop"),beleid=beleidNu();
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

  const komendMm=betrouwbareKomendUurHoeveelheid(a);
  if(komendMm!==null){
    if(kaart.kop)kaart.kop.textContent="Neerslag komend uur";
    zetHtml(kaart.el,waardeMetEenheid(komendMm,"mm"));
    if(kaart.sub){
      kaart.sub.textContent=a&&a.eersteTijd
        ?"Vanaf ongeveer "+a.eersteTijd+" wordt neerslag verwacht."
        :"Verwachte hoeveelheid in het komende uur.";
    }
    return;
  }

  /* Zonder meetbare actuele neerslag of betrouwbare hoeveelheid is dit een
     kanskaart. Schrijf die kans uit dezelfde analyse expliciet terug in plaats
     van te vertrouwen op de tekst van een eerdere renderer. Zo kan een verse
     droge meting een toekomstige kleine kans niet per ongeluk naar 'Droog'
     reduceren. */
  if(kaart.kop)kaart.kop.textContent="Neerslagkans komend uur";
  if(a&&a.genoeg&&beleid&&typeof beleid.kansHoofd==="function"){
    const hoofd=String(beleid.kansHoofd(a)||"–");
    if(/^\d+%$/.test(hoofd))kaart.el.innerHTML=hoofd.replace("%","<s>%</s>");
    else kaart.el.textContent=hoofd;
  }
  if(kaart.sub&&beleid&&typeof beleid.komendUurTekst==="function")kaart.sub.textContent=beleid.komendUurTekst(a);
}

function actueleConditieTekst(a){
  if(!meetbareNeerslagNu(a))return null;
  const soort=String(a&&a.soort||"").trim();
  if(soort&&soort!=="neerslag")return soort.charAt(0).toUpperCase()+soort.slice(1);
  return "Neerslag";
}

function drogeHeroCode(a){
  if(!officieleDrogeMeting(a)||!S.d||!S.d.current)return null;
  const c=S.d.current,modelCode=num(c.weather_code),cc=num(c.cloud_cover);
  if(modelCode===null)return null;
  /* Alleen een conflicterende neerslagcode wordt geneutraliseerd. De actuele
     bewolkingsgraad komt uit hetzelfde current-object en verandert geen forecast. */
  if(modelCode>=51&&modelCode<=99&&cc!==null)return cc>=95?3:cc>=40?2:cc>=15?1:0;
  return modelCode;
}

function synchroniseerHero(){
  const a=analyse(120),nat=meetbareNeerslagNu(a),droog=officieleDrogeMeting(a);
  if(!nat&&!droog)return;
  const cond=document.getElementById("cond"),mini=document.getElementById("minicond"),ico=document.getElementById("nowicon");
  let code=null,tekst=null;
  if(nat){
    tekst=actueleConditieTekst(a);
    const modelCode=S.d&&S.d.current?num(S.d.current.weather_code):null;
    code=modelCode!==null&&modelCode>=51&&modelCode<=99?modelCode:61;
  }else{
    code=drogeHeroCode(a);
    if(code!==null&&typeof txt==="function"&&S.d&&S.d.current)tekst=txt(code,S.d.current.is_day!==0);
  }
  if(!tekst)return;
  zetTekst(cond,tekst);zetTekst(mini,tekst);
  if(ico&&code!==null&&typeof icon==="function"&&S.d&&S.d.current)ico.innerHTML=icon(code,S.d.current.is_day===1,46);
}

function actueleNeerslagZin(a,metCijfer){
  if(!meetbareNeerslagNu(a))return "";
  const v=actueleIntensiteit(a),basis=metCijfer
    ?"Er valt nu neerslag: "+fmt1(v)+" mm/u."
    :"Er valt nu neerslag.";
  return a&&a.droogVanafTijd?basis+" Rond "+a.droogVanafTijd+" wordt het naar verwachting droog.":basis;
}

function vervangEersteNeerslagzinInBriefing(a){
  const nat=meetbareNeerslagNu(a),droog=officieleDrogeMeting(a),beleid=beleidNu();
  if(!nat&&!droog)return;
  const el=document.getElementById("brief");
  if(!el||typeof el.innerHTML!=="string")return;
  const nieuw=nat
    ?actueleNeerslagZin(a,true)
    :(beleid&&typeof beleid.briefingZin==="function"?beleid.briefingZin(a):"");
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
  analyse,actueleIntensiteit,meetbareNeerslagNu,officieleDrogeMeting,kansKomendUur,betrouwbareKomendUurHoeveelheid,
  actueleConditieTekst,drogeHeroCode,actueleNeerslagZin,tweeUurTekst,
  werkNeerslagkaartBij,synchroniseerHero,werkTweeUurBij
};
})(typeof globalThis!=="undefined"?globalThis:this);

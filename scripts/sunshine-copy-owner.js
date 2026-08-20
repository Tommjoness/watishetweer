"use strict";

/* De zonurentegel heeft één inhoudelijke owner in de base-build. De dagselectie,
   sunshine_duration, sunrise/sunset en lokale kalenderdag blijven exact dezelfde
   databronnen; deze owner neemt alleen de al bestaande finale daglichtbewuste
   consumentencopy over van de late UI-polish-wrapper. */
function weatherNowZonurenWoord(uur,daglichtUur){
  const zon=uur!==null&&uur!==undefined&&uur!==""&&Number.isFinite(Number(uur))?Number(uur):null;
  const daglicht=daglichtUur!==null&&daglichtUur!==undefined&&daglichtUur!==""&&Number.isFinite(Number(daglichtUur))?Number(daglichtUur):null;
  if(zon===null)return "Zonuren niet beschikbaar.";
  if(daglicht!==null&&daglicht>0){
    const aandeel=Math.max(0,Math.min(1,zon/daglicht));
    if(aandeel>=0.8)return "Naar verwachting bijna de hele dag zon.";
    if(aandeel>=0.6)return "Naar verwachting veel zon vandaag.";
    if(aandeel>=0.35)return "Naar verwachting meerdere uren zon vandaag.";
    if(aandeel>=0.15)return "Naar verwachting enkele uren zon vandaag.";
    return "Naar verwachting weinig zon vandaag.";
  }
  if(zon>=8)return "Naar verwachting veel zon vandaag.";
  if(zon>=4)return "Naar verwachting meerdere uren zon vandaag.";
  if(zon>=1)return "Naar verwachting enkele uren zon vandaag.";
  return "Naar verwachting weinig zon vandaag.";
}

const ZONUREN_BRON=`function zonurenTegel(){
  const day=S.d&&S.d.daily;
  const idx=day&&day.time?day.time.indexOf(plaatsVandaag()):-1;
  const sec=idx>=0&&day.sunshine_duration?day.sunshine_duration[idx]:null;
  if(sec==null||!Number.isFinite(sec)||sec<0){
    return \`<div class="stat zon"><div class="eyebrow">Zonuren</div>
      <div class="sval">–</div><div class="ssub">Zonuren niet beschikbaar</div></div>\`;
  }
  const uur=sec/3600;
  const woord = uur<2 ? "Weinig zon vandaag" : uur<=7 ? "Een aantal zonuren vandaag" : "Vandaag redelijk wat zon";
  return \`<div class="stat zon"><div class="eyebrow">Zonuren</div>
      <div class="sval">\${nl(uur)}<s>uur</s></div><div class="ssub">\${woord}</div></div>\`;
}`;

const HELPER_PRODUCTIE=weatherNowZonurenWoord.toString();
const ZONUREN_PRODUCTIE=`function zonurenTegel(){
  const day=S.d&&S.d.daily;
  const idx=day&&Array.isArray(day.time)?day.time.indexOf(plaatsVandaag()):-1;
  const secRuw=idx>=0&&day&&Array.isArray(day.sunshine_duration)?day.sunshine_duration[idx]:null;
  const sec=secRuw!==null&&secRuw!==undefined&&secRuw!==""&&Number.isFinite(Number(secRuw))?Number(secRuw):null;
  if(sec===null||sec<0){
    return \`<div class="stat zon"><div class="eyebrow">Zonuren</div>
      <div class="sval">–</div><div class="ssub">Zonuren niet beschikbaar</div></div>\`;
  }
  const uur=sec/3600;
  let daglichtUur=null;
  const sr=day&&Array.isArray(day.sunrise)?day.sunrise[idx]:null;
  const ss=day&&Array.isArray(day.sunset)?day.sunset[idx]:null;
  if(sr&&ss&&typeof mins==="function"){
    const minuten=mins(ss)-mins(sr);
    if(Number.isFinite(minuten)&&minuten>0)daglichtUur=minuten/60;
  }
  const woord=weatherNowZonurenWoord(uur,daglichtUur);
  return \`<div class="stat zon"><div class="eyebrow">Zonuren</div>
      <div class="sval">\${nl(uur)}<s>uur</s></div><div class="ssub">\${woord}</div></div>\`;
}`;

function pasSunshineCopyToe(html){
  let bron=String(html||"");
  if(bron.includes("function weatherNowZonurenWoord(uur,daglichtUur){"))
    throw new Error("Zonurencopy-helper staat al in het aangeleverde artifact.");
  const aantal=bron.split(ZONUREN_BRON).length-1;
  if(aantal!==1)throw new Error("Zonurentegel-bronanker ontbreekt of is dubbel: "+aantal);
  bron=bron.replace(ZONUREN_BRON,HELPER_PRODUCTIE+"\n\n"+ZONUREN_PRODUCTIE);
  if((bron.split(HELPER_PRODUCTIE).length-1)!==1)throw new Error("Zonurencopy-helper ontbreekt of is dubbel na base-build.");
  if((bron.split(ZONUREN_PRODUCTIE).length-1)!==1)throw new Error("Finale zonurentegel ontbreekt of is dubbel na base-build.");
  if(bron.includes(ZONUREN_BRON))throw new Error("Oude zonurentegel heeft de base-build overleefd.");
  return bron;
}

module.exports=Object.freeze({
  ZONUREN_BRON,ZONUREN_PRODUCTIE,HELPER_PRODUCTIE,
  zonurenWoord:weatherNowZonurenWoord,
  pasSunshineCopyToe
});

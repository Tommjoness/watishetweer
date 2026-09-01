"use strict";

/* Pure base-build owner voor de tijd- en bronsemantiek van de weerbriefing. */

const BRIEFING_HAAK="function briefing(){\n";
const HELPER_PRODUCTIE=`function weatherNowBriefingGraden(waarde){
  const g=globalThis.WeatherNowNederlandseGrammatica;
  if(g&&typeof g.graden==="function")return g.graden(waarde);
  const n=Number(waarde);
  return String(waarde)+" "+(Number.isFinite(n)&&Math.abs(n)===1?"graad":"graden");
}
function weatherNowBriefingNachtzin(tmin,nuLokaal,huidigeTemperatuur){
  const doel=Number(tmin);
  if(!Number.isFinite(doel))return "";
  const waarde="<b>"+weatherNowBriefingGraden(tmin)+"</b>";
  const m=/T(\\d{2}):(\\d{2})/.exec(String(nuLokaal||""));
  const uur=m?Number(m[1]):null;
  if(Number.isFinite(uur)&&uur>=0&&uur<5){
    const huidige=eindigGetal(huidigeTemperatuur);
    if(huidige===null)return "De minimumtemperatuur vannacht ligt rond "+waarde+".";
    if(Math.abs(doel-huidige)<0.75)return "Vannacht blijft de temperatuur rond "+waarde+".";
    return doel<huidige
      ?"Vannacht daalt de temperatuur naar ongeveer "+waarde+"."
      :"Vannacht loopt de temperatuur op naar ongeveer "+waarde+".";
  }
  return "Vannacht koelt het af naar ongeveer "+waarde+".";
}
function briefing(){
`;

const NACHTZIN_BRON='  const nachtZin=tmin===null?"":" Vannacht koelt het af naar <b>"+tmin+" graden</b>.";\n';
const NACHTZIN_PRODUCTIE='  const nachtZin=weatherNowBriefingNachtzin(tmin,nuLokaal,huidige);\n';

const VANDAAG_PIEK_BRON='    zin2="Vandaag wordt het rond "+hhmm(volledigePiekVandaag.t)+" het warmst, met maximaal <b>"\n      +Math.round(volledigePiekVandaag.v)+" graden</b>."+nachtZin;\n';
const VANDAAG_PIEK_PRODUCTIE='    zin2="Het verwachte maximum ligt vandaag rond "+hhmm(volledigePiekVandaag.t)+" op <b>"\n      +weatherNowBriefingGraden(Math.round(volledigePiekVandaag.v))+"</b>."+(nachtZin?" "+nachtZin:"");\n';

const MORGEN_BRON='    zin2=morgenUurPiek\n      ?"Morgen wordt het rond "+hhmm(morgenUurPiek.t)+" het warmst, met maximaal <b>"+Math.round(morgenDagMax)+" graden</b>."+nachtZin\n      :"Morgen wordt het maximaal <b>"+Math.round(morgenDagMax)+" graden</b>."+nachtZin;\n';
const MORGEN_PRODUCTIE='    zin2=morgenUurPiek\n      ?"Het verwachte maximum ligt morgen rond "+hhmm(morgenUurPiek.t)+" op <b>"+weatherNowBriefingGraden(Math.round(morgenDagMax))+"</b>."+(nachtZin?" "+nachtZin:"")\n      :"Het verwachte maximum voor morgen is <b>"+weatherNowBriefingGraden(Math.round(morgenDagMax))+"</b>."+(nachtZin?" "+nachtZin:"");\n';

const VANDAAG_VERLEDEN_BRON='    zin2="Vandaag was het rond "+hhmm(volledigePiekVandaag.t)+" het warmst, met <b>"+Math.round(volledigePiekVandaag.v)+" graden</b>."+nachtZin;\n';
const VANDAAG_VERLEDEN_PRODUCTIE='    zin2="Het verwachte maximum lag vandaag rond "+hhmm(volledigePiekVandaag.t)+" op <b>"+weatherNowBriefingGraden(Math.round(volledigePiekVandaag.v))+"</b>."+(nachtZin?" "+nachtZin:"");\n';

const VANDAAG_MAX_BRON='    zin2="De maximumtemperatuur van vandaag ligt rond <b>"+Math.round(vandaagMax)+" graden</b>."+nachtZin;\n';
const VANDAAG_MAX_PRODUCTIE='    zin2="De maximumtemperatuur van vandaag ligt rond <b>"+weatherNowBriefingGraden(Math.round(vandaagMax))+"</b>."+(nachtZin?" "+nachtZin:"");\n';

const NACHT_STANDALONE_BRON='    zin2="Vannacht koelt het af naar <b>"+tmin+" graden</b>.";\n';
const NACHT_STANDALONE_PRODUCTIE='    zin2=weatherNowBriefingNachtzin(tmin,nuLokaal,huidige);\n';

const WAARSCHUWING_VOORRANG_BRON='        voor="<b>"+waarschKop+":</b> "+esc(w.titel)+". "+voor\n          +" De officiële waarschuwing heeft voorrang op de modelverwachting.";\n';
const WAARSCHUWING_VOORRANG_PRODUCTIE='        voor="<b>"+waarschKop+":</b> "+esc(w.titel)+". "+voor;\n';

function briefingGraden(waarde){
  const g=require("../nederlandse-weergrammatica.js");
  return g.graden(waarde);
}
function briefingNachtzin(tmin,nuLokaal,huidigeTemperatuur){
  const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
  const doel=getal(tmin);if(doel===null)return "";
  const waarde="<b>"+briefingGraden(tmin)+"</b>";
  const m=/T(\d{2}):(\d{2})/.exec(String(nuLokaal||"")),uur=m?Number(m[1]):null;
  if(Number.isFinite(uur)&&uur>=0&&uur<5){
    const huidige=getal(huidigeTemperatuur);
    if(huidige===null)return "De minimumtemperatuur vannacht ligt rond "+waarde+".";
    if(Math.abs(doel-huidige)<0.75)return "Vannacht blijft de temperatuur rond "+waarde+".";
    return doel<huidige
      ?"Vannacht daalt de temperatuur naar ongeveer "+waarde+"."
      :"Vannacht loopt de temperatuur op naar ongeveer "+waarde+".";
  }
  return "Vannacht koelt het af naar ongeveer "+waarde+".";
}

function vervangAantal(html,bron,productie,verwacht,label){
  const aantal=html.split(bron).length-1;
  if(aantal!==verwacht)throw new Error(label+" ontbreekt of heeft onverwacht aantal: "+aantal+" (verwacht "+verwacht+").");
  return html.split(bron).join(productie);
}

function pasBriefingCopyToe(html){
  let uit=String(html||"");
  if(uit.includes("function weatherNowBriefingNachtzin(tmin,nuLokaal,huidigeTemperatuur){"))
    throw new Error("Briefingcopy-owner staat al in het aangeleverde artifact.");
  uit=vervangAantal(uit,BRIEFING_HAAK,HELPER_PRODUCTIE,1,"briefing()-ownerhaak");
  uit=vervangAantal(uit,NACHTZIN_BRON,NACHTZIN_PRODUCTIE,1,"briefing nachtzin");
  uit=vervangAantal(uit,VANDAAG_PIEK_BRON,VANDAAG_PIEK_PRODUCTIE,2,"verwacht maximum vandaag");
  uit=vervangAantal(uit,MORGEN_BRON,MORGEN_PRODUCTIE,1,"verwacht maximum morgen");
  uit=vervangAantal(uit,VANDAAG_VERLEDEN_BRON,VANDAAG_VERLEDEN_PRODUCTIE,1,"verstreken verwacht maximum vandaag");
  uit=vervangAantal(uit,VANDAAG_MAX_BRON,VANDAAG_MAX_PRODUCTIE,1,"maximum vandaag zonder piekuur");
  uit=vervangAantal(uit,NACHT_STANDALONE_BRON,NACHT_STANDALONE_PRODUCTIE,1,"losse nachtzin");
  uit=vervangAantal(uit,WAARSCHUWING_VOORRANG_BRON,WAARSCHUWING_VOORRANG_PRODUCTIE,1,"redundante waarschuwing-voorrangzin");
  return uit;
}

module.exports={
  briefingGraden,briefingNachtzin,pasBriefingCopyToe,BRIEFING_HAAK,HELPER_PRODUCTIE,
  NACHTZIN_BRON,NACHTZIN_PRODUCTIE,VANDAAG_PIEK_BRON,VANDAAG_PIEK_PRODUCTIE,
  MORGEN_BRON,MORGEN_PRODUCTIE,VANDAAG_VERLEDEN_BRON,VANDAAG_VERLEDEN_PRODUCTIE,
  VANDAAG_MAX_BRON,VANDAAG_MAX_PRODUCTIE,NACHT_STANDALONE_BRON,NACHT_STANDALONE_PRODUCTIE,
  WAARSCHUWING_VOORRANG_BRON,WAARSCHUWING_VOORRANG_PRODUCTIE
};

"use strict";

/* Pure base-build owner voor de tijd- en bronsemantiek van de weerbriefing.
 *
 * De bestaande briefing() blijft eigenaar van neerslaganalyse, temperatuur- en
 * windselectie, lokale kalenderdag, markup en renderflow. Deze owner verplaatst
 * uitsluitend de al zichtbare finale UI-polish-copy naar die renderer zelf:
 * forecastmaxima blijven expliciet verwachtingen en rond 00:00–04:59 zegt de
 * nachtzin alleen "later" als er werkelijk nog een relevante daling resteert. */

const BRIEFING_HAAK="function briefing(){\n";
const HELPER_PRODUCTIE=`function weatherNowBriefingNachtzin(tmin,nuLokaal,huidigeTemperatuur){
  const doel=Number(tmin);
  if(!Number.isFinite(doel))return "";
  const waarde="<b>"+tmin+" graden</b>";
  const m=/T(\\d{2}):(\\d{2})/.exec(String(nuLokaal||""));
  const uur=m?Number(m[1]):null;
  if(Number.isFinite(uur)&&uur>=0&&uur<5){
    const huidige=eindigGetal(huidigeTemperatuur);
    if(huidige!==null&&doel>=huidige-0.75)
      return "De minimumtemperatuur vannacht ligt rond "+waarde+".";
    return "Later vannacht koelt het af naar "+waarde+".";
  }
  return "Vannacht koelt het af naar "+waarde+".";
}
function briefing(){
`;

const NACHTZIN_BRON='  const nachtZin=tmin===null?"":" Vannacht koelt het af naar <b>"+tmin+" graden</b>.";\n';
const NACHTZIN_PRODUCTIE='  const nachtZin=weatherNowBriefingNachtzin(tmin,nuLokaal,huidige);\n';

const VANDAAG_PIEK_BRON='    zin2="Vandaag wordt het rond "+hhmm(volledigePiekVandaag.t)+" het warmst, met maximaal <b>"\n      +Math.round(volledigePiekVandaag.v)+" graden</b>."+nachtZin;\n';
const VANDAAG_PIEK_PRODUCTIE='    zin2="Het verwachte maximum ligt vandaag rond "+hhmm(volledigePiekVandaag.t)+" op <b>"\n      +Math.round(volledigePiekVandaag.v)+" graden</b>."+(nachtZin?" "+nachtZin:"");\n';

const MORGEN_BRON='    zin2=morgenUurPiek\n      ?"Morgen wordt het rond "+hhmm(morgenUurPiek.t)+" het warmst, met maximaal <b>"+Math.round(morgenDagMax)+" graden</b>."+nachtZin\n      :"Morgen wordt het maximaal <b>"+Math.round(morgenDagMax)+" graden</b>."+nachtZin;\n';
const MORGEN_PRODUCTIE='    zin2=morgenUurPiek\n      ?"Het verwachte maximum ligt morgen rond "+hhmm(morgenUurPiek.t)+" op <b>"+Math.round(morgenDagMax)+" graden</b>."+(nachtZin?" "+nachtZin:"")\n      :"Het verwachte maximum voor morgen is <b>"+Math.round(morgenDagMax)+" graden</b>."+(nachtZin?" "+nachtZin:"");\n';

const VANDAAG_VERLEDEN_BRON='    zin2="Vandaag was het rond "+hhmm(volledigePiekVandaag.t)+" het warmst, met <b>"+Math.round(volledigePiekVandaag.v)+" graden</b>."+nachtZin;\n';
const VANDAAG_VERLEDEN_PRODUCTIE='    zin2="Het verwachte maximum lag vandaag rond "+hhmm(volledigePiekVandaag.t)+" op <b>"+Math.round(volledigePiekVandaag.v)+" graden</b>."+(nachtZin?" "+nachtZin:"");\n';

const VANDAAG_MAX_BRON='    zin2="De maximumtemperatuur van vandaag ligt rond <b>"+Math.round(vandaagMax)+" graden</b>."+nachtZin;\n';
const VANDAAG_MAX_PRODUCTIE='    zin2="De maximumtemperatuur van vandaag ligt rond <b>"+Math.round(vandaagMax)+" graden</b>."+(nachtZin?" "+nachtZin:"");\n';

const NACHT_STANDALONE_BRON='    zin2="Vannacht koelt het af naar <b>"+tmin+" graden</b>.";\n';
const NACHT_STANDALONE_PRODUCTIE='    zin2=weatherNowBriefingNachtzin(tmin,nuLokaal,huidige);\n';

function briefingNachtzin(tmin,nuLokaal,huidigeTemperatuur){
  const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
  const doel=getal(tmin);if(doel===null)return "";
  const waarde="<b>"+tmin+" graden</b>";
  const m=/T(\d{2}):(\d{2})/.exec(String(nuLokaal||"")),uur=m?Number(m[1]):null;
  if(Number.isFinite(uur)&&uur>=0&&uur<5){
    const huidige=getal(huidigeTemperatuur);
    if(huidige!==null&&doel>=huidige-0.75)return "De minimumtemperatuur vannacht ligt rond "+waarde+".";
    return "Later vannacht koelt het af naar "+waarde+".";
  }
  return "Vannacht koelt het af naar "+waarde+".";
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
  return uit;
}

module.exports={
  briefingNachtzin,pasBriefingCopyToe,BRIEFING_HAAK,HELPER_PRODUCTIE,
  NACHTZIN_BRON,NACHTZIN_PRODUCTIE,VANDAAG_PIEK_BRON,VANDAAG_PIEK_PRODUCTIE,
  MORGEN_BRON,MORGEN_PRODUCTIE,VANDAAG_VERLEDEN_BRON,VANDAAG_VERLEDEN_PRODUCTIE,
  VANDAAG_MAX_BRON,VANDAAG_MAX_PRODUCTIE,NACHT_STANDALONE_BRON,NACHT_STANDALONE_PRODUCTIE
};
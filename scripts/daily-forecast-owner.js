"use strict";

/* Pure base-build owner voor de zichtbare zeven-dagenpresentatie.
 *
 * De bestaande dagen()-renderer blijft eigenaar van daily data, temperatuur,
 * weerbeeld, wind, klikgedrag en layout. Deze owner verplaatst uitsluitend de
 * finale gebruikerspresentatie naar die renderer en zijn bestaande week-CSS:
 * geen dubbele mm in de omschrijving, duidelijke kolomkoppen, lokale Vandaag-
 * semantiek en een consistente hoeveelheid zodra die werkelijk beschikbaar is. */

const DAGEN_HAAK="function dagen(){\n";
const HELPER_PRODUCTIE=`function weatherNowDagNeerslagTekst(kans,som){
  const k=eindigGetal(kans);
  if(k===null)return "–";
  return Math.round(clamp(k,0,100))+"%";
}
function weatherNowDagNeerslagMmTekst(som){
  const mm=eindigGetal(som);
  if(mm===null||mm<0)return "";
  if(mm===0)return "0,0 mm";
  if(mm<0.1)return "<0,1 mm";
  return nl(mm)+" mm";
}
function weatherNowLokaleDatumSleutel(){
  const nu=typeof plaatsNu==="function"?plaatsNu():new Date();
  if(!(nu instanceof Date)||!Number.isFinite(nu.getTime()))return null;
  return nu.getFullYear()+"-"+String(nu.getMonth()+1).padStart(2,"0")+"-"+String(nu.getDate()).padStart(2,"0");
}
function weatherNowDagNaam(datum,volledig){
  const sleutel=String(datum||"").slice(0,10),dt=new Date(sleutel+"T12:00:00");
  if(!sleutel||!Number.isFinite(dt.getTime()))return "–";
  const nr=dt.getDate();
  if(sleutel===weatherNowLokaleDatumSleutel())return volledig?"Vandaag "+nr:"Vandaag";
  return (volledig?DAGENVOL[dt.getDay()]:DAGEN[dt.getDay()])+" "+nr;
}
function dagen(){
`;

const DCOND_BRON='      <div class="dcond">${code===null?"Verwachting niet beschikbaar":txt(code)}${som!==null&&som>0.5?", "+nl(som)+" mm":""}</div>\n';
const DCOND_PRODUCTIE='      <div class="dcond">${code===null?"Verwachting niet beschikbaar":txt(code)}</div>\n';

const KANS_BRON='    const kans=eindigGetal(day.precipitation_probability_max&&day.precipitation_probability_max[i]);\n';
const KANS_PRODUCTIE='    const kans=eindigGetal(day.precipitation_probability_max&&day.precipitation_probability_max[i]);\n    const neerslagTekst=weatherNowDagNeerslagTekst(kans,som);\n    const neerslagMmTekst=weatherNowDagNeerslagMmTekst(som);\n';

const DRAIN_BRON='      <div class="drain">${kans===null?"–":Math.round(clamp(kans,0,100))+"%"}${\n        som!==null&&som>0.5?`<small>${nl(som)} mm</small>`:""}</div></div>`;\n';
const DRAIN_PRODUCTIE='      <div class="drain">${neerslagTekst}${\n        neerslagMmTekst?`<small>${neerslagMmTekst}</small>`:""}</div></div>`;\n';

const DAGNAAM_BRON='    const lang=DAGENVOL[dt.getDay()]+" "+nr;\n    const kort=DAGEN[dt.getDay()]+" "+nr;\n';
const DAGNAAM_PRODUCTIE='    const lang=weatherNowDagNaam(t,true);\n    const kort=weatherNowDagNaam(t,false);\n';

const KOP_BRON='      <div class="dwind">Wind max</div><div class="dmin">Min</div><div class="bar"></div><div class="dmax">Max</div>\n      <div class="drain">Kans</div></div>`;\n';
const KOP_PRODUCTIE='      <div class="dwind">Wind max</div><div class="dmin">Min</div><div class="bar">Bereik</div><div class="dmax">Max</div>\n      <div class="drain">Neerslag</div></div>`;\n';

const KOP_CSS_BRON='  .row.kop .bar,.row.kop .sbar{background:none}\n';
const KOP_CSS_PRODUCTIE='  .row.kop .bar,.row.kop .sbar{background:none}\n  .row.day.kop .bar{text-align:center}\n';

function getal(v){return v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;}
function dagNeerslagTekst(kans,som){
  const k=getal(kans);
  if(k===null)return "–";
  return Math.round(Math.max(0,Math.min(100,k)))+"%";
}
function dagNeerslagMmTekst(som){
  const mm=getal(som);
  if(mm===null||mm<0)return "";
  if(mm===0)return "0,0 mm";
  if(mm<0.1)return "<0,1 mm";
  return String(Math.round(mm*10)/10).replace(".",",")+" mm";
}
function dagNaam(datum,volledig,vandaagSleutel){
  const sleutel=String(datum||"").slice(0,10),dt=new Date(sleutel+"T12:00:00");
  if(!sleutel||!Number.isFinite(dt.getTime()))return "–";
  const nr=dt.getDate();
  if(sleutel===String(vandaagSleutel||""))return volledig?"Vandaag "+nr:"Vandaag";
  const kort=["zo","ma","di","wo","do","vr","za"],lang=["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"];
  return (volledig?lang[dt.getDay()]:kort[dt.getDay()])+" "+nr;
}

function vervangEen(html,bron,productie,label){
  const aantal=html.split(bron).length-1;
  if(aantal!==1)throw new Error(label+" ontbreekt of is dubbel: "+aantal+" keer gevonden.");
  return html.replace(bron,productie);
}

function pasDailyForecastOwnerToe(html){
  let uit=String(html||"");
  if(uit.includes("function weatherNowDagNeerslagTekst(kans,som){"))
    throw new Error("Daily-forecast owner staat al in het aangeleverde artifact.");
  uit=vervangEen(uit,DAGEN_HAAK,HELPER_PRODUCTIE,"dagen()-ownerhaak");
  uit=vervangEen(uit,KANS_BRON,KANS_PRODUCTIE,"dagelijkse neerslagtekst-input");
  uit=vervangEen(uit,DCOND_BRON,DCOND_PRODUCTIE,"weekomschrijving zonder dubbele mm");
  uit=vervangEen(uit,DRAIN_BRON,DRAIN_PRODUCTIE,"weekneerslagcel");
  uit=vervangEen(uit,DAGNAAM_BRON,DAGNAAM_PRODUCTIE,"lokale dagnaam");
  uit=vervangEen(uit,KOP_BRON,KOP_PRODUCTIE,"weekverwachting-koppen");
  uit=vervangEen(uit,KOP_CSS_BRON,KOP_CSS_PRODUCTIE,"Bereik-kopuitlijning");
  return uit;
}

module.exports={
  dagNeerslagTekst,dagNeerslagMmTekst,dagNaam,pasDailyForecastOwnerToe,
  DAGEN_HAAK,HELPER_PRODUCTIE,
  DCOND_BRON,DCOND_PRODUCTIE,KANS_BRON,KANS_PRODUCTIE,
  DRAIN_BRON,DRAIN_PRODUCTIE,DAGNAAM_BRON,DAGNAAM_PRODUCTIE,KOP_BRON,KOP_PRODUCTIE,
  KOP_CSS_BRON,KOP_CSS_PRODUCTIE
};

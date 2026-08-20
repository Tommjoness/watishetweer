"use strict";

/* Pure base-build owner voor de zichtbare zeven-dagenpresentatie.
 *
 * De bestaande dagen()-renderer blijft eigenaar van daily data, temperatuur,
 * weerbeeld, wind, klikgedrag en layout. Deze owner verplaatst uitsluitend de
 * al bestaande finale UI-polish-uitkomst naar die renderer zelf: geen dubbele
 * mm in de omschrijving, de koppen "Bereik" en "Neerslag", en "Droog" bij een
 * verwaarloosbare kans/hoeveelheid. */

const DAGEN_HAAK="function dagen(){\n";
const HELPER_PRODUCTIE=`function weatherNowDagNeerslagTekst(kans,som){
  const k=eindigGetal(kans),mm=eindigGetal(som);
  if(k===null)return "–";
  const pct=Math.round(clamp(k,0,100));
  if(pct<10&&(mm===null||mm<0.1))return "Droog";
  return pct+"%";
}
function dagen(){
`;

const DCOND_BRON='      <div class="dcond">${code===null?"Verwachting niet beschikbaar":txt(code)}${som!==null&&som>0.5?", "+nl(som)+" mm":""}</div>\n';
const DCOND_PRODUCTIE='      <div class="dcond">${code===null?"Verwachting niet beschikbaar":txt(code)}</div>\n';

const KANS_BRON='    const kans=eindigGetal(day.precipitation_probability_max&&day.precipitation_probability_max[i]);\n';
const KANS_PRODUCTIE='    const kans=eindigGetal(day.precipitation_probability_max&&day.precipitation_probability_max[i]);\n    const neerslagTekst=weatherNowDagNeerslagTekst(kans,som);\n';

const DRAIN_BRON='      <div class="drain">${kans===null?"–":Math.round(clamp(kans,0,100))+"%"}${\n        som!==null&&som>0.5?`<small>${nl(som)} mm</small>`:""}</div></div>`;\n';
const DRAIN_PRODUCTIE='      <div class="drain">${neerslagTekst}${\n        som!==null&&som>0.5?`<small>${nl(som)} mm</small>`:""}</div></div>`;\n';

const KOP_BRON='      <div class="dwind">Wind max</div><div class="dmin">Min</div><div class="bar"></div><div class="dmax">Max</div>\n      <div class="drain">Kans</div></div>`;\n';
const KOP_PRODUCTIE='      <div class="dwind">Wind max</div><div class="dmin">Min</div><div class="bar">Bereik</div><div class="dmax">Max</div>\n      <div class="drain">Neerslag</div></div>`;\n';

function dagNeerslagTekst(kans,som){
  const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
  const k=getal(kans),mm=getal(som);
  if(k===null)return "–";
  const pct=Math.round(Math.max(0,Math.min(100,k)));
  if(pct<10&&(mm===null||mm<0.1))return "Droog";
  return pct+"%";
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
  uit=vervangEen(uit,KOP_BRON,KOP_PRODUCTIE,"weekverwachting-koppen");
  return uit;
}

module.exports={
  dagNeerslagTekst,pasDailyForecastOwnerToe,
  DAGEN_HAAK,HELPER_PRODUCTIE,
  DCOND_BRON,DCOND_PRODUCTIE,KANS_BRON,KANS_PRODUCTIE,
  DRAIN_BRON,DRAIN_PRODUCTIE,KOP_BRON,KOP_PRODUCTIE
};
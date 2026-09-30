"use strict";

/*
 * Klimaatblok per plaatspagina: gemiddelden 1991–2020 van het dichtstbijzijnde
 * KNMI-station met een volledige reeks (scripts/data/knmi-klimaatnormalen-1991-2020.json,
 * gegenereerd door scripts/genereer-knmi-klimaatnormalen.js). Dit is statische,
 * gemeten achtergrondinformatie; het raakt de actuele weerdata niet.
 */

const NORMALEN=require("./data/knmi-klimaatnormalen-1991-2020.json");

const MAANDEN=Object.freeze(["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"]);
const MAANDEN_KORT=Object.freeze(["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"]);
/* Verder dan dit is een station geen eerlijke referentie meer voor de plaats. */
const MAX_STATION_KM=60;

function afstandKm(a,b){
  const rad=v=>Number(v)*Math.PI/180;
  const dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 2*6371*Math.asin(Math.min(1,Math.sqrt(h)));
}

function dichtstbijzijndStation(loc){
  let beste=null;
  for(const st of NORMALEN.stations){
    const km=afstandKm(loc,st);
    if(!beste||km<beste.km||(km===beste.km&&st.code<beste.station.code))beste={station:st,km};
  }
  if(!beste||beste.km>MAX_STATION_KM)return null;
  return beste;
}

function getal(v,decimalen=0){
  return Number(v).toFixed(decimalen).replace(".",",").replace("-","−");
}
function esc(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

function samenvatting(loc,ref){
  const m=ref.station.maanden;
  const warmste=m.reduce((b,x,i)=>x.tx>m[b].tx?i:b,0),koudste=m.reduce((b,x,i)=>x.tn<m[b].tn?i:b,0);
  const natste=m.reduce((b,x,i)=>x.neerslag>m[b].neerslag?i:b,0),zonnigste=m.reduce((b,x,i)=>x.zon>m[b].zon?i:b,0);
  const jaarNeerslag=m.reduce((s,x)=>s+x.neerslag,0),jaarZon=m.reduce((s,x)=>s+x.zon,0),jaarRegendagen=m.reduce((s,x)=>s+x.regendagen,0);
  return {warmste,koudste,natste,zonnigste,jaarNeerslag,jaarZon,jaarRegendagen,
    tekst:`In ${loc.naam} is ${MAANDEN[warmste]} gemiddeld de warmste maand, met overdag ${getal(m[warmste].tx,1)} °C. `
      +`In ${MAANDEN[koudste]} zakt de temperatuur 's nachts gemiddeld naar ${getal(m[koudste].tn,1)} °C. `
      +`Per jaar valt ongeveer ${getal(jaarNeerslag)} mm neerslag, verspreid over zo'n ${getal(jaarRegendagen)} dagen met minstens 1 mm; ${MAANDEN[natste]} is gemiddeld de natste maand. `
      +`De zon schijnt ongeveer ${getal(jaarZon)} uur per jaar, het meest in ${MAANDEN[zonnigste]}.`};
}

function klimaatHtml(loc){
  const ref=dichtstbijzijndStation(loc);
  if(!ref)return "";
  const s=samenvatting(loc,ref),km=Math.round(ref.km);
  const bron=km<=2?`KNMI-station ${ref.station.naam}`:`KNMI-station ${ref.station.naam}, op ${km} km`;
  const rijen=ref.station.maanden.map((m,i)=>`<tr><th scope="row"><abbr title="${MAANDEN[i]}">${MAANDEN_KORT[i]}</abbr></th><td>${getal(m.tx,1)}</td><td>${getal(m.tn,1)}</td><td>${getal(m.neerslag)}</td><td>${getal(m.regendagen)}</td><td>${getal(m.zon)}</td></tr>`).join("");
  return `<div class="seo-klimaat" data-knmi-station="${ref.station.code}">
    <h3 class="seo-klimaat-kop">Klimaat in ${esc(loc.naam)}</h3>
    <p>${esc(s.tekst)}</p>
    <div class="seo-klimaat-tabel"><table>
      <caption>Gemiddelden per maand, ${ref.station.jaren.van}–${ref.station.jaren.tot} (${esc(bron)})</caption>
      <thead><tr><th scope="col">Maand</th><th scope="col"><abbr title="gemiddelde hoogste temperatuur per dag">Max °C</abbr></th><th scope="col"><abbr title="gemiddelde laagste temperatuur per dag">Min °C</abbr></th><th scope="col"><abbr title="neerslag per maand in millimeter">Neerslag (mm)</abbr></th><th scope="col"><abbr title="dagen met minstens 1 mm neerslag">Regen&shy;dagen</abbr></th><th scope="col"><abbr title="uren zonneschijn per maand">Zon (uur)</abbr></th></tr></thead>
      <tbody>${rijen}</tbody>
    </table></div>
    <p class="seo-klimaat-bron">Berekend uit de daggegevens van het KNMI. Klimaatgemiddelden beschrijven het normale weer en zijn geen verwachting.</p>
  </div>`;
}

const KLIMAAT_CSS=`.seo-klimaat{margin-top:16px}.seo-klimaat-kop{font-family:var(--serif);font-weight:500;font-size:16px;color:var(--ink);margin:0 0 6px}.seo-klimaat-tabel{overflow-x:auto;margin-top:10px;max-width:640px}.seo-klimaat table{border-collapse:collapse;width:100%;font-size:12px;font-variant-numeric:tabular-nums;color:var(--ink-70)}.seo-klimaat caption{text-align:left;font-size:12px;color:var(--ink-70);padding-bottom:6px}.seo-klimaat th,.seo-klimaat td{padding:4px 5px;border-bottom:1px solid var(--rule);text-align:right;white-space:nowrap}.seo-klimaat thead th{white-space:normal;vertical-align:bottom;line-height:1.25}.seo-klimaat th[scope=row],.seo-klimaat thead th:first-child{text-align:left}.seo-klimaat thead th{font-weight:600;color:var(--ink)}.seo-klimaat abbr{text-decoration:none}.seo-klimaat p.seo-klimaat-bron{font-size:12px;margin-top:8px}`;

module.exports={NORMALEN,MAANDEN,MAX_STATION_KM,afstandKm,dichtstbijzijndStation,samenvatting,klimaatHtml,KLIMAAT_CSS};

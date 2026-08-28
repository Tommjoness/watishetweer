/* Finale productwaarheid 2026-08-28.
 *
 * Deze laag draait na de bestaande inhoudelijke owners en verandert geen brondata.
 * Hij maakt de laatste consumentencopy preciezer, gebruikt actuele wolkenlagen en
 * voorkomt dat een neerslagpercentage als onweers- of hagelkans wordt uitgelegd.
 */
(function(root){
"use strict";

const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const pct=v=>{const n=getal(v);return n===null||n<0||n>100?null:n;};

function bewolkingMetLagen(totaal,laag,midden,hoog,isDag){
  const t=pct(totaal),l=pct(laag),m=pct(midden),h=pct(hoog);
  if(t===null)return null;
  const lm=Math.max(l===null?0:l,m===null?0:m);
  const heeftLagen=l!==null||m!==null||h!==null;
  if(heeftLagen&&lm>=70)return {tekst:"Zwaar bewolkt",code:3};
  if(heeftLagen&&h!==null&&h>=40&&h>=lm+15){
    return {tekst:h>=70?"Veel hoge bewolking":"Hoge bewolking",code:h>=70?2:1};
  }
  if(t>=95)return {tekst:"Vrijwel geheel bewolkt",code:3};
  if(t>=70)return {tekst:"Veel bewolking",code:2};
  if(t>=40)return {tekst:"Half bewolkt",code:2};
  if(t>=15)return {tekst:isDag===false?"Overwegend helder":"Overwegend zonnig",code:1};
  return {tekst:"Vrijwel onbewolkt",code:0};
}

function temperatuurTrendPresentatie(vanRuw,naarRuw,vanAfgerond,naarAfgerond){
  const a=getal(vanRuw),b=getal(naarRuw),va=getal(vanAfgerond),na=getal(naarAfgerond);
  if(a===null||b===null||va===null||na===null)return null;
  if(va===na){
    return {
      compact:true,
      waarde:String(va),
      tekst:a===b?"Blijft "+va+" °C.":"Blijft rond "+va+" °C."
    };
  }
  return {
    compact:false,
    waarde:String(va)+" → "+String(na),
    tekst:na>va?"Het wordt de komende uren warmer.":"Het wordt de komende uren koeler."
  };
}

function vereenvoudigMorgenMaximumHtml(html){
  let t=String(html||"");
  const vervang=(_m,v)=>"Morgen wordt het ongeveer <b>"+v+" graden</b>.";
  t=t.replace(/Het verwachte maximum ligt morgen rond \d{2}:\d{2} op <b>(-?\d+)(?:\s|&nbsp;|\u00a0)+graden<\/b>\./i,vervang);
  t=t.replace(/Het verwachte maximum voor morgen is <b>(-?\d+)(?:\s|&nbsp;|\u00a0)+graden<\/b>\./i,vervang);
  t=t.replace(/Morgen wordt het rond \d{2}:\d{2} het warmst, met maximaal <b>(-?\d+)(?:\s|&nbsp;|\u00a0)+graden<\/b>\./i,vervang);
  return t;
}

function uvPiekTekst(oudeTekst,waarde){
  const t=String(oudeTekst||"").trim(),v=String(waarde==null?"":waarde).trim();
  let m=/^Verwachte UV-piek\s+lag rond (\d{2}:\d{2}) · ([^.]+)\.$/i.exec(t);
  if(m&&v)return "UV-piek vandaag: "+v+" ("+m[2]+"), rond "+m[1]+".";
  m=/^Verwachte UV-piek\s+rond (\d{2}:\d{2}) · ([^.]+)\.$/i.exec(t);
  if(m&&v)return "Verwachte UV-piek vandaag: "+v+" ("+m[2]+"), rond "+m[1]+".";
  return t;
}

function zonurenTekst(uur){
  const n=getal(uur);if(n===null||n<0)return null;
  const afgerond=Math.round(n*10)/10;
  const getalNl=String(afgerond).replace(".",",");
  return "Voor vandaag is "+getalNl+" uur zon berekend.";
}

function daglengteTekst(tekst){
  const t=String(tekst||"").trim();
  let m=/^(\d+) uur en (\d+) minuten? daglicht$/i.exec(t);
  if(m)return "Daglengte "+m[1]+" u "+m[2]+" min";
  m=/^(\d+) uur daglicht$/i.exec(t);
  if(m)return "Daglengte "+m[1]+" u";
  return t;
}

function onweerDagTekst(code){
  const c=getal(code);
  if(c===95)return "Onweer mogelijk";
  if(c===96)return "Onweer mogelijk, lokaal hagel";
  if(c===99)return "Zwaar onweer mogelijk, lokaal hagel";
  return null;
}

const api={
  bewolkingMetLagen,temperatuurTrendPresentatie,vereenvoudigMorgenMaximumHtml,
  uvPiekTekst,zonurenTekst,daglengteTekst,onweerDagTekst,
  toonSeoPlaatsnav:()=>{}
};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowFinalProductTruth=api;

if(typeof document==="undefined"||typeof S==="undefined")return;

function pasBewolkingToe(){
  const c=S.d&&S.d.current;if(!c)return;
  const oordeel=bewolkingMetLagen(c.cloud_cover,c.cloud_cover_low,c.cloud_cover_mid,c.cloud_cover_high,c.is_day!==0);
  if(!oordeel)return;
  const sub=document.getElementById("cloudsub");if(sub)sub.textContent=oordeel.tekst+".";
  const code=getal(c.weather_code),alleenBewolking=code!==null&&code>=0&&code<=3;
  if(!alleenBewolking)return;
  const cond=document.getElementById("cond"),mini=document.getElementById("minicond"),icoon=document.getElementById("nowicon");
  if(cond)cond.textContent=oordeel.tekst;
  if(mini){mini.textContent=oordeel.tekst.toLowerCase();mini.title=oordeel.tekst.toLowerCase();}
  if(icoon&&typeof icon==="function")icoon.innerHTML=icon(oordeel.code,c.is_day===1,46);
}

function pasTemperatuurTrendToe(){
  const q1=root.WeatherNowQ1;if(!q1||typeof q1.temperatuurTrend!=="function"||!S.d)return;
  const nu=S.klokInstantOverride&&typeof S.klokInstantOverride.getTime==="function"?S.klokInstantOverride.getTime():Date.now();
  const trend=q1.temperatuurTrend(S.d,nu);if(!trend||!trend.genoeg)return;
  const h=S.d.hourly||{},i=Array.isArray(h.time)?h.time.indexOf(trend.puntTijd):-1;
  const vanRuw=getal(S.d.current&&S.d.current.temperature_2m),naarRuw=i>=0&&Array.isArray(h.temperature_2m)?getal(h.temperature_2m[i]):null;
  const p=temperatuurTrendPresentatie(vanRuw,naarRuw,trend.van,trend.naar);if(!p)return;
  const waarde=document.getElementById("prec"),sub=document.getElementById("precsub");
  if(waarde)waarde.innerHTML=p.waarde+"<s>°C</s>";
  if(sub)sub.textContent=p.tekst;
}

function pasUvToe(){
  const sub=document.getElementById("uvsub"),val=document.getElementById("uv");if(!sub||!val)return;
  const nieuw=uvPiekTekst(sub.textContent,val.textContent);if(nieuw)sub.textContent=nieuw;
}

function pasZonurenToe(){
  const stat=document.querySelector(".stat.zon"),val=stat&&stat.querySelector(".sval"),sub=stat&&stat.querySelector(".ssub");
  if(!val||!sub)return;
  const m=/(-?\d+(?:[.,]\d+)?)/.exec(String(val.textContent||""));if(!m)return;
  const t=zonurenTekst(Number(m[1].replace(",",".")));if(t)sub.textContent=t;
}

function pasMorgenBriefingToe(){
  const el=document.getElementById("brief");if(!el)return;
  const nieuw=vereenvoudigMorgenMaximumHtml(el.innerHTML);if(nieuw!==el.innerHTML)el.innerHTML=nieuw;
}

function pasDaglengteToe(){
  document.querySelectorAll("#suntimes .zonregel > span:not(.zondag)").forEach(el=>{
    const nieuw=daglengteTekst(el.textContent);if(nieuw!==el.textContent.trim())el.textContent=nieuw;
  });
}

function pasDagenToe(){
  const uitleg=document.getElementById("dagenneerslaguitleg");if(uitleg)uitleg.remove();
  document.querySelectorAll("#days .dag-neerslagnotitie").forEach(el=>el.remove());
  const daily=S.d&&S.d.daily||{};
  document.querySelectorAll("#days .row.day:not(.kop)").forEach(rij=>{
    const mm=rij.querySelector(".q1-dag-mm");
    if(mm&&String(mm.textContent||"").trim()==="0,0 mm"){
      mm.textContent="geen meetbare hoeveelheid";
      mm.title="Geen meetbare hoeveelheid berekend.";
    }
    const i=Number(rij.dataset.i),code=Array.isArray(daily.weather_code)?daily.weather_code[i]:null;
    const onweer=onweerDagTekst(code),cond=rij.querySelector(".dcond");
    if(onweer&&cond)cond.textContent=onweer;
  });
}

function toonSeoPlaatsnav(){
  const nav=document.querySelector(".seo-plaatsnav");if(!nav)return;
  nav.classList.add("weer-klaar");
  nav.removeAttribute("aria-hidden");
}
api.toonSeoPlaatsnav=toonSeoPlaatsnav;

/* Een presentatiecorrectie mag nooit de bewezen kernrender blokkeren. Bij een
   onverwachte DOM-vorm blijft de bestaande owner dus zichtbaar en gaat de rest
   van de pagina gewoon door. De helpertests bewaken los de inhoudelijke regels. */
function veilig(fn){try{fn();}catch(e){if(root&&root.console&&typeof root.console.warn==="function")root.console.warn("final-product-truth",e);}}

if(typeof meters==="function"){
  const basisMetersFinalTruth=meters;
  meters=function(){const r=basisMetersFinalTruth.apply(this,arguments);veilig(pasBewolkingToe);veilig(pasTemperatuurTrendToe);veilig(pasUvToe);veilig(pasZonurenToe);return r;};
}
if(typeof briefing==="function"){
  const basisBriefingFinalTruth=briefing;
  briefing=function(){const r=basisBriefingFinalTruth.apply(this,arguments);veilig(pasMorgenBriefingToe);return r;};
}
if(typeof etmaal==="function"){
  const basisEtmaalFinalTruth=etmaal;
  etmaal=function(){const r=basisEtmaalFinalTruth.apply(this,arguments);veilig(pasDaglengteToe);return r;};
}
if(typeof dagen==="function"){
  const basisDagenFinalTruth=dagen;
  dagen=function(){const r=basisDagenFinalTruth.apply(this,arguments);veilig(pasDagenToe);return r;};
}

})(typeof globalThis!=="undefined"?globalThis:this);

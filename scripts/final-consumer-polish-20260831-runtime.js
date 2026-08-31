/* Finale consumentencopy + zonnecyclus 2026-08-31.
   Deze runtime corrigeert uitsluitend presentatie. Providerdata, forecastformules,
   neerslagbeleid en astronomische bronwaarden blijven onaangeraakt. */
(function(root){
"use strict";

const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const pad2=n=>String(n).padStart(2,"0");

function parseLokaleIso(iso){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(iso||""));
  return m?{jaar:+m[1],maand:+m[2],dag:+m[3],uur:+m[4],minuut:+m[5],seconde:+(m[6]||0)}:null;
}
function datumUitDelen(p){return p?`${p.jaar}-${pad2(p.maand)}-${pad2(p.dag)}`:null;}
function datumPlus(datum,dagen){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum||""));if(!m)return null;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+Number(dagen||0)));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;
}
function zoneDelen(ms,tijdzone){
  if(!tijdzone||typeof Intl==="undefined"||!Intl.DateTimeFormat)return null;
  try{
    const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:tijdzone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
    const p=Object.fromEntries(fmt.formatToParts(new Date(ms)).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
    return {jaar:+p.year,maand:+p.month,dag:+p.day,uur:+p.hour,minuut:+p.minute,seconde:+p.second};
  }catch(_){return null;}
}
function zoneOffsetMs(ms,tijdzone){
  const p=zoneDelen(ms,tijdzone);if(!p)return null;
  const heel=Math.floor(ms/1000)*1000;
  return Date.UTC(p.jaar,p.maand-1,p.dag,p.uur,p.minuut,p.seconde)-heel;
}
function lokaleIsoNaarUtcMs(iso,tijdzone,utcOffsetSeconden){
  const p=parseLokaleIso(iso);if(!p)return null;
  const doel=Date.UTC(p.jaar,p.maand-1,p.dag,p.uur,p.minuut,p.seconde);
  if(tijdzone){
    let gok=doel;
    for(let i=0;i<3;i++){
      const off=zoneOffsetMs(gok,tijdzone);if(off===null)break;
      gok=doel-off;
    }
    if(Number.isFinite(gok))return gok;
  }
  const off=getal(utcOffsetSeconden);
  return off===null?doel:doel-off*1000;
}
function lokaleDatumNu(data,nuMs){
  const d=data||{},zone=zoneDelen(nuMs,d.timezone);
  if(zone)return datumUitDelen(zone);
  const off=getal(d.utc_offset_seconds)||0;
  return new Date(nuMs+off*1000).toISOString().slice(0,10);
}
function gebeurtenisGeldig(op,onder,waarde){
  if(!waarde||!parseLokaleIso(waarde))return false;
  /* Open-Meteo kan in poolscenario's identieke 00:00-sentinels leveren. Een
     echte zonsopkomst en zonsondergang op exact hetzelfde lokale tijdstip is
     geen bruikbare overgang en wordt daarom als sentinel behandeld. */
  if(op&&onder&&String(op)===String(onder))return false;
  return true;
}
function volgendZonmoment(data,nuMs=Date.now()){
  const d=data||{},day=d.daily||{},op=Array.isArray(day.sunrise)?day.sunrise:[],onder=Array.isArray(day.sunset)?day.sunset:[];
  const kandidaten=[];
  const n=Math.max(op.length,onder.length);
  for(let i=0;i<n;i++){
    const sr=op[i],ss=onder[i];
    if(gebeurtenisGeldig(sr,ss,sr)){
      const ms=lokaleIsoNaarUtcMs(sr,d.timezone,d.utc_offset_seconds);
      if(ms!==null&&ms>nuMs+500)kandidaten.push({type:"opkomst",iso:sr,ms});
    }
    if(gebeurtenisGeldig(sr,ss,ss)){
      const ms=lokaleIsoNaarUtcMs(ss,d.timezone,d.utc_offset_seconds);
      if(ms!==null&&ms>nuMs+500)kandidaten.push({type:"ondergang",iso:ss,ms});
    }
  }
  kandidaten.sort((a,b)=>a.ms-b.ms);
  return kandidaten[0]||null;
}
function zonPresentatie(data,nuMs=Date.now()){
  const d=data||{},event=volgendZonmoment(d,nuMs),vandaag=lokaleDatumNu(d,nuMs);
  if(event){
    const delta=Math.max(0,Math.ceil((event.ms-nuMs)/60000)),uren=Math.floor(delta/60),minuten=delta%60;
    const datum=String(event.iso).slice(0,10),morgen=datumPlus(vandaag,1);
    let daglabel=datum===vandaag?"Vandaag":datum===morgen?"Morgen":"";
    if(!daglabel){
      const p=parseLokaleIso(event.iso),tijdzone=d.timezone||"UTC";
      try{daglabel=new Intl.DateTimeFormat("nl-NL",{timeZone:tijdzone,weekday:"long"}).format(new Date(event.ms));}
      catch(_){daglabel=datum;}
      daglabel=daglabel.charAt(0).toUpperCase()+daglabel.slice(1);
    }
    const tijd=String(event.iso).slice(11,16);
    return {
      type:event.type,
      kop:event.type==="opkomst"?"Tijd tot zonsopkomst":"Tijd tot zonsondergang",
      uren,minuten,
      waardeTekst:uren>0?`${uren} u ${pad2(minuten)} min`:`${minuten} min`,
      sub:`${daglabel} om ${tijd}.`,
      aria:`${event.type==="opkomst"?"Zonsopkomst":"Zonsondergang"} over ${uren>0?uren+" uur en ":""}${minuten} minuten, ${daglabel.toLowerCase()} om ${tijd}.`
    };
  }
  const day=d.daily||{},heeftReeks=Array.isArray(day.sunrise)&&Array.isArray(day.sunset)&&Math.max(day.sunrise.length,day.sunset.length)>0;
  if(heeftReeks&&d.current&&Number.isFinite(Number(d.current.is_day))){
    const dag=Number(d.current.is_day)===1;
    return {type:dag?"pooldag":"poolnacht",kop:"Zonlicht",waardeTekst:dag?"Pooldag":"Poolnacht",sub:dag?"De zon gaat binnen de beschikbare verwachting niet onder.":"De zon komt binnen de beschikbare verwachting niet op.",aria:null};
  }
  return {type:"onbekend",kop:"Zonlicht",waardeTekst:"--",sub:"Zoninformatie niet beschikbaar.",aria:null};
}
function vochtigheidPresentatie(current){
  const c=current||{},rh=getal(c.relative_humidity_2m),dp=getal(c.dew_point_2m);
  if(rh===null||rh<0||rh>100)return "Luchtvochtigheid niet beschikbaar.";
  const basis=rh>=80?"Hoge luchtvochtigheid.":rh>=65?"Vochtige lucht.":rh<35?"Droge lucht.":rh<45?"Vrij droge lucht.":"Gemiddelde luchtvochtigheid.";
  return dp===null?basis:`${basis} Dauwpunt circa ${Math.round(dp)} °C.`;
}

const api={parseLokaleIso,datumPlus,zoneDelen,lokaleIsoNaarUtcMs,lokaleDatumNu,volgendZonmoment,zonPresentatie,vochtigheidPresentatie};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowFinalConsumerPolish20260831=api;

if(typeof document==="undefined"||typeof window==="undefined"||typeof S==="undefined")return;

function zetZontegel(){
  if(!S.d)return;
  const waarde=document.getElementById("gust"),sub=document.getElementById("gustsub"),stat=waarde&&waarde.closest(".stat"),kop=stat&&stat.querySelector(".eyebrow");
  if(!waarde||!sub||!kop)return;
  const p=zonPresentatie(S.d,Date.now());
  kop.textContent=p.kop;
  if(p.type==="opkomst"||p.type==="ondergang"){
    waarde.innerHTML=p.uren>0?`${p.uren}<s> u</s> ${pad2(p.minuten)}<s> min</s>`:`${p.minuten}<s> min</s>`;
  }else waarde.textContent=p.waardeTekst;
  sub.textContent=p.sub;
  if(p.aria)waarde.setAttribute("aria-label",p.aria);else waarde.removeAttribute("aria-label");
}
function zetVochtigheid(){
  if(!S.d||!S.d.current)return;
  const sub=document.getElementById("humsub");if(sub)sub.textContent=vochtigheidPresentatie(S.d.current);
}
function verfijnWeekKop(){
  const bereik=document.querySelector("#days .row.day.kop .bar");
  if(bereik)bereik.textContent="Temp.bereik";
}
function verfijnGrafiekTypografie(){
  if(window.innerWidth<1100)return;
  const svg=document.getElementById("chart");if(!svg)return;
  svg.querySelectorAll("text[font-size]").forEach(el=>{
    const fs=Number(el.getAttribute("font-size"));if(!Number.isFinite(fs)||fs<=0)return;
    const tekst=String(el.textContent||"").trim();
    const factor=/^-?\d+°$/.test(tekst)||/^nu\s+-?\d+°$/i.test(tekst)?0.80:0.88;
    el.setAttribute("font-size",String(Math.max(8,Math.round(fs*factor*10)/10)));
  });
  svg.dataset.desktopTypography="compact";
}
function herordeneerNeerslagContext(){
  const tekst=document.getElementById("nctext"),details=document.querySelector("details.data-uitleg");
  if(tekst&&details&&details.parentNode===tekst.parentNode&&details.nextElementSibling===tekst)details.before(tekst);
}

if(typeof meters==="function"){
  const basisMetersFinal=meters;
  meters=function(){const r=basisMetersFinal.apply(this,arguments);zetZontegel();zetVochtigheid();return r;};
}
if(typeof dagen==="function"){
  const basisDagenFinal=dagen;
  dagen=function(){const r=basisDagenFinal.apply(this,arguments);verfijnWeekKop();return r;};
}
if(typeof etmaal==="function"){
  const basisEtmaalFinal=etmaal;
  etmaal=function(){const r=basisEtmaalFinal.apply(this,arguments);verfijnGrafiekTypografie();return r;};
}

herordeneerNeerslagContext();
let zonTimer=null;
function startZonTimer(){
  if(zonTimer!==null)return;
  zonTimer=setInterval(()=>{zetZontegel();zetVochtigheid();},30000);
}
startZonTimer();
window.addEventListener("resize",()=>{if(S.d&&S.chartStart!=null&&S.chartBereik!=null&&typeof etmaal==="function")etmaal(S.chartStart,S.chartBereik);},{passive:true});

})(typeof globalThis!=="undefined"?globalThis:this);

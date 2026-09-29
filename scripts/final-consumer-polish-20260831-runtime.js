/* Finale consumentencopy + zonnecyclus 2026-08-31. */
(function(root){
"use strict";
const grammatica=typeof module!=="undefined"&&module.exports
  ?require("../nederlandse-weergrammatica.js")
  :root.WeatherNowNederlandseGrammatica;
const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const pad2=n=>String(n).padStart(2,"0");
function parseLokaleIso(iso){const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(iso||""));return m?{jaar:+m[1],maand:+m[2],dag:+m[3],uur:+m[4],minuut:+m[5],seconde:+(m[6]||0)}:null;}
function datumUitDelen(p){return p?`${p.jaar}-${pad2(p.maand)}-${pad2(p.dag)}`:null;}
function datumPlus(datum,dagen){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum||""));if(!m)return null;const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+Number(dagen||0)));return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;}
function zoneDelen(ms,tijdzone){if(!tijdzone||typeof Intl==="undefined"||!Intl.DateTimeFormat)return null;try{const fmt=new Intl.DateTimeFormat("en-CA",{timeZone:tijdzone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});const p=Object.fromEntries(fmt.formatToParts(new Date(ms)).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));return {jaar:+p.year,maand:+p.month,dag:+p.day,uur:+p.hour,minuut:+p.minute,seconde:+p.second};}catch(_){return null;}}
function zoneOffsetMs(ms,tijdzone){const p=zoneDelen(ms,tijdzone);if(!p)return null;const heel=Math.floor(ms/1000)*1000;return Date.UTC(p.jaar,p.maand-1,p.dag,p.uur,p.minuut,p.seconde)-heel;}
function lokaleIsoNaarUtcMs(iso,tijdzone,utcOffsetSeconden){const p=parseLokaleIso(iso);if(!p)return null;const doel=Date.UTC(p.jaar,p.maand-1,p.dag,p.uur,p.minuut,p.seconde);if(tijdzone){let gok=doel;for(let i=0;i<3;i++){const off=zoneOffsetMs(gok,tijdzone);if(off===null)break;gok=doel-off;}if(Number.isFinite(gok))return gok;}const off=getal(utcOffsetSeconden);return off===null?doel:doel-off*1000;}
function lokaleDatumNu(data,nuMs){const d=data||{},zone=zoneDelen(nuMs,d.timezone);if(zone)return datumUitDelen(zone);const off=getal(d.utc_offset_seconds)||0;return new Date(nuMs+off*1000).toISOString().slice(0,10);}
function gebeurtenisGeldig(op,onder,waarde){if(!waarde||!parseLokaleIso(waarde))return false;if(op&&onder&&String(op)===String(onder))return false;return true;}
function volgendZonmoment(data,nuMs=Date.now()){const d=data||{},day=d.daily||{},op=Array.isArray(day.sunrise)?day.sunrise:[],onder=Array.isArray(day.sunset)?day.sunset:[],kandidaten=[];const n=Math.max(op.length,onder.length);for(let i=0;i<n;i++){const sr=op[i],ss=onder[i];if(gebeurtenisGeldig(sr,ss,sr)){const ms=lokaleIsoNaarUtcMs(sr,d.timezone,d.utc_offset_seconds);if(ms!==null&&ms>nuMs+500)kandidaten.push({type:"opkomst",iso:sr,ms});}if(gebeurtenisGeldig(sr,ss,ss)){const ms=lokaleIsoNaarUtcMs(ss,d.timezone,d.utc_offset_seconds);if(ms!==null&&ms>nuMs+500)kandidaten.push({type:"ondergang",iso:ss,ms});}}kandidaten.sort((a,b)=>a.ms-b.ms);return kandidaten[0]||null;}
function zonPresentatie(data,nuMs=Date.now()){const d=data||{},event=volgendZonmoment(d,nuMs),vandaag=lokaleDatumNu(d,nuMs);if(event){const delta=Math.max(0,Math.ceil((event.ms-nuMs)/60000)),uren=Math.floor(delta/60),minuten=delta%60;const datum=String(event.iso).slice(0,10),morgen=datumPlus(vandaag,1);let daglabel=datum===vandaag?"Vandaag":datum===morgen?"Morgen":"";if(!daglabel){try{daglabel=new Intl.DateTimeFormat("nl-NL",{timeZone:d.timezone||"UTC",weekday:"long"}).format(new Date(event.ms));}catch(_){daglabel=datum;}daglabel=daglabel.charAt(0).toUpperCase()+daglabel.slice(1);}const tijd=String(event.iso).slice(11,16);const lang=grammatica&&typeof grammatica.duur==="function"?grammatica.duur(uren,minuten):(uren>0?uren+" uur en ":"")+minuten+" minuten";const kort=grammatica&&typeof grammatica.duurKort==="function"?grammatica.duurKort(uren,minuten):(uren>0?`${uren} u ${pad2(minuten)} min`:`${minuten} min`);return {type:event.type,kop:event.type==="opkomst"?"Tijd tot zonsopkomst":"Tijd tot zonsondergang",uren,minuten,waardeTekst:kort,sub:`${daglabel} om ${tijd}.`,aria:`${event.type==="opkomst"?"Zonsopkomst":"Zonsondergang"} over ${lang}, ${daglabel.toLowerCase()} om ${tijd}.`};}const day=d.daily||{},heeftReeks=Array.isArray(day.sunrise)&&Array.isArray(day.sunset)&&Math.max(day.sunrise.length,day.sunset.length)>0;if(heeftReeks&&d.current&&Number.isFinite(Number(d.current.is_day))){const dag=Number(d.current.is_day)===1;return {type:dag?"pooldag":"poolnacht",kop:"Zonlicht",waardeTekst:dag?"Pooldag":"Poolnacht",sub:dag?"De zon gaat binnen de beschikbare verwachting niet onder.":"De zon komt binnen de beschikbare verwachting niet op.",aria:null};}return {type:"onbekend",kop:"Zonlicht",waardeTekst:"--",sub:"Zoninformatie niet beschikbaar.",aria:null};}

/* De procentwaarde blijft relatieve luchtvochtigheid. De zin eronder
   beantwoordt in gewone taal wat een bezoeker wil weten: is het plakkerig of
   niet. Het woord dauwpunt staat er niet in; het dauwpunt bepaalt wel achter
   de schermen hoe plakkerig warme lucht voelt (vanaf 15 tot 16 °C wat, vanaf
   18 °C echt, vanaf 21 °C benauwd). Het wordt berekend uit dezelfde
   temperatuur en luchtvochtigheid als de tegel toont.
   De zin spreekt het percentage nooit tegen: vanaf 80% heet de lucht vochtig,
   vanaf 90% zeer vochtig, en nooit droog, fris of aangenaam; onder 30% is
   lucht niet plakkerig, behalve bij echt benauwde hitte. Bij kou (7 °C of
   lager) is plakkerigheid geen vraag en noemt de zin alleen koud en vochtig of
   droog. */
function vochtigheidPresentatie(current){
  const c=current||{},rh=getal(c.relative_humidity_2m),t=getal(c.temperature_2m);
  if(rh===null||rh<0||rh>100)return "Luchtvochtigheid niet beschikbaar.";
  let dp=getal(c.dew_point_2m);if(dp===null)dp=dauwpuntUit(t,rh);
  if(dp===null){
    if(rh>=90)return "Zeer vochtige lucht.";
    if(rh>=80)return "Vochtige lucht.";
    if(rh<40)return "Droge lucht.";
    return "Normale luchtvochtigheid.";
  }
  if(t!==null&&t<=7){const koud=t<=-15?"IJskoude":"Koude";return rh>=70?koud+", vochtige lucht.":rh>=50?koud+" lucht.":koud+", droge lucht.";}
  if(dp>=24)return "Zeer benauwd en plakkerig.";
  if(dp>=21)return "Benauwd en plakkerig.";
  if(rh>=30){
    if(dp>=18)return "Voelt plakkerig aan.";
    if(dp>=15&&(t===null||t>=18))return "Voelt wat plakkerig aan.";
  }
  if(rh>=90)return "Zeer vochtig, maar niet plakkerig.";
  if(rh>=80)return "Vochtig, maar niet plakkerig.";
  if(rh<30&&t!==null&&t>=30)return "Droge hitte, niet plakkerig.";
  if(rh<40&&dp<10)return "Droge lucht, niet plakkerig.";
  if(t!==null&&t>=28)return "Niet plakkerig.";
  if(dp>=10||(t!==null&&t>=18))return "Aangenaam, niet plakkerig.";
  return "Fris, niet plakkerig.";
}
/* Dauwpunt uit dezelfde actuele temperatuur en luchtvochtigheid als de tegel
   toont (Magnus, Alduchov en Eskridge 1996; boven water, zoals weermodellen
   het dauwpunt geven). Het uurdauwpunt hoort bij het begin van het uur of bij
   een later klokuur en kan dan niet passen bij het getoonde percentage; zo
   staan percentage, temperatuur en dauwpunt altijd in dezelfde verhouding. */
function dauwpuntUit(temp,rh){const t=getal(temp),v=getal(rh);if(t===null||v===null||v<=0||v>100)return null;const g=Math.log(v/100)+17.625*t/(243.04+t);return 243.04*g/(17.625-g);}
const api={parseLokaleIso,datumPlus,zoneDelen,lokaleIsoNaarUtcMs,lokaleDatumNu,volgendZonmoment,zonPresentatie,vochtigheidPresentatie,dauwpuntUit};if(typeof module!=="undefined"&&module.exports)module.exports=api;root.WeatherNowFinalConsumerPolish20260831=api;
if(typeof document==="undefined"||typeof window==="undefined"||typeof S==="undefined")return;
function zetZontegel(){if(!S.d)return;const waarde=document.getElementById("gust"),sub=document.getElementById("gustsub"),stat=waarde&&waarde.closest(".stat"),kop=stat&&stat.querySelector(".eyebrow");if(!waarde||!sub||!kop)return;const p=zonPresentatie(S.d,Date.now());kop.textContent=p.kop;if(p.type==="opkomst"||p.type==="ondergang")waarde.innerHTML=p.uren>0?`${p.uren}<s> u</s> ${pad2(p.minuten)}<s> min</s>`:`${p.minuten}<s> min</s>`;else waarde.textContent=p.waardeTekst;sub.textContent=p.sub;if(p.aria)waarde.setAttribute("aria-label",p.aria);else waarde.removeAttribute("aria-label");}
function zetVochtigheid(){if(!S.d||!S.d.current)return;const sub=document.getElementById("humsub");if(!sub)return;const h=S.d.hourly||{},i=Number.isInteger(S.i0)?S.i0:-1;const temp=getal(S.d.current.temperature_2m)!==null?getal(S.d.current.temperature_2m):(i>=0&&Array.isArray(h.temperature_2m)?getal(h.temperature_2m[i]):null);const dpUur=i>=0&&Array.isArray(h.dew_point_2m)?getal(h.dew_point_2m[i]):null,dpNu=dauwpuntUit(temp,S.d.current.relative_humidity_2m);const dp=dpNu!==null?dpNu:dpUur;const input=Object.assign({},S.d.current,{dew_point_2m:dp,temperature_2m:temp});sub.textContent=vochtigheidPresentatie(input);}
function verfijnWeekKop(){const bereik=document.querySelector("#days .row.day.kop .bar");if(bereik)bereik.textContent="Temp.bereik";}
/* Tussen 431 en 759px tekent de mobiele grafiek op haar werkelijke breedte in
   plaats van 1,5 tot 1,9 keer opgeschaald; cijfers en tijden worden daar dus
   nauwelijks verkleind, zodat ze even groot zijn als op desktop. */
function verfijnGrafiekTypografie(){const svg=document.getElementById("chart");if(!svg)return;const mobiel=window.innerWidth<760;svg.querySelectorAll("text[font-size]").forEach(el=>{const fs=Number(el.getAttribute("font-size"));if(!Number.isFinite(fs)||fs<=0)return;const tekst=String(el.textContent||"").trim();const temp=/^-?\d+°$/.test(tekst)||/^nu\s+-?\d+°$/i.test(tekst);const telefoon=window.innerWidth<=430,factor=temp?(telefoon?0.72:mobiel?0.94:window.innerWidth<1100?0.78:0.80):(telefoon?0.84:mobiel?0.92:0.88);el.setAttribute("font-size",String(Math.max(7.5,Math.round(fs*factor*10)/10)));if(temp){el.setAttribute("opacity",mobiel?"0.76":"0.82");if(el.hasAttribute("stroke-width"))el.setAttribute("stroke-width",mobiel?"2":"2.4");}});svg.querySelectorAll("circle[data-temp-index]").forEach(el=>el.removeAttribute("opacity"));svg.dataset.desktopTypography=mobiel?"calm-mobile":"compact";}
function attribuutGetal(el,naam){const n=Number(el&&el.getAttribute&&el.getAttribute(naam));return Number.isFinite(n)?n:null;}
function grafiekTemperatuurBox(el){const x=attribuutGetal(el,"x"),y=attribuutGetal(el,"y"),fs=attribuutGetal(el,"font-size"),tekst=String(el&&el.textContent||"").trim();if(x===null||y===null||fs===null)return null;return {el,x,y,fs,tekst,w:Math.max(fs*1.7,tekst.length*fs*.56),h:fs*1.15};}
function verfijnGrafiekLabelPosities(){
  const svg=document.getElementById("chart");if(!svg)return;
  const mobiel=window.innerWidth<760;
  const alleTemp=Array.from(svg.querySelectorAll('text[text-anchor="middle"][font-size]')).filter(el=>/^(?:nu\s+)?-?\d+°$/i.test(String(el.textContent||"").trim())).map(grafiekTemperatuurBox).filter(Boolean);
  const modelLabels=alleTemp.filter(b=>!/^[Nn]u\s/.test(b.tekst));
  const cirkels=Array.from(svg.querySelectorAll("circle[data-temp-index]")).map(el=>({el,x:attribuutGetal(el,"cx"),y:attribuutGetal(el,"cy")})).filter(c=>c.x!==null&&c.y!==null);
  if(!modelLabels.length||!cirkels.length)return;
  const gebruikt=new Set(),paren=[];
  for(const label of modelLabels){
    let beste=null,besteScore=Infinity;
    for(const c of cirkels){
      if(gebruikt.has(c.el))continue;
      const dx=Math.abs(label.x-c.x),dy=Math.abs(label.y-c.y);
      if(dx>(mobiel?18:24)||dy>(mobiel?48:54))continue;
      const score=dx*2+dy;if(score<besteScore){beste=c;besteScore=score;}
    }
    if(!beste)continue;gebruikt.add(beste.el);paren.push({label,cirkel:beste});
  }
  const boxes=alleTemp.map(b=>({...b}));
  for(const paar of paren){
    const box=boxes.find(b=>b.el===paar.label.el),c=paar.cirkel;if(!box||box.y<c.y)continue;
    const bovengrens=mobiel?37:44,afstand=mobiel?13:14,stap=box.h+4;
    for(let laag=0;laag<3;laag++){
      const kandidaat=c.y-(afstand+laag*stap);if(kandidaat-box.h<bovengrens)continue;
      const botst=boxes.some(andere=>andere!==box&&Math.abs(andere.x-box.x)<(andere.w+box.w)/2+5&&Math.abs(andere.y-kandidaat)<Math.max(andere.h,box.h)+3);
      if(botst)continue;box.y=kandidaat;box.el.setAttribute("y",kandidaat.toFixed(1));break;
    }
  }
  svg.dataset.minimumLabels="above-when-free";
}
function herordeneerNeerslagContext(){const tekst=document.getElementById("nctext"),details=document.querySelector("details.data-uitleg");if(tekst&&details&&details.parentNode===tekst.parentNode&&details.nextElementSibling===tekst)details.before(tekst);}
if(typeof meters==="function"){const basisMetersFinal=meters;meters=function(){const r=basisMetersFinal.apply(this,arguments);zetZontegel();zetVochtigheid();return r;};}
if(typeof dagen==="function"){const basisDagenFinal=dagen;dagen=function(){const r=basisDagenFinal.apply(this,arguments);verfijnWeekKop();return r;};}
if(typeof etmaal==="function"){const basisEtmaalFinal=etmaal;etmaal=function(){const r=basisEtmaalFinal.apply(this,arguments);verfijnGrafiekTypografie();verfijnGrafiekLabelPosities();return r;};}
herordeneerNeerslagContext();let zonTimer=null;function startZonTimer(){if(zonTimer!==null)return;zonTimer=setInterval(()=>{zetZontegel();},30000);}startZonTimer();window.addEventListener("resize",()=>{if(S.d&&S.chartStart!=null&&S.chartBereik!=null&&typeof etmaal==="function")etmaal(S.chartStart,S.chartBereik);},{passive:true});
})(typeof globalThis!=="undefined"?globalThis:this);

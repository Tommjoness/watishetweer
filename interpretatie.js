(function(root,factory){
  const grammatica=typeof module==="object"&&module.exports
    ?require("./nederlandse-weergrammatica.js")
    :root&&root.WeatherNowNederlandseGrammatica;
  const api=factory(grammatica);
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.WeerInterpretatie=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(grammatica){
  "use strict";
  const CONFIG=Object.freeze({meetbaarMm:0.1,actueelMm:0.05,kansZeerKleinMax:19,kansKleinMax:39,kansMogelijkMax:69,volledigeDekking:0.9,minimaleDekking:0.5});
  const WMO_FAMILIE=Object.freeze({0:"helder",1:"helder",2:"halfbewolkt",3:"bewolkt",45:"mist",48:"ijzel",51:"regen",53:"regen",55:"regen",56:"ijzel",57:"ijzel",61:"regen",63:"regen",65:"regen",66:"ijzel",67:"ijzel",71:"sneeuw",73:"sneeuw",75:"sneeuw",77:"sneeuw",80:"regen",81:"regen",82:"regen",85:"sneeuw",86:"sneeuw",95:"onweer",96:"onweer",99:"onweer"});
  const FAMILIE_TEKST=Object.freeze({helder:"helder",halfbewolkt:"half bewolkt",bewolkt:"bewolkt",mist:"mistig",regen:"regenachtig",sneeuw:"sneeuwachtig",ijzel:"kans op gladheid",onweer:"onweersachtig",onbekend:"wisselvallig"});
  const FAMILIE_ERNS=Object.freeze({helder:0,halfbewolkt:1,bewolkt:2,mist:3,regen:4,sneeuw:5,ijzel:6,onweer:7,onbekend:0});
  const getal=v=>v!=null&&Number.isFinite(Number(v))?Number(v):null;
  const begrens=(v,a,b)=>Math.max(a,Math.min(b,v));
  function minuut(t){
    if(t==null)return null;
    if(typeof t==="number"&&Number.isFinite(t))return Math.floor(t/60);
    const s=String(t).trim();if(!s)return null;
    const iso=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)?s.slice(0,16)+":00Z":s;
    const ms=Date.parse(iso);return Number.isFinite(ms)?Math.floor(ms/60000):null;
  }
  function klok(v){
    if(v==null)return "–";
    if(typeof v==="string"&&v.length>=16)return v.slice(11,16);
    const d=new Date(v*60000);return String(d.getUTCHours()).padStart(2,"0")+":"+String(d.getUTCMinutes()).padStart(2,"0");
  }
  function vorigeKlok(t,stap){const m=minuut(t);return m==null?"–":klok(m-(stap||60));}
  function intervalLabel(t,stap){return vorigeKlok(t,stap)+"–"+klok(t);}
  function overlap(a0,a1,b0,b1){return Math.max(0,Math.min(a1,b1)-Math.max(a0,b0));}
  function dekking(intervalen,start,eind){
    const stukken=intervalen.map(x=>[Math.max(start,x.van),Math.min(eind,x.tot)]).filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0]);
    if(!stukken.length)return 0;
    let totaal=0,van=stukken[0][0],tot=stukken[0][1];
    for(let i=1;i<stukken.length;i++){const [a,b]=stukken[i];if(a<=tot)tot=Math.max(tot,b);else{totaal+=tot-van;van=a;tot=b;}}
    totaal+=tot-van;return begrens(totaal/Math.max(1,eind-start),0,1);
  }
  function bouwIntervalen(reeks,stap,velden){
    const times=reeks&&Array.isArray(reeks.time)?reeks.time:[],uit=[];let vorig=null,monotoon=true;
    for(let i=0;i<times.length;i++){
      const tot=minuut(times[i]);if(tot==null)continue;if(vorig!=null&&tot<=vorig)monotoon=false;vorig=tot;
      const o={i,tijd:times[i],van:tot-stap,tot};for(const veld of velden||[])o[veld]=getal(reeks[veld]&&reeks[veld][i]);uit.push(o);
    }
    uit.monotoon=monotoon;return uit;
  }
  function somGewogen(intervalen,veld,start,eind){let som=0,heeft=false;for(const x of intervalen){const ov=overlap(x.van,x.tot,start,eind);if(!ov||x[veld]==null)continue;heeft=true;som+=x[veld]*(ov/Math.max(1,x.tot-x.van));}return heeft?Math.max(0,som):null;}
  function maxInVenster(intervalen,veld,start,eind){let max=null,waar=null;for(const x of intervalen){if(!overlap(x.van,x.tot,start,eind)||x[veld]==null)continue;if(max==null||x[veld]>max){max=x[veld];waar=x;}}return{waarde:max,interval:waar};}
  function eersteMeetbaar(intervalen,veld,start,eind,drempel){for(const x of intervalen)if(overlap(x.van,x.tot,start,eind)&&x[veld]!=null&&x[veld]>=drempel)return x;return null;}
  function laatsteMeetbaar(intervalen,veld,start,eind,drempel){let laatst=null;for(const x of intervalen)if(overlap(x.van,x.tot,start,eind)&&x[veld]!=null&&x[veld]>=drempel)laatst=x;return laatst;}
  function kansNiveau(kans){if(kans==null)return"onbekend";if(kans<=0)return"geen";if(kans<=CONFIG.kansZeerKleinMax)return"zeer_klein";if(kans<=CONFIG.kansKleinMax)return"klein";if(kans<=CONFIG.kansMogelijkMax)return"mogelijk";return"groot";}
  function mmTekst(mm){if(mm==null)return"niet beschikbaar";if(mm>0&&mm<0.1)return"<0,1 mm";return mm.toFixed(1).replace(".",",")+" mm";}
  function kansTekst(kans){return kans==null?"niet beschikbaar":Math.round(kans)+"%";}
  function analyseNeerslag(data,startT,duurMinuten){
    data=data||{};const duur=Math.max(15,Number(duurMinuten)||120),start=minuut(startT!=null?startT:data.current&&data.current.time);
    if(start==null)return{status:"onvoldoende_data",genoeg:false,duurMinuten:duur,reden:"ongeldig starttijdstip"};
    const eind=start+duur,m=bouwIntervalen(data.minutely_15,15,["precipitation","rain","showers","snowfall","weather_code"]),h=bouwIntervalen(data.hourly,60,["precipitation_probability","precipitation","rain","showers","snowfall","weather_code"]);
    const mDekking=dekking(m,start,eind),hDekking=dekking(h,start,eind),mGeldig=m.monotoon!==false&&mDekking>=CONFIG.minimaleDekking,hGeldig=h.monotoon!==false&&hDekking>=CONFIG.minimaleDekking;
    const bronHoeveelheid=(mGeldig&&mDekking>=hDekking)?"minutely_15":hGeldig?"hourly":mGeldig?"minutely_15":null,bronReeks=bronHoeveelheid==="minutely_15"?m:bronHoeveelheid==="hourly"?h:[];
    const hoeveelheid=bronHoeveelheid?somGewogen(bronReeks,"precipitation",start,eind):null,kansInfo=maxInVenster(h,"precipitation_probability",start,eind),kans=hGeldig?kansInfo.waarde:null;
    const eerste=bronHoeveelheid?eersteMeetbaar(bronReeks,"precipitation",start,eind,CONFIG.meetbaarMm):null,laatste=bronHoeveelheid?laatsteMeetbaar(bronReeks,"precipitation",start,eind,CONFIG.meetbaarMm):null;
    const huidige=getal(data.current&&data.current.precipitation),huidigCode=getal(data.current&&data.current.weather_code),huidigeFamilie=WMO_FAMILIE[huidigCode]||"onbekend",regentNu=huidige!=null&&huidige>CONFIG.actueelMm&&["regen","sneeuw","ijzel","onweer"].includes(huidigeFamilie);
    const hoeveelheidDekking=bronHoeveelheid==="minutely_15"?mDekking:bronHoeveelheid==="hourly"?hDekking:0,genoeg=(hoeveelheidDekking>=CONFIG.volledigeDekking)||(hDekking>=CONFIG.volledigeDekking),niveau=kansNiveau(kans);
    let status;if(!genoeg)status="onvoldoende_data";else if(regentNu)status="neerslag_nu";else if(hoeveelheid!=null&&hoeveelheid>=CONFIG.meetbaarMm)status="neerslag_verwacht";else if(hoeveelheid!=null&&hoeveelheid>0)status="spoor_berekend";else if(niveau==="groot")status="grote_kans_geen_hoeveelheid";else if(niveau==="mogelijk")status="mogelijk";else if(niveau==="klein")status="kleine_kans";else if(niveau==="zeer_klein")status="zeer_kleine_kans";else if(niveau==="geen"&&hoeveelheid===0)status="geen_neerslag";else status="onvoldoende_data";
    const conflict=(kans!=null&&hoeveelheid!=null)&&((kans>=70&&hoeveelheid<CONFIG.meetbaarMm)||(kans<20&&hoeveelheid>=CONFIG.meetbaarMm));
    let zekerheid="hoog";if(!genoeg||m.monotoon===false||h.monotoon===false)zekerheid="laag";else if(conflict||hoeveelheidDekking<CONFIG.volledigeDekking||hDekking<CONFIG.volledigeDekking)zekerheid="middel";
    let type="neerslag",typeCode=null;const typeBron=eerste||kansInfo.interval;if(typeBron){typeCode=typeBron.weather_code;const fam=WMO_FAMILIE[typeCode]||"onbekend";type=fam==="sneeuw"?"sneeuw":fam==="ijzel"?"gladde neerslag":fam==="onweer"?"onweersbuien":fam==="regen"?"regen":"neerslag";}
    return{status,genoeg,zekerheid,conflict,start,eind,duurMinuten:duur,startTijd:klok(start),eindTijd:klok(eind),maximaleKans:kans,kansInterval:kansInfo.interval,hoeveelheid,hoeveelheidBron:bronHoeveelheid,dekking:{minutely_15:mDekking,hourly:hDekking,hoeveelheid:hoeveelheidDekking},eerste,laatste,type,typeCode,regentNu,bronkwaliteit:{minutelyMonotoon:m.monotoon!==false,hourlyMonotoon:h.monotoon!==false},intervals:{minutely_15:m,hourly:h}};
  }
  function beschrijfNeerslag(a,opties){
    opties=opties||{};const termijn=opties.termijn||("de komende "+(a.duurMinuten===60?"uur":a.duurMinuten===120?"twee uur":a.duurMinuten+" minuten")),kans="Maximale kans: "+kansTekst(a.maximaleKans)+".",mm="Verwachte hoeveelheid: "+mmTekst(a.hoeveelheid)+".";
    if(!a||!a.genoeg||a.status==="onvoldoende_data")return"Voor "+termijn+" is er niet genoeg aansluitende data voor een betrouwbare neerslaginschatting.";
    if(a.conflict)return"De neerslagsignalen spreken elkaar gedeeltelijk tegen. "+kans+" "+mm;
    if(a.status==="neerslag_nu"){const stop=a.laatste?" Naar verwachting neemt de neerslag rond "+klok(a.laatste.tot)+" af.":"";return grammatica.actueleNeerslagZin(a.type)+stop+" "+kans+" "+mm;}
    if(a.status==="neerslag_verwacht"){const begin=a.eerste?" De eerste meetbare neerslag wordt rond "+klok(Math.max(a.start,a.eerste.van))+" verwacht.":"";return"Binnen "+termijn+" "+grammatica.soortWordtVerwacht(a.type)+"."+begin+" "+kans+" "+mm;}
    if(a.status==="spoor_berekend")return"Voor "+termijn+" wordt hooguit een zeer kleine hoeveelheid neerslag berekend. "+kans+" "+mm;
    if(a.status==="grote_kans_geen_hoeveelheid")return"Voor "+termijn+" is de kans op neerslag groot, maar het hoofdmodel berekent geen meetbare hoeveelheid. "+kans+" "+mm;
    if(a.status==="mogelijk")return"Voor "+termijn+" is neerslag mogelijk. "+kans+" "+mm;
    if(a.status==="kleine_kans")return"Voor "+termijn+" is de kans op neerslag klein. "+kans+" "+mm;
    if(a.status==="zeer_kleine_kans")return"Voor "+termijn+" is de kans op neerslag zeer klein. "+kans+" "+mm;
    if(a.status==="geen_neerslag")return"Voor "+termijn+" wordt geen neerslag verwacht. "+kans+" "+mm;
    return"Voor "+termijn+" is de neerslagverwachting onzeker. "+kans+" "+mm;
  }
  function analyseDag(data,datum,vanafT){
    data=data||{};const h=data.hourly||{},times=Array.isArray(h.time)?h.time:[],vanaf=minuut(vanafT),families=new Map(),codes=new Map();let maxKans=null,maxKansTijd=null,hoeveelheid=0,heeftHoeveelheid=false;const uren=[];
    for(let i=0;i<times.length;i++){if(String(times[i]).slice(0,10)!==datum)continue;const eind=minuut(times[i]);if(eind==null||(vanaf!=null&&eind<=vanaf))continue;const code=getal(h.weather_code&&h.weather_code[i]),fam=WMO_FAMILIE[code]||"onbekend";families.set(fam,(families.get(fam)||0)+1);if(code!=null)codes.set(code,(codes.get(code)||0)+1);const p=getal(h.precipitation_probability&&h.precipitation_probability[i]);if(p!=null&&(maxKans==null||p>maxKans)){maxKans=p;maxKansTijd=times[i];}const mm=getal(h.precipitation&&h.precipitation[i]);if(mm!=null){hoeveelheid+=mm;heeftHoeveelheid=true;}uren.push({tijd:times[i],code,familie:fam,kans:p,hoeveelheid:mm});}
    const gesorteerd=[...families.entries()].sort((a,b)=>b[1]-a[1]||FAMILIE_ERNS[b[0]]-FAMILIE_ERNS[a[0]]),primair=gesorteerd[0]?gesorteerd[0][0]:"onbekend",gevaar=[...families.keys()].sort((a,b)=>FAMILIE_ERNS[b]-FAMILIE_ERNS[a])[0]||primair,secundair=gevaar!==primair&&FAMILIE_ERNS[gevaar]>=4?gevaar:null,codePrimair=[...codes.entries()].filter(([c])=>(WMO_FAMILIE[c]||"onbekend")===primair).sort((a,b)=>b[1]-a[1])[0];
    let omschrijving=primair==="onbekend"?"Weerbeeld niet beschikbaar":"Overwegend "+FAMILIE_TEKST[primair];if(secundair)omschrijving+=", met later mogelijk "+(secundair==="regen"?"regen":secundair==="sneeuw"?"sneeuw":secundair==="ijzel"?"gladde neerslag":"onweer");
    return{datum,uren,primair,secundair,icoonCode:codePrimair?codePrimair[0]:null,omschrijving,maximaleKans:maxKans,maxKansTijd,hoeveelheid:heeftHoeveelheid?hoeveelheid:null};
  }
  function aqiCategorie(stelsel,waarde){const v=getal(waarde);if(v==null)return{tekst:"onbekend",ernst:"onbekend"};if(stelsel==="eu"){if(v<=20)return{tekst:"goed",ernst:"goed"};if(v<=40)return{tekst:"redelijk",ernst:"redelijk"};if(v<=60)return{tekst:"matig",ernst:"matig"};if(v<=80)return{tekst:"slecht",ernst:"slecht"};if(v<=100)return{tekst:"zeer slecht",ernst:"zeer_slecht"};return{tekst:"extreem slecht",ernst:"extreem"};}if(v<=50)return{tekst:"goed",ernst:"goed"};if(v<=100)return{tekst:"redelijk",ernst:"redelijk"};if(v<=150)return{tekst:"ongezond voor gevoelige groepen",ernst:"matig"};if(v<=200)return{tekst:"ongezond",ernst:"slecht"};if(v<=300)return{tekst:"zeer ongezond",ernst:"zeer_slecht"};return{tekst:"gevaarlijk",ernst:"extreem"};}
  function normaliseerWaarschuwingen(lijst,nuMs){const nu=Number.isFinite(nuMs)?nuMs:Date.now(),rang={rood:3,oranje:2,geel:1},gezien=new Set(),uit=[];for(const w of Array.isArray(lijst)?lijst:[]){const eind=w&&w.tot?Date.parse(w.tot):null;if(Number.isFinite(eind)&&eind<nu)continue;const sleutel=String((w&&w.titel)||"").trim().toLowerCase()+"|"+String((w&&w.gebied)||"").trim().toLowerCase();if(!sleutel.replace("|","")||gezien.has(sleutel))continue;gezien.add(sleutel);uit.push(w);}return uit.sort((a,b)=>(rang[b.niveau]||0)-(rang[a.niveau]||0)||(Date.parse(a.van||0)||0)-(Date.parse(b.van||0)||0));}
  return{CONFIG,WMO_FAMILIE,minuut,klok,vorigeKlok,intervalLabel,kansNiveau,mmTekst,kansTekst,analyseNeerslag,beschrijfNeerslag,analyseDag,aqiCategorie,normaliseerWaarschuwingen};
});

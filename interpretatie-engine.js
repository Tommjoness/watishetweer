/*
 * Centrale interpretatielaag voor WeatherNow.
 *
 * De brondata blijft onaangetast. Deze laag zet tijdreeksen eerst om naar
 * expliciete geldigheidsvensters en maakt daarna één conclusie die door
 * briefing, tegels, twee-uursweergave, dagtabel en toegankelijkheid wordt gedeeld.
 */
(function(root){
"use strict";

const INTERPRETATIE_CONFIG = Object.freeze({
  meetbaarMm: 0.1,
  spoorMm: 0.005,
  minimaleDekking: 0.90,
  zeerKleineKansMax: 9,
  kleineKansMax: 29,
  mogelijkeKansMax: 69
});

const STATUS_RANG = Object.freeze({
  ONVOLDOENDE_DATA: -1,
  GEEN_KANS: 0,
  ZEER_KLEINE_KANS: 1,
  KLEINE_KANS: 2,
  MOGELIJKE_NEERSLAG: 3,
  GROTE_KANS_ZONDER_HOEVEELHEID: 4,
  SPOORHOEVEELHEID: 5,
  NEERSLAG_VERWACHT: 6,
  NEERSLAG_NU: 7
});

function getal(v){
  return v!==null && v!==undefined && v!=="" && Number.isFinite(Number(v)) ? Number(v) : null;
}

function veldGetal(veld,v){
  const n=getal(v);
  if(n===null) return null;
  if(veld==="precipitation_probability") return Math.max(0,Math.min(100,n));
  if(["precipitation","rain","showers","snowfall"].includes(veld)) return n<0?null:n;
  return n;
}

function parseLokaleTijd(tijd){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(tijd||""));
  return m?{jaar:+m[1],maand:+m[2],dag:+m[3],uur:+m[4],minuut:+m[5]}:null;
}

function zoneDelen(ms,tijdzone){
  if(!tijdzone||typeof Intl==="undefined"||!Intl.DateTimeFormat) return null;
  try{
    const delen=new Intl.DateTimeFormat("en-CA",{
      timeZone:tijdzone,year:"numeric",month:"2-digit",day:"2-digit",
      hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
    }).formatToParts(new Date(ms));
    const p={};
    delen.forEach(x=>{if(x.type!=="literal")p[x.type]=Number(x.value);});
    return [p.year,p.month,p.day,p.hour,p.minute,p.second].every(Number.isFinite)?p:null;
  }catch(e){return null;}
}

function zoneOffset(ms,tijdzone){
  const p=zoneDelen(ms,tijdzone);
  if(!p) return null;
  return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-Math.floor(ms/1000)*1000;
}

/* Civiele lokale tijden (bijvoorbeeld een zelf opgebouwd lokaal middernacht-
   tijdstip) worden met de IANA-zone naar een werkelijk instant vertaald. Die
   route is datumafhankelijk en hoort dus wél rekening te houden met DST. */
function lokaalNaarMinuten(tijd,tijdzone,utcOffsetSeconden){
  const p=parseLokaleTijd(tijd);
  if(!p) return null;
  const doel=Date.UTC(p.jaar,p.maand-1,p.dag,p.uur,p.minuut);
  if(tijdzone&&typeof Intl!=="undefined"&&Intl.DateTimeFormat){
    let gok=doel;
    for(let i=0;i<5;i++){
      const off=zoneOffset(gok,tijdzone); if(off===null) break;
      const nieuw=doel-off;
      if(Math.abs(nieuw-gok)<1000){gok=nieuw;break;}
      gok=nieuw;
    }
    const terug=zoneDelen(gok,tijdzone);
    // Een niet-bestaande lokale kloktijd (bv. 02:30 tijdens de voorjaarssprong)
    // mag nooit stilletjes naar 03:30 worden genormaliseerd.
    if(terug&&terug.year===p.jaar&&terug.month===p.maand-1+1&&terug.day===p.dag
      &&terug.hour===p.uur&&terug.minute===p.minuut) return gok/60000;
  }
  const off=getal(utcOffsetSeconden);
  return (doel-(off===null?0:off*1000))/60000;
}

/* Open-Meteo serialiseert één response met één vaste utc_offset_seconds over de
   provider-tijdas. De lokale labels in current/hourly/minutely zijn daarom geen
   zelfstandige civiele IANA-tijden: rond een klokomslag blijven ze vaste stappen
   vanaf die response-offset. De provider-as moet met precies die offset worden
   terugvertaald; pas voor zichtbare labels formatteren we het resulterende instant
   weer met de echte IANA-zone. Zonder offset behouden tests/abstracte reeksen de
   bestaande UTC-achtige kalenderas. */
function providerNaarMinuten(tijd,utcOffsetSeconden){
  const p=parseLokaleTijd(tijd);
  if(!p) return null;
  const doel=Date.UTC(p.jaar,p.maand-1,p.dag,p.uur,p.minuut);
  const off=getal(utcOffsetSeconden);
  return (doel-(off===null?0:off*1000))/60000;
}

function analyseStartMinuten(current,nuOverride,tijdzone,utcOffsetSeconden){
  if(typeof nuOverride==="number"&&Number.isFinite(nuOverride)) return nuOverride;
  if(nuOverride!==undefined) return lokaalNaarMinuten(nuOverride,tijdzone,utcOffsetSeconden);
  return providerNaarMinuten(current&&current.time,utcOffsetSeconden);
}

function minutenNaarLokaal(minuten,tijdzone,utcOffsetSeconden){
  if(!Number.isFinite(minuten)) return null;
  if(tijdzone){
    const p=zoneDelen(minuten*60000,tijdzone);
    if(p) return p.year+"-"+String(p.month).padStart(2,"0")+"-"+String(p.day).padStart(2,"0")
      +"T"+String(p.hour).padStart(2,"0")+":"+String(p.minute).padStart(2,"0");
  }
  const off=getal(utcOffsetSeconden);
  return new Date((minuten+(off===null?0:off/60))*60000).toISOString().slice(0,16);
}

function tijdLabel(minuten,tijdzone,utcOffsetSeconden){
  const t=minutenNaarLokaal(minuten,tijdzone,utcOffsetSeconden);
  return t?t.slice(11,16):"–";
}

function datumStartMinuten(datum,tijdzone,utcOffsetSeconden){
  return lokaalNaarMinuten(String(datum||"")+"T00:00",tijdzone,utcOffsetSeconden);
}

function volgendeDatum(datum){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum||""));
  if(!m) return null;
  return new Date(Date.UTC(+m[1],+m[2]-1,+m[3])+86400000).toISOString().slice(0,10);
}

function overlapMinuten(a1,a2,b1,b2){
  return Math.max(0,Math.min(a2,b2)-Math.max(a1,b1));
}

function neerslagSoortUitCode(code){
  code=Number(code);
  if(code===56||code===57||code===66||code===67) return "ijzel";
  if(code>=71&&code<=77) return "sneeuw";
  if(code===85||code===86) return "sneeuwbuien";
  if(code>=95) return "onweer";
  if(code>=51&&code<=57) return "motregen";
  if(code>=80&&code<=82) return "buien";
  if(code>=61&&code<=67) return "regen";
  return "neerslag";
}

function isNeerslagCode(code){
  code=Number(code);
  return (code>=51&&code<=99);
}

function hoeveelheidTekst(mm){
  const v=getal(mm);
  if(v===null) return "niet beschikbaar";
  if(v>0&&v<INTERPRETATIE_CONFIG.meetbaarMm) return "<0,1 mm";
  return v.toFixed(1).replace(".",",")+" mm";
}

function kansTekst(kans){
  const v=getal(kans);
  return v===null?"niet beschikbaar":Math.round(Math.max(0,Math.min(100,v)))+"%";
}

function vensterNaam(duurMin){
  if(duurMin===60) return "de komende circa 60 minuten";
  if(duurMin===120) return "de komende twee uur";
  if(duurMin%60===0) return "de komende "+(duurMin/60)+" uur";
  return "de komende "+duurMin+" minuten";
}

function leesReeks(reeks,stapMin,startMin,eindMin,velden,tijdzone,utcOffsetSeconden){
  const uit=[];
  const tijden=reeks&&Array.isArray(reeks.time)?reeks.time:[];
  const gezien=new Set();
  let dubbeleTijd=false;
  for(let i=0;i<tijden.length;i++){
    const eind=providerNaarMinuten(tijden[i],utcOffsetSeconden);
    if(eind===null) continue;
    const begin=eind-stapMin;
    const overlap=overlapMinuten(begin,eind,startMin,eindMin);
    if(overlap<=0) continue;
    // Exact dubbel aangeleverde providerlabels zijn ambigu/corrupt. Open-Meteo's
    // vaste response-as hoort zelf monotone unieke labels te leveren.
    const lokaleSleutel=String(tijden[i]);
    if(gezien.has(lokaleSleutel)){ dubbeleTijd=true; continue; }
    gezien.add(lokaleSleutel);
    const item={i,begin,eind,overlap,fractie:overlap/stapMin,tijd:tijden[i]};
    for(const veld of velden){
      item[veld]=veldGetal(veld,reeks[veld]&&reeks[veld][i]);
    }
    uit.push(item);
  }
  return {items:uit,dubbeleTijd};
}

function somMetDekking(items,veld,duurMin){
  let som=0,dekking=0;
  for(const item of items){
    if(item[veld]===null) continue;
    som+=item[veld]*item.fractie;
    dekking+=item.overlap;
  }
  return {som,dekking:Math.min(1,dekking/duurMin)};
}

function maxMetDekking(items,veld,duurMin){
  let max=null,dekking=0,piek=null;
  for(const item of items){
    if(item[veld]===null) continue;
    dekking+=item.overlap;
    if(max===null||item[veld]>max){max=item[veld];piek=item;}
  }
  return {max,dekking:Math.min(1,dekking/duurMin),piek};
}

function kiesNeerslagSoort(minItems,uurItems){
  let beste=null;
  for(const item of minItems){
    const gewicht=(item.precipitation||0)+(item.snowfall||0)*0.15;
    if(item.weather_code!==null && (!beste||gewicht>beste.gewicht)) beste={code:item.weather_code,gewicht};
  }
  if(!beste){
    for(const item of uurItems){
      const gewicht=(item.precipitation||0)+(item.precipitation_probability||0)/1000;
      if(item.weather_code!==null && (!beste||gewicht>beste.gewicht)) beste={code:item.weather_code,gewicht};
    }
  }
  return beste?neerslagSoortUitCode(beste.code):"neerslag";
}

function eersteNeerslagMoment(minItems,uurItems){
  for(const item of minItems){
    if((item.precipitation||0)>INTERPRETATIE_CONFIG.spoorMm || (item.snowfall||0)>0){
      return Math.max(item.begin,item.eind-item.overlap);
    }
  }
  for(const item of uurItems){
    if((item.precipitation||0)>=INTERPRETATIE_CONFIG.meetbaarMm){
      return Math.max(item.begin,item.eind-item.overlap);
    }
  }
  return null;
}

function bepaalStatus(kans,hoeveelheid,currentWet,genoeg){
  if(!genoeg) return "ONVOLDOENDE_DATA";
  if(currentWet) return "NEERSLAG_NU";
  if(hoeveelheid>=INTERPRETATIE_CONFIG.meetbaarMm) return "NEERSLAG_VERWACHT";
  if(hoeveelheid>INTERPRETATIE_CONFIG.spoorMm) return "SPOORHOEVEELHEID";
  if(kans===null) return "ONVOLDOENDE_DATA";
  if(kans<=0) return "GEEN_KANS";
  if(kans<=INTERPRETATIE_CONFIG.zeerKleineKansMax) return "ZEER_KLEINE_KANS";
  if(kans<=INTERPRETATIE_CONFIG.kleineKansMax) return "KLEINE_KANS";
  if(kans<=INTERPRETATIE_CONFIG.mogelijkeKansMax) return "MOGELIJKE_NEERSLAG";
  return "GROTE_KANS_ZONDER_HOEVEELHEID";
}

function analyseerNeerslagData(data,duurMin,nuOverride){
  duurMin=Number(duurMin)||120;
  const current=data&&data.current||{};
  const tijdzone=data&&data.timezone||null,utcOffsetSeconden=data&&data.utc_offset_seconds;
  const startMin=analyseStartMinuten(current,nuOverride,tijdzone,utcOffsetSeconden);
  if(startMin===null){
    return {status:"ONVOLDOENDE_DATA",genoeg:false,duurMin,reden:"ongeldig huidig tijdstip"};
  }
  const eindMin=startMin+duurMin;
  const minLees=leesReeks(data&&data.minutely_15,15,startMin,eindMin,
    ["precipitation","rain","showers","snowfall","weather_code"],tijdzone,utcOffsetSeconden);
  const uurLees=leesReeks(data&&data.hourly,60,startMin,eindMin,
    ["precipitation","precipitation_probability","weather_code","snowfall","rain","showers"],tijdzone,utcOffsetSeconden);

  const minSom=somMetDekking(minLees.items,"precipitation",duurMin);
  const uurSom=somMetDekking(uurLees.items,"precipitation",duurMin);
  const kans=maxMetDekking(uurLees.items,"precipitation_probability",duurMin);

  const gebruikMinuten=minSom.dekking>=INTERPRETATIE_CONFIG.minimaleDekking;
  const hoeveelheid=gebruikMinuten?minSom.som:uurSom.som;
  const hoeveelheidDekking=gebruikMinuten?minSom.dekking:uurSom.dekking;
  const bronHoeveelheid=gebruikMinuten?"kwartierdata":"uurdata";
  const dubbeleTijd=minLees.dubbeleTijd||uurLees.dubbeleTijd;
  const genoeg=!dubbeleTijd && hoeveelheidDekking>=INTERPRETATIE_CONFIG.minimaleDekking
    && kans.dekking>=INTERPRETATIE_CONFIG.minimaleDekking;

  const currentRuw=getal(current.precipitation);
  const currentHoeveelheid=currentRuw!==null&&currentRuw>=0?currentRuw:0;
  const currentWet=currentHoeveelheid>=0.05 && isNeerslagCode(current.weather_code);
  // Als de status over 'nu' gaat, komt ook het neerslagtype uit de actuele code.
  // Een toekomstige sneeuwbui mag actuele regen nooit achteraf als sneeuw labelen.
  const soort=currentWet?neerslagSoortUitCode(current.weather_code):kiesNeerslagSoort(minLees.items,uurLees.items);
  const status=bepaalStatus(kans.max,hoeveelheid,currentWet,genoeg);
  const eerste=eersteNeerslagMoment(minLees.items,uurLees.items);

  return {
    status,
    rang:STATUS_RANG[status],
    genoeg,
    reden:dubbeleTijd?"dubbel provider-tijdstip":null,
    duurMin,
    startMin,
    eindMin,
    begin:tijdLabel(startMin,tijdzone,utcOffsetSeconden),
    eind:tijdLabel(eindMin,tijdzone,utcOffsetSeconden),
    kans:kans.max===null?null:Math.round(kans.max),
    kansDekking:kans.dekking,
    kansTijdvak:kans.piek?{
      begin:tijdLabel(kans.piek.begin,tijdzone,utcOffsetSeconden),
      eind:tijdLabel(kans.piek.eind,tijdzone,utcOffsetSeconden)
    }:null,
    hoeveelheid:Math.max(0,hoeveelheid),
    hoeveelheidDekking,
    bronHoeveelheid,
    soort,
    eersteMin:eerste,
    eersteTijd:eerste===null?null:tijdLabel(eerste,tijdzone,utcOffsetSeconden),
    currentWet,
    currentHoeveelheid,
    minutelyItems:minLees.items,
    hourlyItems:uurLees.items
  };
}

function neerslagKorteWeergave(analyse){
  const a=analyse||{};
  if(!a.genoeg) return {hoofd:"–",detail:"",droog:false};
  const kans=a.kans===null?null:Math.round(Math.max(0,Math.min(100,a.kans)));
  if(a.status==="GEEN_KANS") return {hoofd:"Droog",detail:"",droog:true};
  if(a.status==="ZEER_KLEINE_KANS") return {hoofd:kans===null?"Zeer klein":kans+"%",detail:"zeer kleine kans",droog:false};
  if(a.status==="KLEINE_KANS") return {hoofd:kans===null?"Kleine kans":kans+"%",detail:"kleine kans",droog:false};
  if(a.status==="MOGELIJKE_NEERSLAG") return {hoofd:kans===null?"Mogelijk":kans+"%",detail:"hoeveelheid onzeker",droog:false};
  if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID") return {hoofd:kans===null?"Grote kans":kans+"%",detail:"hoeveelheid onzeker",droog:false};
  if(a.status==="SPOORHOEVEELHEID") return {hoofd:kans&&kans>0?kans+"%":"Druppels",detail:hoeveelheidTekst(a.hoeveelheid),droog:false};
  return {
    hoofd:kans===null?"Neerslag":kans+"%",
    detail:getal(a.hoeveelheid)>0?hoeveelheidTekst(a.hoeveelheid):"",
    droog:false
  };
}

function dagHoeveelheidZin(mm){
  const v=getal(mm);
  if(v===null) return "De totale neerslagverwachting voor vandaag is niet beschikbaar.";
  if(v<=INTERPRETATIE_CONFIG.spoorMm) return "Voor vandaag wordt er geen neerslag verwacht.";
  if(v<INTERPRETATIE_CONFIG.meetbaarMm) return "Voor vandaag worden hooguit enkele druppels verwacht.";
  return "Voor vandaag wordt "+hoeveelheidTekst(v)+" neerslag verwacht.";
}

function weatherNowVoorzichtigeTijd(tijd,bron){
  if(!tijd||bron!=="kwartierdata")return tijd;
  const m=/^(\d{2}):(\d{2})$/.exec(tijd); if(!m)return tijd;
  let totaal=(+m[1])*60+(+m[2]); totaal=Math.round(totaal/30)*30; totaal=((totaal%1440)+1440)%1440;
  return String(Math.floor(totaal/60)).padStart(2,"0")+":"+String(totaal%60).padStart(2,"0");
}
function neerslagZin(analyse){
  const a=analyse||{};
  const venster=vensterNaam(a.duurMin||120);
  if(!a.genoeg){
    return "Voor "+venster+" ontbreken voldoende consistente gegevens voor een betrouwbare inschatting.";
  }
  const kans=a.kans===null?null:Math.round(Math.max(0,Math.min(100,a.kans)));
  const kansTussen=kans===null?"":(a.duurMin===60&&a.kansTijdvak
    ?" (hoogste modelkans in de overlappende uurvakken: "+kans+"%)"
    :" (maximaal "+kans+"%)");
  if(a.status==="GEEN_KANS"){
    return "Voor "+venster+" wordt er geen neerslag verwacht.";
  }
  if(a.status==="ZEER_KLEINE_KANS"){
    return "De kans op neerslag in "+venster+" is zeer klein"+kansTussen+".";
  }
  if(a.status==="KLEINE_KANS"){
    return "Er is een kleine kans op neerslag in "+venster+kansTussen+". De meeste berekeningen blijven droog.";
  }
  if(a.status==="MOGELIJKE_NEERSLAG"){
    return "Neerslag is mogelijk in "+venster+kansTussen+", maar de verwachte hoeveelheid is onzeker.";
  }
  if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID"){
    return "De kans op neerslag in "+venster+" is groot"+kansTussen+", terwijl het model tegelijk geen meetbare hoeveelheid berekent. De verwachting is daardoor onzeker.";
  }
  if(a.status==="SPOORHOEVEELHEID"){
    return "In "+venster+" zijn hooguit enkele druppels mogelijk. Verwachte hoeveelheid: "+hoeveelheidTekst(a.hoeveelheid)+".";
  }
  if(a.status==="NEERSLAG_NU"){
    const totaal=getal(a.hoeveelheid)>=INTERPRETATIE_CONFIG.spoorMm
      ?" Verwachte hoeveelheid in "+venster+": "+hoeveelheidTekst(a.hoeveelheid)+".":"";
    return "Volgens het weermodel valt er nu "+a.soort+"."+totaal+(kans===null?"":" Maximale kans: "+kans+"%.");
  }
  const tekstTijd=weatherNowVoorzichtigeTijd(a.eersteTijd,a.bronHoeveelheid); const start=tekstTijd?", rond "+tekstTijd:"";
  return "In "+venster+" wordt "+a.soort+" verwacht"+start+". Verwachte hoeveelheid: "
    +hoeveelheidTekst(a.hoeveelheid)+"."+(kans===null?"":" Maximale kans: "+kans+"%.");
}

function modeCode(codes){
  const telling=new Map();
  for(const c of codes){
    if(c===null||c===undefined) continue;
    telling.set(Number(c),(telling.get(Number(c))||0)+1);
  }
  let best=null,n=-1;
  for(const [code,aantal] of telling){
    if(aantal>n){best=code;n=aantal;}
  }
  return best;
}

function weerCodeRang(code){
  code=Number(code);
  if(code>=95) return 8;
  if([56,57,66,67].includes(code)) return 7;
  if([55,65,75,82,86].includes(code)) return 6;
  if([71,73,77,85].includes(code)) return 5;
  if((code>=51&&code<=67)||(code>=80&&code<=82)) return 4;
  if(code===45||code===48) return 3;
  if(code===3) return 2;
  if(code===2) return 1;
  return 0;
}

function zwaarsteCode(codes){
  let beste=null,rang=-1;
  for(const c of codes){
    const n=getal(c); if(n===null) continue;
    const r=weerCodeRang(n);
    if(r>rang){rang=r;beste=n;}
  }
  return beste;
}

function analyseerDagData(data,dagIndex,nuOverride){
  const daily=data&&data.daily||{};
  const datum=daily.time&&daily.time[dagIndex];
  const tijdzone=data&&data.timezone||null,utcOffsetSeconden=data&&data.utc_offset_seconds;
  const dagStart=datumStartMinuten(datum,tijdzone,utcOffsetSeconden);
  const volgende=volgendeDatum(datum);
  const dagEind=volgende?datumStartMinuten(volgende,tijdzone,utcOffsetSeconden):null;
  if(dagStart===null||dagEind===null||dagEind<=dagStart) return {genoeg:false,status:"ONVOLDOENDE_DATA"};
  const nu=analyseStartMinuten(data&&data.current||{},nuOverride,tijdzone,utcOffsetSeconden);
  const start=nu!==null&&nu>dagStart&&nu<dagEind?nu:dagStart;
  const duur=Math.max(0,dagEind-start);
  if(duur<1) return {genoeg:false,status:"ONVOLDOENDE_DATA",datum,voorbij:true};
  const uur=leesReeks(data.hourly,60,start,dagEind,
    ["precipitation","precipitation_probability","weather_code","snowfall","rain","showers"],tijdzone,utcOffsetSeconden);
  const som=somMetDekking(uur.items,"precipitation",duur);
  const kans=maxMetDekking(uur.items,"precipitation_probability",duur);
  const codes=uur.items.filter(x=>x.weather_code!==null).map(x=>x.weather_code);
  const dagCode=veldGetal("weather_code",daily.weather_code&&daily.weather_code[dagIndex]);
  const huidigeDatum=String(data&&data.current&&data.current.time||"").slice(0,10);
  const isResterendVandaag=datum===huidigeDatum&&start>dagStart;
  // Voor vandaag na 'nu' moet het icoon dezelfde resterende periode beschrijven
  // als kans/hoeveelheid. Voor toekomstige dagen blijft de officiële dagelijkse
  // code juist de beste samenvatting van de hele kalenderdag.
  const code=isResterendVandaag?(zwaarsteCode(codes)??dagCode):(dagCode!==null?dagCode:modeCode(codes));
  const eerste=eersteNeerslagMoment([],uur.items);
  const genoeg=!uur.dubbeleTijd && som.dekking>=0.75 && kans.dekking>=0.75;
  const hoeveelheid=som.som;
  const status=bepaalStatus(kans.max,hoeveelheid,false,genoeg);
  return {
    datum,dagIndex,startMin:start,eindMin:dagEind,genoeg,status,
    kans:kans.max===null?null:Math.round(kans.max),
    hoeveelheid,code,soort:kiesNeerslagSoort([],uur.items),
    eersteTijd:eerste===null?null:tijdLabel(eerste,tijdzone,utcOffsetSeconden),
    kansTijdvak:kans.piek?{
      begin:tijdLabel(kans.piek.begin,tijdzone,utcOffsetSeconden),
      eind:tijdLabel(kans.piek.eind,tijdzone,utcOffsetSeconden)
    }:null,
    rang:STATUS_RANG[status]
  };
}

function statusRang(status){
  return STATUS_RANG[status]===undefined?-1:STATUS_RANG[status];
}

const publiekeApi={
  INTERPRETATIE_CONFIG,
  STATUS_RANG,
  lokaalNaarMinuten,
  providerNaarMinuten,
  minutenNaarLokaal,
  hoeveelheidTekst,
  kansTekst,
  neerslagSoortUitCode,
  analyseerNeerslagData,
  analyseerDagData,
  neerslagKorteWeergave,
  dagHoeveelheidZin,
  neerslagZin,
  statusRang
};

if(typeof module!=="undefined"&&module.exports) module.exports=publiekeApi;
root.WeatherNowInterpretatie=publiekeApi;

/* Browserintegratie. Dit blok wordt door build-weather.js vóór de bestaande
   startprocedure in hetzelfde scriptblok ingevoegd. Alle oorspronkelijke
   renderfuncties bestaan dan al, maar er is nog geen locatie geladen. */
if(typeof document!=="undefined" && typeof S!=="undefined"){
  const origineel={
    meters:typeof meters==="function"?meters:null,
    briefing:typeof briefing==="function"?briefing:null,
    nowcast:typeof nowcast==="function"?nowcast:null,
    dagen:typeof dagen==="function"?dagen:null,
    lucht:typeof lucht==="function"?lucht:null,
    etmaal:typeof etmaal==="function"?etmaal:null,
    chartHint:typeof chartHint==="function"?chartHint:null,
    daglengte:typeof daglengte==="function"?daglengte:null,
    tekenAlles:typeof tekenAlles==="function"?tekenAlles:null,
    stempel:typeof stempel==="function"?stempel:null
  };

  function browserNuMinuten(){
    if(S.klokInstantOverride&&typeof S.klokInstantOverride.getTime==="function") return S.klokInstantOverride.getTime()/60000;
    if(!S.klokOverride) return Date.now()/60000;
    return lokaalNaarMinuten(weatherNowActueleLokaleTijd(),S.d&&S.d.timezone,S.d&&S.d.utc_offset_seconds);
  }
  const analyse=duur=>analyseerNeerslagData(S.d,duur,browserNuMinuten());

  function zetEyebrow(id,tekst){
    const el=document.getElementById(id);
    const ouder=el&&el.parentElement;
    const kop=ouder&&ouder.querySelector?ouder.querySelector(".eyebrow"):null;
    if(kop) kop.textContent=tekst;
  }

  function briefingNeerslagZin(a){
    if(!a||!a.genoeg) return "Voor de komende twee uur ontbreken voldoende gegevens.";
    if(a.status==="GEEN_KANS") return "De komende twee uur blijft het droog.";
    if(a.status==="ZEER_KLEINE_KANS") return "De komende twee uur blijft het waarschijnlijk droog.";
    if(a.status==="KLEINE_KANS") return "De komende twee uur is er een kleine kans op neerslag.";
    if(a.status==="MOGELIJKE_NEERSLAG") return "In de komende twee uur is neerslag mogelijk.";
    if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID") return "De komende twee uur is de neerslagkans groot, maar de hoeveelheid onzeker.";
    return neerslagZin(a);
  }

  /* De eerste zin heeft bewust een vaste horizon van twee uur, maar een
     dagbriefing mag daarna niet abrupt stoppen. Vat daarom alleen de nog niet
     verstreken modeluren ná dat venster samen. Zo blijft een droge middag
     informatief en wordt een latere buienkans niet verstopt. */
  function laterVandaagNeerslag(data,twee){
    if(!data||!twee||!twee.genoeg||!Number.isFinite(twee.eindMin))return null;
    const huidig=parseLokaleTijd(data.current&&data.current.time);
    const uur=data.hourly, tijden=uur&&Array.isArray(uur.time)?uur.time:[];
    const kansen=uur&&Array.isArray(uur.precipitation_probability)?uur.precipitation_probability:[];
    if(!huidig||!tijden.length)return null;
    const datum=String(huidig.jaar).padStart(4,"0")+"-"+String(huidig.maand).padStart(2,"0")+"-"+String(huidig.dag).padStart(2,"0");
    let max=null,aantal=0;
    for(let i=0;i<tijden.length;i++){
      if(String(tijden[i]).slice(0,10)!==datum)continue;
      const minuut=providerNaarMinuten(tijden[i],data.utc_offset_seconds);
      const kans=veldGetal("precipitation_probability",kansen[i]);
      if(minuut===null||minuut<=twee.eindMin||kans===null)continue;
      aantal++;max=Math.max(max===null?0:max,kans);
    }
    return aantal>=2?{kans:Math.round(max)}:null;
  }

  function dagSamenvatting(a){
    if(!a||!a.genoeg) return "Onvoldoende consistente gegevens";
    const basis=(typeof txt==="function"&&a.code!==null)?txt(a.code,true):"Verwachting";
    if(a.status==="NEERSLAG_VERWACHT") {
      const t=weatherNowVoorzichtigeTijd(a.eersteTijd,a.bronHoeveelheid);
      const zelfde=String(basis).toLowerCase().includes(String(a.soort||"").toLowerCase());
      return basis+(zelfde?"":"; "+a.soort)+(t?" rond "+t:"");
    }
    if(a.status==="SPOORHOEVEELHEID") return basis+"; zeer kleine hoeveelheid "+a.soort+" mogelijk";
    if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID") return basis+"; grote neerslagkans, hoeveelheid onzeker";
    if(a.status==="MOGELIJKE_NEERSLAG") return basis+"; neerslag mogelijk";
    if(a.status==="KLEINE_KANS") return basis+"; kleine neerslagkans";
    if(a.status==="ZEER_KLEINE_KANS") return basis+"; zeer kleine neerslagkans";
    return basis;
  }

  if(origineel.meters){
    meters=function(){
      origineel.meters();
      const uur=analyse(60),kort=neerslagKorteWeergave(uur);
      if(!uur.genoeg) set("pop","–");
      else if(kort.droog) set("pop","Droog");
      else if(uur.kans!==null) set("pop",uur.kans+"<s>%</s>");
      else set("pop",kort.hoofd);
      zetTekst("popsub",!uur.genoeg?"Neerslagkans niet beschikbaar.":kort.droog?"Geen neerslag verwacht.":neerslagZin(uur));
      zetEyebrow("prec","Afgelopen 15 minuten");
      const c=S.d.current||{};
      const intervalMin=Math.max(1,Math.round((getal(c.interval)||900)/60));
      const recent=veldGetal("precipitation",c.precipitation);
      set("prec",recent===null?"–":recent<=INTERPRETATIE_CONFIG.spoorMm?"Droog":(recent<0.1?"<0,1":nl(recent))+"<s>mm</s>");
      zetTekst("precsub",recent===null
        ? "Recente neerslag is niet beschikbaar."
        : recent<=INTERPRETATIE_CONFIG.spoorMm
          ? "Geen neerslag."
          : "Neerslag in de afgelopen "+intervalMin+" minuten.");

      // Bewolkingswoorden zijn tijdsafhankelijk. 'Overwegend zonnig' is na
      // zonsondergang semantisch onmogelijk, ook als hetzelfde percentage klopt.
      const cc=getal(c.cloud_cover),sub=document.getElementById("cloudsub");
      if(sub&&c.is_day===0&&cc!==null&&cc>=0&&cc<40){
        sub.textContent=cc<15?"Vrijwel onbewolkt.":"Overwegend helder.";
      }
    };
  }

  if(origineel.briefing){
    briefing=function(){
      origineel.briefing();
      const el=document.getElementById("brief");
      const bestaand=el.innerHTML;
      const scheiding="<!--brief-rest-->",idx=bestaand.indexOf(scheiding);
      const rest=idx>=0?bestaand.slice(idx+scheiding.length):bestaand;
      const twee=analyse(120);
      let voor=esc(briefingNeerslagZin(twee));
      const later=laterVandaagNeerslag(S.d,twee);
      if(later&&later.kans>=25){
        const korteKans=getal(twee.kans);
        const blijftHoog=twee.currentWet||(korteKans!==null&&later.kans<=Math.round(korteKans)+5);
        if(blijftHoog){
          voor+=later.kans>=90
            ?" Ook later vandaag blijft de neerslagkans zeer groot."
            :later.kans>=70
              ?" Ook later vandaag blijft de neerslagkans groot."
              :" Ook later vandaag blijft neerslag mogelijk.";
        }else{
          voor+=" Later vandaag loopt de neerslagkans op tot <b>"+later.kans+"%</b>.";
        }
      }else if(later&&(twee.status==="GEEN_KANS"||twee.status==="ZEER_KLEINE_KANS")){
        voor+=" Ook later vandaag blijft neerslag onwaarschijnlijk.";
      }
      // Alleen een waarschuwing die door de bron tegen deze locatie is getoetst
      // mag de plaats-specifieke modelbriefing overrulen. Een landbrede Atom-
      // fallback blijft zichtbaar in het waarschuwingenblok, maar niet dominant.
      const waars=(S.actieveWaarschuwingen||[]).filter(w=>w&&w.plaatsSpecifiek!==false);
      if(waars.length){
        const w=waars[0];
        const waarschKop=w.niveauIsOfficieel===false
          ?"Officiële weerwaarschuwing"
          :"Officiële weerwaarschuwing"+(w.niveau?" ("+esc(w.niveau)+")":"");
        voor="<b>"+waarschKop+":</b> "+esc(w.titel)+". "+voor
          +" De officiële waarschuwing heeft voorrang op de modelverwachting.";
      }
      el.innerHTML=nbsp(voor+" "+rest);
    };
  }

  if(origineel.nowcast){
    nowcast=function(){
      origineel.nowcast();
      const a=analyse(120),tx=document.getElementById("nctext"),grafiek=document.getElementById("nc");
      tx.textContent=nbsp(neerslagZin(a));
      if(grafiek){
        grafiek.setAttribute("aria-label",neerslagZin(a)+" Kwartierwaarden zijn sommen over het voorafgaande kwartier en kunnen afhankelijk van de locatie uit uurdata zijn geïnterpoleerd.");
        if(a.genoeg) grafiek.style.display=a.bronHoeveelheid==="kwartierdata"&&a.hoeveelheid>0?"block":"none";
      }
    };
  }

  if(origineel.dagen){
    dagen=function(){
      origineel.dagen();
      const rijen=document.querySelectorAll("#days .row.day");
      rijen.forEach(rij=>{
        if(rij.classList&&rij.classList.contains("kop")) return;
        const i=Number(rij.dataset.i),a=analyseerDagData(S.d,i,browserNuMinuten());
        const cond=rij.querySelector(".dcond"),kans=rij.querySelector(".drain"),icoon=rij.querySelector(".dico");
        if(cond) cond.textContent=dagSamenvatting(a);
        if(kans){
          const kort=neerslagKorteWeergave(a);
          if(!a.genoeg){
            kans.innerHTML="–";
            kans.title="Geen betrouwbare kans beschikbaar";
          }else if(kort.droog){
            kans.innerHTML="Droog";
            kans.title="Geen neerslag verwacht";
          }else{
            kans.innerHTML=kort.hoofd+(kort.detail?"<small>"+kort.detail+"</small>":"");
            kans.title=a.kansTijdvak
              ? "Hoogste resterende kans in het uur "+a.kansTijdvak.begin+"–"+a.kansTijdvak.eind
              : neerslagZin(a);
          }
        }
        if(icoon&&a.genoeg&&a.code!==null&&typeof icon==="function") icoon.innerHTML=icon(a.code,true,22);
      });
    };
  }

  if(origineel.etmaal){
    etmaal=function(start,n){
      origineel.etmaal(start,n);
      const svg=document.getElementById("chart");
      if(svg){
        const huidig=svg.getAttribute("aria-label")||"Weergrafiek";
        svg.setAttribute("aria-label",huidig+" Neerslagpercentages gelden voor het voorafgaande uur; waarden links van de nu-lijn zijn verlopen.");
      }
    };
  }

  chartHint=function(){
    const el=document.getElementById("charthint");
    if(el) el.textContent="Houd de grafiek vast voor details.";
  };

  if(origineel.lucht){
    lucht=function(){
      origineel.lucht();
      if(!S.air||!S.air.current) return;
      const c=S.air.current,eu=getal(c.european_aqi),us=getal(c.us_aqi);
      const euro=typeof inEuropa==="function"&&inEuropa(S.lat,S.lon)&&eu!==null;
      const waarde=euro?eu:us;
      const eerste=document.querySelector("#aq .stat");
      if(eerste&&waarde!==null){
        const kop=eerste.querySelector(".eyebrow"),val=eerste.querySelector(".sval"),sub=eerste.querySelector(".ssub");
        const label=euro?"Europese AQI":"AQI (VS-schaal)";
        let oordeel;
        if(euro) oordeel=waarde<=20?"goed":waarde<=40?"redelijk":waarde<=60?"matig":waarde<=80?"slecht":waarde<=100?"zeer slecht":"extreem slecht";
        else oordeel=waarde<=50?"goed":waarde<=100?"redelijk":waarde<=150?"ongezond voor gevoelige groepen":waarde<=200?"ongezond":waarde<=300?"zeer ongezond":"gevaarlijk";
        if(kop) kop.textContent=label;
        if(val) val.textContent=Math.round(waarde);
        if(sub) sub.textContent=oordeel;
      }
    };
  }

  daglengte=function(i){
    const sr=S.d.daily.sunrise[i],ss=S.d.daily.sunset[i];
    if(sr&&ss){
      const l=mins(ss)-mins(sr);
      if(l>0) return Math.floor(l/60)+" uur en "+(l%60)+" minuten daglicht";
    }
    const datum=S.d.daily.time[i],h=S.d.hourly,waarden=[];
    if(h&&h.time&&h.is_day){
      for(let k=0;k<h.time.length;k++) if(h.time[k].slice(0,10)===datum&&h.is_day[k]!=null) waarden.push(h.is_day[k]);
    }
    if(waarden.length&&waarden.every(v=>v===1)) return "24 uur daglicht";
    if(waarden.length&&waarden.every(v=>v===0)) return "poolnacht";
    return "daglichtduur niet beschikbaar";
  };

  if(origineel.tekenAlles){
    tekenAlles=function(){
      origineel.tekenAlles();
      const d=S.d||{},meta=[];
      meta.push(S.lat.toFixed(3)+", "+S.lon.toFixed(3));
      if(getal(d.elevation)!==null) meta.push(Math.round(d.elevation)+" m hoogte");
      if(getal(d.latitude)!==null&&getal(d.longitude)!==null
        &&(Math.abs(d.latitude-S.lat)>0.015||Math.abs(d.longitude-S.lon)>0.015)){
        meta.push("modelcel "+Number(d.latitude).toFixed(3)+", "+Number(d.longitude).toFixed(3));
      }
      if(d.timezone) meta.push(d.timezone);
      const coords=document.getElementById("coords");
      if(coords) coords.textContent=meta.join(" · ");
      zetEyebrow("prec","Afgelopen 15 minuten");
    };
  }
}

})(typeof globalThis!=="undefined"?globalThis:this);

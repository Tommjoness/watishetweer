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
  zeerKleineKansMax: 19,
  kleineKansMax: 39,
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

function lokaalNaarMinuten(tijd){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(tijd||""));
  if(!m) return null;
  return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])/60000;
}

function minutenNaarLokaal(minuten){
  if(!Number.isFinite(minuten)) return null;
  return new Date(minuten*60000).toISOString().slice(0,16);
}

function tijdLabel(minuten){
  const t=minutenNaarLokaal(minuten);
  return t?t.slice(11,16):"–";
}

function datumStartMinuten(datum){
  return lokaalNaarMinuten(String(datum||"")+"T00:00");
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

function leesReeks(reeks,stapMin,startMin,eindMin,velden){
  const uit=[];
  const tijden=reeks&&Array.isArray(reeks.time)?reeks.time:[];
  const gezien=new Set();
  let dubbeleTijd=false;
  for(let i=0;i<tijden.length;i++){
    const eind=lokaalNaarMinuten(tijden[i]);
    if(eind===null) continue;
    const begin=eind-stapMin;
    const overlap=overlapMinuten(begin,eind,startMin,eindMin);
    if(overlap<=0) continue;
    // Alleen een dubbele lokale tijd die het onderzochte venster werkelijk
    // raakt is dubbelzinnig. Een klokomslag in oude of latere brondata mag een
    // actuele conclusie niet onnodig ongeldig maken.
    if(gezien.has(eind)){ dubbeleTijd=true; continue; }
    gezien.add(eind);
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
  const startMin=nuOverride!==undefined?lokaalNaarMinuten(nuOverride):lokaalNaarMinuten(current.time);
  if(startMin===null){
    return {status:"ONVOLDOENDE_DATA",genoeg:false,duurMin,reden:"ongeldig huidig tijdstip"};
  }
  const eindMin=startMin+duurMin;
  const minLees=leesReeks(data&&data.minutely_15,15,startMin,eindMin,
    ["precipitation","rain","showers","snowfall","weather_code"]);
  const uurLees=leesReeks(data&&data.hourly,60,startMin,eindMin,
    ["precipitation","precipitation_probability","weather_code","snowfall","rain","showers"]);

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
  const soort=kiesNeerslagSoort(minLees.items,uurLees.items);
  const status=bepaalStatus(kans.max,hoeveelheid,currentWet,genoeg);
  const eerste=eersteNeerslagMoment(minLees.items,uurLees.items);

  return {
    status,
    rang:STATUS_RANG[status],
    genoeg,
    reden:dubbeleTijd?"dubbele lokale tijd rond een klokomslag":null,
    duurMin,
    startMin,
    eindMin,
    begin:tijdLabel(startMin),
    eind:tijdLabel(eindMin),
    kans:kans.max===null?null:Math.round(kans.max),
    kansDekking:kans.dekking,
    kansTijdvak:kans.piek?{begin:tijdLabel(kans.piek.begin),eind:tijdLabel(kans.piek.eind)}:null,
    hoeveelheid:Math.max(0,hoeveelheid),
    hoeveelheidDekking,
    bronHoeveelheid,
    soort,
    eersteMin:eerste,
    eersteTijd:eerste===null?null:tijdLabel(eerste),
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
  if(v<=INTERPRETATIE_CONFIG.spoorMm) return "Voor vandaag wordt geen neerslag verwacht.";
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
  const kansTussen=kans===null?"":" (maximaal "+kans+"%)";
  if(a.status==="GEEN_KANS"){
    return "Voor "+venster+" wordt geen neerslag verwacht.";
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

function analyseerDagData(data,dagIndex,nuOverride){
  const daily=data&&data.daily||{};
  const datum=daily.time&&daily.time[dagIndex];
  const dagStart=datumStartMinuten(datum);
  if(dagStart===null) return {genoeg:false,status:"ONVOLDOENDE_DATA"};
  const dagEind=dagStart+1440;
  const nu=lokaalNaarMinuten(nuOverride!==undefined?nuOverride:data.current&&data.current.time);
  const start=nu!==null&&nu>dagStart&&nu<dagEind?nu:dagStart;
  const duur=Math.max(0,dagEind-start);
  if(duur<1) return {genoeg:false,status:"ONVOLDOENDE_DATA",datum,voorbij:true};
  const uur=leesReeks(data.hourly,60,start,dagEind,
    ["precipitation","precipitation_probability","weather_code","snowfall","rain","showers"]);
  const som=somMetDekking(uur.items,"precipitation",duur);
  const kans=maxMetDekking(uur.items,"precipitation_probability",duur);
  const codes=uur.items.filter(x=>x.weather_code!==null).map(x=>x.weather_code);
  const dagCode=veldGetal("weather_code",daily.weather_code&&daily.weather_code[dagIndex]);
  const code=dagCode!==null?dagCode:modeCode(codes);
  const eerste=eersteNeerslagMoment([],uur.items);
  const genoeg=!uur.dubbeleTijd && som.dekking>=0.75 && kans.dekking>=0.75;
  const hoeveelheid=som.som;
  const status=bepaalStatus(kans.max,hoeveelheid,false,genoeg);
  return {
    datum,dagIndex,startMin:start,eindMin:dagEind,genoeg,status,
    kans:kans.max===null?null:Math.round(kans.max),
    hoeveelheid,code,soort:kiesNeerslagSoort([],uur.items),
    eersteTijd:eerste===null?null:tijdLabel(eerste),
    kansTijdvak:kans.piek?{begin:tijdLabel(kans.piek.begin),eind:tijdLabel(kans.piek.eind)}:null,
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

  const analyse=duur=>analyseerNeerslagData(S.d,duur,weatherNowActueleLokaleTijd());

  function zetEyebrow(id,tekst){
    const el=document.getElementById(id);
    const ouder=el&&el.parentElement;
    const kop=ouder&&ouder.querySelector?ouder.querySelector(".eyebrow"):null;
    if(kop) kop.textContent=tekst;
  }

  function dagSamenvatting(a){
    if(!a||!a.genoeg) return "Onvoldoende consistente gegevens";
    const basis=(typeof txt==="function"&&a.code!==null)?txt(a.code,true):"Verwachting";
    if(a.status==="NEERSLAG_VERWACHT") {const t=weatherNowVoorzichtigeTijd(a.eersteTijd,a.bronHoeveelheid);return basis+"; "+a.soort+(t?" rond "+t:"");}
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
      else if(kort.droog) set("pop","Geen");
      else if(uur.kans!==null) set("pop",uur.kans+"<s>%</s>");
      else set("pop",kort.hoofd);
      zetTekst("popsub",neerslagZin(uur));
      zetEyebrow("prec","Neerslag recent");
      const c=S.d.current||{};
      const intervalMin=Math.max(1,Math.round((getal(c.interval)||900)/60));
      const recent=veldGetal("precipitation",c.precipitation);
      set("prec",recent===null?"–":recent<=INTERPRETATIE_CONFIG.spoorMm?"Geen":(recent<0.1?"<0,1":nl(recent))+"<s>mm</s>");
      const dag=S.d.daily||{},idx=dag.time?dag.time.indexOf(plaatsVandaag()):-1;
      const dagsom=idx>=0&&dag.precipitation_sum?veldGetal("precipitation",dag.precipitation_sum[idx]):null;
      zetTekst("precsub",recent===null
        ? "Recente neerslag is niet beschikbaar."
        : (recent<=INTERPRETATIE_CONFIG.spoorMm
          ? "Volgens het model viel geen neerslag in de afgelopen "+intervalMin+" minuten. "
          : "Modelwaarde over de afgelopen "+intervalMin+" minuten. ")+dagHoeveelheidZin(dagsom));
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
      let voor=esc(neerslagZin(twee));
      const waars=S.actieveWaarschuwingen||[];
      if(waars.length){
        const w=waars[0];
        const waarschKop=w.niveauIsOfficieel===false
          ?"Officiële weerwaarschuwing"
          :"Officiële "+esc(w.niveau||"weer")+" waarschuwing";
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
        const i=Number(rij.dataset.i),a=analyseerDagData(S.d,i);
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
    if(el) el.textContent="Houd je vinger op de grafiek voor details. Een neerslagpercentage hoort bij het uur dat eindigt op het getoonde tijdstip; waarden links van ‘nu’ zijn voorbij.";
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
        const label=euro?"Europese AQI":"Amerikaanse AQI";
        let oordeel;
        if(euro) oordeel=waarde<=20?"goed":waarde<=40?"redelijk":waarde<=60?"matig":waarde<=80?"slecht":waarde<=100?"zeer slecht":"extreem slecht";
        else oordeel=waarde<=50?"goed":waarde<=100?"redelijk":waarde<=150?"ongezond voor gevoelige groepen":waarde<=200?"ongezond":waarde<=300?"zeer ongezond":"gevaarlijk";
        if(kop) kop.textContent=label;
        if(val) val.textContent=Math.round(waarde);
        if(sub) sub.textContent=oordeel;
      }
      document.querySelectorAll("#aq .stat").forEach(stat=>{
        const kop=stat.querySelector(".eyebrow"),sub=stat.querySelector(".ssub");
        if(kop&&sub&&/^Pollen\s/.test(kop.textContent)) sub.textContent="Gemodelleerde concentratie";
      });
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

  stempel=function(){
    const el=document.getElementById("stamp");
    if(!S.d){el.textContent="";return;}
    const m=Math.max(0,Math.floor((Date.now()-S.op)/60000));
    el.textContent=m<1?"zojuist opgehaald":m===1?"1 minuut geleden opgehaald":m+" minuten geleden opgehaald";
    el.className=m>45?"oud":"";
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
      zetEyebrow("prec","Neerslag recent");
    };
  }
}

})(typeof globalThis!=="undefined"?globalThis:this);

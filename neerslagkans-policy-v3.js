/* Neerslagkansbeleid v3.
 *
 * Open-Meteo blijft wereldwijd de basis voor kans en verwachting. Voor
 * Nederlandse locaties kan een bewezen KNMI-puntbron de actuele neerslag en
 * de komende twee uur verfijnen. De radar zelf wordt nergens getoond: alleen
 * numerieke neerslagdata wordt in dezelfde rustige product-UI verwerkt.
 */
(function(root){
"use strict";

const grammatica=typeof module!=="undefined"&&module.exports
  ?require("./nederlandse-weergrammatica.js")
  :root.WeatherNowNederlandseGrammatica;

const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const clamp=v=>Math.max(0,Math.min(100,v));
const hoofdletter=t=>{t=String(t||"");return t?t.charAt(0).toUpperCase()+t.slice(1):t;};
const kleineStart=t=>{t=String(t||"");return t?t.charAt(0).toLowerCase()+t.slice(1):t;};
const SPOOR_MM=0.005;
const KNMI_ACTUEEL_DREMPEL_MMU=0.1;
const KNMI_TOEKOMST_DREMPEL_MMU=0.05;
const KNMI_MIN_DEKKING=0.90;
const KNMI_CLIENT_MAX_LEEFTIJD_MS=12*60*1000;

function kansNiveau(kans){
  const n=num(kans);
  if(n===null) return "ONBEKEND";
  const k=Math.round(clamp(n));
  if(k===0) return "DROOG";
  if(k<=9) return "ZEER_KLEIN";
  if(k<=29) return "KLEIN";
  if(k<=69) return "MOGELIJK";
  if(k<=89) return "GROOT";
  return "ZEER_GROOT";
}

function hoeveelheidTekst(mm){
  const n=num(mm);
  if(n===null||n<=0) return "";
  if(n<0.1) return "<0,1 mm";
  return n.toFixed(1).replace(".",",")+" mm";
}

function hoeveelheidConditioneel(a){
  const mm=num(a&&a.hoeveelheid);
  if(mm===null||mm<=SPOOR_MM) return "";
  if(mm<0.1) return " Als er neerslag valt, gaat het waarschijnlijk om hooguit enkele druppels.";
  if(a&&a.bronHoeveelheid==="knmi-nowcast") return " De korte-termijnverwachting komt uit op ongeveer "+hoeveelheidTekst(mm)+".";
  return " Als er neerslag valt, berekent het model ongeveer "+hoeveelheidTekst(mm)+".";
}

function geenMeetbareHoeveelheid(a){
  const mm=num(a&&a.hoeveelheid);
  return mm===null||mm<=SPOOR_MM;
}

function actueelNeerslagSignaal(a){
  const mm=num(a&&a.currentHoeveelheid),intensiteit=num(a&&a.currentIntensiteit);
  return !!(a&&(a.currentWet||a.status==="NEERSLAG_NU"
    ||(intensiteit!==null&&intensiteit>=KNMI_ACTUEEL_DREMPEL_MMU)
    ||(mm!==null&&mm>SPOOR_MM)));
}
function actueleSoort(a){
  return a&&a.currentWet?typeNeerslag(a):"neerslag";
}

function tegenstrijdigDroogSignaal(a){
  const mm=num(a&&a.hoeveelheid);
  const natteStatus=a&&(a.status==="SPOORHOEVEELHEID"||a.status==="NEERSLAG_VERWACHT");
  return kansNiveau(a&&a.kans)==="DROOG"&&((mm!==null&&mm>SPOOR_MM)||natteStatus);
}

function typeNeerslag(a){
  const soort=String(a&&a.soort||"neerslag").trim();
  return soort||"neerslag";
}

function dagMomentZinsdeel(tijd){
  const m=/^(\d{1,2}):(\d{2})$/.exec(String(tijd||"").trim());
  if(!m)return "";
  const uur=Number(m[1]);
  if(!Number.isFinite(uur)||uur<0||uur>23)return "";
  if(uur<5)return " in de nacht";
  if(uur<8)return " in de vroege ochtend";
  if(uur<12)return " in de ochtend";
  if(uur<18)return " in de middag";
  return " in de avond";
}

function knmiPayloadVers(knmi,nuMs){
  if(!knmi||knmi.beschikbaar!==true)return false;
  const opgehaald=Date.parse(knmi.opgehaaldOp||"");
  if(!Number.isFinite(opgehaald))return true;
  const nu=Number.isFinite(nuMs)?nuMs:Date.now();
  return nu-opgehaald>=-60000&&nu-opgehaald<=KNMI_CLIENT_MAX_LEEFTIJD_MS;
}

function statusUitKnmi(kans,hoeveelheid,currentWet){
  if(currentWet)return "NEERSLAG_NU";
  if(hoeveelheid>=0.1)return "NEERSLAG_VERWACHT";
  if(hoeveelheid>SPOOR_MM)return "SPOORHOEVEELHEID";
  const k=num(kans);
  if(k===null)return "ONVOLDOENDE_DATA";
  if(k<=0)return "GEEN_KANS";
  if(k<=19)return "ZEER_KLEINE_KANS";
  if(k<=39)return "KLEINE_KANS";
  if(k<=69)return "MOGELIJKE_NEERSLAG";
  return "GROTE_KANS_ZONDER_HOEVEELHEID";
}

function verrijkAnalyseMetKnmi(analyse,data,duurMin,engineApi,nuMs){
  const a={...(analyse||{})},knmi=data&&data.__knmiNeerslag;
  if(!knmiPayloadVers(knmi,nuMs))return a;
  const engine=engineApi||{};
  const act=knmi.actueel&&typeof knmi.actueel==="object"?knmi.actueel:null;
  const intensiteit=act?num(act.waarde):null;
  if(intensiteit!==null&&intensiteit>=0){
    a.currentIntensiteit=intensiteit;
    a.bronActueel="knmi-rtcor";
    a.currentRadarWet=intensiteit>=KNMI_ACTUEEL_DREMPEL_MMU;
    if(a.currentRadarWet){
      a.currentWet=true;
      a.genoeg=true;
      a.status="NEERSLAG_NU";
      if(engine.STATUS_RANG)a.rang=engine.STATUS_RANG.NEERSLAG_NU;
      const code=num(data&&data.current&&data.current.weather_code);
      const modelSoort=code!==null&&typeof engine.neerslagSoortUitCode==="function"
        ?engine.neerslagSoortUitCode(code):"neerslag";
      a.soort=modelSoort&&modelSoort!=="neerslag"?modelSoort:"neerslag";
    }
  }

  const nowcast=knmi.nowcast&&Array.isArray(knmi.nowcast.punten)?knmi.nowcast:null;
  const startMin=num(a.startMin),duur=Number(duurMin)||Number(a.duurMin)||120;
  if(!nowcast||startMin===null||!Number.isFinite(duur)||duur<=0)return a;
  const eindMin=startMin+duur;
  const punten=[];
  for(const p of nowcast.punten){
    const t=Date.parse(p&&p.tijd)/60000,v=num(p&&p.waarde);
    if(!Number.isFinite(t)||v===null||v<0||t<=startMin||t>eindMin)continue;
    const lokaal=typeof engine.minutenNaarLokaal==="function"
      ?engine.minutenNaarLokaal(t,data&&data.timezone,data&&data.utc_offset_seconds):null;
    punten.push({min:t,tijd:lokaal||p.tijd,intensiteit:v,precipitation:v/12});
  }
  punten.sort((x,y)=>x.min-y.min);
  const dekking=Math.min(1,punten.length*5/duur);
  if(dekking<KNMI_MIN_DEKKING)return a;

  const hoeveelheid=punten.reduce((som,p)=>som+p.precipitation,0);
  const eerste=punten.find(p=>p.intensiteit>=KNMI_TOEKOMST_DREMPEL_MMU)||null;
  let droogVanaf=null;
  if(a.currentRadarWet){
    const eersteDroog=punten.find(p=>p.intensiteit<KNMI_ACTUEEL_DREMPEL_MMU);
    if(eersteDroog)droogVanaf=eersteDroog;
  }
  a.genoeg=true;
  a.hoeveelheid=Math.max(0,hoeveelheid);
  a.hoeveelheidDekking=dekking;
  a.bronHoeveelheid="knmi-nowcast";
  a.knmiItems=punten;
  a.eersteMin=eerste?eerste.min:null;
  a.eersteTijd=eerste?String(eerste.tijd).slice(11,16):null;
  a.droogVanafTijd=droogVanaf?String(droogVanaf.tijd).slice(11,16):null;
  a.status=statusUitKnmi(a.kans,a.hoeveelheid,!!a.currentWet);
  if(engine.STATUS_RANG&&engine.STATUS_RANG[a.status]!==undefined)a.rang=engine.STATUS_RANG[a.status];
  return a;
}

function kansHoofd(a){
  if(!a||!a.genoeg) return "–";
  if(a.bronHoeveelheid==="knmi-nowcast"&&(a.status==="NEERSLAG_VERWACHT"||a.status==="SPOORHOEVEELHEID"||actueelNeerslagSignaal(a)))return "Neerslag";
  if(actueelNeerslagSignaal(a)){
    const k=num(a.kans),pct=k===null?0:Math.round(clamp(k));
    return pct>0?pct+"%":"Neerslag";
  }
  if(tegenstrijdigDroogSignaal(a)) return "Onzeker";
  const niveau=kansNiveau(a.kans),k=num(a.kans);
  if(niveau==="ONBEKEND") return "–";
  if(niveau==="DROOG") return "Droog";
  return Math.round(clamp(k))+"%";
}

function actueleZinMetEinde(a){
  const basis=grammatica.actueleNeerslagZin(actueleSoort(a));
  return a&&a.droogVanafTijd?basis+" Rond "+a.droogVanafTijd+" wordt het naar verwachting droog.":basis;
}

function knmiToekomstZin(a,venster){
  if(!a||a.bronHoeveelheid!=="knmi-nowcast"||a.status!=="NEERSLAG_VERWACHT")return null;
  const start=a.eersteTijd?"Vanaf ongeveer "+a.eersteTijd+" wordt neerslag verwacht.":"In "+venster+" wordt neerslag verwacht.";
  const mm=num(a.hoeveelheid);
  return mm!==null&&mm>=0.1?start+" In totaal ongeveer "+hoeveelheidTekst(mm)+".":start;
}

function kansZin(a,venster,opties){
  opties=opties||{};
  if(!a||!a.genoeg) return opties.kort?"Neerslagkans niet beschikbaar.":"Voor "+venster+" ontbreken voldoende gegevens voor een betrouwbare neerslaginschatting.";
  const soort=typeNeerslag(a),k=num(a.kans),niveau=kansNiveau(k);
  if(actueelNeerslagSignaal(a)) return actueleZinMetEinde(a);
  const knmiZin=knmiToekomstZin(a,venster);if(knmiZin)return knmiZin;
  if(a.bronHoeveelheid==="knmi-nowcast"&&a.status==="SPOORHOEVEELHEID")return "In "+venster+" kunnen enkele druppels vallen.";
  if(niveau==="ONBEKEND") return "Neerslagkans niet beschikbaar.";
  const pct=Math.round(clamp(k));
  const hoeveelheidDetail=opties.kort?"":hoeveelheidConditioneel(a);
  const hogeKansZonderHoeveelheid=!opties.kort&&(niveau==="GROOT"||niveau==="ZEER_GROOT")&&geenMeetbareHoeveelheid(a)
    ?" De verwachte hoeveelheid is onzeker.":"";
  const detail=hoeveelheidDetail||hogeKansZonderHoeveelheid;
  if(niveau==="DROOG"){
    if(tegenstrijdigDroogSignaal(a)) return "De neerslagverwachting is onzeker; kans en hoeveelheid spreken elkaar tegen.";
    return opties.kort?"Geen neerslag verwacht.":"Voor "+venster+" wordt geen neerslag verwacht.";
  }
  if(niveau==="ZEER_KLEIN") return (opties.kort?"Zeer kleine kans op neerslag.":"De kans op "+soort+" in "+venster+" is zeer klein (maximaal "+pct+"%).")+detail;
  if(niveau==="KLEIN") return (opties.kort?"Kleine kans op neerslag.":"Er is een kleine kans op "+soort+" in "+venster+" (maximaal "+pct+"%).")+detail;
  if(niveau==="MOGELIJK") return (opties.kort?"Neerslag is mogelijk.":grammatica.soortIsMogelijk(soort)+" in "+venster+" (maximaal "+pct+"%).")+detail;
  if(niveau==="GROOT") return (opties.kort?"Grote kans op neerslag.":"Er is een grote kans op "+soort+" in "+venster+" (maximaal "+pct+"%).")+detail;
  return (opties.kort?"Zeer grote kans op neerslag.":"Er is een zeer grote kans op "+soort+" in "+venster+" (maximaal "+pct+"%).")+detail;
}

function komendUurTekst(a){
  if(!a||!a.genoeg) return "Neerslagkans niet beschikbaar.";
  if(actueelNeerslagSignaal(a)) return actueleZinMetEinde(a);
  if(a.bronHoeveelheid==="knmi-nowcast"&&a.status==="NEERSLAG_VERWACHT")return a.eersteTijd?"Vanaf ongeveer "+a.eersteTijd+" wordt neerslag verwacht.":"Neerslag wordt verwacht het komende uur.";
  if(a.bronHoeveelheid==="knmi-nowcast"&&a.status==="SPOORHOEVEELHEID")return "Enkele druppels zijn mogelijk het komende uur.";
  if(tegenstrijdigDroogSignaal(a)) return "Neerslagverwachting onzeker.";
  const niveau=kansNiveau(a.kans);
  if(niveau==="DROOG") return "Geen neerslag verwacht.";
  if(niveau==="ZEER_KLEIN") return "Zeer kleine kans op neerslag het komende uur.";
  if(niveau==="KLEIN") return "Kleine kans op neerslag het komende uur.";
  if(niveau==="MOGELIJK") return "Neerslag is mogelijk het komende uur.";
  if(niveau==="GROOT") return "Grote kans op neerslag het komende uur.";
  if(niveau==="ZEER_GROOT") return "Zeer grote kans op neerslag het komende uur.";
  return "Neerslagkans niet beschikbaar.";
}

function briefingZin(a){
  if(!a||!a.genoeg) return "Onvoldoende gegevens voor een betrouwbare neerslaginschatting in de komende twee uur.";
  if(actueelNeerslagSignaal(a)) return actueleZinMetEinde(a);
  const knmiZin=knmiToekomstZin(a,"de komende twee uur");if(knmiZin)return knmiZin;
  if(a.bronHoeveelheid==="knmi-nowcast"&&a.status==="SPOORHOEVEELHEID")return "In de komende twee uur kunnen enkele druppels vallen.";
  if(tegenstrijdigDroogSignaal(a)) return "De neerslagverwachting voor de komende twee uur is onzeker.";
  const niveau=kansNiveau(a.kans);
  if(niveau==="DROOG") return "De komende twee uur wordt geen neerslag verwacht.";
  if(niveau==="ZEER_KLEIN") return "De kans op neerslag in de komende twee uur is zeer klein.";
  if(niveau==="KLEIN") return "De komende twee uur is er een kleine kans op neerslag.";
  if(niveau==="MOGELIJK") return "In de komende twee uur is neerslag mogelijk.";
  if(niveau==="GROOT") return "De komende twee uur is er een grote kans op neerslag"+(geenMeetbareHoeveelheid(a)?", maar de hoeveelheid is onzeker.":".");
  if(niveau==="ZEER_GROOT") return "De komende twee uur is de kans op neerslag zeer groot"+(geenMeetbareHoeveelheid(a)?", maar de hoeveelheid is onzeker.":".");
  return "Onvoldoende gegevens voor een betrouwbare neerslaginschatting in de komende twee uur.";
}

function dagKansSamenvatting(a,basis){
  if(!a||!a.genoeg) return "Onvoldoende consistente gegevens";
  basis=String(basis||"Verwachting");
  if(tegenstrijdigDroogSignaal(a)) return basis+"; neerslagverwachting onzeker";
  const soort=typeNeerslag(a),niveau=kansNiveau(a.kans);
  const basisIsNeerslag=/(?:motregen|regen|buien|sneeuw|ijzel|onweer|hagel)/i.test(basis);
  const basisHeeftSoort=basisIsNeerslag||basis.toLowerCase().includes(soort.toLowerCase());
  const type=basisHeeftSoort?basis:hoofdletter(soort);
  const tijd=dagMomentZinsdeel(a.eersteTijd);
  if(niveau==="ONBEKEND") return basis;
  if(niveau==="DROOG") return basisHeeftSoort?"Overwegend droog":basis;
  if(niveau==="ZEER_KLEIN") return basisHeeftSoort?"Zeer kleine kans op "+kleineStart(type)+tijd:basis+"; zeer kleine neerslagkans";
  if(niveau==="KLEIN") return basisHeeftSoort?"Kleine kans op "+kleineStart(type)+tijd:basis+"; kleine neerslagkans";
  if(niveau==="MOGELIJK") return basisHeeftSoort?hoofdletter(type)+" mogelijk"+tijd:basis+"; neerslag mogelijk";
  if(niveau==="GROOT") return basisHeeftSoort?"Grote kans op "+kleineStart(type)+tijd:basis+"; grote neerslagkans";
  return basisHeeftSoort?"Zeer grote kans op "+kleineStart(type)+tijd:basis+"; zeer grote neerslagkans";
}

const api={kansNiveau,kansHoofd,hoeveelheidTekst,hoeveelheidConditioneel,kansZin,komendUurTekst,briefingZin,dagMomentZinsdeel,dagKansSamenvatting,knmiPayloadVers,verrijkAnalyseMetKnmi};
if(typeof module!=="undefined"&&module.exports) module.exports=api;
root.WeatherNowKansbeleidV3=api;

if(typeof document==="undefined"||typeof S==="undefined") return;
const interpretatie=root.WeatherNowInterpretatie;
if(!interpretatie||typeof interpretatie.analyseerNeerslagData!=="function") return;

const basisAnalyseerNeerslag=interpretatie.analyseerNeerslagData.bind(interpretatie);
interpretatie.analyseerNeerslagData=function(data,duur,nuOverride){
  return verrijkAnalyseMetKnmi(basisAnalyseerNeerslag(data,duur,nuOverride),data,duur,interpretatie);
};
const analyse=duur=>interpretatie.analyseerNeerslagData(S.d,duur,weatherNowActueleLokaleTijd());

function zetKnmiOpData(payload){
  if(!S.d||!payload||payload.beschikbaar!==true)return false;
  try{Object.defineProperty(S.d,"__knmiNeerslag",{value:payload,writable:true,configurable:true,enumerable:false});}
  catch(e){S.d.__knmiNeerslag=payload;}
  return true;
}

function verwijderKnmiVanData(){
  if(!S.d)return;
  try{delete S.d.__knmiNeerslag;}catch(e){}
}

function modelConditieHerstellen(){
  if(!S.d||!S.d.current)return;
  const c=S.d.current,cond=document.getElementById("cond"),ico=document.getElementById("nowicon"),mini=document.getElementById("minicond");
  if(cond&&typeof txt==="function")cond.textContent=txt(c.weather_code,c.is_day!==0);
  if(ico&&typeof icon==="function")ico.innerHTML=icon(c.weather_code,c.is_day===1,46);
  if(mini&&typeof txt==="function")mini.textContent=txt(c.weather_code,c.is_day!==0);
}

function werkActueleConditieBij(){
  if(!S.d||!S.d.current)return;
  const a=analyse(120);
  if(!a.currentRadarWet){modelConditieHerstellen();return;}
  const cond=document.getElementById("cond"),ico=document.getElementById("nowicon"),mini=document.getElementById("minicond");
  const tekst=a.soort&&a.soort!=="neerslag"?hoofdletter(a.soort):"Neerslag";
  if(cond)cond.textContent=tekst;
  if(mini)mini.textContent=tekst;
  if(ico&&typeof icon==="function"){
    const code=num(S.d.current.weather_code),neerslagCode=code!==null&&code>=51&&code<=99?code:61;
    ico.innerHTML=icon(neerslagCode,S.d.current.is_day===1,46);
  }
}

function werkBronvermeldingBij(actief){
  const bron=document.querySelector("footer .bron");if(!bron)return;
  let knmi=document.getElementById("knmi-bron-inline");
  if(actief&&!knmi){
    knmi=document.createElement("span");knmi.id="knmi-bron-inline";
    knmi.innerHTML=' · <a href="https://dataplatform.knmi.nl/" target="_blank" rel="noopener">KNMI</a>';
    bron.appendChild(knmi);
  }else if(!actief&&knmi)knmi.remove();
}

function werkNeerslagTegelBij(a){
  const prec=document.getElementById("prec");if(!prec)return;
  const stat=prec.closest&&prec.closest(".stat"),kop=stat&&stat.querySelector(".eyebrow");
  if(kop)kop.textContent="Neerslag nu";
  if(a&&a.bronActueel==="knmi-rtcor"&&num(a.currentIntensiteit)!==null){
    const v=Math.max(0,num(a.currentIntensiteit));
    if(v>0&&v<0.1)set("prec","<0,1<s>mm/u</s>");
    else set("prec",nl(v)+"<s>mm/u</s>");
    zetTekst("precsub",v>=KNMI_ACTUEEL_DREMPEL_MMU?"Actuele neerslagintensiteit.":"Nu geen meetbare neerslag gedetecteerd.");
  }
}

function groepeerKnmiKwartieren(a){
  const uit=Array.from({length:8},(_,i)=>({eindMin:a.startMin+(i+1)*15,mm:0}));
  (a.knmiItems||[]).forEach(p=>{
    const verschil=p.min-a.startMin;if(verschil<=0||verschil>120)return;
    const i=Math.min(7,Math.max(0,Math.ceil(verschil/15)-1));
    uit[i].mm+=Math.max(0,num(p.precipitation)||0);
  });
  return uit;
}

function tekenKnmiGrafiek(a){
  const el=document.getElementById("nc");if(!el||!a||!Array.isArray(a.knmiItems))return false;
  const groepen=groepeerKnmiKwartieren(a),P=groepen.map(g=>g.mm),M=root.innerWidth?root.innerWidth<760:false;
  const W=M?380:900,pl=M?26:44,pr=M?8:20,iw=W-pl-pr,base=40,hmax=M?30:32,cw=iw/groepen.length;
  const mx=Math.max(0.25,...P);
  el.setAttribute("viewBox","0 0 "+W+" "+(M?62:60));
  let out=`<line x1="${pl}" y1="${base}" x2="${W-pr}" y2="${base}" stroke="${RULE}"/>`;
  groepen.forEach((g,k)=>{
    const waarde=P[k],x=pl+k*cw,hh=hmax*(waarde/mx);
    if(waarde>0)out+=`<rect x="${x+3}" y="${base-hh}" width="${cw-6}" height="${hh}" fill="${TEAL}" fill-opacity=".2"/><line x1="${x+3}" y1="${base-hh}" x2="${x+cw-3}" y2="${base-hh}" stroke="${TEAL}" stroke-width="1.2"/>`;
    out+=`<line x1="${x}" y1="${base}" x2="${x}" y2="${base+4}" stroke="${RULE}"/>`;
    if(k%2===1){
      const lokaal=interpretatie.minutenNaarLokaal(g.eindMin,S.d.timezone,S.d.utc_offset_seconds),label=lokaal?lokaal.slice(11,16):"";
      out+=`<text x="${x+cw/2}" y="${base+18}" text-anchor="middle" fill="${INK45}" font-family="DM Mono,monospace" font-size="${M?10:10.5}">${label}</text>`;
    }
    if(waarde>=0.1){
      const boven=base-hh-6,past=boven>=11;
      out+=`<text x="${x+cw/2}" y="${past?boven:base-hh+11}" text-anchor="middle" fill="${TEAL}" font-family="DM Mono,monospace" font-size="${M?9.5:10}">${nl(waarde)}</text>`;
    }
  });
  el.innerHTML=out;
  const som=P.reduce((x,y)=>x+y,0);
  el.style.display=som<0.01&&!a.currentRadarWet?"none":"block";
  return true;
}

function werkNeerslagUitlegBij(a){
  const hint=document.getElementById("nchint"),detail=document.querySelector(".data-uitleg p");
  const knmi=!!(a&&a.bronHoeveelheid==="knmi-nowcast");
  if(hint)hint.textContent=knmi?"KNMI-neerslagdata voor nu en de komende twee uur.":"Kwartierverwachting op basis van weermodellen.";
  if(detail)detail.textContent=knmi
    ?"Voor Nederlandse locaties gebruikt deze neerslagweergave actuele KNMI-puntdata en de KNMI-nowcast. Temperatuur, wind en de langere verwachting blijven uit de gewone weermodellen komen."
    :"De bronresolutie verschilt per regio. Buiten gebieden met echte 15-minutenmodeldata kan Open-Meteo uurdata interpoleren.";
  werkBronvermeldingBij(knmi||!!(a&&a.bronActueel==="knmi-rtcor"));
}

function hertekenNeerslagdelen(){
  if(!S.d)return;
  werkActueleConditieBij();
  meters();
  briefing();
  nowcast();
  if(typeof minibarBij==="function")minibarBij();
}

const basisMeters=meters;
meters=function(){
  basisMeters();
  const a=analyse(60),hoofd=kansHoofd(a);
  werkNeerslagTegelBij(a);
  if(hoofd==="–"||hoofd==="Droog"||hoofd==="Onzeker"||hoofd==="Neerslag") set("pop",hoofd);
  else set("pop",hoofd.replace("%","<s>%</s>"));
  zetTekst("popsub",komendUurTekst(a));
};

const basisNowcast=nowcast;
nowcast=function(){
  basisNowcast();
  const a=analyse(120),tx=document.getElementById("nctext"),grafiek=document.getElementById("nc"),zin=kansZin(a,"de komende twee uur");
  if(a.bronHoeveelheid==="knmi-nowcast")tekenKnmiGrafiek(a);
  werkNeerslagUitlegBij(a);
  if(tx)tx.textContent=zin;
  if(grafiek)grafiek.setAttribute("aria-label",zin+(a.bronHoeveelheid==="knmi-nowcast"?" De balken tonen neerslag per kwartier, opgebouwd uit KNMI-stappen van vijf minuten.":" Kwartierwaarden zijn sommen over het voorafgaande kwartier en kunnen afhankelijk van de locatie uit uurdata zijn geïnterpoleerd."));
};

const basisDagen=dagen;
dagen=function(){
  basisDagen();
  document.querySelectorAll("#days .row.day").forEach(rij=>{
    if(rij.classList&&rij.classList.contains("kop")) return;
    const i=Number(rij.dataset.i),a=interpretatie.analyseerDagData(S.d,i,weatherNowActueleLokaleTijd());
    const cond=rij.querySelector(".dcond"),kansEl=rij.querySelector(".drain");
    const basis=a&&a.code!==null&&typeof txt==="function"?txt(a.code,true):"Verwachting";
    if(cond) cond.textContent=dagKansSamenvatting(a,basis);
    if(kansEl){
      const hoofd=kansHoofd(a);
      kansEl.textContent=hoofd;
      kansEl.title=hoofd==="Onzeker"?"Kans en hoeveelheid spreken elkaar tegen":hoofd==="Droog"?"Geen neerslag verwacht":hoofd==="–"?"Geen betrouwbare kans beschikbaar":"Neerslagkans "+hoofd;
    }
  });
};

let knmiGeneratie=0,knmiController=null,knmiTimer=null,laatsteKnmiSleutel="";
function stopKnmi(){
  knmiGeneratie++;
  if(knmiController){knmiController.abort();knmiController=null;}
  if(knmiTimer!==null){clearTimeout(knmiTimer);knmiTimer=null;}
  laatsteKnmiSleutel="";
}
function planKnmiVerversing(gen){
  if(knmiTimer!==null)clearTimeout(knmiTimer);
  knmiTimer=setTimeout(()=>{
    knmiTimer=null;
    if(gen!==knmiGeneratie||S.land!=="NL"||S.lat==null||S.lon==null)return;
    vraagKnmiEnPasToe(S.lat,S.lon,gen,true);
  },5*60*1000);
}
async function vraagKnmiEnPasToe(lat,lon,gen,force){
  if(gen!==knmiGeneratie||S.land!=="NL")return;
  const sleutel=Number(lat).toFixed(4)+","+Number(lon).toFixed(4);
  if(!force&&sleutel===laatsteKnmiSleutel&&S.d&&S.d.__knmiNeerslag)return;
  laatsteKnmiSleutel=sleutel;
  if(knmiController)knmiController.abort();
  const controller=new AbortController();knmiController=controller;
  try{
    const payload=await j("/api/neerslag?lat="+encodeURIComponent(lat)+"&lon="+encodeURIComponent(lon),{timeoutMs:7500,signal:controller.signal});
    if(gen!==knmiGeneratie||controller.signal.aborted||S.land!=="NL"||Number(S.lat)!==Number(lat)||Number(S.lon)!==Number(lon))return;
    if(payload&&payload.beschikbaar===true&&zetKnmiOpData(payload))hertekenNeerslagdelen();
  }catch(e){}finally{
    if(knmiController===controller)knmiController=null;
    if(gen===knmiGeneratie&&S.land==="NL")planKnmiVerversing(gen);
  }
}
function startKnmiVoorHuidigePlaats(force){
  if(S.land!=="NL"||S.lat==null||S.lon==null||!S.d)return;
  vraagKnmiEnPasToe(S.lat,S.lon,knmiGeneratie,!!force);
}

const basisOnthoudLand=onthoudLand;
onthoudLand=function(v){
  basisOnthoudLand(v);
  if(S.land==="NL")startKnmiVoorHuidigePlaats(false);
  else{verwijderKnmiVanData();werkBronvermeldingBij(false);}
};

/* Een KNMI-request start pas nadat de gewone forecast voor de gekozen plaats
   is gecommit. Zo kan een snelle neerslagresponse nooit op S.d van de vorige
   locatie terechtkomen tijdens een locatiewissel. De weather-load zelf blijft
   wereldwijd volledig onafhankelijk van KNMI en houdt dus zijn fallback. */
const basisLoad=load;
load=async function(lat,lon,label,stil,opslaan,land){
  stopKnmi();
  const gen=knmiGeneratie;
  const resultaat=await basisLoad(lat,lon,label,stil,opslaan,land);
  if(gen!==knmiGeneratie)return resultaat;
  if(S.land==="NL")startKnmiVoorHuidigePlaats(false);
  else{verwijderKnmiVanData();werkBronvermeldingBij(false);modelConditieHerstellen();}
  return resultaat;
};

})(typeof globalThis!=="undefined"?globalThis:this);
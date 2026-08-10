/* Neerslagkansbeleid v3.
 *
 * Open-Meteo blijft de bron van het percentage. Deze laag bepaalt uitsluitend
 * hoe dat percentage in consumententaal wordt vertaald. De grenzen sluiten aan
 * op de publieke KNMI-uitleg: 10% verloopt meestal droog, rond 30% is neerslag
 * mogelijk en rond 90% is de kans zeer groot. Hoeveelheid verandert nooit de
 * zekerheid van de zin; zij wordt alleen conditioneel als hoeveelheid genoemd.
 */
(function(root){
"use strict";

const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const clamp=v=>Math.max(0,Math.min(100,v));
const hoofdletter=t=>{t=String(t||"");return t?t.charAt(0).toUpperCase()+t.slice(1):t;};
const kleineStart=t=>{t=String(t||"");return t?t.charAt(0).toLowerCase()+t.slice(1):t;};

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
  if(mm===null||mm<=0.005) return "";
  if(mm<0.1) return " Als er neerslag valt, gaat het waarschijnlijk om hooguit enkele druppels.";
  return " Als er neerslag valt, berekent het model ongeveer "+hoeveelheidTekst(mm)+".";
}

function geenMeetbareHoeveelheid(a){
  const mm=num(a&&a.hoeveelheid);
  return mm===null||mm<=0.005;
}

function tegenstrijdigDroogSignaal(a){
  const mm=num(a&&a.hoeveelheid);
  return kansNiveau(a&&a.kans)==="DROOG"&&mm!==null&&mm>=0.1;
}

function typeNeerslag(a){
  const soort=String(a&&a.soort||"neerslag").trim();
  return soort||"neerslag";
}

function kansHoofd(a){
  if(!a||!a.genoeg) return "–";
  if(tegenstrijdigDroogSignaal(a)) return "Onzeker";
  const niveau=kansNiveau(a.kans),k=num(a.kans);
  if(niveau==="ONBEKEND") return "–";
  if(niveau==="DROOG") return "Droog";
  return Math.round(clamp(k))+"%";
}

function kansZin(a,venster,opties){
  opties=opties||{};
  if(!a||!a.genoeg) return opties.kort?"Neerslagkans niet beschikbaar.":"Voor "+venster+" ontbreken voldoende gegevens voor een betrouwbare neerslaginschatting.";
  const soort=typeNeerslag(a),k=num(a.kans),niveau=kansNiveau(k);
  if(a.currentWet||a.status==="NEERSLAG_NU") return "Er valt nu "+soort+".";
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
  if(niveau==="MOGELIJK") return (opties.kort?"Neerslag is mogelijk.":hoofdletter(soort)+" is mogelijk in "+venster+" (maximaal "+pct+"%).")+detail;
  if(niveau==="GROOT") return (opties.kort?"Grote kans op neerslag.":"Er is een grote kans op "+soort+" in "+venster+" (maximaal "+pct+"%).")+detail;
  return (opties.kort?"Zeer grote kans op neerslag.":"Er is een zeer grote kans op "+soort+" in "+venster+" (maximaal "+pct+"%).")+detail;
}

function komendUurTekst(a){
  if(!a||!a.genoeg) return "Neerslagkans niet beschikbaar.";
  if(a.currentWet||a.status==="NEERSLAG_NU") return "Er valt nu "+typeNeerslag(a)+".";
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
  if(a.currentWet||a.status==="NEERSLAG_NU") return "Er valt nu "+typeNeerslag(a)+".";
  if(tegenstrijdigDroogSignaal(a)) return "De neerslagverwachting voor de komende twee uur is onzeker.";
  const niveau=kansNiveau(a.kans);
  if(niveau==="DROOG") return "De komende twee uur blijft het droog.";
  if(niveau==="ZEER_KLEIN") return "De komende twee uur blijft het waarschijnlijk droog.";
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
  const basisHeeftSoort=basis.toLowerCase().includes(soort.toLowerCase());
  const type=basisHeeftSoort?basis:hoofdletter(soort);
  const tijd=a.eersteTijd?" rond "+a.eersteTijd:"";
  if(niveau==="ONBEKEND") return basis;
  if(niveau==="DROOG") return basisHeeftSoort?"Overwegend droog":basis;
  if(niveau==="ZEER_KLEIN") return basisHeeftSoort?"Zeer kleine kans op "+kleineStart(type)+tijd:basis+"; zeer kleine neerslagkans";
  if(niveau==="KLEIN") return basisHeeftSoort?"Kleine kans op "+kleineStart(type)+tijd:basis+"; kleine neerslagkans";
  if(niveau==="MOGELIJK") return basisHeeftSoort?hoofdletter(type)+" mogelijk"+tijd:basis+"; neerslag mogelijk";
  if(niveau==="GROOT") return basisHeeftSoort?"Grote kans op "+kleineStart(type)+tijd:basis+"; grote neerslagkans";
  return basisHeeftSoort?"Zeer grote kans op "+kleineStart(type)+tijd:basis+"; zeer grote neerslagkans";
}

const api={kansNiveau,kansHoofd,hoeveelheidTekst,hoeveelheidConditioneel,kansZin,komendUurTekst,briefingZin,dagKansSamenvatting};
if(typeof module!=="undefined"&&module.exports) module.exports=api;
root.WeatherNowKansbeleidV3=api;

if(typeof document==="undefined"||typeof S==="undefined") return;
const interpretatie=root.WeatherNowInterpretatie;
if(!interpretatie||typeof interpretatie.analyseerNeerslagData!=="function") return;
const analyse=duur=>interpretatie.analyseerNeerslagData(S.d,duur,weatherNowActueleLokaleTijd());

/* De centrale briefingrenderer vraagt rechtstreeks briefingZin() op via de
   expliciete buildhaak. Deze laag hoeft de gerenderde briefing dus niet meer
   achteraf te doorzoeken of te herschrijven. */
const basisMeters=meters;
meters=function(){
  basisMeters();
  const a=analyse(60),hoofd=kansHoofd(a);
  if(hoofd==="–"||hoofd==="Droog"||hoofd==="Onzeker") set("pop",hoofd);
  else set("pop",hoofd.replace("%","<s>%</s>"));
  zetTekst("popsub",komendUurTekst(a));
};

const basisNowcast=nowcast;
nowcast=function(){
  basisNowcast();
  const a=analyse(120),tx=document.getElementById("nctext"),grafiek=document.getElementById("nc"),zin=kansZin(a,"de komende twee uur");
  if(tx) tx.textContent=zin;
  if(grafiek) grafiek.setAttribute("aria-label",zin+" Kwartierwaarden zijn sommen over het voorafgaande kwartier en kunnen afhankelijk van de locatie uit uurdata zijn geïnterpoleerd.");
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

})(typeof globalThis!=="undefined"?globalThis:this);

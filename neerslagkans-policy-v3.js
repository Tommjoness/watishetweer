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

const grammatica=typeof module!=="undefined"&&module.exports
  ?require("./nederlandse-weergrammatica.js")
  :root.WeatherNowNederlandseGrammatica;

const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const clamp=v=>Math.max(0,Math.min(100,v));
const hoofdletter=t=>{t=String(t||"");return t?t.charAt(0).toUpperCase()+t.slice(1):t;};
const kleineStart=t=>{t=String(t||"");return t?t.charAt(0).toLowerCase()+t.slice(1):t;};
const SPOOR_MM=0.005;

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
  return " Als er neerslag valt, berekent het model ongeveer "+hoeveelheidTekst(mm)+".";
}

function geenMeetbareHoeveelheid(a){
  const mm=num(a&&a.hoeveelheid);
  return mm===null||mm<=SPOOR_MM;
}

/* Een actuele positieve neerslaghoeveelheid is zelf al een actueel signaal.
   De weather_code kan een cyclus achterlopen; zo'n verschil mag nooit tot de
   consumententekst "Droog" leiden. Als de actuele code het neerslagtype niet
   bevestigt, blijven we bewust generiek en zeggen we alleen "neerslag". */
function actueelNeerslagSignaal(a){
  const mm=num(a&&a.currentHoeveelheid);
  return !!(a&&(a.currentWet||a.status==="NEERSLAG_NU"||(mm!==null&&mm>SPOOR_MM)));
}
function actueleSoort(a){
  return a&&a.currentWet?typeNeerslag(a):"neerslag";
}

/* Kans 0 mag evenmin als droog worden gepresenteerd wanneer dezelfde analyse
   een toekomstige spoor- of meetbare hoeveelheid bevat. In zo'n intern
   tegenstrijdig geval is "onzeker" feitelijker dan een absolute droogclaim. */
function tegenstrijdigDroogSignaal(a){
  const mm=num(a&&a.hoeveelheid);
  const natteStatus=a&&(a.status==="SPOORHOEVEELHEID"||a.status==="NEERSLAG_VERWACHT");
  return kansNiveau(a&&a.kans)==="DROOG"&&((mm!==null&&mm>SPOOR_MM)||natteStatus);
}

function typeNeerslag(a){
  const soort=String(a&&a.soort||"neerslag").trim();
  return soort||"neerslag";
}

/* Een dagregel is een samenvatting, geen uurmeting. eersteTijd kan bovendien
   een minuutwaarde uit de actuele model-/fixturetijd dragen (zoals 12:25), wat
   in een zevendaagse verwachting onterecht preciezer oogt dan de bron is.
   Exacte tijden blijven beschikbaar in de uurgrafiek en tooltip; hier tonen we
   alleen het natuurlijke deel van de lokale dag. */
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

function kansHoofd(a){
  if(!a||!a.genoeg) return "–";
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

function kansZin(a,venster,opties){
  opties=opties||{};
  if(!a||!a.genoeg) return opties.kort?"Neerslagkans niet beschikbaar.":"Voor "+venster+" ontbreken voldoende gegevens voor een betrouwbare neerslaginschatting.";
  const soort=typeNeerslag(a),k=num(a.kans),niveau=kansNiveau(k);
  if(actueelNeerslagSignaal(a)) return grammatica.actueleNeerslagZin(actueleSoort(a));
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
  if(actueelNeerslagSignaal(a)) return grammatica.actueleNeerslagZin(actueleSoort(a));
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
  if(actueelNeerslagSignaal(a)) return grammatica.actueleNeerslagZin(actueleSoort(a));
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

const api={kansNiveau,kansHoofd,hoeveelheidTekst,hoeveelheidConditioneel,kansZin,komendUurTekst,briefingZin,dagMomentZinsdeel,dagKansSamenvatting};
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
  if(hoofd==="–"||hoofd==="Droog"||hoofd==="Onzeker"||hoofd==="Neerslag") set("pop",hoofd);
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
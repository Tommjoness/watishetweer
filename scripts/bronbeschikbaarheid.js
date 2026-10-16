"use strict";

/* Beoordeling van de bronnen achter de park- en vakantiepagina's voor de
   productiesmoke (verslag B6). Drie uitkomsten worden bewust gescheiden en nooit
   als volledige acceptatie samengevoegd:
   - BEWEZEN: er kwam geldige data;
   - FOUTCONTRACT: alle bronnen gaven een nette onbeschikbaarheid. Dat bewijst
     alleen het foutcontract van de route, niet dat de datalevering werkt;
   - NIET_UITGEVOERD: de controle zelf kon niet worden afgerond (timeout,
     netwerkfout, gedeeltelijk of onleesbaar antwoord).
   Een kapot contract (ongeldig 200-antwoord van de eigen route, onbekende status)
   gooit een fout en laat de smoke falen. */

const UITKOMST=Object.freeze({
  BEWEZEN:"datalevering bewezen",
  FOUTCONTRACT:"alleen foutcontract bewezen, geen datalevering",
  STORING:"bron in storing",
  NIET_UITGEVOERD:"controle niet uitgevoerd"
});

function geldigeUurDagdata(json,minUren){
  return !!(json&&typeof json==="object"&&json.hourly&&Array.isArray(json.hourly.time)&&json.hourly.time.length>=minUren);
}

/* resultaat: {fout:string} of {status:number, bron:string|null, json:object|null} */
function beoordeelReserve(resultaat){
  if(!resultaat||resultaat.fout)return {uitkomst:UITKOMST.NIET_UITGEVOERD,reden:resultaat&&resultaat.fout||"geen resultaat"};
  const {status,bron,json}=resultaat;
  if(status===200){
    if(!["visualcrossing","weatherapi"].includes(bron))throw new Error("forecast-reserveroute noemt geen bekende bron");
    if(!geldigeUurDagdata(json,24))throw new Error("forecast-reserveroute mist uurdata");
    if(!(json.daily&&Array.isArray(json.daily.time)&&json.daily.time.length>=7))throw new Error("forecast-reserveroute mist zeven dagen");
    return {uitkomst:UITKOMST.BEWEZEN,reden:"bron "+bron};
  }
  if(status===503){
    if(!json||json.beschikbaar!==false)throw new Error("gedegradeerde forecast-reserveroute moet beschikbaar:false melden");
    return {uitkomst:UITKOMST.FOUTCONTRACT,reden:"Visual Crossing en WeatherAPI leveren nu niets"};
  }
  throw new Error("forecast-reserveroute geeft ongeldige status "+status);
}

/* resultaat: {fout:string} of {status:number, json:object|null} van Open-Meteo zelf */
function beoordeelOpenMeteo(resultaat){
  if(!resultaat||resultaat.fout)return {uitkomst:UITKOMST.NIET_UITGEVOERD,reden:resultaat&&resultaat.fout||"geen resultaat"};
  const {status,json}=resultaat;
  if(status===200){
    return geldigeUurDagdata(json,1)
      ?{uitkomst:UITKOMST.BEWEZEN,reden:"geldige uurdata"}
      :{uitkomst:UITKOMST.NIET_UITGEVOERD,reden:"onvolledig of onleesbaar antwoord"};
  }
  if(status===429||status>=500)return {uitkomst:UITKOMST.STORING,reden:"HTTP "+status};
  return {uitkomst:UITKOMST.NIET_UITGEVOERD,reden:"onverwachte HTTP-status "+status};
}

/* Eindoordeel voor park- en vakantiepagina's. volledig=true alleen als de pagina's
   aantoonbaar data kunnen leveren én de reserveketen niet onbewezen is. */
function samenvatting(openMeteo,reserve){
  const om=openMeteo.uitkomst,rs=reserve.uitkomst,B=UITKOMST.BEWEZEN;
  const regel=`Open-Meteo: ${om} (${openMeteo.reden}); reserveroute: ${rs} (${reserve.reden})`;
  if(om===B&&rs===B)return {volledig:true,tekst:`Datalevering park/vakantie bewezen via Open-Meteo; reserveroute bewezen. ${regel}.`};
  if(om===UITKOMST.STORING&&rs===B)return {volledig:true,tekst:`Open-Meteo is in storing; park/vakantie leveren via de reserveroute (bewezen). ${regel}.`};
  if(om===UITKOMST.STORING&&rs===UITKOMST.FOUTCONTRACT)return {volledig:false,tekst:`GEEN datalevering voor park/vakantie bewezen: beide bronnen in storing; de pagina's tonen nu "niet beschikbaar". Dat het foutcontract van de route klopt bewijst de datalevering niet. ${regel}.`};
  if(om===B)return {volledig:false,tekst:`Datalevering park/vakantie bewezen via Open-Meteo, maar de reserveroute is niet bewezen. ${regel}.`};
  return {volledig:false,tekst:`ONVOLLEDIGE controle: datalevering park/vakantie niet bewezen. ${regel}.`};
}

module.exports={UITKOMST,beoordeelReserve,beoordeelOpenMeteo,samenvatting};

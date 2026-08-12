/* Wereldwijde locatiehardening.
   Twee productregels horen onafhankelijk van land, taal of plaatsnaam te gelden:
   1. zoekresultaten mogen dezelfde geografische plaats niet dubbel aanbieden;
   2. een waarschuwing mag alleen als plaatswaarschuwing worden getoond wanneer
      de bron expliciet bewijst dat het gekozen punt binnen het gebied valt.

   De module verandert geen weerwaarden, modellen of formules. Hij normaliseert
   uitsluitend responses van de bestaande geocoding- en waarschuwingroutes. */
(function(root){
"use strict";

const tekst=v=>String(v==null?"":v).trim().toLocaleLowerCase("und").normalize("NFKC");
const coord=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v).toFixed(5):"";

function zoekSleutel(r){
  if(!r||typeof r!=="object")return null;
  if(r.id!==null&&r.id!==undefined&&String(r.id).trim()!=="")return "id:"+String(r.id).trim();
  return [
    tekst(r.name),tekst(r.admin1),tekst(r.admin2),tekst(r.country_code||r.country),
    coord(r.latitude),coord(r.longitude)
  ].join("|");
}

function dedupliceerZoekresultaten(resultaten){
  const uit=[],gezien=new Set();
  for(const r of (Array.isArray(resultaten)?resultaten:[])){
    const sleutel=zoekSleutel(r);
    if(!sleutel||gezien.has(sleutel))continue;
    gezien.add(sleutel);uit.push(r);
  }
  return uit;
}

function alleenPlaatsgebondenWaarschuwingen(data){
  if(!data||typeof data!=="object")return data;
  const lijst=Array.isArray(data.lijst)?data.lijst:[];
  if(data.dekking!==true)return Object.assign({},data,{lijst:[]});

  const bewezen=lijst.filter(w=>w&&w.plaatsSpecifiek===true&&w.landelijk!==true);
  const bronIsNietPlaatsSpecifiek=data.plaatsSpecifiek===false;
  const bronHadAlleenOnbewezenKaarten=lijst.length>0&&bewezen.length===0;
  if(bronIsNietPlaatsSpecifiek||bronHadAlleenOnbewezenKaarten){
    return Object.assign({},data,{
      dekking:false,
      lijst:[],
      reden:"geen plaats-specifieke dekking",
      plaatsSpecifiek:false
    });
  }
  return Object.assign({},data,{lijst:bewezen});
}

const api={zoekSleutel,dedupliceerZoekresultaten,alleenPlaatsgebondenWaarschuwingen};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowGlobalLocationHardening=api;

/* In de browser blijven de bestaande request-eigenaars intact. j() wordt alleen
   na een succesvolle response door een fail-closed normalisatiestap geleid.
   Daardoor profiteren huidige én toekomstige zoek-/waarschuwingsaanroepers van
   hetzelfde contract zonder stad-, land- of bronspecifieke uitzonderingen. */
if(typeof document==="undefined"||typeof j!=="function")return;
const basisJ=j;
j=async function(url,opt){
  const data=await basisJ(url,opt),u=String(url||"");
  if(u.includes("geocoding-api.open-meteo.com/v1/search?")){
    if(!data||typeof data!=="object")return data;
    return Object.assign({},data,{results:dedupliceerZoekresultaten(data.results)});
  }
  if(u.includes("/api/waarschuwingen?"))return alleenPlaatsgebondenWaarschuwingen(data);
  return data;
};

})(typeof globalThis!=="undefined"?globalThis:this);

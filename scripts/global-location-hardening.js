/* Wereldwijde locatiehardening.
   Productregels die onafhankelijk van land, taal of plaatsnaam horen te gelden:
   1. zoekresultaten mogen dezelfde geografische plaats niet dubbel aanbieden;
   2. deduplicatie mag niet stil minder keus opleveren als de provider verderop
      nog unieke resultaten heeft;
   3. externe geocodingdata mag alleen de UI in met geldige naam/coördinaten;
   4. iedere locatie die de forecastgrens bereikt moet geldige wereldcoördinaten hebben;
   5. een waarschuwing mag alleen als plaatswaarschuwing worden getoond wanneer
      de bron expliciet bewijst dat het gekozen punt binnen het gebied valt.

   De module verandert geen weerwaarden, modellen of formules. Geocoding en de
   centrale locatie-ingang worden in de browser genormaliseerd; waarschuwingsscope
   wordt aan de servergrens genormaliseerd zodat er maar één eigenaar per contract is. */
(function(root){
"use strict";

const MAX_ZOEKRESULTATEN=6;
const PROVIDER_ZOEKVENSTER=12;
const tekst=v=>String(v==null?"":v).trim().toLocaleLowerCase("und").normalize("NFKC");
const coord=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v).toFixed(5):"";

function geldigeCoordinaat(v,min,max){
  if(v===null||v===undefined||String(v).trim()==="")return null;
  const n=Number(v);
  return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}

function normaliseerLaadCoordinaten(lat,lon){
  const latitude=geldigeCoordinaat(lat,-90,90),longitude=geldigeCoordinaat(lon,-180,180);
  return latitude===null||longitude===null?null:{latitude,longitude};
}

/* Open-Meteo levert normaal keurige numerieke coördinaten, maar zoekdata blijft
   externe invoer. De bestaande renderer plaatst latitude/longitude rechtstreeks
   in data-attributen; daarom normaliseren we die grens hier naar echte eindige
   getallen en laten we onvolledige/malforme resultaten helemaal weg. Zo blijft
   de renderer simpel zonder op providervertrouwen te leunen. */
function normaliseerZoekresultaat(r){
  if(!r||typeof r!=="object")return null;
  const name=String(r.name==null?"":r.name).trim();
  const latitude=geldigeCoordinaat(r.latitude,-90,90);
  const longitude=geldigeCoordinaat(r.longitude,-180,180);
  if(!name||latitude===null||longitude===null)return null;
  return Object.assign({},r,{name,latitude,longitude});
}

function zoekSleutel(r){
  if(!r||typeof r!=="object")return null;
  if(r.id!==null&&r.id!==undefined&&String(r.id).trim()!=="")return "id:"+String(r.id).trim();
  return [
    tekst(r.name),tekst(r.admin1),tekst(r.admin2),tekst(r.country_code||r.country),
    coord(r.latitude),coord(r.longitude)
  ].join("|");
}

function dedupliceerZoekresultaten(resultaten,max){
  const uit=[],gezien=new Set(),limiet=Number.isInteger(max)&&max>=0?max:Infinity;
  for(const bron of (Array.isArray(resultaten)?resultaten:[])){
    const r=normaliseerZoekresultaat(bron);
    if(!r)continue;
    const sleutel=zoekSleutel(r);
    if(!sleutel||gezien.has(sleutel))continue;
    gezien.add(sleutel);uit.push(r);
    if(uit.length>=limiet)break;
  }
  return uit;
}

function verruimZoekUrl(url){
  const s=String(url||"");
  if(!s.includes("geocoding-api.open-meteo.com/v1/search?"))return s;
  try{
    const absoluut=/^https?:\/\//i.test(s);
    const u=new URL(s,absoluut?undefined:"https://watishetweer.invalid/");
    const bestaand=Number(u.searchParams.get("count"));
    if(!Number.isFinite(bestaand)||bestaand<PROVIDER_ZOEKVENSTER)u.searchParams.set("count",String(PROVIDER_ZOEKVENSTER));
    return absoluut?u.href:u.pathname+u.search+u.hash;
  }catch(e){
    return s.replace(/([?&])count=\d+/i,"$1count="+PROVIDER_ZOEKVENSTER);
  }
}

/* Zelfde pure contract als de servermodule, voor compacte unitdekking. De
   productie-requestroute gebruikt lib/waarschuwing-scope.cjs als enige runtime
   eigenaar; deze helper wordt niet nogmaals over een al genormaliseerde
   /api/waarschuwingen-response heen gezet. */
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

const api={MAX_ZOEKRESULTATEN,PROVIDER_ZOEKVENSTER,geldigeCoordinaat,normaliseerLaadCoordinaten,normaliseerZoekresultaat,zoekSleutel,dedupliceerZoekresultaten,verruimZoekUrl,alleenPlaatsgebondenWaarschuwingen};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowGlobalLocationHardening=api;

/* In de browser blijft deze laag eigenaar van de externe locatiegrenzen. Eerst
   wordt iedere load-aanroep op echte wereldcoördinaten begrensd; daarna blijft
   de bestaande geocodingwrapper verantwoordelijk voor providerresultaten. */
if(typeof document==="undefined"||typeof j!=="function")return;

if(typeof load==="function"){
  const basisLoad=load;
  load=async function(lat,lon,label,stil,opslaan,land){
    const positie=normaliseerLaadCoordinaten(lat,lon);
    if(!positie){
      if(stil!==true){
        const st=document.getElementById("state");
        if(st){
          st.style.display="block";
          st.className="msg err";
          st.textContent="Deze locatie is ongeldig. Zoek een plaats of gebruik Mijn locatie.";
        }
      }
      return false;
    }
    return basisLoad(positie.latitude,positie.longitude,label,stil,opslaan,land);
  };
}

const basisJ=j;
j=async function(url,opt){
  const oorspronkelijk=String(url||""),isZoek=oorspronkelijk.includes("geocoding-api.open-meteo.com/v1/search?");
  const requestUrl=isZoek?verruimZoekUrl(oorspronkelijk):url;
  const data=await basisJ(requestUrl,opt);
  if(isZoek){
    if(!data||typeof data!=="object")return data;
    return Object.assign({},data,{results:dedupliceerZoekresultaten(data.results,MAX_ZOEKRESULTATEN)});
  }
  return data;
};

})(typeof globalThis!=="undefined"?globalThis:this);

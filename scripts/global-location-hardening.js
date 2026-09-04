/* Wereldwijde locatiehardening.
   Productregels die onafhankelijk van land, taal of plaatsnaam horen te gelden:
   1. zoekresultaten mogen dezelfde geografische plaats niet dubbel aanbieden;
   2. deduplicatie mag niet stil minder keus opleveren als de provider verderop
      nog unieke resultaten heeft;
   3. externe geocodingdata mag alleen de UI in met geldige naam/coördinaten;
   4. iedere locatie die de forecastgrens bereikt moet geldige wereldcoördinaten hebben;
   5. gedeelde URL-coördinaten worden uit de ruwe URL strikt gevalideerd en blijven
      tijdens achtergrondverversing buiten de persoonlijke laatst-gebruikte opslag;
   6. een onbewezen landcode uit een gedeelde URL mag waarschuwingrouting niet bepalen;
   7. een waarschuwing mag alleen als plaatswaarschuwing worden getoond wanneer
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

/* Een gedeelde link is externe invoer. parseFloat("52abc") wordt 52 en zou dus
   een beschadigde URL stil naar een andere maar geldige locatie kunnen laten
   wijzen. Lees daarom de ONGEWIJZIGDE querywaarden met dezelfde strikte
   Number/wereldgrenzen als alle andere locatie-ingangen. */
function gedeeldeUrlCoordinaten(zoek){
  let p;
  try{
    if(zoek&&typeof zoek.has==="function"&&typeof zoek.get==="function")p=zoek;
    else p=new URLSearchParams(String(zoek==null?"":zoek).replace(/^\?/,""));
  }catch(_){return {aanwezig:false,geldig:false,latitude:null,longitude:null};}
  const aanwezig=p.has("lat")||p.has("lon");
  if(!aanwezig)return {aanwezig:false,geldig:false,latitude:null,longitude:null};
  const positie=normaliseerLaadCoordinaten(p.get("lat"),p.get("lon"));
  return positie
    ?{aanwezig:true,geldig:true,latitude:positie.latitude,longitude:positie.longitude}
    :{aanwezig:true,geldig:false,latitude:null,longitude:null};
}

/* De URL is alleen eigenaar van een load die diezelfde URL-positie probeert te
   laden. Na een bewuste client-side locatiekeuze kan de adresbalk nog heel kort
   de vorige deel-URL bevatten; die oude URL mag de nieuwe aanroep dan nooit
   terugtrekken. De 0,0011-grens dekt uitsluitend de bestaande 3-decimaal-share-
   afronding af en is geen geografische plaatsmatching. */
function gedeeldeUrlPastBijAanroep(gedeeld,lat,lon){
  const positie=normaliseerLaadCoordinaten(lat,lon);
  if(!gedeeld||gedeeld.geldig!==true||!positie)return false;
  return Math.abs(positie.latitude-Number(gedeeld.latitude))<=0.0011&&Math.abs(positie.longitude-Number(gedeeld.longitude))<=0.0011;
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

/* De Nederlandstalige providerindex kent sommige wereldsteden alleen onder de
   Nederlandse naam (bijvoorbeeld "Tokio"). Iemand die "Tokyo" invoert hoort
   niet ten onrechte "Niets gevonden" te krijgen. Als de Nederlandse index nog
   geen volledige consumentenset oplevert, vullen we die aan vanuit de Engelse
   index en dedupliceren we daarna op naam en coördinaten. */
function zoekFallbackTaalUrl(url){
  const s=String(url||"");
  if(!s.includes("geocoding-api.open-meteo.com/v1/search?"))return s;
  try{
    const absoluut=/^https?:\/\//i.test(s);
    const u=new URL(s,absoluut?undefined:"https://watishetweer.invalid/");
    const taal=String(u.searchParams.get("language")||"").toLowerCase();
    if(taal&&taal!=="nl")return s;
    u.searchParams.set("language","en");
    return absoluut?u.href:u.pathname+u.search+u.hash;
  }catch(_){
    if(/([?&])language=nl(?:&|$)/i.test(s))return s.replace(/([?&])language=nl(?=&|$)/i,"$1language=en");
    return s+(s.includes("?")?"&":"?")+"language=en";
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

const api={MAX_ZOEKRESULTATEN,PROVIDER_ZOEKVENSTER,geldigeCoordinaat,normaliseerLaadCoordinaten,gedeeldeUrlCoordinaten,gedeeldeUrlPastBijAanroep,normaliseerZoekresultaat,zoekSleutel,dedupliceerZoekresultaten,verruimZoekUrl,zoekFallbackTaalUrl,alleenPlaatsgebondenWaarschuwingen};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowGlobalLocationHardening=api;

/* In de browser blijft deze laag eigenaar van de externe locatiegrenzen. Eerst
   wordt iedere load-aanroep op echte wereldcoördinaten begrensd; daarna blijft
   de bestaande geocodingwrapper verantwoordelijk voor providerresultaten. */
if(typeof document==="undefined"||typeof j!=="function")return;

if(typeof load==="function"){
  const basisLoad=load;
  let gedeeldePositie=null;
  const zelfdePositie=(a,b)=>!!(a&&b&&Math.abs(a.latitude-b.latitude)<1e-9&&Math.abs(a.longitude-b.longitude)<1e-9);
  load=async function(lat,lon,label,stil,opslaan,land){
    let positie=null,effectiefLand=land;
    const aanroepPositie=normaliseerLaadCoordinaten(lat,lon);
    let bestaandeLocatie=false;
    try{bestaandeLocatie=!!(typeof S!=="undefined"&&S&&S.d&&Number.isFinite(Number(S.lat))&&Number.isFinite(Number(S.lon)));}catch(_){ }

    /* Alleen de gedeelde-URL-start die werkelijk dezelfde URL-coördinaten laadt
       mag die URL als autoriteit gebruiken. Een oude query in een reeds actieve
       client-side sessie mag een latere bewuste load niet terugdraaien. Een
       malforme initiële deep link blijft echter altijd raw fail-closed, ook als
       historische startupcode met parseFloat nog een schijnbaar geldig getal
       uit die beschadigde query wist te halen. */
    if(stil!==true&&opslaan===false&&typeof location!=="undefined"){
      const gedeeld=gedeeldeUrlCoordinaten(location.search);
      if(gedeeld.aanwezig){
        if(!gedeeld.geldig){
          if(!bestaandeLocatie){
            const st=document.getElementById("state");
            if(st){
              st.style.display="block";
              st.className="msg err";
              st.textContent="Deze gedeelde locatie is ongeldig. Zoek een plaats of gebruik Mijn locatie.";
            }
            return false;
          }
        }else if(gedeeldeUrlPastBijAanroep(gedeeld,lat,lon)){
          positie={latitude:gedeeld.latitude,longitude:gedeeld.longitude};
          gedeeldePositie=positie;
          effectiefLand=null;
        }
      }
    }

    if(!positie)positie=aanroepPositie;
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

    /* Een gedeelde link hoort ook na de eerste request niet de persoonlijke
       laatst-gebruikte locatie te worden. Achtergrond-/handmatige refreshes
       gebruiken stil=true; zolang het exact dezelfde gedeelde positie is,
       houden we opslaan dus expliciet uit. Een echte nieuwe gebruikerskeuze is
       niet-stil, beëindigt de gedeelde sessie en mag weer normaal opslaan. */
    let effectiefOpslaan=opslaan;
    if(gedeeldePositie){
      if(stil===true&&zelfdePositie(positie,gedeeldePositie))effectiefOpslaan=false;
      else if(stil!==true&&opslaan!==false)gedeeldePositie=null;
    }

    return basisLoad(positie.latitude,positie.longitude,label,stil,effectiefOpslaan,effectiefLand);
  };
}

const basisJ=j;
j=async function(url,opt){
  const oorspronkelijk=String(url||""),isZoek=oorspronkelijk.includes("geocoding-api.open-meteo.com/v1/search?");
  const requestUrl=isZoek?verruimZoekUrl(oorspronkelijk):url;
  let data=await basisJ(requestUrl,opt);
  if(isZoek){
    const eersteResultaten=data&&Array.isArray(data.results)?data.results:[];
    if(eersteResultaten.length<MAX_ZOEKRESULTATEN){
      const fallbackUrl=zoekFallbackTaalUrl(requestUrl);
      if(fallbackUrl!==requestUrl){
        const fallbackData=await basisJ(fallbackUrl,opt);
        if(fallbackData&&typeof fallbackData==="object"){
          const aanvulling=Array.isArray(fallbackData.results)?fallbackData.results:[];
          data=Object.assign({},data,{results:eersteResultaten.concat(aanvulling)});
        }
      }
    }
    if(!data||typeof data!=="object")return data;
    return Object.assign({},data,{results:dedupliceerZoekresultaten(data.results,MAX_ZOEKRESULTATEN)});
  }
  return data;
};

})(typeof globalThis!=="undefined"?globalThis:this);

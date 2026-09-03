/* Zichtbare feedback bij locatiewissels zonder oude en nieuwe weerdata te mengen.
   De volledige forecast blijft de enige bron voor alle uiteindelijke waarden.
   De oudere current-only helpers blijven als pure compatibiliteits-API bestaan,
   maar de runtime gebruikt ze niet meer: bij een wissel blijft de bestaande
   forecast volledig staan tot de nieuwe volledige forecast is gecommit. */
(function(root){
"use strict";

const SNEL_START_VERTRAGING_MS=120;
const SNEL_TIMEOUT_MS=3000;
/* Compatibiliteitsmarker voor oudere build-/contractchecks. Deze tekst wordt
   nergens meer als zichtbare runtime-status gebruikt. */
const LEGACY_PREVIEW_STATUS="Verwachting wordt aangevuld.";
const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;

/* Compatibiliteitshelpers: niet meer gebruikt door de runtime. */
function snellePreviewUrl(lat,lon){
  const a=getal(lat),b=getal(lon);
  if(a===null||b===null)return null;
  return "https://api.open-meteo.com/v1/forecast?latitude="+encodeURIComponent(a)
    +"&longitude="+encodeURIComponent(b)
    +"&current=temperature_2m,apparent_temperature,is_day,weather_code"
    +"&timezone=auto";
}
function normaliseerSnellePreview(data){
  const d=data&&typeof data==="object"?data:{},c=d.current&&typeof d.current==="object"?d.current:{};
  const temperatuur=getal(c.temperature_2m),gevoel=getal(c.apparent_temperature),code=getal(c.weather_code),isDag=getal(c.is_day);
  if(temperatuur===null||code===null||(isDag!==0&&isDag!==1))return null;
  return {
    temperatuur:Math.round(temperatuur),
    gevoel:gevoel===null?null:Math.round(gevoel),
    code:Math.round(code),
    isDag:isDag===1,
    tijdzone:typeof d.timezone==="string"?d.timezone:""
  };
}
/* Behouden voor bestaande contracttests; nieuwe runtime gebruikt geen preview. */
function progressievePreviewToegestaan(stil,wissel,dataVoorLoad){return false;}
function behoudBestaandeForecast(stil,wissel,dataVoorLoad){return !stil&&!!wissel&&!!dataVoorLoad;}

/* De basisloader vangt netwerkfouten zelf af en retourneert daarom geen aparte
   successtatus. Bij een locatiewissel kan S.d vóór de request nog de forecast
   van de vorige plaats bevatten. Alleen coords + !!S.d controleren is dan niet
   genoeg: na een mislukte request staan de coords al op het nieuwe doel terwijl
   S.d nog exact hetzelfde oude object kan zijn. */
function classificeerEindstate(dataVoor,huidigeData,huidigeLat,huidigeLon,doelLat,doelLon){
  if(!huidigeData)return "geen-data";
  const opDoel=Number(huidigeLat)===Number(doelLat)&&Number(huidigeLon)===Number(doelLon);
  if(!opDoel)return "cache-fallback";
  return huidigeData===dataVoor?"oude-data-op-doel":"doeldata";
}

const api={snellePreviewUrl,normaliseerSnellePreview,progressievePreviewToegestaan,behoudBestaandeForecast,classificeerEindstate,SNEL_START_VERTRAGING_MS,SNEL_TIMEOUT_MS,LEGACY_PREVIEW_STATUS};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowProgressiveLocation=api;

if(typeof document==="undefined"||typeof load!=="function")return;

const perf=root.WeatherNowProgressiveLocationPerformance={previewHits:0,lastPreviewMs:null,lastFullMs:null};
const nuMs=()=>root.performance&&typeof root.performance.now==="function"?root.performance.now():Date.now();
let generatie=0,stabieleLocatie=null;
function onthoudStabieleLocatie(){
  if(!S.d)return;
  stabieleLocatie={data:S.d,lat:S.lat,lon:S.lon,label:S.label,land:S.land};
}

function statusElement(){
  let el=document.getElementById("locatie-laadstatus");
  if(el)return el;
  const stamp=document.getElementById("stamp");
  if(!stamp||!stamp.parentNode)return null;
  el=document.createElement("div");
  el.id="locatie-laadstatus";
  el.className="locatie-laadstatus";
  el.setAttribute("role","status");
  el.setAttribute("aria-live","polite");
  el.setAttribute("aria-atomic","true");
  el.hidden=true;
  el.innerHTML='<span class="locatie-spinner" aria-hidden="true"></span><span class="locatie-status-tekst"></span><button type="button" class="locatie-status-retry" hidden>Opnieuw</button>';
  stamp.parentNode.insertBefore(el,stamp);
  return el;
}
function statusTekst(el){return el&&el.querySelector(".locatie-status-tekst");}
function statusRetry(el){return el&&el.querySelector(".locatie-status-retry");}
function statusLaden(label){
  const el=statusElement(),stamp=document.getElementById("stamp");
  if(!el)return;
  const tekst=statusTekst(el),retry=statusRetry(el);
  el.classList.remove("fout");el.hidden=false;
  if(tekst)tekst.textContent="Weer voor "+String(label||"deze locatie")+" ophalen…";
  if(retry){retry.hidden=true;retry.onclick=null;}
  if(stamp)stamp.hidden=true;
}
function statusFout(label,opnieuw){
  const el=statusElement(),stamp=document.getElementById("stamp");
  if(!el)return;
  const tekst=statusTekst(el),retry=statusRetry(el);
  el.classList.add("fout");el.hidden=false;
  if(tekst)tekst.textContent=String(label||"Deze locatie")+" niet geladen. Huidige gegevens blijven staan.";
  if(retry){retry.hidden=false;retry.onclick=typeof opnieuw==="function"?opnieuw:null;}
  if(stamp)stamp.hidden=true;
}
function statusWis(){
  const el=document.getElementById("locatie-laadstatus"),stamp=document.getElementById("stamp");
  if(el){
    const retry=statusRetry(el);
    el.hidden=true;el.classList.remove("fout");
    if(retry){retry.hidden=true;retry.onclick=null;}
  }
  if(stamp)stamp.hidden=false;
}
function busy(aan){
  const app=document.getElementById("app"),q=document.getElementById("q");
  if(app){if(aan)app.setAttribute("aria-busy","true");else app.removeAttribute("aria-busy");}
  if(q){if(aan)q.setAttribute("aria-busy","true");else q.removeAttribute("aria-busy");}
}
function stateSnapshot(){
  const el=document.getElementById("state");
  return el?{display:el.style.display,className:el.className,text:el.textContent}:null;
}
function stateHerstel(s){
  const el=document.getElementById("state");if(!el||!s)return;
  el.style.display=s.display;el.className=s.className;el.textContent=s.text;
}

const basisLoad=load;
load=async function(lat,lon,label,stil,opslaan,land){
  const mijnGeneratie=++generatie,start=nuMs();
  const doelLat=Number(lat),doelLon=Number(lon);
  const wissel=S.lat!==doelLat||S.lon!==doelLon;
  const dataVoorLoad=S.d;
  const zichtbareActie=!stil;
  const bewaren=behoudBestaandeForecast(stil,wissel,dataVoorLoad);
  const stabiel=stabieleLocatie&&stabieleLocatie.data===dataVoorLoad?stabieleLocatie:null;
  const vorige=bewaren?{
    lat:stabiel?stabiel.lat:S.lat,lon:stabiel?stabiel.lon:S.lon,
    label:stabiel?stabiel.label:S.label,land:stabiel?stabiel.land:S.land,
    actieveWaarschuwingen:Array.isArray(S.actieveWaarschuwingen)?S.actieveWaarschuwingen.slice():[]
  }:null;
  /* Een cachefallback kan uit een oudere opslagversie komen zonder landcode.
     Leg de bewezen cachelandcode vóór de targetload vast; ontbreekt die, dan is
     'onbekend' veiliger dan de landcode van de mislukte doellocatie overnemen. */
  const cacheVoorLoad=(typeof ls!=="undefined"&&ls&&typeof ls.get==="function"&&typeof KEY_D!=="undefined")?ls.get(KEY_D,null):null;
  const cacheLandVoorLoad=cacheVoorLoad&&cacheVoorLoad.d&&typeof normLand==="function"?normLand(cacheVoorLoad.land):null;
  const staatVoor=stateSnapshot();
  const waarschuwingEl=document.getElementById("waarschuwingen");
  const waarschuwingenVoor=bewaren&&waarschuwingEl?waarschuwingEl.innerHTML:null;

  if(zichtbareActie){statusLaden(label);busy(true);}
  if(bewaren){
    /* Timers mogen tijdens de wachtfase niet met oude forecast + reeds gestagede
       doelcoördinaten opnieuw tekenen. tekenAlles() start ze na succes opnieuw. */
    if(typeof clearNuTimer==="function")clearNuTimer();
    if(typeof clearKlokTimer==="function")clearKlokTimer();
  }

  try{
    const volledigeBelofte=basisLoad(lat,lon,label,stil,opslaan,land);

    /* basisLoad zet synchronously de generieke melding en leegt waarschuwingen.
       Herstel dit nog binnen dezelfde taak, vóór de browser kan painten. Zo blijft
       de bestaande plaats visueel volledig intact terwijl alleen de compacte
       statusregel bij de zoekbediening verandert. */
    if(zichtbareActie){
      if(bewaren)stateHerstel(staatVoor);
      else{
        const st=document.getElementById("state");if(st)st.style.display="none";
      }
    }
    if(bewaren&&waarschuwingEl)waarschuwingEl.innerHTML=waarschuwingenVoor;

    return await volledigeBelofte;
  }finally{
    perf.lastFullMs=Math.max(0,nuMs()-start);
    if(mijnGeneratie===generatie){
      const eindstate=classificeerEindstate(dataVoorLoad,S.d,S.lat,S.lon,doelLat,doelLon);
      if(eindstate==="doeldata"){
        onthoudStabieleLocatie();
        if(zichtbareActie){statusWis();busy(false);}
      }else{
        if(eindstate==="oude-data-op-doel"&&vorige){
          /* Geen bruikbare fallback: basisLoad heeft alleen target-coördinaten in S
             gezet en de oude forecast ongemoeid gelaten. Zet de state ook intern
             terug naar de werkelijk zichtbare forecast, anders kan een latere resize
             oude data alsnog onder de nieuwe plaatsidentiteit renderen. */
          S.lat=vorige.lat;S.lon=vorige.lon;S.label=vorige.label;S.land=vorige.land;
          S.actieveWaarschuwingen=vorige.actieveWaarschuwingen;
          stateHerstel(staatVoor);
          if(waarschuwingEl)waarschuwingEl.innerHTML=waarschuwingenVoor;
          if(typeof chips==="function")chips();
          if(typeof nuTimerStart==="function")nuTimerStart();
          if(typeof klokTimerStart==="function")klokTimerStart();
        }else if(eindstate==="cache-fallback"){
          /* De basisloader herstelt forecast/coördinaten uit cache, maar een oude
             cache zonder `land` zou anders de target-landcode laten staan. Dat
             kan de direct gestarte waarschuwingrequest verkeerd scopen. Corrigeer
             de identiteit fail-closed en herstart die request met de cachecoords. */
          S.land=cacheLandVoorLoad;
          if(typeof waarschuwingen==="function")void waarschuwingen();
          onthoudStabieleLocatie();
        }

        if(zichtbareActie){
          busy(false);
          const opnieuw=()=>load(lat,lon,label,false,opslaan,land);
          statusFout(label,opnieuw);
        }
      }
    }
  }
};

})(typeof globalThis!=="undefined"?globalThis:this);

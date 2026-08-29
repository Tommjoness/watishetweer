/* Progressieve locatielading voor een nog niet gecachte plaats.
   De volledige forecast blijft de enige bron voor alle uiteindelijke waarden.
   Alleen wanneer een zichtbare locatiewissel op die forecast moet wachten, mag
   een kleine current-only request alvast de plaats, temperatuur en toestand
   tonen. Er worden nooit partial-data in S.d gezet en nooit formules uitgevoerd
   op de snelle response. */
(function(root){
"use strict";

const SNEL_START_VERTRAGING_MS=120;
const SNEL_TIMEOUT_MS=3000;
const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;

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

/* Een current-only preview is nuttig bij een bewuste wissel vanaf een al
   gerenderde plaats. Op de eerste cold load bestaat nog geen veilige vorige
   forecast om tijdelijk naast de preview te houden. Daar veroorzaakte het oude
   display:none -> display:block-pad bovendien de intermitterende 0,539 CLS in
   mobiele PageSpeed-runs. Eerste load wacht daarom rechtstreeks op de volledige
   forecast; latere locatiewissels behouden de bestaande snelle preview. */
function progressievePreviewToegestaan(stil,wissel,dataVoorLoad){
  return !stil&&!!wissel&&!!dataVoorLoad;
}

/* De basisloader vangt netwerkfouten zelf af en retourneert daarom geen aparte
   successtatus. Bij een locatiewissel kan S.d vóór de request nog de forecast
   van de vorige plaats bevatten. Alleen coords + !!S.d controleren is dan niet
   genoeg: na een mislukte request staan de coords al op het nieuwe doel terwijl
   S.d nog exact hetzelfde oude object kan zijn.

   Een nieuw object op de doelcoords is door basisLoad gecommit (verse response
   of een cache voor precies die doelplaats). Data op andere coords is de door
   basisLoad bewust en volledig teruggezette, correct gelabelde laatste briefing.
   Alleen geen data of exact het oude object onder de nieuwe coords is onveilig. */
function classificeerEindstate(dataVoor,huidigeData,huidigeLat,huidigeLon,doelLat,doelLon){
  if(!huidigeData)return "geen-data";
  const opDoel=Number(huidigeLat)===Number(doelLat)&&Number(huidigeLon)===Number(doelLon);
  if(!opDoel)return "cache-fallback";
  return huidigeData===dataVoor?"oude-data-op-doel":"doeldata";
}

const api={snellePreviewUrl,normaliseerSnellePreview,progressievePreviewToegestaan,classificeerEindstate,SNEL_START_VERTRAGING_MS,SNEL_TIMEOUT_MS};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowProgressiveLocation=api;

if(typeof document==="undefined"||typeof load!=="function"||typeof j!=="function")return;

const perf=root.WeatherNowProgressiveLocationPerformance={previewHits:0,lastPreviewMs:null,lastFullMs:null};
const nuMs=()=>root.performance&&typeof root.performance.now==="function"?root.performance.now():Date.now();
let generatie=0,actievePreviewController=null,actievePreviewTimer=null;

function stopPreviewPresentatie(){
  document.documentElement.classList.remove("wn-progressief");
  const app=document.getElementById("app");
  if(app){app.classList.remove("wn-progressief");app.removeAttribute("aria-busy");}
}

function bereidPreviewVoor(){
  stopPreviewPresentatie();
  document.documentElement.classList.add("wn-progressief");
  const app=document.getElementById("app");
  if(app){app.classList.add("wn-progressief");app.setAttribute("aria-busy","true");app.style.display="none";}
}

function renderSnellePreview(data,label,lat,lon){
  const p=normaliseerSnellePreview(data);if(!p)return false;
  const app=document.getElementById("app"),state=document.getElementById("state"),place=document.getElementById("place");
  if(!app||!state||!place)return false;

  const naam=String(label||"");
  place.setAttribute("aria-label",naam);
  place.innerHTML=(typeof esc==="function"?esc(naam):naam)+"<span id=\"plaatstijd\" aria-hidden=\"true\"></span>";
  document.title=naam+" · Wat is het weer?";
  const temp=document.getElementById("t");if(temp)temp.textContent=String(p.temperatuur);
  const cond=document.getElementById("cond");if(cond&&typeof txt==="function")cond.textContent=txt(p.code,p.isDag);
  const feels=document.getElementById("feels");if(feels)feels.textContent=p.gevoel===null?"Gevoelstemperatuur niet beschikbaar":"Gevoelstemperatuur "+p.gevoel+"°C";
  const ico=document.getElementById("nowicon");if(ico&&typeof icon==="function")ico.innerHTML=icon(p.code,p.isDag,46);
  const coords=document.getElementById("coords");
  if(coords&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lon)))coords.textContent=Number(lat).toFixed(3)+", "+Number(lon).toFixed(3)+(p.tijdzone?" · "+p.tijdzone:"");

  state.style.display="block";state.className="msg";state.textContent="Verwachting wordt aangevuld.";
  app.style.display="block";
  return true;
}

const basisLoad=load;
load=async function(lat,lon,label,stil,opslaan,land){
  const mijnGeneratie=++generatie,start=nuMs();
  if(actievePreviewTimer!==null){clearTimeout(actievePreviewTimer);actievePreviewTimer=null;}
  if(actievePreviewController){actievePreviewController.abort();actievePreviewController=null;}
  stopPreviewPresentatie();

  const nieuweLat=Number(lat),nieuweLon=Number(lon);
  const wissel=S.lat!==nieuweLat||S.lon!==nieuweLon;
  const dataVoorLoad=S.d;
  const progressief=progressievePreviewToegestaan(stil,wissel,dataVoorLoad);
  if(progressief)bereidPreviewVoor();

  let volledigKlaar=false,lokaleController=null,previewGetoond=false;
  const volledigeBelofte=basisLoad(lat,lon,label,stil,opslaan,land);

  if(progressief){
    actievePreviewTimer=setTimeout(()=>{
      actievePreviewTimer=null;
      if(mijnGeneratie!==generatie||volledigKlaar)return;
      const url=snellePreviewUrl(lat,lon);if(!url)return;
      const controller=new AbortController();
      lokaleController=controller;actievePreviewController=controller;
      const previewStart=nuMs();
      j(url,{timeoutMs:SNEL_TIMEOUT_MS,signal:controller.signal}).then(data=>{
        if(mijnGeneratie!==generatie||volledigKlaar||controller.signal.aborted)return;
        if(renderSnellePreview(data,label,lat,lon)){
          previewGetoond=true;
          perf.previewHits++;
          perf.lastPreviewMs=Math.max(0,nuMs()-previewStart);
        }
      }).catch(()=>{});
    },SNEL_START_VERTRAGING_MS);
  }

  try{
    return await volledigeBelofte;
  }finally{
    volledigKlaar=true;
    perf.lastFullMs=Math.max(0,nuMs()-start);
    if(actievePreviewTimer!==null&&mijnGeneratie===generatie){clearTimeout(actievePreviewTimer);actievePreviewTimer=null;}
    if(lokaleController)lokaleController.abort();
    if(actievePreviewController===lokaleController)actievePreviewController=null;
    if(mijnGeneratie===generatie){
      const eindstate=classificeerEindstate(dataVoorLoad,S.d,S.lat,S.lon,nieuweLat,nieuweLon);
      /* Een preview mag alleen blijven staan wanneer de basisloader hem met
         veilige doeldata verving. Een expliciet gelabelde cachefallback heeft
         basisLoad zelf al volledig gerenderd en blijft eveneens zichtbaar. Bij
         geen data of een oud S.d-object onder de nieuwe coords verbergen we de
         preview vóór de tijdelijke CSS wordt verwijderd, zodat details van de
         vorige plaats nooit onder de nieuwe plaatsnaam kunnen verschijnen. */
      if(progressief&&previewGetoond&&(eindstate==="geen-data"||eindstate==="oude-data-op-doel")){
        const app=document.getElementById("app");if(app)app.style.display="none";
      }
      stopPreviewPresentatie();
    }
  }
};

})(typeof globalThis!=="undefined"?globalThis:this);

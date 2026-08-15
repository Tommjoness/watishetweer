/* Extra neerslagproviders.
 *
 * Nederland blijft via de bestaande KNMI-client lopen voor actuele neerslag.
 * Deze laag activeert dezelfde generieke /api/neerslag-route voor expliciet
 * toegevoegde landen. Een providerfout mag nooit de gewone Open-Meteo-load
 * blokkeren of vervangen.
 */
(function(root){
"use strict";

if(typeof document==="undefined"||typeof S==="undefined"||typeof load!=="function")return;
const EXTRA_LANDEN=new Set(["BE"]);
let generatie=0,controller=null,timer=null,laatsteSleutel="";

const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const landcode=v=>String(v||"").trim().toUpperCase();
const ondersteund=land=>EXTRA_LANDEN.has(landcode(land));
const beleid=()=>root.WeatherNowKansbeleidV3||null;

function stop(){
  generatie++;
  if(controller){controller.abort();controller=null;}
  if(timer!==null){clearTimeout(timer);timer=null;}
  laatsteSleutel="";
}

function zetPayload(payload){
  if(!S.d||!payload||payload.beschikbaar!==true)return false;
  try{Object.defineProperty(S.d,"__knmiNeerslag",{value:payload,writable:true,configurable:true,enumerable:false});}
  catch(e){S.d.__knmiNeerslag=payload;}
  return true;
}

function herstelModelConditie(){
  if(!S.d||!S.d.current)return;
  const c=S.d.current,cond=document.getElementById("cond"),ico=document.getElementById("nowicon"),mini=document.getElementById("minicond");
  if(cond&&typeof txt==="function")cond.textContent=txt(c.weather_code,c.is_day!==0);
  if(ico&&typeof icon==="function")ico.innerHTML=icon(c.weather_code,c.is_day===1,46);
  if(mini&&typeof txt==="function")mini.textContent=txt(c.weather_code,c.is_day!==0);
}

function werkActueleConditieBij(){
  const api=root.WeatherNowInterpretatie;
  if(!api||typeof api.analyseerNeerslagData!=="function"||!S.d||!S.d.current)return;
  const nu=typeof weatherNowActueleLokaleTijd==="function"?weatherNowActueleLokaleTijd():null;
  const a=api.analyseerNeerslagData(S.d,120,nu);
  if(!a||!a.currentRadarWet){herstelModelConditie();return;}
  const cond=document.getElementById("cond"),ico=document.getElementById("nowicon"),mini=document.getElementById("minicond");
  const tekst=a.soort&&a.soort!=="neerslag"?String(a.soort).charAt(0).toUpperCase()+String(a.soort).slice(1):"Neerslag";
  if(cond)cond.textContent=tekst;
  if(mini)mini.textContent=tekst;
  if(ico&&typeof icon==="function"){
    const code=num(S.d.current.weather_code),neerslagCode=code!==null&&code>=51&&code<=99?code:61;
    ico.innerHTML=icon(neerslagCode,S.d.current.is_day===1,46);
  }
}

function pasBrontekstAan(){
  if(landcode(S.land)!=="BE"||!S.d||!S.d.__knmiNeerslag)return;
  const detail=document.querySelector(".data-uitleg p"),payload=S.d.__knmiNeerslag;
  if(!detail)return;
  if(payload.actueel){
    detail.textContent="Voor Belgische locaties wordt actuele neerslag aangevuld met KNMI-puntdata. De komende uren volgen de beschikbare kwartier- en modelverwachting.";
  }
}

function herteken(){
  werkActueleConditieBij();
  if(typeof meters==="function")meters();
  if(typeof briefing==="function")briefing();
  if(typeof nowcast==="function")nowcast();
  pasBrontekstAan();
  if(typeof minibarBij==="function")minibarBij();
}

function volgendeWachttijd(payload){
  const api=beleid();
  return api&&typeof api.volgendeKnmiVerversingMs==="function"
    ?api.volgendeKnmiVerversingMs(payload||null,Date.now())
    :5*60*1000;
}

function plan(gen,payload){
  if(timer!==null)clearTimeout(timer);
  timer=setTimeout(()=>{
    timer=null;
    if(gen!==generatie||!ondersteund(S.land)||S.lat==null||S.lon==null)return;
    if(document.visibilityState==="hidden"){
      plan(gen,null);
      return;
    }
    vraag(S.lat,S.lon,gen,true);
  },volgendeWachttijd(payload));
}

async function vraag(lat,lon,gen,force){
  const land=landcode(S.land);
  if(gen!==generatie||!ondersteund(land))return;
  const sleutel=land+":"+Number(lat).toFixed(4)+","+Number(lon).toFixed(4);
  if(!force&&sleutel===laatsteSleutel&&S.d&&S.d.__knmiNeerslag)return;
  laatsteSleutel=sleutel;
  if(controller)controller.abort();
  const c=new AbortController();controller=c;
  let planPayload=null;
  try{
    const payload=await j("/api/neerslag?lat="+encodeURIComponent(lat)+"&lon="+encodeURIComponent(lon)+"&land="+encodeURIComponent(land),{timeoutMs:7500,signal:c.signal});
    if(gen!==generatie||c.signal.aborted||landcode(S.land)!==land||Number(S.lat)!==Number(lat)||Number(S.lon)!==Number(lon))return;
    if(payload&&payload.beschikbaar===true&&zetPayload(payload)){
      planPayload=payload;
      herteken();
    }
  }catch(e){}finally{
    if(controller===c)controller=null;
    if(gen===generatie&&ondersteund(S.land))plan(gen,planPayload);
  }
}

function verversBijTerugkeer(){
  if(document.visibilityState&&document.visibilityState!=="visible")return;
  if(controller||!ondersteund(S.land)||S.lat==null||S.lon==null||!S.d)return;
  const api=beleid();
  const moet=api&&typeof api.knmiPayloadMoetBijFocusVervers==="function"
    ?api.knmiPayloadMoetBijFocusVervers(S.d.__knmiNeerslag,Date.now())
    :true;
  if(moet)void vraag(S.lat,S.lon,generatie,true);
}
if(document.addEventListener)document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible")verversBijTerugkeer();
});
if(root.addEventListener)root.addEventListener("pageshow",verversBijTerugkeer);

const basisLoad=load;
load=async function(lat,lon,label,stil,opslaan,land){
  stop();
  const gen=generatie;
  const resultaat=await basisLoad(lat,lon,label,stil,opslaan,land);
  if(gen!==generatie)return resultaat;
  if(ondersteund(S.land)&&S.lat!=null&&S.lon!=null&&S.d)void vraag(S.lat,S.lon,gen,false);
  return resultaat;
};

root.WeatherNowExtraNeerslagproviders={ondersteund,landen:Array.from(EXTRA_LANDEN)};
})(typeof globalThis!=="undefined"?globalThis:this);
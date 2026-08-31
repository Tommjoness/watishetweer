/* Nederlandse luchtkwaliteitscontext uit Luchtmeetnet.
 * De bestaande Open-Meteo/CAMS AQI blijft de hoofdwaarde. Deze laag voegt
 * alleen de aparte Nederlandse LKI toe en verandert geen schaal of pollenbron.
 */
(function(root){
"use strict";

if(typeof document==="undefined"||typeof S==="undefined"||typeof load!=="function"||typeof lucht!=="function")return;
let generatie=0,controller=null;
const landcode=v=>String(v||"").trim().toUpperCase();
const ondersteund=land=>landcode(land)==="NL";

function wis(){
  const oud=document.querySelector&&document.querySelector("#aq .luchtmeetnet-lki");
  if(oud&&typeof oud.remove==="function")oud.remove();
}

function toon(){
  wis();
  const payload=S.__luchtmeetnetLki;
  if(!ondersteund(S.land)||!payload||payload.beschikbaar!==true||payload.type!=="actuele_lki")return;
  const lki=Number(payload.lki);
  if(!Number.isFinite(lki)||lki<1||lki>11)return;
  const kaart=document.querySelector&&document.querySelector("#aq .stat:first-child");
  if(!kaart||typeof document.createElement!=="function")return;
  const regel=document.createElement("div");
  regel.className="ssub luchtmeetnet-lki";
  regel.textContent="Nederlandse LKI "+Math.round(lki)+"/11 · RIVM/Luchtmeetnet";
  regel.setAttribute("title","Officiële Nederlandse luchtkwaliteitsindex van RIVM/Luchtmeetnet; aparte schaal van de Europese AQI.");
  kaart.appendChild(regel);
}

function stop(){
  generatie++;
  if(controller){controller.abort();controller=null;}
  S.__luchtmeetnetLki=null;
  wis();
}

async function vraag(lat,lon,gen){
  if(gen!==generatie||!ondersteund(S.land))return;
  const c=new AbortController();controller=c;
  try{
    const payload=await j("/api/luchtkwaliteit?lat="+encodeURIComponent(lat)+"&lon="+encodeURIComponent(lon)+"&land=NL",{timeoutMs:5000,signal:c.signal});
    if(gen!==generatie||c.signal.aborted||!ondersteund(S.land)||Number(S.lat)!==Number(lat)||Number(S.lon)!==Number(lon))return;
    if(payload&&payload.beschikbaar===true){S.__luchtmeetnetLki=payload;toon();}
  }catch(e){}finally{if(controller===c)controller=null;}
}

const basisLucht=lucht;
lucht=function(){
  const resultaat=basisLucht.apply(this,arguments);
  toon();
  return resultaat;
};

const basisLoad=load;
load=async function(lat,lon,label,stil,opslaan,land){
  stop();
  const gen=generatie;
  const resultaat=await basisLoad(lat,lon,label,stil,opslaan,land);
  if(gen!==generatie)return resultaat;
  if(ondersteund(S.land)&&S.lat!=null&&S.lon!=null)void vraag(S.lat,S.lon,gen);
  return resultaat;
};

root.WeatherNowLuchtmeetnetLki={ondersteund,toon};
})(typeof globalThis!=="undefined"?globalThis:this);

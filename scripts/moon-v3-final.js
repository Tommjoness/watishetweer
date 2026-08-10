/* Exactere maanfase voor de definitieve consumentenweergave.
   De fase wordt uit naam + verlichtingspercentage gereconstrueerd en als een
   lichte maanschijf met expliciete schaduw getekend. Daardoor leest een sikkel
   niet meer als een stip in een lege cirkel. */
(function(root){
"use strict";
const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function faseUitBeschrijving(tekst){
  const t=String(tekst||"").toLowerCase();
  const m=/(nieuwe maan|wassende sikkel|eerste kwartier|wassende maan|volle maan|afnemende maan|laatste kwartier|afnemende sikkel)\s*,\s*(\d{1,3})\s*procent verlicht/.exec(t);
  if(!m)return null;
  const naam=m[1],ill=clamp(Number(m[2]),0,100)/100;
  if(naam==="nieuwe maan")return 0;
  if(naam==="volle maan")return .5;
  const hoek=Math.acos(clamp(1-2*ill,-1,1))/(2*Math.PI);
  return /afnemende|laatste/.test(naam)?1-hoek:hoek;
}

function svgV3(fase,size){
  const f=getal(fase),s=Math.max(8,Math.round(getal(size)||14));if(f===null)return "";
  const p=((f%1)+1)%1,r=7;
  /* Schaduwfractie is precies het complement van de verlichte fractie. Dezelfde
     geometrie als de eerdere V2, maar nu op een expliciete lichte schijf zodat
     ook een 6%-sikkel daadwerkelijk als dun verlicht randje zichtbaar blijft. */
  const schaduwFase=(p+.5)%1,cos=Math.cos(2*Math.PI*schaduwFase),donker=(1-cos)/2;
  let schaduw="";
  if(donker>.985){
    schaduw='<circle class="maan-schaduw-v3" cx="12" cy="12" r="'+r+'"/>';
  }else if(donker>=.015){
    if(Math.abs(cos)<.03){
      schaduw=schaduwFase<.5
        ?'<path class="maan-schaduw-v3" d="M12 5 A7 7 0 0 1 12 19 Z"/>'
        :'<path class="maan-schaduw-v3" d="M12 5 A7 7 0 0 0 12 19 Z"/>';
    }else{
      const rx=Math.max(.6,Math.abs(r*cos)).toFixed(2),rechts=schaduwFase<.5,buiten=rechts?1:0,binnen=((cos>0)===rechts)?0:1;
      schaduw='<path class="maan-schaduw-v3" d="M 12 5 A 7 7 0 0 '+buiten+' 12 19 A '+rx+' 7 0 0 '+binnen+' 12 5 Z"/>';
    }
  }
  return '<svg class="maan-fase-svg maan-fase-svg-v3" data-fase="'+p.toFixed(4)+'" viewBox="0 0 24 24" width="'+s+'" height="'+s+'" aria-hidden="true" focusable="false"><circle class="maan-licht" cx="12" cy="12" r="7"/>'+schaduw+'</svg>';
}

function verbeterElement(el,size,beschrijving){
  if(!el)return false;
  const tekst=String(beschrijving||el.getAttribute("title")||el.getAttribute("aria-label")||el.textContent||"");
  const fase=faseUitBeschrijving(tekst);if(fase===null)return false;
  const svg=svgV3(fase,size);if(!svg)return false;
  const oud=el.querySelector(".maan-fase-svg");
  if(oud)oud.outerHTML=svg;else el.insertAdjacentHTML("afterbegin",svg);
  if(el.classList.contains("maanbij"))el.setAttribute("aria-label",tekst);
  return true;
}
function verbeterAlles(){
  document.querySelectorAll("#nights .maanbij").forEach(el=>verbeterElement(el,14));
  const lab=document.getElementById("moonlab");if(lab)verbeterElement(lab,16,lab.textContent||lab.getAttribute("aria-label"));
}

const api={faseUitBeschrijving,svgV3};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowMoonV3=api;
if(typeof document==="undefined"||typeof S==="undefined")return;
const basisNachten=nachten;
nachten=function(){basisNachten();verbeterAlles();};
})(typeof globalThis!=="undefined"?globalThis:this);

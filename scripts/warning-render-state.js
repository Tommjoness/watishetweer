"use strict";

/* De waarschuwingrenderer zelf is eigenaar van de twee statussen die direct
   aan zijn requestcyclus gekoppeld zijn: zichtbaar laden terwijl de officiële
   bron nog loopt, en een expliciete lege eindstate wanneer een geldige feed
   geen waarschuwingen bevat. Deze pure base-build owner verandert geen bron,
   filtering, scope, sortering of kaartinhoud. */
const START_BRON=`  S.actieveWaarschuwingen=[];
  el.innerHTML="";
  try{`;
const START_PRODUCTIE=`  S.actieveWaarschuwingen=[];
  el.innerHTML='<div class="msg" data-ui-warning-loading="1">Officiële weerwaarschuwingen controleren…</div>';
  try{`;

const EIND_BRON=`        +\`</p></div>\`;
    }).join("");
  }catch(e){`;
const EIND_PRODUCTIE=`        +\`</p></div>\`;
    }).join("");
    if(lijst.length===0) el.innerHTML='<div class="msg">Geen officiële weerwaarschuwingen voor deze locatie.</div>';
  }catch(e){`;

function pasWarningRenderStateToe(html){
  let bron=String(html||"");
  for(const [label,oud,nieuw] of [
    ["waarschuwing-laadstatus",START_BRON,START_PRODUCTIE],
    ["waarschuwing-leegstatus",EIND_BRON,EIND_PRODUCTIE]
  ]){
    const aantal=bron.split(oud).length-1;
    if(aantal!==1)throw new Error(label+" bronanker ontbreekt of is dubbel: "+aantal);
    bron=bron.replace(oud,nieuw);
  }
  if((bron.split(START_PRODUCTIE).length-1)!==1)throw new Error("Waarschuwing-laadstatus ontbreekt of is dubbel na base-build.");
  if((bron.split(EIND_PRODUCTIE).length-1)!==1)throw new Error("Waarschuwing-leegstatus ontbreekt of is dubbel na base-build.");
  return bron;
}

module.exports=Object.freeze({
  START_BRON,START_PRODUCTIE,EIND_BRON,EIND_PRODUCTIE,pasWarningRenderStateToe
});

/* Gerichte polish op basis van de fysieke iPhone-screenshots van 10-08-2026.
   Alleen presentatie: maanfase, pollen-eenheid en bronfooter. */
(function(root){
"use strict";

const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const begrens=(v,a,b)=>Math.max(a,Math.min(b,v));

/* De vorige SVG-route ging via één van acht Unicode-maanfases en verloor daarmee
   de fijnere fase-informatie. In Nachtzicht staat gelukkig ook de fase-naam plus
   het afgeronde verlichtingspercentage. Daarmee kan de fase opnieuw continu
   worden benaderd: wassend ligt in [0, .5], afnemend in [.5, 1]. */
function maanFaseUitBeschrijving(tekst){
  const t=String(tekst||"").toLowerCase();
  const m=/(nieuwe maan|wassende sikkel|eerste kwartier|wassende maan|volle maan|afnemende maan|laatste kwartier|afnemende sikkel)\s*,\s*(\d{1,3})\s*procent verlicht/.exec(t);
  if(!m)return null;
  const naam=m[1],pct=begrens(Number(m[2]),0,100),ill=pct/100;
  if(naam==="nieuwe maan")return 0;
  if(naam==="volle maan")return 0.5;
  const hoek=Math.acos(begrens(1-2*ill,-1,1))/(2*Math.PI);
  return /afnemende|laatste/.test(naam)?1-hoek:hoek;
}

/* De ronde CSS-drager is het verlichte maanoppervlak. In de SVG tekenen we
   uitsluitend de donkere/schaduwzijde. Daardoor is nieuwe maan een donkere
   schijf en volle maan een lichte schijf, in plaats van twee varianten die als
   hetzelfde lege rondje kunnen lezen. */
function maanFaseSvgV2(fase,size){
  const f=getal(fase),s=Math.max(8,Math.round(getal(size)||12));
  if(f===null)return "";
  const p=((f%1)+1)%1,r=7,schaduwFase=(p+0.5)%1;
  const cos=Math.cos(2*Math.PI*schaduwFase),donker=(1-cos)/2;
  let vorm="";
  if(donker>0.985){
    vorm='<circle class="maan-schaduw-vol" cx="12" cy="12" r="'+r+'" fill="currentColor"/>';
  }else if(donker>=0.015){
    if(Math.abs(cos)<0.03){
      vorm=schaduwFase<0.5
        ?'<path class="maan-schaduw" d="M12 5 A7 7 0 0 1 12 19 Z" fill="currentColor"/>'
        :'<path class="maan-schaduw" d="M12 5 A7 7 0 0 0 12 19 Z" fill="currentColor"/>';
    }else{
      const rx=Math.max(0.6,Math.abs(r*cos)).toFixed(2),rechts=schaduwFase<0.5,buiten=rechts?1:0,binnen=((cos>0)===rechts)?0:1;
      vorm='<path class="maan-schaduw" d="M 12 5 A 7 7 0 0 '+buiten+' 12 19 A '+rx+' 7 0 0 '+binnen+' 12 5 Z" fill="currentColor"/>';
    }
  }
  return '<svg class="maan-fase-svg maan-fase-svg-v2" data-fase="'+p.toFixed(4)+'" viewBox="0 0 24 24" width="'+s+'" height="'+s+'" aria-hidden="true" focusable="false">'+vorm+'</svg>';
}

function verbeterMaanElement(el,size,beschrijving){
  if(!el)return false;
  const tekst=String(beschrijving||el.getAttribute("title")||el.textContent||"");
  const fase=maanFaseUitBeschrijving(tekst);
  if(fase===null)return false;
  const svg=maanFaseSvgV2(fase,size);
  if(!svg)return false;
  const bestaand=el.querySelector(".maan-fase-svg");
  if(bestaand)bestaand.outerHTML=svg;
  else el.insertAdjacentHTML("afterbegin",svg);
  if(el.classList.contains("maanbij"))el.setAttribute("aria-label",tekst);
  return true;
}

function verbeterMaanfasen(){
  document.querySelectorAll("#nights .maanbij").forEach(el=>verbeterMaanElement(el,11));
  const lab=document.getElementById("moonlab");
  if(lab)verbeterMaanElement(lab,12,lab.textContent);
}

/* De weergegeven pollenwaarde wordt afgerond vóór hij de gebruiker bereikt.
   De eenheid volgt daarom dat zichtbare getal: 1 korrel/m³, alle andere waarden
   korrels/m³. Zo staat er op een fysieke iPhone nooit meer '1 korrels/m³'. */
function pollenEenheid(waarde){
  const v=getal(waarde);
  return v!==null&&Math.round(v)===1?"korrel/m³":"korrels/m³";
}
function corrigeerPollenEenheden(){
  document.querySelectorAll("#aq .stat").forEach(stat=>{
    const kop=stat.querySelector(".eyebrow"),waarde=stat.querySelector(".sval"),eenheid=waarde&&waarde.querySelector("s");
    if(!kop||!/^Pollen\s+/i.test((kop.textContent||"").trim())||!waarde||!eenheid)return;
    const eerste=waarde.firstChild&&waarde.firstChild.nodeType===3?waarde.firstChild.nodeValue:"";
    const zichtbaar=getal(String(eerste||"").trim());
    if(zichtbaar===null)return;
    eenheid.textContent=pollenEenheid(zichtbaar);
  });
}

/* De bronregel was inhoudelijk correct maar werd op iPhone één lange reeks van
   links, middendots en tekst. We behouden exact dezelfde links/attributie en
   groeperen ze alleen in vier betekenisvolle, wrappende items. */
function structureerBronnen(){
  const bron=document.querySelector("footer .bron:first-child");
  if(!bron||bron.classList.contains("bron-bronnen"))return false;
  const links=[...bron.querySelectorAll("a")];
  const pak=naam=>links.find(a=>(a.textContent||"").trim()===naam);
  const open=pak("Open-Meteo"),alarm=pak("MeteoAlarm"),nws=pak("National Weather Service"),osm=pak("© OpenStreetMap-bijdragers");
  if(!open||!alarm||!nws||!osm)return false;
  bron.classList.add("bron-bronnen");
  bron.innerHTML='<span class="bronlabel">Bronnen</span>'
    +'<span class="bronitem">'+open.outerHTML+' / CAMS</span>'
    +'<span class="bronitem">'+alarm.outerHTML+'</span>'
    +'<span class="bronitem">'+nws.outerHTML+'</span>'
    +'<span class="bronitem">BigDataCloud / '+osm.outerHTML+'</span>';
  return true;
}

const api={maanFaseUitBeschrijving,maanFaseSvgV2,pollenEenheid};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowMobileScreenshotPolish=api;

if(typeof document==="undefined"||typeof S==="undefined")return;

structureerBronnen();

const basisNachten=nachten;
nachten=function(){
  basisNachten();
  verbeterMaanfasen();
};

const basisLucht=lucht;
lucht=function(){
  basisLucht();
  corrigeerPollenEenheden();
};

})(typeof globalThis!=="undefined"?globalThis:this);

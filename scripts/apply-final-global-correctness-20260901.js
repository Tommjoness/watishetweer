"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const POLICY=fs.readFileSync(path.join(__dirname,"final-global-correctness-20260901.js"),"utf8");
const MARKER="/* ===== FINAL GLOBAL CORRECTNESS 20260901 ===== */";
const START="/* ---------- start ---------- */";

const ZOEK_OUD=`function zoekSleutel(r){
  if(!r||typeof r!=="object")return null;
  if(r.id!==null&&r.id!==undefined&&String(r.id).trim()!=="")return "id:"+String(r.id).trim();
  return [
    tekst(r.name),tekst(r.admin1),tekst(r.admin2),tekst(r.country_code||r.country),
    coord(r.latitude),coord(r.longitude)
  ].join("|");
}`;
const ZOEK_NIEUW=`function zoekSleutel(r){
  if(!r||typeof r!=="object")return null;
  const beleid=typeof globalThis!=="undefined"&&globalThis.WeatherNowFinalGlobalCorrectness;
  if(beleid&&typeof beleid.zoekSleutel==="function")return beleid.zoekSleutel(r);
  return [tekst(r.name),tekst(r.country_code||r.country),tekst(r.admin1),tekst(r.admin2),coord(r.latitude),coord(r.longitude)].join("|");
}`;

const NACHT_CALL_OUD=`const detail=venster?corrigeerNachtVensterBron(venster,horizon,zichtbaar,{zonsopkomst:sr,actief:!!actief&&horizon===0,nuTijd:hhmmIso(nuLokaal)}):"";`;
const NACHT_CALL_NIEUW=`const detail=venster?corrigeerNachtVensterBron(venster,horizon,zichtbaar,{zonsopkomst:sr,actief:!!actief&&horizon===0,nuTijd:hhmmIso(nuLokaal),nuDatumTijd:nuLokaal,nachtDatum:Array.isArray(day.time)?day.time[horizon]:null,tijdzone:S.d&&S.d.timezone,nuEpochMs:Date.now()}):"";`;

const CSS=`
/* ===== FINAL GLOBAL CORRECTNESS 20260901 CSS ===== */
#modelrisico{margin:10px 0 0;padding:10px 0 0;border-top:1px solid var(--rule);max-width:72ch}
#modelrisico[hidden]{display:none!important}
#modelrisico .modelrisico-kop{display:flex;gap:9px;align-items:baseline;flex-wrap:wrap}
#modelrisico .modelrisico-label{font-family:var(--sans);font-size:10px;font-weight:600;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-70)}
#modelrisico .modelrisico-note{font-family:var(--sans);font-size:11px;color:var(--ink-45)}
#modelrisico .modelrisico-items{display:grid;gap:2px;margin-top:4px;font-size:13px;line-height:1.45}
#days .wiw-dag-onzeker{display:block;white-space:normal;line-height:1.15;font-size:10px}
@media(max-width:370px){#days .wiw-dag-onzeker{font-size:9px;letter-spacing:-.01em}}
`;

const RUNTIME=`
${MARKER}
(function(){
"use strict";
const G=globalThis.WeatherNowFinalGlobalCorrectness;if(!G)return;

/* Nachtzicht: de bestaande owner blijft eindpuntcorrectie en horizoncopy doen.
   Voor de eerste nacht schakelen we alleen de tijdsvorm over op volledige lokale
   datetimes. Daardoor kan 05:49 niet meer als "na 20:00" worden behandeld. */
if(typeof corrigeerNachtVensterBron==="function"){
  const basisNachtVenster=corrigeerNachtVensterBron;
  corrigeerNachtVensterBron=function(tekst,horizon,score,opties={}){
    const t=String(tekst||"").trim();
    const geen=/^Geen (?:gunstig|goed) kijkvenster door (.+?)[.!?]*$/i.exec(t);
    if(geen)return G.nachtAdvies(score,geen[1]);
    const h=Number(horizon);
    if(Number.isFinite(h)&&h===0){
      const neutraal=basisNachtVenster(tekst,1,score,opties);
      return G.nachtVensterTijdsvorm(neutraal,{horizonDagen:0,nuDatumTijd:opties.nuDatumTijd,nachtDatum:opties.nachtDatum,tijdzone:opties.tijdzone,nuEpochMs:opties.nuEpochMs});
    }
    return basisNachtVenster(tekst,horizon,score,opties);
  };
}

/* Dagweertype: dagcode blijft leidend. Uurdata bepaalt timing en resterende-dag-
   context, maar één licht uur mag een natte dag niet hernoemen. */
if(globalThis.WeatherNowKansbeleidV3&&typeof globalThis.WeatherNowKansbeleidV3.dagKansSamenvatting==="function"){
  const basisDagKans=globalThis.WeatherNowKansbeleidV3.dagKansSamenvatting;
  globalThis.WeatherNowKansbeleidV3.dagKansSamenvatting=function(a,basis){return basisDagKans(a,G.dagBasis(a,basis));};
}

function laatsteGetal(tekst){const m=/(-?\\d+(?:[.,]\\d+)?)\\s*$/.exec(String(tekst||""));return m?Number(m[1].replace(",",".")):null;}
function corrigeerTemperatuurDom(root){
  const scope=root||document;
  const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);let n;
  while((n=walker.nextNode())){
    const oud=n.nodeValue||"",nieuw=G.corrigeerGradenTekst(oud);if(nieuw!==oud)n.nodeValue=nieuw;
    if(/^\\s*graden\\b/.test(n.nodeValue||"")&&n.previousSibling){
      const v=laatsteGetal(n.previousSibling.textContent);if(v!==null&&Math.abs(v)===1)n.nodeValue=String(n.nodeValue).replace(/^([\\s]*)graden\\b/,"$1graad");
    }
  }
  scope.querySelectorAll&&scope.querySelectorAll("[aria-label],[title]").forEach(el=>{
    for(const a of ["aria-label","title"]){if(!el.hasAttribute(a))continue;const oud=el.getAttribute(a),nieuw=G.corrigeerGradenTekst(oud);if(nieuw!==oud)el.setAttribute(a,nieuw);}
  });
}

function corrigeerDrukSemantiek(){
  document.querySelectorAll(".eyebrow").forEach(el=>{if(el.textContent.trim()==="Luchtdruk")el.textContent="Luchtdruk op zeeniveau";});
  const pres=document.getElementById("pres");if(pres){
    const stat=pres.closest(".stat");if(stat){stat.setAttribute("title","Luchtdruk herleid tot zeeniveau (MSL).");stat.setAttribute("aria-label","Luchtdruk op zeeniveau. "+pres.textContent.trim());}
  }
  const scope=document.getElementById("app");if(!scope)return;
  const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);let n;
  while((n=walker.nextNode())){
    let t=n.nodeValue||"";
    t=t.replace(/\\bDe luchtdruk is\\b/g,"De luchtdruk op zeeniveau is").replace(/\\bDe luchtdruk blijft\\b/g,"De luchtdruk op zeeniveau blijft").replace(/\\bLuchtdruk:\\s*/g,"Luchtdruk op zeeniveau: ");
    n.nodeValue=t;
  }
}

function finaliseerDagNeerslag(){
  document.querySelectorAll("#days .row.day:not(.kop)").forEach(r=>{
    const vak=r.querySelector(".drain");if(!vak)return;
    const m=/(\\d{1,3})%/.exec(vak.textContent||""),k=m?Number(m[1]):null;
    const bekend=vak.querySelector("small,.q1-dag-mm");
    if(k!==null&&k>0&&!bekend){
      const small=document.createElement("small");small.className="wiw-dag-onzeker";small.textContent="hoeveelheid onzeker";vak.appendChild(small);
    }
    const delen=[];if(k!==null)delen.push("Neerslagkans "+k+" procent");
    const small=vak.querySelector("small,.q1-dag-mm");if(small&&small.textContent.trim())delen.push(small.textContent.trim());
    if(!delen.length&&/^[-–—]$/.test(vak.textContent.trim()))delen.push("Neerslaggegevens niet beschikbaar");
    if(delen.length)vak.setAttribute("aria-label",delen.join("; "));
  });
}

function reeks(h,naam,begin,eind){const a=h&&Array.isArray(h[naam])?h[naam]:[];return a.slice(begin,eind).map(Number).filter(Number.isFinite);}
function maxOf(a){return a.length?Math.max(...a):null;}function minOf(a){return a.length?Math.min(...a):null;}
function renderModelRisico(){
  const el=document.getElementById("modelrisico");if(!el)return;
  if(!S||!S.d||!S.d.hourly||(Number.isFinite(Number(S.op))&&Date.now()-Number(S.op)>60*60*1000)){el.hidden=true;el.innerHTML="";return;}
  const h=S.d.hourly,i=Math.max(0,Number(S.i0)||0),e=Math.min(h.time&&h.time.length||i+25,i+25);
  const euro=typeof inEuropa==="function"?inEuropa(S.lat,S.lon):false,c=S.air&&S.air.current||{};
  const aqi=euro&&c.european_aqi!=null?Number(c.european_aqi):c.us_aqi!=null?Number(c.us_aqi):null;
  const risicos=G.modelRisicos({
    maxTemperatuur:maxOf(reeks(h,"temperature_2m",i,e)),maxGevoel:maxOf(reeks(h,"apparent_temperature",i,e)),
    maxUv:maxOf(reeks(h,"uv_index",i,e)),maxWindstoot:maxOf(reeks(h,"wind_gusts_10m",i,e)),minZicht:minOf(reeks(h,"visibility",i,e)),
    aqi,aqiSchaal:euro&&c.european_aqi!=null?"EU":"US"
  });
  if(!risicos.length){el.hidden=true;el.innerHTML="";return;}
  el.hidden=false;
  el.innerHTML='<div class="modelrisico-kop"><span class="modelrisico-label">Modelsignaal</span><span class="modelrisico-note">Modelgegevens, geen officiële waarschuwing.</span></div><div class="modelrisico-items">'+risicos.map(r=>'<span>'+String(r.tekst).replace(/[&<>]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[ch]))+'</span>').join("")+'</div>';
}

function finaleDomCorrecties(){finaliseerDagNeerslag();corrigeerTemperatuurDom(document.getElementById("app")||document);corrigeerDrukSemantiek();renderModelRisico();}
if(typeof tekenAlles==="function"){
  const basisTekenAlles=tekenAlles;tekenAlles=function(){const r=basisTekenAlles.apply(this,arguments);finaleDomCorrecties();queueMicrotask(finaleDomCorrecties);return r;};
}
if(typeof lucht==="function"){
  const basisLucht=lucht;lucht=function(){const r=basisLucht.apply(this,arguments);corrigeerTemperatuurDom(document.getElementById("aq")||document);renderModelRisico();return r;};
}
})();
`;

function weerHtmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);if(e.isDirectory())uit.push(...weerHtmlBestanden(p));else if(e.isFile()&&e.name==="index.html")uit.push(p);
  }
  return uit;
}
function exactEen(bron,oud,nieuw,naam){const n=bron.split(oud).length-1;if(n!==1)throw new Error(naam+"-anker verwacht 1x, gevonden "+n);return bron.replace(oud,nieuw);}
function pasToe(pad){
  let html=fs.readFileSync(pad,"utf8");
  if(!html.includes(START)||!html.includes("WeatherNowGlobalLocationHardening"))return false;
  if(html.includes(MARKER))throw new Error("Finale correctheidslaag staat al in "+pad);
  html=exactEen(html,ZOEK_OUD,ZOEK_NIEUW,"zoekdeduplicatie");
  html=exactEen(html,NACHT_CALL_OUD,NACHT_CALL_NIEUW,"Nachtzicht datetime-call");
  html=exactEen(html,'<p class="brief" id="brief"></p>','<p class="brief" id="brief"></p>\n    <div id="modelrisico" role="note" hidden></div>',"modelsignaal-container");
  html=exactEen(html,"</style>",CSS+"\n</style>","hoofdstijl");
  html=exactEen(html,START,POLICY+"\n"+RUNTIME+"\n"+START,"startup-injectie");
  html=html.replace(/>Luchtdruk</g,">Luchtdruk op zeeniveau<");
  fs.writeFileSync(pad,html,"utf8");return true;
}

let aantal=0;for(const p of weerHtmlBestanden(OUT))if(pasToe(p))aantal++;
if(!aantal)throw new Error("Geen weerpagina's gevonden voor finale correctheidslaag.");
const versie=vernieuwServiceworkerCache(OUT,"final-global-correctness-20260901");
console.log("Finale wereldwijde correctheidslaag toegepast op "+aantal+" weerpagina's; cache "+versie+".");

module.exports={ZOEK_OUD,ZOEK_NIEUW,NACHT_CALL_OUD,NACHT_CALL_NIEUW,CSS,RUNTIME,MARKER,pasToe};

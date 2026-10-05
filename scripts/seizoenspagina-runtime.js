/* Seizoenspagina's: één generiek sjabloon voor evenementpagina's zoals witte
   kerst. Buiten het verwachtingsvenster toont de pagina alleen wanneer de
   verwachting verschijnt; binnen het venster haalt hij de echte Open-Meteo-
   verwachting op voor de vaste plaatsen uit de config. Er is geen lange-
   termijnverwachting en geen klimaatstatistiek: alleen wat het model nu zegt.
   Dit bestand draait in de browser (inline, door de build verpakt) en is in
   Node te laden voor unit-tests. */
(function(){
"use strict";
const MAANDEN=["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
const DAGNAMEN=["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"];
const DAG_MS=864e5;

function pad(n){return String(n).padStart(2,"0");}
function datumISO(jaar,maand,dag){return `${jaar}-${pad(maand)}-${pad(dag)}`;}
function dagNummer(iso){const [j,m,d]=String(iso).split("-").map(Number);return Date.UTC(j,m-1,d)/DAG_MS;}
function dagenTussen(van,tot){return dagNummer(tot)-dagNummer(van);}
function plusDagen(iso,n){const t=new Date((dagNummer(iso)+n)*DAG_MS);return datumISO(t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate());}
function datumTekst(iso,metDagnaam){
  const t=new Date(dagNummer(iso)*DAG_MS);
  const kort=`${t.getUTCDate()} ${MAANDEN[t.getUTCMonth()]}`;
  return metDagnaam?`${DAGNAMEN[t.getUTCDay()]} ${kort}`:kort;
}
/* De kalenderdag in de tijdzone van het evenement, niet die van de bezoeker. */
function vandaagIn(tijdzone,nu){
  const delen=new Intl.DateTimeFormat("en-CA",{timeZone:tijdzone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(nu);
  const deel=type=>delen.find(d=>d.type===type).value;
  return `${deel("year")}-${deel("month")}-${deel("day")}`;
}
function vul(sjabloon,waarden){return String(sjabloon).replace(/\{(\w+)\}/g,(m,k)=>Object.prototype.hasOwnProperty.call(waarden,k)?String(waarden[k]):m);}
function klein(label){return String(label).charAt(0).toLowerCase()+String(label).slice(1);}

/* Welk jaar, welke dagen al binnen het venster vallen en vanaf wanneer de
   verwachting er is. Na de laatste evenementdag schuift de pagina door naar
   volgend jaar. */
function toestand(vandaag,cfg){
  const laatste=cfg.dagen[cfg.dagen.length-1];
  const jaarNu=Number(vandaag.slice(0,4));
  const jaar=dagenTussen(vandaag,datumISO(jaarNu,laatste.maand,laatste.dag))>=0?jaarNu:jaarNu+1;
  const dagen=cfg.dagen.map(d=>{
    const iso=datumISO(jaar,d.maand,d.dag),over=dagenTussen(vandaag,iso);
    return {label:d.label,iso,over,zichtbaar:over>=0&&over<=cfg.vensterDagen-1,vanaf:plusDagen(iso,-(cfg.vensterDagen-1))};
  });
  return {vandaag,jaar,dagen,vanaf:dagen[0].vanaf,fase:dagen.some(d=>d.zichtbaar)?"verwachting":"ver"};
}

function aftelTekst(t,cfg){
  const vandaagDag=t.dagen.find(d=>d.over===0);
  if(vandaagDag)return vul(cfg.teksten.aftellenVandaag,{dag:klein(vandaagDag.label)});
  const eerste=t.dagen[0];
  if(eerste.over===1)return vul(cfg.teksten.aftellenMorgen,{dag:klein(eerste.label)});
  return vul(cfg.teksten.aftellenMeer,{n:eerste.over,dag:klein(eerste.label)});
}
function meldingTekst(t,cfg){
  if(t.fase==="ver")return vul(cfg.teksten.ver,{datum:datumTekst(t.vanaf,true),dagen:cfg.vensterDagen});
  return "";
}

function getal(v){return typeof v==="number"&&Number.isFinite(v)?v:null;}
function komma(v,dec){return v.toFixed(dec).replace(".",",");}
function cm(v){return v<1?"minder dan 1 cm":`${Math.round(v)} cm`;}
function graden(v){return v==null?"–":`${Math.round(v)}°`;}

/* Eén plaats, één kalenderdag. Sneeuwdek is de verwachte sneeuwhoogte in de
   ochtend (cfg.ochtendUur, lokale tijd). */
function dagWaarden(data,iso,ochtendUur){
  const d=data&&data.daily,h=data&&data.hourly;
  if(!d||!Array.isArray(d.time))return null;
  const i=d.time.indexOf(iso);
  if(i<0)return null;
  const reeks=(obj,k,idx)=>obj&&Array.isArray(obj[k])?getal(obj[k][idx]):null;
  const hi=h&&Array.isArray(h.time)?h.time.indexOf(`${iso}T${pad(ochtendUur)}:00`):-1;
  const diepte=hi>=0?reeks(h,"snow_depth",hi):null;
  return {
    tmin:reeks(d,"temperature_2m_min",i),
    tmax:reeks(d,"temperature_2m_max",i),
    sneeuwval:reeks(d,"snowfall_sum",i),
    neerslag:reeks(d,"precipitation_sum",i),
    sneeuwdek:diepte==null?null:diepte*100
  };
}
function heeftSneeuwdek(w){return !!(w&&w.sneeuwdek!=null&&w.sneeuwdek>=1);}
function sneeuwTekst(w){
  if(!w||(w.sneeuwdek==null&&w.sneeuwval==null&&w.neerslag==null))return "Geen gegevens";
  if(heeftSneeuwdek(w))return `Sneeuwdek, ${cm(w.sneeuwdek)}`;
  if(w.sneeuwval!=null&&w.sneeuwval>=0.1)return `Wat sneeuw (${cm(w.sneeuwval)}), geen sneeuwdek`;
  if(w.neerslag!=null&&w.neerslag>=0.2)return `Geen sneeuw, ${komma(w.neerslag,1)} mm regen`;
  return "Geen sneeuw, droog";
}

/* De samenvatting gaat over de officiële meetplaats uit de config. */
function samenvatting(t,resultaten,cfg){
  const officieel=resultaten.find(r=>r.plaats.officieel);
  if(!officieel)return "";
  const zichtbaar=t.dagen.filter(d=>d.zichtbaar);
  const zonder=zichtbaar.find(d=>!heeftSneeuwdek(officieel.dagen[d.iso]));
  const plaats=officieel.plaats.naam;
  if(zonder)return vul(cfg.teksten.nietOp,{plaats,dag:klein(zonder.label)});
  if(zichtbaar.length===t.dagen.length)return vul(cfg.teksten.allemaal,{plaats});
  const volgende=t.dagen.find(d=>!d.zichtbaar&&d.over>0);
  return vul(cfg.teksten.totNuToe,{plaats,dag:zichtbaar.map(d=>klein(d.label)).join(" en "),volgende:volgende?klein(volgende.label):"",datum:volgende?datumTekst(volgende.vanaf,false):""});
}

function verwachtingUrl(cfg){
  const lat=cfg.plaatsen.map(p=>p.lat).join(","),lon=cfg.plaatsen.map(p=>p.lon).join(",");
  return "https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+
    "&daily=temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_sum&hourly=snow_depth"+
    "&timezone="+encodeURIComponent(cfg.tijdzone)+"&forecast_days="+cfg.vensterDagen;
}
function verwerkAntwoord(json,t,cfg){
  const lijst=Array.isArray(json)?json:[json];
  if(lijst.length!==cfg.plaatsen.length)throw new Error("Onverwacht aantal plaatsen in de verwachting");
  return cfg.plaatsen.map((plaats,i)=>{
    const dagen={};
    for(const d of t.dagen)if(d.zichtbaar)dagen[d.iso]=dagWaarden(lijst[i],d.iso,cfg.ochtendUur);
    return {plaats,dagen};
  });
}

/* ---------- Browser ---------- */
function el(tag,attrs,kinderen){
  const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,v);
  for(const k of [].concat(kinderen||[]))e.append(k);
  return e;
}
/* De plaatsnaam is een eigennaam en wordt niet vertaald (translate="no"); de
   toevoeging "officiële meetplaats" staat in een eigen blok en wel. */
function plaatsCel(plaats){
  const inhoud=plaats.href?el("a",{href:plaats.href},plaats.naam):plaats.naam;
  const cel=el("th",{scope:"row"},el("div",{class:"plaats",translate:"no"},inhoud));
  if(plaats.officieel)cel.append(el("div",{class:"officieel"},"officiële meetplaats"));
  return cel;
}
function dagTabel(dag,resultaten){
  const sectie=el("section",{class:"seizoen-dag","data-datum":dag.iso});
  sectie.append(el("h3",{},[dag.label+" ",el("span",{},datumTekst(dag.iso,true))]));
  const tabel=el("table",{});
  tabel.append(el("thead",{},el("tr",{},[el("th",{scope:"col"},"Plaats"),el("th",{scope:"col"},"Sneeuw"),el("th",{scope:"col"},"Min / max")])));
  const body=el("tbody",{});
  for(const r of resultaten){
    const w=r.dagen[dag.iso];
    body.append(el("tr",{},[plaatsCel(r.plaats),el("td",{},sneeuwTekst(w)),el("td",{class:"temp"},w?`${graden(w.tmin)} / ${graden(w.tmax)}`:"–")]));
  }
  tabel.append(body);
  sectie.append(tabel);
  return sectie;
}
function toon(doel,t,resultaten,cfg){
  doel.replaceChildren();
  const tekst=samenvatting(t,resultaten,cfg);
  if(tekst)doel.append(el("p",{class:"seizoen-samenvatting"},tekst));
  for(const dag of t.dagen){
    if(dag.zichtbaar)doel.append(dagTabel(dag,resultaten));
    else if(dag.over>0)doel.append(el("p",{class:"seizoen-later"},vul(cfg.teksten.dagLater,{dag:dag.label,datum:datumTekst(dag.vanaf,true)})));
  }
  doel.append(el("p",{class:"klein"},cfg.teksten.toelichting));
}
async function start(){
  const bron=document.getElementById("seizoen-config");
  if(!bron)return;
  const cfg=JSON.parse(bron.textContent);
  const t=toestand(vandaagIn(cfg.tijdzone,new Date()),cfg);
  const kop=document.getElementById("seizoen-kop");
  if(kop)kop.textContent=`${cfg.naam} ${t.jaar}`;
  document.title=vul(cfg.titel,{jaar:t.jaar})+" | watishetweer.nl";
  const aftellen=document.getElementById("seizoen-aftellen");
  if(aftellen){aftellen.textContent=aftelTekst(t,cfg);aftellen.hidden=false;}
  const melding=document.getElementById("seizoen-melding");
  if(melding){melding.textContent=meldingTekst(t,cfg);melding.hidden=!melding.textContent;}
  const doel=document.getElementById("seizoen-verwachting");
  if(!doel||t.fase!=="verwachting")return;
  doel.setAttribute("aria-busy","true");
  doel.replaceChildren(el("p",{class:"klein"},"Verwachting laden…"));
  try{
    const stop=new AbortController(),timer=setTimeout(()=>stop.abort(),10000);
    const res=await fetch(verwachtingUrl(cfg),{signal:stop.signal});
    clearTimeout(timer);
    if(!res.ok)throw new Error("HTTP "+res.status);
    toon(doel,t,verwerkAntwoord(await res.json(),t,cfg),cfg);
  }catch(e){
    doel.replaceChildren(el("p",{class:"seizoen-fout"},cfg.teksten.fout));
  }finally{
    doel.removeAttribute("aria-busy");
  }
}

const api={datumISO,dagenTussen,plusDagen,datumTekst,vandaagIn,vul,toestand,aftelTekst,meldingTekst,dagWaarden,heeftSneeuwdek,sneeuwTekst,samenvatting,verwachtingUrl,verwerkAntwoord};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else if(typeof document!=="undefined"){
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
}
})();

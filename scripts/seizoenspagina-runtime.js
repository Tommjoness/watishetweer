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
/* De kalenderdag en het uur in de tijdzone van het evenement, niet die van de
   bezoeker. */
function nuIn(tijdzone,nu){
  const delen=new Intl.DateTimeFormat("en-CA",{timeZone:tijdzone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(nu);
  const deel=type=>delen.find(d=>d.type===type).value;
  return {datum:`${deel("year")}-${deel("month")}-${deel("day")}`,uur:Number(deel("hour"))%24};
}
function vandaagIn(tijdzone,nu){return nuIn(tijdzone,nu).datum;}
function vul(sjabloon,waarden){return String(sjabloon).replace(/\{(\w+)\}/g,(m,k)=>Object.prototype.hasOwnProperty.call(waarden,k)?String(waarden[k]):m);}
function klein(label){return String(label).charAt(0).toLowerCase()+String(label).slice(1);}

/* Tot welk uur (vanaf middernacht aan het begin van de evenementdag) een
   evenementdag loopt: het laatste uur uit cfg.uren (26 = 02:00 de dag erna),
   anders het einde van de dag. */
function eindUur(cfg){return Array.isArray(cfg.uren)&&cfg.uren.length?Math.max(...cfg.uren):24;}
/* Een evenementdag van gisteren is nog "bezig" zolang zijn uren doorlopen,
   zoals de nacht van oud en nieuw tot 1 januari 02:00. Zonder uur (unit-tests
   op alleen een datum) is een voorbije dag nooit bezig. */
function bezig(over,uur,cfg){return over<0&&uur!=null&&-over*24+uur<eindUur(cfg);}

/* Welk jaar, welke dagen al binnen het venster vallen en vanaf wanneer de
   verwachting er is. Na de laatste evenementdag schuift de pagina door naar
   volgend jaar, maar pas als die dag niet meer bezig is. cfg.extraDagen:
   zoveel dagen ná een evenementdag zijn ook nodig (de nacht van oud en nieuw
   loopt door tot 1 januari 02:00); een dag telt pas als zichtbaar wanneer ook
   die volgende dag(en) in het venster vallen. */
function toestand(vandaag,cfg,uur){
  const laatste=cfg.dagen[cfg.dagen.length-1];
  const extra=cfg.extraDagen||0;
  const jaarNu=Number(vandaag.slice(0,4));
  const voorbij=j=>{const over=dagenTussen(vandaag,datumISO(j,laatste.maand,laatste.dag));return over<0&&!bezig(over,uur,cfg);};
  const jaar=[jaarNu-1,jaarNu].find(j=>!voorbij(j))||jaarNu+1;
  const dagen=cfg.dagen.map(d=>{
    const iso=datumISO(jaar,d.maand,d.dag),over=dagenTussen(vandaag,iso),loopt=bezig(over,uur,cfg);
    return {label:d.label,iso,over,bezig:loopt,zichtbaar:(over>=0||loopt)&&over+extra<=cfg.vensterDagen-1,vanaf:plusDagen(iso,-(cfg.vensterDagen-1-extra))};
  });
  return {vandaag,jaar,dagen,vanaf:dagen[0].vanaf,fase:dagen.some(d=>d.zichtbaar)?"verwachting":"ver"};
}

function aftelTekst(t,cfg){
  const vandaagDag=t.dagen.find(d=>d.over===0);
  if(vandaagDag)return vul(cfg.teksten.aftellenVandaag,{dag:klein(vandaagDag.label)});
  const lopend=t.dagen.find(d=>d.bezig);
  if(lopend)return vul(cfg.teksten.aftellenBezig||cfg.teksten.aftellenVandaag,{dag:klein(lopend.label)});
  const eerste=t.dagen[0];
  if(eerste.over===1)return vul(cfg.teksten.aftellenMorgen,{dag:klein(eerste.label)});
  return vul(cfg.teksten.aftellenMeer,{n:eerste.over,dag:klein(eerste.label)});
}
/* Aftellen als groot getal met de rest ernaast ("81" + "dagen tot eerste
   kerstdag"); alleen als er nog meer dan een dag te gaan is en de pagina
   daar een tekst voor heeft. Anders null en blijft de gewone zin staan. */
function aftelGetal(t,cfg){
  if(!cfg.teksten.aftellenGetal||t.dagen.some(d=>d.over===0||d.bezig))return null;
  const eerste=t.dagen[0];
  if(!(eerste.over>1))return null;
  return {n:eerste.over,tekst:vul(cfg.teksten.aftellenGetal,{dag:klein(eerste.label)})};
}
function meldingTekst(t,cfg){
  /* {datum} is de dag waarop de eerste evenementdag verschijnt, {datum2} die
     van de tweede (tweede kerstdag komt een dag later in beeld dan eerste). */
  if(t.fase==="ver")return vul(cfg.teksten.ver,{datum:datumTekst(t.vanaf,true),datum2:t.dagen[1]?datumTekst(t.dagen[1].vanaf,true):"",dagen:cfg.vensterDagen});
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

/* ---------- Soort "middernacht": één nacht, uur voor uur ---------- */
const RICHTINGEN=["N","NO","O","ZO","Z","ZW","W","NW"];
function richting(graad){return graad==null?"":RICHTINGEN[Math.round((((graad%360)+360)%360)/45)%8];}
/* cfg.uren zijn uren vanaf middernacht aan het begin van de evenementdag:
   22, 23, 24 (= 00:00 de dag erna), 25, 26. */
function uurStempel(iso,uur){return `${plusDagen(iso,Math.floor(uur/24))}T${pad(uur%24)}:00`;}
function nachtWaarden(data,iso,cfg){
  const h=data&&data.hourly;
  if(!h||!Array.isArray(h.time))return null;
  const reeks=k=>cfg.uren.map(u=>{const i=h.time.indexOf(uurStempel(iso,u));return i>=0&&Array.isArray(h[k])?getal(h[k][i]):null;});
  const echt=a=>a.filter(v=>v!=null);
  const neerslag=echt(reeks("precipitation")),kans=echt(reeks("precipitation_probability"));
  const wind=echt(reeks("wind_speed_10m")),stoot=echt(reeks("wind_gusts_10m")),zicht=echt(reeks("visibility"));
  const midIdx=cfg.uren.indexOf(cfg.middernachtUur);
  const temp=midIdx>=0?reeks("temperature_2m")[midIdx]:null,dir=midIdx>=0?reeks("wind_direction_10m")[midIdx]:null;
  if(!neerslag.length&&!wind.length&&temp==null)return null;
  return {
    neerslag:neerslag.length?neerslag.reduce((a,b)=>a+b,0):null,
    kans:kans.length?Math.max(...kans):null,
    wind:wind.length?wind.reduce((a,b)=>a+b,0)/wind.length:null,
    stoot:stoot.length?Math.max(...stoot):null,
    richting:richting(dir),
    zicht:zicht.length?Math.min(...zicht):null,
    temp
  };
}
function neerslagTekst(w){
  if(!w||w.neerslag==null)return "Geen gegevens";
  const kans=w.kans==null?"":` · kans ${Math.round(w.kans)}%`;
  return w.neerslag>=0.1?`${komma(w.neerslag,1)} mm${kans}`:`Droog${kans}`;
}
function windTekst(w){
  if(!w||w.wind==null)return "Geen gegevens";
  const basis=`${w.richting?w.richting+" ":""}${Math.round(w.wind)} km/u`;
  return w.stoot==null?basis:`${basis} · stoten ${Math.round(w.stoot)}`;
}
function heeftMist(w,cfg){return !!(w&&w.zicht!=null&&w.zicht<cfg.mistZicht);}
function lijstTekst(namen){return namen.length<2?namen.join(""):namen.slice(0,-1).join(", ")+" en "+namen[namen.length-1];}
function nachtSamenvatting(t,resultaten,cfg){
  const dag=t.dagen.find(d=>d.zichtbaar);
  if(!dag)return [];
  const w=r=>r.dagen[dag.iso];
  const metData=resultaten.filter(r=>w(r));
  if(!metData.length)return [];
  const nat=metData.filter(r=>w(r).neerslag!=null&&w(r).neerslag>=0.1).map(r=>r.plaats.naam);
  const stoten=metData.filter(r=>w(r).stoot!=null&&w(r).stoot>=cfg.stootDrempel).map(r=>r.plaats.naam);
  const mist=metData.filter(r=>heeftMist(w(r),cfg)).map(r=>r.plaats.naam);
  const zinnen=[nat.length?vul(cfg.teksten.neerslagIn,{plaatsen:lijstTekst(nat)}):cfg.teksten.droogOveral];
  if(stoten.length)zinnen.push(vul(cfg.teksten.stotenIn,{kmh:cfg.stootDrempel,plaatsen:lijstTekst(stoten)}));
  if(mist.length)zinnen.push(vul(cfg.teksten.mistIn,{plaatsen:lijstTekst(mist)}));
  return zinnen;
}

/* Loopt de nacht nog (1 januari 01:00), dan begint de verwachting van vandaag
   pas om 00:00: past_days=1 haalt de uren van gisteravond erbij. */
function verwachtingUrl(cfg,t){
  const lat=cfg.plaatsen.map(p=>p.lat).join(","),lon=cfg.plaatsen.map(p=>p.lon).join(",");
  const velden=cfg.soort==="middernacht"
    ?"&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility"
    :"&daily=temperature_2m_max,temperature_2m_min,snowfall_sum,precipitation_sum&hourly=snow_depth";
  return "https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+velden+
    "&timezone="+encodeURIComponent(cfg.tijdzone)+"&forecast_days="+cfg.vensterDagen+
    (t&&t.dagen.some(d=>d.bezig)?"&past_days=1":"");
}
function verwerkAntwoord(json,t,cfg){
  const lijst=Array.isArray(json)?json:[json];
  if(lijst.length!==cfg.plaatsen.length)throw new Error("Onverwacht aantal plaatsen in de verwachting");
  return cfg.plaatsen.map((plaats,i)=>{
    const dagen={};
    for(const d of t.dagen)if(d.zichtbaar)dagen[d.iso]=cfg.soort==="middernacht"?nachtWaarden(lijst[i],d.iso,cfg):dagWaarden(lijst[i],d.iso,cfg.ochtendUur);
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
/* "Droog · kans 10%": op mobiel komt het tweede deel op een eigen, kleinere regel. */
function tweedelig(tekst,attrs){
  const i=tekst.indexOf(" · ");
  return i<0?el("td",attrs||{},tekst):el("td",attrs||{},[tekst.slice(0,i),el("span",{class:"sep"}," · "),el("span",{class:"sub"},tekst.slice(i+3))]);
}
function nachtTabel(dag,resultaten,cfg){
  const sectie=el("section",{class:"seizoen-dag","data-datum":dag.iso});
  const eerste=cfg.uren[0],laatste=cfg.uren[cfg.uren.length-1];
  const van=uurStempel(dag.iso,eerste),tot=uurStempel(dag.iso,laatste);
  sectie.append(el("h3",{},[cfg.teksten.nachtKop+" ",el("span",{},`${datumTekst(van.slice(0,10),false)} ${van.slice(11)} – ${datumTekst(tot.slice(0,10),false)} ${tot.slice(11)}`)]));
  const tabel=el("table",{class:"seizoen-nacht"});
  tabel.append(el("thead",{},el("tr",{},[el("th",{scope:"col"},"Plaats"),el("th",{scope:"col"},"Neerslag"),el("th",{scope:"col"},"Wind"),el("th",{scope:"col"},"Temp.")])));
  const body=el("tbody",{});
  for(const r of resultaten){
    const w=r.dagen[dag.iso];
    body.append(el("tr",{},[plaatsCel(r.plaats),tweedelig(neerslagTekst(w)),tweedelig(windTekst(w)),el("td",{class:"temp"},w?graden(w.temp):"–")]));
  }
  tabel.append(body);
  sectie.append(tabel);
  return sectie;
}
function toon(doel,t,resultaten,cfg){
  doel.replaceChildren();
  const nacht=cfg.soort==="middernacht";
  const zinnen=nacht?nachtSamenvatting(t,resultaten,cfg):[samenvatting(t,resultaten,cfg)].filter(Boolean);
  for(const z of zinnen)doel.append(el("p",{class:"seizoen-samenvatting"},z));
  for(const dag of t.dagen){
    if(dag.zichtbaar)doel.append(nacht?nachtTabel(dag,resultaten,cfg):dagTabel(dag,resultaten));
    else if(dag.over>0)doel.append(el("p",{class:"seizoen-later"},vul(cfg.teksten.dagLater,{dag:dag.label,datum:datumTekst(dag.vanaf,true)})));
  }
  doel.append(el("p",{class:"klein"},cfg.teksten.toelichting));
}
/* Wat de pagina toont hangt alleen af van deze sleutel: verandert hij (na
   middernacht, of als de nacht van oud en nieuw om 02:00 voorbij is), dan
   bouwt de pagina zichzelf opnieuw op, ook als hij al die tijd openstond. */
function sleutel(t){return t.jaar+"|"+t.dagen.map(d=>d.over+(d.bezig?"b":"")).join(",");}
function huidigeToestand(cfg){const n=nuIn(cfg.tijdzone,new Date());return toestand(n.datum,cfg,n.uur);}
let getoond="",bewaakt=false;
function bewaak(cfg){
  if(bewaakt)return;
  bewaakt=true;
  const kijk=()=>{if(sleutel(huidigeToestand(cfg))!==getoond)start();};
  setInterval(kijk,60000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")kijk();});
}
async function start(){
  const bron=document.getElementById("seizoen-config");
  if(!bron)return;
  const cfg=JSON.parse(bron.textContent);
  const t=huidigeToestand(cfg);
  getoond=sleutel(t);
  bewaak(cfg);
  const kop=document.getElementById("seizoen-kop");
  if(kop)kop.textContent=`${cfg.naam} ${t.jaar}`;
  document.title=vul(cfg.titel,{jaar:t.jaar})+" | watishetweer.nl";
  const aftellen=document.getElementById("seizoen-aftellen");
  if(aftellen){
    const groot=aftelGetal(t,cfg);
    aftellen.classList.toggle("groot",!!groot);
    if(groot)aftellen.replaceChildren(el("b",{class:"aftel-getal"},String(groot.n))," ",el("span",{},groot.tekst));
    else aftellen.textContent=aftelTekst(t,cfg);
    aftellen.hidden=false;
  }
  const melding=document.getElementById("seizoen-melding");
  if(melding){melding.textContent=meldingTekst(t,cfg);melding.hidden=!melding.textContent;}
  const doel=document.getElementById("seizoen-verwachting");
  if(!doel)return;
  if(t.fase!=="verwachting"){doel.replaceChildren();return;}
  doel.setAttribute("aria-busy","true");
  doel.replaceChildren(el("p",{class:"klein"},"Verwachting laden…"));
  try{
    const stop=new AbortController(),timer=setTimeout(()=>stop.abort(),10000);
    const res=await fetch(verwachtingUrl(cfg,t),{signal:stop.signal});
    clearTimeout(timer);
    if(!res.ok)throw new Error("HTTP "+res.status);
    toon(doel,t,verwerkAntwoord(await res.json(),t,cfg),cfg);
  }catch(e){
    doel.replaceChildren(el("p",{class:"seizoen-fout"},cfg.teksten.fout));
  }finally{
    doel.removeAttribute("aria-busy");
  }
}

const api={datumISO,dagenTussen,plusDagen,datumTekst,nuIn,vandaagIn,vul,eindUur,toestand,aftelTekst,aftelGetal,meldingTekst,dagWaarden,heeftSneeuwdek,sneeuwTekst,samenvatting,richting,uurStempel,nachtWaarden,neerslagTekst,windTekst,lijstTekst,nachtSamenvatting,verwachtingUrl,verwerkAntwoord};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else if(typeof document!=="undefined"){
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
}
})();

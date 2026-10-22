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
  if(cfg.soort==="vakantie")return toestandVakantie(vandaag,cfg);
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
  if(cfg.soort==="vakantie")return vakantieAftellen(t,cfg).tekst;
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
  if(cfg.soort==="vakantie")return vakantieAftellen(t,cfg).groot;
  if(!cfg.teksten.aftellenGetal||t.dagen.some(d=>d.over===0||d.bezig))return null;
  const eerste=t.dagen[0];
  if(!(eerste.over>1))return null;
  return {n:eerste.over,tekst:vul(cfg.teksten.aftellenGetal,{dag:klein(eerste.label)})};
}
function meldingTekst(t,cfg){
  if(t.fase==="onbekend")return vul(cfg.teksten.onbekend,{jaar:t.jaar});
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

/* ---------- Soort "vakantie": een periode per regio, met data per jaar ---------- */
/* cfg.perioden: {jaar: [{regio, van, tot}]}, met ISO-datums (tot en met). De
   pagina toont het eerste jaar waarvan de vakantie nog niet voorbij is; staat
   het volgende jaar nog niet in de config, dan is de fase "onbekend". */
function vakantieJaren(cfg){return Object.keys(cfg.perioden||{}).map(Number).sort((a,b)=>a-b);}
function eersteVan(lijst){return lijst.reduce((m,p)=>p.van<m?p.van:m,lijst[0].van);}
function laatsteTot(lijst){return lijst.reduce((m,p)=>p.tot>m?p.tot:m,lijst[0].tot);}
function toestandVakantie(vandaag,cfg){
  const jaren=vakantieJaren(cfg);
  const jaar=jaren.find(j=>dagenTussen(vandaag,laatsteTot(cfg.perioden[j]))>=0);
  if(jaar==null)return {vandaag,jaar:Math.max(Number(vandaag.slice(0,4)),jaren.length?jaren[jaren.length-1]+1:0),dagen:[],perioden:[],vanaf:null,tot:null,fase:"onbekend"};
  const perioden=cfg.perioden[jaar],tot=laatsteTot(perioden),dagen=[];
  for(let iso=eersteVan(perioden);dagenTussen(iso,tot)>=0;iso=plusDagen(iso,1)){
    const over=dagenTussen(vandaag,iso);
    dagen.push({iso,label:datumTekst(iso,true),over,bezig:false,
      regios:perioden.filter(p=>p.van<=iso&&iso<=p.tot).map(p=>p.regio),
      zichtbaar:over>=0&&over<=cfg.vensterDagen-1,vanaf:plusDagen(iso,-(cfg.vensterDagen-1))});
  }
  const komend=dagen.find(d=>d.over>=0);
  return {vandaag,jaar,dagen,perioden,tot,vanaf:komend.vanaf,fase:dagen.some(d=>d.zichtbaar)?"verwachting":"ver"};
}
/* Aftellen per regio: "Het is herfstvakantie in regio noord. In regio midden en
   zuid begint de vakantie op zaterdag 17 oktober." Begint de vakantie overal
   op dezelfde dag, dan zonder regio. */
function vakantieAftellen(t,cfg){
  if(t.fase==="onbekend")return {tekst:"",groot:null};
  const T=cfg.teksten,v=t.vandaag;
  const regio=lijst=>lijst.length===t.perioden.length?"":` in regio ${lijstTekst(lijst)}`;
  const bezigNu=t.perioden.filter(p=>p.van<=v&&v<=p.tot).map(p=>p.regio);
  const later=t.perioden.filter(p=>p.van>v);
  const eerste=later.length?eersteVan(later):null,eersteRegios=later.filter(p=>p.van===eerste).map(p=>p.regio);
  if(bezigNu.length){
    const vandaagBegonnen=t.perioden.filter(p=>p.van===v).map(p=>p.regio);
    const zin=vandaagBegonnen.length===bezigNu.length?vul(T.aftellenVandaag,{regio:regio(bezigNu)}):bezigNu.length===t.perioden.length?T.overal:vul(T.bezig,{regios:lijstTekst(bezigNu)});
    return {tekst:eerste?zin+" "+vul(T.begintNog,{regios:lijstTekst(eersteRegios),datum:datumTekst(eerste,true)}):zin,groot:null};
  }
  const n=dagenTussen(v,eerste);
  if(n===1)return {tekst:vul(T.aftellenMorgen,{regio:regio(eersteRegios)}),groot:null};
  return {tekst:vul(T.aftellenMeer,{n,regio:regio(eersteRegios)}),groot:{n,tekst:vul(T.aftellenGetal,{regio:regio(eersteRegios)})}};
}
/* "10 t/m 18 oktober", "31 oktober t/m 1 november", en over de jaargrens
   met jaartallen: "19 december 2026 t/m 3 januari 2027". */
function periodeTekst(van,tot){
  const a=datumTekst(van,false),b=datumTekst(tot,false);
  if(van.slice(0,4)!==tot.slice(0,4))return `${a} ${van.slice(0,4)} t/m ${b} ${tot.slice(0,4)}`;
  return a.split(" ")[1]===b.split(" ")[1]?`${a.split(" ")[0]} t/m ${b}`:`${a} t/m ${b}`;
}
function vakantieWaarden(data,iso){
  const d=data&&data.daily;
  if(!d||!Array.isArray(d.time))return null;
  const i=d.time.indexOf(iso);
  if(i<0)return null;
  const reeks=k=>Array.isArray(d[k])?getal(d[k][i]):null,zon=reeks("sunshine_duration");
  return {tmin:reeks("temperature_2m_min"),tmax:reeks("temperature_2m_max"),neerslag:reeks("precipitation_sum"),sneeuw:reeks("snowfall_sum"),kans:reeks("precipitation_probability_max"),zon:zon==null?null:zon/3600};
}
/* Valt er een halve centimeter verse sneeuw of meer, dan noemt de cel sneeuw
   in cm in plaats van regen in mm: in de winter is neerslag niet altijd regen. */
function vakantieWeerTekst(w){
  if(!w||(w.neerslag==null&&w.zon==null))return "Geen gegevens";
  const kans=w.kans==null?"":` · kans ${Math.round(w.kans)}%`;
  if(w.sneeuw!=null&&w.sneeuw>=0.5)return `${komma(w.sneeuw,1)} cm sneeuw${kans}`;
  if(w.neerslag!=null&&w.neerslag>=0.2)return `${komma(w.neerslag,1)} mm regen${kans}`;
  if(w.zon==null)return "Droog";
  const uren=Math.round(w.zon);
  return uren<1?"Droog · weinig zon":`Droog · ${uren} uur zon`;
}
/* Overwegend droog: in minder dan de helft van de plaatsen 1 mm regen of meer. */
function overwegendDroog(resultaten,iso){
  const metData=resultaten.map(r=>r.dagen[iso]).filter(w=>w&&w.neerslag!=null);
  return metData.length?metData.filter(w=>w.neerslag>=1).length*2<metData.length:null;
}
function vakantieSamenvatting(t,resultaten,cfg){
  const T=cfg.teksten,oordeel=t.dagen.filter(d=>d.zichtbaar).map(d=>({d,droog:overwegendDroog(resultaten,d.iso)})).filter(x=>x.droog!=null);
  const m=oordeel.length,n=oordeel.filter(x=>x.droog).length;
  if(!m)return "";
  if(m===1)return vul(n?T.dagDroog:T.dagNat,{dag:oordeel[0].d.label});
  return n===m?vul(T.allesDroog,{m}):n===0?vul(T.nietsDroog,{m}):vul(T.deelsDroog,{n,m,zijn:n===1?"is":"zijn"});
}

/* Loopt de nacht nog (1 januari 01:00), dan begint de verwachting van vandaag
   pas om 00:00: past_days=1 haalt de uren van gisteravond erbij. */
function verwachtingUrl(cfg,t){
  const lat=cfg.plaatsen.map(p=>p.lat).join(","),lon=cfg.plaatsen.map(p=>p.lon).join(",");
  const velden=cfg.soort==="middernacht"
    ?"&hourly=temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility"
    :cfg.soort==="vakantie"
      ?"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,precipitation_probability_max,sunshine_duration"
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
    for(const d of t.dagen)if(d.zichtbaar)dagen[d.iso]=cfg.soort==="middernacht"?nachtWaarden(lijst[i],d.iso,cfg):cfg.soort==="vakantie"?vakantieWaarden(lijst[i],d.iso):dagWaarden(lijst[i],d.iso,cfg.ochtendUur);
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
/* Temperatuurbalkje (akkoord eigenaar, 14 oktober): dezelfde kleurschaal als de
   zevendagenweergave van de app (TEMP_SCHAAL in index.html; seizoenspagina.test.js
   bewaakt dat beide gelijk blijven). Alle plaatsen van één dag delen één schaal.
   Het balkje is een aanvulling op de cijfers en daarom aria-hidden. */
const TEMP_SCHAAL={
  licht:[[-10,"#254582"],[-4,"#295ca5"],[2,"#367ac1"],[8,"#5e97cd"],[13,"#afaca4"],[17,"#afaca4"],[21,"#c78829"],[26,"#bd6706"],[31,"#ad4600"],[36,"#8f331a"]],
  donker:[[-10,"#bbddf6"],[-4,"#92c4ee"],[2,"#73a9e1"],[8,"#5e91c0"],[13,"#77746d"],[17,"#77746d"],[21,"#bf8032"],[26,"#e28e3a"],[31,"#f0ab55"],[36,"#f7cd87"]]
};
function temperatuurKleur(t,thema){
  const stops=TEMP_SCHAAL[thema==="donker"?"donker":"licht"],rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  if(!(t>stops[0][0]))return "rgb("+rgb(stops[0][1]).join(",")+")";
  for(let k=1;k<stops.length;k++)if(t<=stops[k][0]){
    const [t0,c0]=stops[k-1],[t1,c1]=stops[k],f=(t-t0)/(t1-t0),a=rgb(c0),b=rgb(c1);
    return "rgb("+a.map((v,i)=>Math.round(v+(b[i]-v)*f)).join(",")+")";
  }
  return "rgb("+rgb(stops[stops.length-1][1]).join(",")+")";
}
/* Laagste minimum en hoogste maximum van één dag, over alle plaatsen. */
function dagBereik(dag,resultaten){
  const w=resultaten.map(r=>r.dagen[dag.iso]).filter(x=>x&&Number.isFinite(x.tmin)&&Number.isFinite(x.tmax));
  return w.length?{lo:Math.min(...w.map(x=>x.tmin)),hi:Math.max(...w.map(x=>x.tmax))}:null;
}
function tempBalk(w,bereik){
  if(!bereik||!w||!Number.isFinite(w.tmin)||!Number.isFinite(w.tmax))return null;
  const span=Math.max(1,bereik.hi-bereik.lo),links=(w.tmin-bereik.lo)/span*100,breed=Math.max(8,(w.tmax-w.tmin)/span*100);
  const verloop=thema=>`linear-gradient(90deg,${temperatuurKleur(w.tmin,thema)},${temperatuurKleur(w.tmax,thema)})`;
  return el("span",{class:"tbalk","aria-hidden":"true"},el("i",{style:`left:${links.toFixed(1)}%;width:${Math.min(breed,100-links).toFixed(1)}%;--licht:${verloop("licht")};--donker:${verloop("donker")}`}));
}
/* Kop en rij voor tabellen met min/max: op desktop staat het balkje in een eigen
   kolom (zodat "Min / max" recht boven de cijfers staat), op een telefoon onder
   de cijfers. */
function minMaxKop(kolommen){
  return el("thead",{},el("tr",{},[...kolommen.map(k=>el("th",{scope:"col"},k)),el("td",{class:"tbalkkop","aria-hidden":"true"}),el("th",{scope:"col"},"Min / max")]));
}
function minMaxCellen(w,bereik){
  const balk=tempBalk(w,bereik),cijfers=el("td",{class:"temp"},w?`${graden(w.tmin)} / ${graden(w.tmax)}`:"–");
  if(balk)cijfers.append(balk.cloneNode(true));
  return [el("td",{class:"tbalkcel","aria-hidden":"true"},balk||[]),cijfers];
}
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
  tabel.append(minMaxKop(["Plaats","Sneeuw"]));
  const body=el("tbody",{}),bereik=dagBereik(dag,resultaten);
  for(const r of resultaten){
    const w=r.dagen[dag.iso];
    body.append(el("tr",{},[plaatsCel(r.plaats),el("td",{},sneeuwTekst(w)),...minMaxCellen(w,bereik)]));
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
/* Is de dag in alle regio's vakantie, dan "alle regio's" in plaats van de
   volledige opsomming. */
function regioKop(dag,aantal){return dag.regios.length===aantal?"alle regio's":"regio "+lijstTekst(dag.regios);}
/* Snelkoppelingen naar de dagen van een vakantie (vanaf drie zichtbare dagen): de tekst is dezelfde als
   de dagkop, zodat de vertaling hem herkent. Op een brede kaart staan de dagen naast elkaar en
   verbergt de stijl de regel. */
function dagKoppelingen(dagen){
  const p=el("p",{class:"seizoen-zieook seizoen-dagnav"},[el("span",{},"Naar dag")," "]);
  dagen.forEach((dag,i)=>{
    if(i)p.append(" · ");
    p.append(el("a",{href:"#dag-"+dag.iso},dag.label.charAt(0).toUpperCase()+dag.label.slice(1)));
  });
  return p;
}
function vakantieTabel(dag,resultaten,aantal){
  const sectie=el("section",{class:"seizoen-dag","data-datum":dag.iso,id:"dag-"+dag.iso});
  sectie.append(el("h3",{},[dag.label.charAt(0).toUpperCase()+dag.label.slice(1)+" ",el("span",{},regioKop(dag,aantal))]));
  const tabel=el("table",{class:"seizoen-vakantie"});
  tabel.append(minMaxKop(["Plaats","Weer"]));
  const body=el("tbody",{}),bereik=dagBereik(dag,resultaten);
  for(const r of resultaten){
    const w=r.dagen[dag.iso];
    body.append(el("tr",{},[plaatsCel(r.plaats),tweedelig(vakantieWeerTekst(w)),...minMaxCellen(w,bereik)]));
  }
  tabel.append(body);
  sectie.append(tabel);
  return sectie;
}
function toonVakantie(doel,t,resultaten,cfg,bronZin){
  doel.replaceChildren();
  const zin=vakantieSamenvatting(t,resultaten,cfg);
  if(zin)doel.append(el("p",{class:"seizoen-samenvatting"},zin));
  const zichtbaar=t.dagen.filter(d=>d.zichtbaar);
  if(zichtbaar.length>=3)doel.append(dagKoppelingen(zichtbaar));
  for(const dag of zichtbaar)doel.append(vakantieTabel(dag,resultaten,t.perioden.length));
  if(t.dagen.some(d=>!d.zichtbaar&&d.over>0))doel.append(el("p",{class:"seizoen-later"},vul(cfg.teksten.later,{tot:datumTekst(t.tot,true)})));
  /* Met een reservebron staat er één bronzin met de echte bron, niet ook nog
     "Bron: Open-Meteo". */
  if(bronZin){
    const zonderBron=cfg.teksten.toelichting.replace(/\s*Bron: Open-Meteo\.\s*$/,"");
    if(zonderBron)doel.append(el("p",{class:"klein"},zonderBron));
    doel.append(el("p",{class:"klein seizoen-bron"},bronZin));
  }else doel.append(el("p",{class:"klein"},cfg.teksten.toelichting));
}
function toon(doel,t,resultaten,cfg,bronZin){
  if(cfg.soort==="vakantie")return toonVakantie(doel,t,resultaten,cfg,bronZin);
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
/* Open-Meteo hapert soms kort (429, 5xx of een time-out). Eén nieuwe poging na
   twee seconden vangt dat op; mislukt die ook, dan volgt de gewone foutmelding
   (akkoord eigenaar, 14 oktober). */
const NIEUWE_POGING_MS=2000;
async function haalEenmaal(url,ms,metBron){
  const stop=new AbortController(),timer=setTimeout(()=>stop.abort(),ms);
  try{
    const res=await fetch(url,{signal:stop.signal});
    if(!res.ok)throw new Error("HTTP "+res.status);
    const json=await res.json();
    return metBron?{json,bron:res.headers.get("X-WIW-Weather-Source")||""}:json;
  }finally{
    clearTimeout(timer);
  }
}
async function haalVerwachting(url){
  for(let poging=1;;poging++){
    try{
      return await haalEenmaal(url,10000);
    }catch(e){
      if(poging>=2)throw e;
    }
    await new Promise(r=>setTimeout(r,NIEUWE_POGING_MS));
  }
}
/* Reserve voor de vakantiepagina's (verslag L1/B1): na twee mislukte pogingen bij
   Open-Meteo vraagt de pagina per plaats de eigen reserveroute (/api/forecast:
   Visual Crossing, daarna WeatherAPI; zelfde vorm als Open-Meteo, elke antwoord
   10 minuten in de edge-cache). Een plaats die ook daar ontbreekt blijft
   onbekend ("Geen gegevens"); pas als geen enkele plaats antwoordt volgt de
   foutmelding. Velden die de reserve niet kent (zonuren) blijven onbekend. */
async function haalReserve(cfg){
  const uit=await Promise.all(cfg.plaatsen.map(p=>
    haalEenmaal("/api/forecast?lat="+encodeURIComponent(p.lat)+"&lon="+encodeURIComponent(p.lon),8000,true).catch(()=>null)));
  const antwoorden=uit.map(u=>u&&u.json&&u.json.daily?u.json:null);
  if(!antwoorden.some(Boolean))throw new Error("Geen reserveverwachting");
  /* De bron per plaats komt uit de kop X-WIW-Weather-Source van de reserveroute. */
  return {antwoorden,bronnen:uit.map((u,i)=>antwoorden[i]?u.bron:null)};
}
const RESERVEBRON={visualcrossing:"Visual Crossing",weatherapi:"WeatherAPI"};
/* De bronzin als een reservebron is gebruikt: de werkelijk gebruikte bron(nen),
   per bron de plaatsen als ze verschillen. Plaatsen zonder gegevens komen er
   niet in voor (die tonen "Geen gegevens"). Null als geen enkele plaats data heeft. */
function reserveBronTekst(plaatsen,bronnen){
  const groepen=new Map();
  plaatsen.forEach((p,i)=>{
    if(bronnen[i]==null)return;
    const naam=RESERVEBRON[bronnen[i]]||"een reservebron";
    if(!groepen.has(naam))groepen.set(naam,[]);
    groepen.get(naam).push(p.naam);
  });
  if(!groepen.size)return null;
  const delen=[...groepen].map(([naam,namen])=>groepen.size>1?`${naam} (${lijstTekst(namen)})`:naam);
  return `Bron: ${lijstTekst(delen)}, omdat Open-Meteo niet bereikbaar was.`;
}
let getoond="",bewaakt=false,lopend=0;
/* De foutmelding met een werkende link naar het weer voor de eigen plaats (de
   zoekbalk op de startpagina) en de knop om opnieuw te proberen. */
const EIGEN_PLAATS="bekijk het weer voor je eigen plaats";
function foutBlok(cfg){
  const tekst=cfg.teksten.fout,i=tekst.indexOf(EIGEN_PLAATS);
  const alinea=el("p",{class:"seizoen-fout"});
  if(i<0)alinea.append(tekst);
  else alinea.append(tekst.slice(0,i),el("a",{href:"/"},EIGEN_PLAATS),tekst.slice(i+EIGEN_PLAATS.length));
  const knop=el("button",{type:"button",class:"seizoen-opnieuw"},"Opnieuw proberen");
  knop.addEventListener("click",()=>{
    /* De knop verdwijnt bij het opnieuw opbouwen: houd de focus op de blijvende verwachtingsregio. */
    const regio=document.getElementById("seizoen-verwachting");
    if(regio&&document.activeElement===knop){regio.tabIndex=-1;regio.dataset.focus="1";regio.focus({preventScroll:true});}
    knop.disabled=true;start();
  });
  const blok=el("div",{class:"seizoen-fout-blok"});
  blok.append(alinea,knop);
  return blok;
}
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
    aftellen.hidden=!aftellen.textContent;
    /* Vakantiepagina's: de zin over wie wanneer vakantie heeft staat als gewone
       tekst onder een korte tussenkop, niet als grote seriftekst. Het grote
       aftelgetal blijft zoals het was. */
    const tekstvorm=cfg.soort==="vakantie"&&!groot&&!aftellen.hidden;
    aftellen.classList.toggle("tekst",tekstvorm);
    let tussenkop=document.getElementById("seizoen-aftel-kop");
    if(tekstvorm&&!tussenkop){tussenkop=el("h2",{id:"seizoen-aftel-kop",class:"seizoen-aftel-kop"});aftellen.before(tussenkop);}
    if(tussenkop){tussenkop.textContent=`${cfg.naam} per regio`;tussenkop.hidden=!tekstvorm;}
  }
  const melding=document.getElementById("seizoen-melding");
  if(melding){melding.textContent=meldingTekst(t,cfg);melding.hidden=!melding.textContent;}
  const doel=document.getElementById("seizoen-verwachting");
  if(!doel)return;
  if(t.fase!=="verwachting"){lopend++;doel.replaceChildren();doel.removeAttribute("aria-busy");delete doel.dataset.focus;return;}
  /* Alleen het laatste ophalen telt: een oudere, trage aanvraag (of een
     tweede klik op "Opnieuw proberen") mag het scherm niet meer overschrijven. */
  const volgnummer=++lopend;
  doel.setAttribute("aria-busy","true");
  doel.replaceChildren(el("p",{class:"klein"},"Verwachting laden…"));
  try{
    let antwoord,bronZin=null;
    try{
      antwoord=await haalVerwachting(verwachtingUrl(cfg,t));
    }catch(e){
      if(cfg.soort!=="vakantie")throw e;
      const reserve=await haalReserve(cfg);
      antwoord=reserve.antwoorden;
      bronZin=reserveBronTekst(cfg.plaatsen,reserve.bronnen);
    }
    if(volgnummer!==lopend)return;
    toon(doel,t,verwerkAntwoord(antwoord,t,cfg),cfg,bronZin);
    delete doel.dataset.focus;
  }catch(e){
    if(volgnummer!==lopend)return;
    doel.replaceChildren(foutBlok(cfg));
    /* Mislukt ook een nieuwe poging, dan krijgt de nieuwe knop de focus. */
    if(doel.dataset.focus){delete doel.dataset.focus;const nieuw=doel.querySelector(".seizoen-opnieuw");if(nieuw)nieuw.focus({preventScroll:true});}
  }finally{
    if(volgnummer===lopend)doel.removeAttribute("aria-busy");
  }
}

const api={TEMP_SCHAAL,temperatuurKleur,dagBereik,toestandVakantie,periodeTekst,regioKop,vakantieAftellen,vakantieWaarden,vakantieWeerTekst,overwegendDroog,vakantieSamenvatting,datumISO,dagenTussen,plusDagen,datumTekst,nuIn,vandaagIn,vul,eindUur,toestand,aftelTekst,aftelGetal,meldingTekst,dagWaarden,heeftSneeuwdek,sneeuwTekst,samenvatting,richting,uurStempel,nachtWaarden,neerslagTekst,windTekst,lijstTekst,nachtSamenvatting,verwachtingUrl,verwerkAntwoord,reserveBronTekst};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else if(typeof document!=="undefined"){
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
}
})();

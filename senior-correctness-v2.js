/* Senior-correctheidslaag: pure rekenhelpers + browserintegratie.
   Wordt door build-weather.js in de productiebundel ingevoegd. */
(function(root){
"use strict";

const grammatica=typeof module!=="undefined"&&module.exports
  ?require("./nederlandse-weergrammatica.js")
  :root.WeatherNowNederlandseGrammatica;

const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const clampNum=(v,a,b)=>Math.max(a,Math.min(b,v));
const natCode=code=>{code=Number(code);return code>=51&&code<=99;};
const mistCode=code=>Number(code)===45||Number(code)===48;
const hoofdletter=t=>{t=String(t||"");return t?t.charAt(0).toUpperCase()+t.slice(1):t;};
const kleineStart=t=>{t=String(t||"");return t?t.charAt(0).toLowerCase()+t.slice(1):t;};

function nachtzichtScore(rijen){
  const alle=Array.isArray(rijen)?rijen:[];
  const geldig=alle.filter(r=>num(r.cloud)!==null&&num(r.visibility)!==null);
  const dekking=alle.length?geldig.length/alle.length:0;
  if(geldig.length<2||dekking<0.65) return {genoeg:false,score:null,dekking,reden:"onvoldoende data",beste:null};
  const gem=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const clouds=geldig.map(r=>clampNum(num(r.cloud),0,100));
  const vis=geldig.map(r=>Math.max(0,num(r.visibility)));
  const hum=geldig.map(r=>num(r.humidity)).filter(v=>v!==null&&v>=0&&v<=100);
  const spread=geldig.map(r=>num(r.spread)).filter(v=>v!==null);
  const gust=geldig.map(r=>num(r.gust)).filter(v=>v!==null&&v>=0);
  const moon=geldig.map(r=>clampNum(num(r.moon)||0,0,1));
  const wet=geldig.filter(r=>(num(r.precip)||0)>=0.05||natCode(r.code)).length;
  const fog=geldig.filter(r=>mistCode(r.code)||num(r.visibility)<1000).length;
  const cw=gem(clouds),gemVis=gem(vis);
  let score=(1-cw/100)*10;
  if(hum.length&&gem(hum)>93) score-=1;
  if(spread.length&&Math.min(...spread)<1.5) score-=1;
  if(gust.length&&Math.max(...gust)>45) score-=1;
  score-=2.2*(moon.length?gem(moon):0)*(1-cw/140);
  if(gemVis<1000) score=Math.min(score,1.5);
  else if(gemVis<4000) score=Math.min(score,3.5);
  else if(gemVis<8000) score=Math.min(score,6);
  if(fog/geldig.length>=0.5) score=Math.min(score,2);
  else if(fog) score-=0.8;
  if(wet/geldig.length>=0.5) score=Math.min(score,3);
  else if(wet) score-=0.7;
  score=clampNum(score,0,10);

  const goed=r=>num(r.cloud)!==null&&num(r.cloud)<35
    &&num(r.visibility)!==null&&num(r.visibility)>=8000
    &&(num(r.precip)||0)<0.05&&!mistCode(r.code)&&!natCode(r.code)
    &&clampNum(num(r.moon)||0,0,1)<0.2;
  let run=[],beste=[];
  for(const r of alle){
    const ms=num(r.ms),vorige=run.length?num(run[run.length-1].ms):null;
    const aansluit=vorige!==null&&ms!==null&&ms>vorige&&ms-vorige<=90*60000;
    if(!goed(r)){run=[];continue;}
    if(run.length&&!aansluit) run=[];
    run.push(r);
    if(run.length>beste.length) beste=run.slice();
  }
  const besteVenster=beste.length>=2?beste:null;

  const redenen=[];
  if(gemVis<8000||fog) redenen.push(gemVis<1000||fog/geldig.length>=0.5?"mist of zeer slecht zicht":"beperkt zicht");
  if(wet) redenen.push("neerslag");
  if(cw>=35) redenen.push("bewolking");
  if(moon.length&&gem(moon)>=0.2) redenen.push("maanlicht");
  return {genoeg:true,score,dekking,gemBewolking:cw,gemZicht:gemVis,beste:besteVenster,redenen};
}

function grafiekNeerslagVerschuiving(cw){
  const n=num(cw); return n===null?0:-n/2;
}

/* Een dagcode kan bijvoorbeeld "Lichte motregen" zijn terwijl de kans slechts
   12 procent is. Een berekende hoeveelheid mag dan niet van een kleine kans een
   stellige gebeurtenis maken. De kans bepaalt daarom de modaliteit van de zin;
   de WMO-code bepaalt alleen welk type neerslag genoemd wordt. */
function dagKansSamenvatting(a,basis){
  if(!a||!a.genoeg) return "Onvoldoende consistente gegevens";
  basis=String(basis||"Verwachting");
  const kans=num(a.kans),soort=String(a.soort||"neerslag");
  const type=basis.toLowerCase().includes(soort.toLowerCase())?basis:hoofdletter(soort);
  const tijd=a.eersteTijd?" rond "+a.eersteTijd:"";
  if(a.status==="NEERSLAG_VERWACHT"){
    if(kans!==null&&kans<=19) return "Zeer kleine kans op "+kleineStart(type)+tijd;
    if(kans!==null&&kans<=39) return "Kleine kans op "+kleineStart(type)+tijd;
    if(kans!==null&&kans<=69) return hoofdletter(type)+" mogelijk"+tijd;
    const zelfde=basis.toLowerCase().includes(soort.toLowerCase());
    return basis+(zelfde?"":"; "+soort)+tijd;
  }
  if(a.status==="SPOORHOEVEELHEID") return basis+"; zeer kleine hoeveelheid "+soort+" mogelijk";
  if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID") return basis+"; grote neerslagkans, hoeveelheid onzeker";
  if(a.status==="MOGELIJKE_NEERSLAG") return basis+"; neerslag mogelijk";
  if(a.status==="KLEINE_KANS") return basis+"; kleine neerslagkans";
  if(a.status==="ZEER_KLEINE_KANS") return basis+"; zeer kleine neerslagkans";
  return basis;
}

/* De waarde 27% staat al groot boven deze tekst. De toelichting eronder moet de
   gebruiker helpen, niet de bronberekening herhalen met termen als modeluur en
   overlappende uurvakken. De technische uitleg blijft elders beschikbaar. */
function komendUurTekst(a){
  if(!a||!a.genoeg) return "Neerslagkans niet beschikbaar.";
  const kans=num(a.kans),soort=String(a.soort||"neerslag");
  if(a.status==="GEEN_KANS") return "Geen neerslag verwacht.";
  if(a.status==="ZEER_KLEINE_KANS") return "Zeer kleine kans op neerslag het komende uur.";
  if(a.status==="KLEINE_KANS") return "Kleine kans op neerslag het komende uur.";
  if(a.status==="MOGELIJKE_NEERSLAG") return "Neerslag is mogelijk het komende uur.";
  if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID") return "Grote kans op neerslag; hoeveelheid onzeker.";
  if(a.status==="SPOORHOEVEELHEID") return "Enkele druppels mogelijk het komende uur.";
  if(a.status==="NEERSLAG_NU") return grammatica.actueleNeerslagZin(soort);
  if(a.status==="NEERSLAG_VERWACHT"){
    if(kans!==null&&kans<=39) return "Kleine kans op neerslag het komende uur.";
    if(kans!==null&&kans<=69) return grammatica.soortIsMogelijk(soort)+" het komende uur.";
    return hoofdletter(grammatica.soortWordtVerwacht(soort,"het komende uur"))+".";
  }
  return "Neerslagverwachting beschikbaar.";
}

/* Alleen maanopkomst/-ondergang binnen het werkelijk beoordeelde nachtvenster
   is relevant. Een ondergang om 20:29 hoort niet in een rij die pas om 21:16
   begint. */
function maanEventsBinnenVenster(op,onder,startMs,eindMs){
  if(!Number.isFinite(startMs)||!Number.isFinite(eindMs)||eindMs<=startMs) return [];
  const uit=[];
  if(Number.isFinite(op)&&op>=startMs&&op<=eindMs) uit.push({type:"op",ms:op});
  if(Number.isFinite(onder)&&onder>=startMs&&onder<=eindMs) uit.push({type:"onder",ms:onder});
  return uit.sort((a,b)=>a.ms-b.ms);
}

const api={nachtzichtScore,grafiekNeerslagVerschuiving,dagKansSamenvatting,komendUurTekst,maanEventsBinnenVenster};
if(typeof module!=="undefined"&&module.exports) module.exports=api;
root.WeatherNowCorrectnessV2=api;

if(typeof document!=="undefined"&&typeof S!=="undefined"){
  function maanFactor(tijd){
    try{
      const ms=naarUTC(tijd),m=maan(new Date(ms));
      const h=maanHoogte(ms,S.lat,S.lon);
      const hoogte=h<=0?0:Math.min(1,Math.sin(h*Math.PI/180)/Math.sin(45*Math.PI/180));
      return hoogte*m.ill;
    }catch(e){return 0;}
  }
  function uurRij(i){
    const h=S.d.hourly,t=h.time[i],temp=num(h.temperature_2m&&h.temperature_2m[i]),dp=num(h.dew_point_2m&&h.dew_point_2m[i]);
    return {tijd:t,ms:naarUTC(t),cloud:num(h.cloud_cover&&h.cloud_cover[i]),visibility:num(h.visibility&&h.visibility[i]),
      precip:num(h.precipitation&&h.precipitation[i]),code:num(h.weather_code&&h.weather_code[i]),
      humidity:num(h.relative_humidity_2m&&h.relative_humidity_2m[i]),spread:temp!==null&&dp!==null?temp-dp:null,
      gust:num(h.wind_gusts_10m&&h.wind_gusts_10m[i]),moon:maanFactor(t)};
  }
  function actueleRij(){
    const c=S.d.current||{},h=S.d.hourly||{},i=S.i0,temp=num(c.temperature_2m),dp=num(h.dew_point_2m&&h.dew_point_2m[i]);
    const t=weatherNowActueleLokaleTijd();
    return {tijd:t,ms:naarUTC(t),cloud:num(c.cloud_cover),visibility:num(c.visibility),precip:num(c.precipitation),code:num(c.weather_code),
      humidity:num(c.relative_humidity_2m),spread:temp!==null&&dp!==null?temp-dp:null,gust:num(c.wind_gusts_10m),moon:maanFactor(t)};
  }
  function segmenten(){
    const h=S.d.hourly||{},is=h.is_day||[],uit=[];let begin=null;
    for(let i=0;i<is.length;i++){
      if(Number(is[i])===0&&begin===null) begin=i;
      if(begin!==null&&(Number(is[i])===1||i===is.length-1)){
        const eind=Number(is[i])===1?i-1:i;
        if(eind>=begin) uit.push({begin,eind});
        begin=null;
      }
    }
    return uit;
  }
  function labelDag(t){
    const d=new Date(String(t).slice(0,10)+"T12:00:00");return DAGEN[d.getDay()];
  }
  function redenTekst(r){
    return grammatica.geenZichtvensterZin(r);
  }
  function nachtGrenzen(segment,vanafMs){
    const h=S.d.hourly||{},day=S.d.daily||{};
    const eerste=h.time&&h.time[segment.begin],laatste=h.time&&h.time[segment.eind];
    let start=naarUTC(eerste),eind=naarUTC(laatste)+3600000;
    if(!Number.isFinite(start)||!Number.isFinite(eind)) return null;
    const zonOnder=(day.sunset||[]).map(t=>naarUTC(t)).filter(Number.isFinite)
      .filter(ms=>ms>=start-12*3600000&&ms<=start+3600000).sort((a,b)=>b-a)[0];
    const zonOp=(day.sunrise||[]).map(t=>naarUTC(t)).filter(Number.isFinite)
      .filter(ms=>ms>=eind-2*3600000&&ms<=eind+4*3600000).sort((a,b)=>a-b)[0];
    if(Number.isFinite(zonOnder)) start=zonOnder;
    if(Number.isFinite(zonOp)) eind=zonOp;
    if(Number.isFinite(vanafMs)) start=Math.max(start,vanafMs);
    return eind>start?{start,eind}:null;
  }
  function maanInfo(segment,vanafMs){
    try{
      const grens=nachtGrenzen(segment,vanafMs);if(!grens)return {icoon:"",titel:"",tijden:"",fase:null};
      const mt=opOnder("maan",grens.start-6*3600000,S.lat,S.lon);
      const events=maanEventsBinnenVenster(mt.op,mt.onder,grens.start,grens.eind);
      const midden=(grens.start+grens.eind)/2,mn=maan(new Date(midden));
      let tijden="";
      if(events.length){
        tijden=events.map(e=>e.type==="op"?"maan op "+naarLokaal(e.ms):"maan onder "+naarLokaal(e.ms)).join(" · ");
      }else{
        tijden=maanHoogte(midden,S.lat,S.lon)>0?"maan blijft boven de horizon":"maan blijft onder de horizon";
      }
      return {icoon:maanUnicode(mn.fase),titel:mn.naam+", "+Math.round(mn.ill*100)+" procent verlicht",tijden,fase:mn.fase};
    }catch(e){return {icoon:"",titel:"",tijden:"",fase:null};}
  }

  nachten=function(){
    const h=S.d.hourly||{},nuMs=naarUTC(weatherNowActueleLokaleTijd()),stukken=segmenten().filter(s=>s.eind>=S.i0).slice(0,6);
    let out="";
    for(const s of stukken){
      const actueel=S.i0>=s.begin&&S.i0<=s.eind&&Number(S.d.current&&S.d.current.is_day)===0;
      const rijen=[];
      if(actueel) rijen.push(actueleRij());
      const vanaf=actueel?Math.max(S.i0+1,s.begin):s.begin;
      for(let i=vanaf;i<=s.eind;i++){
        const r=uurRij(i); if(r.ms>=nuMs) rijen.push(r);
      }
      if(!rijen.length) continue;
      const a=nachtzichtScore(rijen),eerste=rijen[0],laatste=rijen[rijen.length-1],mi=maanInfo(s,actueel?nuMs:null);
      const lbl=actueel?"vannacht":labelDag(eerste.tijd)+" op "+labelDag(laatste.tijd);
      let advies,venster;
      if(!a.genoeg){advies="Onvoldoende data";venster="Geen betrouwbare zichtscore";}
      else{
        advies=a.score>=8.5?"Uitstekend":a.score>=7?"Goed":a.score>=5?"Redelijk":a.score>=3.5?"Matig":"Ongunstig";
        if(a.beste){
          const bs=a.beste[0],be=a.beste[a.beste.length-1];
          const eindIndex=h.time.indexOf(be.tijd),volgende=eindIndex>=0&&h.time[eindIndex+1]?h.time[eindIndex+1]:null;
          venster="Beste periode "+(actueel&&bs===eerste?weatherNowActueleLokaleTijd().slice(11,16):bs.tijd.slice(11,16))
            +"–"+(volgende?volgende.slice(11,16):be.tijd.slice(11,16));
        }else venster=redenTekst(a.redenen);
      }
      const score=a.genoeg?Math.round(a.score)+"/10":"–",breed=a.genoeg?a.score*10:0;
      const kleur=!a.genoeg?INK25:a.score>=7?TEAL:a.score>=4?INK:INK25;
      const bew=a.genoeg&&Number.isFinite(a.gemBewolking)?Math.round(a.gemBewolking)+"%":"–";
      const zicht=a.genoeg&&Number.isFinite(a.gemZicht)?(a.gemZicht>=10000?"10+ km":nl(a.gemZicht/1000)+" km"):"onbekend";
      const faseAttribuut=Number.isFinite(mi.fase)?` data-maan-fase="${mi.fase.toFixed(4)}"`:"";
      const maanTekst=mi.tijden?` · <span class="maanbij" title="${esc(mi.titel)}"${faseAttribuut}>${mi.icoon}</span> ${esc(mi.tijden)}`:"";
      out+=`<div class="row night"><div class="dname">${lbl}</div><div class="score" style="color:${kleur}" title="Zichtscore op basis van resterende nacht">${score}</div>`
        +`<div class="sbar"><i style="width:${breed}%;background:${kleur}"></i></div>`
        +`<div class="nmeta"><span class="perc">${bew}</span> bewolking</div>`
        +`<div class="nmeta wide"><span class="nachtadvies">${advies}</span><span class="nachtvenster">${venster}</span><span class="nachtmaan">Zicht ${zicht}${maanTekst}</span></div></div>`;
    }
    const kop=`<div class="row night kop"><div class="dname">Nacht</div><div class="score">Score</div><div class="sbar"></div><div class="nmeta">Bewolking</div><div class="nmeta wide">Beste zichtperiode</div></div>`;
    document.getElementById("nights").innerHTML=out?kop+out:'<div class="msg">Geen nachtdata beschikbaar.</div>';
    const m=maan(new Date());
    const moonlab=document.getElementById("moonlab");
    moonlab.dataset.maanFase=m.fase.toFixed(4);
    moonlab.innerHTML=maanUnicode(m.fase)+"<span>"+m.naam+", "+Math.round(m.ill*100)+" procent verlicht</span>";
  };

  /* De centrale engine houdt de volledige bronuitleg beschikbaar. In de kleine
     tegel tonen we alleen de consumentenzin; het percentage zelf staat al erboven. */
  const basisMetersPolish=meters;
  meters=function(){
    basisMetersPolish();
    const interpretatie=root.WeatherNowInterpretatie;
    if(!interpretatie||typeof interpretatie.analyseerNeerslagData!=="function") return;
    const a=interpretatie.analyseerNeerslagData(S.d,60,weatherNowActueleLokaleTijd());
    zetTekst("popsub",komendUurTekst(a));
  };

  /* De daganalyse zelf blijft canoniek in de interpretatie-engine. Alleen de
     formulering van een berekende hoeveelheid bij een lage kans wordt hier
     begrensd, zodat 12% nooit als een zekere motregenbui wordt gepresenteerd. */
  const basisDagenPolish=dagen;
  dagen=function(){
    basisDagenPolish();
    const interpretatie=root.WeatherNowInterpretatie;
    if(!interpretatie||typeof interpretatie.analyseerDagData!=="function") return;
    document.querySelectorAll("#days .row.day").forEach(rij=>{
      if(rij.classList&&rij.classList.contains("kop")) return;
      const i=Number(rij.dataset.i),a=interpretatie.analyseerDagData(S.d,i,weatherNowActueleLokaleTijd());
      const cond=rij.querySelector(".dcond");
      if(!cond) return;
      const basis=a&&a.code!==null&&typeof txt==="function"?txt(a.code,true):"Verwachting";
      cond.textContent=dagKansSamenvatting(a,basis);
    });
  };

  const basisEtmaal=etmaal;
  etmaal=function(start,n){
    /* Bij een bewust gekozen kalenderdag is de neerslagwaarde met tijd 00:00
       de som/kans van 23:00–00:00 van de vorige dag. Die ligt volledig buiten
       het gekozen dagvenster en moet dus niet links van de grafiek verschijnen.
       De waarde op de volgende 00:00 blijft juist wel staan: die hoort bij het
       laatste uur 23:00–00:00 van de gekozen dag. */
    const gekozenDag=S.dag!=null&&n===24,h=S.d&&S.d.hourly||{};
    let oudeKans,oudeMm,hadKans=false,hadMm=false;
    if(gekozenDag&&Number.isInteger(start)&&start>=0){
      if(Array.isArray(h.precipitation_probability)&&start<h.precipitation_probability.length){hadKans=true;oudeKans=h.precipitation_probability[start];h.precipitation_probability[start]=null;}
      if(Array.isArray(h.precipitation)&&start<h.precipitation.length){hadMm=true;oudeMm=h.precipitation[start];h.precipitation[start]=null;}
    }
    try{basisEtmaal(start,n);}finally{
      if(hadKans)h.precipitation_probability[start]=oudeKans;
      if(hadMm)h.precipitation[start]=oudeMm;
    }
    const svg=document.getElementById("chart"),g=S.geo;
    if(!svg||!g||!Number.isFinite(g.cw)) return;
    const dx=grafiekNeerslagVerschuiving(g.cw);
    [...svg.querySelectorAll("rect")].forEach(el=>{
      if(el.getAttribute("fill")===TEAL&&el.getAttribute("fill-opacity")===".16"){
        const x=num(el.getAttribute("x")); if(x!==null) el.setAttribute("x",String(x+dx));
      }
    });
    [...svg.querySelectorAll("text")].forEach(el=>{
      const hoeveelheid=/ millimeter neerslag$/.test(el.getAttribute("aria-label")||"");
      if(el.getAttribute("fill")===TEAL||hoeveelheid){
        const x=num(el.getAttribute("x"));if(x!==null)el.setAttribute("x",String(x+dx));
      }
    });
    const aria=svg.getAttribute("aria-label")||"Weergrafiek";
    svg.setAttribute("aria-label",aria+" Neerslagbalken zijn gecentreerd over het voorafgaande modeluur; een deels verstreken modeluur wordt niet kunstmatig naar minuten omgerekend.");
  };
}
})(typeof globalThis!=="undefined"?globalThis:this);

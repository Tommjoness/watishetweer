"use strict";

/*
 * Senior hardening voor exact de gebouwde WeatherNow-HTML.
 *
 * Dit bestand is bewust een compilerstap en geen test. Elke verwachte bronvorm
 * moet precies één keer voorkomen; bij nul of meerdere matches stopt de build.
 */
function pasToe(bron){
  let html=String(bron);
  const exact=(zoek,vervang,label)=>{
    const n=html.split(zoek).length-1;
    if(n!==1) throw new Error(label+": verwacht precies één match, gevonden "+n+".");
    html=html.replace(zoek,vervang);
  };

  /* Reeds bekende productie-integratiefouten. */
  exact('const recent=veldGetal(c.precipitation,"precipitation");',
    'const recent=veldGetal("precipitation",c.precipitation);',"actuele neerslagwaarde");
  exact('const dagsom=idx>=0&&dag.precipitation_sum?veldGetal(dag.precipitation_sum[idx],"precipitation_sum"):null;',
    'const dagsom=idx>=0&&dag.precipitation_sum?veldGetal("precipitation",dag.precipitation_sum[idx]):null;',"dagelijkse neerslagsom");
  exact('const basis=/^\\d{4}-\\d{2}-\\d{2}$/.test(bronDatum)?bronDatum:plaatsVandaag();',
    'const basis=plaatsVandaag();',"lokale daggrens");

  /* Lokale klok: productie gebruikt de IANA-zone uit de API. S.klokOverride
     behoudt de historische testsuite-semantiek; klokInstantOverride is alleen
     voor tests die juist een absoluut UTC-moment over een DST-grens willen zetten. */
  exact(
`function plaatsVandaag(){
  const t=plaatsNu();
  return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");
}`,
`function plaatsTijdDelen(){
  if(S.klokOverride&&typeof S.klokOverride.getTime==="function"){
    const eigen=-new Date().getTimezoneOffset()*60;
    const daar=(S.d&&S.d.utc_offset_seconds!=null)?S.d.utc_offset_seconds:eigen;
    const t=new Date(S.klokOverride.getTime()+(daar-eigen)*1000);
    return {year:t.getFullYear(),month:t.getMonth()+1,day:t.getDate(),hour:t.getHours(),minute:t.getMinutes(),second:t.getSeconds()};
  }
  const basis=(S.klokInstantOverride&&typeof S.klokInstantOverride.getTime==="function")?S.klokInstantOverride.getTime():Date.now();
  const tz=S.d&&S.d.timezone;
  if(tz&&typeof Intl!=="undefined"&&Intl.DateTimeFormat){
    try{
      const delen=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(basis));
      const p={}; delen.forEach(x=>{if(x.type!=="literal")p[x.type]=Number(x.value);});
      if([p.year,p.month,p.day,p.hour,p.minute,p.second].every(Number.isFinite))return p;
    }catch(e){}
  }
  const eigen=-new Date(basis).getTimezoneOffset()*60;
  const daar=(S.d&&S.d.utc_offset_seconds!=null)?S.d.utc_offset_seconds:eigen;
  const t=new Date(basis+(daar-eigen)*1000);
  return {year:t.getFullYear(),month:t.getMonth()+1,day:t.getDate(),hour:t.getHours(),minute:t.getMinutes(),second:t.getSeconds()};
}
function plaatsVandaag(){
  const p=plaatsTijdDelen();
  return p.year+"-"+String(p.month).padStart(2,"0")+"-"+String(p.day).padStart(2,"0");
}`,
    "IANA lokale kalenderdag");

  exact(
`function plaatsNu(){
  const eigen=-new Date().getTimezoneOffset()*60;
  const daar=(S.d&&S.d.utc_offset_seconds!=null)?S.d.utc_offset_seconds:eigen;
  // S.klokOverride is alleen voor de testsuite, zodat "nu" op een vaste datum kan
  // worden gezet; in de app zelf staat dit altijd op null en telt de echte klok.
  // duck-typing in plaats van instanceof: de testsuite draait de app in een eigen
  // vm-realm met zijn eigen Date-klasse, dus een Date die van buiten wordt
  // meegegeven faalt altijd op instanceof Date binnen die sandbox
  const basis=(S.klokOverride&&typeof S.klokOverride.getTime==="function")?S.klokOverride.getTime():Date.now();
  return new Date(basis+(daar-eigen)*1000);
}`,
`function plaatsNu(){
  const p=plaatsTijdDelen();
  return new Date(p.year,p.month-1,p.day,p.hour,p.minute,p.second,0);
}`,
    "IANA lokale klok");

  exact(
`function plaatsKlok(){
  const t=plaatsNu();
  return String(t.getHours()).padStart(2,"0")+":"+String(t.getMinutes()).padStart(2,"0");
}`,
`function plaatsKlok(){
  const p=plaatsTijdDelen();
  return String(p.hour).padStart(2,"0")+":"+String(p.minute).padStart(2,"0");
}`,
    "IANA plaatsklok");

  /* Lokale tijdstring <-> UTC voor zon/maan met de zone-offset die op dat
     specifieke moment geldt; geen vaste offset over een DST-overgang. */
  exact(
`function naarUTC(lokaal){
  const off=(S.d&&S.d.utc_offset_seconds!=null?S.d.utc_offset_seconds:0)*1000;
  return Date.parse(lokaal+":00Z")-off;
}
function naarLokaal(msUTC){
  const off=(S.d&&S.d.utc_offset_seconds!=null?S.d.utc_offset_seconds:0)*1000;
  return new Date(msUTC+off).toISOString().slice(11,16);
}`,
`function weatherNowZoneDelen(ms,tz){
  try{
    const delen=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms));
    const p={}; delen.forEach(x=>{if(x.type!=="literal")p[x.type]=Number(x.value);});
    return [p.year,p.month,p.day,p.hour,p.minute,p.second].every(Number.isFinite)?p:null;
  }catch(e){return null;}
}
function weatherNowZoneOffset(ms,tz){
  const p=weatherNowZoneDelen(ms,tz); if(!p)return null;
  return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-Math.floor(ms/1000)*1000;
}
function naarUTC(lokaal){
  const m=/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})/.exec(String(lokaal||""));
  if(!m)return NaN;
  const doel=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]);
  const tz=S.d&&S.d.timezone;
  if(tz&&typeof Intl!=="undefined"&&Intl.DateTimeFormat){
    let gok=doel;
    for(let i=0;i<4;i++){
      const off=weatherNowZoneOffset(gok,tz); if(off===null)break;
      const nieuw=doel-off; if(Math.abs(nieuw-gok)<1000){gok=nieuw;break;} gok=nieuw;
    }
    return gok;
  }
  const off=(S.d&&S.d.utc_offset_seconds!=null?S.d.utc_offset_seconds:0)*1000;
  return doel-off;
}
function naarLokaal(msUTC){
  const tz=S.d&&S.d.timezone;
  if(tz&&typeof Intl!=="undefined"&&Intl.DateTimeFormat){
    const p=weatherNowZoneDelen(msUTC,tz);
    if(p)return String(p.hour).padStart(2,"0")+":"+String(p.minute).padStart(2,"0");
  }
  const off=(S.d&&S.d.utc_offset_seconds!=null?S.d.utc_offset_seconds:0)*1000;
  return new Date(msUTC+off).toISOString().slice(11,16);
}`,
    "DST-veilige tijdconversie");

  /* Korte termijn en verlopen grafiekintervallen beginnen op de echte lokale
     minuut van de plaats. */
  exact('const analyse=duur=>analyseerNeerslagData(S.d,duur);',
    'const analyse=duur=>analyseerNeerslagData(S.d,duur,weatherNowActueleLokaleTijd());',"exacte korte-termijnstart");
  exact('<=globalThis.WeatherNowInterpretatie.lokaalNaarMinuten(S.d.current.time);',
    '<=globalThis.WeatherNowInterpretatie.lokaalNaarMinuten(weatherNowActueleLokaleTijd());',"grafiekinterval tegen echte nu");

  /* Kans en deterministische hoeveelheid zijn verschillende modeluitgangen.
     Nul mm bij een hoge kans wordt onzeker, niet 'enkele druppels'. */
  exact('if(a.status==="MOGELIJKE_NEERSLAG") return {hoofd:kans===null?"Mogelijk":kans+"%",detail:"hooguit enkele druppels",droog:false};',
    'if(a.status==="MOGELIJKE_NEERSLAG") return {hoofd:kans===null?"Mogelijk":kans+"%",detail:"hoeveelheid onzeker",droog:false};',"mogelijke-neerslagdetail");
  exact('if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID") return {hoofd:kans===null?"Grote kans":kans+"%",detail:"hooguit enkele druppels",droog:false};',
    'if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID") return {hoofd:kans===null?"Grote kans":kans+"%",detail:"hoeveelheid onzeker",droog:false};',"grote-neerslagkansdetail");
  exact('return "Neerslag is mogelijk in "+venster+kansTussen+", maar waarschijnlijk gaat het om hooguit enkele druppels.";',
    'return "Neerslag is mogelijk in "+venster+kansTussen+", maar de verwachte hoeveelheid is onzeker.";',"mogelijke-neerslagzin");
  exact('return "De kans op neerslag in "+venster+" is groot"+kansTussen+", maar waarschijnlijk gaat het om hooguit enkele druppels.";',
    'return "De kans op neerslag in "+venster+" is groot"+kansTussen+", terwijl het model tegelijk geen meetbare hoeveelheid berekent. De verwachting is daardoor onzeker.";',"grote-neerslagkanszin");
  exact('if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID") return basis+"; grote neerslagkans, geen meetbare hoeveelheid";',
    'if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID") return basis+"; grote neerslagkans, hoeveelheid onzeker";',"dagtekst onzeker neerslagsignaal");

  /* 15-minutendata kan geïnterpoleerd zijn. De grafiek behoudt de bronpunten,
     tekst communiceert een onset alleen afgerond als 'rond' een half uur. */
  exact('function neerslagZin(analyse){\n  const a=analyse||{};',
`function weatherNowVoorzichtigeTijd(tijd,bron){
  if(!tijd||bron!=="kwartierdata")return tijd;
  const m=/^(\\d{2}):(\\d{2})$/.exec(tijd); if(!m)return tijd;
  let totaal=(+m[1])*60+(+m[2]); totaal=Math.round(totaal/30)*30; totaal=((totaal%1440)+1440)%1440;
  return String(Math.floor(totaal/60)).padStart(2,"0")+":"+String(totaal%60).padStart(2,"0");
}
function neerslagZin(analyse){
  const a=analyse||{};`,"voorzichtige kwartiertijd");
  exact('const start=a.eersteTijd?", vanaf ongeveer "+a.eersteTijd:"";',
    'const tekstTijd=weatherNowVoorzichtigeTijd(a.eersteTijd,a.bronHoeveelheid); const start=tekstTijd?", rond "+tekstTijd:"";',"neerslagstart zonder schijnprecisie");
  exact('if(a.status==="NEERSLAG_VERWACHT") return basis+"; "+a.soort+(a.eersteTijd?" vanaf ongeveer "+a.eersteTijd:"");',
    'if(a.status==="NEERSLAG_VERWACHT") {const t=weatherNowVoorzichtigeTijd(a.eersteTijd,a.bronHoeveelheid);return basis+"; "+a.soort+(t?" rond "+t:"");}',"dagtekst zonder schijnprecisie");
  exact('grafiek.setAttribute("aria-label",neerslagZin(a)+" Kwartierwaarden zijn sommen over het voorafgaande kwartier.");',
    'grafiek.setAttribute("aria-label",neerslagZin(a)+" Kwartierwaarden zijn sommen over het voorafgaande kwartier en kunnen afhankelijk van de locatie uit uurdata zijn geïnterpoleerd.");',"kwartierdata toegankelijkheidscontext");

  /* Weekconditie: Open-Meteo daily.weather_code is leidend; uurmodus alleen fallback. */
  exact('  const codes=uur.items.filter(x=>x.weather_code!==null).map(x=>x.weather_code);\n  const code=modeCode(codes);',
    '  const codes=uur.items.filter(x=>x.weather_code!==null).map(x=>x.weather_code);\n  const dagCode=veldGetal("weather_code",daily.weather_code&&daily.weather_code[dagIndex]);\n  const code=dagCode!==null?dagCode:modeCode(codes);',"zwaarste dagconditie");

  exact('? "Geen neerslag gemeten in de afgelopen "+intervalMin+" minuten. "',
    '? "Volgens het model viel geen neerslag in de afgelopen "+intervalMin+" minuten. "',"modeltaal recente neerslag");

  /* KNMI: 117 km/u blijft Bft 11; Bft 12 is meer dan 117. */
  exact('const BFT=[1,6,12,20,29,39,50,62,75,89,103,117];',
    'const BFT=[1,6,12,20,29,39,50,62,75,89,103,117.000001];',"Beaufortgrens 11-12");

  /* Actueel zicht is een current-variabele; hourly alleen fallback. */
  exact('+"rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m"',
    '+"rain,showers,snowfall,visibility,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m"',"actueel zicht ophalen");
  exact('const zichtRuw=eindigGetal(h.visibility&&h.visibility[i]);',
    'const zichtRuw=eindigGetal(c.visibility!=null?c.visibility:(h.visibility&&h.visibility[i]));',"actueel zicht tonen");

  /* Exact drie uur terug door interpolatie van de omringende uurpunten. */
  exact(
`  const p3Ruw=eindigGetal(h.pressure_msl&&h.pressure_msl[i-3]);
  const p3=p3Ruw!==null&&p3Ruw>0?p3Ruw:null;
  const dp=(p3!==null&&luchtdruk!==null)?luchtdruk-p3:null;
  zetTekst("pressub", dp==null ? "Geen tendens beschikbaar."
    : Math.abs(dp)<0.15 ? "In drie uur nauwelijks veranderd."
    : "In drie uur "+nl(Math.abs(dp))+" hPa "+(dp>0?"gestegen":"gedaald")+".");`,
`  const p3Ruw=weatherNowUurWaardeOp("pressure_msl",weatherNowMinutenNu()-180);
  const p3=p3Ruw!==null&&p3Ruw>0?p3Ruw:null;
  const dp=(p3!==null&&luchtdruk!==null)?luchtdruk-p3:null;
  zetTekst("pressub", dp==null ? "Geen tendens beschikbaar."
    : Math.abs(dp)<0.15 ? "In de afgelopen drie uur nauwelijks veranderd."
    : "In de afgelopen drie uur "+nl(Math.abs(dp))+" hPa "+(dp>0?"gestegen":"gedaald")+".");`,"exacte drie-uurs druktrend");

  /* 24 echte uren = 25 momentpunten. Geselecteerde kalenderdag blijft 24. */
  exact('const eind=Math.min(i+24,h.time.length);','const eind=Math.min(i+25,h.time.length);',"werkelijk 24-uurs briefingvenster");
  exact('  const h=S.d.hourly,T=[],A=[],P=[],MM=[],L=[],W_=[],G=[],C=[],D=[],TI=[],ND=[],WD=[];\n  for(let k=0;k<n;k++){',
    '  const h=S.d.hourly,T=[],A=[],P=[],MM=[],L=[],W_=[],G=[],C=[],D=[],TI=[],ND=[],WD=[];\n  const punten=S.dag==null&&n===24?25:n;\n  for(let k=0;k<punten;k++){',"werkelijk 24-uurs grafiekvenster");

  /* Extrema uitsluitend uit geldige temperatuurpunten. */
  exact('const iMax=T.indexOf(Math.max.apply(null,T)), iMin=T.indexOf(Math.min.apply(null,T));',
    'const geldigeIdx=T.map((v,i)=>geldig(i)?i:null).filter(i=>i!==null); const iMax=geldigeIdx.reduce((a,b)=>T[b]>T[a]?b:a), iMin=geldigeIdx.reduce((a,b)=>T[b]<T[a]?b:a);',"null-veilige grafiekextrema");

  /* Windstoot = maximum over voorafgaand uurvak, niet een exact moment. */
  exact(
`  const pgRuw=piek("wind_gusts_10m"),pg=pgRuw&&pgRuw.v>=0?pgRuw:null;
  zetTekst("gustsub", !pg ? "Geen uurgegevens beschikbaar."
    : pg.t>nu ? dagAanduiding(pg.t,true)+" rond "+hhmm(pg.t)+" worden windstoten tot "+Math.round(pg.v)+" km/u verwacht."
    : dagAanduiding(pg.t,true)+" was de zwaarste windstoot "+Math.round(pg.v)+" km/u rond "+hhmm(pg.t)+".");`,
`  const pgRuw=piek("wind_gusts_10m"),pg=pgRuw&&pgRuw.v>=0?pgRuw:null;
  zetTekst("gustsub", !pg ? "Geen uurgegevens beschikbaar."
    : pg.t>nu ? dagAanduiding(pg.t,true)+" in het uur "+weatherNowUurvak(pg.t)+" worden windstoten tot "+Math.round(pg.v)+" km/u verwacht."
    : dagAanduiding(pg.t,true)+" viel de zwaarste windstoot in het uur "+weatherNowUurvak(pg.t)+" en bereikte die "+Math.round(pg.v)+" km/u.");`,"windstoot als uurvak");
  exact('let wmax=null,wi=null,gmax=null;','let wmax=null,wi=null,gmax=null,gi=null;',"windstoot piekindex");
  exact('if(g!==null&&(gmax===null||g>gmax)) gmax=g;','if(g!==null&&(gmax===null||g>gmax)){gmax=g;gi=k;}',"windstoot piekindex bewaren");
  exact('zin3+=gmax!==null&&gmax>=60?"; windstoten kunnen "+Math.round(gmax)+" km/u bereiken.":".";',
    'zin3+=gmax!==null&&gmax>=60&&gi!==null?"; "+dagAanduiding(h.time[gi],true)+" in het uur "+weatherNowUurvak(h.time[gi])+" kunnen windstoten tot "+Math.round(gmax)+" km/u voorkomen.":".";',"briefing windstootuurvak");

  /* Nachtzicht: alleen hele modeluren werkelijk tussen zonsondergang/opkomst,
     plus eerlijke naam voor de beperkte heuristiek. */
  exact('    const a2=idx[ss.slice(0,13)+":00"],b2=idx[sr2.slice(0,13)+":00"];\n    if(a2==null||b2==null||b2<=a2) continue;',
    '    const a2=h.time.findIndex(t=>t>=ss);\n    let b2=-1; for(let z=h.time.length-1;z>=0;z--){if(h.time[z]<=sr2){b2=z;break;}}\n    if(a2<0||b2<0||b2<=a2) continue;',"nachtvenster zonder voorsunset-uur");
  html=html.replaceAll("beste zicht van ","gunstigste modelvenster van ");
  html=html.replaceAll("Geen geschikt zichtvenster:","Geen gunstig modelvenster:");
  exact('<div class="nmeta">Bewolking</div><div class="nmeta wide">Waarneemvenster en maan</div></div>`;',
    '<div class="nmeta">Bewolking</div><div class="nmeta wide">Modelvenster (bewolking en maan)</div></div>`;',"nachtzicht eerlijke kop");
  exact('<div class="dname">Nacht</div><div class="score">Score 0-10</div><div class="sbar"></div>',
    '<div class="dname">Nacht</div><div class="score">Modelscore 0-10</div><div class="sbar"></div>',"nachtzicht modelscore");

  /* Zoekrace + volledige combobox-keyboardinteractie. */
  exact(
`const q=document.getElementById("q"),res=document.getElementById("res");
let timer=null;
q.addEventListener("input",()=>{
  clearTimeout(timer);const v=q.value.trim();
  if(v.length<2){res.classList.remove("on");q.setAttribute("aria-expanded","false");return;}
  timer=setTimeout(async()=>{
    try{
      const d=await j("https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(v)+"&count=6&language=nl&format=json");
      if(!d.results){res.innerHTML="<div>Niets gevonden</div>";res.classList.add("on");return;}
      res.innerHTML=d.results.map(r=>\`<div role="option" data-lat="\${r.latitude}" data-lon="\${r.longitude}" data-nm="\${esc(r.name)}">\${esc(r.name)}<span style="color:\${INK45}"> · \${esc(r.admin1||"")} \${esc(r.country_code||"")}</span></div>\`).join("");
      res.classList.add("on");
    }catch(e){res.innerHTML="<div>Zoeken mislukt</div>";res.classList.add("on");}
  },320);
});
res.addEventListener("click",e=>{
  const el=e.target.closest("div[data-lat]");if(!el)return;
  res.classList.remove("on");q.value=el.dataset.nm;
  gpsGeneratie++;   // een handmatige keuze wint altijd van een nog lopende gps-aanvraag
  load(el.dataset.lat,el.dataset.lon,el.dataset.nm);
});
document.addEventListener("click",e=>{if(!e.target.closest(".tools"))res.classList.remove("on");});`,
`const q=document.getElementById("q"),res=document.getElementById("res");
let timer=null,zoekGeneratie=0,zoekIndex=-1;
const zoekOpties=()=>Array.from(res.querySelectorAll("div[data-lat]"));
function zoekMarkeer(n){
  const opties=zoekOpties();if(!opties.length){zoekIndex=-1;q.removeAttribute("aria-activedescendant");return;}
  zoekIndex=Math.max(0,Math.min(n,opties.length-1));
  opties.forEach((el,i)=>el.setAttribute("aria-selected",i===zoekIndex?"true":"false"));
  q.setAttribute("aria-activedescendant",opties[zoekIndex].id);
}
function zoekKies(el){
  if(!el)return;
  ++zoekGeneratie;clearTimeout(timer);res.classList.remove("on");q.setAttribute("aria-expanded","false");q.removeAttribute("aria-activedescendant");
  q.value=el.dataset.nm;zoekIndex=-1;gpsGeneratie++;load(el.dataset.lat,el.dataset.lon,el.dataset.nm);
}
q.addEventListener("input",()=>{
  clearTimeout(timer);const generatie=++zoekGeneratie,v=q.value.trim();zoekIndex=-1;q.removeAttribute("aria-activedescendant");
  if(v.length<2){res.classList.remove("on");q.setAttribute("aria-expanded","false");return;}
  timer=setTimeout(async()=>{
    try{
      const d=await j("https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(v)+"&count=6&language=nl&format=json");
      if(generatie!==zoekGeneratie)return;
      const resultaten=Array.isArray(d.results)?d.results:[];
      res.innerHTML=resultaten.length?resultaten.map((r,i)=>\`<div id="zoekopt-\${i}" role="option" aria-selected="false" data-lat="\${r.latitude}" data-lon="\${r.longitude}" data-nm="\${esc(r.name)}">\${esc(r.name)}<span style="color:\${INK45}"> · \${esc(r.admin1||"")} \${esc(r.country_code||"")}</span></div>\`).join(""):"<div>Niets gevonden</div>";
      res.classList.add("on");q.setAttribute("aria-expanded","true");
    }catch(e){if(generatie!==zoekGeneratie)return;res.innerHTML="<div>Zoeken mislukt</div>";res.classList.add("on");q.setAttribute("aria-expanded","true");}
  },320);
});
q.addEventListener("keydown",e=>{
  const opties=zoekOpties();
  if(e.key==="ArrowDown"&&opties.length){e.preventDefault();zoekMarkeer(zoekIndex<0?0:zoekIndex+1);}
  else if(e.key==="ArrowUp"&&opties.length){e.preventDefault();zoekMarkeer(zoekIndex<0?opties.length-1:zoekIndex-1);}
  else if(e.key==="Enter"&&zoekIndex>=0){e.preventDefault();zoekKies(opties[zoekIndex]);}
  else if(e.key==="Escape"){res.classList.remove("on");q.setAttribute("aria-expanded","false");q.removeAttribute("aria-activedescendant");zoekIndex=-1;}
});
res.addEventListener("click",e=>zoekKies(e.target.closest("div[data-lat]")));
document.addEventListener("click",e=>{if(!e.target.closest(".tools")){res.classList.remove("on");q.setAttribute("aria-expanded","false");}});`,"zoekrace en toetsenbord");

  /* Live dagwisseling. */
  exact(
`let klokMinuutTimer=null, klokUitlijnTimer=null;
function klokBijwerken(){
  const tijd=plaatsKlok();
  const pt=document.getElementById("plaatstijd"); if(pt) pt.textContent=tijd;
  const mt=document.getElementById("minitijd"); if(mt) mt.textContent=tijd;
}`,
`let klokMinuutTimer=null, klokUitlijnTimer=null, klokKalenderdag=null, klokPlaatsSleutel=null;
function klokBijwerken(){
  const tijd=plaatsKlok(),dag=plaatsVandaag();
  const pt=document.getElementById("plaatstijd"); if(pt) pt.textContent=tijd;
  const mt=document.getElementById("minitijd"); if(mt) mt.textContent=tijd;
  const plaatsSleutel=String(S.lat)+","+String(S.lon);
  if(klokPlaatsSleutel!==plaatsSleutel){klokPlaatsSleutel=plaatsSleutel;klokKalenderdag=dag;return;}
  if(klokKalenderdag===null){klokKalenderdag=dag;return;}
  if(dag!==klokKalenderdag){klokKalenderdag=dag;if(S.lat!=null&&S.d)load(S.lat,S.lon,S.label,true,false);}
}`,
    "live lokale dagwisseling");

  /* Ontbrekende UV is onbekend. */
  exact(
`  zetTekst("uvsub", (!pu||pu.v<0.5)
    ? "Nauwelijks UV vandaag."
    : pu.t>nu
      ? "De UV-index piekt vandaag rond "+hhmm(pu.t)+" en is dan "+uvOordeel(pu.v)+"."
      : "De UV-index piekte vandaag rond "+hhmm(pu.t)+" en was toen "+uvOordeel(pu.v)+".");`,
`  zetTekst("uvsub", !pu
    ? "UV-gegevens voor vandaag niet beschikbaar."
    : pu.v<0.5
      ? "Nauwelijks UV vandaag."
      : pu.t>nu
        ? "De UV-index piekt vandaag rond "+hhmm(pu.t)+" en is dan "+uvOordeel(pu.v)+"."
        : "De UV-index piekte vandaag rond "+hhmm(pu.t)+" en was toen "+uvOordeel(pu.v)+".");`,
    "ontbrekende UV-data");

  return html;
}
module.exports={pasToe};

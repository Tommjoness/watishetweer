"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const ROOT=path.join(__dirname,"..");
const htmlPad=path.join(ROOT,"public","index.html");
let html=fs.readFileSync(htmlPad,"utf8");

const MARK="/* ===== PERFORMANCE FINAL 20260811 ===== */";
if(html.includes(MARK))throw new Error("Performance-final is al toegepast.");

function vervangExact(oud,nieuw,naam){
  const aantal=html.split(oud).length-1;
  if(aantal!==1)throw new Error(naam+" ontbreekt of is dubbel: "+aantal);
  html=html.replace(oud,nieuw);
}

/* De app toont zeven kalenderdagen en een gekozen daggrafiek gebruikt ook de
   rechtergrens 00:00 van de volgende dag. 168 waarden kunnen daardoor exact op
   de laatste grens tekortkomen; een najaars-DST-omslag kan bovendien één extra
   verstreken uur toevoegen. 170 toekomstige uren houdt beide randgevallen veilig
   afgedekt, terwijl de vroegere onbegrensde ~384 toekomsturen ruim gehalveerd
   blijven. Daily=7 en de 15-minutenreeks blijven ongewijzigd. */
const forecastOud='&forecast_days=7&timezone=auto&wind_speed_unit=kmh";';
const forecastNieuw='&forecast_days=7&forecast_hours=170&timezone=auto&wind_speed_unit=kmh";';
const forecastAantal=html.split(forecastOud).length-1;
if(forecastAantal!==1)throw new Error("Forecast-horizonanker ontbreekt of is dubbel: "+forecastAantal);
html=html.replace(forecastOud,forecastNieuw);

/* De centrale interpretatie converteert dezelfde instants herhaaldelijk voor
   briefing, tegels, grafiek en dagregels. Naast de al begrensde formattercache
   bewaren we daarom ook succesvolle formatToParts-resultaten per exact instant
   + IANA-zone. De resultaatcache is FIFO-begrensd en bewaart alleen primitieve
   componenten; iedere hit krijgt een nieuw object zodat callers nooit gedeelde
   mutable state zien. DST en niet-hele offsets blijven daardoor volledig door
   Intl bepaald voor precies dezelfde instant en zone. */
const beginMark="/* ===== CENTRALE INTERPRETATIE-ENGINE ===== */";
const eindMark="/* ===== EINDE CENTRALE INTERPRETATIE-ENGINE ===== */";
const begin=html.indexOf(beginMark),eind=html.indexOf(eindMark,begin+beginMark.length);
if(begin<0||eind<=begin)throw new Error("Centrale interpretatie-engine niet eenduidig gevonden.");
let engine=html.slice(begin,eind);
const zoneStart=engine.indexOf("function zoneDelen(ms,tijdzone){");
const zoneEind=engine.indexOf("\nfunction zoneOffset(ms,tijdzone){",zoneStart);
if(zoneStart<0||zoneEind<=zoneStart)throw new Error("zoneDelen kon niet veilig worden afgebakend.");
const zoneNieuw=`const zoneFormatterCache=new Map();
const zoneDelenCache=new Map();
function zoneFormatter(tijdzone){
  let formatter=zoneFormatterCache.get(tijdzone);
  if(!formatter){
    formatter=new Intl.DateTimeFormat("en-CA",{
      timeZone:tijdzone,year:"numeric",month:"2-digit",day:"2-digit",
      hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"
    });
    zoneFormatterCache.set(tijdzone,formatter);
    if(zoneFormatterCache.size>24)zoneFormatterCache.delete(zoneFormatterCache.keys().next().value);
  }
  return formatter;
}
function zoneDelenObject(waarden){
  return {year:waarden[0],month:waarden[1],day:waarden[2],hour:waarden[3],minute:waarden[4],second:waarden[5]};
}
function zoneDelen(ms,tijdzone){
  if(!tijdzone||typeof Intl==="undefined"||!Intl.DateTimeFormat) return null;
  try{
    const instant=new Date(ms),epoch=instant.getTime();
    if(!Number.isFinite(epoch))return null;
    const sleutel=String(tijdzone)+"|"+epoch;
    const bewaard=zoneDelenCache.get(sleutel);
    if(bewaard)return zoneDelenObject(bewaard);
    const delen=zoneFormatter(tijdzone).formatToParts(instant);
    const p={};
    delen.forEach(x=>{if(x.type!=="literal")p[x.type]=Number(x.value);});
    const waarden=[p.year,p.month,p.day,p.hour,p.minute,p.second];
    if(!waarden.every(Number.isFinite))return null;
    zoneDelenCache.set(sleutel,waarden);
    if(zoneDelenCache.size>2048)zoneDelenCache.delete(zoneDelenCache.keys().next().value);
    return p;
  }catch(e){return null;}
}`;
engine=engine.slice(0,zoneStart)+zoneNieuw+engine.slice(zoneEind);

/* De Q1-laag heeft een eigen DST-veilige uurreconstructie. Die hoeft niet ook
   een tweede Intl-conversie-engine te bezitten: maak alleen de bestaande pure
   centrale zoneDelen-helper beschikbaar. Q1 behoudt zijn eigen algoritme en
   fallback, maar kan in de browser exact dezelfde begrensde instant+zonecache
   gebruiken. */
const apiOud='  neerslagZin,\n  statusRang\n};';
const apiNieuw='  neerslagZin,\n  statusRang,\n  zoneDelen\n};';
const apiAantal=engine.split(apiOud).length-1;
if(apiAantal!==1)throw new Error("Publieke interpretatie-API-anchor ontbreekt of is dubbel: "+apiAantal);
engine=engine.replace(apiOud,apiNieuw);
html=html.slice(0,begin)+engine+html.slice(eind);

const q1Mark="/* ===== CHECKPOINT 25 Q1 ===== */";
const q1Begin=html.indexOf(q1Mark);
const q1ZoneStart=html.indexOf("function zoneDelen(ms,tijdzone){",q1Begin);
const q1ZoneEind=html.indexOf("\nfunction zoneOffset(ms,tijdzone){",q1ZoneStart);
if(q1Begin<0||q1ZoneStart<0||q1ZoneEind<=q1ZoneStart)throw new Error("Q1 zoneDelen kon niet veilig worden afgebakend.");
let q1Zone=html.slice(q1ZoneStart,q1ZoneEind);
const q1Open=q1Zone.indexOf("{")+1;
if(q1Open<=0||!q1Zone.includes('new Intl.DateTimeFormat("en-CA"'))throw new Error("Q1 zoneDelen heeft een onverwachte vorm.");
const q1Delegatie='\n  const centraal=root.WeatherNowInterpretatie;\n  if(centraal&&typeof centraal.zoneDelen==="function")return centraal.zoneDelen(ms,tijdzone);';
if(q1Zone.includes("WeatherNowInterpretatie"))throw new Error("Q1 zoneDelen delegeert al vóór performance-final.");
q1Zone=q1Zone.slice(0,q1Open)+q1Delegatie+q1Zone.slice(q1Open);
html=html.slice(0,q1ZoneStart)+q1Zone+html.slice(q1ZoneEind);

/* Pure civiele tijdconversies worden per exacte lokale kloktekst en tijdzone
   gememoized. Belangrijk: begrens uitsluitend het eigen functieblok. De eerdere
   implementatie gebruikte `function minutenNaarLokaal` als eindanker en slikte
   daardoor nieuwe top-level helpers tussen beide functies stil als nested code
   in. Een kolom-0 sluitaccolade is onderdeel van het broncontract van deze pure
   helper en laat opvolgende helpers volledig ongemoeid. */
const lokaalStart=html.indexOf("function lokaalNaarMinuten(tijd,tijdzone,utcOffsetSeconden){",begin);
const lokaalSluit=html.indexOf("\n}\n",lokaalStart);
const lokaalEind=lokaalSluit<0?-1:lokaalSluit+2;
if(lokaalStart<0||lokaalEind<=lokaalStart||lokaalEind>=eind)throw new Error("lokaalNaarMinuten kon niet veilig als eigen functieblok worden afgebakend.");
const lokaalOud=html.slice(lokaalStart,lokaalEind);
const bodyBegin=lokaalOud.indexOf("{")+1;
const lokaalBody=lokaalOud.slice(bodyBegin);
const returnPatroon=/\n}\s*$/;
if(!returnPatroon.test(lokaalBody))throw new Error("Einde lokaalNaarMinuten onverwacht.");
const origineleBody=lokaalBody.replace(returnPatroon,"\n");
const lokaalNieuw=`const lokaleMinutenCache=new Map();
function lokaalNaarMinuten(tijd,tijdzone,utcOffsetSeconden){
  const cacheSleutel=String(tijdzone||"")+"|"+String(utcOffsetSeconden??"")+"|"+String(tijd||"");
  if(lokaleMinutenCache.has(cacheSleutel))return lokaleMinutenCache.get(cacheSleutel);
  const bereken=()=>{${origineleBody}
  };
  const uit=bereken();
  lokaleMinutenCache.set(cacheSleutel,uit);
  if(lokaleMinutenCache.size>4096)lokaleMinutenCache.delete(lokaleMinutenCache.keys().next().value);
  return uit;
}`;
html=html.slice(0,lokaalStart)+lokaalNieuw+html.slice(lokaalEind);

/* De UI-runtime heeft daarnaast eigen helpers voor lokale klokteksten. Bij een
   geldige IANA-zone blijft die zone leidend. Als een provider ooit een onbekende
   of malforme zone-id levert, geeft weatherNowZoneOffset null terug. Voorheen
   werd de lokale klok dan stil als UTC behandeld. Dat wijkt ook af van
   naarLokaal(), dat in hetzelfde geval al naar utc_offset_seconds terugvalt.
   Maak beide richtingen daarom fail-safe en symmetrisch: alleen een volledig
   geldige zoneconversie mag de IANA-uitkomst retourneren; anders gebruiken we
   de numerieke provider-offset. */
const naarUtcStart=html.indexOf("function naarUTC(lokaal){");
const naarUtcEind=html.indexOf("\nfunction naarLokaal(msUTC){",naarUtcStart);
if(naarUtcStart<0||naarUtcEind<=naarUtcStart)throw new Error("naarUTC kon niet veilig worden afgebakend.");
const naarUtcNieuw=`function naarUTC(lokaal){
  const m=/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})/.exec(String(lokaal||""));
  if(!m)return NaN;
  const doel=Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]);
  const tz=S.d&&S.d.timezone;
  if(tz&&typeof Intl!=="undefined"&&Intl.DateTimeFormat){
    let gok=doel,zoneGeldig=true;
    for(let i=0;i<4;i++){
      const off=weatherNowZoneOffset(gok,tz);
      if(off===null){zoneGeldig=false;break;}
      const nieuw=doel-off;
      if(Math.abs(nieuw-gok)<1000){gok=nieuw;break;}
      gok=nieuw;
    }
    if(zoneGeldig)return gok;
  }
  const off=(S.d&&S.d.utc_offset_seconds!=null?S.d.utc_offset_seconds:0)*1000;
  return doel-off;
}`;
html=html.slice(0,naarUtcStart)+naarUtcNieuw+html.slice(naarUtcEind);

/* De meelopende contextbalk gebruikt IntersectionObserver als primaire bron van
   waarheid. Daardoor is er geen synchrone geometry-read meer tijdens de gewone
   opstart. Scrollen legt de laatste betekenisvolle leesrichting los van de
   zichtbaarheid vast, zodat een later binnenkomende observer- of fallbackstate
   meteen dezelfde mobiele hide/show-keuze kan toepassen. Een vertraagde
   fallback meet de hero uitsluitend als een browser na een echte scroll geen
   nieuwe observer-entry levert. */
const minibalkOud=`  let timer=null,richtingY=Math.max(0,window.scrollY||0);
  const mobiel=()=>window.matchMedia&&window.matchMedia("(max-width:900px)").matches;
  const pasRichtingToe=()=>{
    if(!mobiel()){
      bar.classList.remove("senior-verstopt");
      richtingY=Math.max(0,window.scrollY||0);
      return;
    }
    const y=Math.max(0,window.scrollY||0),verschil=y-richtingY;
    if(Math.abs(verschil)<10) return;
    if(bar.classList.contains("aan"))bar.classList.toggle("senior-verstopt",verschil>0);
    else bar.classList.remove("senior-verstopt");
    richtingY=y;
  };
  const zet=()=>{
    timer=null;
    const r=hero.getBoundingClientRect();
    const aan=Number.isFinite(r.bottom)&&r.bottom<=0;
    bar.classList.toggle("aan",aan);
    if(!aan)bar.classList.remove("senior-verstopt");
    pasRichtingToe();
  };
  const plan=()=>{
    if(timer!==null) return;
    timer=setTimeout(zet,16);
  };
  if("IntersectionObserver" in window)new IntersectionObserver(plan,{threshold:0}).observe(hero);
  window.addEventListener("scroll",plan,{passive:true});
  window.addEventListener("resize",plan,{passive:true});
  plan();`;
const minibalkNieuw=`  let frame=null,fallbackTimer=null,observerVersie=0,richtingY=Math.max(0,window.scrollY||0),gewensteVerstopt=false;
  const mobiel=()=>window.matchMedia&&window.matchMedia("(max-width:900px)").matches;
  const pasVerstoptToe=()=>{
    bar.classList.toggle("senior-verstopt",bar.classList.contains("aan")&&mobiel()&&gewensteVerstopt);
  };
  const zetAan=aan=>{
    bar.classList.toggle("aan",!!aan);
    pasVerstoptToe();
  };
  const registreerRichting=()=>{
    if(!mobiel()){
      gewensteVerstopt=false;
      richtingY=Math.max(0,window.scrollY||0);
    }else{
      const y=Math.max(0,window.scrollY||0),verschil=y-richtingY;
      if(Math.abs(verschil)>=10){
        gewensteVerstopt=verschil>0;
        richtingY=y;
      }
    }
    if(frame!==null)return;
    const run=()=>{frame=null;pasVerstoptToe();};
    frame=typeof window.requestAnimationFrame==="function"?window.requestAnimationFrame(run):setTimeout(run,16);
  };
  const meetFallback=versie=>{
    fallbackTimer=null;
    if(observerVersie!==versie)return;
    const r=hero.getBoundingClientRect();
    zetAan(Number.isFinite(r.bottom)&&r.bottom<=0);
  };
  const planFallback=()=>{
    if(fallbackTimer!==null)clearTimeout(fallbackTimer);
    const versie=observerVersie;
    fallbackTimer=setTimeout(()=>meetFallback(versie),120);
  };
  if("IntersectionObserver" in window)new IntersectionObserver(([entry])=>{
    observerVersie++;
    if(fallbackTimer!==null){clearTimeout(fallbackTimer);fallbackTimer=null;}
    zetAan(!!entry&&!entry.isIntersecting&&entry.boundingClientRect.top<0);
  },{threshold:0}).observe(hero);
  window.addEventListener("scroll",()=>{registreerRichting();planFallback();},{passive:true});
  window.addEventListener("resize",()=>{
    if(fallbackTimer!==null){clearTimeout(fallbackTimer);fallbackTimer=null;}
    gewensteVerstopt=false;
    zetAan(false);
    richtingY=Math.max(0,window.scrollY||0);
  },{passive:true});`;
vervangExact(minibalkOud,minibalkNieuw,"Minibalk zonder synchrone opstart-layout-read");

/* De rode actuele temperatuur hoeft zijn SVG-tekstbreedte niet door de browser
   te laten uitmeten. Voor de enige beslissing hier, links of rechts van de stip,
   is een conservatieve breedte op basis van de korte labeltekst voldoende. De
   begrensde schatting voorkomt getComputedTextLength en houdt extra marge voor
   mintekens en twee-cijferige temperaturen. */
const nuBreedteOud=`  let breed=54;
  try{const b=tekst.getComputedTextLength();if(Number.isFinite(b)&&b>0)breed=b;}catch(e){}`;
const nuBreedteNieuw=`  const labelTekst=String(tekst.textContent||"").trim();
  const breed=Math.max(54,Math.min(88,labelTekst.length*(S.geo.M?8:9)+10));`;
vervangExact(nuBreedteOud,nuBreedteNieuw,"Nu-label zonder synchrone SVG-tekstmeting");

html=html.replace("</style>","\n"+MARK+"\n</style>");
const scripts=[...html.matchAll(/<script(?![^>]* src=)[^>]*>([^]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime na performance-final.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:performance-"+(i+1)}));
fs.writeFileSync(htmlPad,html,"utf8");
console.log("Performance-final toegepast: 170 forecasturen, gedeelde tijdzonecache, veilige tijdzonefallback, observergedreven minibalk met robuuste scrollrichting en nu-label zonder synchrone SVG-tekstmeting.");
"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const ROOT=path.join(__dirname,"..");
const htmlPad=path.join(ROOT,"public","index.html");
let html=fs.readFileSync(htmlPad,"utf8");

const MARK="/* ===== PERFORMANCE FINAL 20260811 ===== */";
if(html.includes(MARK))throw new Error("Performance-final is al toegepast.");

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

/* De centrale interpretatie converteert dezelfde lokale uurstrings voor tegel,
   briefing, nowcast en zeven dagregels. Intl.DateTimeFormat bouwen is veel duurder
   dan formatToParts op een bestaand formatterobject. De formatter is volledig
   bepaald door de IANA-zone, dus hergebruik verandert geen tijd-, DST- of
   kalendersemantiek. De kleine begrensde cache voorkomt onbeperkte groei wanneer
   veel locaties na elkaar worden bekeken. */
const beginMark="/* ===== CENTRALE INTERPRETATIE-ENGINE ===== */";
const eindMark="/* ===== EINDE CENTRALE INTERPRETATIE-ENGINE ===== */";
const begin=html.indexOf(beginMark),eind=html.indexOf(eindMark,begin+beginMark.length);
if(begin<0||eind<=begin)throw new Error("Centrale interpretatie-engine niet eenduidig gevonden.");
let engine=html.slice(begin,eind);
const zoneStart=engine.indexOf("function zoneDelen(ms,tijdzone){");
const zoneEind=engine.indexOf("\nfunction zoneOffset(ms,tijdzone){",zoneStart);
if(zoneStart<0||zoneEind<=zoneStart)throw new Error("zoneDelen kon niet veilig worden afgebakend.");
const zoneNieuw=`const zoneFormatterCache=new Map();
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
function zoneDelen(ms,tijdzone){
  if(!tijdzone||typeof Intl==="undefined"||!Intl.DateTimeFormat) return null;
  try{
    const delen=zoneFormatter(tijdzone).formatToParts(new Date(ms));
    const p={};
    delen.forEach(x=>{if(x.type!=="literal")p[x.type]=Number(x.value);});
    return [p.year,p.month,p.day,p.hour,p.minute,p.second].every(Number.isFinite)?p:null;
  }catch(e){return null;}
}`;
engine=engine.slice(0,zoneStart)+zoneNieuw+engine.slice(zoneEind);
html=html.slice(0,begin)+engine+html.slice(eind);

/* Pure tijdconversies worden daarnaast per exacte lokale kloktekst en tijdzone
   gememoized. Dit is dezelfde deterministische functie-uitkomst; dubbele lokale
   tijden blijven als dubbele bronstring door leesReeks() gedetecteerd en verlagen
   dus nog steeds de zekerheid. */
const lokaalStart=html.indexOf("function lokaalNaarMinuten(tijd,tijdzone,utcOffsetSeconden){",begin);
const lokaalEind=html.indexOf("\nfunction minutenNaarLokaal(minuten,tijdzone,utcOffsetSeconden){",lokaalStart);
if(lokaalStart<0||lokaalEind<=lokaalStart)throw new Error("lokaalNaarMinuten kon niet veilig worden afgebakend.");
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

html=html.replace("</style>","\n"+MARK+"\n</style>");
const scripts=[...html.matchAll(/<script(?![^>]* src=)[^>]*>([^]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime na performance-final.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:performance-"+(i+1)}));
fs.writeFileSync(htmlPad,html,"utf8");
console.log("Performance-final toegepast: 170 forecasturen, formatterhergebruik, lokale-tijdcache en veilige tijdzonefallback.");
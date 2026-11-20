"use strict";

/* Deterministische, contractgetrouwe Open-Meteo-antwoorden voor CI (P0, 20 november 2026).

   Open-Meteo vraagt om in CI geen live API-aanroepen te doen (ticket #235915).
   Browserchecks tegen preview en productie laden de echte site, maar krijgen
   voor Open-Meteo dit antwoord in plaats van het netwerk. De vorm volgt het
   contract van Open-Meteo zoals de app en de monitors het gebruiken:
   - het antwoord wordt opgebouwd uit de aanvraag zelf: alleen de gevraagde
     variabelen in current, minutely_15, hourly en daily, met de bijbehorende
     *_units; een onbekende variabele geeft HTTP 400 met {error:true,reason},
     zoals Open-Meteo, zodat een gewijzigde aanvraag van de app opvalt;
   - tijden: lokaal, "YYYY-MM-DDTHH:MM", met één vaste utc_offset_seconds voor
     het hele antwoord (die van nu), ook over een klokwissel heen; current op het
     kwartier, hourly vanaf het huidige uur min past_hours met forecast_hours
     stappen (of tot het einde van forecast_days), daily vanaf vandaag min
     past_days, minutely_15 rond het huidige kwartier;
   - timezone=auto: de tijdzone komt van de aanroeper (tzVoor), anders GMT,
     zoals Open-Meteo op open zee en aan de polen;
   - meerdere coördinaten (latitude=a,b) geven een array, zoals Open-Meteo;
   - zon: zonsopkomst en -ondergang uit de zonnestand; bij poolnacht staan beide
     op 00:00 van die dag, bij 24 uur daglicht staat sunset op 00:00 van de
     volgende dag (vastgesteld gedrag, zie production-source-truth.js);
   - waarden: plausibel, onderling consistent (dagwaarden uit de uurwaarden,
     neerslag en weercode in samenhang, nacht zonder uv) en deterministisch per
     plaats en moment.
   Ook luchtkwaliteit (pollen alleen in Europa, elders null), geocoding (kleine
   vaste plaatsenlijst) en hoogte. Dit bestand doet zelf nooit een netwerkverzoek. */

const UUR=3600000,KWARTIER=900000,DAG=86400000;
const EENHEID={
  temperature_2m:"°C",apparent_temperature:"°C",dew_point_2m:"°C",relative_humidity_2m:"%",
  precipitation_probability:"%",precipitation:"mm",rain:"mm",showers:"mm",snowfall:"cm",snow_depth:"m",
  weather_code:"wmo code",cloud_cover:"%",cloud_cover_low:"%",cloud_cover_mid:"%",cloud_cover_high:"%",
  wind_speed_10m:"km/h",wind_direction_10m:"°",wind_gusts_10m:"km/h",visibility:"m",uv_index:"",
  pressure_msl:"hPa",surface_pressure:"hPa",is_day:"",sunshine_duration:"s",
  temperature_2m_max:"°C",temperature_2m_min:"°C",apparent_temperature_max:"°C",apparent_temperature_min:"°C",
  sunrise:"iso8601",sunset:"iso8601",daylight_duration:"s",precipitation_probability_max:"%",precipitation_sum:"mm",
  rain_sum:"mm",showers_sum:"mm",snowfall_sum:"cm",precipitation_hours:"h",uv_index_max:"",wind_speed_10m_max:"km/h",
  wind_gusts_10m_max:"km/h",wind_direction_10m_dominant:"°"
};
const UURVARS=new Set(["temperature_2m","apparent_temperature","dew_point_2m","relative_humidity_2m","precipitation_probability","precipitation","rain","showers","snowfall","snow_depth","weather_code","cloud_cover","cloud_cover_low","cloud_cover_mid","cloud_cover_high","wind_speed_10m","wind_direction_10m","wind_gusts_10m","visibility","uv_index","pressure_msl","surface_pressure","is_day","sunshine_duration"]);
const DAGVARS=new Set(["weather_code","temperature_2m_max","temperature_2m_min","apparent_temperature_max","apparent_temperature_min","sunrise","sunset","daylight_duration","sunshine_duration","precipitation_probability_max","precipitation_sum","rain_sum","showers_sum","snowfall_sum","precipitation_hours","uv_index_max","wind_speed_10m_max","wind_gusts_10m_max","wind_direction_10m_dominant"]);
const KWARTIERVARS=new Set(["precipitation","rain","showers","snowfall","weather_code","temperature_2m","is_day","visibility","wind_speed_10m","wind_gusts_10m","wind_direction_10m"]);
const POLLEN=["alder_pollen","birch_pollen","grass_pollen","mugwort_pollen","ragweed_pollen","olive_pollen"];

const r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100;
const klem=(v,a,b)=>Math.min(b,Math.max(a,v));

/* ---------- tijd ---------- */
function offsetSeconden(ms,tz){
  if(!tz||tz==="GMT"||tz==="UTC")return 0;
  const d=new Intl.DateTimeFormat("en-US",{timeZone:tz,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(new Date(ms));
  const g=t=>Number(d.find(p=>p.type===t).value);
  return Math.round((Date.UTC(g("year"),g("month")-1,g("day"),g("hour"),g("minute"),g("second"))-Math.floor(ms/1000)*1000)/1000);
}
function afkorting(ms,tz){
  if(!tz||tz==="GMT")return "GMT";
  try{return new Intl.DateTimeFormat("en-US",{timeZone:tz,timeZoneName:"short"}).formatToParts(new Date(ms)).find(p=>p.type==="timeZoneName").value;}catch(e){return "GMT";}
}
/* Lokale "wandklok" met vaste offset: instant + offset, weergegeven als UTC. */
const iso=(lokaalMs)=>new Date(lokaalMs).toISOString().slice(0,16);
const isoDag=(lokaalMs)=>new Date(lokaalMs).toISOString().slice(0,10);

/* ---------- zon (NOAA, voldoende nauwkeurig voor een fixture) ---------- */
function zonHoogte(ms,lat,lon){
  const jd=ms/DAG+2440587.5,n=jd-2451545.0;
  const L=(280.46+0.9856474*n)%360,g=(357.528+0.9856003*n)*Math.PI/180;
  const lambda=(L+1.915*Math.sin(g)+0.02*Math.sin(2*g))*Math.PI/180;
  const eps=(23.439-0.0000004*n)*Math.PI/180;
  const dec=Math.asin(Math.sin(eps)*Math.sin(lambda));
  const ra=Math.atan2(Math.cos(eps)*Math.sin(lambda),Math.cos(lambda));
  const gmst=(18.697374558+24.06570982441908*n)%24;
  const ha=((gmst*15+lon)*Math.PI/180)-ra;
  const phi=lat*Math.PI/180;
  return Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(ha))*180/Math.PI;
}
const OPKOMST=-0.833;
/* Zonsopkomst/-ondergang binnen een lokale dag (vaste offset), per minuut gezocht. */
function zonDag(dagStartUtcMs,lat,lon,offsetMs){
  let op=null,onder=null,vorige=zonHoogte(dagStartUtcMs,lat,lon),boven=vorige>OPKOMST?1:0,daglicht=0;
  for(let m=1;m<=1440;m++){
    const t=dagStartUtcMs+m*60000,h=zonHoogte(t,lat,lon);
    if(vorige<=OPKOMST&&h>OPKOMST&&op===null)op=t;
    if(vorige>OPKOMST&&h<=OPKOMST&&onder===null)onder=t;
    if(h>OPKOMST)daglicht+=60;
    vorige=h;
  }
  const lokaal=t=>iso(t+offsetMs),middernacht=iso(dagStartUtcMs+offsetMs);
  if(op===null&&onder===null){
    if(boven)return {sunrise:middernacht,sunset:iso(dagStartUtcMs+DAG+offsetMs),daylight:86400};
    return {sunrise:middernacht,sunset:middernacht,daylight:0};
  }
  return {sunrise:op===null?middernacht:lokaal(op),sunset:onder===null?iso(dagStartUtcMs+DAG+offsetMs):lokaal(onder),daylight:daglicht};
}

/* ---------- weer per uur (deterministisch) ---------- */
function zaad(lat,lon){let h=2166136261;for(const c of `${lat.toFixed(3)},${lon.toFixed(3)}`){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967295;}
function weerOp(ms,lat,lon,lokaalUur){
  const s=zaad(lat,lon),u=ms/UUR,elev=zonHoogte(ms,lat,lon),dag=elev>OPKOMST;
  const basis=27-0.45*Math.abs(lat);
  const temperature_2m=r1(basis+4*Math.sin(2*Math.PI*(lokaalUur-9)/24)+1.5*Math.sin(u/37+s*6));
  const cloud_cover=Math.round(klem(55+42*Math.sin(u/7+s*11),0,100));
  const precipitation_probability=Math.round(klem(cloud_cover>65?(cloud_cover-55)*2:5+cloud_cover/10,0,100));
  const precipitation=precipitation_probability>=60?r1((precipitation_probability-50)/25):0;
  const sneeuw=temperature_2m<=0.5;
  const rain=sneeuw?0:precipitation,snowfall=sneeuw?r2(precipitation*0.7):0;
  const weather_code=snowfall>0?(snowfall>1?73:71):precipitation>0?(precipitation<0.5?61:precipitation<2?63:65):cloud_cover<20?0:cloud_cover<50?1:cloud_cover<80?2:3;
  const dew_point_2m=r1(temperature_2m-3-2.5*(1+Math.sin(u/11+s)));
  const ea=6.112*Math.exp(17.62*dew_point_2m/(243.12+dew_point_2m)),es=6.112*Math.exp(17.62*temperature_2m/(243.12+temperature_2m));
  const relative_humidity_2m=Math.round(klem(100*ea/es,5,100));
  const wind_speed_10m=r1(9+6*Math.sin(u/9+s*3));
  const wind_gusts_10m=r1(wind_speed_10m*1.7+3);
  const wind_direction_10m=Math.round(((200+70*Math.sin(u/13+s*5))%360+360)%360);
  const apparent_temperature=r1(temperature_2m-wind_speed_10m/12+(relative_humidity_2m>70&&temperature_2m>20?1:0));
  const uv_index=dag?r2(Math.max(0,9*Math.sin(elev*Math.PI/180))*(1-cloud_cover/200)):0;
  return {temperature_2m,apparent_temperature,dew_point_2m,relative_humidity_2m,precipitation_probability,precipitation,rain,showers:0,
    snowfall,snow_depth:sneeuw?r2(0.05+snowfall/100):0,weather_code,cloud_cover,cloud_cover_low:Math.round(cloud_cover*0.6),cloud_cover_mid:Math.round(cloud_cover*0.3),
    cloud_cover_high:Math.round(cloud_cover*0.2),wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility:precipitation>0?8000:24140,uv_index,
    pressure_msl:r1(1013+6*Math.sin(u/29+s*2)),surface_pressure:r1(1008+6*Math.sin(u/29+s*2)),is_day:dag?1:0,
    sunshine_duration:dag&&cloud_cover<70?Math.round(3600*(1-cloud_cover/100)):0};
}
const ERNST=c=>[0,1,2,3,45,48,51,53,55,61,63,65,71,73,75,80,81,82,95].indexOf(c);
function windOmrekenen(v,eenheid){return eenheid==="ms"?r1(v/3.6):eenheid==="mph"?r1(v/1.609):eenheid==="kn"?r1(v/1.852):v;}

function lijst(p,naam){const w=p.get(naam);return w?w.split(",").map(x=>x.trim()).filter(Boolean):[];}
function geheel(p,naam,standaard){const w=p.get(naam);if(w==null||w==="")return standaard;const n=Number(w);return Number.isInteger(n)&&n>=0?n:NaN;}
class Ongeldig extends Error{}

function eenForecast(lat,lon,p,nuMs,tz){
  const offset=offsetSeconden(nuMs,tz),offMs=offset*1000;
  const windEenheid=p.get("wind_speed_unit")||"kmh";
  const lokaalNu=nuMs+offMs;
  const uurNu=Math.floor(lokaalNu/UUR)*UUR-offMs,kwartierNu=Math.floor(lokaalNu/KWARTIER)*KWARTIER-offMs;
  const middernachtVandaag=Math.floor(lokaalNu/DAG)*DAG-offMs;
  const forecastDays=geheel(p,"forecast_days",7),pastDays=geheel(p,"past_days",0);
  const pastHours=geheel(p,"past_hours",null),forecastHours=geheel(p,"forecast_hours",null);
  for(const [n,v,max] of [["forecast_days",forecastDays,16],["past_days",pastDays,92],["past_hours",pastHours,2208],["forecast_hours",forecastHours,384]])
    if(v!==null&&(Number.isNaN(v)||v>max))throw new Ongeldig(`Parameter '${n}' is out of allowed range`);
  const eenheden=(vars)=>{const u={time:"iso8601"};for(const v of vars)u[v]=EENHEID[v]||(POLLEN.includes(v)?"grains/m³":"");if(windEenheid!=="kmh")for(const v of vars)if(/^wind_(speed|gusts)/.test(v))u[v]=windEenheid==="ms"?"m/s":windEenheid==="mph"?"mp/h":"kn";return u;};
  const waarde=(w,v)=>/^wind_(speed|gusts)_10m$/.test(v)?windOmrekenen(w[v],windEenheid):w[v];
  const uit={latitude:r2(lat),longitude:r2(lon),generationtime_ms:0.123,utc_offset_seconds:offset,timezone:tz||"GMT",timezone_abbreviation:afkorting(nuMs,tz),elevation:Math.round(Math.max(0,20*(1+Math.sin(lat+lon))))};
  const weer=ms=>weerOp(ms,lat,lon,new Date(ms+offMs).getUTCHours()+new Date(ms+offMs).getUTCMinutes()/60);

  const current=lijst(p,"current");
  if(current.length){
    for(const v of current)if(!UURVARS.has(v))throw new Ongeldig(`Cannot initialize SurfacePressureAndHeightVariable<VariableAndPreviousDay, ForecastPressureVariable, ForecastHeightVariable> from invalid String value ${v}.`);
    uit.current_units={...eenheden(current),interval:"seconds"};delete uit.current_units.time;uit.current_units={time:"iso8601",interval:"seconds",...uit.current_units};
    const w=weer(kwartierNu);uit.current={time:iso(kwartierNu+offMs),interval:900};for(const v of current)uit.current[v]=waarde(w,v);
  }
  const kwartier=lijst(p,"minutely_15");
  if(kwartier.length){
    for(const v of kwartier)if(!KWARTIERVARS.has(v))throw new Ongeldig(`Cannot initialize Minutely15Variable from invalid String value ${v}.`);
    const terug=geheel(p,"past_minutely_15",0),vooruit=geheel(p,"forecast_minutely_15",96);
    const start=kwartierNu-terug*KWARTIER,n=terug+vooruit;
    uit.minutely_15_units=eenheden(kwartier);uit.minutely_15={time:[]};for(const v of kwartier)uit.minutely_15[v]=[];
    for(let i=0;i<n;i++){const t=start+i*KWARTIER,w=weer(t);uit.minutely_15.time.push(iso(t+offMs));for(const v of kwartier)uit.minutely_15[v].push(v==="precipitation"||v==="rain"||v==="showers"||v==="snowfall"?r2(w[v]/4):waarde(w,v));}
  }
  const uurVars=lijst(p,"hourly");
  if(uurVars.length){
    for(const v of uurVars)if(!UURVARS.has(v))throw new Ongeldig(`Cannot initialize ForecastSurfaceVariable from invalid String value ${v}.`);
    let start,n;
    if(forecastHours!==null){start=uurNu-(pastHours||0)*UUR;n=(pastHours||0)+forecastHours;}
    else{start=pastHours!==null?uurNu-pastHours*UUR:middernachtVandaag-pastDays*DAG;n=Math.round((middernachtVandaag+forecastDays*DAG-start)/UUR);}
    uit.hourly_units=eenheden(uurVars);uit.hourly={time:[]};for(const v of uurVars)uit.hourly[v]=[];
    for(let i=0;i<n;i++){const t=start+i*UUR,w=weer(t);uit.hourly.time.push(iso(t+offMs));for(const v of uurVars)uit.hourly[v].push(waarde(w,v));}
  }
  const dagVars=lijst(p,"daily");
  if(dagVars.length){
    for(const v of dagVars)if(!DAGVARS.has(v))throw new Ongeldig(`Cannot initialize ForecastVariableDaily from invalid String value ${v}.`);
    uit.daily_units=eenheden(dagVars);uit.daily={time:[]};for(const v of dagVars)uit.daily[v]=[];
    for(let d=-pastDays;d<forecastDays;d++){
      const s=middernachtVandaag+d*DAG,uren=[];for(let h=0;h<24;h++)uren.push(weer(s+h*UUR));
      const zon=zonDag(s,lat,lon,offMs),som=k=>r1(uren.reduce((a,w)=>a+w[k],0)),max=k=>Math.max(...uren.map(w=>w[k])),min=k=>Math.min(...uren.map(w=>w[k]));
      const code=uren.map(w=>w.weather_code).reduce((a,c)=>ERNST(c)>ERNST(a)?c:a,0);
      const richting=Math.round(((Math.atan2(uren.reduce((a,w)=>a+Math.sin(w.wind_direction_10m*Math.PI/180),0),uren.reduce((a,w)=>a+Math.cos(w.wind_direction_10m*Math.PI/180),0))*180/Math.PI)+360)%360);
      const dag={weather_code:code,temperature_2m_max:max("temperature_2m"),temperature_2m_min:min("temperature_2m"),apparent_temperature_max:max("apparent_temperature"),apparent_temperature_min:min("apparent_temperature"),
        sunrise:zon.sunrise,sunset:zon.sunset,daylight_duration:zon.daylight,sunshine_duration:Math.min(zon.daylight,uren.reduce((a,w)=>a+w.sunshine_duration,0)),
        precipitation_probability_max:max("precipitation_probability"),precipitation_sum:som("precipitation"),rain_sum:som("rain"),showers_sum:0,snowfall_sum:r2(uren.reduce((a,w)=>a+w.snowfall,0)),
        precipitation_hours:uren.filter(w=>w.precipitation>0).length,uv_index_max:r2(max("uv_index")),wind_speed_10m_max:windOmrekenen(max("wind_speed_10m"),windEenheid),
        wind_gusts_10m_max:windOmrekenen(max("wind_gusts_10m"),windEenheid),wind_direction_10m_dominant:richting};
      uit.daily.time.push(isoDag(s+offMs));for(const v of dagVars)uit.daily[v].push(dag[v]);
    }
  }
  return uit;
}

function coords(p){
  const la=lijst(p,"latitude").map(Number),lo=lijst(p,"longitude").map(Number);
  if(!la.length||la.length!==lo.length||la.some(x=>!Number.isFinite(x)||x<-90||x>90)||lo.some(x=>!Number.isFinite(x)||x<-180||x>180))throw new Ongeldig("Latitude must be in range of -90 to 90°. Longitude must be in range of -180 to 180°.");
  return la.map((lat,i)=>({lat,lon:lo[i]}));
}
function tijdzoneVoor(p,lat,lon,tzVoor){
  const tz=p.get("timezone");
  if(tz&&tz!=="auto"){try{new Intl.DateTimeFormat("en-US",{timeZone:tz});return tz;}catch(e){throw new Ongeldig(`Invalid timezone ${tz}`);}}
  const gevonden=tzVoor&&tzVoor(lat,lon);
  return gevonden||"GMT";
}

/* Antwoord op een Open-Meteo-URL: {status, json}. */
function openMeteoAntwoord(url,{nu=Date.now(),tzVoor=standaardTz}={}){
  const u=new URL(url),p=u.searchParams;
  try{
    if(!/(^|\.)open-meteo\.com$/.test(u.hostname))throw new Error("geen Open-Meteo-URL: "+url);
    if(u.hostname==="geocoding-api.open-meteo.com")return {status:200,json:geocoding(p)};
    const plekken=coords(p);
    let lijstUit;
    if(u.pathname==="/v1/elevation")return {status:200,json:{elevation:plekken.map(({lat,lon})=>Math.round(Math.max(0,20*(1+Math.sin(lat+lon)))))}};
    if(u.hostname==="air-quality-api.open-meteo.com")lijstUit=plekken.map(({lat,lon})=>luchtkwaliteit(lat,lon,p,nu,tijdzoneVoor(p,lat,lon,tzVoor)));
    else if(u.pathname==="/v1/forecast")lijstUit=plekken.map(({lat,lon})=>eenForecast(lat,lon,p,nu,tijdzoneVoor(p,lat,lon,tzVoor)));
    else return {status:404,json:{error:true,reason:"Not Found"}};
    return {status:200,json:lijstUit.length===1?lijstUit[0]:lijstUit};
  }catch(e){
    if(e instanceof Ongeldig)return {status:400,json:{error:true,reason:e.message}};
    throw e;
  }
}

function luchtkwaliteit(lat,lon,p,nuMs,tz){
  const offset=offsetSeconden(nuMs,tz),offMs=offset*1000,lokaalNu=nuMs+offMs;
  const europa=lat>=34&&lat<=72&&lon>=-25&&lon<=45,s=zaad(lat,lon);
  const uit={latitude:r2(lat),longitude:r2(lon),generationtime_ms:0.12,utc_offset_seconds:offset,timezone:tz||"GMT",timezone_abbreviation:afkorting(nuMs,tz),elevation:10};
  const cur=lijst(p,"current"),uur=lijst(p,"hourly");
  const eaqi=Math.round(18+14*(1+Math.sin(nuMs/UUR/9+s*7)));
  if(cur.length){
    uit.current_units={time:"iso8601",interval:"seconds"};uit.current={time:iso(Math.floor(lokaalNu/(UUR))*UUR),interval:3600};
    for(const v of cur){
      if(v==="european_aqi"){uit.current_units[v]="EAQI";uit.current[v]=europa?eaqi:eaqi;}
      else if(v==="us_aqi"){uit.current_units[v]="USAQI";uit.current[v]=Math.round(eaqi*1.3);}
      else if(POLLEN.includes(v)){uit.current_units[v]="grains/m³";uit.current[v]=europa?0:null;}
      else throw new Ongeldig(`Cannot initialize CamsVariable from invalid String value ${v}.`);
    }
  }
  if(uur.length){
    const dagen=geheel(p,"forecast_days",5),start=Math.floor(lokaalNu/DAG)*DAG-offMs;
    uit.hourly_units={time:"iso8601"};uit.hourly={time:[]};
    for(const v of uur){if(!POLLEN.includes(v)&&v!=="european_aqi"&&v!=="us_aqi")throw new Ongeldig(`Cannot initialize CamsVariable from invalid String value ${v}.`);uit.hourly_units[v]=POLLEN.includes(v)?"grains/m³":v==="us_aqi"?"USAQI":"EAQI";uit.hourly[v]=[];}
    for(let i=0;i<dagen*24;i++){
      const t=start+i*UUR;uit.hourly.time.push(iso(t+offMs));
      for(const v of uur){
        if(POLLEN.includes(v))uit.hourly[v].push(europa?(v==="grass_pollen"?r1(Math.max(0,8*Math.sin(t/UUR/5+s))):0):null);
        else uit.hourly[v].push(Math.round(eaqi*(v==="us_aqi"?1.3:1)));
      }
    }
  }
  return uit;
}

/* Kleine vaste plaatsenlijst (velden zoals de echte geocoding-API). */
const PLAATSEN=[
  {id:2759794,name:"Amsterdam",latitude:52.37403,longitude:4.88969,elevation:13,feature_code:"PPLC",country_code:"NL",timezone:"Europe/Amsterdam",population:741636,country:"Nederland",admin1:"Noord-Holland"},
  {id:2745912,name:"Utrecht",latitude:52.09083,longitude:5.12222,elevation:13,feature_code:"PPLA",country_code:"NL",timezone:"Europe/Amsterdam",population:290529,country:"Nederland",admin1:"Utrecht"},
  {id:2759879,name:"Almere",latitude:52.37025,longitude:5.21413,elevation:-3,feature_code:"PPL",country_code:"NL",timezone:"Europe/Amsterdam",population:176432,country:"Nederland",admin1:"Flevoland"},
  {id:2747891,name:"Rotterdam",latitude:51.9225,longitude:4.47917,elevation:0,feature_code:"PPLA2",country_code:"NL",timezone:"Europe/Amsterdam",population:598199,country:"Nederland",admin1:"Zuid-Holland"},
  {id:1850147,name:"Tokio",latitude:35.6895,longitude:139.69171,elevation:44,feature_code:"PPLC",country_code:"JP",timezone:"Asia/Tokyo",population:9733276,country:"Japan",admin1:"Tokio"},
  {id:2147714,name:"Sydney",latitude:-33.86785,longitude:151.20732,elevation:58,feature_code:"PPLA",country_code:"AU",timezone:"Australia/Sydney",population:4627345,country:"Australië",admin1:"Nieuw-Zuid-Wales"},
  {id:5128581,name:"New York",latitude:40.71427,longitude:-74.00597,elevation:10,feature_code:"PPL",country_code:"US",timezone:"America/New_York",population:8175133,country:"Verenigde Staten",admin1:"New York"},
  {id:2643743,name:"Londen",latitude:51.50853,longitude:-0.12574,elevation:25,feature_code:"PPLC",country_code:"GB",timezone:"Europe/London",population:8961989,country:"Verenigd Koninkrijk",admin1:"Engeland"}
];
const plat=t=>String(t||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
const ALIAS={tokyo:"tokio",london:"londen"};
function geocoding(p){
  const naam=plat(p.get("name")).trim(),zoek=ALIAS[naam]||naam,aantal=Math.max(1,Math.min(100,Number(p.get("count"))||10));
  const results=naam.length<2?[]:PLAATSEN.filter(x=>plat(x.name).startsWith(zoek)).slice(0,aantal);
  return results.length?{results,generationtime_ms:0.4}:{generationtime_ms:0.4};
}

/* Tijdzone bij timezone=auto: bekende plaatsen, anders Nederland/België rond de
   Benelux, anders GMT. Scripts met eigen locaties geven hun eigen tzVoor mee. */
function standaardTz(lat,lon){
  for(const x of PLAATSEN)if(Math.abs(x.latitude-lat)<0.6&&Math.abs(x.longitude-lon)<0.6)return x.timezone;
  if(lat>=50.6&&lat<=53.7&&lon>=3.2&&lon<=7.3)return "Europe/Amsterdam";
  return null;
}
function tzUitLijst(locaties,terugval=standaardTz){
  return (lat,lon)=>{let best=null,afstand=Infinity;for(const l of locaties){const d=Math.hypot(l.lat-lat,l.lon-lon);if(d<afstand){afstand=d;best=l;}}
    return best&&afstand<0.6?(best.tz||null):terugval(lat,lon);};
}

/* Playwright: beantwoordt ieder verzoek naar *.open-meteo.com met de fixture.
   Registreer dit als eerste route van een context; latere routes van het script
   zelf gaan voor. */
const ROUTE=/^https?:\/\/([^/?#]+\.)?open-meteo\.com(:\d+)?([/?#]|$)/i;
async function installeerOpenMeteoFixtures(contextOfPage,opties={}){
  await contextOfPage.route(ROUTE,route=>{
    const req=route.request();
    if(req.method()==="OPTIONS")return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*"}});
    const {status,json}=openMeteoAntwoord(req.url(),{nu:opties.nu?opties.nu():Date.now(),tzVoor:opties.tzVoor||standaardTz});
    return route.fulfill({status,contentType:"application/json; charset=utf-8",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(json)});
  });
}
/* Iedere nieuwe context en pagina van deze browser krijgt de fixtures. */
function metOpenMeteoFixtures(browser,opties={}){
  const nc=browser.newContext.bind(browser),np=browser.newPage.bind(browser);
  browser.newContext=async function(...a){const c=await nc(...a);await installeerOpenMeteoFixtures(c,opties);return c;};
  browser.newPage=async function(...a){const p=await np(...a);await installeerOpenMeteoFixtures(p.context(),opties);return p;};
  return browser;
}

module.exports={openMeteoAntwoord,eenForecast,installeerOpenMeteoFixtures,metOpenMeteoFixtures,standaardTz,tzUitLijst,offsetSeconden,zonDag,PLAATSEN,ROUTE};

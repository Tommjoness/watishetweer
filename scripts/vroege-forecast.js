"use strict";

function tel(tekst,zoek){return String(tekst).split(zoek).length-1;}

/* Vroege weeraanvraag. De bootstrap staat klaar voordat de ~115 kB app is
   gedownload en uitgevoerd (live gemeten: 0,25 s eerder op desktop, 0,47 s op
   een 4x tragere telefoon-CPU). Hij vraagt de volledige verwachting daarom al
   aan; de app neemt dat antwoord over via weatherNowNeemVroegeForecast() als
   het adres exact gelijk is. De adresopbouw wordt letterlijk overgenomen uit
   load() in de finale, onverkleinde app-runtime (const basis=… en const f=…,
   ná pressure-retirement en alle andere bouwlagen), zodat er één bron
   is; de plaats volgt dezelfde volgorde en dezelfde waarden als de app-start:
   plaatsroute (Number), gedeelde link (parseFloat), ?hier=1 (niets), laatst
   gekozen plaats (JSON uit localStorage). */
const FORECAST_START='const basis="https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon';
const FORECAST_EIND="\n  const fmin=basis+";
function forecastAdresCode(runtime){
  const bron=String(runtime||"");
  if(tel(bron,FORECAST_START)!==1)throw new Error("Vroege weeraanvraag: verwacht exact één forecast-adresopbouw in load(), gevonden "+tel(bron,FORECAST_START)+".");
  const start=bron.indexOf(FORECAST_START),eind=bron.indexOf(FORECAST_EIND,start);
  if(eind<0)throw new Error("Vroege weeraanvraag: einde van de forecast-adresopbouw niet gevonden.");
  const code=bron.slice(start,eind);
  if(!/\n  const f=basis\+/.test(code))throw new Error("Vroege weeraanvraag: const f=basis+… ontbreekt in de adresopbouw.");
  return code;
}
/* Eerste bezoek zonder plaats: de app laadt dan een vaste standaardplaats
   (nu Amsterdam). Ook die coördinaten komen letterlijk uit de finale runtime;
   ontbreekt dat startpad, dan doet de bootstrap bij een eerste bezoek niets. */
const STANDAARD_RE=/\/\/ D\. eerste bezoek[^\n]*\n(?:[^\n]*\n){0,6}?\s*load\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),/;
function standaardPlaats(runtime){
  const m=STANDAARD_RE.exec(String(runtime||""));
  return m?{lat:Number(m[1]),lon:Number(m[2])}:null;
}
function vroegeForecastBron(bron){
  const code=forecastAdresCode(bron);
  const standaard=standaardPlaats(bron);
  return `(function(){
"use strict";
try{
  if(window.__WEATHERNOW_APP_READY__||window.__WEATHERNOW_VROEGE_FORECAST__||typeof fetch!=="function")return;
  let lat=null,lon=null;
  const el=document.getElementById("weather-now-route");
  let route=null;
  if(el){try{route=JSON.parse(el.textContent||"null");}catch(e){route=null;}}
  if(route&&Number.isFinite(Number(route.lat))&&Number.isFinite(Number(route.lon))&&route.name){lat=Number(route.lat);lon=Number(route.lon);}
  else{
    const p=new URLSearchParams(location.search);
    const la=parseFloat(p.get("lat")),lo=parseFloat(p.get("lon"));
    if(!isNaN(la)&&!isNaN(lo)){lat=la;lon=lo;}
    else if(p.get("hier"))return;
    else{
      let v=null;
      try{const ruw=localStorage.getItem("weerbriefing.plaats");v=ruw?JSON.parse(ruw):null;}catch(e){v=null;}
      if(v&&v.lat!=null){lat=v.lat;lon=v.lon;}
      else{const standaard=${JSON.stringify(standaard)};if(standaard){lat=standaard.lat;lon=standaard.lon;}}
    }
  }
  if(lat===null||lon===null)return;
  const adres=(function(lat,lon){
  ${code}
  return f;
  })(lat,lon);
  window.__WEATHERNOW_VROEGE_FORECAST__={url:adres,op:Date.now(),gebruikt:false,respons:fetch(adres).catch(()=>null)};
}catch(e){}
})();
`;
}

const VROEGE_FORECAST_MARKER="__WEATHERNOW_VROEGE_FORECAST__";
module.exports={forecastAdresCode,vroegeForecastBron,standaardPlaats,VROEGE_FORECAST_MARKER};

"use strict";

/*
 * Wereldwijde regressiematrix voor WeatherNow.
 *
 * Landgrenzen veranderen de weerlogica niet; coördinaten, lokale tijdzone,
 * breedtegraad, databeschikbaarheid en het weertype doen dat wel. Daarom toetst
 * deze suite alle relevante UTC-offsetvormen, klimaatranden, WMO-codes,
 * neerslagdrempels, grafiekvormen en ontbrekende-data-situaties deterministisch.
 */

const assert=require("assert");
const {laadKern}=require("./kern.js");
const {bouw}=require("./data.js");
const {
  analyseerNeerslagData,
  neerslagZin,
  neerslagKorteWeergave,
  statusRang
}=require("./interpretatie-engine.js");

let geslaagd=0,mislukt=0;
const fouten=[];
const schoon=t=>String(t==null?"":t).replace(/\u00a0/g," ");
const zonderTags=t=>schoon(t).replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();

function check(naam,voorwaarde,extra){
  if(voorwaarde){geslaagd++;return;}
  mislukt++;
  fouten.push(naam+(extra?" -> "+extra:""));
}

function isoLokaalNaarMs(lokaal){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(lokaal);
  if(!m) throw new Error("ongeldige lokale testtijd: "+lokaal);
  return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]);
}

function zetPlaatsKlok(api,offsetSeconden,lokaal){
  /* De app verschuift vanaf de actuele browsertijd en gebruikt daarbij de
     huidige browser-offset. Bij een historische testdatum kan getHours() door
     zomer-/wintertijd echter een andere browser-offset toepassen. Los dat in de
     fixture op, zodat de matrix onafhankelijk blijft van land en TZ van CI. */
  const doel=isoLokaalNaarMs(lokaal);
  const eigenNu=-new Date().getTimezoneOffset()*60;
  let basis=doel-offsetSeconden*1000;
  for(let i=0;i<2;i++){
    const verschoven=basis+(offsetSeconden-eigenNu)*1000;
    const eigenOpDoelmoment=-new Date(verschoven).getTimezoneOffset()*60;
    basis=doel-(offsetSeconden-eigenNu+eigenOpDoelmoment)*1000;
  }
  api.S.klokOverride=new Date(basis);
}

function kwartierTijdenVanaf(lokaal,aantal){
  const start=isoLokaalNaarMs(lokaal);
  return Array.from({length:aantal},(_,i)=>new Date(start+(i+1)*15*60000).toISOString().slice(0,16));
}

function zetHuidigUur(d,datum,uur){
  const sleutel=datum+"T"+String(uur).padStart(2,"0")+":00";
  const i=d.hourly.time.indexOf(sleutel);
  if(i<0) throw new Error("testuur ontbreekt: "+sleutel);
  d.current.time=sleutel;
  for(const veld of ["temperature_2m","apparent_temperature","relative_humidity_2m","weather_code","cloud_cover",
    "pressure_msl","wind_speed_10m","wind_direction_10m","wind_gusts_10m","is_day"]){
    if(d.hourly[veld]) d.current[veld]=d.hourly[veld][i];
  }
  d.current.precipitation=d.hourly.precipitation[i]||0;
  d.current.interval=900;
  d.minutely_15={
    time:kwartierTijdenVanaf(sleutel.slice(0,16),16),
    precipitation:Array(16).fill(0),
    rain:Array(16).fill(0),
    showers:Array(16).fill(0),
    snowfall:Array(16).fill(0),
    weather_code:Array(16).fill(d.current.weather_code||3)
  };
  return i;
}

function omgeving({breedte=390,opties={},lat=52.35,lon=5.26,timezone="Europe/Amsterdam",offset=7200}={}){
  const {api,bak}=laadKern(breedte);
  const d=bouw(opties);
  d.timezone=timezone;
  d.utc_offset_seconds=offset;
  Object.assign(api.S,{d,op:Date.now(),lat,lon,label:"Wereldtest",dag:null,bereik:24});
  api.S.i0=d.hourly.time.findIndex(t=>t.slice(0,13)===d.current.time.slice(0,13));
  zetPlaatsKlok(api,offset,d.current.time.slice(0,16));
  return {api,bak,d};
}

function renderBasis(ctx,n=24){
  const {api}=ctx;
  api.meters();
  api.briefing();
  api.nowcast();
  api.etmaal(api.S.i0,n);
}

function temperatuurLabels(html){
  return [...String(html).matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"[^>]*font-size="([\d.]+)">(-?\d+)°<\/text>/g)]
    .map(m=>({x:+m[1],y:+m[2],fs:+m[3],waarde:+m[4],breedte:String(m[4]).length*(+m[3])*0.58+(+m[3])*0.40}));
}

function labelsBotsen(labels){
  for(let i=0;i<labels.length;i++) for(let j=i+1;j<labels.length;j++){
    const a=labels[i],b=labels[j];
    if(Math.abs(a.x-b.x)<(a.breedte+b.breedte)/2+4 && Math.abs(a.y-b.y)<Math.max(a.fs,b.fs)+3) return [a,b];
  }
  return null;
}

/* 1. Alle civiele UTC-offsetvormen en wereldregio's. */
const wereldprofielen=[
  ["Baker Island",0,-176.5,"Etc/GMT+12",-12*3600],
  ["Honolulu",21.3,-157.8,"Pacific/Honolulu",-10*3600],
  ["Marquesaseilanden",-9.0,-139.5,"Pacific/Marquesas",-9.5*3600],
  ["Anchorage",61.2,-149.9,"America/Anchorage",-9*3600],
  ["Los Angeles",34.1,-118.2,"America/Los_Angeles",-8*3600],
  ["Denver",39.7,-105.0,"America/Denver",-7*3600],
  ["Chicago",41.9,-87.6,"America/Chicago",-6*3600],
  ["New York",40.7,-74.0,"America/New_York",-5*3600],
  ["Halifax",44.6,-63.6,"America/Halifax",-4*3600],
  ["St. John's",47.6,-52.7,"America/St_Johns",-3.5*3600],
  ["São Paulo",-23.6,-46.6,"America/Sao_Paulo",-3*3600],
  ["Fernando de Noronha",-3.9,-32.4,"America/Noronha",-2*3600],
  ["Azoren",37.7,-25.4,"Atlantic/Azores",-1*3600],
  ["Londen",51.5,-0.1,"Europe/London",0],
  ["Amsterdam",52.4,4.9,"Europe/Amsterdam",3600],
  ["Kaapstad",-33.9,18.4,"Africa/Johannesburg",2*3600],
  ["Nairobi",-1.3,36.8,"Africa/Nairobi",3*3600],
  ["Teheran",35.7,51.4,"Asia/Tehran",3.5*3600],
  ["Dubai",25.2,55.3,"Asia/Dubai",4*3600],
  ["Kabul",34.6,69.2,"Asia/Kabul",4.5*3600],
  ["Karachi",24.9,67.0,"Asia/Karachi",5*3600],
  ["Delhi",28.6,77.2,"Asia/Kolkata",5.5*3600],
  ["Kathmandu",27.7,85.3,"Asia/Kathmandu",5.75*3600],
  ["Dhaka",23.8,90.4,"Asia/Dhaka",6*3600],
  ["Yangon",16.8,96.2,"Asia/Yangon",6.5*3600],
  ["Bangkok",13.8,100.5,"Asia/Bangkok",7*3600],
  ["Beijing",39.9,116.4,"Asia/Shanghai",8*3600],
  ["Eucla",-31.7,128.9,"Australia/Eucla",8.75*3600],
  ["Tokyo",35.7,139.7,"Asia/Tokyo",9*3600],
  ["Darwin",-12.5,130.8,"Australia/Darwin",9.5*3600],
  ["Brisbane",-27.5,153.0,"Australia/Brisbane",10*3600],
  ["Lord Howe",-31.6,159.1,"Australia/Lord_Howe",10.5*3600],
  ["Nouméa",-22.3,166.5,"Pacific/Noumea",11*3600],
  ["Auckland",-36.8,174.8,"Pacific/Auckland",12*3600],
  ["Chathameilanden",-43.9,-176.5,"Pacific/Chatham",12.75*3600],
  ["Apia",-13.8,-171.8,"Pacific/Apia",13*3600],
  ["Kiritimati",1.9,-157.4,"Pacific/Kiritimati",14*3600]
];

for(const [naam,lat,lon,timezone,offset] of wereldprofielen){
  try{
    const ctx=omgeving({lat,lon,timezone,offset});
    zetPlaatsKlok(ctx.api,offset,"2026-07-22T23:45");
    check(naam+": lokale klok blijft 23:45",ctx.api.plaatsKlok()==="23:45",ctx.api.plaatsKlok());
    renderBasis(ctx,24);
    check(naam+": briefing bevat geen NaN of undefined",!/NaN|undefined|\[object Object\]/.test(ctx.bak.brief.innerHTML),zonderTags(ctx.bak.brief.innerHTML));
    check(naam+": grafiek heeft een geldige viewBox",/^0 0 \d+ \d+$/.test(ctx.bak.chart.getAttribute("viewBox")||""),ctx.bak.chart.getAttribute("viewBox"));
  }catch(e){
    check(naam+": volledige wereldrender loopt niet vast",false,e.message);
  }
}

/* 2. Alle door de app ondersteunde WMO-weercodes, overdag én 's nachts. */
{
  const eerste=omgeving();
  const codes=Object.keys(eerste.api.CODES||{}).map(Number).sort((a,b)=>a-b);
  check("WMO-catalogus bevat alle 28 ondersteunde codes",codes.length===28,"gevonden "+codes.length);
  for(const code of codes){
    for(const dag of [0,1]){
      try{
        const ctx=omgeving({opties:{wc:()=>code,wcNu:code,nacht:dag===0}});
        ctx.d.current.is_day=dag;
        const icoon=ctx.api.icon(code,dag===1,24);
        check("WMO "+code+" "+(dag?"dag":"nacht")+": icoon is geldig",/^<svg[\s\S]*<\/svg>$/.test(icoon),icoon.slice(0,80));
        ctx.api.meters();
        ctx.api.briefing();
        check("WMO "+code+" "+(dag?"dag":"nacht")+": tekst blijft bruikbaar",!/NaN|undefined|Onbekend/.test(ctx.bak.brief.innerHTML),zonderTags(ctx.bak.brief.innerHTML));
      }catch(e){
        check("WMO "+code+" "+(dag?"dag":"nacht")+": render loopt niet vast",false,e.message);
      }
    }
  }
}

/* 3. De briefing gebruikt de lokale kalenderdag; de grafiek blijft een rollend
   etmaal. Een waarde op morgen mag vroeg vandaag dus niet als dagmaximum gelden. */
{
  const ctx=omgeving({breedte:390});
  const i=zetHuidigUur(ctx.d,"2026-07-22",1);
  ctx.api.S.i0=i;
  const h=ctx.d.hourly;
  for(let k=0;k<h.temperature_2m.length;k++){
    h.temperature_2m[k]=18;
    h.apparent_temperature[k]=17;
  }
  for(let stap=0;stap<24;stap++) h.temperature_2m[i+stap]=18+Math.max(0,16-Math.abs(stap-15));
  h.temperature_2m[i+15]=34;
  h.temperature_2m[i+24]=50; // rechtergrens van de rollende 24-uursgrafiek, op morgen
  ctx.d.current.temperature_2m=h.temperature_2m[i];
  ctx.d.current.apparent_temperature=h.apparent_temperature[i];
  zetPlaatsKlok(ctx.api,ctx.d.utc_offset_seconds,"2026-07-22T01:06");
  ctx.api.briefing();
  ctx.api.etmaal(i,24);
  const tekst=zonderTags(ctx.bak.brief.innerHTML);
  check("briefing kiest de 34 graden uit het zichtbare etmaal",/34 graden/.test(tekst),tekst);
  check("briefing noemt het bijbehorende uur 16:00",/16:00/.test(tekst),tekst);
  check("briefing noemt de 50 graden van morgen niet als maximum van vandaag",!/50 graden/.test(tekst),tekst);
  const labels=temperatuurLabels(ctx.bak.chart.innerHTML);
  check("grafiek behoudt de aparte rollende rechtergrens van 50 graden",labels.some(x=>x.waarde===50),labels.map(x=>x.waarde).join(","));
}

/* 4. Informatiedichtheid en botsingsvrijheid bij alle relevante schermmaten. */
const curves={
  vlak:j=>20,
  stijgend:j=>-10+j*2,
  dalend:j=>38-j*1.5,
  sinus:j=>18+10*Math.sin((j-6)/24*2*Math.PI),
  zigzag:j=>20+(j%2?8:-8),
  dubbelpiek:j=>20+Math.max(12-Math.abs(j-6)*2,10-Math.abs(j-17)*2,0),
  scherpePiek:j=>j===12?55:10+Math.abs(j-12)*0.2,
  extreem:j=>-80+j*(135/23)
};

for(const breedte of [320,390,430,760,900,1100,1440]){
  for(const [naam,curve] of Object.entries(curves)){
    try{
      const ctx=omgeving({breedte});
      const i=ctx.api.S.i0;
      for(let j=0;j<Math.min(48,ctx.d.hourly.temperature_2m.length-i);j++){
        const v=curve(j);
        ctx.d.hourly.temperature_2m[i+j]=v;
        ctx.d.hourly.apparent_temperature[i+j]=v-1;
      }
      ctx.d.current.temperature_2m=ctx.d.hourly.temperature_2m[i];
      ctx.api.etmaal(i,24);
      const labels=temperatuurLabels(ctx.bak.chart.innerHTML);
      const botsing=labelsBotsen(labels);
      check(breedte+"px "+naam+": temperatuurcijfers botsen niet",!botsing,botsing?JSON.stringify(botsing):"");
      check(breedte+"px "+naam+": alle acht drie-uursreferenties blijven zichtbaar en ieder uur krijgt hoogstens één cijfer",
        labels.length>=8&&labels.length<=24,"labels "+labels.length);
      check(breedte+"px "+naam+": grafiek bevat geen NaN",!/NaN|undefined/.test(ctx.bak.chart.innerHTML),ctx.bak.chart.innerHTML.slice(0,120));
    }catch(e){
      check(breedte+"px "+naam+": grafiek loopt niet vast",false,e.message);
    }
  }
}

{
  const ctx=omgeving({breedte:390});
  const i=ctx.api.S.i0;
  for(let j=0;j<24;j++){
    ctx.d.hourly.temperature_2m[i+j]=10+j;
    ctx.d.hourly.apparent_temperature[i+j]=9+j;
  }
  ctx.d.current.temperature_2m=10;
  ctx.api.etmaal(i,24);
  const labels=temperatuurLabels(ctx.bak.chart.innerHTML);
  check("mobiele 24-uursgrafiek toont minimaal alle acht drie-uursreferenties",labels.length>=8,"gevonden "+labels.length+": "+labels.map(x=>x.waarde).join(","));
}

/* 5. Neerslagmatrix: alle kans- en hoeveelheidsdrempels, meerdere termijnen. */
function tijdreeks(start,stapMin,aantal,eersteStap=0){
  const ms=isoLokaalNaarMs(start);
  return Array.from({length:aantal},(_,i)=>new Date(ms+(i+eersteStap)*stapMin*60000).toISOString().slice(0,16));
}

function neerslagFixture(kans,mm,code=61){
  const nu="2026-01-01T00:00";
  const ht=tijdreeks(nu,60,10,0);
  const mt=tijdreeks(nu,15,32,1);
  const min=Array(32).fill(0);
  if(mm>0) min[0]=mm;
  return {
    current:{time:nu,interval:900,precipitation:0,weather_code:3},
    hourly:{
      time:ht,
      precipitation_probability:Array(10).fill(kans),
      precipitation:Array(10).fill(0),
      weather_code:Array(10).fill(code),
      rain:Array(10).fill(0),showers:Array(10).fill(0),snowfall:Array(10).fill(0)
    },
    minutely_15:{
      time:mt,precipitation:min,
      rain:min.map(v=>code>=51&&code<=67?v:0),
      showers:min.map(v=>code>=80&&code<=82?v:0),
      snowfall:min.map(v=>(code>=71&&code<=77)||code===85||code===86?v:0),
      weather_code:Array(32).fill(code)
    }
  };
}

const kansen=[0,1,19,20,39,40,69,70,100];
const hoeveelheden=[0,0.004,0.006,0.04,0.09,0.1,1,20,100];
for(const duur of [60,120,360]){
  for(const kans of kansen){
    let vorige=-Infinity;
    for(const mm of hoeveelheden){
      const a=analyseerNeerslagData(neerslagFixture(kans,mm),duur);
      const zin=neerslagZin(a),kort=neerslagKorteWeergave(a),alles=zin+" "+kort.hoofd+" "+kort.detail;
      check(duur+" min, "+kans+"%, "+mm+" mm: geen technische rommel",!/NaN|undefined|\[object Object\]/.test(alles),alles);
      if(kans===0&&mm===0){
        check(duur+" min droog: geen 0% of 0,0 mm",!/0%|0,0 mm/.test(alles),alles);
      }
      const rang=statusRang(a.status);
      check(duur+" min, "+kans+"%: meer hoeveelheid maakt conclusie niet droger",rang>=vorige,a.status+" na rang "+vorige);
      vorige=rang;
    }
  }
}

/* 5b. Productie-integratie: bovenste samenvatting, onderste tekst en de
   kwartiergrafiek moeten exact hetzelfde open tijdvenster (nu, nu+2 uur]
   gebruiken. De forse bui die om 14:45 eindigde is bewust verleden; alleen
   het laatste toekomstige kwartier om 16:45 bevat 0,4 mm. */
{
  const ctx=omgeving({breedte:390});
  const d=ctx.d,h=d.hourly;
  const i=h.time.indexOf("2026-07-22T14:00");
  d.current.time="2026-07-22T14:45";
  d.current.precipitation=0;
  d.current.weather_code=3;
  ctx.api.S.i0=i;
  zetPlaatsKlok(ctx.api,d.utc_offset_seconds,d.current.time);

  h.precipitation_probability.fill(0);
  h.precipitation.fill(0);
  h.weather_code.fill(3);
  for(const q of [i+1,i+2,i+3]){
    h.precipitation_probability[q]=80;
    h.weather_code[q]=61;
  }

  const tijden=tijdreeks("2026-07-22T14:30",15,10,0);
  const waarden=tijden.map((_,k)=>k===1?5:k===9?0.4:0);
  d.minutely_15={
    time:tijden,
    precipitation:waarden,
    rain:waarden.map((v,k)=>k===9?v:0),
    showers:Array(10).fill(0),
    snowfall:Array(10).fill(0),
    weather_code:tijden.map((_,k)=>k===9?61:3)
  };

  const analyse=analyseerNeerslagData(d,120);
  const verwacht=neerslagZin(analyse);
  check("laatste kwartier: centrale analyse heeft volledige twee-uursdekking",
    analyse.genoeg&&analyse.hoeveelheidDekking===1&&analyse.kansDekking===1,
    JSON.stringify({genoeg:analyse.genoeg,hoeveelheidDekking:analyse.hoeveelheidDekking,kansDekking:analyse.kansDekking}));
  check("laatste kwartier: analyse begint na nu en eindigt exact twee uur later",
    analyse.minutelyItems[0]&&analyse.minutelyItems[0].tijd==="2026-07-22T15:00"&&
    analyse.minutelyItems.at(-1)&&analyse.minutelyItems.at(-1).tijd==="2026-07-22T16:45",
    analyse.minutelyItems.map(x=>x.tijd).join(", "));

  ctx.api.briefing();
  ctx.api.nowcast();
  const boven=zonderTags(ctx.bak.brief.innerHTML);
  const onder=schoon(ctx.bak.nctext.textContent).trim();
  check("laatste kwartier: samenvatting bovenaan gebruikt de centrale neerslagzin",
    boven.startsWith(verwacht),boven);
  check("laatste kwartier: neerslagtekst onderaan is exact dezelfde centrale zin",
    onder===verwacht,onder+" | verwacht: "+verwacht);
  check("laatste kwartier: grafiek tekent 0,4 mm om 16:45",
    />0,4<\/text>/.test(ctx.bak.nc.innerHTML)&&/16:/.test(ctx.bak.nc.innerHTML),ctx.bak.nc.innerHTML);
  check("laatste kwartier: grafiek tekent de verstreken 5 mm niet",
    !/>5<\/text>/.test(ctx.bak.nc.innerHTML),ctx.bak.nc.innerHTML);
}

/* 6. Temperatuur, wind, zicht en vocht aan de fysieke en weergaveranden. */
for(const temp of [-90,-60,-30,-1,0,1,20,45,60]){
  try{
    const ctx=omgeving({opties:{temp:()=>temp,tempNu:temp}});
    ctx.api.etmaal(ctx.api.S.i0,24);
    check(temp+"°C: grafiek blijft geldig",!/NaN|undefined/.test(ctx.bak.chart.innerHTML));
  }catch(e){check(temp+"°C: render loopt niet vast",false,e.message);}
}

{
  const ctx=omgeving();
  const grenzen=[0,1,5,6,11,12,19,20,28,29,38,39,49,50,61,62,74,75,88,89,102,103,116,117,150];
  let vorig=-1;
  for(const kmu of grenzen){
    const b=ctx.api.bft(kmu);
    check(kmu+" km/u: Beaufort blijft tussen 0 en 12",b>=0&&b<=12,"Bft "+b);
    check(kmu+" km/u: Beaufort is monotoon",b>=vorig,"Bft "+b+" na "+vorig);
    vorig=b;
  }
}

for(const zicht of [0,500,999,1000,3999,4000,9999,10000,50000,null]){
  try{
    const ctx=omgeving({opties:{zicht}});
    ctx.api.meters();
    check("zicht "+zicht+": tekst bevat geen NaN",!/NaN|undefined/.test(ctx.bak.vis.innerHTML+ctx.bak.vissub.textContent));
  }catch(e){check("zicht "+zicht+": meter loopt niet vast",false,e.message);}
}

for(const rh of [0,39,40,60,61,100]){
  try{
    const ctx=omgeving({opties:{rh}});
    ctx.api.meters();
    check("luchtvochtigheid "+rh+"%: waarde blijft zichtbaar",new RegExp("(^|>)"+rh+"(<|$)").test(ctx.bak.hum.innerHTML),ctx.bak.hum.innerHTML);
  }catch(e){check("luchtvochtigheid "+rh+"%: meter loopt niet vast",false,e.message);}
}

/* 7. Pooldag, poolnacht, datumgrenzen en klokomslagen. */
for(const [naam,isDag,verwacht] of [["pooldag",1,"24 uur daglicht"],["poolnacht",0,"poolnacht"]]){
  try{
    const ctx=omgeving({lat:78.2,lon:15.6,timezone:"Arctic/Longyearbyen",offset:7200});
    ctx.d.daily.sunrise=ctx.d.daily.sunrise.map(()=>null);
    ctx.d.daily.sunset=ctx.d.daily.sunset.map(()=>null);
    ctx.d.hourly.is_day=ctx.d.hourly.is_day.map(()=>isDag);
    ctx.d.current.is_day=isDag;
    check(naam+": daglengte is inhoudelijk correct",ctx.api.daglengte(0)===verwacht,ctx.api.daglengte(0));
    ctx.api.etmaal(ctx.api.S.i0,24);
    ctx.api.nachten();
    check(naam+": grafiek en nachtzicht lopen niet vast",!/NaN|undefined/.test(ctx.bak.chart.innerHTML+ctx.bak.nights.innerHTML));
  }catch(e){check(naam+": render loopt niet vast",false,e.message);}
}

for(const [naam,lokaal,offset] of [
  ["jaargrens west","2025-12-31T23:59",-12*3600],
  ["jaargrens oost","2026-01-01T00:01",14*3600],
  ["schrikkeldag","2028-02-29T12:34",5.75*3600]
]){
  try{
    const ctx=omgeving({offset});
    zetPlaatsKlok(ctx.api,offset,lokaal);
    check(naam+": lokale minuten blijven exact",ctx.api.plaatsKlok()===lokaal.slice(11,16),ctx.api.plaatsKlok());
  }catch(e){check(naam+": kloktest loopt niet vast",false,e.message);}
}

{
  try{
    const ctx=omgeving();
    const i=ctx.api.S.i0;
    ctx.d.hourly.time[i+2]=ctx.d.hourly.time[i+1];
    ctx.api.etmaal(i,24);
    check("dubbel lokaal uur: grafiek loopt niet vast",!/NaN|undefined/.test(ctx.bak.chart.innerHTML));
  }catch(e){check("dubbel lokaal uur: grafiek loopt niet vast",false,e.message);}
}

{
  try{
    const ctx=omgeving();
    const i=ctx.api.S.i0+2;
    for(const veld of Object.keys(ctx.d.hourly)){
      if(Array.isArray(ctx.d.hourly[veld])) ctx.d.hourly[veld].splice(i,1);
    }
    ctx.api.etmaal(ctx.api.S.i0,24);
    check("overgeslagen lokaal uur: grafiek loopt niet vast",!/NaN|undefined/.test(ctx.bak.chart.innerHTML));
  }catch(e){check("overgeslagen lokaal uur: grafiek loopt niet vast",false,e.message);}
}

/* 8. Ontbrekende waarden en modelgaten mogen nooit een verzonnen nul opleveren. */
{
  const ctx=omgeving();
  const i=ctx.api.S.i0;
  for(const sprong of [3,4,11,12]){
    ctx.d.hourly.temperature_2m[i+sprong]=null;
    ctx.d.hourly.apparent_temperature[i+sprong]=null;
  }
  ctx.api.etmaal(i,24);
  check("temperatuurgaten leveren geen NaN of kunstmatige 0°C-piek",!/NaN|>0°<\/text>/.test(ctx.bak.chart.innerHTML),ctx.bak.chart.innerHTML.slice(0,160));
}

{
  const ctx=omgeving({opties:{geenKwartier:true}});
  try{
    ctx.api.briefing();ctx.api.nowcast();ctx.api.etmaal(ctx.api.S.i0,24);
    check("zonder kwartierdata blijft een eerlijke uurdata-fallback werken",!/NaN|undefined/.test(ctx.bak.brief.innerHTML+ctx.bak.nctext.textContent));
  }catch(e){check("zonder kwartierdata loopt de app niet vast",false,e.message);}
}

{
  const ctx=omgeving();
  const c=ctx.d.current,h=ctx.d.hourly;
  for(const veld of ["wind_speed_10m","wind_direction_10m","wind_gusts_10m","pressure_msl","cloud_cover"]){
    c[veld]=null;
    if(Array.isArray(h[veld])) h[veld].fill(null);
  }
  try{
    ctx.api.meters();
    ctx.api.briefing();
    const inhoud=[ctx.bak.wind.innerHTML,ctx.bak.gust.innerHTML,ctx.bak.pres.innerHTML,
      ctx.bak.cloud.innerHTML,ctx.bak.brief.innerHTML].join(" ");
    check("ontbrekende wind, druk en bewolking worden niet als nul verzonnen",
      !/\b0\s*(?:km\/u|hPa|%)/.test(zonderTags(inhoud))&&!/NaN|undefined|null/.test(inhoud),zonderTags(inhoud));
    check("ontbrekende wind krijgt een expliciete uitleg",
      /Windgegevens zijn momenteel niet beschikbaar/.test(zonderTags(ctx.bak.brief.innerHTML)),zonderTags(ctx.bak.brief.innerHTML));
  }catch(e){check("ontbrekende wind, druk en bewolking lopen niet vast",false,e.message);}
}

{
  const ctx=omgeving();
  ctx.d.current.temperature_2m=null;
  ctx.d.hourly.temperature_2m.fill(null);
  try{
    ctx.api.briefing();
    const tekst=zonderTags(ctx.bak.brief.innerHTML);
    const neerslagOpeningen=(tekst.match(/kans op neerslag|neerslag verwacht|gegevens om de neerslagkans/gi)||[]).length;
    check("ontbrekende temperatuur dupliceert de centrale neerslagconclusie niet",neerslagOpeningen===1,tekst);
  }catch(e){check("ontbrekende temperatuur laat de briefing niet vastlopen",false,e.message);}
}

{
  const ctx=omgeving();
  delete ctx.d.minutely_15.precipitation;
  delete ctx.d.hourly.precipitation;
  try{
    ctx.api.briefing();ctx.api.nowcast();
    const tekst=zonderTags(ctx.bak.brief.innerHTML+" "+ctx.bak.nctext.textContent);
    check("ontbrekende neerslagreeksen geven geen stellige droge nulconclusie",
      /onvoldoende|ontbreken voldoende consistente gegevens/i.test(tekst)&&!/NaN|undefined|null/.test(tekst),tekst);
  }catch(e){check("ontbrekende neerslagreeksen lopen niet vast",false,e.message);}
}

if(mislukt){
  console.error("\nWereldwijde scenario-matrix: "+mislukt+" van "+(geslaagd+mislukt)+" controles mislukt.");
  fouten.slice(0,40).forEach(f=>console.error("FOUT "+f));
  if(fouten.length>40) console.error("... en "+(fouten.length-40)+" extra fouten");
  process.exitCode=1;
}else{
  console.log("\nWereldwijde scenario-matrix: "+geslaagd+" controles geslaagd.");
}

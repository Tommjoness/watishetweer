"use strict";
const assert=require("assert");
const q=require("./q1-precip-performance.js");

assert.equal(q.mmTekst(0),"0,0 mm");
assert.equal(q.mmTekst(0.04),"<0,1 mm");
assert.equal(q.mmTekst(1.44),"1,4 mm");
assert.equal(q.mmTekst(null),"");

assert.deepEqual(q.tooltipNeerslag(0,0),{kans:"0%",hoeveelheid:"",waarde:"0%"});
assert.deepEqual(q.tooltipNeerslag(8,0),{kans:"8%",hoeveelheid:"",waarde:"8%"});
assert.deepEqual(q.tooltipNeerslag(25,0),{kans:"25%",hoeveelheid:"",waarde:"25%"},"0 mm verandert een echte kans niet");
assert.deepEqual(q.tooltipNeerslag(65,1.24),{kans:"65%",hoeveelheid:"1,2 mm",waarde:"65% · 1,2 mm"});
assert.deepEqual(q.tooltipNeerslag(null,1.2),{kans:"–",hoeveelheid:"1,2 mm",waarde:"– · 1,2 mm"});

const hoofd=a=>!a.genoeg?"–":a.kans===0?"Droog":a.kans==null?"–":a.kans+"%";
assert.deepEqual(q.dagNeerslagPresentatie(60,4.8,hoofd,q.mmTekst),{hoofd:"60%",hoeveelheid:"4,8 mm"});
assert.deepEqual(q.dagNeerslagPresentatie(0,0,hoofd,q.mmTekst),{hoofd:"Droog",hoeveelheid:""});
assert.deepEqual(q.dagNeerslagPresentatie(25,0,hoofd,q.mmTekst),{hoofd:"25%",hoeveelheid:""},"daily 0 mm mag 25% niet naar 0% veranderen");
assert.deepEqual(q.dagNeerslagPresentatie(null,null,hoofd,q.mmTekst),{hoofd:"–",hoeveelheid:""});

assert.equal(q.neerslagTegelRelevant({genoeg:true,kans:25,hoeveelheid:0,currentWet:false}),false,"kleine droge kans blijft uit de prominente tegel");
assert.equal(q.neerslagTegelRelevant({genoeg:true,kans:65,hoeveelheid:0,currentWet:false}),true,"relevante kans maakt de tegel zichtbaar");
assert.equal(q.neerslagTegelRelevant({genoeg:true,kans:0,hoeveelheid:1.4,currentWet:false}),true,"meetbare hoeveelheid met tegenstrijdige kans moet zichtbaar blijven");
assert.equal(q.neerslagTegelRelevant({genoeg:false,kans:null,hoeveelheid:null,currentWet:true,status:"NEERSLAG_NU"}),true,"actuele neerslag blijft relevant");
assert.equal(q.neerslagTegelRelevant({genoeg:false,kans:null,hoeveelheid:null,currentWet:false}),false);

function lokaal(ms,tz){
  const delen=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms));
  const p={};delen.forEach(x=>{if(x.type!=="literal")p[x.type]=x.value;});
  return p.year+"-"+p.month+"-"+p.day+"T"+p.hour+":"+p.minute;
}
function reeks(vanafMs,aantal,tz,tempFn){
  const time=[],temperature_2m=[];
  for(let i=0;i<aantal;i++){
    const ms=vanafMs+i*3600000;
    time.push(lokaal(ms,tz));
    temperature_2m.push(tempFn?tempFn(i,ms):10+i);
  }
  return {time,temperature_2m};
}
function trendFixture(tz,nuMs,vanafMs,aantal,van,tempFn){
  return {timezone:tz,current:{temperature_2m:van},hourly:reeks(vanafMs,aantal,tz,tempFn)};
}

/* Almere: 23:17 lokale tijd -> doel 02:17 volgende lokale kalenderdag. Het
   dichtstbijzijnde echte uurpunt is 02:00; er wordt niet naar 02:17 geïnterpoleerd. */
{
  const tz="Europe/Amsterdam",nu=Date.UTC(2026,7,11,21,17),vanaf=Date.UTC(2026,7,11,20,0);
  const d=trendFixture(tz,nu,vanaf,10,19,i=>20-i);
  const t=q.temperatuurTrend(d,nu);
  assert.equal(t.genoeg,true);assert(t.puntTijd.endsWith("T02:00"));assert.equal(t.afwijkingMin,17);assert.equal(t.richting,"daalt");
}

/* Tokyo en New York bewijzen dat geen Nederlandse/device-klok in de keuze zit. */
{
  const tz="Asia/Tokyo",nu=Date.UTC(2026,7,11,21,17),vanaf=Date.UTC(2026,7,11,20,0);
  const t=q.temperatuurTrend(trendFixture(tz,nu,vanaf,10,19,i=>18+i),nu);
  assert.equal(t.genoeg,true);assert(t.puntTijd.endsWith("T09:00"));assert.equal(t.afwijkingMin,17);
}
{
  const tz="America/New_York",nu=Date.UTC(2026,7,11,21,17),vanaf=Date.UTC(2026,7,11,20,0);
  const t=q.temperatuurTrend(trendFixture(tz,nu,vanaf,10,19,i=>19),nu);
  assert.equal(t.genoeg,true);assert(t.puntTijd.endsWith("T20:00"));assert.equal(t.richting,"gelijk");
}

/* Kandy heeft een halfuurs-offset. Bij exact 02:30 is 02:00/03:00 even ver;
   de tie-break kiest het latere echte modelpunt, niet een synthetische 02:30. */
{
  const tz="Asia/Colombo",nu=Date.UTC(2026,7,11,18,0),vanaf=Date.UTC(2026,7,11,17,30);
  const t=q.temperatuurTrend(trendFixture(tz,nu,vanaf,10,24,i=>24-i),nu);
  assert.equal(t.genoeg,true);assert(t.puntTijd.endsWith("T03:00"));assert.equal(t.afwijkingMin,30);
}

/* Sydney: kalendergrens en zuidelijk halfrond hebben dezelfde tijdslogica. */
{
  const tz="Australia/Sydney",nu=Date.UTC(2026,7,11,13,17),vanaf=Date.UTC(2026,7,11,12,0);
  const t=q.temperatuurTrend(trendFixture(tz,nu,vanaf,10,14,i=>14+i),nu);
  assert.equal(t.genoeg,true);assert(t.puntTijd.endsWith("T02:00"));assert.equal(t.afwijkingMin,17);
}

/* Europese najaarsomslag: 02:00 komt tweemaal voor. Beide lokale klokteksten
   moeten naar twee verschillende, opeenvolgende instants worden gekoppeld. */
{
  const tz="Europe/Amsterdam",vanaf=Date.UTC(2026,9,24,22,0),h=reeks(vanaf,8,tz),inst=q.uurInstants(h.time,tz,3600);
  const dubbele=h.time.reduce((a,t,i)=>{if(t.endsWith("T02:00"))a.push(i);return a;},[]);
  assert.equal(dubbele.length,2);assert.equal(inst[dubbele[1]]-inst[dubbele[0]],3600000);
  const nu=Date.UTC(2026,9,24,23,17),t=q.temperatuurTrend({timezone:tz,current:{temperature_2m:12},hourly:h},nu);
  assert.equal(t.genoeg,true);assert(t.puntTijd.endsWith("T03:00"));
}

/* Europese voorjaarssprong: het niet-bestaande 02:00-uur wordt niet verzonnen. */
{
  const tz="Europe/Amsterdam",vanaf=Date.UTC(2026,2,28,22,0),h=reeks(vanaf,8,tz),nu=Date.UTC(2026,2,28,23,17);
  assert(!h.time.some(t=>t.endsWith("T02:00")));
  const t=q.temperatuurTrend({timezone:tz,current:{temperature_2m:8},hourly:h},nu);
  assert.equal(t.genoeg,true);assert(t.puntTijd.endsWith("T04:00"));
}

/* New York najaarsomslag: ook het Amerikaanse dubbele 01:00-uur blijft twee
   afzonderlijke forecastinstants. */
{
  const tz="America/New_York",vanaf=Date.UTC(2026,10,1,3,0),h=reeks(vanaf,8,tz),inst=q.uurInstants(h.time,tz,-18000);
  const dubbele=h.time.reduce((a,t,i)=>{if(t.endsWith("T01:00"))a.push(i);return a;},[]);
  assert.equal(dubbele.length,2);assert.equal(inst[dubbele[1]]-inst[dubbele[0]],3600000);
  const nu=Date.UTC(2026,10,1,4,17),t=q.temperatuurTrend({timezone:tz,current:{temperature_2m:10},hourly:h},nu);
  assert.equal(t.genoeg,true);assert(t.puntTijd.endsWith("T02:00"));
}

assert.equal(q.temperatuurTrend({timezone:"Europe/Amsterdam",current:{temperature_2m:null},hourly:{time:["2026-08-11T12:00"],temperature_2m:[18]}},Date.UTC(2026,7,11,10)).genoeg,false,"null current mag geen 0 °C worden");
assert.equal(q.temperatuurTrend({timezone:"Europe/Amsterdam",current:{temperature_2m:18},hourly:{time:["2026-08-11T18:00"],temperature_2m:[20]}},Date.UTC(2026,7,11,10)).genoeg,false,"te ver verwijderd modelpunt wordt niet als +3 uur gepresenteerd");

assert.equal(q.cacheSleutel(52.367612,4.9041),"52.368,4.904");
assert.equal(q.cacheIsVers({op:1000},1000+q.CACHE_VERS_MS),true);
assert.equal(q.cacheIsVers({op:1000},1001+q.CACHE_VERS_MS),false);
assert.equal(q.cacheIsDirectBruikbaar({op:1000},1000+q.CACHE_DIRECT_MS),true,"cache mag tot de directe tussenweergavegrens onmiddellijk tekenen");
assert.equal(q.cacheIsDirectBruikbaar({op:1000},1001+q.CACHE_DIRECT_MS),false,"ouder dan de tussenweergavegrens wacht op actuele netwerkdata");
const gesnoeid=q.cacheSnoei({a:{op:1},b:{op:2},c:{op:3},d:{op:4},e:{op:5},f:{op:6},g:{op:7},h:{op:8},i:{op:9}});
assert.deepEqual(Object.keys(gesnoeid),["i","h","g","f","e","d","c","b"],"cache volgt de acht mogelijke bewaarde plaatsen");

console.log("Checkpoint 25%: temperatuurtrend, neerslagsemantiek en performancecache geslaagd.");

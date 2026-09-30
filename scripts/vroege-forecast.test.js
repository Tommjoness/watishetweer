"use strict";

/* Vroege weeraanvraag (eigenaar, 30 september 2026: "hoe komt het dat data soms
   traag is"). De bootstrap vraagt de volledige verwachting al aan terwijl de app
   nog laadt; de app neemt dat antwoord alleen over voor exact hetzelfde adres.
   Deze test controleert beide kanten zonder netwerk. */

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vroegeForecastBron,forecastAdresCode,standaardPlaats}=require("./vroege-forecast.js");

const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");

/* 1. De adresopbouw wordt letterlijk uit load() overgenomen. */
const code=forecastAdresCode(html);
assert(code.startsWith('const basis="https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon'),"adresopbouw begint niet bij const basis");
assert(/\n  const f=basis\+"&minutely_15=/.test(code),"volledige forecast (const f) ontbreekt in de overgenomen code");
assert(!code.includes("const fmin="),"de lichte fallback hoort niet in de vroege aanvraag");
assert.throws(()=>forecastAdresCode(html.replace('const basis="https://api.open-meteo.com','const basis2="https://api.open-meteo.com')),/exact één forecast-adresopbouw/,"ontbrekende adresopbouw moet de build laten falen");
const bron=vroegeForecastBron(html);

/* Het adres dat de app zelf bouwt, met dezelfde code. */
const appAdres=(lat,lon)=>vm.runInNewContext(`(function(lat,lon){\n${code}\nreturn f;})`)(lat,lon);

function draaiBootstrap({zoek="",route=null,opslag=null,klaar=false}={}){
  const aanvragen=[];
  const document={getElementById:id=>id==="weather-now-route"&&route!==null?{textContent:JSON.stringify(route)}:null};
  const localStorage={getItem:k=>k==="weerbriefing.plaats"&&opslag!==null?JSON.stringify(opslag):null};
  const window={__WEATHERNOW_APP_READY__:klaar};
  const context={window,document,localStorage,location:{search:zoek},URLSearchParams,JSON,Number,parseFloat,isNaN,Date,
    fetch:url=>{aanvragen.push(url);return Promise.resolve({ok:true});}};
  vm.runInNewContext(bron,context);
  return {aanvragen,vroeg:window.__WEATHERNOW_VROEGE_FORECAST__};
}

/* 2. Plaatskeuze gelijk aan de app-start. */
let r=draaiBootstrap({route:{lat:52.3508,lon:5.2647,name:"Almere",country:"NL"},zoek:"?lat=1&lon=2"});
assert.deepEqual(r.aanvragen,[appAdres(Number(52.3508),Number(5.2647))],"plaatsroute gaat vóór de link, net als in de app");
r=draaiBootstrap({zoek:"?lat=52.396&lon=5.280&plaats=Almere&land=NL"});
assert.deepEqual(r.aanvragen,[appAdres(parseFloat("52.396"),parseFloat("5.280"))],"gedeelde link: parseFloat zoals de app");
assert(r.aanvragen[0].includes("latitude=52.396&longitude=5.28&"),"coördinaten staan zoals de app ze schrijft");
assert.equal(r.vroeg.url,r.aanvragen[0]);assert.equal(r.vroeg.gebruikt,false);
r=draaiBootstrap({zoek:"?hier=1",opslag:{lat:52.35,lon:5.265,label:"Almere"}});
assert.deepEqual(r.aanvragen,[],"?hier=1 wacht op gps; geen vroege aanvraag");
r=draaiBootstrap({opslag:{lat:52.35,lon:5.265,label:"Almere",land:"NL"}});
assert.deepEqual(r.aanvragen,[appAdres(52.35,5.265)],"laatst gekozen plaats zoals ls.get() hem teruggeeft");
r=draaiBootstrap({});
assert.deepEqual(r.aanvragen,[],"zonder standaardplaats in de runtime: geen aanvraag bij een eerste bezoek");
/* De finale runtime laadt bij een eerste bezoek een vaste standaardplaats. */
const finaleStart='  // D. eerste bezoek: Amsterdam is de neutrale standaardlocatie. Er wordt\n  //    geen gps-toestemming gevraagd.\n  q.value="Amsterdam";\n  load(52.3676,4.9041,"Amsterdam",false,true,"NL");\n';
assert.deepEqual(standaardPlaats(html+finaleStart),{lat:52.3676,lon:4.9041},"standaardplaats wordt letterlijk uit het eerste-bezoekpad gelezen");
assert.equal(standaardPlaats(html),null);
{
  const bronMet=vroegeForecastBron(html+finaleStart),aanvragen=[];
  const ctx={window:{},document:{getElementById:()=>null},localStorage:{getItem:()=>null},location:{search:""},URLSearchParams,JSON,Number,parseFloat,isNaN,Date,fetch:u=>{aanvragen.push(u);return Promise.resolve({ok:true});}};
  vm.runInNewContext(bronMet,ctx);
  assert.deepEqual(aanvragen,[appAdres(52.3676,4.9041)],"eerste bezoek: vroege aanvraag voor de standaardplaats, zoals de app");
  const ctx2={...ctx,window:{},location:{search:"?hier=1"}},aanvragen2=[];ctx2.fetch=u=>{aanvragen2.push(u);return Promise.resolve({ok:true});};
  vm.runInNewContext(bronMet,ctx2);
  assert.deepEqual(aanvragen2,[],"?hier=1 blijft wachten op gps, ook met standaardplaats");
}
r=draaiBootstrap({route:{lat:"x",lon:5,name:"Kapot"},zoek:""});
assert.deepEqual(r.aanvragen,[],"ongeldige route zonder andere plaats: geen aanvraag");
r=draaiBootstrap({zoek:"?lat=52.396&lon=5.280",klaar:true});
assert.deepEqual(r.aanvragen,[],"app al gestart: geen dubbele aanvraag");

/* 3. De app neemt het antwoord alleen over voor exact hetzelfde adres, één keer
      en binnen een minuut; afbreken en time-out werken zoals bij fetch. */
function blok(start,eind){const a=html.indexOf(start),b=html.indexOf(eind,a);assert(a>=0&&b>a,"blok niet gevonden: "+start);return html.slice(a,b);}
const appCode=blok("function weatherNowNeemVroegeForecast(url){","\nconst WEATHER_NOW_UURVELDEN=");
async function appScenario(opzet){
  const opgehaald=[];
  const window={__WEATHERNOW_VROEGE_FORECAST__:opzet.vroeg||null};
  const context={window,Date,Number,Promise,AbortController,DOMException,setTimeout,clearTimeout,
    fetch:async(url,o)=>{opgehaald.push(url);return {ok:true,json:async()=>({bron:"fetch"})};}};
  vm.runInNewContext(appCode+"\nthis.j=j;",context);
  return {context,opgehaald,window};
}
const U="https://api.open-meteo.com/v1/forecast?latitude=52.35&longitude=5.265";
(async()=>{
  let s=await appScenario({vroeg:{url:U,op:Date.now(),gebruikt:false,respons:Promise.resolve({ok:true,json:async()=>({bron:"vroeg"})})}});
  assert.deepEqual(await s.context.j(U,{timeoutMs:1000}),{bron:"vroeg"},"zelfde adres: vroeg antwoord gebruikt");
  assert.deepEqual(s.opgehaald,[],"geen tweede aanvraag");
  assert.deepEqual(await s.context.j(U,{timeoutMs:1000}),{bron:"fetch"},"tweede keer (verversen) haalt gewoon opnieuw op");
  assert.equal(s.opgehaald.length,1);

  s=await appScenario({vroeg:{url:U+"&x=1",op:Date.now(),gebruikt:false,respons:Promise.resolve({ok:true,json:async()=>({bron:"vroeg"})})}});
  assert.deepEqual(await s.context.j(U,{timeoutMs:1000}),{bron:"fetch"},"ander adres: vroeg antwoord genegeerd");

  s=await appScenario({vroeg:{url:U,op:Date.now()-61000,gebruikt:false,respons:Promise.resolve({ok:true,json:async()=>({bron:"vroeg"})})}});
  assert.deepEqual(await s.context.j(U,{timeoutMs:1000}),{bron:"fetch"},"ouder dan een minuut: niet gebruikt");

  s=await appScenario({vroeg:{url:U,op:Date.now(),gebruikt:false,respons:Promise.resolve(null)}});
  assert.deepEqual(await s.context.j(U,{timeoutMs:1000}),{bron:"fetch"},"mislukte vroege aanvraag: app haalt zelf op");

  s=await appScenario({vroeg:{url:U,op:Date.now(),gebruikt:false,respons:Promise.resolve({ok:false,status:503,json:async()=>({})})}});
  await assert.rejects(()=>s.context.j(U,{timeoutMs:1000}),/status 503/,"foutstatus van de vroege aanvraag gedraagt zich als een gewone foutstatus (fallback neemt over)");

  s=await appScenario({vroeg:{url:U,op:Date.now(),gebruikt:false,respons:new Promise(()=>{})}});
  await assert.rejects(()=>s.context.j(U,{timeoutMs:30}),e=>e&&e.name==="AbortError","hangende vroege aanvraag valt onder dezelfde time-out");
  const ctl=new AbortController();
  s=await appScenario({vroeg:{url:U,op:Date.now(),gebruikt:false,respons:new Promise(()=>{})}});
  const belofte=s.context.j(U,{timeoutMs:5000,signal:ctl.signal});ctl.abort();
  await assert.rejects(()=>belofte,e=>e&&e.name==="AbortError","afbreken (nieuwe plaats gekozen) werkt ook tijdens de vroege aanvraag");

  console.log("Vroege weeraanvraag: adres letterlijk uit load(), plaatskeuze gelijk aan de app-start, overname alleen bij exact hetzelfde adres (één keer, binnen een minuut), time-out en afbreken ongewijzigd.");
})().catch(e=>{console.error(e);process.exit(1);});

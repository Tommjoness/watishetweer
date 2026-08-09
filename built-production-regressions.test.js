"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {laadKern}=require("./kern.js");
const {bouw}=require("./data.js");

let geslaagd=0;
function ok(voorwaarde,naam,extra){
  assert.ok(voorwaarde,naam+(extra?" -> "+extra:""));
  geslaagd++;
  console.log("OK  "+naam);
}
function norm(t){return String(t==null?"":t).replace(/\u00a0/g," ");}
function tekst(el){return norm(el&&((el.textContent||el.innerHTML)||"")).replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();}
function zetBasis(api,d,extra){
  const i=d.hourly.time.findIndex(t=>t.slice(0,13)===d.current.time.slice(0,13));
  Object.assign(api.S,{d,i0:i,op:Date.now(),lat:52.35,lon:5.26,label:"Productietest",dag:null,bereik:24,
    klokOverride:new Date("2026-07-22T12:00:00Z")},extra||{});
  return i;
}

/* 1. Geldige actuele neerslag en dagsom blijven zichtbaar. */
{
  const {api,bak}=laadKern(390); const d=bouw({nu:0.6,som:2.4}); d.current.interval=900; zetBasis(api,d);
  api.meters();
  ok(/0,6/.test(norm(bak.prec.innerHTML)),"actuele neerslag blijft zichtbaar",norm(bak.prec.innerHTML));
  ok(/2,4 mm/.test(tekst(bak.precsub)),"dagelijkse neerslagsom blijft zichtbaar",tekst(bak.precsub));
  ok(!/niet beschikbaar/i.test(tekst(bak.precsub)),"geldige neerslag wordt niet als ontbrekend gemeld",tekst(bak.precsub));
}

/* 2. Lokale kalenderdag wint van een stale current.time. */
{
  const {api,bak}=laadKern(390); const d=bouw({temp:(u,dag)=>dag===1&&u===15?31:18});
  d.current.time="2026-07-22T23:55"; d.current.temperature_2m=18;
  const i=d.hourly.time.findIndex(t=>t==="2026-07-22T23:00");
  Object.assign(api.S,{d,i0:i,op:Date.now(),lat:52.35,lon:5.26,label:"Productietest",dag:null,bereik:24,
    klokOverride:new Date("2026-07-22T22:05:00Z")});
  api.briefing(); const t=tekst(bak.brief);
  ok(/Vandaag wordt het maximaal 31 graden/.test(t),"na lokale middernacht heet de nieuwe dag vandaag",t);
  ok(!/Morgen wordt het maximaal 31 graden/.test(t),"stale current.time houdt morgen niet vast",t);
}

/* 3. Open tabblad ververst op lokale dagwisseling, maar locatiewissel niet. */
{
  const {api,fetchStaat}=laadKern(390); const d=bouw({}); d.current.time="2026-07-22T23:55";
  const i=d.hourly.time.findIndex(t=>t==="2026-07-22T23:00");
  Object.assign(api.S,{d,i0:i,op:Date.now(),lat:52.35,lon:5.26,label:"Productietest",dag:null,bereik:24,
    klokOverride:new Date("2026-07-22T21:55:00Z")});
  api.klokBijwerken(); const voor=fetchStaat.teller;
  api.S.klokOverride=new Date("2026-07-22T22:00:05Z"); api.klokBijwerken();
  ok(fetchStaat.teller>=voor+2,"lokale dagwisseling start automatisch een nieuwe weerfetch","voor="+voor+", na="+fetchStaat.teller);
  const na=fetchStaat.teller; api.S.lat=35.68;api.S.lon=139.76;api.S.d.timezone="Asia/Tokyo";api.S.d.utc_offset_seconds=9*3600;api.klokBijwerken();
  ok(fetchStaat.teller===na,"locatiewissel wordt niet aangezien voor dagwisseling","fetches="+fetchStaat.teller);
}

/* 4. Ontbrekende UV is onbekend, niet laag. */
{
  const {api,bak}=laadKern(390); const d=bouw({}); d.hourly.uv_index=d.hourly.uv_index.map(()=>null); zetBasis(api,d); api.meters();
  ok(/UV-gegevens voor vandaag niet beschikbaar/.test(tekst(bak.uvsub)),"ontbrekende UV-data wordt als onbekend gemeld",tekst(bak.uvsub));
  ok(!/Nauwelijks UV vandaag/.test(tekst(bak.uvsub)),"ontbrekende UV-data wordt niet als lage UV geïnterpreteerd",tekst(bak.uvsub));
}

/* 5. Beaufortgrens: exact 117 km/u is 11 Bft, pas >117 wordt 12. */
{
  const {api}=laadKern(390);
  ok(api.bft(117)===11,"117 km/u blijft 11 Bft","Bft="+api.bft(117));
  ok(api.bft(117.1)===12,"meer dan 117 km/u wordt 12 Bft","Bft="+api.bft(117.1));
}

/* 6. Hoge kans + nulhoeveelheid wordt onzeker genoemd, nooit 'enkele druppels'. */
{
  const {api,bak}=laadKern(390); const d=bouw({pp:()=>80,pr:()=>0,nu:0,som:0});
  d.minutely_15={time:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[]};
  const start=Date.UTC(2026,6,22,14,0);
  for(let k=1;k<=12;k++){
    d.minutely_15.time.push(new Date(start+k*15*60000).toISOString().slice(0,16));d.minutely_15.precipitation.push(0);
    d.minutely_15.rain.push(0);d.minutely_15.showers.push(0);d.minutely_15.snowfall.push(0);d.minutely_15.weather_code.push(3);
  }
  zetBasis(api,d); api.briefing(); const t=tekst(bak.brief);
  ok(/verwachting is daardoor onzeker|hoeveelheid is onzeker/i.test(t),"hoge kans zonder hoeveelheid krijgt onzekerheidszin",t);
  ok(!/hooguit enkele druppels/i.test(t),"hoge kans zonder hoeveelheid verzint geen druppelhoeveelheid",t);
}

/* 7. Daily weather_code (zwaarste conditie) wint van de meest voorkomende uurcode. */
{
  const {api,bak}=laadKern(390); const d=bouw({wc:()=>3}); d.daily.weather_code[0]=95; zetBasis(api,d); api.dagen();
  const inhoud=tekst(bak.days);
  ok(/Onweer/i.test(inhoud),"zwaarste dagconditie blijft zichtbaar in weektabel",inhoud.slice(0,300));
}

/* 8. De standaard 24-uursgrafiek gebruikt 25 momentpunten; gekozen kalenderdag 24. */
{
  const {api}=laadKern(390); const d=bouw({}); const i=zetBasis(api,d);
  api.etmaal(i,24); ok(api.S.geo&&api.S.geo.n===25,"komende 24 uur beslaat 25 grenspunten","n="+(api.S.geo&&api.S.geo.n));
  api.S.dag=0; api.etmaal(i,24); ok(api.S.geo&&api.S.geo.n===24,"gekozen kalenderdag blijft 24 uurpunten","n="+(api.S.geo&&api.S.geo.n));
}

/* 9. DST: IANA-zone bepaalt de klok, ook als gecachte vaste offset achterloopt. */
{
  const {api}=laadKern(390); const d=bouw({}); d.timezone="Europe/Amsterdam"; d.utc_offset_seconds=7200; zetBasis(api,d);
  api.S.klokOverride=new Date("2026-10-25T02:30:00Z");
  ok(api.plaatsKlok()==="03:30","plaatsklok volgt wintertijd via IANA-zone ondanks stale +02 offset",api.plaatsKlok());
}

/* 10. Kwartiermodel krijgt geen schijnprecisie in tekst: 14:15 wordt rond 14:30. */
{
  const {api,bak}=laadKern(390); const d=bouw({pp:()=>75,pr:()=>0});
  d.current.time="2026-07-22T14:00"; d.minutely_15={time:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[]};
  const start=Date.UTC(2026,6,22,14,0);
  for(let k=1;k<=12;k++){
    const nat=k===1?0.2:0;d.minutely_15.time.push(new Date(start+k*15*60000).toISOString().slice(0,16));
    d.minutely_15.precipitation.push(nat);d.minutely_15.rain.push(nat);d.minutely_15.showers.push(0);d.minutely_15.snowfall.push(0);d.minutely_15.weather_code.push(nat?61:3);
  }
  zetBasis(api,d); api.briefing(); const t=tekst(bak.brief);
  ok(/rond 14:30/.test(t),"kwartieronset wordt voorzichtig op half uur gecommuniceerd",t);
  ok(!/14:15/.test(t),"geïnterpoleerde kwartierdata wordt niet als exact kwartier geclaimd",t);
}

/* 11. Recente neerslag heet modelwaarde, niet meting. */
{
  const {api,bak}=laadKern(390); const d=bouw({nu:0,som:0}); d.current.interval=900; zetBasis(api,d); api.meters(); const t=tekst(bak.precsub);
  ok(/Volgens het model/.test(t),"recente neerslag wordt als modelinformatie benoemd",t);
  ok(!/gemeten/i.test(t),"recente modeldata wordt niet als meting gepresenteerd",t);
}

/* 12. Current visibility heeft voorrang op de uurwaarde. */
{
  const {api,bak}=laadKern(390); const d=bouw({zicht:20000}); d.current.visibility=1234; zetBasis(api,d); api.meters();
  ok(/1,2/.test(norm(bak.vis.innerHTML)),"actueel zicht gebruikt current visibility",norm(bak.vis.innerHTML));
}

/* 13. Druktrend is exact drie uur via interpolatie rond de actuele minuut. */
{
  const {api,bak}=laadKern(390); const d=bouw({}); const i=zetBasis(api,d);
  d.current.pressure_msl=1010; d.hourly.pressure_msl[i-3]=1000; d.hourly.pressure_msl[i-2]=1004;
  api.S.klokOverride=new Date("2026-07-22T12:30:00Z"); api.meters(); const t=tekst(bak.pressub);
  ok(/8,0 hPa gestegen/.test(t),"druktrend interpoleert naar exact drie uur geleden",t);
  ok(/afgelopen drie uur/.test(t),"druktrend benoemt het werkelijke venster",t);
}

/* 14. Windstoten krijgen uurvaksemantiek. */
{
  const {api,bak}=laadKern(390); const d=bouw({wg:(u,dag)=>dag===0&&u===18?72:25}); zetBasis(api,d); api.meters(); const t=tekst(bak.gustsub);
  ok(/uur 17:00–18:00/.test(t),"windstootpiek wordt als voorafgaand uurvak getoond",t);
  ok(!/rond 18:00/.test(t),"windstootpiek wordt niet als exact tijdstip geclaimd",t);
}

/* 15. Nachtzicht noemt zichzelf expliciet modelscore/modelvenster. */
{
  const {api,bak}=laadKern(390); const d=bouw({}); zetBasis(api,d); api.nachten(); const t=tekst(bak.nights);
  ok(/Modelscore 0-10/.test(t),"nachtzichtscore is als modelscore gelabeld",t.slice(0,300));
  ok(/Modelvenster \(bewolking en maan\)/.test(t),"nachtzichtvenster noemt beperkte factoren",t.slice(0,300));
}

/* 16. Een null in een positieve temperatuurreeks wordt nooit het globale 0°C-extreem. */
{
  const {api,bak}=laadKern(390); const d=bouw({temp:(u,dag)=>10+u/10}); const i=zetBasis(api,d); d.hourly.temperature_2m[i+5]=null; api.etmaal(i,24);
  ok(!/>0°<\/text>/.test(bak.chart.innerHTML),"null wordt niet als kunstmatig 0°C-extreem gelabeld",bak.chart.innerHTML.slice(0,200));
}

/* 17. Zoekcode heeft generatie-token + volledige combobox-keyboardstatus. */
{
  const html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
  ok(/zoekGeneratie/.test(html)&&/generatie!==zoekGeneratie/.test(html),"oude zoekresponses kunnen nieuwere resultaten niet overschrijven");
  ok(/ArrowDown/.test(html)&&/ArrowUp/.test(html)&&/aria-activedescendant/.test(html)&&/aria-selected/.test(html),"zoeken ondersteunt toetsenbord en actieve optie");
}

/* 18. Buildarchitectuur: geen muterende post-build-'test' meer. */
{
  const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,"package.json"),"utf8"));
  const build=fs.readFileSync(path.join(__dirname,"build-weather.js"),"utf8");
  ok(!String(pkg.scripts.build).includes("post-build-hardening"),"productiecode wordt niet meer door een post-build-test herschreven");
  ok(/require\("\.\/productie-hardening\.js"\)/.test(build)&&/html=pasToe\(html\)/.test(build),"senior-hardening is onderdeel van één expliciete buildcompiler");
}

console.log("Gebouwde senior productie-regressies: "+geslaagd+" controles geslaagd.");

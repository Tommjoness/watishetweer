"use strict";

const assert=require("assert"),fs=require("fs"),path=require("path");
const {laadKern}=require("./kern.js"),{bouw}=require("./data.js");
let geslaagd=0;
function ok(v,n,e){assert.ok(v,n+(e?" -> "+e:""));geslaagd++;console.log("OK  "+n);}
const norm=t=>String(t==null?"":t).replace(/\u00a0/g," ");
const tekst=el=>norm(el&&((el.textContent||el.innerHTML)||"")).replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();
function zetBasis(api,d,extra){const i=d.hourly.time.findIndex(t=>t.slice(0,13)===d.current.time.slice(0,13));Object.assign(api.S,{d,i0:i,op:Date.now(),lat:52.35,lon:5.26,label:"Productietest",dag:null,bereik:24,klokOverride:new Date("2026-07-22T12:00:00Z"),klokInstantOverride:null},extra||{});return i;}

{
 const {api,bak}=laadKern(390),d=bouw({nu:0.6,som:2.4});d.current.interval=900;zetBasis(api,d);api.meters();
 ok(/0,6/.test(norm(bak.prec.innerHTML)),"actuele neerslag blijft zichtbaar",norm(bak.prec.innerHTML));
 ok(!/2,4 mm/.test(tekst(bak.precsub)),"recente neerslagtegel mengt geen dagsom in het korte tijdvak",tekst(bak.precsub));
 ok(!/niet beschikbaar/i.test(tekst(bak.precsub)),"geldige neerslag wordt niet als ontbrekend gemeld",tekst(bak.precsub));
}
{
 const {api,bak}=laadKern(390),d=bouw({temp:(u,dag)=>dag===1&&u===15?31:18});d.current.time="2026-07-22T23:55";d.current.temperature_2m=18;
 const i=d.hourly.time.findIndex(t=>t==="2026-07-22T23:00");Object.assign(api.S,{d,i0:i,op:Date.now(),lat:52.35,lon:5.26,label:"Productietest",dag:null,bereik:24,klokOverride:new Date("2026-07-22T22:05:00Z"),klokInstantOverride:null});
 api.briefing();const t=tekst(bak.brief);ok(/Vandaag wordt het maximaal 31 graden/.test(t),"na lokale middernacht heet de nieuwe dag vandaag",t);ok(!/Morgen wordt het maximaal 31 graden/.test(t),"stale current.time houdt morgen niet vast",t);
}
{
 const {api,bak}=laadKern(390),d=bouw({temp:(u,dag)=>dag===0&&u===17?35:dag===1&&u===14?36:33});
 d.current.time="2026-07-22T14:00";d.current.temperature_2m=33;d.daily.temperature_2m_max[0]=35;d.daily.temperature_2m_max[1]=38;
 const i=d.hourly.time.indexOf("2026-07-22T14:00");Object.assign(api.S,{d,i0:i,op:Date.now(),lat:40.42,lon:-3.70,label:"Madrid",dag:null,bereik:24,klokOverride:new Date("2026-07-22T12:02:00Z"),klokInstantOverride:null});
 api.briefing();const t=tekst(bak.brief);
 ok(/Vandaag wordt het maximaal 35 graden/.test(t),"om 14:02 blijft de briefing bij de resterende huidige dag",t);
 ok(!/Morgen wordt het maximaal/.test(t),"om 14:02 loopt de briefing niet vooruit op morgen",t);
}
{
 const {api,bak}=laadKern(390),d=bouw({temp:(u,dag)=>dag===1&&u===22?38:dag===1&&u===14?35:29});
 d.current.time="2026-07-22T19:00";d.current.temperature_2m=29;d.daily.temperature_2m_max[1]=38;
 const i=d.hourly.time.indexOf("2026-07-22T19:00");Object.assign(api.S,{d,i0:i,op:Date.now(),lat:40.42,lon:-3.70,label:"Madrid",dag:null,bereik:24,klokOverride:new Date("2026-07-22T17:05:00Z"),klokInstantOverride:null});
 api.briefing();const t=tekst(bak.brief);
 ok(/Morgen wordt het maximaal 38 graden/.test(t),"in de avond gebruikt morgen het volledige kalenderdagmaximum",t);
 ok(/rond 22:00/.test(t),"het warme moment van morgen wordt op diezelfde kalenderdag gezocht",t);
}
{
 const {api,fetchStaat}=laadKern(390),d=bouw({});d.current.time="2026-07-22T23:55";const i=d.hourly.time.findIndex(t=>t==="2026-07-22T23:00");
 Object.assign(api.S,{d,i0:i,op:Date.now(),lat:52.35,lon:5.26,label:"Productietest",dag:null,bereik:24,klokOverride:new Date("2026-07-22T21:55:00Z"),klokInstantOverride:null});api.klokBijwerken();const voor=fetchStaat.teller;
 api.S.klokOverride=new Date("2026-07-22T22:00:05Z");api.klokBijwerken();ok(fetchStaat.teller>=voor+2,"lokale dagwisseling start automatisch een nieuwe weerfetch","voor="+voor+", na="+fetchStaat.teller);
 const na=fetchStaat.teller;api.S.lat=35.68;api.S.lon=139.76;api.S.d.timezone="Asia/Tokyo";api.S.d.utc_offset_seconds=9*3600;api.klokBijwerken();ok(fetchStaat.teller===na,"locatiewissel wordt niet aangezien voor dagwisseling","fetches="+fetchStaat.teller);
}
{
 const {api,bak}=laadKern(390),d=bouw({});d.hourly.uv_index=d.hourly.uv_index.map(()=>null);zetBasis(api,d);api.meters();ok(/UV-gegevens voor vandaag niet beschikbaar/.test(tekst(bak.uvsub)),"ontbrekende UV-data wordt als onbekend gemeld",tekst(bak.uvsub));ok(!/Nauwelijks UV vandaag/.test(tekst(bak.uvsub)),"ontbrekende UV-data wordt niet als lage UV geïnterpreteerd",tekst(bak.uvsub));
}
{
 const {api}=laadKern(390);ok(api.bft(117)===11,"117 km/u blijft 11 Bft","Bft="+api.bft(117));ok(api.bft(117.1)===12,"meer dan 117 km/u wordt 12 Bft","Bft="+api.bft(117.1));
}
{
 const {api,bak}=laadKern(390),d=bouw({pp:()=>80,pr:()=>0,nu:0,som:0});d.minutely_15={time:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[]};const start=Date.UTC(2026,6,22,14,0);
 for(let k=1;k<=12;k++){d.minutely_15.time.push(new Date(start+k*15*60000).toISOString().slice(0,16));d.minutely_15.precipitation.push(0);d.minutely_15.rain.push(0);d.minutely_15.showers.push(0);d.minutely_15.snowfall.push(0);d.minutely_15.weather_code.push(3);}zetBasis(api,d);api.briefing();const t=tekst(bak.brief);
 ok(/verwachting is daardoor onzeker|hoeveelheid (?:is )?onzeker/i.test(t),"hoge kans zonder hoeveelheid krijgt onzekerheidszin",t);ok(!/hooguit enkele druppels/i.test(t),"hoge kans zonder hoeveelheid verzint geen druppelhoeveelheid",t);
}
{
 const html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
 ok(html.includes("const isResterendVandaag=")&&html.includes("zwaarsteCode(codes)??dagCode"),"gebouwde daginterpretatie gebruikt voor vandaag uitsluitend het resterende weerbeeld");
}
{
 const {api}=laadKern(390),d=bouw({}),i=zetBasis(api,d);
 api.etmaal(i,24);
 ok(api.S.geo&&api.S.geo.n===25,"komende 24 uur beslaat 25 grenspunten","n="+(api.S.geo&&api.S.geo.n));
 api.S.dag=0;
 const dagStart=d.hourly.time.findIndex(t=>t.slice(0,10)===d.daily.time[0]);
 d.hourly.precipitation_probability[dagStart]=99;
 d.hourly.precipitation_probability[dagStart+24]=88;
 d.hourly.precipitation[dagStart]=9;
 d.hourly.precipitation[dagStart+24]=8;
 api.etmaal(dagStart,24);
 ok(api.S.geo&&api.S.geo.n===25,"gekozen kalenderdag beslaat 00:00 tot volgende 00:00 met 25 grenspunten","n="+(api.S.geo&&api.S.geo.n));
 ok(api.S.geo&&api.S.geo.TI[0].endsWith("T00:00")&&api.S.geo.TI[24].endsWith("T00:00")&&api.S.geo.TI[0].slice(0,10)!==api.S.geo.TI[24].slice(0,10),"kalenderdag bevat de rechtergrens van de volgende dag",(api.S.geo&&api.S.geo.TI||[]).join(","));
 ok(api.S.geo&&api.S.geo.P[0]===null,"00:00 links neemt het neerslaginterval van de vorige dag niet mee","P0="+(api.S.geo&&api.S.geo.P[0]));
 ok(api.S.geo&&api.S.geo.P[24]===88,"volgende 00:00 bewaart het laatste interval 23:00–00:00 van de gekozen dag","P24="+(api.S.geo&&api.S.geo.P[24]));
}
{
 const {api}=laadKern(390),d=bouw({});d.timezone="Europe/Amsterdam";d.utc_offset_seconds=7200;zetBasis(api,d);api.S.klokOverride=null;api.S.klokInstantOverride=new Date("2026-10-25T02:30:00Z");ok(api.plaatsKlok()==="03:30","plaatsklok volgt wintertijd via IANA-zone ondanks stale +02 offset",api.plaatsKlok());
}
{
 const {api,bak}=laadKern(390),d=bouw({pp:()=>75,pr:()=>0});d.current.time="2026-07-22T14:00";d.minutely_15={time:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[]};const start=Date.UTC(2026,6,22,14,0);
 for(let k=1;k<=12;k++){const nat=k===1?0.2:0;d.minutely_15.time.push(new Date(start+k*15*60000).toISOString().slice(0,16));d.minutely_15.precipitation.push(nat);d.minutely_15.rain.push(nat);d.minutely_15.showers.push(0);d.minutely_15.snowfall.push(0);d.minutely_15.weather_code.push(nat?61:3);}zetBasis(api,d);api.briefing();const t=tekst(bak.brief);
 ok(/grote kans op neerslag/i.test(t)&&!/wordt .*verwacht/i.test(t),"kwartierdata houdt hoge kans als kans en maakt geen stellige onset",t);ok(!/14:15|rond 14:00/.test(t),"korte briefing claimt geen precieze kwartieronset",t);
}
{
 const {api,bak}=laadKern(390),d=bouw({nu:0,som:0});d.current.interval=900;zetBasis(api,d);api.meters();const t=tekst(bak.precsub);ok(/^Geen neerslag.$/.test(t),"droge recente neerslag gebruikt korte consumententaal",t);ok(!/gemeten|gemodelleerd|model/i.test(t),"droge tegel toont geen technische bronterminologie",t);
}
{
 const {api,bak}=laadKern(390),d=bouw({zicht:20000});d.current.visibility=1234;zetBasis(api,d);api.meters();ok(/1,2/.test(norm(bak.vis.innerHTML)),"actueel zicht gebruikt current visibility",norm(bak.vis.innerHTML));
}
{
 const {api,bak}=laadKern(390),d=bouw({}),i=zetBasis(api,d);d.current.pressure_msl=1010;d.hourly.pressure_msl[i-3]=1000;d.hourly.pressure_msl[i-2]=1004;api.S.klokOverride=new Date("2026-07-22T12:30:00Z");api.meters();const t=tekst(bak.pressub);ok(/8,0 hPa gestegen/.test(t),"druktrend interpoleert naar exact drie uur geleden",t);ok(/afgelopen drie uur/.test(t),"druktrend benoemt het werkelijke venster",t);
}
{
 const {api,bak}=laadKern(390),d=bouw({wg:(u,dag)=>dag===0&&u===18?72:25});zetBasis(api,d);api.meters();const t=tekst(bak.gustsub);ok(/tussen 17:00 en 18:00/.test(t),"windstootpiek wordt als begrijpelijk uurvak getoond",t);ok(!/rond 18:00/.test(t),"windstootpiek wordt niet als exact tijdstip geclaimd",t);
}
{
 const {api,bak}=laadKern(390),d=bouw({zicht:20000});d.current.visibility=20000;zetBasis(api,d);api.nachten();const t=tekst(bak.nights);ok(/Score/.test(t)&&/\d+\/10/.test(t),"nachtzichtscore is compact en begrijpelijk gelabeld",t.slice(0,300));ok(/Beste zichtperiode/.test(t),"nachtzicht benoemt de beste zichtperiode consumentgericht",t.slice(0,300));
}
{
 const {api,bak}=laadKern(390),d=bouw({zicht:100,cc:()=>0,rh:100,spreiding:0,pr:()=>0,wc:()=>3});
 d.current.time="2026-07-23T00:30";d.current.is_day=0;d.current.visibility=100;d.current.cloud_cover=0;d.current.relative_humidity_2m=100;d.current.precipitation=0;d.current.weather_code=3;
 const i=zetBasis(api,d);api.S.i0=i;api.S.klokOverride=null;api.S.klokInstantOverride=new Date("2026-07-22T22:30:00Z");api.nachten();const t=tekst(bak.nights);
 ok(/vannacht/i.test(t),"na middernacht blijft de lopende nacht de eerste Nachtzicht-rij",t.slice(0,400));
 ok(/Ongunstig/.test(t)&&!/Goed ·/.test(t),"100 meter zicht kan in productie niet als Goed worden beoordeeld",t.slice(0,400));
 ok(/Zicht 0,1 km/.test(t),"Nachtzicht laat slecht zicht expliciet in de beoordeling terugkomen",t.slice(0,400));
}
{
 const {api,bak}=laadKern(390),d=bouw({temp:(u,dag)=>10+u/10}),i=zetBasis(api,d);d.hourly.temperature_2m[i+5]=null;api.etmaal(i,24);ok(!/>0°<\/text>/.test(bak.chart.innerHTML),"null wordt niet als kunstmatig 0°C-extreem gelabeld",bak.chart.innerHTML.slice(0,200));
}
{
 const html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");ok(/zoekGeneratie/.test(html)&&/generatie!==zoekGeneratie/.test(html),"oude zoekresponses kunnen nieuwere resultaten niet overschrijven");ok(/ArrowDown/.test(html)&&/ArrowUp/.test(html)&&/aria-activedescendant/.test(html)&&/aria-selected/.test(html),"zoeken ondersteunt toetsenbord en actieve optie");
}
{
 const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,"package.json"),"utf8")),build=fs.readFileSync(path.join(__dirname,"build-weather.js"),"utf8"),config=fs.readFileSync(path.join(__dirname,"product-config.js"),"utf8");
 ok(!String(pkg.scripts.build).includes("post-build-hardening"),"productiecode wordt niet door een verborgen post-build-test herschreven");
 ok(build.includes('require("./product-config.js")')&&config.includes("EERSTE_BEZOEK_PRODUCTIE")&&config.includes("KALENDERDAG_PUNTEN_PRODUCTIE"),"bewuste productsemantiek staat expliciet in één productconfiguratie");
 ok(build.includes("SENIOR CORRECTHEIDSLAAG")&&build.includes("NEERSLAGKANSBELEID V3"),"inhoudelijke correctheidslagen zijn zichtbaar onderdeel van de deterministische build");
}
console.log("Gebouwde senior productie-regressies: "+geslaagd+" controles geslaagd.");

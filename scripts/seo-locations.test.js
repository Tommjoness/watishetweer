"use strict";

const assert=require("assert");
const {LOCATIES,POPULAIR,plaatsUrl,plaatsTitel,plaatsBeschrijving}=require("./seo-locations.config.js");
const {voegRouteTitelBeleidToe}=require("./generate-seo-location-pages.js");

assert(LOCATIES.length>=30,"SEO-kernset moet minimaal 30 echte Nederlandse plaatsen bevatten");
assert(LOCATIES.length<=60,"SEO-kernset mag niet ongemerkt uitgroeien tot massale thin-page generatie");
assert(new Set(LOCATIES.map(x=>x.slug)).size===LOCATIES.length,"plaats-slugs moeten uniek zijn");
assert(new Set(LOCATIES.map(x=>x.naam.toLowerCase())).size===LOCATIES.length,"plaatsnamen moeten uniek zijn");
for(const loc of LOCATIES){
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(loc.slug),`ongeldige slug: ${loc.slug}`);
  assert(loc.naam&&loc.provincie&&loc.land==="NL",`${loc.slug}: naam/provincie/land ontbreekt`);
  assert(Number.isFinite(loc.lat)&&loc.lat>=50.5&&loc.lat<=53.7,`${loc.slug}: latitude valt buiten Nederland: ${loc.lat}`);
  assert(Number.isFinite(loc.lon)&&loc.lon>=3.2&&loc.lon<=7.3,`${loc.slug}: longitude valt buiten Nederland: ${loc.lon}`);
  const url=plaatsUrl(loc),titel=plaatsTitel(loc),desc=plaatsBeschrijving(loc);
  assert.equal(url,`https://watishetweer.nl/weer/${loc.slug}/`);
  assert(titel.startsWith(`Weer ${loc.naam} vandaag`),`${loc.slug}: titel mist plaats/intentie`);
  assert(titel.length<=70,`${loc.slug}: titel te lang (${titel.length})`);
  assert(desc.includes(loc.naam)&&desc.includes("7-daagse verwachting"),`${loc.slug}: description mist kerninhoud`);
  assert(desc.length>=100&&desc.length<=170,`${loc.slug}: description ongeschikte lengte (${desc.length})`);
}
assert(POPULAIR.length>=8&&POPULAIR.length<=16,"homepage moet een compacte populaire-plaatsenselectie houden");
assert(POPULAIR.every(x=>LOCATIES.includes(x)&&x.populair),"populaire set moet rechtstreeks uit de kernset komen");

/* Het definitieve artifact heeft bewust twee title-writers: de canonieke render
   en de snelle Q1-cache-render. Op een crawlbare plaatsroute moeten beide de
   server-side SEO-titel respecteren; een nieuwe/verdwenen writer moet daarom
   expliciet als contractwijziging worden behandeld. */
const titleWriter='document.title=S.label+" · Wat is het weer?";';
const tweeWriters=`function canoniek(){${titleWriter}}\nfunction cacheKernRender(){${titleWriter}}`;
const routeBewust=voegRouteTitelBeleidToe(tweeWriters,"regressie");
assert.equal((routeBewust.match(/const route=window\.__WEATHERNOW_ROUTE_LOCATION__;/g)||[]).length,2,"beide title-writers moeten route-aware worden");
assert.equal((routeBewust.match(/if\(!zelfdeRoute\) document\.title=S\.label\+" · Wat is het weer\?";/g)||[]).length,2,"beide title-writers moeten alleen buiten dezelfde route de dynamische titel zetten");
assert.throws(()=>voegRouteTitelBeleidToe(`function canoniek(){${titleWriter}}`,"regressie"),/exact 2 title-sync-writers/,"één ontbrekende title-writer moet het buildcontract laten falen");

console.log(`SEO-locatieconfig: ${LOCATIES.length} unieke NL-plaatsen, metadata, compacte populaire set en dubbel title-writercontract geslaagd.`);

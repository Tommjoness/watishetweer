"use strict";

/* Delen: de knop, de gedeelde URL en de deelkaart.
   - De knop staat naast "bewaren" in de plaatsenrij, ook als de plaats al bewaard is.
   - Een plaatsroute deelt haar schone URL; anders gaan coördinaten mee op twee
     decimalen (~1 km), nooit de drie (~100 m) uit de adresbalk.
   - De deelkaart is een echte 1200×630-PNG en alle pagina's verwijzen ernaar. */

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {laadKern}=require("../kern.js");
const {SHARE_IMAGE}=require("./seo-foundation.js");

const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");

/* Knop in de plaatsenrij */
{
  const {api,bak}=laadKern(390);
  Object.assign(api.S,{lat:52.3731,lon:4.8922,label:"Amsterdam",land:"NL"});
  api.chips();
  const deel=bak.chips.querySelector("#chipdeel");
  assert(deel,"Delen ontbreekt in de plaatsenrij");
  assert.equal(deel.textContent,"Delen");
  assert(bak.chips.querySelector("#chipadd"),"bewaren blijft naast Delen staan");

  api.ls.set("weerbriefing.lijst",[{lat:52.3731,lon:4.8922,label:"Amsterdam"}]);
  api.chips();
  assert.equal(bak.chips.querySelector("#chipadd"),null,"een bewaarde plaats toont geen bewaarknop");
  assert(bak.chips.querySelector("#chipdeel"),"Delen blijft beschikbaar als de plaats al bewaard is");
}

/* Gedeelde URL */
function laadDeelUrl(S,route,protocol){
  const m=html.match(/function deelUrl\(\)\{[\s\S]*?\n\}/);
  assert(m,"deelUrl ontbreekt in index.html");
  const ctx={S,URL,Number,window:{__WEATHERNOW_ROUTE_LOCATION__:route},location:{protocol:protocol||"https:",origin:"https://watishetweer.nl"}};
  vm.createContext(ctx);
  vm.runInContext(m[0]+"\nthis.deelUrl=deelUrl;",ctx);
  return ctx.deelUrl();
}
{
  const S={lat:52.37312,lon:4.89224,label:"Amsterdam",land:"NL"};
  const route={slug:"amsterdam",lat:52.37312,lon:4.89224,name:"Amsterdam"};
  assert.equal(laadDeelUrl(S,route),"https://watishetweer.nl/weer/amsterdam/","plaatsroute deelt haar schone URL");

  const eigen=new URL(laadDeelUrl({lat:52.091234,lon:5.121987,label:"Utrecht",land:"NL"},null));
  assert.equal(eigen.origin+eigen.pathname,"https://watishetweer.nl/");
  assert.equal(eigen.searchParams.get("lat"),"52.09","breedtegraad gaat mee op twee decimalen");
  assert.equal(eigen.searchParams.get("lon"),"5.12","lengtegraad gaat mee op twee decimalen");
  assert.equal(eigen.searchParams.get("plaats"),"Utrecht");
  assert.equal(eigen.searchParams.get("land"),"NL");

  const anderePlaats=new URL(laadDeelUrl({lat:51.9225,lon:4.47917,label:"Rotterdam",land:null},route));
  assert.equal(anderePlaats.pathname,"/","een andere plaats op een routepagina deelt niet de route");
  assert.equal(anderePlaats.searchParams.has("land"),false);

  const lokaal=laadDeelUrl({lat:1,lon:2,label:"X",land:null},null,"file:");
  assert(lokaal.startsWith("https://watishetweer.nl/?"),"lokale QA deelt nooit een file://-URL");
}

/* Deelkaart */
{
  const png=fs.readFileSync(path.join(ROOT,"share-card.png"));
  assert.equal(png.slice(1,4).toString("ascii"),"PNG","share-card.png is geen PNG");
  assert.equal(png.readUInt32BE(16),1200,"deelkaart is niet 1200 breed");
  assert.equal(png.readUInt32BE(20),630,"deelkaart is niet 630 hoog");
  assert(png.length<300*1024,"deelkaart is groter dan 300 KB");
  assert.equal(SHARE_IMAGE,"https://watishetweer.nl/share-card.png");
  const over=fs.readFileSync(path.join(ROOT,"over","index.html"),"utf8");
  assert(over.includes('<meta property="og:image" content="https://watishetweer.nl/share-card.png">'),"Over-pagina deelt de kaart");
  assert(fs.readFileSync(path.join(__dirname,"generate-seo-location-pages.js"),"utf8").includes('<meta property="og:image" content="${SHARE_IMAGE}">'),"plaatsenoverzicht deelt de kaart");
}

console.log("Delen OK: knop in de plaatsenrij, schone route-URL of coördinaten op ~1 km, deelkaart 1200×630.");

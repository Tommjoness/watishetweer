"use strict";

const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const {
  CACHE_BRONNEN,
  berekenServiceworkerCacheVersie,
  leesServiceworkerCacheVersie,
  verifieerServiceworkerCache,
  vernieuwServiceworkerCache
}=require("./postbuild-cache.js");

/* Architectuurcontract: build-weather mag niet opnieuw een eigen shelllijst of
   SHA-256-recept invoeren. De eerste build en alle postbuildlagen moeten dezelfde
   helper gebruiken; anders kan één toekomstige assetwijziging twee cache-eigenaars
   uit elkaar laten lopen. */
const buildBron=fs.readFileSync(path.join(__dirname,"..","build-weather.js"),"utf8");
assert(buildBron.includes('require("./scripts/postbuild-cache.js")'),"build-weather moet de gedeelde cachehelper importeren");
assert(buildBron.includes('vernieuwServiceworkerCache(OUT,"build-weather")'),"build-weather moet zijn initiële cache via de gedeelde helper vernieuwen");
assert(!buildBron.includes('crypto.createHash("sha256")'),"build-weather mag geen tweede hashrecept bevatten");
assert(!/const\s+CACHE_BRONNEN\s*=/.test(buildBron),"build-weather mag geen tweede app-shelllijst bevatten");

const OUT=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-cache-"));
try{
  for(const naam of CACHE_BRONNEN){
    const p=path.join(OUT,naam);
    fs.mkdirSync(path.dirname(p),{recursive:true});
    fs.writeFileSync(p,"fixture:"+naam+"\n","utf8");
  }
  fs.writeFileSync(path.join(OUT,"sw.js"),'const CACHE = "watishetweer-v1";\n','utf8');

  const eerste=berekenServiceworkerCacheVersie(OUT,"test");
  assert.match(eerste,/^watishetweer-[0-9a-f]{12}$/);
  assert.equal(vernieuwServiceworkerCache(OUT,"test"),eerste,"legacy cache-id moet naar inhoudshash migreren");
  assert.equal(leesServiceworkerCacheVersie(OUT,"test"),eerste);
  assert.equal(verifieerServiceworkerCache(OUT,"test"),eerste);

  fs.appendFileSync(path.join(OUT,"index.html"),"gewijzigd\n","utf8");
  assert.throws(
    ()=>verifieerServiceworkerCache(OUT,"test"),
    /hoort bij een andere test artifact/,
    "een gewijzigde app-shell mag nooit met een oude serviceworkerhash slagen"
  );

  const tweede=vernieuwServiceworkerCache(OUT,"test");
  assert.notEqual(tweede,eerste,"gewijzigde app-shell moet een nieuwe cache-id krijgen");
  assert.equal(verifieerServiceworkerCache(OUT,"test"),tweede);

  fs.rmSync(path.join(OUT,"icon-192.png"));
  assert.throws(
    ()=>berekenServiceworkerCacheVersie(OUT,"test"),
    /App-shellbestand ontbreekt/,
    "een onvolledige shell mag geen geldige cacheversie krijgen"
  );

  console.log("Postbuild-cachehelper: één eigenaar, berekening, legacy migratie, stale detectie en ontbrekende shell geslaagd.");
}finally{
  fs.rmSync(OUT,{recursive:true,force:true});
}

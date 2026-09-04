"use strict";
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const bron=fs.readFileSync(path.join(__dirname,"global-location-hardening.js"),"utf8")+"\n"+fs.readFileSync(path.join(__dirname,"shared-url-place-identity.js"),"utf8");

async function controleerExpliciet({naam,lat,lon,land,reverseNaam,reverseLand}){
  const calls=[],reverseCalls=[],geocodeCalls=[];
  const state={style:{display:"none"},className:"",textContent:""},q={value:""};
  const query=`?lat=${lat}&lon=${lon}&plaats=${encodeURIComponent(naam)}&land=${land}`;
  const context={
    URL,URLSearchParams,
    location:{search:query,href:"https://watishetweer.nl/"+query},
    document:{getElementById:id=>id==="state"?state:id==="q"?q:null},
    j:async url=>{
      const u=String(url||"");
      if(u.includes("/api/plaatsnaam?")){reverseCalls.push(u);return {naam:reverseNaam,land:reverseLand};}
      if(u.includes("geocoding-api.open-meteo.com")){geocodeCalls.push(u);return {results:[]};}
      return {};
    },
    load:async(...args)=>{calls.push(args);return "geladen";},
    console
  };
  context.globalThis=context;
  vm.runInNewContext(bron,context,{filename:"shared-url-place-trust.runtime.test.js"});
  const uit=await context.load(lat,lon,naam,false,false,land);
  assert.equal(uit,"geladen");
  assert.equal(calls.length,1);
  assert.strictEqual(calls[0][0],Number(lat));
  assert.strictEqual(calls[0][1],Number(lon));
  assert.strictEqual(calls[0][2],naam,`${naam}: expliciete naam mag niet door reverse worden vervangen`);
  assert.strictEqual(calls[0][4],false);
  /* De globale shared-URL-grens blijft land uit de URL wantrouwen; de reverse
     call is uitsluitend de niet-blokkerende metadata-verificatie. */
  assert.strictEqual(calls[0][5],null);
  assert.strictEqual(q.value,naam);
  assert.equal(geocodeCalls.length,0,`${naam}: expliciete naam mag geen blokkerende forward-geocode starten`);
  assert.equal(reverseCalls.length,1,`${naam}: reverse mag alleen metadata op de achtergrond aanvullen`);
}

(async()=>{
  const gevallen=[
    {naam:"Dubai",lat:25.2048,lon:55.2708,land:"AE",reverseNaam:"ديرة",reverseLand:"AE"},
    {naam:"Amsterdam",lat:52.3676,lon:4.9041,land:"NL",reverseNaam:"Centrum",reverseLand:"NL"},
    {naam:"New York",lat:40.7128,lon:-74.0060,land:"US",reverseNaam:"Manhattan",reverseLand:"US"},
    {naam:"São Paulo",lat:-23.5505,lon:-46.6333,land:"BR",reverseNaam:"Sé",reverseLand:"BR"},
    {naam:"München",lat:48.1351,lon:11.5820,land:"DE",reverseNaam:"Altstadt-Lehel",reverseLand:"DE"},
    {naam:"Kathmandu",lat:27.7172,lon:85.3240,land:"NP",reverseNaam:"काठमाडौं महानगरपालिका",reverseLand:"NP"},
    {naam:"Québec",lat:46.8139,lon:-71.2080,land:"CA",reverseNaam:"La Cité-Limoilou",reverseLand:"CA"},
    {naam:"京都",lat:35.0116,lon:135.7681,land:"JP",reverseNaam:"中京区",reverseLand:"JP"},
    {naam:"Springfield",lat:39.7817,lon:-89.6501,land:"US",reverseNaam:"Capital Township",reverseLand:"US"},
    {naam:"Springfield",lat:-27.6531,lon:152.9171,land:"AU",reverseNaam:"Ipswich",reverseLand:"AU"}
  ];
  for(const geval of gevallen)await controleerExpliciet(geval);

  /* Zonder expliciete naam is reverse wél eigenaar van de fallbackidentiteit. */
  const calls=[];const q={value:""},state={style:{},className:"",textContent:""};
  const context={
    URL,URLSearchParams,
    location:{search:"?lat=27.7172&lon=85.3240",href:"https://watishetweer.nl/?lat=27.7172&lon=85.3240"},
    document:{getElementById:id=>id==="q"?q:id==="state"?state:null},
    j:async url=>String(url).includes("/api/plaatsnaam?")?{naam:"काठमाडौं",land:"NP"}:{},
    load:async(...args)=>{calls.push(args);return "geladen";},console
  };
  context.globalThis=context;
  vm.runInNewContext(bron,context,{filename:"shared-url-place-reverse-fallback.runtime.test.js"});
  await context.load(27.7172,85.3240,"Gedeelde locatie",false,false,null);
  assert.strictEqual(calls[0][2],"काठमाडौं");
  assert.strictEqual(q.value,"काठमाडौं");

  console.log("Plaatsidentiteit: expliciete namen zijn autoritatief voor 10 wereld-/schrift-/landgevallen; reverse bezit alleen de naam wanneer expliciete identiteit ontbreekt.");
})().catch(err=>{console.error(err&&err.stack||err);process.exitCode=1;});
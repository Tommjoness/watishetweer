"use strict";
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const h=require("./global-location-hardening.js");

/* Zoekresultaten: identieke GeoNames-id's zijn dezelfde plaats, ook als een
   provider minieme metadata-/coordinatenverschillen terugstuurt. */
const dubbel=[
  {id:123,name:"Ja",admin1:"Janub-Darfur",country_code:"SD",latitude:11.1,longitude:24.2},
  {id:123,name:"Ja",admin1:"Janub-Darfur",country_code:"SD",latitude:11.1001,longitude:24.2001},
  {id:456,name:"Ja",admin1:"Janub-Darfur",country_code:"SD",latitude:11.8,longitude:24.8}
];
assert.equal(h.dedupliceerZoekresultaten(dubbel).length,2,"dezelfde provider-id moet eenmaal worden getoond");

/* Zonder id dedupliceren we alleen bij dezelfde genormaliseerde plaatsmetadata
   én coordinaten. Twee echte plaatsen met dezelfde naam blijven dus bestaan. */
const zonderId=[
  {name:" Né ",admin1:"Ligurië",country_code:"IT",latitude:44.356,longitude:9.388},
  {name:"né",admin1:"Ligurië",country_code:"it",latitude:44.356,longitude:9.388},
  {name:"Né",admin1:"Ligurië",country_code:"IT",latitude:44.456,longitude:9.488}
];
assert.equal(h.dedupliceerZoekresultaten(zonderId).length,2,"gelijke fallback-identiteit dedupliceert, andere coordinaten blijven apart");
assert.deepEqual(h.dedupliceerZoekresultaten(null),[]);

/* Providerdata gaat later als data-lat/data-lon de zoek-UI in. Alleen geldige
   wereldcoördinaten en een niet-lege naam mogen die grens passeren; numerieke
   strings worden bewust naar echte numbers genormaliseerd. */
const extern=[
  {id:1,name:" Geldig ",country_code:"NL",latitude:"52.3676",longitude:"4.9041"},
  {id:2,name:"Attribuutinjectie",country_code:"NL",latitude:'52.1\" onmouseover=\"alert(1)',longitude:5},
  {id:3,name:"Te noordelijk",country_code:"XX",latitude:91,longitude:0},
  {id:4,name:"Te oostelijk",country_code:"XX",latitude:0,longitude:181},
  {id:5,name:"   ",country_code:"NL",latitude:52,longitude:5},
  {id:6,name:"Geen latitude",country_code:"NL",longitude:5}
];
const schoonExtern=h.dedupliceerZoekresultaten(extern);
assert.equal(schoonExtern.length,1,"malforme of onvolledige providerresultaten mogen de UI niet bereiken");
assert.equal(schoonExtern[0].name,"Geldig");
assert.strictEqual(schoonExtern[0].latitude,52.3676);
assert.strictEqual(schoonExtern[0].longitude,4.9041);
assert.equal(h.geldigeCoordinaat(-90,-90,90),-90);
assert.equal(h.geldigeCoordinaat(180,-180,180),180);
assert.equal(h.geldigeCoordinaat("",-90,90),null);
assert.equal(h.geldigeCoordinaat("Infinity",-90,90),null);
assert.equal(h.geldigeCoordinaat("52abc",-90,90),null,"trailing rommel mag niet zoals parseFloat worden afgekapt");
assert.deepEqual(h.normaliseerLaadCoordinaten("52.3676","4.9041"),{latitude:52.3676,longitude:4.9041});
assert.equal(h.normaliseerLaadCoordinaten(91,0),null);
assert.equal(h.normaliseerLaadCoordinaten(0,-181),null);
assert.equal(h.normaliseerLaadCoordinaten(Infinity,0),null);

/* Gedeelde links worden uit de ruwe query gelezen. Aanwezigheid van één van de
   twee parameters maakt het een gedeelde-locatiepoging; beide moeten daarna
   strikt geldig zijn. */
assert.deepEqual(h.gedeeldeUrlCoordinaten("?lat=52.3676&lon=4.9041"),{
  aanwezig:true,geldig:true,latitude:52.3676,longitude:4.9041
});
assert.equal(h.gedeeldeUrlCoordinaten("?lat=52abc&lon=5xyz").geldig,false);
assert.equal(h.gedeeldeUrlCoordinaten("?lat=52.3").geldig,false,"halve gedeelde locatie moet ongeldig zijn");
assert.equal(h.gedeeldeUrlCoordinaten("?hier=1").aanwezig,false,"andere startup-parameters zijn geen gedeelde locatie");

/* Dedupliceren mag de lijst niet onnodig kort maken. De requestlaag vraagt
   daarom twaalf kandidaten en de UI krijgt hoogstens zes unieke resultaten in
   de oorspronkelijke provider-volgorde terug. */
assert(/count=12/.test(h.verruimZoekUrl("https://geocoding-api.open-meteo.com/v1/search?name=ja&count=6&language=nl")));
assert(/count=20/.test(h.verruimZoekUrl("https://geocoding-api.open-meteo.com/v1/search?name=ja&count=20")),"een al ruimer zoekvenster mag niet worden verkleind");
const veel=[];
for(let i=0;i<8;i++){
  veel.push({id:i,name:"Plaats "+i,country_code:"NL",latitude:52+i/100,longitude:5});
  if(i<3)veel.push({id:i,name:"Plaats "+i,country_code:"NL",latitude:52+i/100,longitude:5});
}
assert.deepEqual(h.dedupliceerZoekresultaten(veel,6).map(x=>x.id),[0,1,2,3,4,5]);

/* Waarschuwingen zijn fail-closed: alleen aantoonbaar punt-/gebiedspecifieke
   kaarten mogen door. Een landfeed mag nooit regionale waarschuwingen als
   plaatswaarschuwing tonen. */
const atom=h.alleenPlaatsgebondenWaarschuwingen({
  dekking:true,plaatsSpecifiek:false,bron:"MeteoAlarm landfeed",
  lijst:[{titel:"Red warning Sardegna",landelijk:true,plaatsSpecifiek:false}]
});
assert.equal(atom.dekking,false);
assert.equal(atom.lijst.length,0);
assert.equal(atom.reden,"geen plaats-specifieke dekking");

const gemengd=h.alleenPlaatsgebondenWaarschuwingen({
  dekking:true,plaatsSpecifiek:true,
  lijst:[
    {titel:"Raakt gekozen punt",plaatsSpecifiek:true,landelijk:false},
    {titel:"Onbekend gebied",plaatsSpecifiek:false,landelijk:true}
  ]
});
assert.equal(gemengd.dekking,true);
assert.deepEqual(gemengd.lijst.map(x=>x.titel),["Raakt gekozen punt"]);

const schoon=h.alleenPlaatsgebondenWaarschuwingen({dekking:true,plaatsSpecifiek:true,lijst:[]});
assert.equal(schoon.dekking,true,"een bewezen puntbron met nul actieve waarschuwingen blijft geldige dekking");
assert.deepEqual(schoon.lijst,[]);

const ambigu=h.alleenPlaatsgebondenWaarschuwingen({dekking:true,lijst:[{titel:"Geen scope metadata"}]});
assert.equal(ambigu.dekking,false,"toekomstige brondata zonder plaatsbewijs mag niet als kaart verschijnen");
assert.equal(ambigu.lijst.length,0);

const nws=h.alleenPlaatsgebondenWaarschuwingen({
  dekking:true,plaatsSpecifiek:true,
  lijst:[{titel:"Heat Advisory",plaatsSpecifiek:true,landelijk:false}]
});
assert.equal(nws.dekking,true);
assert.equal(nws.lijst.length,1);

/* De pure validator is pas productveilig als de browserruntime hem ook echt aan
   de centrale load-boundary hangt. Voer daarom dezelfde module in een minimale
   browserachtige VM uit en bewijs normale, gedeelde en ongeldige routes. */
const bron=fs.readFileSync(path.join(__dirname,"global-location-hardening.js"),"utf8");
(async()=>{
  const calls=[];
  const state={style:{display:"none"},className:"",textContent:""};
  const context={
    URL,URLSearchParams,
    location:{search:""},
    document:{getElementById:id=>id==="state"?state:null},
    j:async()=>({results:[]}),
    load:async(...args)=>{calls.push(args);return "geladen";},
    console
  };
  context.globalThis=context;
  vm.runInNewContext(bron,context,{filename:"global-location-hardening.runtime.test.js"});

  const geldig=await context.load("52.3676","4.9041","Amsterdam",false,true,"NL");
  assert.equal(geldig,"geladen","geldige locatie moet de bestaande load blijven bereiken");
  assert.equal(calls.length,1);
  assert.strictEqual(calls[0][0],52.3676);
  assert.strictEqual(calls[0][1],4.9041);

  for(const [lat,lon] of [[91,4],[52,181],[Infinity,4],["NaN",4]]){
    const ervoor=calls.length;
    const uit=await context.load(lat,lon,"Ongeldig",false,false,null);
    assert.equal(uit,false,"ongeldige locatie moet fail-closed terugkeren");
    assert.equal(calls.length,ervoor,"ongeldige locatie mag de forecast-load niet bereiken");
    assert.equal(state.className,"msg err");
    assert.equal(state.style.display,"block");
    assert.equal(state.textContent,"Deze locatie is ongeldig. Zoek een plaats of gebruik Mijn locatie.");
  }

  state.textContent="stil behouden";
  const stil=await context.load(999,0,"Ongeldig",true,false,null);
  assert.equal(stil,false);
  assert.equal(state.textContent,"stil behouden","stille achtergrondload mag geen nieuwe foutmelding forceren");

  /* Bewijs het oorspronkelijke parseFloat-gat: de startup kan 52/5 aanleveren,
     maar de wrapper moet de ruwe query 52abc/5xyz zien en de request blokkeren. */
  context.location.search="?lat=52abc&lon=5xyz&plaats=KapotteLink";
  const voorKapotteLink=calls.length;
  const kapot=await context.load(52,5,"KapotteLink",false,false,null);
  assert.equal(kapot,false);
  assert.equal(calls.length,voorKapotteLink,"kapotte gedeelde link mag geen plausibele forecastrequest starten");
  assert.equal(state.textContent,"Deze gedeelde locatie is ongeldig. Zoek een plaats of gebruik Mijn locatie.");

  /* Bij een geldige gedeelde link zijn de ruwe URL-waarden leidend en blijft
     opslaan=false ook bij stille refreshes van exact dezelfde positie. */
  context.location.search="?lat=52.3676&lon=4.9041&plaats=Gedeeld";
  const gedeeld=await context.load(52,4,"Gedeeld",false,false,"NL");
  assert.equal(gedeeld,"geladen");
  assert.strictEqual(calls.at(-1)[0],52.3676,"ruwe gedeelde latitude is leidend boven parseFloat-aanvoer");
  assert.strictEqual(calls.at(-1)[1],4.9041,"ruwe gedeelde longitude is leidend boven parseFloat-aanvoer");
  assert.strictEqual(calls.at(-1)[4],false,"eerste gedeelde load mag niet opslaan");

  await context.load(52.3676,4.9041,"Gedeeld",true,undefined,"NL");
  assert.strictEqual(calls.at(-1)[4],false,"achtergrondrefresh van gedeelde locatie mag niet alsnog opslaan");

  await context.load(52.5,5.1,"Nieuwe keuze",false,true,"NL");
  assert.strictEqual(calls.at(-1)[4],true,"een echte nieuwe gebruikerskeuze moet de gedeelde sessie beëindigen en opslaan");

  await context.load(52.5,5.1,"Nieuwe keuze",true,undefined,"NL");
  assert.strictEqual(calls.at(-1)[4],undefined,"na een nieuwe keuze mag de normale load-default weer gelden");

  console.log("Wereldwijde locatiehardening: strikte gedeelde links, niet-opslaande gedeelde refresh, centrale load-boundary, uniek zoekvenster, deduplicatie en fail-closed plaatswaarschuwingen geslaagd.");
})().catch(err=>{console.error(err&&err.stack||err);process.exitCode=1;});

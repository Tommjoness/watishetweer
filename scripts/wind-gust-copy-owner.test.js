"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  GUST_BRON,GUST_PRODUCTIE,HELPERS_PRODUCTIE,
  windstootBegin,windstootTekst,windstootDitUur,windstootDitUurTekst,
  volgendeZonsondergang,zonsondergangDuurHtml,pasWindGustCopyToe
}=require("./wind-gust-copy-owner.js");

/* Historische windhelpers blijven correct en beschikbaar voor andere
   forecastpresentaties; alleen de hoofdtegel gebruikt ze niet meer. */
assert.equal(windstootBegin("2026-08-27T00:00"),"2026-08-26T23:00");
assert.equal(windstootBegin("2026-08-26T18:00"),"2026-08-26T17:00");
assert.equal(windstootBegin("ongeldig"),null);
const uurdata={
  time:["2026-08-30T20:00","2026-08-30T21:00","2026-08-30T22:00"],
  wind_gusts_10m:[11,14.4,19.7]
};
assert.deepEqual(windstootDitUur(uurdata,0),{v:14.4,t:"2026-08-30T21:00"});
assert.equal(windstootDitUurTekst({v:14.4,t:"2026-08-30T21:00"},"20:00–21:00"),"Verwachte hoogste windstoot tussen 20:00 en 21:00.");
assert.equal(
  windstootTekst({t:"2026-08-13T19:00",v:44},"2026-08-13T16:00","Vandaag","18:00–19:00"),
  "De hoogste windstoot wordt vandaag tussen 18:00 en 19:00 verwacht: 44 km/u."
);

/* Pure zonsondergangselectie. Voor deze tests behandelen we de lokale
   ISO-kloktijden bewust als een monotone UTC-as; productie injecteert naarUTC()
   en blijft daardoor IANA/DST-veilig. */
const puurNaarUtc=t=>{
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(t||""));
  return m?Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]):NaN;
};
const daily={
  time:["2026-08-31","2026-09-01","2026-09-02"],
  sunset:["2026-08-31T20:29","2026-09-01T20:27","2026-09-02T20:25"]
};
assert.deepEqual(volgendeZonsondergang(daily,"2026-08-31T18:37",puurNaarUtc),{
  t:"2026-08-31T20:29",minuten:112
});
assert.deepEqual(volgendeZonsondergang(daily,"2026-08-31T21:00",puurNaarUtc),{
  t:"2026-09-01T20:27",minuten:1407
});
assert.equal(volgendeZonsondergang({time:["2026-08-31"],sunset:[null]},"2026-08-31T18:37",puurNaarUtc),null);
assert.equal(volgendeZonsondergang(daily,"ongeldig",puurNaarUtc),null);
assert.equal(zonsondergangDuurHtml(52),'52<s> min</s>');
assert.equal(zonsondergangDuurHtml(112),'1<s> u</s> 52<s> min</s>');
assert.equal(zonsondergangDuurHtml(1407),'23<s> u</s> 27<s> min</s>');
assert.equal(zonsondergangDuurHtml(1620),'1<s> d</s> 3<s> u</s>');

const bron=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
assert.equal(bron.split(GUST_BRON).length-1,1,"ontwikkeltemplate mist exact het historische windstootanker");
assert(!bron.includes("function weatherNowVolgendeZonsondergang(daily,nu,naarUtc){"),"ontwikkeltemplate bevat de productiehelper al");

const uit=pasWindGustCopyToe(bron);
assert(!uit.includes(GUST_BRON),"oude windstoottegel bleef in de base-build staan");
assert.equal(uit.split(GUST_PRODUCTIE).length-1,1,"finale zonsondergangtegel ontbreekt of is dubbel");
assert.equal(uit.split(HELPERS_PRODUCTIE).length-1,1,"finale tegelhelpers ontbreken of zijn dubbel");
assert(uit.includes('gustKop.textContent="Tijd tot zonsondergang"'),"tegelkop benoemt de nieuwe consumentwaarde");
assert(uit.includes('weatherNowVolgendeZonsondergang(day,zonNu,naarUTC)'),"tegel gebruikt daily.sunset met de DST-veilige productieomzetter");
assert(uit.includes('plaatsVandaag()+"T"+plaatsKlok()'),"aftellen gebruikt de actuele lokale klok en niet een mogelijk verouderd current.time");
assert(uit.includes('weatherNowZonsondergangDuurHtml(zonOnder.minuten)'),"tegel toont een leesbare resterende duur");
assert(uit.includes('dagAanduiding(zonOnder.t,true)+" om "+hhmm(zonOnder.t)'),"subtekst noemt dag en lokale zonsondergangtijd");
assert(!uit.includes('set("gust",windstoot===null?"–":Math.round(windstoot)+"<s>km/u</s>")'),"windstoot mag niet langer de hoofdtegel vullen");

/* Gewone winddata en de onderliggende windstootforecast blijven aanwezig. */
for(const invariant of [
  "const windRuw=eindigGetal(c.wind_speed_10m);",
  'set("wind",Math.round(windsnelheid)+"<s>km/u</s>"',
  "wind_gusts_10m",
  "wind_gusts_10m_max"
]){
  assert(uit.includes(invariant),"weerdatainvariant is onbedoeld geraakt: "+invariant);
}

assert.throws(()=>pasWindGustCopyToe(uit),/staat al in het aangeleverde artifact/,
  "owner moet fail-fast zijn op een reeds gemigreerd artifact");

console.log("Hoofdtegel groen: tijd tot zonsondergang gebruikt daily.sunset en actuele lokale klok; winddata blijft beschikbaar.");

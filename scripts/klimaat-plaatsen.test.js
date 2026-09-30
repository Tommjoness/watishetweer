"use strict";

const assert=require("assert");
const {NORMALEN,MAX_STATION_KM,dichtstbijzijndStation,samenvatting,klimaatHtml}=require("./klimaat-plaatsen.js");
const {normalen,meetjaren}=require("./genereer-knmi-klimaatnormalen.js");
const {LOCATIES}=require("./seo-locations.config.js");

/* Datakwaliteit van de gecommitte KNMI-normalen. */
assert.equal(NORMALEN.periode,"1991-2020");
assert(NORMALEN.stations.length>=20,"te weinig KNMI-stations met een volledige reeks");
assert.equal(new Set(NORMALEN.stations.map(s=>s.code)).size,NORMALEN.stations.length,"stationscodes moeten uniek zijn");
for(const st of NORMALEN.stations){
  assert(st.naam&&st.knmiNaam,`${st.code}: naam ontbreekt`);
  assert(st.lat>50.5&&st.lat<53.8&&st.lon>3&&st.lon<7.5,`${st.code}: ligging buiten Nederland`);
  assert(st.jaren.van>=1991&&st.jaren.tot<=2020&&st.jaren.tot-st.jaren.van>=24,`${st.code}: meetperiode ${st.jaren.van}-${st.jaren.tot} is te kort voor een normaal`);
  assert.equal(st.maanden.length,12,`${st.code}: verwacht twaalf maanden`);
  for(const [i,m] of st.maanden.entries()){
    assert(m.tx>m.tn,`${st.code} maand ${i+1}: maximum moet boven minimum liggen`);
    assert(m.tx>=2&&m.tx<=26&&m.tn>=-4&&m.tn<=16,`${st.code} maand ${i+1}: onwaarschijnlijke temperatuur ${m.tn}/${m.tx}`);
    assert(m.neerslag>=20&&m.neerslag<=140,`${st.code} maand ${i+1}: onwaarschijnlijke neerslag ${m.neerslag}`);
    assert(m.regendagen>=5&&m.regendagen<=20,`${st.code} maand ${i+1}: onwaarschijnlijke regendagen ${m.regendagen}`);
    assert(m.zon>=30&&m.zon<=280,`${st.code} maand ${i+1}: onwaarschijnlijke zonneschijn ${m.zon}`);
  }
}

/* Referentie De Bilt 1991–2020: KNMI publiceert voor De Bilt een jaarlijkse
   neerslag van ongeveer 850 mm, circa 1700 zonuren en juli als warmste maand
   met een gemiddeld maximum rond 23 °C. */
{
  const bilt=NORMALEN.stations.find(s=>s.code===260);
  assert(bilt,"De Bilt ontbreekt");
  const jaarNeerslag=bilt.maanden.reduce((s,m)=>s+m.neerslag,0),jaarZon=bilt.maanden.reduce((s,m)=>s+m.zon,0);
  assert(jaarNeerslag>=820&&jaarNeerslag<=890,`De Bilt jaarneerslag ${jaarNeerslag}`);
  assert(jaarZon>=1650&&jaarZon<=1780,`De Bilt zonuren ${jaarZon}`);
  assert(Math.abs(bilt.maanden[6].tx-23.1)<=0.5,`De Bilt juli-maximum ${bilt.maanden[6].tx}`);
}

/* Rekenregels van de generator op synthetische data. */
{
  const rijen=[];
  for(let jaar=1991;jaar<=2020;jaar++)for(let maand=1;maand<=12;maand++){
    const nd=new Date(Date.UTC(jaar,maand,0)).getUTCDate();
    for(let dag=1;dag<=nd;dag++){
      const date=`${jaar}-${String(maand).padStart(2,"0")}-${String(dag).padStart(2,"0")}T00:00:00.000Z`;
      rijen.push({date,TX:150,TN:50,RH:dag%2?20:-1,SQ:dag%2?-1:60});
    }
  }
  const m=normalen(rijen);
  assert.equal(m.length,12);
  assert.deepEqual(m[0],{tx:15,tn:5,neerslag:32,regendagen:16,zon:90},"januari: -1 telt als 0; regendagen zijn dagen met minstens 1 mm");
  assert.deepEqual(meetjaren(rijen),{van:1991,tot:2020});
  const kort=rijen.filter(r=>Number(r.date.slice(0,4))<=2012);
  assert.equal(normalen(kort),null,"een station met minder dan 25 jaar per maand hoort niet in de set");
  const gat=rijen.filter(r=>!(r.date.startsWith("2000-03")&&Number(r.date.slice(8,10))>25));
  assert.equal(normalen(gat)[2].tx,15,"een maand met meer dan 10% ontbrekende dagen telt niet mee, maar sloopt het normaal niet");
}

/* Toewijzing en presentatie per plaats. */
for(const loc of LOCATIES){
  const ref=dichtstbijzijndStation(loc);
  assert(ref&&ref.km<=MAX_STATION_KM,`${loc.slug}: geen station binnen ${MAX_STATION_KM} km`);
  for(const st of NORMALEN.stations){
    const {afstandKm}=require("./klimaat-plaatsen.js");
    assert(afstandKm(loc,st)>=ref.km-1e-9,`${loc.slug}: ${st.naam} ligt dichterbij dan het gekozen station`);
  }
}
{
  const debilt={naam:"Testdorp",lat:52.1,lon:5.18};
  const html=klimaatHtml(debilt);
  assert(html.includes('data-knmi-station="260"'),"punt bij De Bilt krijgt station De Bilt");
  assert(html.includes("(KNMI-station De Bilt)"),"binnen 2 km geen afstand noemen");
  assert.equal((html.match(/<th scope="row">/g)||[]).length,12);
  assert(html.includes('<details class="seo-klimaat-details" open>')&&html.includes("<summary>Bekijk per maand</summary>"),"maandtabel staat in de HTML open achter een inklapbare kop");
  assert(!/NaN|undefined/.test(html),"klimaatblok bevat geen ongeldige waarden");
  const s=samenvatting(debilt,dichtstbijzijndStation(debilt));
  assert.equal(s.warmste,6,"juli is de warmste maand in De Bilt");
  assert(s.tekst.includes("juli")&&s.tekst.includes("°C")&&s.tekst.includes(" mm "),"samenvatting noemt maand, temperatuur en neerslag");
  const verweg=klimaatHtml({naam:"Buitenland",lat:40,lon:-3});
  assert.equal(verweg,"","zonder station binnen bereik geen klimaatblok");
  const oss=klimaatHtml(LOCATIES.find(x=>x.slug==="oss"));
  assert(/KNMI-station Volkel, op \d+ km/.test(oss),"verder dan 2 km: stationsnaam met afstand");
  assert(oss.includes("1993–2020"),"de werkelijke meetperiode staat in het bijschrift");
}

console.log(`Klimaatplaatsen: ${NORMALEN.stations.length} KNMI-stations met plausibele normalen, generatorregels, De Bilt-referentie en ${LOCATIES.length} plaatsen met dichtstbijzijnd station geslaagd.`);

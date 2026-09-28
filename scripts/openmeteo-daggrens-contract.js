"use strict";

/* Providercontract: over welk uurvenster berekent Open-Meteo de dagwaarden?

   De site leest een uurwaarde als het uur dat op dat tijdstip eindigt: de
   neerslagkans met tijdstempel 00:00 hoort bij 23:00-24:00 van de vorige dag
   (interpretatie-engine.js, grafiek en uurtabel). De weekrij gebruikte voor
   komende dagen tot nu toe het dagveld precipitation_probability_max. Als
   Open-Meteo dat veld berekent over de tijdstempels 00:00-23:00 van de datum,
   schuift het één uur ten opzichte van de rest van de site (waargenomen:
   weekrij 73%, grafiek 77%).

   Dit script haalt live data op en stelt per dag vast welk venster het
   dagmaximum reproduceert:
   - "tijdstempels": maximum over 00:00..23:00 van de datum;
   - "uren": maximum over 01:00..24:00 (de uren 00-24 van die dag).
   Het faalt als de dagwaarde niet uit de tijdstempels volgt; dan klopt de
   aanname achter de weekrij niet en moet die opnieuw worden bekeken.
   Externe bron: een netwerkfout heet EXTERN en is geen productregressie. */

const assert=require("assert");
const PLAATSEN=[
  {naam:"Amsterdam",lat:52.37,lon:4.9,tz:"Europe/Amsterdam"},
  {naam:"New York",lat:40.71,lon:-74.01,tz:"America/New_York"},
  {naam:"Sydney",lat:-33.87,lon:151.21,tz:"Australia/Sydney"}
];

async function haal(p){
  const url="https://api.open-meteo.com/v1/forecast?latitude="+p.lat+"&longitude="+p.lon
    +"&hourly=precipitation_probability&daily=precipitation_probability_max&timezone="+encodeURIComponent(p.tz)+"&forecast_days=7";
  let laatste=null;
  for(let poging=1;poging<=3;poging++){
    try{
      const r=await fetch(url,{signal:AbortSignal.timeout(15000)});
      if(!r.ok)throw new Error("HTTP "+r.status);
      return await r.json();
    }catch(e){laatste=e;await new Promise(res=>setTimeout(res,1000*poging));}
  }
  throw new Error("EXTERN: Open-Meteo niet bereikbaar voor "+p.naam+": "+(laatste&&laatste.message));
}

(async()=>{
  let totaal=0,tijdstempels=0,uren=0,verschil=0;
  for(const p of PLAATSEN){
    const d=await haal(p),h=d.hourly,dag=d.daily;
    const idx=new Map(h.time.map((t,i)=>[t,i]));
    dag.time.forEach((datum,di)=>{
      const waarde=dag.precipitation_probability_max[di];
      const reeks=van=>Array.from({length:24},(_,k)=>{const t=new Date(Date.parse(datum+"T00:00Z")+(van+k)*3600000).toISOString().slice(0,16);return idx.has(t)?h.precipitation_probability[idx.get(t)]:undefined;});
      const a=reeks(0),b=reeks(1);
      if(waarde==null||a.some(v=>v==null)||b.some(v=>v==null))return;
      const maxA=Math.max(...a),maxB=Math.max(...b);
      totaal++;if(maxA===waarde)tijdstempels++;if(maxB===waarde)uren++;if(maxA!==maxB)verschil++;
      if(maxA!==waarde)console.log("AFWIJKING "+p.naam+" "+datum+": dag "+waarde+", tijdstempels "+maxA+", uren "+maxB);
    });
  }
  console.log("OPEN-METEO DAGGRENS: "+totaal+" volledige dagen; dagwaarde = tijdstempels 00-23 bij "+tijdstempels+", = uren 00-24 bij "+uren+"; de vensters verschillen op "+verschil+" dagen.");
  assert(totaal>=6,"te weinig volledige dagen om het contract vast te stellen ("+totaal+")");
  assert.equal(tijdstempels,totaal,"precipitation_probability_max volgt niet overal het tijdstempelvenster 00:00-23:00");
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

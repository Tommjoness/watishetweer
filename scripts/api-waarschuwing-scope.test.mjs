import assert from "node:assert/strict";
import api from "../api/waarschuwingen.mjs";

const origineelFetch=globalThis.fetch;
try {
  /* Nederland: als de puntcompatibiliteitsfeed tijdelijk niet bruikbaar is maar
     de officiële landfeed succesvol en leeg wordt opgehaald, is nul actieve
     waarschuwingen wél bewezen. Een lege landelijke set kan immers nergens een
     lokale waarschuwing bevatten. */
  globalThis.fetch=async url=>{
    const u=String(url);
    if(u.includes("feeds.meteoalarm.org/api/v1/warnings/feeds-netherlands"))return {ok:false,status:503};
    if(u.includes("meteoalarm-legacy-atom-netherlands"))return {
      ok:true,status:200,
      text:async()=>"<feed></feed>"
    };
    throw new Error("onverwachte fetch in Nederland-test: "+u);
  };
  const nl=await api.fetch(new Request("https://watishetweer.nl/api/waarschuwingen?lat=51.95&lon=5.10&land=NL"));
  assert.equal(nl.status,200);
  const nlBody=await nl.json();
  assert.equal(nlBody.dekking,true);
  assert.equal(nlBody.plaatsSpecifiek,false);
  assert.equal(nlBody.land,"NL");
  assert.deepEqual(nlBody.lijst,[]);
  assert.equal(nlBody.reden,undefined);

  /* Italië/Ligurië: de compatibiliteitsfeed is niet bruikbaar en de fallback
     bevat alleen landbrede Atom-items voor andere regio's. De API-grens moet
     die informatie behouden als 'geen plaats-specifieke dekking', maar mag geen
     rode kaart aan Né/Ligurië koppelen. */
  globalThis.fetch=async url=>{
    const u=String(url);
    if(u.includes("feeds.meteoalarm.org/api/v1/warnings/feeds-italy"))return {ok:false,status:503};
    if(u.includes("meteoalarm-legacy-atom-italy"))return {
      ok:true,status:200,
      text:async()=>`<feed>
        <entry><title>Red High-temperature Warning issued for Italy - Sardegna</title><summary>Regionale hittewaarschuwing</summary></entry>
        <entry><title>Red High-temperature Warning issued for Italy - Sicilia</title><summary>Regionale hittewaarschuwing</summary></entry>
      </feed>`
    };
    throw new Error("onverwachte fetch in Italië-test: "+u);
  };
  const it=await api.fetch(new Request("https://watishetweer.nl/api/waarschuwingen?lat=44.356&lon=9.388&land=IT"));
  assert.equal(it.status,200);
  const itBody=await it.json();
  assert.equal(itBody.dekking,false);
  assert.equal(itBody.plaatsSpecifiek,false);
  assert.deepEqual(itBody.lijst,[]);
  assert.equal(itBody.reden,"geen plaats-specifieke dekking");

  /* De grove CONUS-rechthoek overlapt Canada en Mexico. Een expliciete landcode
     moet daar zwaarder wegen dan alleen de rechthoek: Toronto en Monterrey mogen
     nooit naar api.weather.gov worden gestuurd of NWS-dekking:true krijgen. */
  for(const geval of [
    {naam:"Toronto",lat:43.6532,lon:-79.3832,land:"CA"},
    {naam:"Monterrey",lat:25.6866,lon:-100.3161,land:"MX"}
  ]){
    let nwsAangeroepen=false;
    globalThis.fetch=async url=>{
      const u=String(url);
      if(u.includes("api.weather.gov")){nwsAangeroepen=true;throw new Error("NWS buiten bevestigd NWS-land");}
      throw new Error("onverwachte fetch in "+geval.naam+"-test: "+u);
    };
    const r=await api.fetch(new Request(`https://watishetweer.nl/api/waarschuwingen?lat=${geval.lat}&lon=${geval.lon}&land=${geval.land}`));
    assert.equal(r.status,200);
    const body=await r.json();
    assert.equal(nwsAangeroepen,false,geval.naam+" mag NWS niet aanroepen");
    assert.equal(body.dekking,false,geval.naam+" mag geen NWS-dekking claimen");
    assert.equal(body.land,geval.land);
    assert.deepEqual(body.lijst,[]);
  }

  /* GPS/eerste load kan nog geen land= meesturen. Ook dan mag de rechthoek niet
     zelfstandig beslissen. Toronto moet eerst via reverse geocoding als CA
     worden bevestigd en daarna fail-closed buiten NWS blijven. */
  let gpsNws=false,gpsReverse=false;
  globalThis.fetch=async url=>{
    const u=String(url);
    if(u.includes("nominatim.openstreetmap.org/reverse")){
      gpsReverse=true;
      return {ok:true,status:200,json:async()=>({address:{country_code:"ca"}})};
    }
    if(u.includes("api.weather.gov")){gpsNws=true;throw new Error("NWS buiten bevestigd NWS-land");}
    throw new Error("onverwachte fetch in GPS-Toronto-test: "+u);
  };
  const gps=await api.fetch(new Request("https://watishetweer.nl/api/waarschuwingen?lat=43.6532&lon=-79.3832"));
  assert.equal(gps.status,200);
  const gpsBody=await gps.json();
  assert.equal(gpsReverse,true,"GPS-pad moet land bevestigen vóór NWS");
  assert.equal(gpsNws,false,"GPS-Toronto mag NWS niet aanroepen");
  assert.equal(gpsBody.land,"CA");
  assert.equal(gpsBody.dekking,false);
  assert.deepEqual(gpsBody.lijst,[]);

  /* Dallas/NWS: puntdekking is wél bewijsbaar en moet dus door de servergrens
     heen blijven komen. Dit voorkomt dat fail-closed per ongeluk alle landen
     zonder waarschuwingen maakt. */
  globalThis.fetch=async url=>{
    const u=String(url);
    if(u.includes("api.weather.gov/alerts/active?point="))return {
      ok:true,status:200,
      json:async()=>({features:[{properties:{
        event:"Heat Advisory",severity:"Severe",description:"Dangerous heat expected.",
        effective:"2026-08-12T18:00:00Z",expires:"2026-08-13T02:00:00Z",areaDesc:"Dallas County"
      }}]})
    };
    throw new Error("onverwachte fetch in NWS-test: "+u);
  };
  const us=await api.fetch(new Request("https://watishetweer.nl/api/waarschuwingen?lat=32.783&lon=-96.807&land=US"));
  assert.equal(us.status,200);
  const usBody=await us.json();
  assert.equal(usBody.dekking,true);
  assert.equal(usBody.plaatsSpecifiek,true);
  assert.equal(usBody.land,"US");
  assert.equal(usBody.lijst.length,1);
  assert.equal(usBody.lijst[0].titel,"Heat Advisory");
  assert.equal(usBody.lijst[0].plaatsSpecifiek,true);

  console.log("API-waarschuwingsscope: lege NL-landfeed als nulwaarschuwing, niet-lege landfeed fail-closed, NWS-landgrens, GPS-landcheck en puntdekking behouden.");
} finally {
  globalThis.fetch=origineelFetch;
}

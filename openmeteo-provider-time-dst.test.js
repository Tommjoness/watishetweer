"use strict";

const assert=require("assert");
const I=require("./interpretatie-engine.js");

function payload({datum,offset,tijden}){
  return {
    timezone:"Europe/Amsterdam",
    utc_offset_seconds:offset,
    current:{
      time:datum+"T01:00",
      precipitation:0,
      weather_code:0
    },
    hourly:{
      time:tijden.map(t=>datum+"T"+t),
      precipitation:tijden.map((_,i)=>i===0?0:1),
      precipitation_probability:tijden.map((_,i)=>i===0?0:80-i*5),
      weather_code:tijden.map((_,i)=>i===0?0:61),
      snowfall:tijden.map(()=>0),
      rain:tijden.map((_,i)=>i===0?0:1),
      showers:tijden.map(()=>0)
    }
  };
}

/* Open-Meteo serialiseert een response met één vaste utc_offset_seconds over
   de hele tijdas. Rond de najaarsomslag zijn 01:00, 02:00 en 03:00 in die
   provider-as dus drie opeenvolgende stappen van ieder 60 minuten. WeatherNow
   mag 01→02 niet als twee verstreken uren interpreteren doordat de IANA-zone
   intussen van offset wisselt. */
const herfst=I.analyseerNeerslagData(payload({
  datum:"2026-10-25",
  offset:7200,
  tijden:["01:00","02:00","03:00","04:00"]
}),120);
assert.equal(herfst.genoeg,true,"twee uur aaneengesloten Open-Meteo-data over de najaarsomslag moet volledige dekking houden");
assert.equal(herfst.hourlyItems.length,2,"de twee provideruren 02:00 en 03:00 moeten allebei in het twee-uursvenster vallen");
assert.equal(herfst.hourlyItems[0].overlap,60);
assert.equal(herfst.hourlyItems[1].overlap,60);
assert.equal(herfst.hourlyItems[1].begin,herfst.hourlyItems[0].eind,"opeenvolgende provideruren mogen rond DST geen gat krijgen");

/* Voor de voorjaarssprong geldt hetzelfde omgekeerd. Met de vaste CET-offset
   zijn 02:00 en 03:00 opeenvolgende providerinstanties. Een civiele IANA-parser
   ziet 02:00 als niet-bestaand en kan hem daardoor op hetzelfde instant als
   03:00 laten uitkomen. Dat zou twee modelintervallen over elkaar leggen. */
const voorjaar=I.analyseerNeerslagData(payload({
  datum:"2026-03-29",
  offset:3600,
  tijden:["01:00","02:00","03:00","04:00"]
}),120);
assert.equal(voorjaar.genoeg,true,"twee uur aaneengesloten Open-Meteo-data over de voorjaarssprong moet volledige dekking houden");
assert.equal(voorjaar.hourlyItems.length,2);
assert.equal(voorjaar.hourlyItems[0].overlap,60);
assert.equal(voorjaar.hourlyItems[1].overlap,60);
assert.equal(voorjaar.hourlyItems[1].begin,voorjaar.hourlyItems[0].eind,"provideruren mogen bij een niet-bestaande civiele kloktijd niet overlappen");
assert.ok(voorjaar.hourlyItems[1].eind>voorjaar.hourlyItems[0].eind,"de provider-as moet strikt oplopen");

console.log("Open-Meteo provider-time DST: vaste response-offset blijft een monotone tijdas over beide klokomslagen.");

"use strict";
const assert=require("assert");
const a=require("./final-audit-20260901.js");
const {vochtigheidPresentatie,zonPresentatie}=require("./final-consumer-polish-20260831-runtime.js");

/* Uurwaarde op 08:00 beschrijft volgens de provider 07:00–08:00. */
const tijden=["2026-09-01T06:00","2026-09-01T07:00","2026-09-01T08:00","2026-09-01T09:00","2026-09-01T10:00"];
let p=a.regenperiodenVoorGrafiek({grafiekTijden:tijden,bronTijden:tijden,neerslag:[0,0,0.8,0.4,0],bronStart:0,actueelBronIndex:1});
assert.equal(p.length,1);
assert.equal(p[0].van,"2026-09-01T07:00");
assert.equal(p[0].tot,"2026-09-01T09:00");
assert.equal(Math.round(p[0].som*10)/10,1.2);
assert.equal(a.regenSamenvatting(p),"Verwachte meetbare neerslag: 07:00–09:00 · 1,2 mm.");

/* Verstreken uurwaarden horen niet in de standaard vooruitkijkende grafiektekst. */
p=a.regenperiodenVoorGrafiek({grafiekTijden:tijden,bronTijden:tijden,neerslag:[0,0.7,0.8,0,0],bronStart:0,actueelBronIndex:2});
assert.equal(p.length,0);
p=a.regenperiodenVoorGrafiek({grafiekTijden:tijden,bronTijden:tijden,neerslag:[0,0.7,0.8,0,0],bronStart:0,actueelBronIndex:2,toonVerstreken:true});
assert.equal(p.length,1);assert.equal(p[0].van,"2026-09-01T06:00");assert.equal(p[0].tot,"2026-09-01T08:00");

/* Een bronindexmismatch faalt gesloten; geen indexOf-koppeling rond DST. */
const dubbel=["2026-10-25T01:00","2026-10-25T02:00","2026-10-25T02:00","2026-10-25T03:00"];
p=a.regenperiodenVoorGrafiek({grafiekTijden:dubbel,bronTijden:dubbel,neerslag:[0,0.3,0.4,0],bronStart:0,actueelBronIndex:0});
assert.equal(p.length,1);assert.equal(Math.round(p[0].som*10)/10,0.7);

assert.equal(a.nwsTitelNl("Heat Advisory"),"Hitteadvies");
assert.equal(a.nwsTitelNl("Air Quality Alert"),"Luchtkwaliteitswaarschuwing");
assert.equal(a.nwsTitelNl("Flood Watch"),"Waakzaamheid voor overstromingen");
assert.equal(a.nwsTitelNl("Flood Warning"),"Waarschuwing voor overstromingen");
assert.equal(a.nwsTitelNl("Severe Thunderstorm Watch"),"Waakzaamheid voor zwaar onweer");
assert.equal(a.nwsTitelNl("Tornado Watch"),"Waakzaamheid voor tornado's");
assert.equal(a.nwsTitelNl("Winter Storm Warning"),"Waarschuwing voor zwaar winterweer");
assert.equal(a.nwsTitelNl("High Wind Warning"),"Waarschuwing voor zeer harde wind");
assert.equal(a.fahrenheitContext("Heat Advisory","Heat index values of 100 to 110 degrees Fahrenheit."),"100–110 °F is ongeveer 38–43 °C.");
assert.equal(a.fahrenheitContext("Heat Advisory","Temperatures near 104 °F."),"104 °F is ongeveer 40 °C.");
assert.equal(a.fahrenheitContext("Heat Advisory","Heat index values up to 105."),"De Amerikaanse hitte-index loopt op tot 105 °F, ongeveer 41 °C.");
assert.equal(a.fahrenheitContext("Extreme Heat Warning","Heat index values up to 105."),"De Amerikaanse hitte-index loopt op tot 105 °F, ongeveer 41 °C.");
assert.equal(a.fahrenheitContext("Air Quality Alert","Index values up to 105."),"");
assert.equal(a.fahrenheitContext("Heat Advisory","Heat index values up to 41 °C."),"");
assert.match(a.nwsUitleg("Heat Advisory","100 to 110 degrees Fahrenheit").uitleg,/38–43 °C/);

/* Wereldwijde vochtigheid: relatieve waarde blijft meetwaarde, comfort volgt dauwpunt. */
assert.equal(vochtigheidPresentatie({temperature_2m:40,relative_humidity_2m:43,dew_point_2m:25}),"Zeer benauwde lucht. Dauwpunt circa 25 °C.");
assert.equal(vochtigheidPresentatie({temperature_2m:5,relative_humidity_2m:84,dew_point_2m:3}),"Hoge relatieve luchtvochtigheid; koude lucht bevat weinig waterdamp. Dauwpunt circa 3 °C.");
assert.equal(vochtigheidPresentatie({temperature_2m:2,relative_humidity_2m:78,dew_point_2m:-1}),"Hoge relatieve luchtvochtigheid; koude lucht bevat weinig waterdamp. Dauwpunt circa -1 °C.");
assert.equal(vochtigheidPresentatie({temperature_2m:-49,relative_humidity_2m:67,dew_point_2m:-52}),"Extreem droge lucht. Dauwpunt circa -52 °C.");
assert.equal(vochtigheidPresentatie({temperature_2m:20,relative_humidity_2m:87}),"Hoge relatieve luchtvochtigheid.");
assert(!/droog/i.test(vochtigheidPresentatie({temperature_2m:40,relative_humidity_2m:43,dew_point_2m:25})),"Dubai mag nooit droog heten");
assert(!/^Vochtige lucht/i.test(vochtigheidPresentatie({temperature_2m:-49,relative_humidity_2m:67,dew_point_2m:-52})),"poollucht mag niet simpelweg vochtig heten");

/* Exact één minuut moet ook voor assistieve technologie enkelvoud zijn. */
const zon={timezone:"UTC",utc_offset_seconds:0,current:{is_day:0},daily:{sunrise:["2026-09-01T06:01"],sunset:["2026-09-01T18:00"]}};
const zp=zonPresentatie(zon,Date.UTC(2026,8,1,6,0));
assert.equal(zp.waardeTekst,"1 min");
assert.match(zp.aria,/over 1 minuut,/);
assert(!/1 minuten/.test(zp.aria));

console.log("Finale audithelpers groen: regeninterval, Dubai/Longyearbyen/Ushuaia/Zuidpool, 1 minuut en consistente NWS titel/metrische uitleg zijn geborgd.");

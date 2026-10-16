"use strict";

/* Dagcode voor de rest van vandaag (live bug 16 okt 2026, Montréal 07:15): de
   rij "Vandaag" meldde "dichte motregen" en toonde een motregenicoon, terwijl
   Open-Meteo voor die dag code 63 (matige regen, 27,3 mm) gaf. Oorzaak: dichte
   motregen (55) stond in dezelfde rangklasse als zware regen (65) en won daarom
   van matige regen (63). Motregen is altijd lichter dan gewone regen. */

const assert=require("assert");
const {analyseerDagData}=require("../interpretatie-engine.js");

/* Echte Open-Meteo-uurwaarden van Montréal voor 16 okt 2026 (07:15 lokale tijd). */
const codes=[3,3,3,3,3,55,63,63,63,63,53,55,55,51,53,51,3,51,3,3,3,3,3,3];
const mm=[0,0,0,0,0,1.0,3.5,7.4,7.0,3.8,0.8,1.0,1.2,0.2,0.8,0.4,0,0.2,0,0,0,0,0,0];
const kans=[0,3,8,11,18,77,100,100,99,90,67,74,72,60,39,26,25,19,6,5,4,3,3,3];
const tijd=Array.from({length:24},(_,u)=>"2026-10-16T"+String(u).padStart(2,"0")+":00");
const data=(dagCode,hCodes)=>({
  timezone:"America/Toronto",utc_offset_seconds:-14400,
  current:{time:"2026-10-16T07:15",weather_code:65,precipitation:2.3},
  hourly:{time:tijd,weather_code:hCodes,precipitation:mm,precipitation_probability:kans},
  daily:{time:["2026-10-16","2026-10-17"],weather_code:[dagCode,3],precipitation_sum:[27.3,0],precipitation_probability_max:[100,3]}
});

/* Rest van vandaag: matige regen wint van motregen, ook als motregen eerder of later komt. */
assert.equal(analyseerDagData(data(63,codes),0,"2026-10-16T07:15").code,63,"matige regen wint van dichte motregen");
assert.equal(analyseerDagData(data(63,codes.map(c=>c===63?55:c)),0,"2026-10-16T07:15").code,55,"zonder gewone regen blijft dichte motregen de zwaarste code");

/* De volgorde binnen de klasse en tegen andere soorten blijft zoals bedoeld. */
const rest=lijst=>{const c=Array(24).fill(3);lijst.forEach((x,i)=>c[8+i]=x);const d=data(3,c);d.hourly.precipitation=Array(24).fill(0.3);d.hourly.precipitation_probability=Array(24).fill(80);return analyseerDagData(d,0,"2026-10-16T07:15").code;};
assert.equal(rest([51,53,55]),55,"dichte motregen is de zwaarste motregen");
assert.equal(rest([55,61]),61,"lichte regen wint van dichte motregen");
assert.equal(rest([61,63]),63,"matige regen wint van lichte regen");
assert.equal(rest([63,65]),65,"zware regen blijft de zwaarste regen");
assert.equal(rest([55,71]),71,"sneeuw blijft boven motregen");
assert.equal(rest([55,65]),65,"zware regen wint van dichte motregen");
assert.equal(rest([63,56]),56,"ijzelmotregen blijft zwaarder dan regen");

console.log("Dagcode-rang groen: motregen wint nooit van gewone regen; volgorde binnen en tussen klassen klopt.");

"use strict";
const fs=require("fs");
const p="scripts/prelaunch-hardening-12.js";
let s=fs.readFileSync(p,"utf8");

// Het CAP-fragment komt tweemaal voor (NWS en MeteoAlarm). De eenmalige
// migratie moet daarom exact twee exemplaren aanpassen.
const begin='vervang("lib/waarschuwingen.cjs",\n`      tot: i.expires || i.ends || null,`,';
const i=s.indexOf(begin);
if(i<0) throw new Error("NWS/CAP migratieblok niet gevonden");
const einde=s.indexOf('\nvervang("lib/waarschuwingen.cjs",',i+begin.length);
if(einde<0) throw new Error("Einde NWS/CAP migratieblok niet gevonden");
const blok=s.slice(i,einde);
if(!blok.includes('tot: i.ends || i.expires || null,')) throw new Error("Nieuwe CAP-volgorde ontbreekt in migratieblok");
if(!blok.trimEnd().endsWith('`);')) throw new Error("Onverwacht einde CAP-migratieblok");
const aangepast=blok.replace(/`\);\s*$/, '`,2);');
if(aangepast===blok) throw new Error("CAP-migratieblok kon niet begrensd worden aangepast");
s=s.slice(0,i)+aangepast+s.slice(einde);

// index.html bewaart de slimme aanhalingstekens hier bewust als JavaScript-escape
// (\u201c/\u201d). In het migratiescript stonden ze als letterlijke Unicode-tekens,
// waardoor een exacte bronvergelijking terecht niet matchte.
const unicode='op “Mijn locatie”.';
if(s.split(unicode).length-1!==1) throw new Error("Locatie-quote in migratiescript niet exact eenmaal gevonden");
s=s.replace(unicode,'op \\u201cMijn locatie\\u201d.');

fs.writeFileSync(p,s,"utf8");
console.log("Pre-launch migratieharnas genormaliseerd voor CAP en locatiebron.");

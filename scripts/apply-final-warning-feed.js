"use strict";
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const lees=p=>fs.readFileSync(path.join(R,p),"utf8"),schrijf=(p,s)=>fs.writeFileSync(path.join(R,p),s,"utf8");
function exact(src,oud,nieuw,label){const n=src.split(oud).length-1;if(n===0&&src.includes(nieuw))return src;if(n!==1)throw new Error(label+": verwacht 1 match, gevonden "+n);return src.replace(oud,nieuw);}
let waars=lees("lib/waarschuwingen.cjs");
waars=exact(waars,`async function viaMeteoAlarm(slug, lat, lon) {
  const bronnen = [
    "https://feeds.meteoalarm.org/api/v1/warnings/feeds-" + slug,
    "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-" + slug
  ];
  for (const bron of bronnen) {
    try {
      const r = await haal(bron, "application/json, application/atom+xml");
      const tekst = await r.text();
      const kop = tekst.trim().charAt(0);
      if (kop === "{" || kop === "[") return { bron: bron, lijst: uitCap(JSON.parse(tekst), lat, lon) };
      if (tekst.includes("<entry")) return { bron: bron, lijst: uitAtom(tekst) };
    } catch (e) { /* volgende vorm proberen */ }
  }
  return null;
}`,
`async function viaMeteoAlarm(slug, lat, lon) {
  // MeteoAlarm publiceert de landgebonden Atom-feeds expliciet als de onderhouden
  // publieke feed voor re-users. De vroegere grote JSON-download wordt niet meer
  // eerst geprobeerd: die kon de volledige client-timeout opsouperen voordat de
  // officiële Atom-feed aan bod kwam.
  const bron = "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-" + slug;
  try {
    const r = await haal(bron, "application/atom+xml, application/xml, text/xml");
    const tekst = await r.text();
    // Een geldige feed zonder <entry> betekent gewoon: geen actieve waarschuwingen.
    if (/<feed(?:\\s|>)/i.test(tekst)) return { bron, lijst: uitAtom(tekst) };
  } catch (e) {}
  return null;
}`,
"MeteoAlarm Atom direct");
schrijf("lib/waarschuwingen.cjs",waars);
let test=lees("prelaunch-regressions.test.js");
const anker='ok(waars.includes("waarschuwingTekst")&&!waars.includes("trim().slice(0, 300)"),"waarschuwingstekst breekt niet meer hard op 300 tekens af");';
const extra=anker+'\nok(waars.includes("meteoalarm-legacy-atom-")&&!waars.includes("api/v1/warnings/feeds-"),"MeteoAlarm gebruikt direct de onderhouden publieke Atom-feed");';
test=exact(test,anker,extra,"Atom statische regressie");
test=test.replace('return{ok:true,text:async()=>JSON.stringify({warnings:[]})};','return{ok:true,text:async()=>"<?xml version=\\"1.0\\"?><feed xmlns=\\"http://www.w3.org/2005/Atom\\"></feed>"};');
test=test.replace('return{ok:true,text:async()=>JSON.stringify({warnings:[]})};','return{ok:true,text:async()=>"<?xml version=\\"1.0\\"?><feed xmlns=\\"http://www.w3.org/2005/Atom\\"></feed>"};');
schrijf("prelaunch-regressions.test.js",test);
console.log("MeteoAlarm-feed hardening toegepast.");

"use strict";
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const lees=p=>fs.readFileSync(path.join(R,p),"utf8");
const schrijf=(p,s)=>fs.writeFileSync(path.join(R,p),s,"utf8");
function exact(src,oud,nieuw,label){
  const n=src.split(oud).length-1;
  if(n===0&&src.includes(nieuw)) return src;
  if(n!==1) throw new Error(label+": verwacht 1 match, gevonden "+n);
  return src.replace(oud,nieuw);
}

let waars=lees("lib/waarschuwingen.cjs");
waars=exact(waars,
`async function haal(url, accept) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": accept },
    signal: AbortSignal.timeout(6000)
  });
  if (!r.ok) throw new Error("status " + r.status);
  return r;
}`,
`async function haal(url, accept, timeoutMs = 6000) {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": accept },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!r.ok) throw new Error("status " + r.status);
  return r;
}`,
"haal ondersteunt begrensde timeout");

waars=exact(waars,
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
`async function viaMeteoAlarm(slug, lat, lon) {
  // De onderhouden publieke Atom-feed blijft eerste keus. In productie kan de
  // feed echter incidenteel niet bereikbaar zijn vanuit een serverless-regio.
  // Daarom een korte, begrensde compatibiliteitsfallback naar de bestaande JSON-
  // feed. Beide pogingen samen blijven ruim binnen de 7s-clienttimeout.
  const atom = "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-" + slug;
  try {
    const r = await haal(atom, "application/atom+xml, application/xml, text/xml", 2400);
    const tekst = await r.text();
    // Een geldige feed zonder <entry> betekent gewoon: geen actieve waarschuwingen.
    if (/<feed(?:\\s|>)/i.test(tekst)) return { bron: atom, lijst: uitAtom(tekst) };
  } catch (e) {}

  const compat = "https://feeds.meteoalarm.org/api/v1/warnings/feeds-" + slug;
  try {
    const r = await haal(compat, "application/json", 2400);
    const tekst = await r.text();
    const kop = tekst.trim().charAt(0);
    if (kop === "{" || kop === "[") return { bron: compat, lijst: uitCap(JSON.parse(tekst), lat, lon) };
  } catch (e) {}
  return null;
}`,
"Atom-first runtimefallback");
schrijf("lib/waarschuwingen.cjs",waars);

let test=lees("prelaunch-regressions.test.js");
test=exact(test,
'ok(waars.includes("meteoalarm-legacy-atom-")&&!waars.includes("api/v1/warnings/feeds-"),"MeteoAlarm gebruikt direct de onderhouden publieke Atom-feed");',
'ok(waars.includes("meteoalarm-legacy-atom-")&&waars.includes("api/v1/warnings/feeds-")&&waars.indexOf("meteoalarm-legacy-atom-")<waars.indexOf("api/v1/warnings/feeds-"),"MeteoAlarm gebruikt Atom eerst en heeft alleen daarna een compatibiliteitsfallback");\nok(waars.includes("2400")&&waars.includes("timeoutMs = 6000"),"MeteoAlarm-fallbacks zijn afzonderlijk begrensd binnen de clienttimeout");',
"statische MeteoAlarm runtimefallbacktest");
const anker=`  ok(eu.body.dekking===true&&eu.body.land==="NL"&&warnUrls.length===1&&warnUrls[0].includes("feeds.meteoalarm.org")&&!warnUrls.some(u=>u.includes("nominatim")||u.includes("bigdatacloud")),"meegegeven landcode voorkomt reverse-geocoding voor MeteoAlarm");`;
const extra=anker+`
  const fbUrls=[];const fb=await roep("./lib/waarschuwingen.cjs",{lat:"52.35",lon:"5.26",land:"NL"},async url=>{
    fbUrls.push(String(url));
    if(String(url).includes("meteoalarm-legacy-atom-")) throw new Error("atom test failure");
    return{ok:true,text:async()=>JSON.stringify({warnings:[]})};
  });
  ok(fb.body.dekking===true&&fb.body.land==="NL"&&fbUrls.length===2&&fbUrls[0].includes("meteoalarm-legacy-atom-")&&fbUrls[1].includes("api/v1/warnings/feeds-"),"MeteoAlarm valt bij Atom-runtimefout begrensd terug op compatibiliteitsfeed");`;
test=exact(test,anker,extra,"dynamische MeteoAlarm runtimefallbacktest");
schrijf("prelaunch-regressions.test.js",test);
console.log("MeteoAlarm-runtimefallback toegepast.");

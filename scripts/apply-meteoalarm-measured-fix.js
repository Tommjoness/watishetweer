"use strict";
const fs=require("fs"),path=require("path");
const R=path.join(__dirname,"..");
const lees=p=>fs.readFileSync(path.join(R,p),"utf8"),schrijf=(p,s)=>fs.writeFileSync(path.join(R,p),s,"utf8");
function exact(src,oud,nieuw,label){const n=src.split(oud).length-1;if(n===0&&src.includes(nieuw))return src;if(n!==1)throw new Error(label+": verwacht 1 match, gevonden "+n);return src.replace(oud,nieuw);}

let waars=lees("lib/waarschuwingen.cjs");
waars=exact(waars,
'    const r = await haal(atom, "application/atom+xml, application/xml, text/xml", 2400);',
'    const r = await haal(atom, "*/*", 1500);',
"Atom Accept en timeout");
waars=exact(waars,
'    const r = await haal(compat, "application/json", 2400);',
'    const r = await haal(compat, "application/json", 4500);',
"JSON fallback timeout");
waars=exact(waars,
`  // De onderhouden publieke Atom-feed blijft eerste keus. In productie kan de
  // feed echter incidenteel niet bereikbaar zijn vanuit een serverless-regio.
  // Daarom een korte, begrensde compatibiliteitsfallback naar de bestaande JSON-
  // feed. Beide pogingen samen blijven ruim binnen de 7s-clienttimeout.`,
`  // De onderhouden publieke Atom-feed blijft eerste keus. MeteoAlarm antwoordt
  // op deze Atom-route met 406 zodra we een te specifieke Accept-header sturen;
  // wildcard-Accept levert dezelfde officiële feed wel als application/atom+xml.
  // De compatibiliteits-JSON is alleen fallback en krijgt, op basis van de gemeten
  // responstijd, genoeg ruimte zonder dat beide pogingen samen de 7s-clienttimeout
  // overschrijden.`,
"MeteoAlarm uitleg");
schrijf("lib/waarschuwingen.cjs",waars);

let test=lees("prelaunch-regressions.test.js");
test=exact(test,
'ok(waars.includes("2400")&&waars.includes("timeoutMs = 6000"),"MeteoAlarm-fallbacks zijn afzonderlijk begrensd binnen de clienttimeout");',
'ok(waars.includes(\'haal(atom, "*/*", 1500)\')&&waars.includes(\'haal(compat, "application/json", 4500)\')&&waars.includes("timeoutMs = 6000"),"MeteoAlarm gebruikt gemeten Accept- en timeoutinstellingen binnen de clienttimeout");',
"statische gemeten MeteoAlarm test");
const anker=`  const warnUrls=[];const eu=await roep("./lib/waarschuwingen.cjs",{lat:"52.35",lon:"5.26",land:"NL"},async url=>{warnUrls.push(String(url));return{ok:true,text:async()=>"<?xml version=\\"1.0\\"?><feed xmlns=\\"http://www.w3.org/2005/Atom\\"></feed>"};});
  ok(eu.body.dekking===true&&eu.body.land==="NL"&&warnUrls.length===1&&warnUrls[0].includes("feeds.meteoalarm.org")&&!warnUrls.some(u=>u.includes("nominatim")||u.includes("bigdatacloud")),"meegegeven landcode voorkomt reverse-geocoding voor MeteoAlarm");`;
const extra=`  const warnUrls=[];let atomAccept=null;const eu=await roep("./lib/waarschuwingen.cjs",{lat:"52.35",lon:"5.26",land:"NL"},async (url,opt)=>{warnUrls.push(String(url));if(String(url).includes("meteoalarm-legacy-atom-"))atomAccept=opt&&opt.headers&&opt.headers.Accept;return{ok:true,text:async()=>"<?xml version=\\"1.0\\"?><feed xmlns=\\"http://www.w3.org/2005/Atom\\"></feed>"};});
  ok(eu.body.dekking===true&&eu.body.land==="NL"&&warnUrls.length===1&&warnUrls[0].includes("feeds.meteoalarm.org")&&!warnUrls.some(u=>u.includes("nominatim")||u.includes("bigdatacloud")),"meegegeven landcode voorkomt reverse-geocoding voor MeteoAlarm");
  ok(atomAccept==="*/*","MeteoAlarm Atom-aanroep gebruikt wildcard Accept om 406 te voorkomen");`;
test=exact(test,anker,extra,"dynamische Atom Accept test");
schrijf("prelaunch-regressions.test.js",test);
console.log("Gemeten MeteoAlarm-fix toegepast.");

"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const api=require("./mobile-truth-ux-20260828.js");
const graphApi=require("./mobile-graph-ux-20260828.js");

const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"public","index.html"),"utf8");
const CSS_START="/* ===== MOBILE TRUTH UX 20260828 CSS ===== */";
const CSS_EIND="/* ===== EINDE MOBILE TRUTH UX 20260828 CSS ===== */";
const JS_START="/* ===== MOBILE TRUTH UX 20260828 ===== */";
const JS_EIND="/* ===== EINDE MOBILE TRUTH UX 20260828 ===== */";
const GRAPH_CSS_START="/* ===== MOBILE GRAPH UX 20260828 CSS ===== */";
const GRAPH_CSS_EIND="/* ===== EINDE MOBILE GRAPH UX 20260828 CSS ===== */";
const GRAPH_JS_START="/* ===== MOBILE GRAPH UX 20260828 ===== */";
const GRAPH_JS_EIND="/* ===== EINDE MOBILE GRAPH UX 20260828 ===== */";
const aantal=marker=>html.split(marker).length-1;
let n=0;
function ok(voorwaarde,naam){assert.ok(voorwaarde,naam);n++;console.log("OK  "+naam);}

ok(aantal(CSS_START)===1&&aantal(CSS_EIND)===1,"mobile-truth CSS heeft exact één begin- en eindmarker in artifact");
ok(aantal(JS_START)===1&&aantal(JS_EIND)===1,"mobile-truth runtime heeft exact één begin- en eindmarker in artifact");
ok(aantal(GRAPH_CSS_START)===1&&aantal(GRAPH_CSS_EIND)===1,"mobile-graph CSS heeft exact één begin- en eindmarker in artifact");
ok(aantal(GRAPH_JS_START)===1&&aantal(GRAPH_JS_EIND)===1,"mobile-graph runtime heeft exact één begin- en eindmarker in artifact");
ok(html.indexOf("/* ===== STAFF AUDIT 20260826 ===== */")<html.indexOf(JS_START),"mobile-truth runtime volgt op staff-audit");
ok(html.indexOf(JS_START)<html.indexOf(GRAPH_JS_START)&&html.indexOf(GRAPH_JS_START)<html.indexOf("/* ---------- start ---------- */"),"mobile-graph runtime volgt mobile-truth en draait vóór startup");
ok(html.includes("kans · verwachte hoeveelheid")&&html.includes("kans · hoeveelheid onzeker")&&html.includes("Uitleg meetwaarden"),"uurtegel onderscheidt kans, echte hoeveelheid en onzekerheid expliciet");
ok(html.includes("Selecteer een punt in de grafiek voor details."),"canonieke Q4-grafiekhint blijft aanwezig");
ok(!html.includes("Temperatuur boven, neerslagperioden onder"),"mobiele UX overschrijft de canonieke Q4-grafiekhint niet");
ok(html.includes("Actieve nacht tot zonsopkomst")&&html.includes("Volgende volledige nacht"),"dubbele vannacht-labels krijgen een eenduidige fallback");
ok(typeof api.herstelNachtlabels==="function","Nachtzicht-labelherstel is via de expliciete mobile-truth API beschikbaar");
ok(html.includes('globalThis.WeatherNowMobileTruthUX20260828.herstelNachtlabels()'),"bestaande Nachtzicht-owner roept labelherstel scopeveilig via de globale API aan");
ok(!/verbeterNachtzicht\(renderData,nu,actief\);\s*herstelNachtlabels\(\);/.test(html),"bestaande Nachtzicht-owner bevat geen kale IIFE-lokale helperaanroep");
ok((html.split("const basisNachten=nachten;").length-1)===1,"mobiele grafiek-UX introduceert geen tweede Nachtzicht-owner");
ok(!html.includes("mobile-chart-return")&&!html.includes("mobile-rain-return")&&!html.includes("mobile-days-return"),"mobiele UX verplaatst geen bestaande dashboardsecties");
ok(!html.includes("regenBronPerArray")&&!html.includes("g.MM[i]=gecorrigeerd")&&!html.includes("g.Q1MM[i]=gecorrigeerd"),"mobiele UX muteert geen gedeelde Q4- of tooltiparrays");
ok(!html.includes(".dashrow-hero .stats .stat:nth-child(n)"),"mobiele UX overschrijft het bestaande mobiele metriekgrid niet");
ok(html.includes("data-mobile-hour-axis")&&html.includes("kiesUurLabelIndices"),"mobiele 24/48-uursgrafiek heeft een expliciete fallback voor ontbrekende tijdstippen");
ok(html.includes("setTimeout(voer,120)")&&html.includes("setTimeout(voer,350)"),"mobiele uuras krijgt begrensde late-layout retries voor Safari");
ok(/grid-template-columns:minmax\(0,1fr\)!important/.test(html)&&html.includes("#suntimes span{white-space:normal!important"),"zon- en daglichtinformatie kan op mobiel leesbaar over eigen regels lopen");
ok(html.includes('#nights .nacht-meer[aria-expanded="true"]::after{content:"⌃"}'),"Meer nachten bekijken heeft een zichtbare open/dicht-affordance");
ok(html.includes("Bronnen voor deze weergave")&&html.includes("waarschuwingBronnenVoorLand"),"bronnenblok filtert waarschuwingproviders op de huidige landcontext");
ok(html.includes("return Array.isArray(perioden)?perioden.slice():[];"),"mobiel labelt alle zichtbare Q4-regenperioden en laat geen losse bracket achter");

const deel=api.corrigeerLopendModeluur(4,"2026-08-28T01:00","2026-08-28T00:23");
ok(Math.abs(deel-(4*37/60))<1e-9,"lopend uur telt alleen het nog toekomstige deel mee");
ok(api.corrigeerLopendModeluur(4,"2026-08-28T00:00","2026-08-28T00:23")===null,"volledig verstreken uur telt niet mee");
ok(api.corrigeerLopendModeluur(4,"2026-08-28T02:00","2026-08-28T00:23")===4,"volledig toekomstig uur blijft ongewijzigd");

const bron=[null,4,4,2,0,1];
const bronVoor=bron.slice();
const perioden=api.regenperiodenGecorrigeerd(
  bron,
  ["2026-08-28T00:00","2026-08-28T01:00","2026-08-28T02:00","2026-08-28T03:00","2026-08-28T04:00","2026-08-28T05:00"],
  "2026-08-28T00:23"
);
ok(JSON.stringify(bron)===JSON.stringify(bronVoor),"pure regenperiodecorrectie laat bronarray onveranderd");
ok(perioden.length===2,"regenperioden blijven gescheiden door droge intervallen");
ok(perioden[0].actiefStart===true&&Math.abs(perioden[0].som-(4*37/60+6))<1e-9,"eerste actieve regenperiode gebruikt proportionele uurfractie");
ok(api.mmTekst(perioden[0].som)==="8,5","zichtbare regenperiodesom rondt pas na sommeren af");

const rand=api.regenperiodenGecorrigeerd(
  [null,0.12,0],
  ["2026-08-28T00:00","2026-08-28T01:00","2026-08-28T02:00"],
  "2026-08-28T00:55"
);
ok(rand.length===1&&Math.abs(rand[0].som-0.01)<1e-9,"lopende bronperiode blijft bestaan wanneer alleen nog minder dan 0,1 mm resteert");
ok(api.mmTekst(rand[0].som)==="<0,1","resterende spoorhoeveelheid wordt als <0,1 mm gepresenteerd");

const herfst1=api.providerSerieleMinutenNu(7200,Date.parse("2026-10-25T00:30:00Z"));
const herfst2=api.providerSerieleMinutenNu(7200,Date.parse("2026-10-25T01:30:00Z"));
ok(herfst1===api.lokaleSerieleMinuten("2026-10-25T02:30")&&herfst2===api.lokaleSerieleMinuten("2026-10-25T03:30")&&herfst2-herfst1===60,"live partiële-uurcorrectie volgt de vaste provider-as over de najaarsomslag");
ok(api.nachtPaarLabel({sunset:["2026-08-28T20:36"],sunrise:["2026-08-28T06:43","2026-08-29T06:45"]},0)==="vr–za","volgende nacht krijgt expliciet dagpaar");

const T=Array.from({length:25},(_,i)=>"2026-08-28T"+String((11+i)%24).padStart(2,"0")+":00");
const indices=graphApi.kiesUurLabelIndices(T,4);
ok(indices.length===4&&indices.every(i=>i>=2&&i<=22),"uurasfallback kiest vier verdeelde interne uurpunten en vermijdt de grafiekranden");
ok(!graphApi.isUurAsLabel("20",160,180,"DM Mono")&&graphApi.isUurAsLabel("20",200,180,"DM Mono"),"temperatuurgetal boven de plot telt niet als uurlabel, hetzelfde klokgetal onder de plot wel");
ok(graphApi.neerslagSleutelTekst("52%","De verwachte hoeveelheid is onzeker.")==="kans · hoeveelheid onzeker","kans zonder betrouwbare hoeveelheid wordt niet als tweewaardetegel voorgesteld");
ok(graphApi.neerslagSleutelTekst("52% · 0,8 mm","")==="kans · verwachte hoeveelheid","kans met zichtbare mm houdt beide grootheden expliciet");
ok(graphApi.neerslagSleutelTekst("Droog","Geen neerslag verwacht.")==="","droge tegel krijgt geen lege hoeveelheidssleutel");
ok(graphApi.waarschuwingBronnenVoorLand("NL").meteoalarm&&!graphApi.waarschuwingBronnenVoorLand("NL").nws,"Nederland toont MeteoAlarm en geen irrelevante NWS-bron");
ok(graphApi.waarschuwingBronnenVoorLand("US").nws&&!graphApi.waarschuwingBronnenVoorLand("US").meteoalarm,"VS toont NWS en geen irrelevante MeteoAlarm-bron");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
scripts.forEach((bronScript,i)=>new vm.Script(bronScript,{filename:"verify-mobile-truth-inline-"+(i+1)}));
ok(scripts.length>0,"finale inline runtime compileert");

console.log("Mobile-truth/grafiek-UX 20260828: "+n+" controles geslaagd.");

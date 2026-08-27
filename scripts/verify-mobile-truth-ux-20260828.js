"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const api=require("./mobile-truth-ux-20260828.js");

const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"public","index.html"),"utf8");
const CSS_START="/* ===== MOBILE TRUTH UX 20260828 CSS ===== */";
const CSS_EIND="/* ===== EINDE MOBILE TRUTH UX 20260828 CSS ===== */";
const JS_START="/* ===== MOBILE TRUTH UX 20260828 ===== */";
const JS_EIND="/* ===== EINDE MOBILE TRUTH UX 20260828 ===== */";
const aantal=marker=>html.split(marker).length-1;
let n=0;
function ok(voorwaarde,naam){assert.ok(voorwaarde,naam);n++;console.log("OK  "+naam);}

ok(aantal(CSS_START)===1&&aantal(CSS_EIND)===1,"mobile-truth CSS heeft exact één begin- en eindmarker in artifact");
ok(aantal(JS_START)===1&&aantal(JS_EIND)===1,"mobile-truth runtime heeft exact één begin- en eindmarker in artifact");
ok(html.indexOf("/* ===== STAFF AUDIT 20260826 ===== */")<html.indexOf(JS_START),"mobile-truth runtime volgt op staff-audit");
ok(html.indexOf(JS_START)<html.indexOf("/* ---------- start ---------- */"),"mobile-truth runtime draait vóór startup");
ok(html.includes("kans · verwachte hoeveelheid")&&html.includes("Uitleg meetwaarden"),"uurtegel en secundaire meetuitleg zijn expliciet");
ok(html.includes("Temperatuur boven, neerslagperioden onder"),"grafiek legt temperatuur en regenperioden compact uit");
ok(html.includes("Actieve nacht tot zonsopkomst")&&html.includes("Volgende volledige nacht"),"dubbele vannacht-labels krijgen een eenduidige fallback");
ok(!html.includes("mobile-chart-return")&&!html.includes("mobile-rain-return")&&!html.includes("mobile-days-return"),"mobile-truth verplaatst geen bestaande dashboardsecties");
ok(!html.includes("regenBronPerArray")&&!html.includes("g.MM[i]=gecorrigeerd")&&!html.includes("g.Q1MM[i]=gecorrigeerd"),"mobile-truth muteert geen gedeelde Q4- of tooltiparrays");
ok(!html.includes(".dashrow-hero .stats .stat:nth-child(n)"),"mobile-truth overschrijft het bestaande mobiele metriekgrid niet");

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
ok(api.nachtPaarLabel({sunset:["2026-08-28T20:36"],sunrise:["2026-08-28T06:43","2026-08-29T06:45"]},0)==="vr–za","volgende nacht krijgt expliciet dagpaar");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
scripts.forEach((bronScript,i)=>new vm.Script(bronScript,{filename:"verify-mobile-truth-inline-"+(i+1)}));
ok(scripts.length>0,"finale inline runtime compileert");

console.log("Mobile-truth-UX 20260828: "+n+" controles geslaagd.");

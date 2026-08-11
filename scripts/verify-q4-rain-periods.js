"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log("OK  "+m);};

ok(html.includes("/* ===== Q4 REGENPERIODEN 20260811 ===== */"),"Q4-laag staat in definitieve artifact");
const q4RuntimePos=html.indexOf("const q4BasisEtmaal=etmaal;");
const startupPos=html.indexOf("/* ---------- start ---------- */");
ok(q4RuntimePos>=0&&startupPos>q4RuntimePos,"Q4-runtime is actief vóór de algemene startup-router");
ok(html.includes("if(i===0)return null;"),"eerste neerslaginterval buiten grafiekvenster telt niet mee");
ok(html.includes("waarde!==null&&waarde>=0.1"),"regenperiode begint pas bij meetbare 0,1 mm");
ok(html.includes("lopend={van:i-1,tot:i"),"hoeveelheid op eindtijd wordt aan voorafgaand uurvak gekoppeld");
ok(html.includes("const bronStart=Number.isInteger(S.chartStart)?S.chartStart:null;"),"regenperioden gebruiken de exacte zichtbare bronindex");
ok(html.includes("const bron=bronStart===null?-1:bronStart+i;"),"ieder zichtbaar uur volgt forecastvolgorde zonder lokale indexOf");
ok(!html.includes("const bron=Array.isArray(h.time)?h.time.indexOf(tijd):-1;"),"Q4 gebruikt bij dubbele DST-kloktijden geen indexOf op lokale tijdtekst");
ok(html.includes("g.MM=mm;\n  g.Q1MM=mm;"),"regenstrook en tooltip krijgen exact dezelfde uitgelijnde array");
ok(html.includes("lopend.som+=waarde"),"periodetotaal is som van dezelfde uurintervallen");
ok(html.includes("waarde>lopend.piekMm"),"zwaarste uurvak komt uit dezelfde periodegegevens");
ok(html.includes('data-q4-rain-periods'),"regenperioden hebben een eigen herkenbare SVG-laag");
ok(html.includes('groep.setAttribute("pointer-events","none")'),"regenlaag kan het centrale hitvlak nooit onderscheppen");
ok(html.includes('document.createElementNS(Q4_SVG_NS,"line")'),"regenbrackets worden als echte SVG-lijnen opgebouwd");
ok(html.includes('document.createElementNS(Q4_SVG_NS,"text")'),"regensamenvatting wordt als echte SVG-tekst opgebouwd");
ok(!html.includes("groep.innerHTML=inhoud"),"Q4 gebruikt geen fragiele SVG-innerHTML-injectie meer");
ok(html.includes('el.getAttribute("fill-opacity")===".16"')&&html.includes("el.remove();"),"oude losse neerslagstaven worden na render verwijderd");
ok(html.includes("millimeter neerslag$/.test")&&html.includes("el.remove();"),"oude losse mm-labels worden na render verwijderd");
ok(html.includes('^\\d+%$')&&html.includes("x+g.cw/2"),"neerslagkanslabels worden terug op hun eigen tijdstip gecentreerd");

/* De geassembleerde artifact kan historische chartHint-assignments bevatten.
   Daarom zoeken we niet globaal naar de eerste/laatste match. De runtime-marker
   die direct vóór q4BasisEtmaal staat begrenst de echte Q4-owner; de browser-E2E
   blijft daarna het uiteindelijke zichtbare gedrag in Chromium en WebKit bewijzen. */
const q4Marker="/* ===== Q4 REGENPERIODEN 20260811 ===== */";
const q4RuntimeBegin=html.lastIndexOf(q4Marker,q4RuntimePos);
ok(q4RuntimeBegin>=0&&q4RuntimeBegin<q4RuntimePos,"Q4 runtime-marker begrenst de actieve Q4-laag");
const hintOwnerPos=html.indexOf('chartHint=function(){',q4RuntimeBegin);
ok(hintOwnerPos>q4RuntimeBegin&&hintOwnerPos<q4RuntimePos,"Q4 bezit de grafiekhint binnen zijn eigen runtime vóór startup");
const hintTekstPos=html.indexOf('el.textContent="Selecteer een punt in de grafiek voor details.";',hintOwnerPos);
ok(hintTekstPos>hintOwnerPos&&hintTekstPos<q4RuntimePos,"Q4 grafiekhint-owner bevat de input-neutrale zichtbare tekst");
ok(html.includes('<p class="hint" id="dagenhint">Kies een dag om die verwachting in de grafiek te bekijken.</p>'),"zichtbare daghint is invoermethode-neutraal");
ok(html.includes('<div class="eyebrow">Windstoten nu</div>'),"actuele windstootwaarde is ondubbelzinnig gelabeld");

/* Alleen de afgebakende senior-correctheidslaag bezit de uiteindelijke dagtekst.
   Een identieke helpertekst kan elders in de geassembleerde artifact bestaan als
   bron-/compatibiliteitslaag; die mag niet bepalen of de productowner correct is. */
const corrStart="/* ===== SENIOR CORRECTHEIDSLAAG ===== */",corrEind="/* ===== EINDE SENIOR CORRECTHEIDSLAAG ===== */";
const cs=html.indexOf(corrStart),ce=html.indexOf(corrEind,cs+corrStart.length);
ok(cs>=0&&ce>cs,"senior-correctheidslaag is eenduidig afgebakend");
const corr=html.slice(cs,ce);
ok(!corr.includes('const tijd=a.eersteTijd?" rond "+a.eersteTijd:"";'),"productowner toont geen bronminuut als schijnprecies dagmoment");
ok(corr.includes('uur<6?" in de nacht":uur<12?" in de ochtend":uur<18?" in de middag":" in de avond"'),"productowner gebruikt natuurlijke dagdelen");

ok(html.includes("minmax(140px,.72fr) 92px minmax(260px,1fr)"),"Nachtzicht geeft desktopuitleg meer ruimte dan de scorebalk");
ok(/const CACHE = "watishetweer-[0-9a-f]{12}";/.test(fs.readFileSync(path.join(__dirname,"..","public","sw.js"),"utf8")),"serviceworker houdt inhoudsgebonden Q4-cachehash");

console.log("Q4-artifactcontrole: "+n+" invarianten geslaagd.");

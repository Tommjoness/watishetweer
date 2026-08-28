"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");

const bestand=path.join(__dirname,"..","public","index.html");
assert.ok(fs.existsSync(bestand),"public/index.html ontbreekt");
const html=fs.readFileSync(bestand,"utf8");

assert.equal((html.match(/rel=\"preconnect\" href=\"https:\/\/api\.open-meteo\.com\"/g)||[]).length,1,"forecast-origin krijgt exact één preconnect");
assert.ok(!html.includes('rel="preconnect" href="https://air-quality-api.open-meteo.com"'),"niet-kritieke air-quality-origin wordt niet onnodig gepreconnect");
assert.ok(html.includes("/* ===== LCP FINAL MILE 20260828 ===== */"),"LCP final-mile marker ontbreekt");
assert.ok(html.includes('matchMedia("(max-width: 900px)").matches'),"frame-splitsing is expliciet beperkt tot de gemeten mobiele route");
assert.ok(html.includes("let nietKritiekeRenderToken=0;"),"verouderde deferred render wordt tokenmatig ongeldig gemaakt bij een nieuwe render");
assert.ok(html.includes("let mobieleLuchtRenderUitgesteld=false;"),"mobiele luchtkwaliteit heeft een expliciete deferred-rendergate");
assert.ok(html.includes("if(mobieleLuchtRenderUitgesteld&&S.air&&S.air.current)return;"),"alleen geslaagde AQI-data mag de mobiele LCP-volgorde niet inhalen; foutstatus blijft direct renderbaar");
assert.ok(!html.includes("if(mobieleLuchtRenderUitgesteld)return;"),"luchtkwaliteitfouten worden niet door een onvoorwaardelijke rendergate verborgen");
assert.ok(html.includes('requestAnimationFrame(()=>requestAnimationFrame(()=>{if(geldig())stap1();}))'),"mobiele onder-de-vouwrendering wacht bewust twee frames zodat de briefing eerst kan painten");
assert.ok(html.includes('const stap1=()=>{etmaal(startIdx,S.bereik);nowcast();volgendFrame(stap2);};'),"grafiek en nowcast vormen de eerste deferred mobiele stap");
assert.ok(html.includes('const stap2=()=>{dagen();volgendFrame(stap3);};'),"weekverwachting staat mobiel in een eigen frame");
assert.ok(html.includes('const stap3=()=>{nachten();volgendFrame(stap4);};'),"nachtzicht staat mobiel in een eigen frame");
assert.ok(/const stap4=\(\)=>\{\s*mobieleLuchtRenderUitgesteld=false;\s*lucht\(\);nuTimerStart\(\);klokTimerStart\(\);\s*\};/.test(html),"geslaagde luchtkwaliteit wordt pas na Nachtzicht vrijgegeven en timers starten daarna");
assert.ok(html.includes('etmaal(startIdx,S.bereik);nowcast();dagen();nachten();lucht();nuTimerStart();klokTimerStart();'),"desktop behoudt de bewezen directe rendersemantiek");
assert.ok(/renderNietKritiekeWeergave\(startIdx\)\{[\s\S]*?nietKritiekeRenderToken\+\+;\s*mobieleLuchtRenderUitgesteld=false;\s*etmaal\(startIdx,S\.bereik\);nowcast\(\);dagen\(\);nachten\(\);lucht\(\);nuTimerStart\(\);klokTimerStart\(\);/.test(html),"desktop heft de mobiele luchtgate expliciet op vóór directe rendering");
assert.ok(/meters\(\);briefing\(\);stempel\(\);\s*renderNietKritiekeWeergave\(startIdx\);/.test(html),"kritieke kern vult briefing vóór de viewportgebonden niet-kritieke route");
assert.ok(!/meters\(\);briefing\(\);etmaal\(startIdx,S\.bereik\);nowcast\(\);dagen\(\);nachten\(\);lucht\(\);stempel\(\);/.test(html),"oude ongescopeerde monolithische tekenAlles-route is verwijderd");

console.log("LCP final-mile 20260828: mobiele briefingpaint, directe AQI-degradatiefeedback, deterministische succesvolle AQI-render, forecast-preconnect en direct desktoprenderpad geborgd.");

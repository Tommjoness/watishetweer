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
assert.ok(html.includes("let nietKritiekeRenderToken=0;"),"verouderde deferred render wordt tokenmatig ongeldig gemaakt bij een nieuwe render");
assert.ok(html.includes('requestAnimationFrame(()=>requestAnimationFrame(()=>{if(geldig())stap1();}))'),"onder-de-vouwrendering wacht bewust twee frames zodat de briefing eerst kan painten");
assert.ok(html.includes('const stap1=()=>{etmaal(startIdx,S.bereik);nowcast();volgendFrame(stap2);};'),"grafiek en nowcast vormen de eerste deferred stap");
assert.ok(html.includes('const stap2=()=>{dagen();volgendFrame(stap3);};'),"weekverwachting staat in een eigen frame");
assert.ok(html.includes('const stap3=()=>{nachten();volgendFrame(stap4);};'),"nachtzicht staat in een eigen frame");
assert.ok(html.includes('const stap4=()=>{lucht();nuTimerStart();klokTimerStart();};'),"luchtkwaliteit en timers worden pas na de zichtbare kern gestart");
assert.ok(/meters\(\);briefing\(\);stempel\(\);\s*planNietKritiekeWeergave\(startIdx\);/.test(html),"kritieke render vult kernmetrics en briefing vóór onder-de-vouwmodules");
assert.ok(!/meters\(\);briefing\(\);etmaal\(startIdx,S\.bereik\);nowcast\(\);dagen\(\);nachten\(\);lucht\(\);stempel\(\);/.test(html),"oude monolithische initiële renderroute is verwijderd");

console.log("LCP final-mile 20260828: kritieke briefingpaint, forecast-preconnect en frame-splitting geborgd.");

"use strict";
const fs=require("fs"),path=require("path");
const p=path.join(__dirname,"browser-playwright.test.js");
let s=fs.readFileSync(p,"utf8");
const start='assert.ok(resultaat.brief&&resultaat.days>=7';
const end='await page.fill("#q","Am")';
const a=s.indexOf(start),b=s.indexOf(end,a);
if(a<0||b<0||b<=a)throw new Error("browser assertionsegment niet gevonden");
const correct=[
'assert.ok(resultaat.brief&&resultaat.days>=7,naam+" "+modus+": kerninhoud ontbreekt");',
'assert.equal(resultaat.nuTeksten.length,1,naam+" "+modus+": exact één nu-label verwacht");',
'assert.ok(/^nu -?\\d+°$/.test(resultaat.nuTeksten[0]),naam+" "+modus+": nu-label bevat actuele temperatuur");',
'assert.ok(resultaat.sunDag,naam+" "+modus+": daglabel boven zonsinformatie ontbreekt");',
'assert.equal(resultaat.uvKop,"UV-piek vandaag",naam+" "+modus+": UV-hiërarchie");',
'assert.equal(resultaat.hint,"Houd de grafiek vast voor details.",naam+" "+modus+": grafiekhint is te technisch");',
''
].join('');
s=s.slice(0,a)+correct+s.slice(b);
fs.writeFileSync(p,s);
console.log("Browserasserties atomair herbouwd.");

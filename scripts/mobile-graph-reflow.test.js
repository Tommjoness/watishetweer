"use strict";
const assert=require("assert");
const fs=require("fs");
const path=require("path");
const api=require("./mobile-graph-ux-20260828.js");

const start=api.geschatteSvgTekstBox("nu 19°",100,80,"start",12);
assert(start&&start.x===100,"Start-anchor moet op de opgegeven x beginnen.");
assert(start.y<80&&start.height>12,"Tekstbox moet de SVG-baseline conservatief omvatten.");

const midden=api.geschatteSvgTekstBox("19°",100,80,"middle",12);
assert(midden&&midden.x<100&&midden.x+midden.width>100,"Middle-anchor moet rond x centreren.");
const eind=api.geschatteSvgTekstBox("19°",100,80,"end",12);
assert(eind&&Math.abs((eind.x+eind.width)-100)<1e-9,"End-anchor moet op x eindigen.");
assert.strictEqual(api.geschatteSvgTekstBox("",100,80,"start",12),null,"Leeg label mag geen box opleveren.");

const dichtbij=api.geschatteSvgTekstBox("20°",118,80,"middle",12);
const verweg=api.geschatteSvgTekstBox("20°",220,80,"middle",12);
assert.strictEqual(api.rechthoekenBotsen(start,dichtbij,3),true,"Nabije temperatuurlabels moeten als botsing gelden.");
assert.strictEqual(api.rechthoekenBotsen(start,verweg,3),false,"Verre temperatuurlabels mogen niet als botsing gelden.");

const bron=fs.readFileSync(path.join(__dirname,"mobile-graph-ux-20260828.js"),"utf8");
assert(!/\.getBBox\s*\(/.test(bron),"Mobiele grafiekpolish mag geen uitvoerbare SVG getBBox-layoutread meer bevatten.");
assert(bron.includes("svgTekstBoxUitElement"),"Mobiele grafiekpolish moet de attribuutgebaseerde boxhelper gebruiken.");
console.log("Mobiele grafiek reflow-test groen: nu-labelbotsingen zonder uitvoerbare getBBox-read.");

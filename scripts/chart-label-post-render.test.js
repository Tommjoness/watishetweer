"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const pkg=require("../package.json");

const runtime=fs.readFileSync(path.join(__dirname,"final-consumer-polish-20260831-runtime.js"),"utf8");

assert(runtime.includes("function verfijnGrafiekLabelPosities()"),"post-render temperatuur-labelpolish ontbreekt");
assert(runtime.includes('svg.querySelectorAll("circle[data-temp-index]")'),"labelpolish moet uitsluitend bestaande gerenderde temperatuurpunten volgen");
assert(runtime.includes('text[text-anchor="middle"][font-size]'),"labelpolish moet alleen gecentreerde SVG-teksten als kandidaten bekijken");
assert(runtime.includes("if(!box||box.y<c.y)continue;"),"labels die al boven de lijn staan moeten onaangeraakt blijven");
assert(runtime.includes("if(botst)continue;"),"een bovenpositie mag alleen collisionvrij worden gebruikt");
assert(runtime.includes('box.el.setAttribute("y",kandidaat.toFixed(1))'),"de correctie mag alleen de uiteindelijke tekst-y-positie wijzigen");
assert(runtime.includes("verfijnGrafiekTypografie();verfijnGrafiekLabelPosities();"),"positiepolish moet pas na de canonieke etmaalrender en typografie draaien");
assert(!runtime.includes("getBBox("),"labelpolish mag geen synchrone SVG-fontboxmeting toevoegen");
assert(!runtime.includes("getBoundingClientRect("),"labelpolish mag geen layoutmeting toevoegen");
assert(!pkg.scripts.test.includes("apply-chart-label-consistency-20260911"),"de oude postbuild-mutatie mag niet meer in npm test zitten");
assert(!pkg.scripts.test.includes("verify-chart-label-consistency-20260911"),"de oude chart-pass verifier mag niet meer in npm test zitten");
assert(!pkg.scripts.postbuild.includes("apply-chart-label-consistency-20260911"),"de oude postbuild-mutatie mag niet meer in productie draaien");
assert(!pkg.scripts.postbuild.includes("verify-chart-label-consistency-20260911"),"de oude chart-pass verifier mag niet meer in productie draaien");

console.log("Chart-label post-render contract groen: canonieke raster/placement-render blijft eigenaar; alleen bestaande SVG-tekst mag daarna collisionvrij omhoog.");

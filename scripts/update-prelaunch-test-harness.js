"use strict";
const fs=require("fs");
const p="run.js";
let s=fs.readFileSync(p,"utf8");
function vervang(oud,nieuw){
  const n=s.split(oud).length-1;
  if(n!==1) throw new Error("run.js testfragment verwacht 1x, vond "+n+": "+oud.slice(0,80));
  s=s.replace(oud,nieuw);
}
vervang(
`    check("één opgeslagen plaats: de chiprij bevat precies één chip",\n      rij&&rij.querySelectorAll(".chip[data-i]").length===1);\n    const chip0=rij.querySelector('.chip[data-i="0"]');\n    check("iedere opgeslagen plaats bevat een verwijderknop",!!chip0&&!!chip0.querySelector(".x"));`,
`    check("één opgeslagen plaats: de chiprij bevat precies één chip",\n      rij&&rij.querySelectorAll(".chipplaats[data-i]").length===1);\n    const plaats0=rij.querySelector('.chipplaats[data-i="0"]');\n    const x0=rij.querySelector('.x[data-x="0"]');\n    check("iedere opgeslagen plaats bevat een verwijderknop",!!plaats0&&!!x0);\n    check("plaats en verwijderen zijn echte knoppen",plaats0&&plaats0.tagName==="BUTTON"&&x0&&x0.tagName==="BUTTON");`);
vervang(
`    const chipEls=rij.querySelectorAll(".chip[data-i]").sort((a,b)=>+a.dataset.i-+b.dataset.i);\n    check("meerdere opgeslagen plaatsen werken (chiprij bevat alle vier)",chipEls.length===4);\n    check("alle opgeslagen plaatsen worden in de oorspronkelijke volgorde gerenderd",\n      chipEls.map(c=>c.textContent.replace("×","")).join("|")===lijst.map(p=>p.label).join("|"),\n      chipEls.map(c=>c.textContent).join("|"));\n    check("de actieve chip behoudt de bestaande actieve class",\n      chipEls[1].classList.contains("on") && !chipEls[0].classList.contains("on"));`,
`    const plaatsEls=rij.querySelectorAll(".chipplaats[data-i]").sort((a,b)=>+a.dataset.i-+b.dataset.i);\n    const chipEls=rij.querySelectorAll(".chip").filter(c=>c.querySelector(".chipplaats[data-i]"));\n    check("meerdere opgeslagen plaatsen werken (chiprij bevat alle vier)",plaatsEls.length===4&&chipEls.length===4);\n    check("alle opgeslagen plaatsen worden in de oorspronkelijke volgorde gerenderd",\n      plaatsEls.map(c=>c.textContent).join("|")===lijst.map(p=>p.label).join("|"),\n      plaatsEls.map(c=>c.textContent).join("|"));\n    check("de actieve chip behoudt de bestaande actieve class",\n      chipEls[1].classList.contains("on") && !chipEls[0].classList.contains("on"));`);
vervang(
`    const x0=bak.chips.querySelector('.chip[data-i="0"]').querySelector(".x");`,
`    const x0=bak.chips.querySelector('.x[data-x="0"]');`);
vervang(
`    const chip0=bak.chips.querySelector('.chip[data-i="0"]');\n    chip0.dispatchEvent({type:"click",target:chip0});`,
`    const chip0=bak.chips.querySelector('.chipplaats[data-i="0"]');\n    chip0.dispatchEvent({type:"click",target:chip0});`);
vervang(
`  // bestaande keyboardbediening\n  {\n    const {api,bak}=laadKern(390);\n    api.ls.set(KL,[{lat:52.35,lon:5.26,label:"Almere"}]);\n    Object.assign(api.S,{lat:99,lon:99,label:"Elders"});\n    api.chips();\n    const chip0=bak.chips.querySelector('.chip[data-i="0"]');\n    let geblokkeerd=false;\n    chip0.dispatchEvent({type:"keydown",key:"Enter",target:chip0,preventDefault(){geblokkeerd=true;}});\n    check("bestaande keyboardbediening (Enter) blijft behouden",geblokkeerd&&api.S.lat===52.35);\n  }`,
`  // keyboardbediening is nu native browsergedrag: een echte button activeert met\n  // Enter/Spatie zonder een eigen keydown-handler. De kliksemantiek is hierboven\n  // functioneel getoetst; hier bewaken we de toegankelijke elementsemantiek.\n  {\n    const {api,bak}=laadKern(390);\n    api.ls.set(KL,[{lat:52.35,lon:5.26,label:"Almere"}]);\n    Object.assign(api.S,{lat:99,lon:99,label:"Elders"});\n    api.chips();\n    const chip0=bak.chips.querySelector('.chipplaats[data-i="0"]');\n    const x0=bak.chips.querySelector('.x[data-x="0"]');\n    check("keyboardbediening gebruikt native knopsemantiek",\n      !!chip0&&chip0.tagName==="BUTTON"&&!!x0&&x0.tagName==="BUTTON");\n  }`);
fs.writeFileSync(p,s,"utf8");
console.log("Compatibiliteitstest voor bewaarde plaatsen bijgewerkt naar native knoppen.");

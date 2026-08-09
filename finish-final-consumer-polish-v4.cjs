"use strict";
const fs=require("fs"),path=require("path");
const p=path.join(__dirname,"built-production-regressions.test.js");
let s=fs.readFileSync(p,"utf8");
function vervangLijn(zoek,nieuw){const lijn=s.split("\n").find(x=>x.includes(zoek));if(!lijn)throw new Error("Testregel niet gevonden: "+zoek);s=s.replace(lijn,nieuw);}
vervangLijn("hoge kans zonder hoeveelheid krijgt onzekerheidszin",' ok(/verwachting is daardoor onzeker|hoeveelheid (?:is )?onzeker/i.test(t),"hoge kans zonder hoeveelheid krijgt onzekerheidszin",t);ok(!/hooguit enkele druppels/i.test(t),"hoge kans zonder hoeveelheid verzint geen druppelhoeveelheid",t);');
vervangLijn("recente neerslag wordt als modelinformatie benoemd",' const {api,bak}=laadKern(390),d=bouw({nu:0,som:0});d.current.interval=900;zetBasis(api,d);api.meters();const t=tekst(bak.precsub);ok(/^Geen neerslag\.$/.test(t),"droge recente neerslag gebruikt korte consumententaal",t);ok(!/gemeten|gemodelleerd|model/i.test(t),"droge tegel toont geen technische bronterminologie",t);');
vervangLijn("windstootpiek wordt als voorafgaand uurvak getoond",' const {api,bak}=laadKern(390),d=bouw({wg:(u,dag)=>dag===0&&u===18?72:25});zetBasis(api,d);api.meters();const t=tekst(bak.gustsub);ok(/tussen 17:00 en 18:00/.test(t),"windstootpiek wordt als begrijpelijk uurvak getoond",t);ok(!/rond 18:00/.test(t),"windstootpiek wordt niet als exact tijdstip geclaimd",t);');
fs.writeFileSync(p,s);
console.log("Gebouwde consumentencontracten bijgewerkt.");

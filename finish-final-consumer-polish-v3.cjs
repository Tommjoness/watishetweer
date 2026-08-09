"use strict";
const fs=require("fs"),path=require("path");
const p=path.join(__dirname,"prelaunch-regressions.test.js");
let s=fs.readFileSync(p,"utf8");
const re=/ok\(index\.includes\('class=\\\\"zondag\\\\"'\)&&index\.includes\('Zonsopkomst '\)&&index\.includes\('zon onder '\),"zonsinformatie heeft een eigen daghiërarchie en expliciete grafieklabels"\);/;
const fallback='ok(index.includes(\'class=\\"zondag\\"\')&&index.includes(\'Zonsopkomst \')&&index.includes(\'zon onder \'),"zonsinformatie heeft een eigen daghiërarchie en expliciete grafieklabels");';
const nieuw='ok(index.includes("#suntimes .zondag")&&index.includes("Zonsopkomst ")&&index.includes("Zonsondergang ")&&index.includes("zon op ")&&index.includes("zon onder "),"zonsinformatie heeft een eigen daghiërarchie en expliciete grafieklabels");';
if(re.test(s)) s=s.replace(re,nieuw);
else if(s.includes(fallback)) s=s.replace(fallback,nieuw);
else {
  const lijn=s.split("\n").find(x=>x.includes("zonsinformatie heeft een eigen daghiërarchie"));
  if(!lijn) throw new Error("prelaunch-zonhiërarchietest niet gevonden");
  s=s.replace(lijn,nieuw);
}
fs.writeFileSync(p,s);
console.log("Prelaunch-zonhiërarchie-regressie bijgewerkt.");

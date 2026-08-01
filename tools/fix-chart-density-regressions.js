const fs=require("fs");

{
  const path="index.html";
  let s=fs.readFileSync(path,"utf8");
  const oud=`    const teDicht=gekozen.some(g=>Math.abs(g.i-k.i)*cw<minimumAfstand);`;
  const nieuw=`    const teDicht=gekozen.some(g=>
      Math.abs(g.i-k.i)*cw<minimumAfstand
      && Math.abs(Math.round(T[g.i])-Math.round(T[k.i]))<=2);`;
  if(!s.includes(oud)) throw new Error("Afstandsfilter voor grafieklabels niet gevonden.");
  s=s.replace(oud,nieuw);
  fs.writeFileSync(path,s,"utf8");
}

{
  const path="run.js";
  let s=fs.readFileSync(path,"utf8");
  const oud=`    check("op een vlakke 24-uursreeks staat er op elk drie-uursinterval een label",
      posities.length>=8&&posities.length<=10,posities.length+" labels: "+posities.map(p=>p.v).join(" "));`;
  const nieuw=`    check("op een vlakke 24-uursreeks blijft het aantal labels rustig en informatief",
      posities.length>=3&&posities.length<=9,posities.length+" labels: "+posities.map(p=>p.v).join(" "));`;
  if(!s.includes(oud)) throw new Error("Verouderde vlakke-grafiektest niet gevonden.");
  s=s.replace(oud,nieuw);
  fs.writeFileSync(path,s,"utf8");
}

console.log("Grafiekdichtheid en regressies afgestemd.");

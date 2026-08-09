"use strict";
const fs=require("fs"),path=require("path");
const R=__dirname;
function lees(p){return fs.readFileSync(path.join(R,p),"utf8");}
function schrijf(p,s){fs.writeFileSync(path.join(R,p),s);}
function rep(s,oud,nieuw,label){
  if(!s.includes(oud)) throw new Error("Niet gevonden: "+label);
  const n=s.split(oud).length-1;
  if(n!==1) throw new Error("Verwacht exact 1 match voor "+label+", kreeg "+n);
  return s.replace(oud,nieuw);
}
function rex(s,re,nieuw,label){
  const m=s.match(re); if(!m) throw new Error("Regex niet gevonden: "+label);
  return s.replace(re,nieuw);
}

let html=lees("index.html");
html=rep(html,"    --teal:#0E6E75;","    --teal:#65716C;","rustig accent licht");
html=rep(html,"    --accent-sun:#F2CE63;","    --accent-sun:var(--rule);","UV-accent neutraliseren");
html=rep(html,"    --teal:#63C9BF; --carmine:#E4707E;","    --teal:#A7AEAB; --carmine:#E4707E;","rustig accent donker");
html=rep(html,
`  #suntimes{display:flex;gap:8px 18px;align-items:center;flex-wrap:wrap}\n  #suntimes span{white-space:nowrap}`,
`  #suntimes{display:grid;grid-template-columns:repeat(3,max-content);gap:2px 18px;align-items:center;text-align:left}\n  #suntimes span{white-space:nowrap}\n  #suntimes .zondag{grid-column:1 / -1;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-25);font-weight:500}`,
"zonsinformatie-hiërarchie");
html=rep(html,
`  .night .nmeta.wide{text-align:left}`,
`  .night .nmeta.wide{text-align:left}\n  .nachtadvies,.nachtmaan{display:block}\n  .nachtmaan{margin-top:2px;color:var(--ink-25)}`,
"nachtzicht metaregels");
html=rep(html,
`  #nights{border-top:2px solid var(--accent-night)}\n  #aq{border-top:2px solid var(--accent-info)}\n  .stat.breed{border-top:2px solid var(--accent-sun)}`,
`  #nights{border-top:1px solid var(--rule)}\n  #aq{border-top:1px solid var(--rule)}\n  .stat.breed{border-top:1px solid var(--rule)}`,
"decoratieve accentlijnen neutraliseren");
html=rep(html,'<div class="stat breed"><div class="eyebrow">UV-index</div><div class="sval" id="uv">--</div><div class="ssub" id="uvsub">&nbsp;</div></div>',
'<div class="stat breed"><div class="eyebrow">UV-piek vandaag</div><div class="sval" id="uv">--</div><div class="ssub" id="uvsub">&nbsp;</div></div>',"UV-kop");

html=rep(html,
`  zetTekst("gustsub", !pg ? "Geen uurgegevens beschikbaar."\n    : pg.t>nu ? dagAanduiding(pg.t,true)+" in het uur "+weatherNowUurvak(pg.t)+" worden windstoten tot "+Math.round(pg.v)+" km/u verwacht."\n    : dagAanduiding(pg.t,true)+" viel de zwaarste windstoot in het uur "+weatherNowUurvak(pg.t)+" en bereikte die "+Math.round(pg.v)+" km/u.");`,
`  zetTekst("gustsub", !pg ? "Geen uurgegevens beschikbaar."\n    : pg.t>nu ? dagAanduiding(pg.t,true)+" tot "+Math.round(pg.v)+" km/u tussen "+weatherNowUurvak(pg.t).replace("–"," en ")+"."\n    : dagAanduiding(pg.t,true)+" maximaal "+Math.round(pg.v)+" km/u tussen "+weatherNowUurvak(pg.t).replace("–"," en ")+".");`,
"compacte windstoottekst");
html=rep(html,
`  zetTekst("pressub", dp==null ? "Geen tendens beschikbaar."\n    : Math.abs(dp)<0.15 ? "In de afgelopen drie uur nauwelijks veranderd."\n    : "In de afgelopen drie uur "+nl(Math.abs(dp))+" hPa "+(dp>0?"gestegen":"gedaald")+".");`,
`  zetTekst("pressub", dp==null ? "Geen tendens beschikbaar."\n    : Math.abs(dp)<1 ? "Vrijwel stabiel."\n    : Math.abs(dp)<2 ? "Licht "+(dp>0?"gestegen":"gedaald")+" in de afgelopen drie uur."\n    : "In de afgelopen drie uur "+nl(Math.abs(dp))+" hPa "+(dp>0?"gestegen":"gedaald")+".");`,
"luchtdruk zonder schijnprecisie");
html=rep(html,
`  set("uv", (!pu||pu.v<0.5) ? "–" : nl(pu.v));\n  zetTekst("uvsub", !pu\n    ? "UV-gegevens voor vandaag niet beschikbaar."\n    : pu.v<0.5\n      ? "Nauwelijks UV vandaag."\n      : pu.t>nu\n        ? "De UV-index piekt vandaag rond "+hhmm(pu.t)+" en is dan "+uvOordeel(pu.v)+"."\n        : "De UV-index piekte vandaag rond "+hhmm(pu.t)+" en was toen "+uvOordeel(pu.v)+".");`,
`  set("uv", !pu ? "–" : Math.round(Math.max(0,pu.v)));\n  zetTekst("uvsub", !pu\n    ? "UV-gegevens voor vandaag niet beschikbaar."\n    : pu.v<0.5\n      ? "Nauwelijks UV vandaag."\n      : "Rond "+hhmm(pu.t)+" · "+uvOordeel(pu.v)+".");`,
"UV als dagpiek");

html=rex(html,
/    const draait=hoek!==null&&hoek>45;\n    const draaiTekst=draait&&richtingPiek\?" en draait naar het "\+richtingPiek:"";\n    if\(richtingNu\) zin3="De wind komt uit het "\+richtingNu\+draaiTekst\+"\.";\n    const opvallendeWind=bm>=5\|\|\(gmax!==null&&gmax>=60\);/,
`    const opvallendeWind=bm>=5||(gmax!==null&&gmax>=60);\n    const huidigeWind=eindigGetal(c.wind_speed_10m),huidigeBft=huidigeWind===null?null:bft(Math.max(0,huidigeWind));\n    const richtingRelevant=(huidigeBft!==null&&huidigeBft>=3)||opvallendeWind;\n    const draait=richtingRelevant&&hoek!==null&&hoek>45&&bm>=3;\n    const draaiTekst=draait&&richtingPiek?" en draait naar het "+richtingPiek:"";\n    if(richtingRelevant&&richtingNu) zin3="De wind komt uit het "+richtingNu+draaiTekst+".";`,
"windrichting alleen relevant");

html=rep(html,'      const tekst=(g.op?"op ":"onder ")+hhmm(g.tijd);','      const tekst=(g.op?"zon op ":"zon onder ")+hhmm(g.tijd);',"grafiek zonlabels");
html=rep(html,
`      const nuStip=nuTemp===null?"":\`<circle cx="\${xn}" cy="\${y(nuTemp)}" r="3" fill="\${CARMINE}"/>\`;\n      nu=\`<line x1="\${xn}" y1="\${by-2}" x2="\${xn}" y2="\${pb+6}" stroke="\${CARMINE}" stroke-width="1"/>\${nuStip}\n          <text x="\${xn+4}" y="\${by+bh+13}" fill="\${CARMINE}" font-family="DM Mono,monospace" font-size="\${F.nu}">nu</text>\`;`,
`      const nuStip=nuTemp===null?"":\`<circle cx="\${xn}" cy="\${y(nuTemp)}" r="3" fill="\${CARMINE}"/>\`;\n      const nuLabelY=nuTemp===null?by+bh+13:clamp(y(nuTemp)-10,pt+F.temp,pb-4);\n      const nuLabel=nuTemp===null?"nu":"nu "+Math.round(nuTemp)+"°";\n      nu=\`<line x1="\${xn}" y1="\${by-2}" x2="\${xn}" y2="\${pb+6}" stroke="\${CARMINE}" stroke-width="1"/>\${nuStip}\n          <text x="\${xn+8}" y="\${nuLabelY}" fill="\${CARMINE}" font-family="DM Mono,monospace" font-size="\${F.nu}">\${nuLabel}</text>\`;`,
"één expliciet nu-label");
html=rep(html,
`  // 1: het huidige punt (afgeleid uit nuX, dat al eerder uit dezelfde\n  // fractionele plaatsNuIndex(TI) is berekend; geen tweede berekening nodig)\n  if(nuX!=null) zet(Math.round((nuX-pl)/cw),4);\n  // 2+3: het globale maximum en minimum binnen het zichtbare bereik`,
`  // Het actuele punt krijgt hierboven een eigen rood \"nu 25°\"-label. Reguliere\n  // modeluurpunten vlak ernaast worden hieronder onderdrukt om dubbele actuele\n  // temperaturen te voorkomen.\n  // Het globale maximum en minimum binnen het zichtbare bereik`,
"geen tweede huidig kandidaatlabel");
html=rep(html,
`  const kandidatenRuw=[...kandKaart.entries()].map(([i,rang])=>({i,rang}))\n    .sort((a,b)=>b.rang-a.rang||a.i-b.i);`,
`  if(nuX!=null){\n    for(const [idx] of [...kandKaart.entries()]){\n      if(Math.abs(x(idx)-nuX)<cw*1.05) kandKaart.delete(idx);\n    }\n  }\n  const kandidatenRuw=[...kandKaart.entries()].map(([i,rang])=>({i,rang}))\n    .sort((a,b)=>b.rang-a.rang||a.i-b.i);`,
"uurlabels rond nu onderdrukken");
html=rep(html,'    const v=k.rang===4&&nuTemp!==null?nuTemp:T[i];','    const v=T[i];',"candidate temperatuur");
html=rep(html,'    let cx=k.rang===4&&nuX!==null?nuX:x(i);','    let cx=x(i);',"candidate x");

html=rep(html,'  const zonDag=dg==null&&day.time&&day.time[di]?dagAanduiding(day.time[di],false):"";','  const zonDag=dg==null&&day.time&&day.time[di]?dagAanduiding(day.time[di],true):"";',"zon daglabel hoofdletter");
html=rep(html,
`  document.getElementById("suntimes").innerHTML=(day.sunrise[di]&&day.sunset[di])\n    ? "<span>"+(zonDag?zonDag+" · ":"")+"zonsopkomst "+hhmm(day.sunrise[di])+"</span> "\n     +"<span>zonsondergang "+hhmm(day.sunset[di])+"</span> "\n     +"<span>"+daglengte(di)+"</span>"\n    : "<span>"+daglengte(di)+"</span>";`,
`  document.getElementById("suntimes").innerHTML=(day.sunrise[di]&&day.sunset[di])\n    ? (zonDag?"<span class=\\"zondag\\">"+zonDag+"</span>":"")\n     +"<span>Zonsopkomst "+hhmm(day.sunrise[di])+"</span>"\n     +"<span>Zonsondergang "+hhmm(day.sunset[di])+"</span>"\n     +"<span>"+daglengte(di)+"</span>"\n    : (zonDag?"<span class=\\"zondag\\">"+zonDag+"</span>":"")+"<span>"+daglengte(di)+"</span>";`,
"zoninformatie losse hiërarchie");
html=rep(html,'  el2.textContent="Houd je vinger op de grafiek voor meer informatie";','  el2.textContent="Houd de grafiek vast voor details.";',"bron chart hint");

html=rep(html,
`    out+=\`<div class="row night">\n      <div class="dname">\${lbl}</div>\n      <div class="score" style="color:\${kleur}" title="Modelscore \${nl(sc)} van 10">\${Math.round(sc)}/10</div>\n      <div class="sbar"><i style="width:\${sc*10}%;background:\${kleur}"></i></div>\n      <div class="nmeta"><span class="perc">\${Math.round(cw)}%</span> bewolking</div>\n      <div class="nmeta wide">\${sc>=8.5?"Uitstekend":sc>=7?"Goed":sc>=5?"Redelijk":sc>=3.5?"Matig":"Ongunstig"} · \${venster}\${maanTekst\n        ? \` <span class="maangroep"><span class="maanbij" title="\${esc(maanTitel)}">\${maanIcoon}</span> \${maanTekst}</span>\`\n        : ""}</div></div>\`;`,
`    out+=\`<div class="row night">\n      <div class="dname">\${lbl}</div>\n      <div class="score" style="color:\${kleur}" title="Modelscore \${nl(sc)} van 10">\${Math.round(sc)}/10</div>\n      <div class="sbar"><i style="width:\${sc*10}%;background:\${kleur}"></i></div>\n      <div class="nmeta"><span class="perc">\${Math.round(cw)}%</span> bewolking</div>\n      <div class="nmeta wide"><span class="nachtadvies">\${sc>=8.5?"Uitstekend":sc>=7?"Goed":sc>=5?"Redelijk":sc>=3.5?"Matig":"Ongunstig"} · \${venster}</span>\${maanTekst\n        ? \`<span class="nachtmaan"><span class="maanbij" title="\${esc(maanTitel)}">\${maanIcoon}</span> \${maanTekst.charAt(0).toUpperCase()+maanTekst.slice(1)}</span>\`\n        : ""}</div></div>\`;`,
"nachtzicht rustiger regels");

schrijf("index.html",html);

let eng=lees("interpretatie-engine.js");
eng=rep(eng,
`  function dagSamenvatting(a){`,
`  function briefingNeerslagZin(a){\n    if(!a||!a.genoeg) return "Voor de komende twee uur ontbreken voldoende gegevens.";\n    if(a.status==="GEEN_KANS") return "De komende twee uur blijft het droog.";\n    if(a.status==="ZEER_KLEINE_KANS") return "De komende twee uur blijft het waarschijnlijk droog.";\n    if(a.status==="KLEINE_KANS") return "De komende twee uur is er een kleine kans op neerslag.";\n    if(a.status==="MOGELIJKE_NEERSLAG") return "In de komende twee uur is neerslag mogelijk.";\n    if(a.status==="GROTE_KANS_ZONDER_HOEVEELHEID") return "De komende twee uur is de neerslagkans groot, maar de hoeveelheid onzeker.";\n    return neerslagZin(a);\n  }\n\n  function dagSamenvatting(a){`,
"korte briefingneerslag");
eng=rep(eng,'      zetTekst("popsub",neerslagZin(uur));','      zetTekst("popsub",!uur.genoeg?"Neerslagkans niet beschikbaar.":kort.droog?"Geen neerslag verwacht.":neerslagZin(uur));',"kort komend uur");
eng=rep(eng,
`      zetTekst("precsub",recent===null\n        ? "Recente neerslag is niet beschikbaar."\n        : recent<=INTERPRETATIE_CONFIG.spoorMm\n          ? "Geen neerslag gemodelleerd in de afgelopen "+intervalMin+" minuten."\n          : "Modelwaarde over de afgelopen "+intervalMin+" minuten.");`,
`      zetTekst("precsub",recent===null\n        ? "Recente neerslag is niet beschikbaar."\n        : recent<=INTERPRETATIE_CONFIG.spoorMm\n          ? "Geen neerslag."\n          : "Neerslag in de afgelopen "+intervalMin+" minuten.");`,
"kort recente neerslag");
eng=rep(eng,'      let voor=esc(neerslagZin(twee));','      let voor=esc(briefingNeerslagZin(twee));',"briefing korte neerslag");
eng=rep(eng,'    if(el) el.textContent="Houd je vinger op de grafiek voor details. Een neerslagpercentage hoort bij het uur dat eindigt op het getoonde tijdstip; waarden links van ‘nu’ zijn voorbij.";','    if(el) el.textContent="Houd de grafiek vast voor details.";',"integratie chart hint");
eng=rep(eng,
`      document.querySelectorAll("#aq .stat").forEach(stat=>{\n        const kop=stat.querySelector(".eyebrow"),sub=stat.querySelector(".ssub");\n        if(kop&&sub&&/^Pollen\\s/.test(kop.textContent)) sub.textContent="Gemodelleerde concentratie";\n      });\n`,
``,
"pollen kwalitatief houden");
schrijf("interpretatie-engine.js",eng);

let pre=lees("prelaunch-regressions.test.js");
pre=rep(pre,
`ok(index.includes("nuTemp=eindigGetal(S.d.current&&S.d.current.temperature_2m)")&&index.includes("k.rang===4&&nuTemp!==null?nuTemp:T[i]"),"nu-label in grafiek gebruikt actuele temperatuur");`,
`ok(index.includes('const nuLabel=nuTemp===null?"nu":"nu "+Math.round(nuTemp)+"°"')&&index.includes("kandKaart.delete(idx)"),"grafiek toont één expliciete actuele temperatuur en onderdrukt nabije uurlabels");\nok(index.includes('UV-piek vandaag')&&index.includes('Math.round(Math.max(0,pu.v))'),"UV-tegel presenteert dagpiek zonder actuele schijnwaarde");\nok(index.includes('Math.abs(dp)<1 ? "Vrijwel stabiel."'),"kleine luchtdrukschommeling wordt consumentgericht als stabiel samengevat");\nok(index.includes('huidigeBft>=3')&&index.includes('richtingRelevant'),"zwakke wind krijgt geen irrelevante richtingsdraai in de briefing");\nok(index.includes('class=\\"zondag\\"')&&index.includes('Zonsopkomst ')&&index.includes('zon onder '),"zonsinformatie heeft een eigen daghiërarchie en expliciete grafieklabels");\nok(index.includes('--teal:#A7AEAB')&&!index.includes('--teal:#63C9BF')&&index.includes('#aq{border-top:1px solid var(--rule)}'),"normale informatie gebruikt een rustig neutraal accent in plaats van fel blauwgroen");\nok(engine.includes('briefingNeerslagZin')&&engine.includes('Geen neerslag verwacht.')&&engine.includes('? "Geen neerslag."'),"briefing en neerslagtegels gebruiken korte consumententaal zonder dubbele technische uitleg");\nok(!engine.includes('sub.textContent="Gemodelleerde concentratie"'),"pollen houdt een begrijpelijk kwalitatief oordeel");`,
"nieuwe prelaunchcontracten");
schrijf("prelaunch-regressions.test.js",pre);

let pw=lees("browser-playwright.test.js");
pw=rep(pw,
`return {labels:labels.length,bots,over:document.documentElement.scrollWidth-window.innerWidth,brief:(document.getElementById("brief")||{}).textContent||"",days:document.querySelectorAll("#days .row.day:not(.kop)").length};`,
`const nuTeksten=[...chart.querySelectorAll("text")].filter(el=>/^nu(?:\\s-?\\d+°)?$/.test((el.textContent||"").trim()));\nconst sun=document.getElementById("suntimes");\nreturn {labels:labels.length,bots,over:document.documentElement.scrollWidth-window.innerWidth,brief:(document.getElementById("brief")||{}).textContent||"",days:document.querySelectorAll("#days .row.day:not(.kop)").length,nuTeksten:nuTeksten.map(x=>x.textContent.trim()),sunDag:sun&&sun.querySelector(".zondag")?sun.querySelector(".zondag").textContent.trim():"",uvKop:(document.getElementById("uv")&&document.getElementById("uv").parentElement.querySelector(".eyebrow")||{}).textContent||"",hint:(document.getElementById("charthint")||{}).textContent||""};`,
"browserresultaat consumer polish");
pw=rep(pw,
`assert.ok(resultaat.brief&&resultaat.days>=7,naam+" "+modus+": kerninhoud ontbreekt);`,
`assert.ok(resultaat.brief&&resultaat.days>=7,naam+" "+modus+": kerninhoud ontbreekt);assert.equal(resultaat.nuTeksten.length,1,naam+" "+modus+": exact één nu-label verwacht");assert.ok(/^nu -?\\d+°$/.test(resultaat.nuTeksten[0]),naam+" "+modus+": nu-label bevat actuele temperatuur");assert.ok(resultaat.sunDag,naam+" "+modus+": daglabel boven zonsinformatie ontbreekt");assert.equal(resultaat.uvKop,"UV-piek vandaag",naam+" "+modus+": UV-hiërarchie");assert.equal(resultaat.hint,"Houd de grafiek vast voor details.",naam+" "+modus+": grafiekhint is te technisch);`,
"browserasserties consumer polish");
schrijf("browser-playwright.test.js",pw);

console.log("Final consumer polish toegepast.");

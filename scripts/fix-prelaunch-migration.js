"use strict";
const fs=require("fs");
const p="scripts/prelaunch-hardening-12.js";
let s=fs.readFileSync(p,"utf8");

// Laat exacte migraties ook veilig doorlopen wanneer een voorbereidend,
// begrensd herstel het gewenste eindfragment al heeft aangebracht.
const helper='  if(gevonden!==aantal) throw new Error(`${p}: verwacht ${aantal}× fragment, vond ${gevonden}`);';
if(s.split(helper).length-1!==1) throw new Error("Migratiehelper niet exact eenmaal gevonden");
s=s.replace(helper,'  if(gevonden===0&&s.includes(na)){return;}\n'+helper);

// Het CAP-fragment komt tweemaal voor (NWS en MeteoAlarm). De eenmalige
// migratie moet daarom exact twee exemplaren aanpassen.
const begin='vervang("lib/waarschuwingen.cjs",\n`      tot: i.expires || i.ends || null,`,';
const i=s.indexOf(begin);
if(i<0) throw new Error("NWS/CAP migratieblok niet gevonden");
const einde=s.indexOf('\nvervang("lib/waarschuwingen.cjs",',i+begin.length);
if(einde<0) throw new Error("Einde NWS/CAP migratieblok niet gevonden");
const blok=s.slice(i,einde);
if(!blok.includes('tot: i.ends || i.expires || null,')) throw new Error("Nieuwe CAP-volgorde ontbreekt in migratieblok");
if(!blok.trimEnd().endsWith('`);')) throw new Error("Onverwacht einde CAP-migratieblok");
const aangepast=blok.replace(/`\);\s*$/, '`,2);');
if(aangepast===blok) throw new Error("CAP-migratieblok kon niet begrensd worden aangepast");
s=s.slice(0,i)+aangepast+s.slice(einde);
fs.writeFileSync(p,s,"utf8");

// De startflow bevat in de bron een JavaScript-escape voor slimme quotes. Patch
// dit blok rechtstreeks op structurele grenzen, zodat Unicode-escaping geen
// onderdeel van de productmigratie hoeft te zijn.
const indexPad="index.html";
let html=fs.readFileSync(indexPad,"utf8");
const oudeC='  // C. terugkerende gebruiker: de opgeslagen plaats laadt meteen, en\n  //    tegelijkertijd loopt de actuele locatie op de achtergrond mee\n';
const nieuweC='  // C. terugkerende gebruiker: laad de laatst gekozen plaats direct. De browser\n  //    krijgt geen nieuwe locatievraag totdat de gebruiker zelf "Mijn locatie" kiest.\n';
if(html.split(oudeC).length-1!==1) throw new Error("Terugkerende-locatiekop niet exact eenmaal gevonden");
html=html.replace(oudeC,nieuweC);
const auto='    locatieNu("auto-terugkerend");\n';
if(html.split(auto).length-1!==1) throw new Error("Automatische terugkerende GPS-aanroep niet exact eenmaal gevonden");
html=html.replace(auto,"");
const dStart='  // D. eerste bezoek zonder enige bekende locatie: automatisch gps, nooit\n';
const start=html.indexOf(dStart);
if(start<0) throw new Error("Start eerste-bezoekblok niet gevonden");
const sluit='  });\n})();';
const stop=html.indexOf(sluit,start);
if(stop<0) throw new Error("Einde eerste-bezoekblok niet gevonden");
const nieuwD='  // D. eerste bezoek: geen automatische gps-prompt. De gebruiker kiest zelf\n'
  +'  //    tussen zoeken en "Mijn locatie"; dat is duidelijker en privacyvriendelijker.\n'
  +'  const st0=document.getElementById("state");\n'
  +'  st0.style.display="block";st0.className="msg";\n'
  +'  st0.textContent="Zoek hierboven een plaats of kies ‘Mijn locatie’.";\n';
html=html.slice(0,start)+nieuwD+html.slice(stop+"  });\n".length);
fs.writeFileSync(indexPad,html,"utf8");

console.log("Pre-launch migratieharnas genormaliseerd voor CAP en locatiebron.");

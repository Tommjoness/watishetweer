"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");

const ROOT=__dirname;
const indexPad=path.join(ROOT,"public","index.html");
const swPad=path.join(ROOT,"public","sw.js");

if(!fs.existsSync(indexPad)) throw new Error("Gebouwde productie-index ontbreekt.");

let html=fs.readFileSync(indexPad,"utf8");

function vervangExact(zoek,vervang,label){
  const aantal=html.split(zoek).length-1;
  if(aantal!==1) throw new Error(label+": verwacht precies één match, gevonden "+aantal+".");
  html=html.replace(zoek,vervang);
}

/* De centrale interpretatielaag verwacht veldGetal(veld, waarde). Twee aanroepen
   in de productie-integratie stonden andersom, waardoor geldige actuele en
   dagelijkse neerslag als ontbrekend konden eindigen. */
vervangExact(
  'const recent=veldGetal(c.precipitation,"precipitation");',
  'const recent=veldGetal("precipitation",c.precipitation);',
  "actuele neerslagwaarde"
);
vervangExact(
  'const dagsom=idx>=0&&dag.precipitation_sum?veldGetal(dag.precipitation_sum[idx],"precipitation_sum"):null;',
  'const dagsom=idx>=0&&dag.precipitation_sum?veldGetal("precipitation",dag.precipitation_sum[idx]):null;',
  "dagelijkse neerslagsom"
);

/* Woorden als vandaag en morgen horen bij de actuele kalenderdag van de gekozen
   locatie, niet bij het tijdstip waarop de laatste weerrespons is opgehaald. Zo
   slaat een open tabblad om 00:00 lokale tijd direct correct om. */
vervangExact(
  'const basis=/^\\d{4}-\\d{2}-\\d{2}$/.test(bronDatum)?bronDatum:plaatsVandaag();',
  'const basis=plaatsVandaag();',
  "lokale daggrens"
);

/* Ontbrekende UV-data is onbekend, niet hetzelfde als een gemeten lage UV-index. */
vervangExact(
`  zetTekst("uvsub", (!pu||pu.v<0.5)
    ? "Nauwelijks UV vandaag."
    : pu.t>nu
      ? "De UV-index piekt vandaag rond "+hhmm(pu.t)+" en is dan "+uvOordeel(pu.v)+"."
      : "De UV-index piekte vandaag rond "+hhmm(pu.t)+" en was toen "+uvOordeel(pu.v)+".");`,
`  zetTekst("uvsub", !pu
    ? "UV-gegevens voor vandaag niet beschikbaar."
    : pu.v<0.5
      ? "Nauwelijks UV vandaag."
      : pu.t>nu
        ? "De UV-index piekt vandaag rond "+hhmm(pu.t)+" en is dan "+uvOordeel(pu.v)+"."
        : "De UV-index piekte vandaag rond "+hhmm(pu.t)+" en was toen "+uvOordeel(pu.v)+".");`,
  "ontbrekende UV-data"
);

fs.writeFileSync(indexPad,html,"utf8");

/* build-weather.js maakt al een inhoudshash voor de serviceworker. Omdat deze
   hardening bewust ná die build draait, moet de cacheversie opnieuw uit de
   uiteindelijke productie-HTML worden afgeleid; anders kan een bestaande PWA
   nog een oudere app-shell vasthouden. */
if(fs.existsSync(swPad)){
  let sw=fs.readFileSync(swPad,"utf8");
  const cacheVersie="weerbriefing-"+crypto.createHash("sha256").update(html).digest("hex").slice(0,12);
  sw=sw.replace(/weerbriefing-(?:v\d+|[0-9a-f]{12})/g,cacheVersie);
  if(!sw.includes(cacheVersie)) throw new Error("Serviceworker-cacheversie kon niet worden bijgewerkt.");
  fs.writeFileSync(swPad,sw,"utf8");
}

console.log("Productie-hardening toegepast: neerslag, lokale daggrens en ontbrekende UV-data gecorrigeerd.");

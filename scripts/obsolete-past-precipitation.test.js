"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");

const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"senior-semantiek-20260810.css"),"utf8");

/* De bronmarkup bestaat nog zolang current.precipitation intern door de bestaande
   weerinterpretatie wordt gebruikt. Productmatig mag die oude tegel echter niet
   meer zichtbaar of bereikbaar zijn. Houd die twee verantwoordelijkheden apart:
   geen wijziging aan provider/formules, wel een expliciet verborgen legacy-kaart. */
assert(html.includes('id="prec"'),"verwacht legacy-neerslagelement in de bronmarkup");
assert(html.includes('id="precsub"'),"verwacht legacy-neerslagsubtekst in de bronmarkup");
assert(/\.stat:has\(#prec\)\s*\{\s*display\s*:\s*none\s*\}/.test(css),
  "de obsolete tegel 'Afgelopen 15 minuten' moet als volledige stat verborgen zijn");

console.log("Obsolete neerslagtegel is productmatig verborgen zonder de weerlogica te wijzigen.");

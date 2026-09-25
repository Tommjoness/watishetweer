"use strict";

/* Cloudflare's scriptmonitoring (Web assets > Client-side resources, voorheen
   Page Shield) stuurt op een steekproef van responses een
   Content-Security-Policy-Report-Only-header mee met een lege scriptlijst. De
   browser laadt alles gewoon, maar meldt iedere script- en verbindingsbron aan
   Cloudflare. WebKit zet die meldingen als "[Report Only] Refused to …" in de
   console. Ze blokkeren niets en komen niet uit de CSP van deze site: die is
   afdwingend, en een echte overtreding daarvan verschijnt zonder
   "[Report Only]". Productiemonitors tellen deze meldingen daarom niet als
   fout, maar loggen hoeveel er waren. */
const ALLEEN_GEMELD=/^\s*\[Report Only\]/;

function isAlleenGemeld(tekst){
  return ALLEEN_GEMELD.test(String(tekst||""));
}

/* Splitst consolefouten in echte fouten en alleen-gemelde CSP-meldingen. */
function scheidConsoleFouten(teksten){
  const fouten=[],gemeld=[];
  for(const t of teksten||[])(isAlleenGemeld(t)?gemeld:fouten).push(t);
  return {fouten,gemeld};
}

function logAlleenGemeld(label,aantal){
  if(aantal>0)console.log(`${label}: ${aantal} Report-Only-CSP-melding(en) van Cloudflare-scriptmonitoring genegeerd (blokkeren niets).`);
}

module.exports={isAlleenGemeld,scheidConsoleFouten,logAlleenGemeld};

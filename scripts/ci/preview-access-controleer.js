"use strict";

/* Toegangsgrens van het PR-previewproject (SEC-02, Cloudflare Access).

   PR-code wordt als Pages Functions uitgerold. Een preview-URL is standaard publiek (Cloudflare-documentatie), pas
   het toegangsbeleid van het project zet Cloudflare Access ervoor. Een controle ná de deploy komt te laat: dan
   heeft een verkeerd geconfigureerd project de PR-code al publiek bereikbaar gemaakt.

   Deze controle draait daarom in twee fases, zonder Cloudflare-credentials en zonder iets uit te rollen:

   - VOORAF (vóór `wrangler pages deploy`): er wordt niets uitgerold, maar Access beslist op hostnaam. Een host die
     nog niet bestaat moet daarom al naar Cloudflare Access doorsturen als het wildcard-beleid
     (*.<project>.pages.dev) actief is. Gecontroleerd worden de exacte branchalias van deze PR en een willekeurige,
     nooit gebruikte hash-host (de vorm van een onveranderlijke deployment-URL). Beide moeten naar
     *.cloudflareaccess.com doorsturen. Een 404 van Pages, een 200 of een netwerkfout is "niet bewezen" en stopt de
     workflow (fail-closed).
   - NA de deploy (`--url`): dezelfde eisen voor de werkelijke onveranderlijke URL.

   In beide fases geldt voor de projectalias `<project>.pages.dev`, die Cloudflare niet door het previewbeleid
   beschermt: zij mag geen inhoud (2xx) tonen. Doorsturen naar Access of een 4xx/5xx is toegestaan.

   Dit bestand is puur (alleen `fetch` is injecteerbaar) zodat het testbaar is. */

const crypto = require("crypto");
const { PRODUCTIEPROJECT, PREVIEWBRANCH } = require("./preview-isolatie-controleer.js");

const ACCESS_DOORSTUUR = /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com\//;
const PROJECTNAAM = /^[a-z0-9][a-z0-9-]{0,56}$/;
const ONVERANDERLIJKE_URL = /^https:\/\/[a-z0-9]+\.([a-z0-9-]+)\.pages\.dev\/?$/;

function routes({ project, branch, url, hash = crypto.randomBytes(4).toString("hex") }) {
  const lijst = [
    { naam: "branchalias", url: `https://${branch}.${project}.pages.dev/`, eis: "access" },
    { naam: "onveranderlijke deployment-URL (vorm)", url: `https://${hash}.${project}.pages.dev/`, eis: "access" },
    { naam: "projectalias", url: `https://${project}.pages.dev/`, eis: "geen-inhoud" }
  ];
  if (url) lijst.splice(2, 0, { naam: "onveranderlijke deployment-URL", url: url.replace(/\/?$/, "/"), eis: "access" });
  return lijst;
}

/* waarnemingen: [{ naam, url, eis, status, location, fout }] -> lijst met fouten (leeg = bewezen) */
function beoordeel(waarnemingen) {
  const f = [];
  for (const w of waarnemingen) {
    const waar = `${w.naam} (${w.url})`;
    if (w.fout) { f.push(`${waar}: niet te controleren (${w.fout}); zonder bewijs wordt er niets uitgerold`); continue; }
    const doorgestuurdNaarAccess = w.status >= 300 && w.status < 400 && ACCESS_DOORSTUUR.test(String(w.location || ""));
    if (w.eis === "access") {
      if (!doorgestuurdNaarAccess) f.push(`${waar}: stuurt niet door naar Cloudflare Access (status ${w.status}); het toegangsbeleid van het previewproject is niet actief of dekt deze host niet`);
    } else if (w.status >= 200 && w.status < 300) {
      f.push(`${waar}: toont publiek inhoud (status ${w.status}); de projectalias mag geen previewcode serveren`);
    } else if (w.status >= 300 && w.status < 400 && !doorgestuurdNaarAccess) {
      f.push(`${waar}: stuurt door naar iets anders dan Cloudflare Access (status ${w.status})`);
    }
  }
  return f;
}

async function waarneem(route, haal) {
  for (let poging = 1; poging <= 2; poging++) {
    try {
      const r = await haal(route.url, { redirect: "manual", method: "GET", headers: { accept: "text/html" }, signal: AbortSignal.timeout(20000) });
      return { ...route, status: r.status, location: r.headers.get("location") || "" };
    } catch (e) {
      if (poging === 2) return { ...route, fout: String((e && e.cause && e.cause.code) || (e && e.message) || e).slice(0, 80) };
    }
  }
}

function leesArgumenten(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 2) a[argv[i].replace(/^--/, "")] = argv[i + 1];
  return a;
}

async function controleer({ project, branch, url, haal = fetch, hash, log = console.log }) {
  if (!PROJECTNAAM.test(String(project || ""))) return [`ongeldige projectnaam: ${project}`];
  if (project === PRODUCTIEPROJECT) return [`previewcontrole mag niet op het productieproject (${PRODUCTIEPROJECT}) draaien`];
  if (!PREVIEWBRANCH.test(String(branch || ""))) return [`previewbranch moet pr-<nummer> zijn (kreeg: ${branch})`];
  if (url) {
    const m = ONVERANDERLIJKE_URL.exec(String(url));
    if (!m || m[1] !== project) return [`preview-URL ${url} hoort niet bij project ${project}`];
  }
  const waarnemingen = [];
  for (const route of routes({ project, branch, url, hash })) waarnemingen.push(await waarneem(route, haal));
  for (const w of waarnemingen) {
    const kort = w.fout ? `fout: ${w.fout}` : `${w.status} ${String(w.location || "").split("?")[0]}`.trim();
    log(`${w.naam}: ${kort}`);
  }
  return beoordeel(waarnemingen);
}

async function main(argv) {
  const a = leesArgumenten(argv);
  const fouten = await controleer({ project: a.project, branch: a.branch, url: a.url });
  if (fouten.length) {
    console.error("Cloudflare Access beschermt het previewproject NIET aantoonbaar" + (a.url ? "" : "; er wordt geen PR-code uitgerold") + ":");
    for (const x of fouten) console.error(`- ${x}`);
    return 1;
  }
  console.log(`Cloudflare Access beschermt ${a.project} voor ${a.branch}` + (a.url ? " (inclusief de uitgerolde deployment)." : " (vooraf bewezen)."));
  return 0;
}

if (require.main === module) main(process.argv.slice(2)).then(code => process.exit(code));

module.exports = { controleer, beoordeel, routes, ACCESS_DOORSTUUR };

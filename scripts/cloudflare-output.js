"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const cloudflareDir = path.join(root, "cloudflare");

for (const naam of ["_headers", "_routes.json", "404.html"]) {
  const bron = path.join(cloudflareDir, naam);
  const doel = path.join(publicDir, naam);
  if (!fs.existsSync(bron)) throw new Error(`Cloudflare-bron ontbreekt: ${naam}`);
  fs.copyFileSync(bron, doel);
}

for (const naam of ["functions", "cloudflare"]) {
  const ongewenst = path.join(publicDir, naam);
  if (fs.existsSync(ongewenst)) throw new Error(`Platformbroncode staat nog in public/: ${naam}`);
}

function verifieerPublicatie(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const naam = entry.name;
    if (naam.startsWith(".") || /\.(?:key|pem|p12|pfx)$/i.test(naam) || naam === "wrangler.jsonc") {
      throw new Error(`Gevoelig bestand mag niet in public/: ${path.relative(publicDir, path.join(dir, naam))}`);
    }
    /* Repositorydocumentatie (runbooks, audits, commerciële baseline) hoort niet
       op het productiedomein. Geen enkele publieke route serveert Markdown. */
    if ((entry.isFile() && /\.md$/i.test(naam)) || (entry.isDirectory() && dir === publicDir && naam === "docs")) {
      throw new Error(`Interne documentatie mag niet in public/: ${path.relative(publicDir, path.join(dir, naam))}`);
    }
    if (entry.isDirectory()) verifieerPublicatie(path.join(dir, naam));
  }
}

verifieerPublicatie(publicDir);
console.log("Cloudflare buildoutput gereed.");

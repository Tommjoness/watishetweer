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

console.log("Cloudflare buildoutput gereed.");

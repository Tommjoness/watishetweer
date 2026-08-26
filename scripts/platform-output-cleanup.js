"use strict";

const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "..", "public");
for (const naam of ["functions", "cloudflare"]) {
  fs.rmSync(path.join(publicDir, naam), { recursive: true, force: true });
}

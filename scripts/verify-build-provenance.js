"use strict";

const path=require("path");
const {bepaalSha,controleerProvenance}=require("./apply-build-provenance.js");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const verwacht=bepaalSha();
const {paginas,sitemap}=controleerProvenance(OUT,verwacht);
const cache=verifieerServiceworkerCache(OUT,"build-provenance-verifier");
console.log(`Build-provenance geverifieerd op ${paginas} HTML-artifacts (alle ${sitemap} sitemap-pagina's inbegrepen): ${verwacht}; cache ${cache}.`);

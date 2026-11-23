"use strict";

/* Artifactcontrole G2-typografie: iedere publieke pagina (niet admin) heeft
   precies één G2-laag met de kernregels, en de homepage preloadt Instrument
   Sans 600 in plaats van Bodoni Moda. */
const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,STYLE_ID,doelpagina}=require("./apply-g2-typografie-20261123.js");
const {htmlBestanden}=require("./apply-kleur-20261012.js");

let n=0;
for(const p of htmlBestanden(OUT)){
  const rel=path.relative(OUT,p);
  const html=fs.readFileSync(p,"utf8");
  if(!doelpagina(rel)){assert(!html.includes(`id="${STYLE_ID}"`),rel+": admin en 404 horen geen G2-laag te krijgen");continue;}
  const blokken=html.split(`<style id="${STYLE_ID}">`).length-1;
  assert.equal(blokken,1,rel+": G2-typografielaag moet precies één keer staan ("+blokken+")");
  const css=html.split(`<style id="${STYLE_ID}">`)[1].split("</style>")[0];
  for(const regel of ["--serif:var(--sans)!important","--display:'Newsreader','Newsreader Fallback Georgia','Newsreader Fallback','Newsreader Fallback Noto',","font-family:var(--display)!important","src:url('/newsreader-latin-500-normal.woff2')","font-family:'Newsreader Fallback';src:local('Times New Roman')",'svg text[font-family*="Bodoni"]',"text-transform:none!important","font-weight:400!important","font-weight:600!important","font-size:12px!important"])
    assert(css.includes(regel),rel+": G2-regel ontbreekt: "+regel);
  n++;
}
assert(n>=190,"te weinig pagina's met G2-laag: "+n);
const home=fs.readFileSync(path.join(OUT,"index.html"),"utf8");
for(const w of [400,500])assert(home.includes(`rel="preload" href="/newsreader-latin-${w}-normal.woff2"`),"homepage preloadt Newsreader "+w+" niet");
for(const w of [400,500])assert(fs.existsSync(path.join(OUT,`newsreader-latin-${w}-normal.woff2`)),"Newsreader "+w+" ontbreekt in het artifact");
assert(!home.includes('rel="preload" href="/bodoni-moda-latin-400-normal.woff2"'),"homepage preloadt Bodoni nog");
console.log("G2-typografie geverifieerd op "+n+" pagina's: één letter, geen hoofdletterkopjes, grote cijfers 400, minimaal 12px; Newsreader 400/500 gepreload, Bodoni niet.");

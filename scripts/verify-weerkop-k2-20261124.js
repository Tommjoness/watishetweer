"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,htmlBestanden,gebundeldeWeerpagina}=require("./apply-kleur-20261012.js");
const {STYLE_ID,RAIL_KOP}=require("./apply-weerkop-k2-20261124.js");

/* Kop van de weerpagina's (K2, eigenaar 24 november): op iedere weerpagina precies
   één K2-stijllaag; de bovenbalk begint met het menu en daarna het logo; geen
   snelkoppeling Nachtzicht meer; Licht/Auto/Donker (#thema) staat in het
   menupaneel onder de vier groepen; de zijbalkkop "Snel naar" staat vooraan in
   het paneel; alleen de homepage-h1 "watishetweer.nl" is visueel verborgen. */
const tel=(h,s)=>h.split(s).length-1;
let n=0,home=0;
for(const p of htmlBestanden(OUT)){
  const rel=path.relative(OUT,p),html=fs.readFileSync(p,"utf8");
  if(rel.split(path.sep).includes("admin")||!gebundeldeWeerpagina(html))continue;
  assert.equal(tel(html,`id="${STYLE_ID}"`),1,rel+": K2-stijllaag niet exact eenmaal");
  assert.equal(tel(html,"wiw-snel-nachtzicht\""),0,rel+": snelkoppeling Nachtzicht staat er nog");
  const b0=html.indexOf('<div class="wiw-bovenbalk">');
  assert(b0>=0,rel+": bovenbalk ontbreekt");
  assert(html.startsWith('<div class="wiw-bovenbalk"><details class="wiw-menu" id="wiw-menu">',b0),rel+": bovenbalk begint niet met het menu");
  const menuEind=html.indexOf("</nav></details>",b0);
  assert(html.startsWith('<a class="wiw-sk-merk wiw-weer-merk" href="/" translate="no" aria-label="watishetweer.nl">',menuEind+"</nav></details>".length),rel+": logo staat niet direct na het menu");
  const paneel=html.slice(b0,menuEind);
  assert.equal(tel(paneel,RAIL_KOP),1,rel+": zijbalkkop 'Snel naar' ontbreekt in het menupaneel");
  assert.equal(tel(paneel,'<details class="wiw-menu-groep" name="wiw-menu-groep">'),4,rel+": verwacht vier menugroepen");
  const w=paneel.indexOf('<div class="wiw-weergave-boven">');
  assert(w>paneel.lastIndexOf("</ul></details>")&&paneel.includes('id="thema"',w),rel+": weergavekeuze staat niet in het menupaneel onder de groepen");
  assert.equal(tel(html,'id="thema"'),1,rel+": weergavekeuze niet precies eenmaal");
  assert(!html.includes('<a href="#nachtzicht">')||paneel.includes('<a href="#nachtzicht">'),rel+": Nachtzicht vanavond ontbreekt in het menu");
  assert(html.includes('id="nachtzicht"'),rel+": anker #nachtzicht ontbreekt");
  if(html.includes('<h1 class="wiw-h1-verborgen">watishetweer.nl</h1>')){home++;assert.equal(rel,"index.html",rel+": h1 verborgen op een andere pagina dan de homepage");}
  else assert(!html.includes("wiw-h1-verborgen\">"),rel+": verborgen h1 met andere tekst");
  assert.equal(tel(html,"<h1"),1,rel+": niet precies één h1");
  n++;
}
assert(n>=100,"te weinig weerpagina's met K2: "+n);
assert.equal(home,1,"homepage-h1 niet precies eenmaal verborgen");
console.log(`Weerkop K2 geverifieerd op ${n} weerpagina's: menu en logo in de bovenbalk, geen snelkoppeling Nachtzicht, weergavekeuze en 'Snel naar' in het menupaneel, homepage-h1 alleen voor zoekmachines.`);

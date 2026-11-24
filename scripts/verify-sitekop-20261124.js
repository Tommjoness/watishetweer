"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,htmlBestanden}=require("./apply-kleur-20261012.js");
const {STYLE_ID,KOP_ID,SCRIPT_NAAM,SCRIPT_BRON,isSubpagina}=require("./apply-sitekop-20261124.js");
const {SEIZOENSPAGINAS}=require("./seizoenspagina.config.js");
const NZ=require("./nachtzicht.config.js");

/* Gedeelde kop (K1): iedere subpagina precies één kop met menu, logo en weergavekeuze in het menu;
   geen eigen kopregels of weergavebalken meer; weerpagina's ongewijzigd. */
const DOELEN=["/","/weer/","/#nachtzicht",NZ.BASIS,NZ.MAAN,"/over/","/privacy","/contact/",...SEIZOENSPAGINAS.map(p=>`/${p.slug}/`)];
const tel=(h,s)=>h.split(s).length-1;
let sub=0,weer=0;
assert.equal(fs.readFileSync(path.join(OUT,SCRIPT_NAAM),"utf8"),SCRIPT_BRON,"sitekopscript ontbreekt of wijkt af");
for(const p of htmlBestanden(OUT)){
  const rel=path.relative(OUT,p),html=fs.readFileSync(p,"utf8");
  if(rel.split(path.sep).includes("admin"))continue;
  if(!isSubpagina(html,rel)){
    assert(!html.includes(`id="${KOP_ID}"`)&&!html.includes(`id="${STYLE_ID}"`),rel+": weerpagina kreeg de sitekop");
    weer++;continue;
  }
  assert.equal(tel(html,`id="${KOP_ID}"`),1,rel+": sitekop niet exact eenmaal");
  assert.equal(tel(html,`id="${STYLE_ID}"`),1,rel+": sitekopstijl niet exact eenmaal");
  assert.equal(tel(html,`<script src="/${SCRIPT_NAAM}" defer></script>`),1,rel+": sitekopscript niet exact eenmaal");
  assert(/<body[^>]*><header class="wiw-sitekop" id="wiw-sitekop"><details class="wiw-menu" id="wiw-menu">/.test(html),rel+": sitekop is niet het eerste element, of het menu staat niet links");
  const k0=html.indexOf(`id="${KOP_ID}"`),k1=html.indexOf("</header>",k0),kop=html.slice(k0,k1);
  for(const d of DOELEN)assert(kop.includes(`<a href="${d}">`),rel+": menu mist de link naar "+d);
  assert.equal(tel(kop,'<details class="wiw-menu-groep" name="wiw-menu-groep">'),4,rel+": verwacht vier menugroepen");
  assert(kop.includes('class="wiw-sk-logo"')&&kop.includes('<circle')&&kop.includes('class="wiw-sk-merk" href="/" translate="no"'),rel+": logo (zonneboog met stip) of merklink ontbreekt");
  const w0=kop.indexOf('class="wiw-sk-weergave"');
  assert(w0>kop.lastIndexOf("</ul></details>")&&w0<kop.indexOf("</nav>"),rel+": weergavekeuze staat niet in het menupaneel onder de groepen");
  const weergave=kop.slice(w0);
  const knoppen=tel(weergave,"data-keuze=");
  assert.equal(knoppen,3,rel+": weergavekeuze heeft geen drie knoppen in het menu");
  /* Nergens anders een weergavebalk of eigen kopregel. */
  assert.equal(tel(html,'id="thema"'),tel(kop,'id="thema"'),rel+": weergavekeuze staat ook buiten het menu");
  assert.equal(tel(html,"data-maan-thema=\""),tel(kop,"data-maan-thema=\""),rel+": maanknoppen staan ook buiten het menu");
  for(const oud of ['class="hub-top"','class="nz-maan-bovenbalk"','class="wk-header"','class="wk-theme"','name="wk-thema"'])
    assert(!html.includes(oud),rel+": oude kop of weergavebalk staat er nog: "+oud);
  const terug=/>\s*← Terug naar het weer\s*</.test(html),park=/>\s*← Alle Nationale Parken\s*</.test(html);
  assert(terug||park,rel+": geen weg terug naar het weer (of naar de parken)");
  sub++;
}
assert(sub>=25,"te weinig subpagina's met de sitekop: "+sub);
assert(weer>=100,"te weinig weerpagina's gecontroleerd: "+weer);
for(const r of ["weer/index.html","maan/index.html","witte-kerst/index.html","oud-en-nieuw/index.html","contact/index.html","over/index.html","privacy.html","nachtzicht/index.html"]){
  const f=path.join(OUT,r);assert(fs.existsSync(f),"ontbreekt: "+r);
  assert(fs.readFileSync(f,"utf8").includes(`id="${KOP_ID}"`),r+": geen sitekop");
}
console.log(`Sitekop geverifieerd op ${sub} subpagina's (menu links, logo, weergavekeuze in het menu, weg terug) en afwezig op ${weer} weerpagina's.`);

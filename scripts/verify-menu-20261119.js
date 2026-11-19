"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {OUT,htmlBestanden,gebundeldeWeerpagina}=require("./apply-kleur-20261012.js");
const {STYLE_ID}=require("./apply-menu-20261119.js");
const BOVENBALK_STYLE_ID=require("./apply-bovenbalk-20261118.js").STYLE_ID;
const VOET_STYLE_ID=require("./apply-voet.js").STYLE_ID;
const {SEIZOENSPAGINAS}=require("./seizoenspagina.config.js");
const NZ=require("./nachtzicht.config.js");

/* Menu (UI PR #2): op iedere gebundelde weerpagina staat precies één menu als
   eerste element van de bovenbalk, met alle bestaande bestemmingen als
   crawlbare links; de seizoens- en nachtlinks staan niet meer in de footer,
   terwijl bronnen, disclaimer, Over, Privacy, technische gegevens en contact
   er wel blijven; de menuruntime zit in de gedeelde app-bundle. */
const DOELEN=["/","/weer/","#nachtzicht",NZ.BASIS,NZ.MAAN,"/over/","/privacy","mailto:support@watishetweer.nl",...SEIZOENSPAGINAS.map(p=>`/${p.slug}/`)];
let gezien=0;const bundels=new Set();
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!gebundeldeWeerpagina(html))continue;
  const rel=path.relative(OUT,p),tel=s=>html.split(s).length-1;
  assert.equal(tel('id="wiw-menu"'),1,rel+": menu niet exact eenmaal aanwezig");
  assert.equal(tel(`id="${STYLE_ID}"`),1,rel+": menustijl niet exact eenmaal aanwezig");
  assert(html.includes('<div class="wiw-bovenbalk"><details class="wiw-menu" id="wiw-menu">'),rel+": menu is niet het eerste element van de bovenbalk");
  const m0=html.indexOf('id="wiw-menu"'),m1=html.indexOf("</details>",m0),menu=html.slice(m0,m1);
  assert(m0<html.indexOf('id="thema"'),rel+": menu staat niet vóór de weergavekeuze");
  assert(!menu.includes('id="thema"'),rel+": weergavekeuze staat in het menu");
  for(const d of DOELEN)assert(menu.includes(`<a href="${d}">`),rel+": menu mist de link naar "+d);
  for(const kop of ["Weer en plaatsen","Sterren en nacht","Seizoenen en feestdagen","Over en informatie"])assert(menu.includes(">"+kop+"<"),rel+": menugroep ontbreekt: "+kop);
  const v0=html.indexOf("<footer"),voet=html.slice(v0,html.indexOf("</footer>",v0));
  assert(!voet.includes("seizoen-link"),rel+": footer bevat nog seizoens- of nachtlinks");
  for(const v of ["Open-Meteo","Weersinformatie is algemeen",'<a href="/over/">Over deze site</a>','<a href="/privacy">Privacy &amp; gegevens</a>',"footer-details","mailto:support@watishetweer.nl"])
    assert(voet.includes(v),rel+": footer mist "+v);
  const kop=html.slice(0,html.indexOf("</head>"));const stijlen=[...kop.matchAll(/<style([^>]*)>/g)].map(m=>m[1]);
  assert(stijlen.pop().includes(`id="${VOET_STYLE_ID}"`),rel+": voetlaag is niet meer de laatste stijllaag");
  assert(stijlen.pop().includes(`id="${STYLE_ID}"`),rel+": menustijl staat niet direct vóór de voetlaag");
  assert(stijlen.pop().includes(`id="${BOVENBALK_STYLE_ID}"`),rel+": bovenbalklaag staat niet direct vóór de menustijl");
  const b=html.match(/<script src="\/(app-[0-9a-f]{12}\.min\.js)"/);if(b)bundels.add(b[1]);
  gezien++;
}
assert(gezien>=100,"te weinig weerpagina's met het menu: "+gezien);
assert.equal(bundels.size,1,"weerpagina's delen niet één app-bundle: "+[...bundels].join(", "));
const bundel=fs.readFileSync(path.join(OUT,[...bundels][0]),"utf8");
assert(bundel.includes("wiw-menu-rail")&&bundel.includes("wiw-menu"),"menuruntime ontbreekt in de app-bundle");
console.log(`Menu geverifieerd op ${gezien} weerpagina's: één menu vooraan in de bovenbalk met ${DOELEN.length} bestemmingen, footer zonder seizoens- en nachtlinks, runtime in ${[...bundels][0]}.`);

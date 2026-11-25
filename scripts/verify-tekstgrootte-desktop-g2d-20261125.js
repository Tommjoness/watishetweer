"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const CleanCSS=require("clean-css");
const {OUT,htmlBestanden}=require("./apply-kleur-20261012.js");
const G=require("./apply-tekstgrootte-desktop-g2d-20261125.js");

/* G2-D (eigenaar 25 november, optie B): controle op het finale artifact.
   - iedere pagina met px-lettergroottes in haar CSS draagt het merkteken precies eenmaal;
   - iedere desktopkopie staat in @media (min-width:1100px) en volgt direct op haar origineel;
   - geen kopie binnen een @media die op desktop nooit geldt (max-width < 1100px);
   - geen kopie voor displaymaten (>= 36px) of schermlezermaten (< 11px);
   - alle CSS blijft syntactisch geldig (clean-css zonder fouten);
   - de stap is idempotent: nogmaals toepassen verandert niets. */
const MEDIA="@media (min-width:1100px){";
const tel=(h,s)=>h.split(s).length-1;
let paginas=0,kopieen=0;
for(const p of htmlBestanden(OUT)){
  const rel=path.relative(OUT,p);
  if(rel.split(path.sep).includes("admin"))continue;
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(G.STYLE_MARKER))continue;
  paginas++;
  assert.equal(tel(html,`id="${G.STYLE_MARKER}"`),1,rel+": G2-D-merkteken niet exact eenmaal");
  assert.equal(G.pasToe(html).html,html,rel+": G2-D is niet idempotent");
  for(const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)){
    const css=m[1];
    const res=new CleanCSS({level:0,inline:false}).minify(css);
    assert.deepEqual(res.errors,[],rel+": ongeldige CSS na G2-D: "+res.errors.join("; "));
    let i=0;
    while((i=css.indexOf(MEDIA,i))>=0){
      kopieen++;
      const blok=css.slice(i,css.indexOf("}}",i)+2);
      for(const w of blok.matchAll(/(?:font-size|--wiw-t-[a-z-]+):(\d+(?:\.\d+)?)px/g)){
        const v=parseFloat(w[1]);
        assert(v>=G.KLEIN_TOT*G.FACTOR-0.5&&v<G.GROOT_VANAF*G.FACTOR,rel+": onverwachte desktopmaat "+v+"px in "+blok.slice(0,120));
      }
      i+=MEDIA.length;
    }
  }
  /* Geen kopie binnen mobiele/tabletmedia: zoek @media(max-width:<1100) blokken die een G2-D-kopie bevatten. */
  for(const m of html.matchAll(/@media[^{]*max-width\s*:\s*(\d+)px[^{]*\{/g)){
    if(+m[1]>=G.DESKTOP_VANAF)continue;
    const start=m.index+m[0].length;let d=1,j=start;
    while(j<html.length&&d>0){if(html[j]==="{")d++;else if(html[j]==="}")d--;j++;}
    assert(!html.slice(start,j).includes(MEDIA),rel+": G2-D-kopie binnen een mobiele @media (max-width:"+m[1]+"px)");
  }
}
assert(paginas>=100,"Te weinig pagina's met G2-D: "+paginas);
assert(kopieen>=paginas*20,"Verdacht weinig G2-D-kopieën: "+kopieen);
console.log(`G2-D geverifieerd: ${paginas} pagina's, ${kopieen} desktopkopieën vanaf ${G.DESKTOP_VANAF}px (x${G.FACTOR}), geldige CSS, idempotent, niets binnen mobiele media.`);

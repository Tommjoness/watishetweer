"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-ronde2-20261007";

/* Ontwerpronde 2 (akkoord eigenaar 7 oktober op voor/na-beelden):
   1. Donkere modus: geen puur zwart en grijs meer, maar een iets warmere,
      licht groengetinte ondergrond die past bij de inkt van het lichte thema
      (en bij de theme-color #0B120F die de app al gebruikte), met gebroken wit
      als tekst. De secundaire grijzen blijven minstens zo licht als na de
      leesbaarheidsronde (#A8A8A8/#959595), zodat het contrast niet daalt.
      Geldt voor iedere pagina met een donker thema; alleen de
      themavariabelen veranderen, dus elke pagina behoudt haar eigen opbouw.
   2. De stip van nu op de dagbalk van vandaag (de dagrenderer zet hem als
      .nu-stip in de balk), in karmijn zoals de nu-lijn in de grafiek.
   3. Zachte overgangen: kleur bij aanwijzen en tikken, en de dag- en
      zichtscorebalken die rustig verschijnen. Alleen kleur en doorzichtigheid,
      nooit maat of positie, dus geen verschuiving van de opmaak. Wie op het
      apparaat minder beweging heeft ingesteld, krijgt geen overgangen.
   De nieuwe iconenset staat in de iconfunctie van de app zelf. */
const CSS=`
html[data-thema=donker]{--paper:#0C0F0E;--sheet:#131716;--ink:#E9E7E2;--ink-70:#BDBCB7;--ink-45:#A9ADAA;--ink-25:#969B98;--muted:#A9ADAA;--rule:#262C2A;--rule-soft:#1A1F1D;--night:#1A1F1E;--teal:#A3AFAA;--carmine:#E07A86}
#days .row.day:not(.kop) .bar .nu-stip{position:absolute;top:50%;left:0;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--carmine);box-shadow:0 0 0 2px var(--sheet);z-index:1;pointer-events:none}
@media (prefers-reduced-motion:no-preference){
  #days .row.day,#nights .row.night,#hours .row,.sheet button,.sheet a{transition:background-color .18s ease,color .18s ease,border-color .18s ease}
  #days .row.day:not(.kop) .bar i,#days .row.day:not(.kop) .bar .nu-stip,#nights .row.night:not(.kop) .sbar i{animation:wiw-verschijn .32s ease both}
}
@keyframes wiw-verschijn{from{opacity:0}to{opacity:1}}
`;

function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

/* Alleen pagina's die zelf een donker thema hebben. */
const heeftDonker=html=>/html\[data-thema="?donker"?\]\{--paper:/i.test(html);

function pasToe(html,rel){
  if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": ronde-2-laag staat al in artifact.");
  if(!html.includes("</head>"))throw new Error(rel+": headafsluiting ontbreekt.");
  return html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const html=fs.readFileSync(p,"utf8");
    if(!heeftDonker(html))continue;
    fs.writeFileSync(p,pasToe(html,path.relative(OUT,p)),"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen pagina geraakt door de ronde-2-laag.");
  const cache=vernieuwServiceworkerCache(OUT,"ronde2-20261007");
  console.log("Ronde-2-laag toegepast op "+geraakt+" pagina's: donkere modus, nu-stip en zachte overgangen; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,CSS,htmlBestanden,heeftDonker,pasToe,main};

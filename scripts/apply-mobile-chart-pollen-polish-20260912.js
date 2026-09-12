"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARK="/* ===== MOBILE GRAFIEK + POLLEN POLISH 20260912 ===== */";

/* Mobiel was in de finale presentatielaag bewust teruggebracht naar één vast
   temperatuurcijfer per zes uur. Op een echte iPhone leest de curve daardoor
   onnodig leeg. Gebruik hetzelfde drie-uursritme als de zichtbare tijdas; de
   bestaande collision-owner mag nog steeds een label laten wijken als er echt
   geen veilige plek is. Extrema blijven hogere prioriteit houden. */
const GRAFIEK_OUD='?kandidatenRuw.filter(k=>k.rang>1||(k.i%6===0&&!kandidatenRuw.some(g=>g.rang>1&&Math.abs(g.i-k.i)<=1)))';
const GRAFIEK_NIEUW='?kandidatenRuw.filter(k=>k.rang>1||(k.i%3===0&&!kandidatenRuw.some(g=>g.rang>1&&Math.abs(g.i-k.i)<=1)))';

/* CAMS levert concentraties, geen universele allergie-/risicoschaal voor alle
   pollensoorten. De ruwe waarde blijft daarom leidend. De subregel gebruikt
   alleen brede, consumententaal over de hoeveelheid: geen, weinig, aanwezig of
   veel. Dit zijn presentatiebanden en nadrukkelijk geen gezondheidsadvies. */
const POLLEN_TRUE_OUD='if(aanwezig===true)return {tekst:"Modelverwachting voor dit uur.",kleur:"ink"};';
const POLLEN_TRUE_NIEUW='if(aanwezig===true)return {tekst:"Pollen verwacht voor dit uur.",kleur:"ink"};';
const POLLEN_FALSE_OUD='if(aanwezig===false)return {tekst:"Model verwacht geen pollen voor dit uur.",kleur:"ink45"};';
const POLLEN_FALSE_NIEUW='if(aanwezig===false)return {tekst:"Geen pollen verwacht voor dit uur.",kleur:"ink45"};';

/* apply-final-presentation-consistency verwijdert vóór deze stap de aparte
   Zonuren-tak uit de senior-runtime. De pollen-tak is in de definitieve artifact
   daardoor een zelfstandige `if`, niet langer een `}else if`. Target bewust de
   finale owner zodat deze late polish fail-closed blijft in plaats van een
   oudere tussenartifact te verwachten. */
const POLLEN_RUNTIME_OUD=`      if(/^Pollen\\s+/i.test(kop.textContent)){
        const o=pollenPresentatieGetoond(true);sub.textContent=o.tekst;val.style.color=kleurToken(o.kleur);`;
const POLLEN_RUNTIME_NIEUW=`      if(/^Pollen\\s+/i.test(kop.textContent)){
        const o=pollenPresentatieGetoond(true);
        const ruwe=String(val.textContent||"").replace(",",".");
        const minderDanEen=/<\\s*1/.test(ruwe),match=ruwe.match(/\\d+(?:\\.\\d+)?/);
        const concentratie=minderDanEen?0.5:(match?Number(match[0]):null);
        sub.textContent=concentratie!==null&&concentratie<10
          ?"Weinig pollen verwacht voor dit uur."
          :concentratie!==null&&concentratie>=200
            ?"Veel pollen verwacht voor dit uur."
            :o.tekst;
        val.style.color=kleurToken(o.kleur);`;

function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function exactEen(bron,oud,nieuw,label,rel){
  const n=bron.split(oud).length-1;
  if(n!==1)throw new Error(rel+": "+label+" ontbreekt of is dubbel: "+n);
  return bron.replace(oud,nieuw);
}

let geraakt=0;
for(const p of htmlBestanden(OUT)){
  let html=fs.readFileSync(p,"utf8");
  if(!html.includes(GRAFIEK_OUD)&&!html.includes(POLLEN_TRUE_OUD))continue;
  const rel=path.relative(OUT,p);
  if(html.includes(MARK))throw new Error(rel+": polishmarker staat al in artifact.");
  html=exactEen(html,GRAFIEK_OUD,GRAFIEK_NIEUW,"mobiele drie-uurslabelselectie",rel);
  html=exactEen(html,POLLEN_TRUE_OUD,POLLEN_TRUE_NIEUW,"positieve pollencopy",rel);
  html=exactEen(html,POLLEN_FALSE_OUD,POLLEN_FALSE_NIEUW,"nul-pollencopy",rel);
  html=exactEen(html,POLLEN_RUNTIME_OUD,POLLEN_RUNTIME_NIEUW,"pollen hoeveelheidscopy",rel);
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  if(!scripts.length)throw new Error(rel+": geen inline runtime voor syntaxcontrole.");
  scripts.forEach((code,i)=>new vm.Script(code,{filename:rel+":mobile-pollen-polish-"+(i+1)}));
  html=html.replace("</body>","\n"+MARK+"\n</body>");
  fs.writeFileSync(p,html,"utf8");
  geraakt++;
}
if(!geraakt)throw new Error("Geen weerartifact geraakt door mobile/pollen-polish.");
const cache=vernieuwServiceworkerCache(OUT,"mobile-chart-pollen-polish");
console.log("Mobile/pollen-polish toegepast op "+geraakt+" weerartifacts: drie-uurs temperatuurreferenties en natuurlijke pollencopy; cache "+cache+".");

module.exports={MARK,GRAFIEK_OUD,GRAFIEK_NIEUW,POLLEN_TRUE_OUD,POLLEN_TRUE_NIEUW,POLLEN_FALSE_OUD,POLLEN_FALSE_NIEUW,POLLEN_RUNTIME_OUD,POLLEN_RUNTIME_NIEUW,htmlBestanden};

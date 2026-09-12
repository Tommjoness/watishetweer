"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");
const OUT=path.join(__dirname,"..","public");
const MARKER_LABEL="LIVE CHART LABEL FIX 20260912";
const MARKER_RAIN="LIVE Q4 CHART COMPACTION 20260912";

function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function tel(s,q){return String(s).split(q).length-1;}

let gezien=0;
for(const p of htmlBestanden(OUT)){
  const html=fs.readFileSync(p,"utf8");
  if(!html.includes(MARKER_LABEL)&&!html.includes(MARKER_RAIN))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,MARKER_LABEL),1,rel+": label-fixmarker niet exact eenmaal aanwezig");
  assert.strictEqual(tel(html,MARKER_RAIN),1,rel+": Q4-compactiemarker niet exact eenmaal aanwezig");
  assert.ok(html.includes('const nuLokaleTijd=String(S.d&&S.d.current&&S.d.current.time||"");'),rel+": provider-lokale actuele tijd ontbreekt voor toekomstuurselectie");
  assert.ok(html.includes('if(!M&&n<=24&&nuLokaleTijd){'),rel+": eerste toekomstuur is niet tot desktop-etmaal begrensd");
  assert.ok(html.includes('if(geldig(i)&&String(TI[i]||"")>nuLokaleTijd){eersteToekomst=i;break;}'),rel+": eerste zichtbare toekomstige modeluur volgt niet de provider-lokale tijdas");
  assert.ok(html.includes('if(eersteToekomst!==null) zet(eersteToekomst,4);'),rel+": eerste toekomstige modeluur krijgt niet de hoogste normale labelprioriteit");
  assert.ok(html.includes('let huidigModel=null,afstand=Infinity;'),rel+": lopend-modeluurselectie ontbreekt");
  assert.ok(html.includes('const modelTijd=String(TI[idx]||"");'),rel+": suppressie controleert niet de provider-tijd van de kandidaat");
  assert.ok(html.includes('if(nuLokaleTijd&&(!modelTijd||modelTijd>nuLokaleTijd)) continue;'),rel+": toekomstige modeluren worden niet expliciet beschermd tegen nu-suppressie");
  assert.ok(html.includes('const d=Math.abs(nuX-x(idx));'),rel+": suppressie meet na tijdsfilter niet meer de nabijheid tot de nu-lijn");
  assert.ok(html.includes('if(d<afstand){afstand=d;huidigModel=idx;}'),rel+": dichtstbijzijnde niet-toekomstige kandidaat wordt niet geselecteerd");
  assert.ok(html.includes('if(huidigModel!==null&&afstand<cw*1.05) kandKaart.delete(huidigModel);'),rel+": redundante lopende-uurkandidaat wordt niet begrensd onderdrukt");
  assert.ok(!/Math\.abs\(x\(idx\)\s*-\s*nuX\)\s*<\s*cw\s*\*\s*1\.05/.test(html),rel+": oude brede labelsuppressie staat nog in runtime");

  assert.ok(html.includes('if(eersteToekomst!==null&&!gezet.some(g=>g.i===eersteToekomst)){'),rel+": eerste toekomstige uur heeft geen finale placement-fallback");
  assert.ok(html.includes('basisX+Math.max(28,Math.min(42,cw*.45))'),rel+": finale fallback wijkt niet begrensd rechts van de gesnapte nu-lijn uit");
  assert.ok(html.includes('let poging=probeerLagen(vrijeX,v,eersteBoven,5);'),rel+": finale fallback gebruikt niet dezelfde collision-owner met hogere prioriteit");
  assert.ok(html.includes('if(!poging)poging=probeerLagen(vrijeX,v,!eersteBoven,5);'),rel+": finale fallback probeert niet beide veilige verticale richtingen");
  assert.ok(html.includes('poging.verwijderd.forEach(g=>{const pos=gezet.indexOf(g);if(pos>=0)gezet.splice(pos,1);});'),rel+": finale fallback verwijdert verdrongen lagere prioriteitslabels niet via de bestaande gezet-lijst");
  assert.ok(html.includes('gezet.push({i:i,v:v,cx:vrijeX,cy:poging.cy,bw:bw,rang:5});'),rel+": eerste toekomstige uur wordt niet als finale hoogste-prioriteitsplaatsing bewaard");

  assert.ok(html.includes('const compactDesktop=typeof window!=="undefined"&&window.innerWidth>=1100&&!g.M&&g.n<=25;'),rel+": desktop-only Q4 compactcontract ontbreekt");
  assert.ok(html.includes('const y=pb+(compactDesktop?30:48)'),rel+": regenbracket gebruikt niet de compacte desktopoffset");
  assert.ok(html.includes('const nieuwH=Math.max(basisH,laatsteBedragY+(compactDesktop?14:25));'),rel+": viewBox-onderreserve gebruikt niet het compacte desktopcontract");
  gezien++;
}
assert.ok(gezien>0,"Geen pre-cleanup weerartifact met live chart/layout-fix gevonden.");
const cache=verifieerServiceworkerCache(OUT,"live-chart-layout-fix-20260912");
assert.ok(/^watishetweer-[0-9a-f]{12}$/.test(cache),"serviceworker-cache hoort bij pre-cleanup chart/layout-artifact");
console.log("Live chart/layout pre-cleanup verifier groen voor "+gezien+" weerartifacts; eerste zichtbare toekomstuur blijft beschermd tegen gesnapte nu-lijn én krijgt een finale collisionfallback; cache "+cache+".");

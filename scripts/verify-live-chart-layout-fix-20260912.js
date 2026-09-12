"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");
const OUT=path.join(__dirname,"..","public");
const MARKER_LABEL="LIVE CHART LABEL FIX 20260912";
const MARKER_RAIN="LIVE Q4 CHART COMPACTION 20260912";
const MARKER_LATE_NU="LIVE FUTURE LABEL NU-GUARD 20260912";

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
  if(!html.includes(MARKER_LABEL)&&!html.includes(MARKER_RAIN)&&!html.includes(MARKER_LATE_NU))continue;
  const rel=path.relative(OUT,p);
  assert.strictEqual(tel(html,MARKER_LABEL),1,rel+": label-fixmarker niet exact eenmaal aanwezig");
  assert.strictEqual(tel(html,MARKER_RAIN),1,rel+": Q4-compactiemarker niet exact eenmaal aanwezig");
  assert.strictEqual(tel(html,MARKER_LATE_NU),1,rel+": late nu-guardmarker niet exact eenmaal aanwezig");

  assert.ok(html.includes('const nuLokaleTijd=String(S.d&&S.d.current&&S.d.current.time||"");'),rel+": provider-lokale actuele tijd ontbreekt");
  assert.ok(html.includes('const desktopUurLabels=!M&&n<=24;'),rel+": desktop-etmaalcontract voor elk uurlabel ontbreekt");
  assert.ok(html.includes('if(geldig(i)&&(!nuLokaleTijd||(modelTijd&&modelTijd>nuLokaleTijd))) zet(i,4);'),rel+": niet ieder geldig toekomstig desktopuur krijgt hoge labelprioriteit");
  assert.ok(html.includes('if(nuLokaleTijd&&(!modelTijd||modelTijd>nuLokaleTijd)) continue;'),rel+": toekomstige uren zijn niet beschermd tegen nu-suppressie");
  assert.ok(html.includes('if(huidigModel!==null&&afstand<cw*1.05) kandKaart.delete(huidigModel);'),rel+": alleen dichtstbijzijnde niet-toekomstige modeluur hoort te wijken");
  assert.ok(!/Math\.abs\(x\(idx\)\s*-\s*nuX\)\s*<\s*cw\s*\*\s*1\.05/.test(html),rel+": oude brede labelsuppressie staat nog in runtime");

  assert.ok(html.includes('const verplichteUren=[];'),rel+": finale verplichte-uurlijst ontbreekt");
  assert.ok(html.includes('if(geldig(i)&&(!nuLokaleTijd||(modelTijd&&modelTijd>nuLokaleTijd))) verplichteUren.push(i);'),rel+": finale fallback omvat niet alle toekomstige desktopuren");
  assert.ok(html.includes('if(gezet.some(g=>g.i===i)) continue;'),rel+": bestaande veilige plaatsingen worden niet behouden");
  assert.ok(html.includes('const offsets=[0,stap,-stap,2*stap,-2*stap];'),rel+": extra botsingsvrije horizontale fallbackposities ontbreken");
  assert.ok(html.includes('poging=probeerLagen(kandidaatX,v,eersteBoven,null);'),rel+": fallback gebruikt niet dezelfde collision-owner");
  assert.ok(html.includes('if(!poging)poging=probeerLagen(kandidaatX,v,!eersteBoven,null);'),rel+": fallback probeert niet beide verticale richtingen");
  assert.ok(html.includes('if(poging) gezet.push({i:i,v:v,cx:vrijeX,cy:poging.cy,bw:bw,rang:5});'),rel+": veilige fallbackplaatsing wordt niet bewaard");

  assert.ok(html.includes('const nuLokaleTijdPolish=String(S.d&&S.d.current&&S.d.current.time||"");'),rel+": late nu-cleanup kent de actuele provider-tijd niet");
  assert.ok(html.includes('const tijdenPolish=Array.isArray(S.geo.TI)?S.geo.TI:[];'),rel+": late nu-cleanup gebruikt de zichtbare tijdas niet");
  assert.ok(html.includes('const modelTijd=i!==null?String(tijdenPolish[i]||""):"";'),rel+": late cleanup koppelt het label niet terug aan het modeluur");
  assert.ok(html.includes('const verplichtToekomstuur=!S.geo.M&&S.geo.n<=24&&modelTijd&&(!nuLokaleTijdPolish||modelTijd>nuLokaleTijdPolish);'),rel+": alle toekomstige desktop-uurlabels worden laat niet beschermd");
  assert.ok(html.includes('if(verplichtToekomstuur) return;'),rel+": toekomstige desktop-uurlabels kunnen nog door nu-cleanup verdwijnen");
  assert.ok(html.includes('verwijderTemperatuurMarkering(svg,el);'),rel+": niet-toekomstige concurrerende markeringen blijven niet opruimbaar");

  assert.ok(html.includes('const compactDesktop=typeof window!=="undefined"&&window.innerWidth>=1100&&!g.M&&g.n<=25;'),rel+": desktop-only Q4 compactcontract ontbreekt");
  assert.ok(html.includes('const y=pb+(compactDesktop?30:48)'),rel+": regenbracket gebruikt niet de compacte desktopoffset");
  assert.ok(html.includes('const nieuwH=Math.max(basisH,laatsteBedragY+(compactDesktop?29:25));'),rel+": viewBox-onderreserve gebruikt niet het compacte desktopcontract");
  gezien++;
}
assert.ok(gezien>0,"Geen pre-cleanup weerartifact met live chart/layout-fix gevonden.");
const cache=verifieerServiceworkerCache(OUT,"live-chart-layout-fix-20260912");
assert.ok(/^watishetweer-[0-9a-f]{12}$/.test(cache),"serviceworker-cache hoort bij pre-cleanup chart/layout-artifact");
console.log("Live chart/layout pre-cleanup verifier groen voor "+gezien+" weerartifacts; elk volledig toekomstig desktopuur krijgt een beschermd temperatuurlabel met collision-safe fallback; cache "+cache+".");

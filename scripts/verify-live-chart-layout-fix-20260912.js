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
  assert.ok(html.includes('let eersteToekomst=null;'),rel+": eerste toekomstige modeluur wordt niet expliciet bepaald");
  assert.ok(html.includes('if(geldig(i)&&x(i)>nuX){eersteToekomst=i;break;}'),rel+": eerste toekomstige modeluur gebruikt niet de echte nu-positie");
  assert.ok(html.includes('if(eersteToekomst!==null) zet(eersteToekomst,4);'),rel+": eerste toekomstige modeluur krijgt niet de hoogste labelprioriteit");
  assert.ok(html.includes('let huidigModel=null,afstand=Infinity;'),rel+": lopend-modeluurselectie ontbreekt");
  assert.ok(html.includes('const d=nuX-x(idx);'),rel+": lopend-modeluurselectie kijkt niet uitsluitend links van/óp nu");
  assert.ok(html.includes('if(d>=0&&d<afstand){afstand=d;huidigModel=idx;}'),rel+": laatste niet-toekomstige modelpunt wordt niet geselecteerd");
  assert.ok(html.includes('if(huidigModel!==null&&afstand<cw*1.05) kandKaart.delete(huidigModel);'),rel+": redundante lopende-uurkandidaat wordt niet begrensd onderdrukt");
  assert.ok(!/Math\.abs\(x\(idx\)\s*-\s*nuX\)\s*<\s*cw\s*\*\s*1\.05/.test(html),rel+": oude brede labelsuppressie staat nog in runtime");
  assert.ok(!html.includes('let dichtst=null,afstand=Infinity;'),rel+": geometrisch-nearest suppressie staat nog in runtime");
  assert.ok(html.includes('const compactDesktop=typeof window!=="undefined"&&window.innerWidth>=1100&&!g.M&&g.n<=25;'),rel+": desktop-only Q4 compactcontract ontbreekt");
  assert.ok(html.includes('const y=pb+(compactDesktop?30:48)'),rel+": regenbracket gebruikt niet de compacte desktopoffset");
  assert.ok(html.includes('const nieuwH=Math.max(basisH,laatsteBedragY+(compactDesktop?14:25));'),rel+": viewBox-onderreserve gebruikt niet het compacte desktopcontract");
  assert.ok(!/pb\s*\+\s*48\s*,\s*randFont/.test(html),rel+": oude vaste Q4-offset staat nog in runtime");
  gezien++;
}
assert.ok(gezien>0,"Geen pre-cleanup weerartifact met live chart/layout-fix gevonden.");
const cache=verifieerServiceworkerCache(OUT,"live-chart-layout-fix-20260912");
assert.ok(/^watishetweer-[0-9a-f]{12}$/.test(cache),"serviceworker-cache hoort bij pre-cleanup chart/layout-artifact");
console.log("Live chart/layout pre-cleanup verifier groen voor "+gezien+" weerartifacts; eerste toekomstuur heeft hoogste prioriteit en lopend-uursuppressie is geborgd; cache "+cache+".");

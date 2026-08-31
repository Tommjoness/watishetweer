"use strict";

const fs=require("fs");
const path=require("path");
const os=require("os");
const {spawnSync}=require("child_process");

const browser=process.env.CHROME_PATH||process.env.CHROMIUM_PATH||"google-chrome";
const artifact=path.join(__dirname,"public","index.html");
if(!fs.existsSync(artifact))throw new Error("public/index.html ontbreekt; voer eerst de postbuild uit");

const html=fs.readFileSync(artifact,"utf8");
const stijlen=(html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi)||[]).join("\n");
if(!stijlen.includes("weather-now-desktop-refinement-20260829"))throw new Error("Desktopverfijningsstijl ontbreekt in de finale artifact.");

/* Deze browserregressie is bewust datavrij. De fout was puur geometrisch:
   de desktopoverride begrensde eerst Nachtzicht en het volledige .sheet-vlak.
   Daardoor kon op brede of uitgezoomde desktops opnieuw lege ruimte naast het
   product ontstaan. Een minimale fixture met de echte finale CSS bewijst nu
   zowel het Nachtzicht-grid als het viewportbrede hoofdvlak. */
const fixture=`<!doctype html><html><head><meta charset="utf-8">${stijlen}</head><body>
<div class="sheet" id="sheet-breedte-fixture" style="height:1px;padding-top:0;padding-bottom:0"></div>
<div id="nacht-breedte-fixture" style="width:1280px">
  <div id="nights">
    <div class="row night" id="nacht-breedte-rij">
      <div>vannacht</div>
      <div>5/10</div>
      <div id="nacht-breedte-midden"><div class="sbar"></div></div>
      <div>68%</div>
      <div id="nacht-breedte-laatste" class="nmeta wide">Redelijke omstandigheden. Maanondergang om 21:06.</div>
    </div>
  </div>
</div>
<script>
(function(){
  const sheet=document.getElementById('sheet-breedte-fixture');
  const rij=document.getElementById('nacht-breedte-rij');
  const midden=document.getElementById('nacht-breedte-midden');
  const laatste=document.getElementById('nacht-breedte-laatste');
  const sr=sheet.getBoundingClientRect(),rr=rij.getBoundingClientRect(),mr=midden.getBoundingClientRect(),lr=laatste.getBoundingClientRect();
  const stijl=getComputedStyle(rij),viewport=document.documentElement.clientWidth;
  const linksLeeg=Math.max(0,sr.left),rechtsSheetLeeg=Math.max(0,viewport-sr.right);
  const sheetOk=Math.abs(sr.width-viewport)<=1.5&&linksLeeg<=1.5&&rechtsSheetLeeg<=1.5;
  const rechtsLeeg=Math.max(0,rr.right-lr.right);
  const nachtOk=stijl.display==='grid'&&rr.width>=1279&&mr.width>420&&rechtsLeeg<=1.5&&lr.width>=220;
  document.body.dataset.sheetBreedteResult=sheetOk?'ok':'fout';
  document.body.dataset.sheetBreedte=sr.width.toFixed(2);
  document.body.dataset.sheetViewport=viewport.toFixed(2);
  document.body.dataset.sheetLinksLeeg=linksLeeg.toFixed(2);
  document.body.dataset.sheetRechtsLeeg=rechtsSheetLeeg.toFixed(2);
  document.body.dataset.nachtBreedteResult=nachtOk?'ok':'fout';
  document.body.dataset.nachtBreedteRij=rr.width.toFixed(2);
  document.body.dataset.nachtBreedteMidden=mr.width.toFixed(2);
  document.body.dataset.nachtBreedteLaatste=lr.width.toFixed(2);
  document.body.dataset.nachtBreedteLeeg=rechtsLeeg.toFixed(2);
  document.body.dataset.nachtBreedteGrid=stijl.gridTemplateColumns;
})();
</script></body></html>`;

const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-night-width-"));
const pad=path.join(dir,"index.html");
fs.writeFileSync(pad,fixture,"utf8");
try{
  const r=spawnSync(browser,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
    "--allow-file-access-from-files","--window-size=1600,900","--dump-dom","file://"+pad
  ],{encoding:"utf8",maxBuffer:8*1024*1024});
  if(r.status!==0)throw new Error("Desktop-breedtetest browser exit "+r.status+" "+String(r.stderr||"").slice(-1000));
  const dom=r.stdout||"";
  const veld=naam=>{const m=new RegExp('data-'+naam+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(veld("sheet-breedte-result")!=="ok"){
    throw new Error(
      "Desktop hoofdvlak laat nog zijruimte: sheet="+veld("sheet-breedte")+
      ", viewport="+veld("sheet-viewport")+
      ", links="+veld("sheet-links-leeg")+
      ", rechts="+veld("sheet-rechts-leeg")
    );
  }
  if(veld("nacht-breedte-result")!=="ok"){
    throw new Error(
      "Nachtzicht laat op desktop nog lege rechterruimte: rij="+veld("nacht-breedte-rij")+
      ", midden="+veld("nacht-breedte-midden")+
      ", laatste="+veld("nacht-breedte-laatste")+
      ", leeg="+veld("nacht-breedte-leeg")+
      ", grid="+veld("nacht-breedte-grid")
    );
  }
  console.log("Desktopbreedte geslaagd: hoofdvlak vult de viewport zonder zijgoten en Nachtzicht sluit aan op de rechterrand.");
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}

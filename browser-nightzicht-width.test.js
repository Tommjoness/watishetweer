"use strict";

const fs=require("fs");
const path=require("path");
const os=require("os");
const {spawnSync}=require("child_process");

const browser=require("./scripts/vind-browser.js").vindBrowser()||"google-chrome";
const artifact=path.join(__dirname,"public","index.html");
if(!fs.existsSync(artifact))throw new Error("public/index.html ontbreekt; voer eerst de postbuild uit");

const html=require(path.join(__dirname,"scripts","lokale-artifact-html.js")).metLokaleScripts(fs.readFileSync(artifact,"utf8"),path.dirname(artifact));
const stijlen=(html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi)||[]).join("\n");
if(!stijlen.includes("weather-now-desktop-refinement-20260829"))throw new Error("Desktopverfijningsstijl ontbreekt in de finale artifact.");

/* De buitenste secties blijven bewust viewportbreed. Binnen de Nachtzicht-rij
   gold eerst (augustus) dat de data als begrensde kolommen links bleef staan met
   vrije ruimte rechts. Sinds de desktopronde van 29 september (eigenaar) loopt de
   rij over de volle breedte: vaste kolommen voor Zichtscore, Bewolking,
   Beoordeling en Maan, en alleen Beste zichtperiode rekt mee. Deze fixture
   gebruikt de echte rijopbouw van de app en bewaakt beide invarianten: volle
   sectiebreedte, begrensde vaste kolommen en geen loze eindruimte. */
const fixture=`<!doctype html><html><head><meta charset="utf-8">${stijlen}</head><body>
<div class="sheet" id="sheet-breedte-fixture" style="height:1px;padding-top:0;padding-bottom:0"></div>
<div class="dashrow dashrow-days" id="dagen-breedte-fixture" style="width:1280px">
  <div class="dashcol" id="zeven-breedte-kolom"><div id="days"></div></div>
  <div class="dashcol" id="nacht-breedte-kolom">
    <div id="nights">
      <div class="row night" id="nacht-breedte-rij" data-d="0"><div class="dname">vannacht</div><div class="score" id="nacht-score">5/10</div><div class="sbar"><i></i></div><div class="nmeta" id="nacht-bewolking" aria-label="Bewolking 68%"><span class="perc">68%</span></div><span class="nachtadvies"><span class="nachtoordeel">Redelijk</span></span><span class="nachtvenster" id="nacht-breedte-venster">Redelijke omstandigheden, maar door bewolking is er geen aaneengesloten gunstig kijkvenster.</span><span class="nachtmaan" id="nacht-breedte-laatste"><span class="nachtzichtregel wiw-night-visibility-detail">Gemiddeld zicht: 10+ km</span><span class="nachtmaanregel">Maanondergang om 21:06.</span></span><div class="nmeta wide"><details class="nacht-meta-details" open=""><summary>Zicht en maan</summary></details></div></div>
    </div>
  </div>
</div>
<script>
(function(){
  const sheet=document.getElementById('sheet-breedte-fixture');
  const dagen=document.getElementById('dagen-breedte-fixture');
  const zeven=document.getElementById('zeven-breedte-kolom');
  const nachtKolom=document.getElementById('nacht-breedte-kolom');
  const days=document.getElementById('days');
  const nights=document.getElementById('nights');
  const rij=document.getElementById('nacht-breedte-rij');
  const score=document.getElementById('nacht-score'),bewolking=document.getElementById('nacht-bewolking'),venster=document.getElementById('nacht-breedte-venster');
  const laatste=document.getElementById('nacht-breedte-laatste');
  const sr=sheet.getBoundingClientRect(),dr=dagen.getBoundingClientRect(),zr=zeven.getBoundingClientRect(),nkr=nachtKolom.getBoundingClientRect(),dyr=days.getBoundingClientRect(),nsr=nights.getBoundingClientRect(),rr=rij.getBoundingClientRect(),sr2=score.getBoundingClientRect(),br=bewolking.getBoundingClientRect(),vr=venster.getBoundingClientRect(),lr=laatste.getBoundingClientRect();
  const stijl=getComputedStyle(rij),dagenStijl=getComputedStyle(dagen),viewport=document.documentElement.clientWidth;
  const linksLeeg=Math.max(0,sr.left),rechtsSheetLeeg=Math.max(0,viewport-sr.right);
  const sheetOk=Math.abs(sr.width-viewport)<=1.5&&linksLeeg<=1.5&&rechtsSheetLeeg<=1.5;
  const sectiesOk=dagenStijl.display==='block'&&dr.width>=1279&&Math.abs(zr.width-dr.width)<=1.5&&Math.abs(nkr.width-dr.width)<=1.5&&Math.abs(dyr.width-dr.width)<=1.5&&Math.abs(nsr.width-dr.width)<=1.5;
  const rechtsLeeg=Math.max(0,rr.right-lr.right);
  const kolommen=stijl.gridTemplateColumns.split(/\\s+/).map(parseFloat);
  const zichtscore=kolommen[1]||0;
  const nachtOk=stijl.display==='grid'&&rr.width>=1279&&zichtscore>=150&&zichtscore<=261&&br.width<=160&&vr.width>=319&&lr.width>=200&&lr.width<=300&&rechtsLeeg<=2;
  document.body.dataset.sheetBreedteResult=sheetOk?'ok':'fout';
  document.body.dataset.sheetBreedte=sr.width.toFixed(2);
  document.body.dataset.sheetViewport=viewport.toFixed(2);
  document.body.dataset.sheetLinksLeeg=linksLeeg.toFixed(2);
  document.body.dataset.sheetRechtsLeeg=rechtsSheetLeeg.toFixed(2);
  document.body.dataset.sectiesBreedteResult=sectiesOk?'ok':'fout';
  document.body.dataset.sectiesDisplay=dagenStijl.display;
  document.body.dataset.sectiesParent=dr.width.toFixed(2);
  document.body.dataset.sectiesZeven=zr.width.toFixed(2);
  document.body.dataset.sectiesNacht=nkr.width.toFixed(2);
  document.body.dataset.sectiesDays=dyr.width.toFixed(2);
  document.body.dataset.sectiesNights=nsr.width.toFixed(2);
  document.body.dataset.nachtBreedteResult=nachtOk?'ok':'fout';
  document.body.dataset.nachtBreedteRij=rr.width.toFixed(2);
  document.body.dataset.nachtBreedteMidden=zichtscore.toFixed(2);
  document.body.dataset.nachtBreedteBewolking=br.width.toFixed(2);
  document.body.dataset.nachtBreedteVenster=vr.width.toFixed(2);
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
  if(veld("secties-breedte-result")!=="ok"){
    throw new Error(
      "Onderste desktopsecties vullen niet de volledige breedte: display="+veld("secties-display")+
      ", parent="+veld("secties-parent")+
      ", zeven="+veld("secties-zeven")+
      ", nacht="+veld("secties-nacht")+
      ", days="+veld("secties-days")+
      ", nights="+veld("secties-nights")
    );
  }
  if(veld("nacht-breedte-result")!=="ok"){
    throw new Error(
      "Nachtzicht-kolommen zijn niet begrensd of laten loze eindruimte: rij="+veld("nacht-breedte-rij")+
      ", zichtscore="+veld("nacht-breedte-midden")+
      ", bewolking="+veld("nacht-breedte-bewolking")+
      ", beste zichtperiode="+veld("nacht-breedte-venster")+
      ", maan="+veld("nacht-breedte-laatste")+
      ", vrije eindruimte="+veld("nacht-breedte-leeg")+
      ", grid="+veld("nacht-breedte-grid")
    );
  }
  console.log("Desktopbreedte geslaagd: hoofdvlak en onderste secties blijven volledig breed; Nachtzicht houdt vaste, begrensde kolommen en alleen Beste zichtperiode rekt mee tot de rand.");
}finally{
  fs.rmSync(dir,{recursive:true,force:true});
}

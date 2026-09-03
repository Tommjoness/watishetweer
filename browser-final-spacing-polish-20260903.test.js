"use strict";

const fs=require("fs"),path=require("path"),os=require("os"),{spawnSync}=require("child_process");
function vindBrowser(){for(const n of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){const r=spawnSync("sh",["-lc","command -v "+n],{encoding:"utf8"});if(r.status===0&&r.stdout.trim())return r.stdout.trim();}return null;}
const browser=vindBrowser();
if(!browser){if(process.env.CI){console.error("FOUT spacing-polish browsertest: Chrome/Chromium ontbreekt.");process.exit(1);}console.log("SKIP spacing-polish browsertest: lokaal geen Chrome/Chromium.");process.exit(0);}
const artifact=path.join(__dirname,"public","index.html");
if(!fs.existsSync(artifact))throw new Error("public/index.html ontbreekt; voer eerst de finale spacing polish uit.");
const html=fs.readFileSync(artifact,"utf8");
if(!html.includes("/* ===== FINAL SPACING POLISH 20260903 ===== */"))throw new Error("Final spacing polish ontbreekt in public/index.html.");
const stijlen=(html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi)||[]).join("\n");
const fixture=`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${stijlen}</head><body>
<div class="sheet">
  <div class="mast" id="test-mast"><div><h1>watishetweer.nl</h1><h2 id="place">Amsterdam</h2></div><div class="mastright" id="test-mastright"><div class="tools"><input type="text" value="Amsterdam"><button id="here">Mijn locatie</button><button id="ververs">Ververs</button><button id="thema">Weergave</button></div><div id="stamp">Gegevens opgehaald om 17:35</div></div></div>
  <div class="final-top-grid"><div class="final-top-left"><p class="brief">Korte briefing</p><div class="hero">21 °C</div></div><div class="stats" id="test-topstats"><div class="stat">Wind</div><div class="stat">Zon</div><div class="stat">Neerslag</div><div class="stat">Vocht</div></div></div>
  <div class="dashrow dashrow-days">
    <div class="dashcol"><h2 id="dagen-kop"><span>Zeven dagen</span></h2><p class="hint" id="dagenhint">Kies een dag.</p><div id="days"><div class="row day">Voorbeeld</div></div></div>
    <div class="dashcol"><h2 id="nacht-kop"><span>Nachtzicht</span></h2><p class="hint" id="nachthint">Indicatie voor de nacht.</p><div id="nights">
      <div class="row night kop"><div class="dname">Nacht</div><div class="score">Zichtscore</div><div class="sbar"></div><div class="nmeta">Bewolking</div><div class="nmeta wide">Beste zichtperiode</div></div>
      <div class="row night"><div class="dname">vannacht</div><div class="score">4/10</div><div class="sbar"><i style="width:40%"></i></div><div class="nmeta"><span class="perc">44%</span></div><div class="nmeta wide"><span class="nachtadvies">Matig · Geen gunstig kijkvenster door bewolking, neerslag en maanlicht.</span><span>Gemiddeld zicht: 10+ km</span><span class="nachtmaan">◐ Maanopkomst om 23:08.</span></div></div>
    </div></div>
  </div>
  <h2 id="aq-kop"><span>Luchtkwaliteit en pollen</span></h2><p class="hint" id="pollenhint">Pollen is modelinformatie.</p>
  <div class="stats" id="aq"><div class="stat"><div class="eyebrow">Europese AQI</div><div class="sval">20</div></div><div class="stat"><div class="eyebrow">Zonuren</div><div class="sval">2,4</div></div></div>
  <footer id="test-footer"><span class="bron" id="test-source"><b>Bronnen voor deze weergave</b> <a href="#">Open-Meteo</a> <a href="#">CAMS</a> <a href="#">MeteoAlarm</a> <a href="#">© OpenStreetMap-bijdragers</a> · <a href="#">KNMI</a></span><span class="bron"><a href="#">watishetweer.nl · Over deze site</a></span><span class="bron"><a href="#">Privacy &amp; gegevens</a></span><details class="bron footer-details"><summary>Technische locatiegegevens</summary></details></footer>
</div>
<nav class="seo-plaatsnav" id="test-nav"><div class="seo-plaatsnav-inner"><div class="seo-plaatsnav-kop" id="test-nav-title">Populaire plaatsen in Nederland</div><div class="seo-plaatsnav-links"><a href="#">Almere</a><a href="#">Amersfoort</a><a href="#">Amsterdam</a><a href="#">Arnhem</a><a href="#">Breda</a><a href="#">Den Haag</a><a href="#">Eindhoven</a><a href="#">Groningen</a><a href="#">Haarlem</a><a href="#">Maastricht</a><a href="#">Nijmegen</a><a href="#">Rotterdam</a><a href="#">Utrecht</a><a href="#">Zwolle</a><a href="#">Meer plaatsen</a></div></div></nav>
<script>
(function(){
 const out={};const cs=e=>getComputedStyle(e),rr=e=>e.getBoundingClientRect();
 const wide=document.querySelector('#nights .row.night:not(.kop) .nmeta.wide'),advies=wide.querySelector('.nachtadvies'),maan=wide.querySelector('.nachtmaan'),bar=document.querySelector('#nights .row.night:not(.kop) .sbar');
 const footer=document.getElementById('test-footer'),aq=document.getElementById('aq'),nav=document.getElementById('test-nav'),source=document.getElementById('test-source'),navTitle=document.getElementById('test-nav-title');
 const bron=document.querySelector('#test-footer .bron'),navlink=document.querySelector('#test-nav a'),mastRight=document.getElementById('test-mastright'),topStats=document.getElementById('test-topstats'),search=document.querySelector('#test-mastright input');
 out.wideAlign=cs(wide).textAlign;out.wideItems=cs(wide).alignItems;out.adviesAlign=cs(advies).textAlign;out.maanAlign=cs(maan).textAlign;
 out.barWidth=rr(bar).width;out.bestWidth=rr(wide).width;
 out.mastAxis=Math.abs(rr(mastRight).left-rr(topStats).left);out.mastWidthDelta=Math.abs(rr(mastRight).width-rr(topStats).width);out.searchWidth=rr(search).width;
 out.dagenMargin=parseFloat(cs(document.getElementById('dagen-kop')).marginTop)||0;out.nachtMargin=parseFloat(cs(document.getElementById('nacht-kop')).marginTop)||0;out.aqMargin=parseFloat(cs(document.getElementById('aq-kop')).marginTop)||0;
 out.hintTop=parseFloat(cs(document.getElementById('nachthint')).marginTop)||0;out.hintBottom=parseFloat(cs(document.getElementById('nachthint')).marginBottom)||0;
 out.footerMargin=parseFloat(cs(footer).marginTop)||0;out.footerPadding=parseFloat(cs(footer).paddingTop)||0;out.footerHeight=rr(footer).height;out.aqFooterGap=rr(footer).top-rr(aq).bottom;
 out.sourceWhite=cs(source).whiteSpace;out.sourceHeight=rr(source).height;
 out.navMargin=parseFloat(cs(nav).marginTop)||0;out.navHeight=rr(nav).height;out.navBorder=parseFloat(cs(nav).borderTopWidth)||0;out.navTitleHeight=rr(navTitle).height;out.bronHeight=rr(bron).height;out.navLinkHeight=rr(navlink).height;
 out.overflow=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth;
 for(const [k,v] of Object.entries(out))document.body.setAttribute('data-spacing-'+k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()),String(v));
})();
</script></body></html>`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-spacing-polish-"));
try{
 const pad=path.join(dir,"index.html");fs.writeFileSync(pad,fixture,"utf8");
 for(const [w,h] of [[390,900],[1366,900],[1600,900],[1680,900],[1920,1080]]){
  const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${w},${h}`,"--virtual-time-budget=500","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:20*1024*1024});
  if(r.status!==0)throw new Error(`${w}px browser exit ${r.status}: `+String(r.stderr||"").slice(-800));
  const dom=r.stdout||"",v=k=>{const m=new RegExp('data-spacing-'+k+'="([^"]*)"').exec(dom);return m&&m[1];},n=k=>Number(v(k));
  if(n('overflow')>2)throw new Error(`${w}px: ${n('overflow')}px horizontale overflow`);
  if(w>=1100){
    if(n('mast-axis')>2||n('mast-width-delta')>2)throw new Error(`${w}px: masthead en metriekgrid delen niet dezelfde rechterkolom (as ${n('mast-axis')}px, breedteverschil ${n('mast-width-delta')}px)`);
    if(n('search-width')<200)throw new Error(`${w}px: zoekveld blijft onnodig smal (${n('search-width')}px)`);
    if(v('wide-align')!=="left"||v('wide-items')!=="flex-start"||v('advies-align')!=="left"||v('maan-align')!=="left")throw new Error(`${w}px: Beste zichtperiode niet op één linkeras (${v('wide-align')}/${v('wide-items')}/${v('advies-align')}/${v('maan-align')})`);
    if(n('bar-width')>625)throw new Error(`${w}px: Nachtzicht-scorebalk nog te breed (${n('bar-width')}px)`);
    if(n('best-width')<330)throw new Error(`${w}px: Beste zichtperiode te smal (${n('best-width')}px)`);
    for(const k of ['dagen-margin','nacht-margin','aq-margin'])if(!(n(k)>=26&&n(k)<=30))throw new Error(`${w}px: sectieritme ${k}=${n(k)}px, verwacht circa 28px`);
    if(!(n('hint-top')>=5&&n('hint-top')<=7&&n('hint-bottom')>=7&&n('hint-bottom')<=9))throw new Error(`${w}px: hintmarges niet compact (${n('hint-top')}/${n('hint-bottom')}px)`);
    if(n('footer-margin')>11||n('footer-padding')>8||n('aq-footer-gap')>12)throw new Error(`${w}px: footer staat nog te los (margin ${n('footer-margin')}, padding ${n('footer-padding')}, gap ${n('aq-footer-gap')})`);
    if(n('footer-height')>58)throw new Error(`${w}px: footer nog te hoog (${n('footer-height')}px)`);
    if(v('source-white')!=="nowrap"||n('source-height')>30)throw new Error(`${w}px: bronregel kan intern afbreken (${v('source-white')}, ${n('source-height')}px)`);
    if(n('nav-margin')>1||n('nav-height')>66||n('nav-border')>1.2)throw new Error(`${w}px: populaire-plaatsenstrook nog te ruim/sterk gescheiden (margin ${n('nav-margin')}, hoogte ${n('nav-height')}, border ${n('nav-border')})`);
    if(w>=1300&&n('nav-title-height')>30)throw new Error(`${w}px: SEO-footerkop breekt nog onnodig over meerdere regels (${n('nav-title-height')}px)`);
  }else{
    if(n('bron-height')<43.5)throw new Error(`390px: footertouchdoel te klein (${n('bron-height')}px)`);
    if(n('nav-link-height')<43.5)throw new Error(`390px: plaatstouchdoel te klein (${n('nav-link-height')}px)`);
    if(v('source-white')==="nowrap")throw new Error('390px: desktop-nowrap lekt naar mobiel');
  }
  console.log(`${w}px spacing-polish groen: mast-as ${n('mast-axis').toFixed(1)}px, Nachtzichtbalk ${n('bar-width').toFixed(1)}px, footer ${n('footer-height').toFixed(1)}px, SEO-nav ${n('nav-height').toFixed(1)}px, overflow ${n('overflow').toFixed(1)}px.`);
 }
 console.log("Final spacing polish browsertest geslaagd op 390/1366/1600/1680/1920 px.");
}finally{fs.rmSync(dir,{recursive:true,force:true});}

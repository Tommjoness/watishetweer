"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
function vindBrowser(){for(const n of [process.env.CHROME_PATH,process.env.CHROMIUM_PATH,"google-chrome","google-chrome-stable","chromium","chromium-browser"].filter(Boolean)){const r=spawnSync(n,["--version"],{encoding:"utf8"});if(r.status===0)return n;}return null;}
const browser=vindBrowser();
if(!browser){if(process.env.CI){console.error("FOUT UI/UX-auditbrowsertest: Chrome/Chromium ontbreekt.");process.exit(1);}console.log("SKIP UI/UX-auditbrowsertest: lokaal geen Chrome/Chromium.");process.exit(0);}
const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let basis=fs.readFileSync(productie,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
if(!basis.includes('id="wiw-ui-ux-audit-polish-20260913"'))throw new Error("UI/UX-auditstylesheet ontbreekt in finale artifact");
basis=basis.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<script\b[^>]*\/>/gi,"");
/* De productieruntime voegt na DOMContentLoaded een footerregel met
   display:flex!important toe. Neem precies die bronregel als late stylesheet
   mee, zodat deze test dezelfde cascade test als de echte browser. */
const runtimeBron=fs.readFileSync(path.join(__dirname,"scripts","final-desktop-ui-runtime-20260902.js"),"utf8");
const lateFooterRegel=/footer\{[^{}]*display:flex!important[^{}]*\}/.exec(runtimeBron);
if(!lateFooterRegel)throw new Error("Late finale runtime-footerregel ontbreekt.");
const lateRuntimeStijl='<style id="audit-late-runtime-footer">'+lateFooterRegel[0]+'</style>';

function voerUit(breedte,hoogte){
  const reporter=`<script>
window.addEventListener('DOMContentLoaded',()=>{const zet=(k,v)=>document.body.setAttribute('data-audit-'+k,String(v));try{
  const app=document.getElementById('app'),chips=document.getElementById('chips'),days=document.getElementById('days'),warnings=document.getElementById('waarschuwingen'),results=document.getElementById('res'),thema=document.getElementById('thema');
  app.style.display='block';app.style.visibility='visible';
  chips.innerHTML='<div class="chipskop">Bewaarde plaatsen</div><div class="chiprij"><button class="chip add">+ Deze plaats bewaren</button></div>';
  days.innerHTML='<div class="row day" role="button" tabindex="0"><div class="dname">ma 14</div><div class="dico"></div><div class="dcond">Half bewolkt</div><div class="dwind">3 Bft</div><div class="dmin">12°</div><div class="bar"></div><div class="dmax">19°</div><div class="drain">20%</div></div>';
  warnings.innerHTML='<div class="waarsch" data-ui-severity="oranje"><h3>Waakzaamheid voor overstromingen</h3><p>Volg de officiële aanwijzingen.</p></div>';
  results.innerHTML='<div role="option"><span class="zoekresultaat-naam">Dubai</span><span class="zoekresultaat-detail">Siddharthnagar, Uttar Pradesh, India</span></div>';results.classList.add('on');
  thema.innerHTML='Weergave <span class="thema-status" aria-hidden="true">A</span>';thema.dataset.actieveThemakeuze='auto';
  const hour=document.createElement('table');hour.className='wiw-hour-table';hour.innerHTML='<thead><tr><th>Tijd</th><th>Weer</th><th>Temperatuur</th></tr></thead><tbody><tr><td><time>18:00</time><span class="wiw-hour-date">ma 14</span></td><td>Helder</td><td><span class="wiw-hour-primary">18°</span><span class="wiw-hour-secondary">voelt 17°</span></td></tr></tbody>';app.appendChild(hour);
  const nav=document.querySelector('.mobile-section-nav'),links=[...nav.querySelectorAll('a')],row=days.querySelector('[role="button"]'),warning=warnings.firstElementChild,detail=results.querySelector('.zoekresultaat-detail'),add=chips.querySelector('.chip.add'),kop=hour.querySelector('th'),sec=hour.querySelector('.wiw-hour-secondary'),hint=document.querySelector('.hint'),status=thema.querySelector('.thema-status');
  const footer=document.querySelector('footer'),directe=[...footer.querySelectorAll(':scope > span.bron')],bronnen=directe.find(x=>/Bronnen voor deze weergave/.test(x.textContent||'')),over=directe.find(x=>x.querySelector('a[href="/over/"]')),privacy=directe.find(x=>x.querySelector('a[href="/privacy"]')),disclaimer=directe.find(x=>/Weersinformatie is algemeen/.test(x.textContent||'')),details=footer.querySelector(':scope > details.footer-details');
  if(!bronnen||!over||!privacy||!disclaimer||!details)throw new Error('footerbronnen, hulplinks of disclaimer ontbreken');
  const cs=x=>getComputedStyle(x),pseudo=getComputedStyle(row,'::after'),midden=x=>{const r=x.getBoundingClientRect();return (r.top+r.bottom)/2;};
  const focusDoel=cs(nav).display==='none'?row:links[0];focusDoel.focus();
  zet('nav-display',cs(nav).display);zet('nav-links',links.length);zet('nav-min-height',Math.min(...links.map(x=>x.getBoundingClientRect().height)));
  zet('focus-width',parseFloat(cs(focusDoel).outlineWidth)||0);zet('day-arrow',pseudo.content);zet('add-border',cs(add).borderStyle);
  zet('warning-width',parseFloat(cs(warning).borderLeftWidth)||0);zet('warning-color',cs(warning).borderLeftColor);zet('warning-title-weight',cs(warning.querySelector('h3')).fontWeight);
  zet('detail-display',cs(detail).display);zet('detail-size',parseFloat(cs(detail).fontSize)||0);zet('theme-status-width',status.getBoundingClientRect().width);zet('theme-center-delta',Math.abs(midden(status)-midden(thema)).toFixed(3));
  const footerRect=footer.getBoundingClientRect(),bronnenRect=bronnen.getBoundingClientRect(),overRect=over.getBoundingClientRect(),privacyRect=privacy.getBoundingClientRect(),detailsRect=details.getBoundingClientRect(),disclaimerRect=disclaimer.getBoundingClientRect();
  zet('source-overflow',Math.max(0,footerRect.left-bronnenRect.left,bronnenRect.right-footerRect.right).toFixed(3));zet('footer-display',cs(footer).display);zet('over-text',(over.textContent||'').trim());zet('privacy-text',(privacy.textContent||'').trim());zet('over-top',overRect.top.toFixed(3));zet('privacy-top',privacyRect.top.toFixed(3));zet('details-top',detailsRect.top.toFixed(3));zet('disclaimer-bottom',disclaimerRect.bottom.toFixed(3));
  zet('utility-center-delta',Math.abs(((overRect.left+detailsRect.right)/2)-((footerRect.left+footerRect.right)/2)).toFixed(3));
  zet('header-size',parseFloat(cs(kop).fontSize)||0);zet('secondary-size',parseFloat(cs(sec).fontSize)||0);zet('hint-size',parseFloat(cs(hint).fontSize)||0);
  zet('overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}}, {once:true});
</script>`;
  const html=basis.replace("</body>",lateRuntimeStijl+reporter+"</body>"),dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-ui-ux-audit-"));
  try{
    const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${breedte},${hoogte}`,"--virtual-time-budget=1200","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:24*1024*1024,timeout:20000});
    if(r.status!==0)throw new Error("browser exit "+r.status+": "+String(r.stderr||"").slice(-1200));
    const decode=s=>s&&s.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">");
    const dom=r.stdout||"",v=k=>{const m=new RegExp('data-audit-'+k+'="([^"]*)"').exec(dom);return m&&decode(m[1]);};
    if(v("done")!=="ok")throw new Error("reporter "+breedte+"px: "+v("exception"));
    if(Number(v("nav-links"))!==4)throw new Error("sectienavigatie mist doelen op "+breedte+"px");
    if(Number(v("focus-width"))<1.9)throw new Error("focusring is dunner dan 2px op "+breedte+"px");
    if(Number(v("warning-width"))<2.9||Number(v("warning-title-weight"))<600)throw new Error("oranje waarschuwing mist zichtbare ernst op "+breedte+"px");
    if(!v("warning-color")||v("warning-color")==="rgba(0, 0, 0, 0)")throw new Error("oranje waarschuwing mist accentkleur");
    if(v("detail-display")!=="block"||Number(v("detail-size"))<12.4)throw new Error("locatiedetail is niet leesbaar op "+breedte+"px");
    if(Number(v("theme-status-width"))<15.5)throw new Error("zichtbare themastatus ontbreekt op "+breedte+"px");
    if(Number(v("theme-center-delta"))>1)throw new Error("thema-icoon staat niet verticaal gecentreerd op "+breedte+"px: delta "+v("theme-center-delta")+"px");
    if(v("over-text")!=="Over deze site")throw new Error("footer gebruikt niet de compacte Over-link: "+v("over-text"));
    if(v("privacy-text")!=="Privacy & gegevens")throw new Error("privacyhulplink wijkt af: "+v("privacy-text"));
    if(Number(v("overflow"))>2)throw new Error("horizontale overflow op "+breedte+"px: "+v("overflow"));
    if(breedte<=900){
      if(v("nav-display")!=="grid"||Number(v("nav-min-height"))<43.5)throw new Error("mobiele sectienavigatie is niet zichtbaar/aanraakbaar op "+breedte+"px");
      if(Number(v("header-size"))<10.9||Number(v("secondary-size"))<11.4||Number(v("hint-size"))<12.9)throw new Error("mobiele microcopy blijft te klein op "+breedte+"px");
      if(v("day-arrow")!=="none")throw new Error("desktopchevron lekt naar mobiel op "+breedte+"px");
    }else{
      if(v("nav-display")!=="none")throw new Error("mobiele sectienavigatie lekt naar desktop");
      if(v("footer-display")!=="grid")throw new Error("late finale runtime zet desktopfooter terug naar "+v("footer-display"));
      if(Number(v("source-overflow"))>1)throw new Error("bronnenregel steekt buiten de desktopfooter op "+breedte+"px: "+v("source-overflow")+"px");
      if(!/[›]/.test(v("day-arrow")||""))throw new Error("weekrij mist desktopchevron: "+v("day-arrow"));
      if(v("add-border")!=="solid")throw new Error("bewaaractie oogt op desktop nog tijdelijk: "+v("add-border"));
      if(Math.abs(Number(v("over-top"))-Number(v("privacy-top")))>1)throw new Error("Over en Privacy staan niet op dezelfde afsluitende rij");
      if(Math.abs(Number(v("over-top"))-Number(v("details-top")))>1)throw new Error("technische locatiegegevens sluit niet aan op de hulplinkrij");
      if(Number(v("over-top"))<Number(v("disclaimer-bottom"))+1)throw new Error("footerhulplinks staan niet als aparte regel onder de disclaimer");
      if(Number(v("utility-center-delta"))>1.5)throw new Error("footerhulplinks zijn als groep niet gecentreerd: delta "+v("utility-center-delta")+"px");
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

for(const [w,h] of [[360,900],[390,900],[1280,1000],[1440,1000],[1920,1080]])voerUit(w,h);
console.log("UI/UX-auditbrowserregressie groen op 360px, 390px, 1280px, 1440px en 1920px: navigatie, leesbaarheid, focus, waarschuwingsernst, locatie-identiteit, themastatus, begrensde bronnenregel en aparte gecentreerde footerhulplinkrij inclusief late runtimecascade gemeten zonder overflow.");

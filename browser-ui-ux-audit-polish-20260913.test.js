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

function voerUit(breedte,hoogte,modus="licht"){
  const reporter=`<script>
window.addEventListener('DOMContentLoaded',()=>{const zet=(k,v)=>document.body.setAttribute('data-audit-'+k,String(v));try{
  const app=document.getElementById('app'),chips=document.getElementById('chips'),days=document.getElementById('days'),warnings=document.getElementById('waarschuwingen'),results=document.getElementById('res'),thema=document.getElementById('thema');
  app.style.display='block';app.style.visibility='visible';
  chips.innerHTML='<div class="chipskop">Bewaarde plaatsen</div><div class="chiprij"><button class="chip add">+ Deze plaats bewaren</button></div>';
  days.innerHTML='<div class="row day" role="button" tabindex="0"><div class="dname">ma 14</div><div class="dico"></div><div class="dcond">Half bewolkt</div><div class="dwind">3 Bft</div><div class="dmin">12°</div><div class="bar"></div><div class="dmax">19°</div><div class="drain">20%</div></div>';
  warnings.innerHTML='<div class="waarsch" data-ui-severity="oranje"><h3>Waakzaamheid voor overstromingen</h3><p>Volg de officiële aanwijzingen.</p></div>';
  results.innerHTML='<div role="option"><span class="zoekresultaat-naam">Dubai</span><span class="zoekresultaat-detail">Siddharthnagar, Uttar Pradesh, India</span></div>';results.classList.add('on');
  thema.innerHTML='<button type="button" id="thema-auto" class="wiw-theme-auto" data-thema-keuze="auto" aria-pressed="true">Auto</button><button type="button" id="thema-switch" class="wiw-theme-switch" role="switch" aria-checked="false" aria-label="Automatisch; nu Licht"><span class="wiw-theme-icon wiw-theme-sun" data-thema-handmatig="licht" aria-hidden="true">☀</span><span class="wiw-theme-track" aria-hidden="true"><span class="wiw-theme-thumb"></span></span><span class="wiw-theme-icon wiw-theme-moon" data-thema-handmatig="donker" aria-hidden="true">☾</span></button>';thema.dataset.actieveThemaKeuze='auto';thema.dataset.effectieveThema='licht';
  const hour=document.createElement('table');hour.className='wiw-hour-table';hour.innerHTML='<thead><tr><th>Tijd</th><th>Weer</th><th>Temperatuur</th></tr></thead><tbody><tr><td><time>18:00</time><span class="wiw-hour-date">ma 14</span></td><td>Helder</td><td><span class="wiw-hour-primary">18°</span><span class="wiw-hour-secondary">voelt 17°</span></td></tr></tbody>';app.appendChild(hour);
  const nav=document.querySelector('.mobile-section-nav'),links=[...nav.querySelectorAll('a')],row=days.querySelector('[role="button"]'),warning=warnings.firstElementChild,detail=results.querySelector('.zoekresultaat-detail'),add=chips.querySelector('.chip.add'),kop=hour.querySelector('th'),sec=hour.querySelector('.wiw-hour-secondary'),hint=document.querySelector('.hint'),schakelaar=thema.querySelector('#thema-switch'),track=thema.querySelector('.wiw-theme-track'),thumb=thema.querySelector('.wiw-theme-thumb');
  const footer=document.querySelector('footer'),directe=[...footer.querySelectorAll(':scope > span.bron')],bronnen=directe.find(x=>x.querySelector('a[href*="open-meteo.com"]')),over=directe.find(x=>x.querySelector('a[href="/over/"]')),privacy=directe.find(x=>x.querySelector('a[href="/privacy"]')),disclaimer=directe.find(x=>/Weersinformatie is algemeen/.test(x.textContent||'')),details=footer.querySelector(':scope > details.footer-details'),contact=footer.querySelector('.footer-contact'),plaatsnav=document.querySelector('.seo-plaatsnav'),plaatsgrid=plaatsnav&&plaatsnav.querySelector('.seo-plaatsnav-links'),plaatskop=plaatsnav&&plaatsnav.querySelector('.seo-plaatsnav-kop'),sheet=document.querySelector('.sheet');
  if(!bronnen||!over||!privacy||!disclaimer||!details||!contact||!plaatsnav||!plaatsgrid||!plaatskop||!sheet)throw new Error('footerbronnen, hulplinks, contact, disclaimer of plaatsnavigatie ontbreken');
  /* De fixture verwijdert product-JS expres om alleen de finale cascade te meten.
     Bouw daarom hier dezelfde semantische bronitems op die structureerBronnen()
     in de echte runtime maakt; anders meten we niet-bestaande .bronitem-nodes. */
  if(!bronnen.classList.contains('bron-bronnen')){
    const bronlinks=[...bronnen.querySelectorAll('a')];
    if(bronlinks.length<4)throw new Error('te weinig bronlinks voor mobiele footerfixture');
    bronnen.classList.add('bron-bronnen');
    bronnen.replaceChildren();
    const bronlabel=document.createElement('span');bronlabel.className='bronlabel';bronlabel.textContent='Bronnen voor deze weergave';bronnen.appendChild(bronlabel);
    bronlinks.forEach(a=>{const item=document.createElement('span');item.className='bronitem';item.appendChild(a);bronnen.appendChild(item);});
    [...bronnen.querySelectorAll('.bronitem')].forEach(item=>{if(/National Weather Service|BigDataCloud|OpenStreetMap/i.test(item.textContent||''))item.hidden=true;});
  }
  plaatsnav.classList.add('weer-klaar');
  const cs=x=>getComputedStyle(x),pseudo=getComputedStyle(row,'::after'),midden=x=>{const r=x.getBoundingClientRect();return (r.top+r.bottom)/2;};
  const focusDoel=cs(nav).display==='none'?row:links[0];focusDoel.focus();
  zet('nav-display',cs(nav).display);zet('nav-links',links.length);zet('nav-min-height',Math.min(...links.map(x=>x.getBoundingClientRect().height)));
  zet('focus-width',parseFloat(cs(focusDoel).outlineWidth)||0);zet('day-arrow',pseudo.content);zet('add-border',cs(add).borderStyle);
  zet('warning-width',parseFloat(cs(warning).borderLeftWidth)||0);zet('warning-color',cs(warning).borderLeftColor);zet('warning-title-weight',cs(warning.querySelector('h3')).fontWeight);
  zet('detail-display',cs(detail).display);zet('detail-size',parseFloat(cs(detail).fontSize)||0);zet('theme-role',thema.getAttribute('role'));zet('theme-choice',thema.dataset.actieveThemaKeuze||'');zet('theme-auto-pressed',thema.querySelector('#thema-auto')?.getAttribute('aria-pressed')||'');zet('theme-toggle-width',schakelaar.getBoundingClientRect().width);zet('theme-track-width',track.getBoundingClientRect().width);zet('theme-thumb-width',thumb.getBoundingClientRect().width);zet('theme-center-delta',Math.abs(midden(track)-midden(thema)).toFixed(3));
  const footerRect=footer.getBoundingClientRect(),bronnenRect=bronnen.getBoundingClientRect(),overRect=over.getBoundingClientRect(),privacyRect=privacy.getBoundingClientRect(),detailsRect=details.getBoundingClientRect(),disclaimerRect=disclaimer.getBoundingClientRect();
  const zichtbarePlaatslinks=[...plaatsgrid.querySelectorAll('a')].filter(x=>cs(x).display!=='none'),utilityTargets=[over.querySelector('a'),privacy.querySelector('a'),details.querySelector('summary')].filter(Boolean),sourceTargets=[...bronnen.querySelectorAll('.bronitem:not([hidden]) a')],contactMail=contact.querySelector('a'),contactParts=[contact.querySelector('.footer-contact-question'),contact.querySelector('.footer-contact-mail')].filter(Boolean);
  zet('source-overflow',Math.max(0,footerRect.left-bronnenRect.left,bronnenRect.right-footerRect.right).toFixed(3));zet('footer-display',cs(footer).display);zet('over-text',(over.textContent||'').trim());zet('privacy-text',(privacy.textContent||'').trim());zet('over-top',overRect.top.toFixed(3));zet('privacy-top',privacyRect.top.toFixed(3));zet('details-top',detailsRect.top.toFixed(3));zet('disclaimer-bottom',disclaimerRect.bottom.toFixed(3));
  zet('utility-center-delta',Math.abs(((overRect.left+detailsRect.right)/2)-((footerRect.left+footerRect.right)/2)).toFixed(3));
  const utilityRects=utilityTargets.map(x=>x.getBoundingClientRect()),sourceRects=sourceTargets.map(x=>x.getBoundingClientRect()),contactRects=contactParts.map(x=>x.getBoundingClientRect()),contactRect=contact.getBoundingClientRect();
  const uniekeBronRijen=[...new Set(sourceRects.map(r=>Math.round(r.top)))];
  zet('utility-hit-height',Math.min(...utilityRects.map(r=>r.height)).toFixed(3));
  zet('utility-row-delta',(Math.max(...utilityRects.map(r=>r.top))-Math.min(...utilityRects.map(r=>r.top))).toFixed(3));
  zet('source-hit-height',(sourceRects.length?Math.min(...sourceRects.map(r=>r.height)):0).toFixed(3));
  zet('source-visible-count',sourceRects.length);
  zet('source-row-count',uniekeBronRijen.length);
  zet('source-layout',cs(bronnen).display);
  zet('source-width',bronnenRect.width.toFixed(3));
  zet('disclaimer-line-height',parseFloat(cs(disclaimer).lineHeight)||0);
  zet('disclaimer-line-count',Math.round(disclaimerRect.height/(parseFloat(cs(disclaimer).lineHeight)||1)));
  zet('disclaimer-width',disclaimerRect.width.toFixed(3));
  zet('contact-row-delta',contactRects.length?(Math.max(...contactRects.map(r=>r.top))-Math.min(...contactRects.map(r=>r.top))).toFixed(3):'999');
  zet('source-disclaimer-gap',Math.max(0,disclaimerRect.top-bronnenRect.bottom).toFixed(3));
  zet('utility-contact-gap',Math.max(0,contactRect.top-Math.max(...utilityRects.map(r=>r.bottom))).toFixed(3));
  zet('contact-hit-height',contactMail?contactMail.getBoundingClientRect().height.toFixed(3):'0');
  zet('footer-height',footerRect.height.toFixed(3));
  zet('footer-margin-top',parseFloat(cs(footer).marginTop)||0);
  zet('footer-padding-top',parseFloat(cs(footer).paddingTop)||0);
  zet('footer-row-gap',parseFloat(cs(footer).rowGap)||0);
  zet('source-row-gap',parseFloat(cs(bronnen).rowGap)||0);
  zet('contact-margin-top',parseFloat(cs(contact).marginTop)||0);
  zet('sheet-padding-bottom',parseFloat(cs(sheet).paddingBottom)||0);
  zet('place-display',cs(plaatsgrid).display);
  zet('place-columns',cs(plaatsgrid).display==='grid'?(cs(plaatsgrid).gridTemplateColumns||'').split(/\\s+/).filter(Boolean).length:0);
  zet('css-width',innerWidth);
  zet('place-link-min-height',Math.min(...zichtbarePlaatslinks.map(x=>x.getBoundingClientRect().height)).toFixed(3));
  zet('place-heading-size',parseFloat(cs(plaatskop).fontSize)||0);
  zet('place-overflow',Math.max(0,plaatsnav.getBoundingClientRect().right-innerWidth,-plaatsnav.getBoundingClientRect().left).toFixed(3));
  const pageBottom=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);
  zet('page-end-gap',Math.max(0,pageBottom-plaatsnav.getBoundingClientRect().bottom-window.scrollY).toFixed(3));
  zet('body-padding-bottom',parseFloat(cs(document.body).paddingBottom)||0);
  zet('place-padding-bottom',parseFloat(cs(plaatsnav).paddingBottom)||0);
  zet('place-margin-top',parseFloat(cs(plaatsnav).marginTop)||0);
  zet('place-padding-top',parseFloat(cs(plaatsnav).paddingTop)||0);
  zet('place-bg',cs(plaatsnav).backgroundColor);zet('sheet-bg',cs(document.querySelector('.sheet')).backgroundColor);zet('mode',document.documentElement.dataset.thema||'');
  zet('header-size',parseFloat(cs(kop).fontSize)||0);zet('secondary-size',parseFloat(cs(sec).fontSize)||0);zet('hint-size',parseFloat(cs(hint).fontSize)||0);
  zet('overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}}, {once:true});
</script>`;
  if(!basis.includes('<html lang="nl">'))throw new Error("verwachte html-root ontbreekt");
  const themed=basis.replace('<html lang="nl">',`<html lang="nl" data-thema="${modus==="donker"?"donker":"licht"}">`);
  const html=themed.replace("</body>",lateRuntimeStijl+reporter+"</body>"),dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-ui-ux-audit-"));
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
    if(v("theme-role")!=="group"||v("theme-choice")!=="auto"||v("theme-auto-pressed")!=="true")throw new Error("Auto-togglestatus ontbreekt op "+breedte+"px");
    if(Number(v("theme-toggle-width"))<70||Number(v("theme-track-width"))<24||Number(v("theme-thumb-width"))<10)throw new Error("zichtbare zon/maan-toggle ontbreekt op "+breedte+"px");
    if(Number(v("theme-center-delta"))>1)throw new Error("zon/maan-track staat niet verticaal gecentreerd op "+breedte+"px: delta "+v("theme-center-delta")+"px");
    if(v("over-text")!=="Over deze site")throw new Error("footer gebruikt niet de compacte Over-link: "+v("over-text"));
    if(v("privacy-text")!=="Privacy & gegevens")throw new Error("privacyhulplink wijkt af: "+v("privacy-text"));
    if(Number(v("overflow"))>2)throw new Error("horizontale overflow op "+breedte+"px: "+v("overflow"));
    if(breedte<=900){
      if(v("nav-display")!=="grid"||Number(v("nav-min-height"))<43.5)throw new Error("mobiele sectienavigatie is niet zichtbaar/aanraakbaar op "+breedte+"px");
      if(Number(v("header-size"))<10.9||Number(v("secondary-size"))<11.4||Number(v("hint-size"))<12.9)throw new Error("mobiele microcopy blijft te klein op "+breedte+"px");
      if(v("day-arrow")!=="none")throw new Error("desktopchevron lekt naar mobiel op "+breedte+"px");
      const cssWidth=Number(v("css-width"))||breedte;
      if(v("footer-display")!=="grid")throw new Error("mobiele footer is "+v("footer-display")+" in plaats van één expliciete grid op "+breedte+"px");
      if(Number(v("utility-hit-height"))<43.5)throw new Error("footerhulplink heeft geen 44px tap-zone op "+breedte+"px: "+v("utility-hit-height")+"px");
      if(Number(v("source-hit-height"))<43.5)throw new Error("bronlink heeft geen 44px tap-zone op "+breedte+"px: "+v("source-hit-height")+"px");
      if(Number(v("contact-hit-height"))<43.5)throw new Error("contactmail heeft geen 44px tap-zone op "+breedte+"px: "+v("contact-hit-height")+"px");
      if(v("source-layout")!=="flex")throw new Error("bronlinks gebruiken geen flexritme op "+breedte+"px: "+v("source-layout"));
      if(Number(v("source-visible-count"))<4||Number(v("source-row-count"))>2)throw new Error("zichtbare bronlinks verdelen niet compact over maximaal twee rijen op "+breedte+"px: "+v("source-visible-count")+" links / "+v("source-row-count")+" rijen");
      if(Number(v("disclaimer-line-height"))>17.1)throw new Error("disclaimer houdt een te ruime regelhoogte op "+breedte+"px: "+v("disclaimer-line-height")+"px");
      if(cssWidth>=371&&Number(v("contact-row-delta"))>1)throw new Error("contactvraag en mail staan niet op één compacte rij op "+breedte+"px / CSS "+cssWidth+"px: delta "+v("contact-row-delta")+"px");
      if(cssWidth>=390&&cssWidth<=430&&Number(v("utility-row-delta"))>1)throw new Error("footerhulplinks staan op "+breedte+"px / CSS "+cssWidth+"px nog over meerdere rijen: delta "+v("utility-row-delta")+"px");
      if(breedte>=390&&breedte<=430)console.log("footer-meting "+modus+" "+breedte+"px / CSS "+cssWidth+"px: hoogte="+v("footer-height")+"px, bronnen="+v("source-visible-count")+" in "+v("source-row-count")+" rijen, bronhit="+v("source-hit-height")+"px, disclaimer="+v("disclaimer-width")+"px / "+v("disclaimer-line-count")+" regels, contact-delta="+v("contact-row-delta")+"px, utility-delta="+v("utility-row-delta")+"px");
      if(Number(v("footer-margin-top"))>6.5)throw new Error("mobiele footer houdt te veel bovenmarge op "+breedte+"px: "+v("footer-margin-top")+"px");
      if(Number(v("footer-padding-top"))>0.5)throw new Error("mobiele footer houdt te veel bovenpadding op "+breedte+"px: "+v("footer-padding-top")+"px");
      if(Number(v("footer-row-gap"))>0.5||Number(v("source-row-gap"))>0.5)throw new Error("mobiele footer/bronnen houden verticale row-gap op "+breedte+"px");
      if(Number(v("contact-margin-top"))>0.5)throw new Error("mobiele contactregel houdt nog extra bovenmarge op "+breedte+"px");
      if(Number(v("sheet-padding-bottom"))>4.5)throw new Error("mobiele sheet houdt te veel ruimte onder footercontact op "+breedte+"px: "+v("sheet-padding-bottom")+"px");
      if(Number(v("place-margin-top"))>8.5||Number(v("place-padding-top"))>8.5)throw new Error("overgang naar populaire plaatsen blijft te ruim op "+breedte+"px: margin "+v("place-margin-top")+"px, padding "+v("place-padding-top")+"px");
      const expectedColumns=cssWidth>=600?3:2;
      if(v("place-display")!=="grid")throw new Error("populaire plaatsen is "+v("place-display")+" in plaats van grid op request "+breedte+"px / CSS "+cssWidth+"px");
      if(Number(v("place-columns"))!==expectedColumns)throw new Error("populaire plaatsen gebruikt "+v("place-columns")+" kolommen op request "+breedte+"px / CSS "+cssWidth+"px, verwacht "+expectedColumns);
      if(Number(v("place-link-min-height"))<43.5)throw new Error("populaire-plaatsenlink is te laag op "+breedte+"px: "+v("place-link-min-height")+"px");
      if(Number(v("place-heading-size"))<18.9)throw new Error("populaire-plaatsenkop blijft te klein op "+breedte+"px");
      if(Number(v("place-overflow"))>1)throw new Error("populaire plaatsen loopt buiten viewport op "+breedte+"px: "+v("place-overflow")+"px");
      if(Number(v("place-padding-bottom"))>0.5)throw new Error("populaire plaatsen houdt nog loze onderpadding op "+breedte+"px: "+v("place-padding-bottom")+"px");
      if(Number(v("page-end-gap"))>1.5)throw new Error("mobiele pagina houdt buiten de safe-area nog loze eindruimte op "+breedte+"px: "+v("page-end-gap")+"px");
      if(Number(v("body-padding-bottom"))>1.5)throw new Error("headless mobiel houdt nog basis-bodypadding onder de laatste sectie op "+breedte+"px: "+v("body-padding-bottom")+"px");
      if(modus==="donker"&&(v("mode")!=="donker"||v("place-bg")==="rgb(255, 255, 255)"||v("sheet-bg")==="rgb(255, 255, 255)"))throw new Error("donkere mobiele afsluiting valt terug naar witte achtergrond op "+breedte+"px");
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

for(const [w,h] of [[320,844],[360,900],[390,844],[430,932],[768,1024],[1280,1000],[1440,1000],[1920,1080]])voerUit(w,h,"licht");
for(const [w,h] of [[390,844],[430,932]])voerUit(w,h,"donker");
console.log("UI/UX-auditbrowserregressie groen op 320/360/390/430/768px plus brede desktop en aparte donkere 390/430px-runs: navigatie, typografie, 44px tap-zones, populaire-plaatsengrid, dark mode, focus, waarschuwingsernst en footeruitlijning gemeten zonder overflow.");

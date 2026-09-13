"use strict";

const fs=require("fs"),os=require("os"),path=require("path"),{spawnSync}=require("child_process");
function vindBrowser(){for(const n of [process.env.CHROME_PATH,process.env.CHROMIUM_PATH,"google-chrome","google-chrome-stable","chromium","chromium-browser"].filter(Boolean)){const r=spawnSync(n,["--version"],{encoding:"utf8"});if(r.status===0)return n;}return null;}
const browser=vindBrowser();
if(!browser){if(process.env.CI){console.error("FOUT UI/UX-auditbrowsertest: Chrome/Chromium ontbreekt.");process.exit(1);}console.log("SKIP UI/UX-auditbrowsertest: lokaal geen Chrome/Chromium.");process.exit(0);}
const productie=path.join(__dirname,"public","index.html");
if(!fs.existsSync(productie))throw new Error("public/index.html ontbreekt.");
let basis=fs.readFileSync(productie,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"");
if(!basis.includes('id="wiw-ui-ux-audit-polish-20260913"'))throw new Error("UI/UX-auditstylesheet ontbreekt in finale artifact");
if(!basis.includes('class="footer-disclaimer-row"')||!basis.includes('class="footer-utility-row"'))throw new Error("structurele footer-rijcontainers ontbreken in finale artifact");
if(basis.includes("watishetweer.nl · Over deze site"))throw new Error("oude samengestelde Over-link staat nog in finale footer");
basis=basis.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<script\b[^>]*\/>/gi,"");

function voerUit(breedte,hoogte,thema){
  const reporter=`<script>
window.addEventListener('DOMContentLoaded',()=>{const zet=(k,v)=>document.body.setAttribute('data-audit-'+k,String(v));try{
  if(${JSON.stringify(thema)}==='donker')document.documentElement.dataset.thema='donker';else document.documentElement.removeAttribute('data-thema');
  const app=document.getElementById('app'),chips=document.getElementById('chips'),days=document.getElementById('days'),warnings=document.getElementById('waarschuwingen'),results=document.getElementById('res'),themaKnop=document.getElementById('thema');
  app.style.display='block';app.style.visibility='visible';
  chips.innerHTML='<div class="chipskop">Bewaarde plaatsen</div><div class="chiprij"><button class="chip add">+ Deze plaats bewaren</button></div>';
  days.innerHTML='<div class="row day" role="button" tabindex="0"><div class="dname">ma 14</div><div class="dico"></div><div class="dcond">Half bewolkt</div><div class="dwind">3 Bft</div><div class="dmin">12°</div><div class="bar"></div><div class="dmax">19°</div><div class="drain">20%</div></div>';
  warnings.innerHTML='<div class="waarsch" data-ui-severity="oranje"><h3>Waakzaamheid voor overstromingen</h3><p>Volg de officiële aanwijzingen.</p></div>';
  results.innerHTML='<div role="option"><span class="zoekresultaat-naam">Dubai</span><span class="zoekresultaat-detail">Siddharthnagar, Uttar Pradesh, India</span></div>';results.classList.add('on');
  themaKnop.innerHTML='Weergave <span class="thema-status" aria-hidden="true">A</span>';themaKnop.dataset.actieveThemakeuze='auto';
  const hour=document.createElement('table');hour.className='wiw-hour-table';hour.innerHTML='<thead><tr><th>Tijd</th><th>Weer</th><th>Temperatuur</th></tr></thead><tbody><tr><td><time>18:00</time><span class="wiw-hour-date">ma 14</span></td><td>Helder</td><td><span class="wiw-hour-primary">18°</span><span class="wiw-hour-secondary">voelt 17°</span></td></tr></tbody>';app.appendChild(hour);
  const nav=document.querySelector('.mobile-section-nav'),links=[...nav.querySelectorAll('a')],row=days.querySelector('[role="button"]'),warning=warnings.firstElementChild,detail=results.querySelector('.zoekresultaat-detail'),add=chips.querySelector('.chip.add'),kop=hour.querySelector('th'),sec=hour.querySelector('.wiw-hour-secondary'),hint=document.querySelector('.hint'),status=themaKnop.querySelector('.thema-status');
  const footer=document.querySelector('footer'),source=[...footer.children].find(x=>x.matches('span.bron')&&x.querySelector('b')?.textContent.trim()==='Bronnen'),disclaimerRow=footer.querySelector(':scope > .footer-disclaimer-row'),utilityRow=footer.querySelector(':scope > .footer-utility-row');
  const disclaimer=disclaimerRow?.querySelector(':scope > span.bron'),overLink=utilityRow?.querySelector('a[href="/over/"]'),privacyLink=utilityRow?.querySelector('a[href="/privacy"],a[href="/privacy.html"]'),details=utilityRow?.querySelector(':scope > details.footer-details'),summary=details?.querySelector(':scope > summary');
  if(!source||!disclaimerRow||!utilityRow||!disclaimer||!overLink||!privacyLink||!details||!summary)throw new Error('structurele footerlagen of utility-items ontbreken');
  const cs=x=>getComputedStyle(x),pseudo=getComputedStyle(row,'::after'),midden=x=>{const r=x.getBoundingClientRect();return (r.top+r.bottom)/2;};
  const rgb=s=>{const m=String(s).match(/[\d.]+/g);return m?m.slice(0,3).map(Number):null;},lum=rgbv=>{const c=rgbv.map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2];},contrast=(a,b)=>{a=lum(rgb(a));b=lum(rgb(b));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
  const focusDoel=cs(nav).display==='none'?row:links[0];focusDoel.focus();
  zet('nav-display',cs(nav).display);zet('nav-links',links.length);zet('nav-min-height',Math.min(...links.map(x=>x.getBoundingClientRect().height)));
  zet('focus-width',parseFloat(cs(focusDoel).outlineWidth)||0);zet('day-arrow',pseudo.content);zet('add-border',cs(add).borderStyle);
  zet('warning-width',parseFloat(cs(warning).borderLeftWidth)||0);zet('warning-color',cs(warning).borderLeftColor);zet('warning-title-weight',cs(warning.querySelector('h3')).fontWeight);
  zet('detail-display',cs(detail).display);zet('detail-size',parseFloat(cs(detail).fontSize)||0);zet('theme-status-width',status.getBoundingClientRect().width);zet('theme-center-delta',Math.abs(midden(status)-midden(themaKnop)).toFixed(3));
  const sr=source.getBoundingClientRect(),dr=disclaimerRow.getBoundingClientRect(),ur=utilityRow.getBoundingClientRect(),or=overLink.getBoundingClientRect(),pr=privacyLink.getBoundingClientRect(),tr=summary.getBoundingClientRect();
  zet('source-bottom',sr.bottom.toFixed(3));zet('disclaimer-top',dr.top.toFixed(3));zet('disclaimer-bottom',dr.bottom.toFixed(3));zet('utility-top',ur.top.toFixed(3));
  zet('over-top',or.top.toFixed(3));zet('privacy-top',pr.top.toFixed(3));zet('details-top',tr.top.toFixed(3));
  zet('over-text',(overLink.textContent||'').trim());zet('privacy-text',(privacyLink.textContent||'').trim());zet('details-text',(summary.textContent||'').trim());
  zet('over-href',overLink.getAttribute('href')||'');zet('privacy-href',privacyLink.getAttribute('href')||'');zet('over-pointer',cs(overLink).pointerEvents);zet('privacy-pointer',cs(privacyLink).pointerEvents);zet('summary-pointer',cs(summary).pointerEvents);
  const sheet=document.querySelector('.sheet'),achtergrond=cs(sheet).backgroundColor;zet('over-contrast',contrast(cs(overLink).color,achtergrond).toFixed(3));zet('privacy-contrast',contrast(cs(privacyLink).color,achtergrond).toFixed(3));zet('summary-contrast',contrast(cs(summary).color,achtergrond).toFixed(3));
  overLink.focus();zet('over-focus',parseFloat(cs(overLink).outlineWidth)||0);summary.focus();zet('summary-focus',parseFloat(cs(summary).outlineWidth)||0);summary.click();zet('details-open',details.open?'1':'0');details.open=false;
  zet('header-size',parseFloat(cs(kop).fontSize)||0);zet('secondary-size',parseFloat(cs(sec).fontSize)||0);zet('hint-size',parseFloat(cs(hint).fontSize)||0);
  zet('overflow',Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);zet('done','ok');
}catch(e){zet('exception',e&&e.stack||e);zet('done','fout');}}, {once:true});
</script>`;
  const html=basis.replace("</body>",reporter+"</body>"),dir=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-ui-ux-audit-"));
  try{
    const pad=path.join(dir,"index.html");fs.writeFileSync(pad,html,"utf8");
    const r=spawnSync(browser,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",`--window-size=${breedte},${hoogte}`,"--virtual-time-budget=1200","--dump-dom","file://"+pad],{encoding:"utf8",maxBuffer:24*1024*1024,timeout:20000});
    if(r.status!==0)throw new Error("browser exit "+r.status+": "+String(r.stderr||"").slice(-1200));
    const decode=s=>s&&s.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">");
    const dom=r.stdout||"",v=k=>{const m=new RegExp('data-audit-'+k+'="([^"]*)"').exec(dom);return m&&decode(m[1]);};
    const waar=(ok,msg)=>{if(!ok)throw new Error(`${breedte}px ${thema}: ${msg}`);};
    waar(v("done")==="ok","reporter: "+v("exception"));
    waar(Number(v("nav-links"))===4,"sectienavigatie mist doelen");
    waar(Number(v("focus-width"))>=1.9,"focusring is dunner dan 2px");
    waar(Number(v("warning-width"))>=2.9&&Number(v("warning-title-weight"))>=600,"oranje waarschuwing mist zichtbare ernst");
    waar(v("warning-color")&&v("warning-color")!=="rgba(0, 0, 0, 0)","oranje waarschuwing mist accentkleur");
    waar(v("detail-display")==="block"&&Number(v("detail-size"))>=12.4,"locatiedetail is niet leesbaar");
    waar(Number(v("theme-status-width"))>=15.5,"zichtbare themastatus ontbreekt");
    waar(Number(v("theme-center-delta"))<=1,"thema-icoon staat niet verticaal gecentreerd: delta "+v("theme-center-delta")+"px");
    waar(v("over-text")==="Over deze site","footer gebruikt niet exact Over deze site: "+v("over-text"));
    waar(v("privacy-text")==="Privacy & gegevens","privacyhulplink wijkt af: "+v("privacy-text"));
    waar(v("details-text")==="Technische locatiegegevens","technische hulplink wijkt af: "+v("details-text"));
    waar(v("over-href")==="/over/","Over-linkdoel is gewijzigd: "+v("over-href"));
    waar(/^\/privacy(?:\.html)?$/.test(v("privacy-href")||""),"Privacy-linkdoel is gewijzigd: "+v("privacy-href"));
    waar(v("over-pointer")!=="none"&&v("privacy-pointer")!=="none"&&v("summary-pointer")!=="none","utility-item is niet klikbaar");
    waar(Number(v("over-focus"))>=1.9&&Number(v("summary-focus"))>=1.9,"bestaande utility-focusstijl is niet zichtbaar");
    waar(v("details-open")==="1","Technische locatiegegevens kan niet via summary worden geopend");
    waar(Number(v("over-contrast"))>=4.5&&Number(v("privacy-contrast"))>=4.5&&Number(v("summary-contrast"))>=4.5,"utility-contrast onder 4.5:1");
    waar(Number(v("source-bottom"))<=Number(v("disclaimer-top"))+0.5,"bronnen staan niet vóór disclaimer");
    waar(Number(v("utility-top"))>=Number(v("disclaimer-bottom"))-0.5,"utilitygroep staat niet fysiek onder disclaimer");
    waar(Math.abs((Number(v("utility-top"))+1)-Number(v("disclaimer-top")))>1,"disclaimer en utilitygroep delen dezelfde rij");
    waar(Number(v("overflow"))<=2,"horizontale overflow: "+v("overflow"));
    if(breedte<=900){
      waar(v("nav-display")==="grid"&&Number(v("nav-min-height"))>=43.5,"mobiele sectienavigatie is niet zichtbaar/aanraakbaar");
      waar(Number(v("header-size"))>=10.9&&Number(v("secondary-size"))>=11.4&&Number(v("hint-size"))>=12.9,"mobiele microcopy blijft te klein");
      waar(v("day-arrow")==="none","desktopchevron lekt naar mobiel");
    }else{
      waar(v("nav-display")==="none","mobiele sectienavigatie lekt naar desktop");
      waar(/[›]/.test(v("day-arrow")||""),"weekrij mist desktopchevron: "+v("day-arrow"));
      waar(v("add-border")==="solid","bewaaractie oogt op desktop nog tijdelijk: "+v("add-border"));
      waar(Math.abs(Number(v("over-top"))-Number(v("privacy-top")))<=1,"Over en Privacy staan niet op dezelfde utilityrij");
      waar(Math.abs(Number(v("over-top"))-Number(v("details-top")))<=1,"Technische locatiegegevens staat niet op dezelfde utilityrij");
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

for(const thema of ["licht","donker"])for(const [w,h] of [[360,900],[390,900],[1440,1000]])voerUit(w,h,thema);
console.log("UI/UX-auditbrowserregressie groen op 360px, 390px en 1440px in licht en donker: drie structurele footerlagen, exacte utilitycopy, klikbaarheid, focus, contrast en overflow zijn geometrisch gemeten.");

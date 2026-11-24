"use strict";

/* Menu en zijbalk (UI PR #2, eigenaar 19 november) op het finale artifact, met
   de echte runtime. Gecontroleerd op 320, 360, 390, 430, 450, 481, 559, 560, 768, 1024, 1366,
   1440 en 1920px (licht en donker, NL en EN):
   - één menu als <details> vooraan in de bovenbalk, met daarnaast het logo
     (K2, eigenaar 24 november); Licht/Auto/Donker staat in het menu onder de
     vier groepen (keuze 1a) en de snelkoppeling Nachtzicht is weg;
   - dicht: alleen de knop, geen overflow; de eerste-schermgrenzen blijven
     (temperatuur ≤380px vanaf 360px, ≤560px op 320px; desktop ongewijzigd);
   - open/dicht met muis, Enter, Spatie, Escape (focus terug op de knop), klik
     buiten het menu en klik op een link; schermlezer: knop "Menu" met
     uitgeklapt/ingeklapt, navigatie "Menu";
   - de vier groepen (eigenaar 19 november): titels zichtbaar en klikbaar met
     een pijltje, links pas na een klik, één groep tegelijk open; ieder
     groepskopje is voor de schermlezer een knop met uitgeklapt/ingeklapt en
     een dichte groep heeft geen voorleesbare links;
   - alle bestemmingen bestaan als route of anker; Nachtzicht vanavond brengt de
     kop in beeld;
   - vanaf 1904px: hetzelfde menu als zijbalk "Snel naar" (K2) in de
     linkermarge, alle groepen uitgeklapt met de weergavekeuze eronder,
     leesbaar (titels ≥12px, links ≥14px, niets afgeknipt, vakjes ≥86px),
     zonder overlap met het vel, binnen het venster, vast bij scrollen en boven
     het einde van het vel; Escape sluit de groep, Enter opent hem weer;
     wisselen van venstergrootte schakelt tussen zijbalk en uitklapmenu;
   - footer: bronnen, disclaimer, Over, Privacy, technische gegevens en contact
     blijven; seizoens- en nachtlinks staan er niet meer in.
   - (20 november) geen menuwoord dat midden afbreekt, NL en EN, op iedere
     breedte en in de zijbalk; Licht/Auto/Donker niet afgeknipt en boven 430px
     minstens 86px per vakje, ook op 431–480px.

   Draait na: npm test of npm run build:cloudflare */


const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fixture(){
  const d=bouw({som:2.4,pp:(u,dag)=>dag===0&&u>=19&&u<=22?60:8,pr:(u,dag)=>dag===0&&u>=19&&u<=22?0.8:0});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});



function bestaat(href){
  if(href.startsWith("#")||href.startsWith("mailto:"))return true;
  const p=href.replace(/\/$/,"");
  return [path.join(OUT,p,"index.html"),path.join(OUT,p+".html"),path.join(OUT,p)].some(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
}

async function pagina(browser,root,w,h,schema,taal,aanraak){
  const touch=aanraak===undefined?w<700:aanraak;
  const context=await browser.newContext({viewport:{width:w,height:h},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",colorScheme:schema,isMobile:w<700,hasTouch:touch});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T15:39:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture()});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T17:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/"+(taal==="en"?"?taal=en":""),{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:10000});
  await page.waitForFunction(()=>!document.getElementById("here")?.disabled,null,{timeout:10000});
  await sleep(700);
  return {context,page,fouten};
}

/* Wat een schermlezer krijgt: de toegankelijkheidsboom van Chrome zelf (een
   <summary> heet daar DisclosureTriangle en wordt voorgelezen als knop met
   uitgeklapt/ingeklapt), niet de benadering van Playwright. */
async function axMenu(page){
  const cdp=await page.context().newCDPSession(page);
  try{
    const {nodes}=await cdp.send("Accessibility.getFullAXTree");
    const waarde=n=>n&&n.value!==undefined?n.value:undefined;
    const prop=(n,k)=>{const p=(n.properties||[]).find(p=>p.name===k);return p?waarde(p.value):undefined;};
    /* Een groepstitel in een accordeon (<details name>) heet in Chrome DisclosureTriangleGrouped. */
    const isKnop=n=>!n.ignored&&/^(DisclosureTriangle|DisclosureTriangleGrouped|button)$/.test(waarde(n.role));
    const knop=nodes.find(n=>isKnop(n)&&/^Menu$/.test(String(waarde(n.name)||"").trim()));
    const nav=nodes.find(n=>!n.ignored&&waarde(n.role)==="navigation"&&waarde(n.name)==="Menu");
    const byId=new Map(nodes.map(n=>[n.nodeId,n]));
    const onder=(n,f,uit=[])=>{for(const c of (n&&n.childIds)||[]){const k=byId.get(c);if(!k)continue;if(f(k))uit.push(k);onder(k,f,uit);}return uit;};
    const groepen=nav?onder(nav,isKnop).map(n=>({naam:String(waarde(n.name)||"").trim(),uitgeklapt:prop(n,"expanded")})):[];
    const lijsten=nav?onder(nav,n=>!n.ignored&&waarde(n.role)==="list"):[];
    const links=nav?onder(nav,n=>!n.ignored&&waarde(n.role)==="link"):[];
    return {knopRol:knop&&waarde(knop.role),uitgeklapt:knop?prop(knop,"expanded"):undefined,nav:!!nav,groepen,lijsten:lijsten.map(l=>String(waarde(l.name)||"")),links:links.length};
  }finally{await cdp.detach();}
}

const meet=()=>{
  const zie=e=>!!(e&&e.checkVisibility&&e.checkVisibility({visibilityProperty:true,opacityProperty:true}));
  const r=e=>{if(typeof e==="string")e=document.querySelector(e);if(!e||!e.getClientRects().length)return null;const b=e.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height,ptop:b.top+scrollY};};
  const vak=e=>{const b=e.getBoundingClientRect();return {l:b.left,r:b.right,boven:b.top,b:b.bottom,h:b.height};};
  const menu=document.getElementById("wiw-menu"),knop=menu&&menu.querySelector(":scope > summary"),paneel=menu&&menu.querySelector(".wiw-menu-paneel"),balk=document.querySelector(".wiw-bovenbalk"),thema=document.getElementById("thema");
  const links=paneel?[...paneel.querySelectorAll("a")].map(a=>({href:a.getAttribute("href"),t:a.textContent.trim(),zicht:zie(a),fs:parseFloat(getComputedStyle(a).fontSize),knip:a.scrollWidth>a.clientWidth+1,...(zie(a)?vak(a):{})})):[];
  const groepen=paneel?[...paneel.querySelectorAll(".wiw-menu-groep")].map(g=>{const k=g.querySelector(":scope > summary"),u=g.querySelector("ul"),id=u&&u.getAttribute("aria-labelledby");
    return {kop:k?k.textContent.trim():"",label:id&&document.getElementById(id)===k,open:g.open,n:u?u.querySelectorAll("a").length:0,kopZicht:zie(k),kopFs:k?parseFloat(getComputedStyle(k).fontSize):0,kopKnip:k?k.scrollWidth>k.clientWidth+1:true,
      pijl:k?getComputedStyle(k,"::before").transform:"",linksZicht:u?[...u.querySelectorAll("a")].filter(zie).length:0,...(zie(k)?vak(k):{})};}):[];
  const voet=document.querySelector("footer"),sheet=document.querySelector(".sheet");
  const merk=balk&&balk.querySelector(":scope > .wiw-weer-merk"),railKop=paneel&&paneel.querySelector(".wiw-rail-kop"),laatsteGroep=paneel?[...paneel.querySelectorAll(".wiw-menu-groep")].pop():null;
  return {aantalMenus:document.querySelectorAll("#wiw-menu,.wiw-menu").length,merk:zie(merk)?r(merk):null,merkTekst:merk?merk.textContent.trim():"",snelNacht:document.querySelectorAll(".wiw-snel-nachtzicht").length,
    railKop:zie(railKop)?railKop.textContent.trim():"",themaOnderGroepen:!!(thema&&laatsteGroep&&zie(thema)&&thema.getBoundingClientRect().top>=laatsteGroep.getBoundingClientRect().bottom-1),inBalk:!!(balk&&menu&&balk.firstElementChild===menu),themaInMenu:!!(menu&&thema&&menu.contains(thema)),themaInBalk:!!(balk&&thema&&balk.contains(thema)),
    open:!!(menu&&menu.open),rail:document.documentElement.classList.contains("wiw-menu-rail"),knop:zie(knop)?r(knop):null,paneel:r(paneel),paneelZicht:zie(paneel),
    themaGeknipt:["#thema .wiw-theme-sun","#thema-auto","#thema .wiw-theme-moon"].some(s=>{const e=document.querySelector(s);return !!e&&zie(e)&&e.scrollWidth>e.clientWidth+1;}),
    thema:zie(thema)?r(thema):null,segs:["#thema .wiw-theme-sun","#thema-auto","#thema .wiw-theme-moon"].map(s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect().width:0;}),balk:r(balk),hero:r(".hero"),sheet:r(sheet),ctx:r(".seo-route-context"),plaatsnav:r(".seo-plaatsnav"),
    links,groepen,navLabel:paneel?paneel.getAttribute("aria-label"):"",knopTekst:knop?knop.textContent.replace(/\s+/g," ").trim():"",icoon:(()=>{const i=knop&&knop.querySelector(".wiw-menu-icoon");if(!zie(i))return null;const b=i.getBoundingClientRect();return {w:b.width,h:b.height};})(),
    voetTekst:voet?voet.textContent.replace(/\s+/g," "):"",voetHrefs:voet?[...voet.querySelectorAll("a")].map(a=>a.getAttribute("href")):[],
    overflow:document.documentElement.scrollWidth-innerWidth,focus:document.activeElement?(document.activeElement.tagName+"."+(document.activeElement.className||"")):""};
};
/* Geen woord breekt midden af: ieder woord (gescheiden door spaties of zachte afbreekstreepjes)
   van iedere groepstitel en menulink past op zijn eigen regel. Opent kort alle groepen en zet de staat terug. */
const woordbreuk=async()=>{
  const menu=document.getElementById("wiw-menu"),was=menu.open,groepen=[...document.querySelectorAll(".wiw-menu-paneel > .wiw-menu-groep")],open=groepen.map(g=>g.open);
  menu.open=true;const fout=[];
  for(const g of groepen){g.open=true;await new Promise(r=>setTimeout(r,30));
    for(const e of [g.querySelector("summary"),...g.querySelectorAll("a")]){
      const cs=getComputedStyle(e);let ruimte=e.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
      if(e.tagName==="SUMMARY"){const v=getComputedStyle(e,"::before");ruimte-=parseFloat(v.width)+parseFloat(v.marginLeft)+parseFloat(v.marginRight)+(parseFloat(cs.columnGap)||0);}
      const m=document.createElement("span");m.style.cssText=`position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font};letter-spacing:${cs.letterSpacing};text-transform:${cs.textTransform}`;document.body.appendChild(m);
      for(const w of e.textContent.trim().split(/[\s\u00ad]+/)){m.textContent=w;const b=m.getBoundingClientRect().width;if(b>ruimte+0.5)fout.push(`${w} ${b.toFixed(1)}>${ruimte.toFixed(1)}px`);}
      m.remove();}
    g.open=false;}
  groepen.forEach((g,i)=>{g.open=open[i];});menu.open=was;
  return fout;
};
const KOP=i=>`.wiw-menu-paneel > .wiw-menu-groep:nth-of-type(${i+1}) > summary`;

/* Iedere groep één voor één openen met een klik: alleen die groep open,
   zijn links zichtbaar, leesbaar en groot genoeg; schermlezer volgt mee. */
async function loopGroepen(page,label,eis){
  const n=(await page.evaluate(meet)).groepen.length;
  for(let i=0;i<n;i++){
    await page.click(KOP(i));await sleep(120);
    const m=await page.evaluate(meet),g=m.groepen[i];
    assert(m.groepen.every((x,j)=>x.open===(j===i)),`${label}: na klik op '${g.kop}' staat niet precies die groep open: ${JSON.stringify(m.groepen.map(x=>x.open))}`);
    assert.equal(g.linksZicht,g.n,`${label}: '${g.kop}' toont ${g.linksZicht} van ${g.n} links`);
    const eigen=m.links.filter(l=>l.zicht);
    assert.equal(eigen.length,g.n,`${label}: links van een dichte groep zichtbaar`);
    for(const l of eigen)eis(l,m,g);
    const ax=await axMenu(page);
    assert(ax.groepen.length===4&&ax.groepen.every((x,j)=>x.uitgeklapt===(j===i))&&ax.links===g.n&&ax.lijsten.length===1&&ax.lijsten[0].toLowerCase()===g.kop.toLowerCase()&&ax.groepen[i].naam.toLowerCase()===g.kop.toLowerCase(),`${label}: schermlezer na openen van '${g.kop}' klopt niet: ${JSON.stringify(ax)}`);
  }
  /* Nog eens op de open titel: groep weer dicht. */
  await page.click(KOP(n-1));await sleep(120);
  assert((await page.evaluate(meet)).groepen.every(x=>!x.open),`${label}: tweede klik op een titel sluit de groep niet`);
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  const regels=[];
  /* Eerste-schermposities zonder menu (main 78e8d1fd): desktop moet exact gelijk blijven. */
  const DESKTOP_HERO={1024:221,1366:208,1440:211};
  try{
    const gevallen=[[320,640,"light","nl"],[360,740,"light","nl"],[390,844,"light","nl"],[390,844,"dark","nl"],[430,932,"light","en"],[450,900,"light","nl"],[481,900,"light","nl"],[481,900,"light","en"],[559,900,"light","en"],[560,900,"light","nl"],
      [768,1024,"light","nl"],[1024,768,"light","nl"],[1366,768,"dark","nl"],[1440,900,"light","nl"],[1904,1080,"light","nl"],[1920,1080,"light","nl"],[1920,1080,"dark","en"],
      /* aanraakscherm op desktopbreedte en een laag breed venster */
      [1024,768,"light","nl",true],[1920,1080,"light","nl",true],[1920,640,"light","nl"]];
    for(const [w,h,schema,taal,aanraak] of gevallen){
      const touch=aanraak===undefined?w<700:aanraak;
      const label=`${w}×${h} ${schema}${taal==="en"?" EN":""}${aanraak?" aanraak":""}`;
      const {context,page,fouten}=await pagina(browser,root,w,h,schema,taal,aanraak);
      try{
        const m=await page.evaluate(meet);
        assert.equal(m.aantalMenus,1,`${label}: niet precies één menu`);
        assert(m.inBalk&&m.themaInMenu,`${label}: menu niet vooraan in de bovenbalk of weergavekeuze niet in het menu`);
        assert.equal(m.snelNacht,0,`${label}: snelkoppeling Nachtzicht staat nog in de bovenbalk`);
        assert(m.merk&&m.merkTekst==="watishetweer.nl"&&m.merk.height>=(w<=900||(aanraak===undefined?w<700:aanraak)?44:36)-0.5,`${label}: logo met naam ontbreekt in de bovenbalk of is te klein (${JSON.stringify(m.merk)})`);
        if(m.knop)assert(m.merk.left>=m.knop.right&&Math.abs((m.merk.top+m.merk.bottom)/2-(m.knop.top+m.knop.bottom)/2)<=3,`${label}: logo staat niet rechts naast de menuknop`);
        assert(m.overflow<=1,`${label}: horizontale overflow ${m.overflow}px`);
        assert.equal(m.groepen.length,4,`${label}: verwacht vier groepen`);
        assert(m.groepen.every(g=>g.kop&&g.label&&g.n>=2&&g.open===(w>=1904)),`${label}: groep zonder klikbare titel als label, met te weinig links, of open/dicht verkeerd (zijbalk: alles open): ${JSON.stringify(m.groepen.map(g=>[g.kop,g.label,g.n,g.open]))}`);
        for(const l of m.links)assert(bestaat(l.href),`${label}: bestemming bestaat niet: ${l.href}`);
        assert.equal(new Set(m.links.map(l=>l.href)).size,m.links.length,`${label}: dubbele bestemming in het menu`);
        assert.equal(m.links.length,15,`${label}: verwacht 15 bestemmingen`);
        const wb=await page.evaluate(woordbreuk);
        assert.deepEqual(wb,[],`${label}: menuwoord breekt midden af: ${wb.join(", ")}`);
        if(taal==="en")assert.deepEqual(m.groepen.map(g=>g.kop),["Weather and places","Stars and night","Seasons and holidays","About and information"],`${label}: groepen niet vertaald`);
        else assert.deepEqual(m.groepen.map(g=>g.kop),["Weer en plaatsen","Sterren en nacht","Seizoenen en feestdagen","Over en informatie"],`${label}: groepskoppen gewijzigd`);
        /* Footer: verplichte onderdelen blijven, seizoens- en nachtlinks weg; plaatscontext en populaire plaatsen blijven. */
        for(const v of taal==="en"?["Open-Meteo","About this site","Privacy & data","support@watishetweer.nl"]:["Open-Meteo","Weersinformatie is algemeen","Over deze site","Privacy & gegevens","Technische locatiegegevens","support@watishetweer.nl"])
          assert(m.voetTekst.includes(v),`${label}: footer mist '${v}'`);
        assert(!m.voetHrefs.some(h=>/^\/(witte-kerst|oud-en-nieuw|kerstvakantie|voorjaarsvakantie|meivakantie|zomervakantie|herfstvakantie|nachtzicht|maan)\//.test(h)),`${label}: footer bevat nog seizoens- of nachtlinks: ${m.voetHrefs.join(", ")}`);
        assert(m.ctx&&m.plaatsnav,`${label}: plaatscontext of populaire plaatsen ontbreekt`);
        const minDoel=w<=900||touch?44:w>=1904?30:36;
        /* Titels: zichtbaar zodra het menu open is (zijbalk: altijd), met pijltje naar rechts. */
        const titels=(x,lbl)=>{
          assert(x.groepen.every(g=>g.kopZicht&&g.kopFs>=12&&!g.kopKnip&&g.h>=minDoel-0.5&&g.pijl&&g.pijl!=="none"),`${lbl}: groepstitels niet zichtbaar, te klein, afgeknipt of zonder pijltje: ${JSON.stringify(x.groepen.map(g=>[g.kop,g.kopZicht,g.kopFs,Math.round(g.h||0),g.pijl]))}`);
          assert.equal(x.links.filter(l=>l.zicht).length,0,`${lbl}: links zichtbaar terwijl alle groepen dicht zijn`);
        };
        if(w>=1904){
          /* Zijbalk "Snel naar" (K2): alle groepen open, links zichtbaar, weergavekeuze eronder. */
          assert(m.rail&&m.open&&m.paneelZicht&&!m.knop,`${label}: zijbalk niet zichtbaar of menuknop nog zichtbaar`);
          assert.equal(m.railKop,taal==="en"?"Quick links":"Snel naar",`${label}: kop van de zijbalk ontbreekt of is niet vertaald`);
          assert(m.paneel.left>=7.5&&m.paneel.right<=m.sheet.left-7.5,`${label}: zijbalk valt niet in de linkermarge (${Math.round(m.paneel.left)}–${Math.round(m.paneel.right)}, vel vanaf ${Math.round(m.sheet.left)})`);
          assert.equal(m.navLabel,"Menu",`${label}: navigatie heeft geen naam`);
          assert(m.groepen.every(g=>g.kopZicht&&g.kopFs>=12&&!g.kopKnip&&g.h>=minDoel-0.5&&g.linksZicht===g.n),`${label}: groepstitels of links in de zijbalk niet zichtbaar, te klein of afgeknipt: ${JSON.stringify(m.groepen.map(g=>[g.kop,g.kopZicht,g.kopFs,Math.round(g.h||0),g.linksZicht,g.n]))}`);
          assert.equal(m.links.filter(l=>l.zicht).length,15,`${label}: niet alle 15 bestemmingen zichtbaar in de zijbalk`);
          for(const l of m.links)assert(l.fs>=14&&!l.knip&&l.r<=m.sheet.left-7.5&&l.h>=minDoel-0.5,`${label}: zijbalklink '${l.t}' onleesbaar, afgeknipt, over het vel of te klein (${l.fs}px, ${Math.round(l.h)}px hoog)`);
          assert(m.paneel.bottom<=h+1,`${label}: zijbalk loopt onder het venster door (${Math.round(m.paneel.bottom)} > ${h})`);
          assert(m.themaInMenu&&m.themaOnderGroepen&&!m.themaGeknipt&&m.segs.every(x=>x>=86),`${label}: weergavekeuze niet onder de groepen in de zijbalk, afgeknipt of vakjes te smal (${m.segs.map(Math.round).join("/")})`);
          const ax0=await axMenu(page);
          assert(ax0.nav&&ax0.groepen.length===4&&ax0.groepen.every(g=>g.uitgeklapt===true)&&ax0.links===15,`${label}: schermlezerstructuur zijbalk klopt niet: ${JSON.stringify(ax0)}`);
          /* Weergavekeuze in de zijbalk bereikbaar (ook als de zijbalk moet scrollen) en werkend. */
          const bereik=await page.evaluate(()=>{const p=document.querySelector(".wiw-menu-paneel"),t=document.getElementById("thema");t.scrollIntoView({block:"nearest"});const a=t.getBoundingClientRect(),q=p.getBoundingClientRect();return a.top>=q.top-1&&a.bottom<=q.bottom+1&&a.bottom<=innerHeight;});
          assert(bereik,`${label}: weergavekeuze in de zijbalk niet bereikbaar`);
          const t0=()=>page.evaluate(()=>document.documentElement.getAttribute("data-thema"));
          const begin0=await t0();await page.click("#thema .wiw-theme-moon");const d0=await t0();await page.click("#thema-auto");const a0=await t0();
          assert(d0==="donker"&&a0===begin0,`${label}: weergavekeuze in de zijbalk werkt niet (${begin0}→${d0}→${a0})`);
          await page.evaluate(()=>document.querySelector(".wiw-menu-paneel").scrollTop=0);
          /* Langste groep: laatste link met het toetsenbord bereikbaar; Escape sluit de groep en zet de focus op de titel; Enter opent hem weer. */
          const laatste=await page.evaluate(()=>{const p=document.querySelector(".wiw-menu-paneel"),a=[...p.querySelectorAll(".wiw-menu-groep:nth-of-type(3) a")].pop();a.focus();const r=a.getBoundingClientRect(),q=p.getBoundingClientRect();return {zicht:r.top>=q.top-1&&r.bottom<=q.bottom+1&&r.bottom<=innerHeight};});
          assert(laatste.zicht,`${label}: laatste link van de langste groep niet bereikbaar`);
          await page.keyboard.press("Escape");await sleep(100);
          const esc=await page.evaluate(()=>({open:document.querySelector(".wiw-menu-paneel > .wiw-menu-groep:nth-of-type(3)").open,focus:document.activeElement&&document.activeElement.id}));
          assert(!esc.open&&esc.focus==="wiw-menu-seizoen",`${label}: Escape in de zijbalk sluit de groep niet of zet de focus niet op de titel (${JSON.stringify(esc)})`);
          await page.keyboard.press("Enter");await sleep(100);
          const heropen=await page.evaluate(meet);
          assert(heropen.groepen.every(g=>g.open),`${label}: Enter opent de groep in de zijbalk niet weer (of sluit een andere): ${JSON.stringify(heropen.groepen.map(g=>g.open))}`);
          /* Vast bij scrollen en boven het einde van het vel */
          await page.evaluate(()=>document.querySelector(".wiw-menu-paneel").scrollTop=0);
          const m2=await page.evaluate(meet);
          for(const y of [600,1400]){
            await page.evaluate(y=>scrollTo(0,y),y);await sleep(250);
            const s=await page.evaluate(meet);
            assert(Math.abs(s.paneel.top-m2.paneel.top)<=1&&s.paneel.bottom<=s.sheet.bottom-15,`${label}: zijbalk niet vast bij scrollY ${y} (top ${Math.round(s.paneel.top)}, onder ${Math.round(s.paneel.bottom)}, vel tot ${Math.round(s.sheet.bottom)})`);
          }
          await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await sleep(300);
          const o=await page.evaluate(meet);
          assert(o.paneel.bottom<=o.sheet.bottom-15&&(!o.ctx||o.paneel.bottom<=o.ctx.top)&&o.paneel.bottom<=o.plaatsnav.top,`${label}: zijbalk overlapt onderaan (zijbalk tot ${Math.round(o.paneel.bottom)}, vel tot ${Math.round(o.sheet.bottom)}, plaatscontext ${Math.round(o.ctx&&o.ctx.top)})`);
          /* Groep dichtklikken onderaan: de zijbalk blijft netjes boven het einde van het vel. */
          await page.click(KOP(2));await sleep(200);
          const o2=await page.evaluate(meet);
          assert(o2.paneel.bottom<=o2.sheet.bottom-15&&o2.paneel.top>=-1,`${label}: zijbalk na dichtklikken onderaan verkeerd geplaatst (${Math.round(o2.paneel.top)}–${Math.round(o2.paneel.bottom)})`);
          /* Wisselen van venstergrootte: zijbalk -> uitklapmenu (alles dicht, één groep tegelijk) -> zijbalk (alles open) */
          await page.setViewportSize({width:1366,height:768});await sleep(300);
          const k=await page.evaluate(meet);
          assert(!k.rail&&!k.open&&k.knop&&!k.paneelZicht&&k.groepen.every(g=>!g.open),`${label} → 1366: menu niet terug naar dichte knop met dichte groepen`);
          assert.equal(await page.evaluate(()=>[...document.querySelectorAll(".wiw-menu-groep")].filter(g=>g.getAttribute("name")==="wiw-menu-groep").length),4,`${label} → 1366: groepen niet terug als accordeon (één tegelijk open)`);
          await page.setViewportSize({width:w,height:h});await sleep(300);
          const z=await page.evaluate(meet);
          assert(z.rail&&z.open&&z.paneelZicht&&!z.knop&&z.groepen.every(g=>g.open),`${label} → ${w}: zijbalk niet terug met alle groepen open`);
          regels.push(`${label}: zijbalk "${m.railKop}" ${Math.round(m.paneel.left)}–${Math.round(m.paneel.right)}px naast vel vanaf ${Math.round(m.sheet.left)}px, alle groepen open, 15 leesbare links, weergave ${m.segs.map(Math.round).join("/")}px, Escape/Enter, vast bij scrollen, wisselt met 1366px`);
        }else{
          /* Dicht */
          assert(!m.open&&!m.rail&&m.knop&&!m.paneelZicht,`${label}: menu niet dicht bij laden`);
          assert(m.knop.width>=44&&m.knop.height>=minDoel,`${label}: menuknop ${Math.round(m.knop.width)}x${Math.round(m.knop.height)}`);
          assert(!m.thema,`${label}: Licht/Auto/Donker zichtbaar terwijl het menu dicht is`);
          if(w>=360&&w<=900)assert(m.hero.ptop<=380,`${label}: temperatuur pas op ${Math.round(m.hero.ptop)}px`);
          if(w<360)assert(m.hero.ptop<=560,`${label}: temperatuur pas op ${Math.round(m.hero.ptop)}px`);
          if(DESKTOP_HERO[w]&&!touch)assert(Math.abs(m.hero.ptop-DESKTOP_HERO[w])<=1,`${label}: temperatuur verschoven (${Math.round(m.hero.ptop)} tegen ${DESKTOP_HERO[w]}px)`);
          assert(/Menu/.test(m.knopTekst),`${label}: knop heet niet Menu`);
          /* Het icoon blijft staan, ook na de Engelse taallaag (die lege elementen in vertaalde blokken weglaat). */
          assert(m.icoon&&m.icoon.w>=14&&m.icoon.h>=10,`${label}: menu-icoon ontbreekt of is onzichtbaar (${JSON.stringify(m.icoon)})`);
          const ax0=await axMenu(page);
          assert(ax0.knopRol&&ax0.uitgeklapt===false&&ax0.links===0&&ax0.groepen.length===0,`${label}: dichte menuknop niet als ingeklapte knop "Menu" voor schermlezers, of inhoud toch voorleesbaar: ${JSON.stringify(ax0)}`);
          /* Openen met muis: vier titels, nog geen links */
          await page.click("#wiw-menu > summary");await sleep(150);
          let o=await page.evaluate(meet);
          assert(o.open&&o.paneelZicht,`${label}: menu opent niet met klik`);
          titels(o,label);
          assert(o.paneel.top>=o.knop.bottom-1&&o.paneel.left>=-1&&o.paneel.right<=w+1&&o.paneel.bottom<=h+1,`${label}: menupaneel valt buiten beeld of over de knop`);
          assert(Math.abs(o.hero.ptop-m.hero.ptop)<=1,`${label}: openen verschuift de temperatuur`);
          /* Weergavekeuze in het open menu onder de groepen, met dezelfde maten als voorheen in de bovenbalk. */
          assert(o.thema&&o.themaOnderGroepen&&o.thema.left>=o.paneel.left&&o.thema.right<=o.paneel.right+1,`${label}: Licht/Auto/Donker staat niet onder de groepen in het menupaneel`);
          assert(o.thema.width>=242,`${label}: Licht/Auto/Donker te smal (${Math.round(o.thema.width)}px)`);
          assert(!o.themaGeknipt,`${label}: woord in Licht/Auto/Donker afgeknipt`);
          /* Contract indeling-browser.test.js: boven 430px ieder vakje minstens 86px. */
          if(w>430)assert(o.segs.every(x=>x>=86),`${label}: vakjes Licht/Auto/Donker te smal: ${o.segs.map(Math.round).join("/")}`);
          const ax1=await axMenu(page);
          assert(ax1.uitgeklapt===true&&ax1.nav&&ax1.groepen.length===4&&ax1.groepen.every(g=>g.uitgeklapt===false)&&ax1.links===0,`${label}: schermlezerstructuur open menu klopt niet: ${JSON.stringify(ax1)}`);
          await loopGroepen(page,label,(l,x)=>{
            assert(!l.knip&&l.fs>=14&&l.h>=minDoel-0.5,`${label}: menulink '${l.t}' afgeknipt of kleiner dan het doel (${l.fs}px, ${Math.round(l.h)}px hoog)`);
            assert(l.l>=x.paneel.left&&l.r<=x.paneel.right+1&&x.paneel.bottom<=h+1&&x.overflow<=1,`${label}: menulink '${l.t}' buiten het paneel of paneel buiten beeld (link ${Math.round(l.l)}–${Math.round(l.r)}, paneel ${Math.round(x.paneel.left)}–${Math.round(x.paneel.right)} tot ${Math.round(x.paneel.bottom)}, venster ${h}, overflow ${x.overflow})`);
          });
          await page.keyboard.press("Escape");await sleep(100);
          o=await page.evaluate(meet);
          assert(!o.open&&/SUMMARY/.test(o.focus),`${label}: Escape sluit niet of zet de focus niet terug (${o.open}, ${o.focus})`);
          /* Toetsenbord: Enter op de knop, Tab naar de eerste titel, Enter opent die groep, Spatie op de knop sluit */
          await page.focus("#wiw-menu > summary");await page.keyboard.press("Enter");await sleep(100);
          assert((await page.evaluate(meet)).open,`${label}: Enter opent het menu niet`);
          await page.keyboard.press("Tab");
          assert(await page.evaluate(s=>document.activeElement===document.querySelector(s),KOP(0)),`${label}: Tab gaat niet naar de eerste groepstitel`);
          await page.keyboard.press("Enter");await sleep(100);
          assert((await page.evaluate(meet)).groepen[0].open,`${label}: Enter opent de groep niet`);
          await page.keyboard.press("Tab");
          assert(await page.evaluate(()=>document.activeElement===document.querySelector(".wiw-menu-groep[open] a")),`${label}: Tab gaat niet naar de eerste link van de open groep`);
          await page.focus("#wiw-menu > summary");await page.keyboard.press(" ");await sleep(100);
          assert(!(await page.evaluate(meet)).open,`${label}: Spatie sluit het menu niet`);
          /* Klik buiten het menu */
          await page.click("#wiw-menu > summary");await sleep(100);
          const buiten=await page.evaluate(()=>{const menu=document.getElementById("wiw-menu");
            for(let y=innerHeight-10;y>10;y-=15)for(let x=10;x<innerWidth-10;x+=15){const e=document.elementFromPoint(x,y);if(e&&!menu.contains(e)&&!e.closest("a,button,input,label,select,summary,textarea,[tabindex],[onclick]"))return {x,y};}return null;});
          assert(buiten,`${label}: geen neutraal punt buiten het open menu gevonden`);
          await page.mouse.click(buiten.x,buiten.y);await sleep(150);
          const naBuiten=page.url();
          assert(!(await page.evaluate(meet)).open&&/\/weer\/utrecht\//.test(naBuiten),`${label}: klik buiten het menu sluit het niet (of navigeerde naar ${naBuiten})`);
          /* Klik op Nachtzicht vanavond (groep Sterren en nacht): menu dicht, kop in beeld */
          await page.evaluate(()=>scrollTo(0,0));
          await page.click("#wiw-menu > summary");await sleep(100);
          if(!(await page.evaluate(meet)).groepen[1].open){await page.click(KOP(1));await sleep(100);}
          await page.click('.wiw-menu-paneel a[href="#nachtzicht"]');await sleep(500);
          const n=await page.evaluate(()=>{const e=document.getElementById("nachtzicht").getBoundingClientRect();return {zicht:e.top>=0&&e.bottom<=innerHeight,hash:location.hash,open:document.getElementById("wiw-menu").open};});
          assert(n.zicht&&n.hash==="#nachtzicht"&&!n.open,`${label}: Nachtzicht vanavond werkt niet (${JSON.stringify(n)})`);
          /* Weergavekeuze in het menu werkt; het menu blijft open tijdens het kiezen. */
          await page.evaluate(()=>scrollTo(0,0));
          const t=()=>page.evaluate(()=>document.documentElement.getAttribute("data-thema"));
          await page.click("#wiw-menu > summary");await sleep(100);
          const begin=await t();await page.click("#thema .wiw-theme-moon");const d=await t();
          assert((await page.evaluate(meet)).open,`${label}: kiezen van Donker sluit het menu`);
          await page.click("#thema-auto");const a=await t();
          assert(d==="donker"&&a===begin,`${label}: weergavekeuze werkt niet meer (${begin}→${d}→${a})`);
          /* Voorkeur blijft na herladen */
          await page.click("#thema .wiw-theme-moon");await page.reload({waitUntil:"domcontentloaded"});await page.waitForSelector("#wiw-menu");await sleep(400);
          assert.equal(await t(),"donker",`${label}: gekozen Donker blijft niet na herladen`);
          await page.click("#wiw-menu > summary");await sleep(100);await page.click("#thema-auto");
          regels.push(`${label}: knop ${Math.round(m.knop.width)}×${Math.round(m.knop.height)}, logo ernaast, keuze in het menu ${Math.round(o.thema.width)}px, temperatuur op ${Math.round(m.hero.ptop)}px, 4 titels (≥${minDoel}px), iedere groep apart open, Escape/Enter/Tab/Spatie/buiten/link OK`);
        }
        assert.deepEqual(fouten,[],`${label}: runtimefouten ${fouten.join(" | ")}`);
      }finally{await context.close();}
    }
    /* Toetsenbordvolgorde: na de skiplink komt eerst de menuknop. */
    {
      const {context,page}=await pagina(browser,root,390,844,"light","nl");
      const v=[];for(let i=0;i<3;i++){await page.keyboard.press("Tab");v.push(await page.evaluate(()=>document.activeElement.tagName+"."+(document.activeElement.className||document.activeElement.id||"")));}
      assert(v.some(x=>/^SUMMARY\.wiw-menu-knop/.test(x)),`toetsenbord: menuknop niet bij de eerste tabstops: ${v.join(" → ")}`);
      await context.close();
    }
  }finally{await browser.close();server.close();}
  regels.forEach(r=>console.log("MENU "+r));
  console.log("Menu OK: één menu met logo in de bovenbalk op 320–1440px (open/dicht met muis, toetsenbord, Escape, buiten klikken en links; Licht/Auto/Donker onder de groepen), vier uitklapbare titels met één groep tegelijk open, zijbalk \"Snel naar\" vanaf 1904px (alles open, weergavekeuze eronder, vast, leesbaar, binnen het venster, geen overlap, wisselt met de venstergrootte), NL/EN, licht/donker, aanraakscherm, footer en eerste scherm.");
})().catch(e=>{console.error(e);process.exit(1);});

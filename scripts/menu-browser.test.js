"use strict";

/* Menu en zijbalk (UI PR #2, eigenaar 19 november) op het finale artifact, met
   de echte runtime. Gecontroleerd op 320, 360, 390, 430, 481, 768, 1024, 1366,
   1440 en 1920px (licht en donker, NL en EN):
   - één menu als <details> vooraan in de bovenbalk; Licht/Auto/Donker staat
     ernaast op dezelfde plek als zonder menu, nooit in het menu;
   - dicht: alleen de knop, geen overflow; de eerste-schermgrenzen blijven
     (temperatuur ≤380px vanaf 360px, ≤560px op 320px; desktop ongewijzigd);
   - open/dicht met muis, Enter, Spatie, Escape (focus terug op de knop), klik
     buiten het menu en klik op een link; schermlezer: knop "Menu" met
     uitgeklapt/ingeklapt, navigatie "Menu" met vier gelabelde lijsten;
   - alle bestemmingen bestaan als route of anker; Nachtzicht vanavond brengt de
     kop in beeld;
   - vanaf 1904px: hetzelfde menu als zijbalk in de linkermarge, leesbaar
     (≥14px, niets afgeknipt), zonder overlap met het vel, vast bij scrollen en
     boven het einde van het vel; wisselen van venstergrootte schakelt tussen
     zijbalk en uitklapmenu;
   - footer: bronnen, disclaimer, Over, Privacy, technische gegevens en contact
     blijven; seizoens- en nachtlinks staan er niet meer in.

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


function lum(rgb){const c=rgb.match(/\d+(\.\d+)?/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*c[0]+.7152*c[1]+.0722*c[2];}
function contrast(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}


const BESTEMMINGEN_GROEPEN=4;
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
    const knop=nodes.find(n=>!n.ignored&&/^(DisclosureTriangle|button)$/.test(waarde(n.role))&&/^Menu$/.test(String(waarde(n.name)||"").trim()));
    const nav=nodes.find(n=>!n.ignored&&waarde(n.role)==="navigation"&&waarde(n.name)==="Menu");
    const byId=new Map(nodes.map(n=>[n.nodeId,n]));
    const onder=(n,f,uit=[])=>{for(const c of (n&&n.childIds)||[]){const k=byId.get(c);if(!k)continue;if(f(k))uit.push(k);onder(k,f,uit);}return uit;};
    const lijsten=nav?onder(nav,n=>!n.ignored&&waarde(n.role)==="list"):[];
    const links=nav?onder(nav,n=>!n.ignored&&waarde(n.role)==="link"):[];
    return {knopRol:knop&&waarde(knop.role),uitgeklapt:knop?prop(knop,"expanded"):undefined,nav:!!nav,lijsten:lijsten.map(l=>String(waarde(l.name)||"")),links:links.length};
  }finally{await cdp.detach();}
}

const meet=()=>{
  const zie=e=>!!(e&&e.checkVisibility&&e.checkVisibility({visibilityProperty:true,opacityProperty:true}));
  const r=e=>{if(typeof e==="string")e=document.querySelector(e);if(!e||!e.getClientRects().length)return null;const b=e.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height,ptop:b.top+scrollY};};
  const menu=document.getElementById("wiw-menu"),knop=menu&&menu.querySelector("summary"),paneel=menu&&menu.querySelector(".wiw-menu-paneel"),balk=document.querySelector(".wiw-bovenbalk"),thema=document.getElementById("thema");
  const links=paneel?[...paneel.querySelectorAll("a")].map(a=>({href:a.getAttribute("href"),t:a.textContent.trim(),zicht:zie(a),fs:parseFloat(getComputedStyle(a).fontSize),knip:a.scrollWidth>a.clientWidth+1,...(a.getClientRects().length?(()=>{const b=a.getBoundingClientRect();return {l:b.left,r:b.right,t:b.top,b:b.bottom};})():{})})):[];
  const groepen=paneel?[...paneel.querySelectorAll("ul")].map(u=>{const id=u.getAttribute("aria-labelledby");const k=id&&document.getElementById(id);return {kop:k?k.textContent.trim():"",n:u.querySelectorAll("a").length};}):[];
  const voet=document.querySelector("footer"),sheet=document.querySelector(".sheet");
  return {aantalMenus:document.querySelectorAll("#wiw-menu,.wiw-menu").length,inBalk:!!(balk&&menu&&balk.firstElementChild===menu),themaInMenu:!!(menu&&thema&&menu.contains(thema)),themaInBalk:!!(balk&&thema&&balk.contains(thema)),
    open:!!(menu&&menu.open),rail:document.documentElement.classList.contains("wiw-menu-rail"),knop:zie(knop)?r(knop):null,paneel:r(paneel),paneelZicht:zie(paneel),
    thema:r(thema),balk:r(balk),hero:r(".hero"),chartkop:r(".dashrow-chart .chartkop")||r(".chartkop"),sheet:r(sheet),ctx:r(".seo-route-context"),plaatsnav:r(".seo-plaatsnav"),
    links,groepen,navLabel:paneel?paneel.getAttribute("aria-label"):"",knopTekst:knop?knop.textContent.replace(/\s+/g," ").trim():"",
    voetTekst:voet?voet.textContent.replace(/\s+/g," "):"",voetHrefs:voet?[...voet.querySelectorAll("a")].map(a=>a.getAttribute("href")):[],
    overflow:document.documentElement.scrollWidth-innerWidth,focus:document.activeElement?(document.activeElement.tagName+"."+(document.activeElement.className||"")):""};
};

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  const regels=[];
  /* Eerste-schermposities zonder menu (main 78e8d1fd): desktop moet exact gelijk blijven. */
  const DESKTOP_HERO={1024:221,1366:208,1440:211};
  try{
    const gevallen=[[320,640,"light","nl"],[360,740,"light","nl"],[390,844,"light","nl"],[390,844,"dark","nl"],[430,932,"light","en"],[481,900,"light","nl"],
      [768,1024,"light","nl"],[1024,768,"light","nl"],[1366,768,"dark","nl"],[1440,900,"light","nl"],[1920,1080,"light","nl"],[1920,1080,"dark","en"],
      /* aanraakscherm op desktopbreedte en een laag breed venster */
      [1024,768,"light","nl",true],[1920,1080,"light","nl",true],[1920,640,"light","nl"]];
    for(const [w,h,schema,taal,aanraak] of gevallen){
      const touch=aanraak===undefined?w<700:aanraak;
      const label=`${w}×${h} ${schema}${taal==="en"?" EN":""}${aanraak?" aanraak":""}`;
      const {context,page,fouten}=await pagina(browser,root,w,h,schema,taal,aanraak);
      try{
        const m=await page.evaluate(meet);
        assert.equal(m.aantalMenus,1,`${label}: niet precies één menu`);
        assert(m.inBalk&&m.themaInBalk&&!m.themaInMenu,`${label}: menu niet vooraan in de bovenbalk of weergavekeuze in het menu`);
        assert(m.overflow<=1,`${label}: horizontale overflow ${m.overflow}px`);
        assert.equal(m.groepen.length,BESTEMMINGEN_GROEPEN,`${label}: verwacht vier groepen`);
        assert(m.groepen.every(g=>g.kop&&g.n>=2),`${label}: groep zonder kop of met te weinig links: ${JSON.stringify(m.groepen)}`);
        for(const l of m.links)assert(bestaat(l.href),`${label}: bestemming bestaat niet: ${l.href}`);
        assert.deepEqual([...new Set(m.links.map(l=>l.href))].length,m.links.length,`${label}: dubbele bestemming in het menu`);
        if(taal==="en")assert.deepEqual(m.groepen.map(g=>g.kop),["Weather and places","Stars and night","Seasons and holidays","About and information"],`${label}: groepen niet vertaald`);
        else assert.deepEqual(m.groepen.map(g=>g.kop),["Weer en plaatsen","Sterren en nacht","Seizoenen en feestdagen","Over en informatie"],`${label}: groepskoppen gewijzigd`);
        /* Footer: verplichte onderdelen blijven, seizoens- en nachtlinks weg; plaatscontext en populaire plaatsen blijven. */
        for(const v of taal==="en"?["Open-Meteo","About this site","Privacy & data","support@watishetweer.nl"]:["Open-Meteo","Weersinformatie is algemeen","Over deze site","Privacy & gegevens","Technische locatiegegevens","support@watishetweer.nl"])
          assert(m.voetTekst.includes(v),`${label}: footer mist '${v}'`);
        assert(!m.voetHrefs.some(h=>/^\/(witte-kerst|oud-en-nieuw|kerstvakantie|voorjaarsvakantie|meivakantie|zomervakantie|herfstvakantie|nachtzicht|maan)\//.test(h)),`${label}: footer bevat nog seizoens- of nachtlinks: ${m.voetHrefs.join(", ")}`);
        assert(m.ctx&&m.plaatsnav,`${label}: plaatscontext of populaire plaatsen ontbreekt`);
        if(w>=1904){
          /* Zijbalk */
          assert(m.rail&&m.open&&m.paneelZicht&&!m.knop,`${label}: zijbalk niet zichtbaar of menuknop nog zichtbaar`);
          assert(m.paneel.left>=7.5&&m.paneel.right<=m.sheet.left-7.5,`${label}: zijbalk valt niet in de linkermarge (${Math.round(m.paneel.left)}–${Math.round(m.paneel.right)}, vel vanaf ${Math.round(m.sheet.left)})`);
          assert(m.links.every(l=>l.zicht&&l.fs>=14&&!l.knip&&l.r<=m.sheet.left-7.5),`${label}: zijbalklinks onleesbaar, afgeknipt of over het vel: ${JSON.stringify(m.links.filter(l=>!(l.zicht&&l.fs>=14&&!l.knip&&l.r<=m.sheet.left-7.5)).map(l=>l.t))}`);
          assert(m.paneel.bottom<=h+1,`${label}: zijbalk loopt onder het venster door (${Math.round(m.paneel.bottom)} > ${h})`);
          const laatste=await page.evaluate(()=>{const p=document.querySelector(".wiw-menu-paneel"),a=[...p.querySelectorAll("a")].pop();a.focus();const r=a.getBoundingClientRect(),q=p.getBoundingClientRect();return {zicht:r.top>=q.top-1&&r.bottom<=q.bottom+1,hoogte:r.height};});
          assert(laatste.zicht,`${label}: laatste zijbalklink niet bereikbaar met het toetsenbord`);
          if(touch)assert(m.links.every(l=>l.b-l.t>=43.5),`${label}: zijbalklinks kleiner dan 44px op een aanraakscherm`);
          await page.evaluate(()=>document.activeElement.blur());
          assert.equal(m.navLabel,"Menu",`${label}: navigatie heeft geen naam`);
          const ax=await axMenu(page);
          assert(ax.nav&&ax.lijsten.length===4&&ax.lijsten.every(Boolean)&&ax.links===m.links.length,`${label}: schermlezerstructuur zijbalk klopt niet: ${JSON.stringify(ax)}`);
          /* Vast bij scrollen en boven het einde van het vel */
          for(const y of [600,1400]){
            await page.evaluate(y=>scrollTo(0,y),y);await sleep(250);
            const s=await page.evaluate(meet);
            assert(Math.abs(s.paneel.top-m.paneel.top)<=1&&s.paneel.bottom<=s.sheet.bottom-15,`${label}: zijbalk niet vast bij scrollY ${y} (top ${Math.round(s.paneel.top)}, onder ${Math.round(s.paneel.bottom)}, vel tot ${Math.round(s.sheet.bottom)})`);
          }
          await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await sleep(300);
          const o=await page.evaluate(meet);
          assert(o.paneel.bottom<=o.sheet.bottom-15&&(!o.ctx||o.paneel.bottom<=o.ctx.top)&&o.paneel.bottom<=o.plaatsnav.top,`${label}: zijbalk overlapt onderaan (zijbalk tot ${Math.round(o.paneel.bottom)}, vel tot ${Math.round(o.sheet.bottom)}, plaatscontext ${Math.round(o.ctx&&o.ctx.top)})`);
          /* Wisselen van venstergrootte: zijbalk -> uitklapmenu -> zijbalk */
          await page.setViewportSize({width:1366,height:768});await sleep(300);
          const k=await page.evaluate(meet);
          assert(!k.rail&&!k.open&&k.knop&&!k.paneelZicht,`${label} → 1366: menu niet terug naar dichte knop`);
          await page.setViewportSize({width:1920,height:1080});await sleep(300);
          const z=await page.evaluate(meet);
          assert(z.rail&&z.open&&z.paneelZicht&&!z.knop,`${label} → 1920: zijbalk niet terug`);
          regels.push(`${label}: zijbalk ${Math.round(m.paneel.left)}–${Math.round(m.paneel.right)}px naast vel vanaf ${Math.round(m.sheet.left)}px, ${m.links.length} links ≥14px, vast bij scrollen, wisselt met 1366px`);
        }else{
          /* Dicht */
          assert(!m.open&&!m.rail&&m.knop&&!m.paneelZicht,`${label}: menu niet dicht bij laden`);
          const minDoel=w<=900||touch?44:36;
          assert(m.knop.width>=44&&m.knop.height>=minDoel,`${label}: menuknop ${Math.round(m.knop.width)}x${Math.round(m.knop.height)}`);
          if(w>=346)assert(Math.abs(m.knop.top-m.thema.top)<=2,`${label}: menuknop en Licht/Auto/Donker niet op één rij`);
          else assert(m.thema.top>=m.knop.bottom-1,`${label}: op ${w}px hoort de keuze onder de menuknop`);
          assert(m.thema.width>=242,`${label}: Licht/Auto/Donker te smal (${Math.round(m.thema.width)}px)`);
          if(w>=360&&w<=900)assert(m.hero.ptop<=380,`${label}: temperatuur pas op ${Math.round(m.hero.ptop)}px`);
          if(w<360)assert(m.hero.ptop<=560,`${label}: temperatuur pas op ${Math.round(m.hero.ptop)}px`);
          if(DESKTOP_HERO[w]&&!touch)assert(Math.abs(m.hero.ptop-DESKTOP_HERO[w])<=1,`${label}: temperatuur verschoven (${Math.round(m.hero.ptop)} tegen ${DESKTOP_HERO[w]}px)`);
          assert(/Menu/.test(m.knopTekst),`${label}: knop heet niet Menu`);
          const ax0=await axMenu(page);
          assert(ax0.knopRol&&ax0.uitgeklapt===false&&ax0.links===0,`${label}: dichte menuknop niet als ingeklapte knop "Menu" voor schermlezers, of links toch voorleesbaar: ${JSON.stringify(ax0)}`);
          /* Openen met muis, sluiten met Escape: focus terug op de knop */
          await page.click("#wiw-menu > summary");await sleep(150);
          let o=await page.evaluate(meet);
          assert(o.open&&o.paneelZicht,`${label}: menu opent niet met klik`);
          assert(o.paneel.top>=o.knop.bottom-1&&o.paneel.left>=-1&&o.paneel.right<=w+1,`${label}: menupaneel valt buiten beeld of over de knop`);
          assert(o.links.every(l=>l.zicht&&!l.knip&&(w>900&&!touch||l.b-l.t>=43.5)),`${label}: menulinks afgeknipt of kleiner dan het aanraakdoel`);
          assert(Math.abs(o.thema.top-m.thema.top)<=1&&Math.abs(o.hero.ptop-m.hero.ptop)<=1,`${label}: openen verschuift de keuze of de temperatuur`);
          assert(o.overflow<=1,`${label}: overflow met open menu ${o.overflow}px`);
          const ax1=await axMenu(page);
          assert(ax1.uitgeklapt===true&&ax1.nav&&ax1.lijsten.length===4&&ax1.lijsten.every(Boolean)&&ax1.links===m.links.length,`${label}: schermlezerstructuur open menu klopt niet: ${JSON.stringify(ax1)}`);
          await page.keyboard.press("Escape");await sleep(100);
          o=await page.evaluate(meet);
          assert(!o.open&&/SUMMARY/.test(o.focus),`${label}: Escape sluit niet of zet de focus niet terug (${o.open}, ${o.focus})`);
          /* Toetsenbord: Enter en Spatie */
          await page.focus("#wiw-menu > summary");await page.keyboard.press("Enter");await sleep(100);
          assert((await page.evaluate(meet)).open,`${label}: Enter opent het menu niet`);
          await page.keyboard.press("Tab");
          assert(await page.evaluate(()=>document.activeElement===document.querySelector(".wiw-menu-paneel a")),`${label}: Tab gaat niet naar de eerste menulink`);
          await page.focus("#wiw-menu > summary");await page.keyboard.press(" ");await sleep(100);
          assert(!(await page.evaluate(meet)).open,`${label}: Spatie sluit het menu niet`);
          /* Klik buiten het menu */
          await page.click("#wiw-menu > summary");await sleep(100);
          const buiten=await page.evaluate(()=>{const menu=document.getElementById("wiw-menu");
            for(let y=innerHeight-10;y>10;y-=15)for(let x=10;x<innerWidth-10;x+=15){const e=document.elementFromPoint(x,y);if(e&&!menu.contains(e)&&!e.closest("a,button,input,label,select,summary,textarea,[tabindex],[onclick]"))return {x,y};}return null;});
          assert(buiten,`${label}: geen neutraal punt buiten het open menu gevonden`);
          await page.mouse.click(buiten.x,buiten.y);await sleep(150);
          const naBuiten=page.url();
          assert(!(await page.evaluate(meet)).open&&naBuiten===page.url()&&/\/weer\/utrecht\//.test(naBuiten),`${label}: klik buiten het menu sluit het niet (of navigeerde naar ${naBuiten})`);
          /* Klik op Nachtzicht vanavond: menu dicht, kop in beeld */
          await page.evaluate(()=>scrollTo(0,0));
          await page.click("#wiw-menu > summary");await sleep(100);
          await page.click('.wiw-menu-paneel a[href="#nachtzicht"]');await sleep(500);
          const n=await page.evaluate(()=>{const e=document.getElementById("nachtzicht").getBoundingClientRect();return {zicht:e.top>=0&&e.bottom<=innerHeight,hash:location.hash,open:document.getElementById("wiw-menu").open};});
          assert(n.zicht&&n.hash==="#nachtzicht"&&!n.open,`${label}: Nachtzicht vanavond werkt niet (${JSON.stringify(n)})`);
          /* Thema werkt nog en zit niet in het menu */
          await page.evaluate(()=>scrollTo(0,0));
          const t=()=>page.evaluate(()=>document.documentElement.getAttribute("data-thema"));
          const begin=await t();await page.click("#thema .wiw-theme-moon");const d=await t();await page.click("#thema-auto");const a=await t();
          assert(d==="donker"&&a===begin,`${label}: weergavekeuze werkt niet meer (${begin}→${d}→${a})`);
          /* Voorkeur blijft na herladen */
          await page.click("#thema .wiw-theme-moon");await page.reload({waitUntil:"domcontentloaded"});await page.waitForSelector("#wiw-menu");await sleep(400);
          assert.equal(await t(),"donker",`${label}: gekozen Donker blijft niet na herladen`);
          await page.click("#thema-auto");
          regels.push(`${label}: knop ${Math.round(m.knop.width)}×${Math.round(m.knop.height)}, keuze ${Math.round(m.thema.width)}px, temperatuur op ${Math.round(m.hero.ptop)}px, open/Escape/Enter/Spatie/buiten/link OK`);
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
  console.log("Menu OK: één menu in de bovenbalk op 320–1440px (open/dicht met muis, toetsenbord, Escape, buiten klikken en links), zijbalk vanaf 1904px (vast, leesbaar, geen overlap, wisselt met de venstergrootte), NL/EN, licht/donker, footer en eerste scherm.");
})().catch(e=>{console.error(e);process.exit(1);});

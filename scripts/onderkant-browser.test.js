"use strict";

/* Onderkant van de pagina op het finale artifact, met de echte runtime.
   - Bronnen: één regel met alleen de gebruikte bronnen. Visual Crossing en
     WeatherAPI.com verschijnen alleen als de getoonde verwachting van die
     bron komt.
   - Voet: onderstreept direct onder de tekst; tapdoelen 44px op touch en
     24px met muis. Op touchbreedte links uitgelijnd op de lijn van de pagina;
     vanaf 1100px (verzoek van de eigenaar, 29 september: "de footer heeft te
     veel uitlijning naar links") staan bronnen, disclaimer (hooguit 900px
     breed), links en de weergaveknop gecentreerd onder de pagina.
   - Nachtzicht vanaf 1100px: de kolommen Beste zichtperiode en Maan staan
     gecentreerd, kop en tekst met hetzelfde midden, en Zichtscore staat midden
     boven score en balk (eigenaar, 29 september).
   - Zeven dagen en uurtabel vanaf 1100px: de koppen Wind max, Min, Max en
     Wind staan precies boven hun waarden; het woord Temp.bereik vervalt.
   - SEO-blok en populaire plaatsen beginnen op dezelfde lijn als de inhoud
     van het vel, op iedere breedte.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fixture(){
  const d=bouw({som:0});
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

/* bron "openmeteo": gewone load. bron "visualcrossing": Open-Meteo faalt, de
   same-origin providerroute levert de verwachting zoals de server dat doet. */
async function open(browser,root,w,h,bron,colorScheme){
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700,colorScheme:colorScheme||"light"});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T15:39:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com")return bron==="visualcrossing"?r.fulfill({status:503,json:{error:true}}):r.fulfill({json:fixture()});
    if(u.pathname==="/api/forecast")return r.fulfill({json:{...fixture(),provider:bron==="visualcrossing"?"visualcrossing":"weatherapi"},headers:{"X-WIW-Weather-Source":bron==="visualcrossing"?"visualcrossing":"weatherapi"}});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:["2026-07-22T17:00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:15000});
  await page.waitForFunction(()=>document.querySelectorAll("#days .row.day:not(.kop)").length===7,null,{timeout:15000});
  await sleep(1700);
  return {context,page,fouten};
}

function meet(){
  const zichtbaar=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=="hidden";
  const rect=e=>{const r=e.getBoundingClientRect();return {l:r.left,r:r.right,t:r.top+scrollY,b:r.bottom+scrollY,w:r.width,h:r.height};};
  const tekstLinks=e=>{if(!e)return null;const rg=document.createRange();rg.selectNodeContents(e);const r=[...rg.getClientRects()].filter(x=>x.width>0);return r.length?Math.min(...r.map(x=>x.left)):null;};
  const tekstRechts=e=>{if(!e)return null;const rg=document.createRange();rg.selectNodeContents(e);const r=[...rg.getClientRects()].filter(x=>x.width>0);return r.length?Math.max(...r.map(x=>x.right)):null;};
  /* Midden van een groep elementen: van de meest linkse tot de meest rechtse rand. */
  const midden=els=>{const r=els.filter(zichtbaar).map(e=>e.getBoundingClientRect());return r.length?(Math.min(...r.map(x=>x.left))+Math.max(...r.map(x=>x.right)))/2:null;};
  const app=document.getElementById("app"),footer=document.querySelector("footer"),bron=footer.querySelector(".bron-bronnen");
  const bronLinks=[...bron.querySelectorAll(".bronitem a")].filter(zichtbaar);
  const disclaimer=[...footer.querySelectorAll(":scope>span.bron")].find(e=>/Weersinformatie is algemeen/.test(e.textContent||""));
  const doelen=[footer.querySelector('a[href="/over/"]'),footer.querySelector('a[href="/privacy"]'),footer.querySelector("details.footer-details>summary"),footer.querySelector(".footer-contact a"),...bronLinks].filter(zichtbaar);
  const seo=document.querySelector(".seo-route-context"),nav=document.querySelector(".seo-plaatsnav");
  const navLinks=nav?[...nav.querySelectorAll(".seo-plaatsnav-links a")].filter(zichtbaar):[];
  return {
    appLinks:app.getBoundingClientRect().left,
    footer:rect(footer),
    bronnen:bronLinks.map(a=>({t:(a.textContent||"").trim(),l:a.getBoundingClientRect().left,top:Math.round(a.getBoundingClientRect().top),h:a.getBoundingClientRect().height})),
    bronDisplay:getComputedStyle(bron).display,
    labelLinks:tekstLinks(bron.querySelector(".bronlabel")),
    disclaimer:disclaimer?{l:tekstLinks(disclaimer),r:tekstRechts(disclaimer),align:getComputedStyle(disclaimer).textAlign}:null,
    voetMidden:(footer.getBoundingClientRect().left+footer.getBoundingClientRect().right)/2,
    bronMidden:midden([bron.querySelector(".bronlabel"),...bronLinks]),
    /* De linkrij: iedere interne footerlink (seizoenspagina's, Over, Privacy), technische details en contact. */
    linksMidden:midden([...footer.querySelectorAll('span.bron > a[href^="/"]'),footer.querySelector("details.footer-details>summary"),footer.querySelector(".footer-contact")]),
    weergaveMidden:midden([...document.querySelectorAll(".wiw-weergave-voet>*")]),
    kolommen:(()=>{
      const m=e=>{if(!e||!zichtbaar(e))return null;const r=e.getBoundingClientRect();return (r.left+r.right)/2;};
      /* Midden van de zichtbare tekst. Tekst in .sr-only (bijvoorbeeld het
         verborgen label "Maximale wind" voor schermlezers) is weggeknipt en
         telt niet mee. */
      const tm=e=>{if(!e||!zichtbaar(e))return null;const rs=[];for(const n of e.childNodes){if(n.nodeType===1&&n.matches(".sr-only"))continue;const rg=document.createRange();rg.selectNodeContents(n);rs.push(...[...rg.getClientRects()].filter(x=>x.width>0));if(n.nodeType===1&&n.namespaceURI==="http://www.w3.org/2000/svg")rs.push(n.getBoundingClientRect());}return rs.length?(Math.min(...rs.map(x=>x.left))+Math.max(...rs.map(x=>x.right)))/2:null;};
      const kop=document.querySelector("#days .row.day.kop"),rij=document.querySelector("#days .row.day:not(.kop)");
      const dagen={};for(const k of ["dwind","dmin","dmax"])dagen[k]=[tm(kop&&kop.querySelector("."+k)),tm(rij&&rij.querySelector("."+k))];
      const th=document.querySelector("#wiw-hour-table thead th:nth-child(5)"),td=document.querySelector("#wiw-hour-table tbody td.wiw-hour-wind");
      const nk=document.querySelector("#nights .row.night.kop>.score"),nr=[...document.querySelectorAll("#nights .row.night:not(.kop)")].find(zichtbaar);
      const wolk=[tm(document.querySelector("#nights .row.night.kop>.nmeta:not(.wide)")),tm(nr&&nr.querySelector(".nmeta:not(.wide)"))];
      return {dagen,bereikZichtbaar:kop&&kop.querySelector(".bar")?getComputedStyle(kop.querySelector(".bar")).visibility:"",wind:[tm(th),tm(td)],zichtscore:[tm(nk),tm(nr&&nr.querySelector(".score"))],bewolking:wolk};
    })(),
    nacht:(()=>{const kop=document.querySelector("#nights .row.night.kop"),rij=[...document.querySelectorAll("#nights .row.night:not(.kop)")].find(zichtbaar);if(!kop||!rij)return null;
      const m=e=>{if(!zichtbaar(e))return null;const r=e.getBoundingClientRect();return {m:(r.left+r.right)/2,a:getComputedStyle(e).textAlign};};
      return {oordeelKop:m(kop.querySelector(".sbar")),oordeel:m(rij.querySelector(".nachtadvies")),vensterKop:m(kop.querySelector(".nmeta.wide")),venster:m(rij.querySelector(".nachtvenster")),maanKop:m(kop.querySelector(".wiw-night-moon-head")),maan:m(rij.querySelector(".nachtmaan"))};})(),
    doelen:doelen.map(e=>{const s=getComputedStyle(e);return {t:(e.textContent||"").trim().slice(0,28),h:e.getBoundingClientRect().height,l:e.getBoundingClientRect().left,deco:s.textDecorationLine,rand:s.borderBottomWidth,schaduw:s.boxShadow};}),
    seo:seo?{kruimel:tekstLinks(seo.querySelector(".seo-breadcrumb")),kop:tekstLinks(seo.querySelector("h2")),kopGrootte:parseFloat(getComputedStyle(seo.querySelector("h2")).fontSize),tekst:tekstLinks(seo.querySelector("p")),buurt:tekstLinks(seo.querySelector(".seo-route-nearby-kop"))}:null,
    plaatsen:nav?{kop:tekstLinks(nav.querySelector(".seo-plaatsnav-kop")),eerste:navLinks[0]?tekstLinks(navLinks[0]):null,aantal:navLinks.length,hoogte:Math.min(...navLinks.map(a=>a.getBoundingClientRect().height)),hoogteBlok:nav.getBoundingClientRect().height}:null,
    namen:[...document.querySelectorAll("#days .row.day:not(.kop)>.dname,#nights .row.night:not(.kop)>.dname")].filter(zichtbaar).map(e=>({t:(e.textContent||"").trim().slice(0,20),tt:getComputedStyle(e,"::first-letter").textTransform})),
    overflow:document.documentElement.scrollWidth-innerWidth
  };
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h] of [[390,844],[768,1024],[1100,800],[1440,900],[1920,1080]]){
      const {context,page,fouten}=await open(browser,root,w,h,"openmeteo");
      const label=w+"px";
      try{
        const m=await page.evaluate(meet);
        const touch=w<=900,minDoel=touch?43.5:23.5;
        assert(m.overflow<=1,label+": horizontale overflow "+m.overflow+"px");
        /* Dag- en nachtnamen beginnen visueel met een hoofdletter ("Donderdag 1"
           naast "Vandaag 30"); de tekst zelf blijft ongewijzigd (eigenaar, 30 september). */
        assert(m.namen.length>=8,label+": te weinig dag- en nachtnamen gevonden: "+JSON.stringify(m.namen));
        assert(m.namen.every(n=>n.tt==="uppercase"),label+": niet iedere dag- of nachtnaam begint met een hoofdletter: "+JSON.stringify(m.namen));
        assert(m.namen.some(n=>/^(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|ma|di|wo|do|vr|za|zo) /.test(n.t)),label+": weekdagnamen horen in de tekst klein te blijven: "+JSON.stringify(m.namen));
        /* Bronnen: doorlopende regel, alleen wat gebruikt is. */
        assert.equal(m.bronDisplay,"flex",label+": bronnen staan niet als doorlopende regel");
        const namen=m.bronnen.map(b=>b.t);
        assert(namen.includes("Open-Meteo")&&namen.includes("CAMS"),label+": kernbronnen ontbreken: "+JSON.stringify(namen));
        assert(!namen.some(n=>/Visual Crossing|WeatherAPI/.test(n)),label+": Visual Crossing of WeatherAPI.com staat vermeld bij Open-Meteo-data: "+JSON.stringify(namen));
        if(touch)assert(Math.abs(m.labelLinks-m.appLinks)<=1.5,label+": bronlabel begint niet op de lijn van de pagina ("+m.labelLinks+" tegen "+m.appLinks+")");
        else for(const [n,x] of Object.entries({bronnen:m.bronMidden,links:m.linksMidden,weergave:m.weergaveMidden}))
          assert(x!==null&&Math.abs(x-m.voetMidden)<=3,label+": "+n+" staan niet gecentreerd onder de pagina (midden "+x+" tegen "+m.voetMidden+")");
        /* Touch: label op een eigen regel, bronnen eronder vanaf de paginalijn.
           Muis: bronnen direct achter het label op dezelfde regel. */
        if(touch)assert(Math.abs(Math.min(...m.bronnen.map(b=>b.l))-m.appLinks)<=1.5,label+": eerste bron begint niet op de lijn van de pagina: "+JSON.stringify(m.bronnen));
        else assert(m.bronnen[0].l>m.labelLinks&&m.bronnen[0].l-m.labelLinks<260,label+": bronnen staan niet direct achter het label: "+JSON.stringify(m.bronnen));
        assert(new Set(m.bronnen.map(b=>b.top)).size<=(touch?2:1),label+": bronnen beslaan te veel regels: "+JSON.stringify(m.bronnen));
        /* Voet: links uitgelijnd, onderstreept, tapdoelen. */
        if(touch)assert(m.disclaimer&&Math.abs(m.disclaimer.l-m.appLinks)<=1.5&&m.disclaimer.align!=="center",label+": disclaimer staat niet links in de kolom: "+JSON.stringify(m.disclaimer));
        else assert(m.disclaimer&&m.disclaimer.align==="center"&&m.disclaimer.r-m.disclaimer.l<=901&&Math.abs((m.disclaimer.l+m.disclaimer.r)/2-m.voetMidden)<=3,label+": disclaimer staat niet gecentreerd in hooguit 900px: "+JSON.stringify(m.disclaimer)+" midden voet "+m.voetMidden);
        if(!touch){
          /* Zeven dagen, uurtabel en Zichtscore: kop precies boven de inhoud (eigenaar, 29 september). */
          const k=m.kolommen;
          for(const [naam,[kop,waarde]] of Object.entries(k.dagen))assert(kop!==null&&waarde!==null&&Math.abs(kop-waarde)<=2,label+": Zeven dagen, kop "+naam+" staat niet boven de waarden ("+kop+" tegen "+waarde+")");
          assert.equal(k.bereikZichtbaar,"hidden",label+": het woord Temp.bereik staat nog in de kop van Zeven dagen");
          assert(k.wind[0]!==null&&k.wind[1]!==null&&Math.abs(k.wind[0]-k.wind[1])<=2,label+": uurtabel, kop Wind staat niet boven de windwaarden ("+k.wind.join(" tegen ")+")");
          /* Zichtscore: het cijfer staat onder het midden van de kop, het balkje
             ernaast; Bewolking: kop en percentage op hetzelfde midden (eigenaar, 5 oktober). */
          assert(k.zichtscore[0]!==null&&k.zichtscore[1]!==null&&Math.abs(k.zichtscore[0]-k.zichtscore[1])<=2,label+": Nachtzicht, scorecijfer staat niet onder het midden van de kop Zichtscore ("+k.zichtscore.join(" tegen ")+")");
          assert(k.bewolking[0]!==null&&k.bewolking[1]!==null&&Math.abs(k.bewolking[0]-k.bewolking[1])<=2,label+": Nachtzicht, kop Bewolking staat niet boven het percentage ("+k.bewolking.join(" tegen ")+")");
          const n=m.nacht;assert(n&&n.vensterKop&&n.venster,label+": Nachtzicht-kolommen niet gevonden: "+JSON.stringify(n));
          const paren=[["Beoordeling",n.oordeelKop,n.oordeel],["Beste zichtperiode",n.vensterKop,n.venster]];if(w>=1360)paren.push(["Maan",n.maanKop,n.maan]);
          for(const [naam,kop,tekst] of paren)
            assert(kop&&tekst&&kop.a==="center"&&tekst.a==="center"&&Math.abs(kop.m-tekst.m)<=2,label+": Nachtzicht-kolom "+naam+" staat niet gecentreerd onder zijn kop: "+JSON.stringify({kop,tekst}));
        }
        assert(m.doelen.length>=6,label+": te weinig voetlinks gevonden: "+JSON.stringify(m.doelen));
        for(const d of m.doelen){
          assert(d.h>=minDoel,label+": voetlink '"+d.t+"' is lager dan "+Math.ceil(minDoel)+"px ("+d.h+")");
          assert(/underline/.test(d.deco)&&d.rand==="0px"&&d.schaduw==="none",label+": voetlink '"+d.t+"' heeft geen onderstreping direct onder de tekst: "+JSON.stringify(d));
        }
        if(touch)assert(Math.abs(Math.min(...m.doelen.map(d=>d.l))-m.appLinks)<=1.5,label+": voetlinks beginnen niet op de lijn van de pagina");
        /* SEO-blok en plaatsen op de lijn van de pagina. */
        for(const [n,x] of Object.entries({kruimelpad:m.seo.kruimel,kop:m.seo.kop,tekst:m.seo.tekst,buurt:m.seo.buurt,plaatsenkop:m.plaatsen.kop}))
          assert(x!==null&&Math.abs(x-m.appLinks)<=1.5,label+": SEO-"+n+" begint op "+x+"px in plaats van op de lijn van de pagina ("+m.appLinks+"px)");
        assert(m.seo.kopGrootte<=12,label+": SEO-kop herhaalt de h1 als grote kop ("+m.seo.kopGrootte+"px)");
        assert(m.plaatsen.hoogte>=minDoel,label+": plaatslink lager dan "+Math.ceil(minDoel)+"px");
        if(touch){
          assert(Math.abs(m.plaatsen.eerste-m.appLinks)<=1.5,label+": eerste populaire plaats begint niet op de lijn van de pagina");
          assert.equal(m.plaatsen.aantal,7,label+": verwacht zes plaatsen plus Meer plaatsen op touchbreedte");
        }
        if(w===390){
          assert(m.footer.h<=330,label+": voet is "+Math.round(m.footer.h)+"px hoog, verwacht hooguit 330px");
          assert(m.plaatsen.hoogteBlok<=150,label+": populaire plaatsen beslaan "+Math.round(m.plaatsen.hoogteBlok)+"px");
        }
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("ONDERKANT "+label+": voet "+Math.round(m.footer.h)+"px, bronnen "+namen.join(", ")+"; "+(touch?"alles op x="+Math.round(m.appLinks):"voet gecentreerd rond x="+Math.round(m.voetMidden)+", SEO-blok op x="+Math.round(m.appLinks))+".");
      }finally{await context.close();}
    }
    /* Visual Crossing levert: dan hoort de verplichte vermelding zichtbaar te zijn, WeatherAPI.com niet. */
    for(const [w,h] of [[390,844],[1440,900]]){
      const {context,page,fouten}=await open(browser,root,w,h,"visualcrossing");
      try{
        await page.waitForFunction(()=>S&&S.d&&S.d.provider==="visualcrossing",null,{timeout:15000});
        await sleep(600);
        const namen=await page.evaluate(()=>[...document.querySelectorAll("footer .bron-bronnen .bronitem a")].filter(a=>a.getClientRects().length).map(a=>(a.textContent||"").trim()));
        assert(namen.includes("Weather Data Provided by Visual Crossing"),w+"px: Visual Crossing-vermelding ontbreekt terwijl Visual Crossing de data levert: "+JSON.stringify(namen));
        assert(!namen.includes("WeatherAPI.com"),w+"px: WeatherAPI.com staat vermeld terwijl Visual Crossing de data levert");
        assert.deepEqual(fouten,[],w+"px: runtimefouten "+fouten.join(" | "));
        console.log("ONDERKANT "+w+"px via Visual Crossing: "+namen.join(", ")+".");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Onderkant OK op 390, 768, 1100, 1440 en 1920px, en met Visual Crossing als bron.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

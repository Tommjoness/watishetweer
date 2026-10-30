"use strict";

/* Typografie-ronde 29 oktober 2026 (live-audit van productie 646673f): functionele tekst was op desktop te klein ten opzichte
   van de briefing (20px) en de grote temperatuur. Deze test legt de nieuwe rolmaten vast op het gebouwde artifact, gemeten als
   computed maat, en voor SVG-tekst als effectieve maat (computed maat x schaal van getScreenCTM: de grafiek schaalt, en de
   tooltip is als groep opgeschaald, dus alleen de computed waarde zegt niets over wat de bezoeker ziet).

   Desktop (vanaf 1100px): sectiekoppen 20px; tegellabels 14px; toelichting 15px; eenheden 14px; waarschuwing titel 18px en
   uitleg 16px (zowel de lokale waarschuwing .waarsch als de melding .msg); modelcontext 14px; uurtabel kop 14px, primaire waarde
   en tijd 16px, secundaire waarde en datum 14px; alternatieve tabel kop 14px en cellen 15px; terugknop 14px; grafiektekst
   effectief minimaal 14px; tooltip effectief minimaal 14px met de tijd op 16px.
   Tablet (760 tot 1099px): koppen 18px; labels 13px; toelichting 14px; waarschuwing 18/16px; tabelwaarden 15px; grafiek en
   tooltip effectief minimaal 13px (tooltiptijd 15px).
   Telefoon (tot 759px): koppen 18px; tegellabels 13px vanaf 380px (daaronder 12px); toelichting 14px; waarschuwing 17/16px;
   modelcontext 14px; terugknop 13px. Tabellen blijven daar op hun maat (12px en 14px): de kolombreedtes zijn op 320px afgestemd (zie leesbaarheid-fase2a-browser.test.js).
   Bewaakt wordt ook wat de grotere tekst niet mag veroorzaken: geen horizontale paginascroll, geen tegeltekst buiten zijn tegel,
   geen overlappende grafiek- of tooltiptekst, een tooltip die binnen de tekening blijft aan beide randen, en een uurtabel die
   alleen volledige rijen toont. Letterfamilies en kleuren worden niet getoetst: die zijn bewust ongewijzigd. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};
const NU=Date.UTC(2026,6,22,12,10,0);

const WAARSCHUWING=[{titel:"Code geel: mist",tekst:"Plaatselijk dichte mist (minder dan 200 m).",tot:"2026-07-23T07:00:00Z",niveau:"geel",gebied:"Flevoland"}];
const MEERDERE=[
  {titel:"Code rood: zeer zware storm met windstoten tot 140 km/u en mogelijk zeer hoge waterstanden langs de kust",tekst:"Zeer zware storm met windstoten tot 140 km/u; mogelijk gevaarlijke situaties door omvallende bomen en rondvliegend materiaal. Blijf zoveel mogelijk binnen en volg de aanwijzingen van de overheid.",tot:"2026-07-23T07:00:00Z",niveau:"rood",gebied:"Noord-Holland"},
  {titel:"Code oranje: onweer",tekst:"Zware onweersbuien met hagel en veel regen in korte tijd.",tot:"2026-07-23T04:00:00Z",niveau:"oranje",gebied:"Noord-Holland"},
  {titel:"Code geel: mist",tekst:"Plaatselijk dichte mist.",tot:"2026-07-23T07:00:00Z",niveau:"geel",gebied:"Noord-Holland"}];

function bouwServer(opties){
  const d=bouw({tempNu:11,wcNu:3,ccNu:60,rh:85,pp:u=>u>=16&&u<=19?60:10,pr:u=>u>=16&&u<=19?0.6:0,wc:u=>u>=16&&u<=19?61:3,cc:()=>60,som:2,...(opties.bouw||{})});
  d.latitude=52.3676;d.longitude=4.9041;d.elevation=3;d.minutely_15=null;
  Object.assign(d.current,{time:"2026-07-22T14:10",interval:900,visibility:(opties.bouw&&opties.bouw.zicht)||16000});
  d.daily.sunshine_duration=d.daily.time.map(()=>3*3600);
  const air={current:{european_aqi:30,us_aqi:40},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const stub=`<script>Date.now=()=>${NU};window.fetch=async function(url){const u=String(url);
    const payload=u.includes('/api/neerslag')?${JSON.stringify({beschikbaar:false,reden:"test"})}:u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:opties.waarschuwing||WAARSCHUWING,land:"NL"})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:${JSON.stringify(d)};
    return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};};
    try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
  html=html.replace("</head>",stub+"</head>");
  return http.createServer((req,res)=>{
    const p=(req.url||"").split("?")[0];
    if(p==="/"||p==="/index.html"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}
    const f=path.join(PUBLIC,p.replace(/^\//,""));
    if(f.startsWith(PUBLIC+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()){res.writeHead(200,{"content-type":mime[path.extname(f).toLowerCase()]||"application/octet-stream"});fs.createReadStream(f).pipe(res);}
    else{res.writeHead(404);res.end("not found");}
  });
}

/* In de browser: effectieve maten per rol (kleinste en grootste), plus de controles die grotere tekst niet mag breken. */
const ROLLEN={
  kop:"#chartlab,#app > h2 > span,.dashcol h2 > span",label:".stat .eyebrow",uitleg:".stat .ssub",eenheid:".sval > s",
  wtitel:"#waarschuwingen .waarsch h3",wtekst:"#waarschuwingen .waarsch p",mlabel:"#modelrisico .modelrisico-label",mnote:"#modelrisico .modelrisico-note",
  uurkop:"#wiw-hour-table thead th",uurtijd:"#wiw-hour-table tbody time",uurprim:"#wiw-hour-table .wiw-hour-primary",uursec:"#wiw-hour-table .wiw-hour-secondary",
  uurdatum:"#wiw-hour-table .wiw-hour-date",dagkop:"#days .row.kop > div",altth:"#chartdata th",alttd:"#chartdata td",terug:"#back",
  grafiek:"#chart > text",tooltip:"#chart #scrub text"
};
function meet(page){
  return page.evaluate(rollen=>{
    const zichtbaar=el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);return r.width>0&&r.height>0&&c.visibility!=="hidden"&&c.display!=="none"&&c.opacity!=="0";};
    const verborgen=el=>!!el.closest('details:not([open]) > :not(summary),#wiw-hour-title,.sr-only,.wiw-visually-hidden,caption,[class*="visually-hidden"]');
    const uit={maten:{}};
    for(const [naam,sel] of Object.entries(rollen)){
      const w=[];
      for(const el of document.querySelectorAll(sel)){
        if(!zichtbaar(el)||verborgen(el))continue;
        let eff=parseFloat(getComputedStyle(el).fontSize);
        if(el instanceof SVGElement&&el.getScreenCTM){const m=el.getScreenCTM();if(m)eff=eff*Math.hypot(m.a,m.b);}
        w.push(eff);
      }
      if(w.length)uit.maten[naam]={min:Math.round(Math.min(...w)*100)/100,max:Math.round(Math.max(...w)*100)/100,n:w.length};
    }
    uit.overloop=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth;
    const buiten=[];
    for(const st of document.querySelectorAll(".stat")){
      if(!zichtbaar(st)||st.hidden)continue;const br=st.getBoundingClientRect(),tw=document.createTreeWalker(st,NodeFilter.SHOW_TEXT);let n;
      while((n=tw.nextNode())){if(!n.textContent.trim()||!zichtbaar(n.parentElement)||verborgen(n.parentElement))continue;const r=document.createRange();r.selectNodeContents(n);const q=r.getBoundingClientRect();
        if(q.width>0&&(q.left<br.left-1||q.right>br.right+1))buiten.push(n.textContent.trim().slice(0,24));}
    }
    uit.tegelBuiten=buiten;
    const svg=document.getElementById("chart"),overlap=[];
    if(svg){
      const items=[...svg.querySelectorAll("text")].filter(t=>zichtbaar(t)&&t.textContent.trim()&&!(t.hasAttribute("data-tip-verberg")&&getComputedStyle(t).visibility==="hidden")).map(t=>({t:t.textContent.trim().slice(0,16),q:t.getBoundingClientRect(),tip:!!t.closest("#scrub")}));
      for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
        const a=items[i],b=items[j];if(a.tip!==b.tip)continue;
        const w=Math.min(a.q.right,b.q.right)-Math.max(a.q.left,b.q.left),h=Math.min(a.q.bottom,b.q.bottom)-Math.max(a.q.top,b.q.top);
        if(w>1.5&&h>3)overlap.push(a.t+" / "+b.t);
      }
      const rect=svg.querySelector("#scrub rect"),sr=svg.getBoundingClientRect();
      /* Elke zichtbare grafiektekst (ook "nu 11°" / "now 11°", dat pas na de plaatsing wordt vertaald) valt binnen de tekening: de SVG knipt wat erbuiten valt. Marge 2px: het tekstvak bevat de lege ruimte boven en onder de letters (gecontroleerd: bij 1px geen geknipte pixels). */
      uit.tekstBuitenSvg=items.filter(i=>i.q.left<sr.left-2||i.q.right>sr.right+2||i.q.top<sr.top-2||i.q.bottom>sr.bottom+2).map(i=>i.t);
      if(rect&&zichtbaar(rect)){const rr=rect.getBoundingClientRect();uit.tipBinnen=rr.left>=sr.left-1&&rr.right<=sr.right+1&&rr.top>=sr.top-1&&rr.bottom<=sr.bottom+1;
        uit.tipTekstBuiten=items.filter(i=>i.tip&&(i.q.left<rr.left-1||i.q.right>rr.right+1||i.q.top<rr.top-1||i.q.bottom>rr.bottom+1)).map(i=>i.t);}
    }
    uit.grafiekOverlap=overlap;
    const panel=document.getElementById("wiw-hour-panel"),rijen=[...document.querySelectorAll("#wiw-hour-table tbody tr")].filter(zichtbaar);
    uit.uurRijen=rijen.length;
    uit.uurRijBinnen=!(panel&&rijen.length)||rijen[rijen.length-1].getBoundingClientRect().bottom<=panel.getBoundingClientRect().bottom+1;
    return uit;
  },ROLLEN);
}

/* Verwachte maten per schermklasse (computed voor HTML, effectief voor SVG). */
/* Werkelijk aantal volledige uurrijen per desktopviewport en taal (Amsterdam, start, 29 oktober 2026). Main stond op nl/en: 1100: 9/8,
   1280 tot 1366: 10/10, 1440: 12/12, 1920: 14/14. De tabel toont zoveel volledige uren als naast de grafiek passen; 1363x936 is de door de
   eigenaar goedgekeurde situatie (8 volledige rijen). Op 1920px staan de uren op één regel; in het Engels past "0.6 mm 60% chance"
   (55 + 90px) niet meer in zijn kolom van 145px (paneel 496px), zodat de regel afbreekt en er 9 rijen passen (bekende beperking).
   Een lager aantal dan hier is een regressie. Eén keer op ongeveer twaalf keer laden is het paneel 24px lager en staat er een rij minder
   (gemeten op 1440px: main 11 i.p.v. 12, nu 9 i.p.v. 10; bestaand en niet door de typografie veroorzaakt); daarom wordt een te laag aantal
   maximaal twee keer opnieuw geladen en faalt de test pas als ook die keren onder het minimum blijven. */
const MIN_UURRIJEN={1100:{nl:7,en:7},1280:{nl:8,en:8},1363:{nl:8,en:8},1366:{nl:8,en:8},1440:{nl:10,en:10},1920:{nl:14,en:9}};
const DESKTOP={kop:20,label:14,uitleg:15,eenheid:14,wtitel:18,wtekst:16,mlabel:14,mnote:14,uurkop:14,uurtijd:16,uurprim:16,uursec:14,uurdatum:14,dagkop:14,altth:14,alttd:15,terug:14};
const TABLET={kop:18,label:13,uitleg:14,eenheid:14,wtitel:18,wtekst:16,mlabel:14,mnote:14,uurkop:13,uurtijd:15,terug:14,altth:13,alttd:15};
const TELEFOON={kop:18,uitleg:14,eenheid:13,wtitel:17,wtekst:16,mlabel:14,mnote:14,terug:13};

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let n=0;
  const controleer=(L,klasse,m,verwacht)=>{
    for(const [rol,px] of Object.entries(verwacht)){
      if(!m.maten[rol])continue;
      assert.equal(m.maten[rol].min,px,`${L}: ${rol} is minimaal ${m.maten[rol].min}px (verwacht ${px}px, ${klasse})`);
      assert.ok(m.maten[rol].max<=px+(rol==="uursec"||rol==="alttd"?0:0),`${L}: ${rol} varieert (${m.maten[rol].min}-${m.maten[rol].max}px)`);
    }
    assert.ok(m.overloop<=0,`${L}: horizontale paginascroll ${m.overloop}px`);
    assert.deepEqual(m.tegelBuiten,[],`${L}: tegeltekst buiten de tegel`);
    assert.deepEqual(m.grafiekOverlap,[],`${L}: overlappende grafiek- of tooltiptekst`);
    /* 909px (tablet, 760–1099px) toont alle uren als lijst onder de grafiek; er is geen paneel dat rijen afkapt, dus daar bestaat de eis "alleen volledige rijen in het paneel" niet (productiebuild van main gedraagt zich gelijk). */
    assert.deepEqual(m.tekstBuitenSvg||[],[],`${L}: grafiektekst valt buiten de tekening en wordt afgeknipt`);
    if(m.tipBinnen!==undefined){assert.ok(m.tipBinnen,`${L}: tooltip valt buiten de tekening`);assert.deepEqual(m.tipTekstBuiten,[],`${L}: tooltiptekst valt buiten de tooltipdoos`);}
    if(!(klasse==="tablet"&&L.startsWith("909px")))assert.ok(m.uurRijBinnen,`${L}: laatste uurrij valt buiten het uurpaneel (alleen volledige rijen)`);
    n++;
  };
  try{
    const srv=bouwServer({});await new Promise(r=>srv.listen(0,"127.0.0.1",r));
    const srvMeerdere=bouwServer({waarschuwing:MEERDERE});await new Promise(r=>srvMeerdere.listen(0,"127.0.0.1",r));
    const srvZicht=bouwServer({bouw:{zicht:400,tempNu:-3,temp:()=>-3}});await new Promise(r=>srvZicht.listen(0,"127.0.0.1",r));
    const gevallen=[
      ...[[1100,800],[1280,800],[1363,936],[1366,768],[1440,900],[1920,1080]].flatMap(([w,h])=>["nl","en"].map(taal=>({w,h,taal,klasse:"desktop"}))),
      ...[[768,1024]].flatMap(([w,h])=>["nl","en"].map(taal=>({w,h,taal,klasse:"tablet"}))),
      /* 909x624 met schaal 1,5 is een venster van 1363px op 150% browserzoom; daar viel "now 11°" (pas na de plaatsing vertaald) links uit de tekening. */
      ...[[909,624]].flatMap(([w,h])=>["nl","en"].map(taal=>({w,h,taal,klasse:"tablet",dpr:1.5}))),
      ...[[390,844],[375,812],[320,640]].flatMap(([w,h])=>["nl","en"].map(taal=>({w,h,taal,klasse:"telefoon"})))
    ];
    for(const g of gevallen)for(const thema of (g.w===1440||g.w===375?["licht","donker"]:["licht"])){
      for(const [variant,server] of [["standaard",srv],["meerdere waarschuwingen",srvMeerdere],["modelcontext",srvZicht]]){
        if(variant!=="standaard"&&!(g.taal==="nl"&&thema==="licht"))continue;
        const ctx=await browser.newContext({viewport:{width:g.w,height:g.h},deviceScaleFactor:g.dpr||1,locale:g.taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",colorScheme:thema==="donker"?"dark":"light"});
        const page=await ctx.newPage(),fouten=[];page.on("pageerror",e=>fouten.push(String(e)));
        if(g.taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
        try{
          await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL`,{waitUntil:"networkidle"});
          await page.waitForSelector("#wiw-hour-table tbody tr",{timeout:20000});await page.waitForTimeout(1200);
          /* Telefoon: tegellabels 13px vanaf 380px, daaronder 12px ("LUCHTVOCHTIGHEID" valt anders niet in zijn tegel). */
          const verwacht=g.klasse==="desktop"?DESKTOP:g.klasse==="tablet"?TABLET:{...TELEFOON,label:g.w>=380?13:12};
          const L=`${g.w}px ${g.taal} ${thema} ${variant}`;
          /* uitgangssituatie, daarna tooltip in het midden en aan beide randen, geopende alternatieve tabel, gekozen dag */
          let m=await meet(page);
          controleer(L+" [start]",g.klasse,m,variant==="modelcontext"?{mlabel:14,mnote:14}:verwacht);
          if(variant==="standaard"){
            assert.ok(m.maten.wtitel&&m.maten.wtekst,`${L}: de lokale waarschuwing ontbreekt in de meting`);
            if(g.klasse!=="telefoon"){
              const minGrafiek=g.klasse==="desktop"?14:13;
              assert.ok(m.maten.grafiek&&m.maten.grafiek.min>=minGrafiek-0.05,`${L}: grafiektekst effectief ${m.maten.grafiek&&m.maten.grafiek.min}px (minimaal ${minGrafiek}px)`);
            }
            if(g.klasse==="desktop"){
              for(let poging=0;poging<2&&m.uurRijen<MIN_UURRIJEN[g.w][g.taal];poging++){
                await page.reload({waitUntil:"networkidle"});await page.waitForSelector("#wiw-hour-table tbody tr",{timeout:20000});await page.waitForTimeout(1200);
                m=await meet(page);
              }
            }
            if(g.klasse==="desktop")assert.ok(m.uurRijen>=MIN_UURRIJEN[g.w][g.taal],`${L}: de uurtabel toont ${m.uurRijen} volledige rijen (minimaal ${MIN_UURRIJEN[g.w][g.taal]} op deze viewport)`);
            for(const [naam,toets] of [["tooltip","ArrowRight"],["tooltip links","Home"],["tooltip rechts","End"]]){
              if(g.klasse==="telefoon")break; /* tot en met 429px is er de informatiestrook; de SVG-tooltip is daar verborgen */
              await page.evaluate(()=>{const h=document.getElementById("hit");if(h){h.scrollIntoView({block:"center"});h.focus();}});
              await page.keyboard.press(toets);if(naam==="tooltip")await page.keyboard.press("ArrowRight");await page.waitForTimeout(500);
              m=await meet(page);
              assert.ok(m.maten.tooltip,`${L}: ${naam} niet zichtbaar`);
              const minTip=g.klasse==="desktop"?14:13,tijd=g.klasse==="desktop"?16:15;
              assert.ok(m.maten.tooltip.min>=minTip-0.05,`${L}: ${naam} effectief ${m.maten.tooltip.min}px (minimaal ${minTip}px)`);
              assert.ok(m.maten.tooltip.max>=tijd-0.05&&m.maten.tooltip.max<=tijd+0.5,`${L}: ${naam}: de tijd staat effectief op ${m.maten.tooltip.max}px (verwacht ${tijd}px)`);
              controleer(`${L} [${naam}]`,g.klasse,m,{});
            }
            if(g.klasse==="desktop"){
              await page.evaluate(()=>{const s=document.querySelector("#chartdata summary");if(s&&!s.parentElement.open)s.click();});await page.waitForTimeout(400);
              m=await meet(page);controleer(`${L} [tabel]`,g.klasse,m,{altth:14,alttd:15});
              await page.evaluate(()=>{const r=document.querySelector("#days .row.day:not(.kop)");if(r)(r.querySelector("button,[role=button]")||r).click();});await page.waitForTimeout(800);
              m=await meet(page);assert.ok(m.maten.terug,`${L}: terugknop ontbreekt na dagselectie`);controleer(`${L} [dag]`,g.klasse,m,{terug:14,kop:20});
            }
          }
          assert.deepEqual(fouten,[],`${L}: scriptfouten`);
        }finally{await ctx.close();}
      }
    }
    srv.close();srvMeerdere.close();srvZicht.close();
  }finally{await browser.close();}
  console.log(`Typografie 29 oktober 2026: ${n} situaties (desktop 1100 tot 1920px, tablet 768px, telefoon 375 en 320px; NL/EN; licht/donker; meerdere waarschuwingen en modelcontext): rolmaten (computed, voor SVG effectief), tooltip 14px en tijd 16px aan beide randen, geen paginascroll, per viewport en taal minstens het gemeten aantal volledige uurrijen, geen tegeltekst buiten de tegel, geen overlappende grafiektekst en alleen volledige uurrijen.`);
})().catch(e=>{console.error(e);process.exit(1);});

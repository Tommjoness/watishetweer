"use strict";

/* Samenhang na de kritische review van 25 september, op het finale artifact
   met de echte runtime.
   - Zes tegels: "Tijd tot zonsondergang" en (bij goed zicht) "Zicht" staan
     verborgen; vanaf 600px drie kolommen.
   - Na zonsondergang: "UV-piek morgen" en "Zonuren morgen" met de waarden
     voor morgen.
   - Pollen: niveau per soort volgens het National Allergy Bureau (160
     graspollen = veel), met bronvermelding.
   - Nachtzicht: telefoon toont alleen vannacht, desktop drie nachten.
   - Dagweergave: geen dubbele dagnaam voor zon op/onder.
   - Desktopgrafiek: 24 uur; de uurtabel is het begin daarvan.
   - Plaatsindex /weer/: Licht | Auto | Donker, terug-link bovenaan, zoekveld.
   - Over en Privacy: siteletters; Privacy begint met een korte samenvatting.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const SCENARIO={
  /* 17:39, natte avond, 160 graspollen. */
  middag:{klok:"2026-07-22T15:39:00Z",meting:"2026-07-22T17:30",gras:160,
    temp:(u,dag)=>+(15.5+4.5*Math.sin((u-9)/24*Math.PI*2)-dag*0.4).toFixed(1),
    pp:(u,dag)=>dag===0&&u>=19&&u<=23?[40,70,80,65,30][u-19]:8,
    pr:(u,dag)=>dag===0&&u>=19&&u<=23?[0.2,1.4,2.1,0.8,0.1][u-19]:0},
  /* 22:40, na zonsondergang. */
  avond:{klok:"2026-07-22T20:40:00Z",meting:"2026-07-22T22:30",gras:12,
    temp:(u,dag)=>+(14+3.8*Math.sin((u-9)/24*Math.PI*2)-dag*0.2).toFixed(1),pp:()=>8,pr:()=>0}
};
function fixture(sc){
  const d=bouw({temp:sc.temp,pp:sc.pp,pr:sc.pr,som:0});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map((_,i)=>[21600,12000,5000,30000,26000,18000,24000][i]);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  const nu=h.time.indexOf(sc.meting.slice(0,14)+"00");
  d.current.time=sc.meting;d.current.temperature_2m=h.temperature_2m[nu];d.current.apparent_temperature=h.temperature_2m[nu]-1;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  let f=path.join(OUT,p);if(!fs.existsSync(f)&&fs.existsSync(f+".html"))f+=".html";
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,sc,w,h,pad="/weer/utrecht/"){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  if(sc)await page.addInitScript(k=>{const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;},sc.klok);
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(sc&&(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast"))return r.fulfill({json:fixture(sc)});
    if(sc&&u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:30,uv_index:2},hourly:{time:[sc.meting.slice(0,14)+"00"],grass_pollen:[sc.gras],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[1],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+pad,{waitUntil:"domcontentloaded"});
  if(sc){
    await page.waitForSelector("#app",{state:"visible",timeout:15000});
    await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelectorAll("#chart circle").length>0&&document.querySelector("#aq .stat"),null,{timeout:15000});
    await sleep(1500);
  }else await sleep(600);
  return {context,page,fouten};
}

function meet(){
  const tekst=el=>el?String(el.textContent||"").replace(/\s+/g," ").trim():"";
  const stats=document.querySelector(".final-top-grid>.stats")||document.querySelector("#app .stats:not(#aq)");
  const zichtbaar=stats?[...stats.children].filter(t=>t.classList.contains("stat")&&t.getBoundingClientRect().height>0):[];
  const aq=[...document.querySelectorAll("#aq .stat")].map(t=>({kop:tekst(t.querySelector(".eyebrow")),sub:tekst(t.querySelector(".ssub")),niveau:(t.querySelector(".sval")||{getAttribute:()=>null}).getAttribute("data-pollen-niveau")}));
  const uv=document.getElementById("uv"),uvTegel=uv&&uv.closest(".stat");
  const nachten=[...document.querySelectorAll("#nights .row.night:not(.kop)")].filter(r=>!r.hidden&&r.getClientRects().length).length;
  const uitleg=[...document.querySelectorAll("#app p, #app .hint")].find(el=>/Pollenwaarden zijn een verwachting van CAMS/.test(el.textContent||""));
  return {tegels:zichtbaar.map(t=>tekst(t.querySelector(".eyebrow"))),kolommen:new Set(zichtbaar.map(t=>Math.round(t.getBoundingClientRect().left))).size,
    uvKop:tekst(uvTegel&&uvTegel.querySelector(".eyebrow")),uvSub:tekst(uvTegel&&uvTegel.querySelector(".ssub")),aq,nachten,
    pollenBron:!!uitleg&&/National Allergy Bureau/.test(uitleg.textContent),
    grafiekUren:S.geo&&Array.isArray(S.geo.TI)?S.geo.TI.length:0,
    tabel:[...document.querySelectorAll("#wiw-hour-table tbody tr")].map(r=>S.d.hourly.time[Number(r.dataset.sourceIndex)]).filter(Boolean),
    geoTI:S.geo&&S.geo.TI?S.geo.TI.slice():[],
    overflow:document.documentElement.scrollWidth-innerWidth};
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [naam,w,h] of [["middag",390,844],["middag",768,1024],["middag",1366,768],["avond",390,844],["avond",1440,900]]){
      const label=naam+" "+w+"px",sc=SCENARIO[naam];
      const {context,page,fouten}=await open(browser,root,sc,w,h);
      try{
        const m=await page.evaluate(meet);
        assert.equal(m.tegels.length,6,label+": verwacht zes tegels, kreeg "+JSON.stringify(m.tegels));
        assert(!m.tegels.some(k=>/^Tijd tot zon/.test(k)),label+": tegel met tijd tot zonsondergang/-opkomst is nog zichtbaar");
        assert(!m.tegels.includes("Zicht"),label+": zichttegel is zichtbaar bij goed zicht");
        if(w>=600)assert.equal(m.kolommen,3,label+": zes tegels staan niet in drie kolommen ("+m.kolommen+")");
        if(naam==="avond"){
          assert.equal(m.uvKop,"UV-piek morgen",label+": UV-tegel toont na zonsondergang niet morgen");
          assert(!/lag rond|vandaag/.test(m.uvSub),label+": UV-regel gaat na zonsondergang nog over vandaag: "+m.uvSub);
          const zon=m.aq.find(t=>/^Zonuren/.test(t.kop));
          assert(zon&&zon.kop==="Zonuren morgen"&&/morgen/.test(zon.sub)&&!/vandaag/.test(zon.sub),label+": zonurentegel toont na zonsondergang niet morgen: "+JSON.stringify(zon));
        }else{
          assert.equal(m.uvKop,"UV-piek vandaag",label+": UV-tegel toont overdag niet vandaag");
          const gras=m.aq.find(t=>t.kop==="Graspollen");
          assert(gras&&gras.sub==="Veel graspollen verwacht voor dit uur."&&gras.niveau==="hoog",label+": 160 graspollen heet niet 'veel' (NAB): "+JSON.stringify(gras));
          assert(m.pollenBron,label+": bronvermelding van de pollenschaal ontbreekt");
        }
        assert.equal(m.nachten,w<=900?1:3,label+": verwacht "+(w<=900?"alleen vannacht":"drie nachten")+", kreeg "+m.nachten);
        if(w>=1100){
          assert.equal(m.grafiekUren,25,label+": desktopgrafiek toont geen 24 uur ("+m.grafiekUren+" punten)");
          assert(m.tabel.length>0&&m.tabel.every((t,i)=>t===m.geoTI[i]),label+": de uurtabel is niet het begin van de grafiek: "+JSON.stringify({tabel:m.tabel.slice(0,3),grafiek:m.geoTI.slice(0,3)}));
        }
        /* Dagweergave: de dagnaam staat al in de kop. */
        const rij=await page.$$("#days .row.day");
        if(rij[3]){
          await rij[3].click();await sleep(1000);
          const dag=await page.evaluate(()=>({labels:document.querySelectorAll("#suntimes .zondag").length,zon:(document.getElementById("suntimes")||{}).textContent||""}));
          assert.equal(dag.labels,0,label+": dagweergave herhaalt de dagnaam bij zon op/onder");
          assert(/zon op/.test(dag.zon),label+": zon op ontbreekt in de dagweergave");
        }
        assert(m.overflow<=1,label+": horizontale overflow "+m.overflow+"px");
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("SAMENHANG "+label+": "+m.tegels.length+" tegels in "+m.kolommen+" kolom(men), "+m.uvKop+", "+m.nachten+" nacht(en) open"+(w>=1100?", grafiek "+(m.grafiekUren-1)+" uur":"")+".");
      }finally{await context.close();}
    }
    /* Plaatsindex. */
    for(const [w,h] of [[390,844],[1366,768]]){
      const {context,page,fouten}=await open(browser,root,null,w,h,"/weer/");
      try{
        const r=await page.evaluate(()=>{
          const knoppen=[...document.querySelectorAll("#thema [data-keuze]")].map(k=>({k:k.getAttribute("data-keuze"),p:k.getAttribute("aria-pressed"),h:k.getBoundingClientRect().height}));
          const terug=document.querySelector(".terug-boven a"),h1=document.querySelector("h1");
          return {knoppen,terugBoven:!!terug&&h1&&terug.getBoundingClientRect().top<h1.getBoundingClientRect().top,oudeSchakelaar:!!document.querySelector(".wiw-theme-switch")};
        });
        assert.deepEqual(r.knoppen.map(k=>k.k),["licht","auto","donker"],w+"px /weer/: weergavekeuze Licht | Auto | Donker ontbreekt");
        assert(r.knoppen.every(k=>k.h>=43.5),w+"px /weer/: weergaveknoppen zijn geen 44px-tikdoel");
        assert(r.terugBoven&&!r.oudeSchakelaar,w+"px /weer/: terug-link niet bovenaan of oude schakelaar nog aanwezig");
        await page.click('#thema [data-keuze="donker"]');await sleep(150);
        assert.equal(await page.evaluate(()=>document.documentElement.getAttribute("data-thema")),"donker",w+"px /weer/: Donker zet het donkere thema niet");
        await page.fill("#hub-zoek","utre");await sleep(150);
        const gefilterd=await page.evaluate(()=>[...document.querySelectorAll(".plaatsen li")].filter(li=>!li.hidden).map(li=>li.querySelector("a").textContent.trim()));
        assert.deepEqual(gefilterd,["Utrecht"],w+"px /weer/: zoeken op 'utre' filtert niet naar Utrecht: "+JSON.stringify(gefilterd));
        await page.fill("#hub-zoek","xyzq");await sleep(150);
        assert.equal(await page.evaluate(()=>document.getElementById("hub-leeg").hidden),false,w+"px /weer/: melding bij geen resultaat ontbreekt");
        assert.deepEqual(fouten,[],w+"px /weer/: runtimefouten "+fouten.join(" | "));
        console.log("SAMENHANG /weer/ "+w+"px: Licht | Auto | Donker, terug bovenaan, zoeken filtert.");
      }finally{await context.close();}
    }
    /* Over en Privacy. */
    for(const pad of ["/over/","/privacy.html"]){
      const {context,page}=await open(browser,root,null,390,844,pad);
      try{
        const r=await page.evaluate(()=>({body:getComputedStyle(document.body).fontFamily,h1:getComputedStyle(document.querySelector("h1")).fontFamily,kort:document.querySelectorAll("ul.kort li").length,merk:/Merk en sitenaam|vaste merk- en sitenaam/.test(document.body.textContent)}));
        assert(/Instrument Sans/.test(r.body)&&/Bodoni Moda/.test(r.h1),pad+": gebruikt de siteletters niet: "+JSON.stringify(r));
        assert(!r.merk,pad+": merk- en sitenaamregel staat er nog");
        if(pad==="/privacy.html")assert.equal(r.kort,4,pad+": samenvatting in het kort ontbreekt");
        console.log("SAMENHANG "+pad+": siteletters"+(pad==="/privacy.html"?", samenvatting in vier punten":"")+".");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Samenhang OK: zes tegels, avondtegels voor morgen, pollenschaal per soort, Nachtzicht compact, dagkop, desktopgrafiek 24 uur, plaatsindex en subpagina's.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

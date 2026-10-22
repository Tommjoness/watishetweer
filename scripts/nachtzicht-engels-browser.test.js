"use strict";

/* Engelse bezoekersroute door de verdiepingspagina's (audit 15 oktober):
   hoofdapp → /maan/ → /nachtzicht/ → parkpagina's, op het finale artifact met
   de echte runtime en de echte vertaallaag.
   - De vertaallaag meldt niets als onvertaald (window.__WIW_TAAL_ONTBREEKT__).
   - Titel, kop, maanfase, datums, parknamen, uitleg, bronregel, laadtekst,
     foutmelding en aria-labels zijn Engels.
   - Plaats- en parknamen blijven letterlijk staan en de spans van de
     maanpagina (plaats, tijdzone) blijven bestaan, zodat de runtime ze kan
     bijwerken.
   Mobiel en desktop.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
for(const r of ["maan","nachtzicht","nachtzicht/lauwersmeer"])if(!fs.existsSync(path.join(OUT,r,"index.html")))throw new Error(`public/${r}/index.html ontbreekt; draai eerst de build.`);

/* Zelfde opbouw als nachtzicht-pariteit-browser.test.js: 22 juli 2026, 21:30 lokaal, heldere nacht. */
function fixture(lat,lon){
  const d=bouw({geenKwartier:true,cc:()=>8});
  const lok="2026-07-22T21:00",i=d.hourly.time.indexOf(lok),c=d.current,h=d.hourly;
  c.time="2026-07-22T21:30";
  for(const v of ["temperature_2m","relative_humidity_2m","precipitation","weather_code","cloud_cover","wind_gusts_10m","is_day"])c[v]=h[v][i];
  c.visibility=h.visibility?h.visibility[i]:null;
  d.latitude=Number.isFinite(lat)?lat:53.38;d.longitude=Number.isFinite(lon)?lon:6.22;d.elevation=2;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

/* Zichtbare tekst en labels die nog als Nederlands herkenbaar zijn (los van de taallaag). */
const NL=/\b(vannacht|verlicht|wassende|afnemende|sikkel|bewolking|lichtvervuiling|geschat|kijkvenster|komende|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|januari|februari|maart|juni|juli|augustus|oktober|opkomst|ondergang|plekken|sterren kijken|wordt geladen|kon niet|gemiddeld|Bronnen|Hoe de indicatie)\b/i;

async function controleer(browser,root,route,w){
  const context=await browser.newContext({viewport:{width:w,height:1000},locale:"en-GB",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T19:30:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
  await page.route("**/*",r=>{
    const u=new URL(r.request().url());
    if(u.hostname.endsWith("open-meteo.com")||u.pathname==="/api/forecast"){
      const la=String(u.searchParams.get("latitude")||""),lo=String(u.searchParams.get("longitude")||"");
      if(la.includes(",")){const A=la.split(",").map(Number),B=lo.split(",").map(Number);return r.fulfill({json:A.map((x,i)=>fixture(x,B[i]))});}
      return r.fulfill({json:fixture(Number(la),Number(lo))});
    }
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  try{
    await page.goto(root+route+"?taal=en",{waitUntil:"load"});
    await page.waitForFunction(()=>window.__WIW_TAAL_ONTBREEKT__ instanceof Set||Array.isArray(window.__WIW_TAAL_ONTBREEKT__),null,{timeout:15000});
    /* Wacht tot de runtime de verwachting en de maan heeft ingevuld en de vertaallaag klaar is. */
    await page.waitForTimeout(2500);
    return await page.evaluate(src=>{
      const NL=new RegExp(src,"i"),zichtbaar=[],labels=[];
      const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
      while((n=w.nextNode())){const t=n.textContent.replace(/\s+/g," ").trim();const el=n.parentElement;
        if(!t||!el||el.closest("script,style,noscript,[translate=no]")||!el.getClientRects().length)continue;
        if(NL.test(t))zichtbaar.push(t);}
      for(const e of document.querySelectorAll("[aria-label],[title],img[alt]"))for(const a of ["aria-label","title","alt"]){const t=e.getAttribute(a);if(t&&NL.test(t))labels.push(a+": "+t);}
      return {lang:document.documentElement.lang,title:document.title,h1:(document.querySelector("h1")||{}).textContent||"",
        tekst:document.body.innerText.replace(/\s+/g," "),ontbreekt:[...(window.__WIW_TAAL_ONTBREEKT__||[])],zichtbaar,labels,
        spans:["nz-maan-plaats","nz-maan-standplaats","nz-maan-tijdzone","nz-maan-elders"].filter(id=>document.getElementById(id)),
        parkLinks:[...document.querySelectorAll('tr[data-park] a[translate="no"]')].map(a=>a.textContent.trim())};
    },NL.source).then(r=>({...r,fouten}));
  }finally{await context.close();}
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const w of [390,1366]){
      const maan=await controleer(browser,root,"/maan/",w);
      const overzicht=await controleer(browser,root,"/nachtzicht/",w);
      const park=await controleer(browser,root,"/nachtzicht/lauwersmeer/",w);
      const vanGogh=await controleer(browser,root,"/nachtzicht/van-gogh/",w);
      for(const [naam,r] of [["/maan/",maan],["/nachtzicht/",overzicht],["/nachtzicht/lauwersmeer/",park],["/nachtzicht/van-gogh/",vanGogh]]){
        assert.deepEqual(r.fouten,[],`${naam} ${w}px: scriptfouten`);
        assert.equal(r.lang,"en-GB",`${naam} ${w}px: de pagina staat niet in het Engels`);
        assert.deepEqual(r.ontbreekt,[],`${naam} ${w}px: de vertaallaag meldt onvertaalde tekst`);
        assert.deepEqual(r.zichtbaar,[],`${naam} ${w}px: zichtbare tekst is nog Nederlands`);
        assert.deepEqual(r.labels,[],`${naam} ${w}px: aria-label/title is nog Nederlands`);
      }
      assert.equal(maan.title,"The moon today: phase, moonrise and moonset | watishetweer.nl",`/maan/ ${w}px: titel`);
      assert.equal(maan.h1,"The moon today",`/maan/ ${w}px: kop`);
      assert(/\b(Waxing|Waning|Full|New|First|Last) [a-z ]*, \d+% illuminated\b/i.test(maan.tekst),`/maan/ ${w}px: maanfase en verlichting niet in het Engels`);
      /* De tijden staan in volgorde van de dag ("moonset 06:12, moonrise 17:30"), elk met het Engelse woord. */
      const tijdenEn=/Today in De Bilt: (moonrise|moonset) (\d{2}:\d{2})(?:, (moonrise|moonset) (\d{2}:\d{2}))?\./.exec(maan.tekst);
      assert(tijdenEn,`/maan/ ${w}px: op- en ondergang niet in het Engels`);
      assert(!tijdenEn[4]||(tijdenEn[1]!==tijdenEn[3]&&tijdenEn[2]<=tijdenEn[4]),`/maan/ ${w}px: op- en ondergang niet in volgorde van de dag: ${tijdenEn[0]}`);
      assert(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \d{1,2} (July|August), \d{2}:\d{2}/.test(maan.tekst),`/maan/ ${w}px: datums van de fasen niet in het Engels`);
      assert.deepEqual(maan.spans,["nz-maan-plaats","nz-maan-standplaats","nz-maan-tijdzone","nz-maan-elders"],`/maan/ ${w}px: de vertaling heeft de spans van plaats en tijdzone weggehaald`);
      assert.equal(overzicht.title,"Stargazing in the Netherlands: the darkest places | watishetweer.nl",`/nachtzicht/ ${w}px: titel`);
      assert(overzicht.parkLinks.includes("De Hoge Veluwe")&&overzicht.parkLinks.includes("Lauwersmeer"),`/nachtzicht/ ${w}px: parknamen blijven niet letterlijk staan`);
      assert(/How dark is it\?/.test(overzicht.tekst)&&/How the indication works/.test(overzicht.tekst),`/nachtzicht/ ${w}px: uitleg niet in het Engels`);
      assert(/Sources: the forecast comes from the weather model via Open-Meteo/.test(overzicht.tekst),`/nachtzicht/ ${w}px: bronregel niet in het Engels`);
      assert.equal(park.title,"Stargazing in Lauwersmeer National Park | watishetweer.nl",`park ${w}px: titel`);
      assert.equal(park.h1,"Stargazing in Lauwersmeer National Park",`park ${w}px: kop`);
      assert(/Light pollution: low \(estimated\)/.test(park.tekst),`park ${w}px: lichtvervuiling niet in het Engels`);
      assert(/average \d+%/.test(park.tekst)&&/Cloud cover per hour/.test(park.tekst),`park ${w}px: feiten en grafiek niet in het Engels`);
      assert.equal(vanGogh.h1,"Stargazing in Van Gogh National Park",`Van Gogh ${w}px: parknaam met "Nationaal Park" achteraan`);
    }
    /* Laad- en foutteksten (de runtime schrijft ze alleen bij een trage of mislukte verwachting). */
    const kern=require("../taal/vertaalkern.js"),en=require("../taal/en.js"),v=kern.maakVertaler(en);
    for(const [nl,eng] of [
      ["De verwachting voor vannacht wordt geladen.","Loading tonight's forecast."],
      ["De verwachting voor vannacht kon niet worden geladen. Probeer het later opnieuw.","Tonight's forecast could not be loaded. Please try again later."],
      ["De verwachting kon niet worden geladen. Probeer het later opnieuw.","The forecast could not be loaded. Please try again later."],
      ["De op- en ondergangstijden worden geladen.","Loading moonrise and moonset times."],
      ["Vandaag komt de maan in Tokyo niet op of niet onder.","Today the moon does not rise or set in Tokyo."],
      ["Tijden in plaatselijke tijd van Tokyo.","Times are in local time in Tokyo."],
      ["Afnemende sikkel, 12% verlicht · de hele nacht onder de horizon","Waning crescent, 12% illuminated · below the horizon all night"],
      ["02:00: bewolking onbekend","02:00: cloud cover unknown"]
    ])assert.equal(v.vertaal(nl),eng,`vertaling van "${nl}"`);
    console.log("Nachtzicht Engels: /maan/, /nachtzicht/ en parkpagina's volledig Engels op 390 en 1366 px; niets onvertaald, plaats- en parknamen letterlijk, spans behouden, laad- en foutteksten vertaald.");
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

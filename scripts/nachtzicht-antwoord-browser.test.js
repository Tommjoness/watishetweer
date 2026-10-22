"use strict";

/* Het directe antwoord boven het Nachtzicht-overzicht (/nachtzicht/) en de kaartindeling
   van de parktabel op smalle schermen. Gecontroleerd op het finale artifact (public/) met de
   echte runtime:
   - goed weer: "gunstig" met het aantal parken en links naar de beste parken;
   - slecht weer: nooit "gunstig" of "het best" als alle parken slecht scoren, wel de hoogste
     indicatie en de beperkende factoren;
   - gemengd: aantal gunstige parken, links die naar dezelfde pagina's wijzen als de tabelrijen
     en de factoren van de rest;
   - ontbrekende gegevens van één park worden genoemd, niet verzwegen;
   - Engels: volledig vertaald, geen Nederlandse resten;
   - 320/390/768/1440/1920 px: geen horizontale overloop, geen rij die op tien regels uitloopt
     (kolom "Beste periode" op de telefoon) en een stabiele tabelpositie nadat het antwoord er is. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"nachtzicht","index.html")))throw new Error("public/nachtzicht/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".css":"text/css; charset=utf-8"};
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  const rel=(pathname.endsWith("/")?pathname+"index.html":pathname).replace(/^\//,"");
  const file=path.join(PUBLIC,rel);
  if(file.startsWith(PUBLIC+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.writeHead(200,{"content-type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","cache-control":"no-store"});
    fs.createReadStream(file).pipe(res);return;
  }
  res.writeHead(404);res.end("not found");
});

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const VARIANT={
  goed:{cc:()=>8},
  matig:{cc:()=>60},
  slecht:{cc:()=>95,pr:()=>0.6,zicht:1500,wc:()=>61}
};
function nacht(lat,lon,soort,verwijderNacht){
  const d=bouw({geenKwartier:true,...VARIANT[soort]});
  const i=d.hourly.time.indexOf("2026-07-22T21:00"),c=d.current,h=d.hourly;
  c.time="2026-07-22T21:30";
  for(const v of ["temperature_2m","relative_humidity_2m","precipitation","weather_code","cloud_cover","wind_gusts_10m","is_day"])c[v]=h[v][i];
  c.visibility=h.visibility?h.visibility[i]:null;
  d.latitude=lat;d.longitude=lon;d.elevation=2;
  /* Alleen uren in het verleden: er is dan geen nacht om te beoordelen. */
  if(verwijderNacht)for(const k of Object.keys(h))h[k]=h[k].slice(0,20);
  return d;
}
/* scenario: "goed" | "slecht" | "gemengd" | "ontbrekend" */
const soortVoor=(scenario,i)=>scenario==="gemengd"?["goed","matig","slecht"][i%3]:scenario==="ontbrekend"?"goed":scenario;

async function open(browser,scenario,{breedte,taal,vertraging}){
  const context=await browser.newContext({viewport:{width:breedte,height:900},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  if(taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
  await page.clock.setFixedTime(new Date("2026-07-22T19:30:00Z"));
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"){
      if(vertraging)await sleep(vertraging);
      const A=String(u.searchParams.get("latitude")).split(",").map(Number),B=String(u.searchParams.get("longitude")).split(",").map(Number);
      return r.fulfill({json:A.map((x,i)=>nacht(x,B[i],soortVoor(scenario,i),scenario==="ontbrekend"&&i===2))});
    }
    if(u.pathname.startsWith("/api/"))return r.fulfill({status:503,json:{beschikbaar:false}});
    if(u.hostname!=="127.0.0.1")return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto("http://127.0.0.1:"+server.address().port+"/nachtzicht/",{waitUntil:"load"});
  return {context,page,fouten};
}
const NL_RESTEN=/\b(Vannacht|parken|omstandigheden|gunstige?|Elders|beperkend|Het best|Hoogste indicatie|ontbreken|gegevens|neerslag|bewolking|maanlicht|zicht)\b/i;

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    /* ----- inhoud van het antwoord, Nederlands ----- */
    const tekst={};
    for(const scenario of ["goed","slecht","gemengd","ontbrekend"]){
      const {context,page,fouten}=await open(browser,scenario,{breedte:1440,taal:"nl"});
      try{
        await page.waitForFunction(()=>{const a=document.getElementById("nz-antwoord");return a&&!a.hidden&&a.textContent.trim();},null,{timeout:20000});
        const t=await page.evaluate(()=>{
          const a=document.getElementById("nz-antwoord");
          const rij=[...document.querySelectorAll("tr[data-park] th a")].map(x=>({naam:x.textContent,href:x.getAttribute("href")}));
          return {tekst:a.textContent.replace(/\s+/g," ").trim(),links:[...a.querySelectorAll("a")].map(x=>({naam:x.textContent,href:x.getAttribute("href"),vertaling:x.getAttribute("translate")})),rij,status:document.getElementById("nz-status").hidden,live:a.getAttribute("aria-live")};
        });
        tekst[scenario]=t.tekst;
        assert.equal(t.live,"polite",`${scenario}: antwoord is geen beleefde live-regio`);
        assert.equal(t.status,true,`${scenario}: laadmelding blijft staan`);
        for(const l of t.links){
          assert(t.rij.some(r=>r.href===l.href&&r.naam===l.naam),`${scenario}: link ${JSON.stringify(l)} staat niet in de tabel`);
          assert.equal(l.vertaling,"no",`${scenario}: parknaam in het antwoord is vertaalbaar`);
        }
        if(scenario==="goed"){
          assert(/Vannacht zijn de omstandigheden in 19 van de 19 parken gunstig \(7\/10 of hoger\)\./.test(t.tekst),`goed: ${t.tekst}`);
          assert(/Het best \(\d+\/10\): alle 19 parken\./.test(t.tekst),`goed: ${t.tekst}`);
          assert(!/Elders beperkend/.test(t.tekst),`goed: "elders beperkend" zonder overige parken: ${t.tekst}`);
        }
        if(scenario==="slecht"){
          assert(/^Vannacht is er geen park met gunstige omstandigheden\./.test(t.tekst),`slecht: ${t.tekst}`);
          assert(!/parken gunstig|Het best/.test(t.tekst),`slecht: een relatief beste park mag niet als gunstig gelden: ${t.tekst}`);
          assert(/Hoogste indicatie: \d\/10 \(Ongunstig\) in alle 19 parken\./.test(t.tekst),`slecht: ${t.tekst}`);
          assert(/Beperkend in de meeste parken: .*(neerslag|bewolking)/.test(t.tekst),`slecht: factoren ontbreken: ${t.tekst}`);
        }
        if(scenario==="gemengd"){
          assert(/in 7 van de 19 parken gunstig/.test(t.tekst),`gemengd: ${t.tekst}`);
          assert(t.links.length>=1&&/\+\d/.test(t.tekst)||t.links.length>=1,`gemengd: links naar de beste parken ontbreken: ${t.tekst}`);
          assert(/Elders beperkend: /.test(t.tekst),`gemengd: ${t.tekst}`);
        }
        if(scenario==="ontbrekend")assert(/Voor 1 park ontbreken gegevens\./.test(t.tekst),`ontbrekend: ${t.tekst}`);
        assert.deepEqual(fouten,[],`${scenario}: scriptfouten ${fouten}`);
      }finally{await context.close();}
    }
    console.log("Nachtzicht-antwoord NL: goed, slecht, gemengd en ontbrekend kloppen.");

    /* ----- Engels ----- */
    for(const scenario of ["goed","slecht","gemengd","ontbrekend"]){
      const {context,page,fouten}=await open(browser,scenario,{breedte:1440,taal:"en"});
      try{
        await page.waitForFunction(()=>{const a=document.getElementById("nz-antwoord");return a&&!a.hidden&&a.textContent.trim();},null,{timeout:20000});
        await sleep(400);
        const t=await page.evaluate(()=>document.getElementById("nz-antwoord").textContent.replace(/\s+/g," ").trim());
        assert(!NL_RESTEN.test(t),`en ${scenario}: Nederlandse resten in "${t}"`);
        assert(/^Tonight/.test(t),`en ${scenario}: ${t}`);
        if(scenario==="slecht")assert(/no park|none of the parks/i.test(t)&&!/Best \(/.test(t),`en slecht: ${t}`);
        assert.deepEqual(fouten,[],`en ${scenario}: scriptfouten ${fouten}`);
      }finally{await context.close();}
    }
    console.log("Nachtzicht-antwoord EN: vertaald zonder Nederlandse resten.");

    /* ----- indeling per breedte ----- */
    for(const breedte of [320,390,768,1440,1920])for(const scenario of ["slecht","gemengd"])for(const taal of breedte<=390?["nl","en"]:["nl"]){
      const {context,page,fouten}=await open(browser,scenario,{breedte,taal,vertraging:700});
      const L=`${breedte}px ${scenario} ${taal}`;
      try{
        await page.waitForSelector("tr[data-park]");
        const voor=await page.evaluate(()=>document.querySelector(".nz-tabel").getBoundingClientRect().top+scrollY);
        await page.waitForFunction(()=>{const a=document.getElementById("nz-antwoord");return a&&!a.hidden;},null,{timeout:20000});
        await sleep(300);
        const m=await page.evaluate(()=>{
          const rijen=[...document.querySelectorAll("tr[data-park]")];
          return {top:document.querySelector(".nz-tabel").getBoundingClientRect().top+scrollY,
            overloop:document.documentElement.scrollWidth-innerWidth,
            hoogte:rijen.map(r=>Math.round(r.getBoundingClientRect().height)),
            kop:getComputedStyle(document.querySelector(".nz-tabel thead")).display,
            vensterBreedte:rijen.map(r=>Math.round(r.querySelector(".nz-venster").getBoundingClientRect().width))};
        });
        assert(m.overloop<=0,`${L}: horizontale overloop ${m.overloop}`);
        /* Stabiele plek: het antwoord vult de gereserveerde ruimte (min-height per breedte), zodat de tabel niet verspringt. */
        assert(Math.abs(m.top-voor)<=2,`${L}: tabel verschuift ${Math.round(m.top-voor)}px nadat het antwoord er staat`);
        if(breedte<768){
          assert(m.kop==="none",`${L}: kolomkoppen horen op de telefoon te vervallen`);
          assert(Math.max(...m.hoogte)<=(breedte<=320?190:125),`${L}: rij te hoog (${Math.max(...m.hoogte)}px): de periodekolom is te smal`);
          assert(Math.min(...m.vensterBreedte)>=breedte*0.6,`${L}: periode heeft te weinig breedte (${Math.min(...m.vensterBreedte)}px)`);
        }else{
          assert(m.kop!=="none",`${L}: kolomkoppen ontbreken`);
          if(breedte>=1024)assert(Math.max(...m.hoogte)<=48,`${L}: rij op meer dan één regel (${Math.max(...m.hoogte)}px)`);
          else assert(Math.max(...m.hoogte)<=75,`${L}: rij te hoog (${Math.max(...m.hoogte)}px)`);
        }
        assert.deepEqual(fouten,[],`${L}: scriptfouten ${fouten}`);
        console.log(`  ${L}: tabel verschuift ${Math.round(m.top-voor)}px, hoogste rij ${Math.max(...m.hoogte)}px`);
      }finally{await context.close();}
    }
    console.log("Nachtzicht-tabel: geen overloop, compacte rijen en een stabiele tabelpositie op 320, 390, 768, 1440 en 1920 px.");
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

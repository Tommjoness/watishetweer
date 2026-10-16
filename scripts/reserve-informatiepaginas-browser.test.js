"use strict";

/* Verslag L1/B1: de losse parkpagina en de vakantiepagina vallen bij een fout van
   Open-Meteo terug op de eigen reserveroute (/api/forecast). Het overzicht van de
   parken heeft bewust GEEN reserve. Bij een eindfout staat er een nette status
   ("Niet beschikbaar" in de tabelcellen) met een knop "Opnieuw proberen" die
   werkt. Draait op het finale artifact (public/) met de echte runtimes. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");
const {SEIZOENSPAGINAS}=require("./seizoenspagina.config.js");

const PUBLIC=path.join(__dirname,"..","public");
for(const f of ["nachtzicht/index.html","nachtzicht/alde-feanen/index.html","herfstvakantie/index.html"])
  if(!fs.existsSync(path.join(PUBLIC,f)))throw new Error("public/"+f+" ontbreekt; draai eerst de build.");
const herfst=SEIZOENSPAGINAS.find(p=>p.slug==="herfstvakantie");
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

function nachtFixture(lat,lon){
  const d=bouw({geenKwartier:true,cc:()=>8});
  const lok="2026-07-22T21:00",i=d.hourly.time.indexOf(lok),c=d.current,h=d.hourly;
  c.time="2026-07-22T21:30";
  for(const v of ["temperature_2m","relative_humidity_2m","precipitation","weather_code","cloud_cover","wind_gusts_10m","is_day"])c[v]=h[v][i];
  c.visibility=h.visibility?h.visibility[i]:null;
  d.latitude=lat;d.longitude=lon;d.elevation=2;
  return d;
}
/* Eén plaats, zoals /api/forecast het geeft: zonuren onbekend (null). */
function vakantieEen(){
  const dagen=[];for(let i=0;i<7;i++)dagen.push(new Date(Date.parse("2026-10-12T00:00:00Z")+i*864e5).toISOString().slice(0,10));
  return {daily:{time:dagen,temperature_2m_min:dagen.map(()=>7.6),temperature_2m_max:dagen.map(()=>15.4),
    precipitation_sum:dagen.map(()=>0.4),snowfall_sum:dagen.map(()=>0),precipitation_probability_max:dagen.map(()=>20),sunshine_duration:dagen.map(()=>null)}};
}
function vakantieAlle(){return herfst.plaatsen.map(()=>vakantieEen());}

/* modus per bron: "ok" | "fout" */
async function nieuwePagina(browser,modus,pad,klok){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
  const page=await context.newPage(),fouten=[],tel={primair:0,reserve:0};
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.clock.setFixedTime(new Date(klok));
  await page.route("**/*",r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"){
      tel.primair++;
      if(modus.primair==="fout")return r.fulfill({status:503,body:"{}"});
      const la=String(u.searchParams.get("latitude")||""),lo=String(u.searchParams.get("longitude")||"");
      if(pad.startsWith("/herfstvakantie"))return r.fulfill({json:vakantieAlle()});
      if(la.includes(",")){const A=la.split(",").map(Number),B=lo.split(",").map(Number);return r.fulfill({json:A.map((x,i)=>nachtFixture(x,B[i]))});}
      return r.fulfill({json:nachtFixture(Number(la),Number(lo))});
    }
    if(u.pathname==="/api/forecast"){
      tel.reserve++;
      if(modus.reserve==="fout")return r.fulfill({status:503,json:{beschikbaar:false}});
      return r.fulfill({json:pad.startsWith("/herfstvakantie")?vakantieEen():nachtFixture(Number(u.searchParams.get("lat")),Number(u.searchParams.get("lon")))});
    }
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.hostname!=="127.0.0.1")return r.fulfill({status:204,body:""});
    return r.continue();
  });
  return {context,page,fouten,tel,modus};
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const base="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  const NU="2026-07-22T19:30:00Z";
  try {
    /* 1. Parkpagina: Open-Meteo faalt, de reserve levert. */
    {
      const {context,page,fouten,tel}=await nieuwePagina(browser,{primair:"fout",reserve:"ok"},"/nachtzicht/alde-feanen/",NU);
      await page.goto(base+"/nachtzicht/alde-feanen/",{waitUntil:"load"});
      await page.waitForSelector("#nz-vannacht:not([hidden])",{timeout:15000});
      assert.equal(await page.locator("#nz-status").isHidden(),true,"park+reserve: geen foutstatus");
      assert.equal(tel.reserve,1,"park+reserve: één reserveaanvraag voor het punt");
      assert.deepEqual(fouten,[],"park+reserve: scriptfouten");
      await context.close();
    }
    /* 2. Parkpagina: beide bronnen falen; de knop probeert het opnieuw en slaagt. */
    {
      const {context,page,fouten,modus}=await nieuwePagina(browser,{primair:"fout",reserve:"fout"},"/nachtzicht/alde-feanen/",NU);
      await page.goto(base+"/nachtzicht/alde-feanen/",{waitUntil:"load"});
      await page.waitForSelector("#nz-status .nz-opnieuw",{timeout:20000});
      assert.match(await page.locator("#nz-status").innerText(),/kon niet worden geladen/,"park-eindfout: tekst");
      assert.equal(await page.locator("#nz-vannacht").isHidden(),true,"park-eindfout: geen data");
      const b=await page.locator("#nz-status .nz-opnieuw").boundingBox();
      assert(b.height>=44,"park-eindfout: knop is minstens 44px hoog ("+b.height+")");
      modus.primair="ok";
      await page.locator("#nz-status .nz-opnieuw").click();
      await page.waitForSelector("#nz-vannacht:not([hidden])",{timeout:15000});
      assert.equal(await page.locator("#nz-status").isHidden(),true,"park-herstel: status weg");
      assert.deepEqual(fouten,[],"park-eindfout: scriptfouten");
      await context.close();
    }
    /* 3. Overzicht: geen reserve, "Niet beschikbaar" in de cellen, knop werkt. */
    {
      const {context,page,fouten,tel,modus}=await nieuwePagina(browser,{primair:"fout",reserve:"ok"},"/nachtzicht/",NU);
      await page.goto(base+"/nachtzicht/",{waitUntil:"load"});
      await page.waitForSelector("#nz-status .nz-opnieuw",{timeout:20000});
      assert.equal(tel.reserve,0,"overzicht: geen reserveaanvragen (19 parken kosten te veel)");
      const cellen=await page.$$eval("tr[data-park] td.nz-n, tr[data-park] td.nz-venster",tds=>tds.map(t=>t.textContent.trim()));
      assert(cellen.length>=2&&cellen.every(t=>t==="Niet beschikbaar"),"overzicht: alle cellen 'Niet beschikbaar' ("+[...new Set(cellen)].join("|")+")");
      modus.primair="ok";
      await page.locator("#nz-status .nz-opnieuw").click();
      await page.waitForFunction(()=>[...document.querySelectorAll("tr[data-park] td.nz-n")].every(t=>!/Niet beschikbaar|…/.test(t.textContent)),null,{timeout:15000});
      assert.equal(await page.locator("#nz-status").isHidden(),true,"overzicht-herstel: status weg");
      assert.deepEqual(fouten,[],"overzicht: scriptfouten");
      await context.close();
    }
    /* 4. Vakantiepagina: Open-Meteo faalt, de reserve levert per plaats; zonuren blijven onbekend. */
    {
      const {context,page,fouten,tel}=await nieuwePagina(browser,{primair:"fout",reserve:"ok"},"/herfstvakantie/","2026-10-12T10:00:00Z");
      await page.goto(base+"/herfstvakantie/",{waitUntil:"load"});
      await page.waitForFunction(()=>!document.querySelector("#seizoen-verwachting[aria-busy]"),null,{timeout:40000});
      assert.equal(tel.reserve,herfst.plaatsen.length,"vakantie+reserve: één reserveaanvraag per plaats");
      assert(await page.locator("#seizoen-verwachting .seizoen-dag").count()>0,"vakantie+reserve: dagtabellen");
      assert.equal(await page.locator(".seizoen-fout").count(),0,"vakantie+reserve: geen foutmelding");
      assert.match(await page.locator("#seizoen-verwachting").innerText(),/reservebron/,"vakantie+reserve: vermeldt de reservebron");
      assert.doesNotMatch(await page.locator("#seizoen-verwachting").innerText(),/\b0 uur zon|geen zon/,"vakantie+reserve: onbekende zonuren worden niet 0");
      assert.deepEqual(fouten,[],"vakantie+reserve: scriptfouten");
      await context.close();
    }
    /* 5. Vakantiepagina: beide falen; foutmelding met knop; herstel via de knop. */
    {
      const {context,page,fouten,modus}=await nieuwePagina(browser,{primair:"fout",reserve:"fout"},"/herfstvakantie/","2026-10-12T10:00:00Z");
      await page.goto(base+"/herfstvakantie/",{waitUntil:"load"});
      await page.waitForSelector("#seizoen-verwachting .seizoen-opnieuw",{timeout:40000});
      assert.equal(await page.locator(".seizoen-fout").count(),1,"vakantie-eindfout: melding");
      assert((await page.locator(".seizoen-opnieuw").boundingBox()).height>=44,"vakantie-eindfout: knop minstens 44px");
      modus.primair="ok";
      await page.locator(".seizoen-opnieuw").click();
      await page.waitForFunction(()=>document.querySelectorAll("#seizoen-verwachting .seizoen-dag").length>0,null,{timeout:15000});
      assert.equal(await page.locator(".seizoen-fout").count(),0,"vakantie-herstel: melding weg");
      assert.deepEqual(fouten,[],"vakantie-eindfout: scriptfouten");
      await context.close();
    }
    console.log("Reserve en foutstatus: parkpagina en vakantiepagina vallen terug op /api/forecast; het overzicht heeft geen reserve; 'Niet beschikbaar' en 'Opnieuw proberen' werken.");
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e=>{console.error(e);process.exit(1);});

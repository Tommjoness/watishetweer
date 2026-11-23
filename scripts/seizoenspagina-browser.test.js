"use strict";

/* Witte kerst in de echte, definitieve build: ver voor kerst (alleen de datum
   waarop de verwachting verschijnt), binnen het venster (echte tabel per dag),
   een gedeeltelijk venster, een mislukte verwachting en de jaarwissel. Mobiel
   en desktop, licht en donker. Met SEIZOEN_SCREENSHOTS=<map> worden ook
   screenshots bewaard. */

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {SEIZOENSPAGINAS}=require("./seizoenspagina.config.js");
const {meetUitlijning,controleerUitlijning}=require("./seizoen-uitlijning-meting.js");

const PUBLIC=path.join(__dirname,"..","public");
const PAD="/witte-kerst/";
const bestand=path.join(PUBLIC,"witte-kerst","index.html");
if(!fs.existsSync(bestand))throw new Error("public/witte-kerst/index.html ontbreekt; draai eerst de build.");
const kerst=SEIZOENSPAGINAS.find(p=>p.slug==="witte-kerst");
const SCHERMEN=process.env.SEIZOEN_SCREENSHOTS||"";

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

/* Open-Meteo-antwoord: 7 dagen vanaf `start`, per plaats eigen sneeuw. */
function antwoord(start,perPlaats){
  const dagen=[];const t0=Date.parse(start+"T00:00:00Z");
  for(let i=0;i<7;i++)dagen.push(new Date(t0+i*864e5).toISOString().slice(0,10));
  return kerst.plaatsen.map((p,i)=>{
    const sneeuw=perPlaats(p,i)||{};
    const uren=[],diepte=[];
    for(const d of dagen)for(let u=0;u<24;u++){uren.push(`${d}T${String(u).padStart(2,"0")}:00`);diepte.push(sneeuw[d]?sneeuw[d].diepte:0);}
    return {
      latitude:p.lat,longitude:p.lon,timezone:"Europe/Amsterdam",utc_offset_seconds:3600,
      daily:{time:dagen,
        temperature_2m_min:dagen.map(d=>sneeuw[d]?sneeuw[d].min:2.4),
        temperature_2m_max:dagen.map(d=>sneeuw[d]?sneeuw[d].max:6.8),
        snowfall_sum:dagen.map(d=>sneeuw[d]?sneeuw[d].val:0),
        precipitation_sum:dagen.map(d=>sneeuw[d]?sneeuw[d].nat:(i%2?1.6:0))},
      hourly:{time:uren,snow_depth:diepte}
    };
  });
}
const metSneeuw=start=>antwoord(start,(p,i)=>i===0||i===2?{
  "2026-12-25":{diepte:0.04,val:2.3,nat:1.9,min:-3.2,max:0.4},
  "2026-12-26":{diepte:0.05,val:0.6,nat:0.5,min:-5.1,max:-0.8}
}:null);

const metOntbrekendeDiepte=start=>antwoord(start,(p,i)=>i===0?{
  "2026-12-25":{diepte:null,val:0,nat:0,min:1,max:2},
  "2026-12-26":{diepte:0.03,val:1,nat:0,min:-2,max:0}
}:null);

const SCENARIOS=[
  {naam:"ver",nu:"2026-10-05T10:00:00Z",verwacht:{kop:"Witte kerst 2026",aftellen:"81 dagen tot eerste kerstdag",melding:/^Verwachting vanaf zaterdag 19 december\u00a0· tweede kerstdag volgt op zondag 20 december$/,tabellen:0,fetch:0}},
  {naam:"venster",nu:"2026-12-21T09:00:00Z",data:metSneeuw("2026-12-21"),verwacht:{kop:"Witte kerst 2026",aftellen:"4 dagen tot eerste kerstdag",samenvatting:"Volgens de huidige verwachting ligt er op beide kerstdagen sneeuw in De Bilt. Blijft dat zo, dan is het officieel een witte kerst.",tabellen:2,fetch:1,cel:"Sneeuwdek, 4 cm"}},
  {naam:"half",nu:"2026-12-19T09:00:00Z",data:metSneeuw("2026-12-19"),verwacht:{tabellen:1,fetch:1,later:"Tweede kerstdag: de verwachting verschijnt op zondag 20 december."}},
  {naam:"onbekend",nu:"2026-12-21T09:00:00Z",data:metOntbrekendeDiepte("2026-12-21"),verwacht:{samenvatting:"Of het een officiële witte kerst wordt, is nog niet te beoordelen: de sneeuwdekgegevens voor De Bilt zijn niet voor beide kerstdagen beschikbaar.",tabellen:2,fetch:1,cel:"Sneeuwdek onbekend"}},
  {naam:"fout",nu:"2026-12-21T09:00:00Z",status:503,verwacht:{tabellen:0,fetch:2,fout:true}},
  /* Eén nieuwe poging na een korte hapering van Open-Meteo (14 oktober). */
  {naam:"herstel",nu:"2026-12-21T09:00:00Z",eersteStatus:503,data:metSneeuw("2026-12-21"),verwacht:{tabellen:2,fetch:2,cel:"Sneeuwdek, 4 cm"}},
  {naam:"na-kerst",nu:"2026-12-27T09:00:00Z",verwacht:{kop:"Witte kerst 2027",aftellen:"363 dagen tot eerste kerstdag",tabellen:0,fetch:0}}
];

async function controleer(browserType,label,base){
  const browser=await browserType.launch({headless:true});
  try{
    for(const sc of SCENARIOS)for(const breedte of [390,1366])for(const schema of ["light","dark"]){
      if(schema==="dark"&&sc.naam!=="venster"&&sc.naam!=="ver")continue;
      const context=await browser.newContext({viewport:{width:breedte,height:breedte<700?844:900},colorScheme:schema});
      const page=await context.newPage();
      const fouten=[];let fetches=0;
      page.on("pageerror",e=>fouten.push(e.message));
      page.on("console",m=>{if(m.type()==="error"&&!/Failed to load resource/.test(m.text()))fouten.push(m.text());});
      await page.clock.setFixedTime(new Date(sc.nu));
      await page.route("https://api.open-meteo.com/**",route=>{
        fetches++;
        const url=new URL(route.request().url());
        assert.equal(url.searchParams.get("forecast_days"),"7");
        assert.equal(url.searchParams.get("latitude").split(",").length,kerst.plaatsen.length);
        if(sc.status)return route.fulfill({status:sc.status,body:"{}"});
        if(sc.eersteStatus&&fetches===1)return route.fulfill({status:sc.eersteStatus,body:"{}"});
        return route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(sc.data)});
      });
      await page.route(/posthog|googletagmanager|google-analytics|cloudflareinsights/,route=>route.abort());
      await page.goto(base+PAD,{waitUntil:"networkidle"});
      const v=sc.verwacht,id=`${label} ${sc.naam} ${breedte}px ${schema}`;
      await page.waitForFunction(()=>!document.querySelector("#seizoen-verwachting[aria-busy]"));
      const r=await page.evaluate(()=>({
        kop:document.querySelector("h1").textContent.trim(),
        titel:document.title,
        aftellen:(()=>{const e=document.getElementById("seizoen-aftellen");return e&&!e.hidden?e.textContent.trim():"";})(),
        getal:(()=>{const e=document.querySelector("#seizoen-aftellen .aftel-getal");return e?parseFloat(getComputedStyle(e).fontSize):0;})(),
        melding:document.getElementById("seizoen-melding").textContent.trim(),
        samenvatting:(document.querySelector(".seizoen-samenvatting")||{}).textContent||"",
        tabellen:document.querySelectorAll(".seizoen-dag table").length,
        rijen:[...document.querySelectorAll(".seizoen-dag tbody tr")].length,
        cellen:[...document.querySelectorAll(".seizoen-dag td")].map(td=>td.textContent.trim()),
        later:[...document.querySelectorAll(".seizoen-later")].map(p=>p.textContent.trim()),
        fout:!!document.querySelector(".seizoen-fout"),
        breed:document.documentElement.scrollWidth,
        thema:document.documentElement.getAttribute("data-thema"),
        achtergrond:getComputedStyle(document.body).backgroundColor
      }));
      assert.deepEqual(fouten,[],`${id}: geen browserfouten`);
      controleerUitlijning(assert,await page.evaluate(meetUitlijning),breedte,id);
      assert.equal(fetches,v.fetch,`${id}: aantal verwachtingsverzoeken`);
      if(v.kop){assert.equal(r.kop,v.kop,`${id}: kop`);assert(r.titel.startsWith(v.kop+":"),`${id}: titel volgt het jaar (${r.titel})`);}
      if(v.aftellen)assert.equal(r.aftellen,v.aftellen,`${id}: aftelling`);
      if(/^\d/.test(v.aftellen||""))assert.equal(r.getal,76,`${id}: aftelgetal staat niet groot (${r.getal}px)`);
      if(v.melding)assert.match(r.melding,v.melding,`${id}: melding`);
      if(v.samenvatting)assert.equal(r.samenvatting.trim(),v.samenvatting,`${id}: samenvatting`);
      assert.equal(r.tabellen,v.tabellen,`${id}: aantal dagtabellen`);
      if(v.tabellen)assert.equal(r.rijen,v.tabellen*kerst.plaatsen.length,`${id}: één rij per plaats per dag`);
      if(v.cel)assert(r.cellen.includes(v.cel),`${id}: cel ${v.cel} in ${JSON.stringify(r.cellen)}`);
      if(v.later)assert.deepEqual(r.later,[v.later],`${id}: latere dag`);
      assert.equal(r.fout,!!v.fout,`${id}: foutmelding alleen bij een mislukte verwachting`);
      assert(!r.cellen.some(c=>/undefined|NaN|null/.test(c)),`${id}: geen lege waarden`);
      assert(r.breed<=breedte,`${id}: geen horizontale overflow (${r.breed}px)`);
      if(schema==="dark"){assert.equal(r.thema,"donker",`${id}: donker thema`);assert.equal(r.achtergrond,"rgb(12, 15, 14)",`${id}: donkere achtergrond`);}
      if(SCHERMEN&&label==="Chromium"&&(sc.naam==="ver"||sc.naam==="venster")){
        fs.mkdirSync(SCHERMEN,{recursive:true});
        await page.screenshot({path:path.join(SCHERMEN,`witte-kerst-${sc.naam}-${breedte<700?"mobiel":"desktop"}-${schema==="dark"?"donker":"licht"}.png`),fullPage:true});
      }
      await context.close();
    }
  }finally{await browser.close();}
}

/* Engels: alles vertaald, links en plaatsnamen blijven staan. */
const ENGELS=[
  {naam:"ver",nu:"2026-10-05T10:00:00Z",kop:"White Christmas 2026",zinnen:["81 days to go until Christmas Day","Forecast from Saturday 19 December · Boxing Day follows on Sunday 20 December"]},
  {naam:"venster",nu:"2026-12-21T09:00:00Z",data:metSneeuw("2026-12-21"),kop:"White Christmas 2026",zinnen:["4 days to go until Christmas Day","According to the current forecast, there will be snow on the ground in De Bilt on both Christmas Day and Boxing Day. If that holds, it will officially be a white Christmas.","Snow cover, 4 cm","No snow, 1.6 mm of rain","official measuring site"]},
  {naam:"half",nu:"2026-12-19T09:00:00Z",data:metSneeuw("2026-12-19"),kop:"White Christmas 2026",zinnen:["Boxing Day: the forecast will appear on Sunday 20 December."]}
];
async function engels(browserType,label,base){
  const browser=await browserType.launch({headless:true});
  try{
    for(const sc of ENGELS)for(const breedte of [390,1366]){
      const context=await browser.newContext({viewport:{width:breedte,height:breedte<700?844:900}});
      await context.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1",JSON.stringify("en"));}catch(e){}});
      const page=await context.newPage();
      const fouten=[];page.on("pageerror",e=>fouten.push(e.message));
      await page.clock.setFixedTime(new Date(sc.nu));
      await page.route("https://api.open-meteo.com/**",route=>route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify(sc.data||[])}));
      await page.route(/posthog|googletagmanager|google-analytics|cloudflareinsights/,route=>route.abort());
      await page.goto(base+PAD,{waitUntil:"networkidle"});
      const id=`${label} EN ${sc.naam} ${breedte}px`;
      await page.waitForFunction(k=>document.querySelector("h1")&&document.querySelector("h1").textContent.trim()===k,sc.kop,{timeout:10000});
      await page.waitForTimeout(400);
      const r=await page.evaluate(()=>({
        /* Witruimte samengevoegd: het grote aftelgetal staat in een eigen blok. */
        tekst:document.body.innerText.replace(/\s+/g," "),
        titel:document.title,
        ontbreekt:[...(window.__WIW_TAAL_ONTBREEKT__||[])],
        links:[...document.querySelectorAll(".seizoen-dag a")].map(a=>a.getAttribute("href")),
        plaatsen:[...document.querySelectorAll(".seizoen-dag .plaats")].map(e=>e.textContent.trim())
      }));
      assert.deepEqual(fouten,[],`${id}: geen browserfouten`);
      assert.deepEqual(r.ontbreekt,[],`${id}: alles vertaald`);
      /* De vertaallaag mag geen lege vormelementen weghalen (tijdlijn en logo). */
      const vorm=await page.evaluate(()=>({pt:document.querySelectorAll(".wk-pt").length,st:document.querySelectorAll(".wk-st").length,lijn:document.querySelectorAll(".wk-lijn").length,jl:document.querySelectorAll(".wk-jl").length,logo:document.querySelectorAll(".wk-brandmark").length,label:document.querySelector(".wk-baan").getAttribute("aria-label")}));
      assert.deepEqual([vorm.pt,vorm.st,vorm.lijn,vorm.jl,vorm.logo],[8,8,1,8,1],`${id}: tijdlijn en logo blijven compleet (${JSON.stringify(vorm)})`);
      assert(/^Timeline of official white Christmases since 1901: /.test(vorm.label),`${id}: tekstalternatief tijdlijn vertaald`);
      assert(r.titel.startsWith(sc.kop+": will we get snow at Christmas?"),`${id}: titel (${r.titel})`);
      for(const z of sc.zinnen)assert(r.tekst.includes(z),`${id}: tekst bevat "${z}"`);
      assert(!/kerst|sneeuw|verwachting|Bekijk/i.test(r.tekst),`${id}: geen Nederlandse resten: ${r.tekst}`);
      if(sc.data){
        assert(r.plaatsen.includes("De Bilt")&&r.plaatsen.includes("Utrecht"),`${id}: plaatsnamen blijven staan`);
        assert(r.links.includes("/weer/utrecht/"),`${id}: links naar plaatspagina's blijven werken`);
      }
      if(SCHERMEN&&label==="Chromium"&&sc.naam==="venster"&&breedte===390){
        fs.mkdirSync(SCHERMEN,{recursive:true});
        await page.screenshot({path:path.join(SCHERMEN,"witte-kerst-venster-mobiel-engels.png"),fullPage:true});
      }
      await context.close();
    }
  }finally{await browser.close();}
}


/* Afgebakende UI-verificatie voor de Witte-kerst ontwerplaag; weer- en KNMI-testmatrix hierboven blijft intact. */
async function controleerOntwerp(browserType,label,base){
  const browser=await browserType.launch({headless:true});
  try{
    for(const breedte of [320,390,768,1366]){
      const context=await browser.newContext({viewport:{width:breedte,height:844},colorScheme:"light"});
      const page=await context.newPage();
      const fouten=[];page.on("pageerror",e=>fouten.push(e.message));
      await page.clock.setFixedTime(new Date("2026-11-21T10:00:00Z"));
      await page.route(/posthog|googletagmanager|google-analytics|cloudflareinsights/,route=>route.abort());
      await page.goto(base+PAD,{waitUntil:"networkidle"});
      const id=`${label} ontwerp ${breedte}px`;
      assert.equal(await page.locator(".wk-page").count(),1,id+": geïsoleerde kerstpagina");
      assert.equal(await page.getByRole("banner").count(),1,id+": siteheader is een eigen landmark");
      assert.equal(await page.getByRole("main").count(),1,id+": één hoofdlandmark");
      assert.equal(await page.getByRole("contentinfo").count(),1,id+": sitefooter is een eigen landmark");
      assert.equal(await page.getByRole("region",{name:"Witte kerst 2026",exact:true}).count(),1,id+": één regio met de paginanaam");
      assert.equal(await page.locator("#seizoen-melding").count(),1,id+": één runtimebericht");
      assert.equal(await page.locator("#seizoen-melding").locator('xpath=ancestor::*[@aria-live="polite"][1]').count(),1,id+": statusbericht heeft beleefde live-aankondiging");
      assert.equal(await page.locator(".wk-vragen article").count(),2,id+": twee KNMI-uitlegvragen");
      assert.equal(await page.locator(".wk-dot").count(),0,id+": geen nulachtig statusicoon");
      /* G2-B: eerst het antwoord, dan de tijdlijn; geen verlopen of gloed, geen kaart in een kaart. */
      const g2b=await page.evaluate(()=>{
        const r=e=>e.getBoundingClientRect();
        const kop=document.getElementById("seizoen-kop"),label=document.getElementById("seizoen-label"),melding=document.getElementById("seizoen-melding");
        const baan=document.querySelector(".wk-baan"),jl=[...document.querySelectorAll(".wk-jl")],pt=[...document.querySelectorAll(".wk-pt")];
        const botst=(a,b)=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom;
        const vakken=jl.map(r);
        let overlap=0;for(let i=0;i<vakken.length;i++)for(let k=i+1;k<vakken.length;k++)if(botst(vakken[i],vakken[k]))overlap++;
        const lijnY=r(document.querySelector(".wk-lijn")).top;
        const kaders=[...document.querySelectorAll("main *")].filter(e=>{const s=getComputedStyle(e);return /gradient/.test(s.backgroundImage)});
        const omkaderd=[...document.querySelectorAll("main section, main article, main aside, main div")].filter(e=>{const s=getComputedStyle(e);return ["Top","Right","Bottom","Left"].every(z=>parseFloat(s["border"+z+"Width"])>0)});
        return {
          labelZichtbaar:!!label&&!label.hidden&&r(label).height>0,labelTekst:label&&label.textContent,
          antwoordOnderKop:r(melding).top-r(kop).bottom,antwoordVoorTijdlijn:r(melding).bottom<=r(baan).top,
          tijdlijnVoorLead:r(baan).bottom<=r(document.querySelector(".wk-lead")).top,
          stippen:pt.length,jaartallen:jl.map(e=>e.textContent).join(","),overlap,
          labelsZichtbaar:vakken.every(v=>v.width>0&&v.left>=0&&v.right<=innerWidth),
          labelsBuitenLijn:vakken.every(v=>v.bottom<lijnY-3||v.top>lijnY+3),
          labelGrootte:Math.min(...jl.map(e=>parseFloat(getComputedStyle(e).fontSize))),
          verlopen:kaders.length,volledigOmkaderd:omkaderd.map(e=>e.className||e.tagName)
        };
      });
      assert(g2b.labelZichtbaar&&g2b.labelTekst==="Nog te vroeg",id+": kort antwoord zichtbaar ("+g2b.labelTekst+")");
      assert(g2b.antwoordOnderKop>=0&&g2b.antwoordOnderKop<80,id+": antwoord direct onder de paginakop ("+g2b.antwoordOnderKop+"px)");
      assert(g2b.antwoordVoorTijdlijn&&g2b.tijdlijnVoorLead,id+": volgorde antwoord, tijdlijn, inleiding");
      assert.equal(g2b.stippen,8,id+": acht stippen");
      assert.equal(g2b.jaartallen,"1906,1938,1940,1950,1964,1981,2009,2010",id+": alle acht jaartallen");
      assert.equal(g2b.overlap,0,id+": jaartallen overlappen elkaar niet");
      assert(g2b.labelsZichtbaar&&g2b.labelsBuitenLijn,id+": jaartallen binnen beeld en los van de tijdlijn");
      assert(g2b.labelGrootte>=12,id+": jaartallen minstens 12px");
      assert.equal(g2b.verlopen,0,id+": geen verlopen of gloed");
      assert.deepEqual(g2b.volledigOmkaderd,[],id+": geen omkaderde vlakken (kaart in kaart)");
      /* G2-B: de weergavekeuze zit in het menu, niet als balk bovenaan. */
      assert.equal(await page.locator(".wk-menu .wk-theme").count(),1,id+": weergavekeuze staat in het menu");
      assert(!await page.locator(".wk-theme").isVisible(),id+": weergavekeuze niet zichtbaar zolang het menu dicht is");
      await page.locator(".wk-menu > summary").click();
      assert(await page.locator(".wk-menu").evaluate(x=>x.open),id+": menu open");
      assert((await page.locator(".wk-theme label").all()).length===3,id+": drie themakeuzes");
      const maat=await page.locator(".wk-theme label").evaluateAll(a=>a.map(x=>x.getBoundingClientRect()));
      assert(maat.every(x=>x.height>=44),id+": alle themadoelen minstens 44px");
      assert(maat.every(x=>x.left>=0&&x.right<=breedte),id+": themakeuzes binnen het scherm");
      await page.locator('label[for="wk-donker"]').click();
      assert.equal(await page.locator("html").getAttribute("data-thema"),"donker",id+": donker werkt");
      assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("weerbriefing.thema.sessie"))),"donker",id+": keuze opgeslagen");
      await page.locator('label[for="wk-licht"]').click();
      assert.equal(await page.locator("html").getAttribute("data-thema"),"licht",id+": licht werkt");
      await page.locator('label[for="wk-auto"]').click();
      assert(await page.locator("#wk-auto").isChecked(),id+": auto geselecteerd");
      assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("weerbriefing.thema.sessie"))),"auto",id+": auto opgeslagen");
      /* Systeemthema wisselt na handmatige keuze: beide themahulpjes mogen elkaar niet overschrijven. */
      await page.locator('label[for="wk-donker"]').click();
      await page.emulateMedia({colorScheme:"dark"});
      await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
      await page.emulateMedia({colorScheme:"light"});
      await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
      assert.equal(await page.locator("html").getAttribute("data-thema"),"donker",id+": handmatig Donker overleeft systeemwissel");
      await page.locator('label[for="wk-licht"]').click();
      await page.emulateMedia({colorScheme:"dark"});
      await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
      assert.equal(await page.locator("html").getAttribute("data-thema"),"licht",id+": handmatig Licht overleeft systeemwissel");
      await page.locator('label[for="wk-auto"]').click();
      assert.equal(await page.locator("html").getAttribute("data-thema"),"donker",id+": Auto volgt donker systeem");
      await page.emulateMedia({colorScheme:"light"});
      await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
      assert.equal(await page.locator("html").getAttribute("data-thema"),null,id+": Auto volgt licht systeem");
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id+": geen horizontale overflow");
      await page.locator(".wk-menu > summary").click();
      assert(!await page.locator(".wk-menu").evaluate(x=>x.open),id+": menu dicht");
      assert.deepEqual(fouten,[],id+": geen JavaScript-fouten");
      await context.close();
    }
  }finally{await browser.close();}
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    await controleer(chromium,"Chromium",base);
    await controleer(webkit,"WebKit",base);
    await controleerOntwerp(chromium,"Chromium",base);
    await controleerOntwerp(webkit,"WebKit",base);
    await engels(chromium,"Chromium",base);
    await engels(webkit,"WebKit",base);
  }finally{server.close();}
  console.log("Witte kerst: ver voor kerst, volledig en half venster, storing en jaarwissel in Chromium en WebKit, mobiel en desktop, licht en donker; Engels volledig vertaald.");
})().catch(e=>{console.error(e);process.exit(1);});

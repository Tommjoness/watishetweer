"use strict";

/* Toegankelijk alternatief voor de uurgrafiek op de parkpagina (/nachtzicht/<park>/): de balkjes zijn alleen visueel
   (niet focusbaar, verborgen voor hulptechnologie); tijd, bewolkingspercentage, maanstand en beoordeling per uur
   staan als tekst in een uitklapbare tabel met één tabstop. Gecontroleerd op het finale artifact (public/), in
   Nederlands en Engels: semantiek in de toegankelijkheidsboom, toetsenbordbediening en focus, gelijkheid met de
   balkjes, een onbekende bewolkingswaarde en het ontbreken van onvertaalde tekst. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"nachtzicht","alde-feanen","index.html")))throw new Error("public/nachtzicht/alde-feanen/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".css":"text/css; charset=utf-8"};
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

/* Wisselende bewolking, met één uur waarvan de bewolking ontbreekt. */
function nacht(lat,lon){
  const d=bouw({geenKwartier:true,cc:u=>(u*7)%90+5});
  const i=d.hourly.time.indexOf("2026-07-22T21:00"),c=d.current,h=d.hourly;
  c.time="2026-07-22T21:30";
  for(const v of ["temperature_2m","relative_humidity_2m","precipitation","weather_code","cloud_cover","wind_gusts_10m","is_day"])c[v]=h[v][i];
  c.visibility=h.visibility?h.visibility[i]:null;
  const onbekend=h.time.indexOf("2026-07-23T01:00");
  h.cloud_cover[onbekend]=null;
  d.latitude=lat;d.longitude=lon;d.elevation=2;
  return d;
}

async function open(browser,taal,breedte){
  const context=await browser.newContext({viewport:{width:breedte,height:900},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  if(taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
  await page.clock.setFixedTime(new Date("2026-07-22T19:30:00Z"));
  await page.route("**/*",r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com")return r.fulfill({json:nacht(Number(u.searchParams.get("latitude")),Number(u.searchParams.get("longitude")))});
    if(u.pathname.startsWith("/api/"))return r.fulfill({status:503,json:{beschikbaar:false}});
    if(u.hostname!=="127.0.0.1")return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto("http://127.0.0.1:"+server.address().port+"/nachtzicht/alde-feanen/",{waitUntil:"load"});
  await page.waitForFunction(()=>{const u=document.getElementById("nz-vannacht");return u&&!u.hidden&&u.querySelector("details.nz-gegevens");},null,{timeout:20000});
  await sleep(500);
  return {context,page,fouten};
}

/* De toegankelijkheidsboom van de uurtabel (Chromium/CDP): rollen en namen van koppen en cellen. */
async function axTabel(context,page){
  const cdp=await context.newCDPSession(page);
  await cdp.send("DOM.enable");await cdp.send("Accessibility.enable");
  const doc=await cdp.send("DOM.getDocument",{depth:0});
  const q=await cdp.send("DOM.querySelector",{nodeId:doc.root.nodeId,selector:"details.nz-gegevens"});
  const d=await cdp.send("DOM.describeNode",{nodeId:q.nodeId,depth:-1,pierce:true});
  const ids=new Set();(function walk(n){ids.add(n.backendNodeId);(n.children||[]).forEach(walk);})(d.node);
  const ax=await cdp.send("Accessibility.getFullAXTree");
  const mijn=ax.nodes.filter(n=>!n.ignored&&ids.has(n.backendDOMNodeId));
  const uit={
    rollen:[...new Set(mijn.map(n=>n.role.value))],
    kolomkoppen:mijn.filter(n=>n.role.value==="columnheader").map(n=>n.name.value),
    rijkoppen:mijn.filter(n=>n.role.value==="rowheader").map(n=>n.name.value),
    cellen:mijn.filter(n=>n.role.value==="cell").map(n=>n.name.value),
    tabel:mijn.filter(n=>n.role.value==="table").map(n=>n.name&&n.name.value)
  };
  /* Balkjes en tijdlabels van de grafiek horen niet in de boom. */
  const balk=await cdp.send("DOM.querySelector",{nodeId:doc.root.nodeId,selector:".nz-staven"});
  const bd=await cdp.send("DOM.describeNode",{nodeId:balk.nodeId,depth:-1,pierce:true});
  const bids=new Set();(function walk(n){bids.add(n.backendNodeId);(n.children||[]).forEach(walk);})(bd.node);
  uit.balkenInBoom=ax.nodes.filter(n=>!n.ignored&&bids.has(n.backendDOMNodeId)&&n.role.value!=="none"&&n.role.value!=="generic"&&n.role.value!=="ignored").length;
  await cdp.detach();
  return uit;
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    for(const taal of ["nl","en"])for(const breedte of [390,1366]){
      const L=`${taal} ${breedte}px`,en=taal==="en";
      const T=(nl,eng)=>en?eng:nl;
      const {context,page,fouten}=await open(browser,taal,breedte);
      try{
        /* Structuur: gesloten details met één samenvatting, balkjes verborgen, geen extra tabstops. */
        const s=await page.evaluate(()=>{
          const details=document.querySelector("details.nz-gegevens"),fig=document.querySelector(".nz-grafiek");
          const focusbaar=el=>[...el.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')].filter(e=>e.tabIndex>=0);
          return {open:details.open,samenvatting:details.querySelector("summary").textContent.trim(),
            balkenVerborgen:document.querySelector(".nz-staven").getAttribute("aria-hidden")==="true",
            balken:document.querySelectorAll(".nz-uur").length,
            focusInGrafiek:focusbaar(fig).length,
            focusInTabel:focusbaar(details.querySelector("table")).length,
            caption:details.querySelector("caption").textContent.trim(),
            koppen:[...details.querySelectorAll("thead th")].map(t=>[t.textContent.trim(),t.getAttribute("scope")]),
            rijkoppen:[...details.querySelectorAll("tbody th")].map(t=>t.getAttribute("scope")),
            rijen:details.querySelectorAll("tbody tr").length,
            titels:[...document.querySelectorAll(".nz-uur")].map(b=>({titel:b.getAttribute("title"),goed:b.classList.contains("goed")})),
            cellen:[...details.querySelectorAll("tbody tr")].map(r=>[...r.children].map(c=>c.textContent.trim()))};
        });
        assert.equal(s.open,false,`${L}: de tabel is standaard dicht`);
        assert.equal(s.samenvatting,T("Bewolking per uur als tabel","Cloud cover per hour as a table"),`${L}: samenvatting`);
        assert.equal(s.balkenVerborgen,true,`${L}: de balkjes zijn verborgen voor hulptechnologie`);
        assert.equal(s.focusInGrafiek,0,`${L}: geen tabstops op de balkjes`);
        assert.equal(s.focusInTabel,0,`${L}: geen tabstops in de tabel`);
        assert(s.balken>=6&&s.rijen===s.balken,`${L}: één rij per uur (${s.rijen} rijen, ${s.balken} balkjes)`);
        assert.match(s.caption,T(/^Bewolking per uur, \d\d:\d\d tot \d\d:\d\d$/,/^Cloud cover per hour, \d\d:\d\d to \d\d:\d\d$/),`${L}: tabelnaam`);
        assert.deepEqual(s.koppen,[[T("Tijd","Time"),"col"],[T("Bewolking","Cloud"),"col"],[T("Maan","Moon"),"col"],[T("Beoordeling","Rating"),"col"]],`${L}: kolomkoppen ${JSON.stringify(s.koppen)}`);
        assert(s.rijkoppen.every(x=>x==="row"),`${L}: de tijd is rijkop`);

        /* Gelijk aan de balkjes: tijd, percentage, maan en beoordeling per uur (alleen in het Nederlands vergeleken op titel). */
        s.cellen.forEach((c,i)=>{
          assert.match(c[0],/^\d\d:\d\d$/,`${L}: rij ${i} tijd`);
          assert.match(c[1],T(/^(\d+%|onbekend)$/,/^(\d+%|unknown)$/),`${L}: rij ${i} bewolking "${c[1]}"`);
          assert(c[2]===T("maan op","moon up")||c[2]===T("maan niet op","moon down"),`${L}: rij ${i} maan "${c[2]}"`);
          assert.equal(c[3],s.titels[i].goed?T("goed om te kijken","good for stargazing"):T("te bewolkt, slecht zicht of te veel maanlicht","too cloudy, poor visibility or too much moonlight"),`${L}: rij ${i} beoordeling`);
          if(!en){
            const m=/^(\d\d:\d\d): (?:(\d+%) bewolking|bewolking onbekend)(, maan op)?$/.exec(s.titels[i].titel);
            assert(m,`${L}: titel van balkje ${i} "${s.titels[i].titel}"`);
            assert.equal(m[1],c[0],`${L}: tijd rij ${i}`);
            assert.equal(m[2]||"onbekend",c[1],`${L}: bewolking rij ${i}`);
            assert.equal(m[3]?"maan op":"maan niet op",c[2],`${L}: maan rij ${i}`);
          }
        });
        assert(s.cellen.some(c=>c[1]===T("onbekend","unknown")),`${L}: een ontbrekende bewolkingswaarde staat als "onbekend", niet als 0%`);
        assert(s.cellen.some(c=>/%$/.test(c[1])&&c[1]!=="0%"),`${L}: bewolking in procenten`);

        /* Toetsenbord: Tab bereikt de samenvatting, Enter en spatie klappen open en dicht, de focus blijft. */
        await page.evaluate(()=>{const f=document.querySelector(".nz-grafiek");f.setAttribute("tabindex","-1");f.focus();});
        let bereikt=false;
        for(let i=0;i<4&&!bereikt;i++){await page.keyboard.press("Tab");bereikt=await page.evaluate(()=>document.activeElement&&document.activeElement.tagName==="SUMMARY"&&document.activeElement.closest("details.nz-gegevens")!=null);}
        assert(bereikt,`${L}: de samenvatting is met Tab binnen enkele stappen bereikbaar`);
        await page.keyboard.press("Enter");
        assert.equal(await page.locator("details.nz-gegevens").evaluate(d=>d.open),true,`${L}: Enter opent de tabel`);
        assert.equal(await page.evaluate(()=>document.activeElement.tagName),"SUMMARY",`${L}: de focus blijft op de samenvatting`);
        const zichtbaar=await page.locator("details.nz-gegevens table").isVisible();
        assert(zichtbaar,`${L}: de geopende tabel is zichtbaar`);
        const overloop=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
        assert(overloop<=0,`${L}: geen horizontale overloop met open tabel (${overloop}px)`);

        /* Toegankelijkheidsboom: echte tabel met kop- en rijcellen, en geen balkjes. */
        const ax=await axTabel(context,page);
        assert(ax.rollen.includes("table"),`${L}: AX-rol table ontbreekt (${ax.rollen})`);
        assert.deepEqual(ax.kolomkoppen,[T("Tijd","Time"),T("Bewolking","Cloud"),T("Maan","Moon"),T("Beoordeling","Rating")],`${L}: AX-kolomkoppen`);
        assert.equal(ax.rijkoppen.length,s.rijen,`${L}: AX-rijkoppen`);
        assert(ax.cellen.some(c=>/\d+%/.test(c)),`${L}: de bewolkingspercentages staan in de toegankelijkheidsboom (${ax.cellen.slice(0,4)})`);
        assert.equal(ax.balkenInBoom,0,`${L}: de balkjes staan niet in de toegankelijkheidsboom`);
        await page.keyboard.press("Space");
        assert.equal(await page.locator("details.nz-gegevens").evaluate(d=>d.open),false,`${L}: spatie sluit de tabel`);
        assert.equal(await page.evaluate(()=>document.activeElement.tagName),"SUMMARY",`${L}: de focus blijft na sluiten`);

        if(en){
          const ontbreekt=await page.evaluate(()=>[...(window.__WIW_TAAL_ONTBREEKT__||[])]);
          assert.deepEqual(ontbreekt,[],`${L}: de vertaallaag meldt onvertaalde tekst`);
        }
        assert.deepEqual(fouten,[],`${L}: scriptfouten`);
      }finally{await context.close();}
    }
    console.log("Nachtzicht-uurtabel: tijd, bewolking, maan en beoordeling per uur als tabel met één tabstop; semantiek, toetsenbord, focus en NL/EN geslaagd.");
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

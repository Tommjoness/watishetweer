"use strict";

/* Verslag L1/B1: de losse parkpagina en de vakantiepagina vallen bij een fout van
   Open-Meteo terug op de eigen reserveroute (/api/forecast). Het overzicht van de
   parken heeft bewust GEEN reserve. Bij een eindfout staat er een nette status
   ("Niet beschikbaar" onder Vannacht, een streepje met toegankelijke omschrijving
   onder Beste periode) met een knop "Opnieuw proberen" die werkt. Gecontroleerd:
   de hele reeks laden → fout → opnieuw proberen → herstel, geen dubbele
   verzoeken bij dubbelklikken, de echte bronvermelding (ook bij verschillende
   bronnen per plaats), onbekende zonuren, de link naar de eigen plaats, de
   teksthiërarchie, de compacte parktitel en de taalknop op dezelfde rij, in
   Nederlands en Engels op 320, 390 en 1366 px. Draait op het finale artifact
   (public/) met de echte runtimes. */

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


const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* modus.primair/reserve: "ok" | "fout"; modus.bronPerPlaats: functie (index) → bronkop;
   modus.reserveFoutPlaats: index van een plaats die in de reserve ontbreekt;
   modus.vertraging: ms vertraging op Open-Meteo (om de laadstatus te zien). */
async function nieuwePagina(browser,modus,pad,klok,opt={}){
  const breedte=opt.breedte||390;
  const context=await browser.newContext({viewport:{width:breedte,height:844},locale:opt.taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
  const page=await context.newPage(),fouten=[],tel={primair:0,reserve:0};
  page.on("pageerror",e=>fouten.push(String(e)));
  if(opt.taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
  await page.clock.setFixedTime(new Date(klok));
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"){
      tel.primair++;
      if(modus.vertraging)await sleep(modus.vertraging);
      if(modus.primair==="fout")return r.fulfill({status:503,body:"{}"});
      const la=String(u.searchParams.get("latitude")||""),lo=String(u.searchParams.get("longitude")||"");
      if(pad.startsWith("/herfstvakantie"))return r.fulfill({json:vakantieAlle()});
      if(la.includes(",")){const A=la.split(",").map(Number),B=lo.split(",").map(Number);return r.fulfill({json:A.map((x,i)=>nachtFixture(x,B[i]))});}
      return r.fulfill({json:nachtFixture(Number(la),Number(lo))});
    }
    if(u.pathname==="/api/forecast"){
      tel.reserve++;
      if(modus.reserve==="fout")return r.fulfill({status:503,json:{beschikbaar:false}});
      const lat=Number(u.searchParams.get("lat"));
      if(pad.startsWith("/herfstvakantie")){
        const i=herfst.plaatsen.findIndex(p=>Math.abs(p.lat-lat)<1e-6);
        if(i===modus.reserveFoutPlaats)return r.fulfill({status:503,json:{beschikbaar:false}});
        const bron=modus.bronPerPlaats?modus.bronPerPlaats(i):"visualcrossing";
        return r.fulfill({json:vakantieEen(),headers:{"X-WIW-Weather-Source":bron}});
      }
      return r.fulfill({json:nachtFixture(lat,Number(u.searchParams.get("lon"))),headers:{"X-WIW-Weather-Source":"visualcrossing"}});
    }
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.hostname!=="127.0.0.1")return r.fulfill({status:204,body:""});
    return r.continue();
  });
  return {context,page,fouten,tel,modus};
}
const klaarVakantie=page=>page.waitForFunction(()=>!document.querySelector("#seizoen-verwachting[aria-busy]"),null,{timeout:45000});
const tekstVan=(page,sel)=>page.locator(sel).innerText();

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const base="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  const NU="2026-07-22T19:30:00Z",V="2026-10-12T10:00:00Z";
  let gemeten=0;
  try {
    for(const taal of ["nl","en"])for(const breedte of [320,390,1366]){
      const L=`${taal} ${breedte}px`,en=taal==="en";
      const T=(nl,eng)=>en?eng:nl;
      /* 1. Parkpagina: Open-Meteo faalt, de reserve levert; kop compact, taalknop op de rij van de terugknop. */
      {
        const {context,page,fouten,tel}=await nieuwePagina(browser,{primair:"fout",reserve:"ok"},"/nachtzicht/alde-feanen/",NU,{taal,breedte});
        await page.goto(base+"/nachtzicht/alde-feanen/",{waitUntil:"load"});
        await page.waitForSelector("#nz-vannacht:not([hidden])",{timeout:15000});
        assert.equal(await page.locator("#nz-status").isHidden(),true,`${L} park+reserve: geen foutstatus`);
        assert.equal(tel.reserve,1,`${L} park+reserve: één reserveaanvraag voor het punt`);
        const m=await page.evaluate(()=>{
          const knop=document.querySelector("[data-taal-keuze]"),terug=document.querySelector(".nz-terug a"),h1=document.querySelector("h1");
          const r=e=>e.getBoundingClientRect();
          return {knopMid:r(knop).top+r(knop).height/2,terugMid:r(terug).top+r(terug).height/2,knopRechts:r(knop).right,h1Top:r(h1).top,h1Maat:parseFloat(getComputedStyle(h1).fontSize),h1Hoogte:r(h1).height,overloop:document.documentElement.scrollWidth-innerWidth};
        });
        const t=await page.evaluate(()=>{
          const top=s=>{const e=document.querySelector(s);return e?e.getBoundingClientRect().top+scrollY:null;};
          const fs=s=>{const e=document.querySelector(s);return e?parseFloat(getComputedStyle(e).fontSize):null;};
          return {score:top(".nz-cijfer"),licht:top(".nz-licht"),feiten:top(".nz-feiten"),h2:fs("main>h2"),feitkop:fs(".nz-feiten dt"),h1:fs("h1"),lh:getComputedStyle(document.querySelector("h2")).lineHeight,hoogte:innerHeight,
            volgorde:[...document.querySelectorAll("main>*")].map(e=>e.id||e.className||e.tagName).slice(0,8).join(",")};
        });
        assert(t.score!=null&&t.licht!=null&&t.score<t.feiten&&t.feiten<t.licht,`${L} park: volgorde score → gegevens → lichtvervuiling klopt niet (${t.score}/${t.feiten}/${t.licht})`);
        assert(t.score<t.hoogte,`${L} park: score staat niet in het eerste scherm (${t.score}px)`);
        assert.equal(t.h2,18,`${L} park: sectiekop ${t.h2}px`);assert.equal(t.feitkop,13,`${L} park: feitkop ${t.feitkop}px`);
        assert(breedte>600?t.h1===36:t.h1===30,`${L} park: hoofdtitel ${t.h1}px`);
        assert(Math.abs(m.knopMid-m.terugMid)<=8,`${L} park: taalknop staat niet op de rij van de terugknop (${m.knopMid} vs ${m.terugMid})`);
        assert(m.h1Maat<=36,`${L} park: parktitel (${m.h1Maat}px)`);
        assert(m.h1Top<=120,`${L} park: te veel lege ruimte boven de titel (${m.h1Top}px)`);
        assert(m.overloop<=0,`${L} park: horizontale overloop ${m.overloop}`);
        assert.deepEqual(fouten,[],`${L} park+reserve: scriptfouten`);
        await context.close();gemeten++;
      }
      /* 2. Parkpagina: beide bronnen falen; reeks laden → fout → knop → herstel; dubbelklik = één ronde. */
      {
        const {context,page,fouten,tel,modus}=await nieuwePagina(browser,{primair:"fout",reserve:"fout"},"/nachtzicht/alde-feanen/",NU,{taal,breedte});
        await page.goto(base+"/nachtzicht/alde-feanen/",{waitUntil:"load"});
        await page.waitForSelector("#nz-status .nz-opnieuw",{timeout:20000});
        assert.match(await tekstVan(page,"#nz-status"),T(/kon niet worden geladen/,/could not be loaded/),`${L} park-eindfout: tekst`);
        assert.equal(await page.locator("#nz-vannacht").isHidden(),true,`${L} park-eindfout: geen data`);
        assert(await page.evaluate(()=>document.getElementById("nz-status").getBoundingClientRect().top<document.querySelector(".nz-licht").getBoundingClientRect().top),`${L} park-eindfout: foutstatus hoort boven de lichtvervuilingsuitleg`);
        assert((await page.locator("#nz-status .nz-opnieuw").boundingBox()).height>=44,`${L} park-eindfout: knop minstens 44px`);
        assert.equal((await page.locator("#nz-status .nz-opnieuw").innerText()).trim(),T("Opnieuw proberen","Try again"),`${L} park-eindfout: knoptekst`);
        const voor={p:tel.primair,r:tel.reserve};
        modus.vertraging=600;
        await page.evaluate(()=>{const b=document.querySelector("#nz-status .nz-opnieuw");b.click();b.click();});
        /* laadstatus zichtbaar, de foutmelding en de knop zijn weg */
        assert.equal(await page.locator("#nz-status .nz-opnieuw").count(),0,`${L} park-retry: knop verdwijnt tijdens laden`);
        assert.match(await tekstVan(page,"#nz-status"),T(/wordt geladen/,/Loading/),`${L} park-retry: laadstatus`);
        await page.waitForSelector("#nz-status .nz-opnieuw",{timeout:20000});   /* nog steeds beide bronnen stuk: opnieuw fout */
        assert.equal(tel.primair-voor.p,1,`${L} park-retry: dubbelklik geeft één Open-Meteo-aanvraag (${tel.primair-voor.p})`);
        assert.equal(tel.reserve-voor.r,1,`${L} park-retry: dubbelklik geeft één reserveaanvraag (${tel.reserve-voor.r})`);
        modus.primair="ok";modus.vertraging=0;
        await page.locator("#nz-status .nz-opnieuw").click();
        await page.waitForSelector("#nz-vannacht:not([hidden])",{timeout:15000});
        assert.equal(await page.locator("#nz-status").isHidden(),true,`${L} park-herstel: foutmelding weg`);
        assert.equal(await page.locator("#nz-status .nz-opnieuw").count(),0,`${L} park-herstel: knop weg`);
        assert.deepEqual(fouten,[],`${L} park-eindfout: scriptfouten`);
        await context.close();gemeten++;
      }
      /* 3. Overzicht: geen reserve; Niet beschikbaar / streepje; ruimte; geen verkleining; herstel. */
      {
        const {context,page,fouten,tel,modus}=await nieuwePagina(browser,{primair:"fout",reserve:"ok"},"/nachtzicht/",NU,{taal,breedte});
        await page.goto(base+"/nachtzicht/",{waitUntil:"load"});
        await page.waitForSelector("#nz-status .nz-opnieuw",{timeout:20000});
        assert.equal(tel.reserve,0,`${L} overzicht: geen reserveaanvragen (19 parken kosten te veel)`);
        const m=await page.evaluate(()=>{
          const rijen=[...document.querySelectorAll("tr[data-park]")];
          const bereik=(td)=>{const r=document.createRange();r.selectNodeContents(td);return r.getBoundingClientRect();};
          return {
            aantal:rijen.length,
            n:rijen.map(r=>r.querySelector(".nz-n .nz-w").textContent.trim()),
            nRegels:rijen.map(r=>{const t=r.querySelector(".nz-n");return Math.round(bereik(t).height/parseFloat(getComputedStyle(t).lineHeight));}),
            vZichtbaar:rijen.map(r=>[...r.querySelectorAll(".nz-venster .nz-w > [aria-hidden=true]")].map(c=>c.textContent).join("")),
            vOmschrijving:rijen.map(r=>(r.querySelector(".nz-venster .nz-sr")||{}).textContent||""),
            vVolledig:rijen.map(r=>r.querySelector(".nz-venster").textContent.trim()),
            ruimte:rijen.map(r=>{const a=bereik(r.querySelector(".nz-n")),b=r.querySelector(".nz-venster").getBoundingClientRect();return b.left-a.right;}),
            labels:rijen.map(r=>[...r.querySelectorAll(".nz-lbl")].map(l=>({t:l.textContent,zichtbaar:getComputedStyle(l).display!=="none",hidden:l.getAttribute("aria-hidden")==="true"}))),
            thead:getComputedStyle(document.querySelector(".nz-tabel thead th")).fontSize,theadZichtbaar:getComputedStyle(document.querySelector(".nz-tabel thead")).display!=="none",
            maatN:parseFloat(getComputedStyle(rijen[0].querySelector(".nz-n")).fontSize),
            maatTh:parseFloat(getComputedStyle(rijen[0].querySelector("th")).fontSize),
            overloop:document.documentElement.scrollWidth-innerWidth
          };
        });
        assert(m.aantal>=15,`${L} overzicht: ${m.aantal} parken`);
        assert(m.n.every(t=>t===T("Niet beschikbaar","Not available")),`${L} overzicht: Vannacht ${[...new Set(m.n)]}`);
        /* Altijd op één regel, ook met een lange parknaam ("Schiermonnikoog") op 320 px (daar staat de rij op twee regels). */
        assert(m.nRegels.every(n=>n===1),`${L} overzicht: Niet beschikbaar moet op één regel (${[...new Set(m.nRegels)]})`);
        assert(m.vZichtbaar.every(t=>t==="—"),`${L} overzicht: Beste periode toont geen streepje`);
        assert(m.vOmschrijving.every(t=>t===T("Beste periode niet beschikbaar","Best period not available")),`${L} overzicht: toegankelijke omschrijving ${[...new Set(m.vOmschrijving)]}`);
        assert(m.vVolledig.every(t=>!/Niet beschikbaar|Not available/.test(t.replace(/Beste periode niet beschikbaar|Best period not available/,""))),`${L} overzicht: de uitleg staat tweemaal per park`);
        assert(breedte<370||m.ruimte.every(x=>x>=15),`${L} overzicht: te weinig ruimte tussen de kolommen (${Math.min(...m.ruimte)}px)`);
        assert(m.maatN>=14,`${L} overzicht: tekst is verkleind (${m.maatN}px)`);
        assert(m.overloop<=0,`${L} overzicht: horizontale overloop ${m.overloop}`);
        /* Smal scherm: zonder kolomkoppen staat het label bij iedere waarde; breed: de tabelkoppen. */
        const lblN=T("Vannacht","Tonight"),lblV=T("Beste periode","Best period");
        assert(m.labels.every(l=>l.length===2&&l[0].t===lblN&&l[1].t===lblV&&l[1].hidden&&!l[0].hidden),`${L} overzicht: labels ontbreken of zijn niet correct verborgen voor schermlezers`);
        if(breedte<370)assert(m.labels.every(l=>l.every(x=>x.zichtbaar))&&!m.theadZichtbaar,`${L} overzicht: smalle rij toont geen labels bij de waarden`);
        else assert(m.labels.every(l=>l.every(x=>!x.zichtbaar))&&m.theadZichtbaar,`${L} overzicht: brede tabel toont dubbele labels`);
        assert.equal(m.thead,"13px",`${L} overzicht: tabelkop ${m.thead}`);
        const voor=tel.primair;
        await page.evaluate(()=>{const b=document.querySelector("#nz-status .nz-opnieuw");b.click();b.click();});
        await page.waitForSelector("#nz-status .nz-opnieuw",{timeout:20000});
        assert.equal(tel.primair-voor,1,`${L} overzicht-retry: dubbelklik geeft één aanvraag (${tel.primair-voor})`);
        modus.primair="ok";
        await page.locator("#nz-status .nz-opnieuw").click();
        await page.waitForFunction(()=>[...document.querySelectorAll("tr[data-park] td.nz-n")].every(t=>!/Niet beschikbaar|Not available|…/.test(t.textContent)),null,{timeout:15000});
        assert.equal(await page.locator("#nz-status").isHidden(),true,`${L} overzicht-herstel: foutmelding weg`);
        assert.equal(await page.locator("tr.nz-niet").count(),0,`${L} overzicht-herstel: geen rij meer 'niet beschikbaar'`);
        assert((await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth))<=0,`${L} overzicht-herstel: horizontale overloop met gegevens`);
        assert.equal(await page.locator("tr[data-park] .nz-lbl").evaluateAll(l=>l.every(x=>(getComputedStyle(x).display!=="none")===(innerWidth<370))),true,`${L} overzicht-herstel: labels alleen zichtbaar op smalle schermen`);
        assert.equal(await page.locator("tr[data-park] .nz-sr").count(),0,`${L} overzicht-herstel: geen omschrijving meer`);
        assert.deepEqual(fouten,[],`${L} overzicht: scriptfouten`);
        await context.close();gemeten++;
      }
      /* 4. Vakantiepagina, één bron (Visual Crossing): echte bronzin, geen "Bron: Open-Meteo", zonuren onbekend, tussenkop. */
      {
        const {context,page,fouten,tel}=await nieuwePagina(browser,{primair:"fout",reserve:"ok"},"/herfstvakantie/",V,{taal,breedte});
        await page.goto(base+"/herfstvakantie/",{waitUntil:"load"});
        await klaarVakantie(page);
        await page.waitForTimeout(600);
        assert.equal(tel.reserve,herfst.plaatsen.length,`${L} vakantie+reserve: één reserveaanvraag per plaats`);
        assert(await page.locator("#seizoen-verwachting .seizoen-dag").count()>0,`${L} vakantie+reserve: dagtabellen`);
        assert.equal(await page.locator(".seizoen-fout").count(),0,`${L} vakantie+reserve: geen foutmelding`);
        const tekst=await tekstVan(page,"#seizoen-verwachting");
        assert(tekst.includes(T("Bron: Visual Crossing, omdat Open-Meteo niet bereikbaar was.","Source: Visual Crossing, because Open-Meteo could not be reached.")),`${L} vakantie+reserve: echte bron ontbreekt: ${tekst.slice(-200)}`);
        assert(!/Open-Meteo\.\s*$/m.test(tekst)&&!tekst.includes(T("Bron: Open-Meteo.","Source: Open-Meteo.")),`${L} vakantie+reserve: tegenstrijdige bronvermelding`);
        assert.equal((tekst.match(T(/Bron:/g,/Source:/g))||[]).length,1,`${L} vakantie+reserve: dubbele bronmelding`);
        const cellen=await page.$$eval("#seizoen-verwachting td:nth-child(2)",t=>t.map(x=>x.textContent.replace(/\s+/g," ").trim()));
        assert(cellen.length>0&&cellen.every(c=>!/uur zon|hrs? of sun|weinig zon|little sun|sunshine/i.test(c)),`${L} vakantie+reserve: onbekende zonuren worden getoond: ${cellen[0]}`);
        const kop=await page.evaluate(()=>{const k=document.getElementById("seizoen-aftel-kop"),a=document.getElementById("seizoen-aftellen");return {kop:k&&!k.hidden?k.textContent:null,maat:parseFloat(getComputedStyle(a).fontSize),serif:/Bodoni/.test(getComputedStyle(a).fontFamily),tag:k&&k.tagName};});
        assert.equal(kop.kop,T("Herfstvakantie per regio","Autumn school holiday by region"),`${L} vakantie: tussenkop`);
        assert.equal(kop.tag,"H2",`${L} vakantie: tussenkop is een kop`);
        const ty=await page.evaluate(()=>{const fs=s=>{const e=document.querySelector(s);return e?parseFloat(getComputedStyle(e).fontSize):null;};const intro=document.querySelector("main>h1+p");
          return {h1:fs("h1"),tussen:fs(".seizoen-aftel-kop"),sectie:fs("main>h2:not(.seizoen-aftel-kop)"),dag:fs(".seizoen-dag h3"),kop:fs(".seizoen-dag thead th"),klein:fs(".seizoen-bron"),introRegels:Math.round(intro.getBoundingClientRect().height/parseFloat(getComputedStyle(intro).lineHeight)),
            eerste:document.querySelector(".seizoen-dag").getBoundingClientRect().top+scrollY,breed:innerWidth};});
        assert.equal(ty.tussen,21,`${L} vakantie: tussenkop ${ty.tussen}px`);assert.equal(ty.sectie,18,`${L} vakantie: sectiekop ${ty.sectie}px`);
        assert.equal(ty.dag,17,`${L} vakantie: dagkop ${ty.dag}px`);assert.equal(ty.kop,13,`${L} vakantie: tabelkop ${ty.kop}px`);assert.equal(ty.klein,14,`${L} vakantie: secundaire tekst ${ty.klein}px`);
        assert(ty.h1===(breedte>600?36:32),`${L} vakantie: hoofdtitel ${ty.h1}px`);
        assert(ty.introRegels<=(breedte<=320?4:3),`${L} vakantie: introductie is niet compact (${ty.introRegels} regels)`);
        assert(kop.maat<=17&&!kop.serif,`${L} vakantie: toelichting is nog grote seriftekst (${kop.maat}px)`);
        if(en)assert.deepEqual(await page.evaluate(()=>window.__WIW_TAAL_ONTBREEKT__?[...window.__WIW_TAAL_ONTBREEKT__]:null),[],`${L} vakantie: onvertaalde teksten`);
        assert.deepEqual(fouten,[],`${L} vakantie+reserve: scriptfouten`);
        await context.close();gemeten++;
      }
      /* 5. Vakantiepagina, verschillende bronnen per plaats en één plaats zonder gegevens. */
      if(breedte===390){
        const {context,page,fouten}=await nieuwePagina(browser,{primair:"fout",reserve:"ok",bronPerPlaats:i=>i<3?"visualcrossing":"weatherapi",reserveFoutPlaats:6},"/herfstvakantie/",V,{taal,breedte});
        await page.goto(base+"/herfstvakantie/",{waitUntil:"load"});
        await klaarVakantie(page);
        await page.waitForTimeout(600);
        const nm=herfst.plaatsen.map(p=>p.naam),lijst=a=>a.length>1?a.slice(0,-1).join(", ")+" "+T("en","and")+" "+a[a.length-1]:a[0];
        const verwacht=T(`Bron: Visual Crossing (${lijst(nm.slice(0,3))}) en WeatherAPI (${lijst(nm.slice(3,6))}), omdat Open-Meteo niet bereikbaar was.`,
                         `Source: Visual Crossing (${lijst(nm.slice(0,3))}) and WeatherAPI (${lijst(nm.slice(3,6))}), because Open-Meteo could not be reached.`);
        const tekst=(await tekstVan(page,"#seizoen-verwachting")).replace(/\s+/g," ");
        assert(tekst.includes(verwacht),`${L} gemengde bronnen: "${verwacht}" niet in "${tekst.slice(-300)}"`);
        assert(!tekst.includes(nm[6]+")")&&!new RegExp(`WeatherAPI \\([^)]*${nm[6]}`).test(tekst),`${L} gemengde bronnen: plaats zonder gegevens staat bij een bron`);
        const laatste=await page.$$eval("#seizoen-verwachting .seizoen-dag:first-of-type tbody tr",rs=>rs.map(r=>r.children[1].textContent.replace(/\s+/g," ").trim()));
        assert.equal(laatste[6],T("Geen gegevens","No data"),`${L} gemengde bronnen: plaats zonder gegevens toont geen "Geen gegevens" (${laatste[6]})`);
        if(en)assert.deepEqual(await page.evaluate(()=>window.__WIW_TAAL_ONTBREEKT__?[...window.__WIW_TAAL_ONTBREEKT__]:null),[],`${L} gemengde bronnen: onvertaalde teksten`);
        assert.deepEqual(fouten,[],`${L} gemengde bronnen: scriptfouten`);
        await context.close();gemeten++;
      }
      /* 6. Vakantiepagina: beide falen; link naar de eigen plaats; laden → fout → knop → herstel; dubbelklik. */
      {
        const {context,page,fouten,tel,modus}=await nieuwePagina(browser,{primair:"fout",reserve:"fout"},"/herfstvakantie/",V,{taal,breedte});
        await page.goto(base+"/herfstvakantie/",{waitUntil:"load"});
        await page.waitForSelector("#seizoen-verwachting .seizoen-opnieuw",{timeout:45000});
        assert.equal(await page.locator(".seizoen-fout").count(),1,`${L} vakantie-eindfout: melding`);
        const link=await page.evaluate(()=>{const a=document.querySelector(".seizoen-fout a");return a?{tekst:a.textContent,pad:new URL(a.href).pathname}:null;});
        assert(link&&link.pad==="/",`${L} vakantie-eindfout: link naar de eigen plaats ontbreekt`);
        assert.equal(link.tekst,T("bekijk het weer voor je eigen plaats","check the weather for your own location"),`${L} vakantie-eindfout: linktekst`);
        assert.equal((await page.request.get(base+link.pad)).status(),200,`${L} vakantie-eindfout: de link werkt niet`);
        assert((await page.locator(".seizoen-opnieuw").boundingBox()).height>=44,`${L} vakantie-eindfout: knop minstens 44px`);
        /* Toetsenbord: de link en de knop zijn bereikbaar met Tab en tonen een zichtbare focus. */
        const gefocust=[];
        for(let i=0;i<14&&gefocust.length<2;i++){
          await page.keyboard.press("Tab");
          const f=await page.evaluate(()=>{const e=document.activeElement;if(!e||!e.closest("#seizoen-verwachting"))return null;const cs=getComputedStyle(e);return {tag:e.tagName,zichtbaar:(parseFloat(cs.outlineWidth)>0&&cs.outlineStyle!=="none")||cs.boxShadow!=="none"};});
          if(f)gefocust.push(f);
        }
        assert.deepEqual(gefocust.map(f=>f.tag),["A","BUTTON"],`${L} vakantie-eindfout: toetsenbordvolgorde link → knop (${JSON.stringify(gefocust)})`);
        assert(gefocust.every(f=>f.zichtbaar),`${L} vakantie-eindfout: focus is niet zichtbaar`);
        assert.equal((await page.locator(".seizoen-opnieuw").innerText()).trim(),T("Opnieuw proberen","Try again"),`${L} vakantie-eindfout: knoptekst`);
        const voor={p:tel.primair,r:tel.reserve};
        modus.vertraging=500;
        await page.evaluate(()=>{const b=document.querySelector(".seizoen-opnieuw");b.click();b.click();});
        assert.equal(await page.locator("#seizoen-verwachting[aria-busy]").count(),1,`${L} vakantie-retry: laadstatus ontbreekt`);
        assert.equal(await page.locator(".seizoen-fout").count(),0,`${L} vakantie-retry: foutmelding blijft staan tijdens laden`);
        await page.waitForSelector("#seizoen-verwachting .seizoen-opnieuw",{timeout:45000});
        assert.equal(tel.primair-voor.p,2,`${L} vakantie-retry: dubbelklik geeft één ronde (2 pogingen), gemeten ${tel.primair-voor.p}`);
        assert.equal(tel.reserve-voor.r,herfst.plaatsen.length,`${L} vakantie-retry: één reserveronde, gemeten ${tel.reserve-voor.r}`);
        modus.primair="ok";modus.vertraging=0;
        await page.locator(".seizoen-opnieuw").click();
        await page.waitForFunction(()=>document.querySelectorAll("#seizoen-verwachting .seizoen-dag").length>0,null,{timeout:15000});
        assert.equal(await page.locator(".seizoen-fout").count(),0,`${L} vakantie-herstel: melding weg`);
        assert.equal(await page.locator(".seizoen-opnieuw").count(),0,`${L} vakantie-herstel: knop weg`);
        assert.match(await tekstVan(page,"#seizoen-verwachting"),T(/Bron: Open-Meteo\./,/Source: Open-Meteo\./),`${L} vakantie-herstel: bron is weer Open-Meteo`);
        assert.deepEqual(fouten,[],`${L} vakantie-eindfout: scriptfouten`);
        await context.close();gemeten++;
      }
    }
    console.log(`Reserve en foutstatus: ${gemeten} controles (park, overzicht, vakantie; NL/EN; 320/390/1366 px): reserve per plaats met de echte bron, 'Niet beschikbaar' en streepje, laden → fout → opnieuw → herstel zonder dubbele verzoeken, zonuren onbekend, tussenkop, compacte parktitel en taalknop op de rij van de terugknop.`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch(e=>{console.error(e);process.exit(1);});

"use strict";
/*
 * Waarschuwingen per plaats, in de echte build (eigenaar 4 oktober):
 *   - eigen waarschuwing (Assen, Drenthe): de kaart "Code geel: wind" met de
 *     officiële tekst, en niets over waarschuwingen elders;
 *   - geen eigen waarschuwing (Utrecht): alleen "Geen officiële
 *     weerwaarschuwingen voor deze locatie.", ook als er elders iets geldt;
 *   - niet te koppelen waarschuwing: de eerlijke melding "In Nederland geldt nu …
 *     kunnen we nog niet bepalen", ook in het Engels;
 *   - Engels: kop vertaald ("Yellow warning for wind"), tekst officieel Engels;
 *   - geen horizontaal scrollen, geen paginafouten, gebiedsnamen ge-escaped.
 * Met SCHERMEN=<map> worden schermafbeeldingen bewaard (licht en donker).
 */
const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const SCHERMEN=process.env.SCHERMEN||"";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const KLOK="2026-07-22T12:15:00Z",METING="2026-07-22T14:00";

function fixture(lat,lon){
  const d=bouw({temp:(u,dag)=>+(15+3*Math.sin((u-9)/24*Math.PI*2)-dag*0.2).toFixed(1),pp:()=>10,pr:()=>0,som:0});
  d.latitude=lat;d.longitude=lon;d.daily.sunshine_duration=d.daily.time.map(()=>20000);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  const nu=h.time.indexOf(METING.slice(0,14)+"00");
  d.current.time=METING;d.current.temperature_2m=h.temperature_2m[nu];d.current.apparent_temperature=h.temperature_2m[nu]-1;
  return d;
}
const morgen="2026-07-23T21:59:59+02:00";
/* Een samenvatting van niet te koppelen waarschuwingen. Bij dekking mag de app
   die nooit tonen; zonder dekking wordt het de eerlijke melding. */
const SAMENVATTING={land:"NL",landNaam:"Nederland",groepen:[{kleur:"oranje",type:"wind",gebieden:["Zeeland","Zierikzee"],meer:0},{kleur:"geel",type:"mist",gebieden:["IJsselmeer","Waddenzee","Zuid-Holland"],meer:2}]};
const DRENTHE={titel:"Code geel: wind",tekst:"Er worden zware windstoten verwacht van 75-90 km/u.",kleur:"geel",type:"wind",niveau:"geel",niveauIsOfficieel:true,
  van:"2026-07-22T12:00:00+02:00",tot:morgen,gebied:"Drenthe",plaatsSpecifiek:true,landelijk:false,scope:"gebied"};
const DRENTHE_EN=Object.assign({},DRENTHE,{tekst:"Severe gusts of 75-90 km/h are expected.",taal:"en-GB",titelIsVertaling:true});
const ASSEN="/?lat=52.993&lon=6.562&plaats=Assen&land=NL",UTRECHT="/?lat=52.091&lon=5.122&plaats=Utrecht&land=NL";
const PLAATSEN={
  assen:{pad:ASSEN,lat:52.993,lon:6.562,antwoord:{bron:"MeteoAlarm netherlands",dekking:true,plaatsSpecifiek:true,land:"NL",lijst:[DRENTHE],elders:SAMENVATTING},
    antwoordEn:{bron:"MeteoAlarm netherlands",dekking:true,plaatsSpecifiek:true,land:"NL",lijst:[DRENTHE_EN],elders:SAMENVATTING}},
  utrecht:{pad:UTRECHT,lat:52.091,lon:5.122,antwoord:{bron:"MeteoAlarm netherlands",dekking:true,plaatsSpecifiek:true,land:"NL",lijst:[],elders:SAMENVATTING}},
  onbekend:{pad:UTRECHT,lat:52.091,lon:5.122,antwoord:{bron:"MeteoAlarm netherlands",dekking:false,plaatsSpecifiek:false,land:"NL",lijst:[],reden:"geen plaats-specifieke dekking",
    elders:{land:"NL",landNaam:"Nederland",groepen:[{kleur:"geel",type:"wind",gebieden:["Drenthe","<img src=x onerror=alert(1)>"],meer:0}]}}}
};

/* Een buitenlandse locatie zonder officiële NL-tekst: de originele tekst mag niet stil worden vertaald. */
const ZONDER_NL=Object.assign({},PLAATSEN.assen,{antwoord:PLAATSEN.assen.antwoordEn});
const PORTUGESE_BRON="Aviso de vento forte. Rajadas intensas. <img src=x onerror=alert(1)>";
const PORTUGAL={pad:"/?lat=38.7223&lon=-9.1393&plaats=Lisboa&land=PT",lat:38.7223,lon:-9.1393,
  antwoord:{bron:"MeteoAlarm portugal",dekking:true,plaatsSpecifiek:true,land:"PT",lijst:[Object.assign({},DRENTHE_EN,{taal:"pt-PT",tekst:PORTUGESE_BRON,gebied:"Lisboa"})]}};

const METEO_VERTALING_NL=Object.assign({},PORTUGAL,{antwoord:{...PORTUGAL.antwoord,lijst:[Object.assign({},PORTUGAL.antwoord.lijst[0],{vertaling:{tekst:"Waarschuwing voor harde wind in Lisboa.",methode:"deepl",automatisch:true}})]}});
const FRANSE_TITEL="Alerte locale pour des vents violents";
const FRANSE_MELDING={pad:"/?lat=48.8566&lon=2.3522&plaats=Paris&land=FR",lat:48.8566,lon:2.3522,
  antwoord:{bron:"MeteoAlarm france",dekking:true,plaatsSpecifiek:true,land:"FR",
    lijst:[Object.assign({},DRENTHE_EN,{titel:FRANSE_TITEL,titelIsVertaling:false,taal:"fr-FR",
      tekst:"Rafales dangereuses possibles.",gebied:"Paris"})]}};

const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  let f=path.join(OUT,p);if(!fs.existsSync(f)&&fs.existsSync(f+".html"))f+=".html";
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,plaats,w,h,{taal,thema}={}){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel,colorScheme:thema==="donker"?"dark":"light"});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  page.on("dialog",d=>{fouten.push("dialog: "+d.message());d.dismiss();});
  if(taal)await page.addInitScript(t=>{try{localStorage.setItem("weerbriefing.taal.v1",JSON.stringify(t));}catch(_){}},taal);
  await page.addInitScript(k=>{const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;},KLOK);
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture(plaats.lat,plaats.lon)});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:30,uv_index:2},hourly:{time:[METING.slice(0,14)+"00"],grass_pollen:[4],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[1],ragweed_pollen:[0],olive_pollen:[0]}}});
    /* Zoals de echte API: met taal=en de officiële Engelse tekst van de weerdienst. */
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:u.searchParams.get("taal")==="en"&&plaats.antwoordEn?plaats.antwoordEn:plaats.antwoord});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+plaats.pad,{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:15000});
  await page.waitForFunction(()=>{const el=document.getElementById("waarschuwingen");return el&&!el.querySelector('[data-ui-warning-loading="1"]')&&(el.textContent||"").trim().length>0;},null,{timeout:15000});
  await sleep(1200);
  return {context,page,fouten};
}
const lees=page=>page.evaluate(()=>{
  const el=document.getElementById("waarschuwingen");
  return {kaarten:[...el.querySelectorAll(".waarsch h3")].map(h=>h.textContent.trim()),
    kaartTekst:[...el.querySelectorAll(".waarsch p")].map(p=>p.textContent.replace(/\s+/g," ").trim()),
    tekst:el.textContent.replace(/\s+/g," ").trim(),html:el.innerHTML,
    scroll:document.documentElement.scrollWidth-innerWidth,
    ontbreekt:[...(window.__WIW_TAAL_ONTBREEKT__||[])].filter(s=>/geldt nu|Code (geel|oranje|rood)|weerwaarschuwing/.test(s))};
});
async function scherm(page,naam){
  if(!SCHERMEN)return;
  fs.mkdirSync(SCHERMEN,{recursive:true});
  const el=page.locator("#waarschuwingen");
  await el.scrollIntoViewIfNeeded();
  const box=await el.boundingBox();
  const vp=page.viewportSize();
  await page.screenshot({path:path.join(SCHERMEN,naam+".png"),clip:{x:0,y:Math.max(0,box.y-120),width:vp.width,height:Math.min(520,box.height+240)}});
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    for(const [w,h] of [[390,844],[1440,900]]){
      for(const thema of ["licht","donker"]){
        {
          const {context,page,fouten}=await open(browser,root,PLAATSEN.assen,w,h,{thema});
          const r=await lees(page);
          assert.deepEqual(r.kaarten,["Code geel: wind"],`Assen ${w}: eigen waarschuwing voor Drenthe`);
          assert(/^Er worden zware windstoten verwacht van 75-90 km\/u\. Geldig tot morgen 21:59\.$/.test(r.kaartTekst[0]),`Assen ${w}: officiële tekst (${r.kaartTekst[0]})`);
          assert(!/Elders|Zeeland|geldt nu/.test(r.tekst),`Assen ${w}: niets over waarschuwingen elders (${r.tekst})`);
          assert(r.scroll<=1,`Assen ${w}: geen horizontaal scrollen (${r.scroll}px)`);
          assert.deepEqual(fouten,[],`Assen ${w}: geen paginafouten`);
          await scherm(page,`assen-${w}-${thema}`);
          await context.close();
        }
        {
          const {context,page,fouten}=await open(browser,root,PLAATSEN.utrecht,w,h,{thema});
          const r=await lees(page);
          assert.equal(r.tekst,"Geen officiële weerwaarschuwingen voor deze locatie.",`Utrecht ${w}: alleen de eigen status, niets van elders`);
          assert.deepEqual(fouten,[],`Utrecht ${w}: geen paginafouten`);
          await scherm(page,`utrecht-${w}-${thema}`);
          await context.close();
        }
      }
    }
    {
      const {context,page}=await open(browser,root,PLAATSEN.assen,390,844,{taal:"en"});
      const r=await lees(page);
      assert.deepEqual(r.ontbreekt,[],"Engels: niets onvertaald");
      assert.deepEqual(r.kaarten,["Yellow warning for wind"],"Engels: kop vertaald");
      assert(r.kaartTekst.length===1&&/^Severe gusts of 75-90 km\/h are expected\./.test(r.kaartTekst[0]),"Engels: officiële Engelse tekst van de weerdienst");
      assert(!/Geldig|morgen|vandaag/.test(r.kaartTekst[0]),"Engels: geldigheid vertaald ("+r.kaartTekst[0]+")");
      await scherm(page,"assen-390-engels");
      await context.close();
    }
    /* Geen Nederlandse CAP-tekst: één officiële bronzin, juist lang-attribuut en heldere disclaimer. */
    {
      const {context,page,fouten}=await open(browser,root,ZONDER_NL,390,844,{thema:"donker"});
      const r=await lees(page);
      const bron=await page.locator("#waarschuwingen .waarsch-origineel").evaluate(p=>({
        tekst:p.textContent.trim(),lang:p.getAttribute("lang"),translate:p.getAttribute("translate"),
        label:p.previousElementSibling&&p.previousElementSibling.textContent.trim()
      }));
      assert.deepEqual(r.kaarten,["Code geel: wind"],"NL fallback: kop blijft Nederlandse categorie");
      assert.equal(bron.tekst,DRENTHE_EN.tekst,"Engelse officiële tekst blijft exact");
      assert.equal(bron.lang,"en-GB","voorleessoftware krijgt de werkelijke brontaal");
      assert.equal(bron.translate,"no","officiële tekst wordt niet door de vertaallaag gewijzigd");
      assert.equal(bron.label,"Nederlandse kop: vertaling van de officiële categorie. Brontekst onvertaald.");
      assert.equal(r.tekst.split(DRENTHE_EN.tekst).length-1,1,"officiële inhoud staat één keer op de kaart");
      assert.deepEqual(fouten,[],"geen browserfouten bij ontbreken van een NL-info-blok");
      await context.close();
    }
    /* Ook Portugese CAP-brontekst blijft ongewijzigd; HTML uit de feed wordt ge-escaped. */
    for(const taal of [null,"en"]){
      const {context,page,fouten}=await open(browser,root,PORTUGAL,taal?1440:390,900,{taal});
      const r=await lees(page);
      const origineel=await page.locator("#waarschuwingen .waarsch-origineel").evaluate(p=>({
        tekst:p.textContent.trim(),lang:p.getAttribute("lang"),translate:p.getAttribute("translate"),
        label:p.previousElementSibling&&p.previousElementSibling.textContent.trim(),
        img:p.querySelector("img")!==null
      }));
      assert.equal(origineel.tekst,PORTUGESE_BRON,"Portugese officiële tekst is onaangetast");
      assert.equal(origineel.lang,"pt-PT","taal PT wordt expliciet aan de browser doorgegeven");
      assert.equal(origineel.translate,"no","niet doen alsof Portugese brontekst is vertaald");
      assert.equal(r.tekst.split(PORTUGESE_BRON).length-1,1,"geen dubbele officiële tekst");
      assert.equal(origineel.img,false,"onvertrouwde brontekst mag nooit HTML uitvoeren");
      assert(!/<img\s+src=/i.test(r.html)&&r.html.includes("&lt;img"),"originele HTML van de bron veilig ge-escaped");
      assert.equal(origineel.label,taal
        ?"Heading translated from the official warning category. Source text unchanged."
        :"Nederlandse kop: vertaling van de officiële categorie. Brontekst onvertaald.","label correct in pagina-taal");
      assert.deepEqual(fouten,[],"geen browserfouten bij buitenlandse originele brontekst");
      await context.close();
    }
    /* Een geaccepteerde vertaling is zichtbaar, maar officiële tekst slechts in details. */
    {
      const {context,page,fouten}=await open(browser,root,METEO_VERTALING_NL,390,844);
      const samenvatting=await page.locator("#waarschuwingen .waarsch").innerText();
      assert(samenvatting.includes("Automatisch vertaald (niet officieel):"),"Nederlandse tekst herkenbaar als automatische vertaling");
      assert(samenvatting.includes("Waarschuwing voor harde wind in Lisboa."),"Nederlandse vertaling direct zichtbaar");
      const bron=page.locator("#waarschuwingen .waarsch details .waarsch-origineel, #waarschuwingen .waarsch details p[translate=no]");
      assert.equal(await bron.count(),1,"officiële brontekst éénmaal in details");
      assert.equal(await bron.first().getAttribute("lang"),"pt-PT");
      assert.equal(await bron.first().textContent(),PORTUGESE_BRON);
      assert.deepEqual(fouten,[],"geen browserfouten door vertaalveld");
      await context.close();
    }
    /* Geen NL- of EN-blok beschikbaar: Frans, Spaans, Duits en Italiaans blijven origineel. */
    for(const item of [
      {taal:"fr-FR",land:"FR",stad:"Paris",lat:48.8566,lon:2.3522,tekst:"Alerte de vent fort."},
      {taal:"es-ES",land:"ES",stad:"Madrid",lat:40.4168,lon:-3.7038,tekst:"Aviso por viento fuerte."},
      {taal:"de-DE",land:"DE",stad:"Berlin",lat:52.52,lon:13.405,tekst:"Warnung vor starkem Wind."},
      {taal:"it-IT",land:"IT",stad:"Roma",lat:41.9028,lon:12.4964,tekst:"Allerta per vento forte."}
    ]){
      const plaats={pad:"/?lat="+item.lat+"&lon="+item.lon+"&plaats="+item.stad+"&land="+item.land,
        lat:item.lat,lon:item.lon,antwoord:{bron:"MeteoAlarm "+item.land.toLowerCase(),
          dekking:true,plaatsSpecifiek:true,land:item.land,
          lijst:[Object.assign({},DRENTHE_EN,{taal:item.taal,tekst:item.tekst,gebied:item.stad})]}};
      for(const taal of [null,"en"]){
        const {context,page,fouten}=await open(browser,root,plaats,taal?1440:390,900,{taal});
        const r=await lees(page);
        const bron=await page.locator("#waarschuwingen .waarsch-origineel").evaluate(p=>({
          tekst:p.textContent.trim(),lang:p.getAttribute("lang"),translate:p.getAttribute("translate"),
          label:p.previousElementSibling&&p.previousElementSibling.textContent.trim()
        }));
        assert.equal(bron.tekst,item.tekst,item.taal+": officiële tekst blijft letterlijk");
        assert.equal(bron.lang,item.taal,item.taal+": juiste taal voor schermlezers");
        assert.equal(bron.translate,"no",item.taal+": geen automatische vertaling");
        assert.equal(r.tekst.split(item.tekst).length-1,1,item.taal+": geen dubbele officiële tekst");
        assert.equal(bron.label,taal
          ?"Heading translated from the official warning category. Source text unchanged."
          :"Nederlandse kop: vertaling van de officiële categorie. Brontekst onvertaald.",
          item.taal+": uitleg in interfacetaal");
        assert.deepEqual(fouten,[],item.taal+": geen browserfouten");
        await context.close();
      }
    }
    /* Zonder herkende CAP-categorie is ook de titel officieel en onvertaald. */
    for(const taal of [null,"en"]){
      const {context,page,fouten}=await open(browser,root,FRANSE_MELDING,taal?1440:390,900,{taal});
      const kop=await page.locator("#waarschuwingen .waarsch h3").evaluate(el=>({
        text:el.textContent.trim(),lang:el.getAttribute("lang"),translate:el.getAttribute("translate")
      }));
      const label=await page.locator("#waarschuwingen .waarsch-bronlabel").innerText();
      assert.equal(kop.text,FRANSE_TITEL,"onbekende CAP-soort: originele Franse titel");
      assert.equal(kop.lang,"fr-FR","voorleessoftware leest ook de originele titel in de bron-taal");
      assert.equal(kop.translate,"no","niet-gematchte officiële titel niet automatisch vertalen");
      assert.equal(label,taal?"Official source text (not translated):":"Officiële brontekst (niet vertaald):",
        "geen categorievertaalclaim bij officiële Franse titel");
      assert.deepEqual(fouten,[],"geen browserfouten voor originele CAP-titel");
      await context.close();
    }
    {
      const {context,page,fouten}=await open(browser,root,PLAATSEN.onbekend,390,844);
      const r=await lees(page);
      assert(/^In Nederland geldt nu code geel voor wind \(Drenthe, .+\)\. Of dit ook voor deze plaats geldt, kunnen we nog niet bepalen\.$/.test(r.tekst),"niet te koppelen: eerlijke melding ("+r.tekst+")");
      assert(!/<img/i.test(r.html)&&/&lt;img/.test(r.html),"gebiedsnamen worden ge-escaped");
      assert.deepEqual(fouten,[],"geen script uit gebiedsnamen");
      await context.close();
    }
    {
      const {context,page}=await open(browser,root,PLAATSEN.onbekend,390,844,{taal:"en"});
      const r=await lees(page);
      assert(/^In the Netherlands: yellow warning for wind \(Drenthe, .+\)\. We cannot yet tell whether this applies to this place\.$/.test(r.tekst),"niet te koppelen, Engels ("+r.tekst+")");
      await context.close();
    }
    console.log("Waarschuwing per plaats (browser): eigen waarschuwing zonder regel elders, geen eigen waarschuwing alleen eigen status, eerlijke melding bij niet te koppelen (Nederlands en Engels), licht en donker, 390 en 1440 px, escaping geslaagd.");
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

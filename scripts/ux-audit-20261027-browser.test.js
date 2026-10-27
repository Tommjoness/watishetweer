"use strict";

/* Vier bevindingen uit de onafhankelijke UX/UI-audit van 27 oktober 2026, op het
   finale artifact met de echte runtime:
   - F1: Escape sluit de grafiektooltip zonder dat de focus of het gekozen uur
     verdwijnt; een volgende pijltoets, Enter of spatie opent hem weer. Het
     tabelalternatief blijft aanwezig. Nederlands en Engels, licht en donker.
   - F2: de Rijksoverheid-bron op iedere vakantiepagina blijft in het Engels een
     echte, focusbare link met dezelfde bestemming als in het Nederlands.
   - F3: de kerstvakantietekst noemt de data vastgesteld (basis- en voortgezet
     onderwijs mogen alleen in bijzondere situaties afwijken; mbo en hoger
     onderwijs bepalen zelf), de voorjaarsvakantie blijft adviesdata.
   - F4: een zoekterm die de bezoeker typt terwijl een plaats nog laadt, wordt
     niet vervangen door de plaatsnaam van die lopende laadronde; zonder eigen
     invoer (of na het verlaten van het veld) wordt de plaatsnaam gewoon gezet.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");
const {SEIZOENSPAGINAS}=require("./seizoenspagina.config.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const KLOK="2026-07-22T15:39:00Z",METING="2026-07-22T17:30";

function fixture(lat,lon){
  const d=bouw({temp:(u,dag)=>+(15.5+4.5*Math.sin((u-9)/24*Math.PI*2)-dag*0.4).toFixed(1),pp:(u,dag)=>dag===0&&u>=19&&u<=23?[40,70,80,65,30][u-19]:8,pr:(u,dag)=>dag===0&&u>=19&&u<=23?[0.2,1.4,2.1,0.8,0.1][u-19]:0,wc:(u,dag)=>u<11?1:u<17?2:3,som:2});
  d.latitude=lat;d.longitude=lon;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,14)+"00");}
  const nu=h.time.indexOf(METING.slice(0,14)+"00");
  d.current.time=METING;d.current.temperature_2m=h.temperature_2m[nu];d.current.apparent_temperature=h.temperature_2m[nu]-1;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,pad,{w=1363,h=936,taal="nl",schema="light",vertraging=0}={}){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:mobiel?2:1,locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",colorScheme:schema,serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(([k,t])=>{
    const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;
    if(t==="en")try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(x){}
  },[KLOK,taal]);
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast"){
      if(vertraging)await sleep(vertraging);
      const la=+(u.searchParams.get("latitude")||52.09),lo=+(u.searchParams.get("longitude")||5.12);
      return r.fulfill({json:fixture(la,lo)});
    }
    if(u.hostname==="geocoding-api.open-meteo.com")return r.fulfill({json:{results:[{name:"Tokio",latitude:35.6895,longitude:139.69171,country_code:"JP",country:"Japan",admin1:"Tokio",feature_code:"PPLC"}]}});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:[METING.slice(0,14)+"00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+pad,{waitUntil:"domcontentloaded"});
  return {context,page,fouten};
}
async function wachtOpWeer(page){
  await page.waitForSelector("#app",{state:"visible",timeout:20000});
  await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelector("#chart #hit")&&document.querySelectorAll("#chart circle").length>0,null,{timeout:20000});
  await sleep(1200);
}

/* F1: Escape sluit de tooltip, focus en gekozen uur blijven. */
const tooltipStaat=page=>page.evaluate(()=>{
  const g=document.getElementById("scrub"),hit=document.getElementById("hit"),kop=g&&g.querySelector("text");
  return {open:!!g&&g.style.display!=="none"&&getComputedStyle(g).display!=="none",focus:document.activeElement===hit,idx:hit.dataset.keyboardIndex,nu:hit.getAttribute("aria-valuenow"),tekst:hit.getAttribute("aria-valuetext"),kop:kop?kop.textContent.trim().slice(0,5):""};
});
async function testTooltipEscape(browser,root){
  let n=0;
  for(const taal of ["nl","en"])for(const schema of ["light","dark"])for(const w of [1363,390]){
    const L=`${taal} ${schema} ${w}px`;
    const {context,page,fouten}=await open(browser,root,"/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL",{taal,schema,w});
    try{
      await wachtOpWeer(page);
      assert(await page.evaluate(()=>!!document.getElementById("wiw-hour-table")),L+": het tabelalternatief ontbreekt");
      await page.evaluate(()=>document.getElementById("hit").focus());await sleep(250);
      const a=await tooltipStaat(page);
      assert(a.open&&a.focus,L+": de tooltip opent niet bij toetsenbordfocus ("+JSON.stringify(a)+")");
      await page.keyboard.press("ArrowRight");await sleep(200);
      const b=await tooltipStaat(page);
      assert(b.open&&b.idx==="1"&&b.nu==="2",L+": ArrowRight kiest het volgende uur niet ("+JSON.stringify(b)+")");
      await page.keyboard.press("Escape");await sleep(250);
      const c=await tooltipStaat(page);
      assert(!c.open,L+": Escape sluit de tooltip niet ("+JSON.stringify(c)+")");
      assert(c.focus,L+": de focus verlaat de grafiek na Escape");
      assert.equal(c.idx,b.idx,L+": het gekozen uur verandert door Escape");
      assert.equal(c.nu,b.nu,L+": aria-valuenow verandert door Escape");
      assert.equal(c.tekst,b.tekst,L+": aria-valuetext verandert door Escape");
      await page.keyboard.press("Escape");await sleep(150);
      const d=await tooltipStaat(page);
      assert(!d.open&&d.focus&&d.idx===b.idx,L+": een tweede Escape verstoort de toestand ("+JSON.stringify(d)+")");
      /* Een bewuste volgende interactie opent hem weer, vanaf het gekozen uur. */
      await page.keyboard.press("ArrowRight");await sleep(200);
      const e=await tooltipStaat(page);
      assert(e.open&&e.idx==="2"&&e.nu==="3"&&e.focus,L+": ArrowRight na Escape opent de tooltip niet bij het volgende uur ("+JSON.stringify(e)+")");
      await page.keyboard.press("Escape");await sleep(150);
      await page.keyboard.press("Enter");await sleep(200);
      const f=await tooltipStaat(page);
      assert(f.open&&f.idx==="2"&&f.focus,L+": Enter na Escape opent de tooltip niet bij hetzelfde uur ("+JSON.stringify(f)+")");
      await page.keyboard.press("Escape");await sleep(150);
      await page.keyboard.press("End");await sleep(200);
      const g=await tooltipStaat(page);
      assert(g.open&&Number(g.idx)>2&&g.focus,L+": End na Escape opent de tooltip niet ("+JSON.stringify(g)+")");
      /* Tab uit de grafiek sluit hem nog steeds. */
      await page.keyboard.press("Tab");await sleep(200);
      assert(!(await tooltipStaat(page)).open,L+": Tab uit de grafiek laat de tooltip staan");
      assert.deepEqual(fouten,[],L+": runtimefouten "+fouten.join(" | "));
      n++;
    }finally{await context.close();}
  }
  console.log("F1 grafiektooltip: Escape sluit zonder focus- of uurverlies, pijltoets/Enter/End openen opnieuw, Tab sluit ("+n+" combinaties).");
}

/* F2 en F3: bronlink en vakantietekst op alle vakantiepagina's. */
async function testVakantiebron(browser,root){
  const vakantie=SEIZOENSPAGINAS.filter(p=>p.soort==="vakantie");
  assert(vakantie.length>=5,"minstens vijf vakantiepagina's verwacht, gevonden "+vakantie.length);
  let n=0;
  for(const cfg of vakantie)for(const schema of ["light","dark"]){
    const href=cfg.uitleg.bron.url,pad="/"+cfg.slug+"/";
    const staat={};
    for(const taal of ["nl","en"]){
      const L=`${cfg.slug} ${taal} ${schema}`;
      const {context,page,fouten}=await open(browser,root,pad,{taal,schema,w:taal==="nl"?1363:390});
      try{
        await page.waitForSelector("p.klein a[href^='https://www.rijksoverheid.nl/']",{timeout:15000});
        await sleep(1500);
        const r=await page.evaluate(()=>{
          const p=[...document.querySelectorAll("p.klein")].find(x=>x.querySelector("a[href^='https://www.rijksoverheid.nl/']"));
          const a=p&&p.querySelector("a[href^='https://www.rijksoverheid.nl/']");
          if(a)a.focus();
          /* De uitleg: de alinea's tussen de kop "Wanneer is de …?" en de bronregel. */
          const uitleg=[];
          for(let e=p&&p.previousElementSibling;e&&e.tagName==="P";e=e.previousElementSibling)uitleg.unshift(e.textContent.trim().replace(/\s+/g," "));
          return {lang:document.documentElement.lang,bron:p?p.textContent.trim().replace(/\s+/g," "):"",href:a?a.getAttribute("href"):null,tekst:a?a.textContent.trim():"",focus:!!a&&document.activeElement===a,zichtbaar:!!a&&a.getClientRects().length>0,uitleg,
            ontbreekt:[...(window.__WIW_TAAL_ONTBREEKT__||[])].filter(t=>/vakantie|Mbo|hogescholen|Rijksoverheid/i.test(t))};
        });
        assert.equal(r.href,href,L+": de bronlink wijst niet naar dezelfde bestemming");
        assert(r.zichtbaar&&r.focus,L+": de bronlink is niet zichtbaar of niet focusbaar");
        assert.equal(r.tekst,"Rijksoverheid",L+": linktekst");
        if(taal==="en"){
          assert(/^Source: Dutch government \(Rijksoverheid\)$/.test(r.bron),L+": Engelse bronregel is \""+r.bron+"\"");
          assert.equal(r.lang,"en-GB",L+": paginataal");
        }else assert.equal(r.bron,"Bron: Rijksoverheid",L+": Nederlandse bronregel");
        assert.deepEqual(r.ontbreekt,[],L+": onvertaalde tekst gemeld: "+JSON.stringify(r.ontbreekt));
        assert.deepEqual(fouten,[],L+": runtimefouten "+fouten.join(" | "));
        const alinea=cfg.uitleg.alineas[0];
        staat[taal]=r;
        if(cfg.slug==="kerstvakantie"){
          const tekst=taal==="nl"?r.uitleg.join(" "):r.uitleg.join(" ");
          if(taal==="nl"){
            assert(!/kunnen ervan afwijken|scholen mogen daarvan afwijken/.test(tekst),L+": de kerstvakantietekst suggereert dat de data adviesdata zijn");
            assert(/vastgestelde data/.test(tekst)&&/basisonderwijs en voortgezet onderwijs/.test(tekst)&&/alleen in bijzondere situaties/.test(tekst)&&/Mbo-instellingen, hogescholen en universiteiten bepalen hun vakantiedata zelf/.test(tekst),L+": de kerstvakantietekst mist de vastgestelde data of de schooltypen ("+tekst+")");
          }else{
            assert(!/schools may deviate|kunnen ervan/.test(tekst),L+": de Engelse kerstvakantietekst suggereert adviesdata");
            assert(/fixed dates/.test(tekst)&&/primary and secondary education/.test(tekst)&&/only deviate from them in special circumstances/.test(tekst)&&/Vocational colleges \(mbo\), universities of applied sciences and universities set their own holiday dates/.test(tekst),L+": de Engelse kerstvakantietekst mist de vastgestelde data of de schooltypen ("+tekst+")");
          }
        }
        if(cfg.slug==="voorjaarsvakantie"||cfg.slug==="herfstvakantie"){
          const tekst=r.uitleg.join(" ");
          assert(taal==="nl"?/adviesdata/.test(tekst)&&/mogen daarvan afwijken/.test(tekst):/recommended|advice/i.test(tekst),L+": de adviesdata-uitleg is veranderd ("+tekst+")");
        }
        assert(alinea&&alinea.length>20,L+": configuratie zonder uitlegalinea");
        n++;
      }finally{await context.close();}
    }
  }
  console.log("F2/F3 vakantiepagina's: Rijksoverheid-bron blijft een focusbare link met dezelfde bestemming in NL en EN; kerst vastgesteld, voorjaar en herfst adviesdata ("+n+" combinaties).");
}

/* F4: eigen invoer tijdens een lopende laadronde blijft staan. */
async function testZoekinvoer(browser,root){
  const PAD="/?lat=40.714&lon=-74.006&plaats=New+York&land=US";
  const lees=page=>page.evaluate(()=>({q:document.getElementById("q").value,opties:[...document.querySelectorAll("#res [role=option]")].map(e=>e.dataset.nm),open:document.getElementById("res").classList.contains("on"),focus:document.activeElement.id,plaats:(document.getElementById("place")||{}).textContent||""}));
  for(const taal of ["nl","en"]){
    const L="zoekveld "+taal;
    /* 1. Typen terwijl de plaats nog laadt: de term blijft, de suggesties horen erbij. */
    {
      const {context,page,fouten}=await open(browser,root,PAD,{taal,vertraging:2500});
      try{
        await sleep(400);
        await page.click("#q");await page.keyboard.press("Control+A");await page.keyboard.type("Tokyo",{delay:25});
        await page.waitForSelector("#res.on",{timeout:8000});
        await wachtOpWeer(page);await sleep(2800);
        const r=await lees(page);
        assert.equal(r.q,"Tokyo",L+": de ingetypte zoekterm is vervangen door \""+r.q+"\" ("+JSON.stringify(r)+")");
        assert.deepEqual(r.opties,["Tokio"],L+": de suggesties horen niet bij de ingetypte term");
        assert(r.open&&r.focus==="q",L+": suggesties of focus verloren");
        assert(/New York/.test(r.plaats),L+": het weer hoort bij de eerder gekozen plaats ("+r.plaats+")");
        /* Een gekozen suggestie zet de plaatsnaam wel gewoon. */
        await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");
        await page.waitForFunction(()=>/Tokio/.test((document.getElementById("place")||{}).textContent||""),null,{timeout:20000});
        await sleep(3000);
        const k=await lees(page);
        assert.equal(k.q,"Tokio",L+": na het kiezen van een suggestie staat er niet de plaatsnaam ("+JSON.stringify(k)+")");
        assert.deepEqual(fouten,[],L+": runtimefouten "+fouten.join(" | "));
      }finally{await context.close();}
    }
    /* 2. Typen en het veld verlaten vóór de laadronde klaar is: de plaatsnaam komt terug. */
    {
      const {context,page}=await open(browser,root,PAD,{taal,vertraging:2500});
      try{
        await sleep(400);
        await page.click("#q");await page.keyboard.press("Control+A");await page.keyboard.type("Tokyo",{delay:25});
        await page.waitForSelector("#res.on",{timeout:8000});
        await page.evaluate(()=>document.getElementById("q").blur());
        await wachtOpWeer(page);await sleep(2800);
        const r=await lees(page);
        assert.equal(r.q,"New York",L+": na het verlaten van het veld staat niet de plaatsnaam ("+JSON.stringify(r)+")");
      }finally{await context.close();}
    }
    /* 3. Zonder eigen invoer: de plaatsnaam van de laadronde staat in het veld, ook met focus. */
    {
      const {context,page}=await open(browser,root,PAD,{taal,vertraging:1500});
      try{
        await sleep(300);
        await page.click("#q");
        await wachtOpWeer(page);await sleep(2000);
        const r=await lees(page);
        assert.equal(r.q,"New York",L+": zonder eigen invoer staat er niet de plaatsnaam ("+JSON.stringify(r)+")");
      }finally{await context.close();}
    }
  }
  console.log("F4 zoekveld: eigen invoer tijdens het laden blijft staan, suggestie kiezen en het veld verlaten zetten de plaatsnaam weer (NL en EN).");
}

server.listen(0,"127.0.0.1",async()=>{
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    await testTooltipEscape(browser,root);
    await testVakantiebron(browser,root);
    await testZoekinvoer(browser,root);
    console.log("UX-audit 27 oktober 2026: F1, F2, F3 en F4 OK.");
  }catch(e){console.error(e);process.exitCode=1;}
  finally{await browser.close();server.close();}
});

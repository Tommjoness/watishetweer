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

async function open(browser,root,pad,{w=1363,h=936,taal="nl",schema="light",houd=false}={}){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:mobiel?2:1,locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",colorScheme:schema,serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  /* Met houd=true wacht iedere weerverwachting tot de test laat() aanroept: de laadronde loopt dan precies zolang de test
     wil, zonder vaste vertraging die op een trage runner te kort of te lang kan zijn. */
  let laat=()=>{};const poort=houd?new Promise(r=>{laat=r;}):null;
  /* Alle schrijfacties van de app op #q.value, om ook tussentijdse waarden te kunnen toetsen. */
  await page.addInitScript(()=>{
    window.__qw=[];const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value");
    Object.defineProperty(HTMLInputElement.prototype,"value",{configurable:true,get:d.get,set(v){if(this.id==="q")window.__qw.push(String(v));d.set.call(this,v);}});
  });
  await page.addInitScript(([k,t])=>{
    const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;
    if(t==="en")try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(x){}
  },[KLOK,taal]);
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast"){
      if(poort)await poort;
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
  return {context,page,fouten,laat:()=>laat()};
}
/* Wacht tot er `stilte` ms niets in de DOM verandert (met een bovengrens), in plaats van een vaste pauze. */
const rustig=(page,stilte=250,max=4000)=>page.evaluate(([s,m])=>new Promise(res=>{
  let t=setTimeout(klaar,s);const stop=setTimeout(klaar,m);
  const mo=new MutationObserver(()=>{clearTimeout(t);t=setTimeout(klaar,s);});
  mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true});
  function klaar(){mo.disconnect();clearTimeout(t);clearTimeout(stop);res();}
}),[stilte,max]);
/* Na twee gerenderde frames: alles wat synchroon of in de eerstvolgende frame gebeurt is dan uitgevoerd. */
const naPaint=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function wachtOpWeer(page){
  await page.waitForSelector("#app",{state:"visible",timeout:20000});
  await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelector("#chart #hit")&&document.querySelectorAll("#chart circle").length>0,null,{timeout:20000});
  await rustig(page,250);
}

/* F1: Escape sluit de tooltip, focus en gekozen uur blijven. */
/* Een voorwaarde die niet komt, geeft dezelfde beschrijvende assertiemelding (met de toestand erbij) als een directe controle. */
const eis=async(wacht,melding,staat)=>{try{await wacht();}catch(e){assert.fail(melding+" ("+JSON.stringify(await staat())+")");}};
const tooltipOpen=(page,idx,melding)=>eis(()=>page.waitForFunction(i=>{const g=document.getElementById("scrub"),h=document.getElementById("hit");return !!g&&g.style.display!=="none"&&(i===undefined||h.dataset.keyboardIndex===String(i));},idx,{timeout:5000}),melding,()=>tooltipStaat(page));
const tooltipDicht=(page,melding)=>eis(()=>page.waitForFunction(()=>{const g=document.getElementById("scrub");return !!g&&g.style.display==="none";},null,{timeout:5000}),melding,()=>tooltipStaat(page));
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
      await page.evaluate(()=>document.getElementById("hit").focus());await tooltipOpen(page,undefined,L+": de tooltip opent niet bij toetsenbordfocus");
      const a=await tooltipStaat(page);
      assert(a.open&&a.focus,L+": de tooltip opent niet bij toetsenbordfocus ("+JSON.stringify(a)+")");
      await page.keyboard.press("ArrowRight");await tooltipOpen(page,1,L+": ArrowRight kiest het volgende uur niet");
      const b=await tooltipStaat(page);
      assert(b.open&&b.idx==="1"&&b.nu==="2",L+": ArrowRight kiest het volgende uur niet ("+JSON.stringify(b)+")");
      await page.keyboard.press("Escape");await tooltipDicht(page,L+": Escape sluit de tooltip niet");await naPaint(page);
      const c=await tooltipStaat(page);
      assert(!c.open,L+": Escape sluit de tooltip niet ("+JSON.stringify(c)+")");
      assert(c.focus,L+": de focus verlaat de grafiek na Escape");
      assert.equal(c.idx,b.idx,L+": het gekozen uur verandert door Escape");
      assert.equal(c.nu,b.nu,L+": aria-valuenow verandert door Escape");
      assert.equal(c.tekst,b.tekst,L+": aria-valuetext verandert door Escape");
      await page.keyboard.press("Escape");await naPaint(page);
      const d=await tooltipStaat(page);
      assert(!d.open&&d.focus&&d.idx===b.idx,L+": een tweede Escape verstoort de toestand ("+JSON.stringify(d)+")");
      /* Een bewuste volgende interactie opent hem weer, vanaf het gekozen uur. */
      await page.keyboard.press("ArrowRight");await tooltipOpen(page,2,L+": ArrowRight na Escape opent de tooltip niet bij het volgende uur");
      const e=await tooltipStaat(page);
      assert(e.open&&e.idx==="2"&&e.nu==="3"&&e.focus,L+": ArrowRight na Escape opent de tooltip niet bij het volgende uur ("+JSON.stringify(e)+")");
      await page.keyboard.press("Escape");await tooltipDicht(page,L+": Escape sluit de tooltip niet (na ArrowRight)");
      await page.keyboard.press("Enter");await tooltipOpen(page,2,L+": Enter na Escape opent de tooltip niet bij hetzelfde uur");
      const f=await tooltipStaat(page);
      assert(f.open&&f.idx==="2"&&f.focus,L+": Enter na Escape opent de tooltip niet bij hetzelfde uur ("+JSON.stringify(f)+")");
      await page.keyboard.press("Escape");await tooltipDicht(page,L+": Escape sluit de tooltip niet (na Enter)");
      await page.keyboard.press("End");await eis(()=>page.waitForFunction(()=>{const g=document.getElementById("scrub"),h=document.getElementById("hit");return g.style.display!=="none"&&Number(h.dataset.keyboardIndex)>2;},null,{timeout:5000}),L+": End na Escape opent de tooltip niet",()=>tooltipStaat(page));
      const g=await tooltipStaat(page);
      assert(g.open&&Number(g.idx)>2&&g.focus,L+": End na Escape opent de tooltip niet ("+JSON.stringify(g)+")");
      /* Tab uit de grafiek sluit hem nog steeds. */
      await page.keyboard.press("Tab");await tooltipDicht(page,L+": Tab uit de grafiek laat de tooltip staan");
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
        await eis(()=>page.waitForSelector("p.klein a[href^='https://www.rijksoverheid.nl/']",{timeout:15000}),L+": de Rijksoverheid-bronlink ontbreekt",()=>page.evaluate(()=>({bron:(document.querySelector("p.klein")||{}).textContent||null,lang:document.documentElement.lang})));
        if(taal==="en")await page.waitForSelector("html[data-taal-klaar]",{state:"attached",timeout:15000});
        await rustig(page,250);
        const r=await page.evaluate(()=>{
          const p=[...document.querySelectorAll("p.klein")].find(x=>x.querySelector("a[href^='https://www.rijksoverheid.nl/']"));
          const a=p&&p.querySelector("a[href^='https://www.rijksoverheid.nl/']");
          if(a)a.focus();
          /* De uitleg: de alinea's direct na de kop "Wanneer is de …?" (Engels: "When is the …?"). */
          const uitleg=[],kop=[...document.querySelectorAll("h2")].find(x=>/^(Wanneer is|When is)/.test(x.textContent.trim()));
          for(let e=kop&&kop.nextElementSibling;e&&e.tagName==="P";e=e.nextElementSibling)uitleg.push(e.textContent.trim().replace(/\s+/g," "));
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
  const lees=page=>page.evaluate(()=>({q:document.getElementById("q").value,opties:[...document.querySelectorAll("#res [role=option]")].map(e=>e.dataset.nm),open:document.getElementById("res").classList.contains("on"),focus:document.activeElement.id,plaats:(document.getElementById("place")||{}).textContent||"",schrijf:window.__qw.slice()}));
  /* De startcode van de pagina heeft de plaatsnaam in het veld gezet en de eerste laadronde gestart (dan houdt de poort de verwachting vast). */
  const wachtOpStart=page=>page.waitForFunction(()=>window.__qw&&window.__qw.length>=1,null,{timeout:15000});
  /* De laadronde voor `label` is afgerond: de gegevens staan er en de identiteit is omgezet (S.label wisselt pas bij succes). */
  const wachtOpLaad=async(page,label)=>{
    await page.waitForFunction(l=>typeof S!=="undefined"&&!!S.d&&S.label===l&&document.getElementById("app").style.display!=="none",label,{timeout:20000});
    await rustig(page,200);
  };
  const typTokyo=async page=>{
    await wachtOpStart(page);
    await page.click("#q");await page.keyboard.press("Control+A");await page.keyboard.type("Tokyo",{delay:25});
    await page.waitForSelector("#res.on",{timeout:8000});
  };
  /* Typ "Tokyo" terwijl de plaats nog laadt, laat de laadronde dan eindigen terwijl het veld focus houdt. */
  const typTijdensLaden=async(page,laat)=>{
    await typTokyo(page);
    laat();
    await wachtOpLaad(page,"New York");
  };
  for(const taal of ["nl","en"]){
    const L="zoekveld "+taal;
    /* 1. Typen terwijl de plaats nog laadt: de term blijft, de suggesties horen erbij. */
    {
      const {context,page,fouten,laat}=await open(browser,root,PAD,{taal,houd:true});
      try{
        await typTijdensLaden(page,laat);
        const r=await lees(page);
        assert.equal(r.q,"Tokyo",L+": de ingetypte zoekterm is vervangen door \""+r.q+"\" ("+JSON.stringify(r)+")");
        assert.deepEqual(r.opties,["Tokio"],L+": de suggesties horen niet bij de ingetypte term");
        assert(r.open&&r.focus==="q",L+": suggesties of focus verloren");
        assert(/New York/.test(r.plaats),L+": het weer hoort bij de eerder gekozen plaats ("+r.plaats+")");
        /* Een gekozen suggestie zet de plaatsnaam wel gewoon. */
        await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");
        await wachtOpLaad(page,"Tokio");
        const k=await lees(page);
        assert.equal(k.q,"Tokio",L+": na het kiezen van een suggestie staat er niet de plaatsnaam ("+JSON.stringify(k)+")");
        assert.deepEqual(fouten,[],L+": runtimefouten "+fouten.join(" | "));
      }finally{await context.close();}
    }
    /* 2. Typen en het veld verlaten vóór de laadronde klaar is: de plaatsnaam komt terug. */
    {
      const {context,page,laat}=await open(browser,root,PAD,{taal,houd:true});
      try{
        await typTokyo(page);
        await page.evaluate(()=>document.getElementById("q").blur());
        laat();
        await wachtOpLaad(page,"New York");
        const r=await lees(page);
        assert.equal(r.q,"New York",L+": na het verlaten van het veld staat niet de plaatsnaam ("+JSON.stringify(r)+")");
      }finally{await context.close();}
    }
    /* 3. Zonder eigen invoer: de plaatsnaam van de laadronde staat in het veld, ook met focus. */
    {
      const {context,page,laat}=await open(browser,root,PAD,{taal,houd:true});
      try{
        await wachtOpStart(page);
        await page.click("#q");
        laat();
        await wachtOpLaad(page,"New York");
        const r=await lees(page);
        assert.equal(r.q,"New York",L+": zonder eigen invoer staat er niet de plaatsnaam ("+JSON.stringify(r)+")");
      }finally{await context.close();}
    }
    /* 4. Omgekeerde volgorde: de laadronde is klaar terwijl het veld nog focus heeft (de term blijft), daarna wordt het veld
          verlaten zonder suggestie te kiezen. Veld en getoonde plaats zijn dan weer consistent, de suggesties zijn weg. */
    for(const [naam,verlaat] of [["Tab",p=>p.keyboard.press("Tab")],["klik naast het veld",p=>p.mouse.click(700,900)],["blur",p=>p.evaluate(()=>document.getElementById("q").blur())]]){
      const {context,page,fouten,laat}=await open(browser,root,PAD,{taal,houd:true});
      try{
        await typTijdensLaden(page,laat);
        const voor=await lees(page);
        assert.equal(voor.q,"Tokyo",L+" ("+naam+"): de term blijft staan zolang het veld focus heeft ("+JSON.stringify(voor)+")");
        assert(voor.focus==="q"&&voor.open&&/New York/.test(voor.plaats),L+" ("+naam+"): focus, suggesties of getoonde plaats vóór het verlaten kloppen niet");
        await verlaat(page);await naPaint(page);
        const na=await lees(page);
        assert.equal(na.q,"New York",L+" ("+naam+"): na het verlaten staat het veld niet op de getoonde plaats ("+JSON.stringify(na)+")");
        assert(/New York/.test(na.plaats),L+" ("+naam+"): de getoonde plaats is veranderd ("+na.plaats+")");
        assert(!na.open&&na.opties.length===0,L+" ("+naam+"): de suggesties bij de oude invoer staan er nog ("+JSON.stringify(na)+")");
        /* Er volgt niets meer: precies één herstelschrijfactie, en geen latere wijziging. */
        await rustig(page,300);
        const laatst=await lees(page);
        assert.equal(laatst.q,"New York",L+" ("+naam+"): het veld verandert later nog");
        assert.deepEqual(laatst.schrijf.slice(voor.schrijf.length),["New York"],L+" ("+naam+"): onverwachte schrijfacties op het zoekveld na het verlaten: "+JSON.stringify(laatst.schrijf.slice(voor.schrijf.length)));
        assert.deepEqual(fouten,[],L+": runtimefouten "+fouten.join(" | "));
      }finally{await context.close();}
    }
    /* 5. Muisklik op een suggestie nadat de laadronde klaar is: het veld toont nooit tussendoor de oude plaats. */
    {
      const {context,page,fouten,laat}=await open(browser,root,PAD,{taal,houd:true});
      try{
        await typTijdensLaden(page,laat);
        const voor=await lees(page);
        await page.click("#res [role=option]");
        await wachtOpLaad(page,"Tokio");
        const na=await lees(page);
        assert.equal(na.q,"Tokio",L+": na een muisklik op een suggestie staat er niet de plaatsnaam ("+JSON.stringify(na)+")");
        assert(/Tokio/.test(na.plaats),L+": de getoonde plaats is niet de gekozen plaats");
        assert(!na.schrijf.slice(voor.schrijf.length).includes("New York")||na.schrijf.slice(voor.schrijf.length).indexOf("Tokio")<na.schrijf.slice(voor.schrijf.length).indexOf("New York"),L+": het veld toonde na de klik eerst de oude plaats ("+JSON.stringify(na.schrijf.slice(voor.schrijf.length))+")");
        assert.deepEqual(fouten,[],L+": runtimefouten "+fouten.join(" | "));
      }finally{await context.close();}
    }
    /* 6. Gewoon typen over het einde van een laadronde heen: geen teken gaat verloren of wordt vervangen. De laadronde eindigt
          precies tussen twee toetsaanslagen; de app schrijft in de tussentijd niets in het veld. */
    {
      const {context,page,fouten,laat}=await open(browser,root,PAD,{taal,houd:true});
      try{
        await wachtOpStart(page);
        await page.click("#q");await page.keyboard.press("Control+A");
        await page.keyboard.type("Ams",{delay:40});
        const voor=await lees(page);
        laat();
        await wachtOpLaad(page,"New York");
        await page.keyboard.type("terdam",{delay:40});
        const r=await lees(page);
        assert.equal(r.q,"Amsterdam",L+": tijdens het typen over het einde van een laadronde ging invoer verloren ("+JSON.stringify(r)+")");
        assert.deepEqual(r.schrijf.slice(voor.schrijf.length),[],L+": de app schreef in het zoekveld terwijl de bezoeker typte: "+JSON.stringify(r.schrijf.slice(voor.schrijf.length)));
        await rustig(page,250);
        assert.equal((await lees(page)).q,"Amsterdam",L+": invoer veranderde nadat de laadronde klaar was");
        assert.deepEqual(fouten,[],L+": runtimefouten "+fouten.join(" | "));
      }finally{await context.close();}
    }
  }
  console.log("F4 zoekveld: eigen invoer tijdens het laden blijft staan; daarna het veld verlaten (Tab, klik, blur) herstelt veld en suggesties; suggestie kiezen (toetsenbord en muis) en normaal typen blijven ongestoord (NL en EN).");
}

server.listen(0,"127.0.0.1",async()=>{
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    const tijd=async(naam,f)=>{const t=Date.now();await f();console.log("  duur "+naam+": "+((Date.now()-t)/1000).toFixed(1)+" s");};
    await tijd("F1",()=>testTooltipEscape(browser,root));
    await tijd("F2/F3",()=>testVakantiebron(browser,root));
    await tijd("F4",()=>testZoekinvoer(browser,root));
    console.log("UX-audit 27 oktober 2026: F1, F2, F3 en F4 OK.");
  }catch(e){console.error(e);process.exitCode=1;}
  finally{await browser.close();server.close();}
});

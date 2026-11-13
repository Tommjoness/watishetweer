"use strict";

/* Neerslagtegel ("Neerslag komend uur"), alle breedtes (320 t/m 1366 px), Nederlands licht en Engels donker.
   Contract (zie scripts/q1-precip-performance.js neerslagTegelInhoud en neerslagkans-policy-v3.js):
   - elke geldige toestand toont een hoofdwaarde en een passende toelichting, ook op mobiel en tablet (tot en met 900 px) naast een sleutel;
     zonder bruikbare gegevens staat er '–' met "Neerslaggegevens niet beschikbaar.";
   - 0% is 'Droog' ("Geen neerslag verwacht."), 1 t/m 9% toont het percentage zelf met de zeer-kleine-kansregel, daarna kleine/mogelijke/
     grote/zeer grote kans; een meetbare hoeveelheid (vanaf 0,1 mm) staat erbij; een tegenstrijdige 0% met hoeveelheid is 'Onzeker';
     ongeldige kansen (negatief, boven 100) zijn geen gegevens en nooit stil 0%;
   - KNMI-nowcast: verwachte hoeveelheid zonder modelkans ("1,5 mm" of "<0,1 mm" bij enkele druppels), nooit 'Droog'; actuele radar toont
     'Het regent nu' enz.; een verse droge meting laat een hoge modelkans staan (aparte bronnen);
   A. (in-pagina toestandswissels) alle 101 gehele percentages op 320, 390 en 1366 px en een reeks grenswaarden/hoeveelheden/ongeldige
      kansen op alle breedten: waarde, toelichting (NL en EN), kop, sleutel, geen afkapping, geen overlap met de naburige tegel, geen
      horizontale scroll, toegankelijkheidsboom;
   B. koude laad met echte fixtures (ook KNMI-payloads en 1,5 s vertraagde neerslagdata): placeholder (&nbsp;) of lege toelichting is nooit
      zichtbaar; layout-shift binnen het CLS-budget (< 0,1, zoals browser-mobile-cls-budget); de uiteindelijke toestand klopt;
   C. wisselen van toestand na het laden: geen verouderde toelichting, sleutel of toegankelijke naam; tegelhoogte per toestand stabiel;
   D. toegankelijkheid: toelichting staat precies één keer in de toegankelijkheidsboom en de waarde heeft een naam die bij de waarde past.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=process.env.WIW_PUBLIC||path.join(__dirname,"..","public");
const KLOK="2026-07-22T15:39:00Z",METING="2026-07-22T17:30";
const PAD="/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL";

function fixture(lat,lon){
  const d=bouw({temp:(u,dag)=>+(15.5+4.5*Math.sin((u-9)/24*Math.PI*2)-dag*0.4).toFixed(1),pp:()=>SC.pp,pr:()=>SC.pr,wc:(u,dag)=>u<11?1:u<17?2:3,som:2});
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



const kern=require("../taal/vertaalkern.js"),woordenboek=require("../taal/en.js");
const vertaler=kern.maakVertaler(woordenboek);
const EN=t=>vertaler.vertaal(t)||t;

const SC={pp:0,pr:0,knmi:null};
const BP=900;
const ZIN={DROOG:"Geen neerslag verwacht.",ZEER_KLEIN:"Het komende uur is er een zeer kleine kans op neerslag.",KLEIN:"Het komende uur is er een kleine kans op neerslag.",
  MOGELIJK:"Het komende uur is neerslag mogelijk.",GROOT:"Het komende uur is er een grote kans op neerslag.",ZEER_GROOT:"Het komende uur is er een zeer grote kans op neerslag."};
const ONZEKER="Neerslagverwachting onzeker.",GEEN="Neerslaggegevens niet beschikbaar.";
const niveauVan=k=>k===0?"DROOG":k<=9?"ZEER_KLEIN":k<=29?"KLEIN":k<=69?"MOGELIJK":k<=89?"GROOT":"ZEER_GROOT";

/* Toestanden die in de pagina worden gezet (S.d wijzigen + meters()), net als bij een verversing van de voorspelling. */
const GRENZEN=[0,1,2,5,9,10,15,25,29,30,50,69,70,80,89,90,99,100];
const TOESTANDEN=[
  ...GRENZEN.map(k=>({naam:`kans ${k}%`,kans:k,mm:0,waarde:k===0?"Droog":k+"%",zin:ZIN[niveauVan(k)]})),
  {naam:"0% met 1,5 mm (tegenstrijdig)",kans:0,mm:1.5,waarde:"Onzeker · 1,5 mm",zin:ONZEKER},
  {naam:"0% met spoor (tegenstrijdig)",kans:0,mm:0.04,waarde:"Onzeker",zin:ONZEKER},
  {naam:"5% met spoor",kans:5,mm:0.04,waarde:"5%",zin:ZIN.ZEER_KLEIN},
  {naam:"60% met 1,5 mm",kans:60,mm:1.5,waarde:"60% · 1,5 mm",zin:ZIN.MOGELIJK},
  {naam:"95% met 12 mm",kans:95,mm:12,waarde:"95% · 12,0 mm",zin:ZIN.ZEER_GROOT},
  {naam:"geen gegevens",kans:null,mm:null,waarde:"–",zin:GEEN},
  {naam:"ongeldig 150",kans:150,mm:0,waarde:"–",zin:GEEN},
  {naam:"ongeldig -5",kans:-5,mm:0,waarde:"–",zin:GEEN}];
const HELE_REEKS=Array.from({length:101},(_,k)=>({naam:`kans ${k}%`,kans:k,mm:0,waarde:k===0?"Droog":k+"%",zin:ZIN[niveauVan(k)]}));

/* Echte koude-laadfixtures (SC.pp/SC.pr/SC.knmi). */
const KLOKMS=Date.parse(KLOK);
function knmiPayload(soort){
  const ref=KLOKMS-4*60000;
  const defs={verwacht:{act:0,f:i=>i>=2&&i<=7?3:0},druppels:{act:0,f:i=>i===3?0.5:0},nu:{act:0.8,f:i=>i<3?0.8:0},droog:{act:0,f:()=>0}};
  const d=defs[soort];
  return {beschikbaar:true,opgehaaldOp:new Date(KLOKMS-60000).toISOString(),actueel:{waarde:d.act,tijd:new Date(ref).toISOString()},
    nowcast:{referenceTime:new Date(ref).toISOString(),punten:Array.from({length:25},(_,i)=>({tijd:new Date(ref+i*300000).toISOString(),waarde:d.f(i)}))}};
}
const LAADGEVALLEN=[
  {naam:"droog",pp:0,pr:0,waarde:"Droog",zin:ZIN.DROOG},
  {naam:"kans 5%",pp:5,pr:0,waarde:"5%",zin:ZIN.ZEER_KLEIN},
  {naam:"kans 25%",pp:25,pr:0,waarde:"25%",zin:ZIN.KLEIN},
  /* De fixture zet 1,5 mm ook in het huidige uur: het model meldt dus neerslag nu, naast de kans van 60%. */
  {naam:"kans 60% met 1,5 mm (nu nat volgens model)",pp:60,pr:1.5,waarde:"60% · 1,5 mm",zin:/^Er valt nu neerslag\./},
  {naam:"geen gegevens",pp:null,pr:null,waarde:"–",zin:GEEN},
  {naam:"KNMI verwacht",pp:5,pr:0,knmi:"verwacht",waarde:/^1,5 mm$/,zin:/^Vanaf ongeveer 17:4\d wordt neerslag verwacht\.$/},
  {naam:"KNMI enkele druppels",pp:5,pr:0,knmi:"druppels",waarde:"<0,1 mm",zin:"Het komende uur zijn enkele druppels mogelijk."},
  /* Zelfde KNMI-payload bij droge modeluren: de briefing noemt dan de radar als bron. */
  {naam:"KNMI enkele druppels, droge modeluren",pp:0,pr:0,knmi:"druppels",radarBriefing:true,waarde:"<0,1 mm",zin:"Het komende uur zijn enkele druppels mogelijk."},
  {naam:"KNMI regent nu",pp:40,pr:0,knmi:"nu",waarde:/^(Neerslag|<?\d+(?:,\d)? mm)$/,zin:/^Er valt nu neerslag\./},
  {naam:"KNMI droog, modelkans 80%",pp:80,pr:0,knmi:"droog",waarde:"80%",zin:ZIN.GROOT},
  {naam:"KNMI droog, modelkans 0%",pp:0,pr:0,knmi:"droog",waarde:"Droog",zin:ZIN.DROOG}];


const INIT=`(()=>{
  window.__rec=[];let last="";
  const snap=()=>{const pop=document.getElementById("pop"),sub=document.getElementById("popsub");if(!pop||!sub)return null;
    const st=pop.closest(".stat"),sl=st&&st.querySelector(".mobile-neerslag-sleutel");
    return {waarde:pop.textContent,sub:sub.textContent,subDisp:getComputedStyle(sub).display,sleutelZichtbaar:!!sl&&!sl.hidden&&sl.textContent.trim()!=="",h:Math.round(st.getBoundingClientRect().height)};};
  const log=()=>{const s=snap();if(!s)return;const k=JSON.stringify(s);if(k!==last){last=k;window.__rec.push(s);}};
  new MutationObserver(log).observe(document,{subtree:true,childList:true,characterData:true,attributes:true});
  window.__ls=0;try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__ls+=e.value;}).observe({type:"layout-shift",buffered:true});}catch(e){}
})();`;

async function open(browser,root,{w,taal="nl",schema="light",ncVertraging=0}={}){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:mobiel?844:936},deviceScaleFactor:1,locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",colorScheme:schema,serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(INIT);
  await page.addInitScript(([k,t])=>{
    const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;
    if(t==="en")try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(x){}
  },[KLOK,taal]);
  const payload=SC.knmi?knmiPayload(SC.knmi):null;
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast"){
      const la=+(u.searchParams.get("latitude")||u.searchParams.get("lat")||52.09),lo=+(u.searchParams.get("longitude")||u.searchParams.get("lon")||5.12);
      return r.fulfill({json:fixture(la,lo)});
    }
    if(u.hostname==="geocoding-api.open-meteo.com")return r.fulfill({json:{results:[]}});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:[METING.slice(0,14)+"00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag"){if(ncVertraging)await new Promise(x=>setTimeout(x,ncVertraging));return r.fulfill({json:payload||{nowcast:null,actueel:null,bron:"test"}});}
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+PAD,{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:25000});
  await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelector("#chart #hit"),null,{timeout:25000});
  await page.waitForTimeout(ncVertraging?ncVertraging+1500:1200);
  if(schema==="dark")await page.evaluate(()=>document.documentElement.setAttribute("data-thema","donker"));
  return {context,page,fouten};
}

const meetTegel=page=>page.evaluate(()=>{
  const pop=document.getElementById("pop"),st=pop.closest(".stat"),sub=document.getElementById("popsub"),sl=st.querySelector(".mobile-neerslag-sleutel");
  const sr=sub.getBoundingClientRect(),tr=st.getBoundingClientRect(),pr=pop.getBoundingClientRect();
  const zichtbaar=getComputedStyle(sub).display!=="none"&&sr.height>0;
  const buren=[...st.parentElement.children].filter(e=>e!==st&&e.getBoundingClientRect().height>0&&getComputedStyle(e).display!=="none");
  const overlap=buren.some(e=>{const r=e.getBoundingClientRect();return r.left<tr.right-1&&r.right>tr.left+1&&r.top<tr.bottom-1&&r.bottom>tr.top+1;});
  const rij=[st,...buren].filter(e=>Math.abs(e.getBoundingClientRect().top-tr.top)<2);
  const rijHoogtes=rij.map(e=>Math.round(e.getBoundingClientRect().height));
  return {kop:st.querySelector(".eyebrow").textContent.trim(),waarde:pop.textContent.trim(),sub:sub.textContent.replace(/ /g," ").trim(),subZichtbaar:zichtbaar,
    sleutelZichtbaar:!!sl&&!sl.hidden&&sl.textContent.trim()!=="",sleutel:sl?sl.textContent.trim():"",markering:st.dataset.popUitleg||null,aria:pop.getAttribute("aria-label"),
    subAfgekapt:zichtbaar&&(sub.scrollWidth>sub.clientWidth+1||sub.scrollHeight>sub.clientHeight+1||sr.right>tr.right+1||sr.left<tr.left-1||sr.bottom>tr.bottom+1),
    waardeAfgekapt:pop.scrollWidth>pop.clientWidth+1||pr.right>tr.right+1||pr.left<tr.left-1,
    geo:{sw:sub.scrollWidth,cw:sub.clientWidth,sh:sub.scrollHeight,ch:sub.clientHeight,subR:Math.round(sr.right),subL:Math.round(sr.left),subB:Math.round(sr.bottom),stR:Math.round(tr.right),stL:Math.round(tr.left),stB:Math.round(tr.bottom),oflow:getComputedStyle(sub).overflow},
    meter:(()=>{const e=st.querySelector(":scope > .wiw-meter");return e?e.getAttribute("data-waarde"):null;})(),
    overlap,rijGelijk:Math.max(...rijHoogtes)-Math.min(...rijHoogtes)<=1,h:Math.round(tr.height),hscroll:document.documentElement.scrollWidth>innerWidth};
});
async function axTelling(page,sel){
  const cdp=await page.context().newCDPSession(page);
  try{const {root}=await cdp.send("DOM.getDocument",{depth:0});const {nodeIds}=await cdp.send("DOM.querySelectorAll",{nodeId:root.nodeId,selector:sel});
    let z=0;for(const nodeId of nodeIds){const r=await cdp.send("Accessibility.getPartialAXTree",{nodeId,fetchRelatives:false});if(r.nodes[0]&&!r.nodes[0].ignored)z++;}return {totaal:nodeIds.length,zichtbaar:z};}
  finally{await cdp.detach().catch(()=>{});}
}
let n=0;const ok=(c,m)=>{assert(c,m);n++;};const gelijk=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};
const eerlijk=(fouten,wat)=>{assert.deepEqual(fouten,[],wat+": scriptfouten "+fouten.join(" | "));};

const ENWAARDE=t=>t.replace(/Droog/g,"Dry").replace(/Onzeker/g,"Uncertain").replace(/^Neerslag/,"Precipitation").replace(/,/g,".");
const ENZIN_REGEX=[[/^Vanaf ongeveer 17:4\d wordt neerslag verwacht\.$/,/^Precipitation is expected from about 17:4\d\.$/],[/^Er valt nu neerslag\./,/^There is precipitation now\./]];
const kopVerwacht=(waarde,nu)=>{
  const pct=/%/.test(waarde),mm=/\bmm\b/.test(waarde);
  if(nu&&!pct&&!mm)return ["Neerslag nu"];
  return [pct&&mm?"Neerslag komend uur":pct?"Neerslagkans komend uur":mm?"Verwachte neerslag komend uur":"Neerslag komend uur"].concat(nu?["Neerslag nu"]:[]);
};
const sleutelVerwacht=waarde=>{const pct=/%/.test(waarde),mm=/\bmm\b/.test(waarde);return pct&&mm?"kans · verwacht totaal":pct?"kans":mm?"verwacht totaal":"";};

/* Gemeenschappelijke controle van één gemeten tegel tegen de verwachting. */
function controleer(m,st,taal,L){
  const nl=taal==="nl",waardeTekst=typeof st.waarde==="string"?(nl?st.waarde:ENWAARDE(st.waarde)):null;
  const gemeten=nl?m.waarde:m.waarde.replace(/,/g,".");
  if(waardeTekst!==null)gelijk(gemeten,waardeTekst,`${L}: hoofdwaarde`);else ok(st.waarde.test(nl?m.waarde:m.waarde.replace(/\./g,",").replace(/^Precipitation/,"Neerslag")),`${L}: hoofdwaarde ${m.waarde}`);
  if(typeof st.zin==="string")gelijk(m.sub,nl?st.zin:EN(st.zin),`${L}: toelichting`);
  else{const i=ENZIN_REGEX.findIndex(r=>r[0].source===st.zin.source);ok((nl?st.zin:(i>=0?ENZIN_REGEX[i][1]:/^$/)).test(m.sub),`${L}: toelichting ${m.sub}`);}
  gelijk(m.subZichtbaar,true,`${L}: toelichting zichtbaar`);gelijk(m.markering,"1",`${L}: markering`);
  /* 'Droog' staat alleen bij de droge toelichting en omgekeerd. */
  gelijk(m.waarde===(nl?"Droog":"Dry"),m.sub===(nl?ZIN.DROOG:EN(ZIN.DROOG)),`${L}: 'Droog' en droge toelichting horen bij elkaar (${m.waarde} / ${m.sub})`);
  const nuNat=/^Er valt nu|^There is precipitation now/.test(m.sub);
  const nlWaarde=typeof st.waarde==="string"?st.waarde:m.waarde;
  if(nl)ok(kopVerwacht(nlWaarde,nuNat).includes(m.kop),`${L}: kop ${m.kop}`);else ok(m.kop&&m.kop!==kopVerwacht(nlWaarde,nuNat)[0]||/^[A-Z][A-Za-z ]+$/.test(m.kop),`${L}: kop ${m.kop}`);
  if(m.sleutelZichtbaar)gelijk(m.sleutel,nl?sleutelVerwacht(nlWaarde):EN(sleutelVerwacht(nlWaarde)),`${L}: zichtbare sleutel past niet bij de waarde`);
  gelijk(m.subAfgekapt,false,`${L}: toelichting afgekapt ${JSON.stringify(m.geo)}`);gelijk(m.waardeAfgekapt,false,`${L}: waarde afgekapt`);
  gelijk(m.overlap,false,`${L}: tegel overlapt een naburige tegel`);gelijk(m.rijGelijk,true,`${L}: tegels in dezelfde rij zijn niet even hoog`);
  gelijk(m.hscroll,false,`${L}: horizontale scroll`);
  /* Kansmetertje: alleen bij een percentage en dan gelijk aan dat percentage (een hoeveelheid in mm is nooit een kans). */
  const pctMatch=/^(\d+)%/.exec(m.waarde);
  gelijk(m.meter,pctMatch?pctMatch[1]:null,`${L}: kansmeter ${m.meter} hoort niet bij ${m.waarde}`);
  if(m.waarde==="–")ok(!m.aria,`${L}: verouderde toegankelijke naam bij '–' (${m.aria})`);
  else ok(m.aria&&m.aria.toLowerCase().replace(/,/g,".").includes(m.waarde.split(" · ")[0].toLowerCase().replace(/,/g,".")),`${L}: toegankelijke naam ${m.aria} past niet bij ${m.waarde}`);
}

const zet=(page,kans,mm)=>page.evaluate(([k,m])=>{
  const i=S.d.hourly.time.indexOf(S.d.current.time.slice(0,13)+":00");
  for(let j=i;j<i+4;j++){S.d.hourly.precipitation_probability[j]=k;S.d.hourly.precipitation[j]=m;}
  meters();nowcast();
},[kans,mm]);

/* A. Toestandswissels in één pagina, alle breedten; de volledige reeks 0 t/m 100% op drie breedten. */
async function testToestanden(browser,root){
  const breedtes=[320,360,390,430,768,900,901,1366];
  for(const w of breedtes)for(const [taal,schema] of [["nl","light"],["en","dark"]]){
    SC.pp=0;SC.pr=0;SC.knmi=null;
    const {context,page,fouten}=await open(browser,root,{w,taal,schema});
    try{
      const metReeks=w===320||(taal==="nl"&&[390,1366].includes(w));
      const reeks=[...TOESTANDEN,...(metReeks?HELE_REEKS:[])];
      for(const [idx,st] of reeks.entries()){
        await zet(page,st.kans,st.mm);/* De Engelse vertaallaag schrijft hoogstens 20 keer per 2 s naar dezelfde node (rem tegen heen-en-weer schrijven); een echte verversing komt
           veel zeldzamer voor, dus wissel hier langzaam genoeg. */
        await page.waitForTimeout(taal==="en"?400:30);
        const m=await meetTegel(page),L=`${w}px ${taal} ${schema} ${st.naam}${idx>=TOESTANDEN.length?" (reeks)":""}`;
        controleer(m,st,taal,L);
        if(idx<TOESTANDEN.length){const ax=await axTelling(page,"#popsub");gelijk(ax.zichtbaar,1,`${L}: toelichting precies één keer in de toegankelijkheidsboom (${JSON.stringify(ax)})`);}
      }
      eerlijk(fouten,`A ${w} ${taal}`);
    }finally{await context.close();}
  }
  console.log(`A. Neerslagtegel in de pagina: ${TOESTANDEN.length} grens-/hoeveelheids-/ongeldige toestanden op ${breedtes.join("/")} px (NL licht, EN donker) en alle 101 percentages (NL 320/390/1366 px, EN 320 px): waarde, toelichting, kop, sleutel, geen afkapping of overlap, a11y.`);
}

/* B. Koude laad met echte fixtures, KNMI-payloads en vertraagde neerslagdata: nooit placeholder of tegenstrijdige tussentoestand. */
/* Zelfde budget als browser-mobile-cls-budget.test.js. Een late KNMI-payload kan de toelichting korter of langer maken (de tegelhoogte
   volgt de inhoud); dat verschuift de tegels eronder een regel, en blijft ruim binnen het budget. */
const CLS_BUDGET=0.1;let maxLs=0,maxLsWaar="";
async function testLaden(browser,root){
  const runs=[];
  for(const w of [320,390,768])for(const g of LAADGEVALLEN)runs.push({w,g,taal:"nl",schema:"light",vertraging:0});
  for(const g of LAADGEVALLEN)runs.push({w:320,g,taal:"en",schema:"dark",vertraging:0});
  for(const g of LAADGEVALLEN.filter(x=>x.knmi==="verwacht"||x.pr===1.5||x.knmi==="droog"&&x.pp===80))runs.push({w:390,g,taal:"nl",schema:"light",vertraging:1500});
  for(const {w,g,taal,schema,vertraging} of runs){
    SC.pp=g.pp;SC.pr=g.pr;SC.knmi=g.knmi||null;
    const {context,page,fouten}=await open(browser,root,{w,taal,schema,ncVertraging:vertraging});
    const L=`laden ${w}px ${taal} vertraging ${vertraging} ${g.naam}`;
    try{
      const r=await page.evaluate(()=>({rec:window.__rec,ls:window.__ls}));
      ok(r.rec.length>=2,`${L}: te weinig DOM-momenten (${r.rec.length})`);
      /* Tijdens het vertalen is de ene tekst even Nederlands en de andere Engels: vergelijk betekenis, niet taal. */
      const isDroog=t=>t.trim()==="Droog"||t.trim()==="Dry",isDroogZin=t=>t.trim()===ZIN.DROOG||t.trim()===EN(ZIN.DROOG);
      for(const s of r.rec){
        const leeg=s.sub.replace(/ /g,"").trim()==="";
        ok(!(s.subDisp!=="none"&&leeg),`${L}: een lege toelichting of de placeholder is zichtbaar ${JSON.stringify(s)}`);
        if(s.subDisp!=="none")ok(isDroog(s.waarde)===isDroogZin(s.sub),`${L}: tegenstrijdige tussentoestand ${JSON.stringify(s)}`);
      }
      if(r.ls>maxLs){maxLs=r.ls;maxLsWaar=L;}ok(r.ls<CLS_BUDGET,`${L}: layout-shift ${r.ls} overschrijdt het CLS-budget ${CLS_BUDGET}`);
      controleer(await meetTegel(page),g,taal,L);
      if(g.radarBriefing){
        const briefing=await page.locator("#brief").innerText();
        const radarZin=taal==="en"?"According to the KNMI radar forecast, a few drops may fall in the next two hours.":"Volgens de KNMI-radar kunnen er de komende twee uur enkele druppels vallen.";
        ok(briefing.includes(radarZin),`${L}: de briefing vermeldt de radarbron bij droge modeluren: ${briefing}`);
      }
      eerlijk(fouten,L);
    }finally{await context.close();}
  }
  SC.knmi=null;
  console.log(`B. Koude laad: ${runs.length} runs (320/390/768 px NL, 320 px EN donker, KNMI-payloads, 1,5 s vertraagde neerslagdata): geen placeholder of tegenstrijdige tussentoestand, layout-shift max ${maxLs.toFixed(3)} bij '${maxLsWaar}' (< ${CLS_BUDGET}), eindtoestand klopt.`);
}

/* C. Wisselen na het laden: geen verouderde toelichting of toegankelijke naam; tegelhoogte per toestand stabiel. */
async function testWisselen(browser,root){
  const vind=naam=>TOESTANDEN.find(t=>t.naam===naam);
  const rij=["kans 0%","kans 25%","kans 0%","60% met 1,5 mm","geen gegevens","kans 25%","kans 5%","ongeldig 150","kans 0%","0% met 1,5 mm (tegenstrijdig)","kans 100%","kans 0%"];
  for(const w of [320,390,768,1366]){
    SC.pp=0;SC.pr=0;SC.knmi=null;
    const {context,page,fouten}=await open(browser,root,{w});
    try{
      const hoogtes={};
      for(const naam of rij){
        const st=vind(naam);await zet(page,st.kans,st.mm);await page.waitForTimeout(150);
        const m=await meetTegel(page),L=`wisselen ${w}px ${naam}`;
        controleer(m,st,"nl",L);
        if(hoogtes[naam]===undefined)hoogtes[naam]=m.h;else ok(Math.abs(hoogtes[naam]-m.h)<=2,`${L}: hoogte ${m.h} wijkt af van eerdere hoogte ${hoogtes[naam]} voor dezelfde toestand`);
      }
      eerlijk(fouten,"wisselen "+w);
    }finally{await context.close();}
  }
  console.log("C. Wisselen droog > 25% > droog > 60% met 1,5 mm > geen gegevens > 25% > 5% > ongeldig > droog > tegenstrijdig > 100% > droog (320/390/768/1366 px): toelichting, toegankelijke naam en hoogte blijven per toestand consistent.");
}

server.listen(0,"127.0.0.1",async()=>{
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    const tijd=async(naam,f)=>{const t=Date.now();await f();console.log("  duur "+naam+": "+((Date.now()-t)/1000).toFixed(1)+" s");};
    await tijd("A",()=>testToestanden(browser,root));
    await tijd("B",()=>testLaden(browser,root));
    await tijd("C",()=>testWisselen(browser,root));
    console.log(`Neerslagtegel: ${n} controles geslaagd.`);
  }catch(e){console.error(e);process.exitCode=1;}
  finally{await browser.close();server.close();}
});

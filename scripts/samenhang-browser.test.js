"use strict";

/* Samenhang na de kritische review van 25 september, op het finale artifact
   met de echte runtime.
   - Zes tegels: "Tijd tot zonsondergang" en (bij goed zicht) "Zicht" staan
     verborgen; vanaf 600px drie kolommen.
   - Na zonsondergang: "UV-piek morgen" en "Zonuren morgen" met de waarden
     voor morgen; na een wissel naar een plaats overdag weer "vandaag".
   - Pollen: niveau per soort volgens het National Allergy Bureau (160
     graspollen = veel), met bronvermelding.
   - Nachtzicht: telefoon toont alleen vannacht, desktop drie nachten.
   - Dagweergave: geen dubbele dagnaam voor zon op/onder.
   - Desktopgrafiek: 24 uur; de uurtabel is het begin daarvan.
   - Plaatsindex /weer/: Licht | Auto | Donker, terug-link bovenaan, zoekveld
     dat echt filtert (zichtbaar en focusbaar), op telefoon en desktop.
   - Uurtabel naast de desktopgrafiek (1100-1366px): ook bij storm ("WZW 10
     Bft") geen horizontaal scrollen en geen afgekapte kolom.
   - Over en Privacy: siteletters; Privacy begint met een korte samenvatting.
   - Themawissel: de grafiek (stippen, cijfers, iconen, verloop) volgt
     direct, in beide richtingen, op telefoon en desktop.
   - Privacy: "Wis lokale gegevens" wist ook de weergavekeuze van de sessie
     en houdt de GA4-toestemmingskeuze.
   - Engels (audit 2 oktober): UV-kop na plaatswissel, klikbare e-mail,
     grafiekvenster, themalabels, Maan-kolom en "The Hague" in de lijst.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const SCENARIO={
  /* 17:39, natte avond, 160 graspollen. */
  middag:{klok:"2026-07-22T15:39:00Z",meting:"2026-07-22T17:30",gras:160,
    temp:(u,dag)=>+(15.5+4.5*Math.sin((u-9)/24*Math.PI*2)-dag*0.4).toFixed(1),
    pp:(u,dag)=>dag===0&&u>=19&&u<=23?[40,70,80,65,30][u-19]:8,
    pr:(u,dag)=>dag===0&&u>=19&&u<=23?[0.2,1.4,2.1,0.8,0.1][u-19]:0},
  /* 22:40, na zonsondergang. */
  avond:{klok:"2026-07-22T20:40:00Z",meting:"2026-07-22T22:30",gras:12,
    temp:(u,dag)=>+(14+3.8*Math.sin((u-9)/24*Math.PI*2)-dag*0.2).toFixed(1),pp:()=>8,pr:()=>0},
  /* Storm: windkracht 10 uit het westzuidwesten ("WZW 10 Bft"), veel regen. */
  storm:{klok:"2026-07-22T07:10:00Z",meting:"2026-07-22T09:00",gras:4,ws:95,wd:247.5,
    temp:(u,dag)=>+(13+3*Math.sin((u-9)/24*Math.PI*2)-dag*0.2).toFixed(1),pp:()=>100,pr:()=>12.4}
};
function fixture(sc){
  const d=bouw({temp:sc.temp,pp:sc.pp,pr:sc.pr,som:0,...(sc.ws?{ws:sc.ws}:{})});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map((_,i)=>[21600,12000,5000,30000,26000,18000,24000][i]);
  const h=d.hourly;
  if(sc.wd!==undefined)h.wind_direction_10m=h.wind_direction_10m.map(()=>sc.wd);
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  const nu=h.time.indexOf(sc.meting.slice(0,14)+"00");
  d.current.time=sc.meting;d.current.temperature_2m=h.temperature_2m[nu];d.current.apparent_temperature=h.temperature_2m[nu]-1;
  return d;
}
/* Hetzelfde moment in New York: 16:30 plaatselijke tijd, ruim voor zonsondergang. */
function fixtureNewYork(sc){
  const d=fixture(sc);
  d.latitude=40.7143;d.longitude=-74.006;d.timezone="America/New_York";d.utc_offset_seconds=-14400;
  const meting=new Date(Date.parse(sc.meting+"Z")-6*3600000).toISOString().slice(0,16);
  const nu=d.hourly.time.indexOf(meting.slice(0,14)+"00");
  d.current.time=meting;d.current.is_day=1;d.current.temperature_2m=d.hourly.temperature_2m[nu];d.current.apparent_temperature=d.hourly.temperature_2m[nu]-1;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  let f=path.join(OUT,p);if(!fs.existsSync(f)&&fs.existsSync(f+".html"))f+=".html";
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,sc,w,h,pad="/weer/utrecht/",taal){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  if(taal)await page.addInitScript(t=>{try{localStorage.setItem("weerbriefing.taal.v1",JSON.stringify(t));}catch(_){}},taal);
  if(sc)await page.addInitScript(k=>{const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;},sc.klok);
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(sc&&u.hostname==="geocoding-api.open-meteo.com")return r.fulfill({json:{results:/new york/i.test(u.searchParams.get("name")||"")?[{name:"New York",latitude:40.7143,longitude:-74.006,admin1:"New York",country_code:"US"}]:[]}});
    if(sc&&(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")){
      const lat=Number(u.searchParams.get("latitude")||u.searchParams.get("lat"));
      return r.fulfill({json:Math.abs(lat-40.7143)<0.01?fixtureNewYork(sc):fixture(sc)});
    }
    if(sc&&u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:30,uv_index:2},hourly:{time:[sc.meting.slice(0,14)+"00"],grass_pollen:[sc.gras],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[1],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+pad,{waitUntil:"domcontentloaded"});
  if(sc){
    await page.waitForSelector("#app",{state:"visible",timeout:15000});
    await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelectorAll("#chart circle").length>0&&document.querySelector("#aq .stat"),null,{timeout:15000});
    await sleep(1500);
  }else await sleep(600);
  return {context,page,fouten};
}

function meet(){
  const tekst=el=>el?String(el.textContent||"").replace(/\s+/g," ").trim():"";
  const stats=document.querySelector(".final-top-grid>.stats")||document.querySelector("#app .stats:not(#aq)");
  const zichtbaar=stats?[...stats.children].filter(t=>t.classList.contains("stat")&&t.getBoundingClientRect().height>0):[];
  const aq=[...document.querySelectorAll("#aq .stat")].map(t=>({kop:tekst(t.querySelector(".eyebrow")),sub:tekst(t.querySelector(".ssub")),niveau:(t.querySelector(".sval")||{getAttribute:()=>null}).getAttribute("data-pollen-niveau")}));
  const uv=document.getElementById("uv"),uvTegel=uv&&uv.closest(".stat");
  const nachten=[...document.querySelectorAll("#nights .row.night:not(.kop)")].filter(r=>!r.hidden&&r.getClientRects().length).length;
  const uitleg=[...document.querySelectorAll("#app p, #app .hint")].find(el=>/Pollenwaarden zijn een verwachting van CAMS/.test(el.textContent||""));
  return {tegels:zichtbaar.map(t=>tekst(t.querySelector(".eyebrow"))),kolommen:new Set(zichtbaar.map(t=>Math.round(t.getBoundingClientRect().left))).size,
    uvKop:tekst(uvTegel&&uvTegel.querySelector(".eyebrow")),uvSub:tekst(uvTegel&&uvTegel.querySelector(".ssub")),aq,nachten,
    pollenBron:!!uitleg&&/National Allergy Bureau/.test(uitleg.textContent),
    grafiekUren:S.geo&&Array.isArray(S.geo.TI)?S.geo.TI.length:0,
    tabel:[...document.querySelectorAll("#wiw-hour-table tbody tr")].map(r=>S.d.hourly.time[Number(r.dataset.sourceIndex)]).filter(Boolean),
    geoTI:S.geo&&S.geo.TI?S.geo.TI.slice():[],
    overflow:document.documentElement.scrollWidth-innerWidth};
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [naam,w,h] of [["middag",390,844],["middag",768,1024],["middag",1366,768],["avond",390,844],["avond",1440,900]]){
      const label=naam+" "+w+"px",sc=SCENARIO[naam];
      const {context,page,fouten}=await open(browser,root,sc,w,h);
      try{
        const m=await page.evaluate(meet);
        assert.equal(m.tegels.length,6,label+": verwacht zes tegels, kreeg "+JSON.stringify(m.tegels));
        assert(!m.tegels.some(k=>/^Tijd tot zon/.test(k)),label+": tegel met tijd tot zonsondergang/-opkomst is nog zichtbaar");
        assert(!m.tegels.includes("Zicht"),label+": zichttegel is zichtbaar bij goed zicht");
        if(w>=600)assert.equal(m.kolommen,3,label+": zes tegels staan niet in drie kolommen ("+m.kolommen+")");
        if(naam==="avond"){
          assert.equal(m.uvKop,"UV-piek morgen",label+": UV-tegel toont na zonsondergang niet morgen");
          assert(!/lag rond|vandaag/.test(m.uvSub),label+": UV-regel gaat na zonsondergang nog over vandaag: "+m.uvSub);
          const zon=m.aq.find(t=>/^Zonuren/.test(t.kop));
          assert(zon&&zon.kop==="Zonuren morgen"&&/morgen/.test(zon.sub)&&!/vandaag/.test(zon.sub),label+": zonurentegel toont na zonsondergang niet morgen: "+JSON.stringify(zon));
        }else{
          assert.equal(m.uvKop,"UV-piek vandaag",label+": UV-tegel toont overdag niet vandaag");
          const gras=m.aq.find(t=>t.kop==="Graspollen");
          assert(gras&&gras.sub==="Veel graspollen verwacht voor dit uur."&&gras.niveau==="hoog",label+": 160 graspollen heet niet 'veel' (NAB): "+JSON.stringify(gras));
          assert(m.pollenBron,label+": bronvermelding van de pollenschaal ontbreekt");
        }
        assert.equal(m.nachten,w<=900?1:3,label+": verwacht "+(w<=900?"alleen vannacht":"drie nachten")+", kreeg "+m.nachten);
        if(w>=1100){
          assert.equal(m.grafiekUren,25,label+": desktopgrafiek toont geen 24 uur ("+m.grafiekUren+" punten)");
          assert(m.tabel.length>0&&m.tabel.every((t,i)=>t===m.geoTI[i]),label+": de uurtabel is niet het begin van de grafiek: "+JSON.stringify({tabel:m.tabel.slice(0,3),grafiek:m.geoTI.slice(0,3)}));
        }
        /* Dagweergave: de dagnaam staat al in de kop. */
        const rij=await page.$$("#days .row.day");
        if(rij[3]){
          await rij[3].click();await sleep(1000);
          const dag=await page.evaluate(()=>({labels:document.querySelectorAll("#suntimes .zondag").length,zon:(document.getElementById("suntimes")||{}).textContent||""}));
          assert.equal(dag.labels,0,label+": dagweergave herhaalt de dagnaam bij zon op/onder");
          assert(/zon op/.test(dag.zon),label+": zon op ontbreekt in de dagweergave");
        }
        assert(m.overflow<=1,label+": horizontale overflow "+m.overflow+"px");
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("SAMENHANG "+label+": "+m.tegels.length+" tegels in "+m.kolommen+" kolom(men), "+m.uvKop+", "+m.nachten+" nacht(en) open"+(w>=1100?", grafiek "+(m.grafiekUren-1)+" uur":"")+".");
      }finally{await context.close();}
    }
    /* Plaatswissel van avond naar dag, zonder herladen: Utrecht 22:40 (UV-piek
       morgen) naar New York 16:40. De kop moet terug naar vandaag; eerder bleef
       "UV-piek morgen" boven de waarde van vandaag staan (audit F01). */
    for(const [w,h] of [[390,844],[1366,768]]){
      const label="avond→dag "+w+"px";
      const {context,page,fouten}=await open(browser,root,SCENARIO.avond,w,h);
      try{
        assert.equal((await page.evaluate(meet)).uvKop,"UV-piek morgen",label+": uitgangssituatie is niet de avond");
        await page.fill("#q","New York");
        await page.waitForSelector("#res.on div[data-lat]",{timeout:5000});
        await page.locator("#res div[data-lat]").first().click();
        await page.waitForFunction(()=>typeof S!=="undefined"&&S.d&&S.d.timezone==="America/New_York"&&document.querySelectorAll("#chart circle").length>0,null,{timeout:15000});
        await sleep(1500);
        const m=await page.evaluate(meet);
        assert.equal(m.uvKop,"UV-piek vandaag",label+": UV-kop bleef na de wissel naar een plaats overdag op morgen staan");
        assert(!/morgen/.test(m.uvSub),label+": UV-regel gaat overdag over morgen: "+m.uvSub);
        const zon=m.aq.find(t=>/^Zonuren/.test(t.kop));
        assert(zon&&zon.kop==="Zonuren",label+": zonurentegel bleef op morgen staan: "+JSON.stringify(zon));
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("SAMENHANG "+label+": na de wissel naar New York staat er weer "+m.uvKop+" en "+zon.kop+".");
      }finally{await context.close();}
    }
    /* Engelse weergave (audit F03–F08): contactlink, grafiekvenster,
       themalabels en de Maan-kolom zonder extra zichtregel. */
    {
      const label="Engels 1440px";
      const {context,page,fouten}=await open(browser,root,SCENARIO.middag,1440,900,"/weer/utrecht/","en");
      try{
        await page.waitForFunction(()=>document.documentElement.lang==="en-GB",null,{timeout:10000});await sleep(800);
        const r=await page.evaluate(()=>{
          const zichtbaar=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).display!=="none"&&getComputedStyle(el).visibility!=="hidden";
          const maan=[...document.querySelectorAll("#nights .nachtmaan")].filter(zichtbaar).map(el=>[...el.querySelectorAll("*")].filter(k=>zichtbaar(k)&&!k.children.length).map(k=>k.textContent.trim()).join(" "));
          const na=sel=>{const el=document.querySelector(sel);return el?getComputedStyle(el,"::after").content:null;};
          return {mailto:[...document.querySelectorAll('.footer-contact a[href="mailto:support@watishetweer.nl"]')].length,
            maan,licht:na("#thema .wiw-theme-sun"),donker:na("#thema .wiw-theme-moon")};
        });
        assert(r.mailto>=1,label+": de e-mail in de footer is geen klikbare link meer (F03)");
        assert(r.maan.length&&r.maan.every(t=>!/visibility|zicht/i.test(t)),label+": de Maan-kolom toont een zichtregel: "+JSON.stringify(r.maan.slice(0,2))+" (F08)");
        if(r.licht!==null)assert.deepEqual([r.licht,r.donker],['"Light"','"Dark"'],label+": themalabels blijven Nederlands (F05)");
        /* Grafiekvenster bij een gekozen uur. */
        const hit=await page.$("#hit");await hit.scrollIntoViewIfNeeded();
        const box=await hit.boundingBox();await page.mouse.move(box.x+box.width*0.35,box.y+box.height*0.5);await sleep(400);
        const venster=await page.evaluate(()=>[...document.querySelectorAll("#scrub text")].map(t=>t.textContent.trim()));
        assert(venster.length>=6,label+": het grafiekvenster verschijnt niet ("+venster.length+" teksten)");
        const nl=venster.filter(t=>/temperatuur|voelt als|bewolking|windstoten|km\/u|neerslag|kans \d|WZW|ZZW|OZO|NNO|ONO/.test(t));
        assert.deepEqual(nl,[],label+": grafiekvenster bevat Nederlandse tekst (F04): "+JSON.stringify(venster));
        /* Handmatig donker: de naam van de schakelaar is Engels. */
        await page.evaluate(()=>document.getElementById("thema-switch").click());await sleep(300);
        const naam=await page.evaluate(()=>document.getElementById("thema-switch").getAttribute("aria-label")||"");
        assert(!/Handmatig|Licht|Donker|browsersessie/.test(naam),label+": schakelaarnaam blijft Nederlands (F05): "+naam);
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("SAMENHANG "+label+": mailto blijft, Maan-kolom zonder zichtregel, venster "+JSON.stringify(venster.slice(0,4))+", schakelaar '"+naam+"'.");
      }finally{await context.close();}
    }
    /* Plaatsindex. */
    for(const [w,h] of [[390,844],[1366,768]]){
      const {context,page,fouten}=await open(browser,root,null,w,h,"/weer/");
      try{
        const r=await page.evaluate(()=>{
          const knoppen=[...document.querySelectorAll("#thema [data-keuze]")].map(k=>({k:k.getAttribute("data-keuze"),p:k.getAttribute("aria-pressed"),h:k.getBoundingClientRect().height}));
          const terug=document.querySelector(".terug-boven a"),h1=document.querySelector("h1");
          return {knoppen,terugBoven:!!terug&&h1&&terug.getBoundingClientRect().top<h1.getBoundingClientRect().top,oudeSchakelaar:!!document.querySelector(".wiw-theme-switch")};
        });
        assert.deepEqual(r.knoppen.map(k=>k.k),["licht","auto","donker"],w+"px /weer/: weergavekeuze Licht | Auto | Donker ontbreekt");
        assert(r.knoppen.every(k=>k.h>=43.5),w+"px /weer/: weergaveknoppen zijn geen 44px-tikdoel");
        assert(r.terugBoven&&!r.oudeSchakelaar,w+"px /weer/: terug-link niet bovenaan of oude schakelaar nog aanwezig");
        await page.click('#thema [data-keuze="donker"]');await sleep(150);
        assert.equal(await page.evaluate(()=>document.documentElement.getAttribute("data-thema")),"donker",w+"px /weer/: Donker zet het donkere thema niet");
        /* Zoeken: telt wat werkelijk op het scherm staat (weergegeven en
           niet display:none), niet alleen het hidden-attribuut. Een
           weggefilterde plaats mag ook geen focus kunnen krijgen. */
        const totaal=await page.evaluate(()=>document.querySelectorAll(".plaatsen li").length);
        assert(totaal>=20,w+"px /weer/: plaatsenlijst te kort ("+totaal+")");
        const zoek=async(q,verwacht)=>{
          await page.fill("#hub-zoek",q);
          await page.waitForFunction(n=>[...document.querySelectorAll(".plaatsen li")].filter(li=>!li.hidden).length===n,verwacht,{timeout:5000}).catch(()=>{});
          return page.evaluate(()=>{
            const zichtbaar=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).display!=="none"&&getComputedStyle(el).visibility!=="hidden";
            const li=[...document.querySelectorAll(".plaatsen li")];
            const verborgenFocus=li.filter(e=>!zichtbaar(e)).map(e=>e.querySelector("a")).filter(a=>{a.focus();const ja=document.activeElement===a;a.blur();return ja;}).length;
            const leeg=document.getElementById("hub-leeg");
            return {namen:li.filter(zichtbaar).map(e=>e.querySelector("a").textContent.trim()),verborgenFocus,leeg:zichtbaar(leeg),leegTekst:leeg?leeg.textContent.trim():""};
          });
        };
        let z=await zoek("Almere",1);
        assert.deepEqual(z.namen,["Almere"],w+"px /weer/: 'Almere' toont niet precies één resultaat: "+z.namen.length+" zichtbaar");
        assert.equal(z.verborgenFocus,0,w+"px /weer/: "+z.verborgenFocus+" weggefilterde links zijn nog focusbaar");
        assert(!z.leeg,w+"px /weer/: melding 'niet in de lijst' staat er bij een treffer");
        z=await zoek("utre",1);
        assert.deepEqual(z.namen,["Utrecht"],w+"px /weer/: zoeken op 'utre' toont niet alleen Utrecht: "+JSON.stringify(z.namen.slice(0,5)));
        assert.equal(z.verborgenFocus,0,w+"px /weer/: weggefilterde links zijn nog focusbaar bij 'utre'");
        /* Toetsenbord: Tab vanuit het zoekveld komt direct op Utrecht. */
        await page.focus("#hub-zoek");await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(()=>(document.activeElement||{}).textContent||""),"Utrecht",w+"px /weer/: Tab na 'utre' komt niet op Utrecht");
        z=await zoek("xyzq",0);
        assert.deepEqual(z.namen,[],w+"px /weer/: onbekende term toont toch "+z.namen.length+" plaatsen");
        assert.equal(z.verborgenFocus,0,w+"px /weer/: weggefilterde links zijn nog focusbaar bij een onbekende term");
        assert(z.leeg&&/niet in de lijst/.test(z.leegTekst),w+"px /weer/: hulptekst bij geen resultaat ontbreekt of is niet zichtbaar");
        z=await zoek("",totaal);
        assert.equal(z.namen.length,totaal,w+"px /weer/: leeg zoekveld toont niet de volledige lijst ("+z.namen.length+" van "+totaal+")");
        assert(!z.leeg,w+"px /weer/: melding 'niet in de lijst' blijft staan bij een leeg zoekveld");
        assert.deepEqual(fouten,[],w+"px /weer/: runtimefouten "+fouten.join(" | "));
        console.log("SAMENHANG /weer/ "+w+"px: Licht | Auto | Donker, terug bovenaan, zoeken filtert.");
      }finally{await context.close();}
    }
    /* Engelse plaatsenlijst: de getoonde naam ("The Hague") en de
       oorspronkelijke naam ("Den Haag") vinden allebei de plaats (audit F07). */
    {
      const {context,page,fouten}=await open(browser,root,null,1366,768,"/weer/","en");
      try{
        await page.waitForFunction(()=>document.documentElement.lang==="en-GB",null,{timeout:10000});await sleep(500);
        const zoekEn=async q=>{await page.fill("#hub-zoek",q);await sleep(150);
          return page.evaluate(()=>[...document.querySelectorAll(".plaatsen li")].filter(li=>!li.hidden&&li.getClientRects().length).map(li=>li.querySelector("a").textContent.trim()));};
        assert.deepEqual(await zoekEn("The Hague"),["The Hague"],"/weer/ EN: zoeken op 'The Hague' vindt de plaats niet");
        assert.deepEqual(await zoekEn("den haag"),["The Hague"],"/weer/ EN: zoeken op 'den haag' vindt de plaats niet meer");
        assert.deepEqual(fouten,[],"/weer/ EN: runtimefouten "+fouten.join(" | "));
        console.log("SAMENHANG /weer/ EN: 'The Hague' en 'Den Haag' vinden allebei The Hague.");
      }finally{await context.close();}
    }
    /* Uurtabel naast de desktopgrafiek: ook "WZW 10 Bft" past, zonder
       horizontaal scrollen of een afgekapt kolomkopje. */
    for(const w of [1100,1280,1366]){
      const {context,page}=await open(browser,root,SCENARIO.storm,w,900);
      try{
        const r=await page.evaluate(()=>{const hour=document.getElementById("wiw-hour-table"),scroll=document.getElementById("wiw-hour-scroll");
          const th=hour&&hour.querySelector("thead th:nth-child(3)"),wind=hour&&hour.querySelector("tbody .wiw-hour-wind .wiw-hour-primary");
          return {tabel:!!hour,overflow:scroll?scroll.scrollWidth-scroll.clientWidth:null,kopVrij:!!th&&th.scrollWidth<=th.clientWidth+1,
            wind:wind?wind.textContent.trim():"",windVrij:!!wind&&[...hour.querySelectorAll("tbody td.wiw-hour-wind")].every(td=>td.scrollWidth<=td.clientWidth+1)};});
        assert(r.tabel,w+"px storm: uurtabel ontbreekt");
        assert(/^[NOZW]{3} 1\d Bft$/.test(r.wind),w+"px storm: fixture toont geen windkracht 10+ met drieletterrichting ("+r.wind+")");
        assert(r.overflow!==null&&r.overflow<=1,w+"px storm: uurtabel loopt "+r.overflow+"px over");
        assert(r.kopVrij&&r.windVrij,w+"px storm: kolomkop of windcel wordt afgekapt ("+JSON.stringify(r)+")");
        console.log("SAMENHANG storm "+w+"px: uurtabel past met "+r.wind+".");
      }finally{await context.close();}
    }
    /* Themawissel: de grafiek volgt direct, zonder opnieuw te tekenen. Na de
       wissel mag geen grafiekelement nog een kleur hebben die alleen in het
       vorige thema bestaat (inkt, gedempte inkt of papier). */
    const themaKleuren=()=>["--ink","--ink-45","--sheet"].map(v=>{const el=document.createElement("span");el.style.color="var("+v+")";document.body.appendChild(el);const c=getComputedStyle(el).color;el.remove();return c;});
    for(const w of [390,1366]){
      const {context,page,fouten}=await open(browser,root,SCENARIO.middag,w,900);
      try{
        await page.waitForFunction(()=>{const k=document.getElementById("thema-switch");return k&&!k.disabled;},null,{timeout:10000});
        for(const naar of ["donker","licht"]){
          const oud=await page.evaluate(themaKleuren);
          await page.evaluate(()=>document.getElementById("thema-switch").click());
          await page.waitForFunction(t=>(document.documentElement.getAttribute("data-thema")||"licht")===t,naar,{timeout:5000});
          const nieuw=await page.evaluate(themaKleuren),alleenOud=oud.filter(c=>!nieuw.includes(c));
          assert(alleenOud.length>0,w+"px thema "+naar+": thema's hebben geen eigen kleuren ("+oud.join(", ")+")");
          const blijft=await page.evaluate(oudeKleuren=>[...document.querySelectorAll("#chart *")].filter(el=>!el.closest("mask,defs,#scrub")).map(el=>{const cs=getComputedStyle(el);
            const hit=[["fill",cs.fill],["stroke",cs.stroke],["stop-color",cs.stopColor],["color",cs.color]].find(([,c])=>oudeKleuren.includes(c));
            return hit?el.tagName+[...el.attributes].filter(a=>/^data-/.test(a.name)).map(a=>"["+a.name+"]").join("")+" "+hit[0]+"="+hit[1]:null;}).filter(Boolean),alleenOud);
          assert.deepEqual(blijft.slice(0,6),[],w+"px naar "+naar+": "+blijft.length+" grafiekelementen houden de kleur van het vorige thema");
        }
        assert.deepEqual(fouten,[],w+"px themawissel: runtimefouten "+fouten.join(" | "));
        console.log("SAMENHANG themawissel "+w+"px: grafiek volgt licht → donker → licht direct.");
      }finally{await context.close();}
    }
    /* Over en Privacy. */
    for(const pad of ["/over/","/privacy.html"]){
      const {context,page}=await open(browser,root,null,390,844,pad);
      try{
        const r=await page.evaluate(()=>({body:getComputedStyle(document.body).fontFamily,h1:getComputedStyle(document.querySelector("h1")).fontFamily,kort:document.querySelectorAll("ul.kort li").length,merk:/Merk en sitenaam|vaste merk- en sitenaam/.test(document.body.textContent)}));
        assert(/Instrument Sans/.test(r.body)&&/Bodoni Moda/.test(r.h1),pad+": gebruikt de siteletters niet: "+JSON.stringify(r));
        assert(!r.merk,pad+": merk- en sitenaamregel staat er nog");
        if(pad==="/privacy.html")assert.equal(r.kort,4,pad+": samenvatting in het kort ontbreekt");
        console.log("SAMENHANG "+pad+": siteletters"+(pad==="/privacy.html"?", samenvatting in vier punten":"")+".");
      }finally{await context.close();}
    }
    /* "Wis lokale gegevens" wist ook de weergavekeuze van deze sessie; de
       GA4-toestemmingskeuze blijft. Eigen context, dus eigen opslag. */
    {
      const {context,page,fouten}=await open(browser,root,null,390,844,"/privacy.html");
      try{
        await page.evaluate(()=>{
          localStorage.setItem("weerbriefing.ga4.consent.v1",JSON.stringify("geweigerd"));
          localStorage.setItem("weerbriefing.analytics.uit.v1","1");
          localStorage.setItem("weerbriefing.plaats",JSON.stringify({naam:"Utrecht"}));
          localStorage.setItem("weerbriefing.actiefThema",JSON.stringify("donker"));
          sessionStorage.setItem("weerbriefing.thema.sessie",JSON.stringify("donker"));
          document.documentElement.setAttribute("data-thema","donker");
        });
        await page.click("#wis");
        await page.waitForFunction(()=>/gewist/.test(document.getElementById("wisstatus").textContent||""),null,{timeout:5000});
        const r=await page.evaluate(()=>({lokaal:Object.keys(localStorage).sort(),sessie:Object.keys(sessionStorage),
          consent:localStorage.getItem("weerbriefing.ga4.consent.v1"),thema:document.documentElement.getAttribute("data-thema")}));
        assert.deepEqual(r.lokaal,["weerbriefing.analytics.uit.v1","weerbriefing.ga4.consent.v1"],"/privacy.html: wissen laat lokale gegevens staan of wist de GA4-keuze of statistiekenafmelding: "+r.lokaal.join(", "));
        assert.equal(r.consent,JSON.stringify("geweigerd"),"/privacy.html: wissen verandert de GA4-toestemmingskeuze");
        assert.deepEqual(r.sessie,[],"/privacy.html: wissen laat de weergavekeuze van deze sessie staan: "+r.sessie.join(", "));
        assert.equal(r.thema,null,"/privacy.html: na wissen blijft de pagina in de gekozen weergave staan");
        assert.deepEqual(fouten,[],"/privacy.html: runtimefouten "+fouten.join(" | "));
        console.log("SAMENHANG /privacy.html: wissen haalt plaatsen, instellingen en sessiekeuze weg en houdt de GA4-keuze en de statistiekenafmelding.");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Samenhang OK: zes tegels, avondtegels voor morgen, pollenschaal per soort, Nachtzicht compact, dagkop, desktopgrafiek 24 uur, plaatsindex en subpagina's.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

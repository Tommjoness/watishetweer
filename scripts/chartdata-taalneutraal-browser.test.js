"use strict";

/* Uitklapbare grafiektabel (details#chartdata) in Nederlands en Engels, onafhankelijk van de volgorde van renderen en vertalen.

   Aanleiding (31 oktober 2026): vindVolledigeGrafiekTabel() (final-desktop-ui-runtime-20260902.js) zocht de uitklap op de Nederlandse tekst van
   haar samenvatting ("grafiekgegevens ... tabel"). Was de vertaallaag ("Chart data as a table") al klaar vóór de runtime opstartte, dan kreeg
   de samenvatting de klasse wiw-chartdata-summary niet: #chartdata was 18 px in plaats van 42 px hoog, het paneel naast de grafiek stond 24 px
   lager en de uurtabel had een rij minder. De uitklap wordt nu structureel gevonden (details#chartdata).

   De volgorde wordt afgedwongen in plaats van afgewacht:
   - "vertaling-eerst": de app-bundel wordt vastgehouden tot de vertaallaag klaar is (data-taal-klaar).
   - "app-eerst": de Engelse woordenlijst wordt vastgehouden tot de app haar tegels heeft opgezet.
   - "normaal": zonder ingreep.
   Elke gate wordt gecontroleerd: een gate die niet openging is een testfout, geen stille terugval. Nederlands heeft geen woordenlijst; daar
   zijn de drie volgordes de controle dat dezelfde gates niets veranderen. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};
const NU=Date.UTC(2026,6,22,12,10,0);
const VIEWPORTS=[{naam:"desktop 1440",width:1440,height:900},{naam:"desktop 1920",width:1920,height:1080}];
const VOLGORDES=["normaal","vertaling-eerst","app-eerst"];

function bouwServer(){
  const d=bouw({tempNu:11,wcNu:3,ccNu:60,rh:85,pp:u=>u>=16&&u<=19?60:10,pr:u=>u>=16&&u<=19?0.6:0,wc:u=>u>=16&&u<=19?61:3,cc:()=>60,som:2});
  d.latitude=52.3676;d.longitude=4.9041;d.elevation=3;d.minutely_15=null;
  Object.assign(d.current,{time:"2026-07-22T14:10",interval:900,visibility:16000});
  d.daily.sunshine_duration=d.daily.time.map(()=>3*3600);
  const air={current:{european_aqi:30,us_aqi:40},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const stub=`<script>Date.now=()=>${NU};window.fetch=async function(url){const u=String(url);
    const payload=u.includes('/api/neerslag')?${JSON.stringify({beschikbaar:false,reden:"test"})}:u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:${JSON.stringify(d)};
    return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};};
    try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
  html=html.replace("</head>",stub+"</head>");
  return http.createServer((req,res)=>{
    const p=(req.url||"").split("?")[0];
    if(p==="/"||p==="/index.html"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}
    const f=path.join(PUBLIC,p.replace(/^\//,""));
    if(f.startsWith(PUBLIC+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()){res.writeHead(200,{"content-type":mime[path.extname(f).toLowerCase()]||"application/octet-stream"});fs.createReadStream(f).pipe(res);}
    else{res.writeHead(404);res.end("not found");}
  });
}

function meet(){
  const det=document.querySelectorAll("details#chartdata");
  const d=det[0],sum=d&&d.querySelector(":scope > summary");
  const layout=document.getElementById("wiw-chart-layout"),main=document.querySelector(".wiw-chart-main");
  const tegels=document.querySelector(".final-top-grid>.stats");
  const rijen=[...document.querySelectorAll("#wiw-hour-table tbody tr")].filter(r=>r.getBoundingClientRect().height>0);
  return {
    aantalDetails:det.length,
    isDetails:!!d&&d.tagName==="DETAILS",
    heeftToegankelijkKlasse:!!d&&d.classList.contains("wiw-chartdata-accessible"),
    samenvattingEersteKind:!!sum&&d.firstElementChild===sum,
    samenvattingKlasse:!!sum&&sum.classList.contains("wiw-chartdata-summary"),
    open:!!d&&d.open,
    scrollRegio:!!d&&!!d.querySelector('.chartdata-scroll[role="region"][tabindex="0"]'),
    tabelRijen:d?d.querySelectorAll("tbody tr").length:0,
    hoogteChartdata:d?Math.round(d.getBoundingClientRect().height):-1,
    hoogteLayout:layout?Math.round(layout.getBoundingClientRect().height):-1,
    hoogteMain:main?Math.round(main.getBoundingClientRect().height):-1,
    dataTegels:tegels?tegels.getAttribute("data-tegels"):"",
    uurRijen:rijen.length,
    taalKlaar:document.documentElement.hasAttribute("data-taal-klaar")
  };
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  const srv=bouwServer();await new Promise(r=>srv.listen(0,"127.0.0.1",r));
  const resultaten={};let n=0;
  try{
    for(const vp of VIEWPORTS)for(const taal of ["nl","en"])for(const volgorde of VOLGORDES){
      const L=`${vp.naam} ${taal} ${volgorde}`;
      const ctx=await browser.newContext({viewport:{width:vp.width,height:vp.height},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
      const page=await ctx.newPage(),fouten=[];page.on("pageerror",e=>fouten.push(String(e)));
      const poorten={vertalingEerst:null,appEerst:null};
      if(taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
      try{
        if(volgorde==="vertaling-eerst"&&taal==="en"){
          await page.route(/\/app-[0-9a-f]+\.min\.js$/,async route=>{
            poorten.vertalingEerst=await page.waitForFunction(()=>document.documentElement.hasAttribute("data-taal-klaar"),null,{timeout:15000}).then(()=>"open").catch(()=>"verlopen");
            await route.continue();
          });
        }
        if(volgorde==="app-eerst"&&taal==="en"){
          await page.route(/\/taal-en-[0-9a-f]+\.js$/,async route=>{
            poorten.appEerst=await page.waitForFunction(()=>!!document.querySelector(".final-top-grid>.stats[data-tegels]"),null,{timeout:15000}).then(()=>"open").catch(()=>"verlopen");
            await route.continue();
          });
        }
        await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL`,{waitUntil:"domcontentloaded"});
        await page.waitForSelector("#wiw-hour-table tbody tr",{timeout:20000});
        if(taal==="en")await page.waitForFunction(()=>document.documentElement.hasAttribute("data-taal-klaar"),null,{timeout:15000});
        let m=null,vorige="",gelijk=0;
        for(let i=0;i<30&&gelijk<3;i++){await page.waitForTimeout(250);m=await page.evaluate(meet);const sleutel=JSON.stringify(m);gelijk=sleutel===vorige?gelijk+1:0;vorige=sleutel;}
        assert.ok(gelijk>=3,`${L}: de grafiektabel wordt niet stabiel`);
        if(taal==="en"&&volgorde==="vertaling-eerst")assert.equal(poorten.vertalingEerst,"open",`${L}: de vertaling was niet klaar vóór de app startte (testfout, geen bewijs voor de volgorde)`);
        if(taal==="en"&&volgorde==="app-eerst")assert.equal(poorten.appEerst,"open",`${L}: de app had haar tegels niet opgezet vóór de vertaling (testfout, geen bewijs voor de volgorde)`);
        assert.equal(m.taalKlaar,taal==="en",`${L}: vertaalstatus klopt niet`);

        assert.equal(m.aantalDetails,1,`${L}: er moet precies één details#chartdata zijn`);
        assert.ok(m.isDetails&&m.samenvattingEersteKind,`${L}: #chartdata is geen details met de samenvatting als eerste kind`);
        assert.ok(m.heeftToegankelijkKlasse,`${L}: details#chartdata mist wiw-chartdata-accessible`);
        assert.ok(m.samenvattingKlasse,`${L}: de samenvatting mist wiw-chartdata-summary (hoogte ${m.hoogteChartdata}px)`);
        assert.equal(m.open,false,`${L}: de grafiektabel moet dichtgeklapt starten`);
        assert.ok(m.scrollRegio,`${L}: de scrollregio met role=region en tabindex=0 ontbreekt`);
        assert.ok(m.tabelRijen>=24,`${L}: de alternatieve tabel heeft te weinig rijen (${m.tabelRijen})`);

        /* De uitklap werkt nog: openen en sluiten via de samenvatting, ook toetsenbord. */
        await page.click("details#chartdata > summary");
        assert.equal(await page.evaluate(()=>document.querySelector("details#chartdata").open),true,`${L}: klik op de samenvatting opent de tabel niet`);
        await page.click("details#chartdata > summary");
        assert.equal(await page.evaluate(()=>document.querySelector("details#chartdata").open),false,`${L}: tweede klik sluit de tabel niet`);
        await page.focus("details#chartdata > summary");await page.keyboard.press("Enter");
        assert.equal(await page.evaluate(()=>document.querySelector("details#chartdata").open),true,`${L}: Enter opent de tabel niet`);
        await page.keyboard.press("Enter");
        assert.equal(await page.evaluate(()=>document.querySelector("details#chartdata").open),false,`${L}: Enter sluit de tabel niet`);
        await page.waitForTimeout(300);
        const na=await page.evaluate(meet);
        assert.deepEqual({...na},{...m},`${L}: de grafiektabel of de hoogtes veranderen na openen en sluiten`);
        assert.deepEqual(fouten,[],`${L}: scriptfouten`);

        (resultaten[vp.naam]=resultaten[vp.naam]||{})[`${taal} ${volgorde}`]=m;
        n++;
      }finally{await ctx.close();}
    }
    /* Per breedte: dezelfde hoogtes en tabelinhoud in elke taal en volgorde. Het aantal uurrijen hangt ook af van de tegelrij erboven (een
       andere zaak); het wordt daarom vergeleken binnen situaties met dezelfde tegelopbouw. */
    for(const [vpNaam,perSituatie] of Object.entries(resultaten)){
      const basis=perSituatie["nl normaal"],groepen={};
      for(const [sit,m] of Object.entries(perSituatie)){
        for(const k of ["hoogteChartdata","hoogteLayout","hoogteMain","tabelRijen","samenvattingKlasse","isDetails","scrollRegio"])
          assert.equal(m[k],basis[k],`${vpNaam}: ${sit} wijkt af van nl normaal op ${k} (${m[k]} tegenover ${basis[k]})`);
        (groepen[m.dataTegels]=groepen[m.dataTegels]||[]).push([sit,m.uurRijen]);
      }
      for(const [tegels,lijst] of Object.entries(groepen))
        assert.ok(lijst.every(([,r])=>r===lijst[0][1]),`${vpNaam}: bij ${tegels} tegels verschilt het aantal uurrijen per situatie: ${JSON.stringify(lijst)}`);
    }
  }finally{srv.close();await browser.close();}
  console.log(`Grafiektabel taalneutraal: ${n} situaties (2 breedtes, NL en EN, 3 volgordes van renderen en vertalen): details#chartdata met wiw-chartdata-accessible en wiw-chartdata-summary, dicht bij start, openen en sluiten met klik en Enter, gelijke hoogtes van uitklap, grafiek en paneel, NL en EN gelijk.`);
})().catch(e=>{console.error(e);process.exit(1);});

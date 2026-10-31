"use strict";

/* Eerste scherm: dezelfde zes tegels in Nederlands en Engels, onafhankelijk van de volgorde van renderen en vertalen.

   Aanleiding (31 oktober 2026): de test uurtabel-ondervlak faalde in het Engels bij ongeveer de helft van de runs. Oorzaak: beperkTegels()
   (final-audit-runtime-20260901.js) zocht de tegel "Tijd tot zonsondergang" op haar Nederlandse koptekst. Is de vertaallaag ("Time until
   sunset") al klaar vóór de runtime opstart, dan werd de tegel niet gevonden en bleef staan: zeven tegels in vier kolommen in plaats van zes in
   drie, een lager paneel en een uurtabel met een rij minder. De tegel heeft nu een taalneutraal anker (#gust).

   De volgorde wordt hier afgedwongen in plaats van afgewacht:
   - "vertaling-eerst": de app-bundel wordt vastgehouden tot de vertaallaag klaar is (data-taal-klaar), dus de vertaling is af vóór de runtime start.
   - "app-eerst": de Engelse woordenlijst wordt vastgehouden tot de app haar tegels heeft opgezet, dus de vertaling komt pas na de eerste render.
   - "normaal": zonder ingreep.
   Elke gate wordt gecontroleerd: een gate die niet openging is een testfout, geen stille terugval op de normale volgorde. Nederlands heeft geen
   woordenlijst; de drie volgordes zijn daar de controle dat dezelfde gates niets veranderen. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};
const NU=Date.UTC(2026,6,22,12,10,0);
/* De zes zichtbare tegels, in volgorde, aangeduid met het id van hun waardeveld (taalneutraal), en de twee die bewust verborgen zijn:
   tijd tot zonsondergang (#gust, legacy id) en zicht (#vis). */
const ZICHTBAAR=["wind","prec","pop","hum","cloud","uv"];
const VERBORGEN=["gust","vis"];
const VIEWPORTS=[{naam:"desktop 1440",width:1440,height:900},{naam:"tablet 768",width:768,height:1024},{naam:"telefoon 390",width:390,height:844}];
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
  const stats=document.querySelector(".final-top-grid>.stats");
  const tegels=[...stats.children].filter(t=>t.classList.contains("stat"));
  const idVan=t=>{const w=t.querySelector(".sval[id]");return w?w.id:"";};
  const zichtbaar=tegels.filter(t=>!t.hidden&&getComputedStyle(t).display!=="none");
  const verborgen=tegels.filter(t=>t.hidden);
  return {
    dataTegels:stats.getAttribute("data-tegels"),
    zichtbaar:zichtbaar.map(idVan),
    verborgen:verborgen.map(idVan).sort(),
    verborgenMarkering:verborgen.every(t=>t.getAttribute("data-tegel-verborgen")==="1"),
    zichtbaarVoorVerborgen:tegels.findIndex(t=>t.hidden)===-1||tegels.slice(tegels.findIndex(t=>t.hidden)).every(t=>t.hidden),
    kolommen:getComputedStyle(stats).gridTemplateColumns.split(" ").length,
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
          /* De app-bundel start pas als de vertaling klaar is. */
          await page.route(/\/app-[0-9a-f]+\.min\.js$/,async route=>{
            poorten.vertalingEerst=await page.waitForFunction(()=>document.documentElement.hasAttribute("data-taal-klaar"),null,{timeout:15000}).then(()=>"open").catch(()=>"verlopen");
            await route.continue();
          });
        }
        if(volgorde==="app-eerst"&&taal==="en"){
          /* De woordenlijst komt pas als de app haar tegels heeft opgezet. */
          await page.route(/\/taal-en-[0-9a-f]+\.js$/,async route=>{
            poorten.appEerst=await page.waitForFunction(()=>!!document.querySelector(".final-top-grid>.stats[data-tegels]"),null,{timeout:15000}).then(()=>"open").catch(()=>"verlopen");
            await route.continue();
          });
        }
        await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL`,{waitUntil:"domcontentloaded"});
        await page.waitForFunction(()=>{const s=document.querySelector(".final-top-grid>.stats");return !!s&&s.hasAttribute("data-tegels")&&document.getElementById("t")&&document.getElementById("t").textContent.trim()!==""&&document.getElementById("t").textContent.trim()!=="--";},null,{timeout:20000});
        if(taal==="en")await page.waitForFunction(()=>document.documentElement.hasAttribute("data-taal-klaar"),null,{timeout:15000});
        /* Stabiel: drie opeenvolgende metingen zijn gelijk. */
        let m=null,vorige="",gelijk=0;
        for(let i=0;i<30&&gelijk<3;i++){await page.waitForTimeout(250);m=await page.evaluate(meet);const sleutel=JSON.stringify(m);gelijk=sleutel===vorige?gelijk+1:0;vorige=sleutel;}
        assert.ok(gelijk>=3,`${L}: de tegels worden niet stabiel`);
        if(taal==="en"&&volgorde==="vertaling-eerst")assert.equal(poorten.vertalingEerst,"open",`${L}: de vertaling was niet klaar vóór de app startte (testfout, geen bewijs voor de volgorde)`);
        if(taal==="en"&&volgorde==="app-eerst")assert.equal(poorten.appEerst,"open",`${L}: de app had haar tegels niet opgezet vóór de vertaling (testfout, geen bewijs voor de volgorde)`);
        assert.equal(m.taalKlaar,taal==="en",`${L}: vertaalstatus klopt niet`);

        assert.equal(m.dataTegels,"6",`${L}: data-tegels is ${m.dataTegels} in plaats van 6`);
        assert.deepEqual(m.zichtbaar,ZICHTBAAR,`${L}: zichtbare tegels (op id) wijken af`);
        assert.deepEqual(m.verborgen,[...VERBORGEN].sort(),`${L}: verborgen tegels (op id) wijken af; de zonsondergangstegel moet in elke taal verborgen zijn`);
        assert.ok(m.verborgenMarkering,`${L}: een verborgen tegel mist data-tegel-verborgen`);
        assert.ok(m.zichtbaarVoorVerborgen,`${L}: verborgen tegels staan niet achteraan`);

        /* Opnieuw renderen (zoals bij verversen of een nieuwe plaats) verandert niets, ook niet nadat de vertaling klaar is. */
        const opnieuw=await page.evaluate(()=>{if(typeof meters!=="function")return null;meters();return true;});
        assert.equal(opnieuw,true,`${L}: meters() is niet bereikbaar voor de hertekentest`);
        await page.waitForTimeout(600);
        const na=await page.evaluate(meet);
        assert.deepEqual({...na},{...m},`${L}: de tegels veranderen na opnieuw renderen`);
        assert.deepEqual(fouten,[],`${L}: scriptfouten`);

        (resultaten[vp.naam]=resultaten[vp.naam]||{})[`${taal} ${volgorde}`]=m;
        n++;
      }finally{await ctx.close();}
    }
    /* Nederlands en Engels, in elke volgorde, tonen exact dezelfde tegels en dezelfde opbouw. */
    for(const [vpNaam,perSituatie] of Object.entries(resultaten)){
      const basis=perSituatie["nl normaal"];
      for(const [sit,m] of Object.entries(perSituatie)){
        assert.deepEqual({...m,taalKlaar:undefined},{...basis,taalKlaar:undefined},`${vpNaam}: ${sit} wijkt af van nl normaal`);
      }
    }
  }finally{srv.close();await browser.close();}
  console.log(`Eerste scherm taalneutraal: ${n} situaties (3 breedtes, NL en EN, 3 volgordes van renderen en vertalen, opnieuw renderen): altijd dezelfde zes tegels (${ZICHTBAAR.join(", ")}), de zonsondergangstegel (#gust) en zicht verborgen en achteraan, data-tegels 6, NL en EN gelijk.`);
})().catch(e=>{console.error(e);process.exit(1);});

"use strict";

/* Fase 2b-2 (26 oktober 2026): drie correcties op het gebouwde artifact.
   1. "iJzel": een weersomschrijving die met "IJ" begint (IJzel, IJzelmotregen) werd midden in een zin met alleen de I
      verkleind ("Kleine kans op iJzel"). In het Nederlands hoort dat "ijzel" te zijn.
   2. Dagcontext in de grafiek: na middernacht stond in de tooltip en in de gesproken waarde van de schuif alleen "00:00".
      Die tijd krijgt nu "morgen" (Engels "Tomorrow"); vandaag blijft zonder voorvoegsel.
   3. Geen afgekapte of uitstekende omschrijvingen: de tooltip toont de omschrijving op een eigen regel binnen de doos, en de
      omschrijving in de zevendaagse lijst wordt vanaf 1100px niet meer met een ellips ingekort.
   Gecontroleerd in Nederlands en Engels, op telefoon, tablet en desktop. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};

function bouwServer(d,nu,tijd){
  const air={current:{european_aqi:30,us_aqi:40},hourly:{time:[tijd],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const stub=`<script>Date.now=()=>${nu};window.fetch=async function(url){const u=String(url);
    const payload=u.includes('/api/neerslag')?${JSON.stringify({beschikbaar:false,reden:"test"})}:u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[]})}:u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Amsterdam",land:"NL",bron:"test"})}:${JSON.stringify(d)};
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
const basis=(opts,tijd)=>{
  const d=bouw(opts);
  d.latitude=52.3676;d.longitude=4.9041;d.elevation=3;d.minutely_15=null;
  Object.assign(d.current,{time:tijd,interval:900,visibility:9000});
  d.daily.sunshine_duration=d.daily.time.map(()=>3*3600);
  return d;
};
async function open(browser,srv,taal,breedte,schema){
  const context=await browser.newContext({viewport:{width:breedte,height:900},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",colorScheme:schema||"light",serviceWorkers:"block"});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  if(taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
  await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL`,{waitUntil:"networkidle"});
  await page.waitForSelector("#chart text",{state:"attached",timeout:15000});
  await page.waitForTimeout(1000);
  return {context,page,fouten};
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let n=0;
  try{
    /* 1. iJzel: weercode 57 (IJzelmotregen) en 67 (IJzel), nu en later vandaag. */
    {
      const nu=Date.UTC(2026,6,22,12,10,0),tijd="2026-07-22T14:10";
      for(const [naam,code,huidig] of [["nu 67",67,true],["later 67",67,false],["nu 57",57,true],["later 57",57,false]]){
        const d=basis({tempNu:-1,wcNu:huidig?code:3,ccNu:90,rh:90,pp:u=>huidig?10:(u>=16&&u<=19?70:10),pr:u=>!huidig&&u>=16&&u<=19?0.6:0,wc:u=>huidig?code:(u>=16&&u<=19?code:3),cc:()=>90,som:2},tijd);
        const srv=bouwServer(d,nu,tijd);await new Promise(r=>srv.listen(0,"127.0.0.1",r));
        try{
          for(const breedte of [390,1440]){
            const {context,page,fouten}=await open(browser,srv,"nl",breedte);
            try{
              const t=await page.evaluate(()=>document.body.innerText+"\n"+[...document.querySelectorAll("[aria-label],[title]")].map(e=>(e.getAttribute("aria-label")||"")+" "+(e.getAttribute("title")||"")).join("\n"));
              const fout=[...t.matchAll(/.{0,30}\b[a-z]*iJ[a-z]*.{0,20}/g)].map(x=>x[0].replace(/\s+/g," "));
              assert.deepEqual(fout,[],`${naam} ${breedte}px: "iJ" met kleine i in de tekst`);
              assert.ok(/\b[Ii]jzel\w*/.test(t)||/\bIJzel\w*/.test(t),`${naam} ${breedte}px: de ijzelomschrijving staat niet op de pagina`);
              assert.deepEqual(fouten,[],`${naam} ${breedte}px: scriptfouten`);
              n++;
            }finally{await context.close();}
          }
        }finally{srv.close();}
      }
    }

    /* 2 + 3a. Tooltip en schuif om 23:30: de reeks loopt na middernacht door. Lange omschrijvingen blijven binnen de doos. */
    {
      const nu=Date.UTC(2026,6,22,21,30,0),tijd="2026-07-22T23:30";
      for(const code of [3,57,67,99]){
        const d=basis({tempNu:11,wcNu:code,ccNu:90,rh:90,pp:()=>40,pr:()=>0.3,wc:()=>code,cc:()=>90,som:2},tijd);
        const srv=bouwServer(d,nu,tijd);await new Promise(r=>srv.listen(0,"127.0.0.1",r));
        try{
          for(const [taal,breedte,schema] of [["nl",390,"light"],["en",390,"dark"],["nl",1440,"dark"],["en",1440,"light"],["nl",390,"dark"],["en",1440,"dark"]]){
            const L=`code ${code} ${taal} ${breedte}px ${schema}`;
            const {context,page,fouten}=await open(browser,srv,taal,breedte,schema);
            try{
              const lees=async k=>{
                await page.evaluate(k=>{const hit=document.querySelector('[role="slider"]');hit.focus();hit.dataset.keyboardIndex=String(k-1);hit.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));},k);
                await page.waitForTimeout(250);
                return page.evaluate(()=>{
                  const g=document.querySelector("#scrub"),teksten=[...g.querySelectorAll("text")],rc=g.querySelector("rect"),svg=document.querySelector("#chart");
                  const r=t=>t.getBoundingClientRect(),rb=r(rc),sb=r(svg);
                  /* Rijen: elk paar (label, waarde) staat op dezelfde regel, het label links en de waarde rechts van het midden van de doos,
                     en de regels staan van boven naar beneden. De desktop-compactie plaatst de teksten op volgorde en schoof bij een extra
                     regel labels en waarden door elkaar. */
                  const midden=(rb.left+rb.right)/2,rijen=[];
                  for(let k=1;k<=6;k++){
                    const lt=g.querySelector(`text[data-tip-rij="${k}"][data-tip-kol="label"]`),wt=g.querySelector(`text[data-tip-rij="${k}"][data-tip-kol="waarde"]`);
                    if(!lt||!wt){rijen.push({label:lt?lt.textContent:null,waarde:wt?wt.textContent:null,zelfdeRegel:false,labelLinks:false,waardeRechts:false,y:0});continue;}
                    const a=r(lt),b=r(wt);
                    rijen.push({label:lt.textContent,waarde:wt.textContent,zelfdeRegel:Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2)<=2,labelLinks:a.left<midden&&a.right<=b.left+0.5,waardeRechts:b.right>midden,y:(a.top+a.bottom)/2});
                  }
                  const sep=[...g.querySelectorAll("line")].find(l=>l.getAttribute("y1")===l.getAttribute("y2")),sepY=sep?sep.getBoundingClientRect().top:null;
                  const omschr=teksten[1]?r(teksten[1]):null,kopB=teksten[0]?r(teksten[0]):null;
                  return {rijen,aantal:teksten.length,
                    volgorde:omschr&&kopB&&sepY!==null?(kopB.bottom<=omschr.top+2&&omschr.bottom<=sepY+1&&rijen.every(x=>x.y>sepY)):false,
                    rijenOplopend:rijen.every((x,k)=>k===0||x.y>rijen[k-1].y),
                    kop:teksten[0]?teksten[0].textContent:"",omschrijving:teksten[1]?teksten[1].textContent:"",
                    tekstBinnenDoos:teksten.every(t=>r(t).left>=rb.left-0.5&&r(t).right<=rb.right+0.5),
                    doosBinnenGrafiek:rb.left>=sb.left-0.5&&rb.right<=sb.right+0.5,
                    vt:document.querySelector('[role="slider"]').getAttribute("aria-valuetext")};
                });
              };
              /* De reeks begint bij nu (23:30); punten na middernacht horen "morgen" te dragen, punten van vandaag niet. */
              const alle=[];for(let k=1;k<=8;k++)alle.push(await lees(k));
              const na=alle.find(x=>/^(morgen|Tomorrow) /.test(x.kop));
              assert.ok(na,`${L}: geen punt na middernacht met dagcontext gevonden (${alle.map(x=>x.kop).join(" | ")})`);
              assert.match(na.kop,taal==="en"?/^Tomorrow \d{2}:\d{2}$/:/^morgen \d{2}:\d{2}$/,`${L}: kop na middernacht is "${na.kop}"`);
              assert.match(na.vt,taal==="en"?/^tomorrow \d{2}:\d{2}, /:/^morgen \d{2}:\d{2}, /,`${L}: gesproken waarde na middernacht is "${na.vt}"`);
              alle.filter(x=>/^\d{2}:\d{2}$/.test(x.kop)).forEach(x=>assert.ok(!/morgen|tomorrow/i.test(x.vt),`${L}: gesproken waarde van vandaag heeft een dagvoorvoegsel: "${x.vt}"`));
              alle.forEach(x=>{
                assert.equal(x.aantal,14,`${L}: ${x.aantal} teksten in de tooltip (verwacht tijd, omschrijving en zes rijen van twee)`);
                assert.equal(x.rijen.length,6,`${L}: ${x.rijen.length} rijen`);
                const labels=x.rijen.map(y=>y.label).join("|");
                /* Elk label hoort bij zijn eigen soort waarde: de verwisseling van labels en waarden zou dit direct laten falen. */
                const soort=[/^-?\d+°C$/,/^-?\d+°C$/,/%/,/(km\/u|km\/h)/,/(km\/u|km\/h)$/,/^\d+%$/];
                x.rijen.forEach((y,k)=>assert.match(String(y.waarde),soort[k],`${L}: rij ${k+1} ("${y.label}") heeft waarde "${y.waarde}"`));
                assert.ok(/^(temperatuur|temperature)$/.test(x.rijen[0].label)&&/^(voelt als|feels like)$/.test(x.rijen[1].label)&&/^(neerslagkans|precip\. chance)$/.test(x.rijen[2].label)&&/^wind$/.test(x.rijen[3].label)&&/^(windstoten|gusts)$/.test(x.rijen[4].label)&&/^(bewolking|cloud cover)$/.test(x.rijen[5].label),`${L}: labels in de verkeerde volgorde: ${labels}`);
                assert.ok(x.rijen.every(y=>y.zelfdeRegel&&y.labelLinks&&y.waardeRechts),`${L}: label en waarde verwisseld of niet op dezelfde regel: ${JSON.stringify(x.rijen)}`);
                assert.ok(x.rijenOplopend&&x.volgorde,`${L}: tijd, omschrijving, scheidingslijn en rijen staan niet netjes onder elkaar`);
                                assert.ok(x.omschrijving.length>2,`${L}: omschrijving ontbreekt in de tooltip`);
                assert.ok(x.tekstBinnenDoos,`${L}: tekst steekt buiten de tooltip ("${x.kop}" / "${x.omschrijving}")`);
                assert.ok(x.doosBinnenGrafiek,`${L}: tooltip valt buiten de grafiek`);
              });
              assert.deepEqual(fouten,[],`${L}: scriptfouten`);
              n++;
            }finally{await context.close();}
          }
        }finally{srv.close();}
      }
    }

    /* 3b. Zevendaagse lijst: geen omschrijving afgekapt of ingekort, in beide talen op alle breedten. */
    {
      const nu=Date.UTC(2026,6,22,12,10,0),tijd="2026-07-22T14:10";
      const CODES=[99,67,57,96,86,45,48];
      const d=basis({tempNu:11,wcNu:3,ccNu:60,rh:80,pp:()=>30,pr:()=>0.2,wc:()=>3,cc:()=>60,som:2},tijd);
      d.daily.weather_code=d.daily.time.map((_,i)=>CODES[i%CODES.length]);
      const srv=bouwServer(d,nu,tijd);await new Promise(r=>srv.listen(0,"127.0.0.1",r));
      try{
        for(const taal of ["nl","en"])for(const breedte of [320,360,390,430,768,1099,1100,1180,1280,1366,1440,1920]){
          const L=`dagomschrijvingen ${taal} ${breedte}px`;
          const {context,page,fouten}=await open(browser,srv,taal,breedte);
          try{
            await page.waitForSelector("#days .row.day",{state:"attached",timeout:15000});
            const r=await page.evaluate(()=>[...document.querySelectorAll("#days .row.day:not(.kop) .dcond")].filter(e=>e.getBoundingClientRect().width>0).map(e=>{
              const cs=getComputedStyle(e);return {t:e.textContent.trim(),afgekapt:e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1,ellips:cs.textOverflow==="ellipsis"&&e.scrollWidth>e.clientWidth+1};}));
            assert.ok(r.length>=7,`${L}: ${r.length} omschrijvingen gevonden`);
            r.forEach(x=>assert.ok(!x.afgekapt&&!x.ellips,`${L}: omschrijving "${x.t}" wordt afgekapt`));
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${L}: horizontale overloop door het afbreken van omschrijvingen`);
            assert.deepEqual(fouten,[],`${L}: scriptfouten`);
            n++;
          }finally{await context.close();}
        }
      }finally{srv.close();}
    }
    console.log(`Fase 2b-2: ${n} situaties: geen "iJzel" met kleine i (NL, 390 en 1440px), dagcontext "morgen"/"Tomorrow" na middernacht in tooltip en gesproken waarde (4 weercodes, NL/EN, 390 en 1440px), omschrijving binnen de tooltip met labels links en waarden rechts (licht en donker), en geen afgekapte dagomschrijving of horizontale overloop (NL/EN, 320 tot 1920px).`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

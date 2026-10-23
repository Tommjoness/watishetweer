"use strict";

/* Kleine tekst op de weerpagina. De desktoplaag van 29 september bepaalt dat labels vanaf 1100px minimaal 12px zijn,
   maar twee onderdelen bleven op 11px staan (gemeten op het finale artifact):
   - de kop van de uurtabel (Tijd, Temperatuur, Neerslag, Wind) tussen 1100 en 1599px, terwijl de cellen eronder 12 en
     13,5px zijn (vanaf 1600px stond hij al op 12,5px);
   - de taalschakelaar EN/NL, op alle pagina's en breedtes 11px.
   De driewegkeuze Auto | Licht | Donker blijft bewust op 11px: de drie segmenten delen één typografische basis (bewaakt
   door preview-responsive-visual-browser.js) en vallen binnen de richtwaarde voor kleine labels.
   Deze test legt die ondergrens vast en bewaakt dat de grotere tekst niets laat overlopen of overlappen: geen
   horizontale paginascroll, de tabelkop wordt niet afgeknipt, de uurtabel houdt haar uren en de schakelaar blijft naast
   de merknaam binnen het scherm, in Nederlands en Engels. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};

const d=bouw({tempNu:18,wcNu:3,ccNu:60,rh:80,pp:u=>u>=16&&u<=19?60:10,pr:u=>u>=16&&u<=19?0.6:0,wc:u=>u>=16&&u<=19?61:3,cc:()=>60,som:2});
d.latitude=52.3676;d.longitude=4.9041;d.elevation=3;d.minutely_15=null;
Object.assign(d.current,{time:"2026-07-22T14:10",interval:900,visibility:16000});
d.daily.sunshine_duration=d.daily.time.map(()=>6*3600);
const air={current:{european_aqi:30,us_aqi:40},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const NU=Date.UTC(2026,6,22,12,10,0);

function bouwServer(){
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const stub=`<script>Date.now=()=>${NU};window.fetch=async function(url){const u=String(url);
    const payload=u.includes('/api/neerslag')?${JSON.stringify({beschikbaar:false,reden:"test"})}:u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Amsterdam",latitude:52.3676,longitude:4.9041,admin1:"Noord-Holland",country_code:"NL"}]})}:u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Amsterdam",land:"NL",bron:"test"})}:${JSON.stringify(d)};
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

function meet(page){
  return page.evaluate(()=>{
    const px=el=>el?parseFloat(getComputedStyle(el).fontSize):null;
    const zichtbaar=el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);return r.width>0&&r.height>0&&c.visibility!=="hidden"&&c.display!=="none";};
    const kopjes=[...document.querySelectorAll("#wiw-hour-table thead th")].filter(th=>zichtbaar(th)&&!th.querySelector(".wiw-visually-hidden")&&th.textContent.trim()&&!th.classList.contains("wiw-visually-hidden"));
    const taal=document.querySelector("a.taal-keuze"),auto=document.getElementById("thema-auto"),merk=document.querySelector(".mast h1");
    const tr=taal&&taal.getBoundingClientRect(),mr=merk&&merk.getBoundingClientRect();
    return {kopPx:kopjes.map(th=>px(th)),kopTekst:kopjes.map(th=>th.textContent.trim()),
      kopAfgeknipt:kopjes.map(th=>th.scrollWidth-th.clientWidth),
      kopHoogte:kopjes.map(th=>Math.round(th.getBoundingClientRect().height)),
      cellPx:px(document.querySelector("#wiw-hour-table tbody td .wiw-hour-secondary")||document.querySelector("#wiw-hour-table tbody td")),
      rijen:[...document.querySelectorAll("#wiw-hour-table tbody tr")].filter(zichtbaar).length,
      autoPx:px(auto),lichtPx:px(document.querySelector('[data-thema-handmatig="licht"]')),donkerPx:px(document.querySelector('[data-thema-handmatig="donker"]')),taalPx:px(taal),taalTekst:taal&&taal.textContent.trim(),
      taalBinnenScherm:!!tr&&tr.left>=0&&tr.right<=innerWidth,
      taalOverMerk:!!(tr&&mr)&&tr.left<mr.right&&tr.right>mr.left&&tr.top<mr.bottom&&tr.bottom>mr.top,
      paginaOverloop:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
      breedte:innerWidth};
  });
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let n=0;
  const srv=bouwServer();await new Promise(r=>srv.listen(0,"127.0.0.1",r));
  try{
    const GEVALLEN=[];
    for(const taal of ["nl","en"])for(const breedte of [320,390,768,1024,1100,1280,1366,1440,1536,1599,1600,1920]){
      if(taal==="en"&&![390,1280,1440].includes(breedte))continue;
      const L=`${taal} ${breedte}px`,desktop=breedte>=1100;
      const context=await browser.newContext({viewport:{width:breedte,height:1000},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
      try{
        const page=await context.newPage(),fouten=[];
        page.on("pageerror",e=>fouten.push(String(e)));
        if(taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
        await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL`,{waitUntil:"networkidle"});
        await page.waitForSelector("#wiw-hour-table tbody tr",{timeout:15000});
        await page.waitForTimeout(1200);
        const r=await meet(page);

        /* De taalschakelaar is overal minstens 12px, blijft binnen het scherm en ligt niet over de merknaam. */
        assert.ok(r.taalPx>=12,`${L}: taalschakelaar ${r.taalPx}px`);
        assert.equal(r.taalTekst,taal==="en"?"NL":"EN",`${L}: de schakelaar toont de andere taal`);
        assert.ok(r.taalBinnenScherm,`${L}: taalschakelaar binnen het scherm`);
        assert.equal(r.taalOverMerk,false,`${L}: taalschakelaar overlapt de merknaam niet`);
        /* Geen horizontale paginascroll door grotere tekst. */
        assert.ok(r.paginaOverloop<=0,`${L}: horizontale overloop ${r.paginaOverloop}px`);
        assert.ok(r.rijen>=7,`${L}: de uurtabel toont ${r.rijen} uren`);
        if(desktop){
          assert.ok(r.kopPx.length>=3,`${L}: uurtabelkop gevonden (${r.kopTekst})`);
          r.kopPx.forEach((px,i)=>assert.ok(px>=12,`${L}: kop "${r.kopTekst[i]}" is ${px}px`));
          r.kopAfgeknipt.forEach((w,i)=>assert.ok(w<=1,`${L}: kop "${r.kopTekst[i]}" wordt ${w}px afgeknipt`));
          /* Eén regel per kop: de grotere tekst maakt de tabelkop niet hoger. */
          assert.ok(Math.max(...r.kopHoogte)<=30,`${L}: tabelkop te hoog (${r.kopHoogte})`);
        }else{
          /* Onder 1100px verandert er niets aan de labelmaat van de rest (minimaal 11px). */
          r.kopPx.forEach((px,i)=>assert.ok(px>=11,`${L}: kop "${r.kopTekst[i]}" is ${px}px`));
        }
        /* De drie segmenten van de weergavekeuze delen één lettergrootte (en die blijft minimaal 11px). */
        assert.ok(r.autoPx>=11,`${L}: knop Auto ${r.autoPx}px`);
        assert.deepEqual([r.lichtPx,r.donkerPx],[r.autoPx,r.autoPx],`${L}: Auto/Licht/Donker delen één lettergrootte (${r.autoPx}/${r.lichtPx}/${r.donkerPx})`);
        assert.deepEqual(fouten,[],`${L}: scriptfouten`);
        GEVALLEN.push(`${L}: kop ${[...new Set(r.kopPx)].join("/")}px, Auto ${r.autoPx}px, ${r.taalTekst} ${r.taalPx}px, ${r.rijen} uren`);
        n++;
      }finally{await context.close();}
    }
    console.log(`Tekstgrootte bureaublad: ${n} situaties (NL/EN, 320 tot 1920px): uurtabelkop minimaal 12px vanaf 1100px en taalschakelaar minimaal 12px (overal), Auto/Licht/Donker één lettergrootte, zonder afgeknipte kop, overlap, extra tabelhoogte of horizontale scroll.`);
  }finally{srv.close();await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

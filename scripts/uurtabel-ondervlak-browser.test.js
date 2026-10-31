"use strict";

/* Uurtabel naast de desktopgrafiek: geen groot ongebruikt vlak onder de laatste rij, in Nederlands en Engels, op 1440 tot 1920px, met gewone,
   brede en stormwaarden ("12.4 mm 100% chance", "NW 9 Bft 88 km/h").

   Aanleiding (30 oktober 2026, controle van PR #575 vóór de merge): in het Engels vanaf 1600px kwamen er 9 rijen van 40px en bleef er 96px
   leeg paneel onder de tabel over (Nederlands: 14 rijen zonder rest). Oorzaak: het hoogtefilter (apply-hour-panel-refinement-20260907.js)
   meet de rijhoogte met alle 24 kandidaatrijen aanwezig. De tijdkolom is dan 70px breed door de datumregel van het middernachtuur
   ("Thu 23 Jul"), waardoor neerslag en wind in het Engels afbreken en alle rijen 49px worden. Het filter laat 9 rijen staan; zonder
   die datumregel (de middernachtrij valt weg) passen neerslag en wind weer op één regel en zijn de rijen 31px: 96px blijft leeg.
   Een controle die alleen het aantal volledige rijen telt, ziet dat niet: de rijen zijn volledig, er staan er alleen te weinig.

   Bewaakt wordt daarom: een minimum aantal volledige rijen per breedte, een ongebruikt vlak onder de laatste rij van hooguit 12px (kleiner
   dan een halve rij: er past dus nergens nog een rij bij), hetzelfde aantal rijen (±1) in Nederlands en Engels met dezelfde data, waarden
   op één regel vanaf 1600px, geen overloop of afgeknipte kop, en een grafiek die niet smaller wordt (aandeel 65 tot 72%). */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};
const NU=Date.UTC(2026,6,22,12,10,0);

const SCENARIOS={
  standaard:{},
  normaal:{tempNu:18,wcNu:3,ccNu:100,rh:80,pp:()=>0,pr:()=>0,wc:()=>3,cc:()=>100,som:0},
  breed:{tempNu:-12,wcNu:73,ccNu:100,rh:80,temp:u=>+(-16+2*Math.sin(u/24*2*Math.PI)).toFixed(1),pp:()=>45,pr:()=>0.4,wc:()=>73,cc:()=>100,ws:25,wg:()=>40,som:5},
  storm:{tempNu:18,wcNu:65,ccNu:100,rh:95,pp:()=>100,pr:()=>12.4,wc:()=>65,cc:()=>100,ws:88,wg:()=>131,som:60,zicht:400},
  /* Zwaarder dan wat in de kolom past ("WNW 10 Bft 105 km/h", "112.4 mm"): de waarden breken af, maar de rijen blijven gelijk en vullen het paneel. */
  extreem:{tempNu:-12,wcNu:65,ccNu:100,rh:95,temp:u=>+(-16+2*Math.sin(u/24*2*Math.PI)).toFixed(1),pp:()=>100,pr:()=>112.4,wc:()=>65,cc:()=>100,ws:105,wg:()=>131,som:60,zicht:400,richting:292}
};
/* Minimum aantal volledige rijen per dataset en breedte: het laagste van Nederlands en Engels, gemeten op 30 oktober 2026 (Amsterdam, viewport 1440x900 en
   vanaf 1600px 900 of 1080px hoog). Gewone en brede waarden staan vanaf 1600px op één regel; de extreme dataset breekt af (twee regels per waarde): het
   paneel is dan vol met 9 rijen van 49px, het gaat daar om het ontbreken van leeg vlak en niet om het aantal. */
const MIN_RIJEN={
  standaard:{1440:10,1600:13,1660:13,1920:13},
  normaal:{1440:9,1600:11,1660:11,1920:11},
  breed:{1440:10,1600:14,1660:14,1920:14},
  storm:{1440:10,1600:13,1660:13,1920:13},
  extreem:{1440:8,1600:9,1660:9,1920:9}
};
const MAX_GAT=12;

function bouwServer(opties){
  const d=bouw({tempNu:11,wcNu:3,ccNu:60,rh:85,pp:u=>u>=16&&u<=19?60:10,pr:u=>u>=16&&u<=19?0.6:0,wc:u=>u>=16&&u<=19?61:3,cc:()=>60,som:2,...opties});
  if(opties.richting)d.hourly.wind_direction_10m=d.hourly.wind_direction_10m.map(()=>opties.richting);
  d.latitude=52.3676;d.longitude=4.9041;d.elevation=3;d.minutely_15=null;
  Object.assign(d.current,{time:"2026-07-22T14:10",interval:900,visibility:opties.zicht||16000});
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
  const main=document.querySelector(".wiw-chart-main").getBoundingClientRect(),panel=document.getElementById("wiw-hour-panel").getBoundingClientRect();
  const rijen=[...document.querySelectorAll("#wiw-hour-table tbody tr")].filter(r=>r.getBoundingClientRect().height>0);
  const laatste=rijen[rijen.length-1].getBoundingClientRect(),sc=document.getElementById("wiw-hour-scroll"),kop=document.querySelector("#wiw-hour-table thead th:nth-child(3)");
  /* Rijen met een datumregel (middernacht) zijn bewust hoger; alle andere rijen zijn vanaf 1600px één regel. */
  const gewoneHoogtes=rijen.filter(r=>!r.querySelector(".wiw-hour-date")).map(r=>r.getBoundingClientRect().height);
  const eenRegel=rijen.slice(0,3).every(r=>[...r.querySelectorAll(".wiw-hour-rain,.wiw-hour-wind")].every(c=>{const p=c.querySelector(".wiw-hour-primary"),q=c.querySelector(".wiw-hour-secondary");if(!p||!q)return true;return Math.abs(p.getBoundingClientRect().top-q.getBoundingClientRect().top)<4;}));
  return {rijen:rijen.length,gat:main.bottom-laatste.bottom,hoogsteGewoneRij:Math.max(...gewoneHoogtes),mainW:main.width,aandeel:main.width/(main.width+panel.width),
    overloop:sc?sc.scrollWidth-sc.clientWidth:-1,thclip:kop?kop.scrollWidth-kop.clientWidth:-1,pagina:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,eenRegel,
    regen:(rijen[0].querySelector(".wiw-hour-rain")||{textContent:""}).textContent.replace(/\s+/g," ").trim()};
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let n=0;const rijenPerSituatie={};
  try{
    for(const [naam,opties] of Object.entries(SCENARIOS)){
      const srv=bouwServer(opties);await new Promise(r=>srv.listen(0,"127.0.0.1",r));
      try{
        for(const w of [1440,1600,1660,1920])for(const taal of ["nl","en"]){
          const ctx=await browser.newContext({viewport:{width:w,height:w===1920?1080:900},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
          const page=await ctx.newPage(),fouten=[];page.on("pageerror",e=>fouten.push(String(e)));
          if(taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
          const L=`${naam} ${taal} ${w}px`;
          try{
            const laad=async()=>{await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL`,{waitUntil:"networkidle"});
              await page.waitForSelector("#wiw-hour-table tbody tr",{timeout:20000});await page.waitForTimeout(1500);return page.evaluate(meet);};
            let m=await laad();
            /* Eén keer op ongeveer twaalf keer laden is het paneel 24px lager en staat er een rij minder (ook in main); dan maximaal twee keer opnieuw laden. */
            const minRijen=MIN_RIJEN[naam][w];
            for(let poging=0;poging<2&&(m.rijen<minRijen||m.gat>MAX_GAT);poging++)m=await laad();
            assert.ok(m.rijen>=minRijen,`${L}: ${m.rijen} volledige uurrijen (minimaal ${minRijen})`);
            assert.ok(m.gat<=MAX_GAT,`${L}: ${Math.round(m.gat)}px ongebruikt vlak onder de laatste uurrij (maximaal ${MAX_GAT}px; ${m.rijen} rijen)`);
            assert.ok(m.gat>=-1,`${L}: de laatste uurrij valt ${Math.round(-m.gat)}px buiten de grafiekhoogte`);
            assert.ok(m.overloop<=1,`${L}: uurtabel loopt ${m.overloop}px buiten haar kolom (${m.regen})`);
            assert.ok(m.thclip<=1,`${L}: kolomkop Temperatuur afgeknipt (${m.thclip}px)`);
            assert.ok(m.pagina<=1,`${L}: ${m.pagina}px horizontale paginascroll`);
            assert.ok(m.aandeel>=.65&&m.aandeel<=.72,`${L}: grafiekaandeel ${(m.aandeel*100).toFixed(1)}% buiten 65 tot 72%`);
            if(w>=1600&&naam!=="extreem"){
              assert.ok(m.eenRegel,`${L}: neerslag of wind staat niet op één regel per uur (${m.regen})`);
              assert.ok(m.hoogsteGewoneRij<=36,`${L}: een gewone uurrij is ${Math.round(m.hoogsteGewoneRij)}px hoog (afgebroken waarden?)`);
              assert.ok(m.mainW>=940,`${L}: de grafiek is ${Math.round(m.mainW)}px breed (minimaal 940px)`);
            }
            assert.deepEqual(fouten,[],`${L}: scriptfouten`);
            (rijenPerSituatie[`${naam} ${w}`]=rijenPerSituatie[`${naam} ${w}`]||{})[taal]=m.rijen;
            n++;
          }finally{await ctx.close();}
        }
      }finally{srv.close();}
    }
    for(const [k,v] of Object.entries(rijenPerSituatie))assert.ok(Math.abs(v.nl-v.en)<=1,`${k}px: Nederlands ${v.nl} en Engels ${v.en} uurrijen met dezelfde data verschillen meer dan 1`);
  }finally{await browser.close();}
  console.log(`Uurtabel zonder groot ongebruikt vlak: ${n} situaties (5 datasets, NL en EN, 1440/1600/1660/1920px): per dataset en breedte een minimum aan volledige rijen, hooguit ${MAX_GAT}px leeg onder de laatste rij, NL en EN gelijk aantal rijen, waarden op één regel vanaf 1600px, geen overloop, grafiekaandeel 65 tot 72%.`);
})().catch(e=>{console.error(e);process.exit(1);});

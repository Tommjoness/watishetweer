"use strict";

/* Zon-op- en zon-onder-labels op de telefoon (eigenaarsbeslissing na de productieverificatie van #565, 26 oktober 2026).
   Op een telefoon (tot en met 430px) staan de labels "zon op"/"zon onder" niet in de grafiek: #suntimes erboven noemt beide
   tijden al. Dat gold eerder alleen voor Nederlandse labels, omdat vereenvoudigMobieleZonband op Nederlandse tekst zocht en de
   vertaling naar het Engels later liep (race NL/EN). Nu worden ze herkend aan data-zon-label, in beide talen.
   Deze test eist, voor Nederlands en Engels, licht en donker, 320 tot en met 430px:
   - geen enkel zon-label in de grafiek, ook niet bij een vertraagde (gedrosselde) CPU en niet bij vertraagd renderen van #suntimes;
   - zowel de zon-op- als de zon-onder-tijd blijft zichtbaar in #suntimes boven de grafiek, ook gesproken (tekst staat in de DOM);
   - de zonlijnen in de nachtband blijven staan;
   - zolang #suntimes beide tijden nog niet toont, blijven de labels staan: er verdwijnt nooit een tijd;
   - vanaf 431px (tablet en desktop) blijven de labels in de grafiek, in beide talen. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};

/* [zon op, zon onder]; het venster begint om 00:13, dus beide vallen binnen de zichtbare 25 uur. */
const DAGEN=[["07:25","17:22"],["09:00","15:30"],["03:00","21:30"]];
const TELEFOON=[320,360,375,390,430],GROTER=[431,768,1440];
const air={current:{european_aqi:30,us_aqi:40},hourly:{time:["2026-07-22T00:13"],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const NU=Date.UTC(2026,6,21,22,13,0);

function bouwServer(zon){
  const d=bouw({tempNu:11,wcNu:3,ccNu:60,rh:80,pp:()=>10,pr:()=>0,wc:()=>3,cc:()=>60,som:2});
  d.latitude=52.3676;d.longitude=4.9041;d.elevation=3;d.minutely_15=null;
  Object.assign(d.current,{time:"2026-07-22T00:13",interval:900,visibility:16000});
  d.daily.sunshine_duration=d.daily.time.map(()=>2*3600);
  d.daily.sunrise=d.daily.time.map(t=>t+"T"+zon[0]);d.daily.sunset=d.daily.time.map(t=>t+"T"+zon[1]);
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const stub=`<script>Date.now=()=>${NU};window.fetch=async function(url){const u=String(url);
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


function meet(){
  const svg=document.querySelector("#chart"),st=document.getElementById("suntimes");
  const labels=[...svg.querySelectorAll("text[data-zon-label]")].map(t=>t.textContent.trim());
  const lijnen=[...svg.querySelectorAll("line")].filter(l=>l.getAttribute("x1")===l.getAttribute("x2")&&l.getAttribute("stroke-width")==="1"&&!l.closest("#scrub")).length;
  return {labels,lijnen,compact:svg.getAttribute("data-mobile-sun-band-compact")||"",suntimes:st?st.textContent.replace(/\s+/g," "):"",suntimesZichtbaar:!!(st&&st.getBoundingClientRect().height>0)};
}
const alsKaal=(r,zon,L)=>{
  assert.ok(r.suntimesZichtbaar,`${L}: #suntimes is niet zichtbaar`);
  [zon[0],zon[1]].forEach(t=>assert.ok(r.suntimes.includes(t),`${L}: tijd ${t} staat niet in #suntimes (${r.suntimes})`));
};

async function open(browser,srv,taal,breedte,schema,opties={}){
  const context=await browser.newContext({viewport:{width:breedte,height:900},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",colorScheme:schema,serviceWorkers:"block"});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  if(taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
  if(opties.cpu){const cdp=await context.newCDPSession(page);await cdp.send("Emulation.setCPUThrottlingRate",{rate:opties.cpu});}
  await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL`,{waitUntil:"networkidle"});
  await page.waitForSelector("#chart text",{state:"attached",timeout:30000});
  return {context,page,fouten};
}

/* Draait taken met een bovengrens aan gelijktijdige browsercontexten; de eerste fout stopt de test. */
async function parallel(taken,limiet){
  let volgende=0;
  await Promise.all(Array.from({length:limiet},async()=>{while(volgende<taken.length)await taken[volgende++]();}));
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let n=0;
  try{
    for(const [zi,zon] of DAGEN.entries()){
      const srv=bouwServer(zon);await new Promise(r=>srv.listen(0,"127.0.0.1",r));
      const taken=[];
      try{
        for(const taal of ["nl","en"])for(const schema of ["light","dark"]){
          /* 1. Telefoon: nooit een label in de grafiek, beide tijden in #suntimes. Met een traag gemaakte CPU (6x) alleen voor de eerste daglengte. */
          for(const breedte of TELEFOON)for(const cpu of (zi===0?[0,6]:[0])){
            taken.push(async()=>{
              const L=`${zon[0]}–${zon[1]} ${taal} ${schema} ${breedte}px${cpu?" cpu×"+cpu:""}`;
              const {context,page,fouten}=await open(browser,srv,taal,breedte,schema,{cpu});
              try{
                await page.waitForTimeout(cpu?2500:700);
                const r=await page.evaluate(meet);
                assert.deepEqual(r.labels,[],`${L}: zon-labels staan op de telefoon in de grafiek (${r.labels.join(" | ")})`);
                assert.equal(r.compact,"1",`${L}: marker data-mobile-sun-band-compact ontbreekt`);
                assert.ok(r.lijnen>=2,`${L}: de zonlijnen in de nachtband ontbreken (${r.lijnen})`);
                alsKaal(r,zon,L);
                assert.deepEqual(fouten,[],`${L}: scriptfouten`);
                n++;
              }finally{await context.close();}
            });
          }
          if(zi!==0)continue;
          /* 2. Telefoon, vertraagd renderen: #suntimes toont de tijden pas later. Zolang ze er niet staan blijven de labels staan;
                daarna verdwijnen ze, zonder dat een tijd ooit uit beeld is. */
          for(const breedte of [360,390])taken.push(async()=>{
            const L=`${zon[0]}–${zon[1]} ${taal} ${schema} ${breedte}px vertraagd #suntimes`;
            const {context,page,fouten}=await open(browser,srv,taal,breedte,schema);
            try{
              await page.waitForTimeout(700);
              await page.evaluate(()=>{
                const st=document.getElementById("suntimes"),d=Object.getOwnPropertyDescriptor(Element.prototype,"innerHTML");
                st.innerHTML="";
                Object.defineProperty(st,"innerHTML",{configurable:true,get(){return d.get.call(st);},set(v){setTimeout(()=>d.set.call(st,v),1500);}});
                window.etmaal(S.i0,S.bereik);
              });
              await page.waitForTimeout(700);
              const voor=await page.evaluate(meet);
              assert.equal(voor.labels.length,2,`${L}: zolang #suntimes leeg is moeten beide labels blijven staan (${voor.labels.join(" | ")}; #suntimes "${voor.suntimes}")`);
              await page.waitForTimeout(2200);
              const na=await page.evaluate(meet);
              assert.deepEqual(na.labels,[],`${L}: labels zijn niet verdwenen nadat #suntimes de tijden toont (${na.labels.join(" | ")})`);
              alsKaal(na,zon,L);
              assert.deepEqual(fouten,[],`${L}: scriptfouten`);
              n++;
            }finally{await context.close();}
          });
          /* 3. Tablet en desktop: de labels blijven in de grafiek. */
          for(const breedte of GROTER)taken.push(async()=>{
            const L=`${zon[0]}–${zon[1]} ${taal} ${schema} ${breedte}px`;
            const {context,page,fouten}=await open(browser,srv,taal,breedte,schema);
            try{
              await page.waitForTimeout(700);
              const r=await page.evaluate(meet);
              const tekst=r.labels.join(" | ");
              [zon[0],zon[1]].forEach(t=>assert.ok(tekst.includes(t),`${L}: tijd ${t} ontbreekt in de zon-labels (${tekst})`));
              assert.notEqual(r.compact,"1",`${L}: de telefoonopruiming draait ook op ${breedte}px`);
              assert.deepEqual(fouten,[],`${L}: scriptfouten`);
              n++;
            }finally{await context.close();}
          });
        }
        await parallel(taken,6);
      }finally{srv.close();}
    }
    console.log(`Zon-labels op de telefoon: ${n} situaties (3 daglengtes × NL/EN × licht/donker): geen labels in de grafiek tot en met 430px, beide tijden in #suntimes (ook bij gedrosselde CPU en vertraagd renderen), labels vanaf 431px behouden.`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

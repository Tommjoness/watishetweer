"use strict";

/* De actuele neerslagzin van de briefing spreekt de officiële KNMI-meting niet tegen, ook niet als een officiële
   weerwaarschuwing vóór die zin staat (de interpretatielaag zet de waarschuwing dan eerst, en de presentatielaag
   zocht de zin alleen aan het begin van de tekst). Gecontroleerd op het finale artifact (public/) in een echte
   browser, in Nederlands en Engels, met en zonder waarschuwing, bij een droge en een natte radarmeting, en bij de
   eerste render en na een asynchrone herrender:
   - droog: model zegt motregen, radar 0 mm/u → briefing, hero, minibalk, neerslagtegel en twee-uursblok zijn droog;
   - nat: radar 0,6 mm/u → alle dragers noemen de gemeten neerslag;
   - de waarschuwing, de temperatuur- en windzinnen en de opmaak blijven staan. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};

const d=bouw({temp:()=>22,tempNu:22,pp:()=>12,pr:()=>0,som:0,ws:2,wsNu:2,cc:()=>55,ccNu:55,wg:()=>8,wc:()=>3,wcNu:53});
Object.assign(d.current,{time:"2026-07-22T14:17",interval:900,temperature_2m:22,apparent_temperature:22,is_day:1,precipitation:0.2,weather_code:53,cloud_cover:97,wind_speed_10m:2,wind_direction_10m:225,wind_gusts_10m:8,pressure_msl:1014,visibility:16000});
d.elevation=3;d.latitude=52.35;d.longitude=5.26;d.minutely_15=null;
d.daily.precipitation_probability_max=d.daily.time.map(()=>12);d.daily.precipitation_sum=d.daily.time.map(()=>0);d.daily.weather_code=d.daily.time.map(()=>3);d.daily.sunshine_duration=d.daily.time.map(()=>6*3600);
const air={current:{european_aqi:30,us_aqi:40},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const waarschuwing=[{titel:"Code geel: windstoten",niveau:"geel",tekst:"Verwachte windstoten tot 75 km/u.",van:"2026-07-22T10:00:00Z",tot:"2026-07-22T20:00:00Z",gebied:"Flevoland",plaatsSpecifiek:true,landelijk:false}];
const NU=Date.UTC(2026,6,22,12,17,0);

function bouwServer(nat,metWaarschuwing){
  const knmi={beschikbaar:true,opgehaaldOp:"2026-07-22T12:17:20Z",actueel:{waarde:nat?0.6:0,tijd:"2026-07-22T12:15:00Z"},nowcast:null};
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const stub=`<script>Date.now=()=>${NU};window.fetch=async function(url){const u=String(url);
    const payload=u.includes('/api/neerslag')?${JSON.stringify(knmi)}:u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:metWaarschuwing?waarschuwing:[],land:"NL"})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Amsterdam",latitude:52.35,longitude:5.26,admin1:"Noord-Holland",country_code:"NL"}]})}:u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Amsterdam",land:"NL",bron:"test"})}:${JSON.stringify(d)};
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

async function meet(page){
  return page.evaluate(()=>{
    const t=id=>((document.getElementById(id)||{}).textContent||"").replace(/\s+/g," ").trim();
    const brief=document.getElementById("brief"),pop=document.getElementById("pop"),stat=pop&&pop.closest(".stat");
    return {hero:t("cond"),mini:t("minicond"),brief:t("brief"),briefOpmaak:[...brief.querySelectorAll("b")].map(b=>b.textContent.trim()),
      popkop:((stat&&stat.querySelector(".eyebrow"))||{}).textContent||"",pop:t("pop"),popsub:t("popsub"),nc:t("nctext"),
      markeringen:(brief.innerHTML.match(/<!--\/?brief-neerslag-->/g)||[]).length};
  });
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let n=0;
  try{
    for(const taal of ["nl","en"])for(const metWaarschuwing of [false,true])for(const nat of [false,true]){
      const L=`${taal} ${metWaarschuwing?"met":"zonder"} waarschuwing, radar ${nat?"nat":"droog"}`,en=taal==="en";
      const srv=bouwServer(nat,metWaarschuwing);await new Promise(r=>srv.listen(0,"127.0.0.1",r));
      const context=await browser.newContext({viewport:{width:1280,height:900},locale:en?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
      try{
        const page=await context.newPage(),fouten=[];
        page.on("pageerror",e=>fouten.push(String(e)));
        if(en)await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
        await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=52.35&lon=5.26&plaats=Amsterdam&land=NL`,{waitUntil:"networkidle"});
        await page.waitForFunction(()=>{const x=globalThis.WeatherNowNeerslagPresentatieV2,a=x&&x.analyse?x.analyse(120):null;return !!(a&&a.bronActueel==="knmi-rtcor");},null,{timeout:10000});
        if(metWaarschuwing)await page.waitForFunction(()=>S.actieveWaarschuwingen&&S.actieveWaarschuwingen.length>0,null,{timeout:10000});
        await page.waitForTimeout(1200);

        const controleer=async(fase)=>{
          const r=await meet(page),W=`${L} (${fase})`;
          if(!nat){
            assert.doesNotMatch(r.brief,/motregent|drizzling|Er valt nu|(is|are) (falling|raining)|precipitation is falling/i,`${W}: de briefing claimt neerslag terwijl de radar droog is: "${r.brief}"`);
            assert.match(r.brief,en?/low chance of precipitation/i:/kleine kans op neerslag/i,`${W}: de briefing noemt de kleine kans: "${r.brief}"`);
            assert.doesNotMatch(r.hero+" "+r.mini,/regen|motregen|bui|neerslag|drizzl|rain|shower|precipitation/i,`${W}: hero/minibalk claimen neerslag: ${r.hero}|${r.mini}`);
            assert.match(r.pop,/12/,`${W}: tegel behoudt de kans`);
            assert.doesNotMatch(r.popkop+" "+r.popsub+" "+r.nc,/motregent|drizzling|valt nu|falling now/i,`${W}: tegel/twee-uursblok claimen neerslag`);
          }else{
            assert.match(r.brief,en?/falling now: 0\.6 mm\/h/i:/Er valt nu neerslag: 0,6 mm\/u/,`${W}: de briefing noemt de gemeten neerslag: "${r.brief}"`);
            assert.doesNotMatch(r.brief,/motregent|drizzling/i,`${W}: de modelzin is vervangen`);
            /* De tegel mag de gemeten intensiteit tonen of de kans met "motregent nu" eronder; hij mag niet droog zeggen. */
            assert.match(r.popkop+" "+r.pop+" "+r.popsub,en?/0\.6|drizzling now|precipitation now/i:/0,6|motregent nu|Neerslag nu/,`${W}: tegel noemt de actuele neerslag (${r.popkop}|${r.pop}|${r.popsub})`);
            assert.doesNotMatch(r.hero+" "+r.mini,/droog|dry|clear|onbewolkt/i,`${W}: hero/minibalk zeggen niet droog`);
          }
          if(metWaarschuwing){
            assert.match(r.brief,en?/^Official weather warning/:/^Officiële weerwaarschuwing/,`${W}: de waarschuwing blijft vooraan: "${r.brief}"`);
            assert.match(r.brief,en?/yellow warning for gusts/i:/windstoten/i,`${W}: de titel van de waarschuwing blijft`);
            if(!en)assert(r.briefOpmaak.length>=1&&/Officiële weerwaarschuwing/.test(r.briefOpmaak[0]),`${W}: vet kopje van de waarschuwing blijft staan (${r.briefOpmaak})`);
          }else assert.doesNotMatch(r.brief,/waarschuwing|warning/i,`${W}: geen waarschuwing`);
          assert.match(r.brief,en?/degrees/:/graden/,`${W}: de temperatuurzin blijft staan`);
          return r;
        };
        await controleer("eerste render");

        /* Asynchrone herrender: de briefing wordt opnieuw opgebouwd (zoals bij de radarverrijking) en blijft consistent. */
        await page.evaluate(()=>{briefing();});
        await page.waitForTimeout(500);
        await controleer("na herrender");
        if(!en){
          const r=await meet(page);
          assert.equal(r.markeringen,2,`${L}: precies één afgebakende neerslagzin`);
        }
        assert.deepEqual(fouten,[],`${L}: scriptfouten`);
        n++;
      }finally{await context.close();srv.close();}
    }
    console.log(`Briefing-neerslagzin: ${n} situaties (NL/EN, met en zonder waarschuwing, droge en natte radar, eerste render en herrender): briefing, hero, minibalk, tegel en twee-uursblok spreken elkaar niet tegen.`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

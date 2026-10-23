"use strict";

/* De briefingzin over een maximum waarvan het uur al voorbij is. De uurwaarde van een verstreken uur blijft een
   modelwaarde, geen meting. De zin was "Het verwachte maximum lag vandaag rond 13:00 op 12 graden": verwacht en
   verleden tijd in één zin klinkt onnatuurlijk, maar het als waarneming presenteren ("Vandaag was het rond 13:00
   het warmst") zou een voorspelling als meting voorstellen. Nu: "Volgens de verwachting was het vandaag rond 13:00
   het warmst, met 12 graden." / "According to the forecast, today's high was 12 degrees, reached at around 13:00."
   Gecontroleerd op het finale artifact (public/) in een echte browser, NL en EN, bij droog weer, motregen, buien,
   harde wind, hitte, 's nachts, 's avonds en met een officiële waarschuwing:
   - tijd en temperatuur in de zin zijn het uur en de waarde van het hoogste punt van de uurreeks van vandaag;
   - vóór het maximum, 's nachts en 's avonds blijven de toekomstzinnen ongewijzigd;
   - de overige zinnen (neerslag, temperatuur vannacht, wind, waarschuwing) en de opmaak blijven staan;
   - de zin komt precies één keer voor en er ontbreekt geen Engelse vertaling. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};

const WAARSCHUWING=[{titel:"Code geel: windstoten",niveau:"geel",tekst:"Verwachte windstoten tot 75 km/u.",van:"2026-07-22T10:00:00Z",tot:"2026-07-22T20:00:00Z",gebied:"Flevoland",plaatsSpecifiek:true,landelijk:false}];

/* Een dagcurve met het hoogste punt op `piekUur`: piek, dal 12 uur eerder. */
const curve=(piek,dal,piekUur)=>u=>+(dal+(piek-dal)*(1+Math.cos((u-piekUur)*Math.PI/12))/2).toFixed(1);

/* uur/minuut = lokale tijd (Europe/Amsterdam, UTC+2 in juli). verwacht = wat de zin over het maximum moet zijn. */
const SITUATIES=[
  {naam:"droog, maximum voorbij",uur:14,minuut:17,piek:12.4,dal:6,piekUur:13,opties:{wc:()=>3,wcNu:3,cc:()=>55,ccNu:55,pp:()=>8,pr:()=>0},
    nl:/Volgens de verwachting was het vandaag rond 13:00 het warmst, met 12 graden\./,en:/According to the forecast, today's high was 12 degrees, reached at around 13:00\./},
  {naam:"motregen, maximum voorbij",uur:15,minuut:5,piek:17.4,dal:11,piekUur:14,opties:{wc:()=>53,wcNu:53,cc:()=>100,ccNu:100,pp:()=>75,pr:()=>0.3,nu:0.2},
    nl:/Volgens de verwachting was het vandaag rond 14:00 het warmst, met 17 graden\./,en:/According to the forecast, today's high was 17 degrees, reached at around 14:00\./},
  {naam:"buien, maximum voorbij",uur:16,minuut:40,piek:19.6,dal:12,piekUur:13,opties:{wc:u=>u>=15&&u<=19?80:3,wcNu:80,cc:()=>90,ccNu:90,pp:()=>80,pr:u=>u>=15&&u<=19?1.4:0,nu:1.2},
    nl:/Volgens de verwachting was het vandaag rond 13:00 het warmst, met 20 graden\./,en:/According to the forecast, today's high was 20 degrees, reached at around 13:00\./},
  {naam:"harde wind, maximum voorbij",uur:14,minuut:30,piek:15.1,dal:8,piekUur:12,opties:{wc:()=>3,wcNu:3,cc:()=>70,ccNu:70,pp:()=>10,pr:()=>0,ws:45,wsNu:45,wg:()=>90},
    nl:/Volgens de verwachting was het vandaag rond 12:00 het warmst, met 15 graden\./,en:/According to the forecast, today's high was 15 degrees, reached at around 12:00\./},
  {naam:"hitte, maximum voorbij",uur:16,minuut:10,piek:36.4,dal:21,piekUur:15,opties:{wc:()=>0,wcNu:0,cc:()=>5,ccNu:5,pp:()=>0,pr:()=>0},
    nl:/Volgens de verwachting was het vandaag rond 15:00 het warmst, met 36 graden\./,en:/According to the forecast, today's high was 36 degrees, reached at around 15:00\./},
  {naam:"officiële waarschuwing, maximum voorbij",uur:14,minuut:17,piek:12.4,dal:6,piekUur:13,opties:{wc:()=>3,wcNu:3,cc:()=>55,ccNu:55,pp:()=>8,pr:()=>0},waarschuwing:true,
    nl:/Volgens de verwachting was het vandaag rond 13:00 het warmst, met 12 graden\./,en:/According to the forecast, today's high was 12 degrees, reached at around 13:00\./},
  /* Toekomst en andere tijden: ongewijzigd. */
  {naam:"nacht, maximum nog te komen",uur:2,minuut:10,piek:12.4,dal:6,piekUur:13,opties:{wc:()=>3,wcNu:3,cc:()=>20,ccNu:20,pp:()=>5,pr:()=>0},nacht:true,
    nl:/Het verwachte maximum ligt vandaag rond 13:00 op 12 graden\./,en:/Today's forecast high is 12 degrees at around 13:00\./,niet:true},
  {naam:"ochtend, maximum nog te komen",uur:9,minuut:30,piek:12.4,dal:6,piekUur:13,opties:{wc:()=>3,wcNu:3,cc:()=>55,ccNu:55,pp:()=>8,pr:()=>0},
    nl:/Het verwachte maximum ligt vandaag rond 13:00 op 12 graden\./,en:/Today's forecast high is 12 degrees at around 13:00\./,niet:true},
  {naam:"avond, nieuwe dag",uur:20,minuut:15,piek:12.4,dal:6,piekUur:13,opties:{wc:()=>3,wcNu:3,cc:()=>55,ccNu:55,pp:()=>8,pr:()=>0},
    nl:/Morgen wordt het ongeveer 12 graden\./,en:/Tomorrow it will be about 12 degrees\./,niet:true}
];

function data(s){
  const d=bouw(Object.assign({temp:curve(s.piek,s.dal,s.piekUur),tempNu:undefined,som:0,wg:()=>8},s.opties));
  const tijd=`2026-07-22T${String(s.uur).padStart(2,"0")}:${String(s.minuut).padStart(2,"0")}`;
  const nuTemp=curve(s.piek,s.dal,s.piekUur)(s.uur+s.minuut/60);
  Object.assign(d.current,{time:tijd,interval:900,temperature_2m:nuTemp,apparent_temperature:nuTemp,is_day:s.nacht?0:1,pressure_msl:1014,visibility:16000});
  d.elevation=3;d.latitude=52.35;d.longitude=5.26;d.minutely_15=null;
  d.daily.sunshine_duration=d.daily.time.map(()=>6*3600);
  /* Dagmaximum en -minimum horen bij dezelfde curve als de uurreeks (bouw() zet ze vast op 20 en 14). */
  d.daily.temperature_2m_max=d.daily.time.map(()=>s.piek);d.daily.temperature_2m_min=d.daily.time.map(()=>s.dal);
  return d;
}

function bouwServer(s,d){
  const air={current:{european_aqi:30,us_aqi:40},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
  const NU=Date.UTC(2026,6,22,s.uur-2,s.minuut,0);
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const stub=`<script>Date.now=()=>${NU};window.fetch=async function(url){const u=String(url);
    const payload=u.includes('/api/neerslag')?${JSON.stringify({beschikbaar:false,reden:"test"})}:u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:s.waarschuwing?WAARSCHUWING:[],land:"NL"})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Almere",latitude:52.35,longitude:5.26,admin1:"Flevoland",country_code:"NL"}]})}:u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Almere",land:"NL",bron:"test"})}:${JSON.stringify(d)};
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

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let n=0;
  try{
    for(const taal of ["nl","en"])for(const s of SITUATIES){
      const en=taal==="en",L=`${taal}: ${s.naam}`,d=data(s);
      /* Het hoogste punt van de uurreeks van vandaag: dát moeten tijd en waarde in de zin zijn. */
      const vandaag=d.hourly.time.map((t,i)=>({t,v:d.hourly.temperature_2m[i]})).filter(x=>x.t.startsWith("2026-07-22"));
      const top=vandaag.reduce((a,b)=>b.v>a.v?b:a);
      assert.equal(top.t.slice(11,16),String(s.piekUur).padStart(2,"0")+":00",`${L}: testdata heeft het maximum op ${s.piekUur}:00`);

      const srv=bouwServer(s,d);await new Promise(r=>srv.listen(0,"127.0.0.1",r));
      const context=await browser.newContext({viewport:{width:1280,height:900},locale:en?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
      try{
        const page=await context.newPage(),fouten=[];
        page.on("pageerror",e=>fouten.push(String(e)));
        if(en)await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
        await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=52.35&lon=5.26&plaats=Almere&land=NL`,{waitUntil:"networkidle"});
        if(s.waarschuwing)await page.waitForFunction(()=>S.actieveWaarschuwingen&&S.actieveWaarschuwingen.length>0,null,{timeout:10000});
        await page.waitForTimeout(1500);
        const r=await page.evaluate(()=>({brief:(document.getElementById("brief").textContent||"").replace(/\s+/g," ").trim(),
          vet:[...document.querySelectorAll("#brief b")].map(b=>b.textContent.replace(/\s+/g," ").trim()),
          ontbreekt:[...(window.__WIW_TAAL_ONTBREEKT__||[])].filter(x=>document.body.textContent.replace(/\s+/g," ").includes(x))}));

        assert.match(r.brief,s[taal],`${L}: de zin over het maximum klopt: "${r.brief}"`);
        /* Tijd en waarde uit de zin zijn die van het hoogste punt. */
        /* De temperatuur in de verwachte zin is het afgeronde hoogste punt van de uurreeks (en het uur is dat van het hoogste punt). */
        assert.equal(Math.round(top.v),Math.round(s.piek),`${L}: testdata: het hoogste punt van de uurreeks is ${s.piek}`);
        assert.ok(s[taal].source.includes(String(Math.round(top.v))),`${L}: de verwachte zin noemt ${Math.round(top.v)} graden`);
        if(!s.niet)assert.ok(s[taal].source.includes(top.t.slice(11,16)),`${L}: de verwachte zin noemt het uur ${top.t.slice(11,16)} van het hoogste punt`);
        if(!s.niet){
          assert.doesNotMatch(r.brief,/verwachte maximum lag|forecast high was/i,`${L}: de onnatuurlijke oude formulering is weg`);
          assert.doesNotMatch(r.brief,en?/(?<!According to the forecast, )today's high was|it was warmest/i:/(?<!Volgens de verwachting )was het (vandaag )?rond \d{2}:\d{2} het warmst/,`${L}: het maximum wordt niet als waarneming gepresenteerd`);
          assert.equal((r.brief.match(en?/According to the forecast/g:/Volgens de verwachting/g)||[]).length,1,`${L}: de zin komt één keer voor`);
          assert(r.vet.some(b=>/^\d+ (graden|degrees)$/.test(b)),`${L}: de temperatuur blijft vet (${r.vet})`);
        }else{
          assert.doesNotMatch(r.brief,/Volgens de verwachting was het|According to the forecast, today's high was/,`${L}: geen verleden-tijdzin vóór of buiten het maximum`);
        }
        /* De overige zinnen blijven staan. */
        assert.match(r.brief,en?/(Tonight|tonight)/:/Vannacht|vannacht/,`${L}: de temperatuur van vannacht blijft staan: "${r.brief}"`);
        assert.match(r.brief,en?/degrees/:/graden/,`${L}: temperatuurzin aanwezig`);
        if(s.opties.ws===45)assert.match(r.brief,en?/gusts/i:/windstoten/i,`${L}: de windstootzin blijft staan: "${r.brief}"`);
        if(s.waarschuwing)assert.match(r.brief,en?/^Official weather warning/:/^Officiële weerwaarschuwing/,`${L}: de waarschuwing staat vooraan: "${r.brief}"`);
        else assert.doesNotMatch(r.brief,/waarschuwing|warning/i,`${L}: geen waarschuwing`);
        if(en)assert.deepEqual(r.ontbreekt.filter(t=>/verwachting|maximum|warmst|vannacht|windstoot/i.test(t)),[],`${L}: geen onvertaalde briefingzin`);
        assert.deepEqual(fouten,[],`${L}: scriptfouten`);
        n++;
      }finally{await context.close();srv.close();}
    }
    console.log(`Briefing verstreken maximum: ${n} situaties (NL/EN; droog, motregen, buien, harde wind, hitte, nacht, ochtend, avond en met officiële waarschuwing): de zin schrijft het maximum aan de verwachting toe, tijd en waarde zijn het hoogste punt van de uurreeks en de overige zinnen blijven gelijk.`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

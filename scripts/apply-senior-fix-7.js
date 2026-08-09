"use strict";

const fs=require("fs");
const path=require("path");
const {execFileSync}=require("child_process");
const ROOT=path.resolve(__dirname,"..");
const lees=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const schrijf=(p,s)=>{const f=path.join(ROOT,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s,"utf8");};

function exact(bron,zoek,vervang,label){
  const n=bron.split(zoek).length-1;
  if(n!==1) throw new Error(label+": verwacht precies één match, gevonden "+n);
  return bron.replace(zoek,vervang);
}
function vervangBestand(p,zoek,vervang,label){
  schrijf(p,exact(lees(p),zoek,vervang,label));
}

/* 1. Gebruik de huidige, reeds breed geteste productiecompiler één laatste keer.
   De gebouwde HTML bevat alle eerdere senior-hardening. We halen die semantiek
   terug naar index.html en interpretatie-engine.js, zodat daarna geen verborgen
   bron->productie-mutaties meer nodig zijn. */
execFileSync(process.execPath,[path.join(ROOT,"build-weather.js")],{cwd:ROOT,stdio:"inherit"});
const gebouwd=lees("public/index.html");
const beginMark="/* ===== CENTRALE INTERPRETATIE-ENGINE ===== */";
const eindMark="/* ===== EINDE CENTRALE INTERPRETATIE-ENGINE ===== */";
const b=gebouwd.indexOf(beginMark),e=gebouwd.indexOf(eindMark);
if(b<0||e<=b) throw new Error("Kan gebouwde interpretatielaag niet terugvinden.");
const binnen=gebouwd.slice(b+beginMark.length,e).replace(/^\n+|\n+$/g,"");
const helperMark="function weatherNowUurvak(tijd){";
const h=binnen.indexOf(helperMark);
if(h<0) throw new Error("Kan productiehelpers niet van de interpretatie-engine scheiden.");
const canoniekeEngine=binnen.slice(0,h).replace(/\s+$/,"")+"\n";
const helpers=binnen.slice(h).trim()+"\n\n";
const na=gebouwd.slice(e+eindMark.length).replace(/^\n+/,"");
const canoniekeIndex=gebouwd.slice(0,b)+helpers+na;
if(canoniekeIndex.includes(beginMark)||canoniekeIndex.includes("CENTRALE INTERPRETATIE-ENGINE")) throw new Error("Engine bleef dubbel in bron-index staan.");
schrijf("interpretatie-engine.js",canoniekeEngine);
schrijf("index.html",canoniekeIndex);

/* 2. Netwerklaag: een niet-kritische CAMS-aanvraag mag de kernverwachting nooit
   blokkeren. Elke fetch heeft een timeout en een nieuwe locatie annuleert oude
   weer/lucht-aanvragen echt, bovenop de bestaande generatiecheck. */
let index=lees("index.html");
index=exact(index,
'async function j(url){const r=await fetch(url);if(!r.ok)throw new Error("status "+r.status);return r.json();}',
`async function j(url,opt){
  opt=opt||{};
  const controller=new AbortController(),extern=opt.signal||null;
  const onAbort=()=>controller.abort();
  if(extern){if(extern.aborted)controller.abort();else extern.addEventListener("abort",onAbort,{once:true});}
  const timer=setTimeout(()=>controller.abort(),Number.isFinite(opt.timeoutMs)?opt.timeoutMs:10000);
  try{
    const r=await fetch(url,{signal:controller.signal});
    if(!r.ok)throw new Error("status "+r.status);
    return await r.json();
  }finally{
    clearTimeout(timer);
    if(extern)extern.removeEventListener("abort",onAbort);
  }
}`,
"fetch-timeout");
index=exact(index,'let laadTeller=0,waarschuwingTeller=0;',
'let laadTeller=0,waarschuwingTeller=0,actieveWeerController=null,actieveLuchtController=null;',
"requestcontrollers");
index=exact(index,
`  try{
    const [rf,ra]=await Promise.allSettled([j(f),j(a)]);
    let vol=rf.status==="fulfilled"?rf.value:null;
    if(!vol) vol=await j(fmin);
    if(mijnBeurt!==laadTeller) return;   // er is inmiddels een nieuwere plaats gekozen
    S.d=vol;
    S.air=ra.status==="fulfilled"?ra.value:null;
    S.op=Date.now(); if(!stil) S.dag=null;
    if(opslaan) ls.set(KEY_P,{lat:S.lat,lon:S.lon,label:label});
    ls.set(KEY_D,{d:S.d,air:S.air,label:label,lat:S.lat,lon:S.lon,op:S.op});
    tekenAlles();
    st.style.display="none";
    document.getElementById("app").style.display="block";
    urlBij();
  }catch(err){`,
`  if(actieveWeerController) actieveWeerController.abort();
  if(actieveLuchtController) actieveLuchtController.abort();
  const weerController=new AbortController(),luchtController=new AbortController();
  actieveWeerController=weerController;actieveLuchtController=luchtController;
  const luchtBelofte=j(a,{timeoutMs:7000,signal:luchtController.signal})
    .then(value=>({ok:true,value}),()=>({ok:false,value:null}));
  try{
    let vol=null;
    try{vol=await j(f,{timeoutMs:10000,signal:weerController.signal});}
    catch(e){
      if(mijnBeurt!==laadTeller) return;
      vol=await j(fmin,{timeoutMs:10000,signal:weerController.signal});
    }
    if(mijnBeurt!==laadTeller) return;   // er is inmiddels een nieuwere plaats gekozen
    S.d=vol;S.air=null;
    S.op=Date.now(); if(!stil) S.dag=null;
    if(opslaan) ls.set(KEY_P,{lat:S.lat,lon:S.lon,label:label});
    ls.set(KEY_D,{d:S.d,air:null,label:label,lat:S.lat,lon:S.lon,op:S.op});
    tekenAlles();
    st.style.display="none";
    document.getElementById("app").style.display="block";
    urlBij();
    luchtBelofte.then(result=>{
      if(mijnBeurt!==laadTeller||S.d!==vol) return;
      S.air=result.ok?result.value:null;
      ls.set(KEY_D,{d:S.d,air:S.air,label:S.label,lat:S.lat,lon:S.lon,op:S.op});
      lucht();
    });
  }catch(err){`,
"weer-render-zonder-luchtwacht");

/* 3. Kwartiergrens: de centrale analyse gebruikt de echte lokale minuut. De
   eerste gedeeltelijk toekomstige 15-minutenwaarde wordt in dezelfde verhouding
   getekend als waarin hij in de centrale som meetelt, nooit meer volledig. */
index=exact(index,'? api.analyseerNeerslagData(S.d,120) : null;',
'? api.analyseerNeerslagData(S.d,120,weatherNowActueleLokaleTijd()) : null;',
"nowcast echte minuut");
index=exact(index,'P.push(item.precipitation==null?null:item.precipitation);',
'P.push(item.precipitation==null?null:item.precipitation*item.fractie);',
"nowcast gedeeltelijk kwartier");

/* 4. De bron geeft uurvak-kansen; het product gebruikt daarom geen mathematisch
   exact klinkend label voor een rollend zestig-minutenvenster. */
index=exact(index,'<div class="eyebrow">Neerslagkans komend uur</div><div class="sval" id="pop">',
'<div class="eyebrow">Neerslagkans binnenkort</div><div class="sval" id="pop">',
"neerslagkanslabel");
schrijf("index.html",index);
let engine=lees("interpretatie-engine.js");
engine=exact(engine,'if(duurMin===60) return "het komende uur";',
'if(duurMin===60) return "de komende circa 60 minuten";',
"neerslagvenster circa");

/* 5. NWS-kleur is alleen onze visuele prioritering; MeteoAlarm-kleur mag wel als
   officiële kleur worden benoemd. */
engine=exact(engine,
`        const w=waars[0];
        voor="<b>Officiële "+esc(w.niveau||"weer")+" waarschuwing:</b> "+esc(w.titel)+". "+voor
          +" De officiële waarschuwing heeft voorrang op de modelverwachting.";`,
`        const w=waars[0];
        const waarschKop=w.niveauIsOfficieel===false
          ?"Officiële weerwaarschuwing"
          :"Officiële "+esc(w.niveau||"weer")+" waarschuwing";
        voor="<b>"+waarschKop+":</b> "+esc(w.titel)+". "+voor
          +" De officiële waarschuwing heeft voorrang op de modelverwachting.";`,
"bron-eigen waarschuwingsniveau");
schrijf("interpretatie-engine.js",engine);

let waars=lees("lib/waarschuwingen.cjs");
waars=exact(waars,
'      niveau: NIVEAU[i.severity] || "geel",\n      van: i.onset || i.effective || null,',
'      niveau: NIVEAU[i.severity] || "geel",\n      niveauIsOfficieel: false,\n      bronErnst: i.severity || null,\n      van: i.onset || i.effective || null,',
"NWS niveau metadata");
waars=exact(waars,
'        niveau: NIVEAU[i.severity] || NIVEAU[i.level] || "geel",\n        van: i.onset || i.effective || null,',
'        niveau: NIVEAU[i.severity] || NIVEAU[i.level] || "geel",\n        niveauIsOfficieel: true,\n        van: i.onset || i.effective || null,',
"MeteoAlarm CAP niveau metadata");
waars=exact(waars,
'      niveau: /rood|red/i.test(t) ? "rood" : /oranje|orange/i.test(t) ? "oranje" : "geel",\n      van: null, tot: null, gebied: null',
'      niveau: /rood|red/i.test(t) ? "rood" : /oranje|orange/i.test(t) ? "oranje" : "geel",\n      niveauIsOfficieel: true,\n      van: null, tot: null, gebied: null',
"MeteoAlarm Atom niveau metadata");
schrijf("lib/waarschuwingen.cjs",waars);

/* 6. Web-API adapters: stuur browsercache expliciet op revalidatie en geef de
   Vercel-CDN een eigen TTL-header. Dit vermijdt ambiguïteit rond door Vercel
   geconsumeerde s-maxage-directives. */
const adapter=naam=>`import legacyHandler from "../lib/${naam}.cjs";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const query = Object.fromEntries(url.searchParams.entries());
    let statusCode = 200;
    let body = null;
    const headers = new Headers();
    const response = {
      setHeader(name, value) { headers.set(name, String(value)); },
      status(code) { statusCode = Number(code); return response; },
      json(value) { body = value; return response; }
    };

    await legacyHandler({ query }, response);
    const internCache=headers.get("Cache-Control");
    if(internCache){
      headers.set("Vercel-CDN-Cache-Control",internCache);
      headers.set("Cache-Control","public, max-age=0, must-revalidate");
    }
    headers.set("Content-Type","application/json; charset=utf-8");
    return new Response(JSON.stringify(body), { status: statusCode, headers });
  }
};
`;
schrijf("api/plaatsnaam.mjs",adapter("plaatsnaam"));
schrijf("api/waarschuwingen.mjs",adapter("waarschuwingen"));

/* 7. Bouwarchitectuur: vanaf nu is bron == semantiek. De build kopieert, voegt
   alleen de expliciete enginebron in, controleert syntax/invarianten en versieert
   de serviceworker. Geen productie-hardening of zoek/vervang-logica meer. */
const nieuweBuild=`"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const crypto=require("crypto");
const ROOT=__dirname,OUT=path.join(ROOT,"public");
const NIET_PUBLICEREN=new Set([
  ".git",".github","api","lib","node_modules","public","scripts",
  "build-weather.js","interpretatie-engine.js","interpretatie-engine.test.js",
  "run.js","run-built-matrix.js","kern.js","data.js","package.json","package-lock.json","vercel.json"
]);
function intern(n){return NIET_PUBLICEREN.has(n)||n.endsWith(".test.js");}
function kopieer(bron,doel){
  const st=fs.statSync(bron);
  if(st.isDirectory()){
    fs.mkdirSync(doel,{recursive:true});
    for(const n of fs.readdirSync(bron))kopieer(path.join(bron,n),path.join(doel,n));
  }else{fs.mkdirSync(path.dirname(doel),{recursive:true});fs.copyFileSync(bron,doel);}
}
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
for(const n of fs.readdirSync(ROOT)){if(!intern(n))kopieer(path.join(ROOT,n),path.join(OUT,n));}
let html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
const engine=fs.readFileSync(path.join(ROOT,"interpretatie-engine.js"),"utf8");
const start="/* ---------- start ---------- */";
if((html.match(/\\/\\* ---------- start ---------- \\*\\//g)||[]).length!==1)throw new Error("Startmarker ontbreekt of is dubbel.");
if(html.includes("CENTRALE INTERPRETATIE-ENGINE"))throw new Error("Bron-index bevat de engine al.");
html=html.replace(start,"/* ===== CENTRALE INTERPRETATIE-ENGINE ===== */\\n"+engine+"\\n/* ===== EINDE CENTRALE INTERPRETATIE-ENGINE ===== */\\n\\n"+start);
const scripts=[...html.matchAll(/<script(?![^>]*\\ssrc=)[^>]*>([\\s\\S]*?)<\\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline script gevonden.");
scripts.forEach((s,i)=>new vm.Script(s,{filename:"public/index.html:inline-"+(i+1)}));
const vereist=[
  "WeatherNowInterpretatie","weatherNowActueleLokaleTijd","plaatsTijdDelen","weatherNowZoneOffset",
  "const eind=Math.min(i+25,h.time.length);","const punten=S.dag==null&&n===24?25:n;",
  "hoeveelheid onzeker","daily.weather_code&&daily.weather_code[dagIndex]","117.000001",
  "c.visibility!=null?c.visibility","weatherNowUurWaardeOp(\\\"pressure_msl\\\"","zoekGeneratie",
  "klokKalenderdag","Neerslagkans binnenkort","item.precipitation*item.fractie",
  "luchtBelofte","niveauIsOfficieel===false"
];
for(const x of vereist)if(!html.includes(x))throw new Error("Canonieke broninvariant ontbreekt: "+x);
fs.writeFileSync(path.join(OUT,"index.html"),html,"utf8");
const versie="weerbriefing-"+crypto.createHash("sha256").update(html).digest("hex").slice(0,12);
const swp=path.join(OUT,"sw.js");
if(fs.existsSync(swp)){
  let sw=fs.readFileSync(swp,"utf8").replace(/weerbriefing-(?:v\\d+|[0-9a-f]{12})/g,versie);
  if(!sw.includes(versie))throw new Error("Serviceworker-cacheversie niet toegepast.");
  fs.writeFileSync(swp,sw,"utf8");
}
for(const n of fs.readdirSync(OUT))if(intern(n))throw new Error("Intern bestand publiek gebouwd: "+n);
console.log("WeatherNow-build geslaagd: canonieke bron, deterministische assemblage, cache "+versie+".");
`;
schrijf("build-weather.js",nieuweBuild);
for(const p of ["productie-hardening-v2.js","productie-hardening.js"]){const f=path.join(ROOT,p);if(fs.existsSync(f))fs.unlinkSync(f);}

/* Browser-smoke blijft dependencyvrij maar draait nu mobiel én desktop. */
let browser=lees("browser-production.test.js");
const oudOnder=`const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-browser-"));
const fixture=path.join(dir,"index.html");fs.writeFileSync(fixture,html);
const url="file://"+fixture+"?lat=52.3500&lon=5.2600&plaats=Browsertest";
const r=spawnSync(browser,[
  "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",
  "--window-size=390,844","--virtual-time-budget=3000","--dump-dom",url
],{encoding:"utf8",maxBuffer:16*1024*1024});
fs.rmSync(dir,{recursive:true,force:true});

if(r.status!==0){console.error("FOUT echte browsertest: browser exit "+r.status+"\\n"+(r.stderr||"").slice(-2000));process.exit(1);}
const dom=r.stdout||"";
const waarde=naam=>{const m=new RegExp('data-'+naam+'="([^"]*)"').exec(dom);return m&&m[1];};
const resultaat=waarde("browser-test-result");
if(resultaat!=="ok"){
  console.error("FOUT echte browsertest: resultaat="+resultaat+", labels="+waarde("browser-labels")+", botsingen="+waarde("browser-botsingen")+", buiten="+waarde("browser-buiten")+", scrub="+waarde("browser-scrub")+", exception="+waarde("browser-exception"));
  process.exit(1);
}
console.log("Echte browserproductietest geslaagd: "+waarde("browser-labels")+" temperatuurlabels, 0 botsingen, tooltip binnen beeld.");`;
const nieuwOnder=`const dir=fs.mkdtempSync(path.join(os.tmpdir(),"weathernow-browser-"));
const fixture=path.join(dir,"index.html");fs.writeFileSync(fixture,html);
const url="file://"+fixture+"?lat=52.3500&lon=5.2600&plaats=Browsertest";
function voerBrowserUit(maat,naam){
  const r=spawnSync(browser,[
    "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--allow-file-access-from-files",
    "--window-size="+maat,"--virtual-time-budget=3000","--dump-dom",url
  ],{encoding:"utf8",maxBuffer:16*1024*1024});
  if(r.status!==0)throw new Error(naam+": browser exit "+r.status+" "+(r.stderr||"").slice(-1000));
  const dom=r.stdout||"";
  const waarde=veld=>{const m=new RegExp('data-'+veld+'="([^"]*)"').exec(dom);return m&&m[1];};
  if(waarde("browser-test-result")!=="ok")throw new Error(naam+": resultaat="+waarde("browser-test-result")+", labels="+waarde("browser-labels")+", botsingen="+waarde("browser-botsingen")+", buiten="+waarde("browser-buiten")+", scrub="+waarde("browser-scrub")+", exception="+waarde("browser-exception"));
  console.log("Echte browserproductietest "+naam+" geslaagd: "+waarde("browser-labels")+" labels, 0 botsingen, tooltip binnen beeld.");
}
try{voerBrowserUit("390,844","mobiel Chromium");voerBrowserUit("1440,1000","desktop Chromium");}
finally{fs.rmSync(dir,{recursive:true,force:true});}`;
browser=exact(browser,oudOnder,nieuwOnder,"dubbele Chromium-viewports");
schrijf("browser-production.test.js",browser);

/* Gerichte regressies voor deze ronde. */
const seniorTest=`"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),{pathToFileURL}=require("url");
const R=__dirname,lees=p=>fs.readFileSync(path.join(R,p),"utf8");
let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;console.log("OK  "+m);};
const index=lees("index.html"),engine=lees("interpretatie-engine.js"),build=lees("build-weather.js"),waars=lees("lib/waarschuwingen.cjs");
ok(!/productie-hardening/.test(build),"build verandert geen productsemantiek meer");
ok(!fs.existsSync(path.join(R,"productie-hardening-v2.js")),"oude semantische hardeninglaag is verwijderd");
ok(engine.includes("hoeveelheid onzeker")&&index.includes("117.000001"),"eerdere senior-fixes staan in canonieke bron");
ok(index.includes("luchtBelofte")&&!index.includes("Promise.allSettled([j(f),j(a)])"),"luchtkwaliteit blokkeert kernweer niet meer");
ok(index.includes("item.precipitation*item.fractie"),"gedeeltelijk verstreken kwartier wordt proportioneel verwerkt");
ok(index.includes("analyseerNeerslagData(S.d,120,weatherNowActueleLokaleTijd())"),"nowcast start op echte lokale minuut");
ok(index.includes("Neerslagkans binnenkort")&&engine.includes("de komende circa 60 minuten"),"uurkans vermijdt schijnprecisie");
ok(waars.includes("niveauIsOfficieel: false")&&waars.includes("niveauIsOfficieel: true"),"NWS-kleur wordt onderscheiden van officiële MeteoAlarm-kleur");
ok(engine.includes('w.niveauIsOfficieel===false'),"briefing noemt NWS-kleur niet officieel");
(async()=>{
  const oud=global.fetch;
  global.fetch=async url=>({ok:true,json:async()=>({address:{city:"Teststad"}}),text:async()=>""});
  try{
    const mod=await import(pathToFileURL(path.join(R,"api/plaatsnaam.mjs")).href+"?t="+Date.now());
    const r=await mod.default.fetch(new Request("https://example.test/api/plaatsnaam?lat=52.37&lon=4.90"));
    ok(r.headers.get("vercel-cdn-cache-control")==="s-maxage=86400, stale-while-revalidate=604800","plaatsnaam zet expliciete Vercel-CDN TTL");
    ok(r.headers.get("cache-control")==="public, max-age=0, must-revalidate","browser cachet dynamische plaatsnaam niet langdurig");
  }finally{global.fetch=oud;}
  console.log("Senior-7 regressies: "+n+" controles geslaagd.");
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
`;
schrijf("senior-7-regressions.test.js",seniorTest);

/* Playwright-test wordt alleen in de permanente CI aangeroepen. */
const pwTest=`"use strict";
const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");
const d=bouw({temp:(u,dag)=>18+8*Math.sin((u-7)/24*Math.PI*2)+(u===18&&dag===0?3:0),pp:(u,dag)=>dag===0&&u>=16&&u<=18?65:8,pr:(u,dag)=>dag===0&&u===17?0.5:0,cc:(u,dag)=>dag===0&&u>=17&&u<=19?75:25,wg:(u,dag)=>dag===0&&u===18?72:30});
d.current.interval=900;d.current.visibility=16000;d.elevation=3;d.latitude=52.35;d.longitude=5.26;d.daily.sunshine_duration=d.daily.time.map(()=>7.5*3600);
d.minutely_15={time:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[]};
for(let i=1;i<=20;i++){const t=new Date(Date.UTC(2026,6,22,14,0)+i*15*60000).toISOString().slice(0,16),nat=i>=9&&i<=11?0.12:0;d.minutely_15.time.push(t);d.minutely_15.precipitation.push(nat);d.minutely_15.rain.push(nat);d.minutely_15.showers.push(0);d.minutely_15.snowfall.push(0);d.minutely_15.weather_code.push(nat?61:3);}
const air={current:{european_aqi:22,us_aqi:45},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[4],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
let html=fs.readFileSync(path.join(__dirname,"public/index.html"),"utf8");
const stub=\`<script>window.fetch=async function(url){const u=String(url);const payload=u.includes('/api/waarschuwingen')?\${JSON.stringify({bron:"test",dekking:true,lijst:[]})}:u.includes('air-quality-api.open-meteo.com')?\${JSON.stringify(air)}:u.includes('geocoding-api.open-meteo.com')?\${JSON.stringify({results:[{name:"Amsterdam",latitude:52.37,longitude:4.90,admin1:"Noord-Holland",country_code:"NL"}]})}:u.includes('/api/plaatsnaam')?\${JSON.stringify({naam:"Browsertest",bron:"test"})}:\${JSON.stringify(d)};return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};};try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>\`;
html=html.replace("</head>",stub+"</head>");
const server=http.createServer((req,res)=>{const p=(req.url||"").split("?")[0];if(p==="/"||p==="/index.html"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}const f=path.join(__dirname,"public",p.replace(/^\//,""));if(fs.existsSync(f)&&fs.statSync(f).isFile()){res.writeHead(200);fs.createReadStream(f).pipe(res);}else{res.writeHead(404);res.end("not found");}});
(async()=>{await new Promise(r=>server.listen(0,"127.0.0.1",r));const port=server.address().port;try{for(const [naam,type] of [["Chromium",chromium],["WebKit",webkit]]){const b=await type.launch({headless:true});try{for(const [modus,viewport] of [["mobiel",{width:390,height:844}],["desktop",{width:1440,height:1000}]]){const page=await b.newPage({viewport});const fouten=[];page.on("pageerror",e=>fouten.push(String(e)));page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});await page.goto(\`http://127.0.0.1:\${port}/?lat=52.35&lon=5.26&plaats=Browsertest\`,{waitUntil:"networkidle"});await page.waitForSelector("#app",{state:"visible"});const resultaat=await page.evaluate(()=>{const chart=document.getElementById("chart"),labels=[...chart.querySelectorAll("text")].filter(el=>/^-?\\d+°$/.test((el.textContent||"").trim())&&String(el.getAttribute("font-family")||"").includes("Bodoni"));let bots=0;for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i].getBoundingClientRect(),b=labels[j].getBoundingClientRect();if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)bots++;}return {labels:labels.length,bots,over:document.documentElement.scrollWidth-window.innerWidth,brief:(document.getElementById("brief")||{}).textContent||"",days:document.querySelectorAll("#days .row.day:not(.kop)").length};});assert.ok(resultaat.labels>=5,naam+" "+modus+": te weinig labels");assert.equal(resultaat.bots,0,naam+" "+modus+": temperatuurlabels botsen");assert.ok(resultaat.over<=2,naam+" "+modus+": horizontale overflow");assert.ok(resultaat.brief&&resultaat.days>=7,naam+" "+modus+": kerninhoud ontbreekt");await page.fill("#q","Am");await page.waitForTimeout(450);await page.press("#q","ArrowDown");await page.press("#q","Enter");assert.equal(await page.inputValue("#q"),"Amsterdam",naam+" "+modus+": combobox toetsenbord");assert.deepEqual(fouten,[],naam+" "+modus+": console/page errors: "+fouten.join(" | "));await page.close();console.log("OK  "+naam+" "+modus);}}finally{await b.close();}}}finally{server.close();}})().catch(e=>{console.error(e&&e.stack||e);server.close();process.exit(1);});
`;
schrijf("browser-playwright.test.js",pwTest);

const pkg=JSON.parse(lees("package.json"));
for(const key of ["test","build"]){
  if(!pkg.scripts[key].includes("senior-7-regressions.test.js")){
    const anker="node audit-regressions.test.js";
    pkg.scripts[key]=pkg.scripts[key].replace(anker,anker+" && node senior-7-regressions.test.js");
  }
}
schrijf("package.json",JSON.stringify(pkg,null,2)+"\n");

/* Permanente kwaliteitspoort: gewone suite + echte Chromium/WebKit op twee viewports. */
const quality=`name: WeatherNow quality\non:\n  pull_request:\n  push:\n    branches:\n      - main\n      - agent/senior-fix-7-auditpunten\npermissions:\n  contents: read\njobs:\n  quality:\n    runs-on: ubuntu-latest\n    timeout-minutes: 20\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n          cache: npm\n      - run: npm ci\n      - run: npm test\n      - run: npm install --no-save playwright@1.55.0\n      - run: npx playwright install --with-deps chromium webkit\n      - run: node browser-playwright.test.js\n`;
schrijf(".github/workflows/quality.yml",quality);

/* Deze migrator en zijn trigger zijn éénmalig en mogen niet in de eindbranch blijven. */
const trigger=path.join(ROOT,".github/workflows/apply-senior-fix-7.yml");if(fs.existsSync(trigger))fs.unlinkSync(trigger);
const zelf=path.join(ROOT,"scripts/apply-senior-fix-7.js");
process.on("exit",()=>{try{fs.unlinkSync(zelf);const dir=path.dirname(zelf);if(fs.existsSync(dir)&&fs.readdirSync(dir).length===0)fs.rmdirSync(dir);}catch(e){}});
console.log("Senior-fix bronmigratie toegepast; nu volledige suite uitvoeren.");

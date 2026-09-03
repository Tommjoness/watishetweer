"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

function vulBronvelden(d,{rain=0,showers=0,snowfall=0,sunshine=6*3600}={}){
  const n=d.hourly.time.length;
  d.hourly.rain=Array(n).fill(rain);
  d.hourly.showers=Array(n).fill(showers);
  d.hourly.snowfall=Array(n).fill(snowfall);
  d.daily.sunshine_duration=d.daily.time.map(()=>sunshine);
  if(d.minutely_15){
    const m=d.minutely_15.time.length;
    d.minutely_15.rain=Array(m).fill(rain);
    d.minutely_15.showers=Array(m).fill(showers);
    d.minutely_15.snowfall=Array(m).fill(snowfall);
    d.minutely_15.weather_code=Array(m).fill(d.current.weather_code||0);
  }
  if(d.current.visibility===undefined){
    const i=d.hourly.time.findIndex(t=>String(t).slice(0,13)===String(d.current.time).slice(0,13));
    if(d.hourly.visibility)d.current.visibility=d.hourly.visibility[Math.max(0,i)];
  }
  return d;
}

function maakData({tz="Europe/Amsterdam",offset=7200,lat=52.35,lon=5.26,temp=18,rh=70,pp=10,pr=0,code=2,cloud=35,wind=14,gust=26,zicht=20000,som=0,regen=0,buien=0,sneeuw=0,poolzon=false}={}){
  const tempFn=typeof temp==="function"?temp:()=>temp;
  const d=bouw({temp:tempFn,tempNu:tempFn(14,0),rh,pp:()=>pp,pr:()=>pr,wc:()=>code,wcNu:code,cc:()=>cloud,ccNu:cloud,ws:wind,wsNu:wind,wg:()=>gust,zicht,som,poolzon});
  d.timezone=tz;d.utc_offset_seconds=offset;d.latitude=lat;d.longitude=lon;d.elevation=5;
  d.daily.weather_code=d.daily.time.map(()=>code);
  d.daily.precipitation_probability_max=d.daily.time.map(()=>pp);
  d.daily.precipitation_sum=d.daily.time.map(()=>som);
  const uren=d.hourly.temperature_2m.slice(24,48).filter(Number.isFinite);
  const max=uren.length?Math.max(...uren):tempFn(14,0),min=uren.length?Math.min(...uren):tempFn(14,0);
  d.daily.temperature_2m_max=d.daily.time.map(()=>max);
  d.daily.temperature_2m_min=d.daily.time.map(()=>min);
  return vulBronvelden(d,{rain:regen,showers:buien,snowfall:sneeuw,sunshine:cloud>=95?1*3600:7*3600});
}

const data={
  A:maakData({lat:52.35,lon:5.26,temp:19,code:2,pp:15}),
  B:maakData({tz:"Asia/Tokyo",offset:32400,lat:35.68,lon:139.69,temp:27,code:1,pp:5}),
  C:maakData({tz:"America/New_York",offset:-14400,lat:40.71,lon:-74.00,temp:24,code:3,pp:35,pr:0.2,som:1.2}),
  D:maakData({tz:"Africa/Johannesburg",offset:7200,lat:-33.92,lon:18.42,temp:16,code:2,pp:10}),
  G:maakData({tz:"Asia/Colombo",offset:19800,lat:7.29,lon:80.63,temp:28,code:2,pp:30,pr:0.1,som:0.4})
};
const dataMin=Object.fromEntries(Object.entries(data).map(([k,v])=>{const c=JSON.parse(JSON.stringify(v));delete c.minutely_15;return [k,c];}));

const air={
  A:{current:{european_aqi:11,us_aqi:18},hourly:{time:[data.A.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[1],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}},
  B:{current:{european_aqi:88,us_aqi:101},hourly:{time:[data.B.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[8],mugwort_pollen:[1],ragweed_pollen:[0],olive_pollen:[0]}},
  C:{current:{european_aqi:33,us_aqi:44},hourly:{time:[data.C.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[3],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}},
  D:{current:{european_aqi:22,us_aqi:30},hourly:{time:[data.D.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[2],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}},
  G:{current:{european_aqi:27,us_aqi:35},hourly:{time:[data.G.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[4],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}
};
function waarschuwing(titel,land){return {bron:"test",dekking:true,land,lijst:[{titel,tekst:"Testwaarschuwing.",niveau:"geel",van:"2026-07-22T12:00:00Z",tot:"2026-07-22T23:00:00Z",gebied:"test"}]};}
const warnings={A:waarschuwing("OUDE A-waarschuwing","NL"),B:waarschuwing("NIEUWE B-waarschuwing","JP"),C:{bron:"test",dekking:true,land:"US",lijst:[]},D:{bron:"test",dekking:true,land:"ZA",lijst:[]},G:{bron:"test",dekking:true,land:"LK",lijst:[]}};

const visuals={
  dry:maakData({temp:22,code:0,cloud:2,pp:0,pr:0,som:0}),
  smallchance:maakData({temp:21,code:2,cloud:40,pp:25,pr:0,som:0}),
  heavyrain:maakData({temp:16,code:65,cloud:100,pp:95,pr:5,som:35,regen:5,wind:28,gust:48}),
  snow:maakData({temp:-4,code:75,cloud:100,pp:90,pr:2,som:12,sneeuw:1.5,wind:20,gust:38}),
  freezing:maakData({temp:-1,code:67,cloud:100,pp:90,pr:1.2,som:8,regen:1.2,wind:18,gust:35}),
  thunder:maakData({temp:24,code:99,cloud:100,pp:95,pr:6,som:28,regen:4,buien:2,wind:35,gust:82}),
  heat:maakData({temp:u=>u>=12&&u<=17?39:30,rh:24,code:0,cloud:0,pp:0,pr:0,som:0,wind:6,gust:12}),
  frost:maakData({temp:-12,rh:72,code:1,cloud:10,pp:0,pr:0,som:0,wind:8,gust:15}),
  fog:maakData({temp:8,rh:100,code:45,cloud:100,pp:5,pr:0,som:0,zicht:200,wind:3,gust:6}),
  storm:maakData({temp:14,code:65,cloud:100,pp:95,pr:4,som:24,regen:4,wind:80,gust:125}),
  overcast:maakData({temp:18,code:3,cloud:100,pp:0,pr:0,som:0})
};

let html=fs.readFileSync(path.join(__dirname,"public/index.html"),"utf8");
const stub=`<script>
(function(){
  const data=${JSON.stringify(data)},dataMin=${JSON.stringify(dataMin)},air=${JSON.stringify(air)},warnings=${JSON.stringify(warnings)},visuals=${JSON.stringify(visuals)};
  const params=new URL(location.href).searchParams;
  const q=window.__q4={
    mode:params.get('mode')||'api',visual:params.get('visual')||'',
    counts:{full:{},min:{},air:{},warn:{},geocode:0,bdc:0,reverse:0},starts:[],
    holds:{air:{A:false},warn:{A:false}},pending:{air:[],warn:[]},
    fail:{full:{},min:{},air:{},warn:{}},bdcComplete:true,
    geo:{lat:7.2906,lon:80.6337,accuracy:18}
  };
  if(q.mode==='api'){q.holds.air.A=true;q.holds.warn.A=true;}
  if(params.get('failboot')==='1'){q.fail.full.G=true;q.fail.min.G=true;}
  const clone=x=>JSON.parse(JSON.stringify(x));
  const inc=(soort,key)=>{const o=q.counts[soort];o[key]=(o[key]||0)+1;};
  const mark=(soort,key)=>q.starts.push({soort,key,t:performance.now()});
  const slecht=status=>({ok:false,status:status||503,json:async()=>({}),text:async()=>''});
  const goed=payload=>({ok:true,status:200,json:async()=>clone(payload),text:async()=>JSON.stringify(payload)});
  const keyVan=u=>{
    const x=new URL(u,location.href),lat=Number(x.searchParams.get('latitude')||x.searchParams.get('lat'));
    if(lat>52&&lat<53)return 'A';if(lat>35&&lat<36)return 'B';if(lat>40&&lat<41)return 'C';if(lat<-33&&lat>-35)return 'D';return 'G';
  };
  const gate=(soort,key)=>{
    if(!(q.holds[soort]&&q.holds[soort][key]))return Promise.resolve();
    return new Promise(resolve=>q.pending[soort].push({key,resolve}));
  };
  window.__q4Release=(soort,key)=>{
    const lijst=q.pending[soort]||[],over=[];
    for(const item of lijst){if(!key||item.key===key)item.resolve();else over.push(item);}
    q.pending[soort]=over;
    if(q.holds[soort]&&key)q.holds[soort][key]=false;
  };
  window.fetch=async function(url,opt){
    const u=String(url),key=keyVan(u);
    if(u.includes('api.open-meteo.com/v1/forecast')){
      const full=new URL(u,location.href).searchParams.has('minutely_15'),soort=full?'full':'min';inc(soort,key);mark(soort,key);
      if(q.fail[soort][key])return slecht(503);
      const payload=q.visual&&visuals[q.visual]?visuals[q.visual]:(full?data[key]:dataMin[key]);return goed(payload||data.G);
    }
    if(u.includes('air-quality-api.open-meteo.com')){
      inc('air',key);mark('air',key);await gate('air',key);if(q.fail.air[key])return slecht(503);return goed(air[key]||air.G);
    }
    if(u.includes('/api/waarschuwingen')){
      inc('warn',key);mark('warn',key);await gate('warn',key);if(q.fail.warn[key])return slecht(503);return goed(warnings[key]||warnings.G);
    }
    if(u.includes('geocoding-api.open-meteo.com')){q.counts.geocode++;return goed({results:[{name:'Amsterdam',latitude:52.37,longitude:4.90,admin1:'Noord-Holland',country_code:'NL'}]});}
    if(u.includes('api.bigdatacloud.net/data/reverse-geocode-client')){q.counts.bdc++;return goed(q.bdcComplete?{city:'Kandy',countryCode:'LK'}:{city:'',locality:'',principalSubdivision:'',countryCode:''});}
    if(u.includes('/api/plaatsnaam')){q.counts.reverse++;return goed({naam:'Fallbackplaats',land:'LK',bron:'test'});}
    return goed({});
  };
  try{Object.defineProperty(navigator,'permissions',{configurable:true,value:{query:async()=>({state:'granted'})}});}catch(e){}
  try{Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(ok){setTimeout(()=>ok({coords:{latitude:q.geo.lat,longitude:q.geo.lon,accuracy:q.geo.accuracy}}),0);}}});}catch(e){}
  Date.now=()=>Date.UTC(2026,6,22,12,0,0);
})();
</script>`;
html=html.replace("</head>",stub+"</head>");

const server=http.createServer((req,res)=>{
  const pathname=(req.url||"").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}
  const rel=pathname.startsWith("/")?pathname.slice(1):pathname,file=path.join(__dirname,"public",rel);
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const ext=path.extname(file).toLowerCase(),types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(file).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

function tel(o,k){return Number(o&&o[k]||0);}
async function apiStress(browser,naam){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,serviceWorkers:"block"});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/?mode=api&lat=52.35&lon=5.26&plaats=Start+A&land=NL`,{waitUntil:"domcontentloaded"});
    await page.waitForSelector("#app",{state:"visible"});
    await page.waitForFunction(()=>__q4.pending.air.some(x=>x.key==='A')&&__q4.pending.warn.some(x=>x.key==='A'));
    const eerste=await page.evaluate(()=>({counts:__q4.counts,starts:__q4.starts.slice(),airPending:__q4.pending.air.length,warnPending:__q4.pending.warn.length,label:S.label}));
    assert.equal(tel(eerste.counts.full,'A'),1,naam+": koude load doet exact één volledige forecastaanvraag");
    assert.equal(tel(eerste.counts.min,'A'),0,naam+": gezonde forecast gebruikt geen fallback");
    assert.equal(tel(eerste.counts.air,'A'),1,naam+": koude load doet exact één luchtkwaliteitsaanvraag");
    assert.equal(tel(eerste.counts.warn,'A'),1,naam+": koude load doet exact één waarschuwingaanvraag");
    assert(eerste.airPending>0&&eerste.warnPending>0,naam+": weer-UI is zichtbaar terwijl lucht en waarschuwingen nog echt wachten");
    const sa=eerste.starts.find(x=>x.soort==='air'&&x.key==='A'),sf=eerste.starts.find(x=>x.soort==='full'&&x.key==='A');
    assert(sa&&sf&&Math.abs(sa.t-sf.t)<100,naam+": lucht en hoofdforecast starten parallel (<100 ms startverschil)");

    await page.evaluate(()=>{__q4Release('air','A');__q4Release('warn','A');});
    await page.waitForFunction(()=>S.air&&S.air.current&&S.air.current.european_aqi===11);
    await page.waitForFunction(()=>document.getElementById('waarschuwingen').textContent.includes('OUDE A-waarschuwing'));

    /* A rendert, maar lucht en waarschuwingen blijven kunstmatig hangen. B mag
       daarna winnen; zelfs als A later alsnog resolveert, mag niets terugspringen. */
    await page.evaluate(async()=>{__q4.holds.air.A=true;__q4.holds.warn.A=true;await load(52.36,5.27,'Oude A',false,true,'NL');});
    await page.waitForFunction(()=>__q4.pending.air.some(x=>x.key==='A')&&__q4.pending.warn.some(x=>x.key==='A'));
    await page.evaluate(async()=>{await load(35.68,139.69,'Nieuwe B',false,true,'JP');});
    await page.waitForFunction(()=>S.label==='Nieuwe B'&&S.air&&S.air.current&&S.air.current.european_aqi===88);
    await page.waitForFunction(()=>document.getElementById('waarschuwingen').textContent.includes('NIEUWE B-waarschuwing'));
    await page.evaluate(()=>{__q4Release('air','A');__q4Release('warn','A');});
    await page.waitForTimeout(80);
    const race=await page.evaluate(()=>({label:S.label,aq:S.air&&S.air.current&&S.air.current.european_aqi,warn:document.getElementById('waarschuwingen').textContent,lat:S.lat,lon:S.lon}));
    assert.equal(race.label,'Nieuwe B',naam+": late A wijzigt geselecteerde plaats niet");
    assert.equal(race.aq,88,naam+": late luchtkwaliteit A overschrijft B niet");
    assert(race.warn.includes('NIEUWE B-waarschuwing')&&!race.warn.includes('OUDE A-waarschuwing'),naam+": late waarschuwing A overschrijft B niet");
    assert(Math.abs(race.lat-35.68)<0.001&&Math.abs(race.lon-139.69)<0.001,naam+": race houdt coördinaten van B");

    /* Volledige forecast kapot: precies één minimale fallback en bruikbare UI. */
    const voorFallback=await page.evaluate(()=>JSON.parse(JSON.stringify(__q4.counts)));
    await page.evaluate(async()=>{__q4.fail.full.C=true;await load(40.71,-74.00,'Fallback C',false,true,'US');});
    await page.waitForFunction(()=>S.label==='Fallback C');
    const fallback=await page.evaluate(()=>({counts:__q4.counts,label:S.label,heeftKwartier:!!S.d.minutely_15,tekst:document.body.innerText,app:getComputedStyle(document.getElementById('app')).display}));
    assert.equal(tel(fallback.counts.full,'C')-tel(voorFallback.full,'C'),1,naam+": falende volledige forecast exact één poging");
    assert.equal(tel(fallback.counts.min,'C')-tel(voorFallback.min,'C'),1,naam+": daarna exact één minimale forecastfallback");
    assert.equal(fallback.heeftKwartier,false,naam+": fallback werkt echt zonder minutely_15");
    assert.notEqual(fallback.app,'none',naam+": minimale fallback houdt app zichtbaar");
    assert(!/NaN|undefined|\[object Object\]/.test(fallback.tekst),naam+": fallback lekt geen technische waarden");

    /* Lucht en waarschuwingen mogen afzonderlijk falen zonder weerdata te verliezen. */
    await page.evaluate(async()=>{__q4.fail.air.D=true;__q4.fail.warn.D=true;await load(-33.92,18.42,'Degradatie D',false,true,'ZA');});
    await page.waitForFunction(()=>/Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald/i.test(document.getElementById('waarschuwingen').textContent));
    await page.waitForTimeout(30);
    const degradatie=await page.evaluate(()=>({label:S.label,air:S.air,aq:document.getElementById('aq').textContent,warn:document.getElementById('waarschuwingen').textContent,temp:document.getElementById('t').textContent}));
    assert.equal(degradatie.label,'Degradatie D',naam+": falende nevenbronnen veranderen locatie niet");
    assert.equal(degradatie.air,null,naam+": netwerkfout luchtkwaliteit wordt geen synthetische data");
    assert(/niet beschikbaar/i.test(degradatie.aq),naam+": luchtkwaliteitfout wordt eerlijk gemeld");
    assert(/Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald/i.test(degradatie.warn),naam+": waarschuwingfout wordt eerlijk gemeld");
    assert(!/NaN|undefined/.test(degradatie.temp),naam+": hoofdweer blijft bruikbaar bij falende nevenbronnen");

    /* Beide forecastvarianten stuk: bestaande laatste briefing wordt expliciet
       hersteld in plaats van data onder de nieuwe plaatsnaam te laten staan. */
    await page.evaluate(async()=>{__q4.fail.full.G=true;__q4.fail.min.G=true;await load(1.23,2.34,'Defecte locatie',false,true,'XX');});
    const totaalFail=await page.evaluate(()=>{
      const state=document.getElementById('state');
      const compact=document.getElementById('locatie-laadstatus');
      const tekst=compact&&compact.querySelector('.locatie-status-tekst');
      const retry=compact&&compact.querySelector('.locatie-status-retry');
      return {
        label:S.label,
        melding:String(compact&&compact.hidden===false&&tekst?tekst.textContent:(state&&state.textContent)||''),
        klasse:state?state.className:'',
        retry:!!((retry&&!retry.hidden)||(state&&state.querySelector('button')))
      };
    });
    assert.equal(totaalFail.label,'Degradatie D',naam+": totale fout herstelt de laatst geldige briefing met eigen label");
    assert(/Defecte locatie/i.test(totaalFail.melding)&&/Degradatie D/i.test(totaalFail.melding),naam+": compacte foutmelding noemt doel en behouden bronlocatie");
    assert(totaalFail.retry,naam+": retry ontbreekt bij totale forecastfout met bestaande data");
    assert(!/err/.test(totaalFail.klasse),naam+": tijdelijke providerfout krijgt geen onterechte rode offline-status in de basisstate");

    /* Reverse geocoding: serverfallback alleen wanneer primaire bron onvolledig is. */
    await page.evaluate(()=>{__q4.fail.full.G=false;__q4.fail.min.G=false;__q4.bdcComplete=true;__q4.geo={lat:7.2906,lon:80.6337,accuracy:18};});
    const geoVoor=await page.evaluate(()=>({bdc:__q4.counts.bdc,reverse:__q4.counts.reverse}));
    assert.equal(await page.evaluate(()=>locatieNu('knop')),true,naam+": GPS met complete primaire reverse-geocode slaagt");
    const geoEen=await page.evaluate(()=>({bdc:__q4.counts.bdc,reverse:__q4.counts.reverse,label:S.label}));
    assert.equal(geoEen.bdc-geoVoor.bdc,1,naam+": complete GPS doet één primaire reverse-geocode");
    assert.equal(geoEen.reverse-geoVoor.reverse,0,naam+": complete primaire reverse-geocode doet geen serverfallback");
    assert.equal(geoEen.label,'Kandy',naam+": primaire reverse-geocode levert plaatsnaam");

    await page.evaluate(()=>{__q4.bdcComplete=false;__q4.geo={lat:6.9271,lon:79.8612,accuracy:20};});
    const geoTweeVoor=await page.evaluate(()=>({bdc:__q4.counts.bdc,reverse:__q4.counts.reverse}));
    assert.equal(await page.evaluate(()=>locatieNu('knop')),true,naam+": GPS met onvolledige primaire bron gebruikt fallback");
    const geoTwee=await page.evaluate(()=>({bdc:__q4.counts.bdc,reverse:__q4.counts.reverse,label:S.label}));
    assert.equal(geoTwee.bdc-geoTweeVoor.bdc,1,naam+": fallbackpad probeert primaire reverse-geocode één keer");
    assert.equal(geoTwee.reverse-geoTweeVoor.reverse,1,naam+": fallbackpad doet exact één serverreverse-geocode");
    assert.equal(geoTwee.label,'Fallbackplaats',naam+": serverfallback levert plaatsnaam");

    assert.deepEqual(fouten,[],naam+": API-stresspad zonder runtime/consolefouten");
  }finally{await context.close();}
}

async function geenCacheFout(browser,naam){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
  const page=await context.newPage(),fouten=[];page.on("pageerror",e=>fouten.push(String(e)));page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/?mode=fail&failboot=1&lat=1.23&lon=2.34&plaats=GeenCache&land=XX`,{waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>{
      const compact=document.getElementById('locatie-laadstatus');
      const compactTekst=compact&&compact.querySelector('.locatie-status-tekst');
      const state=document.getElementById('state');
      const melding=String(compact&&compact.hidden===false&&compactTekst?compactTekst.textContent:(state&&state.textContent)||'');
      return /Ophalen mislukt|duurt te lang|kon niet worden opgehaald|niet geladen/i.test(melding);
    });
    const r=await page.evaluate(()=>{
      const app=document.getElementById('app'),state=document.getElementById('state'),compact=document.getElementById('locatie-laadstatus');
      const compactTekst=compact&&compact.querySelector('.locatie-status-tekst');
      const compactRetry=compact&&compact.querySelector('.locatie-status-retry');
      const eigenaar=compact&&compact.hidden===false?compact:state;
      const appStijl=getComputedStyle(app),eigenaarStijl=eigenaar?getComputedStyle(eigenaar):null;
      return {
        state:String(compact&&compact.hidden===false&&compactTekst?compactTekst.textContent:(state&&state.textContent)||''),
        foutstatus:!!((compact&&compact.hidden===false&&compact.classList.contains('fout'))||(state&&state.classList.contains('err'))),
        retry:!!((compactRetry&&!compactRetry.hidden)||(state&&state.querySelector('button'))),
        appDisplay:appStijl.display,
        appVisibility:appStijl.visibility,
        stateDisplay:eigenaarStijl?eigenaarStijl.display:'none',
        stateVisibility:eigenaarStijl?eigenaarStijl.visibility:'hidden',
        heeftData:!!(typeof S!=='undefined'&&S.d)
      };
    });
    assert(/Ophalen mislukt|duurt te lang|kon niet worden opgehaald|niet geladen/i.test(r.state),naam+": totale forecastfout zonder cache geeft duidelijke melding");
    assert(r.foutstatus,naam+": fout zonder cache krijgt foutstatus");
    assert(r.retry,naam+": fout zonder cache biedt retry");
    assert.notEqual(r.appDisplay,'none',naam+": CLS-layout reserveert de app ook zonder geldige data");
    assert.equal(r.appVisibility,'hidden',naam+": zonder geldige data blijft de gereserveerde app visueel verborgen");
    assert.equal(r.heeftData,false,naam+": fout zonder cache mag geen geldige of stale S.d bevatten");
    assert.notEqual(r.stateDisplay,'none',naam+": foutmelding zonder cache blijft in de layout zichtbaar");
    assert.equal(r.stateVisibility,'visible',naam+": foutmelding zonder cache blijft visueel zichtbaar");
    assert.deepEqual(fouten,[],naam+": foutpad zonder cache veroorzaakt geen runtime/consolefout");
  }finally{await context.close();}
}

async function visueleStress(browser,naam){
  const breedtes=[320,360,375,390,430,1440];
  for(const scenario of Object.keys(visuals)){
    const context=await browser.newContext({viewport:{width:390,height:900},deviceScaleFactor:3,serviceWorkers:"block"});
    const page=await context.newPage(),fouten=[];page.on("pageerror",e=>fouten.push(String(e)));page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
    try{
      await page.goto(`http://127.0.0.1:${server.address().port}/?mode=visual&visual=${scenario}&lat=52.35&lon=5.26&plaats=${scenario}&land=NL`,{waitUntil:"networkidle"});
      await page.waitForSelector("#app",{state:"visible"});await page.evaluate(()=>document.fonts&&document.fonts.ready);
      for(const breedte of breedtes){
        await page.setViewportSize({width:breedte,height:900});await page.waitForTimeout(25);
        const r=await page.evaluate(()=>{
          const ids=[...document.querySelectorAll('[id]')].map(x=>x.id),dubbel=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
          return {overflow:document.documentElement.scrollWidth-window.innerWidth,tekst:document.body.innerText,dubbel,
            dagen:document.querySelectorAll('#days .row.day:not(.kop)').length,nachten:document.querySelectorAll('#nights .row.night:not(.kop)').length,
            weeknotities:document.querySelectorAll('#days .dag-neerslagnotitie').length,
            viewBox:(document.getElementById('chart')||{}).getAttribute?.('viewBox')||'',cloudsub:(document.getElementById('cloudsub')||{}).textContent||'',vis:(document.getElementById('vis')||{}).textContent||''};
        });
        assert(r.overflow<=2,`${naam} ${scenario} ${breedte}px: geen horizontale overflow (${r.overflow}px)`);
        assert.deepEqual(r.dubbel,[],`${naam} ${scenario} ${breedte}px: geen dubbele DOM-id's`);
        assert(!/NaN|undefined|\[object Object\]/.test(r.tekst),`${naam} ${scenario} ${breedte}px: geen technische waarden`);
        assert(!/Afgelopen 15 minuten|Afgelopen kwartier/.test(r.tekst),`${naam} ${scenario}: verwijderde recente-neerslagtekst blijft weg`);
        assert(/^0 0 \d+ \d+$/.test(r.viewBox),`${naam} ${scenario} ${breedte}px: grafiek heeft geldige viewBox`);
        assert.equal(r.dagen,7,`${naam} ${scenario}: zeven dagrijen blijven aanwezig`);
        assert(r.nachten>=1,`${naam} ${scenario}: Nachtzicht blijft renderen`);
        assert(!/Het wordt maximaal \d+ graden/i.test(r.tekst),`${naam} ${scenario}: geen tijdloze oude maximumtemperatuurclaim`);
        assert.equal(r.weeknotities,0,`${naam} ${scenario}: lange technische weeknotities blijven wereldwijd weg`);
        if(scenario==='dry')assert(!/0,0\s*mm/i.test(r.tekst),`${naam} droog: nutteloze 0,0 mm blijft verborgen`);
        if(scenario==='smallchance'){
          assert(/25%/.test(r.tekst),`${naam}: echte 25%-kans blijft zichtbaar`);
          assert(/0,0\s*mm/i.test(r.tekst),`${naam}: bekende 0,0 mm blijft naast niet-nul kans zichtbaar`);
          assert(!/25% kans met 0,0 mm/i.test(r.tekst)&&!/één decimaal|berekende dagsom|verschillende modelwaarden/i.test(r.tekst),`${naam}: 25% + 0,0 mm blijft compact zonder technische uitleg`);
        }
        if(scenario==='overcast')assert.equal(r.cloudsub.trim(),'Geheel bewolkt.',`${naam}: 100% bewolking exact benoemd`);
        if(scenario==='fog')assert(!/^\s*–/.test(r.vis),`${naam}: 200 meter zicht blijft geldige data`);
      }
      assert.deepEqual(fouten,[],`${naam} ${scenario}: geen runtime/consolefouten`);
    }finally{await context.close();}
  }
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    for(const [naam,type] of [["Chromium",chromium],["WebKit",webkit]]){
      const browser=await type.launch({headless:true});
      try{
        await apiStress(browser,naam);
        await geenCacheFout(browser,naam);
        await visueleStress(browser,naam);
      }finally{await browser.close();}
    }
    console.log("Checkpoint 100% browserstress geslaagd: requestaantallen/paralleliteit, forecastfallback, lucht- en waarschuwingraces/falen, reverse geocoding, totale uitval en 11 weerscenario's × 6 breedtes in Chromium/WebKit.");
  }finally{server.close();}
})().catch(err=>{console.error(err);process.exit(1);});
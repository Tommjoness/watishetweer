"use strict";
/*
 * Lichtvervuiling in Nachtzicht, in de echte build:
 *   - Nederlandse plaats: één regel onder de uitleg ("Lichtvervuiling in <plaats>"), met klasse, uitleg, korte bron
 *     zonder jaartal en een link naar /over/#lichtvervuiling;
 *   - Engels: volledig vertaald, geen onvertaalde tekst;
 *   - plaats buiten Nederland: geen regel en het databestand wordt niet geladen;
 *   - wisselen van Nederland naar het buitenland haalt de regel weg;
 *   - geen horizontaal scrollen op mobiel.
 */
const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const SCENARIO={
  /* 17:39, natte avond, 160 graspollen. */
  middag:{klok:"2026-07-22T15:39:00Z",meting:"2026-07-22T17:30",gras:160,
    temp:(u,dag)=>+(15.5+4.5*Math.sin((u-9)/24*Math.PI*2)-dag*0.4).toFixed(1),
    pp:(u,dag)=>dag===0&&u>=19&&u<=23?[40,70,80,65,30][u-19]:8,
    pr:(u,dag)=>dag===0&&u>=19&&u<=23?[0.2,1.4,2.1,0.8,0.1][u-19]:0},
  /* 22:40, na zonsondergang. */
  avond:{klok:"2026-07-22T20:40:00Z",meting:"2026-07-22T22:30",gras:12,
    temp:(u,dag)=>+(14+3.8*Math.sin((u-9)/24*Math.PI*2)-dag*0.2).toFixed(1),pp:()=>8,pr:()=>0},
  /* 14:15, het regende vanochtend (05-10 uur), daarna droog: de rest van vandaag
     is 0,0 mm, de hele kalenderdag niet (eigenaar, 2 oktober). */
  ochtendregen:{klok:"2026-07-22T12:15:00Z",meting:"2026-07-22T14:00",gras:4,
    temp:(u,dag)=>+(15+3*Math.sin((u-9)/24*Math.PI*2)-dag*0.2).toFixed(1),
    pp:(u,dag)=>dag===0&&u>=5&&u<=9?85:3,pr:(u,dag)=>dag===0&&u>=5&&u<=9?1.2:0},
  /* Als ochtendregen, maar 26 juli zonder wind- en neerslaggegevens. */
  onbekend:{klok:"2026-07-22T12:15:00Z",meting:"2026-07-22T14:00",gras:4,
    temp:(u,dag)=>+(15+3*Math.sin((u-9)/24*Math.PI*2)-dag*0.2).toFixed(1),
    pp:(u,dag)=>dag===0&&u>=5&&u<=9?85:3,pr:(u,dag)=>dag===0&&u>=5&&u<=9?1.2:0,
    pas:d=>{const i=d.daily.time.indexOf("2026-07-26");d.daily.wind_speed_10m_max[i]=null;d.daily.precipitation_probability_max[i]=null;d.daily.precipitation_sum[i]=null;
      d.hourly.time.forEach((t,k)=>{if(t.startsWith("2026-07-26")){d.hourly.precipitation_probability[k]=null;d.hourly.precipitation[k]=null;d.hourly.rain[k]=null;}});}},
  /* Storm: windkracht 10 uit het westzuidwesten ("WZW 10 Bft"), veel regen. */
  storm:{klok:"2026-07-22T07:10:00Z",meting:"2026-07-22T09:00",gras:4,ws:95,wd:247.5,
    temp:(u,dag)=>+(13+3*Math.sin((u-9)/24*Math.PI*2)-dag*0.2).toFixed(1),pp:()=>100,pr:()=>12.4}
};
function fixture(sc){
  const d=bouw({temp:sc.temp,pp:sc.pp,pr:sc.pr,som:0,...(sc.ws?{ws:sc.ws}:{})});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map((_,i)=>[21600,12000,5000,30000,26000,18000,24000][i]);
  const h=d.hourly;
  if(sc.wd!==undefined)h.wind_direction_10m=h.wind_direction_10m.map(()=>sc.wd);
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  const nu=h.time.indexOf(sc.meting.slice(0,14)+"00");
  d.current.time=sc.meting;d.current.temperature_2m=h.temperature_2m[nu];d.current.apparent_temperature=h.temperature_2m[nu]-1;
  if(sc.pas)sc.pas(d);
  return d;
}
/* Hetzelfde moment in New York: 16:30 plaatselijke tijd, ruim voor zonsondergang. */
function fixtureNewYork(sc){
  const d=fixture(sc);
  d.latitude=40.7143;d.longitude=-74.006;d.timezone="America/New_York";d.utc_offset_seconds=-14400;
  const meting=new Date(Date.parse(sc.meting+"Z")-6*3600000).toISOString().slice(0,16);
  const nu=d.hourly.time.indexOf(meting.slice(0,14)+"00");
  d.current.time=meting;d.current.is_day=1;d.current.temperature_2m=d.hourly.temperature_2m[nu];d.current.apparent_temperature=d.hourly.temperature_2m[nu]-1;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  let f=path.join(OUT,p);if(!fs.existsSync(f)&&fs.existsSync(f+".html"))f+=".html";
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,sc,w,h,pad="/weer/utrecht/",taal){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:h},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  if(taal)await page.addInitScript(t=>{try{localStorage.setItem("weerbriefing.taal.v1",JSON.stringify(t));}catch(_){}},taal);
  if(sc)await page.addInitScript(k=>{const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;},sc.klok);
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(sc&&u.hostname==="geocoding-api.open-meteo.com")return r.fulfill({json:{results:/new york/i.test(u.searchParams.get("name")||"")?[{name:"New York",latitude:40.7143,longitude:-74.006,admin1:"New York",country_code:"US"}]:[]}});
    if(sc&&(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")){
      const lat=Number(u.searchParams.get("latitude")||u.searchParams.get("lat"));
      return r.fulfill({json:Math.abs(lat-40.7143)<0.01?fixtureNewYork(sc):fixture(sc)});
    }
    if(sc&&u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:30,uv_index:2},hourly:{time:[sc.meting.slice(0,14)+"00"],grass_pollen:[sc.gras],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[1],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+pad,{waitUntil:"domcontentloaded"});
  if(sc){
    await page.waitForSelector("#app",{state:"visible",timeout:15000});
    await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelectorAll("#chart circle").length>0&&document.querySelector("#aq .stat"),null,{timeout:15000});
    await sleep(1500);
  }else await sleep(600);
  return {context,page,fouten};
}

const sc=SCENARIO.middag;
const lees=page=>page.evaluate(()=>{const el=document.getElementById("lichtvervuiling");return el?{hidden:el.hidden,tekst:(el.textContent||"").replace(/\s+/g," ").trim(),href:(el.querySelector("a")||{}).getAttribute?el.querySelector("a").getAttribute("href"):null,vet:(el.querySelector("b")||{}).textContent||null,scroll:document.documentElement.scrollWidth-innerWidth,ontbreekt:[...(window.__WIW_TAAL_ONTBREEKT__||[])].filter(s=>/[Ll]icht|Melkweg|RIVM|Bron/.test(s))}:null;});
(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
  try{
    const gevallen=[
      ["Utrecht",52.091,5.122,"NL",390,"nl","matig tot hoog"],
      ["Rotterdam",51.922,4.479,"NL",1440,"nl","hoog"],
      ["Dwingeloo",52.81,6.40,"NL",390,"nl","laag"],
      ["Utrecht",52.091,5.122,"NL",390,"en","moderate to high"]
    ];
    for(const [plaats,lat,lon,land,w,taal,klasse] of gevallen){
      const label=`${plaats} ${taal} ${w}px`;
      const {context,page,fouten}=await open(browser,root,sc,w,w<700?844:900,`/?lat=${lat}&lon=${lon}&plaats=${plaats}&land=${land}`,taal==="en"?"en":undefined);
      if(taal==="en")await page.waitForFunction(()=>document.documentElement.lang==="en-GB",null,{timeout:10000});
      await page.waitForFunction(()=>{const el=document.getElementById("lichtvervuiling");return el&&!el.hidden;},null,{timeout:10000});
      await sleep(taal==="en"?1500:300);
      const r=await lees(page);
      console.log(label,JSON.stringify(r.tekst));
      assert.equal(r.vet,klasse,`${label}: vet woord is de klasse`);
      assert.equal(r.href,"/over/#lichtvervuiling",`${label}: link naar de bronverantwoording`);
      assert(!/2015/.test(r.tekst),`${label}: geen jaartal in de regel`);
      if(taal==="nl")assert.equal(r.tekst,`Lichtvervuiling in ${plaats}: ${klasse} (geschat). ${{"laag":"Weinig kunstlicht: de Melkweg is goed te zien.","hoog":"Veel kunstlicht: vooral heldere sterren en planeten zijn te zien.","matig tot hoog":"De Melkweg is waarschijnlijk niet te zien; heldere sterren wel."}[klasse]} Geschat op basis van de RIVM-kaart, voor een heldere, maanloze nacht. Bron`,`${label}: volledige regel`);
      else{assert(/^Light pollution in Utrecht: moderate to high \(estimated\)\. .+ Estimated from the RIVM map, for a clear, moonless night\. Source$/.test(r.tekst),`${label}: Engelse regel; kreeg ${r.tekst}`);assert.deepEqual(r.ontbreekt,[],`${label}: niets onvertaald`);}
      assert(r.scroll<=1,`${label}: geen horizontaal scrollen (${r.scroll}px)`);
      assert.deepEqual(fouten,[],`${label}: geen paginafouten`);
      await context.close();
    }
    /* Buitenland: geen regel en geen download van het databestand. */
    {
      const {context,page,fouten}=await open(browser,root,sc,390,844,"/?lat=40.7143&lon=-74.006&plaats=New%20York&land=US");
      let geladen=0;page.on("request",q=>{if(q.url().includes("/lichtvervuiling-nl.json"))geladen++;});
      await sleep(1500);
      const r=await lees(page);
      assert(r&&r.hidden&&r.tekst==="","New York: geen regel lichtvervuiling");
      assert.equal(geladen,0,"New York: databestand niet geladen");
      assert.deepEqual(fouten,[],"New York: geen paginafouten");
      await context.close();
    }
    /* Wisselen van Utrecht naar New York haalt de regel weg. */
    {
      const {context,page}=await open(browser,root,sc,390,844,"/?lat=52.091&lon=5.122&plaats=Utrecht&land=NL");
      await page.waitForFunction(()=>!document.getElementById("lichtvervuiling").hidden,null,{timeout:10000});
      await page.evaluate(()=>load(40.7143,-74.006,"New York",false,false,"US"));
      await page.waitForFunction(()=>document.getElementById("lichtvervuiling").hidden,null,{timeout:10000});
      await context.close();
    }
    console.log("Lichtvervuiling-browser: Nederlandse plaatsen tonen klasse, uitleg en bronlink zonder jaartal (NL en EN), buitenland toont niets en laadt geen data, plaatswissel ruimt de regel op.");
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

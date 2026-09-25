"use strict";

/* Kleur met één betekenis per kleur, op het finale artifact met de echte
   runtime, in licht en donker thema, op 390 en 1366px.
   - Karmijn komt alleen voor bij "nu" (nu-lijn, nu-stip, nu-label) en bij
     "let op" (code rood, foutmelding, verouderde gegevens).
   - De gekozen dag in de weeklijst heeft een streep in inkt.
   - Slechte luchtkwaliteit en veel pollen tonen het getal in inkt, halfvet;
     het oordeel staat als woord eronder.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function fixture(){
  const d=bouw({som:0});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,w,h,donker){
  const context=await browser.newContext({viewport:{width:w,height:h},colorScheme:donker?"dark":"light",locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(()=>{const N=Date,s=N.now(),e=N.parse("2026-07-22T10:39:00Z");class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;});
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture()});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:82,uv_index:3},hourly:{time:["2026-07-22T12:00"],grass_pollen:[160],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:15000});
  await page.waitForFunction(()=>document.querySelector("#aq .sval")&&/\d/.test(document.querySelector("#aq .sval").textContent||""),null,{timeout:15000});
  await sleep(1000);
  return {context,page,fouten};
}

function meet(){
  const probe=document.createElement("i");probe.style.color="var(--carmine)";document.body.appendChild(probe);
  const karmijn=getComputedStyle(probe).color;probe.style.color="var(--ink)";const inkt=getComputedStyle(probe).color;probe.remove();
  const dag=document.querySelector("#days .day.on");
  const aq=[...document.querySelectorAll("#aq .sval")].map(el=>({tekst:(el.textContent||"").trim().slice(0,16),kleur:getComputedStyle(el).color,gewicht:Number(getComputedStyle(el).fontWeight),karmijnGemarkeerd:/--carmine/.test(el.getAttribute("style")||"")}));
  /* Toegestane plaatsen voor karmijn: nu-markering in de grafiek en "let op". */
  const toegestaan=el=>!!el.closest("#chart,#minigrafiek,.waarsch[data-ui-severity=rood],#stamp.oud,.msg.err,.locatie-laadstatus.fout");
  const zichtbaar=el=>{const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.visibility!=="hidden"&&cs.display!=="none";};
  const buiten=[];
  for(const el of document.querySelectorAll("body *")){
    if(!zichtbaar(el)||toegestaan(el))continue;
    const cs=getComputedStyle(el),tekst=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    const kleuren=[cs.backgroundColor,cs.borderTopColor,cs.borderLeftColor,getComputedStyle(el,"::before").backgroundColor];
    if(tekst)kleuren.push(cs.color);
    if(kleuren.includes(karmijn))buiten.push((el.id?"#"+el.id:el.tagName.toLowerCase()+"."+[...el.classList].join("."))+" "+(el.textContent||"").trim().slice(0,20));
  }
  return {karmijn,inkt,dagStreep:dag?getComputedStyle(dag,"::before").backgroundColor:null,aq,buiten:buiten.slice(0,8)};
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const [w,h,donker] of [[390,844,false],[390,844,true],[1366,900,false],[1366,900,true]]){
      const label=w+"px "+(donker?"donker":"licht");
      const {context,page,fouten}=await open(browser,root,w,h,donker);
      try{
        const rij=await page.$$("#days .row.day");
        assert(rij.length>2,label+": weeklijst ontbreekt");
        await rij[2].click();await sleep(900);
        const m=await page.evaluate(meet);
        assert(m.karmijn!==m.inkt,label+": karmijn en inkt zijn gelijk");
        assert.equal(m.dagStreep,m.inkt,label+": de gekozen dag heeft geen inktstreep maar "+m.dagStreep);
        const slecht=m.aq.filter(a=>a.karmijnGemarkeerd);
        assert(slecht.length>=1,label+": geen slechte luchtkwaliteit of hoge pollen in de testdata: "+JSON.stringify(m.aq));
        slecht.forEach(a=>{
          assert.equal(a.kleur,m.inkt,label+": "+a.tekst+" staat niet in inkt maar "+a.kleur);
          assert(a.gewicht>=600,label+": "+a.tekst+" is niet halfvet ("+a.gewicht+")");
        });
        assert.deepEqual(m.buiten,[],label+": karmijn buiten nu en let op");
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("KLEUR "+label+": gekozen dag en "+slecht.length+" slechte waarde(n) in inkt, karmijn alleen voor nu en let op.");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Kleur OK op 390 en 1366px, licht en donker.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

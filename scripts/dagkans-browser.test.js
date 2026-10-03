"use strict";

/* Eén neerslagkans per dag, overal hetzelfde uurvenster (audit 28 september).

   Waargenomen: weekrij en daghint 73%, grafiekbeschrijving 77% voor dezelfde
   dag. Oorzaak: de weekrij nam het daily veld van Open-Meteo (tijdstempels
   00:00-23:00), grafiek en uurtabel lezen een uurwaarde als het uur dat op
   haar tijdstempel eindigt (uren 00-24). Nu gebruiken weekrij, rij-tooltip,
   daghint en grafiekbeschrijving allemaal de uren 00-24 van de kalenderdag.

   Gecontroleerde grensuren (tijdstempel = einde van het uur):
   - 23 juli 00:00: 90% (uur 23-24 van 22 juli)
   - 23 juli 14:00: 73%
   - 24 juli 00:00: 77% (uur 23-24 van 23 juli)
   Het daily veld is berekend zoals Open-Meteo dat doet (tijdstempels
   00:00-23:00): 23 juli 90%, 24 juli 77%.
   Verwacht: 23 juli overal 77%, 24 juli 10%, vandaag (22 juli, resterend) 90%.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const KLOK="2026-07-22T10:10:00Z",METING="2026-07-22T12:00";
const pp=(u,d)=>d===1&&u===0?90:d===1&&u===14?73:d===2&&u===0?77:10;
function fixture(){
  const d=bouw({pp,pr:()=>0,som:0});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>20000);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(k==="precipitation_probability"?10:h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  d.daily.precipitation_probability_max=d.daily.time.map(dag=>Math.max(...h.time.map((t,i)=>t.slice(0,10)===dag?h.precipitation_probability[i]:-1)));
  const nu=h.time.indexOf(METING);d.current.time=METING;d.current.temperature_2m=h.temperature_2m[nu];d.current.apparent_temperature=h.temperature_2m[nu]-1;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  let f=path.join(OUT,p);if(!fs.existsSync(f)&&fs.existsSync(f+".html"))f+=".html";
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});
const pct=t=>{const m=/(\d{1,3})\s*%/.exec(String(t||""));return m?Number(m[1]):null;};

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const w of [390,1366]){
      const context=await browser.newContext({viewport:{width:w,height:900},isMobile:w<700,hasTouch:w<700,locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
      const page=await context.newPage(),fouten=[];page.on("pageerror",e=>fouten.push(String(e)));
      await page.addInitScript(k=>{const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;},KLOK);
      await page.route("**/*",async r=>{const u=new URL(r.request().url());
        if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture()});
        if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
        if(u.pathname.startsWith("/api/")||u.hostname.endsWith("open-meteo.com"))return r.fulfill({json:{beschikbaar:false}});
        if(u.origin!==root)return r.fulfill({status:204,body:""});return r.continue();});
      try{
        await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
        await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelectorAll("#days .row.day:not(.kop)").length>=7,null,{timeout:15000});
        const rijen=await page.evaluate(()=>[...document.querySelectorAll("#days .row.day:not(.kop)")].map(r=>{const d=r.querySelector(".drain");return {i:Number(r.dataset.i),tekst:d?d.textContent:"",titel:d?d.title:"",gesproken:d?d.getAttribute("aria-label")||"":""};}));
        const rij=i=>rijen.find(r=>r.i===i)||{};
        assert.equal(pct(rij(0).tekst),90,w+"px: vandaag (resterend) hoort het uur 23-24 mee te tellen: "+rij(0).tekst);
        assert.equal(pct(rij(1).tekst),77,w+"px: weekrij 23 juli volgt niet de uren 00-24: "+rij(1).tekst);
        assert.equal(pct(rij(1).titel),77,w+"px: tooltip 23 juli wijkt af van de rij: "+rij(1).titel);
        /* Een schermlezer hoort dezelfde betekenis als de tooltip: de hoogste kans in één uur. */
        assert(/^Hoogste neerslagkans in één uur 77 procent/.test(rij(1).gesproken),w+"px: schermlezertekst 23 juli noemt niet de hoogste kans in één uur: "+rij(1).gesproken);
        assert.equal(pct(rij(2).tekst),10,w+"px: weekrij 24 juli telt het uur 23-24 van 23 juli mee: "+rij(2).tekst);
        /* Dag kiezen: daghint en grafiekbeschrijving zeggen hetzelfde als de rij. */
        await page.click('#days .row.day[data-i="1"]');
        await page.waitForFunction(()=>S.dag===1&&/Hoogste kans op neerslag in één uur/.test((document.getElementById("charthint")||{}).textContent||""),null,{timeout:5000});
        const dag=await page.evaluate(()=>({hint:document.getElementById("charthint").textContent,aria:document.getElementById("chart").getAttribute("aria-label")||""}));
        assert(/Hoogste kans op neerslag in één uur:\s*77%/.test(dag.hint),w+"px: daghint 23 juli wijkt af: "+dag.hint);
        assert(/hoogste neerslagkans in één uur op deze dag 77 procent/.test(dag.aria),w+"px: grafiekbeschrijving 23 juli wijkt af: "+dag.aria);
        assert.deepEqual(fouten,[],w+"px: runtimefouten "+fouten.join(" | "));
        console.log("DAGKANS "+w+"px: vandaag "+pct(rij(0).tekst)+"%, 23 juli rij/tooltip/hint/grafiek 77%, 24 juli "+pct(rij(2).tekst)+"%.");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Dagkans OK: weekrij, tooltip, daghint en grafiekbeschrijving gebruiken dezelfde uren 00-24.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

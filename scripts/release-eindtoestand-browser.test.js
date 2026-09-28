"use strict";

/* Eindtoestanden voor het releasebewijs (scripts/release-eindtoestand.js),
   op het finale artifact met de echte runtime:
   - waarschuwingen volledig (met en zonder waarschuwing), niet beschikbaar en
     fout (503 en een bron die nooit antwoordt: de app stopt zelf na 7 s);
   - trage waarschuwingen en trage KNMI-neerslag: de helper wacht tot de
     laadmelding en "Verwachting wordt bijgewerkt…" weg zijn;
   - telefoon en desktop.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");
const {wachtEindtoestand,leesEindtoestand}=require("./release-eindtoestand.js");

const OUT=path.join(__dirname,"..","public");
const KLOK="2026-07-22T12:10:00Z",METING="2026-07-22T14:00";
function fixture(){
  const d=bouw({});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>20000);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  d.current.time=METING;
  return d;
}
const WAARSCHUWING={titel:"Code geel: windstoten",tekst:"Zware windstoten tot 80 km/u.",niveau:"geel",van:"2026-07-22T10:00:00Z",tot:"2026-07-22T23:00:00Z",gebied:"Utrecht"};
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  let f=path.join(OUT,p);if(!fs.existsSync(f)&&fs.existsSync(f+".html"))f+=".html";
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});
const wacht=ms=>new Promise(r=>setTimeout(r,ms));

const SCENARIOS=[
  {naam:"volledig, geen waarschuwing",w:{json:{bron:"test",dekking:true,land:"NL",lijst:[]}},verwacht:"volledig",aantal:0},
  {naam:"volledig, één waarschuwing",w:{json:{bron:"test",dekking:true,land:"NL",lijst:[WAARSCHUWING]}},verwacht:"volledig",aantal:1},
  {naam:"niet beschikbaar",w:{json:{bron:"test",dekking:false,land:"NL"}},verwacht:"niet-beschikbaar"},
  {naam:"fout 503",w:{status:503,json:{error:true}},verwacht:"fout"},
  {naam:"fout, bron antwoordt nooit",w:{nooit:true},verwacht:"fout"},
  {naam:"trage waarschuwingen en KNMI",w:{json:{bron:"test",dekking:true,land:"NL",lijst:[]},vertraging:2500},knmiVertraging:2500,verwacht:"volledig",aantal:0}
];

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    for(const w of [390,1366])for(const sc of SCENARIOS){
      if(w===1366&&sc.w.nooit)continue;
      const label=w+"px "+sc.naam;
      const context=await browser.newContext({viewport:{width:w,height:900},locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:w<700,hasTouch:w<700});
      const page=await context.newPage(),fouten=[];page.on("pageerror",e=>fouten.push(String(e)));
      await page.addInitScript(k=>{const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;},KLOK);
      await page.route("**/*",async r=>{
        const u=new URL(r.request().url());
        if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture()});
        if(u.pathname==="/api/waarschuwingen"){
          if(sc.w.nooit)return;/* nooit afhandelen: de app moet zelf stoppen */
          if(sc.w.vertraging)await wacht(sc.w.vertraging);
          return r.fulfill({status:sc.w.status||200,contentType:"application/json",body:JSON.stringify(sc.w.json)});
        }
        if(u.pathname==="/api/neerslag"){
          if(sc.knmiVertraging)await wacht(sc.knmiVertraging);
          return r.fulfill({json:{beschikbaar:true,actueel:{waarde:0},nowcast:{punten:[]},bron:"test"}});
        }
        if(u.pathname.startsWith("/api/")||u.hostname.endsWith("open-meteo.com"))return r.fulfill({json:{beschikbaar:false}});
        if(u.origin!==root)return r.fulfill({status:204,body:""});
        return r.continue();
      });
      try{
        await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
        if(sc.knmiVertraging){
          /* Het oude screenshotmoment (weerdata en dagrijen staan er) is bij
             trage bronnen nog een tussenstand. */
          await page.waitForFunction(()=>document.querySelectorAll("#days .row.day:not(.kop)").length>=7,null,{timeout:15000});
          const vroeg=await leesEindtoestand(page);
          assert(vroeg.waarschuwingen==="bezig"||vroeg.briefing==="bezig",label+": verwachtte een tussenstand direct na het laden ("+JSON.stringify(vroeg)+")");
        }
        const t=await wachtEindtoestand(page,label,25000);
        assert.equal(t.briefing,"klaar",label+": briefing niet klaar ("+JSON.stringify(t)+")");
        assert.equal(t.waarschuwingen,sc.verwacht,label+": waarschuwingen "+t.waarschuwingen+" ("+t.waarschuwingenTekst+")");
        if(sc.aantal!==undefined)assert.equal(t.aantalWaarschuwingen,sc.aantal,label+": aantal waarschuwingen");
        /* Wat er op het scherm staat, is ook echt de eindtoestand. */
        const scherm=await page.evaluate(()=>{const b=document.getElementById("brief");return {bijgewerkt:b?getComputedStyle(b,"::after").content:"",
          laden:!!document.querySelector("[data-ui-warning-loading]"),zichtbaar:b?getComputedStyle(b).visibility:""};});
        assert(!/bijgewerkt/.test(scherm.bijgewerkt),label+": 'Verwachting wordt bijgewerkt…' staat nog op het scherm");
        assert(!scherm.laden&&scherm.zichtbaar==="visible",label+": laadtoestand zichtbaar ("+JSON.stringify(scherm)+")");
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        console.log("EINDTOESTAND "+label+": briefing "+t.briefing+", waarschuwingen "+t.waarschuwingen+".");
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Releasebewijs-eindtoestanden OK: volledig, niet beschikbaar en fout, ook bij trage en hangende bronnen.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

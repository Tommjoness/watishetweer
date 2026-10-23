"use strict";

/* Celniveau-controle van de vakantietabellen (/herfstvakantie/): in iedere cel valt de inhoud binnen de cel en raakt
   de inhoud van de volgende cel niet, in het Nederlands en het Engels, rond het omslagpunt van het tweekolomsraster
   (1179/1180 px), op een telefoon en op een brede kaart, met lange hoeveelheden ("12.4 mm of rain · chance 100%")
   en een negatieve minimumtemperatuur. Alleen op horizontale documentoverloop controleren is onvoldoende: een cel
   kan over zijn buurcel lopen zonder dat de pagina breder wordt. Draait op het finale artifact (public/). */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {SEIZOENSPAGINAS}=require("./seizoenspagina.config.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"herfstvakantie","index.html")))throw new Error("public/herfstvakantie/index.html ontbreekt; draai eerst de build.");
const herfst=SEIZOENSPAGINAS.find(p=>p.slug==="herfstvakantie");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".css":"text/css; charset=utf-8"};
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  const rel=(pathname.endsWith("/")?pathname+"index.html":pathname).replace(/^\//,"");
  const file=path.join(PUBLIC,rel);
  if(file.startsWith(PUBLIC+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.writeHead(200,{"content-type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","cache-control":"no-store"});
    fs.createReadStream(file).pipe(res);return;
  }
  res.writeHead(404);res.end("not found");
});
const KLOK="2026-10-12T10:00:00Z";
function vakantie(mm,kans){
  const dagen=[];for(let i=0;i<7;i++)dagen.push(new Date(Date.parse("2026-10-12T00:00:00Z")+i*864e5).toISOString().slice(0,10));
  return {daily:{time:dagen,temperature_2m_min:dagen.map(()=>-3.4),temperature_2m_max:dagen.map(()=>15.4),precipitation_sum:dagen.map(()=>mm),snowfall_sum:dagen.map(()=>0),precipitation_probability_max:dagen.map(()=>kans),sunshine_duration:dagen.map(()=>6.2*3600)}};
}

/* Per rij en per cel: loopt de inhoud buiten de eigen cel, of raakt hij de inhoud van de volgende cel? */
function meet(){
  const uit={tabellen:0,rijen:0,probleem:[]};
  const bereik=el=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect();};
  for(const t of document.querySelectorAll(".seizoen-vakantie")){
    uit.tabellen++;
    for(const rij of t.querySelectorAll("tbody tr")){
      uit.rijen++;
      const cellen=[...rij.children].filter(c=>c.getClientRects().length);
      cellen.forEach((c,i)=>{
        const b=c.getBoundingClientRect(),inh=bereik(c);
        if(c.scrollWidth>c.clientWidth+1)uit.probleem.push(`cel ${i} scroll ${c.scrollWidth}>${c.clientWidth} "${c.textContent.trim().slice(0,40)}"`);
        if(inh.width&&(inh.right>b.right+1||inh.left<b.left-1))uit.probleem.push(`cel ${i} inhoud ${Math.round(inh.left)}-${Math.round(inh.right)} buiten cel ${Math.round(b.left)}-${Math.round(b.right)} "${c.textContent.trim().slice(0,40)}"`);
        const volgende=cellen[i+1];
        if(volgende&&inh.width){const n=volgende.getBoundingClientRect(),ni=bereik(volgende);
          if(inh.right>n.left+1&&(ni.width||n.width))uit.probleem.push(`cel ${i} raakt cel ${i+1}: ${Math.round(inh.right)} > ${Math.round(n.left)} "${c.textContent.trim().slice(0,40)}"`);}
      });
    }
  }
  uit.overloop=document.documentElement.scrollWidth-innerWidth;
  return uit;
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let geteld=0;
  try{
    for(const taal of ["nl","en"])for(const [naam,mm,kans] of [["9,0 mm/100%",9,100],["12,4 mm/100%",12.4,100],["0,4 mm/20%",0.4,20]])for(const breedte of [360,390,768,1179,1180,1280,1920]){
      const L=`${taal} ${breedte}px ${naam}`;
      const context=await browser.newContext({viewport:{width:breedte,height:900},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
      try{
        const page=await context.newPage();
        if(taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
        await page.clock.setFixedTime(new Date(KLOK));
        await page.route("**/*",r=>{
          const u=new URL(r.request().url());
          if(u.hostname==="api.open-meteo.com")return r.fulfill({json:herfst.plaatsen.map(()=>vakantie(mm,kans))});
          if(u.pathname.startsWith("/api/"))return r.fulfill({status:503,json:{beschikbaar:false}});
          if(u.hostname!=="127.0.0.1")return r.fulfill({status:204,body:""});
          return r.continue();
        });
        await page.goto("http://127.0.0.1:"+server.address().port+"/herfstvakantie/",{waitUntil:"load"});
        await page.waitForFunction(()=>!document.querySelector("#seizoen-verwachting[aria-busy]")&&document.querySelector(".seizoen-vakantie tbody tr"),null,{timeout:30000});
        await new Promise(r=>setTimeout(r,400));
        if(taal==="en")assert.match(await page.locator(".seizoen-vakantie td:nth-child(2)").first().innerText(),/rain|chance/,`${L}: de tabel is Engels`);
        const m=await page.evaluate(meet);
        assert(m.tabellen>=3&&m.rijen>=9,`${L}: te weinig tabellen/rijen gemeten (${m.tabellen}/${m.rijen})`);
        assert.deepEqual(m.probleem.slice(0,3),[],`${L}: inhoud buiten of over een buurcel`);
        assert(m.overloop<=0,`${L}: horizontale overloop ${m.overloop}px`);
        geteld++;
      }finally{await context.close();}
    }
    console.log(`Vakantietabellen: ${geteld} situaties (NL/EN, 360–1920 px, rond het omslagpunt 1179/1180, lange hoeveelheden, negatieve minimumtemperatuur): inhoud blijft binnen de eigen cel en raakt geen buurcel.`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

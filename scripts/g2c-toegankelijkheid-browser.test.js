"use strict";

/* G2-C in de browser (eigenaar 23 november, punten 3 en 6 van de UI/UX-ronde):
   - temperatuurtrend: de pijl is voor schermlezers verborgen; de zichtbare waarde
     ("25 ↘ 23°C") is aria-hidden en een verborgen zin ervóór zegt "Van 25 naar 23 °C"
     (EN: "From 25 to 23 °C"), met dezelfde getallen als zichtbaar;
   - aanraakvlakken van minstens 44px op aanraakschermen: de taalknop EN/NL (onzichtbare
     uitbreiding, het vakje zelf blijft gelijk), de parknamen op /nachtzicht/ (onzichtbaar,
     binnen de rij) en de letters A–Z op /weer/ (echt 44 × 44px);
   - met een muis blijft alles zoals het was.
   Draait op het finale artifact (npm run build:cloudflare). */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {stub}=require("./taal-catalogus-browser.js");
const {SCENARIOS}=require("./taal-scenarios.js");

const OUT=path.join(__dirname,"..","public");
const TYPES={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webp":"image/webp",".jpg":"image/jpeg"};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  if(f.endsWith(".html")){
    const html=fs.readFileSync(f,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"").replace("<head>","<head>"+stub(SCENARIOS[0],""));
    res.writeHead(200,{"content-type":TYPES[".html"]});res.end(html);return;
  }
  res.writeHead(200,{"content-type":TYPES[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);
});

/* Raakt een tik op 21px boven, onder, links en rechts van het midden nog het doel? (44px-vlak) */
function aanraakvlak([sel,i,richtingen]){
  const a=document.querySelectorAll(sel)[i];
  if(!a)return null;
  a.scrollIntoView({block:"center",inline:"nearest"});
  const r=a.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  const punten={boven:[cx,cy-21],onder:[cx,cy+21],links:[cx-21,cy],rechts:[cx+21,cy]};
  const uit={naam:a.textContent.trim(),breedte:Math.round(r.width),hoogte:Math.round(r.height)};
  for(const k of richtingen){const e=document.elementFromPoint(...punten[k]);uit[k]=!!e&&(e===a||a.contains(e));}
  return uit;
}

server.listen(0,async()=>{
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let geslaagd=0;
  const open=async(url,breedte,aanraak)=>{
    const page=await browser.newPage({viewport:{width:breedte,height:900},hasTouch:aanraak,isMobile:aanraak});
    const fouten=[];page.on("pageerror",e=>fouten.push(e.message));
    await page.route("**/*",r=>r.request().url().startsWith(base)?r.continue():r.abort());
    await page.goto(base+url,{waitUntil:"load"});
    await page.waitForFunction(()=>document.documentElement.hasAttribute("data-taal-klaar")||!window.WeatherNowTaal,null,{timeout:15000}).catch(()=>{});
    await page.waitForTimeout(600);
    page.fouten=fouten;return page;
  };
  try{
    /* 1. Temperatuurtrend, NL en EN, telefoon en desktop. */
    for(const [taal,breedte,aanraak] of [["nl",390,true],["en",390,true],["nl",1366,false],["en",1366,false]]){
      const page=await open(taal==="en"?"/?taal=en":"/",breedte,aanraak);
      await page.waitForFunction(()=>{const v=document.getElementById("prec");return v&&/[↗↘→]/.test(v.textContent);},null,{timeout:15000});
      const m=await page.evaluate(()=>{
        const v=document.getElementById("prec"),sr=v.parentElement.querySelector(".wiw-trend-sr");
        const s=sr&&getComputedStyle(sr),r=sr&&sr.getBoundingClientRect();
        return {zicht:v.textContent.trim(),verborgen:v.getAttribute("aria-hidden"),pijlVerborgen:v.querySelector("span").getAttribute("aria-hidden"),
          zin:sr?sr.textContent:null,aantal:v.parentElement.querySelectorAll(".wiw-trend-sr").length,ervoor:!!sr&&sr.nextElementSibling===v,
          onzichtbaar:!!sr&&s.position==="absolute"&&r.width<=1&&r.height<=1,overloop:document.documentElement.scrollWidth-innerWidth};
      });
      const label=`${taal} ${breedte}px`;
      const z=/^(-?\d+) ([↗↘→]) (-?\d+)°C$/.exec(m.zicht);
      assert(z,`${label}: zichtbare trend ongewijzigd ("${m.zicht}")`);
      assert.equal(m.verborgen,"true",`${label}: zichtbare trendwaarde is voor schermlezers verborgen`);
      assert.equal(m.pijlVerborgen,"true",`${label}: pijl blijft aria-hidden`);
      assert.equal(m.aantal,1,`${label}: precies één verborgen trendzin`);
      assert(m.ervoor,`${label}: verborgen zin staat direct vóór de zichtbare waarde`);
      assert(m.onzichtbaar,`${label}: verborgen zin is niet zichtbaar (sr-only)`);
      const re=taal==="en"?/^From (-?\d+) to (-?\d+) °C$/:/^Van (-?\d+) naar (-?\d+) °C$/;
      const zin=re.exec(m.zin||"");
      assert(zin,`${label}: verborgen zin "${m.zin}" volgt het patroon`);
      assert.deepEqual([zin[1],zin[2]],[z[1],z[3]],`${label}: verborgen zin noemt dezelfde temperaturen als zichtbaar`);
      assert(m.overloop<=0,`${label}: geen horizontale overloop`);
      assert.deepEqual(page.fouten,[],`${label}: scriptfouten`);
      await page.close();geslaagd++;
    }
    /* 2. Aanraakvlakken op een telefoon (aanraakscherm). */
    for(const url of ["/","/weer/","/nachtzicht/","/kerstvakantie/","/maan/"]){
      const page=await open(url,390,true);
      const r=await page.evaluate(aanraakvlak,[".taal-keuze",0,["boven","onder","links","rechts"]]);
      assert(r,`${url}: taalknop aanwezig`);
      assert(r.breedte<44&&r.hoogte<44,`${url}: zichtbaar vakje van de taalknop blijft klein (${r.breedte}×${r.hoogte})`);
      for(const k of ["boven","onder","links","rechts"])assert(r[k],`${url}: tik 21px ${k} het midden raakt de taalknop`);
      if(url==="/nachtzicht/"){
        const n=await page.evaluate(()=>document.querySelectorAll(".nz-tabel tbody th a").length);
        assert(n>=10,`/nachtzicht/: parklinks gevonden (${n})`);
        for(let i=0;i<n;i++){
          const p=await page.evaluate(aanraakvlak,[".nz-tabel tbody th a",i,["boven","onder"]]);
          assert(p.boven&&p.onder,`/nachtzicht/: aanraakvlak van ${p.naam} is minstens 44px hoog`);
        }
      }
      if(url==="/weer/"){
        const az=await page.evaluate(()=>[...document.querySelectorAll(".az a")].map(a=>{const r=a.getBoundingClientRect();return [a.textContent,r.width,r.height];}));
        assert(az.length>=10,"/weer/: letters A–Z gevonden");
        for(const [l,w,h] of az)assert(w>=44&&h>=44,`/weer/: letter ${l} is ${Math.round(w)}×${Math.round(h)} (minstens 44×44)`);
      }
      assert(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=0,`${url}: geen horizontale overloop`);
      assert.deepEqual(page.fouten,[],`${url}: scriptfouten`);
      await page.close();geslaagd++;
    }
    /* 3. Met een muis: geen uitbreiding, A–Z blijft 32px. */
    for(const url of ["/weer/","/nachtzicht/"]){
      const page=await open(url,1366,false);
      const m=await page.evaluate(()=>{
        const na=s=>{const e=document.querySelector(s);return e?getComputedStyle(e,"::after").content:null;};
        const a=document.querySelector(".az a");
        return {taal:na(".taal-keuze"),park:na(".nz-tabel tbody th a"),az:a?Math.round(a.getBoundingClientRect().height):null};
      });
      assert(m.taal==="none"||m.taal==="normal",`${url} muis: geen aanraakuitbreiding bij de taalknop`);
      assert(m.park===null||m.park==="none"||m.park==="normal",`${url} muis: geen aanraakuitbreiding bij de parklinks`);
      if(url==="/weer/")assert.equal(m.az,32,"/weer/ muis: letters A–Z blijven 32px");
      await page.close();geslaagd++;
    }
    console.log(`G2-C toegankelijkheid geslaagd: ${geslaagd} controles (trendzin NL/EN, aanraakvlakken EN/NL-knop, parklinks en A–Z, muisweergave ongewijzigd).`);
  }finally{await browser.close();server.close();}
});

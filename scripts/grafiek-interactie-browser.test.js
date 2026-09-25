"use strict";

/* Grafiek aantikken, piek en dal, en leesbaarheid, op het finale artifact met
   de echte runtime.
   - Aantikken (echte touch): het venster toont het aangetikte uur en blijft
     staan; de focus van het tikvlak kiest geen ander uur. Het toetsenbord
     begint bij het laatst aangetikte uur en loopt met de pijltjes verder.
   - Piek en dal: de volle stip staat op het echte hoogste en laagste punt van
     het venster, ook tussen twee drie-uursankers (telefoon) of tussen twee
     uurcijfers (tablet). Een rand van het venster is geen piek of dal als de
     reeks daarbuiten verder stijgt of daalt. Op tablet en desktop heeft piek
     en dal een eigen uurtijd.
   - Telefoon: geen grafiektekst kleiner dan 11px, ieder drie-uursanker heeft
     een temperatuur, "nu" staat bij de rode stip (binnen twee regels), en een regengetal staat bij
     zijn staafje (hooguit twee regels erboven) en herhaalt zich niet voor uren met dezelfde hoeveelheid.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* Twee dagverlopen: een natte avond (nu 17:39) en een late avond met regen na
   middernacht (nu 22:39). Beide met het dal tussen twee drie-uursankers. */
const SCENARIO={
  avondregen:{klok:"2026-07-22T15:39:00Z",meting:"2026-07-22T17:30",
    temp:(u,dag)=>+(15.5+4.5*Math.sin((u-9)/24*Math.PI*2)-dag*0.4).toFixed(1),
    pp:(u,dag)=>dag===0&&u>=19&&u<=23?[40,70,80,65,30][u-19]:dag===2&&u>=10&&u<=16?55:8,
    pr:(u,dag)=>dag===0&&u>=19&&u<=23?[0.2,1.4,2.1,0.8,0.1][u-19]:dag===2&&u>=10&&u<=16?0.6:0,
    wc:(u,dag)=>dag===0&&u>=19&&u<=23?61:dag===2&&u>=10&&u<=16?61:u<11?1:u<17?2:3},
  nachtregen:{klok:"2026-07-22T20:39:00Z",meting:"2026-07-22T22:30",
    temp:(u,dag)=>+(14+3.8*Math.sin((u-9)/24*Math.PI*2)-dag*0.2).toFixed(1),
    pp:(u,dag)=>dag===1&&u>=1&&u<=5?[30,55,60,45,20][u-1]:10,
    pr:(u,dag)=>dag===1&&u>=1&&u<=5?[0.1,0.4,0.6,0.3,0.1][u-1]:0,
    wc:(u,dag)=>dag===1&&u>=1&&u<=5?61:3}
};
function fixture(sc){
  const d=bouw({temp:sc.temp,pp:sc.pp,pr:sc.pr,wc:sc.wc,som:2});
  d.latitude=52.09;d.longitude=5.12;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,16));}
  const nu=h.time.indexOf(sc.meting.slice(0,14)+"00");
  d.current.time=sc.meting;d.current.temperature_2m=h.temperature_2m[nu];d.current.apparent_temperature=h.temperature_2m[nu]-1;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,sc,w,h){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:mobiel?2:1,locale:"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block",isMobile:mobiel,hasTouch:mobiel});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  await page.addInitScript(k=>{const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;},sc.klok);
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast")return r.fulfill({json:fixture(sc)});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:[sc.meting.slice(0,14)+"00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+"/weer/utrecht/",{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#app",{state:"visible",timeout:15000});
  await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelector("#chart #hit")&&document.querySelectorAll("#chart circle").length>0,null,{timeout:15000});
  await sleep(1800);
  return {context,page,fouten};
}

function meetGrafiek(){
  const svg=document.getElementById("chart"),g=S.geo,vb=svg.viewBox.baseVal,schaal=svg.getBoundingClientRect().width/vb.width;
  const T=g.T.map(Number),n=g.M?Math.min(24,T.length):T.length;
  const uren=S.d.hourly,k0=uren.time.indexOf(g.TI[0]),k1=uren.time.indexOf(g.TI[n-1]);
  const buiten=k=>k>=0&&k<uren.time.length&&Number.isFinite(Number(uren.temperature_2m[k]))?Number(uren.temperature_2m[k]):null;
  const links=k0>0?buiten(k0-1):null,rechts=n<T.length?T[n]:(k1>=0?buiten(k1+1):null);
  const zicht=T.slice(0,n);
  const stippen=[...svg.querySelectorAll("[data-mobile-temp-marker-dot],[data-desktop-temp-marker-dot]")].map(el=>{
    const type=el.getAttribute("data-mobile-temp-marker-dot")||el.getAttribute("data-desktop-temp-marker-dot"),cx=Number(el.getAttribute("cx"));
    let i=0;for(let k=1;k<n;k++)if(Math.abs(g.x(k)-cx)<Math.abs(g.x(i)-cx))i=k;
    return {type,i,dx:Math.abs(g.x(i)-cx),dy:Math.abs(g.y(T[i])-Number(el.getAttribute("cy")))};
  });
  const cijfers=[...svg.querySelectorAll("text[data-mobile-temp-marker],text[data-desktop-temp-marker]")].map(el=>({type:el.getAttribute("data-mobile-temp-marker")||el.getAttribute("data-desktop-temp-marker"),tekst:el.textContent.trim(),x:Number(el.getAttribute("x"))}));
  const tijden=[...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&!el.closest("g[data-q4-rain-periods]")&&el.getAttribute("display")!=="none"&&/^\d{2}:00$/.test(el.textContent.trim())).map(el=>Number(el.getAttribute("x")));
  const zichtbaar=el=>{let e=el;while(e&&e!==svg){if(e.getAttribute&&e.getAttribute("display")==="none")return false;const cs=getComputedStyle(e);if(cs.display==="none"||cs.visibility==="hidden")return false;e=e.parentNode;}return el.getClientRects().length>0;};
  const klein=[...svg.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&zichtbaar(el)&&el.textContent.trim()).map(el=>({t:el.textContent.trim(),px:parseFloat(getComputedStyle(el).fontSize)*schaal})).filter(x=>x.px<10.95);
  const nu=[...svg.querySelectorAll("text")].find(el=>/^nu(?:\s|$)/i.test(el.textContent.trim())),nuStip=svg.querySelector('circle[fill="var(--carmine)"][r="3"]');
  let nuAfstand=null;
  if(nu&&nuStip){const b=nu.getBBox(),cy=Number(nuStip.getAttribute("cy"));nuAfstand=Math.max(0,b.y-cy,cy-(b.y+b.height));}
  const staven=[...svg.querySelectorAll("g[data-regenstaven] path.regenstaaf")].map(el=>({uur:el.getAttribute("data-uur"),top:el.getBBox().y}));
  const stipBoxen=[...svg.querySelectorAll("circle[data-mobile-temp-marker-dot],circle[data-desktop-temp-marker-dot],circle[fill=\"var(--carmine)\"]")].map(c=>c.getBBox());
  const raakt=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  const regen=[...svg.querySelectorAll("g[data-regenstaaf-mm] text")].map(el=>{const b=el.getBBox(),s=staven.find(s=>s.uur===el.getAttribute("data-uur"));return {uur:el.getAttribute("data-uur"),tekst:el.textContent.trim(),boven:s?s.top-(b.y+b.height):null,fs:Number(el.getAttribute("font-size")),opStip:stipBoxen.some(st=>raakt(b,st))};});
  return {M:!!g.M,n,van:g.TI[0],zicht,links,rechts,stippen,cijfers,tijden,x:zicht.map((_,k)=>g.x(k)),klein,nuAfstand,regen,
    missing:svg.getAttribute("data-mobile-temp-missing-anchors")||"",compact:innerWidth<=430};
}

/* Verwachte markeringen: echte extremen, zonder rand die buiten het venster doorloopt. */
function verwacht(m){
  const uit=[];
  for(const type of ["max","min"]){
    const w=type==="max"?Math.max(...m.zicht):Math.min(...m.zicht);
    const idx=m.zicht.map((v,k)=>v===w?k:-1).filter(k=>k>=0);
    const verder=v=>v!==null&&(type==="max"?v>=w:v<=w);
    if(idx.includes(0)&&verder(m.links))continue;
    if(idx.includes(m.n-1)&&verder(m.rechts))continue;
    uit.push({type,waarde:Math.round(w),idx});
  }
  return uit;
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    /* 1. Aantikken en toetsenbord op de telefoon. */
    {
      const {context,page,fouten}=await open(browser,root,SCENARIO.avondregen,390,844);
      try{
        const doel=await page.$("#chart");await doel.scrollIntoViewIfNeeded();await sleep(300);
        const box=await doel.boundingBox();
        for(const f of [0.3,0.6,0.9]){
          const x=box.x+box.width*f,y=box.y+box.height*0.5;
          await page.touchscreen.tap(x,y);await sleep(1000);
          const r=await page.evaluate(([cx])=>{
            const svg=document.getElementById("chart"),g=S.geo,rb=svg.getBoundingClientRect(),vx=(cx-rb.left)/(rb.width/(g.W||900));
            let beste=0;for(let k=1;k<g.n;k++)if(Math.abs(g.x(k)-vx)<Math.abs(g.x(beste)-vx))beste=k;
            const scrub=document.getElementById("scrub"),kop=scrub&&scrub.querySelector("text");
            return {verwacht:g.TI[beste].slice(11,16),kop:kop?kop.textContent.slice(0,5):"",zichtbaar:!!scrub&&scrub.style.display!=="none",outline:getComputedStyle(document.getElementById("hit")).outlineStyle};
          },[x]);
          assert(r.zichtbaar,"390px: na een tik op "+Math.round(f*100)+"% is het detailvenster na 1 seconde al weg");
          assert.equal(r.kop,r.verwacht,"390px: tik op "+Math.round(f*100)+"% toont "+r.kop+" in plaats van het aangetikte uur "+r.verwacht);
          assert.equal(r.outline,"none","390px: het tikvlak krijgt een focusrand bij aantikken");
          await sleep(900);
        }
        /* Pijltje rechts gaat verder vanaf het laatst aangetikte uur. */
        const voor=await page.evaluate(()=>S.geo.TI[Number(document.getElementById("hit").dataset.keyboardIndex||0)].slice(11,16));
        await page.keyboard.press("ArrowRight");await sleep(300);
        const na=await page.evaluate(()=>{const kop=document.querySelector("#scrub text");return {kop:kop?kop.textContent.slice(0,5):"",uur:S.geo.TI[Number(document.getElementById("hit").dataset.keyboardIndex||0)].slice(11,16)};});
        assert.notEqual(na.uur,voor,"390px: pijltje rechts blijft op hetzelfde uur");
        assert.equal(na.kop,na.uur,"390px: pijltje rechts toont "+na.kop+" in plaats van "+na.uur);
        assert.deepEqual(fouten,[],"390px: runtimefouten "+fouten.join(" | "));
        console.log("GRAFIEK 390px: aantikken toont het aangetikte uur en blijft staan; pijltjes lopen verder vanaf daar.");
      }finally{await context.close();}
    }
    /* Toetsenbord zonder aanraking: Tab naar de grafiek toont het eerste uur. */
    {
      const {context,page,fouten}=await open(browser,root,SCENARIO.avondregen,1366,900);
      try{
        await page.evaluate(()=>document.getElementById("hit").focus());await sleep(300);
        const r=await page.evaluate(()=>{const kop=document.querySelector("#scrub text");return {kop:kop?kop.textContent.slice(0,5):"",zichtbaar:document.getElementById("scrub").style.display!=="none",eerste:S.geo.TI[0].slice(11,16)};});
        assert(r.zichtbaar&&r.kop===r.eerste,"1366px: toetsenbordfocus op de grafiek toont niet het eerste uur ("+JSON.stringify(r)+")");
        await page.mouse.move(2,2);
        assert.deepEqual(fouten,[],"1366px: runtimefouten "+fouten.join(" | "));
        console.log("GRAFIEK 1366px: toetsenbordfocus begint bij het eerste uur.");
      }finally{await context.close();}
    }
    /* 2-4. Piek en dal, leesbaarheid, nu-label en regengetallen. */
    for(const [naam,sc] of Object.entries(SCENARIO)){
      for(const [w,h] of [[360,780],[390,844],[768,1024],[1366,900]]){
        const label=naam+" "+w+"px";
        const {context,page,fouten}=await open(browser,root,sc,w,h);
        try{
          const m=await page.evaluate(meetGrafiek);
          const plan=verwacht(m);
          assert.equal(m.stippen.length,plan.length,label+": "+m.stippen.length+" stippen, verwacht "+plan.map(p=>p.type).join("+"));
          for(const p of plan){
            const s=m.stippen.find(x=>x.type===p.type),c=m.cijfers.find(x=>x.type===p.type);
            assert(s,label+": geen "+p.type+"-stip");
            assert(p.idx.includes(s.i)&&s.dx<1&&s.dy<1,label+": de "+p.type+"-stip staat op index "+s.i+" en niet op het echte "+(p.type==="max"?"hoogste":"laagste")+" punt ("+p.idx.join("/")+")");
            assert(c&&c.tekst===p.waarde+"°",label+": het "+p.type+"-cijfer is "+(c&&c.tekst)+", verwacht "+p.waarde+"°");
            assert(Math.abs(c.x-m.x[s.i])<=14,label+": het "+p.type+"-cijfer staat niet boven zijn stip");
            if(!m.compact)assert(m.tijden.some(x=>Math.abs(x-m.x[s.i])<3),label+": de "+p.type+" heeft geen eigen uurtijd");
          }
          if(w<760){
            assert.deepEqual(m.klein,[],label+": grafiektekst kleiner dan 11px");
            assert.equal(m.missing,"",label+": drie-uursanker zonder temperatuur ("+m.missing+")");
            assert(m.nuAfstand!==null&&m.nuAfstand<=26,label+": het nu-label staat "+m.nuAfstand+" van de rode stip");
          }
          for(const r of m.regen){
            assert(r.boven!==null&&r.boven>=-1&&r.boven<=2*(r.fs+2)+3,label+": regengetal "+r.tekst+" ("+r.uur.slice(11,16)+") zweeft "+(r.boven===null?"?":r.boven.toFixed(1))+" boven zijn staafje");
            assert(!r.opStip,label+": regengetal "+r.tekst+" ("+r.uur.slice(11,16)+") bedekt een stip van piek, dal of nu");
            const vorige=m.regen.find(x=>Date.parse(x.uur+"Z")===Date.parse(r.uur+"Z")-3600000);
            assert(!vorige||vorige.tekst!==r.tekst,label+": regengetal "+r.tekst+" herhaalt zich voor opeenvolgende uren");
          }
          assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
          console.log("GRAFIEK "+label+": "+(plan.map(p=>p.type+" "+p.waarde+"°").join(", ")||"geen piek of dal in beeld")+"; "+m.regen.length+" regengetal(len).");
        }finally{await context.close();}
      }
    }
  }finally{await browser.close();server.close();}
  console.log("Grafiekinteractie en piek/dal OK op 360, 390, 768 en 1366px.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

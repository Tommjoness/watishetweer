"use strict";

/* Zon-op- en zon-onder-labels in de grafiek (index.html tekent ze boven de nachtband, ieder naast zijn eigen lijn).
   Fase 2a (25 oktober 2026) liet zien dat deze labels elkaar kunnen raken: in het Engels op de telefoon bij een korte winterdag
   ("sunrise 07:25" en "sunset 17:22" op 320 tot 390px), en in beide talen op tablet en desktop bij een zeer korte of zeer lange
   dag. #563 zette de lettergrootte van de labels terug op 11px om de verslechtering door 12px te herstellen; de overlap zelf bleef.
   Fase 2b lost die op met een botsingsafhandeling (ontwarZonlabels in mobile-graph-ux-20260828.js): raken twee labels elkaar, dan
   klapt het ene naar de andere kant van zijn lijn en past dat niet, dan worden ze samengevoegd. De tekst gaat niet kleiner en
   er verdwijnt geen tijd.
   Deze test loopt daglengtes van vrijwel een etmaal tot twee uur af, in Nederlands en Engels, van 320 tot 1920px, en eist:
   - geen enkel tekstpaar in de grafiek overlapt (ook niet met andere teksten);
   - zowel de zon-op- als de zon-onder-tijd staat nog in de grafiek, of in #suntimes erboven (op de telefoon, tot en met 430px,
     in beide talen: daar staan ze bewust alleen in #suntimes, zie vereenvoudigMobieleZonband en zonlabels-telefoon-browser.test.js);
   - de lettergrootte van de labels blijft 11px (op 1440px en breder 13px, zoals alle grafiektekst), nooit kleiner;
   - samengevoegde labels staan binnen de grafiek;
   - een dag zonder botsing blijft ongemoeid: de labels staan op hun getekende plek. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};

/* [zon op, zon onder]; het venster begint om 00:13, dus beide vallen binnen de zichtbare 25 uur. */
const DAGEN=[["07:25","17:22"],["06:00","18:30"],["09:00","15:30"],["10:30","13:30"],["10:40","12:20"],["11:20","12:40"],["03:00","21:30"],["00:40","23:30"]];
const BREEDTES=[320,360,375,390,430,768,1100,1440,1920];
const air={current:{european_aqi:30,us_aqi:40},hourly:{time:["2026-07-22T00:13"],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const NU=Date.UTC(2026,6,21,22,13,0);

function bouwServer(zon){
  const d=bouw({tempNu:11,wcNu:3,ccNu:60,rh:80,pp:()=>10,pr:()=>0,wc:()=>3,cc:()=>60,som:2});
  d.latitude=52.3676;d.longitude=4.9041;d.elevation=3;d.minutely_15=null;
  Object.assign(d.current,{time:"2026-07-22T00:13",interval:900,visibility:16000});
  d.daily.sunshine_duration=d.daily.time.map(()=>2*3600);
  d.daily.sunrise=d.daily.time.map(t=>t+"T"+zon[0]);d.daily.sunset=d.daily.time.map(t=>t+"T"+zon[1]);
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const stub=`<script>Date.now=()=>${NU};window.fetch=async function(url){const u=String(url);
    const payload=u.includes('/api/neerslag')?${JSON.stringify({beschikbaar:false,reden:"test"})}:u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[]})}:u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Amsterdam",land:"NL",bron:"test"})}:${JSON.stringify(d)};
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

function meet(){
  const svg=document.querySelector("#chart"),sr=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal,sc=vb&&vb.width?sr.width/vb.width:1;
  const alle=[...svg.querySelectorAll("text")].filter(t=>{const q=t.getBoundingClientRect(),c=getComputedStyle(t);return q.width>0&&q.height>0&&c.display!=="none"&&c.visibility!=="hidden"&&!t.closest("#scrub");});
  const zon=alle.filter(t=>t.hasAttribute("data-zon-label")).map(t=>{const q=t.getBoundingClientRect();return {t:t.textContent.trim(),l:q.left,r:q.right,px:parseFloat(getComputedStyle(t).fontSize)*sc,plaatsing:t.getAttribute("data-zon-plaatsing")||"",anker:t.getAttribute("text-anchor"),x:Number(t.getAttribute("x")),lijn:Number(t.getAttribute("data-zon-x"))};}).sort((a,b)=>a.l-b.l);
  const tt=alle.map(e=>({t:e.textContent.trim(),r:e.getBoundingClientRect()}));const paren=[];
  for(let i=0;i<tt.length;i++)for(let j=i+1;j<tt.length;j++){const a=tt[i].r,c=tt[j].r;const dx=Math.min(a.right,c.right)-Math.max(a.left,c.left),dy=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top);if(dx>0.5&&dy>0.5)paren.push(tt[i].t+" × "+tt[j].t+" ("+dx.toFixed(1)+"×"+dy.toFixed(1)+")");}
  const st=document.getElementById("suntimes");
  return {zon,paren,svgL:sr.left,svgR:sr.right,suntimes:st?st.textContent.replace(/\s+/g," "):"",suntimesZichtbaar:!!(st&&st.getBoundingClientRect().height>0)};
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let n=0,omgeklapt=0,samengevoegd=0,ongemoeid=0;
  try{
    for(const zon of DAGEN){
      const srv=bouwServer(zon);await new Promise(r=>srv.listen(0,"127.0.0.1",r));
      try{
        for(const taal of ["en","nl"])for(const breedte of BREEDTES){
          const L=`${zon[0]}–${zon[1]} ${taal} ${breedte}px`;
          const context=await browser.newContext({viewport:{width:breedte,height:900},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",serviceWorkers:"block"});
          try{
            const page=await context.newPage(),fouten=[];
            page.on("pageerror",e=>fouten.push(String(e)));
            if(taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
            await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL`,{waitUntil:"networkidle"});
            await page.waitForSelector("#chart text",{state:"attached",timeout:15000});
            await page.waitForTimeout(900);
            const r=await page.evaluate(meet);
            /* Geen enkel tekstpaar overlapt. */
            assert.deepEqual(r.paren,[],`${L}: overlappende teksten in de grafiek`);
            const telefoon=breedte<=430;
            if(telefoon){
              assert.equal(r.zon.length,0,`${L}: zon-labels staan op de telefoon bewust niet in de SVG (beide talen)`);
              [zon[0],zon[1]].forEach(t=>assert.ok(r.suntimesZichtbaar&&r.suntimes.includes(t),`${L}: tijd ${t} staat niet in #suntimes (${r.suntimes})`));
            }else{
              /* Beide tijden blijven zichtbaar: elk in een eigen label, of samen in één label. */
              const tekst=r.zon.map(z=>z.t).join(" | ");
              [zon[0],zon[1]].forEach(t=>assert.ok(tekst.includes(t),`${L}: tijd ${t} ontbreekt in de zon-labels (${tekst})`));
              assert.ok(r.zon.length>=1&&r.zon.length<=2,`${L}: ${r.zon.length} zon-labels`);
              r.zon.forEach(z=>{
                const min=breedte>=1440?13:11;
                assert.ok(z.px>=min-0.2,`${L}: zon-label "${z.t}" is ${z.px.toFixed(2)}px (minimaal ${min}px)`);
                assert.ok(z.l>=r.svgL-0.5&&z.r<=r.svgR+0.5,`${L}: zon-label "${z.t}" valt buiten de grafiek`);
              });
              if(r.zon.some(z=>z.plaatsing==="samengevoegd")){samengevoegd++;assert.equal(r.zon.length,1,`${L}: samengevoegd label naast een ander label`);}
              else if(r.zon.some(z=>z.plaatsing==="omgeklapt"))omgeklapt++;
              else ongemoeid++;
            }
            /* Een dag zonder botsing blijft zoals getekend: zon op 07:25 en zon onder 17:22 liggen vanaf 768px minstens 60px uit elkaar. */
            if(zon[0]==="07:25"&&breedte>=768)assert.ok(r.zon.every(z=>!z.plaatsing),`${L}: labels zonder botsing zijn niet verplaatst`);
            assert.deepEqual(fouten,[],`${L}: scriptfouten`);
            n++;
          }finally{await context.close();}
        }
      }finally{srv.close();}
    }
    console.log(`Zon-labels: ${n} situaties (8 daglengtes × NL/EN × 320 tot 1920px): geen overlappende grafiekteksten, beide tijden zichtbaar, lettergrootte niet kleiner dan 11px (13px vanaf 1440px); ${omgeklapt} keer een label omgeklapt, ${samengevoegd} keer samengevoegd, ${ongemoeid} keer ongemoeid.`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

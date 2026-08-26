"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

/* Gerichte fixture voor checkpoint 50: veel lokale temperatuurpieken en -dalen,
   een actuele temperatuur tussen twee modeluren en sterk wisselende bewolking.
   Zo raken we precies de Nachtzicht- en grafiekgevallen die op een telefoon krap
   kunnen worden, zonder de brede 100%-weermatrix nu al dubbel uit te voeren. */
const d=bouw({
  temp:(u,dag)=>{
    const basis=[13.1,12.7,12.4,12.2,12.5,13.2,14.4,15.9,17.1,18.8,19.4,20.6,20.1,21.3,20.2,21.0,19.8,20.5,18.9,18.3,17.6,16.8,15.9,14.8][u];
    return +(basis+(dag||0)*0.12).toFixed(1);
  },
  tempNu:20.7,
  pp:(u)=>u===16?65:u===17?45:5,
  pr:(u)=>u===16?1.4:u===17?0.2:0,
  som:1.6,
  cc:(u,dag)=>{
    if(u>=22||u<=2)return (dag%2===0?18:28);
    if(u===3)return 72;
    return 48;
  },
  ccNu:42,
  wc:(u)=>u===16?61:u===17?51:3,
  wcNu:3,
  ws:14,
  wsNu:13,
  wg:(u)=>u===18?42:26
});
d.current.time="2026-07-22T14:17";
d.current.interval=900;
d.current.temperature_2m=20.7;
d.current.apparent_temperature=20.1;
d.current.is_day=1;
d.current.precipitation=0;
d.current.weather_code=3;
d.current.cloud_cover=42;
d.current.wind_speed_10m=13;
d.current.wind_direction_10m=250;
d.current.wind_gusts_10m=27;
d.current.pressure_msl=1014;
d.current.visibility=18000;
d.elevation=3;
d.latitude=52.35;
d.longitude=5.26;
d.daily.sunrise=d.daily.time.map(t=>t+"T05:46");
d.daily.sunset=d.daily.time.map(t=>t+"T21:44");
d.daily.sunshine_duration=d.daily.time.map(()=>9.3*3600);

/* Volledige droge kwartierdata voor de eerstvolgende twee uur. */
d.minutely_15={time:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[]};
for(let i=0;i<9;i++){
  const ms=Date.UTC(2026,6,22,12,15)+i*15*60000;
  const t=new Date(ms+2*3600000).toISOString().slice(0,16);
  d.minutely_15.time.push(t);d.minutely_15.precipitation.push(0);d.minutely_15.rain.push(0);
  d.minutely_15.showers.push(0);d.minutely_15.snowfall.push(0);d.minutely_15.weather_code.push(3);
}

const air={current:{european_aqi:24,us_aqi:33},hourly:{
  time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[4],mugwort_pollen:[1],ragweed_pollen:[0],olive_pollen:[0]
}};

let html=fs.readFileSync(path.join(__dirname,"public/index.html"),"utf8");
const fixedNow=Date.UTC(2026,6,22,12,17); // 14:17 Europe/Amsterdam
const stub=`<script>
Date.now=()=>${fixedNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
    :u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Almere",latitude:52.35,longitude:5.26,admin1:"Flevoland",country_code:"NL"}]})}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Almere",land:"NL",bron:"test"})}
    :${JSON.stringify(d)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const server=http.createServer((req,res)=>{
  const pathname=(req.url||"").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;
  }
  const rel=pathname.startsWith("/")?pathname.slice(1):pathname,file=path.join(__dirname,"public",rel);
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){
    const ext=path.extname(file).toLowerCase(),types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(file).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

function oordeelUitAdvies(tekst){
  return String(tekst||"").replace(/^Voorlopig\s+/i,"").replace(/^Later in de week:\s*/i,"").split(" · ")[0].trim();
}
function oordeelVoorScore(n){return n>=9?"Uitstekend":n>=7?"Goed":n>=5?"Redelijk":n>=4?"Matig":"Ongunstig";}

async function controleer(page,naam,breedte){
  const fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Almere&land=NL`,{waitUntil:"networkidle"});
  await page.waitForSelector("#app",{state:"visible"});
  await page.evaluate(()=>document.fonts&&document.fonts.ready);

  const r=await page.evaluate(()=>{
    const rect=el=>{const b=el.getBoundingClientRect();return {l:b.left,r:b.right,t:b.top,b:b.bottom,w:b.width,h:b.height};};
    const overlapt=(a,b)=>Math.min(a.r,b.r)-Math.max(a.l,b.l)>0.75&&Math.min(a.b,b.b)-Math.max(a.t,b.t)>0.75;
    const nights=document.getElementById("nights"),chart=document.getElementById("chart");
    const nachtRect=rect(nights);
    const rijen=[...nights.querySelectorAll(".row.night:not(.kop)")].map(rij=>{
      const score=rij.querySelector(".score"),bar=rij.querySelector(".sbar"),cloud=rij.querySelector(".nmeta:not(.wide)"),wide=rij.querySelector(".nmeta.wide"),advies=rij.querySelector(".nachtadvies"),moon=rij.querySelector(".nachtmaan"),maanBij=moon&&moon.querySelector(".maanbij"),maanSvg=moon&&moon.querySelector(".maan-fase-svg-v2");
      const sr=rect(score),br=rect(bar),cr=rect(cloud),rr=rect(rij),wr=rect(wide);
      return {
        visible:!rij.hidden&&getComputedStyle(rij).display!=="none",
        score:(score.textContent||"").trim(),advies:(advies&&advies.textContent||"").trim(),cloud:(cloud.textContent||"").trim(),
        barWidth:parseFloat(((rij.querySelector(".sbar i")||{}).style||{}).width||"0"),
        scoreBarGap:br.l-sr.r,rowRight:rr.r,cloudRight:cr.r,cloudLeft:cr.l,
        rowScroll:rij.scrollWidth-rij.clientWidth,wideRight:wr.r,wideScroll:wide.scrollWidth-wide.clientWidth,
        moonText:moon?(moon.textContent||""):"",moonSvg:moon?moon.querySelectorAll(".maan-fase-svg-v2").length:0,
        moonBase:maanSvg?maanSvg.querySelectorAll(".maan-schaduw").length:0,
        moonSource:maanBij&&maanBij.getAttribute("data-maan-fase")!==null?Number(maanBij.getAttribute("data-maan-fase")):null,
        moonRendered:maanSvg&&maanSvg.getAttribute("data-fase")!==null?Number(maanSvg.getAttribute("data-fase")):null
      };
    });
    const kop=nights.querySelector(".row.night.kop"),cloudKop=kop&&kop.querySelector(".nmeta:not(.wide)");
    const cloudKopRect=cloudKop?rect(cloudKop):null;
    const moonlab=document.getElementById("moonlab"),moonlabSvg=moonlab&&moonlab.querySelector(".maan-fase-svg-v2");

    const teksten=[...chart.querySelectorAll("text")].filter(el=>!el.closest("#scrub")&&rect(el).w>0&&rect(el).h>0).map(el=>({tekst:(el.textContent||"").trim(),box:rect(el),font:el.getAttribute("font-family")||"",fill:el.getAttribute("fill")||""}));
    const bots=[];
    for(let i=0;i<teksten.length;i++)for(let j=i+1;j<teksten.length;j++){
      if(overlapt(teksten[i].box,teksten[j].box))bots.push({a:teksten[i],b:teksten[j]});
    }
    const gewone=teksten.filter(x=>/^-?\d+°$/.test(x.tekst)&&/Bodoni/i.test(x.font));
    const nu=teksten.filter(x=>/^nu(?:\s-?\d+°)?$/i.test(x.tekst));
    const vb=chart.viewBox.baseVal;
    const chartRect=rect(chart);
    const tempBuiten=gewone.filter(x=>x.box.l<chartRect.l-1||x.box.r>chartRect.r+1||x.box.t<chartRect.t-1||x.box.b>chartRect.b+1).map(x=>x.tekst);
    return {
      overflow:document.documentElement.scrollWidth-window.innerWidth,
      nightRows:rijen,nachtRight:nachtRect.r,
      cloudKopRight:cloudKopRect?cloudKopRect.r:null,cloudKopLeft:cloudKopRect?cloudKopRect.l:null,
      emoji:/[🌑🌒🌓🌔🌕🌖🌗🌘]/u.test((nights.textContent||"")+((document.getElementById("moonlab")||{}).textContent||"")),
      moonSvgs:document.querySelectorAll("#nights .maan-fase-svg-v2,#moonlab .maan-fase-svg-v2").length,
      moonHeading:{
        base:moonlabSvg?moonlabSvg.querySelectorAll(".maan-schaduw").length:0,
        source:moonlab&&moonlab.getAttribute("data-maan-fase")!==null?Number(moonlab.getAttribute("data-maan-fase")):null,
        rendered:moonlabSvg&&moonlabSvg.getAttribute("data-fase")!==null?Number(moonlabSvg.getAttribute("data-fase")):null
      },
      viewBox:{w:vb.width,h:vb.height},bots,nu:nu.map(x=>x.tekst),tempLabels:gewone.length,tempBuiten,
      canonicalBeste:[...nights.querySelectorAll(".nachtadvies")].filter(x=>/Beste periode\s+\d{2}:\d{2}/i.test(x.textContent||"")).length
    };
  });

  assert.deepEqual(fouten,[],`${naam} ${breedte}px: geen runtime/consolefouten`);
  assert.ok(r.overflow<=2,`${naam} ${breedte}px: geen horizontale pagina-overflow (${r.overflow}px)`);
  assert.ok(r.nightRows.length>=5,`${naam} ${breedte}px: Nachtzicht bevat de verwachte rijen`);
  assert.ok(r.moonSvgs>=r.nightRows.length,`${naam} ${breedte}px: continue maanfase-SVG's aanwezig`);
  assert.equal(r.emoji,false,`${naam} ${breedte}px: geen platformafhankelijke maanemoji in zichtbare Nachtzichttekst`);
  assert.equal(r.moonHeading.base,1,`${naam} ${breedte}px: maanfase in de kop heeft één herkenbare schaduwschijf`);
  assert.ok(Number.isFinite(r.moonHeading.source)&&Number.isFinite(r.moonHeading.rendered)&&Math.abs(r.moonHeading.source-r.moonHeading.rendered)<=0.0001,`${naam} ${breedte}px: maanfase in de kop volgt de berekende fase`);
  assert.equal(r.canonicalBeste,0,`${naam} ${breedte}px: oude overprecieze 'Beste periode'-tekst is niet zichtbaar`);

  const mobiel=breedte<760;
  const zichtbareNachten=r.nightRows.filter(rij=>rij.visible).length;
  assert.equal(zichtbareNachten,mobiel?Math.min(3,r.nightRows.length):r.nightRows.length,`${naam} ${breedte}px: juiste aantal Nachtzicht-rijen zichtbaar`);

  for(const [i,rij] of r.nightRows.entries()){
    const m=/^(\d+)\/10$/.exec(rij.score);assert(m,`${naam} ${breedte}px nacht ${i}: zichtbare scorevorm`);
    const score=Number(m[1]);
    assert.equal(oordeelUitAdvies(rij.advies).toLowerCase(),oordeelVoorScore(score).toLowerCase(),`${naam} ${breedte}px nacht ${i}: oordeel volgt zichtbare score`);
    assert.equal(rij.barWidth,score*10,`${naam} ${breedte}px nacht ${i}: balk volgt zichtbare score`);
    if(rij.visible){
      assert.ok(rij.scoreBarGap>=8,`${naam} ${breedte}px nacht ${i}: score en balk hebben minimaal 8px ruimte (${rij.scoreBarGap}px)`);
      assert.ok(rij.rowRight<=r.nachtRight+1,`${naam} ${breedte}px nacht ${i}: rij blijft binnen Nachtzicht`);
      assert.ok(rij.cloudRight<=r.nachtRight+1&&rij.cloudLeft>=0,`${naam} ${breedte}px nacht ${i}: bewolking blijft binnen kolom`);
      assert.ok(rij.rowScroll<=1,`${naam} ${breedte}px nacht ${i}: rij-inhoud loopt niet horizontaal uit (${rij.rowScroll}px)`);
      assert.ok(rij.wideRight<=r.nachtRight+1,`${naam} ${breedte}px nacht ${i}: tekstkolom blijft binnen Nachtzicht`);
      assert.ok(rij.wideScroll<=1,`${naam} ${breedte}px nacht ${i}: tekstkolom wrapt zonder interne overflow (${rij.wideScroll}px)`);
    }
    assert.equal(rij.moonBase,1,`${naam} ${breedte}px nacht ${i}: maanfase heeft één herkenbare schaduwschijf`);
    assert.ok(Number.isFinite(rij.moonSource)&&Number.isFinite(rij.moonRendered)&&Math.abs(rij.moonSource-rij.moonRendered)<=0.0001,`${naam} ${breedte}px nacht ${i}: zichtbare fase volgt de berekende fase`);
    assert(/^\d{1,3}%$/.test(rij.cloud),`${naam} ${breedte}px nacht ${i}: mobiele/compacte bewolking blijft helder percentage`);
  }
  assert.ok(r.cloudKopRight===null||r.cloudKopRight<=r.nachtRight+1,`${naam} ${breedte}px: kop Bewolking loopt niet uit Nachtzicht`);

  const basisH=mobiel?250:296;
  assert.equal(r.viewBox.w,mobiel?380:900,`${naam} ${breedte}px: grafiekbreedte blijft canoniek`);
  /* Checkpoint 50 bewaakt de basisgrafiek. Latere lagen mogen uitsluitend onder
     die basis extra gereserveerde informatieruimte toevoegen (Q4 regenperioden),
     maar de grafiek mag nooit krimpen of onbeheerst doorgroeien. */
  assert.ok(r.viewBox.h>=basisH&&r.viewBox.h<=basisH+100,`${naam} ${breedte}px: grafiekhoogte blijft binnen basis + gereserveerde onderruimte (${r.viewBox.h}px)`);
  assert.deepEqual(r.nu,["nu 21°"],`${naam} ${breedte}px: exact één actuele temperatuur in grafiek`);
  if(mobiel)assert.ok(r.tempLabels>=4,`${naam} ${breedte}px: mobiel houdt meerdere temperatuurreferenties naast het actuele punt (${r.tempLabels})`);
  else assert.ok(r.tempLabels>=6,`${naam} ${breedte}px: desktop houdt voldoende zichtbare temperatuurreferenties`);
  assert.deepEqual(r.tempBuiten,[],`${naam} ${breedte}px: temperatuurcijfers blijven binnen grafiek`);
  assert.deepEqual(r.bots,[],`${naam} ${breedte}px: zichtbare grafiekteksten botsen niet; botsingen: ${JSON.stringify(r.bots)}`);
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    for(const [naam,type] of [["Chromium",chromium],["WebKit",webkit]]){
      const browser=await type.launch({headless:true});
      try{
        for(const breedte of [320,360,375,390,430,1440]){
          const context=await browser.newContext({viewport:{width:breedte,height:900},deviceScaleFactor:breedte<760?3:1});
          const page=await context.newPage();
          try{await controleer(page,naam,breedte);}finally{await context.close();}
        }
      }finally{await browser.close();}
    }
    console.log("Checkpoint 50 browsermatrix geslaagd: Nachtzicht + grafiek in Chromium/WebKit op 320/360/375/390/430/desktop.");
  }finally{server.close();}
})().catch(err=>{console.error(err);process.exit(1);});

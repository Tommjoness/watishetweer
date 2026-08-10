"use strict";
const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const d=bouw({
  temp:(u,dag)=>18+8*Math.sin((u-7)/24*Math.PI*2)+(u===18&&dag===0?3:0),
  pp:(u,dag)=>dag===0&&u>=16&&u<=18?65:8,
  pr:(u,dag)=>dag===0&&u===17?0.5:0,
  cc:(u,dag)=>dag===0&&u>=17&&u<=19?75:25,
  wg:(u,dag)=>dag===0&&u===18?72:30
});
d.current.interval=900;d.current.visibility=16000;d.elevation=3;d.latitude=52.35;d.longitude=5.26;
d.daily.sunshine_duration=d.daily.time.map(()=>7.5*3600);
d.minutely_15={time:[],precipitation:[],rain:[],showers:[],snowfall:[],weather_code:[]};
for(let i=1;i<=20;i++){
  const t=new Date(Date.UTC(2026,6,22,14,0)+i*15*60000).toISOString().slice(0,16),nat=i>=9&&i<=11?0.12:0;
  d.minutely_15.time.push(t);d.minutely_15.precipitation.push(nat);d.minutely_15.rain.push(nat);
  d.minutely_15.showers.push(0);d.minutely_15.snowfall.push(0);d.minutely_15.weather_code.push(nat?61:3);
}
const air={current:{european_aqi:22,us_aqi:45},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[4],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};

let html=fs.readFileSync(path.join(__dirname,"public/index.html"),"utf8");
const stub=`<script>window.fetch=async function(url){const u=String(url);const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[]})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Amsterdam",latitude:52.37,longitude:4.90,admin1:"Noord-Holland",country_code:"NL"}]})}:u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Browsertest",bron:"test"})}:${JSON.stringify(d)};return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};};try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
html=html.replace("</head>",stub+"</head>");

const server=http.createServer((req,res)=>{
  const p=(req.url||"").split("?")[0];
  if(p==="/"||p==="/index.html"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}
  const rel=p.startsWith("/")?p.slice(1):p,f=path.join(__dirname,"public",rel);
  if(fs.existsSync(f)&&fs.statSync(f).isFile()){
    const ext=path.extname(f).toLowerCase(),types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(f).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

async function controleer(page,naam,modus,mobiel){
  const fouten=[];page.on("pageerror",e=>fouten.push(String(e)));page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Browsertest`,{waitUntil:"networkidle"});
  await page.waitForSelector("#app",{state:"visible"});

  const resultaat=await page.evaluate(()=>{
    const chart=document.getElementById("chart");
    const labels=[...chart.querySelectorAll("text")].filter(el=>/^-?\d+°$/.test((el.textContent||"").trim())&&String(el.getAttribute("font-family")||"").includes("Bodoni"));
    let bots=0,dubbelDichtbij=0;
    for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
      const a=labels[i].getBoundingClientRect(),b=labels[j].getBoundingClientRect();
      if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)bots++;
      if((labels[i].textContent||"").trim()===(labels[j].textContent||"").trim()&&Math.abs((a.left+a.right-b.left-b.right)/2)<58)dubbelDichtbij++;
    }

    const kop=document.querySelector("#nights .row.night.kop"),bewKop=kop&&kop.querySelector(".nmeta:not(.wide)");
    const kr=kop&&kop.getBoundingClientRect(),br=bewKop&&bewKop.getBoundingClientRect();
    const recent=document.getElementById("prec"),recentStat=recent&&recent.parentElement;
    const dagMm=[...document.querySelectorAll("#days .dag-mm")].map(el=>(el.textContent||"").trim());
    const maan=document.querySelector(".maan-fase-svg-v3"),maanLicht=maan&&maan.querySelector(".maan-licht");
    const aqKoppen=[...document.querySelectorAll("#aq .eyebrow")].map(el=>(el.textContent||"").trim());

    function tooltipVoor(tijd){
      const G=window.S&&S.geo,hit=document.getElementById("hit"),scrub=document.getElementById("scrub"),svg=document.getElementById("chart");
      if(!G||!hit||!scrub||!svg)return [];
      const i=G.TI.findIndex(t=>String(t).slice(11,16)===tijd);if(i<0)return [];
      const r=svg.getBoundingClientRect(),cx=r.left+(G.x(i)/(G.W||900))*r.width,cy=r.top+((G.pt+Math.max(10,G.ih/3))/(G.H||450))*r.height;
      hit.dispatchEvent(new PointerEvent("pointermove",{clientX:cx,clientY:cy,pointerType:"mouse",bubbles:true}));
      return [...scrub.querySelectorAll("text")].map(el=>(el.textContent||"").trim());
    }
    const wetTooltip=tooltipVoor("17:00"),dryTooltip=tooltipVoor("19:00");

    return {
      labels:labels.length,bots,dubbelDichtbij,
      over:document.documentElement.scrollWidth-window.innerWidth,
      brief:(document.getElementById("brief")||{}).textContent||"",
      days:document.querySelectorAll("#days .row.day:not(.kop)").length,
      recentKop:recentStat&&recentStat.querySelector(".eyebrow")?recentStat.querySelector(".eyebrow").textContent.trim():"",
      dagMm,
      wetTooltip,dryTooltip,
      nachtKopBinnen:!!(kr&&br&&br.left>=kr.left-1&&br.right<=kr.right+1),
      maanV3:!!maan,maanLicht:!!maanLicht,
      aqKoppen,
      nowcastKopZichtbaar:!document.querySelector("#nchint")?.previousElementSibling?.hidden
    };
  });

  assert.ok(resultaat.labels>=5,naam+" "+modus+": te weinig labels");
  assert.equal(resultaat.bots,0,naam+" "+modus+": temperatuurlabels botsen");
  assert.equal(resultaat.dubbelDichtbij,0,naam+" "+modus+": identieke afgeronde temperatuurlabels staan onnodig vlak naast elkaar");
  assert.ok(resultaat.over<=2,naam+" "+modus+": horizontale overflow");
  assert.ok(resultaat.brief&&resultaat.days>=7,naam+" "+modus+": kerninhoud ontbreekt");
  assert.equal(resultaat.recentKop,"Afgelopen kwartier",naam+" "+modus+": kwartierinterval gebruikt compacte kop");
  assert.ok(resultaat.dagMm.some(t=>/^\d+,\d mm$|^<0,1 mm$/.test(t)),naam+" "+modus+": neerslagdag toont verwachte hoeveelheid in mm");
  assert.ok(!resultaat.dagMm.includes("0,0 mm"),naam+" "+modus+": droge dag toont geen zinloze 0,0 mm-regel");
  assert.ok(resultaat.wetTooltip.includes("neerslagkans")&&resultaat.wetTooltip.includes("65%"),naam+" "+modus+": nat tooltipuur behoudt bronkans");
  assert.ok(resultaat.wetTooltip.includes("verwacht")&&resultaat.wetTooltip.includes("0,5 mm"),naam+" "+modus+": nat tooltipuur toont mm");
  assert.ok(resultaat.dryTooltip.includes("neerslagkans")&&resultaat.dryTooltip.includes("8%"),naam+" "+modus+": droog hoeveelheiduur behoudt niet-nulle bronkans");
  assert.ok(!resultaat.dryTooltip.includes("verwacht")&&!resultaat.dryTooltip.some(t=>/mm$/.test(t)),naam+" "+modus+": 0 mm voegt geen mm-regel toe en forceert geen 0%");
  assert.ok(resultaat.maanV3&&resultaat.maanLicht,naam+" "+modus+": continue maanfase V3 is gerenderd");
  assert.ok(resultaat.aqKoppen.includes("Graspollen"),naam+" "+modus+": natuurlijke Nederlandse pollennaam");
  assert.ok(resultaat.nowcastKopZichtbaar,naam+" "+modus+": twee-uursmodule blijft zichtbaar wanneer er echt neerslagsignaal is");
  if(mobiel)assert.ok(resultaat.nachtKopBinnen,naam+" "+modus+": BEWOLKING blijft binnen Nachtzicht-grid");

  // Zoekbediening blijft ook na de performancecache functioneel.
  await page.fill("#q","Am");await page.waitForTimeout(450);await page.press("#q","ArrowDown");await page.press("#q","Enter");
  assert.equal(await page.inputValue("#q"),"Amsterdam",naam+" "+modus+": combobox toetsenbord");
  assert.deepEqual(fouten,[],naam+" "+modus+": console/page errors: "+fouten.join(" | "));
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));const port=server.address().port;
  try{
    const schermen=[
      ["mobiel-320",{width:320,height:760},true],
      ["mobiel-360",{width:360,height:800},true],
      ["mobiel-375",{width:375,height:812},true],
      ["mobiel-390",{width:390,height:844},true],
      ["mobiel-430",{width:430,height:932},true],
      ["desktop",{width:1440,height:1000},false]
    ];
    for(const [naam,type] of [["Chromium",chromium],["WebKit",webkit]]){
      const b=await type.launch({headless:true});
      try{
        for(const [modus,viewport,mobiel] of schermen){
          const page=await b.newPage({viewport});
          await controleer(page,naam,modus,mobiel);await page.close();console.log("OK  "+naam+" "+modus);
        }
      }finally{await b.close();}
    }
  }finally{server.close();}
})().catch(e=>{console.error(e&&e.stack||e);server.close();process.exit(1);});

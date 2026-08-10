"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("../data.js");

const d=bouw({pp:()=>0,pr:()=>0,som:0,cc:()=>18,ccNu:18,wc:()=>0,wcNu:0,ws:8,wsNu:8,wg:()=>14,tempNu:21});
d.current.interval=900;
d.current.visibility=16000;
d.elevation=3;d.latitude=52.35;d.longitude=5.26;
d.daily.sunshine_duration=d.daily.time.map(()=>9.5*3600);

const air={
  current:{european_aqi:28,us_aqi:45},
  hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[4],mugwort_pollen:[1],ragweed_pollen:[0],olive_pollen:[0]}
};

let html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
const stub=`<script>
Date.now=()=>Date.UTC(2026,6,22,12,0,0);
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}
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
  const rel=pathname.startsWith("/")?pathname.slice(1):pathname;
  const bestand=path.join(__dirname,"..","public",rel);
  if(fs.existsSync(bestand)&&fs.statSync(bestand).isFile()){
    const ext=path.extname(bestand).toLowerCase();
    const types={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});fs.createReadStream(bestand).pipe(res);
  }else{res.writeHead(404);res.end("not found");}
});

async function controleer(engine,naam){
  const browser=await engine.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const fouten=[];
    page.on("pageerror",e=>fouten.push(String(e)));
    page.on("console",m=>{if(m.type()==="error")fouten.push(m.text());});
    await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Almere&land=NL`,{waitUntil:"networkidle"});
    await page.waitForSelector("#app",{state:"visible"});
    await page.waitForSelector(".maan-fase-svg-v2",{state:"attached"});

    const r=await page.evaluate(()=>{
      const prec=document.getElementById("prec"),kop=prec&&prec.parentElement&&prec.parentElement.querySelector(".eyebrow");
      const footer=document.querySelector("footer .bron-bronnen"),label=footer&&footer.querySelector(".bronlabel");
      return {
        v2:document.querySelectorAll(".maan-fase-svg-v2").length,
        oud:document.querySelectorAll(".maan-fase-svg:not(.maan-fase-svg-v2)").length,
        maanFasen:[...document.querySelectorAll(".maan-fase-svg-v2")].map(el=>el.getAttribute("data-fase")),
        recent:kop?kop.textContent.trim():"",
        footer:!!footer,
        bronItems:footer?footer.querySelectorAll(".bronitem").length:0,
        footerDisplay:footer?getComputedStyle(footer).display:"",
        footerWrap:footer?getComputedStyle(footer).flexWrap:"",
        labelBreed:label?label.getBoundingClientRect().width:0,
        footerBreed:footer?footer.getBoundingClientRect().width:0,
        overflow:document.documentElement.scrollWidth-window.innerWidth
      };
    });

    assert.equal(fouten.length,0,`${naam}: geen console/page errors: ${fouten.join(" | ")}`);
    assert.ok(r.v2>=2,`${naam}: maanfase-v2 staat in kop én Nachtzicht`);
    assert.equal(r.oud,0,`${naam}: oude/kwantiseerde maan-SVG blijft niet achter`);
    assert.ok(r.maanFasen.every(Boolean),`${naam}: iedere maan-SVG heeft een concrete fase`);
    assert.equal(r.recent,"Afgelopen kwartier",`${naam}: recente-neerslagkop is compact`);
    assert.equal(r.footer,true,`${naam}: bronfooter is gestructureerd`);
    assert.equal(r.bronItems,4,`${naam}: vier bronclusters blijven volledig aanwezig`);
    assert.equal(r.footerDisplay,"flex",`${naam}: bronclusters gebruiken flexlayout`);
    assert.equal(r.footerWrap,"wrap",`${naam}: bronclusters mogen wrappen`);
    assert.ok(r.labelBreed>=r.footerBreed*0.9,`${naam}: mobiele bronkop staat op een eigen regel`);
    assert.ok(r.overflow<=2,`${naam}: geen horizontale overflow`);
  }finally{await browser.close();}
}

server.listen(0,"127.0.0.1",async()=>{
  try{
    await controleer(chromium,"Chromium");
    await controleer(webkit,"WebKit");
    console.log("Mobiele screenshot-browsercheck: Chromium en WebKit geslaagd.");
  }catch(e){console.error(e.stack||e);process.exitCode=1;}
  finally{server.close();}
});

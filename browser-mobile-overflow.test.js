"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {execFileSync}=require("child_process");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const PUBLIC=path.join(__dirname,"public");
const indexPad=path.join(PUBLIC,"index.html");
if(!fs.existsSync(indexPad))throw new Error("public/index.html ontbreekt; voer build/postbuild eerst uit.");

/* Natte fixture met twee regenperioden, zodat juist de informatielaag onder de
   24-uursgrafiek, de weektabel en Nachtzicht allemaal daadwerkelijk renderen. */
const weer=bouw({
  pp:(u,dag)=>dag===0&&((u>=5&&u<=6)||(u>=16&&u<=18))?88:dag===0&&u===11?24:12,
  pr:(u,dag)=>dag===0?(u===5?0.1:u===6?0.2:u===16?0.8:u===17?1.2:u===18?0.6:0):0,
  wc:(u,dag)=>dag===0&&((u>=5&&u<=6)||(u>=16&&u<=18))?61:2,
  cc:(u)=>u>=16&&u<=18?65:18,
  som:2.9
});
weer.current.time="2026-07-22T04:30";
weer.current.interval=900;
weer.current.visibility=16000;
weer.current.cloud_cover=18;
weer.current.precipitation=0;
weer.current.is_day=0;
weer.latitude=52.35;weer.longitude=5.26;weer.elevation=3;
weer.daily.sunshine_duration=weer.daily.time.map(()=>7*3600);
const lucht={current:{european_aqi:24,us_aqi:42},hourly:{time:[weer.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[4],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const testNow=Date.parse("2026-07-22T02:30:00Z");

let html=fs.readFileSync(indexPad,"utf8");
const stub=`<script>
Date.now=()=>${testNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(lucht)}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Overflowtest",land:"NL",bron:"test"})}
    :${JSON.stringify(weer)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const mime={".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;
  }
  const file=path.join(PUBLIC,pathname.replace(/^\//,""));
  if(file.startsWith(PUBLIC+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.writeHead(200,{"content-type":mime[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});
    fs.createReadStream(file).pipe(res);return;
  }
  res.writeHead(404);res.end("not found");
});

function omschrijf(el){
  const id=el.id?"#"+el.id:"";
  const cls=typeof el.className==="string"&&el.className.trim()?"."+el.className.trim().replace(/\s+/g,"."):"";
  return el.tagName.toLowerCase()+id+cls;
}

async function controleer(type,naam,breedte){
  const browser=await type.launch({headless:true});
  const context=await browser.newContext({viewport:{width:breedte,height:900},serviceWorkers:"block"});
  const page=await context.newPage();
  const fouten=[];page.on("pageerror",e=>fouten.push(String(e)));
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Overflowtest&land=NL`,{waitUntil:"load"});
    await page.waitForSelector("#app",{state:"visible"});
    await page.waitForFunction(()=>document.querySelector("#chart g[data-q4-rain-periods]")&&document.querySelectorAll("#days .row.day").length>2&&document.querySelectorAll("#nights .row.night").length>1,null,{timeout:10000});
    await page.locator("#chartdata > summary").click();

    const resultaat=await page.evaluate(()=>{
      const vw=document.documentElement.clientWidth;
      const zichtbaar=el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return s.display!=="none"&&s.visibility!=="hidden"&&Number(r.width)>0&&Number(r.height)>0;
      };
      const label=el=>{
        const id=el.id?"#"+el.id:"";
        const cls=typeof el.className==="string"&&el.className.trim()?"."+el.className.trim().replace(/\s+/g,"."):"";
        return el.tagName.toLowerCase()+id+cls;
      };
      const pad=n=>Number.isFinite(n)?+n.toFixed(2):null;
      const selectorPad=el=>{
        if(!el||el.nodeType!==1)return null;
        const delen=[];
        for(let p=el;p&&p.nodeType===1&&delen.length<6;p=p.parentElement){
          delen.unshift(label(p));
          if(p.classList&&p.classList.contains("sheet"))break;
        }
        return delen.join(" > ");
      };
      const audit=el=>{
        if(!el)return null;
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return {
          el:label(el),pad:selectorPad(el),parent:el.parentElement?label(el.parentElement):null,
          left:pad(r.left),right:pad(r.right),width:pad(r.width),
          clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,offsetWidth:el.offsetWidth,
          overflowX:s.overflowX,overflowY:s.overflowY,display:s.display,position:s.position,
          cssWidth:s.width,minWidth:s.minWidth,maxWidth:s.maxWidth,whiteSpace:s.whiteSpace,
          marginLeft:s.marginLeft,marginRight:s.marginRight,contain:s.contain,transform:s.transform
        };
      };
      const begrensdDoorHorizontaleScroller=el=>{
        for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){
          const s=getComputedStyle(p),x=s.overflowX;
          if((x==="auto"||x==="scroll")&&p.scrollWidth>p.clientWidth+.75)return p;
        }
        return null;
      };
      const buiten=[];
      for(const el of document.querySelectorAll("body *")){
        if(!zichtbaar(el))continue;
        const r=el.getBoundingClientRect();
        /* SVG-primitieven mogen intern buiten hun eigen viewBox liggen zonder de
           documentlayout te verbreden; de SVG-container zelf telt wél mee. */
        if(el instanceof SVGElement&&el.tagName.toLowerCase()!=="svg")continue;
        const links=Math.min(0,r.left),rechts=Math.max(0,r.right-vw);
        if(links<-.75||rechts>.75){
          /* Een brede datatabel mag binnen een expliciete, zelf begrensde
             horizontale scrollregio doorlopen. Dit is geen pagina-overflow:
             de scroller zelf moet hieronder nog steeds binnen de viewport
             vallen en html/body-scrollWidth blijven apart hard bewaakt. */
          const scroller=begrensdDoorHorizontaleScroller(el);
          if(scroller&&scroller!==el)continue;
          buiten.push({el:label(el),left:+r.left.toFixed(2),right:+r.right.toFixed(2),width:+r.width.toFixed(2),links:+links.toFixed(2),rechts:+rechts.toFixed(2)});
        }
      }
      const modules={};
      for(const [naam,sel] of Object.entries({sheet:".sheet",header:".mast",chart:"#chart",chartdata:".chartdata-scroll",days:"#days",nights:"#nights",air:"#aq",footer:"footer",minibar:"#minibar"})){
        const el=document.querySelector(sel);if(!el)continue;const r=el.getBoundingClientRect();
        modules[naam]={left:+r.left.toFixed(2),right:+r.right.toFixed(2),width:+r.width.toFixed(2),scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,overflowX:getComputedStyle(el).overflowX};
      }

      /* Diagnoseer scrollbare/intrinsieke overflow ook wanneer rects zelf netjes
         binnen de viewport liggen. Dit verandert geen enkele assertie: het
         maakt alleen de echte eigenaar zichtbaar wanneer de harde bodygate faalt. */
      const sheet=document.querySelector(".sheet");
      const kandidaten=sheet?[sheet,...sheet.querySelectorAll("*")]:[];
      const offenders=kandidaten
        .filter(el=>{
          if(!zichtbaar(el))return false;
          if(el instanceof SVGElement&&el.tagName.toLowerCase()!=="svg")return false;
          const r=el.getBoundingClientRect();
          return el.scrollWidth>el.clientWidth+1||r.left<-.75||r.right>vw+.75;
        })
        .map(audit)
        .sort((a,b)=>Math.max((b.scrollWidth||0)-(b.clientWidth||0),Math.max(0,(b.right||0)-vw))-Math.max((a.scrollWidth||0)-(a.clientWidth||0),Math.max(0,(a.right||0)-vw)))
        .slice(0,15);
      const expliciet={};
      for(const [k,sel] of Object.entries({
        sheet:".sheet",details:"#chartdata",summary:"#chartdata > summary",hint:".chartdata-scrollhint",scroller:".chartdata-scroll",table:".chartdata-scroll table"
      }))expliciet[k]=audit(document.querySelector(sel));

      const scroller=document.querySelector(".chartdata-scroll");
      let scrollProbe=null;
      if(scroller){
        const voor=scroller.scrollLeft,max=Math.max(0,scroller.scrollWidth-scroller.clientWidth),doel=Math.min(48,max);
        scroller.scrollLeft=doel;
        scrollProbe={voor,na:scroller.scrollLeft,max};
        scroller.scrollLeft=voor;
      }

      return {
        innerWidth:window.innerWidth,clientWidth:vw,
        htmlScroll:document.documentElement.scrollWidth,
        bodyScroll:document.body.scrollWidth,
        buiten,modules,
        overflowAudit:{offenders,expliciet},
        scrollProbe,
        q4Labels:[...document.querySelectorAll('#chart g[data-q4-rain-periods] text')].map(x=>(x.textContent||"").trim()),
        q4ViewBox:document.getElementById("chart").getAttribute("viewBox"),
        scrollHint:getComputedStyle(document.querySelector(".chartdata-scrollhint")).display
      };
    });

    const diagnose=JSON.stringify(resultaat);
    assert.equal(resultaat.clientWidth,breedte,`${naam} ${breedte}: onverwachte viewport; ${diagnose}`);
    assert.ok(resultaat.htmlScroll<=resultaat.clientWidth,`${naam} ${breedte}: document heeft horizontale overflow; ${diagnose}`);
    assert.ok(resultaat.bodyScroll<=resultaat.clientWidth,`${naam} ${breedte}: body heeft horizontale overflow; ${diagnose}`);
    assert.deepEqual(resultaat.buiten,[],`${naam} ${breedte}: zichtbare elementen steken buiten viewport; ${diagnose}`);
    if(resultaat.modules.chartdata){
      assert.ok(resultaat.modules.chartdata.left>=-.75&&resultaat.modules.chartdata.right<=resultaat.clientWidth+.75,`${naam} ${breedte}: grafiekdatatabel-scroller zelf valt buiten viewport; ${diagnose}`);
      assert.ok(["auto","scroll"].includes(resultaat.modules.chartdata.overflowX),`${naam} ${breedte}: brede grafiekdatatabel is niet horizontaal begrensd; ${diagnose}`);
      if(resultaat.modules.chartdata.scrollWidth>resultaat.modules.chartdata.clientWidth+1){
        assert.ok(resultaat.scrollProbe&&resultaat.scrollProbe.max>0&&resultaat.scrollProbe.na>resultaat.scrollProbe.voor,`${naam} ${breedte}: grafiekdatatabel is breed maar kan niet echt horizontaal worden gescrold; ${diagnose}`);
      }
    }
    if(breedte<=430)assert.notEqual(resultaat.scrollHint,"none",`${naam} ${breedte}: horizontaal scrollbare grafiektabel mist een zichtbare aanwijzing; ${diagnose}`);
    else assert.equal(resultaat.scrollHint,"none",`${naam} ${breedte}: mobiele scrollaanwijzing blijft onnodig zichtbaar op desktop; ${diagnose}`);
    assert.deepEqual(fouten,[],`${naam} ${breedte}: pageerrors; ${JSON.stringify(fouten)}`);
    console.log(`Mobiele overflow OK: ${naam} ${breedte}px; chart ${resultaat.modules.chart.width}px; labels ${resultaat.q4Labels.join(" | ")}`);
  }finally{await context.close();await browser.close();}
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    for(const [type,naam] of [[chromium,"Chromium"],[webkit,"WebKit"]]){
      for(const breedte of [320,375,390,430,1280])await controleer(type,naam,breedte);
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
  /* De mobiele overflowcheck is al een vaste eindrondepoort. Koppel hier ook
     de fysieke iPhone-regressie aan, zodat eerste render en dagwissel van de
     gewone uuras niet opnieuw ongemerkt uit de checkpoint kunnen verdwijnen. */
  execFileSync(process.execPath,[path.join(__dirname,"browser-mobile-feedback-20260826.test.js")],{stdio:"inherit"});
})().catch(err=>{console.error(err&&err.stack||err);try{server.close(()=>{});}catch(_){}process.exit(1);});

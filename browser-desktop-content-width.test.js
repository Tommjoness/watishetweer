"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");

const ROOT=path.join(__dirname,"public");
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"").split("?")[0];
  const rel=pathname==="/"?"index.html":pathname.replace(/^\//,"");
  const file=path.join(ROOT,rel);
  if(!file.startsWith(ROOT)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404);res.end("not found");return;
  }
  const ext=path.extname(file).toLowerCase();
  const types={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
  res.writeHead(200,{"content-type":types[ext]||"application/octet-stream","cache-control":"no-store"});
  fs.createReadStream(file).pipe(res);
});

async function controleer(browserType,naam){
  const browser=await browserType.launch({headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1600,height:900},locale:"nl-NL",serviceWorkers:"block"});
    const page=await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:"domcontentloaded"});

    for(const width of [1600,1920]){
      await page.setViewportSize({width,height:900});
      await page.evaluate(()=>{
        const app=document.getElementById("app");
        if(app)app.style.display="block";
      });
      await page.waitForTimeout(60);

      const g=await page.evaluate(()=>{
        const rect=sel=>{
          const el=document.querySelector(sel);
          if(!el)return null;
          const r=el.getBoundingClientRect();
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
        };
        const sheet=document.querySelector(".sheet"),cs=getComputedStyle(sheet);
        const paddingLeft=parseFloat(cs.paddingLeft)||0,paddingRight=parseFloat(cs.paddingRight)||0;
        const binnen=sheet.clientWidth-paddingLeft-paddingRight;
        const dagen=document.querySelector(".dashrow-days");
        const kinderen=dagen?[...dagen.children].map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width};}):[];
        return {
          binnen,
          sheet:rect(".sheet"),
          app:rect("#app"),
          chart:rect(".dashrow-chart"),
          chartcol:rect(".dashrow-chart>.dashcol"),
          dagen:rect(".dashrow-days"),
          dagcol:rect(".dashrow-days>.dashcol:first-child"),
          nachtcol:rect(".dashrow-days>.dashcol:nth-child(2)"),
          days:rect("#days"),
          nights:rect("#nights"),
          aq:rect("#aq"),
          dagenDisplay:getComputedStyle(dagen).display,
          kinderen,
          overflow:document.documentElement.scrollWidth-window.innerWidth
        };
      });

      assert(g.binnen>1200,`${naam}/${width}px: beschikbare desktopinhoud is onverwacht smal (${g.binnen}px)`);
      for(const [label,box] of Object.entries({app:g.app,chart:g.chart,chartcol:g.chartcol,dagen:g.dagen,dagcol:g.dagcol,nachtcol:g.nachtcol,days:g.days,nights:g.nights,aq:g.aq})){
        assert(box,`${naam}/${width}px: ${label} ontbreekt`);
        assert(Math.abs(box.width-g.binnen)<=2,`${naam}/${width}px: ${label} gebruikt ${box.width}px van ${g.binnen}px beschikbare breedte`);
      }
      assert.equal(g.dagenDisplay,"block",`${naam}/${width}px: Zeven dagen/Nachtzicht-wrapper is niet expliciet gestapeld`);
      assert.equal(g.kinderen.length,2,`${naam}/${width}px: verwacht exact twee gestapelde dag/nacht-kolommen`);
      assert(g.kinderen[1].top>=g.kinderen[0].bottom-1,`${naam}/${width}px: Nachtzicht staat naast/over Zeven dagen in plaats van eronder`);
      assert(g.overflow<=2,`${naam}/${width}px: breedtefix veroorzaakt ${g.overflow}px horizontale overflow`);
    }
    await context.close();
  }finally{await browser.close();}
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    await controleer(chromium,"Chromium");
    await controleer(webkit,"WebKit");
    console.log("Desktop contentbreedte groen: 1600/1920px vullen #app, grafiek, Zeven dagen, Nachtzicht en luchtkwaliteit de beschikbare breedte en dag/nacht blijft gestapeld in Chromium/WebKit.");
  }finally{server.close();}
})().catch(err=>{console.error(err);process.exit(1);});

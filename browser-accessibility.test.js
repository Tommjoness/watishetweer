"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");

const PUBLIC=path.join(__dirname,"public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("Definitieve public/index.html ontbreekt; voer build/postbuild eerst uit.");

const server=http.createServer((req,res)=>{
  const rel=((req.url||"/").split("?")[0]==="/")?"index.html":String(req.url||"").split("?")[0].replace(/^\/+/,"");
  const file=path.join(PUBLIC,rel);
  if(!file.startsWith(PUBLIC)||!fs.existsSync(file)||!fs.statSync(file).isFile()){
    res.writeHead(404);res.end("not found");return;
  }
  const ext=path.extname(file).toLowerCase();
  const types={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
  res.writeHead(200,{"content-type":types[ext]||"application/octet-stream"});
  fs.createReadStream(file).pipe(res);
});

async function controleer(browserType,naam){
  const browser=await browserType.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto("http://127.0.0.1:"+server.address().port+"/",{waitUntil:"domcontentloaded"});
    const resultaat=await page.evaluate(()=>{
      const app=document.getElementById("app");
      if(app)app.style.display="block";
      const mains=[...document.querySelectorAll("main")];
      const meetDoel=el=>{
        const r=el.getBoundingClientRect();
        return {tekst:(el.textContent||"").trim(),hoogte:r.height,breedte:r.width};
      };
      /* Een gesloten details verbergt zijn descendant-links terecht met een
         0x0-layoutbox. Meet de summary in gesloten toestand, open daarna de
         details en meet pas dan de links die voor de gebruiker zichtbaar zijn. */
      const summaries=[...document.querySelectorAll("footer details summary")].map(meetDoel);
      [...document.querySelectorAll("footer details")].forEach(el=>{el.open=true;});
      const links=[...document.querySelectorAll("footer a")].map(meetDoel);
      return {
        mainAantal:mains.length,
        mainId:mains[0]&&mains[0].id,
        appTag:app&&app.tagName,
        doelen:[...summaries,...links],
        maanAria:[...document.querySelectorAll(".maanbij")].map(el=>el.getAttribute("aria-label"))
      };
    });
    assert.equal(resultaat.mainAantal,1,naam+": exact één main-landmark");
    assert.equal(resultaat.mainId,"app",naam+": #app is het main-landmark");
    assert.equal(resultaat.appTag,"MAIN",naam+": #app gebruikt native main-semantiek");
    assert.ok(resultaat.doelen.length>=5,naam+": footerdoelen ontbreken");
    resultaat.doelen.forEach(doel=>{
      assert.ok(doel.hoogte>=43.5,naam+": footerdoel '"+doel.tekst+"' is "+doel.hoogte+"px hoog");
      assert.ok(doel.breedte>0,naam+": footerdoel '"+doel.tekst+"' heeft geen breedte");
    });
    assert.ok(resultaat.maanAria.every(v=>v===null),naam+": .maanbij krijgt geen dubbel aria-label");
  }finally{await browser.close();}
}

server.listen(0,"127.0.0.1",async()=>{
  try{
    await controleer(chromium,"Chromium 390");
    await controleer(webkit,"WebKit 390");
    console.log("Accessibility-browsercontract groen in Chromium en WebKit.");
  }catch(e){console.error(e&&e.stack||e);process.exitCode=1;}
  finally{server.close();}
});

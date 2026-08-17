"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");

const PUBLIC=path.join(__dirname,"public");
const privacyPad=path.join(PUBLIC,"privacy.html");
if(!fs.existsSync(privacyPad))throw new Error("Definitieve public/privacy.html ontbreekt voor themacontrole.");

const privacyBron=fs.readFileSync(privacyPad,"utf8");
const themaInit=privacyBron.indexOf('localStorage.getItem("weerbriefing.thema")');
const stijl=privacyBron.indexOf("<style>");
assert.ok(themaInit>0&&stijl>themaInit,"thema-initialisatie moet vóór het eerste stijlblok staan om een verkeerde themapaint te voorkomen");
assert.ok(!privacyBron.includes('data-thema="rood"'),"de verwijderde rode weergavestand mag niet opnieuw op de privacypagina ontstaan");

const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png"};
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  const rel=pathname==="/"?"index.html":pathname.replace(/^\//,"");
  const file=path.join(PUBLIC,rel);
  if(file.startsWith(PUBLIC+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.writeHead(200,{"content-type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","cache-control":"no-store"});
    fs.createReadStream(file).pipe(res);return;
  }
  res.writeHead(404);res.end("not found");
});

const gevallen=[
  {keuze:"donker",thema:"donker",achtergrond:"rgb(10, 10, 10)",kaart:"rgb(20, 20, 20)"},
  {keuze:"licht",thema:"licht",achtergrond:"rgb(244, 245, 243)",kaart:"rgb(255, 255, 255)"},
  {keuze:"auto",thema:null,achtergrond:"rgb(244, 245, 243)",kaart:"rgb(255, 255, 255)"},
  {keuze:"rood",thema:null,achtergrond:"rgb(244, 245, 243)",kaart:"rgb(255, 255, 255)"}
];

async function controleer(browserType,naam){
  const browser=await browserType.launch({headless:true});
  try{
    for(const geval of gevallen){
      const context=await browser.newContext({viewport:{width:390,height:844}});
      await context.addInitScript(keuze=>{
        localStorage.setItem("weerbriefing.thema",JSON.stringify(keuze));
      },geval.keuze);
      const page=await context.newPage();
      const fouten=[];
      page.on("pageerror",e=>fouten.push(String(e)));
      await page.goto(`http://127.0.0.1:${server.address().port}/privacy.html`,{waitUntil:"domcontentloaded"});
      const staat=await page.evaluate(()=>({
        thema:document.documentElement.getAttribute("data-thema"),
        achtergrond:getComputedStyle(document.body).backgroundColor,
        kaart:getComputedStyle(document.querySelector(".kaart")).backgroundColor,
        titel:(document.querySelector("h1")||{}).textContent||""
      }));
      assert.equal(staat.thema,geval.thema,`${naam}: directe privacy-load verwerkt ${geval.keuze} volgens het actieve themacontract`);
      assert.equal(staat.achtergrond,geval.achtergrond,`${naam}: pagina-achtergrond klopt voor ${geval.keuze}`);
      assert.equal(staat.kaart,geval.kaart,`${naam}: kaartachtergrond klopt voor ${geval.keuze}`);
      assert.equal(staat.titel.trim(),"Privacy & gegevens",`${naam}: privacypagina blijft inhoudelijk geladen`);
      assert.deepEqual(fouten,[],`${naam}: geen page errors bij ${geval.keuze}`);
      await context.close();
    }
    console.log(`${naam}: privacy respecteert licht/donker, behoudt auto-fallback en heractiveert oude rode voorkeur niet.`);
  }finally{await browser.close();}
}

server.listen(0,"127.0.0.1",async()=>{
  try{await controleer(chromium,"Chromium");await controleer(webkit,"WebKit");}
  catch(e){console.error(e&&e.stack||e);process.exitCode=1;}
  finally{server.close();}
});

"use strict";
const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium,webkit}=require("playwright");
const PUBLIC=path.join(__dirname,"public"),indexPad=path.join(PUBLIC,"index.html");
if(!fs.existsSync(indexPad))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(indexPad,"utf8");
html=html.replace("</head>",'<script>try{localStorage.removeItem("weerbriefing.thema")}catch(e){};window.fetch=async()=>({ok:false,status:503,json:async()=>({}),text:async()=>""});</script></head>');
const mime={".js":"application/javascript",".json":"application/json",".woff2":"font/woff2",".png":"image/png"};
const server=http.createServer((req,res)=>{const p=(req.url||"/").split("?")[0];if(p==="/"){res.writeHead(200,{"content-type":"text/html"});res.end(html);return;}const f=path.join(PUBLIC,p.replace(/^\//,""));if(f.startsWith(PUBLIC+path.sep)&&fs.existsSync(f)){res.writeHead(200,{"content-type":mime[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);return;}res.writeHead(404);res.end();});
async function check(type,naam,breedte){
  const browser=await type.launch({headless:true}),page=await browser.newPage({viewport:{width:breedte,height:900}}),errors=[];page.on("pageerror",e=>errors.push(String(e)));
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:"domcontentloaded"});
    await page.waitForSelector("#thema");
    const init=await page.evaluate(()=>{const k=document.getElementById("thema"),m=document.getElementById("themamenu"),f=document.querySelector('link[rel="icon"]');return {tekst:k.textContent.trim(),hidden:m.hidden,keuzes:[...m.querySelectorAll("[data-thema-keuze]")].map(x=>x.dataset.themaKeuze),fav:f&&f.getAttribute("href"),past:k.scrollWidth<=k.clientWidth+1,pijl:getComputedStyle(k,"::after").content};});
    assert.equal(init.tekst,"Weergave",naam+": compacte duidelijke knop");assert.equal(init.hidden,true,naam+": menu gesloten");assert.deepEqual(init.keuzes,["auto","licht","donker"],naam+": alleen nuttige keuzes");assert(init.fav&&init.fav.startsWith("data:image/svg+xml,"),naam+": zon-favicon");assert(init.past,naam+": knop past op "+breedte+"px");assert(init.pijl.includes("⌄"),naam+": knop toont menu-indicator");
    await page.click("#thema");assert.equal(await page.locator("#themamenu").evaluate(x=>x.hidden),false,naam+": menu opent");
    await page.click('[data-thema-keuze="donker"]');
    const donker=await page.evaluate(()=>({thema:document.documentElement.dataset.thema,knop:document.getElementById("thema").textContent.trim(),ink45:getComputedStyle(document.documentElement).getPropertyValue("--ink-45").trim(),ink25:getComputedStyle(document.documentElement).getPropertyValue("--ink-25").trim()}));
    assert.deepEqual(donker,{thema:"donker",knop:"Weergave",ink45:"#A8A8A8",ink25:"#959595"},naam+": donker selecteert met sterker secundair contrast");
    await page.click("#thema");await page.click('[data-thema-keuze="auto"]');
    const nacht=await page.evaluate(()=>{S.d={current:{is_day:0}};themaToepassen();return {actief:document.documentElement.dataset.thema,knop:document.getElementById("thema").textContent.trim(),auto:document.querySelector('[data-thema-keuze="auto"]').getAttribute("aria-checked"),donker:document.querySelector('[data-thema-keuze="donker"]').getAttribute("aria-checked")};});
    assert.deepEqual(nacht,{actief:"donker",knop:"Weergave",auto:"true",donker:"false"},naam+": auto-nacht is geen tweede donkerkeuze");
    const oudRood=await page.evaluate(()=>{ls.set("weerbriefing.thema","rood");themaToepassen();return {opgeslagen:ls.get("weerbriefing.thema",""),actief:document.documentElement.dataset.thema,roodOptie:!!document.querySelector('[data-thema-keuze="rood"]')};});
    assert.deepEqual(oudRood,{opgeslagen:"auto",actief:"donker",roodOptie:false},naam+": oude rode voorkeur migreert veilig naar auto");
    assert.deepEqual(errors,[],naam+": geen page errors");
  }finally{await browser.close();}
}
server.listen(0,"127.0.0.1",async()=>{try{for(const [t,n] of [[chromium,"Chromium"],[webkit,"WebKit"]]){await check(t,n,390);await check(t,n,1280);}console.log("UI-shell browsercontrole groen in Chromium en WebKit.");}catch(e){console.error(e.stack||e);process.exitCode=1;}finally{server.close();}});

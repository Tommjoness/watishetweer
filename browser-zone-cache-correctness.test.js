"use strict";
const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const PUBLIC=path.join(__dirname,"public");
let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
const cacheMark="const zoneDelenCache=new Map();",zoneOffsetMark="\nfunction zoneOffset(ms,tijdzone){";
if(html.split(cacheMark).length-1!==1)throw new Error("zoneDelenCache-markering niet eenduidig.");
const cachePos=html.indexOf(cacheMark),exposePos=html.indexOf(zoneOffsetMark,cachePos);
if(exposePos<0)throw new Error("Bijbehorende zoneOffset na zoneDelenCache ontbreekt.");
html=html.slice(0,exposePos)+"\nwindow.__zoneDelenTest=zoneDelen;"+html.slice(exposePos);
html=html.replace("</head>",'<script>window.fetch=async()=>({ok:false,status:503,json:async()=>({}),text:async()=>""});try{Object.defineProperty(navigator,"geolocation",{value:undefined,configurable:true});}catch(e){}</script></head>');
const mime={".js":"application/javascript",".json":"application/json",".woff2":"font/woff2",".png":"image/png"};
const server=http.createServer((req,res)=>{const p=(req.url||"/").split("?")[0];if(p==="/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}const f=path.join(PUBLIC,p.replace(/^\//,""));if(f.startsWith(PUBLIC+path.sep)&&fs.existsSync(f)){res.writeHead(200,{"content-type":mime[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);return;}res.writeHead(404);res.end();});
server.listen(0,"127.0.0.1",async()=>{let browser;try{
  browser=await chromium.launch({headless:true,channel:"chrome"});
  const page=await browser.newPage(),pageErrors=[];page.on("pageerror",e=>pageErrors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:"domcontentloaded"});
  const uit=await page.evaluate(()=>{
    const zoneDelen=window.__zoneDelenTest;if(typeof zoneDelen!=="function")throw new Error("zoneDelen test-expose ontbreekt.");
    const oracle=(ms,zone)=>{const d=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(ms)),p={};d.forEach(x=>{if(x.type!=="literal")p[x.type]=Number(x.value);});return {year:p.year,month:p.month,day:p.day,hour:p.hour,minute:p.minute,second:p.second};};
    const gelijk=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const tel=fn=>{const o=Intl.DateTimeFormat.prototype.formatToParts;let calls=0;Intl.DateTimeFormat.prototype.formatToParts=function(v){calls++;return o.call(this,v);};try{return {waarde:fn(),calls};}finally{Intl.DateTimeFormat.prototype.formatToParts=o;}};
    const cases=[
      [Date.parse("2026-03-29T00:59:59Z"),"Europe/Amsterdam"],[Date.parse("2026-03-29T01:00:00Z"),"Europe/Amsterdam"],
      [Date.parse("2026-10-25T00:30:00Z"),"Europe/Amsterdam"],[Date.parse("2026-10-25T01:30:00Z"),"Europe/Amsterdam"],
      [Date.parse("2026-08-12T04:15:00Z"),"UTC"],[Date.parse("2026-08-12T04:15:00Z"),"Asia/Kolkata"],
      [Date.parse("2026-01-12T04:15:00Z"),"Australia/Adelaide"],[Date.parse("2026-07-12T04:15:00Z"),"Australia/Adelaide"],
      [Date.parse("2026-08-12T04:15:00Z"),"Asia/Kathmandu"]
    ];
    const afwijkingen=cases.filter(([ms,z])=>!gelijk(zoneDelen(ms,z),oracle(ms,z)));
    const m=Date.parse("2031-08-12T04:15:00Z"),multi=tel(()=>{const utc=zoneDelen(m,"UTC"),ams=zoneDelen(m,"Europe/Amsterdam"),utcHit=zoneDelen(m,"UTC");return {utc,ams,utcHit};});
    const multiGoed=multi.calls===2&&gelijk(multi.waarde.utc,oracle(m,"UTC"))&&gelijk(multi.waarde.ams,oracle(m,"Europe/Amsterdam"))&&gelijk(multi.waarde.utcHit,multi.waarde.utc)&&multi.waarde.utcHit!==multi.waarde.utc;
    const c=Date.parse("2032-08-12T04:15:00Z"),clone=tel(()=>{const a=zoneDelen(c,"Europe/Amsterdam");a.hour=99;const b=zoneDelen(c,"Europe/Amsterdam");b.minute=98;const d=zoneDelen(c,"Europe/Amsterdam");return {a,b,d};});
    const cloneGoed=clone.calls===1&&clone.waarde.a!==clone.waarde.b&&clone.waarde.b!==clone.waarde.d&&gelijk(clone.waarde.d,oracle(c,"Europe/Amsterdam"));
    const k=Date.parse("2033-08-12T04:15:00Z"),canon=tel(()=>{const a=zoneDelen(k,"UTC"),b=zoneDelen(new Date(k),"UTC");return {a,b};});
    const canonGoed=canon.calls===1&&canon.waarde.a!==canon.waarde.b&&gelijk(canon.waarde.a,canon.waarde.b);
    const basis=Date.parse("2040-01-01T00:00:00Z"),eviction=tel(()=>{for(let i=0;i<2049;i++)zoneDelen(basis+i*1000,"UTC");const nieuw=zoneDelen(basis+2048*1000,"UTC"),oud=zoneDelen(basis,"UTC");return {nieuw,oud};});
    const evictionGoed=eviction.calls===2050&&gelijk(eviction.waarde.nieuw,oracle(basis+2048*1000,"UTC"))&&gelijk(eviction.waarde.oud,oracle(basis,"UTC"));
    return {afwijkingen,multiGoed,multiMisses:multi.calls,cloneGoed,cloneMisses:clone.calls,canonGoed,canonMisses:canon.calls,evictionGoed,evictionMisses:eviction.calls,invalidInstant:zoneDelen("geen-datum","UTC"),invalidZone:zoneDelen(Date.parse("2034-01-01T00:00:00Z"),"Etc/Definitely-Not-A-Timezone")};
  });
  assert.deepEqual(uit.afwijkingen,[],"DST/UTC/halfuur/kwartier moet exact Intl volgen");
  assert.equal(uit.multiGoed,true,`multi-zone cachekey fout; misses ${uit.multiMisses}`);
  assert.equal(uit.cloneGoed,true,`mutable clonegedrag fout; misses ${uit.cloneMisses}`);
  assert.equal(uit.canonGoed,true,`canonieke epoch-key fout; misses ${uit.canonMisses}`);
  assert.equal(uit.evictionGoed,true,`2048-FIFO eviction fout; misses ${uit.evictionMisses}`);
  assert.equal(uit.invalidInstant,null);assert.equal(uit.invalidZone,null);assert.deepEqual(pageErrors,[]);
  console.log(`Zone-cache correctness groen: DST, UTC, halfuur, kwartier, multi-zone=${uit.multiMisses}, clone=${uit.cloneMisses}, canon=${uit.canonMisses}, eviction=${uit.evictionMisses} misses.`);
}catch(e){console.error(e.stack||e);process.exitCode=1;}finally{if(browser)await browser.close();server.close();}});

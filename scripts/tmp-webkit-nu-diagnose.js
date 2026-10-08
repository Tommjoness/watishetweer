/* Tijdelijke diagnose (wordt niet gemerged): nu-label in WebKit vs Chromium op productie. */
const {webkit,chromium,devices}=require("playwright");
(async()=>{
 for(const [naam,bt,dev] of [["webkit",webkit,devices["iPhone 15 Pro Max"]],["chromium",chromium,{viewport:{width:430,height:932},deviceScaleFactor:3,isMobile:true,hasTouch:true}]]){
  const b=await bt.launch();const c=await b.newContext({...dev,colorScheme:"dark"});const p=await c.newPage();const fouten=[];
  p.on("pageerror",e=>fouten.push("pageerror: "+e.message));p.on("console",m=>{if(m.type()==="error")fouten.push("console: "+m.text().slice(0,200));});
  await p.goto("https://watishetweer.nl/?lat=52.35&lon=5.26&plaats=Almere&land=NL&analytics=uit",{waitUntil:"load",timeout:60000});
  await p.waitForFunction(()=>document.querySelector("#days .row.day:not(.kop)"),null,{timeout:60000}).catch(()=>fouten.push("geen dagen"));
  await p.waitForTimeout(3000);
  const r=await p.evaluate(()=>{const svg=document.getElementById("chart");if(!svg)return {svg:false};
   const t=[...svg.querySelectorAll("text")].find(e=>/^nu\b/i.test(String(e.textContent||"").trim()));
   const circles=[...svg.querySelectorAll("circle")].map(e=>({fill:e.getAttribute("fill"),r:e.getAttribute("r"),cx:e.getAttribute("cx"),cls:e.getAttribute("class")})).filter(o=>!/^(#fff|white|var\(--paper)/i.test(String(o.fill)));
   const lijnen=[...svg.querySelectorAll("line")].map(e=>({stroke:e.getAttribute("stroke"),x1:e.getAttribute("x1"),cls:e.getAttribute("class")})).filter(o=>!/rule|grid/i.test(String(o.cls))).slice(0,6);
   return {tekst:t&&{txt:JSON.stringify(t.textContent),codes:[...t.textContent].map(ch=>ch.charCodeAt(0).toString(16)).join(" "),x:t.getAttribute("x"),y:t.getAttribute("y"),anchor:t.getAttribute("text-anchor"),stroke:t.getAttribute("stroke"),html:t.outerHTML.slice(0,300)},
    regexMatch:t?/^nu\s+-?\d+°$/i.test(String(t.textContent||"").trim()):null,circles,lijnen,geo:typeof S!=="undefined"&&S.geo?{M:S.geo.M,pt:S.geo.pt,ih:S.geo.ih,W:S.geo.W,pl:S.geo.pl,pr:S.geo.pr,cw:S.geo.cw}:null,
    carmine:typeof CARMINE!=="undefined"?CARMINE:"(niet globaal)",ua:navigator.userAgent.slice(0,60),build:(document.querySelector('meta[name="build-sha"]')||{}).content||null};});
  console.log("DIAG "+naam+" "+JSON.stringify(r));console.log("FOUTEN "+naam+" "+JSON.stringify(fouten.slice(0,10)));
  await p.screenshot({path:`diag-${naam}.png`,clip:{x:0,y:0,width:430,height:932},fullPage:false}).catch(()=>{});
  await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});

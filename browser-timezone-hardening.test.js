"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");

const PUBLIC=path.join(__dirname,"public");
const indexPad=path.join(PUBLIC,"index.html");
if(!fs.existsSync(indexPad))throw new Error("public/index.html ontbreekt.");
let html=fs.readFileSync(indexPad,"utf8");
html=html.replace("</head>",'<script>window.fetch=async()=>({ok:false,status:503,json:async()=>({}),text:async()=>""});try{Object.defineProperty(navigator,"geolocation",{value:undefined,configurable:true});}catch(e){}</script></head>');

const mime={".js":"application/javascript",".json":"application/json",".woff2":"font/woff2",".png":"image/png"};
const server=http.createServer((req,res)=>{
  const p=(req.url||"/").split("?")[0];
  if(p==="/"){res.writeHead(200,{"content-type":"text/html"});res.end(html);return;}
  const f=path.join(PUBLIC,p.replace(/^\//,""));
  if(f.startsWith(PUBLIC+path.sep)&&fs.existsSync(f)){
    res.writeHead(200,{"content-type":mime[path.extname(f)]||"application/octet-stream"});
    fs.createReadStream(f).pipe(res);return;
  }
  res.writeHead(404);res.end();
});

async function controleer(type,naam){
  const browser=await type.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[]; page.on("pageerror",e=>errors.push(String(e)));
  try{
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:"domcontentloaded"});
    const uit=await page.evaluate(()=>{
      const iso=ms=>new Date(ms).toISOString();

      S.d={timezone:"Europe/Amsterdam",utc_offset_seconds:7200};
      const amsterdamZomer=iso(naarUTC("2026-08-12T10:00"));
      const amsterdamTerug=naarLokaal(Date.parse("2026-08-12T08:00:00Z"));
      const amsterdamWinter=iso(naarUTC("2026-01-12T10:00"));

      S.d={timezone:"Asia/Kathmandu",utc_offset_seconds:20700};
      const kathmandu=iso(naarUTC("2026-08-12T10:00"));
      const kathmanduTerug=naarLokaal(Date.parse("2026-08-12T04:15:00Z"));

      S.d={timezone:"Etc/Definitely-Not-A-Timezone",utc_offset_seconds:19800};
      const fallback=iso(naarUTC("2026-08-12T10:00"));
      const fallbackTerug=naarLokaal(Date.parse("2026-08-12T04:30:00Z"));

      return {amsterdamZomer,amsterdamTerug,amsterdamWinter,kathmandu,kathmanduTerug,fallback,fallbackTerug};
    });

    assert.equal(uit.amsterdamZomer,"2026-08-12T08:00:00.000Z",naam+": Amsterdam zomertijd gebruikt IANA-zone");
    assert.equal(uit.amsterdamTerug,"10:00",naam+": Amsterdam UTC naar lokale zomertijd");
    assert.equal(uit.amsterdamWinter,"2026-01-12T09:00:00.000Z",naam+": Amsterdam wintertijd gebruikt andere DST-offset");
    assert.equal(uit.kathmandu,"2026-08-12T04:15:00.000Z",naam+": kwartierzone Kathmandu wordt correct omgerekend");
    assert.equal(uit.kathmanduTerug,"10:00",naam+": kwartierzone rondreis is consistent");
    assert.equal(uit.fallback,"2026-08-12T04:30:00.000Z",naam+": ongeldige IANA-zone valt terug op utc_offset_seconds");
    assert.equal(uit.fallbackTerug,"10:00",naam+": fallback is in beide richtingen symmetrisch");
    assert.deepEqual(errors,[],naam+": geen page errors");
  }finally{await browser.close();}
}

server.listen(0,"127.0.0.1",async()=>{
  try{
    await controleer(chromium,"Chromium");
    await controleer(webkit,"WebKit");
    console.log("Tijdzone-hardening groen in Chromium en WebKit: IANA, DST, kwartierzone en veilige fallback.");
  }catch(e){console.error(e.stack||e);process.exitCode=1;}
  finally{server.close();}
});
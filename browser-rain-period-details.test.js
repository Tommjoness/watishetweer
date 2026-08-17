"use strict";

const fs=require("fs");
const path=require("path");
const http=require("http");
const assert=require("assert");
const {chromium,webkit}=require("playwright");
const {bouw}=require("./data.js");

const weer=bouw({
  pp:(u,dag)=>dag===0&&((u>=16&&u<=18)||u===22)?86:8,
  pr:(u,dag)=>dag===0?(u===16?0.2:u===17?0.4:u===18?0.1:u===22?0.5:0):0,
  wc:(u,dag)=>dag===0&&((u>=16&&u<=18)||u===22)?61:3,
  som:1.2
});
weer.current.interval=900;
weer.current.visibility=16000;
weer.current.cloud_cover=30;
weer.elevation=3;weer.latitude=52.35;weer.longitude=5.26;
weer.daily.sunshine_duration=weer.daily.time.map(()=>7*3600);
const lucht={current:{european_aqi:22,us_aqi:45},hourly:{time:[weer.current.time],grass_pollen:[2]}};
const testNow=Date.parse("2026-07-22T12:30:00Z");

let html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
const stub=`<script>
Date.now=()=>${testNow};
window.fetch=async function(url){
  const u=String(url);
  const payload=u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"MeteoAlarm",dekking:true,lijst:[],land:"NL"})}
    :u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(lucht)}
    :u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Regenperiodetest",land:"NL",bron:"test"})}
    :${JSON.stringify(weer)};
  return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};
};
try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}
</script>`;
html=html.replace("</head>",stub+"</head>");

const PUBLIC=path.join(__dirname,"public");
const server=http.createServer((req,res)=>{
  const pathname=(req.url||"/").split("?")[0];
  if(pathname==="/"||pathname==="/index.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);return;
  }
  const file=path.join(PUBLIC,pathname.replace(/^\//,""));
  if(file.startsWith(PUBLIC+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.writeHead(200,{"cache-control":"no-store"});fs.createReadStream(file).pipe(res);return;
  }
  res.writeHead(404);res.end("not found");
});

async function controleer(type,naam){
  const browser=await type.launch({headless:true});
  try{
    for(const breedte of [390,1280]){
      const page=await browser.newPage({viewport:{width:breedte,height:900}});
      const fouten=[];
      page.on("pageerror",e=>fouten.push(String(e)));
      await page.goto(`http://127.0.0.1:${server.address().port}/?lat=52.35&lon=5.26&plaats=Regenperiodetest&land=NL`,{waitUntil:"load"});
      await page.waitForFunction(()=>typeof S!=="undefined"&&S.d&&S.i0>=0,null,{timeout:10000});
      await page.evaluate(()=>document.fonts&&document.fonts.ready);

      const uur24=await page.evaluate(()=>{
        S.dag=null;S.bereik=24;etmaal(S.i0,24);
        const svg=document.getElementById("chart"),groep=svg.querySelector('g[data-q4-rain-periods="1"]'),g=S.geo;
        const asY=g.pt+g.ih+(g.M?20:22);
        const asTijden=[...svg.querySelectorAll("text")]
          .filter(el=>Math.abs(Number(el.getAttribute("y"))-asY)<0.1&&/^\d{2}$/.test((el.textContent||"").trim()))
          .map(el=>(el.textContent||"").trim());
        const startEls=groep?[...groep.querySelectorAll('text[data-q4-rain-period-start]')]:[];
        const layouts=startEls.map((start,i)=>{
          const eind=groep.querySelector(`text[data-q4-rain-period-end="${i}"]`),a=start.getBBox(),b=eind.getBBox();
          const overlapt=!(a.x+a.width+2<b.x||b.x+b.width+2<a.x);
          const zelfdeRegel=Math.abs(Number(start.getAttribute("y"))-Number(eind.getAttribute("y")))<0.1;
          /* De labels horen juist buiten hun bracketuiteinden te kunnen staan.
             De SVG-rand is daarom de echte visuele clipgrens; de binnenste plot-
             marge is geen foutgrens voor tekst die onder de plot wordt gezet. */
          const binnen=a.x>=-0.5&&a.x+a.width<=g.W+0.5&&b.x>=-0.5&&b.x+b.width<=g.W+0.5;
          return {
            overlapt,zelfdeRegel,binnen,
            start:{x:a.x,w:a.width},eind:{x:b.x,w:b.width},svg:{links:0,rechts:g.W},plot:{links:g.pl,rechts:g.W-g.pr}
          };
        });
        return {
          n:g&&g.n,mobiel:g&&g.M,
          starts:startEls.map(el=>(el.textContent||"").trim()),
          ends:groep?[...groep.querySelectorAll('text[data-q4-rain-period-end]')].map(el=>(el.textContent||"").trim()):[],
          details:groep?groep.querySelectorAll('text[data-q4-rain-period-detail]').length:0,
          samenvattingen:groep?groep.querySelectorAll('text[data-q4-rain-summary]').length:0,
          totalen:groep?[...groep.querySelectorAll('text[data-q4-rain-period-amount]')].map(el=>(el.textContent||"").trim()):[],
          layouts,asTijden
        };
      });
      assert.ok(uur24.n<=25,`${naam} ${breedte}: test gebruikt daadwerkelijk de 24-uursweergave`);
      assert.equal(uur24.mobiel,breedte<760,`${naam} ${breedte}: renderer gebruikt de verwachte viewportmodus`);
      assert.deepEqual(uur24.starts,["15:00","21:00"],`${naam} ${breedte}: iedere regenbracket toont de eigen begintijd`);
      assert.deepEqual(uur24.ends,["18:00","22:00"],`${naam} ${breedte}: iedere regenbracket toont de eigen eindtijd`);
      assert.equal(uur24.details,0,`${naam} ${breedte}: losse dubbele perioderegels onder de grafiek zijn verwijderd`);
      assert.equal(uur24.samenvattingen,0,`${naam} ${breedte}: totaalregel en Meeste regen zijn verwijderd`);
      assert.deepEqual(uur24.totalen,["0,7 mm","0,5 mm"],`${naam} ${breedte}: bracketbedragen blijven gelijk aan de periodegegevens`);
      assert.ok(uur24.layouts.length===2&&uur24.layouts.every(x=>x.zelfdeRegel&&!x.overlapt&&x.binnen),`${naam} ${breedte}: ook de één-uursperiode houdt begin/einde op één niet-overlappende regel zonder SVG-clipping; kreeg ${JSON.stringify(uur24.layouts)}`);
      assert.ok(uur24.asTijden.length>=6,`${naam} ${breedte}: vaste uuras blijft zichtbaar; kreeg ${JSON.stringify(uur24.asTijden)}`);

      const langer=await page.evaluate(()=>{
        S.dag=null;S.bereik=48;etmaal(S.i0,48);
        const groep=document.querySelector('#chart g[data-q4-rain-periods="1"]');
        return {
          n:S.geo&&S.geo.n,
          starts:groep?groep.querySelectorAll('text[data-q4-rain-period-start]').length:0,
          ends:groep?groep.querySelectorAll('text[data-q4-rain-period-end]').length:0,
          details:groep?groep.querySelectorAll('text[data-q4-rain-period-detail]').length:0,
          samenvattingen:groep?groep.querySelectorAll('text[data-q4-rain-summary]').length:0,
          bedragen:groep?[...groep.querySelectorAll('text[data-q4-rain-period-amount]')].map(el=>(el.textContent||"").trim()):[]
        };
      });
      assert.ok(langer.n>25,`${naam} ${breedte}: tweede controle gebruikt een langere grafiek`);
      assert.equal(langer.starts,0,`${naam} ${breedte}: 48-uursgrafiek wordt niet volgezet met begintijdlabels`);
      assert.equal(langer.ends,0,`${naam} ${breedte}: 48-uursgrafiek wordt niet volgezet met eindtijdlabels`);
      assert.equal(langer.details,0,`${naam} ${breedte}: langere grafiek houdt geen uitgeschreven perioderegels`);
      assert.equal(langer.samenvattingen,0,`${naam} ${breedte}: langere grafiek krijgt ook geen losse totaal- of pieksamenvatting`);
      assert.ok(langer.bedragen.length>=2,`${naam} ${breedte}: langere grafiek behoudt de mm-bedragen per bracket`);
      assert.deepEqual(fouten,[],`${naam} ${breedte}: geen page errors`);
      await page.close();
    }
    console.log(`${naam}: regenbrackets tonen alleen start/einde + mm, inclusief één-uursperiode, en de uuras blijft zichtbaar op mobiel én desktop.`);
  }finally{await browser.close();}
}

server.listen(0,"127.0.0.1",async()=>{
  try{await controleer(chromium,"Chromium");await controleer(webkit,"WebKit");}
  catch(e){console.error(e&&e.stack||e);process.exitCode=1;}
  finally{server.close();}
});

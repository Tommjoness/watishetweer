"use strict";

/* G2-typografie in de browser (eigenaar 22 en 23 november).
   Op ieder paginatype, mobiel en desktop, licht en donker, NL en EN:
   - geen zichtbare tekst (ook SVG-tekst in de grafiek) in Bodoni Moda;
   - geen kopjes in afgedwongen hoofdletters;
   - geen zichtbare tekst onder 12px (bewust verborgen tekst telt niet);
   - koppen 600, de grote temperatuur 400 en de weersomschrijving 500.
   Draait op het finale artifact (npm run build:cloudflare). */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {stub}=require("./taal-catalogus-browser.js");
const {SCENARIOS}=require("./taal-scenarios.js");

const OUT=path.join(__dirname,"..","public");
const TYPES={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webp":"image/webp",".jpg":"image/jpeg"};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  if(f.endsWith(".html")){
    const html=fs.readFileSync(f,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"").replace("<head>","<head>"+stub(SCENARIOS[0],""));
    res.writeHead(200,{"content-type":TYPES[".html"]});res.end(html);return;
  }
  res.writeHead(200,{"content-type":TYPES[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);
});

const WEER=["/","/weer/utrecht/"];
const PAGINAS=[...WEER,"/weer/","/witte-kerst/","/kerstvakantie/","/maan/","/nachtzicht/","/nachtzicht/hoge-veluwe/","/contact/","/over/","/privacy.html"];

function meet(){
  const zichtbaar=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=="none"&&s.visibility!=="hidden"&&parseFloat(s.opacity)>0&&r.width>1&&r.height>1;};
  /* Bewust verborgen tekst (sr-only, clip, font-size 0) is geen leesbare tekst. */
  const verborgen=e=>{for(let x=e;x&&x!==document.body;x=x.parentElement){const s=getComputedStyle(x);if(parseFloat(s.fontSize)===0||(s.position==="absolute"&&(s.clip==="rect(0px, 0px, 0px, 0px)"||/inset\(50%\)|inset\(100%\)/.test(s.clipPath)))||x.getBoundingClientRect().width<=1)return true;}return false;};
  const naam=e=>e.tagName.toLowerCase()+(e.id?"#"+e.id:"")+(e.classList.length?"."+[...e.classList].slice(0,2).join("."):"");
  const tekst=[...document.querySelectorAll("body *")].filter(e=>zichtbaar(e)&&!verborgen(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));
  const kort=e=>naam(e)+" «"+e.textContent.trim().slice(0,24)+"»";
  const h1=document.querySelector("h1"),t=document.getElementById("t"),cond=document.getElementById("cond");
  return {
    bodoni:tekst.filter(e=>/Bodoni/i.test(getComputedStyle(e).fontFamily)).map(kort),
    hoofdletters:tekst.filter(e=>getComputedStyle(e).textTransform==="uppercase").map(kort),
    klein:tekst.filter(e=>parseFloat(getComputedStyle(e).fontSize)<12).map(e=>kort(e)+" "+getComputedStyle(e).fontSize),
    h1:h1&&zichtbaar(h1)?getComputedStyle(h1).fontWeight:null,
    t:t&&zichtbaar(t)?getComputedStyle(t).fontWeight:null,
    cond:cond&&zichtbaar(cond)?getComputedStyle(cond).fontWeight:null,
    hier:(()=>{const e=document.getElementById("here");if(!e||!zichtbaar(e))return null;return getComputedStyle(e).textTransform+"/"+getComputedStyle(e,"::first-letter").textTransform;})(),
    tijd:(()=>{const e=document.getElementById("plaatstijd");return e&&zichtbaar(e)?getComputedStyle(e).fontWeight:null;})(),
    teksten:tekst.length
  };
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  let n=0;
  try{
    for(const pad of PAGINAS)for(const taal of ["nl","en"])for(const breedte of [390,1366])for(const schema of ["light","dark"]){
      const context=await browser.newContext({viewport:{width:breedte,height:900},colorScheme:schema,locale:taal==="en"?"en-GB":"nl-NL",serviceWorkers:"block"});
      const page=await context.newPage();const fouten=[];
      page.on("pageerror",e=>fouten.push(e.message));
      await page.route("**/*",r=>r.request().url().startsWith(root)?r.continue():r.abort());
      try{
        await page.goto(root+pad+(taal==="en"?"?taal=en":""),{waitUntil:"load"});
        if(WEER.includes(pad))await page.waitForSelector("#app",{state:"visible",timeout:15000});
        await page.evaluate(()=>document.fonts.ready);
        await page.waitForTimeout(800);
        const m=await page.evaluate(meet);
        const label=`${pad} ${taal} ${breedte}px ${schema}`;
        assert(m.teksten>5,label+": te weinig tekst gemeten ("+m.teksten+")");
        assert.deepEqual(m.bodoni,[],label+": tekst staat nog in Bodoni Moda: "+JSON.stringify(m.bodoni));
        assert.deepEqual(m.hoofdletters,[],label+": kopjes staan nog in afgedwongen hoofdletters: "+JSON.stringify(m.hoofdletters));
        assert.deepEqual(m.klein,[],label+": zichtbare tekst onder 12px: "+JSON.stringify(m.klein));
        assert.equal(m.h1,"600",label+": kop niet in gewicht 600");
        if(WEER.includes(pad)){
          assert.equal(m.t,"400",label+": grote temperatuur niet in gewicht 400");
          assert.equal(m.cond,"500",label+": weersomschrijving niet in gewicht 500");
          assert.equal(m.hier,"lowercase/uppercase",label+": locatieknop toont niet \"Mijn locatie\"");
          if(m.tijd!==null)assert.equal(m.tijd,"400",label+": tijd naast de plaatsnaam is niet 400");
        }
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        n++;
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("G2-typografie OK op "+n+" weergaven ("+PAGINAS.length+" paginatypes, NL/EN, 390/1366px, licht/donker): geen Bodoni, geen hoofdletterkopjes, niets onder 12px, koppen 600, temperatuur 400.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

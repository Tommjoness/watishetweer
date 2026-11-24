"use strict";

/* Gedeelde kop op de subpagina's in de browser (K1, eigenaar 24 november).
   Op iedere soort subpagina, mobiel en desktop, NL en EN:
   - de kop staat bovenaan: menu links (minstens 44px), logo (zonneboog met stip) en naam;
   - de weergavekeuze is niet zichtbaar zolang het menu dicht is, en staat onder de
     vier groepen zodra het menu open is (drie knoppen van minstens 44px, binnen beeld);
   - Donker/Licht werkt en wordt bewaard; Escape sluit het menu en zet de focus terug;
   - er is een weg terug (naar het weer, of op parkpagina's naar de parken);
   - de inhoud staat niet in een kader; geen horizontale overflow en geen runtimefouten.
   Plus de 404-pagina zoals cloudflare-output.js hem publiceert. Draait op het finale artifact. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {stub}=require("./taal-catalogus-browser.js");
const {SCENARIOS}=require("./taal-scenarios.js");
const SK=require("./apply-sitekop-20261124.js");

const OUT=path.join(__dirname,"..","public");
const VIER04=SK.pasToe(fs.readFileSync(path.join(__dirname,"..","cloudflare","404.html"),"utf8"),"404.html",SK.vandaagNl());
const TYPES={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webp":"image/webp",".jpg":"image/jpeg"};
const server=http.createServer((req,res)=>{
  let p=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
  if(p==="/bestaat-niet/"){res.writeHead(404,{"content-type":TYPES[".html"]});res.end(VIER04);return;}
  if(p==="/privacy")p="/privacy.html";
  if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  if(f.endsWith(".html")){
    const html=fs.readFileSync(f,"utf8").replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/gi,"").replace("<head>","<head>"+stub(SCENARIOS[0],""));
    res.writeHead(200,{"content-type":TYPES[".html"]});res.end(html);return;
  }
  res.writeHead(200,{"content-type":TYPES[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);
});

const PAGINAS=["/weer/","/maan/","/witte-kerst/","/oud-en-nieuw/","/kerstvakantie/","/nachtzicht/","/nachtzicht/hoge-veluwe/","/contact/","/over/","/privacy","/bestaat-niet/"];

function meet(){
  const r=e=>{if(!e||!e.getClientRects().length)return null;const b=e.getBoundingClientRect();return {l:b.left,t:b.top,r:b.right,b:b.bottom,w:b.width,h:b.height};};
  const zie=e=>!!e&&typeof e.checkVisibility==="function"?e.checkVisibility():!!(e&&e.getClientRects().length);
  const kop=document.getElementById("wiw-sitekop"),menu=document.getElementById("wiw-menu"),knop=menu&&menu.querySelector(":scope > summary");
  const logo=kop&&kop.querySelector(".wiw-sk-logo"),merk=kop&&kop.querySelector(".wiw-sk-merk");
  const weergave=kop&&kop.querySelector(".wiw-sk-weergave"),knoppen=weergave?[...weergave.querySelectorAll("button")]:[];
  const terug=[...document.querySelectorAll("a")].find(a=>/Terug naar het weer|Back to the weather|Alle Nationale Parken|All National Parks/.test(a.textContent));
  const kaart=document.querySelector("main.kaart,.kaart.breed,main.wrap");
  return {
    koppen:document.querySelectorAll("#wiw-sitekop").length,kopTop:kop?kop.getBoundingClientRect().top:null,
    knop:r(knop),logo:r(logo),stip:!!(logo&&logo.querySelector("circle")),merk:merk?merk.textContent.trim():"",
    menuLinks:knop&&merk?r(knop).l<r(merk).l:false,
    weergaveZichtbaar:zie(weergave),open:!!(menu&&menu.open),
    knoppen:knoppen.map(k=>({t:k.textContent.trim(),z:zie(k),...(r(k)||{})})),
    groepen:menu?[...menu.querySelectorAll(".wiw-menu-groep>summary")].map(s=>s.textContent.trim()):[],
    weergaveNaGroepen:!!(weergave&&menu&&menu.querySelector("nav")&&(menu.querySelector("nav").compareDocumentPosition(weergave)&Node.DOCUMENT_POSITION_FOLLOWING)),
    /* De weergavekeuze ligt binnen het uitklappaneel en onder de laatste groep; de kop zelf schuift niet op. */
    binnenPaneel:(()=>{const p=r(menu&&menu.querySelector(".wiw-menu-paneel")),w=r(weergave),g=[...(menu?menu.querySelectorAll(".wiw-menu-groep"):[])].pop();if(!p||!w||!g)return false;const gb=g.getBoundingClientRect();return w.t>=p.t-1&&w.b<=p.b+1&&w.l>=p.l-1&&w.r<=p.r+1&&w.t>=gb.bottom-1;})(),
    kopHoogte:kop?kop.getBoundingClientRect().height:0,
    terug:terug?{t:terug.textContent.trim(),z:zie(terug)}:null,
    kaartRand:kaart?getComputedStyle(kaart).borderTopColor:null,kaartAchter:kaart?getComputedStyle(kaart).backgroundColor:null,
    breed:document.documentElement.scrollWidth-innerWidth,thema:document.documentElement.getAttribute("data-thema"),
    actief:document.activeElement===knop
  };
}

(async()=>{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const root=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let n=0;
  try{
    /* De 404 heeft geen taallaag (de hele pagina is Nederlands): alleen NL. */
    for(const pad of PAGINAS)for(const taal of (pad==="/bestaat-niet/"?["nl"]:["nl","en"]))for(const breedte of [390,1366]){
      const context=await browser.newContext({viewport:{width:breedte,height:900},colorScheme:"light",locale:taal==="en"?"en-GB":"nl-NL",serviceWorkers:"block"});
      const page=await context.newPage();const fouten=[];
      page.on("pageerror",e=>fouten.push(e.message));
      await page.route("**/*",r=>r.request().url().startsWith(root)?r.continue():r.abort());
      const label=`${pad} ${taal} ${breedte}px`;
      try{
        await page.goto(root+pad+(taal==="en"?"?taal=en":""),{waitUntil:"load"});
        await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(600);
        let m=await page.evaluate(meet);
        assert.equal(m.koppen,1,label+": niet precies één sitekop");
        assert(m.kopTop!==null&&m.kopTop<40,label+": kop staat niet bovenaan ("+m.kopTop+")");
        assert(m.knop&&m.knop.h>=44&&m.knop.w>=44,label+": menuknop kleiner dan 44px "+JSON.stringify(m.knop));
        assert(m.logo&&m.logo.w>=20&&m.stip,label+": logo (zonneboog met stip) niet zichtbaar");
        assert.equal(m.merk,"watishetweer.nl",label+": merknaam niet letterlijk");
        assert(m.menuLinks,label+": menu staat niet links van het logo");
        assert(!m.weergaveZichtbaar&&!m.open,label+": weergavekeuze zichtbaar terwijl het menu dicht is");
        assert(m.terug&&m.terug.z,label+": geen zichtbare weg terug");
        if(pad!=="/bestaat-niet/")assert(m.kaartRand===null||/rgba\(0, 0, 0, 0\)|transparent/.test(m.kaartRand)&&/rgba\(0, 0, 0, 0\)|transparent/.test(m.kaartAchter),label+": inhoud staat nog in een kader ("+m.kaartRand+" / "+m.kaartAchter+")");
        assert(m.breed<=0,label+": horizontale overflow ("+m.breed+"px)");
        await page.click("#wiw-menu > summary");await page.waitForTimeout(150);
        m=await page.evaluate(meet);
        assert(m.open&&m.weergaveZichtbaar,label+": weergavekeuze niet zichtbaar in het open menu");
        assert.equal(m.groepen.length,4,label+": verwacht vier menugroepen");
        if(taal==="en")assert.deepEqual(m.groepen,["Weather and places","Stars and night","Seasons and holidays","About and information"],label+": menugroepen niet vertaald "+JSON.stringify(m.groepen));
        assert(m.weergaveNaGroepen,label+": weergavekeuze staat niet onder de groepen");
        assert(m.binnenPaneel,label+": weergavekeuze ligt niet binnen het uitklappaneel onder de groepen");
        assert(m.kopHoogte<=80,label+": de kop groeit als het menu opengaat ("+m.kopHoogte+"px)");
        assert.equal(m.knoppen.length,3,label+": verwacht drie weergaveknoppen");
        assert(m.knoppen.every(k=>k.z&&k.h>=44&&k.l>=0&&k.r<=breedte),label+": weergaveknoppen niet zichtbaar, te klein of buiten beeld "+JSON.stringify(m.knoppen));
        /* Donker kiezen werkt en blijft bewaard; daarna weer Auto. */
        await page.click(".wiw-sk-weergave button:nth-child(3)");await page.waitForTimeout(150);
        assert.equal(await page.evaluate(()=>document.documentElement.getAttribute("data-thema")),"donker",label+": Donker werkt niet");
        assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("weerbriefing.thema.sessie"))),"donker",label+": keuze Donker niet bewaard");
        await page.click(".wiw-sk-weergave button:nth-child(1)");await page.waitForTimeout(150);
        /* Licht: "licht" (seizoens- en infopagina's) of geen kenmerk (Weer per plaats, bestaand theme-hub-gedrag); nooit donker. */
        assert(["licht",null].includes(await page.evaluate(()=>document.documentElement.getAttribute("data-thema"))),label+": Licht werkt niet");
        assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem("weerbriefing.thema.sessie"))),"licht",label+": keuze Licht niet bewaard");
        await page.click(".wiw-sk-weergave button:nth-child(2)");await page.waitForTimeout(150);
        /* Escape sluit het menu en zet de focus terug op de knop. */
        await page.keyboard.press("Escape");await page.waitForTimeout(100);
        m=await page.evaluate(meet);
        assert(!m.open&&m.actief,label+": Escape sluit het menu niet of zet de focus niet terug");
        assert.deepEqual(fouten,[],label+": runtimefouten "+fouten.join(" | "));
        n++;
      }finally{await context.close();}
    }
  }finally{await browser.close();server.close();}
  console.log("Sitekop OK op "+n+" weergaven ("+PAGINAS.length+" soorten subpagina's incl. 404, NL/EN, 390/1366px): menu links met logo, weergavekeuze alleen in het menu (Licht/Auto/Donker werkt), Escape, weg terug, geen kader.");
})().catch(e=>{console.error(e);server.close();process.exit(1);});

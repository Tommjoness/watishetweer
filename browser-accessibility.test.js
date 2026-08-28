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
    /* Deze test routeert geocoding naar deterministische fixtures. Blokkeer de
       serviceworker hier, zodat WebKit die requests niet buiten page.route om
       afhandelt; serviceworker-upgrade/offline heeft een eigen browsercontract. */
    const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:"block"});
    await page.goto("http://127.0.0.1:"+server.address().port+"/",{waitUntil:"domcontentloaded"});
    const resultaat=await page.evaluate(()=>{
      const app=document.getElementById("app");
      if(app)app.style.setProperty("display","block","important");
      const footer=document.querySelector("footer");
      if(footer)footer.style.setProperty("display","flex","important");
      const mains=[...document.querySelectorAll("main")];
      const meetDoel=el=>{
        const r=el.getBoundingClientRect();
        let verborgenDoor=null;
        for(let node=el;node;node=node.parentElement){
          const stijl=getComputedStyle(node);
          if(node.hidden||stijl.display==="none"||stijl.visibility==="hidden"){
            verborgenDoor={tag:node.tagName,id:node.id||"",klasse:typeof node.className==="string"?node.className:"",hidden:node.hidden,display:stijl.display,visibility:stijl.visibility};
            break;
          }
        }
        return {tekst:(el.textContent||"").trim(),hoogte:r.height,breedte:r.width,verborgenDoor};
      };
      /* Dit is bewust een layoutcontract op het definitieve artifact, niet een
         dataloadtest. #app en footer starten cold-load verborgen en worden hier
         alleen voor de meting in hun normale zichtbare display gezet. Een
         gesloten details verbergt descendant-links terecht met 0x0; meet eerst
         de summary en daarna de links in geopende toestand. Bronlinks die door
         de locatiebewuste bronfilter bewust hidden zijn, zijn geen tapdoelen en
         horen daarom niet aan de minimale hitbox-eis te worden getoetst. */
      const summaries=[...document.querySelectorAll("footer details summary")].map(meetDoel);
      [...document.querySelectorAll("footer details")].forEach(el=>{el.open=true;});
      const alleLinks=[...document.querySelectorAll("footer a")].map(meetDoel);
      const links=alleLinks.filter(doel=>!doel.verborgenDoor);
      return {
        mainAantal:mains.length,
        mainId:mains[0]&&mains[0].id,
        appTag:app&&app.tagName,
        plaatsTag:document.getElementById("place")?.tagName||null,
        footerDisplay:footer&&getComputedStyle(footer).display,
        doelen:[...summaries,...links],
        verborgenFooterLinks:alleLinks.filter(doel=>!!doel.verborgenDoor).map(doel=>doel.tekst),
        maanAria:[...document.querySelectorAll(".maanbij")].map(el=>el.getAttribute("aria-label")),
        grafiekKop:(document.querySelector(".chartkop h2")?.textContent||"").trim(),
        zonBinnenKop:!!document.querySelector(".chartkop h2 #suntimes"),
        terugBinnenKop:!!document.querySelector(".chartkop h2 #back")
      };
    });
    assert.equal(resultaat.mainAantal,1,naam+": exact één main-landmark");
    assert.equal(resultaat.mainId,"app",naam+": #app is het main-landmark");
    assert.equal(resultaat.appTag,"MAIN",naam+": #app gebruikt native main-semantiek");
    assert.equal(resultaat.plaatsTag,"H2",naam+": de zichtbare plaatsnaam is geen native sectiekop");
    assert.equal(resultaat.footerDisplay,"flex",naam+": footer staat in zichtbare layoutstate");
    const footerTeksten=resultaat.doelen.map(doel=>doel.tekst.replace(/\s+/g," ").trim());
    assert.ok(resultaat.doelen.length>=3,naam+": vaste footerdoelen ontbreken naast dynamisch gefilterde bronlinks: "+JSON.stringify(footerTeksten));
    assert.ok(footerTeksten.some(t=>t==="Open-Meteo"),naam+": kernbron Open-Meteo is niet zichtbaar");
    assert.ok(footerTeksten.some(t=>/Privacy & gegevens/i.test(t)),naam+": privacydoel is niet zichtbaar");
    assert.ok(footerTeksten.some(t=>/Technische locatiegegevens/i.test(t)),naam+": technische locatiegegevens zijn niet zichtbaar");
    assert.ok(resultaat.doelen.every(doel=>!doel.verborgenDoor),naam+": verborgen bronlink telt ten onrechte als interactief footerdoel");
    resultaat.doelen.forEach(doel=>{
      assert.ok(doel.hoogte>=43.5,naam+": footerdoel '"+doel.tekst+"' is "+doel.hoogte+"px hoog");
      assert.ok(doel.breedte>0,naam+": footerdoel '"+doel.tekst+"' heeft geen breedte");
    });
    assert.ok(resultaat.maanAria.every(v=>v===null),naam+": .maanbij krijgt geen dubbel aria-label");
    assert.equal(resultaat.grafiekKop,"Het etmaal",naam+": grafiekheading bevat meer dan de sectietitel");
    assert.equal(resultaat.zonBinnenKop,false,naam+": zoninformatie staat ten onrechte binnen de heading");
    assert.equal(resultaat.terugBinnenKop,false,naam+": interactieve terugknop staat ten onrechte binnen de heading");

    /* Zoekresultaten horen altijd bij de query die zichtbaar in het invoerveld
       staat. Een oudere lijst wordt direct bij input gewist, dus niet pas nadat
       de volgende geocodingrequest is voltooid. */
    await page.route(/^https:\/\/geocoding-api\.open-meteo\.com\//,async route=>{
      const query=new URL(route.request().url()).searchParams.get("name");
      if(query==="Amsterdam"){
        await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({results:[{name:"Amsterdam",admin1:"Noord-Holland",country_code:"NL",latitude:52.3676,longitude:4.9041}]})});return;
      }
      if(query==="Colombo"){
        await new Promise(resolve=>setTimeout(resolve,650));
        await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({results:[{name:"Colombo",admin1:"Western",country_code:"LK",latitude:6.935,longitude:79.849}]})});return;
      }
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({results:[]})});
    });
    const invoer=page.locator("#q");
    await invoer.fill("Amsterdam");
    await page.waitForSelector('#res.on [data-nm="Amsterdam"]');
    await invoer.fill("Colombo");
    const direct=await page.evaluate(()=>({waarde:document.getElementById("q").value,opties:document.querySelectorAll("#res [role='option']").length,open:document.getElementById("res").classList.contains("on"),expanded:document.getElementById("q").getAttribute("aria-expanded")}));
    assert.deepEqual(direct,{waarde:"Colombo",opties:0,open:false,expanded:"false"},naam+": oude Amsterdam-opties blijven zichtbaar of selecteerbaar bij query Colombo");
    await page.waitForSelector('#res.on [data-nm="Colombo"]');
    const nieuw=await page.evaluate(()=>({opties:[...document.querySelectorAll("#res [role='option']")].map(x=>x.dataset.nm),status:document.getElementById("zoekstatus").textContent,expanded:document.getElementById("q").getAttribute("aria-expanded")}));
    assert.deepEqual(nieuw,{opties:["Colombo"],status:"1 plaats gevonden.",expanded:"true"},naam+": nieuwe zoekresultaten/status zijn niet coherent: "+JSON.stringify(nieuw));

    await invoer.fill("Bestaat beslist niet");
    await page.waitForSelector("#zoekmelding.on");
    const leeg=await page.evaluate(()=>({melding:document.getElementById("zoekmelding").textContent,rol:document.getElementById("zoekmelding").getAttribute("role"),opties:document.querySelectorAll("#res [role='option']").length,resOpen:document.getElementById("res").classList.contains("on"),expanded:document.getElementById("q").getAttribute("aria-expanded")}));
    assert.deepEqual(leeg,{melding:"Niets gevonden",rol:"status",opties:0,resOpen:false,expanded:"false"},naam+": lege zoekstate gebruikt geen afzonderlijke statussemantiek");

    await page.setViewportSize({width:320,height:844});
    const smal=await page.evaluate(()=>{
      const knop=document.getElementById("here"),invoer=document.getElementById("q"),bewaar=document.querySelector(".chip.add");
      const r=el=>el?el.getBoundingClientRect():null;
      return {knop:r(knop),knoppen:[...document.querySelectorAll(".tools > button")].map(r),invoer:r(invoer),bewaar:r(bewaar),tekst:knop?knop.innerText.trim():"",naam:knop?knop.getAttribute("aria-label"):"",overflow:document.documentElement.scrollWidth-window.innerWidth};
    });
    assert.ok(smal.knop&&smal.knop.height>=43.5,naam+": 320px locatieknop is kleiner dan 44px");
    assert.ok(smal.knoppen.length===3&&smal.knoppen.every(r=>r.height>=43.5),naam+": niet alle 320px hoofdknoppen zijn minimaal 44px hoog");
    assert.ok(smal.invoer&&smal.invoer.height>=43.5,naam+": 320px zoekveld is kleiner dan 44px");
    assert.equal(smal.tekst.toLocaleLowerCase("nl-NL"),"locatie",naam+": 320px gebruikt niet het compacte zichtbare locatielabel");
    assert.equal(smal.naam,"Mijn locatie",naam+": compact label verandert de toegankelijke knopnaam");
    if(smal.bewaar)assert.ok(smal.bewaar.height>=35.5,naam+": bewaarplaatsknop blijft te klein");
    assert.ok(smal.overflow<=2,naam+": grotere mobiele controls veroorzaken horizontale overflow ("+smal.overflow+"px)");
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

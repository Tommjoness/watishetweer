"use strict";

const assert=require("assert");
const path=require("path");
const {chromium,webkit}=require("playwright");

const ROOTS=["https://watishetweer.nl/","https://www.watishetweer.nl/"];
const SHOTS="/tmp";

function veiligNaam(s){return s.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase();}

async function wachtOpWeer(page,verwachtPlaats=null){
  await page.waitForFunction(verwacht=>{
    const plaats=(document.getElementById("place")?.textContent||"").trim();
    const chart=document.getElementById("chart");
    const body=document.body?.innerText||"";
    const fout=/Ophalen mislukt|Het ophalen duurt te lang/i.test(body);
    if(fout)return true;
    if(!plaats||!chart)return false;
    return !verwacht||plaats.toLowerCase().includes(String(verwacht).toLowerCase());
  },verwachtPlaats,{timeout:30000});
  const body=await page.locator("body").innerText();
  assert(!/Ophalen mislukt|Het ophalen duurt te lang/i.test(body),"productie-weatherload eindigde in een zichtbare ophaalfout");
}

async function basisSmoke(type,browserNaam,root,viewport,label){
  const browser=await type.launch({headless:true});
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const pageErrors=[];
  page.on("pageerror",e=>pageErrors.push(String(e)));
  try{
    const response=await page.goto(root,{waitUntil:"domcontentloaded",timeout:30000});
    assert(response&&response.ok(),`${browserNaam} ${root}: root response is niet OK`);
    await wachtOpWeer(page);
    await page.waitForSelector("#nights",{timeout:15000});
    const staat=await page.evaluate(()=>({
      plaats:(document.getElementById("place")?.textContent||"").trim(),
      chart:!!document.getElementById("chart"),
      nights:document.querySelectorAll("#nights .row.night").length,
      overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
      body:(document.body?.innerText||"").slice(0,300)
    }));
    assert(staat.plaats,`${browserNaam} ${root}: plaats ontbreekt`);
    assert(staat.chart,`${browserNaam} ${root}: grafiek ontbreekt`);
    assert(!staat.overflow,`${browserNaam} ${root}: horizontale documentoverflow`);
    assert.deepEqual(pageErrors,[],`${browserNaam} ${root}: pageerrors`);
    await page.screenshot({path:path.join(SHOTS,`weathernow-prod-${veiligNaam(browserNaam)}-${veiligNaam(label)}.png`),fullPage:true});
    console.log(`OK basis ${browserNaam} ${label}: ${staat.plaats}, nights=${staat.nights}`);
  }finally{
    await context.close().catch(()=>{});
    await browser.close().catch(()=>{});
  }
}

async function longyearbyenSmoke(type,browserNaam){
  const browser=await type.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const pageErrors=[];
  page.on("pageerror",e=>pageErrors.push(String(e)));
  try{
    const response=await page.goto(ROOTS[0],{waitUntil:"domcontentloaded",timeout:30000});
    assert(response&&response.ok(),`${browserNaam}: productie-root is niet OK`);
    await wachtOpWeer(page);

    await page.locator("#q").fill("Longyearbyen");
    await page.waitForSelector("#res.on div",{timeout:15000});
    const opties=page.locator("#res div");
    const teksten=await opties.allTextContents();
    const idx=teksten.findIndex(t=>/Longyearbyen/i.test(t));
    assert(idx>=0,`${browserNaam}: Longyearbyen ontbreekt in echte zoekresultaten: ${JSON.stringify(teksten)}`);
    const gekozen=opties.nth(idx);
    const data=await gekozen.evaluate(el=>({lat:el.dataset.lat,lon:el.dataset.lon,land:el.dataset.land,naam:el.dataset.nm,text:el.textContent}));
    assert(data.lat&&data.lon,`${browserNaam}: zoekresultaat mist coördinaten`);
    await gekozen.click();
    await wachtOpWeer(page,"Longyearbyen");
    await page.waitForSelector("#suntimes .zonregel",{timeout:15000});

    const pool=await page.evaluate(()=>{
      const body=document.body?.innerText||"";
      const zon=(document.getElementById("suntimes")?.innerText||"");
      const chart=document.getElementById("chart");
      const chartTekst=chart?.innerText||"";
      const svgTeksten=chart?[...chart.querySelectorAll("text")].map(el=>(el.textContent||"").trim()).filter(Boolean):[];
      const alleGrafiekTekst=[chartTekst,...svgTeksten].join(" | ");
      return {
        plaats:(document.getElementById("place")?.textContent||"").trim(),
        zon,
        polar:/Zon gaat niet onder/i.test(zon)&&/24 uur daglicht/i.test(zon),
        badPagina:/zon op 00:00|zon onder 00:00/i.test(body),
        badGrafiek:/zon op 00:00|zon onder 00:00/i.test(alleGrafiekTekst),
        overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
        nights:(document.getElementById("nights")?.innerText||"")
      };
    });
    assert(/Longyearbyen/i.test(pool.plaats),`${browserNaam}: verkeerde plaats na selectie: ${pool.plaats}`);
    assert(pool.polar,`${browserNaam}: actuele Longyearbyen-productie mist pooldagtekst: ${pool.zon}`);
    assert.equal(pool.badPagina,false,`${browserNaam}: productiepagina toont nog zon op/onder 00:00 sentinel`);
    assert.equal(pool.badGrafiek,false,`${browserNaam}: productiegrafiek toont nog zon op/onder 00:00 sentinel`);
    assert(/Geen nachtdata beschikbaar/i.test(pool.nights),`${browserNaam}: pooldag fabriceert Nachtzicht-nachtdata: ${pool.nights}`);
    assert(!pool.overflow,`${browserNaam}: Longyearbyen heeft horizontale overflow`);
    assert.deepEqual(pageErrors,[],`${browserNaam}: Longyearbyen pageerrors`);
    await page.screenshot({path:path.join(SHOTS,`weathernow-prod-${veiligNaam(browserNaam)}-longyearbyen.png`),fullPage:true});
    console.log(`OK Longyearbyen ${browserNaam}: zoekresultaat ${data.lat},${data.lon} ${data.land||""}; 24 uur daglicht; geen 00:00-sentinels; geen overflow/pageerrors.`);
  }finally{
    await context.close().catch(()=>{});
    await browser.close().catch(()=>{});
  }
}

(async()=>{
  for(const [type,naam] of [[chromium,"Chromium"],[webkit,"WebKit"]]){
    await basisSmoke(type,naam,ROOTS[0],{width:1440,height:900},"root-desktop");
    await basisSmoke(type,naam,ROOTS[1],{width:390,height:844},"www-mobile");
    await longyearbyenSmoke(type,naam);
  }
  console.log("PRODUCTIE-POLAR-SMOKE GESLAAGD: beide publieke domeinen + Chromium/WebKit + desktop/mobiel + echte Longyearbyen-zoekflow; pooldagtekst klopt en 00:00-sentinels ontbreken.");
})().catch(err=>{console.error(err&&err.stack||err);process.exit(1);});

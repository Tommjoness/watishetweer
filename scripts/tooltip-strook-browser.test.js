"use strict";

/* Tooltip van de temperatuurgrafiek, minimaal 12 px effectief leesbaar op iedere breedte:
   - tot en met 429 px: de zes rijen staan in een HTML-strook direct onder de grafiek (ruimte vanaf de eerste
     render gereserveerd, ook zonder JavaScript); de SVG-tooltip is dan alleen visueel verborgen en kruisdraad en
     meetpunt blijven zichtbaar;
   - vanaf 430 px: de SVG-tooltip blijft, maar wordt zo opgeschaald dat de kleinste tekst minimaal 12 px is.
   Nederlands en Engels, licht en donker, toetsenbord (alle uren, Escape), touch, schermlezerinformatie
   (slider met aria-valuetext, strook aria-hidden) en het wisselen van breekpunt tijdens gebruik.

   Draait na: npm run build:cloudflare */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const OUT=path.join(__dirname,"..","public");
const KLOK="2026-07-22T15:39:00Z",METING="2026-07-22T17:30";
const PAD="/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL";
const TEKST={nl:"Kies een uur in de grafiek om de details te bekijken.",en:"Select an hour on the chart to see the details."};

function fixture(lat,lon){
  const d=bouw({temp:(u,dag)=>+(15.5+4.5*Math.sin((u-9)/24*Math.PI*2)-dag*0.4).toFixed(1),pp:(u,dag)=>dag===0&&u>=19&&u<=23?[40,70,80,65,30][u-19]:8,pr:(u,dag)=>dag===0&&u>=19&&u<=23?[0.2,1.4,2.1,0.8,0.1][u-19]:0,wc:(u,dag)=>u<11?1:u<17?2:3,som:2});
  d.latitude=lat;d.longitude=lon;d.daily.sunshine_duration=d.daily.time.map(()=>21600);
  const h=d.hourly;
  while(h.time.length<194){const i=h.time.length,v=h.time[i-1];for(const k of Object.keys(h))if(k!=="time"&&Array.isArray(h[k]))h[k].push(h[k][i%24]);h.time.push(new Date(Date.parse(v+"Z")+3600000).toISOString().slice(0,14)+"00");}
  const nu=h.time.indexOf(METING.slice(0,14)+"00");
  d.current.time=METING;d.current.temperature_2m=h.temperature_2m[nu];d.current.apparent_temperature=h.temperature_2m[nu]-1;
  return d;
}
const types={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml",".json":"application/json",".png":"image/png",".webp":"image/webp"};
const server=http.createServer((req,res)=>{
  let p=new URL(req.url,"http://localhost").pathname;if(p.endsWith("/"))p+="index.html";
  const f=path.join(OUT,p);
  if(!f.startsWith(OUT+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":types[path.extname(f)]||"application/octet-stream","cache-control":"no-store"});fs.createReadStream(f).pipe(res);
});

async function open(browser,root,{w,taal="nl",schema="light",touch=false,js=true}={}){
  const mobiel=w<700;
  const context=await browser.newContext({viewport:{width:w,height:mobiel?844:936},deviceScaleFactor:mobiel?2:1,locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",colorScheme:schema,serviceWorkers:"block",isMobile:mobiel||touch,hasTouch:mobiel||touch,javaScriptEnabled:js});
  const page=await context.newPage(),fouten=[];
  page.on("pageerror",e=>fouten.push(String(e)));
  if(js){
    await page.addInitScript(([k,t])=>{
      const N=Date,s=N.now(),e=N.parse(k);class F extends N{constructor(...a){super(...(a.length?a:[e+N.now()-s]));}static now(){return e+N.now()-s;}}window.Date=F;
      if(t==="en")try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(x){}
    },[KLOK,taal]);
  }
  await page.route("**/*",async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==="api.open-meteo.com"||u.pathname==="/api/forecast"){
      const la=+(u.searchParams.get("latitude")||u.searchParams.get("lat")||52.09),lo=+(u.searchParams.get("longitude")||u.searchParams.get("lon")||5.12);
      return r.fulfill({json:fixture(la,lo)});
    }
    if(u.hostname==="geocoding-api.open-meteo.com")return r.fulfill({json:{results:[]}});
    if(u.hostname==="air-quality-api.open-meteo.com")return r.fulfill({json:{current:{european_aqi:22},hourly:{time:[METING.slice(0,14)+"00"],grass_pollen:[0],birch_pollen:[0],alder_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}}});
    if(u.pathname==="/api/waarschuwingen")return r.fulfill({json:{bron:"test",dekking:true,land:"NL",lijst:[]}});
    if(u.pathname==="/api/neerslag")return r.fulfill({json:{nowcast:null,actueel:null,bron:"test"}});
    if(u.pathname.startsWith("/api/"))return r.fulfill({json:{beschikbaar:false}});
    if(u.origin!==root)return r.fulfill({status:204,body:""});
    return r.continue();
  });
  await page.goto(root+PAD,{waitUntil:"domcontentloaded"});
  if(js){
    await page.waitForSelector("#app",{state:"visible",timeout:25000});
    await page.waitForFunction(()=>typeof S!=="undefined"&&S.geo&&document.querySelector("#chart #hit")&&document.querySelectorAll("#chart circle").length>0,null,{timeout:25000});
    await page.waitForFunction(()=>{const h=[...document.querySelectorAll("h2")].find(e=>e.getBoundingClientRect().height>0&&e.getBoundingClientRect().top+scrollY>document.querySelector(".dagmod").getBoundingClientRect().bottom+scrollY);return !!h;},null,{timeout:15000});
    await page.waitForTimeout(500);
  }
  return {context,page,fouten};
}

/* Kiest uur i met het toetsenbord (zelfde pad als een gebruiker) en wacht tot de tooltipweergave is bijgewerkt. */
async function kies(page,i){
  await page.evaluate(i=>{const h=document.getElementById("hit");h.focus();h.dataset.keyboardIndex=String(Math.max(0,i-1));h.dispatchEvent(new KeyboardEvent("keydown",{key:i===0?"Home":"ArrowRight",bubbles:true}));},i);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.waitForTimeout(40);
}
const meet=page=>page.evaluate(()=>{
  const q=s=>document.querySelector(s),svg=q("#chart"),st=q("#tip-strook"),g=q("#scrub"),hit=q("#hit");
  const sb=svg.getBoundingClientRect(),tb=st.getBoundingClientRect(),stijl=getComputedStyle(st);
  const kinderen=[...st.querySelectorAll("*")].filter(e=>e.children.length===0&&e.textContent.trim());
  const fonts=kinderen.map(e=>parseFloat(getComputedStyle(e).fontSize));
  const buiten=kinderen.filter(e=>{const r=e.getBoundingClientRect();return r.left<tb.left-0.5||r.right>tb.right+0.5||r.top<tb.top-0.5||r.bottom>tb.bottom+0.5;}).map(e=>e.textContent);
  const zichtbaar=e=>!!e&&getComputedStyle(e).display!=="none"&&getComputedStyle(e).visibility!=="hidden"&&e.getBoundingClientRect().width+e.getBoundingClientRect().height>0;
  const svgTekst=[...g.querySelectorAll("rect,text")];
  const kruis=[...g.querySelectorAll("line")].find(l=>l.getAttribute("x1")===l.getAttribute("x2")),punt=g.querySelector("circle");
  const rijen=[...st.querySelectorAll(".tip-rij")].map(r=>[r.querySelector("dt").textContent,r.querySelector("dd").textContent]);
  const dag=q(".dagmod").getBoundingClientRect().bottom+scrollY;
  const volgende=[...document.querySelectorAll("h2")].find(h=>{const r=h.getBoundingClientRect();return r.height>0&&r.top+scrollY>dag;});
  const rij=n=>{const l=g.querySelector(`text[data-tip-rij="${n}"][data-tip-kol="label"]`),w=g.querySelector(`text[data-tip-rij="${n}"][data-tip-kol="waarde"]`);return [l&&l.textContent.trim(),w&&w.textContent.trim()];};
  return {display:stijl.display,staat:st.children.length?"vol":"leeg",h:+tb.height.toFixed(2),top:+tb.top.toFixed(1),svgBottom:+sb.bottom.toFixed(1),
    doc:document.documentElement.scrollHeight,docW:document.documentElement.scrollWidth,vw:innerWidth,
    volgendTop:volgende?+(volgende.getBoundingClientRect().top+scrollY).toFixed(1):null,
    minFont:fonts.length?Math.min(...fonts):null,buiten,overflowX:st.scrollWidth>st.clientWidth+0.5,
    svgTekstZichtbaar:svgTekst.filter(zichtbaar).length,kruisZichtbaar:zichtbaar(kruis),puntZichtbaar:zichtbaar(punt),
    kop:(st.querySelector(".tip-kop")||{}).textContent||"",rijen,svgRijen:[1,2,3,4,5,6].map(rij),
    svgKop:(g.querySelector('text[data-tip="kop"]')||{}).textContent||"",
    ariaHidden:st.getAttribute("aria-hidden"),valuenow:hit.getAttribute("aria-valuenow"),valuetext:hit.getAttribute("aria-valuetext")||"",focus:document.activeElement&&document.activeElement.id,gDisplay:g.style.display,
    placeholder:getComputedStyle(st,"::before").content};
});
/* Effectieve grootte van de SVG-tooltip: lettergrootte in SVG-eenheden maal de werkelijke schermschaal (inclusief transform). */
const svgTooltip=page=>page.evaluate(()=>{
  const g=document.getElementById("scrub"),svg=document.getElementById("chart"),sb=svg.getBoundingClientRect();
  const rect=g.querySelector("rect"),rb=rect.getBoundingClientRect(),teksten=[...g.querySelectorAll("text")];
  const eff=teksten.map(t=>parseFloat(t.getAttribute("font-size"))*t.getScreenCTM().a);
  const tb=teksten.map(t=>t.getBoundingClientRect());
  let rijOverlap=0;for(let r=1;r<=6;r++){const a=g.querySelector(`text[data-tip-rij="${r}"][data-tip-kol="label"]`),v=g.querySelector(`text[data-tip-rij="${r}"][data-tip-kol="waarde"]`);if(a&&v&&a.getBoundingClientRect().right>v.getBoundingClientRect().left-1)rijOverlap++;}
  const zichtbaar=e=>getComputedStyle(e).visibility!=="hidden"&&getComputedStyle(e).display!=="none";
  return {min:Math.min(...eff),zichtbaar:teksten.every(zichtbaar)&&zichtbaar(rect),aantal:teksten.length,
    doosBinnenGrafiek:rb.left>=sb.left-0.5&&rb.right<=sb.right+0.5&&rb.top>=sb.top-0.5&&rb.bottom<=sb.bottom+0.5,
    tekstBinnenDoos:tb.every(t=>t.left>=rb.left-0.5&&t.right<=rb.right+0.5&&t.top>=rb.top-0.5&&t.bottom<=rb.bottom+0.5),rijOverlap,
    schaal:(g.querySelector("g[data-tip-schaal]")||{getAttribute:()=>null}).getAttribute("data-tip-schaal")};
});

/* A. Tot en met 429 px: strook, toetsenbord, Escape, alle uren (of een steekproef op de tussenbreedtes). */
async function testStrook(browser,root){
  let combos=0,metingen=0;
  const volledig=[320,390,429],steekproef=[360,413,420];
  for(const w of [...volledig,...steekproef])for(const taal of ["nl","en"])for(const schema of ["light","dark"]){
    if(steekproef.includes(w)&&!((taal==="nl"&&schema==="light")||(taal==="en"&&schema==="dark")))continue;
    const L=`${w}px ${taal} ${schema}`;
    const {context,page,fouten}=await open(browser,root,{w,taal,schema});
    try{
      const n=await page.evaluate(()=>S.geo.n);
      const m0=await meet(page);
      /* Sinds de uurselectie (Fase 1) is er altijd een geselecteerd uur: de beginstaat is gevuld met het eerstvolgende uur. De
         rustregel blijft alleen bestaan als CSS-inhoud voor een lege strook (zonder JavaScript, zie C) en is hier dus niet meer zichtbaar. */
      assert.equal(m0.display,"block",L+": strook niet zichtbaar");assert.equal(m0.staat,"vol",L+": beginstaat niet gevuld met het geselecteerde uur");
      assert.equal(m0.placeholder,"none",`${L}: rustregel mag niet naast een gevulde kaart staan (${m0.placeholder})`);
      assert(m0.kop.length>=5,`${L}: geen kop bij het eerstvolgende uur`);assert(m0.kruisZichtbaar&&m0.puntZichtbaar,L+": kruisdraad en meetpunt van de selectie ontbreken");
      assert(m0.h>=140,`${L}: gereserveerde hoogte ${m0.h}px < 140`);assert.equal(m0.ariaHidden,"true",L+": strook niet aria-hidden");
      const hoogtes=new Set([m0.h]),volgend=new Set([m0.volgendTop]),docs=new Set([m0.doc]);
      const uren=steekproef.includes(w)?[0,6,12,20,n-1]:[...Array(n).keys()];
      for(const i of uren){
        await kies(page,i);const m=await meet(page);metingen++;
        assert.equal(m.staat,"vol",`${L} uur ${i}: strook niet gevuld`);
        assert.equal(m.kop,m.svgKop,`${L} uur ${i}: kop wijkt af van de SVG-tooltip`);
        assert.equal(m.rijen.length,6,`${L} uur ${i}: ${m.rijen.length} rijen`);
        m.rijen.forEach((r,k)=>{assert(r[0]&&r[1],`${L} uur ${i}: lege rij ${k+1}`);assert.deepEqual(r,m.svgRijen[k],`${L} uur ${i}: rij ${k+1} wijkt af van de SVG-tooltip`);});
        assert(m.minFont>=12,`${L} uur ${i}: kleinste tekst ${m.minFont}px`);
        assert.deepEqual(m.buiten,[],`${L} uur ${i}: tekst buiten de strook ${m.buiten}`);assert(!m.overflowX,`${L} uur ${i}: horizontale overflow in strook`);
        assert.equal(m.svgTekstZichtbaar,0,`${L} uur ${i}: SVG-tooltip nog zichtbaar`);
        assert(m.kruisZichtbaar&&m.puntZichtbaar,`${L} uur ${i}: kruisdraad of meetpunt niet zichtbaar`);
        assert(m.top>=m.svgBottom-0.5&&m.top-m.svgBottom<=24,`${L} uur ${i}: strook staat niet direct onder de grafiek (afstand ${(m.top-m.svgBottom).toFixed(1)}px)`);
        assert(m.docW<=m.vw,`${L} uur ${i}: horizontale paginaoverloop`);
        assert.equal(m.valuenow,String(i+1),`${L} uur ${i}: aria-valuenow ${m.valuenow}`);assert(m.valuetext.length>10,`${L} uur ${i}: lege aria-valuetext`);
        assert.equal(m.focus,"hit",`${L} uur ${i}: focus verloren`);
        hoogtes.add(m.h);volgend.add(m.volgendTop);docs.add(m.doc);
      }
      assert.equal(hoogtes.size,1,`${L}: stroohoogte wisselt tussen uren: ${[...hoogtes]}`);
      assert.equal(volgend.size,1,`${L}: inhoud onder de grafiek verschuift: ${[...volgend]}`);assert.equal(docs.size,1,`${L}: paginahoogte wisselt: ${[...docs]}`);
      await kies(page,Math.min(5,n-1));const voor=await meet(page);
      await page.keyboard.press("Escape");await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.waitForTimeout(40);const na=await meet(page);
      /* Escape sluit alleen de tijdelijke doos; de gekozen uur (strook, kruisdraad) blijft staan en wijzigt niet. */
      assert.equal(na.staat,"vol",`${L}: de selectie moet na Escape blijven staan`);assert.equal(na.kop,voor.kop,`${L}: kaart wijzigt bij Escape`);assert.equal(na.gDisplay,"block",`${L}: selectie (kruisdraad) verdwijnt bij Escape`);
      assert.equal(na.focus,"hit",`${L}: focus weg na Escape`);assert.equal(na.valuenow,voor.valuenow,`${L}: uur veranderd na Escape`);assert.equal(na.h,voor.h,`${L}: hoogte wisselt bij Escape`);assert.equal(na.volgendTop,voor.volgendTop,`${L}: pagina verschuift bij Escape`);
      await page.keyboard.press("ArrowRight");await page.waitForTimeout(80);assert.equal((await meet(page)).staat,"vol",`${L}: pijltoets opent na Escape niet`);
      assert.deepEqual(fouten,[],`${L}: runtimefouten ${fouten}`);
      combos++;
    }finally{await context.close();}
  }
  console.log(`A. Strook tot en met 429 px (320/360/390/413/420/429, NL/EN, licht/donker): ${combos} combinaties, ${metingen} uurmetingen OK: zes rijen gelijk aan de SVG-tooltip, >=12px, geen overlap, overflow of verschuiving, kruisdraad en meetpunt zichtbaar, Escape en focus, slider-informatie.`);
}

/* B. Touch (touchscreen-simulatie). */
async function testTouch(browser,root){
  for(const w of [320,390,429])for(const taal of ["nl","en"]){
    const L=`touch ${w}px ${taal}`;
    const {context,page,fouten}=await open(browser,root,{w,taal,schema:"light",touch:true});
    try{
      const m00=await meet(page);
      await page.evaluate(()=>{const r=document.getElementById("hit").getBoundingClientRect();window.scrollTo(0,r.top+scrollY-200);});await page.waitForTimeout(300);
      const box=await page.evaluate(()=>{const r=document.getElementById("hit").getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};});
      assert(box.y>=0&&box.y+box.h<=844,L+": grafiek niet in beeld voor de tik");
      const hoogtes=new Set([m00.h]),volgend=new Set([m00.volgendTop]);let laatsteKop="";
      for(const f of [0.15,0.5,0.85]){
        await page.touchscreen.tap(box.x+box.w*f,box.y+box.h*0.5);await page.waitForTimeout(200);
        const m=await meet(page);assert.equal(m.staat,"vol",`${L} f=${f}: strook niet gevuld na tik`);assert.equal(m.svgTekstZichtbaar,0,`${L}: SVG-tooltip zichtbaar na tik`);
        assert(m.kruisZichtbaar&&m.puntZichtbaar,`${L}: kruisdraad/punt weg na tik`);assert(m.minFont>=12);assert.equal(m.rijen.length,6);laatsteKop=m.kop;hoogtes.add(m.h);volgend.add(m.volgendTop);
      }
      assert.equal(hoogtes.size,1,`${L}: hoogte wisselt bij tikken`);assert.equal(volgend.size,1,`${L}: pagina verschuift bij tikken`);
      await page.waitForTimeout(4500);const idle=await meet(page);
      /* Sinds de uurselectie verdwijnt alleen de tijdelijke doos na 4 s; het getikte uur blijft gekozen (kaart, kruisdraad, punt). */
      assert.equal(idle.staat,"vol",`${L}: de gekozen uur moet na 4 s blijven staan`);assert.equal(idle.kop,laatsteKop,`${L}: de kaart wisselt van uur na loslaten`);
      assert.equal(idle.svgTekstZichtbaar,0,`${L}: de tijdelijke SVG-doos blijft staan na 4 s`);assert(idle.kruisZichtbaar&&idle.puntZichtbaar,`${L}: kruisdraad/punt van de selectie verdwijnen na 4 s`);
      assert.equal(idle.h,m00.h,`${L}: hoogte wisselt na loslaten`);
      assert.deepEqual(fouten,[],`${L}: runtimefouten ${fouten}`);
    }finally{await context.close();}
  }
  console.log("B. Touch (tik op 15/50/85 % van de grafiek, tijdelijke doos weg na 4 s, selectie blijft) op 320, 390 en 429 px, NL/EN: OK, hoogte en paginapositie stabiel.");
}

/* C. De ruimte komt uit de initiële HTML/CSS: ook zonder JavaScript staat de lege strook er, op iedere smalle breedte. */
async function testStatischeRuimte(browser,root){
  for(const w of [320,390,429])for(const taal of ["nl","en"]){
    const L=`zonder JavaScript ${w}px`;
    const {context,page}=await open(browser,root,{w,taal,js:false});
    try{
      const r=await page.evaluate(()=>{const st=document.getElementById("tip-strook"),svg=document.getElementById("chart"),b=st.getBoundingClientRect();return {bestaat:!!st,leeg:st.children.length===0&&st.textContent==="",display:getComputedStyle(st).display,h:b.height,volgtOpSvg:svg.nextElementSibling===st,ariaHidden:st.getAttribute("aria-hidden")};});
      assert(r.bestaat&&r.leeg&&r.volgtOpSvg,`${L}: strook ontbreekt of is niet leeg/direct na de grafiek ${JSON.stringify(r)}`);
      assert.equal(r.display,"block",`${L}: strook niet zichtbaar in de initiële render`);assert(r.h>=140,`${L}: hoogte ${r.h}px in de initiële render`);assert.equal(r.ariaHidden,"true");
    }finally{await context.close();}
  }
  for(const w of [430,768,1363]){
    const {context,page}=await open(browser,root,{w,js:false});
    try{assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById("tip-strook")).display),"none",`zonder JavaScript ${w}px: strook zichtbaar`);}finally{await context.close();}
  }
  const html=fs.readFileSync(path.join(OUT,"index.html"),"utf8");
  assert(/<div id="tip-strook" class="tip-strook" aria-hidden="true"><\/div>/.test(html),"initiële HTML mist de lege strook (en bevat geen rustregel als tekst)");
  assert(!html.includes("Kies een uur in de grafiek om de details te bekijken.")||/content:\s*"Kies een uur/.test(html),"rustregel staat als HTML-tekst in plaats van als CSS-inhoud");
  console.log("C. Gereserveerde ruimte (>=140px) staat in de initiële HTML/CSS, zonder JavaScript, op 320/390/429 px (NL/EN); vanaf 430 px verborgen; rustregel alleen als CSS-inhoud.");
}

/* D. Vanaf 430 px: bestaande SVG-tooltip, minimaal 12 px effectief. */
async function testSvgTooltip(browser,root){
  const breedtes=[430,431,440,480,520,600,700,767,768,820,1024,1280,1363,1440,1920];
  for(const w of breedtes)for(const [taal,schema] of [["nl","light"],["en","dark"]]){
    const L=`${w}px ${taal} ${schema}`;
    const {context,page,fouten}=await open(browser,root,{w,taal,schema});
    try{
      const n=await page.evaluate(()=>S.geo.n);
      const st=await meet(page);assert.equal(st.display,"none",L+": strook zichtbaar vanaf 430 px");
      for(const i of [0,4,9,14,19,n-1]){
        await kies(page,Math.min(i,n-1));const t=await svgTooltip(page);
        assert(t.zichtbaar,`${L} uur ${i}: SVG-tooltip niet zichtbaar`);assert(t.aantal>=13,`${L} uur ${i}: ${t.aantal} teksten`);
        assert(t.min>=12-1e-6,`${L} uur ${i}: kleinste tekst ${t.min.toFixed(3)}px effectief`);
        assert(t.doosBinnenGrafiek,`${L} uur ${i}: doos buiten de grafiek`);assert(t.tekstBinnenDoos,`${L} uur ${i}: tekst buiten de doos`);assert.equal(t.rijOverlap,0,`${L} uur ${i}: label en waarde overlappen`);
      }
      assert.deepEqual(fouten,[],`${L}: runtimefouten ${fouten}`);
    }finally{await context.close();}
  }
  console.log(`D. SVG-tooltip vanaf 430 px (${breedtes.join("/")}, NL licht en EN donker): strook verborgen, kleinste tekst >=12px effectief, doos binnen de grafiek, tekst binnen de doos, geen overlap.`);
}

/* E. Breekpunt tijdens gebruik (en de exacte grens 429/430). */
async function testBreekpunt(browser,root){
  const {context,page}=await open(browser,root,{w:429,taal:"nl",schema:"light"});
  try{
    await kies(page,6);let m=await meet(page);assert.equal(m.display,"block");assert.equal(m.staat,"vol");assert.equal(m.svgTekstZichtbaar,0);
    for(const [w,sterk] of [[430,false],[429,true],[414,true],[413,true],[480,false],[390,true]]){
      await page.setViewportSize({width:w,height:844});await page.waitForTimeout(1600);await kies(page,7);
      m=await meet(page);
      if(sterk){assert.equal(m.display,"block",`${w}px: strook niet zichtbaar`);assert.equal(m.staat,"vol",`${w}px: strook niet gevuld`);assert.equal(m.svgTekstZichtbaar,0,`${w}px: SVG-tooltip zichtbaar`);}
      else{assert.equal(m.display,"none",`${w}px: strook zichtbaar`);const t=await svgTooltip(page);assert(t.zichtbaar&&t.min>=12-1e-6,`${w}px: SVG-tooltip ${t.min}px`);}
    }
  }finally{await context.close();}
  console.log("E. Wisselen van breedte tijdens gebruik (429 -> 430 -> 429 -> 414 -> 413 -> 480 -> 390 px) zonder herladen: strook en SVG-tooltip wisselen correct.");
}

server.listen(0,"127.0.0.1",async()=>{
  const root="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  try{
    const tijd=async(naam,f)=>{const t=Date.now();await f();console.log("  duur "+naam+": "+((Date.now()-t)/1000).toFixed(1)+" s");};
    await tijd("A",()=>testStrook(browser,root));
    await tijd("B",()=>testTouch(browser,root));
    await tijd("C",()=>testStatischeRuimte(browser,root));
    await tijd("D",()=>testSvgTooltip(browser,root));
    await tijd("E",()=>testBreekpunt(browser,root));
    console.log("Tooltip-strook en 12px-tooltip: A t/m E OK.");
  }catch(e){console.error(e);process.exitCode=1;}
  finally{await browser.close();server.close();}
});

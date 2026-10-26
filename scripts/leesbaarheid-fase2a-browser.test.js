"use strict";

/* Fase 2a (25 oktober 2026): leesbaarheid van labels, waarden en grafiekteksten op het gebouwde artifact.
   Vastgelegd en bewaakt, op 320, 340, 360, 375, 390, 768, 1440 en 1920px, in Nederlands en Engels, licht en donker:
   - geen zichtbare HTML-tekst onder 12px (alleen de tekst binnen de grafiek-SVG heeft een eigen ondergrens, zie hieronder);
   - de waarden van de uurtabel zijn nooit kleiner dan de kolomkop erboven, en op de telefoon 14px;
   - alle zichtbare HTML-tekst met een bepaalbare achtergrondkleur haalt WCAG-contrast (4,5:1; 3:1 voor grote tekst);
   - grafiektekst minimaal 12px (11px alleen op een grafiek smaller dan 350px: op 320 en 340px staan de uurlabels dan 1 tot 3px
     uit elkaar en houdt het nu-label op 360px te weinig ruimte over), de as- en tijdlabels staan op volle dekking en halen WCAG-contrast 4,5:1;
     de twee zonlabels (op/onder) houden hun 11px (zie zonlabels-winter-browser.test.js: op 12px overlappen ze op een korte winterdag);
   - geen horizontale paginascroll, geen kolomkop of waarde in de uurtabel die over twee regels breekt;
   - ieder tegellabel valt binnen zijn tegel (ook "Luchtvochtigheid" op 320px);
   - Auto | Licht | Donker delen één lettergrootte van minstens 12px en passen op één regel.
   Het schema wordt aantoonbaar toegepast (achtergrond donker of licht), zodat de test niet stilzwijgend alleen het
   lichte thema meet. */

const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");
const {chromium}=require("playwright");
const {bouw}=require("../data.js");

const PUBLIC=path.join(__dirname,"..","public");
if(!fs.existsSync(path.join(PUBLIC,"index.html")))throw new Error("public/index.html ontbreekt; draai eerst de build.");
const mime={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".woff2":"font/woff2",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".css":"text/css; charset=utf-8"};

/* Een regenachtige avond met een officiële waarschuwing, zodat ook de regenaanduiding in de grafiek en het
   waarschuwingsblok in de meting zitten. */
const d=bouw({tempNu:18,wcNu:3,ccNu:60,rh:80,pp:u=>u>=16&&u<=19?60:10,pr:u=>u>=16&&u<=19?0.6:0,wc:u=>u>=16&&u<=19?61:3,cc:()=>60,som:2});
d.latitude=52.3676;d.longitude=4.9041;d.elevation=3;d.minutely_15=null;
Object.assign(d.current,{time:"2026-07-22T14:10",interval:900,visibility:16000});
d.daily.sunshine_duration=d.daily.time.map(()=>6*3600);
const air={current:{european_aqi:30,us_aqi:40},hourly:{time:[d.current.time],alder_pollen:[0],birch_pollen:[0],grass_pollen:[0],mugwort_pollen:[0],ragweed_pollen:[0],olive_pollen:[0]}};
const WAARSCHUWING=[{titel:"Code geel: windstoten",niveau:"geel",tekst:"Verwachte windstoten tot 75 km/u.",van:"2026-07-22T10:00:00Z",tot:"2026-07-22T20:00:00Z",gebied:"Flevoland",plaatsSpecifiek:true,landelijk:false}];
const NU=Date.UTC(2026,6,22,12,10,0);

function bouwServer(){
  let html=fs.readFileSync(path.join(PUBLIC,"index.html"),"utf8");
  const stub=`<script>Date.now=()=>${NU};window.fetch=async function(url){const u=String(url);
    const payload=u.includes('/api/neerslag')?${JSON.stringify({beschikbaar:false,reden:"test"})}:u.includes('/api/waarschuwingen')?${JSON.stringify({bron:"test",dekking:true,lijst:WAARSCHUWING,land:"NL"})}:u.includes('air-quality-api.open-meteo.com')?${JSON.stringify(air)}:u.includes('geocoding-api.open-meteo.com')?${JSON.stringify({results:[{name:"Amsterdam",latitude:52.3676,longitude:4.9041,admin1:"Noord-Holland",country_code:"NL"}]})}:u.includes('/api/plaatsnaam')?${JSON.stringify({naam:"Amsterdam",land:"NL",bron:"test"})}:${JSON.stringify(d)};
    return {ok:true,status:200,json:async()=>payload,text:async()=>JSON.stringify(payload)};};
    try{Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true});}catch(e){}</script>`;
  html=html.replace("</head>",stub+"</head>");
  return http.createServer((req,res)=>{
    const p=(req.url||"").split("?")[0];
    if(p==="/"||p==="/index.html"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html);return;}
    const f=path.join(PUBLIC,p.replace(/^\//,""));
    if(f.startsWith(PUBLIC+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()){res.writeHead(200,{"content-type":mime[path.extname(f).toLowerCase()]||"application/octet-stream"});fs.createReadStream(f).pipe(res);}
    else{res.writeHead(404);res.end("not found");}
  });
}

/* Wordt in de pagina uitgevoerd. */
function meet(){
  const rgb=s=>{const m=(s||"").match(/[\d.]+/g);return m?[+m[0],+m[1],+m[2],m[3]===undefined?1:+m[3]]:[0,0,0,0];};
  const lin=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  const lum=c=>0.2126*lin(c[0])+0.7152*lin(c[1])+0.0722*lin(c[2]);
  const over=(f,b)=>{const a=f[3];return [f[0]*a+b[0]*(1-a),f[1]*a+b[1]*(1-a),f[2]*a+b[2]*(1-a),1];};
  const zichtbaar=e=>{
    for(let n=e;n&&n.nodeType===1;n=n.parentElement){
      const c=getComputedStyle(n);
      if(c.display==="none"||c.visibility==="hidden"||n.hidden)return false;
      if(n!==e&&c.overflow!=="visible"&&(n.clientWidth===0||n.clientHeight===0))return false;
    }
    const r=e.getBoundingClientRect(),c=getComputedStyle(e);
    if(r.width<1||r.height<1)return false;
    if(c.clip&&c.clip!=="auto"&&/rect\(0/.test(c.clip))return false;
    return true;
  };
  const sig=e=>{const p=[];for(let n=e,i=0;n&&n.nodeType===1&&i<3;n=n.parentElement,i++){let s=n.tagName.toLowerCase();if(n.id)s+="#"+n.id;else if(n.classList.length)s+="."+[...n.classList].slice(0,2).join(".");p.unshift(s);}return p.join(">");};
  const effOpacity=e=>{let o=1;for(let n=e;n&&n.nodeType===1;n=n.parentElement)o*=+getComputedStyle(n).opacity;return o;};
  const effBg=e=>{
    const lagen=[];let onbekend=false;
    for(let n=e;n&&n.nodeType===1;n=n.parentElement){const cs=getComputedStyle(n);if(cs.backgroundImage&&cs.backgroundImage!=="none")onbekend=true;const c=rgb(cs.backgroundColor);if(c[3]>0)lagen.push(c);if(c[3]>=1)break;}
    const htmlBg=rgb(getComputedStyle(document.documentElement).backgroundColor),bodyBg=rgb(getComputedStyle(document.body).backgroundColor);
    let b=htmlBg[3]>0?htmlBg:(bodyBg[3]>0?bodyBg:[255,255,255,1]);
    if(b[3]<1)b=over(b,[255,255,255,1]);
    for(let i=lagen.length-1;i>=0;i--)b=over(lagen[i],b);
    return {b,onbekend};
  };
  const regels=el=>{const r=document.createRange();r.selectNodeContents(el);return new Set([...r.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top))).size;};

  /* Alle zichtbare HTML-tekst (geen SVG, geen visueel verborgen schermlezertekst). */
  const klein=[],laagContrast=[];
  let tekstknopen=0,beoordeeld=0;
  for(const e of document.body.querySelectorAll("*")){
    if(["SCRIPT","STYLE","NOSCRIPT","SVG","PATH","G","DEFS","TITLE"].includes(e.tagName.toUpperCase()))continue;
    if(e.closest("svg"))continue;
    if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>0))continue;
    if(!zichtbaar(e))continue;
    if(e.closest(".wiw-visually-hidden,.sr-only,[aria-hidden='true']"))continue;
    tekstknopen++;
    const cs=getComputedStyle(e),px=parseFloat(cs.fontSize);
    if(px===0)continue; /* pictogramknoppen met alleen een toegankelijke naam: de tekst wordt niet getekend */
    if(px<12)klein.push(sig(e)+" "+px+"px “"+e.textContent.trim().slice(0,24)+"”");
    /* WCAG 2.2 AA (1.4.3): 4,5:1, of 3:1 voor grote tekst; elementen op een achtergrondafbeelding of kleurverloop
       worden niet beoordeeld (daar is geen enkele achtergrondkleur te bepalen). */
    const bg=effBg(e);
    if(!bg.onbekend){
      const f=rgb(cs.color),fg=over([f[0],f[1],f[2],f[3]*effOpacity(e)],bg.b),L1=lum(fg),L2=lum(bg.b),ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
      const groot=px>=24||(px>=18.66&&(+cs.fontWeight||400)>=700);
      beoordeeld++;
      if(ratio<(groot?3:4.5))laagContrast.push(sig(e)+" "+ratio.toFixed(2)+":1 “"+e.textContent.trim().slice(0,24)+"”");
    }
  }

  /* De grafiektekst. */
  const grafiek=[...document.querySelectorAll("#chart text")].filter(t=>{const r=t.getBoundingClientRect(),c=getComputedStyle(t);return r.width>0&&r.height>0&&c.visibility!=="hidden"&&c.display!=="none";}).map(t=>{
    const c=getComputedStyle(t),svg=t.closest("svg"),sr=svg.getBoundingClientRect(),vb=svg.viewBox&&svg.viewBox.baseVal&&svg.viewBox.baseVal.width,schaal=vb?sr.width/vb:1;
    const bg=effBg(svg).b,f=rgb(c.fill),fg=over([f[0],f[1],f[2],f[3]*(+c.fillOpacity||1)*effOpacity(t)],bg);
    const L1=lum(fg),L2=lum(bg);
    return {zon:/^(?:sunrise|sunset|zon op|zon onder)\b/i.test(t.textContent.trim()),tekst:t.textContent.trim().slice(0,20),px:+(parseFloat(c.fontSize)*schaal).toFixed(2),dekking:+effOpacity(t).toFixed(2),contrast:+((Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05)).toFixed(2)};
  });

  /* De uurtabel. Een cel met een tweede regel eronder (.wiw-hour-secondary, bijvoorbeeld de kans naast de hoeveelheid
     op een breed scherm) heeft ontwerpmatig twee regels; daar telt alleen of er niets wordt afgeknipt. */
  const ths=[...document.querySelectorAll("#wiw-hour-table thead th")].filter(th=>zichtbaar(th)&&th.textContent.trim()&&!th.classList.contains("wiw-visually-hidden")&&!th.querySelector(".wiw-visually-hidden"));
  const rij=[...document.querySelectorAll("#wiw-hour-table tbody tr")].filter(zichtbaar)[0];
  const tds=rij?[...rij.children]:[];
  const kopPx=ths.map(th=>parseFloat(getComputedStyle(th).fontSize));
  const waardePx=tds.map(td=>parseFloat(getComputedStyle(td).fontSize));
  const kopRegels=ths.map(th=>({tekst:th.textContent.trim(),regels:regels(th),afgeknipt:th.scrollWidth-th.clientWidth}));
  const waardeRegels=[...document.querySelectorAll("#wiw-hour-table tbody tr")].filter(zichtbaar).slice(0,6).flatMap(tr=>[...tr.children].slice(1).map(td=>({tekst:td.textContent.trim().replace(/\s+/g," "),regels:td.querySelector(".wiw-hour-secondary")?1:regels(td),afgeknipt:td.scrollWidth-td.clientWidth})));

  /* De weergavekeuze. */
  const knoppen=["thema-auto"].map(id=>document.getElementById(id)).concat([...document.querySelectorAll("[data-thema-handmatig]")]).filter(Boolean);
  const thema=knoppen.map(k=>({px:parseFloat(getComputedStyle(k).fontSize),regels:regels(k),binnen:k.getBoundingClientRect().right<=innerWidth+0.5&&k.getBoundingClientRect().left>=-0.5,tekst:k.textContent.trim()}));

  /* Past ieder tegellabel binnen zijn tegel? Gemeten aan de echte tekstregels (Range), niet aan de scrollbreedte, omdat een
     gecentreerd label aan beide kanten uitsteekt. */
  let tegelOverschrijding=0,tegelOverschrijdingLabel="";
  for(const s of document.querySelectorAll(".stat")){
    const e=s.querySelector(".eyebrow");if(!e||!zichtbaar(e))continue;
    const r=document.createRange();r.selectNodeContents(e);
    const regelRects=[...r.getClientRects()].filter(x=>x.width>0);if(!regelRects.length)continue;
    const sr=s.getBoundingClientRect(),o=Math.max(0,sr.left-Math.min(...regelRects.map(x=>x.left)),Math.max(...regelRects.map(x=>x.right))-sr.right);
    if(o>tegelOverschrijding){tegelOverschrijding=+o.toFixed(1);tegelOverschrijdingLabel=e.textContent.trim();}
  }

  /* Kleine hulpteksten onder de tegels. */
  const tegel=document.querySelector(".stat .eyebrow"),sub=document.querySelector(".stat .ssub");

  return {
    svgBreedte:Math.round(document.querySelector("#chart").getBoundingClientRect().width*10)/10,
    tegelOverschrijding,tegelOverschrijdingLabel,klein,laagContrast,beoordeeld,tekstknopen,grafiek,kopPx,waardePx,kopRegels,waardeRegels,thema,
    eyebrowPx:tegel?parseFloat(getComputedStyle(tegel).fontSize):null,subPx:sub?parseFloat(getComputedStyle(sub).fontSize):null,
    overloop:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,
    achtergrondLuminantie:lum(effBg(document.body).b),
    waarschuwing:!!document.querySelector("#waarschuwingen .waarsch"),
    breedte:innerWidth
  };
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:require("./vind-browser.js").vindBrowser()||undefined});
  let n=0;
  const srv=bouwServer();await new Promise(r=>srv.listen(0,"127.0.0.1",r));
  try{
    const GEVALLEN=[];
    for(const taal of ["nl","en"])for(const schema of ["light","dark"])for(const breedte of [320,340,360,375,390,768,1440,1920]){
      const L=`${taal} ${schema} ${breedte}px`,telefoon=breedte<=759;
      const context=await browser.newContext({viewport:{width:breedte,height:1000},locale:taal==="en"?"en-GB":"nl-NL",timezoneId:"Europe/Amsterdam",colorScheme:schema,serviceWorkers:"block"});
      try{
        const page=await context.newPage(),fouten=[];
        page.on("pageerror",e=>fouten.push(String(e)));
        if(taal==="en")await page.addInitScript(()=>{try{localStorage.setItem("weerbriefing.taal.v1","en");}catch(e){}});
        await page.goto(`http://127.0.0.1:${srv.address().port}/?lat=52.3676&lon=4.9041&plaats=Amsterdam&land=NL`,{waitUntil:"networkidle"});
        await page.waitForSelector("#wiw-hour-table tbody tr",{timeout:15000});
        await page.waitForSelector("#chart text",{state:"attached",timeout:15000});
        await page.waitForTimeout(1200);
        const r=await page.evaluate(meet);

        /* Het schema is echt toegepast. */
        if(schema==="dark")assert.ok(r.achtergrondLuminantie<0.2,`${L}: de pagina is niet donker (luminantie ${r.achtergrondLuminantie})`);
        else assert.ok(r.achtergrondLuminantie>0.8,`${L}: de pagina is niet licht (luminantie ${r.achtergrondLuminantie})`);
        assert.ok(r.tekstknopen>150,`${L}: te weinig tekst gemeten (${r.tekstknopen})`);
        assert.ok(r.waarschuwing,`${L}: het waarschuwingsblok ontbreekt in de meting`);

        /* Geen zichtbare HTML-tekst onder 12px. */
        assert.deepEqual(r.klein,[],`${L}: tekst onder 12px:\n  ${r.klein.join("\n  ")}`);
        /* WCAG-contrast van alle zichtbare HTML-tekst waarvan de achtergrondkleur te bepalen is. */
        assert.ok(r.beoordeeld>100,`${L}: te weinig tekst op contrast beoordeeld (${r.beoordeeld})`);
        assert.deepEqual(r.laagContrast,[],`${L}: contrast onder AA:\n  ${r.laagContrast.join("\n  ")}`);
        /* Hiërarchie: labels 12px, hulptekst onder de tegels 13px of groter. */
        assert.ok(r.eyebrowPx>=12,`${L}: tegellabel ${r.eyebrowPx}px`);
        assert.ok(r.subPx>=r.eyebrowPx,`${L}: hulptekst (${r.subPx}px) kleiner dan het label (${r.eyebrowPx}px)`);

        /* Uurtabel: waarden nooit kleiner dan de kop, op de telefoon minstens 14px, niets over twee regels. */
        assert.ok(r.kopPx.length>=3,`${L}: uurtabelkop niet gevonden`);
        r.kopPx.forEach((px,i)=>assert.ok(px>=12,`${L}: kolomkop ${r.kopRegels[i].tekst} is ${px}px`));
        const kopMax=Math.max(...r.kopPx);
        r.waardePx.slice(1).forEach((px,i)=>{
          assert.ok(px>=kopMax,`${L}: waarde in kolom ${i+2} (${px}px) kleiner dan de kop (${kopMax}px)`);
          if(telefoon)assert.ok(px>=14,`${L}: waarde in kolom ${i+2} is ${px}px (telefoon: minimaal 14px)`);
        });
        r.kopRegels.forEach(k=>{
          assert.equal(k.regels,1,`${L}: kolomkop "${k.tekst}" staat op ${k.regels} regels (afgebroken)`);
          assert.ok(k.afgeknipt<=1,`${L}: kolomkop "${k.tekst}" wordt ${k.afgeknipt}px afgeknipt`);
        });
        r.waardeRegels.forEach(w=>{
          assert.equal(w.regels,1,`${L}: uurwaarde "${w.tekst}" staat op ${w.regels} regels`);
          assert.ok(w.afgeknipt<=1,`${L}: uurwaarde "${w.tekst}" wordt ${w.afgeknipt}px afgeknipt`);
        });

        /* Grafiektekst: leesbare maat, volle dekking, voldoende contrast. */
        assert.ok(r.grafiek.length>=8,`${L}: te weinig grafiekteksten (${r.grafiek.length})`);
        /* Ondergrens grafiektekst: 12px, en 11px alleen op de smalste telefoons (grafiek smaller dan 350px): daar staan de acht
           uurlabels op 12px 1 tot 3px uit elkaar (320/340px) en houdt het nu-label op 360px 0,5px over in plaats van de
           vereiste 1px (zie grafiekMinPx). */
        const grafiekMin=r.svgBreedte>=350?12:11;
        assert.ok(grafiekMin===12||breedte<375,`${L}: grafiek van ${r.svgBreedte}px blijft op 11px terwijl het scherm breed genoeg is`);
        r.grafiek.forEach(t=>{
          /* De zonlabels (zon op/onder) houden 11px; alle andere grafiektekst volgt de ondergrens hierboven. */
          const min=t.zon?11:grafiekMin;
          assert.ok(t.px>=min-0.05,`${L}: grafiektekst “${t.tekst}” is ${t.px}px (ondergrens ${min}px bij een grafiek van ${r.svgBreedte}px)`);
          assert.equal(t.dekking,1,`${L}: grafiektekst “${t.tekst}” staat op dekking ${t.dekking}`);
          assert.ok(t.contrast>=4.5,`${L}: grafiektekst “${t.tekst}” heeft contrast ${t.contrast}:1 (minimaal 4,5:1)`);
        });

        /* Weergavekeuze: één lettergrootte, minstens 12px, één regel, binnen het scherm. */
        assert.equal(r.thema.length,3,`${L}: ${r.thema.length} knoppen in de weergavekeuze`);
        r.thema.forEach(k=>{
          assert.ok(k.px>=12,`${L}: knop ${k.tekst} is ${k.px}px`);
          assert.equal(k.regels,1,`${L}: knop ${k.tekst} breekt over ${k.regels} regels`);
          assert.ok(k.binnen,`${L}: knop ${k.tekst} valt buiten het scherm`);
        });
        assert.equal(new Set(r.thema.map(k=>k.px)).size,1,`${L}: de drie knoppen delen geen lettergrootte (${r.thema.map(k=>k.px)})`);

        /* Tegellabels vallen binnen hun tegel (vóór fase 2a stak "Luchtvochtigheid" op 320px 7px buiten de tegel). */
        assert.ok(r.tegelOverschrijding<=1,`${L}: tegellabel "${r.tegelOverschrijdingLabel}" steekt ${r.tegelOverschrijding}px buiten zijn tegel`);

        /* Geen horizontale paginascroll en geen scriptfouten. */
        assert.ok(r.overloop<=0,`${L}: horizontale overloop ${r.overloop}px`);
        assert.deepEqual(fouten,[],`${L}: scriptfouten`);
        GEVALLEN.push(L);
        n++;
      }finally{await context.close();}
    }
    console.log(`Leesbaarheid fase 2a: ${n} situaties (NL/EN, licht/donker, 320/340/360/375/390/768/1440/1920px): geen HTML-tekst onder 12px, AA-contrast van alle HTML-tekst met bepaalbare achtergrond, uurtabelwaarden minstens zo groot als de kop (telefoon 14px), grafiektekst op volle dekking met contrast ≥ 4,5:1, geen afgebroken kop of waarde, tegellabels binnen hun tegel, weergavekeuze op één regel, geen horizontale scroll.`);
  }finally{srv.close();await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

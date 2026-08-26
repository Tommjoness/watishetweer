"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const PAD=path.join(OUT,"index.html");
const CSS=fs.readFileSync(path.join(__dirname,"staff-audit-20260826.css"),"utf8");
const JS=fs.readFileSync(path.join(__dirname,"staff-audit-20260826.js"),"utf8");
const START="/* ---------- start ---------- */";
const CSS_MARK="/* ===== STAFF AUDIT 20260826 CSS ===== */";
const JS_MARK="/* ===== STAFF AUDIT 20260826 ===== */";

function vervangExact(bron,oud,nieuw,label){
  const n=bron.split(oud).length-1;
  if(n!==1)throw new Error(label+"-anker ontbreekt of is dubbel: "+n);
  return bron.replace(oud,nieuw);
}

let html=fs.readFileSync(PAD,"utf8");
if(html.includes(CSS_MARK)||html.includes(JS_MARK))throw new Error("Staff-auditlaag staat al in de artifact.");
if(!html.includes("WeatherNowMobileStateUX"))throw new Error("Mobiele state-UX moet vóór de staff-audit zijn geassembleerd.");
if(!html.includes("WeatherNowGlobalLocationHardening"))throw new Error("Wereldwijde locatiehardening ontbreekt vóór staff-audit.");

/* Landmarks + skiplink. UI-polish heeft #app al naar de enige semantische
   <main> omgezet; deze laag voegt alleen een focusdoel voor de skiplink toe en
   maakt de bestaande mast expliciet het banner-landmark. */
html=vervangExact(html,
  '<body>\n<div class="sheet">',
  '<body>\n<a class="skiplink" href="#app">Ga naar hoofdinhoud</a>\n<div class="sheet">',
  "skiplink");
html=vervangExact(html,'  <div class="mast">','  <div class="mast" role="banner">',"header-landmark");
html=vervangExact(html,'<main id="app" style="display:none">','<main id="app" tabindex="-1" style="display:none">',"main-focusdoel");

/* De SVG blijft de rustige visuele grafiek. Een native details+table biedt
   dezelfde kerngegevens via toetsenbord/screenreader zonder ieder SVG-punt
   focusbaar te maken. */
const CHART_BRON=`      <svg id="chart" viewBox="0 0 900 296" width="100%" role="img"
           aria-label="Dag- en nachtverloop met temperatuur, spreiding en neerslagkans"></svg>`;
const CHART_NIEUW=CHART_BRON+`
      <details id="chartdata" class="chartdata">
        <summary>Grafiekgegevens als tabel</summary>
        <div class="chartdata-scroll" tabindex="0" role="region" aria-label="Grafiekgegevens">
          <table>
            <caption class="sr-only">Alternatieve gegevensweergave van de huidige weergrafiek.</caption>
            <thead><tr><th scope="col">Tijd</th><th scope="col">Weer</th><th scope="col">Temperatuur</th><th scope="col">Gevoel</th><th scope="col">Neerslagkans</th><th scope="col">Hoeveelheid</th><th scope="col">Wind</th><th scope="col">Windstoot</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </details>`;
html=vervangExact(html,CHART_BRON,CHART_NIEUW,"toegankelijke grafiektabel");

/* Neerslagkans en dagsom blijven bewust bij de relevante dagrij uitgelegd.
   #179 heeft de losse algemene uitleg verwijderd; deze staff-laag mag die
   productbeslissing niet opnieuw ongedaan maken. De runtime verrijkt alleen de
   bestaande daggebonden notities met het broncontract. */
if(html.includes('id="weekbron-uitleg"'))throw new Error("Losse weekbrede neerslaguitleg mag niet terugkeren.");

/* De startup-router mag een beschadigde of gedeeltelijke lat/lon-query niet
   negeren en daarna oude localStorage-data onder die URL tonen. De bestaande
   GlobalLocationHardening blijft de enige coordinate-validator. */
const COORD_BRON=`  const la=parseFloat(p.get("lat")),lo=parseFloat(p.get("lon"));
  if(!isNaN(la)&&!isNaN(lo)){
    const nm=p.get("plaats")||"Gedeelde locatie";
    q.value=nm;
    load(la,lo,nm,false,false,normLand(p.get("land")));
    return;
  }`;
const COORD_NIEUW=`  const heeftGedeeldeCoordinaten=p.has("lat")||p.has("lon");
  if(heeftGedeeldeCoordinaten){
    const hard=globalThis.WeatherNowGlobalLocationHardening;
    const gedeeld=hard&&typeof hard.gedeeldeUrlCoordinaten==="function"?hard.gedeeldeUrlCoordinaten(p):null;
    if(!gedeeld||!gedeeld.geldig){
      q.value=p.get("plaats")||"";
      const app=document.getElementById("app");if(app)app.style.display="none";
      const fout=document.getElementById("state");
      if(fout){fout.style.display="block";fout.className="msg err";fout.setAttribute("role","alert");fout.textContent="Deze gedeelde locatie is ongeldig. Controleer de link, zoek een plaats of gebruik Mijn locatie.";}
      return;
    }
    const la=gedeeld.latitude,lo=gedeeld.longitude,nm=p.get("plaats")||"Gedeelde locatie";
    q.value=nm;
    load(la,lo,nm,false,false,normLand(p.get("land")));
    return;
  }`;
html=vervangExact(html,COORD_BRON,COORD_NIEUW,"strikte startup-coordinaten");

/* Alleen expliciete locatiekeuzes krijgen pushState. Initial load, refresh en
   achtergrondverversing blijven replace/no-op. Het daadwerkelijke history-
   schrijven blijft centraal in de staff-runtime. */
const SEARCH_BRON='  q.value=el.dataset.nm;zoekIndex=-1;gpsGeneratie++;load(el.dataset.lat,el.dataset.lon,el.dataset.nm,false,true,el.dataset.land||null);';
const SEARCH_NIEUW='  q.value=el.dataset.nm;zoekIndex=-1;gpsGeneratie++;WeatherNowStaffAudit.markeerNavigatie("push");load(el.dataset.lat,el.dataset.lon,el.dataset.nm,false,true,el.dataset.land||null);';
html=vervangExact(html,SEARCH_BRON,SEARCH_NIEUW,"zoekselectie-history");
const CHIP_BRON='      document.getElementById("q").value=p.label;load(p.lat,p.lon,p.label,false,true,p.land||null);';
const CHIP_NIEUW='      document.getElementById("q").value=p.label;WeatherNowStaffAudit.markeerNavigatie("push");load(p.lat,p.lon,p.label,false,true,p.land||null);';
html=vervangExact(html,CHIP_BRON,CHIP_NIEUW,"bewaarde-locatie-history");
const GPS_BRON='      q.value=nm;\n      await load(la,lo,nm,false,true,land);';
const GPS_NIEUW='      q.value=nm;\n      if(modus==="knop")WeatherNowStaffAudit.markeerNavigatie("push");\n      await load(la,lo,nm,false,true,land);';
html=vervangExact(html,GPS_BRON,GPS_NIEUW,"gps-history");

/* CSS en runtime draaien als laatste vóór startup, dus bovenop de reeds
   geverifieerde mobiele renderlaag zonder willekeurige time-outs. */
html=vervangExact(html,"</head>",`<style>\n${CSS_MARK}\n${CSS}\n/* ===== EINDE STAFF AUDIT 20260826 CSS ===== */\n</style>\n</head>`,"staff-css");
html=vervangExact(html,START,`${JS_MARK}\n${JS}\n/* ===== EINDE STAFF AUDIT 20260826 ===== */\n\n${START}`,"staff-runtime");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline scripts na staff-audit.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:staff-audit-"+(i+1)}));

for(const vereist of [
  'class="skiplink"','role="banner"','<main id="app" tabindex="-1"','id="chartdata"',
  'WeatherNowStaffAudit.markeerNavigatie("push")','window.addEventListener("popstate"',
  'Deze gedeelde locatie is ongeldig','Officiële melding','National Weather Service',
  'Kans en dagsom zijn verschillende modelwaarden'
])if(!html.includes(vereist))throw new Error("Staff-audit invariant ontbreekt: "+vereist);
if(html.includes('id="weekbron-uitleg"'))throw new Error("Staff-audit heeft losse weekbrede neerslaguitleg teruggebracht.");

fs.writeFileSync(PAD,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"staff-audit-20260826");
console.log("Staff-auditlaag toegepast: history, invalid deep links, grafiekdata, touch targets, warningtitels, daggebonden neerslagduiding en landmarks; cache "+versie+".");

module.exports={vervangExact,COORD_BRON,COORD_NIEUW,SEARCH_BRON,SEARCH_NIEUW,CHIP_BRON,CHIP_NIEUW,GPS_BRON,GPS_NIEUW,CHART_BRON,CHART_NIEUW};

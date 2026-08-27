"use strict";

const fs=require("fs");
const path=require("path");
const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const rootPad=path.join(OUT,"index.html");
const routePad=path.join(OUT,"weer","amsterdam","index.html");
for(const p of [rootPad,routePad])if(!fs.existsSync(p))throw new Error("Staff-audit artifact ontbreekt: "+p);

const rootHtml=fs.readFileSync(rootPad,"utf8"),routeHtml=fs.readFileSync(routePad,"utf8");
const tel=(s,q)=>s.split(q).length-1;
for(const [naam,html] of [["root",rootHtml],["Amsterdam-route",routeHtml]]){
  if(tel(html,"/* ===== STAFF AUDIT 20260826 ===== */")!==1)throw new Error(naam+": staff-runtime ontbreekt of is dubbel");
  if(tel(html,"/* ===== STAFF AUDIT 20260826 CSS ===== */")!==1)throw new Error(naam+": staff-CSS ontbreekt of is dubbel");
  for(const vereist of [
    'class="skiplink" href="#app"','role="banner"','<main id="app" tabindex="-1"',
    'id="chartdata"','Veeg horizontaal om alle kolommen te zien.','<table>','document.querySelectorAll("#days .dag-neerslagnotitie")',
    'Kans en dagsom zijn verschillende modelwaarden',
    'window.addEventListener("popstate"','history.pushState(state',
    'min-inline-size:40px','min-block-size:40px',
    'Deze gedeelde locatie is ongeldig','Waakzaamheid voor overstromingen',
    'Officiële titel:','National Weather Service'
  ])if(!html.includes(vereist))throw new Error(naam+": staff-invariant ontbreekt: "+vereist);
  if(html.includes('id="weekbron-uitleg"'))throw new Error(naam+": losse weekbrede neerslaguitleg is teruggekeerd");
  if(!html.includes('property="og:image" content="https://watishetweer.nl/icon-512.png"'))throw new Error(naam+": og:image ontbreekt");
  if(!html.includes('name="twitter:image" content="https://watishetweer.nl/icon-512.png"'))throw new Error(naam+": twitter:image ontbreekt");
}

if(!rootHtml.includes('hard.gedeeldeUrlCoordinaten(p)'))throw new Error("Root-startup gebruikt niet de bestaande centrale coordinate-validator.");
if(rootHtml.includes('const la=parseFloat(p.get("lat")),lo=parseFloat(p.get("lon"));'))throw new Error("Oude permissieve parseFloat-startup staat nog in root artifact.");
if(tel(rootHtml,'WeatherNowStaffAudit.markeerNavigatie("push")')<3)throw new Error("Niet alle expliciete locatiekeuzes markeren browserhistory.");
if(!rootHtml.includes("DAG_NEERSLAG_BRONCONTRACT"))throw new Error("Daggebonden broncontract kans versus hoeveelheid ontbreekt.");
if(!rootHtml.includes("function weatherNowWindstootBegin(tijd)"))throw new Error("Datumgrensvaste windstoot-owner ontbreekt in productieartifact.");
if(tel(rootHtml,"function weatherNowWindstootTekst(pg,nu,dag,vak){")!==1)throw new Error("Windstoottekst heeft niet exact één owner in productieartifact.");

/* De route moet canoniek blijven vóór een client-side locatiekeuze; de staff-
   runtime mag de statisch gegenereerde SEO-identiteit niet vooraf afbreken. */
if(!routeHtml.includes('<link rel="canonical" href="https://watishetweer.nl/weer/amsterdam/">'))throw new Error("Amsterdam-route canonical is geraakt.");
if(!routeHtml.includes("window.__WEATHERNOW_ROUTE_LOCATION__"))throw new Error("Routebootstrap ontbreekt na staff-audit.");

const rauw=Buffer.byteLength(rootHtml),gzip=require("zlib").gzipSync(Buffer.from(rootHtml)).length;
console.log(`Staff-audit build groen: root + Amsterdam-route, history, invalid URL, 40px touch target, grafiektabel, warningmapping, daggebonden neerslagduiding en share-image. Root HTML ${rauw} bytes, gzip ${gzip} bytes.`);

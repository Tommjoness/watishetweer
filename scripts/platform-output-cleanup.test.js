"use strict";

const assert=require("assert");
const path=require("path");
const vm=require("vm");
const {
  hardenRuntime,cssMinify,verzamelRuntime,minifyRuntime,hash12,isWeatherAppBestand
}=require("./platform-output-cleanup.js");

(async()=>{
  const bron=`<!doctype html><html><head><style>body { color: red; margin: 0px; }</style></head><body>
<script>
const groep={setAttribute(){}};
const horizontaal={setAttribute(){}};
const g={n:24};const perioden=[];const q4PeriodeTijdvak=()=>"15:00–19:00";const q4Mm=()=>"5,9";const oudeAria="Grafiek.";const svg={setAttribute(){}};
groep.setAttribute("aria-label","Neerslagperioden met tijdvak en hoeveelheid per periode");
    horizontaal.setAttribute("aria-label",q4PeriodeTijdvak(g,p)+" · "+q4Mm(p.som)+" mm");
  const detailAria=g.n<=25?" Bij iedere regenperiode staat het tijdvak en de verwachte hoeveelheid.":"";
  svg.setAttribute("aria-label",(oudeAria+" Meetbare neerslag staat als aaneengesloten perioden onder de temperatuurcurve."+detailAria+" Neerslagkansen blijven via de details beschikbaar.").trim());
</script></body></html>`;
  const hard=hardenRuntime(bron);
  const font400='rel="preload" href="/instrument-sans-latin-400-normal.woff2"';
  const font500='rel="preload" href="/instrument-sans-latin-500-normal.woff2"';
  const bodoni400='rel="preload" href="/bodoni-moda-latin-400-normal.woff2"';
  assert(hard.includes(font400),"Instrument Sans 400 preload ontbreekt");
  assert(hard.includes(font500),"Instrument Sans 500 preload ontbreekt terwijl die weight in de kritieke mobiele keten staat");
  assert(hard.includes(bodoni400),"Bodoni preload ontbreekt");
  const eersteStijl=hard.indexOf("<style>");
  assert(eersteStijl>0,"eerste stijlblok ontbreekt in geharde testartifact");
  for(const preload of [font400,font500,bodoni400])assert(hard.indexOf(preload)<eersteStijl,"kritieke fontpreload moet vóór het eerste stijlblok staan: "+preload);
  assert(hard.includes('groep.setAttribute("aria-hidden","true")'),"regenperiodegroep is niet decoratief voor accessibility tree");
  assert(!hard.includes('horizontaal.setAttribute("aria-label"'),"ongeldige aria-label op SVG-line bleef staan");
  assert(hard.includes("Neerslagperioden: "),"exacte regenperiodesamenvatting verhuist niet naar het SVG-label");

  const css=cssMinify('<style>body { color: red; margin: 0px; }</style>');
  assert(css.length<'<style>body { color: red; margin: 0px; }</style>'.length,"CSS werd niet kleiner");
  assert(css.includes("body{color:red;margin:0}"),"CSS-minificatie wijzigde onverwacht");

  const routeHtml='<script type="application/ld+json">{"x":1}</script><!-- WEATHER NOW PLAATSROUTE --><script>window.__WEATHERNOW_ROUTE_LOCATION__=Object.freeze({"slug":"almere","lat":52.35,"lon":5.26});</script><script>function publiek(){return 2 + 2;} globalThis.__deliveryTest=publiek();</script>';
  const verzameld=verzamelRuntime(routeHtml);
  assert.equal(verzameld.scripts.length,1,"routebootstrap mag geen executable inline runtime blijven");
  assert.equal(verzameld.earlyScripts.length,0,"zonder stijlblok is er geen pre-paintscript om apart te houden");
  assert.equal(verzameld.routeData.slug,"almere","routebootstrap-data ging verloren");
  assert(verzameld.html.includes('type="application/json" id="weather-now-route"'),"routebootstrap is niet naar data-script gemigreerd");
  assert(verzameld.html.includes('type="application/ld+json"'),"JSON-LD mag niet worden geëxternaliseerd");

  const min=await minifyRuntime(verzameld.scripts,verzameld.routeData);
  assert(min.code.length<min.bron.length,"Terser maakte de test-runtime niet kleiner");
  new vm.Script(min.code);
  assert(/^[0-9a-f]{12}$/.test(hash12(min.code)),"contenthash heeft niet de afgesproken vorm");

  const vroegHtml='<html><head><script>(()=>{const raw=localStorage.getItem("weerbriefing.thema");if(raw)document.documentElement.setAttribute("data-thema","donker");})();</script><style>body{color:red}</style></head><body><script>globalThis.laat=1;</script></body></html>';
  const vroeg=verzamelRuntime(vroegHtml);
  assert.equal(vroeg.earlyScripts.length,1,"echte pre-paint thema-initialisatie moet apart worden gehouden");
  assert.equal(vroeg.scripts.length,1,"gewone bodyruntime blijft in de deferred hoofdbundle");
  assert(vroeg.earlyScripts[0].body.includes('localStorage.getItem("weerbriefing.thema")'),"thema-initialisatie ging verloren");
  const vroegPos=vroeg.html.indexOf(vroeg.earlyScripts[0].token);
  const stijlPos=vroeg.html.indexOf("<style>");
  assert(vroegPos>=0&&vroegPos<stijlPos,"placeholder bewaart de pre-paintpositie vóór CSS");
  const vroegMin=await minifyRuntime([vroeg.earlyScripts[0].body],null);
  assert(vroegMin.code.includes("weerbriefing.thema"),"minificatie verwijderde de vroege themalogica");

  const publicDir=path.resolve(__dirname,"..","public");
  assert.equal(isWeatherAppBestand(path.join(publicDir,"index.html")),true,"homepage moet weather-app ownership hebben");
  assert.equal(isWeatherAppBestand(path.join(publicDir,"weer","amsterdam","index.html")),true,"plaatsroute moet weather-app ownership hebben");
  assert.equal(isWeatherAppBestand(path.join(publicDir,"privacy.html")),false,"privacy-runtime mag nooit als weather-app worden geclassificeerd");
  assert.equal(isWeatherAppBestand(path.join(publicDir,"weer","index.html")),false,"statische weerhub mag nooit als weather-app worden geclassificeerd");

  console.log("Platform-output-cleanup: ARIA/font/CSS/JS-hardening, echt pre-paintscriptbehoud, routebootstrap-migratie en app-versus-page ownership geslaagd.");
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
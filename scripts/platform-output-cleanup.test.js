"use strict";

const assert=require("assert");
const vm=require("vm");
const {
  hardenRuntime,cssMinify,verzamelRuntime,minifyRuntime,hash12
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
  assert(hard.includes('rel="preload" href="/instrument-sans-latin-400-normal.woff2"'),"Instrument Sans preload ontbreekt");
  assert(hard.includes('rel="preload" href="/bodoni-moda-latin-400-normal.woff2"'),"Bodoni preload ontbreekt");
  assert(hard.includes('groep.setAttribute("aria-hidden","true")'),"regenperiodegroep is niet decoratief voor accessibility tree");
  assert(!hard.includes('horizontaal.setAttribute("aria-label"'),"ongeldige aria-label op SVG-line bleef staan");
  assert(hard.includes("Neerslagperioden: "),"exacte regenperiodesamenvatting verhuist niet naar het SVG-label");

  const css=cssMinify('<style>body { color: red; margin: 0px; }</style>');
  assert(css.length<'<style>body { color: red; margin: 0px; }</style>'.length,"CSS werd niet kleiner");
  assert(css.includes("body{color:red;margin:0}"),"CSS-minificatie wijzigde onverwacht");

  const routeHtml='<script type="application/ld+json">{"x":1}</script><!-- WEATHER NOW PLAATSROUTE --><script>window.__WEATHERNOW_ROUTE_LOCATION__=Object.freeze({"slug":"almere","lat":52.35,"lon":5.26});</script><script>function publiek(){return 2 + 2;} globalThis.__deliveryTest=publiek();</script>';
  const verzameld=verzamelRuntime(routeHtml);
  assert.equal(verzameld.scripts.length,1,"routebootstrap mag geen executable inline runtime blijven");
  assert.equal(verzameld.routeData.slug,"almere","routebootstrap-data ging verloren");
  assert(verzameld.html.includes('type="application/json" id="weather-now-route"'),"routebootstrap is niet naar data-script gemigreerd");
  assert(verzameld.html.includes('type="application/ld+json"'),"JSON-LD mag niet worden geëxternaliseerd");

  const min=await minifyRuntime(verzameld.scripts,verzameld.routeData);
  assert(min.code.length<min.bron.length,"Terser maakte de test-runtime niet kleiner");
  new vm.Script(min.code);
  assert(/^[0-9a-f]{12}$/.test(hash12(min.code)),"contenthash heeft niet de afgesproken vorm");

  console.log("Platform-output-cleanup: ARIA-hardening, fontpreload, CSS/JS-minificatie en routebootstrap-migratie geslaagd.");
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

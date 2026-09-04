"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");

const ROOT=path.join(__dirname,"..");
const PUBLIC=path.join(ROOT,"public");
const indexPad=path.join(PUBLIC,"index.html");
assert.ok(fs.existsSync(indexPad),"public/index.html ontbreekt voor PageSpeed-eindcontract");
const html=fs.readFileSync(indexPad,"utf8");

const eersteStijl=html.search(/<style\b/i);
assert.ok(eersteStijl>0,"homepage bevat geen controleerbaar stijlblok");

const fonts=[
  "/instrument-sans-latin-400-normal.woff2",
  "/instrument-sans-latin-500-normal.woff2",
  "/bodoni-moda-latin-400-normal.woff2"
];
for(const href of fonts){
  const patroon=new RegExp('rel="preload" href="'+href.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+'"','g');
  const matches=html.match(patroon)||[];
  assert.equal(matches.length,1,"fontpreload moet exact één keer bestaan: "+href);
  assert.ok(html.indexOf('rel="preload" href="'+href+'"')<eersteStijl,"fontpreload moet vóór eerste CSS starten: "+href);
}

const earlyScripts=html.match(/<script[^>]+src="\/early-[0-9a-f]{12}\.min\.js"[^>]*><\/script>/g)||[];
assert.equal(earlyScripts.length,0,"homepage mag geen synchrone early-bundle meer hebben");
const bootstrapScripts=[...html.matchAll(/<script[^>]+src="\/(bootstrap-[0-9a-f]{12}\.min\.js)"[^>]*\bdefer\b[^>]*\bdata-weather-bootstrap\b[^>]*><\/script>/g)];
assert.equal(bootstrapScripts.length,1,"homepage hoort exact één deferred recovery-bootstrap te laden");
const bootstrapTag=bootstrapScripts[0][0];
assert.ok(!/\basync\b/i.test(bootstrapTag),"recovery-bootstrap mag zijn volgorde met de app niet via async verliezen");
const bootstrapPad=path.join(PUBLIC,bootstrapScripts[0][1]);
assert.ok(fs.existsSync(bootstrapPad),"deferred recovery-bootstrap ontbreekt op schijf");
const appScripts=[...html.matchAll(/<script[^>]+src="\/(app-[0-9a-f]{12}\.min\.js)"[^>]*\bdefer\b[^>]*><\/script>/g)];
assert.equal(appScripts.length,1,"homepage hoort exact één deferred app-bundle te laden");
assert.ok(bootstrapScripts[0].index<appScripts[0].index,"recovery-bootstrap moet in documentvolgorde vóór de deferred app staan");
const appPad=path.join(PUBLIC,appScripts[0][1]);
assert.ok(fs.existsSync(appPad),"deferred homepagebundle ontbreekt op schijf");
const app=fs.readFileSync(appPad,"utf8");
assert.ok(app.includes("data:image/svg+xml"),"dynamische tabicoonruntime is niet naar de deferred app-bundle verhuisd");

const forecastPreconnect='<link rel="preconnect" href="https://api.open-meteo.com" crossorigin>';
assert.equal(html.split(forecastPreconnect).length-1,1,"forecast-origin houdt exact één CORS-passende preconnect");
assert.ok(html.indexOf(forecastPreconnect)<eersteStijl,"forecast-preconnect moet zonder parserblokkade vóór de eerste CSS bereikbaar zijn");
assert.ok(!html.includes('rel="preconnect" href="https://air-quality-api.open-meteo.com"'),"niet-kritieke luchtkwaliteit krijgt geen concurrerende preconnect");

assert.equal((html.match(/rel="icon"/g)||[]).length,1,"homepage houdt exact één crawlbare faviconrelatie");
assert.ok(html.includes('<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png">'),"crawlbare PNG-favicon blijft in de HTML staan");

console.log("PageSpeed-eindcontract groen: geen synchrone homepage early-bundle; recovery-bootstrap en app zijn deferred en geordend; kritieke fonts/preconnect blijven vroeg en faviconruntime blijft in de app.");
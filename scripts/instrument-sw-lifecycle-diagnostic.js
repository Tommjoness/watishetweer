"use strict";

const fs=require("fs");
const path=require("path");

const testPad=path.join(__dirname,"..","browser-serviceworker-upgrade.test.js");
let bron=fs.readFileSync(testPad,"utf8");
const oud=`    const installInfo=await page.evaluate(async naam=>{\n      const c=await caches.open(naam),requests=await c.keys(),r=await c.match(new URL("/index.html",location.href).href);\n      const tekst=r?await r.text():"";\n      const m=/name="sw-e2e-build" content="([^\\"]+)"/.exec(tekst);\n      return {urls:requests.map(x=>x.url),marker:m?m[1]:null,heeftIndex:!!r,lengte:tekst.length};\n    },cacheNieuw);`;
const nieuw=`    const installInfo=await page.evaluate(async naam=>{\n      const beforeKeys=await caches.keys();\n      const registratie=await navigator.serviceWorker.getRegistration();\n      const basis={\n        beforeKeys,\n        active:registratie&&registratie.active?{state:registratie.active.state,scriptURL:registratie.active.scriptURL}:null,\n        waiting:registratie&&registratie.waiting?{state:registratie.waiting.state,scriptURL:registratie.waiting.scriptURL}:null,\n        installing:registratie&&registratie.installing?{state:registratie.installing.state,scriptURL:registratie.installing.scriptURL}:null,\n        controller:navigator.serviceWorker.controller?{state:navigator.serviceWorker.controller.state,scriptURL:navigator.serviceWorker.controller.scriptURL}:null\n      };\n      if(!beforeKeys.includes(naam))return {...basis,cacheBestondVoorOpen:false,urls:[],marker:null,heeftIndex:false,lengte:0,afterKeys:beforeKeys};\n      const c=await caches.open(naam),requests=await c.keys(),r=await c.match(new URL("/index.html",location.href).href);\n      const tekst=r?await r.text():"";\n      const m=/name="sw-e2e-build" content="([^\\"]+)"/.exec(tekst);\n      const afterKeys=await caches.keys();\n      return {...basis,cacheBestondVoorOpen:true,urls:requests.map(x=>x.url),marker:m?m[1]:null,heeftIndex:!!r,lengte:tekst.length,afterKeys};\n    },cacheNieuw);`;
if(!bron.includes(oud))throw new Error("SW-diagnostiekanker ontbreekt; productie-test is veranderd.");
bron=bron.replace(oud,nieuw);
fs.writeFileSync(testPad,bron,"utf8");
console.log("SW lifecycle-diagnostiek geïnstrumenteerd zonder productbestanden te wijzigen.");

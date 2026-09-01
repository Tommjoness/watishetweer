"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");

const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const begin=html.indexOf("const WEATHERNOW_VERVERS_INTERVAL=");
const end=html.indexOf('document.addEventListener("visibilitychange"',begin);
assert(begin>=0&&end>begin,"centrale bronververser ontbreekt uit index.html");
const runtime=html.slice(begin,end);

assert(runtime.includes("tick:60*1000"),"centrale controle moet iedere minuut lopen");
assert(runtime.includes("forecast:15*60*1000"),"hoofdforecast moet per vijftien minuten verversen");
assert(runtime.includes("waarschuwingen:5*60*1000"),"waarschuwingen moeten per vijf minuten verversen");
assert(runtime.includes("lucht:60*60*1000"),"luchtkwaliteit/pollen moeten een uurinterval hebben");
assert(!html.includes('Date.now()-S.op>600000'),"oude vaste tienminutenrefresh mag niet terugkeren");
assert(html.includes("Date.now()-Number(S.luchtOp)>=60*60*1000"),"luchtrequest moet werkelijk op de uurleeftijd worden begrensd");
assert(html.includes("Verversen is niet gelukt. Je ziet de laatst opgehaalde gegevens van "),"providerfout moet als mislukte verversing worden benoemd");
assert(html.includes("Geen internetverbinding. Je ziet de laatst opgehaalde gegevens van "),"alleen bewezen browser-offline krijgt een internetmelding");

let nu=1_800_000,loads=0,warnings=0,stempels=0,timerMs=null;
const context=vm.createContext({
  Date:{now:()=>nu},
  Object,
  Number,
  Promise,
  document:{visibilityState:"visible"},
  S:{lat:52.37,lon:4.90,label:"Amsterdam",op:nu,luchtOp:nu,waarschuwingenOp:nu,verversMislukt:false},
  stempel:()=>{stempels++;},
  load:async()=>{loads++;},
  waarschuwingen:()=>{warnings++;},
  setInterval:(_fn,ms)=>{timerMs=ms;return 1;}
});
vm.runInContext(runtime,context,{filename:"source-refresh-runtime.js"});
const tick=()=>vm.runInContext("weatherNowVerversTick()",context);

(async()=>{
  assert.equal(timerMs,60*1000,"scheduler moet exact iedere minuut worden aangeroepen");

  context.S.waarschuwingenOp=nu-5*60*1000;
  await tick();
  assert.equal(warnings,1,"verschuldigde waarschuwingen moeten zonder forecastrequest verversen");
  assert.equal(loads,0,"verse forecast mag niet onnodig worden opgehaald");

  context.S.op=nu-15*60*1000;
  await tick();
  assert.equal(loads,1,"forecast moet na vijftien minuten verversen");

  context.S.op=nu;context.S.verversMislukt=true;
  await tick();
  assert.equal(loads,2,"een mislukte verversing moet bij de volgende minuutcontrole opnieuw worden geprobeerd");

  context.document.visibilityState="hidden";context.S.verversMislukt=true;
  await tick();
  assert.equal(loads,2,"verborgen tabbladen mogen geen achtergrondforecast blijven downloaden");
  assert(stempels>=3,"zichtbare minuutticks moeten ook de ouderdomstekst bijwerken");

  console.log("Bronverversbeleid groen: minuutcontrole, forecast 15 min, waarschuwingen 5 min, lucht/pollen 60 min, retry en verborgen-tabstop.");
})().catch(err=>{console.error(err);process.exit(1);});

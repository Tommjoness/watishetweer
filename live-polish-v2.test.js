"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path");
const {klokTekstMetSeconden,tooltipWaardeKort,temperatuurLabelsBotsen}=require("./live-polish-v2.js");
let n=0;const test=(naam,fn)=>{try{fn();n++;console.log("OK  "+naam);}catch(e){console.error("FOUT "+naam+"\n  "+e.message);process.exitCode=1;}};

test("live klok toont uren minuten en seconden",()=>{
  assert.equal(klokTekstMetSeconden({hour:13,minute:4,second:9}),"13:04:09");
  assert.equal(klokTekstMetSeconden({hour:0,minute:0,second:0}),"00:00:00");
});

test("tooltip gebruikt compact droog in plaats van overlappende lange tekst",()=>{
  assert.equal(tooltipWaardeKort("geen neerslag verwacht"),"droog");
  assert.equal(tooltipWaardeKort("Geen neerslag verwacht."),"droog");
  assert.equal(tooltipWaardeKort("27%"),"27%");
});

test("gelijke temperatuurlabels vlak naast elkaar worden als visueel dubbel gezien",()=>{
  assert(temperatuurLabelsBotsen({text:"16°",x:100,y:80},{text:"16°",x:136,y:82},45));
  assert(!temperatuurLabelsBotsen({text:"16°",x:100,y:80},{text:"17°",x:136,y:82},45));
  assert(!temperatuurLabelsBotsen({text:"16°",x:100,y:80},{text:"16°",x:170,y:80},45));
});

test("desktopgrid reset oude twee- en vierkolomsselectors expliciet",()=>{
  const css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8");
  assert(css.includes(".dashrow-hero .stat:nth-child(n)"));
  assert(css.includes("grid-auto-rows:1fr"));
  assert(css.includes("#nchint{display:none}"));
  assert(css.includes("grid-template-columns:104px 52px minmax(80px,1fr) 116px 218px"));
});

test("tablet en desktop houden compacte weercontext vast tijdens scrollen",()=>{
  const css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8");
  assert(css.includes("@media(min-width:901px)"));
  assert(css.includes("#minibar.aan{display:flex}"));
  assert(css.includes("position:fixed"));
  assert(css.includes("transform:translateX(-50%)"));
  assert(css.includes("width:min(calc(100% - 44px),1440px)"));
});

test("actuele weerblok staat op desktop verticaal in balans met meetraster",()=>{
  const css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8");
  assert(css.includes(".dashrow-hero > .hero"));
  assert(css.includes("margin-top:0"));
  assert(css.includes("align-self:center"));
});

test("productiebundel bevat interactiepolish, desktopbalk en secondentimer",()=>{
  const html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
  assert(html.includes("LIVE INTERACTIEPOLISH"));
  assert(html.includes("WeatherNowPolishV2"));
  assert(html.includes("setInterval(liveKlokTik,1000)"));
  assert(html.includes("tooltipWaardeKort"));
  assert(html.includes("#minibar.aan{display:flex}"));
  assert(html.includes('bar.classList.toggle("aan",!e.isIntersecting&&e.boundingClientRect.top<0)'));
});

if(process.exitCode) console.error("\nLive-polish v2: minstens één regressie mislukt.");
else console.log("\nLive-polish v2: "+n+" regressies geslaagd.");

"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path");
const {
  tooltipWaardeKort,temperatuurLabelsBotsen,temperatuurPuntIndex,nuLabelPositie,nuLabelConcurreert,temperatuurOntdubbelToegestaan,
  dauwpuntCelsius,luchtvochtigheidDuiding,etmaalExtraTemperaturenWeg,grafiekPuntBeschrijving,
  tooltipSchaalFactor,tooltipDoosPlaatsing,TOOLTIP_MIN_PX
}=require("./live-polish-v2.js");
let n=0;const test=(naam,fn)=>{try{fn();n++;console.log("OK  "+naam);}catch(e){console.error("FOUT "+naam+"\n  "+e.message);process.exitCode=1;}};

test("tooltip houdt links altijd hetzelfde label voor neerslagkans",()=>{
  assert.equal(tooltipWaardeKort("geen neerslag verwacht"),"droog");
  assert.equal(tooltipWaardeKort("Geen neerslag verwacht."),"droog");
  assert.equal(tooltipWaardeKort("kans 15:00–16:00"),"neerslagkans");
  assert.equal(tooltipWaardeKort("kans 18:00-19:00"),"neerslagkans");
  assert.equal(tooltipWaardeKort("kans 15–16u"),"neerslagkans");
  assert.equal(tooltipWaardeKort("27%"),"27%");
});

test("toetsenbordpunt krijgt een compacte volledige gesproken waarde",()=>{
  const G={n:2,TI:["2026-09-21T10:00","2026-09-21T11:00"],T:[15.7,17.6],P:[0,25]};
  assert.equal(grafiekPuntBeschrijving(G,0),"10:00, 16 graden, 0 procent neerslagkans");
  assert.equal(grafiekPuntBeschrijving(G,1),"11:00, 18 graden, 25 procent neerslagkans");
  assert.equal(grafiekPuntBeschrijving(G,8),"");
  const js=fs.readFileSync(path.join(__dirname,"live-polish-v2.js"),"utf8");
  assert(js.includes('hit.setAttribute("role","slider")'));
  assert(js.includes('hit.setAttribute("aria-valuenow","1")'));
  assert(js.includes('ev.key==="ArrowRight"'));
  assert(js.includes('ev.key==="Escape"'));
});

test("tooltip wordt zo opgeschaald dat de kleinste tekst minimaal 12 px effectief is",()=>{
  assert.equal(TOOLTIP_MIN_PX,12);
  /* Gemeten schalen van de grafiek: 1,09 (430 px), 1,0 (480 tot 1440 px), 1,047 (1920 px). */
  assert.equal(tooltipSchaalFactor(11,1,12),1.091);
  assert.equal(tooltipSchaalFactor(11,1.087,12),1.004);
  assert.equal(tooltipSchaalFactor(11,1.047,12),1.042);
  assert.equal(tooltipSchaalFactor(11,1.092,12),1);
  assert.equal(tooltipSchaalFactor(14,1,12),1);
  for(const [f,p] of [[11,1],[11,1.001],[11,0.97],[10.5,1.03],[11,1.087]]){
    const k=tooltipSchaalFactor(f,p,12);assert(f*p*k>=12-1e-9,"kleinste tekst blijft onder 12 px bij "+f+"x"+p);
  }
  assert.equal(tooltipSchaalFactor(null,1,12),1);assert.equal(tooltipSchaalFactor(11,0,12),1);assert.equal(tooltipSchaalFactor(11,"x",12),1);
});

test("opgeschaalde tooltip blijft aan dezelfde kant van het punt en binnen de tekening",()=>{
  const veld={W:736,H:296,pr:20,pt:36,ih:220};
  /* Doos rechts van het punt: linkerrand blijft staan, breedte groeit. */
  let p=tooltipDoosPlaatsing({x:210,y:30,w:200,h:130},{x:200},veld,1.1);
  assert.equal(p.nx,210);assert.equal(Math.round(p.nw),220);assert.equal(p.ny,30);
  /* Past rechts niet meer door de groei: doos klapt naar links van het punt. */
  p=tooltipDoosPlaatsing({x:500,y:30,w:200,h:130},{x:490},veld,1.1);
  assert(p.nx+p.nw<=490-10+1e-9,"doos hoort links van het punt te staan");assert(p.nx>=2);
  /* Doos stond links van het punt: rechterrand blijft staan. */
  p=tooltipDoosPlaatsing({x:100,y:30,w:200,h:130},{x:320},veld,1.1);
  assert.equal(Math.round(p.nx+p.nw),300);
  /* Onder verankerd (aanraking): onderrand blijft staan; nooit buiten de tekening. */
  p=tooltipDoosPlaatsing({x:10,y:170,w:200,h:120},{x:300},veld,1.1);
  assert(p.ny+p.nh<=veld.H-2+1e-9&&p.ny>=2);assert(Math.abs((p.ny+p.nh)-(170+120))<1e-6||p.ny+p.nh<=veld.H-2);
  p=tooltipDoosPlaatsing({x:2,y:2,w:300,h:290},{x:400},veld,1.3);
  assert(p.nx>=2&&p.nx+p.nw<=veld.W-2+1e-9&&p.ny>=2);
});

test("tooltipstrook: statische markup, CSS vanaf de eerste render en koppeling na alle tooltiplagen",()=>{
  const js=fs.readFileSync(path.join(__dirname,"live-polish-v2.js"),"utf8"),css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8"),html=fs.readFileSync(path.join(__dirname,"index.html"),"utf8");
  assert(html.includes('<div id="tip-strook" class="tip-strook" aria-hidden="true"></div>'));
  assert.equal(html.split('id="tip-strook"').length-1,1);
  assert(css.includes("@media (max-width:429px){")&&css.includes("min-height:140px")&&css.includes(".tip-strook:empty::before"));
  assert(css.includes("Kies een uur in de grafiek om de details te bekijken.")&&css.includes("Select an hour on the chart to see the details."));
  assert(css.includes('html[lang="en"] .tip-strook:empty::before'));
  assert(css.includes("#chart #scrub [data-tip-verberg]{visibility:hidden;pointer-events:none}"));
  assert(js.includes("requestAnimationFrame(synchroniseerTooltipWeergave)")&&js.includes("koppelTooltipWeergave();"));
  assert(!/strook\.innerHTML|innerHTML\s*=/.test(js.slice(js.indexOf("function tooltipTekstLezen"),js.indexOf("function koppelTooltipWeergave"))),"strook mag alleen met textContent worden gevuld");
});

test("verwijderd temperatuurcijfer koppelt aan het juiste zwarte datapunt",()=>{
  const punten=[{i:3,x:100},{i:4,x:140},{i:5,x:180}];
  const temperaturen=[0,0,0,16.2,16.4,17.1];
  assert.equal(temperatuurPuntIndex({text:"16°",x:136},punten,temperaturen,72),4);
  assert.equal(temperatuurPuntIndex({text:"17°",x:178},punten,temperaturen,72),5);
  assert.equal(temperatuurPuntIndex({text:"15°",x:136},punten,temperaturen,72),null);
  assert.equal(temperatuurPuntIndex({text:"16°",x:260},punten,temperaturen,72),null);
});

test("nu-label blijft op mobiel compact bij de rode stip",()=>{
  assert.deepEqual(nuLabelPositie(100,50,200,false),{y:130,onder:true});
  assert.deepEqual(nuLabelPositie(100,50,200,true),{y:121,onder:true});
  assert.deepEqual(nuLabelPositie(195,50,200,true),{y:177,onder:false});
  assert.deepEqual(nuLabelPositie(190,50,200,false),{y:166,onder:false});
  assert.equal(nuLabelPositie(null,50,200,false),null);
});

test("zwart modelcijfer in directe nu-zone concurreert met actuele meting",()=>{
  assert(nuLabelConcurreert({x:100,y:100},{x:150,y:120},36,false));
  assert(nuLabelConcurreert({x:100,y:100},{x:148,y:130},14,true));
  assert(!nuLabelConcurreert({x:100,y:100},{x:180,y:120},36,false));
  assert(!nuLabelConcurreert({x:100,y:100},{x:145,y:170},36,false));
  assert(!nuLabelConcurreert({x:null,y:100},{x:120,y:120},36,false));
});

test("gelijke temperatuurlabels vlak naast elkaar worden als visueel dubbel gezien",()=>{
  assert(temperatuurLabelsBotsen({text:"16°",x:100,y:80},{text:"16°",x:136,y:82},45));
  assert(!temperatuurLabelsBotsen({text:"16°",x:100,y:80},{text:"17°",x:136,y:82},45));
  assert(!temperatuurLabelsBotsen({text:"16°",x:100,y:80},{text:"16°",x:170,y:80},45));
});

test("24-uursgrafiek wordt niet opnieuw uitgedund door late ontdubbeling",()=>{
  assert.equal(temperatuurOntdubbelToegestaan(24),false);
  assert.equal(temperatuurOntdubbelToegestaan("24"),false);
  assert.equal(temperatuurOntdubbelToegestaan(48),true);
  assert.equal(temperatuurOntdubbelToegestaan(168),true);
  assert.equal(temperatuurOntdubbelToegestaan(null),true);
  const js=fs.readFileSync(path.join(__dirname,"live-polish-v2.js"),"utf8");
  assert(js.includes("!temperatuurOntdubbelToegestaan(S.geo&&S.geo.n)"));
});

test("luchtvochtigheid krijgt dauwpunt en praktische duiding",()=>{
  const d=dauwpuntCelsius(18,86);
  assert.ok(d>15.5&&d<15.8,"18 °C / 86% hoort rond 15,6 °C dauwpunt uit te komen");
  assert.equal(luchtvochtigheidDuiding(18,86),"Dauwpunt circa 16\u00a0°C · kan wat klam aanvoelen.");
  assert.equal(luchtvochtigheidDuiding(25,50),"Dauwpunt circa 14\u00a0°C · meestal aangenaam.");
  assert.equal(luchtvochtigheidDuiding(30,80),"Dauwpunt circa 26\u00a0°C · voelt zeer klam aan.");
  assert.equal(luchtvochtigheidDuiding(null,86),"Zeer hoge relatieve luchtvochtigheid.");
  assert.equal(luchtvochtigheidDuiding(18,null),"Luchtvochtigheid niet beschikbaar.");
});

test("desktop 24 uur houdt drie-uursraster maar verwijdert redundante extra extrema",()=>{
  const T=[16,16.1,16.4,17,17.1,17.2,17,16.9,16.8,16.6];
  const weg=etmaalExtraTemperaturenWeg(T,[0,3,4,5,6,9],3);
  assert.deepEqual(weg,[4,5]);
  assert(!weg.includes(0)&&!weg.includes(3)&&!weg.includes(6)&&!weg.includes(9),"vaste rasterpunten mogen nooit verdwijnen");
  const scherp=[16,16,16,16,19,17,16];
  assert.deepEqual(etmaalExtraTemperaturenWeg(scherp,[0,3,4,6],3),[],"duidelijk afwijkend extra extreem blijft zichtbaar");
  const js=fs.readFileSync(path.join(__dirname,"live-polish-v2.js"),"utf8");
  assert(js.includes("ruimEtmaalExtraTemperaturenOp"));
  assert(js.includes("S.geo.M||!Number.isFinite(S.geo.n)||S.geo.n>24"));
});

test("desktopgrid reset oude twee- en vierkolomsselectors expliciet",()=>{
  const css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8");
  assert(css.includes(".dashrow-hero .stat:nth-child(n)"));
  assert(css.includes("grid-auto-rows:1fr"));
  assert(css.includes("#nchint{display:none"));
  assert(css.includes("grid-template-columns:96px 58px minmax(150px,1fr) 96px minmax(260px,290px)"));
  assert(css.includes("white-space:normal"));
  assert(css.includes("overflow-wrap:break-word"));
});

test("Zeven dagen en Nachtzicht benutten op desktop de volledige inhoudsbreedte",()=>{
  const css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8");
  assert(css.includes(".dashrow-days > .dashcol{width:100%;max-width:none;min-width:0}"));
  assert(!css.includes(".dashrow-days > .dashcol{max-width:1000px}"));
});

test("Nachtzicht-bewolking staat exact onder de gecentreerde kolomkop",()=>{
  const css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8");
  assert(css.includes(".row.night > .nmeta:not(.wide),\n  .row.night.kop > .nmeta:not(.wide){text-align:center}"));
  assert(css.includes(".row.night > .nmeta:not(.wide) .perc{min-width:0;text-align:center}"));
  assert(!css.includes(".row.night > .nmeta:not(.wide){text-align:right}"));
});

test("mobiele plaatsklok staat op een eigen onafbreekbare regel",()=>{
  const css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8");
  assert(css.includes("#plaatstijd{"));
  assert(css.includes("display:block"));
  assert(css.includes("white-space:nowrap"));
  assert(css.includes("font-size:.34em"));
});

test("mobiele grafiekkop benut volle breedte zonder lege rechterkolom",()=>{
  const css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8");
  assert(css.includes(".chartkop{"));
  assert(css.includes("grid-template-columns:repeat(2,minmax(0,1fr))"));
  assert(css.includes(".chartkop #suntimes span:last-child{grid-column:1 / -1}"));
  assert(css.includes("margin-top:18px"));
});

test("UV-piek gebruikt op mobiel de brede rij horizontaal",()=>{
  const css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8");
  assert(css.includes(".dashrow-hero .stat.breed{"));
  assert(css.includes("grid-template-columns:auto auto minmax(0,1fr)"));
  assert(css.includes(".dashrow-hero .stat.breed .ssub{grid-column:3"));
});

test("zoninformatie krijgt in de eindlaag concrete daggebonden regels",()=>{
  const css=fs.readFileSync(path.join(__dirname,"senior-semantiek-20260810.css"),"utf8");
  assert(css.includes("#suntimes.senior-zoninfo"));
  assert(css.includes(".zonregel"));
  assert(css.includes("grid-template-columns:minmax(0,1fr)"));
  assert(css.includes("text-align:right"));
});

test("tablet en desktop houden compacte weercontext vast tijdens scrollen",()=>{
  const css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8");
  assert(css.includes("@media(min-width:901px)"));
  assert(css.includes("#minibar.aan{display:flex}"));
  assert(css.includes("position:fixed"));
  assert(css.includes("transform:translateX(-50%)"));
  assert(css.includes("width:min(calc(100% - 44px),1440px)"));
  assert(css.includes("#minibar.aan{overflow:visible}"),"desktop fixed-minibalk laat de zachte onderovergang niet vrij");
  assert(css.includes("#minibar.aan::after"),"desktop fixed-minibalk mist de zachte onderovergang");
  assert(css.includes("linear-gradient(to bottom,var(--sheet),transparent)"),"desktop headerfade is niet thema-eigen");
});

test("mobiele weercontext verbergt zich neerwaarts zonder sticky-regressie",()=>{
  const css=fs.readFileSync(path.join(__dirname,"senior-semantiek-20260810.css"),"utf8");
  assert(css.includes("#minibar.senior-verstopt"));
  assert(css.includes("translateY(calc(-100% - 2px))"));
  assert(css.includes("pointer-events:none"));
});

test("actuele weerblok staat op desktop verticaal in balans met meetraster",()=>{
  const css=fs.readFileSync(path.join(__dirname,"live-polish.css"),"utf8");
  assert(css.includes(".dashrow-hero > .hero"));
  assert(css.includes("margin-top:0"));
  assert(css.includes("align-self:center"));
});

test("productiebundel bevat interactiepolish zonder aparte secondenklok",()=>{
  const html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
  assert(html.includes("LIVE INTERACTIEPOLISH"));
  assert(html.includes("WeatherNowPolishV2"));
  assert(!html.includes("liveKlokTik"));
  assert(!html.includes("klokTekstMetSeconden"));
  assert(html.includes("klokMinuutTimer=setInterval(klokBijwerken,60000)"));
  assert(html.includes("tooltipWaardeKort"));
  assert(html.includes("neerslagkans"));
  assert(html.includes("temperatuurPuntIndex"));
  assert(html.includes("verwijderTemperatuurMarkering"));
  assert(html.includes("temperatuurOntdubbelToegestaan"));
  assert(html.includes("dauwpuntCelsius"));
  assert(html.includes("luchtvochtigheidDuiding"));
  assert(html.includes("etmaalExtraTemperaturenWeg"));
  assert(html.includes("ruimEtmaalExtraTemperaturenOp"));
  assert(html.includes("nuLabelPositie"));
  assert(html.includes("nuLabelConcurreert"));
  assert(html.includes("positioneerNuLabel"));
  assert(html.includes('<div class="chartkop">'));
  assert(html.includes('<h2><span id="chartlab">Het etmaal</span></h2>'));
  assert(html.includes("#minibar.aan{display:flex}"));
  assert(html.includes(".row.night > .nmeta:not(.wide) .perc{min-width:0;text-align:center}"));
  assert(html.includes("const aan=Number.isFinite(r.bottom)&&r.bottom<=0"));
  assert(html.includes('bar.classList.toggle("aan",aan)'));
  assert(html.includes('window.addEventListener("scroll",plan,{passive:true})'));
  assert(html.includes('new IntersectionObserver(plan,{threshold:0}).observe(hero)'));
  assert(html.includes("timer=setTimeout(zet,16)"));
  assert(html.includes('window.matchMedia("(max-width:900px)")'));
  assert(html.includes('bar.classList.toggle("senior-verstopt",verschil>0)'));
  assert(html.includes("SENIOR SEMANTIEK 20260810"));
  assert(html.includes("senior-zoninfo"));
});

if(process.exitCode) console.error("\nLive-polish v2: minstens één regressie mislukt.");
else console.log("\nLive-polish v2: "+n+" regressies geslaagd.");

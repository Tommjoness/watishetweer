"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {LOCATIES}=require("./seo-locations.config.js");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="weather-now-desktop-refinement-20260829";
const RUNTIME_MARKER="/* ===== FINAL CONSUMER POLISH 20260831 ===== */";
const START_MARKER="/* ---------- start ---------- */";
const NAV_MARKER="<!-- WEATHER NOW INDEXEERBARE PLAATSEN -->";
const RUNTIME=fs.readFileSync(path.join(__dirname,"final-consumer-polish-20260831-runtime.js"),"utf8");

const MOTREGEN_BRON='55:["Zware motregen","regen"],56:["Aanvriezende motregen","ijzel"],57:["Zware aanvriezende motregen","ijzel"],';
const MOTREGEN_PRODUCTIE='55:["Motregen","regen"],56:["Aanvriezende motregen","ijzel"],57:["Aanvriezende motregen","ijzel"],';

const STIJL=`<style id="${MARKER}">
@media(min-width:701px){
  .seo-plaatsnav{
    box-sizing:border-box;
    margin:0 auto;
    padding:20px 48px 24px;
    border:1px solid var(--rule);
    border-top:0;
    background:var(--sheet)
  }
}
@media(min-width:1000px){
  #nights .row.night{
    grid-template-columns:104px 52px minmax(180px,1fr) 104px minmax(220px,280px)
  }
}
@media(min-width:1100px){
  body{
    padding-left:0!important;
    padding-right:0!important
  }
  .sheet,.seo-plaatsnav{
    box-sizing:border-box;
    width:100%!important;
    max-width:none!important;
    margin-left:0!important;
    margin-right:0!important
  }
  .dashrow-chart,.dashrow-days{
    box-sizing:border-box!important;
    display:block!important;
    width:100%!important;
    max-width:none!important;
    min-width:0!important;
    margin-left:0!important;
    margin-right:0!important
  }
  .dashrow-chart>.dashcol,.dashrow-days>.dashcol,#days,#nights{
    box-sizing:border-box!important;
    display:block;
    width:100%!important;
    max-width:none!important;
    min-width:0!important;
    margin-left:0!important;
    margin-right:0!important
  }
  #minibar{
    left:0!important;
    right:0!important;
    width:auto!important;
    max-width:none!important;
    margin-left:0!important;
    margin-right:0!important;
    transform:none!important
  }

  .dashrow-hero>.hero{
    align-self:start!important;
    margin-top:0!important;
    min-height:0!important;
    height:auto!important
  }

  .dashrow-chart .dagmod{padding-top:10px}
  .dashrow-chart #charthint{margin-bottom:4px}
  #chartdata{margin-top:8px}

  .data-uitleg p{max-width:min(110ch,100%)}
  #nctext{max-width:min(110ch,100%)}

  #days .row.day{
    grid-template-columns:100px 26px minmax(260px,1.4fr) minmax(90px,.45fr) 56px minmax(120px,.55fr) 52px 72px;
    gap:16px
  }

  #nights .row.night{
    grid-template-columns:104px 64px minmax(280px,1fr) 110px minmax(300px,.72fr);
    gap:18px
  }
  #nights .night .nmeta.wide{
    box-sizing:border-box;
    width:auto!important;
    max-width:none!important;
    min-width:0!important;
    justify-self:stretch!important;
    line-height:1.45
  }

  footer{
    display:grid;
    grid-template-columns:minmax(0,1fr) max-content max-content;
    gap:8px 32px;
    align-items:start;
    border-top:1px solid var(--rule-soft);
    padding-top:16px
  }
  footer .bron{min-width:0}
  footer details{justify-self:end}
}
@media(min-width:1500px){
  #days .row.day{gap:18px}
  #nights .row.night{gap:20px}
}
</style>`;

function tel(tekst,zoek){return String(tekst).split(zoek).length-1;}

function pasDesktopRefinementToe(html,label="artifact"){
  let bron=String(html||"");
  const heeftStijl=bron.includes(`id="${MARKER}"`),heeftRuntime=bron.includes(RUNTIME_MARKER);
  if(heeftStijl&&heeftRuntime)return bron;
  if(heeftStijl!==heeftRuntime)throw new Error(`${label}: finale verfijning is slechts gedeeltelijk toegepast.`);
  if(tel(bron,NAV_MARKER)!==1)throw new Error(`${label}: indexeerbare plaatsnavigatie ontbreekt of is dubbel.`);
  if(tel(bron,MOTREGEN_BRON)!==1)throw new Error(`${label}: verwachte motregencodetabel ontbreekt of is dubbel.`);
  if(tel(bron,"</head>")!==1)throw new Error(`${label}: verwacht exact één head-einde.`);
  if(tel(bron,START_MARKER)!==1)throw new Error(`${label}: startmarker ontbreekt of is dubbel.`);

  new vm.Script(RUNTIME,{filename:"final-consumer-polish-20260831-runtime.js"});

  const linksVoor=(bron.match(/<a\s+[^>]*href=/g)||[]).length;
  bron=bron.replace(MOTREGEN_BRON,MOTREGEN_PRODUCTIE);
  bron=bron.replace("</head>",STIJL+"\n</head>");
  bron=bron.replace(START_MARKER,`${RUNTIME_MARKER}\n${RUNTIME}\n/* ===== EINDE FINAL CONSUMER POLISH 20260831 ===== */\n\n${START_MARKER}`);
  const linksNa=(bron.match(/<a\s+[^>]*href=/g)||[]).length;

  if(linksNa!==linksVoor)throw new Error(`${label}: plaatsverfijning wijzigde onverwacht het aantal links (${linksVoor} -> ${linksNa}).`);
  if(tel(bron,MOTREGEN_PRODUCTIE)!==1||bron.includes(MOTREGEN_BRON))throw new Error(`${label}: motregencopy is niet eenduidig genormaliseerd.`);
  if(tel(bron,`id="${MARKER}"`)!==1)throw new Error(`${label}: desktopverfijningsstijl ontbreekt of is dubbel.`);
  if(tel(bron,RUNTIME_MARKER)!==1)throw new Error(`${label}: finale consumentencorrectie ontbreekt of is dubbel.`);
  for(const invariant of ["Tijd tot zonsopkomst","Tijd tot zonsondergang","Zeer benauwde lucht.","Temp.bereik","desktopTypography"]){
    if(!bron.includes(invariant))throw new Error(`${label}: finale consumenteninvariant ontbreekt: ${invariant}`);
  }
  return bron;
}

function main(){
  const doelen=[
    {pad:path.join(OUT,"index.html"),label:"homepage"},
    ...LOCATIES.map(loc=>({pad:path.join(OUT,"weer",loc.slug,"index.html"),label:loc.slug}))
  ];
  for(const doel of doelen){
    if(!fs.existsSync(doel.pad))throw new Error(`${doel.label}: HTML-artifact ontbreekt vóór desktopverfijning.`);
    const bron=fs.readFileSync(doel.pad,"utf8");
    fs.writeFileSync(doel.pad,pasDesktopRefinementToe(bron,doel.label),"utf8");
  }
  const versie=vernieuwServiceworkerCache(OUT,"desktop-refinement-20260831");
  console.log(`Finale productverfijning toegepast op ${doelen.length} weerpagina's: volgende lokale zonnegebeurtenis, neutrale vochtigheidscopy, compactere grafiektypografie, uitgebalanceerde week/Nachtzicht-layout, ruimere broncopy en desktopfooter; cache ${versie}.`);
}

if(require.main===module)main();
module.exports={MARKER,RUNTIME_MARKER,START_MARKER,NAV_MARKER,MOTREGEN_BRON,MOTREGEN_PRODUCTIE,STIJL,RUNTIME,pasDesktopRefinementToe};

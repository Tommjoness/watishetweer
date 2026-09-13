"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-ui-ux-audit-polish-20260913";
const OWNER_ID="wiw-live-screenshot-polish-20260912";

/* Deze laatste presentatielaag draait na delivery-cleanup. De selectors raken
   alleen leesbaarheid en interactie-affordance; data, grafiekgeometrie, runtime,
   providers en requestgedrag blijven eigendom van hun bestaande lagen. */
const CSS=`
.mobile-section-nav{display:none}
.results .zoekresultaat-naam{display:block;color:var(--ink)}
.results .zoekresultaat-detail{display:block;margin-top:1px;color:var(--ink-45);font-size:12.5px;line-height:1.35}
button:focus-visible,input:focus-visible,a:focus-visible,[role="button"]:focus-visible,summary:focus-visible{outline:2px solid var(--ink)!important;outline-offset:2px!important}
#thema{opacity:1!important;color:var(--ink-70)!important}
@media(min-width:901px){
  .chip.add{border-style:solid!important;background:var(--sheet);color:var(--ink-70)}
  #days .row.day:not(.kop){padding-right:24px!important}
  #days .row.day:not(.kop)::after{content:"›";position:absolute;right:7px;top:50%;transform:translateY(-52%);color:var(--ink-25);font-family:var(--sans);font-size:20px;line-height:1;transition:color .15s ease,transform .15s ease}
  #days .row.day:not(.kop):hover::after,#days .row.day:not(.kop):focus-visible::after{color:var(--ink);transform:translate(2px,-52%)}
}
@media(max-width:900px){
  .mobile-section-nav{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:18px 0 4px;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
  .mobile-section-nav a{display:flex;align-items:center;justify-content:center;min-width:0;min-height:44px;padding:0 5px;color:var(--ink-70);font-family:var(--sans);font-size:12.5px;font-weight:500;line-height:1.2;text-decoration:none}
  .mobile-section-nav a+a{border-left:1px solid var(--rule)}
  .mobile-section-nav a:hover,.mobile-section-nav a:focus-visible{color:var(--ink);background:var(--paper)}
  #chart,#days,#nights,#aq{scroll-margin-top:68px}
  .row.kop>*{font-size:11px!important;letter-spacing:.07em!important}
  .wiw-hour-table{font-size:12.5px!important}
  .wiw-hour-table thead th{font-size:11px!important;letter-spacing:.06em!important}
  .wiw-hour-secondary{font-size:11.5px!important;line-height:1.2!important}
  .wiw-hour-date{font-size:11px!important}
  .hint,.data-uitleg{font-size:13px!important;line-height:1.45!important}
  #nights .nacht-meer{font-size:12px!important}
}
@media(max-width:370px){
  .mobile-section-nav{grid-template-columns:repeat(2,minmax(0,1fr))}
  .mobile-section-nav a:nth-child(3),.mobile-section-nav a:nth-child(4){border-top:1px solid var(--rule)}
  .mobile-section-nav a:nth-child(3){border-left:0}
}
`;

function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    let html=fs.readFileSync(p,"utf8");
    if(!html.includes(`id="${OWNER_ID}"`))continue;
    const rel=path.relative(OUT,p);
    if(html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": UI/UX-auditpolish staat al in artifact.");
    for(const hook of ['class="mobile-section-nav"','id="thema"','id="days"','id="aq"']){
      if(!html.includes(hook))throw new Error(rel+": verwachte UI-hook ontbreekt: "+hook);
    }
    if(!html.includes("</head>"))throw new Error(rel+": headafsluiting ontbreekt.");
    html=html.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
    fs.writeFileSync(p,html,"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door UI/UX-auditpolish.");
  const cache=vernieuwServiceworkerCache(OUT,"ui-ux-audit-polish-20260913");
  console.log("UI/UX-auditpolish toegepast op "+geraakt+" weerartifacts; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,OWNER_ID,CSS,htmlBestanden,main};

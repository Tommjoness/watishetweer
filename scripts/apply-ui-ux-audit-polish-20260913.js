"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const STYLE_ID="wiw-ui-ux-audit-polish-20260913";
const OWNER_ID="wiw-live-screenshot-polish-20260912";
const SUPPORT_CONTACT='<p class="footer-contact"><span class="footer-contact-question">Opmerkingen, vragen of feedback?</span> <span class="footer-contact-mail">Mail naar <a href="mailto:support@watishetweer.nl">support@watishetweer.nl</a></span></p>';

/* Deze laatste presentatielaag draait na delivery-cleanup. De selectors raken
   alleen leesbaarheid en interactie-affordance; data, grafiekgeometrie, runtime,
   providers en requestgedrag blijven eigendom van hun bestaande lagen. */
const CSS=`
.mobile-section-nav{display:none}
.results .zoekresultaat-naam{display:block;color:var(--ink)}
.results .zoekresultaat-detail{display:block;margin-top:1px;color:var(--ink-45);font-size:12.5px;line-height:1.35}
button:focus-visible,input:focus-visible,a:focus-visible,[role="button"]:focus-visible,summary:focus-visible{outline:2px solid var(--ink)!important;outline-offset:2px!important}
#thema{display:inline-flex!important;align-items:center!important;justify-content:center!important;opacity:1!important;color:var(--ink-70)!important}
#thema .thema-status{vertical-align:0!important}
.footer-contact{grid-column:1 / -1;justify-self:center;margin:6px 0 0;text-align:center;color:var(--ink-25);font:inherit}
@media(min-width:901px){
  .chip.add{border-style:solid!important;background:var(--sheet);color:var(--ink-70)}
  #days .row.day:not(.kop){padding-right:24px!important}
  #days .row.day:not(.kop)::after{content:"›";position:absolute;right:7px;top:50%;transform:translateY(-52%);color:var(--ink-25);font-family:var(--sans);font-size:20px;line-height:1;transition:color .15s ease,transform .15s ease}
  #days .row.day:not(.kop):hover::after,#days .row.day:not(.kop):focus-visible::after{color:var(--ink);transform:translate(2px,-52%)}
  /* De finale desktopruntime voegt na DOMContentLoaded nog een flex-footerregel
     toe. Deze laatste presentatielaag moet daarom met hogere specificiteit ook
     display en het grid zelf bezitten; alleen grid-row op de kinderen is niet
     genoeg zodra die runtime actief is. */
  html body footer:nth-of-type(n){display:grid!important;grid-template-columns:minmax(0,1fr) max-content max-content max-content minmax(0,1fr)!important;justify-content:center!important;align-items:center!important;column-gap:16px!important;row-gap:2px!important}
  html body footer:nth-of-type(n) > span.bron:first-of-type{white-space:normal!important;min-width:0!important;max-width:100%!important}
  footer > span.bron:first-of-type{grid-column:1 / -1!important;grid-row:1!important;justify-self:center!important;text-align:center}
  footer > span.bron:nth-of-type(2){grid-column:1 / -1!important;grid-row:2!important;justify-self:center!important;text-align:center}
  footer > span.bron:nth-last-of-type(2){grid-column:2!important;grid-row:3!important;justify-self:center!important}
  footer > span.bron:last-of-type{grid-column:3!important;grid-row:3!important;justify-self:center!important}
  footer > details.footer-details{grid-column:4!important;grid-row:3!important;justify-self:center!important}
  footer > details.footer-details[open]{grid-column:1 / -1!important;grid-row:4!important;justify-self:center!important}
}
@media(max-width:900px){
  /* Finale mobiele afsluiting: houd bronnen, hulplinks en contact semantisch
     hetzelfde, maar laat de utilityrij als één rustig ritme lezen. De links
     zelf houden een echte 44px tap-zone; niet alleen hun parent. */
  html body footer:nth-of-type(n){column-gap:14px!important;row-gap:0!important}
  footer > span.bron:nth-last-of-type(2) a,
  footer > span.bron:last-of-type a,
  footer > details.footer-details>summary{display:inline-flex;align-items:center;justify-content:center;min-height:44px}
  .footer-contact{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;column-gap:6px;row-gap:0;line-height:1.35}
  .footer-contact-question,.footer-contact-mail{display:inline-flex;align-items:center;justify-content:center}
  .footer-contact-mail{white-space:nowrap}

  /* Populaire plaatsen blijft gewone indexeerbare linknavigatie — geen cards of
     app-pills — maar krijgt mobiel een consistente twee-koloms leesas en zachte
     scheiders. De bestaande korte selectie (zes + Meer plaatsen) blijft intact. */
  body > .seo-plaatsnav{padding-top:14px!important;padding-bottom:4px!important}
  .seo-plaatsnav-inner{gap:8px!important}
  .seo-plaatsnav-kop{font-size:19px!important;line-height:1.2!important;letter-spacing:-.01em}
  .seo-plaatsnav-links{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px!important;row-gap:0!important;width:100%}
  .seo-plaatsnav-links a{display:flex!important;align-items:center;justify-content:flex-start;min-width:0;min-height:44px!important;padding:4px 0;line-height:1.25!important;border-bottom:1px solid var(--rule-soft)!important}
  .seo-plaatsnav-links a:nth-child(n+7):not(.seo-plaatsnav-alles){display:none!important}
  .seo-plaatsnav-links .seo-plaatsnav-alles{grid-column:1 / -1;border-bottom-color:transparent!important}
  html[data-thema="donker"] body > .seo-plaatsnav{background:var(--sheet)!important}

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
  .mobile-section-nav a:active,.seo-plaatsnav a:active,footer a:active,footer summary:active{background:var(--paper)}
}
@media(max-width:600px){
  .footer-contact-mail{margin-top:-8px}
}
@media(min-width:600px) and (max-width:900px){
  .seo-plaatsnav-links{grid-template-columns:repeat(3,minmax(0,1fr))}
  .seo-plaatsnav-links .seo-plaatsnav-alles{grid-column:1 / -1}
}
@media(prefers-reduced-motion:no-preference){
  .mobile-section-nav a,.seo-plaatsnav a,footer a,footer summary{transition:color .15s ease,background-color .15s ease,border-color .15s ease}
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
    if(html.includes('class="footer-contact"'))throw new Error(rel+": supportcontact staat al in artifact.");
    for(const hook of ['class="mobile-section-nav"','id="thema"','id="days"','id="aq"']){
      if(!html.includes(hook))throw new Error(rel+": verwachte UI-hook ontbreekt: "+hook);
    }
    if((html.split("</footer>").length-1)!==1)throw new Error(rel+": footereinde ontbreekt of is dubbel.");
    if(!html.includes("</head>"))throw new Error(rel+": headafsluiting ontbreekt.");
    html=html.replace("</footer>",`${SUPPORT_CONTACT}\n    </footer>`);
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
module.exports={OUT,STYLE_ID,OWNER_ID,SUPPORT_CONTACT,CSS,htmlBestanden,main};
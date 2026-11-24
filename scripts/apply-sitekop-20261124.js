"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");
const {OUT,htmlBestanden}=require("./apply-kleur-20261012.js");
const {menuHtml}=require("./apply-menu-20261119.js");

/* Gedeelde kop op alle subpagina's (K1, eigenaar 24 november; fase E van #641).

   Iedere pagina zonder de weerbovenbalk (seizoenspagina's, maan, Nachtzicht en
   de parken, Weer per plaats, contact, over, privacy en de 404) krijgt dezelfde
   kop: links het menu (dezelfde vier groepen en links als op de weerpagina's),
   daarnaast het logo (zonneboog met rode stip, eigenaar 24 november: optie D)
   met de naam in Newsreader. In het menu staat de weergavekeuze Licht/Auto/
   Donker; die staat niet meer als balk bovenaan (keuze 1a).
   - Weer per plaats had al een eigen, geteste weergavekeuze: die verhuist
     ongewijzigd naar het menu (zelfde knoppen, zelfde script). De eigen
     kopregels van Weer per plaats en de maanpagina verdwijnen.
   - De andere pagina's krijgen dezelfde knoppen als Weer per plaats
     (#thema [data-keuze]) met één klein extern script (geen inline script:
     CSP script-src 'self'), dat dezelfde opslag gebruikt als de weerpagina's.
   - Iedere subpagina heeft "← Terug naar het weer"; de parkpagina's houden
     "← Alle Nationale Parken" (eigenaar 24 november).
   - De inhoud staat niet meer in een kader (zoals Witte kerst).
   Het menu werkt zonder JavaScript (<details>); het script voegt alleen
   Escape, klik buiten het menu en sluiten na een link toe. */
const STYLE_ID="wiw-sitekop-20261124";
const KOP_ID="wiw-sitekop";
const SCRIPT_BRON=`(()=>{"use strict";
  /* Weergavekeuze: zelfde opslag als de weerpagina's en Weer per plaats (sessie; actief thema voor de weerapp). */
  const SESSIE="weerbriefing.thema.sessie",ACTIEF="weerbriefing.actiefThema",PREF="weerbriefing.thema";
  const doc=document,html=doc.documentElement;
  const eigenThema=!doc.querySelector('script[src="/theme-hub.js"]');
  const leesSessie=()=>{try{const raw=sessionStorage.getItem(SESSIE);const v=raw==null?null:JSON.parse(raw);return ["auto","licht","donker"].includes(v)?v:null;}catch(e){return null;}};
  const leesLocal=()=>{try{const v=JSON.parse(localStorage.getItem(PREF));return ["licht","donker"].includes(v)?v:null;}catch(e){return null;}};
  const query=typeof matchMedia==="function"?matchMedia("(prefers-color-scheme: dark)"):null;
  let keuze=leesSessie()||leesLocal()||"auto";
  const actief=()=>keuze==="donker"?"donker":keuze==="licht"?"licht":query&&query.matches?"donker":"licht";
  const pas=()=>{
    const a=actief();
    if(keuze!=="auto"||a==="donker")html.setAttribute("data-thema",a);else html.removeAttribute("data-thema");
    try{localStorage.setItem(ACTIEF,JSON.stringify(a));}catch(e){}
    const meta=doc.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute("content",a==="donker"?"#0B120F":"#F4F5F3");
    doc.querySelectorAll("#thema [data-keuze]").forEach(k=>k.setAttribute("aria-pressed",k.getAttribute("data-keuze")===keuze?"true":"false"));
  };
  if(eigenThema){
    pas();
    if(query){const volg=()=>{if(keuze==="auto")pas();};if(typeof query.addEventListener==="function")query.addEventListener("change",volg);else if(typeof query.addListener==="function")query.addListener(volg);}
    doc.querySelectorAll("#thema [data-keuze]").forEach(k=>k.addEventListener("click",()=>{
      keuze=k.getAttribute("data-keuze");
      try{sessionStorage.setItem(SESSIE,JSON.stringify(keuze));localStorage.removeItem(PREF);}catch(e){}
      pas();
    }));
  }
  /* Menu: Escape sluit en zet de focus terug op de knop; klik buiten of op een link sluit. */
  const menu=doc.getElementById("wiw-menu");if(!menu)return;
  const knop=menu.querySelector(":scope > summary");
  const groepen=[...menu.querySelectorAll(".wiw-menu-groep")];
  groepen.forEach(g=>g.addEventListener("toggle",()=>{if(g.open)groepen.forEach(o=>{if(o!==g&&o.open)o.open=false;});}));
  doc.addEventListener("keydown",e=>{if((e.key==="Escape"||e.key==="Esc")&&menu.open){menu.open=false;if(knop)knop.focus();}});
  doc.addEventListener("click",e=>{if(!menu.open)return;if(!menu.contains(e.target)){menu.open=false;return;}if(e.target.closest&&e.target.closest(".wiw-menu-paneel a"))menu.open=false;});
})();
`;
const SCRIPT_NAAM="sitekop-"+crypto.createHash("sha256").update(SCRIPT_BRON).digest("hex").slice(0,12)+".js";

/* Logo D: zonneboog (de zon over de dag, zoals de dagbalk en de deelafbeelding) met de rode stip. */
const LOGO=`<svg class="wiw-sk-logo" viewBox="0 0 32 20" width="32" height="20" aria-hidden="true" focusable="false"><path d="M4 18.2A12 12 0 0 1 28 18.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M1.5 19h29" stroke="var(--wiw-sk-lijn,#cfd6d0)" stroke-width="1.4"/><circle cx="21.6" cy="8.1" r="3.4" fill="var(--wiw-sk-stip,#a0203a)"/></svg>`;
const STANDAARD_THEMA=`<div id="thema" class="hub-weergave" role="group" aria-label="Weergave kiezen"><button type="button" data-keuze="licht" aria-pressed="false">Licht</button><button type="button" data-keuze="auto" aria-pressed="true" title="Automatisch: volgt de licht/donker-instelling van je apparaat">Auto</button><button type="button" data-keuze="donker" aria-pressed="false">Donker</button></div>`;
const TERUG=`<p class="wiw-sk-terug"><a href="/">← Terug naar het weer</a></p>`;

function kopHtml(vandaag,thema){
  const menu=menuHtml(vandaag).replace('<a href="#nachtzicht">','<a href="/#nachtzicht">');
  if(!menu.endsWith("</nav></details>"))throw new Error("Menu-opbouw onverwacht; kan de weergavekeuze niet toevoegen.");
  /* Weergavekeuze onderaan in het (uitklap)paneel, onder de vier groepen. */
  const metThema=menu.slice(0,-"</nav></details>".length)+`<div class="wiw-sk-weergave"><span class="wiw-sk-weergave-kop" aria-hidden="true">Weergave</span>${thema}</div></nav></details>`;
  return `<header class="wiw-sitekop" id="${KOP_ID}">${metThema}<a class="wiw-sk-merk" href="/" translate="no" aria-label="watishetweer.nl">${LOGO}<span>watishetweer.nl</span></a></header>`;
}

const CSS=`
/* Gedeelde kop (K1). Fallbackwaarden voor pagina's zonder tokens (404). */
.wiw-sitekop{--wiw-sk-lijn:var(--rule,#cfd6d0);--wiw-sk-stip:var(--carmine,#a0203a);box-sizing:border-box;position:relative;z-index:50;display:flex;align-items:center;gap:14px;max-width:1184px;margin:0 auto;padding:12px 20px;border-bottom:1px solid var(--rule,#d9ddd8);font-family:var(--sans,"Instrument Sans",system-ui,sans-serif);color:var(--ink,#152019)}
html[data-thema="donker"] .wiw-sitekop{--wiw-sk-stip:#d2455d}
@media(prefers-color-scheme:dark){html:not([data-thema="licht"]) .wiw-sitekop{--wiw-sk-stip:#d2455d}}
.wiw-sk-merk{display:inline-flex;align-items:center;gap:9px;color:inherit;text-decoration:none;font:500 21px/1 var(--display,"Newsreader",Georgia,serif);letter-spacing:-.01em;white-space:nowrap}
.wiw-sk-merk:hover span{text-decoration:underline;text-underline-offset:4px}
.wiw-sk-logo{flex:none;display:block}
.wiw-sitekop .wiw-menu{position:relative;flex:0 0 auto}
.wiw-sitekop .wiw-menu>summary{list-style:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:46px;min-height:46px;padding:0 14px;border:1px solid var(--rule,#d9ddd8);background:var(--sheet,#fff);color:inherit;font:600 14px/1 var(--sans,"Instrument Sans",system-ui,sans-serif);cursor:pointer;-webkit-user-select:none;user-select:none}
.wiw-sitekop .wiw-menu>summary::-webkit-details-marker{display:none}
.wiw-sitekop .wiw-menu>summary::marker{content:""}
.wiw-sitekop .wiw-menu[open]>summary{border-color:currentColor}
.wiw-sitekop .wiw-menu-icoon{position:relative;display:inline-block;flex:0 0 auto;width:16px;height:12px;box-sizing:border-box;border-top:2px solid currentColor;border-bottom:2px solid currentColor}
.wiw-sitekop .wiw-menu-icoon::after{content:"";position:absolute;left:0;right:0;top:3px;border-top:2px solid currentColor}
.wiw-sitekop .wiw-menu-paneel{position:absolute;left:0;top:calc(100% + 6px);z-index:60;display:block;box-sizing:border-box;width:320px;max-width:calc(100vw - 40px);max-height:calc(100vh - 120px);max-height:calc(100dvh - 120px);overflow:auto;overscroll-behavior:contain;padding:4px 16px;background:var(--sheet,#fff);border:1px solid var(--rule,#d9ddd8);box-shadow:0 10px 26px rgba(0,0,0,.08);text-align:left}
.wiw-sitekop .wiw-menu-groep+.wiw-menu-groep{border-top:1px solid var(--rule,#d9ddd8)}
.wiw-sitekop .wiw-menu-kop{list-style:none;display:flex;align-items:center;gap:12px;min-height:46px;margin:0;cursor:pointer;font:600 14px/1.35 var(--sans,"Instrument Sans",system-ui,sans-serif);color:var(--ink-70,#4a5650)}
.wiw-sitekop .wiw-menu-kop::-webkit-details-marker{display:none}
.wiw-sitekop .wiw-menu-kop::marker{content:""}
.wiw-sitekop .wiw-menu-kop::before{content:"";flex:0 0 auto;width:6px;height:6px;margin:0 2px 0 1px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .15s ease}
.wiw-sitekop .wiw-menu-groep[open]>.wiw-menu-kop::before{transform:translateY(-2px) rotate(45deg)}
.wiw-sitekop .wiw-menu-kop:hover,.wiw-sitekop .wiw-menu-groep[open]>.wiw-menu-kop{color:var(--ink,#152019)}
@media(prefers-reduced-motion:reduce){.wiw-sitekop .wiw-menu-kop::before{transition:none}}
.wiw-sitekop .wiw-menu-paneel ul{list-style:none;margin:0;padding:0 0 8px 22px}
.wiw-sitekop .wiw-menu-paneel a{display:flex;align-items:center;min-height:44px;color:var(--ink,#152019);text-decoration:none;font:400 15px/1.25 var(--sans,"Instrument Sans",system-ui,sans-serif);overflow-wrap:anywhere}
.wiw-sitekop .wiw-menu-paneel a:hover,.wiw-sitekop .wiw-menu-paneel a:focus-visible{text-decoration:underline;text-underline-offset:3px}
.wiw-sk-weergave{border-top:1px solid var(--rule,#d9ddd8);padding:12px 0 14px}
.wiw-sk-weergave-kop{display:block;margin:0 0 8px;font:600 13px/1 var(--sans,"Instrument Sans",system-ui,sans-serif);color:var(--ink-70,#4a5650)}
.wiw-sitekop #thema{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;margin:0;padding:3px;border:1px solid var(--rule,#d9ddd8);border-radius:7px;background:var(--paper,#f4f5f3)}
.wiw-sitekop #thema button{min-width:0;min-height:44px;margin:0;padding:6px 8px;border:0;border-radius:5px;background:transparent;color:var(--ink-70,#4a5650);font:500 13px/1.2 var(--sans,"Instrument Sans",system-ui,sans-serif);cursor:pointer}
.wiw-sitekop #thema button[aria-pressed="true"]{background:var(--sheet,#fff);color:var(--ink,#152019);font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.wiw-sitekop a:focus-visible,.wiw-sitekop summary:focus-visible,.wiw-sitekop button:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.wiw-sk-terug{box-sizing:border-box;max-width:1184px;margin:16px auto 0;padding:0 20px;font:400 14px/1.4 var(--sans,"Instrument Sans",system-ui,sans-serif)}
.wiw-sk-terug a{color:inherit;text-underline-offset:3px}
/* De kop staat bovenaan: geen bovenmarge van de pagina erboven, en zonder kader geen binnenmarge van
   32px meer boven de inhoud (houdt de titel en het eerste antwoord in het eerste scherm). */
html body:not(#wiw-sk){padding-top:0!important}
html body main.kaart:not(#wiw-sk),html body .kaart.breed:not(.wk-page):not(#wiw-sk),html body main.wrap:not(#wiw-sk){padding-top:8px!important;margin-top:0!important}
/* Inhoud zonder kader, zoals Witte kerst. */
html body main.kaart:not(#wiw-sk),html body .kaart.breed:not(#wiw-sk),html body main.wrap:not(#wiw-sk){border-color:transparent!important;background:transparent!important;box-shadow:none!important}
@media(max-width:600px){.wiw-sitekop{padding:10px 16px;gap:12px}.wiw-sk-merk{font-size:19px}.wiw-sitekop .wiw-menu-paneel{max-width:calc(100vw - 32px)}.wiw-sk-terug{padding:0 16px}}
@media(max-width:345px){.wiw-sk-merk{font-size:17px}.wiw-sk-logo{width:28px}}
@media print{.wiw-sitekop{display:none}}
`;

function eenmaal(html,deel,rel,naam){const n=html.split(deel).length-1;if(n!==1)throw new Error(`${rel}: ${naam} komt ${n} keer voor (verwacht 1).`);}

/* Weerpagina's (met de bovenbalk) en beheer vallen buiten de sitekop. */
const isSubpagina=(html,rel)=>!rel.split(path.sep).includes("admin")&&!html.includes('class="wiw-bovenbalk"');

function haalUit(html,re,rel,naam){
  const m=html.match(re);
  if(!m)throw new Error(`${rel}: ${naam} niet gevonden.`);
  if(html.split(m[0]).length-1!==1)throw new Error(`${rel}: ${naam} niet uniek.`);
  return {html:html.replace(m[0],""),deel:m[0]};
}

function pasToe(html,rel,vandaag){
  if(html.includes(`id="${KOP_ID}"`)||html.includes(`id="${STYLE_ID}"`))throw new Error(rel+": sitekop staat al in artifact.");
  if(html.includes('id="wiw-menu"'))throw new Error(rel+": subpagina heeft al een menu.");
  let uit=html,thema=STANDAARD_THEMA;
  /* Weer per plaats: merkregel weg, de bestaande weergavekeuze (#thema, theme-hub.js) gaat het menu in. */
  if(uit.includes('class="hub-top"')){
    const t=haalUit(uit,/<div id="thema" class="hub-weergave"[^>]*>[\s\S]*?<\/div>/,rel,"weergavekeuze Weer per plaats");
    uit=t.html;thema=t.deel;
    uit=haalUit(uit,/<div class="hub-top"><a class="brand" href="\/">watishetweer\.nl<\/a>\s*<\/div>/,rel,"merkregel Weer per plaats").html;
  }
  /* Maanpagina: eigen kopregel (met eigen knoppen die de pagina herladen) weg; de standaard
     weergavekeuze in het menu werkt zonder herladen. Het maanscript vindt dan geen knoppen meer. */
  if(uit.includes('class="nz-maan-bovenbalk"')){
    uit=haalUit(uit,/<header class="nz-maan-bovenbalk">[\s\S]*?<\/header>/,rel,"kopregel maanpagina").html;
  }
  if(uit.includes('id="thema"'))throw new Error(rel+": er staat nog een weergavekeuze buiten het menu.");
  const body=uit.match(/<body[^>]*>/);
  if(!body)throw new Error(rel+": <body> ontbreekt.");
  const heeftTerug=/>\s*← Terug naar het weer\s*</.test(uit)||/>\s*← Alle Nationale Parken\s*</.test(uit);
  uit=uit.replace(body[0],body[0]+kopHtml(vandaag,thema)+(heeftTerug?"":TERUG));
  eenmaal(uit,"</head>",rel,"headafsluiting");
  uit=uit.replace("</head>",`<style id="${STYLE_ID}">\n${CSS}\n</style>\n</head>`);
  eenmaal(uit,"</body>",rel,"bodyafsluiting");
  uit=uit.replace("</body>",`<script src="/${SCRIPT_NAAM}" defer></script>\n</body>`);
  return uit;
}

function vandaagNl(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Amsterdam",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}

function main(){
  const vandaag=vandaagNl();
  fs.writeFileSync(path.join(OUT,SCRIPT_NAAM),SCRIPT_BRON,"utf8");
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    const rel=path.relative(OUT,p),html=fs.readFileSync(p,"utf8");
    if(!isSubpagina(html,rel))continue;
    fs.writeFileSync(p,pasToe(html,rel,vandaag),"utf8");
    geraakt++;
  }
  if(geraakt<25)throw new Error("Te weinig subpagina's geraakt door de sitekop: "+geraakt);
  const cache=vernieuwServiceworkerCache(OUT,"sitekop-20261124");
  console.log(`Sitekop toegepast op ${geraakt} subpagina's: menu met weergavekeuze, logo, terug naar het weer, geen kader; script ${SCRIPT_NAAM}; cache ${cache}.`);
  return {geraakt};
}

if(require.main===module)main();
module.exports={OUT,STYLE_ID,KOP_ID,CSS,SCRIPT_BRON,SCRIPT_NAAM,LOGO,kopHtml,pasToe,isSubpagina,vandaagNl,main};

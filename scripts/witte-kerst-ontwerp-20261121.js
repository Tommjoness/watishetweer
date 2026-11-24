"use strict";

/* Alleen de vormgeving van /witte-kerst/. De bestaande seizoensruntime en data blijven leidend. */
const STIJL=String.raw`
<style id="wk-ontwerp-20261121">
/* Alleen /witte-kerst/: alle overige seizoens-, maan- en Nachtzichtpagina's houden hun huidige opmaak. */
.kaart.breed.wk-page{max-width:1184px;padding:0 28px 48px;border:0;background:transparent}
.wk-page{--wk-sky-a:#dfe8e8;--wk-sky-b:#e8edef;--wk-sky-c:#f6f6f3;--wk-line:#a9b9b0;--wk-overlay:rgba(255,255,255,.56)}
html[data-thema="donker"] .wk-page{--wk-sky-a:#273a40;--wk-sky-b:#2d3b40;--wk-sky-c:#1d2a2a;--wk-line:#607269;--wk-overlay:rgba(20,27,25,.86)}
.wk-page .wk-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:18px;min-height:92px;border-bottom:1px solid var(--rule)}
.wk-brand{display:inline-flex;align-items:center;gap:10px;color:var(--ink);font-size:16px;font-weight:700;letter-spacing:-.035em;text-decoration:none;white-space:nowrap}
.wk-brandmark{position:relative;display:inline-block;width:28px;height:28px;flex:none;border:2px solid currentColor;border-radius:50%;overflow:hidden}
.wk-brandmark:after{content:"";position:absolute;left:-5px;right:-5px;bottom:4px;height:14px;border-top:2px solid currentColor;border-radius:70% 70% 0 0;transform:rotate(-17deg)}
.wk-menu{justify-self:end;position:relative;z-index:3}
.wk-menu summary{display:flex;align-items:center;justify-content:center;min-width:46px;min-height:46px;padding:8px 14px;border:1px solid var(--rule);background:var(--sheet);cursor:pointer;list-style:none;font:600 13px/1.3 var(--sans)}
.wk-menu summary::-webkit-details-marker{display:none}.wk-menu summary::marker{content:""}
.wk-menu[open] summary{border-color:var(--wk-line)}
/* G2-B: de weergavekeuze staat in het menu, niet meer als balk bovenaan. */
.wk-menu .wk-paneel{position:absolute;top:calc(100% + 6px);right:0;display:grid;gap:10px;width:260px;max-width:calc(100vw - 32px);padding:8px 14px 14px;border:1px solid var(--rule);background:var(--sheet);box-shadow:0 10px 26px rgba(0,0,0,.07)}
.wk-menu nav{display:grid}
.wk-menu nav a{display:flex;align-items:center;min-height:44px;padding:7px 4px;color:var(--ink);font-size:14px;text-decoration:none;border-bottom:1px solid var(--rule)}
.wk-menu nav a:last-child{border-bottom:0}.wk-menu nav a:hover{text-decoration:underline;text-underline-offset:3px}
.wk-theme{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;padding:3px;border:1px solid var(--rule);background:var(--paper);border-radius:7px}
.wk-theme input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.wk-theme label{display:inline-flex;align-items:center;justify-content:center;min-width:0;min-height:44px;padding:7px 9px;cursor:pointer;border-radius:5px;font:500 13px/1.2 var(--sans);color:var(--ink-70)}
.wk-theme input:checked+label{background:var(--sheet);color:var(--ink);font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.wk-theme input:focus-visible+label{outline:2px solid var(--ink);outline-offset:2px}
.wk-return{margin:18px 0 20px!important;font-size:14px}
.wk-return a{text-underline-offset:3px}
/* G2-B (eigenaar 22 en 23 november): eerst het antwoord, dan de tijdlijn; geen blauwe kaart,
   geen gloed en geen kaart in een kaart. Eén vlak met dunne lijnen. */
.wk-page h1#seizoen-kop{font-size:clamp(34px,4.4vw,52px);line-height:1.08;margin:6px 0 16px;max-width:none}
.wk-page .seizoen-status.wk-antwoord{margin:0 0 30px;padding:16px 0 20px;border-top:2px solid var(--ink);border-bottom:1px solid var(--rule)}
.wk-status{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 14px}
.wk-status[hidden],.wk-status:not(:has(:not([hidden]))){display:none}
.wk-label{display:inline-flex;align-items:center;min-height:28px;padding:4px 11px;border:1px solid var(--ink);border-radius:999px;font:600 13px/1.2 var(--sans);white-space:nowrap}
.wk-label[hidden]{display:none}
.wk-page .wk-status #seizoen-melding{flex:1 1 30ch;min-width:0;max-width:62ch;margin:0;font:500 clamp(17px,1.7vw,20px)/1.4 var(--sans);color:var(--ink)}
.wk-page .wk-antwoord .seizoen-aftellen{margin:14px 0 0}
.wk-page .wk-antwoord #seizoen-verwachting:not(:empty){margin-top:14px}
/* E1: binnen het venster staat de uitkomst als antwoord boven de aftelling. */
.wk-page #seizoen-uitkomst:empty{display:none}
.wk-page #seizoen-uitkomst .seizoen-samenvatting{max-width:62ch;margin:0 0 4px;font:500 clamp(17px,1.7vw,20px)/1.4 var(--sans);color:var(--ink)}
.wk-tijdlijn{margin:0 0 30px}
.wk-page .wk-tijdlijn h2{font:600 17px/1.3 var(--sans);margin:0 0 6px;max-width:none}
.wk-as{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px}
.wk-eind{font:400 12px/1 var(--sans);color:var(--ink-70);font-variant-numeric:tabular-nums lining-nums}
.wk-baan{position:relative;height:112px}
.wk-baan .wk-vorm,.wk-baan .wk-jaren{position:absolute;inset:0}
.wk-baan .wk-lijn{position:absolute;left:0;right:0;top:54px;border-top:1.5px solid var(--ink-70)}
.wk-baan .wk-pt{position:absolute;top:50px;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:var(--ink)}
.wk-baan .wk-st{position:absolute;width:0;border-left:1px solid var(--ink-70)}
.wk-baan .wk-jl{position:absolute;transform:translateX(-50%);font:600 12px/1 var(--sans);color:var(--ink);font-variant-numeric:tabular-nums lining-nums;white-space:nowrap}
.wk-st.r0{top:59px;height:12px}.wk-jl.r0{top:73px}
.wk-st.r1{top:38px;height:12px}.wk-jl.r1{top:24px}
.wk-st.r2{top:59px;height:28px}.wk-jl.r2{top:89px}
.wk-st.r3{top:22px;height:28px}.wk-jl.r3{top:8px}
.wk-page .wk-tijdlijn-voet{margin:2px 0 0;font-size:14px;line-height:1.45;color:var(--ink-70)}
.wk-page .wk-lead{font-size:16px;line-height:1.6;color:var(--ink-70);max-width:62ch;margin:0 0 6px}
html[data-thema="donker"] .wk-page .wk-lead{color:var(--ink)}
.wk-page .wk-guide{margin-top:30px;padding-top:26px;border-top:1px solid var(--rule)}
.wk-page .wk-guide>h2,.wk-page .wk-related>h2{font:400 30px/1.15 var(--serif);max-width:none;margin:0 0 16px}
.wk-vragen{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 36px}
.wk-qa{min-width:0}
.wk-page .wk-qa h2{font:400 22px/1.2 var(--serif);margin:0 0 10px;max-width:none}
.wk-page .wk-qa p{font-size:15px;line-height:1.65;color:var(--ink-70);margin:0 0 12px;max-width:none}
.wk-page .wk-qa p:last-child{margin-bottom:0}
.wk-page .wk-guide .klein{margin-top:14px}
.wk-related{border-top:1px solid var(--rule);margin-top:36px;padding-top:30px}
.wk-page .wk-related .seizoen-zieook{max-width:none;margin:0;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.wk-page .wk-related .seizoen-zieook span{position:absolute;width:1px;height:1px;clip:rect(0,0,0,0);overflow:hidden}
.wk-page .wk-related .seizoen-zieook a{display:inline-flex;justify-content:center;align-items:center;min-height:44px;min-width:132px;padding:10px 16px;border:1px solid var(--wk-line);text-decoration:none;background:var(--sheet);font-size:14px;font-weight:600}
.wk-page .wk-related .seizoen-zieook a:hover{text-decoration:underline;text-underline-offset:3px}
.wk-weather{margin-top:36px}
.wk-footer{margin-top:36px;padding:26px 0;border-top:1px solid var(--rule);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--ink-70)}
.wk-footer nav{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.wk-footer nav a{display:inline-flex;align-items:center;min-height:44px;color:var(--ink-70)}
.wk-page a:focus-visible,.wk-page summary:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
@media(max-width:600px){
 .kaart.breed.wk-page{padding:0 16px 28px}
 .wk-page .wk-header{grid-template-columns:minmax(0,1fr) auto;row-gap:12px;column-gap:12px;padding:14px 0;min-height:0}
 .wk-brand{font-size:15px}.wk-brandmark{width:26px;height:26px}
 .wk-menu{grid-column:2;grid-row:1}
 .wk-page .wk-guide>h2,.wk-page .wk-related>h2{font-size:27px}
 .wk-vragen{grid-template-columns:1fr;gap:22px}
 .wk-page .wk-qa h2{font-size:21px}
 .wk-page .wk-related .seizoen-zieook a{flex:1 1 125px}
 .wk-footer{align-items:flex-start;flex-direction:column;gap:2px}
}
@media(max-width:345px){.wk-brand{font-size:14px}}
@media(prefers-reduced-motion:reduce){.wk-page *{scroll-behavior:auto}}
</style>`;
const HEADER=String.raw`
<header class="wk-header">
<a class="wk-brand" href="/" aria-label="watishetweer.nl" translate="no"><span class="wk-brandmark" aria-hidden="true"></span><span>watishetweer.nl</span></a>
<details class="wk-menu"><summary>Menu</summary>
<div class="wk-paneel">
<nav aria-label="Menu"><a href="/">Actueel weer</a><a href="/maan/">De maan vandaag</a><a href="/nachtzicht/">Sterren kijken</a><a href="/kerstvakantie/">Kerstvakantie</a><a href="/oud-en-nieuw/">Oud en nieuw</a><a href="/over/">Over deze site</a></nav>
<div class="wk-theme" role="group" aria-label="Weergave kiezen">
<input type="radio" name="wk-thema" id="wk-licht" value="licht"><label for="wk-licht">Licht</label>
<input type="radio" name="wk-thema" id="wk-auto" value="auto" checked><label for="wk-auto">Auto</label>
<input type="radio" name="wk-thema" id="wk-donker" value="donker"><label for="wk-donker">Donker</label>
</div>
</div>
</details>
</header>`;
const FOOTER=String.raw`<footer class="wk-footer"><span translate="no">© watishetweer.nl</span><nav aria-label="Informatie"><a href="/over/">Over deze site</a> <span aria-hidden="true">·</span> <a href="/privacy">Privacy &amp; gegevens</a></nav></footer>`;
const THEMA_SCRIPT=String.raw`<script>
/* De bestaande sessievoorkeur is leidend; alleen deze pagina toont de aanvullende bediening. */
(()=>{try{
 const KEY="weerbriefing.thema.sessie",LEGACY="weerbriefing.thema";
 const lees=(s,k)=>{try{return JSON.parse(s.getItem(k));}catch(e){return null;}};
 const sessie=lees(sessionStorage,KEY),oud=lees(localStorage,LEGACY);
 let keuze=["auto","licht","donker"].includes(sessie)?sessie:["licht","donker"].includes(oud)?oud:"auto";
 const systeem=typeof matchMedia==="function"?matchMedia("(prefers-color-scheme: dark)"):null;
 const pas=()=>{
  const donker=keuze==="donker"||(keuze==="auto"&&!!(systeem&&systeem.matches));
  if(keuze!=="auto"||donker)document.documentElement.setAttribute("data-thema",donker?"donker":"licht");
  else document.documentElement.removeAttribute("data-thema");
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute("content",donker?"#0B120F":"#F4F5F3");
 };
 const radio=document.getElementById("wk-"+keuze);if(radio)radio.checked=true;
 for(const el of document.querySelectorAll('input[name="wk-thema"]'))el.addEventListener("change",()=>{
  if(!el.checked)return;keuze=el.value;
  try{sessionStorage.setItem(KEY,JSON.stringify(keuze));localStorage.removeItem(LEGACY);}catch(e){}
  pas();
 });
 if(systeem){const volg=()=>pas();if(systeem.addEventListener)systeem.addEventListener("change",volg);else if(systeem.addListener)systeem.addListener(volg);}
 pas();
}catch(e){}})();
</script>`;
/* Tijdlijn van de officiële witte kersten (G2-B). Statisch bij de build; posities in procenten.
   Ieder jaartal hangt met een streepje aan zijn stip, in één van vier rijen (onder/boven, kort/lang).
   De rij wordt gekozen voor de smalste baan (ongeveer 200px bij 320px schermbreedte) met minstens
   36px tussen labels in dezelfde rij; op bredere schermen wordt de afstand alleen groter. */
const RIJEN=[{boven:false,lang:false},{boven:true,lang:false},{boven:false,lang:true},{boven:true,lang:true}];
function tijdlijnRijen(jaren,begin,eind,smalste=200,minAfstand=36){
  const laatst=RIJEN.map(()=>-Infinity);
  return jaren.map(j=>{
    const x=(j-begin)/(eind-begin)*smalste;
    let r=laatst.findIndex(l=>x-l>=minAfstand);
    if(r<0)throw new Error(`Tijdlijn witte kerst: geen vrije rij voor ${j}`);
    laatst[r]=x;
    return r;
  });
}
function lijstNl(a){return a.length<2?a.join(""):a.slice(0,-1).join(", ")+" en "+a[a.length-1];}
function tijdlijnHtml(jaren,eind,begin=1901){
  if(!Array.isArray(jaren)||!jaren.length)throw new Error("Tijdlijn witte kerst: geen jaren");
  if(jaren.some((j,i)=>!Number.isInteger(j)||j<begin||j>eind||(i&&j<=jaren[i-1])))throw new Error("Tijdlijn witte kerst: jaren niet oplopend binnen "+begin+"–"+eind);
  const rijen=tijdlijnRijen(jaren,begin,eind);
  const pct=j=>((j-begin)/(eind-begin)*100).toFixed(3)+"%";
  /* Vormen (lijn, stippen, streepjes) en jaartallen in aparte lagen: de Engelse vertaallaag bouwt een
     zinsblok opnieuw op en laat lege elementen daarin vallen. */
  const vormen=jaren.map((j,i)=>`<span class="wk-pt" style="left:${pct(j)}"></span><span class="wk-st r${rijen[i]}" style="left:${pct(j)}"></span>`).join("");
  const labels=jaren.map((j,i)=>`<span class="wk-jl r${rijen[i]}" style="left:${pct(j)}">${j}</span>`).join("");
  return `<section class="wk-tijdlijn" aria-labelledby="wk-tijdlijn-kop">
<h2 id="wk-tijdlijn-kop">${jaren.length} officiële witte kersten sinds ${begin}</h2>
<div class="wk-as"><span class="wk-eind" aria-hidden="true">${begin}</span><div class="wk-baan" role="img" aria-label="Tijdlijn van de officiële witte kersten sinds ${begin}: ${lijstNl(jaren)}."><div class="wk-vorm"><span class="wk-lijn"></span>${vormen}</div><div class="wk-jaren">${labels}</div></div><span class="wk-eind" aria-hidden="true">${eind}</span></div>
<p class="wk-tijdlijn-voet">Laatste officiële witte kerst: ${jaren[jaren.length-1]}. Bron: KNMI.</p>
</section>`;
}
module.exports={STIJL,HEADER,FOOTER,THEMA_SCRIPT,tijdlijnHtml,tijdlijnRijen};

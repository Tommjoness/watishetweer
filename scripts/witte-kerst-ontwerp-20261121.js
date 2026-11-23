"use strict";

/* Alleen de vormgeving van /witte-kerst/. De bestaande seizoensruntime en data blijven leidend. */
const STIJL=String.raw`
<style id="wk-ontwerp-20261121">
/* Alleen /witte-kerst/: alle overige seizoens-, maan- en Nachtzichtpagina's houden hun huidige opmaak. */
.kaart.breed.wk-page{max-width:1184px;padding:0 28px 48px;border:0;background:transparent}
.wk-page{--wk-sky-a:#dfe8e8;--wk-sky-b:#e8edef;--wk-sky-c:#f6f6f3;--wk-line:#a9b9b0;--wk-overlay:rgba(255,255,255,.56)}
html[data-thema="donker"] .wk-page{--wk-sky-a:#273a40;--wk-sky-b:#2d3b40;--wk-sky-c:#1d2a2a;--wk-line:#607269;--wk-overlay:rgba(20,27,25,.86)}
.wk-page .wk-header{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:18px;min-height:92px;border-bottom:1px solid var(--rule)}
.wk-brand{display:inline-flex;align-items:center;gap:10px;color:var(--ink);font-size:16px;font-weight:700;letter-spacing:-.035em;text-decoration:none;white-space:nowrap}
.wk-brandmark{position:relative;display:inline-block;width:28px;height:28px;flex:none;border:2px solid currentColor;border-radius:50%;overflow:hidden}
.wk-brandmark:after{content:"";position:absolute;left:-5px;right:-5px;bottom:4px;height:14px;border-top:2px solid currentColor;border-radius:70% 70% 0 0;transform:rotate(-17deg)}
.wk-menu{justify-self:end;position:relative;z-index:3}
.wk-menu summary{display:flex;align-items:center;justify-content:center;min-width:46px;min-height:46px;padding:8px 14px;border:1px solid var(--rule);background:var(--sheet);cursor:pointer;list-style:none;font:600 13px/1.3 var(--sans)}
.wk-menu summary::-webkit-details-marker{display:none}.wk-menu summary::marker{content:""}
.wk-menu[open] summary{border-color:var(--wk-line)}
.wk-menu nav{position:absolute;top:calc(100% + 6px);right:0;display:grid;min-width:225px;max-width:calc(100vw - 32px);padding:8px 14px;border:1px solid var(--rule);background:var(--sheet);box-shadow:0 10px 26px rgba(0,0,0,.07)}
.wk-menu nav a{display:flex;align-items:center;min-height:44px;padding:7px 4px;color:var(--ink);font-size:14px;text-decoration:none;border-bottom:1px solid var(--rule)}
.wk-menu nav a:last-child{border-bottom:0}.wk-menu nav a:hover{text-decoration:underline;text-underline-offset:3px}
.wk-theme{justify-self:end;display:flex;align-items:center;gap:2px;padding:3px;border:1px solid var(--rule);background:var(--paper);border-radius:7px}
.wk-theme input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.wk-theme label{display:inline-flex;align-items:center;justify-content:center;min-width:56px;min-height:44px;padding:7px 9px;cursor:pointer;border-radius:5px;font:500 13px/1.2 var(--sans);color:var(--ink-70)}
.wk-theme input:checked+label{background:var(--sheet);color:var(--ink);font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.wk-theme input:focus-visible+label{outline:2px solid var(--ink);outline-offset:2px}
.wk-return{margin:18px 0 20px!important;font-size:14px}
.wk-return a{text-underline-offset:3px}
.wk-hero{isolation:isolate;position:relative;display:grid;grid-template-columns:minmax(0,1.2fr) minmax(250px,.8fr);gap:32px;align-items:end;min-height:390px;padding:48px 44px;border:1px solid var(--wk-line);overflow:hidden;background:linear-gradient(115deg,var(--wk-sky-c),var(--wk-sky-a) 62%,var(--wk-sky-b))}
.wk-hero:before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(ellipse at 75% 17%,rgba(255,255,255,.21),transparent 67%),linear-gradient(180deg,transparent 68%,rgba(255,255,255,.08))}
.wk-hero-copy{min-width:0}
.wk-page .wk-hero h1{font:400 clamp(44px,5vw,72px)/1.04 var(--serif);letter-spacing:-.035em;max-width:11ch;margin:0 0 22px}
.wk-page .wk-lead{font-size:17px;line-height:1.55;color:var(--ink-70);max-width:47ch;margin:0}
html[data-thema="donker"] .wk-page .wk-lead{color:var(--ink)}
.wk-note{align-self:end;min-width:0;padding:24px 25px;border:1px solid var(--wk-line);background:var(--wk-overlay)}
.wk-note:has(#seizoen-melding[hidden]){display:none}
.wk-page .wk-note h2{font:700 11px/1.4 var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-70);margin:0 0 14px}
.wk-page .wk-note p{font:400 19px/1.45 var(--sans);color:var(--ink);margin:0}
.wk-page .seizoen-status{margin:26px 0 34px;padding:0;border-top:0}
.wk-page .seizoen-status:has(#seizoen-aftellen[hidden]):has(#seizoen-verwachting:empty){margin:0}
.wk-page .seizoen-aftellen{margin:0 0 18px}
.wk-page .wk-guide{margin-top:34px}
.wk-page .wk-guide>h2,.wk-page .wk-related>h2{font:400 32px/1.15 var(--serif);max-width:none;margin:0 0 18px}
.wk-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.wk-qa{min-width:0;background:var(--sheet);border:1px solid var(--rule);padding:26px 28px}
.wk-page .wk-qa h2{font:400 24px/1.18 var(--serif);margin:0 0 14px;max-width:none}
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
@media(max-width:900px){
 .wk-hero{grid-template-columns:1fr;padding:36px 32px;gap:24px}
 .wk-note{max-width:600px}
}
@media(max-width:600px){
 .kaart.breed.wk-page{padding:0 16px 28px}
 .wk-page .wk-header{grid-template-columns:minmax(0,1fr) auto;row-gap:12px;column-gap:12px;padding:14px 0;min-height:0}
 .wk-brand{font-size:15px}.wk-brandmark{width:26px;height:26px}
 .wk-menu{grid-column:2;grid-row:1}
 .wk-theme{grid-column:1/-1;grid-row:2;justify-self:stretch;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
 .wk-theme label{min-width:0}
 .wk-hero{padding:31px 25px;gap:23px}
 .wk-page .wk-hero h1{font-size:clamp(39px,11.5vw,52px)}
 .wk-page .wk-lead{font-size:16px}
 .wk-note{padding:19px 20px}.wk-page .wk-note p{font-size:17px}
 .wk-page .wk-guide>h2,.wk-page .wk-related>h2{font-size:29px}
 .wk-cards{grid-template-columns:1fr;gap:12px}
 .wk-qa{padding:22px}.wk-page .wk-qa h2{font-size:25px}
 .wk-page .wk-related .seizoen-zieook a{flex:1 1 125px}
 .wk-footer{align-items:flex-start;flex-direction:column;gap:2px}
}
@media(max-width:345px){.wk-hero{padding:28px 21px}.wk-brand{font-size:14px}.wk-page .wk-hero h1{font-size:39px}}
@media(prefers-reduced-motion:reduce){.wk-page *{scroll-behavior:auto}}
</style>`;
const HEADER=String.raw`
<header class="wk-header">
<a class="wk-brand" href="/" aria-label="watishetweer.nl"><span class="wk-brandmark" aria-hidden="true"></span><span translate="no">watishetweer.nl</span></a>
<details class="wk-menu"><summary>Menu</summary>
<nav aria-label="Menu"><a href="/">Actueel weer</a><a href="/maan/">De maan vandaag</a><a href="/nachtzicht/">Sterren kijken</a><a href="/kerstvakantie/">Kerstvakantie</a><a href="/oud-en-nieuw/">Oud en nieuw</a><a href="/over/">Over deze site</a></nav>
</details>
<div class="wk-theme" role="group" aria-label="Weergave kiezen">
<input type="radio" name="wk-thema" id="wk-licht" value="licht"><label for="wk-licht">Licht</label>
<input type="radio" name="wk-thema" id="wk-auto" value="auto" checked><label for="wk-auto">Auto</label>
<input type="radio" name="wk-thema" id="wk-donker" value="donker"><label for="wk-donker">Donker</label>
</div>
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
module.exports={STIJL,HEADER,FOOTER,THEMA_SCRIPT};

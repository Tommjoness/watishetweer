"use strict";

/* De bestaande waarschuwingrenderer is de canonieke owner van zijn requeststates,
   uiteindelijke kaartpresentatie én bijbehorende warning-CSS. Deze pure base-
   buildtransformatie verandert geen bron, filtering, deduplicatie, scope,
   sortering, maximumaantal, geldigheidstijd of requestgedrag. Hij maakt alleen
   de reeds zichtbare finale DOM/copy/stijl direct in hetzelfde domein definitief,
   zodat UI-polish waarschuwingen niet meer apart hoeft te presenteren. */
const START_BRON=`  S.actieveWaarschuwingen=[];
  el.innerHTML="";
  try{`;
const START_PRODUCTIE=`  S.actieveWaarschuwingen=[];
  el.innerHTML='<div class="msg" data-ui-warning-loading="1">Officiële weerwaarschuwingen controleren…</div>';
  try{`;

const DEKKING_BRON=`    if(!d||d.dekking!==true){
      const bronStuk=d&&d.reden==="bron onbereikbaar"
        ?"konden niet worden gecontroleerd"
        :"zijn voor deze locatie niet beschikbaar";
      el.innerHTML='<div class="msg">Officiële weerwaarschuwingen '+bronStuk+'.</div>';
      if(S.d&&typeof briefing==="function") briefing();
      return;
    }`;
const DEKKING_PRODUCTIE=`    if(!d||d.dekking!==true){
      const melding=d&&d.reden==="bron onbereikbaar"
        ?"Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald."
        :"Voor deze locatie kunnen we geen officiële weerwaarschuwingen tonen.";
      el.innerHTML='<div class="msg">'+melding+'</div>';
      if(S.d&&typeof briefing==="function") briefing();
      return;
    }`;

const EIND_BRON=`    el.innerHTML=lijst.slice(0,3).map(w=>{
      const geldig=w.tot?waarschuwingGeldigTot(w.tot):null;
      return \`<div class="waarsch"><h3>\${esc(w.titel)}</h3><p>\${esc(w.tekst||"")}\`
        +(geldig?" Geldig tot "+esc(geldig)+".":"")
        +(w.landelijk?" Geldt voor een groter gebied, niet per se voor deze plaats.":"")
        +\`</p></div>\`;
    }).join("");`;
const EIND_PRODUCTIE=`    el.innerHTML=lijst.slice(0,3).map(w=>{
      const geldig=w.tot?waarschuwingGeldigTot(w.tot):null;
      const tekst=String(w.tekst||""),nwsTekst=tekst.trim();
      const metaDelen=[];
      if(geldig)metaDelen.push("Geldig tot "+esc(geldig)+".");
      if(w.landelijk)metaDelen.push("Geldt voor een groter gebied, niet per se voor deze plaats.");
      const meta=metaDelen.join(" "),ernst=esc(String(w.niveau||"").toLowerCase());
      if(/\\*\\s*(?:WHAT|WHERE|WHEN|IMPACTS)\\.\\.\\./i.test(nwsTekst)){
        return \`<div class="waarsch" data-ui-severity="\${ernst}"><h3>\${esc(w.titel)}</h3>\`
          +(meta?\`<p class="waarsch-meta">\${meta}</p>\`:"")
          +\`<details class="waarsch-details"><summary>Details van de waarschuwing</summary><p lang="en">\${esc(nwsTekst)}</p></details></div>\`;
      }
      return \`<div class="waarsch" data-ui-severity="\${ernst}"><h3>\${esc(w.titel)}</h3><p>\${esc(tekst)}\${meta?" "+meta:""}</p></div>\`;
    }).join("");
    if(lijst.length===0) el.innerHTML='<div class="msg">Geen officiële weerwaarschuwingen voor deze locatie.</div>';`;

const FOUT_BRON=`    el.innerHTML='<div class="msg">Officiële weerwaarschuwingen konden niet worden gecontroleerd.</div>';`;
const FOUT_PRODUCTIE=`    el.innerHTML='<div class="msg">Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald.</div>';`;

/* De ontwikkeltemplate heeft nog de historische warningstijl. De productiestijl
   hieronder is exact de al zichtbare UI-polish-uitkomst: normale advisories
   rustig, rood expliciet en NWS-details compact. Alleen de eigenaar verandert. */
const CSS_BRON=`  /* waarschuwingen */
  .waarsch{border-left:3px solid var(--carmine);padding:10px 0 10px 14px;margin-top:var(--s2)}
  .waarsch h3{font-family:var(--serif);font-weight:400;font-size:18px;margin:0 0 2px;color:var(--carmine)}
  .waarsch p{margin:0;font-size:14px;color:var(--ink-70)}`;
const CSS_PRODUCTIE=`  /* waarschuwingen */
  #waarschuwingen>.msg{font-size:12.5px;color:var(--ink-45);padding:7px 0}
  .waarsch{border-left:1px solid var(--rule);padding:8px 0 8px 12px;margin-top:var(--s2)}
  .waarsch h3{font-family:var(--sans);font-weight:500;font-size:14px;line-height:1.35;margin:0 0 3px;color:var(--ink)}
  .waarsch p{margin:0;font-size:13px;line-height:1.45;color:var(--ink-70)}
  .waarsch[data-ui-severity="rood"]{border-left:3px solid var(--carmine)}
  .waarsch[data-ui-severity="rood"] h3{color:var(--carmine)}
  .waarsch-details{margin-top:6px;font-size:12px;color:var(--ink-45)}
  .waarsch-details summary{display:inline;cursor:pointer;color:var(--ink-45);box-shadow:inset 0 -1px 0 var(--rule)}
  .waarsch-details summary:hover{color:var(--ink)}
  .waarsch-details p{margin-top:7px;font-size:12px;color:var(--ink-45);max-width:92ch}`;

function pasWarningRenderStateToe(html){
  let bron=String(html||"");
  for(const [label,oud,nieuw] of [
    ["waarschuwing-laadstatus",START_BRON,START_PRODUCTIE],
    ["waarschuwing-dekkingpresentatie",DEKKING_BRON,DEKKING_PRODUCTIE],
    ["waarschuwing-kaartpresentatie",EIND_BRON,EIND_PRODUCTIE],
    ["waarschuwing-foutpresentatie",FOUT_BRON,FOUT_PRODUCTIE],
    ["waarschuwing-stijl",CSS_BRON,CSS_PRODUCTIE]
  ]){
    const aantal=bron.split(oud).length-1;
    if(aantal!==1)throw new Error(label+" bronanker ontbreekt of is dubbel: "+aantal);
    bron=bron.replace(oud,nieuw);
  }
  for(const [label,productie] of [
    ["waarschuwing-laadstatus",START_PRODUCTIE],
    ["waarschuwing-dekkingpresentatie",DEKKING_PRODUCTIE],
    ["waarschuwing-kaartpresentatie",EIND_PRODUCTIE],
    ["waarschuwing-foutpresentatie",FOUT_PRODUCTIE],
    ["waarschuwing-stijl",CSS_PRODUCTIE]
  ]){
    if((bron.split(productie).length-1)!==1)throw new Error(label+" ontbreekt of is dubbel na base-build.");
  }
  return bron;
}

module.exports=Object.freeze({
  START_BRON,START_PRODUCTIE,DEKKING_BRON,DEKKING_PRODUCTIE,
  EIND_BRON,EIND_PRODUCTIE,FOUT_BRON,FOUT_PRODUCTIE,
  CSS_BRON,CSS_PRODUCTIE,pasWarningRenderStateToe
});

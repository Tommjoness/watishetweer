"use strict";

/* Releasebewijs pas vastleggen in een betekenisvolle eindtoestand.

   Een screenshot direct na "weerdata geladen" kan nog tussenstanden tonen:
   "Verwachting wordt bijgewerkt…" (briefing wacht op KNMI/de volledige
   verwachting) en "Officiële weerwaarschuwingen controleren…". Beide requests
   zijn in de app begrensd (waarschuwingen 7 s, overige fetches 10 s), dus een
   laadtoestand die blijft staan is een productfout en geen trage externe bron.

   Eindtoestand:
   - briefing zonder pending-kenmerk en met tekst;
   - waarschuwingsblok zonder laadmelding, met een herkenbare uitkomst:
     volledig (waarschuwingen of "geen waarschuwingen"), niet-beschikbaar
     (geen dekking voor deze locatie) of fout (tijdelijk niet opgehaald);
   - webfonts geladen;
   - layout stabiel: paginahoogte en de posities van grafiek, briefing,
     waarschuwingen en dagen gelijk bij drie opeenvolgende metingen.
   Geen vaste wachttijden: alles is een voorwaarde met een begrensde time-out. */

const WAARSCHUWING_TEKST={
  geen:"Geen officiële weerwaarschuwingen voor deze locatie.",
  nietBeschikbaar:"Voor deze locatie kunnen we geen officiële weerwaarschuwingen tonen.",
  fout:"Officiële weerwaarschuwingen konden tijdelijk niet worden opgehaald."
};

/* Draait in de pagina. Alles staat in één functie die Playwright als functie
   doorgeeft (niet als tekst): de productiesite verbiedt eval via haar CSP, en
   een tekstvoorwaarde voor waitForFunction zou daar direct falen. Met
   {stabiel:true} telt de functie ook opeenvolgende gelijke layoutmetingen en
   geeft ze true zodra de eindtoestand drie metingen lang stabiel is. */
function toestandInPagina({teksten,stabiel}){
  const brief=document.getElementById("brief"),w=document.getElementById("waarschuwingen");
  const briefTekst=brief?String(brief.textContent||"").replace(/\s+/g," ").trim():"";
  const briefing=!brief?"ontbreekt"
    :brief.hasAttribute("data-knmi-briefing-pending")||brief.hasAttribute("data-q1-briefing-pending")?"bezig"
    :briefTekst?"klaar":"leeg";
  const wTekst=w?String(w.textContent||"").replace(/\s+/g," ").trim():"";
  const kaarten=w?w.querySelectorAll(".waarsch").length:0;
  const waarschuwingen=!w?"ontbreekt"
    :w.querySelector("[data-ui-warning-loading]")?"bezig"
    :kaarten?"volledig"
    :wTekst===teksten.geen?"volledig"
    :wTekst===teksten.nietBeschikbaar?"niet-beschikbaar"
    :wTekst===teksten.fout?"fout"
    :wTekst?"onbekend":"leeg";
  const t={briefing,briefingTekst:briefTekst.slice(0,200),waarschuwingen,waarschuwingenTekst:wTekst.slice(0,200),aantalWaarschuwingen:kaarten,
    fonts:document.fonts?document.fonts.status:"onbekend"};
  if(!stabiel)return t;
  if(t.briefing!=="klaar"||!["volledig","niet-beschikbaar","fout"].includes(t.waarschuwingen)||t.fonts==="loading")return false;
  const maat=s=>{const e=document.querySelector(s);if(!e)return "-";const r=e.getBoundingClientRect();return Math.round(r.top+scrollY)+":"+Math.round(r.height);};
  const sig=[document.documentElement.scrollHeight,maat("#chart"),maat("#brief"),maat("#waarschuwingen"),maat("#days")].join("|");
  const st=window.__releaseEindtoestand||(window.__releaseEindtoestand={sig:"",n:0});
  if(st.sig===sig)st.n++;else{st.sig=sig;st.n=0;}
  return st.n>=3;
}

async function leesEindtoestand(page){
  return page.evaluate(toestandInPagina,{teksten:WAARSCHUWING_TEKST,stabiel:false});
}

async function wachtEindtoestand(page,naam,timeout=25000){
  try{
    await page.waitForFunction(toestandInPagina,{teksten:WAARSCHUWING_TEKST,stabiel:true},{timeout,polling:200});
  }catch(e){
    const t=await leesEindtoestand(page).catch(()=>null);
    /* Alleen een echte time-out is "geen eindtoestand"; elke andere fout blijft zichtbaar. */
    const timeoutFout=e&&e.name==="TimeoutError";
    throw new Error(`${naam}: `+(timeoutFout?`geen betekenisvolle eindtoestand binnen ${timeout} ms`:`wachten op de eindtoestand faalde (${String(e&&e.message||e).split("\n")[0]})`)+`: ${JSON.stringify(t)}`);
  }
  return leesEindtoestand(page);
}

module.exports={WAARSCHUWING_TEKST,leesEindtoestand,wachtEindtoestand};

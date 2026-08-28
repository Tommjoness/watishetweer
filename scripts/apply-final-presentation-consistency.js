"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const PAD=path.join(OUT,"index.html");

/* Laatste presentation-consistencylaag. Deze stap introduceert geen nieuwe
   meteorologische berekeningen: hij ruimt aantoonbare presentatieconflicten
   op nadat hun canonieke owners al zijn geassembleerd.

   1. De oude senior-runtime overschreef de nieuwere daglichtbewuste zonurencopy.
   2. Nachtzicht kon 6/10 'Redelijk' combineren met een kaal 'Geen gunstig...'.
   3. Q4 labelt mobiel alleen de belangrijkste perioden; de aria-uitleg moet dat
      ook eerlijk zeggen, terwijl iedere bracket zijn eigen aria-label behoudt.
   4. Een bekende dagsom van 0,0 mm mag niet verdwijnen wanneer dezelfde dag nog
      een niet-nul neerslagkans heeft. Bij 0% + 0,0 mm blijft de rij wel compact.
   5. Als kans en 0,0 mm samen zichtbaar zijn, krijgt de weekverwachting een eigen
      uitlegregel. De bedieningshint blijft daardoor uitsluitend een instructie.
   6. Een temperatuurtrend die afgerond gelijk blijft toont geen betekenisloze
      pijl zoals 17 → 17 en zegt expliciet dat de temperatuur rond die waarde blijft. */
const ZON_RUNTIME_OUD=`      if(kop.textContent.trim()==="Zonuren"){
        const u=Number(String(val.textContent||"").replace(",",".").replace(/[^0-9.-]/g,""));
        const tekst=zonurenOordeelGetoond(u);if(tekst)sub.textContent=tekst;
      }else if(/^Pollen\\s+/i.test(kop.textContent)){`;
const ZON_RUNTIME_NIEUW=`      if(/^Pollen\\s+/i.test(kop.textContent)){`;

/* unified-weather-truth normaliseert vóór deze stap alle historische
   "Geen goed zichtvenster"-varianten naar "Geen gunstig kijkvenster". Daardoor
   staan hier in de definitieve artifact twee identieke beginvoorwaarden; vervang
   precies dat geassembleerde paar door één scorebewuste owner. */
const NACHT_OUD=`  if(/^Geen gunstig kijkvenster door /i.test(t))return /[.!?]$/.test(t)?t:t+".";
  if(/^Geen gunstig kijkvenster door /i.test(t))return t.replace(/^Geen gunstig kijkvenster/i,"Geen gunstig kijkvenster")+( /[.!?]$/.test(t)?"":".");`;
const NACHT_NIEUW=`  const geenVenster=/^Geen gunstig kijkvenster door (.+?)[.!?]*$/i.exec(t);
  if(geenVenster){
    const reden=geenVenster[1].trim();
    if(s!==null&&s>=5&&reden){
      const kwalificatie=s>=9?"Uitstekende":s>=7?"Goede":"Redelijke";
      return kwalificatie+" omstandigheden, maar door "+reden+" is er geen aaneengesloten gunstig kijkvenster.";
    }
    return "Geen gunstig kijkvenster door "+reden+".";
  }`;

const ARIA_OUD=`  const detailAria=g.n<=25?" Bij iedere regenperiode staat het tijdvak en de verwachte hoeveelheid.":"";`;
const ARIA_NIEUW=`  const detailAria=g.n<=25?(g.M?" De belangrijkste regenperioden zijn gelabeld; de overige blijven via de grafiekdetails beschikbaar.":" Bij iedere regenperiode staat het tijdvak en de verwachte hoeveelheid."):"";`;

/* Q1 kent zowel kans als dagsom. Exact nul is betekenisvolle bekende data zodra
   de kans groter dan nul is; bij volledig droog (0% + 0,0 mm) blijft de tweede
   regel bewust weg. Positieve spoorhoeveelheden blijven via de bestaande policy
   lopen en worden dus niet als 0,0 mm afgerond. */
const Q1_DAG_MM_OUD=`  const hoeveelheid=mm!==null&&mm>=0
    ? (mm===0?"0,0 mm":(typeof hoeveelheidFn==="function"?hoeveelheidFn(mm):mmTekst(mm))) : "";`;
const Q1_DAG_MM_NIEUW=`  const hoeveelheid=mm!==null&&(mm>=MM_MEETBAAR||(mm===0&&k!==null&&k>0))
    ? (mm===0?"0,0 mm":(typeof hoeveelheidFn==="function"?hoeveelheidFn(mm):mmTekst(mm))) : "";`;

/* De Q1-owner bepaalt richting op de afgeronde zichtbare waarden. Als beide
   waarden gelijk zijn is 17 → 17 geen trendinformatie. In dat geval tonen we
   één waarde en benoemen we de stabiele band eerlijk als 'rond 17 °C'. */
const TEMP_TREND_OUD=`  waarde.innerHTML=String(t.van)+" → "+String(t.naar)+"<s>°C</s>";
  sub.textContent=t.richting==="stijgt"?"Het wordt de komende uren warmer."
    :t.richting==="daalt"?"Het wordt de komende uren koeler."
    :"De temperatuur verandert de komende uren nauwelijks.";`;
const TEMP_TREND_NIEUW=`  if(t.richting==="gelijk"){
    waarde.innerHTML=String(t.van)+"<s>°C</s>";
    sub.textContent="De temperatuur blijft de komende uren rond "+String(t.van)+" °C.";
  }else{
    waarde.innerHTML=String(t.van)+" → "+String(t.naar)+"<s>°C</s>";
    sub.textContent=t.richting==="stijgt"?"Het wordt de komende uren warmer.":"Het wordt de komende uren koeler.";
  }`;

/* Voor vandaag gebruikt unified-weather-truth terecht de resterende lokale
   daganalyse in plaats van het ruwe daily totaal. Ook daar moet een bekende nul
   zichtbaar blijven wanneer er nog wél een niet-nul kans bestaat. */
const VANDAAG_DAG_MM_OUD=`      const dagMm=num(a&&a.hoeveelheid);
      if(a&&a.genoeg&&dagMm!==null&&dagMm>=0.1){
        const small=document.createElement("small");small.className="q1-dag-mm";small.textContent=hoeveelheidTekst(dagMm);kansEl.appendChild(small);
      }`;
const VANDAAG_DAG_MM_NIEUW=`      const dagMm=num(a&&a.hoeveelheid),dagKans=num(a&&a.kans);
      const toonDagMm=dagMm!==null&&(dagMm>=0.1||(dagMm===0&&dagKans!==null&&dagKans>0));
      if(a&&a.genoeg&&toonDagMm){
        const small=document.createElement("small");small.className="q1-dag-mm";small.textContent=dagMm===0?"0,0 mm":hoeveelheidTekst(dagMm);kansEl.appendChild(small);
      }`;

/* Deze wrapper wordt als allerlaatste runtime-owner vlak vóór start ingevoegd.
   Daardoor leest hij de werkelijk zichtbare kans na alle dagcorrecties, inclusief
   de resterende lokale dag voor Vandaag. Alleen als een rij echt xx% + 0,0 mm
   toont, verschijnt een aparte toelichting direct onder de vaste weekhint. */
const START_MARKER="/* ---------- start ---------- */";
const DAGEN_UITLEG_RUNTIME=`/* Finale uitleg bij niet-nul neerslagkans + 0,0 mm. */
function weatherNowDagenNeerslagUitleg(){
  const hint=document.getElementById("dagenhint");if(!hint)return;
  let uitleg=document.getElementById("dagenneerslaguitleg");
  const rij=[...document.querySelectorAll("#days .row.day:not(.kop)")].find(r=>{
    const mm=r.querySelector(".q1-dag-mm"),kansEl=r.querySelector(".drain");
    if(!mm||!kansEl||mm.textContent.trim()!=="0,0 mm")return false;
    const m=/(\\d+)%/.exec(kansEl.textContent||"");return !!m&&Number(m[1])>0;
  });
  if(!rij){if(uitleg)uitleg.remove();return;}
  if(!uitleg){
    uitleg=document.createElement("p");
    uitleg.id="dagenneerslaguitleg";
    uitleg.className="hint";
    uitleg.setAttribute("role","note");
    hint.insertAdjacentElement("afterend",uitleg);
  }
  const m=/(\\d+)%/.exec((rij.querySelector(".drain")||{}).textContent||"");
  const kans=m?m[1]+"%":"Een niet-nul kans";
  uitleg.textContent=kans+" kans met 0,0 mm betekent dat neerslag mogelijk is, maar dat de verwachte totale hoeveelheid voor die dag op één decimaal afrondt naar 0,0 mm.";
}
if(typeof dagen==="function"){
  const basisDagenNeerslagUitleg=dagen;
  dagen=function(){basisDagenNeerslagUitleg();weatherNowDagenNeerslagUitleg();};
}
`;

function vervangExact(bron,oud,nieuw,naam){
  const n=bron.split(oud).length-1;
  if(n!==1)throw new Error(naam+"-anker ontbreekt of is dubbel: "+n);
  return bron.replace(oud,nieuw);
}

let html=fs.readFileSync(PAD,"utf8");
if(html.includes('const geenVenster=/^Geen gunstig kijkvenster door'))
  throw new Error("Finale presentatieconsistentie staat al in de artifact.");
if(!html.includes("function weatherNowZonurenWoord(uur,daglichtUur){"))
  throw new Error("Canonieke daglichtbewuste zonuren-owner ontbreekt vóór finale consistentie.");
if(!html.includes("function q4MobieleGelabeldePerioden(perioden){"))
  throw new Error("Q4 mobiele betekenisselectie ontbreekt vóór finale consistentie.");

html=vervangExact(html,ZON_RUNTIME_OUD,ZON_RUNTIME_NIEUW,"legacy zonurenruntime");
html=vervangExact(html,NACHT_OUD,NACHT_NIEUW,"Nachtzicht venstercopy");
html=vervangExact(html,ARIA_OUD,ARIA_NIEUW,"Q4 aria-uitleg");
html=vervangExact(html,Q1_DAG_MM_OUD,Q1_DAG_MM_NIEUW,"Q1 bekende nul millimeter");
html=vervangExact(html,TEMP_TREND_OUD,TEMP_TREND_NIEUW,"Q1 gelijke temperatuurtrend");
html=vervangExact(html,VANDAAG_DAG_MM_OUD,VANDAAG_DAG_MM_NIEUW,"Vandaag bekende nul millimeter");
html=vervangExact(html,START_MARKER,DAGEN_UITLEG_RUNTIME+"\n"+START_MARKER,"weekuitleg nul millimeter");

/* Syntaxcontrole vóór schrijven: alle wijzigingen zitten in inline JS. */
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline scripts na finale presentatieconsistentie.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:final-presentatie-"+(i+1)}));
if(!html.includes('dagMm===0?"0,0 mm":hoeveelheidTekst(dagMm)'))
  throw new Error("Vandaag-presenteerder borgt bekende 0,0 mm niet.");
if(!html.includes('mm===0&&k!==null&&k>0'))
  throw new Error("Q1-presenteerder onderscheidt 0% droog niet van niet-nul kans bij 0,0 mm.");
if(!html.includes('sub.textContent="De temperatuur blijft de komende uren rond "+String(t.van)+" °C.";'))
  throw new Error("Gelijke temperatuurtrend wordt niet als stabiele temperatuur gepresenteerd.");
if(html.includes('De temperatuur verandert de komende uren nauwelijks.'))
  throw new Error("Oude vage copy voor gelijke temperatuurtrend staat nog in de artifact.");
if(!html.includes("function weatherNowDagenNeerslagUitleg(){"))
  throw new Error("Weekuitleg voor niet-nul kans met 0,0 mm ontbreekt.");
if(!html.includes('uitleg.id="dagenneerslaguitleg"'))
  throw new Error("Weekuitleg staat niet in een eigen uitlegregel.");

fs.writeFileSync(PAD,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"finale-presentatie");
console.log("Finale presentatieconsistentie toegepast: zonuren-owner hersteld, Nachtzicht genuanceerd, gelijke temperatuurtrend vereenvoudigd, mobiele regen-uitleg gelijkgetrokken en xx% + 0,0 mm zichtbaar én apart uitgelegd; cache "+versie+".");

module.exports={ZON_RUNTIME_OUD,ZON_RUNTIME_NIEUW,NACHT_OUD,NACHT_NIEUW,ARIA_OUD,ARIA_NIEUW,Q1_DAG_MM_OUD,Q1_DAG_MM_NIEUW,TEMP_TREND_OUD,TEMP_TREND_NIEUW,VANDAAG_DAG_MM_OUD,VANDAAG_DAG_MM_NIEUW,START_MARKER,DAGEN_UITLEG_RUNTIME,vervangExact};
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
   5. Als kans en 0,0 mm samen zichtbaar zijn, krijgt de weekverwachting een korte
      uitlegregel zonder technische modelparagraaf.
   6. Een temperatuurtrend die afgerond gelijk blijft toont geen betekenisloze
      pijl zoals 17 → 17 en zegt expliciet dat de temperatuur rond die waarde blijft.
   7. Nachtzicht toont ook op desktop eerst drie nachten, met dezelfde bestaande
      uitklapbediening als mobiel; alle rijen blijven in de DOM.
   8. Buiten Europa heet de AQI expliciet 'AQI (VS-schaal)' in plaats van het
      dubbelzinnige 'Amerikaanse AQI'.
   9. De briefing benoemt een windpiek en zware windstoten in twee korte zinnen,
      zonder dubbele dagaanduiding of technisch 'in het uur'-proza.
  10. De desktop-etmaalgrafiek houdt extrema en echte veranderingen, maar laat
      overbodige identieke afgeronde rasterlabels wijken. */
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

/* De bestaande mobiele Nachtzicht-owner bevat al een toegankelijke knop en
   bewaart alle zes rijen in de DOM. De finale productpresentatie gebruikt die
  zelfde compactheid nu ook op desktop. */
const NACHT_COMPACT_OUD=`function nachtzichtCompactAantal(totaal,mobiel){
  const n=Math.max(0,Math.floor(Number(totaal)||0));
  return mobiel?Math.min(3,n):n;
}`;
const NACHT_COMPACT_NIEUW=`function nachtzichtCompactAantal(totaal,mobiel){
  const n=Math.max(0,Math.floor(Number(totaal)||0));
  return Math.min(3,n);
}`;
const NACHT_COMPACT_IF_OUD='  if(!mobiel||rijen.length<=zichtbaar){';
const NACHT_COMPACT_IF_NIEUW='  if(rijen.length<=zichtbaar){';
const NACHT_COMPACT_CSS_OUD='#nights .nacht-meer{display:none}';
const NACHT_COMPACT_CSS_NIEUW=`#nights .row.night[hidden]{display:none!important}
#nights .nacht-meer{
  display:block;width:100%;margin:4px 0 0;padding:12px 0 3px;border:0;border-top:1px solid var(--rule);
  text-align:left;color:var(--ink-70);background:transparent;font-family:var(--sans);font-size:11px;
  font-weight:500;letter-spacing:.1em;text-transform:uppercase
}
#nights .nacht-meer:hover{color:var(--ink);border-top-color:var(--ink)}`;

const AQI_OUD='  const schaalIndex = euro ? "Europese AQI" : "Amerikaanse AQI";';
const AQI_NIEUW='  const schaalIndex = euro ? "Europese AQI" : "AQI (VS-schaal)";';

const WIND_BRIEFING_OUD=`    if(opvallendeWind){
      const moment=wi>i+1
        ? dagAanduiding(h.time[wi],true)+" rond "+hhmm(h.time[wi])
        : "De komende 24 uur";
      zin3+=(zin3?" ":"")+moment+" is de wind op zijn sterkst met <b>"+bm+" Bft</b> ("+BFTNAAM[bm]+")";
      zin3+=gmax!==null&&gmax>=60&&gi!==null?"; "+dagAanduiding(h.time[gi],true)+" in het uur "+weatherNowUurvak(h.time[gi])+" kunnen windstoten tot "+Math.round(gmax)+" km/u voorkomen.":".";
    }`;
const WIND_BRIEFING_NIEUW=`    if(opvallendeWind){
      const windDag=wi>i+1?dagAanduiding(h.time[wi],true):"";
      const moment=windDag?windDag+" rond "+hhmm(h.time[wi]):"In de komende 24 uur";
      zin3+=(zin3?" ":"")+moment+" is de wind het sterkst, met <b>"+bm+" Bft</b> ("+BFTNAAM[bm]+").";
      if(gmax!==null&&gmax>=60&&gi!==null){
        const gustDag=dagAanduiding(h.time[gi],true);
        const zelfdeDag=windDag&&gustDag===windDag;
        const gustMoment=(zelfdeDag?"":gustDag.toLowerCase()+" ")+"tussen "+weatherNowUurvak(h.time[gi]).replace("–"," en ");
        zin3+=" Windstoten kunnen "+gustMoment+" oplopen tot "+Math.round(gmax)+" km/u.";
      }
    }`;

/* Mobiel gebruikt al een rustige zes-uursselectie. Desktop heeft meer ruimte,
   maar hoeft identieke afgeronde temperaturen op nabije vaste rasterpunten niet
   telkens opnieuw te schrijven. Extrema en prominente lokale punten blijven. */
const GRAFIEK_LABELS_OUD='  let kandidaten=n<=24?(M?kandidatenRuw.filter(k=>k.rang>1||(k.i%6===0&&!kandidatenRuw.some(g=>g.rang>1&&Math.abs(g.i-k.i)<=1))):kandidatenRuw):kandidatenRuw.filter((k,pos)=>{';
const GRAFIEK_LABELS_NIEUW=`  let kandidaten=n<=24?(M
    ?kandidatenRuw.filter(k=>k.rang>1||(k.i%6===0&&!kandidatenRuw.some(g=>g.rang>1&&Math.abs(g.i-k.i)<=1)))
    :kandidatenRuw.filter((k,pos,alle)=>{
      if(k.rang!==1)return true;
      const afgerond=Math.round(T[k.i]);
      const belangrijkNabij=kandidatenRuw.some(g=>g.rang>1&&Math.abs(g.i-k.i)<=stap&&Math.round(T[g.i])===afgerond);
      if(belangrijkNabij)return false;
      return !alle.slice(0,pos).some(g=>g.rang===1&&g.i<k.i&&k.i-g.i<=stap*2&&Math.round(T[g.i])===afgerond);
    })
  ):kandidatenRuw.filter((k,pos)=>{`;

/* Deze wrapper wordt als allerlaatste runtime-owner vlak vóór start ingevoegd.
   Daardoor leest hij de werkelijk zichtbare kans na alle dagcorrecties, inclusief
   de resterende lokale dag voor Vandaag. Alleen als een rij echt xx% + 0,0 mm
   toont, verschijnt een korte toelichting direct onder de vaste weekhint. */
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
  const kans=m?m[1]+"% kans":"Neerslag mogelijk";
  uitleg.textContent=kans+" · geen meetbare hoeveelheid verwacht.";
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
html=vervangExact(html,NACHT_COMPACT_OUD,NACHT_COMPACT_NIEUW,"Nachtzicht compactaantal");
html=vervangExact(html,NACHT_COMPACT_IF_OUD,NACHT_COMPACT_IF_NIEUW,"Nachtzicht desktopuitklap");
html=vervangExact(html,NACHT_COMPACT_CSS_OUD,NACHT_COMPACT_CSS_NIEUW,"Nachtzicht desktopstijl");
html=vervangExact(html,AQI_OUD,AQI_NIEUW,"AQI schaallabel");
html=vervangExact(html,WIND_BRIEFING_OUD,WIND_BRIEFING_NIEUW,"briefing windcopy");
html=vervangExact(html,GRAFIEK_LABELS_OUD,GRAFIEK_LABELS_NIEUW,"desktop grafieklabelselectie");
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
if(html.includes("Amerikaanse AQI")||!html.includes("AQI (VS-schaal)"))
  throw new Error("Niet-Europese AQI-schaal wordt niet ondubbelzinnig gepresenteerd.");
if(!html.includes('return Math.min(3,n);')||html.includes('if(!mobiel||rijen.length<=zichtbaar){'))
  throw new Error("Nachtzicht is niet op alle schermformaten standaard compact.");
if(!html.includes('Windstoten kunnen "+gustMoment+" oplopen tot '))
  throw new Error("Compacte briefingcopy voor zware windstoten ontbreekt.");
if(!html.includes("const belangrijkNabij=kandidatenRuw.some"))
  throw new Error("Desktop-grafiekfilter voor redundante temperatuurcijfers ontbreekt.");

fs.writeFileSync(PAD,html,"utf8");
const versie=vernieuwServiceworkerCache(OUT,"finale-presentatie");
console.log("Finale presentatieconsistentie toegepast: zonuren-owner hersteld, Nachtzicht genuanceerd en compact, gelijke temperatuurtrend vereenvoudigd, 0,0-mm-uitleg ingekort, AQI-schaal verduidelijkt, briefingwindcopy aangescherpt en redundante desktop-temperatuurlabels verminderd; cache "+versie+".");

module.exports={
  ZON_RUNTIME_OUD,ZON_RUNTIME_NIEUW,NACHT_OUD,NACHT_NIEUW,ARIA_OUD,ARIA_NIEUW,
  Q1_DAG_MM_OUD,Q1_DAG_MM_NIEUW,TEMP_TREND_OUD,TEMP_TREND_NIEUW,VANDAAG_DAG_MM_OUD,VANDAAG_DAG_MM_NIEUW,
  NACHT_COMPACT_OUD,NACHT_COMPACT_NIEUW,NACHT_COMPACT_IF_OUD,NACHT_COMPACT_IF_NIEUW,NACHT_COMPACT_CSS_OUD,NACHT_COMPACT_CSS_NIEUW,
  AQI_OUD,AQI_NIEUW,WIND_BRIEFING_OUD,WIND_BRIEFING_NIEUW,GRAFIEK_LABELS_OUD,GRAFIEK_LABELS_NIEUW,
  START_MARKER,DAGEN_UITLEG_RUNTIME,vervangExact
};
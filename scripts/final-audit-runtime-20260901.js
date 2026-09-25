/* Finale gecombineerde audit-runtime 2026-09-01. */
(function(root){
"use strict";
const A=root.WeatherNowFinalAudit20260901;
if(!A||typeof document==="undefined")return;

function bouwTopGrid(){
  if(document.querySelector(".final-top-grid"))return;
  const brief=document.getElementById("brief"),warnings=document.getElementById("waarschuwingen"),dash=document.querySelector(".dashrow-hero"),hero=dash&&dash.querySelector(":scope > .hero"),stats=dash&&dash.querySelector(":scope > .stats");
  if(!brief||!warnings||!dash||!hero||!stats||!brief.parentNode)return;
  const grid=document.createElement("div"),left=document.createElement("div");
  grid.className="final-top-grid";left.className="final-top-left";
  brief.parentNode.insertBefore(grid,brief);
  left.appendChild(brief);left.appendChild(warnings);left.appendChild(hero);
  grid.appendChild(left);grid.appendChild(stats);
  /* Het modelsignaal hoort bij de meetgegevens: als laatste in het raster.
     Op mobiel blijft de volgorde gelijk (na de tegels); op desktop zet de
     indelingslaag het rechts onder de tegels, waar anders een lege strook
     bleef. */
  const model=document.getElementById("modelrisico");if(model)grid.appendChild(model);
  if(dash.parentNode)dash.remove();
}

/* Tegels in één rij: labels van gelijke hoogte (de langste bepaalt), zodat
   labels en getallen op één lijn staan, ook als één label afbreekt. */
let tegelResizeGebonden=false,tegelFrame=0;
function lijnTegelsUit(){
  /* Ook hier, één frame na de render: latere tegelwrappers schrijven de
     UV-regel nog over. */
  avondTegels();beperkTegels();
  const stats=document.querySelector(".final-top-grid>.stats")||document.querySelector(".stats");if(!stats)return;
  const labels=[...stats.children].filter(el=>el.classList&&el.classList.contains("stat")&&!el.hidden).map(t=>t.querySelector(":scope>.eyebrow")).filter(Boolean);
  labels.forEach(e=>{e.style.minHeight="";});
  const rijen=new Map();
  labels.forEach(e=>{const r=e.parentElement.getBoundingClientRect();if(!r.height)return;const k=Math.round(r.top);if(!rijen.has(k))rijen.set(k,[]);rijen.get(k).push(e);});
  rijen.forEach(rij=>{if(rij.length<2)return;const max=Math.max(...rij.map(e=>e.getBoundingClientRect().height));rij.forEach(e=>{if(e.getBoundingClientRect().height<max-0.5)e.style.minHeight=max+"px";});});
  stats.setAttribute("data-tegels-uitgelijnd","1");
}
function planTegelUitlijning(){
  if(typeof requestAnimationFrame!=="function"){lijnTegelsUit();return;}
  cancelAnimationFrame(tegelFrame);tegelFrame=requestAnimationFrame(lijnTegelsUit);
  if(!tegelResizeGebonden){
    tegelResizeGebonden=true;window.addEventListener("resize",planTegelUitlijning,{passive:true});
    const f=document.fonts&&document.fonts.ready;if(f&&typeof f.then==="function")f.then(planTegelUitlijning).catch(()=>{});
  }
}

function regenSamenvattingBijwerken(){
  const svg=document.getElementById("chart"),g=typeof S!=="undefined"&&S.geo,h=typeof S!=="undefined"&&S.d&&S.d.hourly;
  if(!svg||!g||!h||!Array.isArray(g.TI))return;
  let el=document.getElementById("final-rain-summary");
  if(!el){el=document.createElement("p");el.id="final-rain-summary";el.className="final-rain-summary";svg.insertAdjacentElement("afterend",el);}
  const perioden=A.regenperiodenVoorGrafiek({
    grafiekTijden:g.TI,bronTijden:h.time,neerslag:h.precipitation,
    bronStart:Number.isInteger(S.chartStart)?S.chartStart:null,
    actueelBronIndex:Number.isInteger(S.i0)?S.i0:null,
    toonVerstreken:S.dag!=null,meetbaarMm:0.1
  });
  const tekst=A.regenSamenvatting(perioden,2);
  el.textContent=tekst;el.hidden=!tekst;
  if(tekst)el.setAttribute("role","note");else el.removeAttribute("role");
}

function gesprokenNeerslag(zichtbaar){
  const t=String(zichtbaar||"").replace(/\s+/g," ").trim(),delen=[];
  const kans=/(\d{1,3})\s*%/.exec(t);if(kans)delen.push(kans[1]+" procent");
  const mm=/([<>]?\s*\d+(?:[.,]\d+)?)\s*mm\b/i.exec(t);
  if(mm){let v=mm[1].replace(/\s+/g,"").replace("<","minder dan ").replace(">","meer dan ");delen.push(v+" millimeter");}
  return delen.join("; ");
}

/* De weektabel heeft historisch meerdere dagen()-wrappers. De finale globale
   correctheidslaag voegt bij een bekende kans zonder zichtbare hoeveelheid
   terecht "hoeveelheid onzeker" toe, maar een latere/directe dagen()-render kan
   de inhoud van .drain opnieuw opbouwen. Deze audit-runtime is de laatste
   dagen()-owner en borgt daarom dezelfde eindstate na iedere weekrender. Er
   verandert niets aan providerdata, kans, dagsom of drempels. */
function herstelWeekNeerslagEindstate(){
  document.querySelectorAll("#days .row.day:not(.kop)").forEach(rij=>{
    const vak=rij.querySelector(".drain");if(!vak)return;
    const match=/(\d{1,3})%/.exec(vak.textContent||""),kans=match?Number(match[1]):null;
    let hoeveelheid=vak.querySelector("small,.q1-dag-mm");
    if(kans!==null&&kans>0&&!hoeveelheid){
      hoeveelheid=document.createElement("small");
      hoeveelheid.className="wiw-dag-onzeker";
      hoeveelheid.textContent="hoeveelheid onzeker";
      vak.appendChild(hoeveelheid);
    }
    const delen=[];
    if(kans!==null)delen.push("Neerslagkans "+kans+" procent");
    if(hoeveelheid&&hoeveelheid.textContent.trim())delen.push(hoeveelheid.textContent.trim());
    if(!delen.length&&/^[-–—]$/.test(vak.textContent.trim()))delen.push("Neerslaggegevens niet beschikbaar");
    if(delen.length)vak.setAttribute("aria-label",delen.join("; "));
  });
}

function verduidelijkVandaag(){
  const hint=document.getElementById("dagenhint"),day=typeof S!=="undefined"&&S.d&&S.d.daily,current=typeof S!=="undefined"&&S.d&&S.d.current;
  if(hint&&!hint.dataset.finalTodayWindow){
    hint.textContent="Kies een dag om die verwachting in de grafiek te bekijken.";
    hint.dataset.finalTodayWindow="1";
  }
  if(!day||!current||!Array.isArray(day.time))return;
  const vandaag=String(current.time||"").slice(0,10),i=day.time.indexOf(vandaag);
  if(i<0)return;
  const rij=document.querySelector('#days .row.day[data-i="'+i+'"]'),drain=rij&&rij.querySelector(".drain");
  if(!rij||!drain)return;
  // Geen extra zichtbare uitleg boven de weektabel. De bestaande rijgebonden
  // schermlezerbeschrijving en alle datum-/neerslagberekeningen blijven intact.
  let beschrijving=document.getElementById("final-today-row-description");
  if(!beschrijving){beschrijving=document.createElement("span");beschrijving.id="final-today-row-description";beschrijving.className="sr-only";rij.insertAdjacentElement("afterend",beschrijving);}
  const neerslag=gesprokenNeerslag(drain.textContent);
  beschrijving.textContent=(neerslag?"Neerslag vandaag vanaf nu: "+neerslag+". ":"")+"Minimum en maximum gelden voor de volledige kalenderdag.";
  const bestaand=String(rij.getAttribute("aria-describedby")||"").trim().split(/\s+/).filter(Boolean).filter(x=>x!==beschrijving.id);
  bestaand.push(beschrijving.id);rij.setAttribute("aria-describedby",bestaand.join(" "));
  /* Bewust géén aria-label op de rij: de bestaande rij-inhoud/naam blijft
     daardoor verwachting, wind, minimum, maximum, kans en hoeveelheid bevatten. */
}

function finaliseerWeekNaRender(){herstelWeekNeerslagEindstate();verduidelijkVandaag();}

function isNwsWaarschuwing(w){
  if(/^(US|PR|VI|GU|MP|AS)$/i.test(String(typeof S!=="undefined"&&S.land||"")))return true;
  return /\*\s*(?:WHAT|WHERE|WHEN|IMPACTS)\.\.\./i.test(String(w&&w.tekst||""));
}
function officiëleNwsUrl(waarde){
  try{const u=new URL(String(waarde||""));const h=u.hostname.toLowerCase();return u.protocol==="https:"&&(h==="weather.gov"||h.endsWith(".weather.gov"))?u.href:"";}catch(_){return "";}
}
function verrijkNwsWaarschuwingen(){
  if(typeof S==="undefined"||!Array.isArray(S.actieveWaarschuwingen))return;
  const cards=[...document.querySelectorAll("#waarschuwingen .waarsch")],items=S.actieveWaarschuwingen.slice(0,3);
  cards.forEach((card,i)=>{
    const w=items[i];if(!w||!isNwsWaarschuwing(w))return;
    const tekst=String(w.tekst||"").trim(),titel=String(w.titel||"").trim(),u=A.nwsUitleg(titel,tekst);
    const nlTitel=u.titel&&u.titel!==titel?u.titel:"Officiële weerwaarschuwing";
    const geldig=w.tot&&typeof waarschuwingGeldigTot==="function"?waarschuwingGeldigTot(w.tot):null;
    const niveau=card.getAttribute("data-ui-severity");card.replaceChildren();if(niveau)card.setAttribute("data-ui-severity",niveau);
    const h3=document.createElement("h3");h3.textContent=nlTitel;card.appendChild(h3);
    const meta=[];if(geldig)meta.push("Geldig tot "+geldig+".");if(w.landelijk)meta.push("Geldt voor een groter gebied, niet per se voor deze plaats.");
    if(meta.length){const p=document.createElement("p");p.className="waarsch-meta";p.textContent=meta.join(" ");card.appendChild(p);}
    const uitleg=document.createElement("p");uitleg.className="final-warning-explanation";
    const strong=document.createElement("strong");strong.textContent="Uitleg van watishetweer.nl: ";uitleg.appendChild(strong);uitleg.appendChild(document.createTextNode(u.uitleg));card.appendChild(uitleg);
    /* Behoud naast de finale class ook het al bestaande staff-auditcontract.
       Zo blijft officiële titel/bron via dezelfde semantische container vindbaar,
       terwijl de uitgebreide officiële NWS-tekst dezelfde details gebruikt. */
    const details=document.createElement("details");details.className="waarsch-details waarsch-officieel-details";
    const summary=document.createElement("summary");summary.textContent="Officiële tekst van de National Weather Service";details.appendChild(summary);
    const bron=document.createElement("p");bron.className="final-warning-official-meta";bron.appendChild(document.createTextNode("Officiële titel: "));
    const officiëleTitel=document.createElement("span");officiëleTitel.lang="en";officiëleTitel.textContent=titel||"Weather alert";bron.appendChild(officiëleTitel);bron.appendChild(document.createTextNode(" · Bron: National Weather Service"));details.appendChild(bron);
    const officieel=document.createElement("p");officieel.lang="en";officieel.className="final-warning-official-text";officieel.textContent=tekst||"Official warning text unavailable.";details.appendChild(officieel);card.appendChild(details);
    const url=officiëleNwsUrl(w.url);if(url){const link=document.createElement("a");link.className="final-warning-source";link.href=url;link.target="_blank";link.rel="noopener";link.textContent="Bekijk deze waarschuwing bij de officiële bron";card.appendChild(link);}
  });
}

let warningUiRun=0,warningUiTimer=null;
function wrapWaarschuwingen(){
  if(typeof waarschuwingen!=="function"||waarschuwingen.__finalAuditWrapped)return;
  const basis=waarschuwingen;
  const wrapped=async function(){
    const run=++warningUiRun;if(warningUiTimer!==null){clearTimeout(warningUiTimer);warningUiTimer=null;}
    let resultaat;
    try{
      resultaat=basis.apply(this,arguments);
      warningUiTimer=setTimeout(()=>{
        if(run!==warningUiRun)return;
        const root=document.getElementById("waarschuwingen");if(!root)return;
        const loading=root.querySelector('[data-ui-warning-loading="1"]')||[...root.children].find(el=>el.classList&&el.classList.contains("msg")&&/waarschuwingen controleren/i.test(el.textContent||""));
        if(loading&&/controleren/i.test(loading.textContent||""))loading.textContent="Officiële weerwaarschuwingen controleren; dit kan even duren.";
      },3000);
      return await resultaat;
    }finally{
      if(run===warningUiRun){if(warningUiTimer!==null)clearTimeout(warningUiTimer);warningUiTimer=null;verrijkNwsWaarschuwingen();}
    }
  };
  wrapped.__finalAuditWrapped=true;waarschuwingen=wrapped;
}

let drukResizeGebonden=false;
function bouwMeetgegevens(){
  const pres=document.getElementById("pres");if(!pres)return;
  let details=document.getElementById("wiw-more-measurements");
  if(!details){
    const stat=pres.closest(".stat"),diag=document.getElementById("wiw-pressure-diagnostic"),anker=document.querySelector(".final-top-grid")||document.querySelector(".dashrow-hero");if(!stat||!anker||!anker.parentNode)return;
    details=document.createElement("details");details.id="wiw-more-measurements";details.className="wiw-more-measurements";
    const summary=document.createElement("summary");summary.textContent="Meer meetgegevens";details.appendChild(summary);
    const body=document.createElement("div");body.className="wiw-more-measurements-body";body.appendChild(stat);details.appendChild(body);anker.insertAdjacentElement("afterend",details);
    if(diag&&diag.parentNode)diag.remove();
    const betekenis=document.createElement("p");betekenis.className="wiw-pressure-meaning";betekenis.textContent="Herleid tot zeeniveau zodat luchtdruk tussen locaties vergelijkbaar is.";stat.appendChild(betekenis);
    details.addEventListener("toggle",()=>{if(details.dataset.syncing!=="1")details.dataset.userChoice="1";});
  }
  const sync=()=>{if(details.dataset.userChoice==="1")return;details.dataset.syncing="1";details.open=window.innerWidth>=901;delete details.dataset.syncing;};sync();
  if(!drukResizeGebonden){drukResizeGebonden=true;window.addEventListener("resize",sync,{passive:true});}
}

function naRender(basis,fn){return function(){const r=basis.apply(this,arguments);fn();return r;};}

/* Na zonsondergang zeggen "UV-piek vandaag" en "zonuren vandaag" niets meer:
   dan tonen die tegels morgen, net zoals "Tijd tot zonsopkomst" dat doet. */
function indexMorgenNaZonsondergang(){
  const day=S.d&&S.d.daily;if(!day||!Array.isArray(day.time)||typeof plaatsVandaag!=="function")return null;
  const i=day.time.indexOf(plaatsVandaag());if(i<0||i+1>=day.time.length)return null;
  const ss=Array.isArray(day.sunset)?day.sunset[i]:null,nu=typeof weatherNowActueleLokaleTijd==="function"?weatherNowActueleLokaleTijd():null;
  if(!ss||!nu||String(nu).slice(0,16)<String(ss).slice(0,16))return null;
  return i+1;
}
function tegelMet(houder,kop){return [...document.querySelectorAll(houder+" .stat")].find(t=>{const e=t.querySelector(".eyebrow");return e&&e.textContent.trim()===kop;})||null;}
function uvMorgen(){
  const uvEl=document.getElementById("uv"),m=indexMorgenNaZonsondergang(),tegel=uvEl&&uvEl.closest(".stat");if(m===null||!tegel)return;
  const day=S.d.daily,uren=S.d.hourly,datum=day.time[m];
  let piek=null;
  if(uren&&Array.isArray(uren.time)&&Array.isArray(uren.uv_index))uren.time.forEach((t,k)=>{const v=Number(uren.uv_index[k]);if(String(t).slice(0,10)===datum&&Number.isFinite(v)&&(!piek||v>piek.v))piek={v,t};});
  if(!piek&&Array.isArray(day.uv_index_max)&&Number.isFinite(Number(day.uv_index_max[m])))piek={v:Number(day.uv_index_max[m]),t:null};
  if(!piek)return;
  /* WHO-indeling van de UV-index, zoals op de dagtegel. */
  const w=Math.round(Math.max(0,piek.v)),oordeel=typeof uvOordeelGetoond==="function"?uvOordeelGetoond(w):w<=2?"laag":w<=5?"matig":w<=7?"hoog":w<=10?"zeer hoog":"extreem";
  tegel.querySelector(".eyebrow").textContent="UV-piek morgen";
  const val=tegel.querySelector(".sval"),sub=tegel.querySelector(".ssub");
  if(val)val.textContent=String(w);
  if(sub)sub.textContent=piek.v<0.5?"Nauwelijks UV verwacht morgen."
    :"Verwachte UV-piek"+(piek.t?" rond "+String(piek.t).slice(11,16):"")+(oordeel?" · "+oordeel:"")+".";
}
function zonurenMorgen(){
  const m=indexMorgenNaZonsondergang(),tegel=document.querySelector("#aq .stat.zon");if(m===null||!tegel)return;
  const day=S.d.daily,sec=Array.isArray(day.sunshine_duration)?Number(day.sunshine_duration[m]):NaN;if(!Number.isFinite(sec)||sec<0)return;
  const uur=sec/3600,sr=Array.isArray(day.sunrise)?day.sunrise[m]:null,ss=Array.isArray(day.sunset)?day.sunset[m]:null;
  const minuten=sr&&ss&&typeof mins==="function"?mins(ss)-mins(sr):NaN,daglicht=Number.isFinite(minuten)&&minuten>0?minuten/60:null;
  const woord=typeof weatherNowZonurenWoord==="function"?weatherNowZonurenWoord(uur,daglicht):"";
  tegel.querySelector(".eyebrow").textContent="Zonuren morgen";
  const val=tegel.querySelector(".sval"),sub=tegel.querySelector(".ssub");
  if(val)val.innerHTML=(typeof nl==="function"?nl(uur):uur.toFixed(1).replace(".",","))+"<s>uur</s>";
  if(sub&&woord)sub.textContent=woord.replace(/vandaag/g,"morgen");
}
function avondTegels(){try{uvMorgen();zonurenMorgen();}catch(_){}}

/* Pollen: een niveau per soort volgens de pollenschaal van het National
   Allergy Bureau (AAAAI), in korrels per kubieke meter lucht. Tussen 10 en
   200 korrels zei de tegel eerder niets ("Pollen verwacht voor dit uur"),
   terwijl 160 graspollen voor hooikoorts veel is. Een waarde van 0 houdt de
   bestaande tekst ("geen pollen"). */
const POLLEN_SCHAAL={gras:[5,20,200],berk:[15,90,1500],els:[15,90,1500],olijf:[15,90,1500],bijvoet:[10,50,500],ambrosia:[10,50,500]};
const POLLEN_WOORD={gras:"graspollen",berk:"berkenpollen",els:"elzenpollen",olijf:"olijfpollen",bijvoet:"bijvoetpollen",ambrosia:"ambrosiapollen"};
const POLLEN_BRON=" Het niveau (weinig tot zeer veel) volgt de pollenschaal van het National Allergy Bureau (AAAAI).";
function pollenNiveau(){
  try{
    document.querySelectorAll("#aq .stat").forEach(t=>{
      const kop=t.querySelector(".eyebrow"),val=t.querySelector(".sval"),sub=t.querySelector(".ssub");if(!kop||!val||!sub)return;
      const k=String(kop.textContent||"").trim().toLowerCase(),soort=Object.keys(POLLEN_SCHAAL).find(s=>k===s+"pollen"||k===POLLEN_WOORD[s]||k==="pollen "+s);if(!soort)return;
      const ruw=String(val.textContent||"").replace(",","."),minder=/<\s*1/.test(ruw),m=ruw.match(/\d+(?:\.\d+)?/),v=minder?0.5:m?Number(m[0]):null;
      if(v===null||v<=0){val.removeAttribute("data-pollen-niveau");return;}
      const [matig,hoog,zeer]=POLLEN_SCHAAL[soort],niveau=v<matig?"laag":v<hoog?"matig":v<zeer?"hoog":"zeer hoog";
      const woord={laag:"Weinig",matig:"Matig veel",hoog:"Veel","zeer hoog":"Zeer veel"}[niveau];
      sub.textContent=woord+" "+POLLEN_WOORD[soort]+" verwacht voor dit uur.";
      val.setAttribute("data-pollen-niveau",niveau);
    });
    const uitleg=[...document.querySelectorAll("#app p, #app .hint")].find(el=>/^Pollenwaarden zijn een verwachting van CAMS/.test(String(el.textContent||"").trim()));
    if(uitleg&&!/National Allergy Bureau/.test(uitleg.textContent))uitleg.textContent=String(uitleg.textContent).trim()+POLLEN_BRON;
  }catch(_){}
}
let luchtFrame=0;
function naLucht(){
  avondTegels();pollenNiveau();
  /* Latere luchtwrappers schrijven de subregels nog over; één frame later
     nogmaals. */
  if(typeof requestAnimationFrame==="function"){cancelAnimationFrame(luchtFrame);luchtFrame=requestAnimationFrame(()=>{avondTegels();pollenNiveau();});}
}

/* Zes tegels in plaats van acht. "Tijd tot zonsondergang/-opkomst" staat al
   boven de grafiek (zon op en onder); "Zicht" zegt alleen iets als het zicht
   beperkt is (minder dan 4 km), bij mist of zware buien. Verborgen tegels
   gaan achteraan, zodat de randen per rij kloppen. */
function beperkTegels(){
  const stats=document.querySelector(".final-top-grid>.stats")||document.querySelector("#app .stats:not(#aq)");if(!stats)return;
  const zon=tegelMet(".stats","Tijd tot zonsondergang")||tegelMet(".stats","Tijd tot zonsopkomst");
  const visEl=document.getElementById("vis"),zicht=visEl&&visEl.closest(".stat");
  const visTekst=visEl?String(visEl.textContent||"").trim():"",visKm=parseFloat(visTekst.replace(",","."));
  const zichtNuttig=!!visTekst&&!/^10\+/.test(visTekst)&&Number.isFinite(visKm)&&visKm<4;
  const verberg=(t,ja)=>{if(!t)return;t.hidden=ja;if(ja)t.setAttribute("data-tegel-verborgen","1");else t.removeAttribute("data-tegel-verborgen");};
  verberg(zon,true);verberg(zicht,!zichtNuttig);
  [...stats.children].filter(t=>t.hidden&&t.classList.contains("stat")).forEach(t=>stats.appendChild(t));
  stats.setAttribute("data-tegels",String([...stats.children].filter(t=>t.classList.contains("stat")&&!t.hidden).length));
}

bouwTopGrid();bouwMeetgegevens();wrapWaarschuwingen();planTegelUitlijning();
if(typeof meters==="function")meters=naRender(meters,()=>{avondTegels();beperkTegels();planTegelUitlijning();});
if(typeof lucht==="function")lucht=naRender(lucht,naLucht);
if(typeof etmaal==="function")etmaal=naRender(etmaal,regenSamenvattingBijwerken);
if(typeof dagen==="function")dagen=naRender(dagen,finaliseerWeekNaRender);
if(typeof tekenAlles==="function")tekenAlles=naRender(tekenAlles,finaliseerWeekNaRender);
regenSamenvattingBijwerken();finaliseerWeekNaRender();verrijkNwsWaarschuwingen();avondTegels();beperkTegels();naLucht();
})(typeof globalThis!=="undefined"?globalThis:this);

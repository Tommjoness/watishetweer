"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");
const OUT=path.join(__dirname,"..","public");
const html=fs.readFileSync(path.join(OUT,"index.html"),"utf8");
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log("OK  "+m);};

ok(html.includes("/* ===== Q4 REGENPERIODEN 20260811 ===== */"),"Q4-laag staat in definitieve artifact");
const q4RuntimePos=html.indexOf("const q4BasisEtmaal=etmaal;");
const startupPos=html.indexOf("/* ---------- start ---------- */");
ok(q4RuntimePos>=0&&startupPos>q4RuntimePos,"Q4-runtime is actief vóór de algemene startup-router");
ok(html.includes("if(i===0)return null;"),"eerste neerslaginterval buiten grafiekvenster telt niet mee");
ok(html.includes("waarde!==null&&waarde>=0.1"),"regenperiode begint pas bij meetbare 0,1 mm");
ok(html.includes("lopend={van:i-1,tot:i"),"hoeveelheid op eindtijd wordt aan voorafgaand uurvak gekoppeld");
ok(html.includes("const bronStart=Number.isInteger(S.chartStart)?S.chartStart:null;"),"regenperioden gebruiken de exacte zichtbare bronindex");
ok(html.includes("const bron=bronStart===null?-1:bronStart+i;"),"ieder zichtbaar uur volgt forecastvolgorde zonder lokale indexOf");
ok(!html.includes("const bron=Array.isArray(h.time)?h.time.indexOf(tijd):-1;"),"Q4 gebruikt bij dubbele DST-kloktijden geen indexOf op lokale tijdtekst");
ok(html.includes("g.MM=mm;\n  g.Q1MM=mm;"),"regenstrook en tooltip krijgen exact dezelfde uitgelijnde array");
ok(html.includes("lopend.som+=waarde"),"periodetotaal is som van dezelfde uurintervallen");
ok(html.includes("waarde>lopend.piekMm"),"zwaarste uurvak blijft intern uit dezelfde periodegegevens beschikbaar");
ok(html.includes('data-q4-rain-periods'),"regenperioden hebben een eigen herkenbare SVG-laag");
ok(html.includes('groep.setAttribute("pointer-events","none")'),"regenlaag kan het centrale hitvlak nooit onderscheppen");
ok(html.includes('document.createElementNS(Q4_SVG_NS,"line")'),"regenbrackets worden als echte SVG-lijnen opgebouwd");
ok(html.includes('document.createElementNS(Q4_SVG_NS,"text")'),"regenlabels worden als echte SVG-tekst opgebouwd");
ok(!html.includes("groep.innerHTML=inhoud"),"Q4 gebruikt geen fragiele SVG-innerHTML-injectie meer");
ok(html.includes('el.getAttribute("fill-opacity")===".16"')&&html.includes("el.remove();"),"oude losse neerslagstaven worden na render verwijderd");
ok(html.includes("millimeter neerslag$/.test")&&html.includes("el.remove();"),"oude losse mm-labels worden na render verwijderd");
ok(!html.includes("function q4KansIndex(g,x)"),"ongebruikte statische-kanspositionering is uit de Q4-runtime verwijderd");
ok(html.includes('!el.closest("#scrub")&&/^\\d+%$/.test((el.textContent||"").trim())')&&html.includes("el.remove();"),"statische neerslagpercentages worden semantisch uit de tijdlijn verwijderd zonder de interactieve tooltip te raken");
ok(html.includes("function q4PeriodeBedragLabels(g,perioden,eersteY,font)"),"periodehoeveelheden hebben een eigen botsingsbewuste layouthulp");
ok(html.includes('data-q4-rain-period-amount')&&html.includes('q4Mm(p.som)+" mm"'),"iedere regenperiode toont zijn eigen berekende totaalhoeveelheid");
ok(html.includes("function q4PeriodeRandTekst(g,p)"),"regenperiode heeft één zichtbare kloktijdhelper");
ok(html.includes('return {van:q4Tijd(van),tot:q4Tijd(tot)};'),"zichtbare tijdlabels tonen uitsluitend kloktijden zonder weekdag");
ok(html.includes("function q4PeriodeRandLabels(g,perioden,y,font)"),"tijdlabels hebben een eigen botsingsbewuste layouthulp");
ok(html.includes('if(!g||g.n>25)return {labels:[],rijen:0'),"tijdlabels blijven beperkt tot de 24-uursweergave");
ok(html.includes('const splitMin=Math.max(52,startBreedte+eindBreedte+10);')&&html.includes('if(span>=splitMin)'),"split-versus-compact volgt de werkelijke beschikbare bracketbreedte");
ok(html.includes('labels.push({index,soort:"start"')&&html.includes('labels.push({index,soort:"end"'),"brede periode kan losse begin- en eindtijd houden");
ok(html.includes('const compactTekst=tekst.van+"–"+tekst.tot')&&html.includes('labels.push({index,soort:"range"'),"korte periode valt terug op één compacte klokrange");
ok(html.includes('const links=2,rechts=g.W-2'),"tijdlabels gebruiken de echte SVG-rand als clipgrens");
ok(html.includes('label.setAttribute("text-anchor",item.anchor||"middle")'),"tijdlabels gebruiken passende SVG-ankers voor split en compact");
ok(html.includes('data-q4-rain-period-"+item.soort'),"split- en compacte tijdlabels krijgen expliciete regressie-attributen");
ok(!html.includes("data-q4-rain-period-detail"),"losse dubbele perioderegels onder de grafiek zijn verwijderd");
ok(html.includes("function q4PeriodeTijdvak(g,p)"),"regenperioden behouden een dagbewuste toegankelijke tijdvakformatter");
ok(html.includes('vanDatum!==totDatum')&&html.includes('vanDag+" "+q4Tijd(van)+"–"+totDag+" "+q4Tijd(tot)'),"toegankelijke bracketbeschrijving benoemt beide kalenderdagen over middernacht");
ok(html.includes('horizontaal.setAttribute("aria-label",q4PeriodeTijdvak(g,p)+" · "+q4Mm(p.som)+" mm")'),"bracket zelf houdt het volledige toegankelijke tijdvak plus hoeveelheid");
ok(!html.includes('const piekTekst="Meeste regen "'),"zichtbare Meeste regen-samenvatting is verwijderd");
ok(!html.includes('const periodeTekst=perioden.length+" regenperiode"'),"zichtbare totaalregel voor regenperioden is verwijderd");
ok(html.includes('const nieuwH=Math.max(basisH,laatsteBedragY+17+8);'),"grafiekhoogte reserveert alleen ruimte voor tijdlabels en mm-bedragen");
ok(html.includes('Bij iedere regenperiode staat het tijdvak en de verwachte hoeveelheid.'),"toegankelijke grafiekuitleg beschrijft split én compacte tijdlabels");
ok(html.includes('Neerslagkansen blijven via de details beschikbaar.'),"verwijderde statische kansen blijven expliciet beschikbaar via interactie");
ok(html.includes('cc!==null&&cc>=0&&cc<5')&&html.includes('&lt;5<s>%</s>'),"vrijwel wolkeloze modelwaarden worden zonder 0/1%-schijnprecisie gepresenteerd");
ok(html.includes('function q4NachtzichtPresentatie()')&&html.includes('el.textContent="<5%"')&&html.includes('const q4BasisNachten=nachten;'),"Nachtzicht gebruikt dezelfde <5%-presentatieregel zonder de scoreberekening te wijzigen");
ok(html.includes('function q4LuchtkwaliteitPresentatie()')&&html.includes('(Europese|Amerikaanse) AQI')&&html.includes('const q4BasisLucht=lucht;'),"AQI-presentatie verwijdert de redundante schaalnaam uit de subregel");
ok(html.includes('function q4NeerslagTegelPresentatie()')&&html.includes('kop.textContent="Neerslag komend uur"'),"neerslagtegel benoemt het 60-minutentijdvak van kans en hoeveelheid eerlijk");
ok(html.includes('const meetbaarMm=globalThis.WeatherNowInterpretatie&&globalThis.WeatherNowInterpretatie.INTERPRETATIE_CONFIG')
  &&html.includes('if(waarde>=meetbaarMm) out+=`<rect')
  &&html.includes('if(waarde>=meetbaarMm){\n      /* Het cijfer'),
  "kwartier-nowcast tekent staaf en label rechtstreeks met de centrale meetbaarheidsgrens");

/* De geassembleerde artifact kan historische chartHint-assignments bevatten.
   Daarom zoeken we niet globaal naar de eerste/laatste match. De runtime-marker
   die direct vóór q4BasisEtmaal staat begrenst de echte Q4-owner; de browser-E2E
   blijft daarna het uiteindelijke zichtbare gedrag in Chromium en WebKit bewijzen. */
const q4Marker="/* ===== Q4 REGENPERIODEN 20260811 ===== */";
const q4RuntimeBegin=html.lastIndexOf(q4Marker,q4RuntimePos);
ok(q4RuntimeBegin>=0&&q4RuntimeBegin<q4RuntimePos,"Q4 runtime-marker begrenst de actieve Q4-laag");
const hintOwnerPos=html.indexOf('chartHint=function(){',q4RuntimeBegin);
ok(hintOwnerPos>q4RuntimeBegin&&hintOwnerPos<q4RuntimePos,"Q4 bezit de grafiekhint binnen zijn eigen runtime vóór startup");
const hintTekstPos=html.indexOf('el.textContent="Selecteer een punt in de grafiek voor details.";',hintOwnerPos);
ok(hintTekstPos>hintOwnerPos&&hintTekstPos<q4RuntimePos,"Q4 grafiekhint-owner bevat de input-neutrale zichtbare tekst");
ok(html.includes('<p class="hint" id="dagenhint">Kies een dag om die verwachting in de grafiek te bekijken.</p>'),"zichtbare daghint is invoermethode-neutraal");
ok(html.includes('<div class="eyebrow">Windstoten nu</div>'),"actuele windstootwaarde is ondubbelzinnig gelabeld");

/* Dag-neerslagtaal heeft één bron-eigenaar: NEERSLAGKANSBELEID V3. Q4 mag de
   senior-correctheidslaag niet meer tekstueel repareren. We controleren daarom
   direct de ingebedde policy die dagen() uiteindelijk voedt; browser-Q4 bewijst
   daarna dat een echte 12:25-fixture geen minuutprecisie in de DOM oplevert. */
const policyStart="/* ===== NEERSLAGKANSBELEID V3 ===== */",policyEind="/* ===== EINDE NEERSLAGKANSBELEID V3 ===== */";
const ps=html.indexOf(policyStart),pe=html.indexOf(policyEind,ps+policyStart.length);
ok(ps>=0&&pe>ps,"neerslagkansbeleid V3 is eenduidig afgebakend");
const policy=html.slice(ps,pe);
ok(policy.includes("function dagMomentZinsdeel(tijd)"),"dag-neerslagpolicy bezit de dagdeelhelper");
ok(policy.includes("const tijd=dagMomentZinsdeel(a.eersteTijd);"),"dag-neerslagsamenvatting gebruikt de canonieke dagdeelhelper");
ok(!policy.includes('const tijd=a.eersteTijd?" rond "+a.eersteTijd:"";'),"canonieke dag-neerslagpolicy bevat geen schijnpreciese kloktijd meer");
ok(policy.includes('if(uur<5)return " in de nacht";')&&policy.includes('if(uur<8)return " in de vroege ochtend";')&&policy.includes('if(uur<12)return " in de ochtend";')&&policy.includes('if(uur<18)return " in de middag";'),"dagdelen hebben expliciete en testbare grenzen");

ok(html.includes("minmax(140px,.72fr) 92px minmax(260px,1fr)"),"Nachtzicht geeft desktopuitleg meer ruimte dan de scorebalk");
const verwacht=verifieerServiceworkerCache(OUT,"Q4");
ok(/^watishetweer-[0-9a-f]{12}$/.test(verwacht),"serviceworker hoort exact bij de Q4-app-shell");

console.log("Q4-artifactcontrole: "+n+" invarianten geslaagd.");
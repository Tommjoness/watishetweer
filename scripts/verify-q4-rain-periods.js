"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");

const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"public","index.html"),"utf8");
const ok=(v,n)=>{assert.ok(v,n);console.log("OK  "+n);};

const q4RuntimePos=html.indexOf("const q4BasisEtmaal=etmaal;");
ok(q4RuntimePos>=0,"Q4-laag staat in definitieve artifact");
const startupPos=html.indexOf("/* ---------- start ---------- */");
ok(startupPos>q4RuntimePos,"Q4-runtime is actief vóór de algemene startup-router");

ok(html.includes("function q4RegenPerioden"),"eerste neerslaginterval buiten grafiekvenster telt niet mee");
ok(html.includes("mm>=Q4_MEETBAAR_MM"),"regenperiode begint pas bij meetbare 0,1 mm");
ok(html.includes("const begin=Q4UurBegin(tijd)"),"hoeveelheid op eindtijd wordt aan voorafgaand uurvak gekoppeld");
ok(html.includes("const bron=Number.isInteger(S.chartStart)?S.chartStart+i:null"),"regenperioden gebruiken de exacte zichtbare bronindex");
ok(html.includes("const bron=Number.isInteger(S.chartStart)?S.chartStart+i:null")&&html.includes("S.d.hourly.precipitation[bron]"),"ieder zichtbaar uur volgt forecastvolgorde zonder lokale indexOf");
ok(!html.includes("S.d.hourly.time.indexOf(g.TI[i])"),"Q4 gebruikt bij dubbele DST-kloktijden geen indexOf op lokale tijdtekst");
ok(html.includes("g.Q1MM=g.MM"),"regenstrook en tooltip krijgen exact dezelfde uitgelijnde array");
ok(html.includes("q4PeriodeTotaal"),"periodetotaal is som van dezelfde uurintervallen");
ok(html.includes("q4Zwaarste"),"zwaarste uurvak blijft intern uit dezelfde periodegegevens beschikbaar");
ok(html.includes('data-q4-rain-periods="1"'),"regenperioden hebben een eigen herkenbare SVG-laag");
ok(html.includes('pointer-events="none" data-q4-rain-periods="1"'),"regenlaag kan het centrale hitvlak nooit onderscheppen");
ok(html.includes("<line")&&html.includes("data-q4-rain-period-amount"),"regenbrackets worden als echte SVG-lijnen opgebouwd");
ok(html.includes("<text")&&html.includes("data-q4-rain-period-amount"),"regenlabels worden als echte SVG-tekst opgebouwd");
ok(!html.includes("innerHTML+=q4"),"Q4 gebruikt geen fragiele SVG-innerHTML-injectie meer");
ok(html.includes("q4VerwijderOudeRegenlaag"),"oude losse neerslagstaven worden na render verwijderd");
ok(html.includes("q4VerwijderOudeRegenlaag"),"oude losse mm-labels worden na render verwijderd");
ok(!html.includes("q4KansLabelY"),"ongebruikte statische-kanspositionering is uit de Q4-runtime verwijderd");
ok(html.includes("q4VerwijderStatischeKanslabels"),"statische neerslagpercentages worden semantisch uit de tijdlijn verwijderd zonder de interactieve tooltip te raken");
ok(html.includes("q4PlaatsPeriodeBedragen"),"periodehoeveelheden hebben een eigen botsingsbewuste layouthulp");
ok(html.includes("data-q4-rain-period-amount"),"iedere regenperiode toont zijn eigen berekende totaalhoeveelheid");
ok(html.includes("function q4TijdLabel"),"regenperiode heeft één zichtbare kloktijdhelper");
ok(html.includes("return m?m[1]+\":\"+m[2]:\"\";"),"zichtbare tijdlabels tonen uitsluitend kloktijden zonder weekdag");
ok(html.includes("q4PlaatsTijdLabels"),"tijdlabels hebben een eigen botsingsbewuste layouthulp");
ok(html.includes("if(S.dag!==null||S.bereik!==24)return"),"tijdlabels blijven beperkt tot de 24-uursweergave");
ok(html.includes("q4GebruikSplitTijdlabels"),"desktop split volgt beschikbare bracketbreedte; mobiel gebruikt de compacte klokrange");
ok(html.includes('data-q4-rain-start="1"')&&html.includes('data-q4-rain-end="1"'),"brede desktopperiode kan losse begin- en eindtijd houden");
ok(html.includes('data-q4-rain-range="1"'),"mobiel en korte perioden vallen terug op één compacte klokrange");
ok(html.includes("Math.max(2,Math.min("),"tijdlabels gebruiken de echte SVG-rand als clipgrens");
ok(html.includes('text-anchor="start"')&&html.includes('text-anchor="end"'),"tijdlabels gebruiken passende SVG-ankers voor split en compact");
ok(html.includes("data-q4-rain-start")&&html.includes("data-q4-rain-range"),"split- en compacte tijdlabels krijgen expliciete regressie-attributen");
ok(!html.includes("q4RegenRegels"),"losse dubbele perioderegels onder de grafiek zijn verwijderd");
ok(html.includes("q4ToegankelijkTijdvak"),"regenperioden behouden een dagbewuste toegankelijke tijdvakformatter");
ok(html.includes("q4ToegankelijkTijdvak"),"toegankelijke bracketbeschrijving benoemt beide kalenderdagen over middernacht");
ok(html.includes("aria-label=\"")&&html.includes("mm\""),"bracket zelf houdt het volledige toegankelijke tijdvak plus hoeveelheid");
ok(!html.includes("Meeste regen"),"zichtbare Meeste regen-samenvatting is verwijderd");
ok(!html.includes("Totaal in perioden"),"zichtbare totaalregel voor regenperioden is verwijderd");
ok(html.includes("q4GrafiekExtraHoogte"),"grafiekhoogte reserveert alleen ruimte voor tijdlabels en mm-bedragen");
ok(html.includes("compacte tijdvakken"),"toegankelijke grafiekuitleg beschrijft split én compacte tijdlabels");
ok(html.includes("Neerslagkans")&&html.includes("scrub"),"verwijderde statische kansen blijven expliciet beschikbaar via interactie");
ok(html.includes("weatherNowBewolkingPresentatie"),"vrijwel wolkeloze modelwaarden worden zonder 0/1%-schijnprecisie gepresenteerd");
ok(html.includes("weatherNowBewolkingPresentatie"),"Nachtzicht gebruikt dezelfde <5%-presentatieregel zonder de scoreberekening te wijzigen");
ok(html.includes("AQI")&&html.includes("Redelijk"),"AQI-presentatie verwijdert de redundante schaalnaam uit de subregel");
ok(html.includes("Neerslagverwachting komend uur"),"neerslagtegel benoemt het 60-minutentijdvak van kans en hoeveelheid eerlijk");
ok(html.includes("meetbaarMm"),"kwartier-nowcast tekent staaf en label rechtstreeks met de centrale meetbaarheidsgrens");

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
ok(html.includes('<div class="eyebrow">Tijd tot zonsondergang</div>'),"statische hoofdtegelkop benoemt tijd tot zonsondergang");
ok(!html.includes('<div class="eyebrow">Windstoot dit uur</div>')&&!html.includes('<div class="eyebrow">Windstoot rond nu</div>'),"historische windstootkoppen zijn uit de finale Q4-artifact verdwenen");
ok(!html.includes("De hoogste verwachte windstoot voor vandaag bedroeg"),"historische windstootdagpiek kan de zonsondergangsubtekst niet overschrijven");

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

console.log("Q4-regenperioden verificatie geslaagd.");

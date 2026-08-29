"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const waarheid=require("./final-product-truth-20260828.js");

const bestand=path.join(__dirname,"..","public","index.html");
assert.ok(fs.existsSync(bestand),"public/index.html ontbreekt");
const html=fs.readFileSync(bestand,"utf8");

assert.equal((html.match(/rel=\"preconnect\" href=\"https:\/\/api\.open-meteo\.com\"/g)||[]).length,1,"forecast-origin krijgt exact één preconnect");
assert.equal((html.match(/rel=\"dns-prefetch\" href=\"\/\/api\.open-meteo\.com\"/g)||[]).length,1,"kritieke forecast-origin krijgt één goedkope DNS-fallback");
assert.ok(!html.includes('rel="preconnect" href="https://air-quality-api.open-meteo.com"'),"niet-kritieke air-quality-origin wordt niet onnodig gepreconnect");
assert.ok(html.includes("/* ===== LCP FINAL MILE 20260828 ===== */"),"LCP final-mile marker ontbreekt");
assert.ok(html.includes("/* ===== FINAL PRODUCT TRUTH 20260828 ===== */"),"finale productwaarheid ontbreekt");
assert.ok(html.includes("/* ===== FINAL PRODUCT TRUTH 20260828 CSS ===== */"),"CLS-stabilisatie-CSS ontbreekt");
assert.ok(html.includes("cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,pressure_msl"),"actuele forecast vraagt alle wolkenlagen op");
assert.ok(html.includes('.seo-plaatsnav{visibility:hidden}.seo-plaatsnav.weer-klaar{visibility:visible}'),"plaatsnav blijft geometrisch aanwezig maar onzichtbaar tijdens frame-opbouw");
assert.ok(html.includes('<noscript><style>.seo-plaatsnav{visibility:visible!important}</style></noscript>'),"plaatsnav blijft zonder JavaScript zichtbaar");

/* De volledige hoofdstructuur moet vanaf first paint een layoutbox hebben.
   display:none -> display:block veroorzaakte in intermitterende mobiele PSI-runs
   0,528 CLS op main#app. visibility wisselt uitsluitend painting en houdt de
   bestaande DOM-geometrie beschikbaar tijdens tekenAlles(). */
assert.ok(html.includes('<div id="app" style="visibility:hidden">')||html.includes('<main id="app" style="visibility:hidden">'),"main#app reserveert vanaf first paint geometrie via visibility:hidden");
assert.ok(!html.includes('id="app" style="display:none"'),"main#app mag niet meer volledig uit de documentflow verdwijnen");
assert.equal((html.match(/document\.getElementById\("app"\)\.style\.visibility="visible";/g)||[]).length,2,"succes- en cachefallback onthullen dezelfde gereserveerde hoofdstructuur");
assert.ok(!html.includes('document.getElementById("app").style.display="block";'),"main#app mag niet meer via display:block in één keer in de flow verschijnen");

assert.ok(html.includes('matchMedia("(max-width: 900px)").matches'),"frame-splitsing is expliciet beperkt tot de gemeten mobiele route");
assert.ok(html.includes("let nietKritiekeRenderToken=0;"),"verouderde deferred render wordt tokenmatig ongeldig gemaakt bij een nieuwe render");
assert.ok(html.includes("let mobieleLuchtRenderUitgesteld=false;"),"mobiele luchtkwaliteit heeft een expliciete deferred-rendergate");
assert.ok(html.includes("if(mobieleLuchtRenderUitgesteld&&S.air&&S.air.current)return;"),"alleen geslaagde AQI-data mag de mobiele LCP-volgorde niet inhalen; foutstatus blijft direct renderbaar");
assert.ok(!html.includes("if(mobieleLuchtRenderUitgesteld)return;"),"luchtkwaliteitfouten worden niet door een onvoorwaardelijke rendergate verborgen");
assert.ok(html.includes('requestAnimationFrame(()=>requestAnimationFrame(()=>{if(geldig())stap1();}))'),"mobiele onder-de-vouwrendering wacht bewust twee frames zodat de briefing eerst kan painten");
assert.ok(html.includes('const stap1=()=>{etmaal(startIdx,S.bereik);nowcast();volgendFrame(stap2);};'),"grafiek en nowcast vormen de eerste deferred mobiele stap");
assert.ok(html.includes('const stap2=()=>{dagen();volgendFrame(stap3);};'),"weekverwachting staat mobiel in een eigen frame");
assert.ok(html.includes('const stap3=()=>{nachten();volgendFrame(stap4);};'),"nachtzicht staat mobiel in een eigen frame");
assert.ok(/const stap4=\(\)=>\{\s*mobieleLuchtRenderUitgesteld=false;\s*lucht\(\);nuTimerStart\(\);klokTimerStart\(\);toonSeoPlaatsnavNaRender\(\);\s*\};/.test(html),"plaatsnav verschijnt pas nadat de laatste mobiele frame-inhoud zijn definitieve hoogte heeft");
assert.ok(html.includes('etmaal(startIdx,S.bereik);nowcast();dagen();nachten();lucht();nuTimerStart();klokTimerStart();toonSeoPlaatsnavNaRender();'),"desktop rendert direct en onthult de plaatsnav pas na complete inhoud");
assert.ok(/renderNietKritiekeWeergave\(startIdx\)\{[\s\S]*?nietKritiekeRenderToken\+\+;\s*mobieleLuchtRenderUitgesteld=false;\s*etmaal\(startIdx,S\.bereik\);nowcast\(\);dagen\(\);nachten\(\);lucht\(\);nuTimerStart\(\);klokTimerStart\(\);toonSeoPlaatsnavNaRender\(\);/.test(html),"desktop heft de mobiele luchtgate expliciet op vóór directe rendering");
assert.ok(/if\(mobieleLcpSplitsing\(\)\)\{briefing\(\);meters\(\);\}else\{meters\(\);briefing\(\);\}stempel\(\);\s*renderNietKritiekeWeergave\(startIdx\);/.test(html),"mobiel biedt het LCP-briefingelement vóór meters aan; desktop houdt zijn bestaande volgorde");
assert.ok(!/meters\(\);briefing\(\);etmaal\(startIdx,S\.bereik\);nowcast\(\);dagen\(\);nachten\(\);lucht\(\);stempel\(\);/.test(html),"oude ongescopeerde monolithische tekenAlles-route is verwijderd");

assert.deepStrictEqual(waarheid.bewolkingMetLagen(82,10,15,80,false),{tekst:"Veel hoge bewolking",code:2},"veel hoge bewolking wordt niet meer automatisch zwaar bewolkt");
assert.deepStrictEqual(waarheid.bewolkingMetLagen(82,76,20,85,false),{tekst:"Zwaar bewolkt",code:3},"substantiële lage bewolking houdt zwaar-bewolktsemantiek");
assert.deepStrictEqual(waarheid.bewolkingMetLagen(56,10,15,50,false),{tekst:"Hoge bewolking",code:1},"dominante hoge bewolking wordt expliciet benoemd");
assert.equal(waarheid.temperatuurTrendPresentatie(17,17,17,17).tekst,"Blijft 17 °C.","werkelijk gelijke ruwe temperatuur heet blijft");
assert.equal(waarheid.temperatuurTrendPresentatie(16.6,17.4,17,17).tekst,"Blijft rond 17 °C.","gelijk afgeronde maar veranderende temperatuur wordt niet absoluut gelijk genoemd");
assert.equal(waarheid.temperatuurTrendPresentatie(16.6,17.4,17,17).waarde,"17","gelijke zichtbare eindpunten tonen geen zinloze 17 naar 17-pijl");
assert.equal(waarheid.vereenvoudigMorgenMaximumHtml('Het verwachte maximum ligt morgen rond 16:00 op <b>21 graden</b>.'),'Morgen wordt het ongeveer <b>21 graden</b>.',"avondbriefing houdt morgenmaximum consumentgericht");
assert.equal(waarheid.uvPiekTekst('Verwachte UV-piek lag rond 13:00 · matig.','3'),'UV-piek vandaag: 3 (matig), rond 13:00.',"verstreken UV-piek gebruikt consequente tijdtaal");
assert.equal(waarheid.zonurenTekst(2.9),'Voor vandaag is 2,9 uur zon berekend.',"zonuren zijn een berekende dagsom en geen late toekomstclaim");
assert.equal(waarheid.daglengteTekst('13 uur en 53 minuten daglicht'),'Daglengte 13 u 53 min',"daglengte is ondubbelzinnig gelabeld");
assert.equal(waarheid.onweerDagTekst(96),'Onweer mogelijk, lokaal hagel',"neerslagkans wordt niet als hagelkans geformuleerd");
assert.ok(html.includes('mm.textContent="geen meetbare hoeveelheid"'),"0,0 mm naast niet-nul kans wordt compact als geen meetbare hoeveelheid gepresenteerd");
assert.ok(html.includes('document.querySelectorAll("#days .dag-neerslagnotitie").forEach(el=>el.remove())'),"lange technische dagnotitie wordt uit de consumententabel verwijderd");
assert.ok(html.includes('document.querySelectorAll("#nights .maanbij")'),"maanindicatoren krijgen een expliciete toegankelijkheidsowner");
assert.ok(html.includes('el.setAttribute("role","img")'),"maanindicatoren krijgen een toegestane semantische afbeeldingsrol");
assert.ok(html.includes('el.getAttribute("aria-label")||el.getAttribute("title")'),"maanindicator behoudt of hergebruikt zijn beschrijvende toegankelijke naam");
assert.ok(/basisNachtenFinalTruth=nachten;[\s\S]*?veilig\(pasMaanToegankelijkheidToe\)/.test(html),"maansemantiek wordt na iedere Nachtzicht-render opnieuw toegepast");

console.log("LCP/finale productwaarheid 20260828: wolkenlagen, temperatuurtrend, briefing, UV, zonuren, daglengte, neerslagsemantiek, onweermodaliteit, geometrisch gereserveerde hoofdstructuur, CLS-stabiele plaatsnav, toegankelijke maaniconen en mobiele briefingpaint geborgd.");

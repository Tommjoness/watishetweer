"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const html=fs.readFileSync(path.join(OUT,"index.html"),"utf8");
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log("OK  "+m);};

ok(html.includes("function weatherNowZonurenWoord(uur,daglichtUur){"),"daglichtbewuste zonuren-owner staat in de finale artifact");
ok(html.includes('if(aandeel>=0.6)return "Naar verwachting veel zon vandaag.";'),"zonurencopy gebruikt aandeel van beschikbare daglichtduur");
ok(!html.includes('if(kop.textContent.trim()==="Zonuren"){'),"oude senior-runtime overschrijft de zonurencopy niet meer na render");
ok(html.includes('if(/^Pollen\\s+/i.test(kop.textContent)){'),"pollenpresentatie uit de senior-runtime blijft behouden");

ok(html.includes('const geenVenster=/^Geen gunstig kijkvenster door (.+?)[.!?]*$/i.exec(t);'),"Nachtzicht gebruikt één genormaliseerde geen-vensterroute na weather truth");
ok(html.includes('const kwalificatie=s>=9?"Uitstekende":s>=7?"Goede":"Redelijke";'),"Nachtzicht verbindt venstercopy aan dezelfde zichtbare scoreklasse");
ok(html.includes('is er geen aaneengesloten gunstig kijkvenster.'),"middelmatige/goede score kan eerlijk uitleggen dat alleen een aaneengesloten venster ontbreekt");
ok(!html.includes('if(/^Geen gunstig kijkvenster door /i.test(t))return /[.!?]$/.test(t)?t:t+".";'),"oude kale Nachtzicht-return is uit de finale artifact verwijderd");
ok(html.includes('function nachtzichtCompactAantal(totaal,mobiel){'),"Nachtzicht houdt één compacte presentatie-owner");
ok(html.includes('return Math.min(3,n);'),"Nachtzicht toont standaard maximaal drie nachten op ieder schermformaat");
ok(!html.includes('if(!mobiel||rijen.length<=zichtbaar){'),"desktop omzeilt de compacte Nachtzichtpresentatie niet meer");
ok(html.includes('#nights .row.night[hidden]{display:none!important}'),"verborgen extra nachten blijven ook op desktop werkelijk verborgen");
ok(html.includes('#nights .nacht-meer{'),"de bestaande Meer nachten-bediening is op desktop beschikbaar");

ok(html.includes("function q4MobieleGelabeldePerioden(perioden){"),"Q4 heeft een expliciete mobiele labelselectie");
ok(html.includes("const labelPerioden=g.M?q4MobieleGelabeldePerioden(perioden):perioden;"),"alleen mobiel gebruikt de gereduceerde permanente regenlabelset");
ok(html.includes('g.M?" De belangrijkste regenperioden zijn gelabeld; de overige blijven via de grafiekdetails beschikbaar."'),"toegankelijke mobiele Q4-uitleg beschrijft de gereduceerde zichtbare regenlabels eerlijk");
ok(html.includes('horizontaal.setAttribute("aria-label",q4PeriodeTijdvak(g,p)+" · "+q4Mm(p.som)+" mm")'),"iedere regenbracket houdt ongeacht zichtbare labelfilter zijn volledige aria-detail");

ok(html.includes('if(t.richting==="gelijk"){'),"gelijke temperatuurtrend krijgt een eigen presentatieroute");
ok(html.includes('waarde.innerHTML=String(t.van)+"<s>°C</s>";'),"gelijke temperatuurtrend toont één temperatuur zonder 17 naar 17-pijl");
ok(html.includes('sub.textContent="De temperatuur blijft de komende uren rond "+String(t.van)+" °C.";'),"gelijke temperatuurtrend benoemt expliciet dat de temperatuur rond dezelfde waarde blijft");
ok(!html.includes('De temperatuur verandert de komende uren nauwelijks.'),"oude vage copy voor gelijke temperatuurtrend is verwijderd");
ok(html.includes('waarde.innerHTML=String(t.van)+" → "+String(t.naar)+"<s>°C</s>";'),"stijgende en dalende temperatuurtrend houden de richtingpijl");

ok(html.includes("function weatherNowDagenNeerslagUitleg(){"),"weekverwachting heeft een finale uitleg-owner voor niet-nul kans met 0,0 mm");
ok(html.includes('uitleg.id="dagenneerslaguitleg"'),"nul-mm-uitleg krijgt een eigen regel en overschrijft de bedieningshint niet");
ok(!html.includes('hint.textContent=basis+" "+kans+" kans met 0,0 mm'),"bedieningshint wordt niet meer gebruikt als meteorologische toelichting");
ok(html.includes('uitleg.textContent=kans+" · geen meetbare hoeveelheid verwacht.";'),"0,0-mm-uitleg is kort en consumentgericht");
ok(!html.includes('op één decimaal afrondt naar 0,0 mm.'),"lange technische afrondingsuitleg is uit de zichtbare weekpresentatie verwijderd");
ok(!html.includes('Kans en dagsom zijn verschillende modelwaarden'),"oude modeltechnische kans/dagsom-uitleg staat niet meer in de finale artifact");

ok(html.includes('const schaalIndex = euro ? "Europese AQI" : "AQI (VS-schaal)";'),"niet-Europese luchtkwaliteit benoemt expliciet dat het om de VS-schaal gaat");
ok(!html.includes('"Amerikaanse AQI"'),"dubbelzinnig label Amerikaanse AQI is verwijderd");

ok(html.includes('moment+" is de wind het sterkst, met <b>"+bm+" Bft</b>'),"briefing benoemt de windpiek in natuurlijke taal");
ok(html.includes('zin3+=" Windstoten kunnen "+gustMoment+" oplopen tot "+Math.round(gmax)+" km/u.";'),"briefing geeft zware windstoten in een korte afzonderlijke zin");
ok(!html.includes('" in het uur "+weatherNowUurvak(h.time[gi])+" kunnen windstoten tot "'),"oude mechanische windstootzin is verwijderd");

ok(html.includes('const belangrijkNabij=kandidatenRuw.some'),"desktop etmaalgrafiek herkent redundante labels naast een belangrijk punt");
ok(html.includes('alle.slice(0,pos).some(g=>g.rang===1&&g.i<k.i&&k.i-g.i<=stap*2&&Math.round(T[g.i])===afgerond)'),"desktop etmaalgrafiek onderdrukt alleen nabije identieke afgeronde rasterwaarden");
ok(html.includes('?kandidatenRuw.filter(k=>k.rang>1||(k.i%6===0'),"mobiele rustige zes-uursselectie blijft behouden");

ok(html.includes('Vannacht daalt de temperatuur naar ongeveer "+waarde+".'),"briefing bevat natuurlijke resterende daling na middernacht");
ok(html.includes('Vannacht blijft de temperatuur rond "+waarde+".'),"briefing bevat een stabiele nachtvariant na middernacht");
ok(!html.includes('Later vannacht koelt het af naar "+waarde'),"onnatuurlijke later-vannacht-copy is uit de finale artifact verdwenen");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
ok(scripts.length>0,"finale artifact bevat inline runtime");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-final-presentatie-"+(i+1)}));
ok(true,"alle inline runtimes blijven syntactisch geldig na finale consistentie");
const cache=verifieerServiceworkerCache(OUT,"finale-presentatie");
ok(/^watishetweer-[0-9a-f]{12}$/.test(cache),"serviceworker hoort bij de finale presentatieartifact");

console.log("Finale presentatiecontrole: "+n+" invarianten geslaagd.");
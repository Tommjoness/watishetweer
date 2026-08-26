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

ok(html.includes("function q4MobieleGelabeldePerioden(perioden){"),"Q4 heeft een expliciete mobiele labelselectie");
ok(html.includes("const labelPerioden=g.M?q4MobieleGelabeldePerioden(perioden):perioden;"),"alleen mobiel gebruikt de gereduceerde permanente labelset");
ok(html.includes('g.M?" De belangrijkste regenperioden zijn gelabeld; de overige blijven via de grafiekdetails beschikbaar."'),"toegankelijke mobiele Q4-uitleg beschrijft de gereduceerde zichtbare labels eerlijk");
ok(html.includes('horizontaal.setAttribute("aria-label",q4PeriodeTijdvak(g,p)+" · "+q4Mm(p.som)+" mm")'),"iedere regenbracket houdt ongeacht zichtbare labelfilter zijn volledige aria-detail");

ok(html.includes("function weatherNowDagenNeerslagUitleg(){"),"weekverwachting heeft een finale uitleg-owner voor niet-nul kans met 0,0 mm");
ok(html.includes('kans+" kans met 0,0 mm betekent dat neerslag mogelijk is'),"weekhint legt kans en afgeronde daghoeveelheid in gewone taal uit");
ok(html.includes('op één decimaal afrondt naar 0,0 mm.'),"uitleg benoemt waarom 0,0 mm naast een kanspercentage kan staan");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
ok(scripts.length>0,"finale artifact bevat inline runtime");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-final-presentatie-"+(i+1)}));
ok(true,"alle inline runtimes blijven syntactisch geldig na finale consistentie");
const cache=verifieerServiceworkerCache(OUT,"finale-presentatie");
ok(/^watishetweer-[0-9a-f]{12}$/.test(cache),"serviceworker hoort bij de finale presentatieartifact");

console.log("Finale presentatiecontrole: "+n+" invarianten geslaagd.");
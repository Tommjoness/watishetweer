"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const vm=require("vm");
const ux=require("./mobile-state-ux-20260826.js");
const {verifieerServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const html=fs.readFileSync(path.join(OUT,"index.html"),"utf8");
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log("OK  "+m);};

ok(ux.grafiekHeeftUurlabels(["21","00"]),"uurlabeldetector herkent geldige tweecijferige aslabels");
ok(!ux.grafiekHeeftUurlabels(["21°","zon op 06:41","65%"]),"uurlabeldetector verwart temperatuur, zon en kans niet met de uuras");
ok(ux.grafiekHerstelNodig(true,24,[]),"lege eerste mobiele 24-uursas wordt na fontload hersteld");
ok(ux.grafiekHerstelNodig(true,48,[]),"lege eerste mobiele 48-uursas wordt na fontload hersteld");
ok(!ux.grafiekHerstelNodig(false,24,[]),"desktop krijgt geen onnodige fontload-hertekening");
ok(!ux.grafiekHerstelNodig(true,168,[]),"weekgrafiek gebruikt niet de uur-asherstelroute");
ok(!ux.grafiekHerstelNodig(true,24,["00"]),"bestaande mobiele uuras wordt niet opnieuw getekend");
ok(ux.terugNaarBereikLabel(24)==="Komende 24 uur","resetknop benoemt de rollende 24-uursmodus");
ok(ux.terugNaarBereikLabel(48)==="Komende 48 uur","resetknop benoemt ook de rollende 48-uursmodus");
ok(ux.terugNaarBereikLabel(168)==="Komende zeven dagen","resetknop benoemt het langere bereik zonder 'terug naar nu'-ambiguïteit");

const nul=ux.dagNeerslagNuance(65,0,"do 27",0.005);
ok(nul&&nul.mmTekst==="0,0 mm"&&/do 27 · 65%/.test(nul.tekst)&&/hoogste neerslagkans in één uur/.test(nul.tekst),"0,0-mm-nuance is aan de juiste dag en betekenis van het percentage gekoppeld");
const spoor=ux.dagNeerslagNuance(42,0.001,"di 1",0.005);
ok(spoor&&spoor.mmTekst==="spoor"&&!/<0,05/.test(spoor.tekst),"amper meetbare hoeveelheid krijgt spoor in plaats van <0,05-schijnprecisie");
const klein=ux.dagNeerslagNuance(88,0.049,"za 29",0.005);
ok(klein&&klein.mmTekst==="<0,05 mm"&&/<0,05 mm/.test(klein.tekst),"<0,05 wordt alleen gebruikt wanneer de echte dagsom onder 0,05 ligt en boven spoor uitkomt");
ok(ux.dagNeerslagNuance(88,0.05,"za 29",0.005)===null,"0,05 mm valt niet ten onrechte in de <0,05-nuance");
ok(ux.dagNeerslagNuance(0,0,"Vandaag",0.005)===null,"een droge 0%-dag krijgt geen overbodige neerslagnotitie");

for(const vereist of [
  "/* ===== MOBILE STATE UX 20260826 ===== */",
  "/* ===== MOBILE STATE UX 20260826 CSS ===== */",
  "const basisEtmaalMobieleState=typeof etmaal",
  "gereed.then(()=>{",
  "grafiekHerstelNodig(mobiel(),n,chartUurTeksten",
  "Deze kalenderdag per uur.",
  "Toon "+"\"+label.toLowerCase()+\" vanaf nu",
  "dagNeerslagNuance",
  "dag-neerslagnotitie",
  "hoogste neerslagkans in één uur",
  "aria-pressed",
  "aria-describedby",
  "nacht-meta-details",
  "Zicht en maan",
  "setTimeout(()=>{",
  "senior-verstopt"
])ok(html.includes(vereist),"artifact bevat state-UX invariant: "+vereist);

ok(!html.includes('back.textContent="Terug naar nu"'),"nieuwe state-UX-runtime zet de resetcopy niet terug naar de ambigue oude tekst");
ok(!html.includes('details.className="data-uitleg dagenneerslaguitleg-compact"'),"losse globale weekuitleg wordt niet opnieuw als apart detailsblok opgebouwd");
ok(html.includes('if(losseUitleg)losseUitleg.remove();'),"oude globale neerslaguitleg wordt na de weekrender verwijderd");
ok(html.includes('if(mm<=spoorgrens)return {'),"spoorhoeveelheden hebben een aparte semantiek vóór de <0,05-grens");
ok(html.includes('if(mm<0.05)return {'),"<0,05-nuance heeft een harde echte grens");
ok(html.includes('details.open=!mobiel();'),"Nachtzicht-details zijn mobiel compact en desktop standaard open");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
ok(scripts.length>0,"definitieve artifact bevat inline runtime");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-mobile-state-ux-"+(i+1)}));
ok(true,"alle inline runtimes blijven syntactisch geldig");

const cache=verifieerServiceworkerCache(OUT,"mobile-state-ux-20260826");
ok(/^watishetweer-[0-9a-f]{12}$/.test(cache),"serviceworker hoort bij de state-UX-artifact");
console.log("Mobiele state-UX-verificatie: "+n+" invarianten geslaagd.");

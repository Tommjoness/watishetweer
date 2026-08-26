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
ok(ux.weekUitlegSamenvatting("65% kans met 0,0 mm betekent dat neerslag mogelijk is")==="Waarom 65% kans en 0,0 mm?","weekuitleg krijgt een korte, concrete samenvatting");

for(const vereist of [
  "/* ===== MOBILE STATE UX 20260826 ===== */",
  "/* ===== MOBILE STATE UX 20260826 CSS ===== */",
  "const basisEtmaalMobieleState=typeof etmaal",
  "gereed.then(()=>{",
  "grafiekHerstelNodig(mobiel(),n,chartUurTeksten",
  "Deze kalenderdag per uur.",
  "Toon "+"\"+label.toLowerCase()+\" vanaf nu",
  "dagenneerslaguitleg-compact",
  "nacht-meta-details",
  "Zicht en maan",
  "setTimeout(()=>{",
  "senior-verstopt"
])ok(html.includes(vereist),"artifact bevat state-UX invariant: "+vereist);

ok(!html.includes('back.textContent="Terug naar nu"'),"nieuwe state-UX-runtime zet de resetcopy niet terug naar de ambigue oude tekst");
ok(html.includes('details.className="data-uitleg dagenneerslaguitleg-compact"'),"weekuitleg wordt een inklapbaar details-element");
ok(html.includes('details.open=!mobiel();'),"Nachtzicht-details zijn mobiel compact en desktop standaard open");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
ok(scripts.length>0,"definitieve artifact bevat inline runtime");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-mobile-state-ux-"+(i+1)}));
ok(true,"alle inline runtimes blijven syntactisch geldig");

const cache=verifieerServiceworkerCache(OUT,"mobile-state-ux-20260826");
ok(/^watishetweer-[0-9a-f]{12}$/.test(cache),"serviceworker hoort bij de state-UX-artifact");
console.log("Mobiele state-UX-verificatie: "+n+" invarianten geslaagd.");

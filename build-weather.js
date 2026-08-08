"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const crypto=require("crypto");

const ROOT=__dirname;
const OUT=path.join(ROOT,"public");
const NIET_PUBLICEREN=new Set([
  ".git",".github","api","node_modules","public",
  "build-weather.js","interpretatie-engine.js","interpretatie-engine.test.js",
  "run.js","run-built-matrix.js","kern.js","data.js","package.json","package-lock.json","vercel.json"
]);

function isInternBestand(naam){
  return NIET_PUBLICEREN.has(naam)||naam.endsWith(".test.js");
}

function kopieer(bron,doel){
  const stat=fs.statSync(bron);
  if(stat.isDirectory()){
    fs.mkdirSync(doel,{recursive:true});
    for(const naam of fs.readdirSync(bron)) kopieer(path.join(bron,naam),path.join(doel,naam));
  }else{
    fs.mkdirSync(path.dirname(doel),{recursive:true});
    fs.copyFileSync(bron,doel);
  }
}

fs.rmSync(OUT,{recursive:true,force:true});
fs.mkdirSync(OUT,{recursive:true});
for(const naam of fs.readdirSync(ROOT)){
  if(isInternBestand(naam)) continue;
  kopieer(path.join(ROOT,naam),path.join(OUT,naam));
}

const indexPad=path.join(ROOT,"index.html");
const enginePad=path.join(ROOT,"interpretatie-engine.js");
let html=fs.readFileSync(indexPad,"utf8");
let engine=fs.readFileSync(enginePad,"utf8");

function vervangEenmalig(zoek,vervang,label){
  const aantal=html.split(zoek).length-1;
  if(aantal!==1) throw new Error(label+": verwacht precies één bronmatch, gevonden "+aantal+".");
  html=html.replace(zoek,vervang);
}

const startMarker="/* ---------- start ---------- */";
if((html.match(/\/\* ---------- start ---------- \*\//g)||[]).length!==1){
  throw new Error("Startmarker ontbreekt of komt meer dan eenmaal voor; interpretatie-engine niet ingevoegd.");
}
if(html.includes("CENTRALE INTERPRETATIE-ENGINE")){
  throw new Error("Bron-index bevat de interpretatie-engine al; build zou dubbel invoegen.");
}

/* Verrijk uitsluitend de gegevens die de centrale interpretatie nodig heeft.
   Iedere vervanging is strikt: een gewijzigde bronstructuur mag nooit ongemerkt
   een half toegepaste interpretatielaag opleveren. */
vervangEenmalig(
  '+"weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m"',
  '+"rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m"',
  "actuele neerslagtypen"
);
vervangEenmalig(
  "&minutely_15=precipitation&past_hours=24",
  "&minutely_15=precipitation,rain,showers,snowfall,weather_code&forecast_minutely_15=16&past_minutely_15=4&past_hours=24",
  "kwartierneerslag"
);
vervangEenmalig(
  "precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,",
  "precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,",
  "uur-neerslagtypen"
);
vervangEenmalig(
  "precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,",
  "precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,",
  "fallback-neerslagtypen"
);

vervangEenmalig(
  '<div class="eyebrow">Neerslag afgelopen uur</div><div class="sval" id="prec">',
  '<div class="eyebrow">Neerslag recent</div><div class="sval" id="prec">',
  "recente-neerslaglabel"
);

/* Uurwaarden voor neerslag en kans gelden voor het voorafgaande uur. Het punt
   met tijd 19:00 is om 19:00 dus volledig verlopen en mag in een toekomstgrafiek
   geen balk, percentage of tooltipwaarde meer opleveren. Temperatuur en andere
   momentwaarden blijven wel staan; alleen de intervalwaarden worden leeggemaakt. */
vervangEenmalig(
  "    P.push(h.precipitation_probability[i]??0);MM.push(h.precipitation[i]??0);",
`    const intervalVerlopen=S.dag==null&&globalThis.WeatherNowInterpretatie
      &&globalThis.WeatherNowInterpretatie.lokaalNaarMinuten(h.time[i])<=globalThis.WeatherNowInterpretatie.lokaalNaarMinuten(S.d.current.time);
    P.push(intervalVerlopen?null:(h.precipitation_probability[i]??null));
    MM.push(intervalVerlopen?null:(h.precipitation[i]??null));`,
  "verlopen grafiekintervallen"
);

/* De tooltip noemt het volledige geldigheidsvak, niet alleen een los einduur. */
vervangEenmalig(
  '+rij("neerslagkans",(heel(G.P&&G.P[i])?G.P[i]:"–")+"%",TEAL)',
  '+rij(heel(G.P&&G.P[i])&&G.P[i]>0?"kans "+weatherNowUurvak(G.TI[i]):"neerslag",heel(G.P&&G.P[i])&&G.P[i]>0?G.P[i]+"%":"geen neerslag verwacht",TEAL)',
  "tooltip-neerslagtijdvak"
);

/* De temperatuurzin bovenaan en de standaardgrafiek moeten hetzelfde venster
   gebruiken. De grafiek start bij S.i0 en toont 24 uur; de briefing keek nog
   maar twaalf uur vooruit, waardoor een middagpiek buiten beeld van de tekst viel. */
vervangEenmalig(
  "  const eind=Math.min(i+13,h.time.length);",
  "  const eind=Math.min(i+24,h.time.length);",
  "briefing gebruikt dezelfde 24 uur als de grafiek"
);

/* Op mobiel waren vijf temperatuurcijfers te weinig voor een etmaal. Acht labels
   geven ongeveer één waarde per drie uur, terwijl de bestaande botsingscontrole
   nog steeds elk label afzonderlijk op veilige afstand en hoogte plaatst. */
vervangEenmalig(
  "  const maximumLabels=M?(n<=24?5:n<=48?4:3):(n<=24?9:n<=48?8:7);",
  "  const maximumLabels=M?(n<=24?8:n<=48?6:4):(n<=24?9:n<=48?8:7);",
  "mobiele dichtheid temperatuurlabels"
);
vervangEenmalig(
  "  const minimumAfstand=M?(n<=24?48:n<=48?62:78):42;",
  "  const minimumAfstand=M?(n<=24?34:n<=48?48:68):42;",
  "mobiele afstand temperatuurlabels"
);
vervangEenmalig(
  "  const MAXLAAG=M?2:3; // beperkte lagen: liever één cijfer minder dan een visuele stapel",
  "  const MAXLAAG=3; // drie veilige hoogtelagen op ieder scherm; botsende labels worden nog steeds geweigerd",
  "veilige hoogtelagen temperatuurlabels"
);

vervangEenmalig(
  '<span class="bron"><b>Weer</b> <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>, ECMWF en DWD, CAMS</span>',
  '<span class="bron"><b>Weer</b> <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo Best Match</a> · <b>Luchtkwaliteit</b> CAMS</span>',
  "bronvermelding"
);

const intervalHelper=`
function weatherNowUurvak(tijd){
  const api=globalThis.WeatherNowInterpretatie;
  const eind=api&&api.lokaalNaarMinuten(tijd);
  const begin=eind==null?null:api.minutenNaarLokaal(eind-60);
  return begin?begin.slice(11,16)+"–"+String(tijd).slice(11,16):"voorafgaand uur";
}
`;

html=html.replace(startMarker,
  "/* ===== CENTRALE INTERPRETATIE-ENGINE ===== */\n"+engine+intervalHelper
  +"\n/* ===== EINDE CENTRALE INTERPRETATIE-ENGINE ===== */\n\n"+startMarker);

/* Compileer ieder inline scriptblok. Dit voert niets uit, maar blokkeert een
   deployment bij een syntaxisfout in de bestaande code of de invoeging. */
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length) throw new Error("Geen inline scriptblok gevonden in de gebouwde index.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:inline-"+(i+1)}));

if(!html.includes("WeatherNowInterpretatie")) throw new Error("Interpretatie-engine ontbreekt na build.");
if(!html.includes("forecast_minutely_15=16")) throw new Error("Uitgebreide kwartierdata ontbreekt na build.");
if(!html.includes("waarden links van ‘nu’ zijn voorbij")) throw new Error("Grafiekcontext ontbreekt na build.");
if(!html.includes("intervalVerlopen")) throw new Error("Verlopen neerslagintervallen worden niet uit de grafiek gefilterd.");
if(!html.includes("weatherNowUurvak")) throw new Error("Exact tooltip-tijdvak ontbreekt.");
if(!html.includes('"geen neerslag verwacht"')) throw new Error("Droge tooltip gebruikt nog een nulpercentage.");
if(!html.includes('kort.droog')) throw new Error("Droge neerslagweergaven zijn niet centraal afgevangen.");
if(!html.includes('maximumLabels=M?')) throw new Error("Harde limiet voor temperatuurlabels ontbreekt.");
if(!html.includes("const eind=Math.min(i+24,h.time.length);")) throw new Error("Briefing gebruikt niet hetzelfde 24-uursvenster als de grafiek.");
if(!html.includes("n<=24?8:n<=48?6:4")) throw new Error("Mobiele grafiek toont nog te weinig temperatuurlabels.");
if(!html.includes("n<=24?34:n<=48?48:68")) throw new Error("Mobiele labelafstand is niet op de hogere informatiedichtheid afgestemd.");
if(!html.includes("const MAXLAAG=3;")) throw new Error("Drie veilige labelhoogtes ontbreken.");
if(!html.includes("S.actieveWaarschuwingen=[];")) throw new Error("Waarschuwingen van een vorige locatie worden niet direct gewist.");
if(!html.includes("Officiële weerwaarschuwingen konden niet worden gecontroleerd.")) throw new Error("Ontbrekende waarschuwingdekking blijft stil.");
if(!html.includes("mijnBeurt!==waarschuwingTeller")) throw new Error("Verouderde waarschuwingaanvragen worden niet geweigerd.");
if(!html.includes("const rondGetal=")) throw new Error("Null-veilige temperatuurweergave ontbreekt.");

fs.writeFileSync(path.join(OUT,"index.html"),html,"utf8");

/* De cacheversie volgt de werkelijk gebouwde app. Een handmatig vast nummer kan
   na een volgende wijziging gelijk blijven, waardoor cache-first assets oud
   blijven. Dezelfde build levert steeds dezelfde hash; gewijzigde code levert
   automatisch een nieuwe cache op. */
const cacheVersie="weerbriefing-"+crypto.createHash("sha256").update(html).digest("hex").slice(0,12);
const swPad=path.join(OUT,"sw.js");
if(fs.existsSync(swPad)){
  let sw=fs.readFileSync(swPad,"utf8");
  sw=sw.replace(/weerbriefing-v\d+/g,cacheVersie);
  if(!sw.includes(cacheVersie)) throw new Error("Dynamische serviceworker-cacheversie is niet toegepast.");
  fs.writeFileSync(swPad,sw,"utf8");
}

for(const naam of fs.readdirSync(OUT)){
  if(isInternBestand(naam)) throw new Error("Intern bestand is ten onrechte publiek gebouwd: "+naam);
}

console.log("WeatherNow-build geslaagd: productiecode gevalideerd, interne tests niet gepubliceerd en cacheversie "+cacheVersie+" toegepast.");

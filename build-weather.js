"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const crypto=require("crypto");
const {pasToe}=require("./productie-hardening-v2.js");

const ROOT=__dirname;
const OUT=path.join(ROOT,"public");
const NIET_PUBLICEREN=new Set([
  ".git",".github","api","node_modules","public",
  "build-weather.js","productie-hardening.js","productie-hardening-v2.js","interpretatie-engine.js","interpretatie-engine.test.js",
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
const engine=fs.readFileSync(enginePad,"utf8");

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

vervangEenmalig(
`    const kans=eindigGetal(h.precipitation_probability&&h.precipitation_probability[i]);
    const hoeveelheid=eindigGetal(h.precipitation&&h.precipitation[i]);
    P.push(kans===null||kans<0?null:clamp(kans,0,100));
    MM.push(hoeveelheid===null||hoeveelheid<0?null:hoeveelheid);`,
`    const kans=eindigGetal(h.precipitation_probability&&h.precipitation_probability[i]);
    const hoeveelheid=eindigGetal(h.precipitation&&h.precipitation[i]);
    const intervalVerlopen=S.dag==null&&globalThis.WeatherNowInterpretatie
      &&globalThis.WeatherNowInterpretatie.lokaalNaarMinuten(h.time[i])<=globalThis.WeatherNowInterpretatie.lokaalNaarMinuten(S.d.current.time);
    P.push(intervalVerlopen||kans===null||kans<0?null:clamp(kans,0,100));
    MM.push(intervalVerlopen||hoeveelheid===null||hoeveelheid<0?null:hoeveelheid);`,
  "verlopen grafiekintervallen"
);

vervangEenmalig(
  '+rij("neerslagkans",(heel(G.P&&G.P[i])?G.P[i]:"–")+"%",TEAL)',
  '+rij(heel(G.P&&G.P[i])&&G.P[i]>0?"kans "+weatherNowUurvak(G.TI[i]):"neerslag",heel(G.P&&G.P[i])&&G.P[i]>0?G.P[i]+"%":"geen neerslag verwacht",TEAL)',
  "tooltip-neerslagtijdvak"
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
function weatherNowActueleLokaleTijd(){
  const p=typeof plaatsTijdDelen==="function"?plaatsTijdDelen():null;
  if(p&&[p.year,p.month,p.day,p.hour,p.minute].every(Number.isFinite)){
    return p.year+"-"+String(p.month).padStart(2,"0")+"-"+String(p.day).padStart(2,"0")+"T"+String(p.hour).padStart(2,"0")+":"+String(p.minute).padStart(2,"0");
  }
  return S.d&&S.d.current&&S.d.current.time?String(S.d.current.time).slice(0,16):null;
}
function weatherNowMinutenNu(){
  const api=globalThis.WeatherNowInterpretatie;
  return api&&api.lokaalNaarMinuten(weatherNowActueleLokaleTijd());
}
function weatherNowUurWaardeOp(veld,doelMin){
  const api=globalThis.WeatherNowInterpretatie,h=S.d&&S.d.hourly;
  if(!api||!h||!Array.isArray(h.time)||!Array.isArray(h[veld])||!Number.isFinite(doelMin)) return null;
  let links=null,rechts=null;
  for(let i=0;i<h.time.length;i++){
    const m=api.lokaalNaarMinuten(h.time[i]),v=eindigGetal(h[veld][i]);
    if(m===null||v===null) continue;
    if(m===doelMin) return v;
    if(m<doelMin && (!links||m>links.m)) links={m,v};
    if(m>doelMin && (!rechts||m<rechts.m)) rechts={m,v};
  }
  if(!links||!rechts||rechts.m-links.m>120) return null;
  const f=(doelMin-links.m)/(rechts.m-links.m);
  return links.v+(rechts.v-links.v)*f;
}
`;

html=html.replace(startMarker,
  "/* ===== CENTRALE INTERPRETATIE-ENGINE ===== */\n"+engine+intervalHelper
  +"\n/* ===== EINDE CENTRALE INTERPRETATIE-ENGINE ===== */\n\n"+startMarker);

html=pasToe(html);

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length) throw new Error("Geen inline scriptblok gevonden in de gebouwde index.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:inline-"+(i+1)}));

const vereist=[
  ["WeatherNowInterpretatie","interpretatie-engine"],
  ["forecast_minutely_15=16","uitgebreide kwartierdata"],
  ["waarden links van ‘nu’ zijn voorbij","grafiekcontext"],
  ["intervalVerlopen","verlopen neerslagintervallen"],
  ["weatherNowUurvak","exact tooltip-tijdvak"],
  ["weatherNowActueleLokaleTijd","werkelijke lokale minuut"],
  ["plaatsTijdDelen","IANA plaatsklok"],
  ["weatherNowZoneOffset","DST-veilige tijdconversie"],
  ["const eind=Math.min(i+25,h.time.length);","volledig 24-uursvenster"],
  ["const punten=S.dag==null&&n===24?25:n;","25 momentpunten voor 24 uur"],
  ["hoeveelheid onzeker","onzekere neerslaghoeveelheid"],
  ["daily.weather_code&&daily.weather_code[dagIndex]","zwaarste dagconditie"],
  ["Volgens het model viel geen neerslag","modeltaal recente neerslag"],
  ["117.000001","juiste Beaufortgrens"],
  ["c.visibility!=null?c.visibility","actueel zicht"],
  ["weatherNowUurWaardeOp(\"pressure_msl\"","exacte druktrend"],
  ["gunstigste modelvenster","eerlijke nachtzichtclaim"],
  ["const geldigeIdx=T.map","null-veilige extrema"],
  ["zoekGeneratie","zoekracebeveiliging"],
  ["aria-activedescendant","zoektoetsenbord"],
  ["klokKalenderdag","middernachtrefresh"],
  ["UV-gegevens voor vandaag niet beschikbaar","ontbrekende UV-data"]
];
for(const [zoek,label] of vereist) if(!html.includes(zoek)) throw new Error("Ontbreekt na build: "+label+".");
if(!html.includes('"geen neerslag verwacht"')) throw new Error("Droge tooltip gebruikt nog een nulpercentage.");
if(!html.includes('kort.droog')) throw new Error("Droge neerslagweergaven zijn niet centraal afgevangen.");
if(!html.includes('maximumLabels=n<=24?kandidaten.length')) throw new Error("Etmaalgrafiek kan nog temperatuurmarkeringen wegkappen.");
if(!html.includes("kandidaten=n<=24?kandidatenRuw")) throw new Error("Drie-uursmarkeringen worden binnen een etmaal nog gefilterd.");
if(!html.includes("const MAXLAAG=M&&n<=24?4:3;")) throw new Error("Extra veilige labelhoogtes voor mobiel ontbreken.");
if(!html.includes("#minibar{position:fixed")) throw new Error("Mobiele minibalk kan nog een scroll-layoutlus veroorzaken.");
if(!html.includes("pastLinks=links-bw/2>=pl-2")) throw new Error("Temperatuurlabel kan nog in de ruimte van de y-as schuiven.");
if(!html.includes("@media(hover:hover) and (pointer:fine){.day:hover")) throw new Error("Weekrij-hover is nog actief tijdens aanraken.");
if(!html.includes("-webkit-tap-highlight-color:transparent")) throw new Error("Witte iOS-aanraakmarkering is niet uitgeschakeld.");
if(!html.includes("S.actieveWaarschuwingen=[];")) throw new Error("Waarschuwingen van een vorige locatie worden niet direct gewist.");
if(!html.includes("Officiële weerwaarschuwingen konden niet worden gecontroleerd.")) throw new Error("Ontbrekende waarschuwingdekking blijft stil.");
if(!html.includes("mijnBeurt!==waarschuwingTeller")) throw new Error("Verouderde waarschuwingaanvragen worden niet geweigerd.");
if(!html.includes("const rondGetal=")) throw new Error("Null-veilige temperatuurweergave ontbreekt.");
if(!html.includes('const scheiding="<!--brief-rest-->"')) throw new Error("Briefinglagen kunnen de tijdgebonden samenvatting niet veilig scheiden.");
if(!html.includes('classList.contains("kop")')) throw new Error("Weekinterpretatie kan de semantische tabelkop nog overschrijven.");
if(!html.includes('dagAanduiding(h.time[top],true)+" wordt het maximaal')) throw new Error("Temperatuurmaximum mist een voorafgaande dagaanduiding.");
if(!html.includes('zonDag+" · "')) throw new Error("Zonmomenten missen een expliciete dag bij de 24-uursweergave.");

fs.writeFileSync(path.join(OUT,"index.html"),html,"utf8");

const cacheVersie="weerbriefing-"+crypto.createHash("sha256").update(html).digest("hex").slice(0,12);
const swPad=path.join(OUT,"sw.js");
if(fs.existsSync(swPad)){
  let sw=fs.readFileSync(swPad,"utf8");
  sw=sw.replace(/weerbriefing-(?:v\d+|[0-9a-f]{12})/g,cacheVersie);
  if(!sw.includes(cacheVersie)) throw new Error("Dynamische serviceworker-cacheversie is niet toegepast.");
  fs.writeFileSync(swPad,sw,"utf8");
}

for(const naam of fs.readdirSync(OUT)){
  if(isInternBestand(naam)) throw new Error("Intern bestand is ten onrechte publiek gebouwd: "+naam);
}

console.log("WeatherNow-build geslaagd: één productiecompiler, senior-hardening toegepast en cacheversie "+cacheVersie+" gevalideerd.");

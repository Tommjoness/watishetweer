"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="<!-- WEATHER NOW CONSUMER FINISH 20260829 -->";

const NUL_UITLEG_OUD=`  const m=/(\\d+)%/.exec((rij.querySelector(".drain")||{}).textContent||"");
  const kans=m?m[1]+"%":"Een niet-nul kans";
  uitleg.textContent=kans+" kans met 0,0 mm betekent dat neerslag mogelijk is, maar dat de verwachte totale hoeveelheid voor die dag op één decimaal afrondt naar 0,0 mm.";`;
const NUL_UITLEG_NIEUW=`  const m=/(\\d+)%/.exec((rij.querySelector(".drain")||{}).textContent||"");
  const kansGetal=m?Number(m[1]):null;
  if(kansGetal!==null&&kansGetal<20){if(uitleg)uitleg.remove();return;}
  const kans=m?m[1]+"% kans":"Neerslag mogelijk";
  uitleg.textContent=kans+" · geen meetbare hoeveelheid berekend.";`;

const NACHT_COMPACT_OUD=`function nachtzichtCompactAantal(totaal,mobiel){
  const n=Math.max(0,Math.floor(Number(totaal)||0));
  return mobiel?Math.min(3,n):n;
}`;
const NACHT_COMPACT_NIEUW=`function nachtzichtCompactAantal(totaal,mobiel){
  const n=Math.max(0,Math.floor(Number(totaal)||0));
  return Math.min(3,n);
}`;
const NACHT_IF_OUD='  if(!mobiel||rijen.length<=zichtbaar){';
const NACHT_IF_NIEUW='  if(rijen.length<=zichtbaar){';
const NACHT_CSS_OUD='#nights .nacht-meer{display:none}';
const NACHT_CSS_NIEUW=`#nights .row.night[hidden]{display:none!important}
#nights .nacht-meer{
  display:block;width:100%;margin:4px 0 0;padding:12px 0 3px;border:0;border-top:1px solid var(--rule);
  text-align:left;color:var(--ink-70);background:transparent;font-family:var(--sans);font-size:11px;
  font-weight:500;letter-spacing:.1em;text-transform:uppercase
}
#nights .nacht-meer:hover{color:var(--ink);border-top-color:var(--ink)}`;

const AQI_OUD='  const schaalIndex = euro ? "Europese AQI" : "Amerikaanse AQI";';
const AQI_NIEUW='  const schaalIndex = euro ? "Europese AQI" : "AQI (VS-schaal)";';

const WIND_OUD=`    if(opvallendeWind){
      const moment=wi>i+1
        ? dagAanduiding(h.time[wi],true)+" rond "+hhmm(h.time[wi])
        : "De komende 24 uur";
      zin3+=(zin3?" ":"")+moment+" is de wind op zijn sterkst met <b>"+bm+" Bft</b> ("+BFTNAAM[bm]+")";
      zin3+=gmax!==null&&gmax>=60&&gi!==null?"; "+dagAanduiding(h.time[gi],true)+" in het uur "+weatherNowUurvak(h.time[gi])+" kunnen windstoten tot "+Math.round(gmax)+" km/u voorkomen.":".";
    }`;
const WIND_NIEUW=`    if(opvallendeWind){
      const windDag=wi>i+1?dagAanduiding(h.time[wi],true):"";
      const moment=windDag
        ? windDag+" rond "+hhmm(h.time[wi])
        : "De komende 24 uur";
      zin3+=(zin3?" ":"")+moment+" is de wind het sterkst, met <b>"+bm+" Bft</b> ("+BFTNAAM[bm]+").";
      if(gmax!==null&&gmax>=60&&gi!==null){
        const gustDag=dagAanduiding(h.time[gi],true);
        const zelfdeDag=windDag&&gustDag===windDag;
        const gustMoment=(zelfdeDag?"":gustDag.toLowerCase()+" ")+"tussen "+weatherNowUurvak(h.time[gi]).replace("–"," en ");
        zin3+=" Windstoten kunnen "+gustMoment+" oplopen tot "+Math.round(gmax)+" km/u.";
      }
    }`;

const GRAFIEK_OUD='  let kandidaten=n<=24?(M?kandidatenRuw.filter(k=>k.rang>1||(k.i%6===0&&!kandidatenRuw.some(g=>g.rang>1&&Math.abs(g.i-k.i)<=1))):kandidatenRuw):kandidatenRuw.filter((k,pos)=>{';
const GRAFIEK_NIEUW=`  let kandidaten=n<=24?(M
    ?kandidatenRuw.filter(k=>k.rang>1||(k.i%6===0&&!kandidatenRuw.some(g=>g.rang>1&&Math.abs(g.i-k.i)<=1)))
    :kandidatenRuw.filter((k,pos,alle)=>{
      if(k.rang!==1)return true;
      const afgerond=Math.round(T[k.i]);
      const belangrijkNabij=kandidatenRuw.some(g=>g.rang>1&&Math.abs(g.i-k.i)<=stap&&Math.round(T[g.i])===afgerond);
      if(belangrijkNabij)return false;
      return !alle.slice(0,pos).some(g=>g.rang===1&&g.i<k.i&&k.i-g.i<=stap*2&&Math.round(T[g.i])===afgerond);
    })
  ):kandidatenRuw.filter((k,pos)=>{`;

const NACHTZIN_OUD=`  if(Number.isFinite(uur)&&uur>=0&&uur<5){
    const huidige=eindigGetal(huidigeTemperatuur);
    if(huidige!==null&&doel>=huidige-0.75)
      return "De minimumtemperatuur vannacht ligt rond "+waarde+".";
    return "Later vannacht koelt het af naar "+waarde+".";
  }
  return "Vannacht koelt het af naar "+waarde+".";`;
const NACHTZIN_NIEUW=`  if(Number.isFinite(uur)&&uur>=0&&uur<5){
    const huidige=eindigGetal(huidigeTemperatuur);
    if(huidige===null)return "De minimumtemperatuur vannacht ligt rond "+waarde+".";
    if(Math.abs(doel-huidige)<0.75)return "Vannacht blijft de temperatuur rond "+waarde+".";
    return doel<huidige
      ?"Vannacht daalt de temperatuur naar ongeveer "+waarde+"."
      :"Vannacht loopt de temperatuur op naar ongeveer "+waarde+".";
  }
  return "Vannacht koelt het af naar ongeveer "+waarde+".";`;

const SEO_NAV_OUD='<nav class="seo-plaatsnav" aria-label="Weer per plaats">';
const SEO_NAV_NIEUW='<nav class="seo-plaatsnav" aria-label="Populaire plaatsen in Nederland">';
const SEO_KOP_OUD='<div class="seo-plaatsnav-kop">Weer per plaats</div>';
const SEO_KOP_NIEUW='<div class="seo-plaatsnav-kop">Populaire plaatsen in Nederland</div>';
const SEO_TEKST_OUD='<p>Bekijk direct het actuele weer en de verwachting voor veelgekozen plaatsen.</p>';
const SEO_TEKST_NIEUW='<p>Bekijk direct het actuele weer en de verwachting voor populaire plaatsen in Nederland.</p>';

function vervangEen(bron,oud,nieuw,label){
  const aantal=bron.split(oud).length-1;
  if(aantal!==1)throw new Error(label+" ontbreekt of is dubbel: "+aantal);
  return bron.replace(oud,nieuw);
}
function htmlBestanden(map){
  const uit=[];
  for(const naam of fs.readdirSync(map)){
    const pad=path.join(map,naam),st=fs.statSync(pad);
    if(st.isDirectory())uit.push(...htmlBestanden(pad));
    else if(naam.endsWith(".html"))uit.push(pad);
  }
  return uit;
}
function pasRuntimeToe(html,label){
  let uit=String(html||"");
  if(uit.includes(MARKER))throw new Error(label+": consumer-finish staat al in de artifact.");
  uit=vervangEen(uit,NUL_UITLEG_OUD,NUL_UITLEG_NIEUW,label+": compacte nul-mm-uitleg");
  uit=vervangEen(uit,NACHT_COMPACT_OUD,NACHT_COMPACT_NIEUW,label+": Nachtzicht compactaantal");
  uit=vervangEen(uit,NACHT_IF_OUD,NACHT_IF_NIEUW,label+": Nachtzicht desktop-toggle");
  uit=vervangEen(uit,NACHT_CSS_OUD,NACHT_CSS_NIEUW,label+": Nachtzicht desktopstijl");
  uit=vervangEen(uit,AQI_OUD,AQI_NIEUW,label+": AQI-schaallabel");
  uit=vervangEen(uit,WIND_OUD,WIND_NIEUW,label+": briefing windcopy");
  uit=vervangEen(uit,GRAFIEK_OUD,GRAFIEK_NIEUW,label+": desktop grafieklabelreductie");
  uit=vervangEen(uit,NACHTZIN_OUD,NACHTZIN_NIEUW,label+": nachtcopy rond middernacht");
  if(uit.includes(SEO_NAV_OUD))uit=vervangEen(uit,SEO_NAV_OUD,SEO_NAV_NIEUW,label+": SEO-nav aria-label");
  if(uit.includes(SEO_KOP_OUD))uit=vervangEen(uit,SEO_KOP_OUD,SEO_KOP_NIEUW,label+": SEO-nav kop");
  if(uit.includes(SEO_TEKST_OUD))uit=vervangEen(uit,SEO_TEKST_OUD,SEO_TEKST_NIEUW,label+": SEO-nav uitleg");
  if((uit.split("</head>").length-1)!==1)throw new Error(label+": head-einde ontbreekt of is dubbel.");
  uit=uit.replace("</head>",MARKER+"\n</head>");
  const scripts=[...uit.matchAll(/<script(?![^>]*\\ssrc=)[^>]*>([\\s\\S]*?)<\\/script>/g)].map(m=>m[1]);
  if(!scripts.length)throw new Error(label+": geen inline runtime gevonden.");
  scripts.forEach((bron,i)=>new vm.Script(bron,{filename:label+":consumer-finish-"+(i+1)}));
  return uit;
}

const bestanden=htmlBestanden(OUT);
let runtimeAantal=0,navAantal=0;
for(const bestand of bestanden){
  let html=fs.readFileSync(bestand,"utf8");
  const runtime=html.includes("function weatherNowDagenNeerslagUitleg(){")&&html.includes("function nachtzichtCompactAantal(totaal,mobiel){");
  if(runtime){
    html=pasRuntimeToe(html,path.relative(OUT,bestand));
    runtimeAantal++;
  }else if(html.includes(SEO_NAV_OUD)||html.includes(SEO_KOP_OUD)||html.includes(SEO_TEKST_OUD)){
    if(html.includes(SEO_NAV_OUD))html=vervangEen(html,SEO_NAV_OUD,SEO_NAV_NIEUW,path.relative(OUT,bestand)+": SEO-nav aria-label");
    if(html.includes(SEO_KOP_OUD))html=vervangEen(html,SEO_KOP_OUD,SEO_KOP_NIEUW,path.relative(OUT,bestand)+": SEO-nav kop");
    if(html.includes(SEO_TEKST_OUD))html=vervangEen(html,SEO_TEKST_OUD,SEO_TEKST_NIEUW,path.relative(OUT,bestand)+": SEO-nav uitleg");
    navAantal++;
  }
  fs.writeFileSync(bestand,html,"utf8");
}
if(runtimeAantal<1)throw new Error("Geen runtimepagina's gevonden voor consumer-finish.");
const versie=vernieuwServiceworkerCache(OUT,"consumer-finish-20260829");
console.log("Consumer-finish toegepast op "+runtimeAantal+" runtimepagina's"+(navAantal?" en "+navAantal+" extra navigatiepagina's":"")+": korte nul-mm-uitleg, compact Nachtzicht op desktop, duidelijk AQI-label, rustigere briefing/windcopy, minder redundante desktop-grafieklabels, natuurlijkere nachtcopy en contextuele NL-plaatsnavigatie; cache "+versie+".");

module.exports={
  MARKER,NUL_UITLEG_OUD,NUL_UITLEG_NIEUW,NACHT_COMPACT_OUD,NACHT_COMPACT_NIEUW,NACHT_IF_OUD,NACHT_IF_NIEUW,
  NACHT_CSS_OUD,NACHT_CSS_NIEUW,AQI_OUD,AQI_NIEUW,WIND_OUD,WIND_NIEUW,GRAFIEK_OUD,GRAFIEK_NIEUW,
  NACHTZIN_OUD,NACHTZIN_NIEUW,SEO_NAV_OUD,SEO_NAV_NIEUW,SEO_KOP_OUD,SEO_KOP_NIEUW,SEO_TEKST_OUD,SEO_TEKST_NIEUW,
  vervangEen,htmlBestanden,pasRuntimeToe
};
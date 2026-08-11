"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const crypto=require("crypto");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");
let html=fs.readFileSync(htmlPad,"utf8");

const MARK="/* ===== Q4 REGENPERIODEN 20260811 ===== */";
if(html.includes(MARK))throw new Error("Q4-regenperioden is al toegepast.");

function vervangExact(van,naar,label){
  const n=html.split(van).length-1;
  if(n!==1)throw new Error(label+" ontbreekt of is dubbel: "+n);
  html=html.replace(van,naar);
}

/* Dagverwachtingen zijn samenvattingen, geen metingen op de minuut. Een bronpunt
   om 12:25 mag daarom niet als schijnprecies moment in een dagregel verschijnen.
   We behouden de kans-/weertype-logica en reduceren uitsluitend de tijdsaanduiding
   tot een natuurlijk dagdeel. */
vervangExact(
  '  const tijd=a.eersteTijd?" rond "+a.eersteTijd:"";',
  '  const tijd=a.eersteTijd?(()=>{const uur=Number(String(a.eersteTijd).slice(0,2));return Number.isFinite(uur)?(uur<6?" in de nacht":uur<12?" in de ochtend":uur<18?" in de middag":" in de avond"):"";})():"";',
  "dagverwachting zonder schijnprecisie"
);

vervangExact('el2.textContent="Houd de grafiek vast voor details.";','el2.textContent="Selecteer een punt in de grafiek voor details.";',"neutrale grafiekhint");
vervangExact('Klik op een dag om die verwachting in de grafiek te laden.','Kies een dag om die verwachting in de grafiek te bekijken.',"neutrale daghint");
vervangExact('<span>Windstoten</span>','<span>Windstoten nu</span>',"ondubbelzinnige windstootkop");

/* De bestaande 24-uursrenderer blijft eigenaar van temperatuur, kans-as,
   zon/nacht, hitvlak en tooltip. Deze laatste laag verwijdert uitsluitend de
   losse hoeveelheidstaven en bouwt daaronder één intervalgebaseerde waarheid.

   Open-Meteo's hourly precipitation op TI[i] hoort bij het voorafgaande uur
   TI[i-1]–TI[i]. Daarom begint een regenperiode bij i-1 en eindigt hij bij i.
   De eerste hoeveelheid van de zichtbare grafiek hoort buiten het venster en
   telt nooit mee. Een interval onder 0,1 mm wordt niet als meetbare regenperiode
   gepresenteerd. */
const START='load(52.3676,4.9041,"Amsterdam",false,true,"NL")';
const startAantal=html.split(START).length-1;
if(startAantal!==1)throw new Error("Initiële load-anker ontbreekt of is dubbel: "+startAantal);
const runtime=`${MARK}
(function(){
  const q4Getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
  const q4Mm=v=>{const n=q4Getal(v);return n===null?"–":n.toFixed(1).replace(".",",");};
  const q4Tijd=t=>String(t||"").slice(11,16);
  const q4DagKort=t=>{try{const d=new Date(String(t).slice(0,10)+"T12:00:00");return DAGEN[d.getDay()]+" "+d.getDate();}catch(e){return "";}};

  function q4Regenperioden(g){
    const h=S.d&&S.d.hourly||{},tijden=Array.isArray(g&&g.TI)?g.TI:[];
    const mm=tijden.map((tijd,i)=>{
      if(i===0)return null;
      const bron=Array.isArray(h.time)?h.time.indexOf(tijd):-1;
      if(bron<0)return null;
      const waarde=q4Getal(h.precipitation&&h.precipitation[bron]);
      if(waarde===null||waarde<0)return null;
      if(S.dag==null&&globalThis.WeatherNowInterpretatie&&typeof globalThis.WeatherNowInterpretatie.lokaalNaarMinuten==="function"){
        const eind=globalThis.WeatherNowInterpretatie.lokaalNaarMinuten(tijd);
        const nu=globalThis.WeatherNowInterpretatie.lokaalNaarMinuten(weatherNowActueleLokaleTijd());
        if(Number.isFinite(eind)&&Number.isFinite(nu)&&eind<=nu)return null;
      }
      return waarde;
    });
    g.MM=mm;
    const perioden=[];let lopend=null;
    for(let i=1;i<mm.length;i++){
      const waarde=mm[i];
      if(waarde!==null&&waarde>=0.1){
        if(!lopend)lopend={van:i-1,tot:i,som:0,piek:i,piekMm:waarde};
        lopend.tot=i;lopend.som+=waarde;
        if(waarde>lopend.piekMm){lopend.piek=i;lopend.piekMm=waarde;}
      }else if(lopend){perioden.push(lopend);lopend=null;}
    }
    if(lopend)perioden.push(lopend);
    return perioden;
  }

  function q4TekenRegenperioden(svg,g,perioden){
    svg.querySelectorAll('g[data-q4-rain-periods]').forEach(el=>el.remove());
    /* Oude hoeveelheidstaven en hun losse mm-cijfers verdwijnen volledig. */
    [...svg.querySelectorAll("rect")].forEach(el=>{
      if(el.getAttribute("fill")===TEAL&&el.getAttribute("fill-opacity")===".16")el.remove();
    });
    [...svg.querySelectorAll("text")].forEach(el=>{
      if(/ millimeter neerslag$/.test(el.getAttribute("aria-label")||""))el.remove();
    });

    /* De vorige correctheidslaag verschoof alle teal teksten een halve kolom om
       de oude hoeveelheidstaven intervalgericht te maken. Dat raakte onbedoeld
       ook de procentlabels. Die kanslabels horen wél exact onder hun tijdstip en
       worden hier één keer teruggezet. */
    [...svg.querySelectorAll("text")].forEach(el=>{
      if(el.getAttribute("fill")!==TEAL||!/^\\d+%$/.test((el.textContent||"").trim()))return;
      if(el.dataset.q4ProbabilityCentered==="1")return;
      const x=q4Getal(el.getAttribute("x"));
      if(x!==null){el.setAttribute("x",String(x+g.cw/2));el.dataset.q4ProbabilityCentered="1";}
    });

    const basisH=q4Getal(g.H)||296;
    if(!perioden.length){
      svg.setAttribute("viewBox","0 0 "+g.W+" "+basisH);
      const aria=(svg.getAttribute("aria-label")||"").replace(/ Neerslagbalken zijn[^.]*?(?:modeluur|omgerekend)\.?/g,"");
      svg.setAttribute("aria-label",aria.trim());
      return;
    }

    const pb=g.pt+g.ih, y=pb+(g.M?48:48), regel=g.M?14:16;
    const compact=g.n>49;
    const regels=compact?1:perioden.length;
    const nieuwH=Math.max(basisH,y+18+regels*regel+8);
    svg.setAttribute("viewBox","0 0 "+g.W+" "+nieuwH);g.H=nieuwH;

    let inhoud="";
    perioden.forEach((p,idx)=>{
      const x1=g.x(p.van),x2=g.x(p.tot),yy=y;
      inhoud+=`<line x1="${x1}" y1="${yy}" x2="${x2}" y2="${yy}" stroke="${TEAL}" stroke-width="3" stroke-linecap="square"/>`
        +`<line x1="${x1}" y1="${yy-4}" x2="${x1}" y2="${yy+4}" stroke="${TEAL}" stroke-width="1"/>`
        +`<line x1="${x2}" y1="${yy-4}" x2="${x2}" y2="${yy+4}" stroke="${TEAL}" stroke-width="1"/>`;
      if(!compact){
        const van=q4Tijd(g.TI[p.van]),tot=q4Tijd(g.TI[p.tot]);
        const pv=q4Tijd(g.TI[p.piek-1]),pt=q4Tijd(g.TI[p.piek]);
        const tekst=van+"–"+tot+" · "+q4Mm(p.som)+" mm · meest "+pv+"–"+pt+": "+q4Mm(p.piekMm)+" mm";
        inhoud+=`<text x="${g.pl}" y="${y+17+idx*regel}" fill="${INK45}" font-family="DM Mono,monospace" font-size="${g.M?9.3:10.2}">${tekst}</text>`;
      }
    });
    if(compact){
      const totaal=perioden.reduce((som,p)=>som+p.som,0);
      let piek=perioden[0];for(const p of perioden)if(p.piekMm>piek.piekMm)piek=p;
      const dag=q4DagKort(g.TI[piek.piek]),pv=q4Tijd(g.TI[piek.piek-1]),pt=q4Tijd(g.TI[piek.piek]);
      const tekst=perioden.length+" neerslagperiode"+(perioden.length===1?"":"n")+" · totaal "+q4Mm(totaal)+" mm · meest "+dag+" "+pv+"–"+pt+": "+q4Mm(piek.piekMm)+" mm";
      inhoud+=`<text x="${g.pl}" y="${y+17}" fill="${INK45}" font-family="DM Mono,monospace" font-size="${g.M?9.1:10}">${tekst}</text>`;
    }
    const groep=document.createElementNS("http://www.w3.org/2000/svg","g");
    groep.setAttribute("data-q4-rain-periods","1");groep.setAttribute("aria-label","Neerslagperioden");groep.innerHTML=inhoud;
    const scrub=svg.querySelector("#scrub");svg.insertBefore(groep,scrub||null);
    const aria=(svg.getAttribute("aria-label")||"").replace(/ Neerslagbalken zijn[^.]*?(?:modeluur|omgerekend)\.?/g,"");
    svg.setAttribute("aria-label",(aria+" Meetbare neerslag staat als aaneengesloten perioden onder de temperatuurcurve.").trim());
  }

  const q4BasisEtmaal=etmaal;
  etmaal=function(start,n){
    q4BasisEtmaal(start,n);
    const svg=document.getElementById("chart"),g=S.geo;
    if(!svg||!g||typeof g.x!=="function"||!Array.isArray(g.TI))return;
    const perioden=q4Regenperioden(g);
    q4TekenRegenperioden(svg,g,perioden);
  };
})();
`;
html=html.replace(START,runtime+START);

/* Desktop-Nachtzicht: de scorebalk blijft informatief, maar krijgt niet langer
   alle resterende breedte terwijl de uitleg in een smalle vaste kolom wordt
   gepropt. Mobiel behoudt zijn eigen bestaande grid. */
const css=`\n${MARK}\n@media(min-width:1100px){\n  .night{grid-template-columns:104px 52px minmax(140px,.72fr) 92px minmax(260px,1fr);gap:14px}\n}\n`;
if((html.match(/<\/style>/g)||[]).length!==1)throw new Error("Exact één stijlblok vereist voor Q4.");
html=html.replace("</style>",css+"</style>");

/* Na de laatste inhoudswijziging wordt de app-shellhash opnieuw uit exact dezelfde
   bronbestanden opgebouwd. */
const CACHE_BRONNEN=[
  "index.html","manifest.json","icon-192.png","icon-512.png","icon-maskable-512.png",
  "bodoni-moda-latin-400-normal.woff2","bodoni-moda-latin-500-normal.woff2",
  "instrument-sans-latin-400-normal.woff2","instrument-sans-latin-500-normal.woff2",
  "instrument-sans-latin-600-normal.woff2","dm-mono-latin-400-normal.woff2","dm-mono-latin-500-normal.woff2"
];
const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime gevonden na Q4.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:q4-"+(i+1)}));
fs.writeFileSync(htmlPad,html,"utf8");

const hash=crypto.createHash("sha256");
for(const naam of CACHE_BRONNEN){
  const p=path.join(OUT,naam);if(!fs.existsSync(p))throw new Error("App-shellbestand ontbreekt voor Q4-cachehash: "+naam);
  hash.update(naam+"\0");hash.update(fs.readFileSync(p));hash.update("\0");
}
const versie="watishetweer-"+hash.digest("hex").slice(0,12);
const swPad=path.join(OUT,"sw.js");let sw=fs.readFileSync(swPad,"utf8");
if(!(sw.match(/watishetweer-[0-9a-f]{12}/g)||[]).length)throw new Error("Geen serviceworker-cachehash voor Q4 gevonden.");
sw=sw.replace(/watishetweer-[0-9a-f]{12}/g,versie);fs.writeFileSync(swPad,sw,"utf8");

console.log("Q4 toegepast: losse neerslagstaven verwijderd, uurperioden + totaal/piek toegevoegd, kanslabels hergecentreerd, dagtijd genuanceerd en Nachtzicht desktop herverdeeld; cache "+versie+".");

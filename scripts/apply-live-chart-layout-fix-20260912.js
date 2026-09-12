"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER_LABEL="LIVE CHART LABEL FIX 20260912";
const MARKER_RAIN="LIVE Q4 CHART COMPACTION 20260912";
const MARKER_LATE_NU="LIVE FUTURE LABEL NU-GUARD 20260912";

/* Deze runtimepatch moet vóór platform-output-cleanup draaien: daarna is de
   hoofdclient uit de HTML gehaald en in de gedeelde/minified app-bundle gezet.
   We matchen bewust op de semantische codevorm en niet op whitespace, maar
   eisen per weerartifact exact één match. */
const LABEL_RE=/if\s*\(nuX\s*!=\s*null\)\s*\{\s*for\s*\(const\s*\[idx\]\s*of\s*\[\.\.\.kandKaart\.entries\(\)\]\)\s*\{\s*if\s*\(Math\.abs\(x\(idx\)\s*-\s*nuX\)\s*<\s*cw\s*\*\s*1\.05\)\s*kandKaart\.delete\(idx\);\s*\}\s*\}/g;
const LABEL_NIEUW=`/* ${MARKER_LABEL} */
  /* De gekoppelde komende-urenweergave mag het lopende modeluur al vóór de
     grafiek afsnijden. Dan begint TI bijvoorbeeld om 18:00 terwijl de echte
     lokale klok 17:35 is. Bepaal het eerste toekomstige modeluur daarom uit
     de provider-lokale tijdstrings zelf. ISO-lokale waarden hebben binnen
     dezelfde provider-as een chronologische lexicografische volgorde. */
  const nuLokaleTijd=String(S.d&&S.d.current&&S.d.current.time||"");
  let eersteToekomst=null;
  if(!M&&n<=24&&nuLokaleTijd){
    for(let i=0;i<T.length;i++){
      if(geldig(i)&&String(TI[i]||"")>nuLokaleTijd){eersteToekomst=i;break;}
    }
  }

  /* Op de compacte desktop-etmaalgrafiek is ieder volledig toekomstig uur een
     primaire informatiewaarde, niet slechts een optioneel rasterlabel. Geef dus
     ieder geldig modeluur ná current.time dezelfde hoge prioriteit. Het lopende
     of laatste verstreken modeluur blijft hieronder bewust vervangbaar door het
     rode actuele nu-label. Mobiel, 48 uur en week blijven bij hun bestaande
     selectieve labeldichtheid. */
  const desktopUurLabels=!M&&n<=24;
  if(desktopUurLabels){
    for(let i=0;i<T.length;i++){
      const modelTijd=String(TI[i]||"");
      if(geldig(i)&&(!nuLokaleTijd||(modelTijd&&modelTijd>nuLokaleTijd))) zet(i,4);
    }
  }else if(eersteToekomst!==null){
    zet(eersteToekomst,4);
  }

  if(nuX!=null){
    /* De gekoppelde desktopgrafiek kan de rode nu-lijn naar de linkergrens
       snappen wanneer het lopende uur al uit TI is gesneden. Geometrie alleen
       mag dan niet doen alsof toekomstige uren redundante actuele modelpunten
       zijn. Alleen de dichtstbijzijnde niet-toekomstige kandidaat mag wijken. */
    let huidigModel=null,afstand=Infinity;
    for(const [idx] of kandKaart.entries()){
      const modelTijd=String(TI[idx]||"");
      if(nuLokaleTijd&&(!modelTijd||modelTijd>nuLokaleTijd)) continue;
      const d=Math.abs(nuX-x(idx));
      if(d<afstand){afstand=d;huidigModel=idx;}
    }
    if(huidigModel!==null&&afstand<cw*1.05) kandKaart.delete(huidigModel);
  }`;

const FALLBACK_OUD='  // dots/labs pas hier opbouwen, uit de uiteindelijke, overlevende gezet-lijst:';
const FALLBACK_NIEUW=`  /* Op desktop moeten alle volledige toekomstige uren de collision-pass
     overleven. De normale owner krijgt eerst alle ruimte om ze te plaatsen.
     Alleen als zo'n verplicht uur nog ontbreekt, proberen we extra veilige
     horizontale posities via exact dezelfde laag- en botsingscontrole. Er is
     géén geforceerde overlap en er wordt geen ander verplicht uur weggevaagd. */
  if(desktopUurLabels){
    const verplichteUren=[];
    for(let i=0;i<T.length;i++){
      const modelTijd=String(TI[i]||"");
      if(geldig(i)&&(!nuLokaleTijd||(modelTijd&&modelTijd>nuLokaleTijd))) verplichteUren.push(i);
    }
    for(const i of verplichteUren){
      if(gezet.some(g=>g.i===i)) continue;
      const v=T[i],bw=labelBreed(v),eersteBoven=soort[i]!==-1,basisX=x(i);
      const stap=Math.max(8,bw/2+6);
      const offsets=[0,stap,-stap,2*stap,-2*stap];
      let poging=null,vrijeX=basisX;
      for(const off of offsets){
        const kandidaatX=basisX+off;
        if(kandidaatX-bw/2<pl-2||kandidaatX+bw/2>W-pr) continue;
        poging=probeerLagen(kandidaatX,v,eersteBoven,null);
        if(!poging)poging=probeerLagen(kandidaatX,v,!eersteBoven,null);
        if(poging){vrijeX=kandidaatX;break;}
      }
      if(poging) gezet.push({i:i,v:v,cx:vrijeX,cy:poging.cy,bw:bw,rang:5});
    }
  }
  // dots/labs pas hier opbouwen, uit de uiteindelijke, overlevende gezet-lijst:`;

/* live-polish-v2 positioneert het rode nu-label ná de basisgrafiek en verwijdert
   daarbij zwarte modelmarkeringen in een geometrische collisionzone. Op de
   compacte desktop-etmaalgrafiek moeten alle toekomstige uurlabels intact
   blijven; alleen niet-toekomstige modelmarkeringen mogen door nu wijken. */
const LATE_NU_OUD=`  gewoneLabels.forEach(el=>{
    const label={x:eindig(el.getAttribute("x")),y:eindig(el.getAttribute("y"))};
    if(nuLabelConcurreert({x:px,y:py},label,S.geo.cw,!!S.geo.M)) verwijderTemperatuurMarkering(svg,el);
  });`;
const LATE_NU_NIEUW=`  /* ${MARKER_LATE_NU} */
  const nuLokaleTijdPolish=String(S.d&&S.d.current&&S.d.current.time||"");
  const tijdenPolish=Array.isArray(S.geo.TI)?S.geo.TI:[];
  const tempPuntenPolish=[...svg.querySelectorAll("circle[data-temp-index]")].map(p=>({
    i:Number(p.getAttribute("data-temp-index")),x:eindig(p.getAttribute("cx"))
  })).filter(p=>Number.isInteger(p.i)&&p.x!==null);
  gewoneLabels.forEach(el=>{
    const label={x:eindig(el.getAttribute("x")),y:eindig(el.getAttribute("y"))};
    if(!nuLabelConcurreert({x:px,y:py},label,S.geo.cw,!!S.geo.M)) return;
    const i=temperatuurPuntIndex(
      {text:String(el.textContent||"").trim(),x:label.x},
      tempPuntenPolish,S.geo.T,Math.max(72,(Number.isFinite(S.geo.cw)?S.geo.cw:36)*2.5)
    );
    const modelTijd=i!==null?String(tijdenPolish[i]||""):"";
    const verplichtToekomstuur=!S.geo.M&&S.geo.n<=24&&modelTijd&&(!nuLokaleTijdPolish||modelTijd>nuLokaleTijdPolish);
    if(verplichtToekomstuur) return;
    verwijderTemperatuurMarkering(svg,el);
  });`;

const REGEN_RE=/const\s+pb\s*=\s*g\.pt\s*\+\s*g\.ih\s*,\s*y\s*=\s*pb\s*\+\s*48\s*,\s*randFont\s*=\s*g\.M\s*\?\s*8\.3\s*:\s*8\.9\s*,\s*bedragFont\s*=\s*g\.M\s*\?\s*8\.8\s*:\s*9\.4\s*;/g;
const REGEN_NIEUW=`/* ${MARKER_RAIN} */
  const pb=g.pt+g.ih;
  const compactDesktop=typeof window!=="undefined"&&window.innerWidth>=1100&&!g.M&&g.n<=25;
  const y=pb+(compactDesktop?30:48),randFont=g.M?8.3:8.9,bedragFont=g.M?8.8:9.4;`;

const HOOGTE_RE=/const\s+nieuwH\s*=\s*Math\.max\(basisH\s*,\s*laatsteBedragY\s*\+\s*17\s*\+\s*8\s*\)\s*;/g;
const HOOGTE_NIEUW='const nieuwH=Math.max(basisH,laatsteBedragY+(compactDesktop?29:25));';

function htmlBestanden(dir){
  const uit=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,item.name);
    if(item.isDirectory())uit.push(...htmlBestanden(p));
    else if(item.isFile()&&item.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}
function vervangRegexExactEen(bron,re,nieuw,label,rel){
  re.lastIndex=0;
  const hits=[...bron.matchAll(re)];
  if(hits.length!==1)throw new Error(rel+": "+label+" ontbreekt of is dubbel: "+hits.length);
  re.lastIndex=0;
  return bron.replace(re,nieuw);
}
function vervangTekstExactEen(bron,oud,nieuw,label,rel){
  const hits=String(bron).split(oud).length-1;
  if(hits!==1)throw new Error(rel+": "+label+" ontbreekt of is dubbel: "+hits);
  return bron.replace(oud,nieuw);
}

function main(){
  let geraakt=0;
  for(const p of htmlBestanden(OUT)){
    let html=fs.readFileSync(p,"utf8");
    if(!html.includes('id="chart"')||!html.includes('data-q4-rain-periods'))continue;
    const rel=path.relative(OUT,p);
    if(html.includes(MARKER_LABEL)||html.includes(MARKER_RAIN)||html.includes(MARKER_LATE_NU))throw new Error(rel+": live chart/layout-fix staat al in artifact.");
    html=vervangRegexExactEen(html,LABEL_RE,LABEL_NIEUW,"nu/modeluur-labelsuppressie",rel);
    html=vervangTekstExactEen(html,FALLBACK_OUD,FALLBACK_NIEUW,"verplichte desktop-uurlabel fallback",rel);
    html=vervangTekstExactEen(html,LATE_NU_OUD,LATE_NU_NIEUW,"late nu-labelcleanup guard",rel);
    html=vervangRegexExactEen(html,REGEN_RE,REGEN_NIEUW,"Q4 desktop regenoffset",rel);
    html=vervangRegexExactEen(html,HOOGTE_RE,HOOGTE_NIEUW,"Q4 desktop grafiekhoogte",rel);
    fs.writeFileSync(p,html,"utf8");
    geraakt++;
  }
  if(!geraakt)throw new Error("Geen weerartifact geraakt door live chart/layout-fix.");
  const cache=vernieuwServiceworkerCache(OUT,"live-chart-layout-fix-20260912");
  console.log("Live chart/layout-fix vóór delivery-cleanup toegepast op "+geraakt+" weerartifacts; cache "+cache+".");
  return {geraakt,cache};
}

if(require.main===module)main();
module.exports={OUT,MARKER_LABEL,MARKER_RAIN,MARKER_LATE_NU,LABEL_RE,LABEL_NIEUW,FALLBACK_OUD,FALLBACK_NIEUW,LATE_NU_OUD,LATE_NU_NIEUW,REGEN_RE,REGEN_NIEUW,HOOGTE_RE,HOOGTE_NIEUW,htmlBestanden,vervangRegexExactEen,vervangTekstExactEen,main};

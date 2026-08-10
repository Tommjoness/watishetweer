/* Tweede gerichte live-polishlaag: kleine browsercorrecties die niet in de
   weerinterpretatie thuishoren. Pure helpers blijven los testbaar in Node. */
(function(root){
"use strict";

const eindig=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;

function klokTekstMetSeconden(delen){
  const p=delen||{};
  if(![p.hour,p.minute,p.second].every(Number.isFinite)) return "--:--:--";
  return String(p.hour).padStart(2,"0")+":"+String(p.minute).padStart(2,"0")+":"+String(p.second).padStart(2,"0");
}

function tooltipWaardeKort(waarde){
  const t=String(waarde==null?"":waarde).trim();
  if(/^geen neerslag verwacht\.?$/i.test(t)) return "droog";
  /* In de tooltip stond links bijvoorbeeld "kans 15:00–16:00". Dat is
     inhoudelijk correct, maar zo breed dat de labelkolom tegen de waarde aan
     liep. Uurdata eindigt altijd op een heel uur, dus dezelfde informatie kan
     zonder betekenisverlies als "kans 15–16u" worden getoond. */
  const tijdvak=/^kans\s+(\d{2}):00[–-](\d{2}):00$/i.exec(t);
  return tijdvak?"kans "+tijdvak[1]+"–"+tijdvak[2]+"u":t;
}

function temperatuurLabelsBotsen(a,b,maxDx){
  if(!a||!b||String(a.text)!==String(b.text)) return false;
  const ax=eindig(a.x),ay=eindig(a.y),bx=eindig(b.x),by=eindig(b.y),lim=eindig(maxDx);
  if([ax,ay,bx,by,lim].some(v=>v===null)) return false;
  return Math.abs(ax-bx)<=lim&&Math.abs(ay-by)<=34;
}

/* Het rode nu-label hoort visueel bij de rode stip, niet bij de zwarte
   temperatuurcijfers van de modelcurve. Normaal staat het daarom onder de stip.
   Alleen als daar onderaan de plot geen ruimte meer is, wijkt het naar boven uit. */
function nuLabelPositie(puntY,plotTop,plotBottom,mobiel){
  const py=eindig(puntY),top=eindig(plotTop),bottom=eindig(plotBottom);
  if([py,top,bottom].some(v=>v===null)||bottom<=top) return null;
  const onderAfstand=mobiel?18:20,bovenAfstand=mobiel?13:15,marge=mobiel?8:10;
  const onder=py+onderAfstand;
  if(onder<=bottom-marge) return {y:onder,onder:true};
  return {y:Math.max(top+marge+3,py-bovenAfstand),onder:false};
}

const api={klokTekstMetSeconden,tooltipWaardeKort,temperatuurLabelsBotsen,nuLabelPositie};
if(typeof module!=="undefined"&&module.exports) module.exports=api;
root.WeatherNowPolishV2=api;

if(typeof document==="undefined"||typeof S==="undefined") return;

/* De klok is puur presentatie. Elke seconde worden alleen de twee klokteksten
   bijgewerkt. De bestaande dagwisselcontrole blijft via klokBijwerken() actief;
   weerdata of grafieken worden dus niet iedere seconde opnieuw opgehaald/getekend. */
const basisKlokBijwerken=klokBijwerken;
const basisClearKlokTimer=clearKlokTimer;
let liveKlokTimer=null,liveKlokUitlijnTimer=null;
function liveKlokTik(){
  basisKlokBijwerken();
  const tijd=klokTekstMetSeconden(plaatsTijdDelen());
  const pt=document.getElementById("plaatstijd");if(pt)pt.textContent=tijd;
  const mt=document.getElementById("minitijd");if(mt)mt.textContent=tijd;
}
clearKlokTimer=function(){
  basisClearKlokTimer();
  if(liveKlokUitlijnTimer!==null){clearTimeout(liveKlokUitlijnTimer);liveKlokUitlijnTimer=null;}
  if(liveKlokTimer!==null){clearInterval(liveKlokTimer);liveKlokTimer=null;}
};
klokTimerStart=function(){
  clearKlokTimer();
  liveKlokTik();
  const wacht=1000-(Date.now()%1000);
  liveKlokUitlijnTimer=setTimeout(()=>{
    liveKlokTik();
    liveKlokTimer=setInterval(liveKlokTik,1000);
  },wacht);
};

/* In de SVG-tooltip staan label en waarde als twee losse tekstnodes. Lange
   consumententeksten worden hier alleen typografisch ingekort; de betekenis
   en brondata blijven ongewijzigd. */
const basisScrubKoppel=scrubKoppel;
scrubKoppel=function(){
  basisScrubKoppel();
  const hit=document.getElementById("hit");
  if(!hit) return;
  const maakKort=()=>{
    const g=document.getElementById("scrub");if(!g)return;
    [...g.querySelectorAll("text")].forEach(el=>{
      const kort=tooltipWaardeKort(el.textContent);
      if(kort!==el.textContent.trim()) el.textContent=kort;
    });
  };
  hit.addEventListener("pointermove",maakKort);
  hit.addEventListener("pointerdown",maakKort);
};

/* Twee opeenvolgende uren met dezelfde afgeronde temperatuur kunnen beide als
   relevant label uit de bestaande grafiek komen. De lijn en punten blijven
   onaangetast; alleen een visueel dubbel label vlak naast zijn tweeling vervalt. */
function ontdubbelTemperatuurlabels(svg){
  if(!svg) return;
  const cw=S.geo&&Number.isFinite(S.geo.cw)?S.geo.cw:36;
  const maxDx=Math.max(38,cw*1.3),gehouden=[];
  const labels=[...svg.querySelectorAll("text")].filter(el=>{
    const ff=String(el.getAttribute("font-family")||"");
    return ff.includes("Bodoni Moda")&&/^-?\d+°$/.test(String(el.textContent||"").trim());
  }).map(el=>({el,text:el.textContent.trim(),x:eindig(el.getAttribute("x")),y:eindig(el.getAttribute("y"))}))
    .filter(x=>x.x!==null&&x.y!==null).sort((a,b)=>a.x-b.x);
  for(const lab of labels){
    if(gehouden.some(v=>temperatuurLabelsBotsen(v,lab,maxDx))) lab.el.remove();
    else gehouden.push(lab);
  }
}

/* Het rode "nu 22°" is belangrijker dan een nabij zwart modeluurlabel. Een
   vaste verschuiving bleek nog te kunnen botsen als een zwart cijfer toevallig
   precies op die nieuwe plek stond. Daarom worden meerdere veilige posities
   werkelijk in de browser gemeten: eerst de voorkeurskant, dan de andere kant,
   daarna iets verder boven/onder. Alleen als geen enkele plek vrij is, mag het
   rode actuele label het botsende zwarte modelcijfer verdringen. */
function positioneerNuLabel(svg){
  if(!svg||!S.geo) return;
  const tekst=[...svg.querySelectorAll("text")].find(el=>/^nu\s+-?\d+°$/i.test(String(el.textContent||"").trim()));
  const punt=[...svg.querySelectorAll("circle")].find(el=>
    String(el.getAttribute("fill")||"")===String(CARMINE)
    &&Math.abs((eindig(el.getAttribute("r"))||0)-3)<0.2);
  if(!tekst||!punt) return;
  const px=eindig(punt.getAttribute("cx")),py=eindig(punt.getAttribute("cy"));
  const top=eindig(S.geo.pt),bottom=top===null||!Number.isFinite(S.geo.ih)?null:top+S.geo.ih;
  const pos=nuLabelPositie(py,top,bottom,!!S.geo.M);
  if(px===null||py===null||top===null||bottom===null||!pos) return;

  tekst.setAttribute("stroke",SHEET);
  tekst.setAttribute("stroke-width",S.geo.M?"2.5":"3");
  tekst.setAttribute("paint-order","stroke");
  tekst.setAttribute("stroke-linejoin","round");

  let breed=54;
  try{const b=tekst.getComputedTextLength();if(Number.isFinite(b)&&b>0)breed=b;}catch(e){}
  const links=Number.isFinite(S.geo.pl)?S.geo.pl:2;
  const rechts=Number.isFinite(S.geo.W)&&Number.isFinite(S.geo.pr)?S.geo.W-S.geo.pr:null;
  const gewoneLabels=[...svg.querySelectorAll("text")].filter(el=>{
    if(el===tekst) return false;
    const ff=String(el.getAttribute("font-family")||"");
    return ff.includes("Bodoni Moda")&&/^-?\d+°$/.test(String(el.textContent||"").trim());
  });
  const raakt=(a,b,marge)=>a.width&&b.width
    &&a.left<b.right+marge&&a.right>b.left-marge
    &&a.top<b.bottom+marge&&a.bottom>b.top-marge;
  const botsers=()=>{
    const r=tekst.getBoundingClientRect();
    return gewoneLabels.filter(el=>raakt(r,el.getBoundingClientRect(),2));
  };
  const plaats=(naarRechts,y,afstand)=>{
    const x=px+(naarRechts?afstand:-afstand);
    if(naarRechts){if(rechts!==null&&x+breed>rechts) return null;}
    else if(x-breed<links) return null;
    if(y<top+8||y>bottom-4) return null;
    tekst.setAttribute("x",String(x));
    tekst.setAttribute("y",String(y));
    tekst.setAttribute("text-anchor",naarRechts?"start":"end");
    return botsers();
  };

  const pastRechts=rechts===null||px+8+breed<=rechts;
  const voorkeur=pastRechts;
  const yVerderOnder=py+(S.geo.M?28:30);
  const yVerderBoven=py-(S.geo.M?22:24);
  const yOpties=[pos.y];
  if(yVerderOnder<=bottom-6&&!yOpties.some(y=>Math.abs(y-yVerderOnder)<1)) yOpties.push(yVerderOnder);
  if(yVerderBoven>=top+10&&!yOpties.some(y=>Math.abs(y-yVerderBoven)<1)) yOpties.push(yVerderBoven);
  const kanten=[voorkeur,!voorkeur];
  let beste=null;
  for(const y of yOpties){
    for(const kant of kanten){
      for(const afstand of [8,16]){
        const b=plaats(kant,y,afstand);
        if(b===null) continue;
        if(!b.length) return;
        if(!beste||b.length<beste.botsers.length) beste={kant,y,afstand,botsers:b};
      }
    }
  }
  if(!beste) return;
  const laatste=plaats(beste.kant,beste.y,beste.afstand);
  if(laatste) laatste.forEach(el=>el.remove());
}

const basisEtmaalPolishV2=etmaal;
etmaal=function(start,n){
  basisEtmaalPolishV2(start,n);
  const svg=document.getElementById("chart");
  ontdubbelTemperatuurlabels(svg);
  positioneerNuLabel(svg);
};

})(typeof globalThis!=="undefined"?globalThis:this);

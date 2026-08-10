/* Gerichte seniorronde 10-08-2026: tijdsemantiek, forecast-horizon en compacte UI.
   Deze laag wordt als laatste buildlaag ingevoegd, zodat bestaande bewezen rekenlagen
   intact blijven. Pure helpers zijn afzonderlijk testbaar in Node. */
(function(root){
"use strict";

const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const pad=n=>String(n).padStart(2,"0");

function datumDagenVerschil(van,naar){
  const p=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||""));return m?[+m[1],+m[2],+m[3]]:null;};
  const a=p(van),b=p(naar); if(!a||!b)return null;
  return Math.round((Date.UTC(b[0],b[1]-1,b[2])-Date.UTC(a[0],a[1]-1,a[2]))/86400000);
}

function hhmm(tijd){
  const m=/(?:T|^)(\d{2}):(\d{2})/.exec(String(tijd||""));
  return m?m[1]+":"+m[2]:null;
}

function dagdeelVanTijd(tijd){
  const t=hhmm(tijd); if(!t)return null;
  const uur=Number(t.slice(0,2));
  if(uur<5) return "nacht";
  if(uur<8) return "vroege ochtend";
  if(uur<12) return "ochtend";
  if(uur<18) return "middag";
  return "avond";
}

function forecastMomentZinsdeel(tijd,horizonDagen){
  const t=hhmm(tijd),h=num(horizonDagen); if(!t)return "";
  if(h===null||h<=2) return "rond "+t;
  if(h<=4){
    const uur=Number(t.slice(0,2)),begin=Math.floor(uur/3)*3,eind=(begin+3)%24;
    return "tussen ongeveer "+pad(begin)+":00 en "+pad(eind)+":00";
  }
  const deel=dagdeelVanTijd(t);
  return deel?"in de "+deel:"";
}

function vervangExactForecastMoment(tekst,tijd,horizonDagen){
  const t=hhmm(tijd); if(!t)return String(tekst||"");
  const h=num(horizonDagen); if(h===null||h<=2)return String(tekst||"");
  const nieuw=forecastMomentZinsdeel(t,h);
  if(!nieuw)return String(tekst||"");
  const patroon=new RegExp("\\s+rond\\s+"+t.replace(":","\\:")+"(?=$|[.;,])","i");
  return String(tekst||"").replace(patroon," "+nieuw);
}

function briefingHistorieSemantiek(html){
  return String(html||"").replace(
    /Vandaag was het rond (\d{2}:\d{2}) het warmst met <b>(-?\d+)(?:\s|&nbsp;|\u00a0)+graden<\/b>\./i,
    (_m,t,v)=>"De hoogste verwachte temperatuur voor vandaag lag rond "+t+" op <b>"+v+"&nbsp;graden</b>."
  );
}

function nachtLabelVarianten(label){
  const t=String(label||"");
  const m=/^([a-z]{2}) op ([a-z]{2})$/i.exec(t);
  return m?{lang:t,kort:m[1]+"–"+m[2]}:{lang:t,kort:t};
}

function nachtAdviesMetHorizon(advies,horizonDagen){
  const t=String(advies||"").trim(),h=num(horizonDagen); if(!t||h===null||h<3)return t;
  const klein=t.charAt(0).toLowerCase()+t.slice(1);
  return h>=5?"Globale indicatie: "+klein:"Voorlopige indicatie: "+klein;
}

function nachtVensterMetHorizon(tekst,horizonDagen){
  const t=String(tekst||""),h=num(horizonDagen); if(h===null||h<=2)return t;
  const m=/^Beste periode\s+(\d{2}:\d{2})[–-](\d{2}:\d{2})$/i.exec(t);
  if(!m)return t;
  const a=dagdeelVanTijd(m[1]),b=dagdeelVanTijd(m[2]);
  if(!a||!b)return t;
  const periode=a===b?"in de "+a:"van de "+a+" tot de "+b;
  return h>=5?"Waarschijnlijk beste periode "+periode:"Beste periode "+periode;
}

function zonInfoRijen(daily,nuLokaal,geselecteerdIndex,daglengteFn,labelFn){
  daily=daily||{}; const tijden=Array.isArray(daily.time)?daily.time:[];
  const sunrise=Array.isArray(daily.sunrise)?daily.sunrise:[],sunset=Array.isArray(daily.sunset)?daily.sunset:[];
  const vandaag=String(nuLokaal||"").slice(0,10),huidig=tijden.indexOf(vandaag);
  let i=Number.isInteger(geselecteerdIndex)&&geselecteerdIndex>=0?geselecteerdIndex:huidig;
  if(i<0||i>=tijden.length)return [];
  const label=idx=>typeof labelFn==="function"?labelFn(tijden[idx]):tijden[idx];
  const lengte=idx=>typeof daglengteFn==="function"?daglengteFn(idx):"";
  const rij=(idx,items)=>({label:label(idx),items:items.filter(Boolean)});
  const op=idx=>sunrise[idx]?"zon op "+hhmm(sunrise[idx]):"";
  const onder=idx=>sunset[idx]?"zon onder "+hhmm(sunset[idx]):"";
  const daglicht=idx=>lengte(idx)||"";

  if(Number.isInteger(geselecteerdIndex)&&geselecteerdIndex>=0){
    return [rij(i,[op(i),onder(i),daglicht(i)])];
  }

  const nu=String(nuLokaal||"");
  if(!sunrise[i]&&!sunset[i]) return [rij(i,[daglicht(i)])];
  if(sunrise[i]&&!sunset[i]){
    return [rij(i,nu<sunrise[i]?[op(i),daglicht(i)]:[daglicht(i)])];
  }
  if(!sunrise[i]&&sunset[i]){
    if(nu<sunset[i]){
      const uit=[rij(i,[onder(i),daglicht(i)])];
      if(i+1<tijden.length&&sunrise[i+1])uit.push(rij(i+1,[op(i+1)]));
      return uit;
    }
    return i+1<tijden.length?[rij(i+1,[op(i+1),onder(i+1),daglicht(i+1)])]:[rij(i,[daglicht(i)])];
  }
  if(nu<sunrise[i]) return [rij(i,[op(i),onder(i),daglicht(i)])];
  if(nu<sunset[i]){
    const uit=[rij(i,[onder(i),daglicht(i)])];
    if(i+1<tijden.length&&sunrise[i+1]) uit.push(rij(i+1,[op(i+1)]));
    return uit;
  }
  if(i+1<tijden.length) return [rij(i+1,[op(i+1),onder(i+1),daglicht(i+1)])];
  return [rij(i,[daglicht(i)])];
}

function escapeHtml(t){return String(t==null?"":t).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}

function tooltipCompactMaten(breedte,hoogte){
  const b=num(breedte),h=num(hoogte); if(b===null||h===null)return null;
  return {breedte:Math.round(b*0.90*10)/10,hoogte:Math.round(h*0.90*10)/10,inzet:12,rijHoogte:15};
}

const api={
  datumDagenVerschil,hhmm,dagdeelVanTijd,forecastMomentZinsdeel,vervangExactForecastMoment,
  briefingHistorieSemantiek,nachtLabelVarianten,nachtAdviesMetHorizon,nachtVensterMetHorizon,
  zonInfoRijen,tooltipCompactMaten
};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowSeniorRonde20260810=api;

if(typeof document==="undefined"||typeof S==="undefined")return;

function actueleDatum(){
  const t=typeof weatherNowActueleLokaleTijd==="function"?weatherNowActueleLokaleTijd():null;
  return String(t||S.d&&S.d.current&&S.d.current.time||"").slice(0,10);
}
function horizonVoorDatum(datum){const d=datumDagenVerschil(actueleDatum(),String(datum||"").slice(0,10));return d===null?0:Math.max(0,d);}

/* Zeven dagen: de kanskolom is inhoudelijk neerslag, en exacte neerslaguren
   worden alleen de eerste twee dagen behouden. Daarna neemt de precisie af. */
const basisDagen=dagen;
dagen=function(){
  basisDagen();
  const kop=document.querySelector("#days .row.day.kop .drain"); if(kop)kop.textContent="Neerslag";
  const interpretatie=root.WeatherNowInterpretatie,beleid=root.WeatherNowKansbeleidV3;
  if(!interpretatie||!beleid)return;
  document.querySelectorAll("#days .row.day:not(.kop)").forEach(rij=>{
    const i=Number(rij.dataset.i),a=interpretatie.analyseerDagData(S.d,i,weatherNowActueleLokaleTijd());
    const cond=rij.querySelector(".dcond"); if(!cond||!a)return;
    const basis=a.code!==null&&typeof txt==="function"?txt(a.code,true):"Verwachting";
    const huidig=beleid.dagKansSamenvatting(a,basis),h=horizonVoorDatum(a.datum);
    cond.textContent=vervangExactForecastMoment(huidig,a.eersteTijd,h);
  });
};

/* Nachtzicht: score blijft dezelfde berekening, maar verre nachten krijgen geen
   exact klokvenster en geen taal die dezelfde zekerheid suggereert als vannacht. */
const basisNachten=nachten;
nachten=function(){
  basisNachten();
  const rijen=[...document.querySelectorAll("#nights .row.night:not(.kop)")];
  rijen.forEach((rij,h)=>{
    const naam=rij.querySelector(".dname"),advies=rij.querySelector(".nachtadvies"),venster=rij.querySelector(".nachtvenster"),score=rij.querySelector(".score");
    if(naam){
      const v=nachtLabelVarianten(naam.textContent);
      naam.innerHTML=v.lang===v.kort?escapeHtml(v.lang):'<span class="nachtlabel-lang">'+escapeHtml(v.lang)+'</span><span class="nachtlabel-kort">'+escapeHtml(v.kort)+'</span>';
    }
    if(advies)advies.textContent=nachtAdviesMetHorizon(advies.textContent,h);
    if(venster)venster.textContent=nachtVensterMetHorizon(venster.textContent,h);
    if(score)score.title=h>=5?"Globale zichtscore op basis van de huidige verwachting":h>=3?"Voorlopige zichtscore op basis van de huidige verwachting":"Zichtscore op basis van de huidige verwachting";
  });
};

/* Verstreken uurwaarden zijn forecast/modelwaarden, geen waarnemingen. De bronzin
   blijft staan voor toekomstige maxima; alleen een piek die al voorbij is krijgt
   expliciet verwachtingstaal. */
const basisMeters=meters;
meters=function(){
  basisMeters();
  try{
    const nu=weatherNowActueleLokaleTijd(),pg=piek("wind_gusts_10m"),sub=document.getElementById("gustsub");
    if(sub&&pg&&pg.t&&nu&&pg.t<nu&&pg.t.slice(0,10)===String(nu).slice(0,10)&&num(pg.v)!==null){
      sub.textContent="De hoogste verwachte windstoot voor vandaag lag op "+Math.round(pg.v)+" km/u in het uur "+weatherNowUurvak(pg.t)+".";
    }
  }catch(e){}
};

const basisBriefing=briefing;
briefing=function(){
  basisBriefing();
  const el=document.getElementById("brief");
  if(el)el.innerHTML=briefingHistorieSemantiek(el.innerHTML);
};

function renderZonInfo(){
  const el=document.getElementById("suntimes"); if(!el||!S.d||!S.d.daily)return;
  const nu=weatherNowActueleLokaleTijd(),geselecteerd=Number.isInteger(S.dag)?S.dag:null;
  const rijen=zonInfoRijen(S.d.daily,nu,geselecteerd,daglengte,datum=>dagAanduiding(datum,true));
  el.classList.add("senior-zoninfo");
  el.innerHTML=rijen.map(r=>'<span class="zonregel"><span class="zondag">'+escapeHtml(r.label)+'</span>'
    +r.items.map(x=>'<span>'+escapeHtml(x)+'</span>').join("")+'</span>').join("");
}

const basisEtmaal=etmaal;
etmaal=function(start,n){basisEtmaal(start,n);renderZonInfo();};

/* Desktop-tooltip: dezelfde zeven informatie-elementen, circa tien procent minder
   breed/hoog door minder padding en compactere regelafstand. Mobiel blijft zoals
   het al was. De box blijft aan dezelfde kant van het aangewezen punt verankerd. */
function compactDesktopTooltip(){
  if(!S.geo||S.geo.M)return;
  const g=document.getElementById("scrub"); if(!g||g.style.display==="none")return;
  const rect=g.querySelector("rect"),teksten=[...g.querySelectorAll("text")];
  if(!rect||teksten.length<13)return;
  const x=num(rect.getAttribute("x")),y=num(rect.getAttribute("y")),w=num(rect.getAttribute("width")),h=num(rect.getAttribute("height"));
  const maten=tooltipCompactMaten(w,h); if(x===null||y===null||!maten)return;
  const lijn=[...g.querySelectorAll("line")].find(l=>l.getAttribute("y1")===l.getAttribute("y2"));
  const puntLijn=[...g.querySelectorAll("line")].find(l=>l!==lijn),puntX=puntLijn?num(puntLijn.getAttribute("x1")):null;
  const oudRechts=x+w,isLinksVanPunt=puntX!==null&&oudRechts<=puntX+1;
  let nx=isLinksVanPunt?oudRechts-maten.breedte:x;
  nx=Math.max(2,Math.min(nx,(num(S.geo.W)||900)-maten.breedte-2));
  rect.setAttribute("x",String(nx));rect.setAttribute("width",String(maten.breedte));rect.setAttribute("height",String(maten.hoogte));rect.setAttribute("stroke-width","0.8");
  const kop=teksten[0];kop.setAttribute("x",String(nx+maten.inzet));kop.setAttribute("y",String(y+16));kop.setAttribute("font-size","14.5");
  if(lijn){lijn.setAttribute("x1",String(nx));lijn.setAttribute("x2",String(nx+maten.breedte));lijn.setAttribute("y1",String(y+24));lijn.setAttribute("y2",String(y+24));}
  for(let r=0;r<6;r++){
    const yy=y+38+r*maten.rijHoogte,label=teksten[1+r*2],waarde=teksten[2+r*2];
    if(label){label.setAttribute("x",String(nx+maten.inzet));label.setAttribute("y",String(yy));}
    if(waarde){waarde.setAttribute("x",String(nx+maten.breedte-maten.inzet));waarde.setAttribute("y",String(yy));}
  }
}
const basisScrubKoppel=scrubKoppel;
scrubKoppel=function(){
  basisScrubKoppel();
  const hit=document.getElementById("hit"); if(!hit)return;
  hit.addEventListener("pointermove",compactDesktopTooltip);
  hit.addEventListener("pointerdown",compactDesktopTooltip);
};

})(typeof globalThis!=="undefined"?globalThis:this);

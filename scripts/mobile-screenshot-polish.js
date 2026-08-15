/* Gerichte polish op basis van fysieke iPhone-controles.
   Nachtzicht heeft hier één presentatie-owner bovenop de canonieke berekening.
   Deze laag normaliseert ook de actieve nacht over de lokale kalendergrens,
   zodat 00:xx niet ineens de volgende avond als 'vannacht' presenteert. */
(function(root){
"use strict";

const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const begrens=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=t=>String(t==null?"":t).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const hhmmIso=t=>{const m=/T(\d{2}):(\d{2})/.exec(String(t||""));return m?m[1]+":"+m[2]:null;};

function datumVerschuif(datum,dagen){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum||""));
  if(!m)return null;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]+Number(dagen||0)));
  return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
}

/* Open-Meteo daily begint normaal op de huidige lokale kalenderdag. Tussen
   middernacht en zonsopkomst hoort de actieve nacht echter bij de zonsondergang
   van de vorige dag. De canonieke renderer koppelt sunset[d] aan sunrise[d+1]
   en zou daardoor zonder deze normalisatie al naar vanavond->morgen springen.
   We voegen uitsluitend voor de render een synthetische vorige kalenderdag toe;
   het echte data-object wordt niet gemuteerd en alle weerformules blijven gelijk. */
function normaliseerNachtDagdata(data,nuLokaal){
  const d=data||{},day=d.daily||{},c=d.current||{};
  if(!Array.isArray(day.time)||!day.time.length||!Array.isArray(day.sunrise)||!Array.isArray(day.sunset))return d;
  const nu=String(nuLokaal||c.time||""),datum=nu.slice(0,10),i=day.time.indexOf(datum);
  if(i!==0||Number(c.is_day)!==0)return d;
  const op=day.sunrise[0];
  if(!op||!(nu<op))return d;
  const gisteren=datumVerschuif(datum,-1);if(!gisteren)return d;
  const dagelijks={...day};
  Object.keys(day).forEach(k=>{
    if(!Array.isArray(day[k]))return;
    dagelijks[k]=[k==="time"?gisteren:null,...day[k]];
  });
  dagelijks.sunset[0]=gisteren+"T23:59";
  dagelijks.sunrise[0]=null;
  return {...d,daily:dagelijks};
}

function nachtIsActiefNu(data,nuLokaal){
  const d=data||{},day=d.daily||{},c=d.current||{},nu=String(nuLokaal||c.time||"");
  if(Number(c.is_day)!==0||!Array.isArray(day.time))return false;
  const i=day.time.indexOf(nu.slice(0,10));if(i<0)return false;
  const op=day.sunrise&&day.sunrise[i],onder=day.sunset&&day.sunset[i];
  return !!((op&&nu<op)||(onder&&nu>=onder));
}

/* De Unicode-fase bevat maar acht stappen. De fase-naam plus het afgeronde
   verlichtingspercentage bewaart meer informatie, dus daaruit leiden we een
   continue fase af. */
function maanFaseUitBeschrijving(tekst){
  const t=String(tekst||"").toLowerCase();
  const m=/(nieuwe maan|wassende sikkel|eerste kwartier|wassende maan|volle maan|afnemende maan|laatste kwartier|afnemende sikkel)\s*,\s*(\d{1,3})\s*procent verlicht/.exec(t);
  if(!m)return null;
  const naam=m[1],pct=begrens(Number(m[2]),0,100),ill=pct/100;
  if(naam==="nieuwe maan")return 0;
  if(naam==="volle maan")return 0.5;
  const hoek=Math.acos(begrens(1-2*ill,-1,1))/(2*Math.PI);
  return /afnemende|laatste/.test(naam)?1-hoek:hoek;
}
function maanFaseSvgV2(fase,size){
  const f=getal(fase),s=Math.max(8,Math.round(getal(size)||12));
  if(f===null)return "";
  const p=((f%1)+1)%1,r=9,boven=12-r,onder=12+r,cos=Math.cos(2*Math.PI*p),ill=(1-cos)/2;
  const schaduw='<circle class="maan-schaduw" cx="12" cy="12" r="'+r+'" fill="var(--moon-unlit)" stroke="var(--moon-outline)" stroke-width="1"/>';
  let vorm="";
  if(ill>0.985)vorm='<circle class="maan-licht-vol" cx="12" cy="12" r="'+r+'" fill="currentColor"/>';
  else if(ill>=0.015){
    if(Math.abs(cos)<0.03){
      vorm=p<0.5?'<path class="maan-licht" d="M12 '+boven+' A'+r+' '+r+' 0 0 1 12 '+onder+' Z" fill="currentColor"/>'
        :'<path class="maan-licht" d="M12 '+boven+' A'+r+' '+r+' 0 0 0 12 '+onder+' Z" fill="currentColor"/>';
    }else{
      const rx=Math.max(0.6,Math.abs(r*cos)).toFixed(2),wassend=p<0.5,buiten=wassend?1:0,binnen=((cos>0)===wassend)?0:1;
      vorm='<path class="maan-licht" d="M 12 '+boven+' A '+r+' '+r+' 0 0 '+buiten+' 12 '+onder+' A '+rx+' '+r+' 0 0 '+binnen+' 12 '+boven+' Z" fill="currentColor"/>';
    }
  }
  return '<svg class="maan-fase-svg maan-fase-svg-v2" data-fase="'+p.toFixed(4)+'" viewBox="0 0 24 24" width="'+s+'" height="'+s+'" aria-hidden="true" focusable="false">'+schaduw+vorm+'</svg>';
}
function verbeterMaanElement(el,size,beschrijving){
  if(!el)return false;
  const tekst=String(beschrijving||el.getAttribute("title")||el.textContent||"");
  const dataFase=getal(el.getAttribute("data-maan-fase"));
  const fase=dataFase!==null&&dataFase>=0&&dataFase<=1?dataFase:maanFaseUitBeschrijving(tekst);
  if(fase===null)return false;
  const svg=maanFaseSvgV2(fase,size);if(!svg)return false;
  const bestaand=el.querySelector(".maan-fase-svg");
  if(bestaand)bestaand.outerHTML=svg;
  else{
    const unicode=[...el.childNodes].find(n=>n.nodeType===3&&/[🌑🌒🌓🌔🌕🌖🌗🌘]/u.test(n.nodeValue||""));
    if(unicode)unicode.nodeValue=String(unicode.nodeValue||"").replace(/[🌑🌒🌓🌔🌕🌖🌗🌘]\uFE0F?/u,"");
    el.insertAdjacentHTML("afterbegin",svg);
  }
  if(el.classList.contains("maanbij"))el.setAttribute("aria-label",tekst);
  return true;
}
function verbeterMaanfasen(){
  document.querySelectorAll("#nights .maanbij").forEach(el=>verbeterMaanElement(el,11));
  const lab=document.getElementById("moonlab");if(lab)verbeterMaanElement(lab,12,lab.textContent);
}

function nachtOordeelGetoond(score){
  const s=getal(score);if(s===null)return "Onvoldoende data";
  const n=begrens(Math.round(s),0,10);
  return n>=9?"Uitstekend":n>=7?"Goed":n>=5?"Redelijk":n>=4?"Matig":"Ongunstig";
}
function nachtBalkPercentageGetoond(score){const s=getal(score);return s===null?0:begrens(Math.round(s),0,10)*10;}
function nachtLabelVarianten(label){
  const t=String(label||""),m=/^([a-z]{2}) op ([a-z]{2})$/i.exec(t);
  return m?{lang:t,kort:m[1]+"–"+m[2]}:{lang:t,kort:t};
}
function nachtAdviesMetHorizon(advies,horizonDagen){
  const t=String(advies||"").trim(),h=getal(horizonDagen);if(!t||h===null||h<3)return t;
  return "Voorlopig "+t.charAt(0).toLowerCase()+t.slice(1);
}
function dagdeelVanUur(tijd){
  const m=/^(\d{2}):(\d{2})$/.exec(String(tijd||""));if(!m)return null;
  const u=Number(m[1]);return u<5?"nacht":u<8?"vroege ochtend":u<12?"ochtend":u<18?"middag":"avond";
}
function minuutVanTijd(tijd){const m=/^(\d{2}):(\d{2})$/.exec(String(tijd||""));return m?Number(m[1])*60+Number(m[2]):null;}
function tijdVanMinuut(min){const v=((Math.round(min)%1440)+1440)%1440;return String(Math.floor(v/60)).padStart(2,"0")+":"+String(v%60).padStart(2,"0");}
function opTijdlijn(min,start){return min===null||start===null?null:(min<start?min+1440:min);}

/* De bronrenderer gebruikt het eerste niet-goede uurpunt als eindpunt, behalve
   wanneer de goede reeks tot aan de astronomische zonsopkomst doorloopt. Alleen
   in het eerste geval trekken we één modeluur af. Daarna wordt het eindpunt hard
   begrensd op de echte zonsopkomst. Een actief venster begint zichtbaar bij 'nu';
   een reeds verstreken beste periode wordt ook als verleden benoemd. */
function corrigeerNachtVensterBron(tekst,horizonDagen,score,opties={}){
  const t=String(tekst||"").trim(),h=getal(horizonDagen),s=getal(score),relatief=s!==null&&s<4;
  if(/^Geen gunstig kijkvenster door /i.test(t))return /[.!?]$/.test(t)?t:t+".";
  if(/^Geen goed zichtvenster door /i.test(t))return t.replace(/^Geen goed zichtvenster/i,"Geen gunstig kijkvenster")+( /[.!?]$/.test(t)?"":".");
  const m=/^Beste periode\s+(\d{2}:\d{2})[–-](\d{2}:\d{2})$/i.exec(t);if(!m)return t;
  const start=m[1],rawEind=m[2],startMin=minuutVanTijd(start),rawEindMin=minuutVanTijd(rawEind);if(startMin===null||rawEindMin===null)return t;
  const zon=String(opties.zonsopkomst||""),zonMin=minuutVanTijd(zon);
  let eind=rawEind===zon?rawEind:tijdVanMinuut(rawEindMin-60);
  let eindLijn=opTijdlijn(minuutVanTijd(eind),startMin);
  const zonLijn=opTijdlijn(zonMin,startMin);
  if(zonLijn!==null&&eindLijn!==null&&eindLijn>zonLijn){eind=zon;eindLijn=zonLijn;}
  if(eindLijn===null||eindLijn<=startMin)return "Geen gunstig kijkvenster.";

  if(h!==null&&h>=3){
    const a=dagdeelVanUur(start),b=dagdeelVanUur(eind);if(!a||!b)return relatief?"Relatief beste periode.":"Beste periode.";
    const deel=a===b?"in de "+a:"van de "+a+" tot de "+b;
    if(relatief)return "Relatief beste periode "+deel+".";
    return (h>=5?"Waarschijnlijk beste periode ":"Beste periode ")+deel+".";
  }

  const nu=opties.actief?minuutVanTijd(opties.nuTijd):null,nuLijn=opTijdlijn(nu,startMin);
  const label=relatief?"Relatief beste periode":"Beste periode";
  if(nuLijn!==null&&nuLijn>=startMin&&nuLijn<eindLijn)return label+": nu tot "+eind+".";
  if(nuLijn!==null&&nuLijn>=eindLijn)return label+" was "+start+"–"+eind+".";
  return label+": "+start+"–"+eind+".";
}

function formatteerMaanTekst(tekst){
  let t=String(tekst||"").replace(/[🌑🌒🌓🌔🌕🌖🌗🌘]\uFE0F?/gu,"").trim();
  t=t.replace(/^de maan\s+/i,"maan ");
  let m=/^maan (?:komt )?op(?: om)? (\d{2}:\d{2})\s*[·,]\s*(?:gaat )?onder(?: om)? (\d{2}:\d{2})$/i.exec(t);
  if(m)return "Maan: komt om "+m[1]+" op en gaat om "+m[2]+" onder.";
  m=/^maan (?:komt )?op(?: om)? (\d{2}:\d{2})$/i.exec(t);if(m)return "Maan: komt om "+m[1]+" op.";
  m=/^maan (?:gaat )?onder(?: om)? (\d{2}:\d{2})$/i.exec(t);if(m)return "Maan: gaat om "+m[1]+" onder.";
  if(/^maan blijft onder de horizon$/i.test(t))return "Maan: blijft onder de horizon.";
  if(/^maan blijft boven de horizon$/i.test(t))return "Maan: blijft boven de horizon.";
  return t?(/^[Mm]aan:/.test(t)?t:"Maan: "+t.charAt(0).toLowerCase()+t.slice(1)):"";
}
function nachtMetaDelen(tekst){
  const t=String(tekst||"").replace(/[🌑🌒🌓🌔🌕🌖🌗🌘]\uFE0F?/gu,"").trim();
  const delen=t.split(/\s*·\s*/).map(x=>x.trim()).filter(Boolean);
  let zicht="",maan="";
  for(const deel of delen){
    if(/^(?:Gem\.?|Gemiddeld) zicht\b/i.test(deel))zicht=deel.replace(/^Gem\.? zicht\s*/i,"Gemiddeld zicht: ").replace(/^Gemiddeld zicht\s+(?!:)/i,"Gemiddeld zicht: ");
    else if(/maan/i.test(deel))maan=maan?maan+" · "+deel:deel;
  }
  if(!maan&&t&&!zicht)maan=t;
  return {zicht,maan:formatteerMaanTekst(maan)};
}

function pollenKop(tekst){
  const t=String(tekst||"").trim();
  const m=/^Pollen\s+(.+)$/i.exec(t);if(!m)return t;
  const soort=m[1].toLowerCase();
  if(soort==="gras")return "Graspollen";
  if(soort==="bijvoet")return "Bijvoetpollen";
  return m[1].charAt(0).toUpperCase()+m[1].slice(1).toLowerCase()+"pollen";
}

function verbeterNachtzicht(data,nuLokaal,actief){
  const rijen=[...document.querySelectorAll("#nights .row.night:not(.kop)")],day=data&&data.daily||{};
  rijen.forEach((rij,h)=>{
    const naam=rij.querySelector(".dname"),score=rij.querySelector(".score"),advies=rij.querySelector(".nachtadvies"),bew=rij.querySelector(".nmeta:not(.wide)"),maan=rij.querySelector(".nachtmaan");
    if(naam){const v=nachtLabelVarianten((naam.textContent||"").trim());naam.innerHTML=v.lang===v.kort?esc(v.lang):'<span class="nachtlabel-lang">'+esc(v.lang)+'</span><span class="nachtlabel-kort">'+esc(v.kort)+'</span>';}
    const sm=/^(\d+)\/10$/.exec(String(score&&score.textContent||"").trim()),zichtbaar=sm?Number(sm[1]):null;
    if(score){
      score.title=h>=5?"Globale zichtscore op basis van de huidige verwachting":h>=3?"Voorlopige zichtscore op basis van de huidige verwachting":"Zichtscore op basis van de huidige verwachting";
      if(zichtbaar!==null){
        const teal=typeof TEAL!=="undefined"?TEAL:"currentColor",ink=typeof INK!=="undefined"?INK:"currentColor",ink25=typeof INK25!=="undefined"?INK25:"currentColor",kleur=zichtbaar>=7?teal:zichtbaar>=4?ink:ink25;
        score.style.color=kleur;const balk=rij.querySelector(".sbar i");if(balk){balk.style.background=kleur;balk.style.width=nachtBalkPercentageGetoond(zichtbaar)+"%";}
      }
    }
    if(advies){
      const delen=String(advies.textContent||"").split(/\s+·\s+/),venster=delen.length>1?delen.slice(1).join(" · "):"";
      const oordeel=zichtbaar===null?(delen[0]||advies.textContent):nachtOordeelGetoond(zichtbaar),hoofd=nachtAdviesMetHorizon(oordeel,h);
      const sr=Array.isArray(day.sunrise)?hhmmIso(day.sunrise[h+1]):null;
      const detail=venster?corrigeerNachtVensterBron(venster,h,zichtbaar,{zonsopkomst:sr,actief:!!actief&&h===0,nuTijd:hhmmIso(nuLokaal)}):"";
      advies.innerHTML='<span class="nachtoordeel">'+esc(hoofd)+'</span>'+(detail?'<span class="nachtvenster">'+esc(detail)+'</span>':"");
    }
    if(bew){const p=bew.querySelector(".perc");if(p){const pct=(p.textContent||"").trim();bew.innerHTML='<span class="perc">'+esc(pct)+'</span>';bew.setAttribute("aria-label","Bewolking "+pct);}}
    if(maan){
      const icoon=maan.querySelector(".maanbij"),icoonHtml=icoon?icoon.outerHTML:"",meta=nachtMetaDelen(maan.textContent||"");
      maan.innerHTML=(meta.zicht?'<span class="nachtzichtregel">'+esc(meta.zicht)+'</span>':"")+(meta.maan?'<span class="nachtmaanregel">'+icoonHtml+(icoonHtml?" ":"")+esc(meta.maan)+'</span>':"");
    }
  });
  verbeterMaanfasen();
}

function pollenEenheid(waarde){const v=getal(waarde);return v!==null&&Math.round(v)===1?"korrel/m³":"korrels/m³";}
function corrigeerPollenPresentatie(){
  document.querySelectorAll("#aq .stat").forEach(stat=>{
    const kop=stat.querySelector(".eyebrow"),waarde=stat.querySelector(".sval"),eenheid=waarde&&waarde.querySelector("s");
    if(!kop||!/^Pollen\s+/i.test((kop.textContent||"").trim())||!waarde||!eenheid)return;
    kop.textContent=pollenKop(kop.textContent);
    const eerste=waarde.firstChild&&waarde.firstChild.nodeType===3?waarde.firstChild.nodeValue:"",zichtbaar=getal(String(eerste||"").trim());
    if(zichtbaar!==null)eenheid.textContent=pollenEenheid(zichtbaar);
  });
}

/* Bronnen zijn zelfstandige items. Geen decoratieve slash of middendot wordt
   onderdeel van de tekststroom, zodat wrapping op mobiel nooit een los teken
   achterlaat. */
function structureerBronnen(){
  const bron=document.querySelector("footer .bron:first-child");if(!bron||bron.classList.contains("bron-bronnen"))return false;
  const links=[...bron.querySelectorAll("a")],pak=naam=>links.find(a=>(a.textContent||"").trim()===naam);
  const open=pak("Open-Meteo"),alarm=pak("MeteoAlarm"),nws=pak("National Weather Service"),osm=pak("© OpenStreetMap-bijdragers");
  if(!open||!alarm||!nws||!osm)return false;
  bron.classList.add("bron-bronnen");
  bron.innerHTML='<span class="bronlabel">Bronnen</span>'
    +'<span class="bronitem">'+open.outerHTML+'</span>'
    +'<span class="bronitem">CAMS</span>'
    +'<span class="bronitem">'+alarm.outerHTML+'</span>'
    +'<span class="bronitem">'+nws.outerHTML+'</span>'
    +'<span class="bronitem">BigDataCloud</span>'
    +'<span class="bronitem">'+osm.outerHTML+'</span>';
  return true;
}

const api={
  maanFaseUitBeschrijving,maanFaseSvgV2,pollenEenheid,pollenKop,nachtOordeelGetoond,
  nachtBalkPercentageGetoond,nachtLabelVarianten,nachtAdviesMetHorizon,
  corrigeerNachtVensterBron,dagdeelVanUur,datumVerschuif,normaliseerNachtDagdata,
  nachtIsActiefNu,formatteerMaanTekst,nachtMetaDelen
};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowMobileScreenshotPolish=api;

if(typeof document==="undefined"||typeof S==="undefined")return;

structureerBronnen();

const basisNachten=nachten;
nachten=function(){
  const origineel=S.d,nu=typeof weatherNowActueleLokaleTijd==="function"?weatherNowActueleLokaleTijd():(origineel&&origineel.current&&origineel.current.time)||"";
  const actief=nachtIsActiefNu(origineel,nu),renderData=normaliseerNachtDagdata(origineel,nu);
  try{if(renderData!==origineel)S.d=renderData;basisNachten();}
  finally{S.d=origineel;}
  verbeterNachtzicht(renderData,nu,actief);
};

const basisLucht=lucht;
lucht=function(){basisLucht();corrigeerPollenPresentatie();};

})(typeof globalThis!=="undefined"?globalThis:this);
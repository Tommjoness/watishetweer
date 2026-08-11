/* Gerichte polish op basis van de fysieke iPhone-screenshots van 10-08-2026.
   Checkpoint 50 consolideert hier ook de Nachtzicht-presentatie: één runtime-owner
   na de canonieke nachtbewerking, zonder een tweede senior-wrapper eronder. */
(function(root){
"use strict";

const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const begrens=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=t=>String(t==null?"":t).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

/* De Unicode-fase in Nachtzicht bevat maar acht stappen. De fase-naam plus het
   afgeronde verlichtingspercentage bewaart meer informatie, dus daaruit leiden
   we een continue fase af: wassend in [0,.5], afnemend in [.5,1]. */
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

/* De v2-SVG tekent juist het VERLICHTE deel. De neutrale ronde CSS-drager is
   daarmee de onverlichte schijf. Dit blijft in licht, donker en rood thema
   semantisch hetzelfde: nieuwe maan is leeg, volle maan volledig gevuld en de
   kwartieren spiegelen elkaar. */
function maanFaseSvgV2(fase,size){
  const f=getal(fase),s=Math.max(8,Math.round(getal(size)||12));
  if(f===null)return "";
  const p=((f%1)+1)%1,r=9,boven=12-r,onder=12+r,cos=Math.cos(2*Math.PI*p),ill=(1-cos)/2;
  const schaduw='<circle class="maan-schaduw" cx="12" cy="12" r="'+r+'" fill="var(--moon-unlit)" stroke="var(--moon-outline)" stroke-width="1"/>';
  let vorm="";
  if(ill>0.985){
    vorm='<circle class="maan-licht-vol" cx="12" cy="12" r="'+r+'" fill="currentColor"/>';
  }else if(ill>=0.015){
    if(Math.abs(cos)<0.03){
      vorm=p<0.5
        ?'<path class="maan-licht" d="M12 '+boven+' A'+r+' '+r+' 0 0 1 12 '+onder+' Z" fill="currentColor"/>'
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
  const svg=maanFaseSvgV2(fase,size);
  if(!svg)return false;
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
  const lab=document.getElementById("moonlab");
  if(lab)verbeterMaanElement(lab,12,lab.textContent);
}

function nachtOordeelGetoond(score){
  const s=getal(score);if(s===null)return "Onvoldoende data";
  const n=begrens(Math.round(s),0,10);
  return n>=9?"Uitstekend":n>=7?"Goed":n>=5?"Redelijk":n>=4?"Matig":"Ongunstig";
}
function nachtBalkPercentageGetoond(score){
  const s=getal(score);return s===null?0:begrens(Math.round(s),0,10)*10;
}
function nachtLabelVarianten(label){
  const t=String(label||"");
  const m=/^([a-z]{2}) op ([a-z]{2})$/i.exec(t);
  return m?{lang:t,kort:m[1]+"–"+m[2]}:{lang:t,kort:t};
}
function nachtAdviesMetHorizon(advies,horizonDagen){
  const t=String(advies||"").trim(),h=getal(horizonDagen);if(!t||h===null||h<3)return t;
  const klein=t.charAt(0).toLowerCase()+t.slice(1);
  return h>=5?"Later in de week: "+klein:"Voorlopig "+klein;
}
function dagdeelVanUur(tijd){
  const m=/^(\d{2}):(\d{2})$/.exec(String(tijd||""));if(!m)return null;
  const u=Number(m[1]);
  return u<5?"nacht":u<8?"vroege ochtend":u<12?"ochtend":u<18?"middag":"avond";
}
function minuutVanTijd(tijd){
  const m=/^(\d{2}):(\d{2})$/.exec(String(tijd||""));
  return m?Number(m[1])*60+Number(m[2]):null;
}
function tijdVanMinuut(min){
  const v=((Math.round(min)%1440)+1440)%1440;
  return String(Math.floor(v/60)).padStart(2,"0")+":"+String(v%60).padStart(2,"0");
}

/* De canonieke nachtrenderer markeert een goed uurpunt en gebruikte het EERSTE
   volgende (dus al niet-goede) uur als eindtijd. Twee goede punten 22:00 en
   23:00 konden daardoor als 22:00–00:00 worden getoond. Open-Meteo's hourly
   cloud_cover is een waarde OP het aangegeven uur, dus checkpoint 50 presenteert
   uitsluitend de daadwerkelijk gunstige modeluren en trekt één uur van dat
   kunstmatige eindpunt af. Voor verre nachten verdwijnen exacte kloktijden weer
   naar dagdelen, zodat de tekst niet preciezer oogt dan de forecast-horizon. */
function corrigeerNachtVensterBron(tekst,horizonDagen,score){
  const t=String(tekst||"").trim(),h=getal(horizonDagen),s=getal(score),relatief=s!==null&&s<4;
  const m=/^Beste periode\s+(\d{2}:\d{2})[–-](\d{2}:\d{2})$/i.exec(t);
  if(!m)return t;
  const eind=minuutVanTijd(m[2]);if(eind===null)return t;
  const werkelijkEind=tijdVanMinuut(eind-60),start=m[1];
  if(h!==null&&h>=3){
    const a=dagdeelVanUur(start),b=dagdeelVanUur(werkelijkEind);
    if(!a||!b)return relatief?"Relatief gunstigste zicht":"Gunstigste zicht";
    const deel=a===b?"in de "+a:"van de "+a+" tot de "+b;
    if(relatief)return "Relatief gunstigste zicht "+deel;
    return h>=5?"Waarschijnlijk gunstigste zicht "+deel:"Gunstigste zicht "+deel;
  }
  return (relatief?"Relatief gunstigste modeluren ":"Beste modeluren ")+start+"–"+werkelijkEind;
}

/* Eén eigenaar voor de zichtbare Nachtzicht-rijen. De canonieke berekening blijft
   onaangeraakt; hier worden uitsluitend score/oordeel/balk, horizonformulering,
   compacte labels, bewolkingspresentatie en maanfase op elkaar afgestemd. */
function verbeterNachtzicht(){
  const rijen=[...document.querySelectorAll("#nights .row.night:not(.kop)")];
  rijen.forEach((rij,h)=>{
    const naam=rij.querySelector(".dname"),score=rij.querySelector(".score"),advies=rij.querySelector(".nachtadvies"),bew=rij.querySelector(".nmeta:not(.wide)");
    if(naam){
      const v=nachtLabelVarianten((naam.textContent||"").trim());
      naam.innerHTML=v.lang===v.kort?esc(v.lang):'<span class="nachtlabel-lang">'+esc(v.lang)+'</span><span class="nachtlabel-kort">'+esc(v.kort)+'</span>';
    }
    const m=/^(\d+)\/10$/.exec(String(score&&score.textContent||"").trim()),zichtbaar=m?Number(m[1]):null;
    if(score){
      score.title=h>=5?"Globale zichtscore op basis van de huidige verwachting":h>=3?"Voorlopige zichtscore op basis van de huidige verwachting":"Zichtscore op basis van de huidige verwachting";
      if(zichtbaar!==null){
        const teal=typeof TEAL!=="undefined"?TEAL:"currentColor",ink=typeof INK!=="undefined"?INK:"currentColor",ink25=typeof INK25!=="undefined"?INK25:"currentColor";
        const kleur=zichtbaar>=7?teal:zichtbaar>=4?ink:ink25;
        score.style.color=kleur;
        const balk=rij.querySelector(".sbar i");if(balk){balk.style.background=kleur;balk.style.width=nachtBalkPercentageGetoond(zichtbaar)+"%";}
      }
    }
    if(advies){
      const delen=String(advies.textContent||"").split(/\s+·\s+/),venster=delen.length>1?delen.slice(1).join(" · "):"";
      const oordeel=zichtbaar===null?(delen[0]||advies.textContent):nachtOordeelGetoond(zichtbaar);
      const hoofd=nachtAdviesMetHorizon(oordeel,h),detail=venster?corrigeerNachtVensterBron(venster,h,zichtbaar):"";
      advies.textContent=detail?hoofd+" · "+detail:hoofd;
    }
    if(bew){
      const p=bew.querySelector(".perc");
      if(p){const pct=(p.textContent||"").trim();bew.innerHTML='<span class="perc">'+esc(pct)+'</span>';bew.setAttribute("aria-label","Bewolking "+pct);}
    }
  });
  verbeterMaanfasen();
}

/* De weergegeven pollenwaarde wordt afgerond vóór hij de gebruiker bereikt.
   De eenheid volgt daarom dat zichtbare getal: 1 korrel/m³, alle andere waarden
   korrels/m³. */
function pollenEenheid(waarde){
  const v=getal(waarde);
  return v!==null&&Math.round(v)===1?"korrel/m³":"korrels/m³";
}
function corrigeerPollenEenheden(){
  document.querySelectorAll("#aq .stat").forEach(stat=>{
    const kop=stat.querySelector(".eyebrow"),waarde=stat.querySelector(".sval"),eenheid=waarde&&waarde.querySelector("s");
    if(!kop||!/^Pollen\s+/i.test((kop.textContent||"").trim())||!waarde||!eenheid)return;
    const eerste=waarde.firstChild&&waarde.firstChild.nodeType===3?waarde.firstChild.nodeValue:"";
    const zichtbaar=getal(String(eerste||"").trim());
    if(zichtbaar===null)return;
    eenheid.textContent=pollenEenheid(zichtbaar);
  });
}

/* De bronregel blijft volledig, maar elk broncluster mag zelfstandig wrappen. */
function structureerBronnen(){
  const bron=document.querySelector("footer .bron:first-child");
  if(!bron||bron.classList.contains("bron-bronnen"))return false;
  const links=[...bron.querySelectorAll("a")];
  const pak=naam=>links.find(a=>(a.textContent||"").trim()===naam);
  const open=pak("Open-Meteo"),alarm=pak("MeteoAlarm"),nws=pak("National Weather Service"),osm=pak("© OpenStreetMap-bijdragers");
  if(!open||!alarm||!nws||!osm)return false;
  bron.classList.add("bron-bronnen");
  bron.innerHTML='<span class="bronlabel">Bronnen</span>'
    +'<span class="bronitem">'+open.outerHTML+' / CAMS</span>'
    +'<span class="bronitem">'+alarm.outerHTML+'</span>'
    +'<span class="bronitem">'+nws.outerHTML+'</span>'
    +'<span class="bronitem">BigDataCloud / '+osm.outerHTML+'</span>';
  return true;
}

const api={
  maanFaseUitBeschrijving,maanFaseSvgV2,pollenEenheid,nachtOordeelGetoond,
  nachtBalkPercentageGetoond,nachtLabelVarianten,nachtAdviesMetHorizon,
  corrigeerNachtVensterBron,dagdeelVanUur
};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowMobileScreenshotPolish=api;

if(typeof document==="undefined"||typeof S==="undefined")return;

structureerBronnen();

const basisNachten=nachten;
nachten=function(){
  basisNachten();
  verbeterNachtzicht();
};

const basisLucht=lucht;
lucht=function(){
  basisLucht();
  corrigeerPollenEenheden();
};

})(typeof globalThis!=="undefined"?globalThis:this);

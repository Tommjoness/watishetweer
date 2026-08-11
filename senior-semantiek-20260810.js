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
    (_m,t,v)=>"Vandaag was het rond "+t+" het warmst, met <b>"+v+"&nbsp;graden</b>."
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

function daglichtGrammatica(tekst){
  return String(tekst||"").replace(/\b1 minuten\b/g,"1 minuut");
}

function nachtOordeelGetoond(score){
  const s=num(score); if(s===null)return "Onvoldoende data";
  const n=Math.max(0,Math.min(10,Math.round(s)));
  return n>=9?"Uitstekend":n>=7?"Goed":n>=5?"Redelijk":n>=4?"Matig":"Ongunstig";
}
function nachtBalkPercentageGetoond(score){
  const s=num(score); return s===null?0:Math.max(0,Math.min(10,Math.round(s)))*10;
}

function neerslagWeerCode(code){
  const c=num(code); return c!==null&&c>=51&&c<=99;
}

function uvOordeelGetoond(waarde){
  const v=num(waarde); if(v===null)return "onbekend";
  const n=Math.max(0,Math.round(v));
  return n<3?"laag":n<6?"matig":n<8?"hoog":n<11?"zeer hoog":"extreem";
}

function bewolkingOordeelGetoond(waarde,isDag){
  const v=num(waarde); if(v===null)return null;
  const n=Math.max(0,Math.min(100,Math.round(v)));
  if(n===100)return "Geheel bewolkt";
  if(n>=95)return "Vrijwel geheel bewolkt";
  if(n>=70)return "Zwaar bewolkt";
  if(n>=40)return "Half bewolkt";
  if(n>=15)return isDag===false?"Overwegend helder":"Overwegend zonnig";
  return "Vrijwel onbewolkt";
}

function bewolkingscodeUitPercentage(waarde){
  const v=num(waarde);if(v===null||v<0||v>100)return null;
  return v>=70?3:v>=40?2:v>=15?1:0;
}

function bewolkingMagActueelWeerOverschrijven(code){
  const c=num(code);
  return c!==null&&c>=0&&c<=3;
}

function actueleBewolkingsomschrijving(code,waarde,isDag,fallback){
  const c=num(code);
  if(c===null||c<0||c>3)return String(fallback||"");
  return bewolkingOordeelGetoond(waarde,isDag)||String(fallback||"");
}

function aqiOordeelGetoond(waarde,europees){
  const v=num(waarde); if(v===null)return {tekst:"onbekend",kleur:"ink45"};
  const n=Math.max(0,Math.round(v));
  if(europees){
    if(n<=20)return {tekst:"goed",kleur:"teal"};
    if(n<=40)return {tekst:"redelijk",kleur:"teal"};
    if(n<=60)return {tekst:"matig",kleur:"ink"};
    if(n<=80)return {tekst:"slecht",kleur:"carmine"};
    if(n<=100)return {tekst:"zeer slecht",kleur:"carmine"};
    return {tekst:"extreem slecht",kleur:"carmine"};
  }
  if(n<=50)return {tekst:"goed",kleur:"teal"};
  if(n<=100)return {tekst:"redelijk",kleur:"teal"};
  if(n<=150)return {tekst:"ongezond voor gevoelige groepen",kleur:"ink"};
  if(n<=200)return {tekst:"ongezond",kleur:"carmine"};
  if(n<=300)return {tekst:"zeer ongezond",kleur:"carmine"};
  return {tekst:"gevaarlijk",kleur:"carmine"};
}

function pollenOordeelGetoond(waarde){
  const v=num(waarde); if(v===null)return {tekst:"onbekend",kleur:"ink45"};
  const n=Math.max(0,Math.round(v));
  if(n<10)return {tekst:"laag",kleur:"ink45"};
  if(n<50)return {tekst:"matig",kleur:"ink"};
  if(n<200)return {tekst:"hoog",kleur:"carmine"};
  return {tekst:"zeer hoog",kleur:"carmine"};
}

function zichtOordeelGetoond(kilometer,plus){
  const km=num(kilometer); if(plus===true)return "Goed zicht, tien kilometer of meer.";
  if(km===null)return "Niet beschikbaar.";
  if(km<1)return "Slecht zicht, minder dan een kilometer.";
  if(km<4)return "Beperkt zicht.";
  if(km<10)return "Redelijk zicht.";
  return "Goed zicht, ongeveer tien kilometer.";
}

function zonurenOordeelGetoond(uren){
  const u=num(uren); if(u===null)return null;
  return u<2?"Weinig zon vandaag":u<=7?"Een aantal zonuren vandaag":"Vandaag redelijk wat zon";
}

const MAAN_SYMBOLEN=["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘"];
function maanFaseUitSymbool(symbool){
  const s=String(symbool||"").replace(/\uFE0E|\uFE0F/g,"").trim();
  const i=MAAN_SYMBOLEN.indexOf(s); return i<0?null:i/8;
}

function maanFaseSvg(fase,size){
  const f=num(fase),s=Math.max(8,Math.round(num(size)||12));
  if(f===null)return "";
  const p=((f%1)+1)%1,r=7,cos=Math.cos(2*Math.PI*p),ill=(1-cos)/2;
  const o='<circle cx="12" cy="12" r="'+r+'" fill="none" stroke="currentColor" stroke-width="1.2"/>';
  let vorm="";
  if(ill>0.97) vorm='<circle cx="12" cy="12" r="'+r+'" fill="currentColor"/>';
  else if(ill>=0.03){
    if(Math.abs(cos)<0.03){
      vorm=p<0.5?'<path d="M12 5 A7 7 0 0 1 12 19 Z" fill="currentColor"/>'
        :'<path d="M12 5 A7 7 0 0 0 12 19 Z" fill="currentColor"/>';
    }else{
      const rx=Math.max(0.6,Math.abs(r*cos)).toFixed(2),wassend=p<0.5,buiten=wassend?1:0,binnen=((cos>0)===wassend)?0:1;
      vorm='<path d="M 12 5 A 7 7 0 0 '+buiten+' 12 19 A '+rx+' 7 0 0 '+binnen+' 12 5 Z" fill="currentColor"/>';
    }
  }
  return '<svg class="maan-fase-svg" viewBox="0 0 24 24" width="'+s+'" height="'+s+'" aria-hidden="true" focusable="false">'+vorm+o+'</svg>';
}

function maanSymboolNaarSvgInHtml(html,size){
  const bron=String(html==null?"":html);
  const symbool=MAAN_SYMBOLEN.find(s=>bron.includes(s));
  if(!symbool)return bron;
  const fase=maanFaseUitSymbool(symbool),svg=maanFaseSvg(fase,size);
  if(!svg)return bron;
  return bron.replace(symbool+"\uFE0F",svg).replace(symbool+"\uFE0E",svg).replace(symbool,svg);
}

function zonInfoRijen(daily,nuLokaal,geselecteerdIndex,daglengteFn,labelFn){
  daily=daily||{}; const tijden=Array.isArray(daily.time)?daily.time:[];
  const sunrise=Array.isArray(daily.sunrise)?daily.sunrise:[],sunset=Array.isArray(daily.sunset)?daily.sunset:[];
  const vandaag=String(nuLokaal||"").slice(0,10),huidig=tijden.indexOf(vandaag);
  let i=Number.isInteger(geselecteerdIndex)&&geselecteerdIndex>=0?geselecteerdIndex:huidig;
  if(i<0||i>=tijden.length)return [];
  const label=idx=>typeof labelFn==="function"?labelFn(tijden[idx]):tijden[idx];
  const lengte=idx=>typeof daglengteFn==="function"?daglichtGrammatica(daglengteFn(idx)):"";
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
  daglichtGrammatica,nachtOordeelGetoond,nachtBalkPercentageGetoond,neerslagWeerCode,uvOordeelGetoond,bewolkingOordeelGetoond,
  bewolkingscodeUitPercentage,bewolkingMagActueelWeerOverschrijven,actueleBewolkingsomschrijving,
  aqiOordeelGetoond,pollenOordeelGetoond,zichtOordeelGetoond,zonurenOordeelGetoond,
  maanFaseUitSymbool,maanFaseSvg,maanSymboolNaarSvgInHtml,zonInfoRijen,tooltipCompactMaten
};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeatherNowSeniorRonde20260810=api;

if(typeof document==="undefined"||typeof S==="undefined")return;

function actueleDatum(){
  const t=typeof weatherNowActueleLokaleTijd==="function"?weatherNowActueleLokaleTijd():null;
  return String(t||S.d&&S.d.current&&S.d.current.time||"").slice(0,10);
}
function horizonVoorDatum(datum){const d=datumDagenVerschil(actueleDatum(),String(datum||"").slice(0,10));return d===null?0:Math.max(0,d);}
function kleurToken(naam){return naam==="teal"?TEAL:naam==="carmine"?CARMINE:naam==="ink45"?INK45:INK;}

/* Zeven dagen: de neerslagkolom draagt de kans. De verwachtingkolom noemt
   neerslag alleen als het dagelijkse weerbeeld zelf een neerslagcode heeft;
   zo staat "Bewolkt" niet nogmaals als "kleine neerslagkans" naast 20%. */
const basisDagen=dagen;
dagen=function(){
  basisDagen();
  const kop=document.querySelector("#days .row.day.kop .drain"); if(kop)kop.textContent="Neerslag";
  const interpretatie=root.WeatherNowInterpretatie,beleid=root.WeatherNowKansbeleidV3;
  if(!interpretatie||!beleid)return;
  document.querySelectorAll("#days .row.day:not(.kop)").forEach(rij=>{
    const i=Number(rij.dataset.i),a=interpretatie.analyseerDagData(S.d,i,weatherNowActueleLokaleTijd());
    const cond=rij.querySelector(".dcond"); if(!cond||!a)return;
    const basis=a.code!==null&&typeof txt==="function"?txt(a.code,true):"Verwachting",h=horizonVoorDatum(a.datum);
    const huidig=neerslagWeerCode(a.code)?beleid.dagKansSamenvatting(a,basis):basis;
    cond.textContent=vervangExactForecastMoment(huidig,a.eersteTijd,h);
  });
};

function vervangMaanSymbolen(){
  document.querySelectorAll("#nights .maanbij").forEach(el=>{
    el.innerHTML=maanSymboolNaarSvgInHtml(el.innerHTML||el.textContent,11);
  });
  const lab=document.getElementById("moonlab");
  if(lab)lab.innerHTML=maanSymboolNaarSvgInHtml(lab.innerHTML||lab.textContent,12);
}

/* Nachtzicht: zichtbare score, oordeel en kleur gebruiken exact dezelfde afgeronde
   score. Daarmee kan 7/10 nooit meer naast "Redelijk" staan. */
const basisNachten=nachten;
nachten=function(){
  basisNachten();
  const rijen=[...document.querySelectorAll("#nights .row.night:not(.kop)")];
  rijen.forEach((rij,h)=>{
    const naam=rij.querySelector(".dname"),advies=rij.querySelector(".nachtadvies"),venster=rij.querySelector(".nachtvenster"),score=rij.querySelector(".score"),bew=rij.querySelector(".nmeta:not(.wide)");
    if(naam){
      const v=nachtLabelVarianten(naam.textContent);
      naam.innerHTML=v.lang===v.kort?escapeHtml(v.lang):'<span class="nachtlabel-lang">'+escapeHtml(v.lang)+'</span><span class="nachtlabel-kort">'+escapeHtml(v.kort)+'</span>';
    }
    const m=/^(\d+)\/10$/.exec(String(score&&score.textContent||"").trim()),zichtbaar=m?Number(m[1]):null;
    if(advies&&zichtbaar!==null)advies.textContent=nachtAdviesMetHorizon(nachtOordeelGetoond(zichtbaar),h);
    else if(advies)advies.textContent=nachtAdviesMetHorizon(advies.textContent,h);
    if(venster)venster.textContent=nachtVensterMetHorizon(venster.textContent,h);
    if(score){
      score.title=h>=5?"Globale zichtscore op basis van de huidige verwachting":h>=3?"Voorlopige zichtscore op basis van de huidige verwachting":"Zichtscore op basis van de huidige verwachting";
      if(zichtbaar!==null){
        const kleur=zichtbaar>=7?TEAL:zichtbaar>=4?INK:INK25;
        score.style.color=kleur;
        const balk=rij.querySelector(".sbar i");if(balk){balk.style.background=kleur;balk.style.width=nachtBalkPercentageGetoond(zichtbaar)+"%";}
      }
    }
    if(bew){const p=bew.querySelector(".perc");if(p)bew.innerHTML='<span class="perc">'+escapeHtml(p.textContent)+'</span>';}
  });
  vervangMaanSymbolen();
};

/* Verstreken uurwaarden zijn forecast/modelwaarden, geen waarnemingen. Daarnaast
   worden categorieën die naast afgeronde cijfers staan op exact die zichtbare
   cijfers gebaseerd: wind/Bft, bewolking, UV en zicht kunnen zo niet botsen. */
const basisMeters=meters;
meters=function(){
  basisMeters();
  try{
    const c=S.d.current||{},nu=weatherNowActueleLokaleTijd(),pg=piek("wind_gusts_10m"),gustSub=document.getElementById("gustsub");
    if(gustSub&&pg&&pg.t&&nu&&pg.t<nu&&pg.t.slice(0,10)===String(nu).slice(0,10)&&num(pg.v)!==null){
      gustSub.textContent="De hoogste verwachte windstoot voor vandaag bedroeg "+Math.round(pg.v)+" km/u in het uur "+weatherNowUurvak(pg.t)+".";
    }

    const wind=num(c.wind_speed_10m),richting=num(c.wind_direction_10m);
    if(wind!==null&&wind>=0){
      const zichtbaar=Math.round(wind),bf=bft(zichtbaar),richtingVol=kompas(richting),sub=document.getElementById("windsub");
      if(sub)sub.textContent=bf===0?"Vrijwel windstil.":BFTNAAM[bf].charAt(0).toUpperCase()+BFTNAAM[bf].slice(1)+(richtingVol?" uit het "+richtingVol:"")+" ("+bf+" Bft)."+(richtingVol?"":" Windrichting niet beschikbaar.");
    }

    const cc=num(c.cloud_cover),huidigeCode=num(c.weather_code),cloudSub=document.getElementById("cloudsub");
    if(cloudSub&&cc!==null&&cc>=0&&cc<=100){
      const oordeel=bewolkingOordeelGetoond(cc,c.is_day!==0);if(oordeel)cloudSub.textContent=oordeel+".";
      const alleenBewolking=bewolkingMagActueelWeerOverschrijven(huidigeCode);
      const omschrijving=actueleBewolkingsomschrijving(huidigeCode,cc,c.is_day!==0,typeof txt==="function"?txt(huidigeCode,c.is_day!==0):"");
      if(omschrijving&&alleenBewolking){
        const conditie=document.getElementById("cond"),mini=document.getElementById("minicond");
        if(conditie)conditie.textContent=omschrijving;
        if(mini){mini.textContent=omschrijving.toLowerCase();mini.title=omschrijving.toLowerCase();}
        const effectieveCode=bewolkingscodeUitPercentage(cc),icoon=document.getElementById("nowicon");
        if(icoon&&effectieveCode!==null&&typeof icon==="function")icoon.innerHTML=icon(effectieveCode,c.is_day===1,46);
      }
    }

    const pu=piek("uv_index"),uvSub=document.getElementById("uvsub");
    if(uvSub&&pu&&num(pu.v)!==null&&pu.v>=0){
      const zichtbaar=Math.round(Math.max(0,pu.v));
      uvSub.textContent=pu.v<0.5?"Nauwelijks UV vandaag.":"Rond "+hhmm(pu.t)+" · "+uvOordeelGetoond(zichtbaar)+".";
    }

    const zicht=num(c.visibility!=null?c.visibility:(S.d.hourly&&S.d.hourly.visibility&&S.d.hourly.visibility[S.i0])),visSub=document.getElementById("vissub");
    if(visSub&&zicht!==null&&zicht>=0){
      const plus=zicht>=10000,km=plus?10:Number((zicht/1000).toFixed(1));
      visSub.textContent=zichtOordeelGetoond(km,plus);
    }
  }catch(e){}
};

const basisBriefing=briefing;
briefing=function(){
  basisBriefing();
  const el=document.getElementById("brief");
  if(el)el.innerHTML=briefingHistorieSemantiek(el.innerHTML);
};

/* Ook luchtkwaliteit/pollen en zonuren gebruiken categorieën naast afgeronde
   waarden. De grenswaarde wordt daarom op het zichtbare getal toegepast. */
const basisLucht=lucht;
lucht=function(){
  basisLucht();
  try{
    if(!S.air||!S.air.current)return;
    const c=S.air.current,eu=num(c.european_aqi),us=num(c.us_aqi),europees=typeof inEuropa==="function"&&inEuropa(S.lat,S.lon)&&eu!==null,raw=europees?eu:us;
    const eerste=document.querySelector("#aq .stat");
    if(eerste&&raw!==null){
      const zichtbaar=Math.round(raw),o=aqiOordeelGetoond(zichtbaar,europees),val=eerste.querySelector(".sval"),sub=eerste.querySelector(".ssub");
      if(val){val.textContent=zichtbaar;val.style.color=kleurToken(o.kleur);}
      if(sub)sub.textContent=o.tekst+" · "+(europees?"Europese AQI":"Amerikaanse AQI");
    }
    document.querySelectorAll("#aq .stat").forEach(stat=>{
      const kop=stat.querySelector(".eyebrow"),val=stat.querySelector(".sval"),sub=stat.querySelector(".ssub");
      if(!kop||!val||!sub)return;
      if(kop.textContent.trim()==="Zonuren"){
        const u=Number(String(val.textContent||"").replace(",",".").replace(/[^0-9.-]/g,""));
        const tekst=zonurenOordeelGetoond(u);if(tekst)sub.textContent=tekst;
      }else if(/^Pollen\s+/i.test(kop.textContent)){
        const v=Number(String(val.textContent||"").replace(/[^0-9.-]/g,""));
        if(Number.isFinite(v)){const o=pollenOordeelGetoond(v);sub.textContent=o.tekst;val.style.color=kleurToken(o.kleur);}
      }
    });
  }catch(e){}
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

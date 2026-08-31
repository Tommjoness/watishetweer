/* Finale wereldwijde correctheidsregels 2026-09-01.
 * Pure functies: geen DOM, geen netwerk en geen plaatsnamen als uitzonderingen.
 */
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.WeatherNowFinalGlobalCorrectness=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
"use strict";

const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
const norm=v=>String(v==null?"":v).trim().toLocaleLowerCase("und").normalize("NFKC");
const coord=v=>{const n=num(v);return n===null?"":n.toFixed(4);};

function zoekSleutel(r){
  if(!r||typeof r!=="object")return null;
  return [norm(r.name),norm(r.country_code||r.country),norm(r.admin1),norm(r.admin2),coord(r.latitude),coord(r.longitude)].join("|");
}

function dedupliceerZoekresultaten(resultaten,max=Infinity){
  const uit=[],gezien=new Set(),limiet=Number.isFinite(Number(max))?Math.max(0,Math.floor(Number(max))):Infinity;
  for(const r of Array.isArray(resultaten)?resultaten:[]){
    if(!r||typeof r!=="object"||!String(r.name||"").trim()||num(r.latitude)===null||num(r.longitude)===null)continue;
    const k=zoekSleutel(r);if(!k||gezien.has(k))continue;
    gezien.add(k);uit.push(r);if(uit.length>=limiet)break;
  }
  return uit;
}

function datumVerschuif(datum,dagen){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum||""));if(!m)return null;
  const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+Number(dagen||0)));
  return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
}
function parseLokaal(iso){
  const m=/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/.exec(String(iso||""));
  if(!m)return null;
  const p={jaar:+m[1],maand:+m[2],dag:+m[3],uur:+m[4],minuut:+m[5]};
  if(p.maand<1||p.maand>12||p.dag<1||p.dag>31||p.uur>23||p.minuut>59)return null;
  p.datum=m[1]+"-"+m[2]+"-"+m[3];p.tijd=m[4]+":"+m[5];
  p.civiel=Date.UTC(p.jaar,p.maand-1,p.dag,p.uur,p.minuut);
  return p;
}
function tijdDelen(epoch,tijdzone){
  try{
    const f=new Intl.DateTimeFormat("en-CA",{timeZone:tijdzone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
    const o={};for(const x of f.formatToParts(new Date(epoch)))if(x.type!=="literal")o[x.type]=x.value;
    if(!o.year||!o.month||!o.day||!o.hour||!o.minute)return null;
    return {jaar:+o.year,maand:+o.month,dag:+o.day,uur:+o.hour,minuut:+o.minute};
  }catch(_){return null;}
}
function zelfdeLokaal(p,q){return !!(p&&q&&p.jaar===q.jaar&&p.maand===q.maand&&p.dag===q.dag&&p.uur===q.uur&&p.minuut===q.minuut);}
function tijdzoneKandidaten(iso,tijdzone){
  const p=parseLokaal(iso);if(!p||!tijdzone)return [];
  const offsets=new Set();
  for(let h=-36;h<=36;h+=6){
    const probe=p.civiel+h*3600000,parts=tijdDelen(probe,tijdzone);if(!parts)continue;
    const alsUtc=Date.UTC(parts.jaar,parts.maand-1,parts.dag,parts.uur,parts.minuut);
    offsets.add(Math.round((alsUtc-probe)/60000)*60000);
  }
  const uit=[];
  for(const off of offsets){
    const epoch=p.civiel-off;if(zelfdeLokaal(p,tijdDelen(epoch,tijdzone)))uit.push(epoch);
  }
  return [...new Set(uit)].sort((a,b)=>a-b);
}
function intervalEpoch(startIso,eindIso,tijdzone,referentieMs){
  const a=tijdzoneKandidaten(startIso,tijdzone),b=tijdzoneKandidaten(eindIso,tijdzone);
  if(!a.length||!b.length)return null;
  const kandidaten=[];
  for(const s of a)for(const e of b)if(e>s&&e-s<=30*3600000)kandidaten.push({start:s,eind:e});
  if(!kandidaten.length)return null;
  if(Number.isFinite(Number(referentieMs))){
    const r=Number(referentieMs);
    kandidaten.sort((x,y)=>Math.abs((x.start+x.eind)/2-r)-Math.abs((y.start+y.eind)/2-r));
  }else kandidaten.sort((x,y)=>x.start-y.start||x.eind-y.eind);
  return kandidaten[0];
}
function huidigEpoch(nuIso,tijdzone,referentieMs){
  const ks=tijdzoneKandidaten(nuIso,tijdzone);if(!ks.length)return null;
  if(Number.isFinite(Number(referentieMs))){const r=Number(referentieMs);return ks.reduce((a,b)=>Math.abs(b-r)<Math.abs(a-r)?b:a);}
  return ks[0];
}

function vensterDelen(tekst){
  const t=String(tekst||"").trim();
  const m=/^(Relatief beste periode|Beste periode)(?:\s+was|:)?\s*(\d{2}:\d{2})[–-](\d{2}:\d{2})[.!?]*$/i.exec(t);
  return m?{label:m[1],start:m[2],eind:m[3]}:null;
}
function nachtVensterTijdsvorm(tekst,opt={}){
  const d=vensterDelen(tekst);if(!d)return String(tekst||"");
  const h=num(opt.horizonDagen);
  if(h!==null&&h>0)return d.label+": "+d.start+"–"+d.eind+".";
  const datum=String(opt.nachtDatum||"").slice(0,10),nu=parseLokaal(opt.nuDatumTijd);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(datum)||!nu)return d.label+": "+d.start+"–"+d.eind+".";
  const eindDatum=d.eind<=d.start?datumVerschuif(datum,1):datum;
  if(!eindDatum)return d.label+": "+d.start+"–"+d.eind+".";
  const startIso=datum+"T"+d.start,eindIso=eindDatum+"T"+d.eind,tz=String(opt.tijdzone||"");
  const interval=intervalEpoch(startIso,eindIso,tz,opt.nuEpochMs),nuEpoch=huidigEpoch(opt.nuDatumTijd,tz,opt.nuEpochMs);
  let toestand="toekomstig";
  if(interval&&nuEpoch!==null){
    toestand=nuEpoch>=interval.eind?"verstreken":nuEpoch>=interval.start?"actief":"toekomstig";
  }else{
    const s=parseLokaal(startIso),e=parseLokaal(eindIso);
    if(s&&e)toestand=nu.civiel>=e.civiel?"verstreken":nu.civiel>=s.civiel?"actief":"toekomstig";
  }
  if(toestand==="verstreken")return d.label+" was "+d.start+"–"+d.eind+".";
  if(toestand==="actief")return d.label+": nu tot "+d.eind+".";
  return d.label+": "+d.start+"–"+d.eind+".";
}

function temperatuurEenheid(v){const n=num(v);return n!==null&&Math.abs(n)===1?"graad":"graden";}
function temperatuurTekst(v){const n=num(v);return n===null?"":String(v)+" "+temperatuurEenheid(n);}
function corrigeerGradenTekst(tekst){
  return String(tekst==null?"":tekst).replace(/(^|[^\d,.-])(-?1) graden\b/g,"$1$2 graad");
}

const WMO={
  0:"Onbewolkt",1:"Overwegend zonnig",2:"Half bewolkt",3:"Bewolkt",45:"Mist",48:"Rijpmist",
  51:"Lichte motregen",53:"Motregen",55:"Dichte motregen",56:"Lichte ijzelmotregen",57:"IJzelmotregen",
  61:"Lichte regen",63:"Regen",65:"Zware regen",66:"Lichte ijzel",67:"IJzel",
  71:"Lichte sneeuw",73:"Sneeuw",75:"Zware sneeuw",77:"Sneeuwkorrels",
  80:"Lichte regenbuien",81:"Regenbuien",82:"Zware regenbuien",85:"Lichte sneeuwbuien",86:"Zware sneeuwbuien",
  95:"Onweer",96:"Onweer met hagel",99:"Zwaar onweer met hagel"
};
function neerslagCode(code){const c=num(code);return c!==null&&((c>=51&&c<=82)||(c>=85&&c<=86)||c===95||c===96||c===99);}
function dagBasis(a,basis){
  const code=num(a&&a.code),mm=num(a&&a.hoeveelheid);
  let t=code!==null&&WMO[code]?WMO[code]:String(basis||"Verwachting");
  if(neerslagCode(code)&&mm!==null&&mm>=5)t=t.replace(/^Lichte\s+/i,"");
  return t;
}
function dagKansTekst(a,basis){
  const b=dagBasis(a,basis),k=num(a&&a.kans),soort=b.toLowerCase(),tijd=String(a&&a.eersteTijd||"");
  if(k===null)return b;
  const dagdeel=(()=>{const m=/^(\d{1,2}):/.exec(tijd);if(!m)return "";const u=+m[1];return u<5?" in de nacht":u<8?" in de vroege ochtend":u<12?" in de ochtend":u<18?" in de middag":" in de avond";})();
  if(!neerslagCode(a&&a.code))return b;
  if(k===0)return "Overwegend droog";
  if(k<=9)return "Zeer kleine kans op "+soort+dagdeel;
  if(k<=29)return "Kleine kans op "+soort+dagdeel;
  if(k<=69)return b+" mogelijk"+dagdeel;
  if(k<=89)return "Grote kans op "+soort+dagdeel;
  return "Zeer grote kans op "+soort+dagdeel;
}

function dagHoeveelheidStatus(kans,mm){
  const k=num(kans),m=num(mm);
  if(m!==null&&m<0)return "niet beschikbaar";
  if(m===null)return k!==null&&k>0?"hoeveelheid onzeker":"niet beschikbaar";
  if(m===0)return k===0?"Droog":k!==null&&k>0?"0,0 mm":"0,0 mm";
  if(m<0.005)return "spoor";
  if(m<0.05)return "<0,05 mm";
  return m.toFixed(1).replace(".",",")+" mm";
}

function modelRisicos(input={}){
  const uit=[];
  const voeg=(id,ernst,tekst,waarde)=>uit.push({id,ernst,tekst,waarde});
  const t=num(input.maxTemperatuur),g=num(input.maxGevoel),uv=num(input.maxUv),gust=num(input.maxWindstoot),vis=num(input.minZicht),aqi=num(input.aqi),schaal=String(input.aqiSchaal||"");
  if(t!==null&&t>=40)voeg("hitte",3,"Extreme hitte in de modelverwachting ("+Math.round(t)+" °C).",t);
  else if(g!==null&&g>=40)voeg("gevoel-hitte",3,"Zeer hoge gevoelstemperatuur in de modelverwachting ("+Math.round(g)+" °C).",g);
  if(aqi!==null&&((schaal==="US"&&aqi>=151)||(schaal==="EU"&&aqi>80)))voeg("luchtkwaliteit",3,"Luchtkwaliteit volgens het model is ongezond ("+(schaal==="US"?"AQI VS ":"Europese AQI ")+Math.round(aqi)+").",aqi);
  if(uv!==null&&uv>=11)voeg("uv",3,"Extreme UV-index in de modelverwachting ("+Math.round(uv)+").",uv);
  else if(uv!==null&&uv>=8)voeg("uv",2,"Zeer hoge UV-index in de modelverwachting ("+Math.round(uv)+").",uv);
  if(gust!==null&&gust>=90)voeg("windstoten",2,"Zware windstoten in de modelverwachting (tot "+Math.round(gust)+" km/u).",gust);
  if(vis!==null&&vis>=0&&vis<1000)voeg("zicht",2,"Zeer slecht zicht in de modelverwachting (minder dan 1 km).",vis);
  return uit.sort((a,b)=>b.ernst-a.ernst).slice(0,2);
}

function nachtAdvies(score,reden){
  const s=num(score),r=String(reden||"").trim().replace(/[.!?]+$/g,"");
  if(s===null)return r?"Geen gunstig kijkvenster door "+r+".":"Onvoldoende gegevens voor een betrouwbare beoordeling.";
  if(s>=7){
    if(/maan/i.test(r))return "De totale zichtscore is hoog; maanlicht maakt de hemel minder donker.";
    if(r)return "De totale zichtscore is hoog, maar "+r+" onderbreekt een langer optimaal kijkvenster.";
    return "De totale zichtscore is hoog.";
  }
  if(s>=5){
    if(r)return "De omstandigheden zijn redelijk, maar "+r+" onderbreekt een langer gunstig kijkvenster.";
    return "De omstandigheden zijn redelijk.";
  }
  return r?"Geen gunstig kijkvenster door "+r+".":"Geen gunstig kijkvenster in deze periode.";
}

return {zoekSleutel,dedupliceerZoekresultaten,datumVerschuif,parseLokaal,tijdzoneKandidaten,nachtVensterTijdsvorm,temperatuurEenheid,temperatuurTekst,corrigeerGradenTekst,dagBasis,dagKansTekst,dagHoeveelheidStatus,modelRisicos,nachtAdvies};
});

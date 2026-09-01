"use strict";

const assert=require("assert");
const {kansHoofd,hoeveelheidTekst}=require("../neerslagkans-policy-v3.js");
const {analyseerDagData}=require("../interpretatie-engine.js");
const {zonInfoRijen}=require("../senior-semantiek-20260810.js");

const BFT=[1,6,12,20,29,39,50,62,75,89,103,117.000001];

function getal(v){return v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;}
function bft(k){const n=getal(k);if(n===null||n<0)return null;let uit=0;for(const grens of BFT)if(n>=grens)uit++;return uit;}
function zichtbaarGetal(tekst){const m=/-?\d+(?:[.,]\d+)?/.exec(String(tekst||""));return m?Number(m[0].replace(",",".")):null;}
function dagNeerslag(kans,mm){
  const k=getal(kans),hoeveelheid=getal(mm),genoeg=k!==null||hoeveelheid!==null;
  return {
    hoofd:String(kansHoofd({genoeg,kans:k,hoeveelheid})||"–"),
    hoeveelheid:hoeveelheid!==null&&(hoeveelheid>=0.1||(hoeveelheid===0&&k!==null&&k>0))
      ?(hoeveelheid===0?"0,0 mm":hoeveelheidTekst(hoeveelheid)):""
  };
}
function uvPiekVandaag(bron){
  const dag=String(bron?.current?.time||"").slice(0,10),tijden=bron?.hourly?.time||[],waarden=bron?.hourly?.uv_index||[];
  let max=null;
  for(let i=0;i<tijden.length;i++){
    if(String(tijden[i]).slice(0,10)!==dag)continue;
    const v=getal(waarden[i]);if(v!==null&&v>=0)max=max===null?v:Math.max(max,v);
  }
  return max===null?null:Math.round(max);
}
function zonDagIndex(bron){
  const daily=bron?.daily||{},datum=String(bron?.current?.time||"").slice(0,10);
  let i=Array.isArray(daily.time)?daily.time.indexOf(datum):-1;if(i<0)i=0;
  const onder=daily.sunset&&daily.sunset[i];
  if(onder&&String(bron.current.time)>=String(onder)&&i+1<(daily.time||[]).length)i++;
  return i;
}
function hhmm(tijd){const m=/(?:T|^)(\d{2}):(\d{2})/.exec(String(tijd||""));return m?m[1]+":"+m[2]:null;}
function datumDagenVerschil(van,naar){
  const p=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||""));return m?[+m[1],+m[2],+m[3]]:null;};
  const a=p(van),b=p(naar);if(!a||!b)return null;
  return Math.round((Date.UTC(b[0],b[1]-1,b[2])-Date.UTC(a[0],a[1]-1,a[2]))/86400000);
}
function poolDaglichtStatus(daily,index){
  const sr=daily?.sunrise?.[index],ss=daily?.sunset?.[index],srt=hhmm(sr),sst=hhmm(ss);
  if(srt!=="00:00"||sst!=="00:00")return "";
  const dagen=datumDagenVerschil(String(sr).slice(0,10),String(ss).slice(0,10));
  if(dagen===0)return "poolnacht";
  if(dagen===1)return "24 uur daglicht";
  return "";
}
function zonVerwachting(bron,nuOverride){
  /* De productie rendert zoninfo tegen weatherNowActueleLokaleTijd(). Rond
     zonsopkomst/-ondergang kan de current.time uit dezelfde providerresponse
     enkele minuten ouder zijn. Gebruik daarom dezelfde live lokale horizon als
     de UI wanneer de browsermonitor die expliciet heeft meegegeven.

     Open-Meteo kan rond de geografische polen 00:00/00:00 als sentinel leveren.
     De product-UI vertaalt die combinatie bewust naar poolnacht of pooldag. De
     bronmonitor moet daarom dezelfde semantiek gebruiken en mag 00:00 niet als
     een echte zonsopkomst/-ondergang eisen. */
  const horizon=String(nuOverride||bron?.current?.time||""),daily=bron?.daily||{};
  const rijen=zonInfoRijen(daily,horizon,null,idx=>poolDaglichtStatus(daily,idx),datum=>datum);
  const items=rijen.flatMap(r=>r.items||[]),op=[],onder=[];
  for(const item of items){
    const opMatch=/^zon op\s+(\d{2}:\d{2})$/i.exec(String(item));
    const onderMatch=/^zon onder\s+(\d{2}:\d{2})$/i.exec(String(item));
    if(opMatch)op.push(opMatch[1]);
    if(onderMatch)onder.push(onderMatch[1]);
  }
  return {rijen,op,onder};
}
function verwachtDagRijen(bron,nuOverride){
  const d=bron?.daily||{},a=[];
  const horizon=String(nuOverride||bron?.current?.time||"");
  const vandaag=horizon.slice(0,10);
  for(let i=0;i<Math.min(7,(d.time||[]).length);i++){
    const resterend=String(d.time[i]||"")===vandaag?analyseerDagData(bron,i,horizon):null;
    const kans=resterend?resterend.kans:d.precipitation_probability_max?.[i];
    const hoeveelheid=resterend?resterend.hoeveelheid:d.precipitation_sum?.[i];
    a.push({
      datum:String(d.time[i]||""),
      min:getal(d.temperature_2m_min?.[i])===null?null:Math.round(Number(d.temperature_2m_min[i])),
      max:getal(d.temperature_2m_max?.[i])===null?null:Math.round(Number(d.temperature_2m_max[i])),
      wind:bft(d.wind_speed_10m_max?.[i]),
      neerslag:resterend&&!resterend.genoeg?{hoofd:"–",hoeveelheid:""}:dagNeerslag(kans,hoeveelheid)
    });
  }
  return a;
}
function verifieerBronwaarheid(bron,ui,label,nuOverride){
  const gelijk=(werkelijk,verwacht,omschrijving)=>assert.equal(
    werkelijk,
    verwacht,
    `${omschrijving}; UI=${JSON.stringify(werkelijk)}, bron=${JSON.stringify(verwacht)}`
  );
  assert(bron&&bron.current&&bron.daily&&bron.hourly,`${label}: onvolledige Open-Meteo-bronrespons`);
  gelijk(ui.temperatuur,Math.round(Number(bron.current.temperature_2m)),`${label}: actuele temperatuur wijkt af van bron`);
  gelijk(ui.wind,Math.round(Number(bron.current.wind_speed_10m)),`${label}: actuele wind wijkt af van bron`);
  gelijk(ui.luchtdruk,Math.round(Number(bron.current.pressure_msl)),`${label}: zeeniveaudruk wijkt af van pressure_msl`);
  gelijk(ui.uv,uvPiekVandaag(bron),`${label}: UV-piek wijkt af van bron`);
  gelijk(ui.thema,Number(bron.current.is_day)===0?"donker":"licht",`${label}: dag/nachtthema wijkt af van current.is_day`);

  const verwacht=verwachtDagRijen(bron,nuOverride);
  assert.equal(verwacht.length,7,`${label}: bron levert geen zeven dagprognoses`);
  assert.equal(ui.rijen.length,7,`${label}: pagina toont geen zeven dagprognoses`);
  verwacht.forEach((dag,i)=>{
    const rij=ui.rijen[i],prefix=`${label}/${dag.datum}`;
    gelijk(rij.min,dag.min,`${prefix}: minimumtemperatuur wijkt af`);
    gelijk(rij.max,dag.max,`${prefix}: maximumtemperatuur wijkt af`);
    gelijk(rij.wind,dag.wind,`${prefix}: maximale windkracht wijkt af`);
    gelijk(rij.neerslagHoofd,dag.neerslag.hoofd,`${prefix}: neerslagkans wijkt af`);
    gelijk(rij.neerslagHoeveelheid,dag.neerslag.hoeveelheid,`${prefix}: neerslaghoeveelheid wijkt af`);
  });

  const zon=zonVerwachting(bron,nuOverride);
  if(zon.op.length||zon.onder.length){
    for(const tijd of zon.op)assert(ui.zon.includes(tijd),`${label}: verwachte komende zonsopkomst ${tijd} ontbreekt`);
    for(const tijd of zon.onder)assert(ui.zon.includes(tijd),`${label}: verwachte komende zonsondergang ${tijd} ontbreekt`);
  }else{
    assert(/zon|daglicht/i.test(ui.zon),`${label}: pooldag/-nacht heeft geen eerlijke zonstatus`);
  }
  return {dagen:verwacht.length,zonRijen:zon.rijen.length};
}

module.exports={BFT,getal,bft,zichtbaarGetal,dagNeerslag,uvPiekVandaag,zonDagIndex,hhmm,datumDagenVerschil,poolDaglichtStatus,zonVerwachting,verwachtDagRijen,verifieerBronwaarheid};

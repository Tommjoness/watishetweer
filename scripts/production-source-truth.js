"use strict";

const assert=require("assert");
const {kansHoofd,hoeveelheidTekst}=require("../neerslagkans-policy-v3.js");
const {analyseerDagData}=require("../interpretatie-engine.js");

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
function verwachtDagRijen(bron){
  const d=bron?.daily||{},a=[],vandaag=String(bron?.current?.time||"").slice(0,10);
  for(let i=0;i<Math.min(7,(d.time||[]).length);i++){
    const resterend=String(d.time[i]||"")===vandaag?analyseerDagData(bron,i,bron.current.time):null;
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
function verifieerBronwaarheid(bron,ui,label){
  const gelijk=(werkelijk,verwacht,omschrijving)=>assert.equal(
    werkelijk,
    verwacht,
    `${omschrijving}; UI=${JSON.stringify(werkelijk)}, bron=${JSON.stringify(verwacht)}`
  );
  assert(bron&&bron.current&&bron.daily&&bron.hourly,`${label}: onvolledige Open-Meteo-bronrespons`);
  gelijk(ui.temperatuur,Math.round(Number(bron.current.temperature_2m)),`${label}: actuele temperatuur wijkt af van bron`);
  gelijk(ui.wind,Math.round(Number(bron.current.wind_speed_10m)),`${label}: actuele wind wijkt af van bron`);
  gelijk(ui.uv,uvPiekVandaag(bron),`${label}: UV-piek wijkt af van bron`);
  gelijk(ui.thema,Number(bron.current.is_day)===0?"donker":"licht",`${label}: dag/nachtthema wijkt af van current.is_day`);

  const verwacht=verwachtDagRijen(bron);
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

  const zonIndex=zonDagIndex(bron),op=bron.daily.sunrise?.[zonIndex],onder=bron.daily.sunset?.[zonIndex];
  if(op&&onder){
    assert(ui.zon.includes(String(op).slice(11,16)),`${label}: zonsopkomst wijkt af van bron`);
    assert(ui.zon.includes(String(onder).slice(11,16)),`${label}: zonsondergang wijkt af van bron`);
  }else{
    assert(/zon|daglicht/i.test(ui.zon),`${label}: pooldag/-nacht heeft geen eerlijke zonstatus`);
  }
  return {dagen:verwacht.length,zonIndex};
}

module.exports={BFT,getal,bft,zichtbaarGetal,dagNeerslag,uvPiekVandaag,zonDagIndex,verwachtDagRijen,verifieerBronwaarheid};

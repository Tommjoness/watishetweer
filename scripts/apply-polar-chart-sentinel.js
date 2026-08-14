"use strict";

const fs=require("fs");
const path=require("path");

const DOEL=path.join(__dirname,"..","public","index.html");

const OUD=`  const overgangen=[];
  if(day&&Array.isArray(day.sunset)&&Array.isArray(day.sunrise)){
    for(let d=0;d<day.time.length;d++){
      const fo=fractIndex(day.sunset[d]);
      if(fo!=null) overgangen.push({idx:fo,tijd:day.sunset[d],op:false});
      const fr=fractIndex(day.sunrise[d]);
      if(fr!=null) overgangen.push({idx:fr,tijd:day.sunrise[d],op:true});
    }
  }
  overgangen.sort((a,b)=>a.idx-b.idx);`;

const NIEUW=`  /* Open-Meteo gebruikt in pooldag/poolnacht 00:00-paren als sentinel:
     dezelfde kalenderdag betekent geen daglicht, de volgende kalenderdag 24 uur
     daglicht. Dat zijn geen echte zonsovergangen en mogen dus ook niet als
     \"zon op 00:00\" / \"zon onder 00:00\" in de 24-uurgrafiek verschijnen.
     De aparte zoninformatielaag hanteert exact dezelfde semantiek. */
  const poolZonSentinel=(sr,ss)=>{
    if(!sr||!ss||hhmm(sr)!=="00:00"||hhmm(ss)!=="00:00") return false;
    const a=Date.parse(String(sr).slice(0,10)+"T00:00:00Z");
    const b=Date.parse(String(ss).slice(0,10)+"T00:00:00Z");
    if(!Number.isFinite(a)||!Number.isFinite(b)) return false;
    const dagen=Math.round((b-a)/86400000);
    return dagen===0||dagen===1;
  };
  const overgangen=[];
  if(day&&Array.isArray(day.sunset)&&Array.isArray(day.sunrise)){
    for(let d=0;d<day.time.length;d++){
      const sr=day.sunrise[d],ss=day.sunset[d];
      if(poolZonSentinel(sr,ss)) continue;
      const fo=fractIndex(ss);
      if(fo!=null) overgangen.push({idx:fo,tijd:ss,op:false});
      const fr=fractIndex(sr);
      if(fr!=null) overgangen.push({idx:fr,tijd:sr,op:true});
    }
  }
  overgangen.sort((a,b)=>a.idx-b.idx);`;

function pasPolarGrafiekSentinelsToe(html){
  const bron=String(html||"");
  if(bron.includes("const poolZonSentinel=(sr,ss)=>"))return bron;
  const aantal=bron.split(OUD).length-1;
  if(aantal!==1)throw new Error("Verwacht exact één onbeschermde zonovergangsblok, gevonden: "+aantal);
  return bron.replace(OUD,NIEUW);
}

function main(){
  if(!fs.existsSync(DOEL))throw new Error("public/index.html ontbreekt; voer eerst de basisbuild uit.");
  const voor=fs.readFileSync(DOEL,"utf8");
  const na=pasPolarGrafiekSentinelsToe(voor);
  fs.writeFileSync(DOEL,na);
  console.log("Poolzon-sentinels worden niet meer als grafiekovergang gerenderd.");
}

if(require.main===module)main();
module.exports={OUD,NIEUW,pasPolarGrafiekSentinelsToe};

"use strict";

/*
 * Berekent klimaatnormalen 1991–2020 per KNMI-station uit de openbare
 * KNMI-daggegevens (https://www.daggegevens.knmi.nl/klimatologie/daggegevens)
 * en schrijft ze naar scripts/data/knmi-klimaatnormalen-1991-2020.json.
 *
 * Dit script draait niet in de build of CI (het haalt data bij KNMI op); het
 * resultaat wordt gecommit. Opnieuw draaien: node scripts/genereer-knmi-klimaatnormalen.js
 *
 * Methode per station en per kalendermaand:
 * - een maand-jaar telt mee als minstens 90% van de dagen een geldige waarde heeft;
 * - een station komt alleen in de set als iedere maand voor iedere grootheid
 *   minstens 25 van de 30 jaren telt (WMO-richtlijn: ruim 80% volledig);
 * - TX/TN: gemiddelde dagmaximum/-minimum (°C), RH: maandsom neerslag (mm),
 *   regendagen: dagen met minstens 1 mm, SQ: maandsom zonneschijn (uur).
 *   KNMI codeert "minder dan 0,05" als -1; dat telt als 0.
 */

const fs=require("fs"),path=require("path");

const BRON="https://www.daggegevens.knmi.nl/klimatologie/daggegevens";
const UIT=path.join(__dirname,"data","knmi-klimaatnormalen-1991-2020.json");
const MIN_JAREN=25;

/* Leesbare stationsnamen voor bezoekers; de KNMI-code blijft de sleutel. */
const WEERGAVENAAM=Object.freeze({
  210:"Valkenburg (Zuid-Holland)",235:"De Kooy (Den Helder)",240:"Schiphol",251:"Hoorn (Terschelling)",
  260:"De Bilt",267:"Stavoren",269:"Lelystad",270:"Leeuwarden",273:"Marknesse",275:"Deelen",
  277:"Lauwersoog",278:"Heino",279:"Hoogeveen",280:"Eelde",283:"Hupsel",286:"Nieuw Beerta",
  290:"Twenthe",310:"Vlissingen",319:"Westdorpe",323:"Wilhelminadorp",330:"Hoek van Holland",
  344:"Rotterdam The Hague Airport",350:"Gilze-Rijen",356:"Herwijnen",370:"Eindhoven",375:"Volkel",
  380:"Maastricht Aachen Airport",391:"Arcen"
});

async function post(body){
  let laatste=null;
  for(let poging=1;poging<=4;poging++){
    try{
      const r=await fetch(BRON,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams(body)});
      if(r.ok)return r;
      laatste=new Error(`KNMI HTTP ${r.status}`);
    }catch(e){laatste=e;}
    await new Promise(res=>setTimeout(res,2000*poging));
  }
  throw laatste;
}

function stationsUitKop(tekst){
  const uit=[];
  for(const regel of tekst.split("\n")){
    const m=/^# (\d{3})\s+([\d.]+)\s+([\d.]+)\s+(-?[\d.]+)\s+(.+?)\s*$/.exec(regel);
    if(m)uit.push({code:Number(m[1]),lon:Number(m[2]),lat:Number(m[3]),knmiNaam:m[5].trim()});
  }
  return uit;
}

function dagenInMaand(jaar,maand){return new Date(Date.UTC(jaar,maand,0)).getUTCDate();}
const gem=a=>a.reduce((s,x)=>s+x,0)/a.length;

function normalen(rijen){
  const per=new Map();
  for(const r of rijen){
    const sleutel=r.date.slice(0,7);
    if(!per.has(sleutel))per.set(sleutel,[]);
    per.get(sleutel).push(r);
  }
  const maanden=[];
  for(let maand=1;maand<=12;maand++){
    const tx=[],tn=[],rh=[],rd=[],sq=[];
    for(let jaar=1991;jaar<=2020;jaar++){
      const rows=per.get(`${jaar}-${String(maand).padStart(2,"0")}`)||[],nd=dagenInMaand(jaar,maand);
      const waarden=k=>rows.map(r=>r[k]).filter(v=>v!==null&&v!==undefined);
      const X=waarden("TX"),N=waarden("TN"),R=waarden("RH"),Q=waarden("SQ");
      if(X.length>=0.9*nd)tx.push(gem(X)/10);
      if(N.length>=0.9*nd)tn.push(gem(N)/10);
      if(R.length>=0.9*nd){const RR=R.map(v=>Math.max(v,0));rh.push(gem(RR)*nd/10);rd.push(RR.filter(v=>v>=10).length/RR.length*nd);}
      if(Q.length>=0.9*nd){const QQ=Q.map(v=>Math.max(v,0));sq.push(gem(QQ)*nd/10);}
    }
    if(Math.min(tx.length,tn.length,rh.length,sq.length)<MIN_JAREN)return null;
    maanden.push({tx:Math.round(gem(tx)*10)/10,tn:Math.round(gem(tn)*10)/10,neerslag:Math.round(gem(rh)),regendagen:Math.round(gem(rd)),zon:Math.round(gem(sq))});
  }
  return maanden;
}

/* Eerste en laatste jaar met metingen van alle grootheden: een station dat
   bijvoorbeeld in 2016 stopte, wordt eerlijk als 1991–2016 getoond. */
function meetjaren(rijen){
  const jaren=rijen.filter(r=>["TX","TN","RH","SQ"].every(k=>r[k]!==null&&r[k]!==undefined)).map(r=>Number(r.date.slice(0,4)));
  return {van:Math.min(...jaren),tot:Math.max(...jaren)};
}

async function main(){
  const kop=await (await post({start:"20200101",end:"20200101",vars:"TG",stns:"ALL"})).text();
  const stations=stationsUitKop(kop);
  const uit=[];
  for(const st of stations){
    const rijen=await (await post({start:"19910101",end:"20201231",vars:"TN:TX:RH:SQ",stns:String(st.code),fmt:"json"})).json();
    const maanden=normalen(rijen);
    if(!maanden)continue;
    if(!WEERGAVENAAM[st.code])throw new Error(`Station ${st.code} (${st.knmiNaam}) heeft een volledige reeks maar nog geen weergavenaam.`);
    uit.push({code:st.code,naam:WEERGAVENAAM[st.code],knmiNaam:st.knmiNaam,lat:st.lat,lon:st.lon,jaren:meetjaren(rijen),maanden});
  }
  const data={bron:"KNMI daggegevens (www.daggegevens.knmi.nl), berekend door watishetweer.nl",periode:"1991-2020",minJaren:MIN_JAREN,stations:uit};
  fs.mkdirSync(path.dirname(UIT),{recursive:true});
  fs.writeFileSync(UIT,JSON.stringify(data,null,1)+"\n","utf8");
  console.log(`Klimaatnormalen 1991–2020 voor ${uit.length} KNMI-stations geschreven naar ${path.relative(process.cwd(),UIT)}.`);
}

if(require.main===module)main().catch(e=>{console.error(e);process.exit(1);});
module.exports={normalen,meetjaren,stationsUitKop,WEERGAVENAAM,MIN_JAREN};

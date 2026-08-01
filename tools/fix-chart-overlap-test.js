const fs=require("fs");
const path="run.js";
let s=fs.readFileSync(path,"utf8");
const oud=`  const labels=[...bak.chart.innerHTML.matchAll(/<text x="([\\d.]+)" y="([\\d.]+)" text-anchor="middle" fill="[^"]+"[^>]*font-family="Bodoni Moda,serif" font-size="[\\d.]+">(-?\\d+)°<\\/text>/g)]
    .map(m=>({x:+m[1],y:+m[2],v:+m[3]})).sort((a,b)=>a.x-b.x);
  const limiet=bereik<=24?5:bereik<=48?4:3;
  check(bereik+" uur mobiel: niet meer dan "+limiet+" temperatuurcijfers",
    labels.length<=limiet,labels.length+" labels: "+labels.map(x=>x.v).join(","));
  let teDicht=0;
  for(let i=1;i<labels.length;i++) if(labels[i].x-labels[i-1].x<42) teDicht++;
  check(bereik+" uur mobiel: temperatuurcijfers staan niet opeengepakt",
    teDicht===0,teDicht+" te kleine afstanden");`;
const nieuw=`  const labels=[...bak.chart.innerHTML.matchAll(/<text x="([\\d.]+)" y="([\\d.]+)" text-anchor="middle" fill="[^"]+"[^>]*font-family="Bodoni Moda,serif" font-size="([\\d.]+)">(-?\\d+)°<\\/text>/g)]
    .map(m=>({x:+m[1],y:+m[2],fs:+m[3],v:+m[4]})).sort((a,b)=>a.x-b.x);
  const limiet=bereik<=24?5:bereik<=48?4:3;
  check(bereik+" uur mobiel: niet meer dan "+limiet+" temperatuurcijfers",
    labels.length<=limiet,labels.length+" labels: "+labels.map(x=>x.v).join(","));
  const botsingen=[];
  for(let i=0;i<labels.length;i++) for(let j=i+1;j<labels.length;j++){
    const a=labels[i],b=labels[j];
    const breedA=(String(a.v).length+1)*a.fs*0.58+a.fs*0.40;
    const breedB=(String(b.v).length+1)*b.fs*0.58+b.fs*0.40;
    if(Math.abs(a.x-b.x)<(breedA+breedB)/2+4 && Math.abs(a.y-b.y)<Math.max(a.fs,b.fs)+4){
      botsingen.push(a.v+"°/"+b.v+"°");
    }
  }
  check(bereik+" uur mobiel: temperatuurcijfers overlappen niet",
    botsingen.length===0,botsingen.join(", "));`;
if(!s.includes(oud)) throw new Error("Naïeve grafiekafstandstest niet exact gevonden.");
s=s.replace(oud,nieuw);
fs.writeFileSync(path,s,"utf8");
console.log("Grafiekoverlaptest gebruikt nu echte tekstvakken.");

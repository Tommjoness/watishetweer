"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const PLAATSINGSANKER="    const eersteBoven = soort[i]!==-1;";
const FALLBACKANKER="    if(!eersteBoven) opties.reverse();";
const RENDERANKER=`    gezet.push({i:i,v:v,cx:cx,cy:cy,bw:bw,rang:k.rang});
  });
  // dots/labs pas hier opbouwen, uit de uiteindelijke, overlevende gezet-lijst:`;
const POSTPASS_MARKER="/* ===== LOCAL MINIMUM LABEL ABOVE-PASS 20260911 ===== */";
const RENDER_NIEUW=`    gezet.push({i:i,v:v,cx:cx,cy:cy,bw:bw,rang:k.rang});
  });
  ${POSTPASS_MARKER}
  /* Houd de bestaande kandidaatselectie en prioriteiten intact. Alleen lokale
     minima die door de historische voorkeur onder hun lijnpunt staan, mogen na
     de definitieve selectie naar een vrije laag erboven verhuizen. Als daar
     geen botsingsvrije plek bestaat, blijft het label veilig onder de lijn. */
  gezet.forEach(g=>{
    if(soort[g.i]!==-1 || g.cy<y(g.v))return;
    const stapHoogte=labelHoogte+4;
    for(let laag=0;laag<MAXLAAG;laag++){
      const kandidaat=y(g.v)-((M?13:14)+laag*stapHoogte);
      if(kandidaat-F.temp<by+bh+6)continue;
      const botst=gezet.some(andere=>andere!==g
        && Math.abs(andere.cx-g.cx)<(andere.bw+g.bw)/2+5
        && Math.abs(andere.cy-kandidaat)<labelHoogte+3);
      if(botst)continue;
      g.cy=kandidaat;
      break;
    }
  });

  /* Een verplaatsing mag nooit ten koste gaan van het vaste drie-uursraster.
     De bestaande placer kan in een uitzonderlijk druk etmaal een rang-1
     rasterpunt laten vallen nadat omliggende extrema eerst zijn geplaatst.
     Herstel daarom uitsluitend ontbrekende rasterkandidaten uit kandKaart en
     alleen wanneer de bestaande collisionplacer er nog een veilige positie voor
     vindt. Geen test- of overlapcontract wordt afgezwakt: zonder veilige plek
     blijft de bestaande browserstresscheck gewoon rood. */
  if(T.length<=25){
    for(let i=0;i<T.length;i++){
      if(!geldig(i)||i%stap!==0||!kandKaart.has(i)||gezet.some(g=>g.i===i))continue;
      const v=T[i],bw=labelBreed(v);
      let cx=x(i);
      if(cx-bw/2<pl-2)cx=pl-2+bw/2;
      if(cx+bw/2>W-pr)cx=W-pr-bw/2;
      let poging=probeerLagen(cx,v,true,null);
      if(!poging){
        const schuif=bw/2+6;
        for(const rcx of [cx+schuif,cx-schuif,cx+2*schuif,cx-2*schuif]){
          if(rcx-bw/2<pl-2||rcx+bw/2>W-pr)continue;
          poging=probeerLagen(rcx,v,true,null);
          if(poging){cx=rcx;break;}
        }
      }
      if(!poging)continue;
      gezet.push({i:i,v:v,cx:cx,cy:poging.cy,bw:bw,rang:kandKaart.get(i)||1});
    }
  }
  // dots/labs pas hier opbouwen, uit de uiteindelijke, overlevende gezet-lijst:`;

function htmlBestanden(dir){
  const uit=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory())uit.push(...htmlBestanden(p));
    else if(ent.isFile()&&ent.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function pasHtmlToe(html,label="artifact"){
  const bron=String(html||"");
  const relevant=bron.includes(PLAATSINGSANKER)||bron.includes(POSTPASS_MARKER);
  if(!relevant)return {html:bron,relevant:false,geraakt:false,reeds:false};
  if(!bron.includes(FALLBACKANKER))throw new Error(`${label}: bestaande boven/onder-fallback ontbreekt.`);
  const oudAantal=bron.split(RENDERANKER).length-1;
  const nieuwAantal=bron.split(POSTPASS_MARKER).length-1;
  if(oudAantal===1&&nieuwAantal===0)return {html:bron.replace(RENDERANKER,RENDER_NIEUW),relevant:true,geraakt:true,reeds:false};
  if(oudAantal===0&&nieuwAantal===1)return {html:bron,relevant:true,geraakt:false,reeds:true};
  throw new Error(`${label}: onverwacht minimumlabel-contract (oud=${oudAantal}, nieuw=${nieuwAantal}).`);
}

function main(){
  let relevant=0,geraakt=0,reeds=0;
  for(const p of htmlBestanden(OUT)){
    const oud=fs.readFileSync(p,"utf8");
    const uit=pasHtmlToe(oud,path.relative(OUT,p));
    if(!uit.relevant)continue;
    relevant++;
    if(uit.reeds)reeds++;
    if(!uit.geraakt)continue;
    fs.writeFileSync(p,uit.html,"utf8");
    geraakt++;
  }
  if(!relevant)throw new Error("Geen weergrafiek-artifact gevonden voor temperatuur-labelconsistentie.");
  if(geraakt){
    const cache=vernieuwServiceworkerCache(OUT,"chart-label-consistency-20260911");
    console.log(`Lokale minimumlabels krijgen waar veilig een vrije laag boven de lijn op ${geraakt}/${relevant} weergrafiek-artifacts; het vaste 24-uursraster wordt na de verplaatsing collisionvrij hersteld. Cache ${cache}.`);
  }else{
    console.log(`Minimumlabel-pass stond al correct op ${reeds}/${relevant} weergrafiek-artifacts.`);
  }
}

if(require.main===module)main();
module.exports={OUT,PLAATSINGSANKER,FALLBACKANKER,RENDERANKER,POSTPASS_MARKER,RENDER_NIEUW,htmlBestanden,pasHtmlToe,main};

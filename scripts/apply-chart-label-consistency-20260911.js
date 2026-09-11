"use strict";

const fs=require("fs");
const path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const PLAATSINGSANKER="    const eersteBoven = soort[i]!==-1;";
const FALLBACKANKER="    if(!eersteBoven) opties.reverse();";
const SORT_OUD=`  const kandidatenRuw=[...kandKaart.entries()].map(([i,rang])=>({i,rang}))
    .sort((a,b)=>b.rang-a.rang||a.i-b.i);`;
const SORT_NIEUW=`  const kandidatenRuw=[...kandKaart.entries()].map(([i,rang])=>({i,rang}))
    .sort((a,b)=>{
      /* Op desktop is het drie-uursraster het vaste leesritme. Plaats die
         kandidaten vóór extra extrema; mobiel en langere bereiken houden hun
         bestaande prioriteitsvolgorde. */
      if(!M&&n<=24){
        const ar=a.i%stap===0?0:1,br=b.i%stap===0?0:1;
        if(ar!==br)return ar-br;
      }
      return b.rang-a.rang||a.i-b.i;
    });`;
const RENDERANKER=`    gezet.push({i:i,v:v,cx:cx,cy:cy,bw:bw,rang:k.rang});
  });
  // dots/labs pas hier opbouwen, uit de uiteindelijke, overlevende gezet-lijst:`;
const POSTPASS_MARKER="/* ===== LOCAL MINIMUM LABEL ABOVE-PASS 20260911 ===== */";
const RENDER_NIEUW=`    /* Het vaste desktop-drie-uursraster is een presentatiecontract, geen
       wegwerpbare achtergrondlaag. Bescherm uitsluitend die reeds geselecteerde
       rasterpunten tegen latere evictie door extra extrema; de kandidaatselectie,
       collisionplacer en mobiele dichtheid blijven verder ongewijzigd. */
    const plaatsRang=!M&&n<=24&&i%stap===0?Math.max(4,k.rang):k.rang;
    gezet.push({i:i,v:v,cx:cx,cy:cy,bw:bw,rang:plaatsRang});
  });
  ${POSTPASS_MARKER}
  /* Alleen lokale minima die door de historische voorkeur onder hun lijnpunt
     staan, mogen na de definitieve selectie naar een vrije laag erboven. Als
     daar geen botsingsvrije plek bestaat, blijft het label veilig onder de lijn. */
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

  /* De stressfixture liet nog één reëel desktoprandgeval zien: een rasterpunt
     kan al vóór de extra extrema geen vrije laag vinden, waarna twee nabije
     lokale extrema (rang 2) de ruimte bezetten. Herstel daarom alleen op
     desktop en alleen ontbrekende 24-uursrasterpunten die nog in kandKaart
     staan. Eerst proberen we zonder iets te verwijderen. Alleen als dat niet
     lukt mag een rasterpunt een botsend lokaal extra-label met rang < 3 laten
     wijken. Globale extrema (rang 3), andere rasterpunten (rang 4) en mobiel
     blijven onaangeraakt. */
  if(!M&&n<=24){
    for(let i=stap;i<T.length;i+=stap){
      if(!geldig(i)||!kandKaart.has(i)||gezet.some(g=>g.i===i))continue;
      const v=T[i],bw=labelBreed(v);
      let cx=x(i);
      if(cx-bw/2<pl-2)cx=pl-2+bw/2;
      if(cx+bw/2>W-pr)cx=W-pr-bw/2;

      const probeerRaster=(minRang)=>{
        let p=probeerLagen(cx,v,true,minRang),px=cx;
        if(p)return {poging:p,cx:px};
        const schuif=bw/2+6;
        for(const rcx of [cx+schuif,cx-schuif,cx+2*schuif,cx-2*schuif]){
          if(rcx-bw/2<pl-2||rcx+bw/2>W-pr)continue;
          p=probeerLagen(rcx,v,true,minRang);
          if(p)return {poging:p,cx:rcx};
        }
        return null;
      };

      let herstel=probeerRaster(null);
      if(!herstel)herstel=probeerRaster(3);
      if(!herstel)continue;

      for(const blokkeerder of herstel.poging.verwijderd||[]){
        const pos=gezet.indexOf(blokkeerder);
        if(pos>=0)gezet.splice(pos,1);
      }
      gezet.push({
        i:i,v:v,cx:herstel.cx,cy:herstel.poging.cy,bw:bw,
        rang:Math.max(4,kandKaart.get(i)||1)
      });
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
  let bron=String(html||"");
  const relevant=bron.includes(PLAATSINGSANKER)||bron.includes(POSTPASS_MARKER);
  if(!relevant)return {html:bron,relevant:false,geraakt:false,reeds:false};
  if(!bron.includes(FALLBACKANKER))throw new Error(`${label}: bestaande boven/onder-fallback ontbreekt.`);

  const sortOud=bron.split(SORT_OUD).length-1,sortNieuw=bron.split(SORT_NIEUW).length-1;
  const renderOud=bron.split(RENDERANKER).length-1,postpass=bron.split(POSTPASS_MARKER).length-1;
  if(sortOud===1&&sortNieuw===0&&renderOud===1&&postpass===0){
    bron=bron.replace(SORT_OUD,SORT_NIEUW).replace(RENDERANKER,RENDER_NIEUW);
    return {html:bron,relevant:true,geraakt:true,reeds:false};
  }
  if(sortOud===0&&sortNieuw===1&&renderOud===0&&postpass===1)return {html:bron,relevant:true,geraakt:false,reeds:true};
  throw new Error(`${label}: onverwacht temperatuur-labelcontract (sort oud=${sortOud}, sort nieuw=${sortNieuw}, render oud=${renderOud}, postpass=${postpass}).`);
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
    console.log(`Temperatuurlabels aangepast op ${geraakt}/${relevant} weergrafiek-artifacts: lokale minima gaan waar veilig boven de lijn; desktop 24 uur beschermt en herstelt het vaste drie-uursraster zonder mobiele dichtheidswijziging. Cache ${cache}.`);
  }else{
    console.log(`Temperatuur-labelpass stond al correct op ${reeds}/${relevant} weergrafiek-artifacts.`);
  }
}

if(require.main===module)main();
module.exports={OUT,PLAATSINGSANKER,FALLBACKANKER,SORT_OUD,SORT_NIEUW,RENDERANKER,POSTPASS_MARKER,RENDER_NIEUW,htmlBestanden,pasHtmlToe,main};

"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const ROOT=path.join(__dirname,"..");
const OUT=path.join(ROOT,"public");
const htmlPad=path.join(OUT,"index.html");

const BRON=`    let vol=null;
    try{vol=await j(f,{timeoutMs:10000,signal:weerController.signal});}
    catch(e){
      if(mijnBeurt!==laadTeller) return;
      vol=await j(fmin,{timeoutMs:10000,signal:weerController.signal});
    }`;

const PRODUCTIE=`    let vol=null;
    const WEER_HEDGE_MS=5000;
    const WEER_FALLBACK_TIMEOUT_MS=7000;
    let hedgeTimer=null,fallbackBelofte=null;
    const startFallback=()=>{
      if(!fallbackBelofte)fallbackBelofte=j(fmin,{timeoutMs:WEER_FALLBACK_TIMEOUT_MS,signal:weerController.signal});
      return fallbackBelofte;
    };
    const volledigeBelofte=j(f,{timeoutMs:10000,signal:weerController.signal});
    try{
      const eerste=await new Promise(resolve=>{
        hedgeTimer=setTimeout(()=>resolve({soort:\"traag\"}),WEER_HEDGE_MS);
        volledigeBelofte.then(
          value=>resolve({soort:\"volledig\",ok:true,value}),
          error=>resolve({soort:\"volledig\",ok:false,error})
        );
      });
      if(hedgeTimer!==null){clearTimeout(hedgeTimer);hedgeTimer=null;}
      if(eerste.soort===\"volledig\"){
        if(eerste.ok)vol=eerste.value;
        else{
          if(mijnBeurt!==laadTeller) return;
          vol=await startFallback();
        }
      }else{
        if(mijnBeurt!==laadTeller) return;
        const fallback=startFallback();
        vol=await new Promise((resolve,reject)=>{
          let fouten=0,laatsteFout=null,klaar=false;
          const geslaagd=value=>{if(klaar)return;klaar=true;resolve(value);};
          const mislukt=error=>{
            laatsteFout=error;fouten++;
            if(!klaar&&fouten===2){klaar=true;reject(laatsteFout);}
          };
          volledigeBelofte.then(geslaagd,mislukt);
          fallback.then(geslaagd,mislukt);
        });
      }
    }finally{
      if(hedgeTimer!==null)clearTimeout(hedgeTimer);
    }`;

function pasToe(html){
  const bronAantal=html.split(BRON).length-1;
  const productieAantal=html.split(PRODUCTIE).length-1;
  if(bronAantal!==1)throw new Error("Sequentieel weerfallbackblok ontbreekt of is dubbel: "+bronAantal);
  if(productieAantal!==0)throw new Error("Hedged weerfallback staat al in artifact: "+productieAantal);
  return html.replace(BRON,PRODUCTIE);
}

if(require.main===module){
  let html=fs.readFileSync(htmlPad,"utf8");
  html=pasToe(html);
  const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  if(!scripts.length)throw new Error("Geen inline runtime na weerfallbackcorrectie.");
  scripts.forEach((code,i)=>new vm.Script(code,{filename:"public/index.html:weather-fallback-"+(i+1)}));
  fs.writeFileSync(htmlPad,html,"utf8");
  const versie=vernieuwServiceworkerCache(OUT,"weather-fallback-hedge");
  console.log("Trage volledige forecast krijgt na 5 s een lichte hedged fallback met 7 s hard cap; normale snelle loads blijven enkelvoudig; cache "+versie+".");
}

module.exports={BRON,PRODUCTIE,pasToe};

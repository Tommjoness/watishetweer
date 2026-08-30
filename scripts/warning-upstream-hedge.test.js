"use strict";
const assert=require("assert");

function nepRes(){return{statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[String(k).toLowerCase()]=v;},status(c){this.statusCode=c;return this;},json(b){this.body=b;return this;}};}
async function roep(query,fetchImpl){
  const oud=global.fetch,p=require.resolve("../lib/waarschuwingen.cjs");
  delete require.cache[p];global.fetch=fetchImpl;
  try{const h=require(p),r=nepRes();await h({query},r);return r;}
  finally{global.fetch=oud;delete require.cache[p];}
}
const headers=len=>({get:n=>String(n).toLowerCase()==="content-length"?String(len):null});
const legeAtom='<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>';

(async()=>{
  const snelUrls=[];
  const snel=await roep({lat:"52.35",lon:"5.26",land:"NL"},async url=>{
    snelUrls.push(String(url));
    return{ok:true,headers:headers(1046008),text:async()=>JSON.stringify({warnings:[]})};
  });
  assert.equal(snelUrls.length,1,"kleine compatibiliteitsfeed mag geen onnodige Atom-request starten");
  assert.equal(snel.body.dekking,true);
  assert.equal(snel.body.plaatsSpecifiek,true);

  let atomGestart=false;const grootUrls=[];
  const groot=await roep({lat:"52.52",lon:"13.405",land:"DE"},async url=>{
    const u=String(url);grootUrls.push(u);
    if(u.includes("api/v1/warnings/feeds-"))return{
      ok:true,headers:headers(10504726),text:async()=>{
        assert.equal(atomGestart,true,"grote compatibiliteitsfeed moet Atom al hedgen vóór de body is verwerkt");
        return JSON.stringify({warnings:[{event:"Storm",severity:"Moderate",area:[{polygon:"52.0,13.0 52.0,14.0 53.0,14.0 53.0,13.0"}]}]});
      }
    };
    atomGestart=true;
    return{ok:true,headers:headers(100),text:async()=>legeAtom};
  });
  assert.equal(grootUrls.length,2,"grote compatibiliteitsfeed start precies één hedged Atom-request");
  assert.equal(groot.body.plaatsSpecifiek,true,"geldige compatibiliteitsdata blijft ondanks hedge leidend");
  assert.equal(groot.body.lijst.length,1);
  assert.equal(groot.body.lijst[0].titel,"Storm");

  let atomVoorFallback=false;const fallbackUrls=[];
  const fallback=await roep({lat:"52.52",lon:"13.405",land:"DE"},async url=>{
    const u=String(url);fallbackUrls.push(u);
    if(u.includes("api/v1/warnings/feeds-"))return{
      ok:true,headers:headers(10504726),text:async()=>{
        assert.equal(atomVoorFallback,true,"Atom moet al lopen voordat een grote onbruikbare compatibiliteitsbody terugvalt");
        return "geen json";
      }
    };
    atomVoorFallback=true;
    return{ok:true,headers:headers(100),text:async()=>legeAtom};
  });
  assert.equal(fallbackUrls.length,2);
  assert.equal(fallback.body.dekking,true,"lege officiële Atom-feed mag nog steeds nul actieve waarschuwingen bewijzen");
  assert.equal(fallback.body.plaatsSpecifiek,false);
  assert.deepEqual(fallback.body.lijst,[]);

  const bron=require("fs").readFileSync(require("path").join(__dirname,"..","lib","waarschuwingen.cjs"),"utf8");
  assert.ok(bron.includes("METEO_HEDGE_HEADER_MS = 1500"));
  assert.ok(bron.includes("if (!compatHeadersOntvangen) void startAtom()"),"trage responseheaders starten dezelfde lazy fallback vroeg");
  console.log("Warning upstream hedge: normale feed enkelvoudig; grote/trage feed hedged; geldige compatibiliteitsdata blijft leidend.");
})().catch(err=>{console.error(err&&err.stack||err);process.exitCode=1;});

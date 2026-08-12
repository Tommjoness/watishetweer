"use strict";

const assert=require("assert");
const pad=require.resolve("../lib/plaatsnaam.cjs");

function laad(){
  delete require.cache[pad];
  return require(pad);
}

async function metEnv(waarde,fn){
  const had=Object.prototype.hasOwnProperty.call(process.env,"NOMINATIM_BASE_URL");
  const oud=process.env.NOMINATIM_BASE_URL;
  if(waarde===null) delete process.env.NOMINATIM_BASE_URL;
  else process.env.NOMINATIM_BASE_URL=waarde;
  try{return await fn();}
  finally{if(had)process.env.NOMINATIM_BASE_URL=oud;else delete process.env.NOMINATIM_BASE_URL;}
}

function nepResponse(){
  return {
    headers:{},statusCode:200,body:null,
    setHeader(k,v){this.headers[k]=String(v);},
    status(code){this.statusCode=Number(code);return this;},
    json(v){this.body=v;return this;}
  };
}

(async()=>{
  await metEnv(null,async()=>{
    const {_intern}=laad();
    assert.equal(_intern.nominatimBasisUrl(),"https://nominatim.openstreetmap.org");
    const u=new URL(_intern.reverseUrl("52.3676","4.9041"));
    assert.equal(u.origin,"https://nominatim.openstreetmap.org");
    assert.equal(u.pathname,"/reverse");
    assert.equal(u.searchParams.get("format"),"jsonv2");
    assert.equal(u.searchParams.get("lat"),"52.3676");
    assert.equal(u.searchParams.get("lon"),"4.9041");
    assert.equal(u.searchParams.get("zoom"),"12");
    assert.equal(u.searchParams.get("accept-language"),"nl");
  });

  await metEnv("https://geo.example.test/nominatim/",async()=>{
    const handler=laad(),{_intern}=handler;
    assert.equal(_intern.nominatimBasisUrl(),"https://geo.example.test/nominatim");
    const u=new URL(_intern.reverseUrl("-33.8688","151.2093"));
    assert.equal(u.origin,"https://geo.example.test");
    assert.equal(u.pathname,"/nominatim/reverse");
    assert.equal(u.searchParams.get("lat"),"-33.8688");
    assert.equal(u.searchParams.get("lon"),"151.2093");

    const vorigeFetch=global.fetch;
    let aanvraag=null;
    try{
      global.fetch=async(url,opt)=>{
        aanvraag={url:String(url),opt};
        return {ok:true,status:200,json:async()=>({address:{city:"Teststad",country_code:"nl"}})};
      };
      const res=nepResponse();
      await handler({query:{lat:"52.3676",lon:"4.9041"}},res);
      assert.equal(res.statusCode,200);
      assert.deepEqual(res.body,{naam:"Teststad",land:"NL",bron:"viaNominatim"});
      assert.equal(new URL(aanvraag.url).origin,"https://geo.example.test");
      assert.equal(new URL(aanvraag.url).pathname,"/nominatim/reverse");
      assert.match(aanvraag.opt.headers["User-Agent"],/WatIsHetWeer\/1\.0/);
      assert.equal(res.headers["Cache-Control"],"s-maxage=86400, stale-while-revalidate=604800");
    }finally{global.fetch=vorigeFetch;}
  });

  for(const fout of [
    "http://geo.example.test",
    "not a url",
    "https://user:pass@geo.example.test",
    "https://geo.example.test?token=x",
    "https://geo.example.test#x"
  ]){
    await metEnv(fout,async()=>{
      const {_intern}=laad();
      assert.throws(()=>_intern.nominatimBasisUrl(),/NOMINATIM_BASE_URL/);
    });
  }

  await metEnv("http://localhost:8080/nominatim",async()=>{
    const {_intern}=laad();
    assert.equal(_intern.nominatimBasisUrl(),"http://localhost:8080/nominatim");
  });

  await metEnv("not a url",async()=>{
    const handler=laad();
    const vorigeFetch=global.fetch;
    let fetchAangeroepen=false;
    try{
      global.fetch=async()=>{fetchAangeroepen=true;throw new Error("mag niet worden aangeroepen");};
      const res=nepResponse();
      await handler({query:{lat:"52.3676",lon:"4.9041"}},res);
      assert.equal(fetchAangeroepen,false);
      assert.equal(res.statusCode,200);
      assert.equal(res.body.naam,null);
      assert.equal(res.body.land,null);
      assert.match(res.body.reden,/NOMINATIM_BASE_URL is geen geldige URL/);
    }finally{global.fetch=vorigeFetch;}
  });

  console.log("Plaatsnaamprovider: standaardprovider, configureerbare fallback, runtimepad en fail-closed validatie geslaagd.");
})().catch(e=>{console.error(e);process.exit(1);});

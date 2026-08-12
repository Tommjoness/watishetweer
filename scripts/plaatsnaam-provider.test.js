"use strict";

const assert=require("assert");
const plaatsPad=require.resolve("../lib/plaatsnaam.cjs");
const waarschuwingPad=require.resolve("../lib/waarschuwingen.cjs");

function laadPlaats(){
  delete require.cache[plaatsPad];
  return require(plaatsPad);
}
function laadWaarschuwingen(){
  delete require.cache[waarschuwingPad];
  return require(waarschuwingPad);
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
    const {_intern}=laadPlaats();
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
    const handler=laadPlaats(),{_intern}=handler;
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

  /* De waarschuwingroute heeft dezelfde providerconfig nodig wanneer de browser
     geen landcode meegeeft. Zo kan één toekomstige providerwissel niet alleen
     plaatsnamen maar ook de server-side landbepaling half omzetten. */
  await metEnv("https://geo.example.test/nominatim/",async()=>{
    const handler=laadWaarschuwingen();
    const vorigeFetch=global.fetch;
    const aanvragen=[];
    try{
      global.fetch=async(url,opt)=>{
        const s=String(url);aanvragen.push({url:s,opt});
        if(s.startsWith("https://geo.example.test/nominatim/reverse?")){
          return {ok:true,status:200,json:async()=>({address:{country_code:"fr"}})};
        }
        return {ok:false,status:503,json:async()=>({}),text:async()=>""};
      };
      const res=nepResponse();
      await handler({query:{lat:"48.8566",lon:"2.3522"}},res);
      const reverse=new URL(aanvragen[0].url);
      assert.equal(reverse.origin,"https://geo.example.test");
      assert.equal(reverse.pathname,"/nominatim/reverse");
      assert.equal(reverse.searchParams.get("zoom"),"3");
      assert.equal(reverse.searchParams.get("accept-language"),"en");
      assert.match(aanvragen[0].opt.headers["User-Agent"],/WatIsHetWeer\/1\.0/);
      assert.equal(res.statusCode,200);
      assert.equal(res.body.land,"FR");
      assert.equal(res.body.bron,"MeteoAlarm france");
      assert.equal(res.body.dekking,false);
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
      const {_intern}=laadPlaats();
      assert.throws(()=>_intern.nominatimBasisUrl(),/NOMINATIM_BASE_URL/);
    });
  }

  await metEnv("http://localhost:8080/nominatim",async()=>{
    const {_intern}=laadPlaats();
    assert.equal(_intern.nominatimBasisUrl(),"http://localhost:8080/nominatim");
  });

  await metEnv("not a url",async()=>{
    const handler=laadPlaats();
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

  console.log("Nominatim-provider: gedeelde standaard/custom provider, plaatsnaam- en waarschuwingsruntime en fail-closed validatie geslaagd.");
})().catch(e=>{console.error(e);process.exit(1);});

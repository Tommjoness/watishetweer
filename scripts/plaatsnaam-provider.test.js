"use strict";

const assert=require("assert");
const pad=require.resolve("../lib/plaatsnaam.cjs");

function laad(){
  delete require.cache[pad];
  return require(pad);
}

function metEnv(waarde,fn){
  const had=Object.prototype.hasOwnProperty.call(process.env,"NOMINATIM_BASE_URL");
  const oud=process.env.NOMINATIM_BASE_URL;
  if(waarde===null) delete process.env.NOMINATIM_BASE_URL;
  else process.env.NOMINATIM_BASE_URL=waarde;
  try{return fn();}
  finally{if(had)process.env.NOMINATIM_BASE_URL=oud;else delete process.env.NOMINATIM_BASE_URL;}
}

metEnv(null,()=>{
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

metEnv("https://geo.example.test/nominatim/",()=>{
  const {_intern}=laad();
  assert.equal(_intern.nominatimBasisUrl(),"https://geo.example.test/nominatim");
  const u=new URL(_intern.reverseUrl("-33.8688","151.2093"));
  assert.equal(u.origin,"https://geo.example.test");
  assert.equal(u.pathname,"/nominatim/reverse");
  assert.equal(u.searchParams.get("lat"),"-33.8688");
  assert.equal(u.searchParams.get("lon"),"151.2093");
});

for(const fout of [
  "http://geo.example.test",
  "not a url",
  "https://user:pass@geo.example.test",
  "https://geo.example.test?token=x",
  "https://geo.example.test#x"
]){
  metEnv(fout,()=>{
    const {_intern}=laad();
    assert.throws(()=>_intern.nominatimBasisUrl(),/NOMINATIM_BASE_URL/);
  });
}

metEnv("http://localhost:8080/nominatim",()=>{
  const {_intern}=laad();
  assert.equal(_intern.nominatimBasisUrl(),"http://localhost:8080/nominatim");
});

console.log("Plaatsnaamprovider: standaardprovider, configureerbare fallback en fail-closed URL-validatie geslaagd.");

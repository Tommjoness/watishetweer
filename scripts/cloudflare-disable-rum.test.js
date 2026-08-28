"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  RULE_REF,
  PHASE,
  EXPRESSION,
  gewensteRegel,
  regelKlopt,
  schakelRumUit
}=require("./cloudflare-disable-rum.js");

const account="0123456789abcdef0123456789abcdef";
const zone="abcdef0123456789abcdef0123456789";
const rulesetId="11111111111111111111111111111111";
const ruleId="22222222222222222222222222222222";

function antwoord(status,result,errors=[]){
  return {ok:status>=200&&status<300,status,async text(){return JSON.stringify({success:status>=200&&status<300,result,errors});}};
}
function domains(){return [
  {name:"watishetweer.nl",zone_tag:zone},
  {name:"www.watishetweer.nl",zone_tag:zone}
];}
function juisteRegel(){return {id:ruleId,...gewensteRegel()};}

(async()=>{
  const gewenst=gewensteRegel();
  assert.equal(gewenst.action,"set_config");
  assert.deepStrictEqual(gewenst.action_parameters,{disable_rum:true});
  assert.equal(gewenst.ref,RULE_REF);
  assert.equal(gewenst.expression,EXPRESSION);
  assert.equal(regelKlopt(juisteRegel()),true);
  assert.equal(regelKlopt({...juisteRegel(),action_parameters:{disable_rum:false}}),false);

  const calls=[];
  const toegevoegd=await schakelRumUit({accountId:account,token:"token",fetchImpl:async(url,options)=>{
    calls.push({url,method:options.method,body:options.body&&JSON.parse(options.body)});
    if(url.includes("/pages/projects/watishetweer/domains"))return antwoord(200,domains());
    if(url.endsWith(`/zones/${zone}/rulesets`)&&options.method==="GET")return antwoord(200,[{id:rulesetId,kind:"zone",phase:PHASE}]);
    if(url.endsWith(`/rulesets/${rulesetId}`)&&options.method==="GET"){
      const alGeschreven=calls.some(x=>x.method==="POST"&&x.url.endsWith(`/rulesets/${rulesetId}/rules`));
      return antwoord(200,{id:rulesetId,rules:alGeschreven?[juisteRegel()]:[]});
    }
    if(url.endsWith(`/rulesets/${rulesetId}/rules`)&&options.method==="POST")return antwoord(200,{id:rulesetId,rules:[juisteRegel()]});
    throw new Error(`Onverwachte testcall: ${options.method} ${url}`);
  }});
  assert.equal(toegevoegd.gewijzigd,true,"ontbrekende RUM-regel moet worden toegevoegd");
  const post=calls.find(x=>x.method==="POST"&&x.url.endsWith(`/rulesets/${rulesetId}/rules`));
  assert(post,"regel moet via de single-rule endpoint worden toegevoegd");
  assert.deepStrictEqual(post.body,gewenst,"geschreven configuratieregel moet exact het RUM-contract volgen");
  assert(!calls.some(x=>x.method==="PUT"),"bestaande rulesetregels mogen niet via een volledige PUT worden overschreven");

  let mutations=0;
  const alCorrect=await schakelRumUit({accountId:account,token:"token",fetchImpl:async(url,options)=>{
    if(options.method!=="GET")mutations+=1;
    if(url.includes("/pages/projects/watishetweer/domains"))return antwoord(200,domains());
    if(url.endsWith(`/zones/${zone}/rulesets`))return antwoord(200,[{id:rulesetId,kind:"zone",phase:PHASE}]);
    if(url.endsWith(`/rulesets/${rulesetId}`))return antwoord(200,{id:rulesetId,rules:[juisteRegel()]});
    throw new Error(`Onverwachte testcall: ${options.method} ${url}`);
  }});
  assert.equal(alCorrect.gewijzigd,false,"correcte regel moet idempotent blijven");
  assert.equal(mutations,0,"correcte regel mag geen nieuwe versie veroorzaken");

  const patchCalls=[];
  const hersteld=await schakelRumUit({accountId:account,token:"token",fetchImpl:async(url,options)=>{
    patchCalls.push({url,method:options.method,body:options.body&&JSON.parse(options.body)});
    if(url.includes("/pages/projects/watishetweer/domains"))return antwoord(200,domains());
    if(url.endsWith(`/zones/${zone}/rulesets`)&&options.method==="GET")return antwoord(200,[{id:rulesetId,kind:"zone",phase:PHASE}]);
    if(url.endsWith(`/rulesets/${rulesetId}`)&&options.method==="GET"){
      const gepatcht=patchCalls.some(x=>x.method==="PATCH");
      return antwoord(200,{id:rulesetId,rules:[gepatcht?juisteRegel():{...juisteRegel(),action_parameters:{disable_rum:false}}]});
    }
    if(url.endsWith(`/rules/${ruleId}`)&&options.method==="PATCH")return antwoord(200,{id:rulesetId,rules:[juisteRegel()]});
    throw new Error(`Onverwachte testcall: ${options.method} ${url}`);
  }});
  assert.equal(hersteld.gewijzigd,true,"afwijkende bestaande regel moet worden hersteld");
  assert(patchCalls.some(x=>x.method==="PATCH"&&x.url.endsWith(`/rules/${ruleId}`)),"bestaande regel moet via PATCH worden bijgewerkt");

  const createCalls=[];
  await schakelRumUit({accountId:account,token:"token",fetchImpl:async(url,options)=>{
    createCalls.push({url,method:options.method,body:options.body&&JSON.parse(options.body)});
    if(url.includes("/pages/projects/watishetweer/domains"))return antwoord(200,domains());
    if(url.endsWith(`/zones/${zone}/rulesets`)&&options.method==="GET")return antwoord(200,[]);
    if(url.endsWith(`/zones/${zone}/rulesets`)&&options.method==="POST")return antwoord(200,{id:rulesetId,kind:"zone",phase:PHASE});
    if(url.endsWith(`/rulesets/${rulesetId}`)&&options.method==="GET"){
      const regelToegevoegd=createCalls.some(x=>x.method==="POST"&&x.url.endsWith(`/rulesets/${rulesetId}/rules`));
      return antwoord(200,{id:rulesetId,rules:regelToegevoegd?[juisteRegel()]:[]});
    }
    if(url.endsWith(`/rulesets/${rulesetId}/rules`)&&options.method==="POST")return antwoord(200,{id:rulesetId,rules:[juisteRegel()]});
    throw new Error(`Onverwachte testcall: ${options.method} ${url}`);
  }});
  const rulesetPost=createCalls.find(x=>x.method==="POST"&&x.url.endsWith(`/zones/${zone}/rulesets`));
  assert(rulesetPost,"ontbrekende http_config_settings-ruleset moet worden aangemaakt");
  assert.deepStrictEqual(rulesetPost.body.kind,"zone");
  assert.deepStrictEqual(rulesetPost.body.phase,PHASE);

  await assert.rejects(
    ()=>schakelRumUit({accountId:account,token:"token",fetchImpl:async(url,options)=>{
      if(url.includes("/pages/projects/watishetweer/domains"))return antwoord(200,domains());
      return antwoord(403,null,[{message:"permission denied"}]);
    }}),
    /Config Rules > Edit/,
    "ontbrekende Config Rules-permissie moet een bruikbare blokkademelding geven"
  );

  const workflow=fs.readFileSync(path.join(__dirname,"..",".github","workflows","cloudflare-production.yml"),"utf8");
  assert(workflow.includes("node scripts/cloudflare-disable-rum.js"),"productieworkflow moet disable_rum afdwingen vóór deploy");
  assert(!workflow.includes("static.cloudflareinsights.com"),"CSP of workflow mag de analytics-beacon niet toelaten");

  console.log("Cloudflare RUM Configuration Rule: create, add, patch, idempotentie, verificatie en permissiefout geslaagd.");
})().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});

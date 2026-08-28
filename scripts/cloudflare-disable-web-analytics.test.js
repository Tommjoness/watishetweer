"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");
const {
  analyticsUit,
  projectUrl,
  schakelWebAnalyticsUit
}=require("./cloudflare-disable-web-analytics.js");

function antwoord(status,body){
  return {ok:status>=200&&status<300,status,async text(){return JSON.stringify(body);}};
}

(async()=>{
  const account="0123456789abcdef0123456789abcdef";
  assert.equal(projectUrl(account),`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/watishetweer`);
  assert.throws(()=>projectUrl("kort"),/ACCOUNT_ID/);
  assert.equal(analyticsUit({build_config:{web_analytics_tag:null,web_analytics_token:null}}),true);
  assert.equal(analyticsUit({build_config:{web_analytics_tag:"tag",web_analytics_token:"token"}}),false);

  const calls=[];
  const gewijzigd=await schakelWebAnalyticsUit({accountId:account,token:"geheim",fetchImpl:async(url,options)=>{
    calls.push({url,options});
    if(calls.length===1)return antwoord(200,{success:true,result:{build_config:{web_analytics_tag:"tag",web_analytics_token:"token"}}});
    return antwoord(200,{success:true,result:{build_config:{web_analytics_tag:null,web_analytics_token:null}}});
  }});
  assert.equal(gewijzigd.gewijzigd,true,"actieve Pages-analytics moet worden uitgezet");
  assert.equal(calls.length,2,"actieve analytics vereist GET plus PATCH");
  assert.equal(calls[1].options.method,"PATCH");
  assert.deepStrictEqual(JSON.parse(calls[1].options.body),{build_config:{web_analytics_tag:null,web_analytics_token:null}});
  assert.equal(calls[1].options.headers.Authorization,"Bearer geheim");

  let alleenGet=0;
  const alUit=await schakelWebAnalyticsUit({accountId:account,token:"geheim",fetchImpl:async()=>{
    alleenGet+=1;
    return antwoord(200,{success:true,result:{build_config:{web_analytics_tag:null,web_analytics_token:null}}});
  }});
  assert.equal(alUit.gewijzigd,false,"al uitgeschakelde analytics blijft idempotent");
  assert.equal(alleenGet,1,"idempotente controle mag geen onnodige PATCH doen");

  await assert.rejects(
    ()=>schakelWebAnalyticsUit({accountId:account,token:"geheim",fetchImpl:async(url,options)=>{
      if(options.method==="GET")return antwoord(200,{success:true,result:{build_config:{web_analytics_tag:"tag",web_analytics_token:"token"}}});
      return antwoord(200,{success:true,result:{build_config:{web_analytics_tag:"tag",web_analytics_token:"token"}}});
    }}),
    /bleef actief/,
    "workflow moet falen als Cloudflare analytics niet werkelijk uitschakelt"
  );

  const workflow=fs.readFileSync(path.join(__dirname,"..",".github","workflows","cloudflare-production.yml"),"utf8");
  assert(workflow.includes("node scripts/cloudflare-disable-web-analytics.js"),"productieworkflow moet Pages Web Analytics vóór deploy uitschakelen");
  assert(!workflow.includes("static.cloudflareinsights.com"),"productieworkflow mag de beacon niet toelaten");

  console.log("Cloudflare Pages Web Analytics: idempotent uitschakelen, verificatie en workflowcontract geslaagd.");
})().catch(error=>{console.error(error&&error.stack||error);process.exit(1);});

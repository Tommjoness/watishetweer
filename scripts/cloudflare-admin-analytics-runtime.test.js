"use strict";

const assert=require("assert");
const {syncRuntime,GA4_PROPERTY_ID}=require("./cloudflare-admin-analytics-runtime.js");

(async()=>{
  const account="a".repeat(32);
  const calls=[];
  const before={
    success:true,
    result:{deployment_configs:{production:{env_vars:{EXISTING_SECRET:{type:"secret_text"},EXISTING_TEXT:{type:"plain_text",value:"ok"}}}}}
  };
  const after={
    success:true,
    result:{deployment_configs:{production:{env_vars:{
      EXISTING_SECRET:{type:"secret_text"},
      EXISTING_TEXT:{type:"plain_text",value:"ok"},
      CLOUDFLARE_ANALYTICS_API_TOKEN:{type:"secret_text"},
      CLOUDFLARE_ACCOUNT_ID:{type:"secret_text"},
      GA4_PROPERTY_ID:{type:"plain_text",value:GA4_PROPERTY_ID}
    }}}}
  };
  let reads=0;
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    if((options.method||"GET")==="GET"){
      reads++;
      return new Response(JSON.stringify(reads===1?before:after),{status:200});
    }
    assert.equal(options.method,"PATCH");
    const body=JSON.parse(options.body);
    assert.equal(body.deployment_configs.production.env_vars.CLOUDFLARE_ANALYTICS_API_TOKEN.type,"secret_text");
    assert.equal(body.deployment_configs.production.env_vars.CLOUDFLARE_ANALYTICS_API_TOKEN.value,"analytics-read-token");
    assert.equal(body.deployment_configs.production.env_vars.CLOUDFLARE_ACCOUNT_ID.type,"secret_text");
    assert.equal(body.deployment_configs.production.env_vars.CLOUDFLARE_ACCOUNT_ID.value,account);
    assert.equal(body.deployment_configs.production.env_vars.GA4_PROPERTY_ID.type,"plain_text");
    assert.equal(body.deployment_configs.production.env_vars.GA4_PROPERTY_ID.value,GA4_PROPERTY_ID);
    assert.equal(body.deployment_configs.preview,undefined,"Preview-runtime mag de analytics-bindings niet krijgen.");
    return new Response(JSON.stringify({success:true,result:{}}),{status:200});
  };

  const result=await syncRuntime({
    accountId:account,
    deployToken:"pages-write-token",
    analyticsToken:"analytics-read-token",
    fetchImpl
  });
  assert.equal(calls.length,3);
  assert.equal(result.ga4PropertyId,GA4_PROPERTY_ID);
  assert(result.productionEnvKeys.includes("EXISTING_SECRET"));
  assert(result.productionEnvKeys.includes("CLOUDFLARE_ANALYTICS_API_TOKEN"));
  assert(result.productionEnvKeys.includes("CLOUDFLARE_ACCOUNT_ID"));
  assert(result.productionEnvKeys.includes("GA4_PROPERTY_ID"));
  console.log("cloudflare-admin-analytics-runtime.test.js: ok");
})().catch(error=>{
  console.error(error&&error.stack||error);
  process.exit(1);
});

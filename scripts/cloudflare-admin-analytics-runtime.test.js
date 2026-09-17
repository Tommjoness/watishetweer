"use strict";

const assert=require("assert");
const {syncRuntime,GA4_PROPERTY_ID,deploymentEnv}=require("./cloudflare-admin-analytics-runtime.js");

(async()=>{
  assert.equal(deploymentEnv(),"production");
  assert.equal(deploymentEnv("PREVIEW"),"preview");
  assert.throws(()=>deploymentEnv("staging"),/production of preview/);

  const account="a".repeat(32);

  for(const target of ["production","preview"]){
    const calls=[];
    const before={
      success:true,
      result:{deployment_configs:{
        production:{env_vars:target==="production"?{EXISTING_SECRET:{type:"secret_text"},EXISTING_TEXT:{type:"plain_text",value:"ok"}}:{}},
        preview:{env_vars:target==="preview"?{EXISTING_SECRET:{type:"secret_text"},EXISTING_TEXT:{type:"plain_text",value:"ok"}}:{}}
      }}
    };
    const after={
      success:true,
      result:{deployment_configs:{
        production:{env_vars:target==="production"?{
          EXISTING_SECRET:{type:"secret_text"},
          EXISTING_TEXT:{type:"plain_text",value:"ok"},
          CLOUDFLARE_ANALYTICS_API_TOKEN:{type:"secret_text"},
          CLOUDFLARE_ACCOUNT_ID:{type:"secret_text"},
          GA4_PROPERTY_ID:{type:"secret_text"}
        }:{}},
        preview:{env_vars:target==="preview"?{
          EXISTING_SECRET:{type:"secret_text"},
          EXISTING_TEXT:{type:"plain_text",value:"ok"},
          CLOUDFLARE_ANALYTICS_API_TOKEN:{type:"secret_text"},
          CLOUDFLARE_ACCOUNT_ID:{type:"secret_text"},
          GA4_PROPERTY_ID:{type:"secret_text"}
        }:{} }
      }}
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
      assert(body.deployment_configs[target],`${target} payload ontbreekt.`);
      const vars=body.deployment_configs[target].env_vars;
      assert.equal(vars.CLOUDFLARE_ANALYTICS_API_TOKEN.type,"secret_text");
      assert.equal(vars.CLOUDFLARE_ANALYTICS_API_TOKEN.value,"analytics-read-token");
      assert.equal(vars.CLOUDFLARE_ACCOUNT_ID.type,"secret_text");
      assert.equal(vars.CLOUDFLARE_ACCOUNT_ID.value,account);
      assert.equal(vars.GA4_PROPERTY_ID.type,"secret_text");
      assert.equal(vars.GA4_PROPERTY_ID.value,GA4_PROPERTY_ID);
      assert.equal(body.deployment_configs[target==="production"?"preview":"production"],undefined,"Sync mag de andere runtime niet muteren.");
      return new Response(JSON.stringify({success:true,result:{}}),{status:200});
    };

    const result=await syncRuntime({
      accountId:account,
      deployToken:"pages-write-token",
      analyticsToken:"analytics-read-token",
      environment:target,
      fetchImpl
    });
    assert.equal(calls.length,3);
    assert.equal(result.environment,target);
    assert.equal(result.ga4PropertyId,GA4_PROPERTY_ID);
    assert(result.envKeys.includes("EXISTING_SECRET"));
    assert(result.envKeys.includes("CLOUDFLARE_ANALYTICS_API_TOKEN"));
    assert(result.envKeys.includes("CLOUDFLARE_ACCOUNT_ID"));
    assert(result.envKeys.includes("GA4_PROPERTY_ID"));
  }

  console.log("cloudflare-admin-analytics-runtime.test.js: ok");
})().catch(error=>{
  console.error(error&&error.stack||error);
  process.exit(1);
});

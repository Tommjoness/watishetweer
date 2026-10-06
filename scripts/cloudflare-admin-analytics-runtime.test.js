"use strict";

const assert=require("assert");
const {syncRuntime,GA4_PROPERTY_ID,deploymentEnv,cfJson,WACHTTIJDEN_MS}=require("./cloudflare-admin-analytics-runtime.js");

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

  /* Tijdelijke storing: 503, dan netwerkfout, dan succes → drie pogingen. */
  {
    assert.deepEqual(WACHTTIJDEN_MS,[2000,5000]);
    const antwoorden=[()=>new Response(JSON.stringify({success:false,errors:[{message:"Service unavailable"}]}),{status:503}),()=>{throw new TypeError("fetch failed");},()=>new Response(JSON.stringify({success:true,result:{ok:1}}),{status:200})];
    const gewacht=[],logs=[];let n=0;
    const result=await cfJson("https://api.example/x",{method:"GET"},async()=>antwoorden[n++](),{wacht:async ms=>{gewacht.push(ms);},log:m=>logs.push(m)});
    assert.deepEqual(result,{ok:1});
    assert.equal(n,3,"tijdelijke fouten krijgen samen drie pogingen");
    assert.deepEqual(gewacht,[2000,5000]);
    assert.equal(logs.length,2);
    assert(!logs.join(" ").includes("Bearer"),"logregels bevatten geen sleutel");
  }
  /* Blijvende storing: na drie pogingen faalt de stap alsnog. */
  {
    let n=0;
    await assert.rejects(cfJson("https://api.example/x",{},async()=>{n++;return new Response("",{status:502});},{wacht:async()=>{},log:()=>{}}),/HTTP 502/);
    assert.equal(n,3);
  }
  /* 429 (rate limit) telt als tijdelijk. */
  {
    let n=0;
    const r=await cfJson("https://api.example/x",{},async()=>(++n===1?new Response("",{status:429}):new Response(JSON.stringify({success:true,result:"ok"}),{status:200})),{wacht:async()=>{},log:()=>{}});
    assert.equal(r,"ok");assert.equal(n,2);
  }
  /* 4xx zoals een ongeldige sleutel is geen storing: direct falen, niet herhalen. */
  for(const status of [400,401,403,404]){
    let n=0;
    await assert.rejects(cfJson("https://api.example/x",{},async()=>{n++;return new Response(JSON.stringify({success:false,errors:[{message:"Authentication error"}]}),{status});},{wacht:async()=>{throw new Error("mag niet wachten");},log:()=>{}}),new RegExp(`HTTP ${status}\\): Authentication error`));
    assert.equal(n,1,`HTTP ${status} wordt niet herhaald`);
  }
  /* syncRuntime geeft de herhaalinstellingen door: een 500 bij de PATCH wordt hersteld. */
  {
    const leeg={success:true,result:{deployment_configs:{production:{env_vars:{}}}}};
    const na={success:true,result:{deployment_configs:{production:{env_vars:{CLOUDFLARE_ANALYTICS_API_TOKEN:{type:"secret_text"},CLOUDFLARE_ACCOUNT_ID:{type:"secret_text"},GA4_PROPERTY_ID:{type:"secret_text"}}}}}};
    let gets=0,patches=0;
    const result=await syncRuntime({accountId:account,deployToken:"w",analyticsToken:"a",fetchImpl:async(url,o={})=>{
      if((o.method||"GET")==="GET")return new Response(JSON.stringify(++gets===1?leeg:na),{status:200});
      return ++patches===1?new Response("",{status:500}):new Response(JSON.stringify({success:true,result:{}}),{status:200});
    },herhaal:{wacht:async()=>{},log:()=>{}}});
    assert.equal(patches,2);assert.equal(result.environment,"production");
  }

  console.log("cloudflare-admin-analytics-runtime.test.js: ok");
})().catch(error=>{
  console.error(error&&error.stack||error);
  process.exit(1);
});

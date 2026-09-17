"use strict";

const API_ROOT="https://api.cloudflare.com/client/v4";
const PROJECT="watishetweer";
const GA4_PROPERTY_ID="554692576";

function id(value,label){
  const cleaned=String(value||"").trim();
  if(!/^[a-f0-9]{32}$/i.test(cleaned))throw new Error(`${label} ontbreekt of is ongeldig.`);
  return cleaned;
}

function token(value,label){
  const cleaned=String(value||"").trim();
  if(!cleaned)throw new Error(`${label} ontbreekt.`);
  return cleaned;
}

function propertyId(value=GA4_PROPERTY_ID){
  const cleaned=String(value||"").trim();
  if(!/^\d{6,20}$/.test(cleaned))throw new Error("GA4_PROPERTY_ID ontbreekt of is ongeldig.");
  return cleaned;
}

function deploymentEnv(value="production"){
  const cleaned=String(value||"").trim().toLowerCase();
  if(cleaned!=="production"&&cleaned!=="preview")throw new Error("CLOUDFLARE_DEPLOYMENT_ENV moet production of preview zijn.");
  return cleaned;
}

async function cfJson(url,options={},fetchImpl=fetch){
  const response=await fetchImpl(url,options);
  const text=await response.text();
  let body=null;
  try{body=text?JSON.parse(text):null;}catch{}
  if(!response.ok||!body||body.success!==true){
    const detail=Array.isArray(body&&body.errors)&&body.errors[0]&&body.errors[0].message;
    throw new Error(`Cloudflare Pages API faalde (HTTP ${response.status})${detail?`: ${detail}`:""}.`);
  }
  return body.result;
}

async function syncRuntime({accountId,deployToken,analyticsToken,ga4PropertyId=GA4_PROPERTY_ID,project=PROJECT,environment="production",fetchImpl=fetch}){
  const account=id(accountId,"CLOUDFLARE_ACCOUNT_ID");
  const writer=token(deployToken,"CLOUDFLARE_API_TOKEN");
  const analytics=token(analyticsToken,"CLOUDFLARE_ANALYTICS_API_TOKEN");
  const ga4=propertyId(ga4PropertyId);
  const target=deploymentEnv(environment);
  const endpoint=`${API_ROOT}/accounts/${account}/pages/projects/${encodeURIComponent(project)}`;
  const headers={Authorization:`Bearer ${writer}`,"Content-Type":"application/json"};

  const before=await cfJson(endpoint,{method:"GET",headers},fetchImpl);
  const beforeVars=before&&before.deployment_configs&&before.deployment_configs[target]&&before.deployment_configs[target].env_vars||{};
  const beforeKeys=Object.keys(beforeVars).sort();

  const envVars={
    CLOUDFLARE_ANALYTICS_API_TOKEN:{type:"secret_text",value:analytics},
    CLOUDFLARE_ACCOUNT_ID:{type:"secret_text",value:account},
    GA4_PROPERTY_ID:{type:"secret_text",value:ga4}
  };
  const payload={deployment_configs:{[target]:{env_vars:envVars}}};
  await cfJson(endpoint,{method:"PATCH",headers,body:JSON.stringify(payload)},fetchImpl);
  const after=await cfJson(endpoint,{method:"GET",headers},fetchImpl);
  const afterVars=after&&after.deployment_configs&&after.deployment_configs[target]&&after.deployment_configs[target].env_vars||{};
  const afterKeys=Object.keys(afterVars).sort();

  for(const key of beforeKeys){
    if(!afterKeys.includes(key))throw new Error(`Bestaande ${target} env-var ${key} verdween tijdens analytics-sync.`);
  }
  if(!afterVars.CLOUDFLARE_ANALYTICS_API_TOKEN||afterVars.CLOUDFLARE_ANALYTICS_API_TOKEN.type!=="secret_text"){
    throw new Error(`Analytics-token staat na sync niet als secret_text in ${target} runtime.`);
  }
  if(!afterVars.CLOUDFLARE_ACCOUNT_ID||afterVars.CLOUDFLARE_ACCOUNT_ID.type!=="secret_text"){
    throw new Error(`Cloudflare account-id staat na sync niet als secret_text in ${target} runtime.`);
  }
  if(!afterVars.GA4_PROPERTY_ID||afterVars.GA4_PROPERTY_ID.type!=="secret_text"){
    throw new Error(`GA4 property-id staat na sync niet als secret_text in ${target} runtime.`);
  }

  return {project,environment:target,ga4PropertyId:ga4,envKeys:afterKeys};
}

async function main(){
  const result=await syncRuntime({
    accountId:process.env.CLOUDFLARE_ACCOUNT_ID,
    deployToken:process.env.CLOUDFLARE_API_TOKEN,
    analyticsToken:process.env.CLOUDFLARE_ANALYTICS_API_TOKEN,
    ga4PropertyId:process.env.GA4_PROPERTY_ID||GA4_PROPERTY_ID,
    project:process.env.CLOUDFLARE_PROJECT||PROJECT,
    environment:process.env.CLOUDFLARE_DEPLOYMENT_ENV||"production"
  });
  console.log(JSON.stringify({analyticsRuntime:"gesynchroniseerd",...result},null,2));
}

if(require.main===module){
  main().catch(error=>{
    console.error(error&&error.stack||error);
    process.exit(1);
  });
}

module.exports={API_ROOT,PROJECT,GA4_PROPERTY_ID,id,token,propertyId,deploymentEnv,cfJson,syncRuntime};

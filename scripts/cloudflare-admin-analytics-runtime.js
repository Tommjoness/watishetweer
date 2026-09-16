"use strict";

const API_ROOT="https://api.cloudflare.com/client/v4";
const PROJECT="watishetweer";

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

async function syncRuntime({accountId,deployToken,analyticsToken,project=PROJECT,fetchImpl=fetch}){
  const account=id(accountId,"CLOUDFLARE_ACCOUNT_ID");
  const writer=token(deployToken,"CLOUDFLARE_API_TOKEN");
  const analytics=token(analyticsToken,"CLOUDFLARE_ANALYTICS_API_TOKEN");
  const endpoint=`${API_ROOT}/accounts/${account}/pages/projects/${encodeURIComponent(project)}`;
  const headers={Authorization:`Bearer ${writer}`,"Content-Type":"application/json"};

  const before=await cfJson(endpoint,{method:"GET",headers},fetchImpl);
  const beforeVars=before&&before.deployment_configs&&before.deployment_configs.production&&before.deployment_configs.production.env_vars||{};
  const beforeKeys=Object.keys(beforeVars).sort();

  const payload={
    deployment_configs:{
      production:{
        env_vars:{
          CLOUDFLARE_ANALYTICS_API_TOKEN:{type:"secret_text",value:analytics},
          CLOUDFLARE_ACCOUNT_ID:{type:"plain_text",value:account}
        }
      }
    }
  };
  await cfJson(endpoint,{method:"PATCH",headers,body:JSON.stringify(payload)},fetchImpl);
  const after=await cfJson(endpoint,{method:"GET",headers},fetchImpl);
  const afterVars=after&&after.deployment_configs&&after.deployment_configs.production&&after.deployment_configs.production.env_vars||{};
  const afterKeys=Object.keys(afterVars).sort();

  for(const key of beforeKeys){
    if(!afterKeys.includes(key))throw new Error(`Bestaande production env-var ${key} verdween tijdens analytics-sync.`);
  }
  if(!afterVars.CLOUDFLARE_ANALYTICS_API_TOKEN||afterVars.CLOUDFLARE_ANALYTICS_API_TOKEN.type!=="secret_text"){
    throw new Error("Analytics-token staat na sync niet als secret_text in production runtime.");
  }
  if(!afterVars.CLOUDFLARE_ACCOUNT_ID||afterVars.CLOUDFLARE_ACCOUNT_ID.type!=="plain_text"){
    throw new Error("Cloudflare account-id staat na sync niet als plain_text in production runtime.");
  }

  return {project,productionEnvKeys:afterKeys};
}

async function main(){
  const result=await syncRuntime({
    accountId:process.env.CLOUDFLARE_ACCOUNT_ID,
    deployToken:process.env.CLOUDFLARE_API_TOKEN,
    analyticsToken:process.env.CLOUDFLARE_ANALYTICS_API_TOKEN,
    project:process.env.CLOUDFLARE_PROJECT||PROJECT
  });
  console.log(JSON.stringify({analyticsRuntime:"gesynchroniseerd",...result},null,2));
}

if(require.main===module){
  main().catch(error=>{
    console.error(error&&error.stack||error);
    process.exit(1);
  });
}

module.exports={API_ROOT,PROJECT,id,token,cfJson,syncRuntime};

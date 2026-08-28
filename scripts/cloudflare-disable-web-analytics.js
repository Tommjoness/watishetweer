"use strict";

const PROJECT="watishetweer";

function projectUrl(accountId,project=PROJECT){
  const account=String(accountId||"").trim();
  if(!/^[a-f0-9]{32}$/i.test(account))throw new Error("CLOUDFLARE_ACCOUNT_ID ontbreekt of is ongeldig.");
  return `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${encodeURIComponent(project)}`;
}

function analyticsUit(project){
  const build=project&&project.build_config||{};
  return build.web_analytics_tag==null&&build.web_analytics_token==null;
}

async function cloudflareJson(url,options,fetchImpl=fetch){
  const response=await fetchImpl(url,options);
  const text=await response.text();
  let body=null;
  try{body=text?JSON.parse(text):null;}catch{}
  if(!response.ok||!body||body.success!==true){
    const fout=Array.isArray(body&&body.errors)&&body.errors[0]&&body.errors[0].message;
    throw new Error(`Cloudflare Pages API faalde (HTTP ${response.status})${fout?`: ${fout}`:""}.`);
  }
  return body.result;
}

async function schakelWebAnalyticsUit({accountId,token,project=PROJECT,fetchImpl=fetch}){
  const api=projectUrl(accountId,project);
  const bearer=String(token||"").trim();
  if(!bearer)throw new Error("CLOUDFLARE_API_TOKEN ontbreekt.");
  const headers={Authorization:`Bearer ${bearer}`,"Content-Type":"application/json"};

  const voor=await cloudflareJson(api,{method:"GET",headers},fetchImpl);
  if(analyticsUit(voor)){
    console.log("Cloudflare Pages Web Analytics staat al uit.");
    return {gewijzigd:false,project:voor};
  }

  const na=await cloudflareJson(api,{
    method:"PATCH",
    headers,
    body:JSON.stringify({build_config:{web_analytics_tag:null,web_analytics_token:null}})
  },fetchImpl);
  if(!analyticsUit(na))throw new Error("Cloudflare Pages Web Analytics bleef actief na PATCH.");
  console.log("Cloudflare Pages Web Analytics uitgeschakeld en geverifieerd.");
  return {gewijzigd:true,project:na};
}

if(require.main===module){
  schakelWebAnalyticsUit({
    accountId:process.env.CLOUDFLARE_ACCOUNT_ID,
    token:process.env.CLOUDFLARE_API_TOKEN,
    project:process.env.CLOUDFLARE_PROJECT||PROJECT
  }).catch(error=>{
    console.error(error&&error.stack||error);
    process.exit(1);
  });
}

module.exports={PROJECT,projectUrl,analyticsUit,cloudflareJson,schakelWebAnalyticsUit};

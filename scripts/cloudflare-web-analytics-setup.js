"use strict";

const PROJECT="watishetweer";
const DOMAIN="watishetweer.nl";
const RULE_REF="watishetweer_disable_rum";
const PHASE="http_config_settings";
const API_ROOT="https://api.cloudflare.com/client/v4";

function geldigeId(waarde,label){
  const id=String(waarde||"").trim();
  if(!/^[a-f0-9]{32}$/i.test(id))throw new Error(`${label} ontbreekt of is ongeldig.`);
  return id;
}

function authHeaders(token){
  const bearer=String(token||"").trim();
  if(!bearer)throw new Error("CLOUDFLARE_API_TOKEN ontbreekt.");
  return {Authorization:`Bearer ${bearer}`,"Content-Type":"application/json"};
}

function apiHint(status,url){
  if(status!==403)return "";
  if(url.includes("/rum/site_info"))return " Cloudflare-token mist waarschijnlijk Account Settings Read/Write voor Web Analytics.";
  if(url.includes("/rulesets"))return " Cloudflare-token mist waarschijnlijk Zone > Config Rules > Edit.";
  return "";
}

async function cloudflareJson(url,options={},fetchImpl=fetch){
  const response=await fetchImpl(url,options);
  const text=await response.text();
  let body=null;
  try{body=text?JSON.parse(text):null;}catch{}
  if(!response.ok||!body||body.success!==true){
    const fout=Array.isArray(body&&body.errors)&&body.errors[0]&&body.errors[0].message;
    throw new Error(`Cloudflare API faalde (HTTP ${response.status})${fout?`: ${fout}`:""}.${apiHint(response.status,url)}`);
  }
  return {result:body.result,resultInfo:body.result_info||null};
}

async function haalZoneTag({accountId,token,project=PROJECT,fetchImpl=fetch}){
  const account=geldigeId(accountId,"CLOUDFLARE_ACCOUNT_ID");
  const headers=authHeaders(token);
  const api=`${API_ROOT}/accounts/${account}/pages/projects/${encodeURIComponent(project)}/domains`;
  const {result:domeinen}=await cloudflareJson(api,{method:"GET",headers},fetchImpl);
  if(!Array.isArray(domeinen))throw new Error("Cloudflare Pages-domainlijst ontbreekt.");
  const root=domeinen.find(x=>x&&x.name===DOMAIN);
  const www=domeinen.find(x=>x&&x.name===`www.${DOMAIN}`);
  const zoneTag=geldigeId(root&&root.zone_tag,"Cloudflare zone_tag");
  if(www&&www.zone_tag&&String(www.zone_tag)!==zoneTag)throw new Error("Cloudflare custom domains wijzen onverwacht naar verschillende zones.");
  return zoneTag;
}

async function lijstWebAnalyticsSites({accountId,headers,fetchImpl=fetch}){
  const alle=[];
  for(let page=1;page<=100;page++){
    const api=`${API_ROOT}/accounts/${accountId}/rum/site_info/list?page=${page}&per_page=100&order_by=host`;
    const {result,resultInfo}=await cloudflareJson(api,{method:"GET",headers},fetchImpl);
    if(!Array.isArray(result))throw new Error("Cloudflare Web Analytics-sitelijst ontbreekt.");
    alle.push(...result);
    const totalPages=Number(resultInfo&&resultInfo.total_pages)||1;
    if(page>=totalPages)return alle;
  }
  throw new Error("Cloudflare Web Analytics-sitelijst overschrijdt de veilige paginalimiet.");
}

function isSiteVoorZone(site,zoneTag){
  if(!site)return false;
  if(String(site.ruleset&&site.ruleset.zone_tag||"")===zoneTag)return true;
  if(String(site.ruleset&&site.ruleset.zone_name||"").toLowerCase()===DOMAIN)return true;
  return Array.isArray(site.rules)&&site.rules.some(rule=>String(rule&&rule.host||"").toLowerCase()===DOMAIN);
}

function siteActief(site,zoneTag){
  return Boolean(site&&site.auto_install===true&&site.ruleset&&site.ruleset.enabled===true&&String(site.ruleset.zone_tag||"")===zoneTag);
}

async function borgWebAnalyticsSite({accountId,token,zoneTag,fetchImpl=fetch}){
  const account=geldigeId(accountId,"CLOUDFLARE_ACCOUNT_ID");
  const zone=geldigeId(zoneTag,"Cloudflare zone_tag");
  const headers=authHeaders(token);
  const sites=await lijstWebAnalyticsSites({accountId:account,headers,fetchImpl});
  const kandidaten=sites.filter(site=>isSiteVoorZone(site,zone));
  if(kandidaten.length>1)throw new Error(`Cloudflare heeft ${kandidaten.length} Web Analytics-sites voor dezelfde watishetweer-zone; automatische keuze is onveilig.`);

  let site=kandidaten[0]||null;
  let gewijzigd=false;
  if(!site){
    const api=`${API_ROOT}/accounts/${account}/rum/site_info`;
    ({result:site}=await cloudflareJson(api,{
      method:"POST",
      headers,
      body:JSON.stringify({auto_install:true,zone_tag:zone})
    },fetchImpl));
    gewijzigd=true;
  }

  const siteId=String(site&&site.site_tag||"").trim();
  if(!siteId)throw new Error("Cloudflare Web Analytics-site mist site_tag.");
  if(!siteActief(site,zone)){
    const api=`${API_ROOT}/accounts/${account}/rum/site_info/${encodeURIComponent(siteId)}`;
    ({result:site}=await cloudflareJson(api,{
      method:"PUT",
      headers,
      body:JSON.stringify({auto_install:true,enabled:true,zone_tag:zone})
    },fetchImpl));
    gewijzigd=true;
  }

  const api=`${API_ROOT}/accounts/${account}/rum/site_info/${encodeURIComponent(siteId)}`;
  const {result:bevestigd}=await cloudflareJson(api,{method:"GET",headers},fetchImpl);
  if(!siteActief(bevestigd,zone))throw new Error("Cloudflare Web Analytics is na schrijven niet aantoonbaar actief met auto-install.");
  return {gewijzigd,siteTag:siteId,siteToken:bevestigd.site_token||null};
}

async function verwijderEigenRumBlokkade({zoneTag,token,fetchImpl=fetch}){
  const zone=geldigeId(zoneTag,"Cloudflare zone_tag");
  const headers=authHeaders(token);
  const basis=`${API_ROOT}/zones/${zone}/rulesets`;
  const {result:rulesets}=await cloudflareJson(basis,{method:"GET",headers},fetchImpl);
  if(!Array.isArray(rulesets))throw new Error("Cloudflare rulesetlijst ontbreekt.");
  const ruleset=rulesets.find(x=>x&&x.kind==="zone"&&x.phase===PHASE);
  if(!ruleset)return {gewijzigd:false,rulesetId:null,ruleId:null};

  const rulesetId=String(ruleset.id||"").trim();
  if(!rulesetId)throw new Error("Cloudflare configuration-ruleset mist een ID.");
  const detailUrl=`${basis}/${rulesetId}`;
  let {result:detail}=await cloudflareJson(detailUrl,{method:"GET",headers},fetchImpl);
  const regels=Array.isArray(detail&&detail.rules)?detail.rules:[];
  const eigen=regels.filter(x=>x&&x.ref===RULE_REF);
  if(eigen.length>1)throw new Error(`Cloudflare bevat ${eigen.length} regels met ref ${RULE_REF}; automatische verwijdering is onveilig.`);
  if(eigen.length===0)return {gewijzigd:false,rulesetId,ruleId:null};

  const ruleId=String(eigen[0].id||"").trim();
  if(!ruleId)throw new Error("Eigen Cloudflare RUM-blokkaderegel mist een ID.");
  await cloudflareJson(`${detailUrl}/rules/${encodeURIComponent(ruleId)}`,{method:"DELETE",headers},fetchImpl);
  ({result:detail}=await cloudflareJson(detailUrl,{method:"GET",headers},fetchImpl));
  const resteert=Array.isArray(detail&&detail.rules)&&detail.rules.some(x=>x&&x.ref===RULE_REF);
  if(resteert)throw new Error("Eigen Cloudflare RUM-blokkaderegel bestaat na DELETE nog steeds.");
  return {gewijzigd:true,rulesetId,ruleId};
}

async function activeerWebAnalytics({accountId,token,project=PROJECT,fetchImpl=fetch}){
  const account=geldigeId(accountId,"CLOUDFLARE_ACCOUNT_ID");
  authHeaders(token);
  const zoneTag=await haalZoneTag({accountId:account,token,project,fetchImpl});

  /* Eerst het analytics-object volledig en verifieerbaar activeren. Pas daarna
     verwijderen we uitsluitend onze eigen historische disable_rum-regel. Zo
     blijft een token-/API-fout fail-safe: de site zelf blijft gewoon werken. */
  const site=await borgWebAnalyticsSite({accountId:account,token,zoneTag,fetchImpl});
  const blokkade=await verwijderEigenRumBlokkade({zoneTag,token,fetchImpl});

  console.log(JSON.stringify({
    webAnalytics:"actief",
    autoInstall:true,
    zoneTag,
    siteTag:site.siteTag,
    siteGewijzigd:site.gewijzigd,
    eigenRumBlokkadeVerwijderd:blokkade.gewijzigd
  }));
  return {zoneTag,site,blokkade};
}

if(require.main===module){
  activeerWebAnalytics({
    accountId:process.env.CLOUDFLARE_ACCOUNT_ID,
    token:process.env.CLOUDFLARE_API_TOKEN,
    project:process.env.CLOUDFLARE_PROJECT||PROJECT
  }).catch(error=>{
    console.error(error&&error.stack||error);
    process.exit(1);
  });
}

module.exports={
  PROJECT,DOMAIN,RULE_REF,PHASE,API_ROOT,
  geldigeId,authHeaders,apiHint,cloudflareJson,haalZoneTag,lijstWebAnalyticsSites,
  isSiteVoorZone,siteActief,borgWebAnalyticsSite,verwijderEigenRumBlokkade,activeerWebAnalytics
};

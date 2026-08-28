"use strict";

const PROJECT="watishetweer";
const DOMAIN="watishetweer.nl";
const RULE_REF="watishetweer_disable_rum";
const PHASE="http_config_settings";
const EXPRESSION='(http.host eq "watishetweer.nl") or (http.host eq "www.watishetweer.nl")';

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

async function cloudflareJson(url,options,fetchImpl=fetch){
  const response=await fetchImpl(url,options);
  const text=await response.text();
  let body=null;
  try{body=text?JSON.parse(text):null;}catch{}
  if(!response.ok||!body||body.success!==true){
    const fout=Array.isArray(body&&body.errors)&&body.errors[0]&&body.errors[0].message;
    const hint=response.status===403&&url.includes("/rulesets")
      ?" Cloudflare-token mist waarschijnlijk Zone > Config Rules > Edit."
      :"";
    throw new Error(`Cloudflare API faalde (HTTP ${response.status})${fout?`: ${fout}`:""}.${hint}`);
  }
  return body.result;
}

function gewensteRegel(){
  return {
    action:"set_config",
    action_parameters:{disable_rum:true},
    expression:EXPRESSION,
    description:"Disable Cloudflare RUM for watishetweer",
    ref:RULE_REF,
    enabled:true
  };
}

function regelKlopt(regel){
  return Boolean(
    regel&&
    regel.ref===RULE_REF&&
    regel.action==="set_config"&&
    regel.enabled!==false&&
    regel.expression===EXPRESSION&&
    regel.action_parameters&&
    regel.action_parameters.disable_rum===true
  );
}

async function haalZoneTag({accountId,token,project=PROJECT,fetchImpl=fetch}){
  const account=geldigeId(accountId,"CLOUDFLARE_ACCOUNT_ID");
  const headers=authHeaders(token);
  const api=`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${encodeURIComponent(project)}/domains`;
  const domeinen=await cloudflareJson(api,{method:"GET",headers},fetchImpl);
  if(!Array.isArray(domeinen))throw new Error("Cloudflare Pages-domainlijst ontbreekt.");
  const root=domeinen.find(x=>x&&x.name===DOMAIN);
  const www=domeinen.find(x=>x&&x.name===`www.${DOMAIN}`);
  const zoneTag=geldigeId(root&&root.zone_tag,"Cloudflare zone_tag");
  if(www&&www.zone_tag&&String(www.zone_tag)!==zoneTag)throw new Error("Cloudflare custom domains wijzen onverwacht naar verschillende zones.");
  return zoneTag;
}

async function haalOfMaakRuleset({zoneTag,headers,fetchImpl=fetch}){
  const basis=`https://api.cloudflare.com/client/v4/zones/${zoneTag}/rulesets`;
  const lijst=await cloudflareJson(basis,{method:"GET",headers},fetchImpl);
  if(!Array.isArray(lijst))throw new Error("Cloudflare rulesetlijst ontbreekt.");
  let ruleset=lijst.find(x=>x&&x.kind==="zone"&&x.phase===PHASE);
  if(ruleset)return ruleset;

  ruleset=await cloudflareJson(basis,{
    method:"POST",
    headers,
    body:JSON.stringify({
      name:"watishetweer configuration rules",
      description:"Configuration rules for watishetweer.nl",
      kind:"zone",
      phase:PHASE
    })
  },fetchImpl);
  if(!ruleset||!ruleset.id)throw new Error("Cloudflare maakte geen configuration-ruleset aan.");
  return ruleset;
}

async function schakelRumUit({accountId,token,project=PROJECT,fetchImpl=fetch}){
  const headers=authHeaders(token);
  const zoneTag=await haalZoneTag({accountId,token,project,fetchImpl});
  const ruleset=await haalOfMaakRuleset({zoneTag,headers,fetchImpl});
  const rulesetId=String(ruleset.id||"").trim();
  if(!rulesetId)throw new Error("Cloudflare configuration-ruleset mist een ID.");

  const basis=`https://api.cloudflare.com/client/v4/zones/${zoneTag}/rulesets/${rulesetId}`;
  let detail=await cloudflareJson(basis,{method:"GET",headers},fetchImpl);
  const bestaand=Array.isArray(detail&&detail.rules)?detail.rules.find(x=>x&&x.ref===RULE_REF):null;

  if(bestaand&&regelKlopt(bestaand)){
    console.log("Cloudflare RUM Configuration Rule staat al correct uit.");
    return {gewijzigd:false,zoneTag,rulesetId,ruleId:bestaand.id||null};
  }

  const regel=gewensteRegel();
  if(bestaand&&bestaand.id){
    await cloudflareJson(`${basis}/rules/${bestaand.id}`,{
      method:"PATCH",
      headers,
      body:JSON.stringify(regel)
    },fetchImpl);
  }else{
    await cloudflareJson(`${basis}/rules`,{
      method:"POST",
      headers,
      body:JSON.stringify(regel)
    },fetchImpl);
  }

  detail=await cloudflareJson(basis,{method:"GET",headers},fetchImpl);
  const bevestigd=Array.isArray(detail&&detail.rules)?detail.rules.find(x=>x&&x.ref===RULE_REF):null;
  if(!regelKlopt(bevestigd))throw new Error("Cloudflare RUM Configuration Rule is na schrijven niet correct actief.");
  console.log("Cloudflare RUM uitgeschakeld via Configuration Rule en geverifieerd.");
  return {gewijzigd:true,zoneTag,rulesetId,ruleId:bevestigd.id||null};
}

if(require.main===module){
  schakelRumUit({
    accountId:process.env.CLOUDFLARE_ACCOUNT_ID,
    token:process.env.CLOUDFLARE_API_TOKEN,
    project:process.env.CLOUDFLARE_PROJECT||PROJECT
  }).catch(error=>{
    console.error(error&&error.stack||error);
    process.exit(1);
  });
}

module.exports={PROJECT,DOMAIN,RULE_REF,PHASE,EXPRESSION,geldigeId,authHeaders,cloudflareJson,gewensteRegel,regelKlopt,haalZoneTag,haalOfMaakRuleset,schakelRumUit};

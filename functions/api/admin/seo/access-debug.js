const JWKS_TTL_MS=60*60*1000;
const PAGES_ACCESS_AUD="ea551fbedaa6efc3ad82569d11df8f0880dc3e54406af51d648aad5ccbb38cec";

let jwksCache={url:null,expiresAt:0,keys:[]};

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"private, no-store, max-age=0",
      "X-Robots-Tag":"noindex, nofollow, noarchive"
    }
  });
}

function base64UrlToBytes(input){
  const normalized=String(input||"").replace(/-/g,"+").replace(/_/g,"/");
  const padded=normalized+"=".repeat((4-normalized.length%4)%4);
  const binary=atob(padded);
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}

function decodeJwtPart(part){
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}

function normalizeTeamDomain(value){
  return String(value||"").trim().replace(/^https?:\/\//i,"").replace(/\/$/,"");
}

function allowedEmails(env){
  return String(env.SEO_ADMIN_EMAILS||env.SEO_ADMIN_EMAIL||"")
    .split(",")
    .map(value=>value.trim().toLowerCase())
    .filter(Boolean);
}

function allowlistSource(env){
  if(String(env.SEO_ADMIN_EMAILS||"").trim())return "SEO_ADMIN_EMAILS";
  if(String(env.SEO_ADMIN_EMAIL||"").trim())return "SEO_ADMIN_EMAIL";
  return "none";
}

function isPagesHost(requestUrl){
  let hostname="";
  try{hostname=new URL(requestUrl).hostname.toLowerCase();}catch{}
  return hostname==="watishetweer.pages.dev"||hostname.endsWith(".watishetweer.pages.dev");
}

async function fetchAccessJwks(teamDomain){
  const url=`https://${teamDomain}/cdn-cgi/access/certs`;
  if(jwksCache.url===url&&jwksCache.expiresAt>Date.now()&&jwksCache.keys.length)return jwksCache.keys;
  const response=await fetch(url,{headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error(`Cloudflare Access certs ophalen mislukt (${response.status}).`);
  const data=await response.json();
  const keys=Array.isArray(data.keys)?data.keys:[];
  if(!keys.length)throw new Error("Cloudflare Access leverde geen verificatiesleutels.");
  jwksCache={url,expiresAt:Date.now()+JWKS_TTL_MS,keys};
  return keys;
}

async function diagnose(context){
  if(!isPagesHost(context.request.url)){
    return {status:404,body:{error:"not_found",message:"Diagnose is alleen beschikbaar op de afgeschermde Pages-preview."}};
  }

  const env=context.env||{};
  const teamDomain=normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const allowlist=allowedEmails(env);
  if(!teamDomain){
    return {status:503,body:{error:"access_not_configured",message:"CF_ACCESS_TEAM_DOMAIN ontbreekt."}};
  }

  const assertion=context.request.headers.get("Cf-Access-Jwt-Assertion")||"";
  if(!assertion)return {status:401,body:{error:"access_required",message:"Cloudflare Access JWT ontbreekt."}};
  const parts=assertion.split(".");
  if(parts.length!==3)return {status:401,body:{error:"invalid_access_token",message:"Ongeldig Cloudflare Access-token."}};

  let header,payload;
  try{
    header=decodeJwtPart(parts[0]);
    payload=decodeJwtPart(parts[1]);
  }catch{
    return {status:401,body:{error:"invalid_access_token",message:"Cloudflare Access-token kon niet worden gelezen."}};
  }

  const now=Math.floor(Date.now()/1000);
  const expectedIssuer=`https://${teamDomain}`;
  const audiences=Array.isArray(payload.aud)?payload.aud:[payload.aud].filter(Boolean);
  if(payload.iss!==expectedIssuer||!audiences.includes(PAGES_ACCESS_AUD)||!payload.exp||payload.exp<=now||(payload.nbf&&payload.nbf>now+30)){
    return {status:401,body:{error:"invalid_access_claims",message:"JWT-claims voldoen niet aan het Pages Access-contract."}};
  }
  if(!header.kid)return {status:401,body:{error:"invalid_access_token",message:"Cloudflare Access-token mist een key-id."}};

  try{
    const keys=await fetchAccessJwks(teamDomain);
    const jwk=keys.find(key=>key.kid===header.kid);
    if(!jwk)return {status:401,body:{error:"unknown_access_key",message:"Cloudflare Access-key is onbekend."}};
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const verified=await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if(!verified)return {status:401,body:{error:"invalid_access_signature",message:"Cloudflare Access-token kon niet worden geverifieerd."}};
  }catch(error){
    return {status:503,body:{error:"access_verification_failed",message:error instanceof Error?error.message:"Cloudflare Access-verificatie mislukt."}};
  }

  const jwtEmail=String(payload.email||"").trim().toLowerCase();
  return {
    status:200,
    body:{
      diagnostic:"seo_access",
      pagesHost:true,
      signatureVerified:true,
      issuerMatch:true,
      audienceMatch:true,
      emailClaimPresent:Boolean(jwtEmail),
      jwtEmail:jwtEmail||null,
      allowlistSource:allowlistSource(env),
      allowlistCount:allowlist.length,
      emailMatch:Boolean(jwtEmail&&allowlist.includes(jwtEmail))
    }
  };
}

export async function onRequestGet(context){
  const result=await diagnose(context);
  return json(result.body,result.status);
}

export async function onRequest(context){
  if(context.request.method!=="GET")return json({error:"method_not_allowed",message:"Alleen GET is toegestaan."},405);
  return onRequestGet(context);
}

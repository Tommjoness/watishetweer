const GRAPHQL_URL="https://api.cloudflare.com/client/v4/graphql";
const DOMAIN="watishetweer.nl";
const WINDOWS=[1,7,30];
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

function accessAudience(env,requestUrl){
  const configured=String(env.CF_ACCESS_AUD||"").trim();
  let hostname="";
  try{hostname=new URL(requestUrl).hostname.toLowerCase();}catch{}
  const pagesHost=hostname==="watishetweer.pages.dev"||hostname.endsWith(".watishetweer.pages.dev");
  return pagesHost?PAGES_ACCESS_AUD:configured;
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

async function verifyAccess(context){
  const env=context.env||{};
  const teamDomain=normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const expectedAud=accessAudience(env,context.request.url);
  const allowlist=allowedEmails(env);
  if(!teamDomain||!expectedAud||!allowlist.length){
    return {ok:false,status:503,code:"access_not_configured",message:"SEO-dashboard is nog niet gekoppeld aan Cloudflare Access."};
  }

  const assertion=context.request.headers.get("Cf-Access-Jwt-Assertion")||"";
  if(!assertion)return {ok:false,status:401,code:"access_required",message:"Log in via Cloudflare Access om dit dashboard te openen."};
  const parts=assertion.split(".");
  if(parts.length!==3)return {ok:false,status:401,code:"invalid_access_token",message:"Ongeldig Cloudflare Access-token."};

  let header,payload;
  try{
    header=decodeJwtPart(parts[0]);
    payload=decodeJwtPart(parts[1]);
  }catch{
    return {ok:false,status:401,code:"invalid_access_token",message:"Cloudflare Access-token kon niet worden gelezen."};
  }

  const now=Math.floor(Date.now()/1000);
  const expectedIssuer=`https://${teamDomain}`;
  const audiences=Array.isArray(payload.aud)?payload.aud:[payload.aud].filter(Boolean);
  if(payload.iss!==expectedIssuer||!audiences.includes(expectedAud)||!payload.exp||payload.exp<=now||(payload.nbf&&payload.nbf>now+30)){
    return {ok:false,status:401,code:"invalid_access_claims",message:"Cloudflare Access-token is verlopen of niet voor deze applicatie bedoeld."};
  }
  if(!header.kid)return {ok:false,status:401,code:"invalid_access_token",message:"Cloudflare Access-token mist een key-id."};

  try{
    const keys=await fetchAccessJwks(teamDomain);
    const jwk=keys.find(key=>key.kid===header.kid);
    if(!jwk)return {ok:false,status:401,code:"unknown_access_key",message:"Cloudflare Access-key is onbekend."};
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const verified=await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if(!verified)return {ok:false,status:401,code:"invalid_access_signature",message:"Cloudflare Access-token kon niet worden geverifieerd."};
  }catch(error){
    return {ok:false,status:503,code:"access_verification_failed",message:error instanceof Error?error.message:"Cloudflare Access-verificatie mislukt."};
  }

  const email=String(payload.email||"").trim().toLowerCase();
  if(!email||!allowlist.includes(email))return {ok:false,status:403,code:"access_denied",message:"Dit account heeft geen toegang tot het SEO-dashboard."};
  return {ok:true,email};
}

function validAccountId(value){
  const id=String(value||"").trim();
  return /^[a-f0-9]{32}$/i.test(id)?id:null;
}

function gqlString(value){
  return JSON.stringify(String(value));
}

function period(days,now=new Date()){
  const end=new Date(now);
  const start=new Date(end.getTime()-days*24*60*60*1000);
  return {start:start.toISOString(),end:end.toISOString()};
}

function buildFilter({start,end,bot}){
  const parts=[
    `{datetime_geq:${gqlString(start)}}`,
    `{datetime_leq:${gqlString(end)}}`,
    `{requestHost:${gqlString(DOMAIN)}}`
  ];
  if(bot===0||bot===1)parts.push(`{bot:${bot}}`);
  return `{AND:[${parts.join(",")}]}`;
}

function buildQuery(accountId,start,end){
  const all=buildFilter({start,end,bot:null});
  const human=buildFilter({start,end,bot:0});
  const bots=buildFilter({start,end,bot:1});
  return `query AdminHumanTraffic { viewer { accounts(filter:{accountTag:${gqlString(accountId)}}) { allTraffic:rumPageloadEventsAdaptiveGroups(limit:1,filter:${all}) { count sum { visits } avg { sampleInterval } } humanTraffic:rumPageloadEventsAdaptiveGroups(limit:1,filter:${human}) { count sum { visits } avg { sampleInterval } } botTraffic:rumPageloadEventsAdaptiveGroups(limit:1,filter:${bots}) { count sum { visits } avg { sampleInterval } } } } }`;
}

function numeric(value,fallback=0){
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}

function aggregate(value){
  if(!Array.isArray(value)||value.length===0)return {pageviews:0,visits:0,sampleInterval:1};
  const row=value[0]||{};
  return {
    pageviews:numeric(row.count),
    visits:numeric(row.sum&&row.sum.visits),
    sampleInterval:numeric(row.avg&&row.avg.sampleInterval,1)
  };
}

async function graphql(token,query){
  const response=await fetch(GRAPHQL_URL,{
    method:"POST",
    headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify({query})
  });
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(`Cloudflare Analytics gaf HTTP ${response.status}.`);
  if(!body)throw new Error("Cloudflare Analytics gaf geen geldige JSON terug.");
  if(Array.isArray(body.errors)&&body.errors.length){
    throw new Error(body.errors.map(item=>String(item&&item.message||"onbekende GraphQL-fout")).join(" | "));
  }
  return body.data;
}

async function loadWindow(accountId,token,days,now){
  const {start,end}=period(days,now);
  const data=await graphql(token,buildQuery(accountId,start,end));
  const accounts=data&&data.viewer&&data.viewer.accounts;
  if(!Array.isArray(accounts)||accounts.length!==1)throw new Error("Cloudflare Analytics gaf niet exact één account terug.");
  const account=accounts[0]||{};
  const human=aggregate(account.humanTraffic);
  const bots=aggregate(account.botTraffic);
  const all=aggregate(account.allTraffic);
  const classified=human.pageviews+bots.pageviews;
  return {
    days,start,end,human,bots,all,
    botPageviewShare:classified>0?bots.pageviews/classified:0
  };
}

async function loadCloudflare(env){
  const accountId=validAccountId(env.CLOUDFLARE_ACCOUNT_ID);
  const token=String(env.CLOUDFLARE_ANALYTICS_API_TOKEN||"").trim();
  if(!accountId||!token){
    return {configured:false,reason:"Cloudflare Analytics is nog niet gekoppeld aan de productie-runtime."};
  }
  const now=new Date();
  try{
    const windows=await Promise.all(WINDOWS.map(days=>loadWindow(accountId,token,days,now)));
    return {
      configured:true,
      source:"Cloudflare Web Analytics RUM",
      host:DOMAIN,
      botFilter:"bot: 0",
      generatedAt:now.toISOString(),
      windows
    };
  }catch(error){
    return {configured:true,error:error instanceof Error?error.message:"Cloudflare Analytics kon niet worden geladen."};
  }
}

export async function onRequestGet(context){
  const access=await verifyAccess(context);
  if(!access.ok)return json({error:access.code,message:access.message},access.status);
  return json(await loadCloudflare(context.env||{}));
}

export async function onRequest(context){
  if(context.request.method!=="GET")return json({error:"method_not_allowed",message:"Alleen GET is toegestaan."},405);
  return onRequestGet(context);
}
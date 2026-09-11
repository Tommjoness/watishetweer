const GOOGLE_TOKEN_URL="https://oauth2.googleapis.com/token";
const GSC_SCOPE="https://www.googleapis.com/auth/webmasters.readonly";
const GA4_SCOPE="https://www.googleapis.com/auth/analytics.readonly";
const JWKS_TTL_MS=60*60*1000;

let jwksCache={url:null,expiresAt:0,keys:[]};
let tokenCache={key:null,expiresAt:0,token:null};

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
  const normalized=input.replace(/-/g,"+").replace(/_/g,"/");
  const padded=normalized+"=".repeat((4-normalized.length%4)%4);
  const binary=atob(padded);
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}

function bytesToBase64Url(bytes){
  let binary="";
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}

function encodeJson(value){
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
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
  const expectedAud=String(env.CF_ACCESS_AUD||"").trim();
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

function pemToArrayBuffer(pem){
  const base64=String(pem||"")
    .replace(/\\n/g,"\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g,"")
    .replace(/-----END PRIVATE KEY-----/g,"")
    .replace(/\s+/g,"");
  if(!base64)throw new Error("Google service-account private key ontbreekt.");
  const binary=atob(base64);
  return Uint8Array.from(binary,c=>c.charCodeAt(0)).buffer;
}

async function getGoogleAccessToken(env){
  const email=String(env.GOOGLE_SERVICE_ACCOUNT_EMAIL||"").trim();
  const privateKey=String(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY||"").trim();
  if(!email||!privateKey)throw new Error("Google service-account is nog niet geconfigureerd.");

  const scopes=[GSC_SCOPE,GA4_SCOPE].join(" ");
  const cacheKey=`${email}|${scopes}`;
  if(tokenCache.key===cacheKey&&tokenCache.token&&tokenCache.expiresAt>Date.now()+60_000)return tokenCache.token;

  const now=Math.floor(Date.now()/1000);
  const unsigned=`${encodeJson({alg:"RS256",typ:"JWT"})}.${encodeJson({
    iss:email,
    scope:scopes,
    aud:GOOGLE_TOKEN_URL,
    iat:now,
    exp:now+3600
  })}`;
  const key=await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},
    false,
    ["sign"]
  );
  const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned));
  const assertion=`${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
  const response=await fetch(GOOGLE_TOKEN_URL,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})
  });
  const payload=await response.json();
  if(!response.ok||!payload.access_token){
    const detail=payload&&payload.error_description?payload.error_description:`HTTP ${response.status}`;
    throw new Error(`Google OAuth-token ophalen mislukt: ${detail}`);
  }
  const expiresIn=Number(payload.expires_in)||3600;
  tokenCache={key:cacheKey,token:payload.access_token,expiresAt:Date.now()+expiresIn*1000};
  return payload.access_token;
}

function isoDate(date){
  return date.toISOString().slice(0,10);
}

function dateRanges(days){
  const safeDays=Math.max(7,Math.min(90,Math.round(Number(days)||28)));
  const settledEnd=new Date();
  settledEnd.setUTCHours(0,0,0,0);
  settledEnd.setUTCDate(settledEnd.getUTCDate()-3);
  const currentStart=new Date(settledEnd);
  currentStart.setUTCDate(currentStart.getUTCDate()-(safeDays-1));
  const previousEnd=new Date(currentStart);
  previousEnd.setUTCDate(previousEnd.getUTCDate()-1);
  const previousStart=new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate()-(safeDays-1));
  return {
    days:safeDays,
    current:{startDate:isoDate(currentStart),endDate:isoDate(settledEnd)},
    previous:{startDate:isoDate(previousStart),endDate:isoDate(previousEnd)}
  };
}

async function gscQuery(token,siteUrl,startDate,endDate,dimensions=[],rowLimit=25000){
  const response=await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,{
    method:"POST",
    headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify({startDate,endDate,dimensions,rowLimit,startRow:0,type:"web",dataState:"final"})
  });
  const payload=await response.json();
  if(!response.ok){
    const detail=payload&&payload.error&&payload.error.message?payload.error.message:`HTTP ${response.status}`;
    throw new Error(`Search Console-query mislukt: ${detail}`);
  }
  return Array.isArray(payload.rows)?payload.rows:[];
}

function summaryFromRows(rows){
  const row=rows[0]||{};
  return {
    clicks:Number(row.clicks)||0,
    impressions:Number(row.impressions)||0,
    ctr:Number(row.ctr)||0,
    position:Number(row.position)||0
  };
}

function delta(current,previous){
  if(previous===0)return current===0?0:null;
  return (current-previous)/previous;
}

function mapRows(rows,keyName){
  return rows.map(row=>({
    [keyName]:String((row.keys||[])[0]||""),
    clicks:Number(row.clicks)||0,
    impressions:Number(row.impressions)||0,
    ctr:Number(row.ctr)||0,
    position:Number(row.position)||0
  }));
}

async function ga4Report(token,propertyId,body){
  const id=String(propertyId).replace(/^properties\//,"");
  const response=await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(id)}:runReport`,{
    method:"POST",
    headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const payload=await response.json();
  if(!response.ok){
    const detail=payload&&payload.error&&payload.error.message?payload.error.message:`HTTP ${response.status}`;
    throw new Error(`GA4-query mislukt: ${detail}`);
  }
  return payload;
}

function metricMap(report){
  const headers=(report.metricHeaders||[]).map(item=>item.name);
  const values=((report.rows||[])[0]||{}).metricValues||[];
  return Object.fromEntries(headers.map((name,index)=>[name,Number(values[index]&&values[index].value)||0]));
}

function ga4Rows(report,dimensionName){
  const metricNames=(report.metricHeaders||[]).map(item=>item.name);
  return (report.rows||[]).map(row=>{
    const item={[dimensionName]:String((row.dimensionValues||[])[0]&&row.dimensionValues[0].value||"")};
    metricNames.forEach((name,index)=>{item[name]=Number(row.metricValues&&row.metricValues[index]&&row.metricValues[index].value)||0;});
    return item;
  });
}

async function loadGa4(token,env,ranges){
  const propertyId=String(env.GA4_PROPERTY_ID||"").trim();
  if(!propertyId)return {configured:false,reason:"GA4_PROPERTY_ID ontbreekt; Search Console werkt wel."};
  try{
    const dateRanges=[ranges.current];
    const [overview,landingPages]=await Promise.all([
      ga4Report(token,propertyId,{
        dateRanges,
        metrics:[
          {name:"sessions"},
          {name:"activeUsers"},
          {name:"screenPageViews"},
          {name:"engagementRate"},
          {name:"bounceRate"}
        ]
      }),
      ga4Report(token,propertyId,{
        dateRanges,
        dimensions:[{name:"landingPagePlusQueryString"}],
        metrics:[{name:"sessions"},{name:"activeUsers"},{name:"engagementRate"}],
        limit:"20",
        orderBys:[{metric:{metricName:"sessions"},desc:true}]
      })
    ]);
    return {
      configured:true,
      propertyId:propertyId.replace(/^properties\//,""),
      summary:metricMap(overview),
      landingPages:ga4Rows(landingPages,"landingPage")
    };
  }catch(error){
    return {configured:true,error:error instanceof Error?error.message:"GA4-query mislukt."};
  }
}

export async function onRequestGet(context){
  const access=await verifyAccess(context);
  if(!access.ok)return json({error:access.code,message:access.message},access.status);

  const siteUrl=String(context.env.GSC_SITE_URL||"sc-domain:watishetweer.nl").trim();
  const requestUrl=new URL(context.request.url);
  const ranges=dateRanges(requestUrl.searchParams.get("days"));

  try{
    const token=await getGoogleAccessToken(context.env);
    const [currentRows,previousRows,queryRows,pageRows,deviceRows,countryRows]=await Promise.all([
      gscQuery(token,siteUrl,ranges.current.startDate,ranges.current.endDate,[],1),
      gscQuery(token,siteUrl,ranges.previous.startDate,ranges.previous.endDate,[],1),
      gscQuery(token,siteUrl,ranges.current.startDate,ranges.current.endDate,["query"],100),
      gscQuery(token,siteUrl,ranges.current.startDate,ranges.current.endDate,["page"],100),
      gscQuery(token,siteUrl,ranges.current.startDate,ranges.current.endDate,["device"],10),
      gscQuery(token,siteUrl,ranges.current.startDate,ranges.current.endDate,["country"],25)
    ]);
    const current=summaryFromRows(currentRows);
    const previous=summaryFromRows(previousRows);
    const queries=mapRows(queryRows,"query");
    const pages=mapRows(pageRows,"page");
    const devices=mapRows(deviceRows,"device");
    const countries=mapRows(countryRows,"country");
    const opportunities=queries
      .filter(item=>item.impressions>=10&&item.position>=4&&item.position<=20)
      .sort((a,b)=>(b.impressions/Math.max(b.position,1))-(a.impressions/Math.max(a.position,1)))
      .slice(0,12);
    const ga4=await loadGa4(token,context.env,ranges);

    return json({
      generatedAt:new Date().toISOString(),
      viewer:access.email,
      range:ranges,
      searchConsole:{
        siteUrl,
        summary:{
          ...current,
          previous,
          change:{
            clicks:delta(current.clicks,previous.clicks),
            impressions:delta(current.impressions,previous.impressions),
            ctr:delta(current.ctr,previous.ctr),
            position:previous.position?current.position-previous.position:null
          }
        },
        opportunities,
        topQueries:queries.slice(0,25),
        topPages:pages.slice(0,25),
        devices,
        countries:countries.slice(0,10)
      },
      ga4
    });
  }catch(error){
    return json({error:"seo_data_failed",message:error instanceof Error?error.message:"SEO-data ophalen mislukt."},502);
  }
}

export async function onRequest(context){
  if(context.request.method!=="GET")return json({error:"method_not_allowed",message:"Alleen GET is toegestaan."},405);
  return onRequestGet(context);
}

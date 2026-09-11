"use strict";

function serviceToken(env=process.env){
  const clientId=String(env.CF_ACCESS_CLIENT_ID||"").trim();
  const clientSecret=String(env.CF_ACCESS_CLIENT_SECRET||"").trim();
  if(!clientId&&!clientSecret)return null;
  if(!clientId||!clientSecret)throw new Error("Cloudflare Access service token is onvolledig: client-id en client-secret moeten samen zijn ingesteld.");
  return {clientId,clientSecret};
}

function accessHeaders(env=process.env){
  const token=serviceToken(env);
  if(!token)return {};
  return {
    "CF-Access-Client-Id":token.clientId,
    "CF-Access-Client-Secret":token.clientSecret
  };
}

function protectedPreviewUrl(input){
  try{
    const waarde=typeof input==="string"||input instanceof URL?String(input):String(input&&input.url||"");
    const url=new URL(waarde);
    return url.protocol==="https:"&&/(?:^|\.)watishetweer\.pages\.dev$/i.test(url.hostname);
  }catch{
    return false;
  }
}

function mergeHeaders(existing,headers){
  const merged=new Headers(existing||{});
  for(const [name,value] of Object.entries(headers))if(!merged.has(name))merged.set(name,value);
  return merged;
}

function installFetch(env=process.env){
  const headers=accessHeaders(env);
  if(!Object.keys(headers).length||typeof globalThis.fetch!=="function")return false;
  if(globalThis.fetch.__wiwCloudflareAccessPatched)return true;
  const nativeFetch=globalThis.fetch.bind(globalThis);
  const patched=async function(input,init={}){
    if(!protectedPreviewUrl(input))return nativeFetch(input,init);
    const inherited=init.headers||(typeof Request!=="undefined"&&input instanceof Request?input.headers:undefined);
    return nativeFetch(input,{...init,headers:mergeHeaders(inherited,headers)});
  };
  Object.defineProperty(patched,"__wiwCloudflareAccessPatched",{value:true});
  globalThis.fetch=patched;
  return true;
}

async function addPreviewRoute(context,headers){
  await context.route(/^https:\/\/(?:[a-z0-9-]+\.)?watishetweer\.pages\.dev(?:\/|$)/i,async route=>{
    const merged=mergeHeaders(route.request().headers(),headers);
    await route.fallback({headers:Object.fromEntries(merged.entries())});
  });
  return context;
}

function decorateBrowser(browser,headers){
  if(!browser||browser.__wiwCloudflareAccessPatched)return browser;
  const original=browser.newContext.bind(browser);
  browser.newContext=async(options={})=>addPreviewRoute(await original(options),headers);
  Object.defineProperty(browser,"__wiwCloudflareAccessPatched",{value:true});
  return browser;
}

function installPlaywright(env=process.env){
  const headers=accessHeaders(env);
  if(!Object.keys(headers).length)return false;
  let playwright;
  try{playwright=require("playwright");}catch{return false;}
  for(const name of ["chromium","firefox","webkit"]){
    const type=playwright[name];
    if(!type||type.__wiwCloudflareAccessPatched||typeof type.launch!=="function")continue;
    const launch=type.launch.bind(type);
    type.launch=async options=>decorateBrowser(await launch(options),headers);
    Object.defineProperty(type,"__wiwCloudflareAccessPatched",{value:true});
  }
  return true;
}

function install(env=process.env){
  serviceToken(env);
  installFetch(env);
  installPlaywright(env);
}

module.exports={serviceToken,accessHeaders,protectedPreviewUrl,mergeHeaders,installFetch,addPreviewRoute,decorateBrowser,installPlaywright,install};

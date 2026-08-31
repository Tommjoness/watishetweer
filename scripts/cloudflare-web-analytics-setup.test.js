"use strict";

const assert=require("assert");
const {RULE_REF,isSiteVoorZone,siteActief,activeerWebAnalytics}=require("./cloudflare-web-analytics-setup.js");

const ACCOUNT="a".repeat(32),ZONE="b".repeat(32),SITE="c".repeat(32),RULESET="d".repeat(32),RULE="e".repeat(32);
function response(body,status=200){return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)};}
function success(result,result_info){return {success:true,errors:[],messages:[],result,...(result_info?{result_info}:{})};}
function maakFetch({siteBestaat=false,blockBestaat=true,forbiddenRum=false}={}){
  const calls=[];
  let site=siteBestaat?{auto_install:false,ruleset:{enabled:false,zone_name:"watishetweer.nl",zone_tag:ZONE},site_tag:SITE,site_token:"tok",rules:[]}:null;
  let block=blockBestaat;
  const fetchImpl=async (url,opt={})=>{
    calls.push({url,method:opt.method||"GET",body:opt.body||null});
    if(url.endsWith("/pages/projects/watishetweer/domains"))return response(success([
      {name:"watishetweer.nl",zone_tag:ZONE},{name:"www.watishetweer.nl",zone_tag:ZONE}
    ]));
    if(url.includes("/rum/site_info/list")){
      if(forbiddenRum)return response({success:false,errors:[{message:"Forbidden"}]},403);
      return response(success(site?[site]:[],{page:1,per_page:100,total_pages:1,total_count:site?1:0}));
    }
    if(url.endsWith("/rum/site_info")&&opt.method==="POST"){
      site={auto_install:true,ruleset:{enabled:true,zone_name:"watishetweer.nl",zone_tag:ZONE},site_tag:SITE,site_token:"tok",rules:[]};
      return response(success(site));
    }
    if(url.endsWith(`/rum/site_info/${SITE}`)&&opt.method==="PUT"){
      site={...site,auto_install:true,ruleset:{...site.ruleset,enabled:true,zone_tag:ZONE}};
      return response(success(site));
    }
    if(url.endsWith(`/rum/site_info/${SITE}`)&&(!opt.method||opt.method==="GET"))return response(success(site));
    if(url.endsWith(`/zones/${ZONE}/rulesets`))return response(success([{id:RULESET,kind:"zone",phase:"http_config_settings"}]));
    if(url.endsWith(`/zones/${ZONE}/rulesets/${RULESET}`))return response(success({id:RULESET,rules:block?[{id:RULE,ref:RULE_REF,action:"set_config",action_parameters:{disable_rum:true}}]:[]}));
    if(url.endsWith(`/zones/${ZONE}/rulesets/${RULESET}/rules/${RULE}`)&&opt.method==="DELETE"){
      block=false;return response(success({id:RULESET,rules:[]}));
    }
    throw new Error(`Onverwachte fetch ${opt.method||"GET"} ${url}`);
  };
  return {fetchImpl,calls,getBlock:()=>block};
}

assert(isSiteVoorZone({ruleset:{zone_tag:ZONE}},ZONE));
assert(!isSiteVoorZone({ruleset:{zone_tag:"f".repeat(32)}},ZONE));
assert(siteActief({auto_install:true,ruleset:{enabled:true,zone_tag:ZONE}},ZONE));
assert(!siteActief({auto_install:false,ruleset:{enabled:true,zone_tag:ZONE}},ZONE));

(async()=>{
  {
    const mock=maakFetch({siteBestaat:false,blockBestaat:true});
    const uit=await activeerWebAnalytics({accountId:ACCOUNT,token:"token",fetchImpl:mock.fetchImpl});
    assert.equal(uit.site.gewijzigd,true,"ontbrekende analytics-site moet worden aangemaakt");
    assert.equal(uit.blokkade.gewijzigd,true,"eigen RUM-blokkade moet worden verwijderd");
    assert.equal(mock.getBlock(),false);
    assert(mock.calls.some(x=>x.method==="POST"&&x.url.endsWith("/rum/site_info")),"site-create ontbreekt");
    assert(mock.calls.some(x=>x.method==="DELETE"&&x.url.includes(`/rules/${RULE}`)),"DELETE van eigen blokkade ontbreekt");
  }
  {
    const mock=maakFetch({siteBestaat:true,blockBestaat:false});
    const uit=await activeerWebAnalytics({accountId:ACCOUNT,token:"token",fetchImpl:mock.fetchImpl});
    assert.equal(uit.site.gewijzigd,true,"bestaande uitgezette site moet worden geactiveerd");
    assert.equal(uit.blokkade.gewijzigd,false,"afwezige eigen blokkade moet noop zijn");
    assert(mock.calls.some(x=>x.method==="PUT"&&x.url.endsWith(`/rum/site_info/${SITE}`)),"site-update ontbreekt");
  }
  {
    const mock=maakFetch({forbiddenRum:true,blockBestaat:true});
    await assert.rejects(()=>activeerWebAnalytics({accountId:ACCOUNT,token:"token",fetchImpl:mock.fetchImpl}),/Account Settings Read\/Write/);
    assert.equal(mock.getBlock(),true,"bij RUM-permissiefout mag de oude blokkade niet worden verwijderd");
    assert(!mock.calls.some(x=>x.method==="DELETE"),"fail-safe pad mag geen rulesetregel verwijderen");
  }
  console.log("cloudflare-web-analytics-setup: create/update, idempotente blokkadeverwijdering en fail-safe permissiepad OK");
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});

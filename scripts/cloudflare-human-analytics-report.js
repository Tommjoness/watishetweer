"use strict";

const fs=require("node:fs");

const GRAPHQL_URL="https://api.cloudflare.com/client/v4/graphql";
const DOMAIN="watishetweer.nl";
const DEFAULT_WINDOWS=[1,7,30];

function geldigeAccountId(waarde){
  const id=String(waarde||"").trim();
  if(!/^[a-f0-9]{32}$/i.test(id))throw new Error("CLOUDFLARE_ACCOUNT_ID ontbreekt of is ongeldig.");
  return id;
}

function tokenKandidaten(env=process.env){
  const kandidaten=[
    ["dedicated-analytics",env.CLOUDFLARE_ANALYTICS_API_TOKEN],
    ["deploy-fallback",env.CLOUDFLARE_DEPLOY_API_TOKEN||env.CLOUDFLARE_API_TOKEN]
  ];
  const gezien=new Set();
  return kandidaten
    .map(([bron,token])=>({bron,token:String(token||"").trim()}))
    .filter(item=>item.token&&!gezien.has(item.token)&&(gezien.add(item.token),true));
}

function venstersUitOmgeving(waarde){
  const bron=String(waarde||"").trim();
  if(!bron)return [...DEFAULT_WINDOWS];
  const vensters=[...new Set(bron.split(",").map(x=>Number.parseInt(x.trim(),10)).filter(Number.isInteger))];
  if(!vensters.length||vensters.some(x=>x<1||x>30))throw new Error("CLOUDFLARE_ANALYTICS_WINDOWS moet unieke gehele dagen tussen 1 en 30 bevatten.");
  return vensters.sort((a,b)=>a-b);
}

function periode(dagen,nu=new Date()){
  if(!Number.isInteger(dagen)||dagen<1||dagen>30)throw new Error("Rapportperiode moet tussen 1 en 30 dagen liggen.");
  const einde=new Date(nu);
  if(!Number.isFinite(einde.getTime()))throw new Error("Ongeldige rapporttijd.");
  const start=new Date(einde.getTime()-(dagen*24*60*60*1000));
  return {start:start.toISOString(),einde:einde.toISOString()};
}

function gqlString(waarde){
  return JSON.stringify(String(waarde));
}

function bouwFilter({start,einde,bot}){
  const onderdelen=[
    `{datetime_geq:${gqlString(start)}}`,
    `{datetime_leq:${gqlString(einde)}}`,
    `{requestHost:${gqlString(DOMAIN)}}`
  ];
  if(bot===0||bot===1)onderdelen.push(`{bot:${bot}}`);
  return `{AND:[${onderdelen.join(",")}]}`;
}

function bouwQuery({accountId,start,einde}){
  const account=geldigeAccountId(accountId);
  const alles=bouwFilter({start,einde,bot:null});
  const mensen=bouwFilter({start,einde,bot:0});
  const bots=bouwFilter({start,einde,bot:1});
  return `query HumanTraffic { viewer { accounts(filter:{accountTag:${gqlString(account)}}) { allTraffic:rumPageloadEventsAdaptiveGroups(limit:1,filter:${alles}) { count sum { visits } avg { sampleInterval } } humanTraffic:rumPageloadEventsAdaptiveGroups(limit:1,filter:${mensen}) { count sum { visits } avg { sampleInterval } } botTraffic:rumPageloadEventsAdaptiveGroups(limit:1,filter:${bots}) { count sum { visits } avg { sampleInterval } } } } }`;
}

function foutUitGraphql(errors){
  if(!Array.isArray(errors)||!errors.length)return "";
  return errors.map(error=>String(error&&error.message||"onbekende GraphQL-fout")).join(" | ");
}

async function graphql({token,query,fetchImpl=fetch}){
  const bearer=String(token||"").trim();
  if(!bearer)throw new Error("Cloudflare Analytics-token ontbreekt.");
  const response=await fetchImpl(GRAPHQL_URL,{
    method:"POST",
    headers:{Authorization:`Bearer ${bearer}`,"Content-Type":"application/json"},
    body:JSON.stringify({query})
  });
  const tekst=await response.text();
  let body=null;
  try{body=tekst?JSON.parse(tekst):null;}catch{}
  if(!response.ok)throw new Error(`Cloudflare GraphQL faalde met HTTP ${response.status}.`);
  if(!body)throw new Error("Cloudflare GraphQL gaf geen geldige JSON terug.");
  const graphqlFout=foutUitGraphql(body.errors);
  if(graphqlFout)throw new Error(`Cloudflare GraphQL-fout: ${graphqlFout}`);
  return body.data;
}

function getal(waarde,standaard=0){
  const n=Number(waarde);
  return Number.isFinite(n)?n:standaard;
}

function leesAggregate(waarde){
  if(!Array.isArray(waarde))throw new Error("Cloudflare RUM-aggregate ontbreekt.");
  if(waarde.length===0)return {pageviews:0,visits:0,sampleInterval:1};
  if(waarde.length!==1)throw new Error(`Cloudflare RUM gaf onverwacht ${waarde.length} totalen terug.`);
  const rij=waarde[0]||{};
  return {
    pageviews:getal(rij.count),
    visits:getal(rij.sum&&rij.sum.visits),
    sampleInterval:getal(rij.avg&&rij.avg.sampleInterval,1)
  };
}

async function haalVenster({accountId,token,dagen,nu=new Date(),fetchImpl=fetch}){
  const {start,einde}=periode(dagen,nu);
  const data=await graphql({token,query:bouwQuery({accountId,start,einde}),fetchImpl});
  const accounts=data&&data.viewer&&data.viewer.accounts;
  if(!Array.isArray(accounts)||accounts.length!==1)throw new Error("Cloudflare GraphQL gaf niet exact één account terug.");
  const account=accounts[0]||{};
  const alles=leesAggregate(account.allTraffic);
  const mensen=leesAggregate(account.humanTraffic);
  const bots=leesAggregate(account.botTraffic);
  const basis=mensen.pageviews+bots.pageviews;
  return {
    dagen,
    start,
    einde,
    human:{...mensen},
    bots:{...bots},
    all:{...alles},
    botPageviewShare:basis>0?bots.pageviews/basis:0
  };
}

async function haalRapport({accountId,token,vensters=DEFAULT_WINDOWS,nu=new Date(),fetchImpl=fetch}){
  const account=geldigeAccountId(accountId);
  const resultaten=[];
  for(const dagen of vensters)resultaten.push(await haalVenster({accountId:account,token,dagen,nu,fetchImpl}));
  return {bron:"Cloudflare Web Analytics RUM",host:DOMAIN,botFilter:"bot: 0",gegenereerd:nu.toISOString(),vensters:resultaten};
}

function formatGetal(waarde){
  return new Intl.NumberFormat("nl-NL",{maximumFractionDigits:0}).format(getal(waarde));
}

function formatPercentage(waarde){
  return new Intl.NumberFormat("nl-NL",{style:"percent",maximumFractionDigits:1}).format(getal(waarde));
}

function labelVoorDagen(dagen){
  return dagen===1?"24 uur":`${dagen} dagen`;
}

function rapportMarkdown(rapport,tokenBron){
  const regels=[
    "## Cloudflare bot-gefilterd verkeer",
    "",
    `- host: \`${rapport.host}\``,
    `- dataset: ${rapport.bron}`,
    "- menselijke classificatie: `bot: 0`",
    `- tokensource: ${tokenBron}`,
    `- gegenereerd: ${rapport.gegenereerd}`,
    "",
    "| Periode | Menselijke visits | Menselijke pageviews | Bot-pageviews uitgesloten | Bot-aandeel pageviews | Sample interval mens |",
    "| --- | ---: | ---: | ---: | ---: | ---: |"
  ];
  for(const venster of rapport.vensters){
    regels.push(`| ${labelVoorDagen(venster.dagen)} | ${formatGetal(venster.human.visits)} | ${formatGetal(venster.human.pageviews)} | ${formatGetal(venster.bots.pageviews)} | ${formatPercentage(venster.botPageviewShare)} | ${venster.human.sampleInterval} |`);
  }
  regels.push("","> `Visits` zijn Cloudflare-visits/sessies, geen unieke personen. Pageviews en visits komen uit browser-RUM; `bot: 0` sluit verkeer uit dat Cloudflare als bot classificeert.","");
  return regels.join("\n");
}

async function main(){
  const accountId=geldigeAccountId(process.env.CLOUDFLARE_ACCOUNT_ID);
  const vensters=venstersUitOmgeving(process.env.CLOUDFLARE_ANALYTICS_WINDOWS);
  const kandidaten=tokenKandidaten();
  if(!kandidaten.length)throw new Error("Geen Cloudflare-token beschikbaar voor het analyticsrapport.");

  const fouten=[];
  for(const kandidaat of kandidaten){
    try{
      const rapport=await haalRapport({accountId,token:kandidaat.token,vensters});
      const markdown=rapportMarkdown(rapport,kandidaat.bron);
      console.log(JSON.stringify({...rapport,tokenBron:kandidaat.bron},null,2));
      if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`${markdown}\n`);
      return rapport;
    }catch(error){
      fouten.push(`${kandidaat.bron}: ${String(error&&error.message||error)}`);
    }
  }
  throw new Error(`Geen beschikbare Cloudflare-token kon RUM Analytics lezen. ${fouten.join(" || ")}`);
}

if(require.main===module){
  main().catch(error=>{
    console.error(error&&error.stack||error);
    process.exit(1);
  });
}

module.exports={
  GRAPHQL_URL,DOMAIN,DEFAULT_WINDOWS,geldigeAccountId,tokenKandidaten,venstersUitOmgeving,periode,
  gqlString,bouwFilter,bouwQuery,foutUitGraphql,graphql,leesAggregate,haalVenster,haalRapport,
  rapportMarkdown,labelVoorDagen
};

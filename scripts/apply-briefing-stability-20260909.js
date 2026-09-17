"use strict";

const fs=require("fs"),path=require("path");
const {vernieuwServiceworkerCache}=require("./postbuild-cache.js");

const OUT=path.join(__dirname,"..","public");
const MARKER="/* ===== BRIEFING STABIELE EERSTE RENDER 20260909 ===== */";
const KNMI_MARKER="/* ===== BRIEFING KNMI EERSTE RENDER 20260917 ===== */";
const Q1_OWNER="let cacheRenderGeneratie=0;";
const CACHE_BRIEF_OUD='  if(typeof themaToepassen==="function")themaToepassen();\n  if(typeof minibarBij==="function")minibarBij();\n  if(typeof briefing==="function")briefing();';
const CACHE_BRIEF_NIEUW=`  if(typeof themaToepassen==="function")themaToepassen();
  if(typeof minibarBij==="function")minibarBij();
  ${MARKER}
  const briefEl=document.getElementById("brief");
  if(briefEl){
    briefEl.style.visibility="hidden";
    briefEl.setAttribute("aria-hidden","true");
    briefEl.setAttribute("aria-busy","true");
    briefEl.setAttribute("data-q1-briefing-pending",String(cacheRenderGeneratie));
  }
  if(typeof briefing==="function")briefing();`;
const LOAD_START_OUD='    const generatie=++cacheRenderGeneratie;\n    const start=nuMs(),sleutel=cacheSleutel(lat,lon),cache=sleutel?leesCache()[sleutel]:null;';
const LOAD_START_NIEUW=`    const generatie=++cacheRenderGeneratie;
    const bestaandBriefEl=document.getElementById("brief");
    if(bestaandBriefEl&&bestaandBriefEl.hasAttribute("data-q1-briefing-pending")){
      bestaandBriefEl.setAttribute("data-q1-briefing-pending",String(generatie));
    }
    const start=nuMs(),sleutel=cacheSleutel(lat,lon),cache=sleutel?leesCache()[sleutel]:null;`;
const LOAD_EIND_OUD='    const resultaat=await basisLoad(lat,lon,label,cacheGetoond?true:stil,opslaan,land);\n    perf.lastNetworkMs=Math.max(0,nuMs()-start);';
const LOAD_EIND_NIEUW=`    const resultaat=await basisLoad(lat,lon,label,cacheGetoond?true:stil,opslaan,land);
    if(generatie===cacheRenderGeneratie){
      const briefEl=document.getElementById("brief");
      if(briefEl&&briefEl.getAttribute("data-q1-briefing-pending")===String(generatie)){
        briefEl.removeAttribute("data-q1-briefing-pending");
        if(!briefEl.hasAttribute("data-knmi-briefing-pending")){
          briefEl.style.visibility="";
          briefEl.removeAttribute("aria-hidden");
          briefEl.removeAttribute("aria-busy");
        }
      }
    }
    perf.lastNetworkMs=Math.max(0,nuMs()-start);`;

const KNMI_STATE_OUD='let knmiGeneratie=0,knmiController=null,knmiTimer=null,laatsteKnmiSleutel="";';
const KNMI_STATE_NIEUW=`let knmiGeneratie=0,knmiController=null,knmiTimer=null,laatsteKnmiSleutel="";
${KNMI_MARKER}
let knmiBriefingData=null,knmiBriefingToken=0;
function knmiBriefingBegin(data){
  if(!data||knmiBriefingData===data)return null;
  const token=String(++knmiBriefingToken),el=document.getElementById("brief");
  if(el){
    el.style.visibility="hidden";
    el.setAttribute("aria-hidden","true");
    el.setAttribute("aria-busy","true");
    el.setAttribute("data-knmi-briefing-pending",token);
  }
  return token;
}
function knmiBriefingEinde(data,token){
  if(data)knmiBriefingData=data;
  const el=document.getElementById("brief");
  if(!el||!token||el.getAttribute("data-knmi-briefing-pending")!==String(token))return;
  el.removeAttribute("data-knmi-briefing-pending");
  if(!el.hasAttribute("data-q1-briefing-pending")){
    el.style.visibility="";
    el.removeAttribute("aria-hidden");
    el.removeAttribute("aria-busy");
  }
}`;
const KNMI_REQUEST_OUD=`  const sleutel=Number(lat).toFixed(4)+","+Number(lon).toFixed(4);
  if(!force&&sleutel===laatsteKnmiSleutel&&S.d&&S.d.__knmiNeerslag)return;
  laatsteKnmiSleutel=sleutel;`;
const KNMI_REQUEST_NIEUW=`  const sleutel=Number(lat).toFixed(4)+","+Number(lon).toFixed(4);
  if(!force&&sleutel===laatsteKnmiSleutel&&S.d&&S.d.__knmiNeerslag)return;
  const dataBijStart=S.d,briefingToken=knmiBriefingBegin(dataBijStart);
  laatsteKnmiSleutel=sleutel;`;
const KNMI_FINALLY_OUD=`  }catch(e){}finally{
    if(knmiController===controller)knmiController=null;
    if(gen===knmiGeneratie&&S.land==="NL")planKnmiVerversing(gen,planPayload);
  }
}`;
const KNMI_FINALLY_NIEUW=`  }catch(e){}finally{
    if(knmiController===controller)knmiController=null;
    knmiBriefingEinde(dataBijStart,briefingToken);
    if(gen===knmiGeneratie&&S.land==="NL")planKnmiVerversing(gen,planPayload);
  }
}`;

function exactEen(bron,oud,nieuw,label){
  const n=String(bron).split(oud).length-1;
  if(n!==1)throw new Error(`${label}: verwacht exact één anker, gevonden ${n}.`);
  return String(bron).replace(oud,nieuw);
}

function pasHtmlToe(html){
  let bron=String(html||"");
  if(!bron.includes(Q1_OWNER))return bron;
  if(bron.includes(MARKER)||bron.includes(KNMI_MARKER))throw new Error("Briefing-stability staat al in artifact.");
  bron=exactEen(bron,CACHE_BRIEF_OUD,CACHE_BRIEF_NIEUW,"cache-briefing");
  bron=exactEen(bron,LOAD_START_OUD,LOAD_START_NIEUW,"cache-load-start");
  bron=exactEen(bron,LOAD_EIND_OUD,LOAD_EIND_NIEUW,"cache-load-einde");
  bron=exactEen(bron,KNMI_STATE_OUD,KNMI_STATE_NIEUW,"knmi-briefing-state");
  bron=exactEen(bron,KNMI_REQUEST_OUD,KNMI_REQUEST_NIEUW,"knmi-briefing-start");
  bron=exactEen(bron,KNMI_FINALLY_OUD,KNMI_FINALLY_NIEUW,"knmi-briefing-einde");
  return bron;
}

function htmlBestanden(dir){
  const uit=[];
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory())uit.push(...htmlBestanden(p));
    else if(e.isFile()&&e.name.endsWith(".html"))uit.push(p);
  }
  return uit;
}

function main(){
  let n=0;
  for(const p of htmlBestanden(OUT)){
    const oud=fs.readFileSync(p,"utf8"),nieuw=pasHtmlToe(oud);
    if(nieuw===oud)continue;
    fs.writeFileSync(p,nieuw,"utf8");n++;
  }
  if(!n)throw new Error("Geen Q1-weerartifacts gevonden voor briefing-stability.");
  const cache=vernieuwServiceworkerCache(OUT,"briefing-stability-20260917");
  console.log(`Briefing-stability toegepast op ${n} weerpagina's: cachepaint en eerste KNMI-verrijking blijven visueel voorlopig; cache ${cache}.`);
}

if(require.main===module)main();
module.exports={OUT,MARKER,KNMI_MARKER,Q1_OWNER,CACHE_BRIEF_OUD,CACHE_BRIEF_NIEUW,LOAD_START_OUD,LOAD_START_NIEUW,LOAD_EIND_OUD,LOAD_EIND_NIEUW,KNMI_STATE_OUD,KNMI_STATE_NIEUW,KNMI_REQUEST_OUD,KNMI_REQUEST_NIEUW,KNMI_FINALLY_OUD,KNMI_FINALLY_NIEUW,exactEen,pasHtmlToe,htmlBestanden,main};

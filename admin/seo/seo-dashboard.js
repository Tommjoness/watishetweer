"use strict";

const els={
  status:document.getElementById("status"),
  range:document.getElementById("range"),
  refresh:document.getElementById("refresh"),
  clicks:document.getElementById("kpi-clicks"),
  impressions:document.getElementById("kpi-impressions"),
  ctr:document.getElementById("kpi-ctr"),
  position:document.getElementById("kpi-position"),
  deltaClicks:document.getElementById("delta-clicks"),
  deltaImpressions:document.getElementById("delta-impressions"),
  deltaCtr:document.getElementById("delta-ctr"),
  deltaPosition:document.getElementById("delta-position"),
  opportunities:document.getElementById("opportunities"),
  queries:document.getElementById("queries"),
  pages:document.getElementById("pages"),
  devices:document.getElementById("devices"),
  countries:document.getElementById("countries"),
  ga4Badge:document.getElementById("ga4-badge"),
  ga4Content:document.getElementById("ga4-content"),
  generated:document.getElementById("generated")
};

const number=new Intl.NumberFormat("nl-NL");
const decimal=new Intl.NumberFormat("nl-NL",{maximumFractionDigits:1});
const percent=new Intl.NumberFormat("nl-NL",{style:"percent",maximumFractionDigits:2});
const regionNames=typeof Intl.DisplayNames==="function"?new Intl.DisplayNames(["nl"],{type:"region"}):null;
const deviceLabels={MOBILE:"Mobiel",DESKTOP:"Desktop",TABLET:"Tablet"};
const countryAlpha3ToAlpha2={ABW:"AW",AFG:"AF",AGO:"AO",AIA:"AI",ALA:"AX",ALB:"AL",AND:"AD",ARE:"AE",ARG:"AR",ARM:"AM",ASM:"AS",ATA:"AQ",ATF:"TF",ATG:"AG",AUS:"AU",AUT:"AT",AZE:"AZ",BDI:"BI",BEL:"BE",BEN:"BJ",BES:"BQ",BFA:"BF",BGD:"BD",BGR:"BG",BHR:"BH",BHS:"BS",BIH:"BA",BLM:"BL",BLR:"BY",BLZ:"BZ",BMU:"BM",BOL:"BO",BRA:"BR",BRB:"BB",BRN:"BN",BTN:"BT",BVT:"BV",BWA:"BW",CAF:"CF",CAN:"CA",CCK:"CC",CHE:"CH",CHL:"CL",CHN:"CN",CIV:"CI",CMR:"CM",COD:"CD",COG:"CG",COK:"CK",COL:"CO",COM:"KM",CPV:"CV",CRI:"CR",CUB:"CU",CUW:"CW",CXR:"CX",CYM:"KY",CYP:"CY",CZE:"CZ",DEU:"DE",DJI:"DJ",DMA:"DM",DNK:"DK",DOM:"DO",DZA:"DZ",ECU:"EC",EGY:"EG",ERI:"ER",ESH:"EH",ESP:"ES",EST:"EE",ETH:"ET",FIN:"FI",FJI:"FJ",FLK:"FK",FRA:"FR",FRO:"FO",FSM:"FM",GAB:"GA",GBR:"GB",GEO:"GE",GGY:"GG",GHA:"GH",GIB:"GI",GIN:"GN",GLP:"GP",GMB:"GM",GNB:"GW",GNQ:"GQ",GRC:"GR",GRD:"GD",GRL:"GL",GTM:"GT",GUF:"GF",GUM:"GU",GUY:"GY",HKG:"HK",HMD:"HM",HND:"HN",HRV:"HR",HTI:"HT",HUN:"HU",IDN:"ID",IMN:"IM",IND:"IN",IOT:"IO",IRL:"IE",IRN:"IR",IRQ:"IQ",ISL:"IS",ISR:"IL",ITA:"IT",JAM:"JM",JEY:"JE",JOR:"JO",JPN:"JP",KAZ:"KZ",KEN:"KE",KGZ:"KG",KHM:"KH",KIR:"KI",KNA:"KN",KOR:"KR",KWT:"KW",LAO:"LA",LBN:"LB",LBR:"LR",LBY:"LY",LCA:"LC",LIE:"LI",LKA:"LK",LSO:"LS",LTU:"LT",LUX:"LU",LVA:"LV",MAC:"MO",MAF:"MF",MAR:"MA",MCO:"MC",MDA:"MD",MDG:"MG",MDV:"MV",MEX:"MX",MHL:"MH",MKD:"MK",MLI:"ML",MLT:"MT",MMR:"MM",MNE:"ME",MNG:"MN",MNP:"MP",MOZ:"MZ",MRT:"MR",MSR:"MS",MTQ:"MQ",MUS:"MU",MWI:"MW",MYS:"MY",MYT:"YT",NAM:"NA",NCL:"NC",NER:"NE",NFK:"NF",NGA:"NG",NIC:"NI",NIU:"NU",NLD:"NL",NOR:"NO",NPL:"NP",NRU:"NR",NZL:"NZ",OMN:"OM",PAK:"PK",PAN:"PA",PCN:"PN",PER:"PE",PHL:"PH",PLW:"PW",PNG:"PG",POL:"PL",PRI:"PR",PRK:"KP",PRT:"PT",PRY:"PY",PSE:"PS",PYF:"PF",QAT:"QA",REU:"RE",ROU:"RO",RUS:"RU",RWA:"RW",SAU:"SA",SDN:"SD",SEN:"SN",SGP:"SG",SGS:"GS",SHN:"SH",SJM:"SJ",SLB:"SB",SLE:"SL",SLV:"SV",SMR:"SM",SOM:"SO",SPM:"PM",SRB:"RS",SSD:"SS",STP:"ST",SUR:"SR",SVK:"SK",SVN:"SI",SWE:"SE",SWZ:"SZ",SXM:"SX",SYC:"SC",SYR:"SY",TCA:"TC",TCD:"TD",TGO:"TG",THA:"TH",TJK:"TJ",TKL:"TK",TKM:"TM",TLS:"TL",TON:"TO",TTO:"TT",TUN:"TN",TUR:"TR",TUV:"TV",TWN:"TW",TZA:"TZ",UGA:"UG",UKR:"UA",UMI:"UM",URY:"UY",USA:"US",UZB:"UZ",VAT:"VA",VCT:"VC",VEN:"VE",VGB:"VG",VIR:"VI",VNM:"VN",VUT:"VU",WLF:"WF",WSM:"WS",YEM:"YE",ZAF:"ZA",ZMB:"ZM",ZWE:"ZW"};

const sortState={
  opportunities:{key:"priority",direction:"desc"},
  queries:{key:"impressions",direction:"desc"},
  pages:{key:"impressions",direction:"desc"}
};
let currentSearchConsole=null;

function escapeHtml(value){
  return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
}

function formatDelta(value,{invert=false,points=false}={}){
  if(value===null||value===undefined||Number.isNaN(value))return {text:"Nog onvoldoende historische data",className:""};
  const favorable=invert?value<0:value>0;
  const unfavorable=invert?value>0:value<0;
  const magnitude=points?`${value>0?"+":""}${decimal.format(value)} pos.`:`${value>0?"+":""}${percent.format(value)}`;
  return {text:`${magnitude} vs vorige periode`,className:favorable?"good":unfavorable?"bad":""};
}

function setDelta(element,delta,options){
  const formatted=formatDelta(delta,options);
  element.textContent=formatted.text;
  element.className=formatted.className;
}

function classifyOpportunity(item){
  const impressions=Number(item.impressions)||0;
  const ctr=Number(item.ctr)||0;
  const position=Number(item.position)||0;
  if(impressions>=10&&position>=8&&position<=15)return {...item,opportunityType:"near",opportunityLabel:"Bijna pagina 1",priority:3};
  if(impressions>=25&&position>=4&&position<=20&&ctr<0.01)return {...item,opportunityType:"ctr",opportunityLabel:"CTR-kans",priority:2};
  if(impressions>=25&&position>15&&position<=40)return {...item,opportunityType:"visibility",opportunityLabel:"Veel zichtbaarheid",priority:1};
  return null;
}

function buildOpportunities(sc){
  const seen=new Set();
  const combined=[...(sc.topQueries||[]),...(sc.opportunities||[])];
  return combined
    .filter(item=>{
      const key=String(item.query||"").trim().toLowerCase();
      if(!key||seen.has(key))return false;
      seen.add(key);
      return true;
    })
    .map(classifyOpportunity)
    .filter(Boolean)
    .sort((a,b)=>b.priority-a.priority||b.impressions-a.impressions||a.position-b.position)
    .slice(0,12);
}

function sortRows(table,rows){
  const state=sortState[table];
  if(!state)return [...rows];
  const direction=state.direction==="asc"?1:-1;
  return [...rows].sort((a,b)=>{
    const av=a[state.key];
    const bv=b[state.key];
    if(typeof av==="number"||typeof bv==="number")return ((Number(av)||0)-(Number(bv)||0))*direction;
    return String(av??"").localeCompare(String(bv??""),"nl",{numeric:true,sensitivity:"base"})*direction;
  });
}

function queryRow(item){
  return `<tr><td>${escapeHtml(item.query)}</td><td>${number.format(item.impressions)}</td><td>${number.format(item.clicks)}</td><td>${decimal.format(item.position)}</td></tr>`;
}

function opportunityRow(item){
  return `<tr><td>${escapeHtml(item.query)}</td><td><span class="opportunity-badge ${escapeHtml(item.opportunityType)}">${escapeHtml(item.opportunityLabel)}</span></td><td>${number.format(item.impressions)}</td><td>${number.format(item.clicks)}</td><td>${percent.format(item.ctr)}</td><td>${decimal.format(item.position)}</td></tr>`;
}

function pageLink(item){
  try{
    const url=new URL(item.page);
    if(url.protocol!=="https:"||!["watishetweer.nl","www.watishetweer.nl"].includes(url.hostname))return null;
    return `https://watishetweer.nl${url.pathname||"/"}`;
  }catch{return null;}
}

function pageRow(item){
  let label=item.page;
  try{const url=new URL(item.page);label=url.pathname||"/";}catch{}
  const href=pageLink(item);
  const pageCell=href?`<a class="page-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="Open ${escapeHtml(label)} op watishetweer.nl">${escapeHtml(label)}</a>`:escapeHtml(label);
  return `<tr><td title="${escapeHtml(item.page)}">${pageCell}</td><td>${number.format(item.impressions)}</td><td>${number.format(item.clicks)}</td><td>${decimal.format(item.position)}</td></tr>`;
}

function emptyRow(colspan,message){
  return `<tr><td colspan="${colspan}">${escapeHtml(message)}</td></tr>`;
}

function splitLabel(key,value){
  const code=String(value??"").trim().toUpperCase();
  if(key==="device")return deviceLabels[code]||code;
  if(key==="country"){
    const alpha2=countryAlpha3ToAlpha2[code]||code;
    if(regionNames&&/^[A-Z]{2}$/.test(alpha2)){
      try{return regionNames.of(alpha2)||code;}catch{}
    }
  }
  return code;
}

function renderSplit(target,rows,key,totalImpressions){
  if(!rows.length){target.innerHTML='<p class="muted">Geen data in deze periode.</p>';return;}
  const total=Number(totalImpressions)||0;
  target.innerHTML=rows.map(item=>{
    const raw=String(item[key]??"").trim().toUpperCase();
    const label=splitLabel(key,raw);
    const title=key==="country"&&label!==raw?` title="${escapeHtml(raw)}"`:"";
    const share=total>0?(Number(item.impressions)||0)/total:0;
    return `<div class="split-row"><strong${title}>${escapeHtml(label)}</strong><span>${number.format(item.impressions)} imp. · ${percent.format(share)}</span><span>${number.format(item.clicks)} klikken</span></div>`;
  }).join("");
}

function renderTables(sc){
  const opportunities=sortRows("opportunities",buildOpportunities(sc));
  const queries=sortRows("queries",sc.topQueries||[]);
  const pages=sortRows("pages",sc.topPages||[]);
  els.opportunities.innerHTML=opportunities.length?opportunities.map(opportunityRow).join(""):emptyRow(6,"Nog geen duidelijke kansen volgens deze selectie.");
  els.queries.innerHTML=queries.length?queries.map(queryRow).join(""):emptyRow(4,"Geen zoektermdata.");
  els.pages.innerHTML=pages.length?pages.map(pageRow).join(""):emptyRow(4,"Geen paginadata.");
  updateSortButtons();
}

function updateSortButtons(){
  document.querySelectorAll("[data-sort-table][data-sort-key]").forEach(button=>{
    const state=sortState[button.dataset.sortTable];
    const active=Boolean(state&&state.key===button.dataset.sortKey);
    button.dataset.active=active?"true":"false";
    button.setAttribute("aria-pressed",active?"true":"false");
    const indicator=button.querySelector(".sort-indicator");
    if(indicator)indicator.textContent=active?(state.direction==="asc"?"↑":"↓"):"";
  });
}

function renderGa4(ga4){
  if(!ga4||!ga4.configured){
    els.ga4Badge.textContent="Nog niet gekoppeld";
    els.ga4Badge.className="badge warn";
    els.ga4Content.textContent=ga4&&ga4.reason?ga4.reason:"GA4 is nog niet geconfigureerd.";
    return;
  }
  if(ga4.error){
    els.ga4Badge.textContent="Configuratie controleren";
    els.ga4Badge.className="badge warn";
    els.ga4Content.textContent=ga4.error;
    return;
  }
  const s=ga4.summary||{};
  els.ga4Badge.textContent="Gekoppeld";
  els.ga4Badge.className="badge ok";
  els.ga4Content.innerHTML=`<div class="ga4-kpis">
    <div class="ga4-mini"><span>Sessies</span><strong>${number.format(s.sessions||0)}</strong></div>
    <div class="ga4-mini"><span>Actieve gebruikers</span><strong>${number.format(s.activeUsers||0)}</strong></div>
    <div class="ga4-mini"><span>Pageviews</span><strong>${number.format(s.screenPageViews||0)}</strong></div>
    <div class="ga4-mini"><span>Engagement</span><strong>${percent.format(s.engagementRate||0)}</strong></div>
    <div class="ga4-mini"><span>Bounce</span><strong>${percent.format(s.bounceRate||0)}</strong></div>
  </div>`;
}

function render(data){
  const sc=data.searchConsole;
  const s=sc.summary;
  currentSearchConsole=sc;
  els.clicks.textContent=number.format(s.clicks);
  els.impressions.textContent=number.format(s.impressions);
  els.ctr.textContent=percent.format(s.ctr);
  els.position.textContent=decimal.format(s.position);
  setDelta(els.deltaClicks,s.change.clicks);
  setDelta(els.deltaImpressions,s.change.impressions);
  setDelta(els.deltaCtr,s.change.ctr);
  setDelta(els.deltaPosition,s.change.position,{invert:true,points:true});

  renderTables(sc);
  renderSplit(els.devices,sc.devices||[],"device",s.impressions);
  renderSplit(els.countries,sc.countries||[],"country",s.impressions);
  renderGa4(data.ga4);

  const generated=new Date(data.generatedAt);
  els.generated.textContent=`Bijgewerkt ${generated.toLocaleString("nl-NL")} · GSC t/m ${data.range.current.endDate} · 3 dagen vertraging voor stabiele data`;
  els.status.className="status";
  els.status.textContent=`${sc.siteUrl} · ${data.range.current.startDate} t/m ${data.range.current.endDate}`;
}

async function load(){
  els.refresh.disabled=true;
  els.status.className="status";
  els.status.textContent="Data laden…";
  try{
    const days=encodeURIComponent(els.range.value);
    const response=await fetch(`/api/admin/seo?days=${days}`,{headers:{Accept:"application/json"},cache:"no-store"});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.message||`SEO-data kon niet worden geladen (${response.status}).`);
    render(payload);
  }catch(error){
    els.status.className="status error";
    els.status.textContent=error instanceof Error?error.message:"SEO-data kon niet worden geladen.";
  }finally{
    els.refresh.disabled=false;
  }
}

els.refresh.addEventListener("click",load);
els.range.addEventListener("change",load);
document.addEventListener("click",event=>{
  const button=event.target.closest("[data-sort-table][data-sort-key]");
  if(!button||!currentSearchConsole)return;
  const table=button.dataset.sortTable;
  const key=button.dataset.sortKey;
  const state=sortState[table];
  if(!state)return;
  if(state.key===key)state.direction=state.direction==="asc"?"desc":"asc";
  else{
    state.key=key;
    state.direction=key==="query"||key==="page"?"asc":"desc";
  }
  renderTables(currentSearchConsole);
});

load();

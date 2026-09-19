"use strict";

const cfEls={
  badge:document.getElementById("cloudflare-badge"),
  content:document.getElementById("cloudflare-content"),
  refresh:document.getElementById("refresh"),
  range:document.getElementById("range")
};

const cfNumber=new Intl.NumberFormat("nl-NL");
const cfDecimal=new Intl.NumberFormat("nl-NL",{maximumFractionDigits:1});
const cfPercent=new Intl.NumberFormat("nl-NL",{style:"percent",maximumFractionDigits:1});

function cfEscape(value){
  return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
}

function cfPeriodLabel(days){
  return Number(days)===1?"Laatste 24 uur":`Laatste ${cfNumber.format(days)} dagen`;
}

function cfSampleLabel(value){
  const interval=Number(value)||1;
  if(interval<=1.5)return {text:"Vrijwel volledig",className:"ok"};
  return {text:`Gesampled ×${cfDecimal.format(interval)}`,className:"warn"};
}

function cfWindowCard(item){
  const human=item&&item.human||{};
  const bots=item&&item.bots||{};
  const share=Math.max(0,Math.min(1,Number(item&&item.botPageviewShare)||0));
  const humanShare=1-share;
  const sample=cfSampleLabel(human.sampleInterval);
  return `<article class="cf-period-card">
    <div class="cf-period-head">
      <div><span class="cf-period-label">${cfEscape(cfPeriodLabel(item.days))}</span><strong>${cfNumber.format(human.visits||0)}</strong><small>bot-gefilterde visits</small></div>
      <span class="cf-sample ${sample.className}">${cfEscape(sample.text)}</span>
    </div>
    <div class="cf-metrics">
      <div><span>Pageviews</span><strong>${cfNumber.format(human.pageviews||0)}</strong></div>
      <div><span>Bot-pageviews</span><strong>${cfNumber.format(bots.pageviews||0)}</strong></div>
      <div><span>Bot-aandeel</span><strong>${cfPercent.format(share)}</strong></div>
    </div>
    <div class="cf-share" role="img" aria-label="${cfPercent.format(humanShare)} bot-gefilterd verkeer en ${cfPercent.format(share)} botverkeer op basis van pageviews">
      <span class="cf-share-human" style="width:${(humanShare*100).toFixed(3)}%"></span>
      <span class="cf-share-bot" style="width:${(share*100).toFixed(3)}%"></span>
    </div>
    <div class="cf-share-labels"><span>${cfPercent.format(humanShare)} niet als bot</span><span>${cfPercent.format(share)} bot</span></div>
  </article>`;
}

function renderCloudflare(data){
  if(!cfEls.badge||!cfEls.content)return;
  if(!data||!data.configured){
    cfEls.badge.textContent="Nog niet gekoppeld";
    cfEls.badge.className="badge warn";
    cfEls.content.innerHTML=`<p class="cf-message">${cfEscape(data&&data.reason?data.reason:"Cloudflare Analytics is nog niet geconfigureerd.")}</p>`;
    return;
  }
  if(data.error){
    cfEls.badge.textContent="Controleer koppeling";
    cfEls.badge.className="badge warn";
    cfEls.content.innerHTML=`<p class="cf-message">${cfEscape(data.error)}</p>`;
    return;
  }

  const windows=Array.isArray(data.windows)?data.windows:[];
  cfEls.badge.textContent="Live";
  cfEls.badge.className="badge ok";
  const generated=data.generatedAt?new Date(data.generatedAt):null;
  const updated=generated&&!Number.isNaN(generated.getTime())?generated.toLocaleString("nl-NL"):"onbekend";
  cfEls.content.innerHTML=`
    <div class="cf-period-grid">${windows.map(cfWindowCard).join("")}</div>
    <div class="cf-footnote">
      <span>Bijgewerkt ${cfEscape(updated)}</span>
      <span><code>bot: 0</code> = door Cloudflare niet als bot geclassificeerd. Visits zijn bezoeken/sessies, geen unieke personen.</span>
    </div>`;
}

async function loadCloudflare(){
  if(!cfEls.badge||!cfEls.content)return;
  cfEls.badge.textContent="Laden…";
  cfEls.badge.className="badge";
  try{
    const scope=encodeURIComponent(cfEls.range&&cfEls.range.value||"28");
    const response=await fetch(`/api/admin/seo/cloudflare?scope=${scope}`,{headers:{Accept:"application/json"},cache:"no-store"});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.message||`Cloudflare-data kon niet worden geladen (${response.status}).`);
    renderCloudflare(payload);
  }catch(error){
    cfEls.badge.textContent="Niet beschikbaar";
    cfEls.badge.className="badge warn";
    cfEls.content.innerHTML=`<p class="cf-message">${cfEscape(error instanceof Error?error.message:"Cloudflare-data kon niet worden geladen.")}</p>`;
  }
}

if(cfEls.refresh)cfEls.refresh.addEventListener("click",loadCloudflare);
if(cfEls.range)cfEls.range.addEventListener("change",loadCloudflare);
loadCloudflare();

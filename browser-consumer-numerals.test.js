"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const {chromium,webkit}=require("playwright");

const html=fs.readFileSync(path.join(__dirname,"public","index.html"),"utf8");
const css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join("\n");
if(!css)throw new Error("Geen finale CSS gevonden voor consumentencijfercontrole.");

async function controleer(type,naam){
  const browser=await type.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>
      <div class="stat"><div class="sval" id="metric">1017</div></div>
      <div class="score" id="score">0/10</div>
      <div class="perc" id="percent">100%</div>
    </body></html>`);
    const resultaat=await page.evaluate(()=>Object.fromEntries(["metric","score","percent"].map(id=>{
      const cs=getComputedStyle(document.getElementById(id));
      return [id,{family:cs.fontFamily,variant:cs.fontVariantNumeric,features:cs.fontFeatureSettings}];
    })));
    for(const [id,stijl] of Object.entries(resultaat)){
      assert(/Instrument Sans/i.test(stijl.family),`${naam} ${id}: consumentencijfer gebruikt niet Instrument Sans (${stijl.family})`);
      assert(!/DM Mono/i.test(stijl.family),`${naam} ${id}: consumentencijfer valt nog terug op DM Mono (${stijl.family})`);
      assert(/tabular-nums/i.test(stijl.variant)||/tnum/i.test(stijl.features),`${naam} ${id}: tabular-nums ontbreekt (${stijl.variant}; ${stijl.features})`);
      assert(!/slashed-zero/i.test(stijl.variant)&&!/["']?zero["']?\s+1/i.test(stijl.features),`${naam} ${id}: slashed-zero wordt nog afgedwongen (${stijl.variant}; ${stijl.features})`);
    }
  }finally{await browser.close();}
}

(async()=>{
  await controleer(chromium,"Chromium");
  await controleer(webkit,"WebKit");
  console.log("Consumentencijfers geverifieerd in Chromium/WebKit: Instrument Sans, tabular-nums en geen DM Mono/slashed-zero.");
})().catch(err=>{console.error(err);process.exit(1);});

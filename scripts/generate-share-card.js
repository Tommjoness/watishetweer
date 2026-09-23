"use strict";

/* Maakt share-card.png: de 1200×630-kaart die WhatsApp, Facebook, LinkedIn en X
   tonen bij een gedeelde link. Handmatig draaien na een wijziging aan merk of
   tekst; de PNG staat in de repository zodat de build geen browser nodig heeft.

     CHROME_PATH=/pad/naar/chromium node scripts/generate-share-card.js

   Alleen lokale fonts en inline SVG: de kaart is reproduceerbaar zonder netwerk. */

const fs=require("fs");
const path=require("path");
const {chromium}=require("playwright-core");

const ROOT=path.join(__dirname,"..");
const UIT=path.join(ROOT,"share-card.png");
const BREEDTE=1200,HOOGTE=630;

const font=(familie,bestand,gewicht)=>`@font-face{font-family:'${familie}';src:url('data:font/woff2;base64,${fs.readFileSync(path.join(ROOT,bestand)).toString("base64")}') format('woff2');font-weight:${gewicht}}`;

/* Het merkteken is dezelfde zonneboog met rode stip als icon-512.png. */
const html=`<!doctype html><html lang="nl"><meta charset="utf-8"><style>
${font("Bodoni Moda","bodoni-moda-latin-400-normal.woff2",400)}
${font("Instrument Sans","instrument-sans-latin-400-normal.woff2",400)}
${font("Instrument Sans","instrument-sans-latin-500-normal.woff2",500)}
html,body{margin:0}
body{width:${BREEDTE}px;height:${HOOGTE}px;background:#F4F5F3;color:#12211C;display:flex;align-items:center;gap:72px;padding:0 88px;box-sizing:border-box;font-family:'Instrument Sans',sans-serif}
svg{flex:0 0 auto}
h1{font-family:'Bodoni Moda',serif;font-weight:400;font-size:84px;line-height:1;margin:0 0 28px;letter-spacing:-.5px}
p{font-size:34px;line-height:1.35;margin:0;color:#3F4B46;max-width:620px}
.klein{margin-top:30px;font-size:24px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:#65716C}
</style><body>
<svg width="330" height="165" viewBox="74 136 364 182" aria-hidden="true">
  <line x1="84" y1="306" x2="428" y2="306" stroke="#DCE1DE" stroke-width="5"/>
  <path d="M124 306A132 132 0 0 1 388 306" fill="none" stroke="#12211C" stroke-width="10"/>
  <circle cx="306" cy="180" r="20" fill="#A02036"/>
</svg>
<div>
  <h1>watishetweer.nl</h1>
  <p>Het weer per uur en voor 7 dagen,<br>in één rustig overzicht.</p>
  <div class="klein">Zonder reclame</div>
</div>
</body></html>`;

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:BREEDTE,height:HOOGTE},deviceScaleFactor:1});
    await page.setContent(html);
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:UIT,type:"png"});
  }finally{await browser.close();}
  console.log("share-card.png geschreven ("+BREEDTE+"×"+HOOGTE+", "+fs.statSync(UIT).size+" bytes).");
})().catch(e=>{console.error(e);process.exit(1);});

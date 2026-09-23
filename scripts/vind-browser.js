"use strict";

/* Eén browserdetectie voor alle Chrome/Chromium-browsertests.

   Voorheen had iedere test een eigen variant: sommige lazen CHROME_PATH niet,
   andere zochten via `sh -lc "command -v …"`. Een login-shell voert het
   profiel uit; print dat iets (bijv. een versiemanager), dan werd die tekst
   als browserpad meegenomen en faalde de test met een onduidelijke exit.

   Volgorde: een expliciet CHROME_PATH/CHROMIUM_PATH wint altijd (ook als het
   pad niet bestaat, zodat een verkeerde CI-configuratie luid faalt). Daarna
   wordt PATH zelf doorzocht, zonder shell, in dezelfde naamvolgorde als de
   oude detectie. Als laatste volgt de Chromium die Playwright zelf meelevert:
   in de Playwright-CI-container staat die niet op PATH, waardoor browsertests
   zonder expliciet CHROME_PATH daar voorheen stil werden overgeslagen. */
const fs=require("fs");
const path=require("path");

const BROWSER_NAMEN=Object.freeze(["google-chrome","google-chrome-stable","chromium","chromium-browser"]);

function uitvoerbaar(pad){
  try{
    fs.accessSync(pad,fs.constants.X_OK);
    return fs.statSync(pad).isFile();
  }catch{
    return false;
  }
}

function playwrightChromium(){
  try{
    return require("playwright-core").chromium.executablePath()||null;
  }catch{
    return null;
  }
}

function vindBrowser(env=process.env,{playwrightPad=playwrightChromium}={}){
  for(const expliciet of [env.CHROME_PATH,env.CHROMIUM_PATH]){
    if(String(expliciet||"").trim())return String(expliciet).trim();
  }
  const mappen=String(env.PATH||"").split(path.delimiter).filter(Boolean);
  for(const naam of BROWSER_NAMEN){
    for(const map of mappen){
      const kandidaat=path.join(map,naam);
      if(uitvoerbaar(kandidaat))return kandidaat;
    }
  }
  let playwright=null;
  try{playwright=playwrightPad();}catch{}
  if(playwright&&uitvoerbaar(playwright))return playwright;
  return null;
}

module.exports={BROWSER_NAMEN,vindBrowser};

"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");
const MARK="/* ===== KLEINE KANS TEGEL CONSISTENTIE 20260815 ===== */";

if(!html.includes(MARK))throw new Error("Kleine-kans-consistentiemarker ontbreekt.");
if(!html.includes('return (k!==null&&k>=10)||(mm!==null&&mm>=MM_MEETBAAR);'))
  throw new Error("Definitieve neerslagtegel gebruikt niet de centrale 10%-grens.");
if(html.includes('return (k!==null&&k>=30)||(mm!==null&&mm>=MM_MEETBAAR);'))
  throw new Error("Verouderde 30%-prominentiegrens staat nog in het artifact.");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime om kleine-kans-correctie te valideren.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-small-chance-"+(i+1)}));

console.log("Kleine-kans-consistentie: definitieve runtime gebruikt 10% als grens en bevat geen oude 30%-owner.");

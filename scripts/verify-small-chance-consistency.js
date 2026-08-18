"use strict";

const fs=require("fs");
const path=require("path");
const vm=require("vm");

const root=path.join(__dirname,"..");
const q1=fs.readFileSync(path.join(__dirname,"q1-precip-performance.js"),"utf8");
const html=fs.readFileSync(path.join(root,"public","index.html"),"utf8");
const CANON='return (k!==null&&k>=10)||(mm!==null&&mm>=MM_MEETBAAR);';
const OUD='return (k!==null&&k>=30)||(mm!==null&&mm>=MM_MEETBAAR);';
const LATE_MARK="/* ===== KLEINE KANS TEGEL CONSISTENTIE 20260815 ===== */";

if((q1.split(CANON).length-1)!==1)throw new Error("Canonieke Q1-owner bevat niet exact één 10%-prominentiegrens.");
if(q1.includes(OUD))throw new Error("Verouderde 30%-prominentiegrens staat nog in de Q1-owner.");
if(!html.includes(CANON))throw new Error("Definitieve runtime gebruikt niet de canonieke 10%-prominentiegrens.");
if(html.includes(OUD))throw new Error("Verouderde 30%-prominentiegrens staat nog in het artifact.");
if(html.includes(LATE_MARK))throw new Error("Verwijderde late kleine-kans-correctielaag staat nog in het artifact.");

const scripts=[...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(!scripts.length)throw new Error("Geen inline runtime om kleine-kans-owner te valideren.");
scripts.forEach((bron,i)=>new vm.Script(bron,{filename:"public/index.html:verify-small-chance-"+(i+1)}));

console.log("Kleine-kans-owner: Q1-bron en definitieve runtime gebruiken 10% zonder late correctielaag.");

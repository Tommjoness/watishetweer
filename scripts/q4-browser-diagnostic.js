"use strict";
const fs=require("fs"),path=require("path"),cp=require("child_process");
const root=path.join(__dirname,"..");
const bronPad=path.join(root,"browser-q4-rain-periods.test.js");
let bron=fs.readFileSync(bronPad,"utf8");
const ret='oudeStaven,oudeMm,teksten,brackets,kansGecentreerd,mmUitgelijnd,';
if(!bron.includes(ret))throw new Error("Q4-diagnose return-anker ontbreekt.");
bron=bron.replace(ret,'oudeStaven,oudeMm,teksten,brackets,kansGecentreerd,mmUitgelijnd,mm:g.MM,ti:g.TI,chartStart:S.chartStart,prec:S.d.hourly.precipitation.slice(S.chartStart,S.chartStart+g.MM.length),rainOuter:regen?regen.outerHTML:"",');
const assertie='assert.equal(resultaat.brackets,6,naam+" "+breedte+": twee gescheiden regenperioden moeten twee afzonderlijke brackets met eindkapjes geven");';
if(!bron.includes(assertie))throw new Error("Q4-diagnose bracket-assertieanker ontbreekt.");
bron=bron.replace(assertie,'console.log("Q4_BROWSER_DIAG "+JSON.stringify({naam,breedte,resultaat})); throw new Error("Q4_DIAG_STOP");');
const tmp=path.join(root,".q4-browser-diagnostic-runtime.js");
fs.writeFileSync(tmp,bron,"utf8");
const r=cp.spawnSync(process.execPath,[tmp],{cwd:root,encoding:"utf8"});
process.stdout.write(r.stdout||"");process.stderr.write(r.stderr||"");
try{fs.unlinkSync(tmp);}catch(e){}
/* De diagnose hoort bewust rood te eindigen; de workflow vangt de output op. */
process.exit(r.status===0?2:r.status||1);

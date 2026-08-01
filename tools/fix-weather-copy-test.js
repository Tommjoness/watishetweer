const fs=require("fs");
const path="interpretatie-engine.test.js";
let s=fs.readFileSync(path,"utf8");
const oud=`test("grote kans zonder hoeveelheid wordt als modelverschil benoemd",()=>{
  const d=basis();
  d.hourly.precipitation_probability[3]=80;
  d.hourly.precipitation_probability[4]=75;
  const a=analyseerNeerslagData(d,120);
  assert.equal(a.status,"GROTE_KANS_ZONDER_HOEVEELHEID");
  assert(/hoeveelheidsmodel berekent geen meetbare neerslag/.test(neerslagZin(a)));
});`;
const nieuw=`test("grote kans zonder hoeveelheid wordt begrijpelijk uitgelegd",()=>{
  const d=basis();
  d.hourly.precipitation_probability[3]=80;
  d.hourly.precipitation_probability[4]=75;
  const a=analyseerNeerslagData(d,120),zin=neerslagZin(a);
  assert.equal(a.status,"GROTE_KANS_ZONDER_HOEVEELHEID");
  assert(/kans op neerslag.*groot/.test(zin),zin);
  assert(/hooguit enkele druppels/.test(zin),zin);
  assert(!/0,0 mm/.test(zin),zin);
});`;
if(!s.includes(oud)) throw new Error("Verouderde modelverschiltest niet exact gevonden.");
s=s.replace(oud,nieuw);
fs.writeFileSync(path,s,"utf8");
console.log("Testverwachting bijgewerkt.");

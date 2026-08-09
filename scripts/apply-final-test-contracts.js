"use strict";
const fs=require("fs"),path=require("path");
const p=path.join(__dirname,"..","audit-regressions.test.js");
let s=fs.readFileSync(p,"utf8");
function exact(oud,nieuw,label){const n=s.split(oud).length-1;if(n===0&&s.includes(nieuw))return;if(n!==1)throw new Error(label+": verwacht 1 match, gevonden "+n);s=s.replace(oud,nieuw);}
exact(`  let aanroep=0;
  const meteo=await roepWaarschuwingen(
    {lat:"52.3676",lon:"4.9041"},
    async url=>{
      aanroep++;
      if(String(url).includes("bigdatacloud")){
        return {ok:true,json:async()=>({countryCode:"NL"})};
      }
      return {ok:true,text:async()=>atom};
    }
  );
  ok(aanroep>=2,"MeteoAlarm-test doorloopt land- en waarschuwingbron");`,
`  let aanroep=0;
  const meteo=await roepWaarschuwingen(
    {lat:"52.3676",lon:"4.9041",land:"NL"},
    async url=>{aanroep++;return {ok:true,text:async()=>atom};}
  );
  ok(aanroep===1,"MeteoAlarm gebruikt met bekende landcode direct één officiële Atom-feed");`,"MeteoAlarm directe feedtest");
exact(`  const meteoTekst=await roepWaarschuwingen(
    {lat:"52.3676",lon:"4.9041"},
    async url=>String(url).includes("bigdatacloud")
      ? {ok:true,json:async()=>({countryCode:"NL"})}
      : {ok:true,text:async()=>atomEntiteiten}
  );`,
`  const meteoTekst=await roepWaarschuwingen(
    {lat:"52.3676",lon:"4.9041",land:"NL"},
    async()=>({ok:true,text:async()=>atomEntiteiten})
  );`,"Atom entiteitentest");
exact(`  async function landFeed(code,lat,lon){
    const urls=[];
    const antwoord=await roepWaarschuwingen({lat:String(lat),lon:String(lon)},async url=>{
      urls.push(String(url));
      if(String(url).includes("bigdatacloud")) return {ok:true,json:async()=>({countryCode:code})};
      if(String(url).includes("/api/v1/")) return {ok:false,status:404};
      return {ok:true,text:async()=>atom};
    });
    return {antwoord,urls};
  }`,
`  async function landFeed(code,lat,lon){
    const urls=[];
    const antwoord=await roepWaarschuwingen({lat:String(lat),lon:String(lon),land:code},async url=>{
      urls.push(String(url));
      return {ok:true,text:async()=>atom};
    });
    return {antwoord,urls};
  }`,"landfeed helper");
exact(`  const rood=await roepWaarschuwingen(
    {lat:"52.3676",lon:"4.9041"},
    async url=>String(url).includes("bigdatacloud")
      ? {ok:true,json:async()=>({countryCode:"NL"})}
      : {ok:true,text:async()=>JSON.stringify({warnings:[{title:"Extreem weer",level:4}]})}
  );
  ok(rood.body.lijst[0].niveau==="rood","MeteoAlarm-niveau 4 wordt als rood geïnterpreteerd");`,
`  const roodAtom="<?xml version=\\"1.0\\"?><feed><entry><title>Code rood: Extreem weer</title><summary>Gevaarlijk weer</summary></entry></feed>";
  const rood=await roepWaarschuwingen(
    {lat:"52.3676",lon:"4.9041",land:"NL"},
    async()=>({ok:true,text:async()=>roodAtom})
  );
  ok(rood.body.lijst[0].niveau==="rood","MeteoAlarm Atom-titel met rood wordt als rood geïnterpreteerd");`,"rode Atom test");
fs.writeFileSync(p,s,"utf8");
console.log("Oude provider-testcontracten bijgewerkt.");

"use strict";

const fs=require("fs");
const path=require("path");
const assert=require("assert");
const vm=require("vm");

const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const begin=html.indexOf("function zoekResultaatDetail(r)");
const end=html.indexOf("function zoekPanelenSluit",begin);
assert(begin>=0&&end>begin,"zoekresultaathelpers ontbreken in ontwikkeltemplate");
const context={};vm.createContext(context);
vm.runInContext(html.slice(begin,end)+";globalThis.__zoek={zoekResultaatDetail,uniekeZoekResultaten};",context);
const {zoekResultaatDetail,uniekeZoekResultaten}=context.__zoek;

const resultaten=[
  {name:"Dubai",latitude:25.07725,longitude:55.30927,admin1:"Dubai",country:"Verenigde Arabische Emiraten",country_code:"AE"},
  {name:"Dubai",latitude:27.2101,longitude:83.2041,admin2:"Siddharthnagar",admin1:"Uttar Pradesh",country:"India",country_code:"IN"},
  {name:"Dubai",latitude:27.2101,longitude:83.2041,admin2:"Siddharthnagar",admin1:"Uttar Pradesh",country:"India",country_code:"IN"},
  {name:"Dubai",latitude:27.1518,longitude:83.5612,admin2:"Maharajganj",admin1:"Uttar Pradesh",country:"India",country_code:"IN"}
];
const uniek=uniekeZoekResultaten(resultaten);
assert.equal(uniek.length,3,"alleen een exact gelijke naam/coördinaatcombinatie hoort te verdwijnen");
assert.deepEqual(uniek.map(zoekResultaatDetail),[
  "Verenigde Arabische Emiraten",
  "Siddharthnagar, Uttar Pradesh, India",
  "Maharajganj, Uttar Pradesh, India"
],"gelijknamige plaatsen moeten met district, regio en land van elkaar te onderscheiden zijn");
assert.equal(zoekResultaatDetail({name:"Utrecht",admin2:"Utrecht",admin1:"Utrecht",country:"Nederland"}),"Nederland","de plaatsnaam mag niet redundant in het detail worden herhaald");
console.log("Zoekresultaatidentiteit groen: exacte geocoderdubbelen verdwijnen, gelijknamige plaatsen blijven onderscheidbaar.");

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
vm.runInContext(html.slice(begin,end)+";globalThis.__zoek={zoekResultaatDetail,zoekResultaatDetails,zoekResultaatType,uniekeZoekResultaten};",context);
const {zoekResultaatDetail,zoekResultaatDetails,zoekResultaatType,uniekeZoekResultaten}=context.__zoek;

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
/* Singapore (audit 15 oktober): de stad (PPLC) en het land (PCLI) heten allebei
   "Singapore" en hebben allebei land "Singapore". Zonder soort waren ze niet te onderscheiden. */
const singapore=uniekeZoekResultaten([
  {name:"Singapore",latitude:1.28967,longitude:103.85007,feature_code:"PPLC",country_code:"SG",country:"Singapore"},
  {name:"Singapore",latitude:1.36667,longitude:103.8,feature_code:"PCLI",country_code:"SG",country:"Singapore"},
  {name:"Singapore",latitude:-24.56233,longitude:29.31502,feature_code:"PPL",country_code:"ZA",country:"Zuid-Afrika",admin1:"Limpopo",admin2:"Waterberg"},
  {name:"Singapore Island",latitude:1.36667,longitude:103.8,feature_code:"ISL",country_code:"SG",country:"Singapore"}
]);
const sg=zoekResultaatDetails(singapore).map(x=>JSON.parse(JSON.stringify(x)));
assert.deepEqual(sg,[
  {type:"hoofdstad",detail:""},
  {type:"land",detail:""},
  {type:"",detail:"Waterberg, Limpopo, Zuid-Afrika"},
  {type:"",detail:"Singapore"}
],"gelijknamige resultaten zonder onderscheidende regio krijgen hun soort; al onderscheidbare resultaten blijven ongewijzigd");
const zichtbaar=sg.map(x=>[x.type,x.detail].filter(Boolean).join(", "));
assert.equal(new Set(singapore.map((r,i)=>r.name+"|"+zichtbaar[i])).size,singapore.length,"ieder Singapore-resultaat is zichtbaar uniek");
assert.deepEqual(uniek.map((r,i)=>zoekResultaatDetails(uniek)[i].type),["","",""],"Dubai-resultaten met eigen regio krijgen geen extra soort");
assert.equal(zoekResultaatType({feature_code:"AIRP"}),"luchthaven","luchthavens worden herkend");
assert.equal(zoekResultaatType({feature_code:"ADM2"}),"regio","bestuurlijke gebieden worden herkend");
assert.equal(zoekResultaatType({}),"","zonder geocodercode geen gegokte soort");
assert(html.includes('<span class="zoekresultaat-type">${type}</span>'),"de soort staat in een eigen tekstknoop, zodat de Engelse vertaling hem exact kan vertalen");
const enBron=fs.readFileSync(path.join(__dirname,"..","taal","en.js"),"utf8");
for(const w of ["hoofdstad","land","eiland","luchthaven","regio","plaats"])assert(enBron.includes('"'+w+'": "'),"Engelse vertaling ontbreekt voor zoekresultaatsoort "+w);
console.log("Zoekresultaatidentiteit groen: exacte geocoderdubbelen verdwijnen, gelijknamige plaatsen blijven onderscheidbaar.");

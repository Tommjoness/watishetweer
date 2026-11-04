"use strict";

/* Deterministische dekking van de tegel "Neerslag komend uur" (alleen Node, geen browser).
   Draait de echte analyse (interpretatie-engine), het echte neerslagbeleid en de echte tegelinhoud (neerslagTegelInhoud) en controleert:
   - alle 101 gehele kanspercentages (0 t/m 100) in combinatie met verschillende hoeveelheden: hoofdwaarde, toelichting en classificatie
     komen overeen, er staat nooit meer zekerheid dan het percentage rechtvaardigt, en 'Droog' staat alleen bij een droge toelichting;
   - decimale kansen op de categoriegrenzen (afronding eerst, categorie daarna) en ongeldige kansen (nooit stil als 0% gelezen);
   - KNMI-nowcast, actuele radar en actuele modelneerslag: bronprioriteit blijft, kans en meting worden niet vermengd;
   - Nederlandse en Engelse toelichting: elke zin die de tegel kan tonen heeft een vertaling. */

const assert=require("assert");
const eng=require("../interpretatie-engine.js");
const pol=require("../neerslagkans-policy-v3.js");
const q=require("./q1-precip-performance.js");
const {bouw}=require("../data.js");
const kern=require("../taal/vertaalkern.js");
const woordenboek=require("../taal/en.js");
const vertaler=kern.maakVertaler(woordenboek);

let n=0;const test=(naam,fn)=>{try{fn();n++;console.log("OK  "+naam);}catch(e){console.error("FOUT "+naam+"\n  "+(e&&e.stack||e));process.exitCode=1;}};

function dataMet(pp,pr,extra){
  const o=extra||{};
  const d=bouw({pp:typeof pp==="function"?pp:()=>pp,pr:()=>pr,wc:()=>(o.wc!==undefined?o.wc:2),som:2});
  d.current.time="2026-07-22T17:30";
  d.current.precipitation=o.nu!==undefined?o.nu:0;
  if(o.wcNu!==undefined)d.current.weather_code=o.wcNu;
  return d;
}
const analyse=(pp,pr,extra)=>eng.analyseerNeerslagData(dataMet(pp,pr,extra),60);
const inhoud=a=>q.neerslagTegelInhoud(a,pol);
const platTekst=html=>html.replace(/<[^>]*>/g,"").replace(/&lt;/g,"<").replace(/&amp;/g,"&");

const ZIN={DROOG:"Geen neerslag verwacht.",ZEER_KLEIN:"Het komende uur is er een zeer kleine kans op neerslag.",KLEIN:"Het komende uur is er een kleine kans op neerslag.",
  MOGELIJK:"Het komende uur is neerslag mogelijk.",GROOT:"Het komende uur is er een grote kans op neerslag.",ZEER_GROOT:"Het komende uur is er een zeer grote kans op neerslag."};
const niveauVan=k=>k===0?"DROOG":k<=9?"ZEER_KLEIN":k<=29?"KLEIN":k<=69?"MOGELIJK":k<=89?"GROOT":"ZEER_GROOT";
const mmNl=v=>v.toFixed(1).replace(".",",")+" mm";

function controleerBasis(i,a,label){
  assert.equal(i.html===undefined,false,label+": html ontbreekt");
  assert.equal(platTekst(i.html),i.waarde,label+": zichtbare waarde en html verschillen ("+i.html+" / "+i.waarde+")");
  assert(i.sub&&i.sub.length>10&&/[.!]$/.test(i.sub),label+": toelichting ontbreekt of is onvolledig: '"+i.sub+"'");
  assert(i.kop&&i.waarde,label+": kop of waarde leeg");
  if(a&&a.genoeg)assert.equal(i.sub,pol.komendUurTekst(a),label+": toelichting komt niet uit het beleid");
  assert.equal(i.waarde==="Droog",i.sub===ZIN.DROOG,label+": 'Droog' en 'Geen neerslag verwacht.' horen bij elkaar ("+i.waarde+" / "+i.sub+")");
  const pct=/^(\d+)%/.exec(i.waarde);
  if(pct)assert(Number(pct[1])<=100,label+": percentage boven 100");
}

test("alle 101 gehele kansen zonder hoeveelheid: waarde en toelichting volgen dezelfde categorie",()=>{
  for(let k=0;k<=100;k++)for(const mm of [0,0.001]){
    const a=analyse(k,mm),i=inhoud(a),l=k+"%/"+mm+" mm";
    controleerBasis(i,a,l);
    assert.equal(a.genoeg,true,l);
    assert.equal(i.waarde,k===0?"Droog":k+"%",l);
    assert.equal(i.sub,ZIN[niveauVan(k)],l);
    assert.equal(pol.kansNiveau(k),niveauVan(k),l);
    assert.equal(i.kop,"Neerslag komend uur",l);
  }
});

test("categoriegrenzen 0/1, 9/10, 29/30, 69/70, 89/90 wisselen waarde en zin tegelijk",()=>{
  const verwacht=[[0,"Droog","DROOG"],[1,"1%","ZEER_KLEIN"],[9,"9%","ZEER_KLEIN"],[10,"10%","KLEIN"],[29,"29%","KLEIN"],[30,"30%","MOGELIJK"],
    [69,"69%","MOGELIJK"],[70,"70%","GROOT"],[89,"89%","GROOT"],[90,"90%","ZEER_GROOT"],[100,"100%","ZEER_GROOT"]];
  for(const [k,w,niveau] of verwacht){const i=inhoud(analyse(k,0));assert.equal(i.waarde,w,k+"%");assert.equal(i.sub,ZIN[niveau],k+"%");}
});

test("alle 101 kansen met een meetbare hoeveelheid: hoeveelheid erbij, nooit 'Droog', tegenstrijdige 0% blijft 'Onzeker'",()=>{
  for(let k=0;k<=100;k++)for(const mm of [0.1,1.5,12]){
    const a=analyse(k,mm),i=inhoud(a),l=k+"%/"+mm+" mm";
    controleerBasis(i,a,l);
    const hoev=mmNl(mm);
    if(k===0){assert.equal(i.waarde,"Onzeker · "+hoev,l);assert.equal(i.sub,"Neerslagverwachting onzeker.",l);}
    else{assert.equal(i.waarde,k+"% · "+hoev,l);assert.equal(i.sub,ZIN[niveauVan(k)],l);}
    assert.notEqual(i.waarde,"Droog",l);
  }
});

test("kleine hoeveelheid (spoor) bij een kans: 0% is tegenstrijdig en dus 'Onzeker', anders het percentage zonder hoeveelheid",()=>{
  for(let k=0;k<=100;k++){
    const a=analyse(k,0.04),i=inhoud(a),l=k+"%/0,04 mm";
    controleerBasis(i,a,l);
    if(k===0){assert.equal(i.waarde,"Onzeker",l);assert.equal(i.sub,"Neerslagverwachting onzeker.",l);}
    else{assert.equal(i.waarde,k+"%",l);assert.equal(i.sub,ZIN[niveauVan(k)],l);}
  }
});

test("decimale kansen: eerst afronden, daarna categoriseren; waarde, toelichting en analyse blijven gelijk",()=>{
  const tabel=[[0.49,"Droog","DROOG"],[0.5,"1%","ZEER_KLEIN"],[9.49,"9%","ZEER_KLEIN"],[9.5,"10%","KLEIN"],[29.49,"29%","KLEIN"],[29.5,"30%","MOGELIJK"],
    [69.49,"69%","MOGELIJK"],[69.5,"70%","GROOT"],[89.49,"89%","GROOT"],[89.5,"90%","ZEER_GROOT"],[99.9,"100%","ZEER_GROOT"],[100,"100%","ZEER_GROOT"]];
  for(const [k,w,niveau] of tabel){
    const a=analyse(k,0),i=inhoud(a);
    controleerBasis(i,a,String(k));
    assert.equal(i.waarde,w,String(k));assert.equal(i.sub,ZIN[niveau],String(k));
    assert.equal(a.kans,Math.round(k),String(k));
  }
});

test("kans als niet-lege numerieke tekst wordt veilig gelezen; andere tekst is ongeldig",()=>{
  assert.equal(inhoud(analyse("7",0)).waarde,"7%");
  assert.equal(inhoud(analyse("9.5",0)).waarde,"10%");
  assert.equal(inhoud(analyse("100",0)).waarde,"100%");
  for(const slecht of ["","x","7%","1e1"])assert.equal(inhoud(analyse(slecht,0)).waarde,"–",JSON.stringify(slecht));
});

test("ongeldige kansen worden nooit stil als 0% of 100% gelezen",()=>{
  for(const slecht of [-5,-0.4,100.4,101,150,NaN,Infinity,-Infinity,false,true,[],{},null,undefined]){
    const a=analyse(slecht,0),i=inhoud(a),l=String(JSON.stringify(slecht)||String(slecht));
    assert.equal(a.genoeg,false,l+": analyse noemt ongeldige kans toereikend");
    assert.equal(i.waarde,"–",l);
    assert.equal(i.sub,"Neerslaggegevens niet beschikbaar.",l);
    assert.notEqual(i.waarde,"Droog",l);
    assert(!/%/.test(i.waarde),l);
  }
});

test("één ongeldig uur wordt als ontbrekend behandeld: het geldige maximum blijft, bij te weinig dekking toont de tegel '–' (nooit 0% of 'Droog')",()=>{
  for(const [duur,slecht] of [[60,18],[120,19],[120,20]]){
    const d=dataMet(u=>u===slecht?150:30,0);
    const a=eng.analyseerNeerslagData(d,duur),i=inhoud(a),l=duur+" min, uur "+slecht;
    assert.equal(a.kans,30,l+": ongeldig uur beïnvloedt het geldige maximum");
    if(a.genoeg)assert.equal(i.waarde,"30%",l);
    else{assert.equal(i.waarde,"–",l);assert.equal(i.sub,"Neerslaggegevens niet beschikbaar.",l);}
    assert.notEqual(i.waarde,"Droog",l);assert.notEqual(i.waarde,"0%",l);
  }
});

test("onbekende of onvolledige invoer geeft de beschikbaarheidstekst",()=>{
  for(const a of [null,undefined,{},{genoeg:false},"x"]){
    const i=q.neerslagTegelInhoud(a,pol);
    assert.equal(i.waarde,"–");assert.equal(i.sub,"Neerslaggegevens niet beschikbaar.");
  }
  assert.equal(q.neerslagTegelInhoud({genoeg:true,kans:0},null).waarde,"–","zonder beleid geen aangenomen 'Droog'");
  const nuZonderKans=q.neerslagTegelInhoud({genoeg:false,currentWet:true,status:"NEERSLAG_NU",hoeveelheid:0.5},pol);
  assert.equal(nuZonderKans.kop,"Neerslag nu");assert.equal(nuZonderKans.waarde,"Neerslag · 0,5 mm");assert.equal(nuZonderKans.sub,"Neerslagkans niet beschikbaar.");
  assert(vertaler.vertaal("Neerslag"),"waardewoord 'Neerslag' moet vertaald kunnen worden");
});

/* --- KNMI en actuele neerslag --- */
function knmiPunten(a,waarden){
  return Array.from({length:25},(_,i)=>({tijd:new Date((a.startMin+i*5)*60000).toISOString(),waarde:waarden(i)}));
}
function metKnmi(pp,pr,actueel,waarden,extra){
  const d=dataMet(pp,pr,extra),basis=eng.analyseerNeerslagData(d,60);
  d.__knmiNeerslag={beschikbaar:true,actueel:{waarde:actueel},nowcast:{punten:knmiPunten(basis,waarden)}};
  return pol.verrijkAnalyseMetKnmi(basis,d,60,eng);
}
const nulReeks=()=>0;

test("KNMI verwacht neerslag: nooit 'Droog'; toelichting noemt de verwachting; modelkans wordt niet vermengd met de KNMI-hoeveelheid",()=>{
  for(const kans of [0,5,40,95]){
    const a=metKnmi(kans,0,0,i=>i>=2&&i<=7?3:0),i=inhoud(a),l="kans "+kans;
    controleerBasis(i,a,l);
    assert.equal(a.bronHoeveelheid,"knmi-nowcast",l);
    assert.notEqual(i.waarde,"Droog",l);
    assert(!/%/.test(i.waarde),l+": modelkans naast KNMI-hoeveelheid: "+i.waarde);
    assert(/ mm$/.test(i.waarde),l+": hoeveelheid ontbreekt: "+i.waarde);
    assert(/^Vanaf ongeveer \d{2}:\d{2} wordt neerslag verwacht\./.test(i.sub),l+": "+i.sub);
    assert.equal(i.kop,"Neerslag komend uur");
  }
});

test("KNMI geeft enkele druppels: '<0,1 mm' met zachte toelichting, geen stellige 'Droog' en geen percentage",()=>{
  const a=metKnmi(3,0,0,i=>i===3?0.5:0),i=inhoud(a);
  controleerBasis(i,a,"druppels");
  assert.equal(a.status,"SPOORHOEVEELHEID");
  assert.equal(i.waarde,"<0,1 mm");
  assert.equal(i.sub,"Het komende uur zijn enkele druppels mogelijk.");
  assert.equal(i.html,"&lt;0,1<s> mm</s>");
});

test("verse droge KNMI-meting naast een hoge modelkans: kans blijft zichtbaar, geen 'Droog' en geen 'het regent nu'",()=>{
  const a=metKnmi(80,0,0,nulReeks),i=inhoud(a);
  controleerBasis(i,a,"droog+kans");
  assert.equal(i.waarde,"80%");assert.equal(i.sub,ZIN.GROOT);assert.equal(i.kop,"Neerslag komend uur");
});

test("verse droge KNMI-meting zonder kans en zonder hoeveelheid blijft 'Droog'",()=>{
  const a=metKnmi(0,0,0,nulReeks),i=inhoud(a);
  controleerBasis(i,a,"droog");
  assert.equal(i.waarde,"Droog");assert.equal(i.sub,ZIN.DROOG);
});

test("actuele KNMI-radar nat: kop 'Neerslag nu', zin 'Het regent nu.' en nooit 'Droog'",()=>{
  for(const kans of [0,40]){
    const a=metKnmi(kans,0,0.8,i=>i<3?0.8:0),i=inhoud(a),l="kans "+kans;
    controleerBasis(i,a,l);
    assert.equal(i.kop,"Neerslag nu",l);
    assert(/^Er valt nu neerslag\.|^Het regent nu\./.test(i.sub),l+": "+i.sub);
    assert.notEqual(i.waarde,"Droog",l);
    /* Met een KNMI-nowcast is de bron voor kans en hoeveelheid KNMI: de modelkans wordt er niet naast gezet. */
    assert(i.waarde==="Neerslag"||/^<?\d+(?:,\d)? mm$/.test(i.waarde),l+": "+i.waarde);
  }
});

test("actuele modelneerslag zonder KNMI: kop 'Neerslag nu' en hoeveelheid vanaf 0,1 mm",()=>{
  const a=analyse(40,0.3,{nu:0.3,wcNu:61}),i=inhoud(a);
  controleerBasis(i,a,"model nu nat");
  assert.equal(i.kop,"Neerslag nu");
  assert.notEqual(i.waarde,"Droog");
  assert(/^40%/.test(i.waarde)||/^Neerslag/.test(i.waarde),i.waarde);
  assert(/nu\./.test(i.sub),i.sub);
});

/* --- Vertaling --- */
test("elke toelichting en tekstwaarde van de tegel heeft een Engelse vertaling",()=>{
  const zinnen=new Set(Object.values(ZIN));
  ["Neerslagverwachting onzeker.","Neerslaggegevens niet beschikbaar.","Neerslagkans niet beschikbaar.","Het komende uur zijn enkele druppels mogelijk.","Het regent nu.","Het sneeuwt nu.","Het komende uur wordt neerslag verwacht."].forEach(z=>zinnen.add(z));
  for(const z of zinnen){const e=vertaler.vertaal(z);assert(e&&e!==z,"geen Engelse vertaling voor: "+z);}
  assert.equal(vertaler.vertaal("Vanaf ongeveer 18:10 wordt neerslag verwacht."),"Precipitation is expected from about 18:10.");
  assert.equal(vertaler.vertaal("Droog"),"Dry");assert.equal(vertaler.vertaal("Onzeker"),"Uncertain");assert.equal(vertaler.vertaal("Neerslag"),"Precipitation");
  for(const kop of ["Neerslag komend uur","Neerslagkans komend uur","Verwachte neerslag komend uur","Neerslag nu"])assert(vertaler.vertaal(kop),"geen vertaling voor kop: "+kop);
  for(const sl of ["kans","verwacht totaal","kans · verwacht totaal"])assert(vertaler.vertaal(sl),"geen vertaling voor sleutel: "+sl);
  /* Toegankelijke namen van de waarde (clarity-laag): ook de samengestelde waarden moeten vertaald worden. */
  for(const w of ["Droog","Onzeker","Neerslag","<0,1 mm","1,5 mm","Onzeker · 1,5 mm","Neerslag · 0,5 mm","60% · 1,5 mm"]){
    const uitleg=/%/.test(w)&&/mm/.test(w)?" Eerst de neerslagkans, daarna het verwachte totaal in het komende uur.":/mm/.test(w)?" Dit is het verwachte totaal in het komende uur.":"";
    const aria="Komend uur: "+w+"."+uitleg;
    assert(vertaler.vertaal(aria),"geen vertaling voor toegankelijke naam: "+aria);
  }
  /* Actuele neerslag: elke soort uit de grammatica, ook met het droogvanaf-einde. */
  const gram=require("../nederlandse-weergrammatica.js");
  for(const soort of ["neerslag","regen","motregen","sneeuw","buien","sneeuwbuien","hagel","onweer","ijzel"]){
    const zin=gram.actueleNeerslagZin(soort);
    assert(vertaler.vertaal(zin)&&vertaler.vertaal(zin)!==zin,"geen vertaling voor: "+zin);
    const metEinde=zin+" Rond 17:50 wordt het naar verwachting droog.";
    assert(vertaler.vertaal(metEinde),"geen vertaling voor: "+metEinde);
  }
  /* Elke Nederlandse zin die het beleid voor het komende uur kan opleveren moet vertaald zijn. */
  for(let k=0;k<=100;k++)for(const mm of [0,0.04,1.5]){
    const a=analyse(k,mm),i=inhoud(a);
    assert(vertaler.vertaal(i.sub),"geen vertaling voor: "+i.sub);
  }
});

test("de tegel-API bewaart de bestaande relevantieregel (twee-uurssectie blijft ongewijzigd)",()=>{
  assert.equal(q.neerslagTegelRelevant(analyse(9,0)),false);
  assert.equal(q.neerslagTegelRelevant(analyse(10,0)),true);
  assert.equal(q.neerslagTegelRelevant(analyse(0,0.1)),true);
  assert.equal(q.neerslagTegelRelevant(analyse(0,0.04)),false);
});

console.log(n+" scenario's van de neerslagtegel-matrix gecontroleerd.");

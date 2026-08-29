"use strict";

const assert=require("assert");
const {ruimWeekNeerslagNotitiesOp}=require("./week-forecast-compact-20260829.js");

function maakRij(describedBy){
  const attrs=new Map();
  if(describedBy!==null&&describedBy!==undefined)attrs.set("aria-describedby",String(describedBy));
  const classes=new Set(["row","day","heeft-neerslagnotitie"]);
  return {
    classList:{
      remove(naam){classes.delete(naam);},
      contains(naam){return classes.has(naam);}
    },
    getAttribute(naam){return attrs.has(naam)?attrs.get(naam):null;},
    setAttribute(naam,waarde){attrs.set(naam,String(waarde));},
    removeAttribute(naam){attrs.delete(naam);}
  };
}

function maakVerwijderbaar(id){
  return {id,removed:false,remove(){this.removed=true;}};
}

const rijen=[
  maakRij("dag-neerslagnotitie-0 extra-help"),
  maakRij("extra-a   dag-neerslagnotitie-1 extra-b"),
  maakRij("dag-neerslagnotitie-2"),
  maakRij("other-help"),
  maakRij(null)
];
const notities=[0,1,2].map(i=>maakVerwijderbaar(`dag-neerslagnotitie-${i}`));
const uitleg=maakVerwijderbaar("dagenneerslaguitleg");
const days={
  querySelectorAll(selector){
    if(selector===".dag-neerslagnotitie")return notities;
    if(selector===".row.day:not(.kop)")return rijen;
    throw new Error("Onverwachte selector: "+selector);
  }
};

const vorigDocument=global.document;
global.document={
  getElementById(id){
    if(id==="days")return days;
    if(id==="dagenneerslaguitleg")return uitleg;
    return null;
  }
};

try{
  assert.equal(ruimWeekNeerslagNotitiesOp(),3,"cleanup moet drie neerslagnotities verwijderen");
  assert(notities.every(n=>n.removed),"alle dag-neerslagnotities moeten worden verwijderd");
  assert(uitleg.removed,"algemene dubbele neerslaguitleg moet worden verwijderd");
  assert(rijen.every(r=>!r.classList.contains("heeft-neerslagnotitie")),"presentatieklasse moet van alle dagrijen verdwijnen");

  assert.equal(rijen[0].getAttribute("aria-describedby"),"extra-help","een extra aria-doel naast de neerslagnotitie moet behouden blijven");
  assert.equal(rijen[1].getAttribute("aria-describedby"),"extra-a extra-b","meerdere overige aria-doelen moeten in volgorde behouden blijven");
  assert.equal(rijen[2].getAttribute("aria-describedby"),null,"aria-describedby mag verdwijnen als uitsluitend de verwijderde neerslagnotitie resteerde");
  assert.equal(rijen[3].getAttribute("aria-describedby"),"other-help","een volledig onafhankelijke aria-beschrijving mag niet wijzigen");
  assert.equal(rijen[4].getAttribute("aria-describedby"),null,"een rij zonder aria-describedby moet zonder attribuut blijven");
}finally{
  if(vorigDocument===undefined)delete global.document;
  else global.document=vorigDocument;
}

console.log("week-forecast-compact accessibility: alleen dag-neerslagnotitie-* wordt uit aria-describedby verwijderd; overige doelen blijven behouden.");

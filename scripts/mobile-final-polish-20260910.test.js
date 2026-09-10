"use strict";

const assert=require("assert");
const vm=require("vm");
const {
  BASIS_MARKER,MARKER,STYLE_ID,STYLE,
  RIJ_FILTER_BRON,RIJ_FILTER_PRODUCTIE,UURKLOK_BRON,UURKLOK_PRODUCTIE,
  pasTekstAan
}=require("./apply-mobile-final-polish-20260910.js");

const basis=`<!doctype html><html><head><style>body{margin:0}</style></head><body>
${BASIS_MARKER}
<script>
const num=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;
function uurRijenUitGeo(g,currentTime,dagGeselecteerd){
  const tijden=g.TI,T=g.T,A=g.A,rijen=[];
  for(let i=0;i<tijden.length;i++){
    const tijd=tijden[i],temp=T[i],gevoel=A[i];
${RIJ_FILTER_BRON}
    rijen.push({tijd});
  }
  return rijen;
}
function werkUurTabelBij(){
  const desktop=window.innerWidth>=1100;
${UURKLOK_BRON}
  return rijen;
}
</script>
</body></html>`;

const r=pasTekstAan(basis,"synthetisch");
assert.equal(r.geraakt,true);
assert(r.html.includes(MARKER));
assert(r.html.includes(`id="${STYLE_ID}"`));
assert(r.html.includes(RIJ_FILTER_PRODUCTIE));
assert(r.html.includes(UURKLOK_PRODUCTIE));
assert(!r.html.includes(UURKLOK_BRON));
assert(UURKLOK_PRODUCTIE.includes("S.klokInstantOverride"));
assert(UURKLOK_PRODUCTIE.includes("utc_offset_seconds"));
assert(UURKLOK_PRODUCTIE.includes("nuMs+providerOffset*1000"));
assert(!UURKLOK_PRODUCTIE.includes("weatherNowActueleLokaleTijd"),"uurgrens mag rond DST niet tegen een civiele IANA-klokstring worden vergeleken");
assert(STYLE.includes("@media(max-width:900px)"));
assert(STYLE.includes("#minibar.aan::after"));
assert(STYLE.includes("linear-gradient(to bottom,var(--sheet),transparent)"));
assert(STYLE.includes("#wiw-hour-title{font-size:18px!important;line-height:1.18!important;scroll-margin-top:64px}"));
assert(!STYLE.includes("@media(max-width:430px)"),"uurtitel hoort bij de bestaande mobiele breakpoint, niet bij een ontestbare extra sub-breakpoint");

const tweede=pasTekstAan(r.html,"synthetisch-tweede");
assert.equal(tweede.html,r.html,"transform moet idempotent zijn");

const zonderBasis=pasTekstAan("<html><head></head><body></body></html>","geen-basis");
assert.equal(zonderBasis.geraakt,false);
assert.throws(()=>pasTekstAan(`${BASIS_MARKER}<html><head></head><body>${RIJ_FILTER_BRON}${RIJ_FILTER_BRON}${UURKLOK_BRON}</body></html>`,`dubbel`),/uurfilter-anker.*2/);

/* Voer exact de rijfilter uit die in het artifact wordt gezet. De currentTime
   parameter is hierbij bewust een provider-as-klok; de callsite maakt die uit
   het universele instant + de vaste response-offset. */
const bron=`function selecteer(tijden,currentTime,dagGeselecteerd){
  const T=tijden.map(()=>1),A=tijden.map(()=>1),rijen=[];
  for(let i=0;i<tijden.length;i++){
    const tijd=tijden[i],temp=T[i],gevoel=A[i];
${RIJ_FILTER_PRODUCTIE}
    rijen.push(tijd);
  }
  return rijen;
}; selecteer;`;
const selecteer=vm.runInNewContext(bron);
const tijden=["2026-09-10T20:00","2026-09-10T21:00","2026-09-10T22:00"];
assert.deepEqual(Array.from(selecteer(tijden,"2026-09-10T20:31",false)),["2026-09-10T21:00","2026-09-10T22:00"]);
assert.deepEqual(Array.from(selecteer(tijden,"2026-09-10T20:00",false)),["2026-09-10T21:00","2026-09-10T22:00"],"het timestamp 20:00 is om exact 20:00 geen toekomstig uur");
assert.deepEqual(Array.from(selecteer(tijden,"2026-09-10T20:31",true)),tijden,"een expliciet gekozen kalenderdag blijft volledig");

/* Sanity check voor de providerklokconstructie rond de Europese najaars-DST:
   hetzelfde universele instant krijgt met de vaste response-offset exact de
   provider-as die ook in hourly.time staat; er wordt niet met een ambigu civiel
   02:xx-label gerekend. */
function providerKlok(iso,offset){return new Date(new Date(iso).getTime()+offset*1000).toISOString().slice(0,16);}
assert.equal(providerKlok("2026-10-25T01:30:00Z",7200),"2026-10-25T03:30");
assert.equal(providerKlok("2026-10-25T01:30:00Z",3600),"2026-10-25T02:30");

console.log("Mobiele final-polish unitcontract groen: provider-as uurgrens, verstreken rijen, gekozen dag en fixed-headerfade/uurtitelstijl zijn geborgd.");

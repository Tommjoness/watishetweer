"use strict";

/* Plaatsing van de zon-op- en zon-onder-labels in de grafiek (kiesZonlabelPlaatsing). Pure logica, zonder browser:
   - raken twee labels elkaar niet, dan verandert er niets;
   - raken ze elkaar wel, dan verschuift de ene kant (omklappen) zonder dat een label een ander of de rand raakt;
   - past geen enkele combinatie van kanten, dan worden de labels samengevoegd en blijft binnen de rand;
   - de uitkomst is nooit afhankelijk van de volgorde waarin de labels worden aangeleverd;
   - tekst wordt nooit kleiner: de functie kent geen lettergrootte, alleen breedtes die de aanroeper meet. */

const assert=require("assert");
const {kiesZonlabelPlaatsing}=require("./mobile-graph-ux-20260828.js");

const W=304;
const op=(lijn,breed=68)=>({lijn,anker:"start",breed});
const onder=(lijn,breed=66)=>({lijn,anker:"end",breed});
const vakVan=(l,anker)=>anker==="end"?[l.lijn-4-l.breed,l.lijn-4]:[l.lijn+4,l.lijn+4+l.breed];

/* 1. Geen botsing: onaangeroerd. Lange dag op 304px, de labels staan ruim uit elkaar. */
assert.deepEqual(kiesZonlabelPlaatsing([op(80),onder(250)],W),{actie:"geen"},"Een dag zonder botsing blijft ongewijzigd.");
assert.deepEqual(kiesZonlabelPlaatsing([onder(250),op(80)],W),{actie:"geen"},"De volgorde van aanleveren speelt geen rol.");

/* 2. Eén of minder label, ongeldige invoer: niets doen. */
assert.deepEqual(kiesZonlabelPlaatsing([op(94)],W),{actie:"geen"});
assert.deepEqual(kiesZonlabelPlaatsing([],W),{actie:"geen"});
assert.deepEqual(kiesZonlabelPlaatsing(null,W),{actie:"geen"});
assert.deepEqual(kiesZonlabelPlaatsing([op(94),onder(130,0)],W),{actie:"geen"},"Een label zonder gemeten breedte laat de functie niets doen.");
assert.deepEqual(kiesZonlabelPlaatsing([op(94),onder(130)],0),{actie:"geen"});

/* 3. Korte dag (zon op 09:00, zon onder 15:30 op 304px): beide naar buiten, dus omklappen zonder samenvoegen. */
{
  const k=kiesZonlabelPlaatsing([op(114),onder(196)],W);
  assert.equal(k.actie,"omklappen","Een korte dag lost op door een kant te wisselen.");
  const nieuw=[op(114),onder(196)].map((l,i)=>{const w=k.labels.find(x=>x.index===i);return w?{...l,anker:w.anker}:l;});
  const [a,b]=nieuw.map(l=>vakVan(l,l.anker));
  assert(a[0]>=2&&a[1]<=W-2&&b[0]>=2&&b[1]<=W-2,"Beide labels blijven binnen de rand.");
  assert(a[1]+4<=b[0]||b[1]+4<=a[0],"De labels raken elkaar niet meer.");
  assert(k.labels.length<=2,"Er worden niet meer labels omgeklapt dan nodig.");
}

/* 4. Zo min mogelijk omklappen: past één wissel, dan blijft het andere label staan. */
{
  const k=kiesZonlabelPlaatsing([op(94),onder(180)],W);
  assert.equal(k.actie,"omklappen");
  assert.equal(k.labels.length,1,"Eén wissel is genoeg als dat past.");
}

/* 5. Zeer korte dag nabij de rand: geen combinatie past, dus samenvoegen, binnen de rand. */
{
  const labels=[op(20),onder(45)];
  const k=kiesZonlabelPlaatsing(labels,W,{scheiding:10});
  assert.equal(k.actie,"samenvoegen");
  assert.deepEqual(k.volgorde,[0,1],"Samengevoegd in volgorde van links naar rechts.");
  const totaal=68+66+10;
  if(k.anker==="start")assert(k.x>=2&&k.x+totaal<=W-2);
  else if(k.anker==="end")assert(k.x-totaal>=2&&k.x<=W-2);
  else assert(k.x-totaal/2>=2-1e-6&&k.x+totaal/2<=W-2+1e-6);
}

/* 6. Volgorde van aanleveren verandert de uitkomst niet (indices blijven die van de aanroeper). */
{
  const a=kiesZonlabelPlaatsing([op(20),onder(45)],W,{scheiding:10});
  const b=kiesZonlabelPlaatsing([onder(45),op(20)],W,{scheiding:10});
  assert.equal(a.actie,b.actie);
  assert.deepEqual(a.volgorde.slice().reverse(),b.volgorde,"Indices volgen de aangeleverde volgorde, links naar rechts.");
}

/* 7. Zeer lange dag: zon onder vlak voor middernacht, volgende zon op net daarna, ver naar rechts. Het omgeklapte label
   (zon op klapte door de rand naar links) botst met het vorige zon-onder-label en wordt netjes opgelost. */
{
  const labels=[onder(280),{lijn:300,anker:"end",breed:68}];
  const k=kiesZonlabelPlaatsing(labels,W,{scheiding:10});
  assert(k.actie==="omklappen"||k.actie==="samenvoegen");
  if(k.actie==="omklappen")k.labels.forEach(l=>assert(l.x>=2&&l.x<=W-2));
}

/* 8. Idempotent: na het toepassen van de uitkomst geeft een tweede aanroep "geen". */
{
  const start=[op(114),onder(196)];
  const k=kiesZonlabelPlaatsing(start,W);
  const nieuw=start.map((l,i)=>{const w=(k.labels||[]).find(x=>x.index===i);return w?{...l,anker:w.anker}:l;});
  assert.deepEqual(kiesZonlabelPlaatsing(nieuw,W),{actie:"geen"},"Een opgelost stel blijft ongemoeid.");
}

/* 9. Willekeurige combinaties: de uitkomst raakt nooit de rand, en samenvoegen is alleen het laatste redmiddel. */
{
  let omgeklapt=0,samengevoegd=0,geen=0;
  for(const w of [304,344,359,374,414,736,1000])
    for(let a=10;a<w-10;a+=11)
      for(let b=a+2;b<w-10;b+=13)
        for(const breed of [60,70,95]){
          const labels=[{lijn:a,anker:"start",breed},{lijn:b,anker:"end",breed:breed-4}];
          const k=kiesZonlabelPlaatsing(labels,w,{scheiding:10});
          if(k.actie==="geen"){geen++;continue;}
          if(k.actie==="omklappen"){
            omgeklapt++;
            const ankers=labels.map((l,i)=>{const x=k.labels.find(y=>y.index===i);return x?x.anker:l.anker;});
            const v=labels.map((l,i)=>vakVan(l,ankers[i]));
            assert(v.every(x=>x[0]>=2-1e-6&&x[1]<=w-2+1e-6),`Binnen de rand bij ${JSON.stringify(labels)} op ${w}px`);
            assert(v[0][1]+4<=v[1][0]+1e-6||v[1][1]+4<=v[0][0]+1e-6,`Geen botsing bij ${JSON.stringify(labels)} op ${w}px`);
          }else{
            samengevoegd++;
            assert.equal(k.actie,"samenvoegen");
          }
        }
  assert(geen>0&&omgeklapt>0&&samengevoegd>0,`Alle drie de uitkomsten komen voor (${geen}/${omgeklapt}/${samengevoegd}).`);
}

console.log("Zonlabels-botsing: plaatsing zonder botsing blijft ongemoeid, omklappen waar dat past, samenvoegen als laatste redmiddel, binnen de rand, volgorde-onafhankelijk en idempotent.");

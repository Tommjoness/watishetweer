"use strict";

/* Meet de kolommen van de seizoenstabellen in de browser (page.evaluate).
   Afspraak (eigenaar, 14 oktober): de eerste kolom staat links en gelijk met
   haar kop; de andere kolommen staan met kop en inhoud op dezelfde middenas.
   Het temperatuurbalkje staat op desktop in een eigen kolom zonder kop. */
function meetUitlijning(){
  const midden=e=>{const r=document.createRange();r.selectNodeContents(e);const b=r.getBoundingClientRect();return b.left+b.width/2;};
  return [...document.querySelectorAll(".seizoen-dag table")].map(t=>{
    const kop=[...t.querySelectorAll("thead tr > *")],rijen=[...t.querySelectorAll("tbody tr")];
    let afwijking=0,eersteLinks=0;
    kop.forEach((k,i)=>{
      if(getComputedStyle(k).display==="none")return;
      for(const r of rijen){
        const c=r.children[i];
        if(!c)continue;
        if(i===0)eersteLinks=Math.max(eersteLinks,Math.abs(c.getBoundingClientRect().left-k.getBoundingClientRect().left));
        else if(k.textContent.trim())afwijking=Math.max(afwijking,Math.abs(midden(c)-midden(k)));
      }
    });
    return {
      afwijking:Math.round(afwijking*10)/10,
      eersteLinks:Math.round(eersteLinks*10)/10,
      rijen:rijen.length,
      minMax:!!t.querySelector(".tbalkkop"),
      balken:[...t.querySelectorAll(".tbalk")].filter(b=>b.getClientRects().length&&b.getBoundingClientRect().width>20).length,
      balkKolom:[...t.querySelectorAll(".tbalkcel")].some(c=>getComputedStyle(c).display!=="none")
    };
  });
}

/* Dezelfde eisen voor iedere test; breedte bepaalt desktop (≥700) of telefoon. */
function controleerUitlijning(assert,metingen,breedte,label){
  for(const u of metingen){
    assert(u.eersteLinks<=1,`${label}: eerste kolom niet links gelijk met de kop (${u.eersteLinks}px)`);
    if(breedte>=700)assert(u.afwijking<=2,`${label}: kop en inhoud niet op dezelfde middenas (${u.afwijking}px)`);
    if(u.minMax){
      assert.equal(u.balken,u.rijen,`${label}: één temperatuurbalkje per plaats`);
      assert.equal(u.balkKolom,breedte>=700,`${label}: balkje in een eigen kolom alleen op desktop`);
    }
  }
}

module.exports={meetUitlijning,controleerUitlijning};

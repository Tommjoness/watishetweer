"use strict";

/* Nachtzicht heeft twee verschillende uitkomsten: de totaalscore over de hele
   nacht en het beste aaneengesloten kijkvenster. De totaalscore weegt maanlicht
   al continu met fase, hoogte en bewolking en blijft daarom onaangeraakt.

   Voor het expliciete 'beste kijkvenster' was de bestaande 0,2-grens echter op
   maanhoogte * verlichting toegepast. Daardoor kon bijvoorbeeld een voor 82%
   verlichte maan laag boven de horizon al als gunstig gelden, terwijl de UI in
   dezelfde rij nog een maanondergang bijna twee uur later toont. Deze owner
   gebruikt dezelfde numerieke 0,2-grens, maar maakt de vensterbetekenis helder:
   - een zwak verlichte maan (<20%) blokkeert het venster niet;
   - bij 20% of meer verlichting moet de maan onder de horizon zijn.
   De continue totaalscore blijft de fijnmazige hoogteweging gebruiken. */
function weatherNowMaanGeschiktVoorNachtvenster(maanOp,verlichting){
  if(verlichting===null||verlichting===undefined||verlichting==="")return false;
  const ill=Number(verlichting);
  if(!Number.isFinite(ill)||ill<0||ill>1)return false;
  return ill<0.2||!maanOp;
}

const NACHTEN_HAAK="function nachten(){\n";
const HELPER_PRODUCTIE=weatherNowMaanGeschiktVoorNachtvenster.toString()+"\n\nfunction nachten(){\n";
const VENSTER_BRON="      const goed = C[i]<35 && (maanWeging[i]*mn.ill < 0.2);";
const VENSTER_PRODUCTIE="      const goed = C[i]<35 && weatherNowMaanGeschiktVoorNachtvenster(maanOp[i],mn.ill);";
const REDEN_BRON="      const maanOk=langsteRun(i=>maanWeging[i]*mn.ill<0.2)>=2;  // zonder de wolken was er een venster geweest";
const REDEN_PRODUCTIE="      const maanOk=langsteRun(i=>weatherNowMaanGeschiktVoorNachtvenster(maanOp[i],mn.ill))>=2;  // zonder de wolken was er een venster geweest";

function vervangExact(bron,van,naar,label){
  const n=bron.split(van).length-1;
  if(n!==1)throw new Error(label+" ontbreekt of is dubbel: "+n);
  return bron.replace(van,naar);
}

function pasNightVisibilityOwnerToe(html){
  let uit=String(html||"");
  if(uit.includes("function weatherNowMaanGeschiktVoorNachtvenster(maanOp,verlichting){"))
    throw new Error("Nachtzicht-maanowner staat al in het aangeleverde artifact.");
  uit=vervangExact(uit,NACHTEN_HAAK,HELPER_PRODUCTIE,"nachten()-ownerhaak");
  uit=vervangExact(uit,VENSTER_BRON,VENSTER_PRODUCTIE,"beste-kijkvenster maanconditie");
  uit=vervangExact(uit,REDEN_BRON,REDEN_PRODUCTIE,"kijkvenster redenanalyse");
  return uit;
}

module.exports=Object.freeze({
  weatherNowMaanGeschiktVoorNachtvenster,
  pasNightVisibilityOwnerToe,
  NACHTEN_HAAK,HELPER_PRODUCTIE,
  VENSTER_BRON,VENSTER_PRODUCTIE,REDEN_BRON,REDEN_PRODUCTIE
});

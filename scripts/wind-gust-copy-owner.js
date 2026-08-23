"use strict";

/* Windstootpresentatie heeft één inhoudelijke owner in de base-build. De
   actuele windstoot, de piekwaarde, het piektijdstip en de gebruikte uurdata
   blijven volledig eigendom van de bestaande meters()-renderer. Deze owner
   verandert uitsluitend de zichtbare subtekst die UI-polish tot nu toe na
   iedere meters()-render opnieuw schreef. */
function weatherNowWindstootTekst(pg,nu,dag,vak){
  if(!pg||!Number.isFinite(Number(pg.v))||!pg.t)return "Geen uurgegevens beschikbaar.";
  const waarde=Math.round(Number(pg.v));
  const dagNaam=String(dag||"").trim();
  const tijdvak=String(vak||"").trim();
  const tussen=tijdvak.replace("–"," en ");
  const toekomst=String(pg.t)>String(nu||"");

  /* pg komt uit forecast-uurdata. Ook wanneer het piekuur inmiddels voorbij is,
     is de waarde dus geen gemeten historische windstoot. De werkwoordstijd mag
     meeschakelen met het lokale moment, maar de zin blijft expliciet een
     verwachting en gebruikt daarom nooit "bedroeg" of een andere meetclaim. */
  if(/^Vandaag$/i.test(dagNaam))return toekomst
    ?`De hoogste windstoot wordt vandaag tussen ${tussen} verwacht: ${waarde} km/u.`
    :`De hoogste windstoot werd vandaag tussen ${tussen} verwacht: ${waarde} km/u.`;
  if(/^Morgen$/i.test(dagNaam))return `De hoogste windstoot wordt morgen tussen ${tussen} verwacht: ${waarde} km/u.`;
  if(/^Gisteren$/i.test(dagNaam))return `De hoogste windstoot werd gisteren tussen ${tussen} verwacht: ${waarde} km/u.`;

  const dagInZin=dagNaam?dagNaam.charAt(0).toLowerCase()+dagNaam.slice(1):"op dat moment";
  return toekomst
    ?`De hoogste windstoot wordt ${dagInZin} tussen ${tussen} verwacht: ${waarde} km/u.`
    :`De hoogste windstoot werd ${dagInZin} tussen ${tussen} verwacht: ${waarde} km/u.`;
}

const HELPER_PRODUCTIE=weatherNowWindstootTekst.toString();
const METERS_MARKER="function meters(){";
const GUST_BRON='  zetTekst("gustsub", !pg ? "Geen uurgegevens beschikbaar."\n    : pg.t>nu ? dagAanduiding(pg.t,true)+" tot "+Math.round(pg.v)+" km/u tussen "+weatherNowUurvak(pg.t).replace("–"," en ")+"."\n    : dagAanduiding(pg.t,true)+" maximaal "+Math.round(pg.v)+" km/u tussen "+weatherNowUurvak(pg.t).replace("–"," en ")+".");';
const GUST_PRODUCTIE='  zetTekst("gustsub",weatherNowWindstootTekst(\n    pg,nu,\n    pg?dagAanduiding(pg.t,true):"",\n    pg?weatherNowUurvak(pg.t):""\n  ));';

function pasWindGustCopyToe(html){
  let bron=String(html||"");
  if(bron.includes("function weatherNowWindstootTekst(pg,nu,dag,vak){"))
    throw new Error("Windstootcopy-helper staat al in het aangeleverde artifact.");
  const metersAantal=bron.split(METERS_MARKER).length-1;
  if(metersAantal!==1)throw new Error("meters()-anker ontbreekt of is dubbel: "+metersAantal);
  const gustAantal=bron.split(GUST_BRON).length-1;
  if(gustAantal!==1)throw new Error("Windstootcopy-bronanker ontbreekt of is dubbel: "+gustAantal);

  bron=bron.replace(METERS_MARKER,HELPER_PRODUCTIE+"\n\n"+METERS_MARKER);
  bron=bron.replace(GUST_BRON,GUST_PRODUCTIE);

  if((bron.split(HELPER_PRODUCTIE).length-1)!==1)throw new Error("Windstootcopy-helper ontbreekt of is dubbel na base-build.");
  if((bron.split(GUST_PRODUCTIE).length-1)!==1)throw new Error("Windstootcopy-productiecontract ontbreekt of is dubbel na base-build.");
  if(bron.includes(GUST_BRON))throw new Error("Oude windstootcopy heeft de base-build overleefd.");
  return bron;
}

module.exports=Object.freeze({
  METERS_MARKER,GUST_BRON,GUST_PRODUCTIE,HELPER_PRODUCTIE,
  windstootTekst:weatherNowWindstootTekst,
  pasWindGustCopyToe
});

"use strict";

/* Windstootpresentatie heeft één inhoudelijke owner in de base-build. De
   actuele windstoot, de piekwaarde, het piektijdstip en de gebruikte uurdata
   blijven volledig eigendom van de bestaande meters()-renderer. Deze owner
   verandert uitsluitend de zichtbare subtekst. Het forecast-tijdstip pg.t is
   het EINDE van het voorafgaande uurvak: voor 23:00–00:00 is pg.t dus 00:00 op
   de volgende lokale kalenderdag. Werkwoordstijd wordt daarom tegen het einde
   van het volledige lokale interval bepaald, terwijl de dagaanduiding bij het
   begin van het interval hoort. */
function weatherNowWindstootBegin(tijd){
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(tijd||""));
  if(!m)return null;
  const ms=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]))-3600000;
  if(!Number.isFinite(ms))return null;
  const d=new Date(ms);
  return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0")
    +"T"+String(d.getUTCHours()).padStart(2,"0")+":"+String(d.getUTCMinutes()).padStart(2,"0");
}

function weatherNowWindstootTekst(pg,nu,dag,vak){
  if(!pg||!Number.isFinite(Number(pg.v))||!pg.t)return "Geen uurgegevens beschikbaar.";
  const waarde=Math.round(Number(pg.v));
  const dagNaam=String(dag||"").trim();
  const tijdvak=String(vak||"").trim();
  const tussen=tijdvak.replace("–"," en ");
  /* pg.t is het intervalEINDE. Zolang dat einde na de lokale huidige tijd ligt,
     is het venster nog toekomstig of gaande en mag de tekst niet in verleden
     tijd springen. Volledige lokale ISO-datum + tijd voorkomt uur-only fouten
     rond middernacht en werkt onafhankelijk van de tijdzone van het apparaat. */
  const toekomstOfGaand=String(pg.t)>String(nu||"");

  /* pg komt uit forecast-uurdata. Ook wanneer het piekuur inmiddels voorbij is,
     is de waarde dus geen gemeten historische windstoot. De werkwoordstijd mag
     meeschakelen met het lokale moment, maar de zin blijft expliciet een
     verwachting en gebruikt daarom nooit taal die een meting claimt. */
  if(/^Vandaag$/i.test(dagNaam))return toekomstOfGaand
    ?`De hoogste windstoot wordt vandaag tussen ${tussen} verwacht: ${waarde} km/u.`
    :`De hoogste windstoot werd vandaag tussen ${tussen} verwacht: ${waarde} km/u.`;
  if(/^Morgen$/i.test(dagNaam))return `De hoogste windstoot wordt morgen tussen ${tussen} verwacht: ${waarde} km/u.`;
  if(/^Gisteren$/i.test(dagNaam))return `De hoogste windstoot werd gisteren tussen ${tussen} verwacht: ${waarde} km/u.`;

  const dagInZin=dagNaam?dagNaam.charAt(0).toLowerCase()+dagNaam.slice(1):"op dat moment";
  return toekomstOfGaand
    ?`De hoogste windstoot wordt ${dagInZin} tussen ${tussen} verwacht: ${waarde} km/u.`
    :`De hoogste windstoot werd ${dagInZin} tussen ${tussen} verwacht: ${waarde} km/u.`;
}

/* HELPER_PRODUCTIE blijft bewust het bestaande contract voor late verifiers:
   zij bewaken de inhoudelijke tekstowner. HELPERS_PRODUCTIE is de volledige
   injectie inclusief de nieuwe, zuiver datumgrenshelper. */
const HELPER_PRODUCTIE=weatherNowWindstootTekst.toString();
const HELPERS_PRODUCTIE=weatherNowWindstootBegin.toString()+"\n\n"+HELPER_PRODUCTIE;
const METERS_MARKER="function meters(){";
const GUST_BRON='  zetTekst("gustsub", !pg ? "Geen uurgegevens beschikbaar."\n    : pg.t>nu ? dagAanduiding(pg.t,true)+" tot "+Math.round(pg.v)+" km/u tussen "+weatherNowUurvak(pg.t).replace("–"," en ")+"."\n    : dagAanduiding(pg.t,true)+" maximaal "+Math.round(pg.v)+" km/u tussen "+weatherNowUurvak(pg.t).replace("–"," en ")+".");';
const GUST_PRODUCTIE='  const gustBegin=pg?weatherNowWindstootBegin(pg.t):null;\n  zetTekst("gustsub",weatherNowWindstootTekst(\n    pg,nu,\n    pg?dagAanduiding(gustBegin||pg.t,true):"",\n    pg?weatherNowUurvak(pg.t):""\n  ));';

function pasWindGustCopyToe(html){
  let bron=String(html||"");
  if(bron.includes("function weatherNowWindstootTekst(pg,nu,dag,vak){"))
    throw new Error("Windstootcopy-helper staat al in het aangeleverde artifact.");
  const metersAantal=bron.split(METERS_MARKER).length-1;
  if(metersAantal!==1)throw new Error("meters()-anker ontbreekt of is dubbel: "+metersAantal);
  const gustAantal=bron.split(GUST_BRON).length-1;
  if(gustAantal!==1)throw new Error("Windstootcopy-bronanker ontbreekt of is dubbel: "+gustAantal);

  bron=bron.replace(METERS_MARKER,HELPERS_PRODUCTIE+"\n\n"+METERS_MARKER);
  bron=bron.replace(GUST_BRON,GUST_PRODUCTIE);

  if((bron.split(HELPERS_PRODUCTIE).length-1)!==1)throw new Error("Windstootcopy-helpers ontbreken of zijn dubbel na base-build.");
  if((bron.split(GUST_PRODUCTIE).length-1)!==1)throw new Error("Windstootcopy-productiecontract ontbreekt of is dubbel na base-build.");
  if(bron.includes(GUST_BRON))throw new Error("Oude windstootcopy heeft de base-build overleefd.");
  return bron;
}

module.exports=Object.freeze({
  METERS_MARKER,GUST_BRON,GUST_PRODUCTIE,HELPER_PRODUCTIE,HELPERS_PRODUCTIE,
  windstootBegin:weatherNowWindstootBegin,windstootTekst:weatherNowWindstootTekst,
  pasWindGustCopyToe
});

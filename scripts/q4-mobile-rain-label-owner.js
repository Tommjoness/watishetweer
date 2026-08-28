"use strict";

/* De 24-uursregenlaag kan op desktop brede perioden als twee losse eindlabels
   tonen (bijv. 16:00 … 18:00). Op mobiel levert dat naast de gewone tijdas te
   veel losse klokteksten op. De Q4-runtime kent de mobiele geometrie al via g.M;
   daar kiezen we daarom altijd de bestaande compacte rangevariant.

   Iedere zichtbare regenbracket moet ook zichtbaar uitlegbaar zijn. Eerder
   bleven brackets van kleine perioden wel staan terwijl hun tijdvak en bedrag
   op mobiel werden weggefilterd. Dat gaf een los streepje zonder betekenis.
   Q4 heeft al botsingsvrije meerrijige labelplaatsing en vergroot de viewBox
   wanneer dat nodig is, dus mobiel gebruikt voortaan alle Q4-perioden. */
const SPLIT_BRON="    if(span>=splitMin){";
const SPLIT_PRODUCTIE="    if(!g.M&&span>=splitMin){";
const HELPER_ANCHOR="function q4PeriodeBedragLabels(g,perioden,eersteY,font){";
const RANDEN_BRON="  const randen=q4PeriodeRandLabels(g,perioden,y,randFont);";
const RANDEN_PRODUCTIE="  const labelPerioden=g.M?q4MobieleGelabeldePerioden(perioden):perioden;\n  const randen=q4PeriodeRandLabels(g,labelPerioden,y,randFont);";
const BEDRAGEN_BRON="  const bedragen=q4PeriodeBedragLabels(g,perioden,bedragStartY,bedragFont);";
const BEDRAGEN_PRODUCTIE="  const bedragen=q4PeriodeBedragLabels(g,labelPerioden,bedragStartY,bedragFont);";

/* Documentatiecontract: Q4 bouwt perioden pas vanaf 0,1 mm. Binnen een 24-uurs-
   grafiek kunnen er maximaal 24 afzonderlijke uurperioden bestaan. De helper
   filtert daar bewust niet nógmaals op: een bracket zonder tekst is niet toegestaan. */
const MOBIEL_LABEL_MIN_MM=0.1;
const MOBIEL_LABEL_MAX=24;

/* Deze helper wordt via Function#toString letterlijk in de browserruntime gezet.
   Houd hem daarom zelfstandig en zonder modulebindings. */
function q4MobieleGelabeldePerioden(perioden){
  return Array.isArray(perioden)?perioden.slice():[];
}

const HELPER_PRODUCTIE=q4MobieleGelabeldePerioden.toString();

function pasQ4MobieleRegenlabelsToe(runtime){
  let bron=String(runtime||"");
  if(bron.includes(SPLIT_PRODUCTIE)||bron.includes("function q4MobieleGelabeldePerioden(perioden){"))
    throw new Error("Q4 mobiele regenlabel-owner staat al in de runtime.");
  const splitN=bron.split(SPLIT_BRON).length-1;
  if(splitN!==1)throw new Error("Q4 splitlabel-anker ontbreekt of is dubbel: "+splitN);
  const helperN=bron.split(HELPER_ANCHOR).length-1;
  if(helperN!==1)throw new Error("Q4 mobiele labelhelper-anker ontbreekt of is dubbel: "+helperN);
  const randenN=bron.split(RANDEN_BRON).length-1;
  if(randenN!==1)throw new Error("Q4 mobiele tijdlabel-renderanker ontbreekt of is dubbel: "+randenN);
  const bedragenN=bron.split(BEDRAGEN_BRON).length-1;
  if(bedragenN!==1)throw new Error("Q4 mobiele bedraglabel-renderanker ontbreekt of is dubbel: "+bedragenN);

  bron=bron.replace(SPLIT_BRON,SPLIT_PRODUCTIE);
  bron=bron.replace(HELPER_ANCHOR,HELPER_PRODUCTIE+"\n\n"+HELPER_ANCHOR);
  bron=bron.replace(RANDEN_BRON,RANDEN_PRODUCTIE);
  bron=bron.replace(BEDRAGEN_BRON,BEDRAGEN_PRODUCTIE);
  return bron;
}

module.exports=Object.freeze({
  SPLIT_BRON,SPLIT_PRODUCTIE,HELPER_PRODUCTIE,RANDEN_PRODUCTIE,BEDRAGEN_PRODUCTIE,
  MOBIEL_LABEL_MIN_MM,MOBIEL_LABEL_MAX,q4MobieleGelabeldePerioden,pasQ4MobieleRegenlabelsToe
});

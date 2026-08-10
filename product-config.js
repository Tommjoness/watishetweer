"use strict";

/* Expliciete productconfiguratie voor de build. De bron-index is een zelfstandig
   ontwikkeltemplate; alle bewuste productieverschillen staan uitsluitend hier en
   worden door regressies gecontroleerd. Zo kan een semantische buildwijziging niet
   meer verborgen in losse replace-code ontstaan. */
const EERSTE_BEZOEK_BRON=`  // D. eerste bezoek: geen automatische gps-prompt. De gebruiker kiest zelf
  //    tussen zoeken en "Mijn locatie"; dat is duidelijker en privacyvriendelijker.
  const st0=document.getElementById("state");
  st0.style.display="block";st0.className="msg";
  st0.textContent="Zoek hierboven een plaats of kies ‘Mijn locatie’.";`;

const EERSTE_BEZOEK_PRODUCTIE=`  // D. eerste bezoek: Amsterdam is de neutrale standaardlocatie. Er wordt
  //    geen gps-toestemming gevraagd; zodra iemand zelf een plaats kiest, wordt
  //    die keuze normaal als laatst gebruikte plaats onthouden.
  q.value="Amsterdam";
  load(52.3676,4.9041,"Amsterdam",false,true,"NL");`;

/* Een grafiek van 24 uur heeft 25 grenspunten nodig: 00:00 t/m de volgende
   00:00. Dat was al zo in de standaard 24-uursweergave, maar niet bij een
   aangeklikte kalenderdag. Voor temperaturen is het laatste punt de rechtergrens;
   voor Open-Meteo-neerslag is het essentieel omdat de waarde op 00:00 de som/kans
   over het voorafgaande uur 23:00–00:00 beschrijft. */
const KALENDERDAG_PUNTEN_BRON="const punten=S.dag==null&&n===24?25:n;";
const KALENDERDAG_PUNTEN_PRODUCTIE="const punten=n===24?25:n;";

module.exports=Object.freeze({
  EERSTE_BEZOEK_BRON,
  EERSTE_BEZOEK_PRODUCTIE,
  KALENDERDAG_PUNTEN_BRON,
  KALENDERDAG_PUNTEN_PRODUCTIE,
  defaultLocation:Object.freeze({naam:"Amsterdam",lat:52.3676,lon:4.9041,land:"NL"})
});

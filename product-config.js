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

module.exports=Object.freeze({
  EERSTE_BEZOEK_BRON,
  EERSTE_BEZOEK_PRODUCTIE,
  defaultLocation:Object.freeze({naam:"Amsterdam",lat:52.3676,lon:4.9041,land:"NL"})
});

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

/* Browser- en fetch-implementaties formuleren een afgebroken request anders
   (bijvoorbeeld WebKit: "Fetch is aborted"). Die technische fouttekst hoort
   nooit rechtstreeks in de product-UI. Een AbortError bij de actuele laadbeurt
   betekent hier dat de eigen requesttimeout is verstreken; een door een nieuwe
   plaats veroorzaakte abort wordt al eerder via laadTeller genegeerd. Overige
   netwerk/providerfouten krijgen eveneens een stabiele, menselijke melding. */
const OPHAALFOUT_BRON='st.textContent="Ophalen mislukt ("+err.message+"). Controleer je verbinding of kies een andere plaats.";';
const OPHAALFOUT_PRODUCTIE='st.textContent=(err&&err.name==="AbortError")?"Het ophalen duurt te lang. Controleer je verbinding en probeer het opnieuw.":"Ophalen mislukt. Controleer je verbinding en probeer het opnieuw.";';

/* Bij een mislukte locatiewissel herstelt de basisloader data, label en
   coördinaten uit de laatste briefing. De landcode hoort bij exact diezelfde
   cache-identiteit. Een legacy-cache zonder land mag daarom nooit terugvallen
   op de landcode van de zojuist mislukte nieuwe locatie; zonder bewezen cacheland
   vertrekt de waarschuwingrequest landloos en bepaalt de server het land opnieuw
   uit de herstelde coördinaten. */
const CACHE_FALLBACK_LAND_BRON="S.land=normLand(oud.land)||S.land;";
const CACHE_FALLBACK_LAND_PRODUCTIE="S.land=normLand(oud.land);";

/* De grafiek mag Open-Meteo's 00:00/00:00-paar niet als echte zonsopkomst of
   -ondergang tekenen. De betekenis van zo'n paar is al canoniek eigendom van
   WeatherNowCorrectnessV2.zonDaglichtInfo: dezelfde lokale kalenderdag is
   poolnacht, de volgende lokale kalenderdag is pooldag. De grafiek bewaakt alleen
   de provider-sentinelvorm en delegeert de datum-/daglichtsemantiek aan die owner. */
const POLAR_GRAFIEK_BRON=`  const overgangen=[];
  if(day&&Array.isArray(day.sunset)&&Array.isArray(day.sunrise)){
    for(let d=0;d<day.time.length;d++){
      const fo=fractIndex(day.sunset[d]);
      if(fo!=null) overgangen.push({idx:fo,tijd:day.sunset[d],op:false});
      const fr=fractIndex(day.sunrise[d]);
      if(fr!=null) overgangen.push({idx:fr,tijd:day.sunrise[d],op:true});
    }
  }
  overgangen.sort((a,b)=>a.idx-b.idx);`;
const POLAR_GRAFIEK_PRODUCTIE=`  const poolZonSentinel=(sr,ss)=>{
    if(!sr||!ss||hhmm(sr)!=="00:00"||hhmm(ss)!=="00:00") return false;
    const owner=globalThis.WeatherNowCorrectnessV2;
    if(!owner||typeof owner.zonDaglichtInfo!=="function") return false;
    const info=owner.zonDaglichtInfo(sr,ss);
    return !!info&&(info.status==="pooldag"||info.status==="poolnacht");
  };
  const overgangen=[];
  if(day&&Array.isArray(day.sunset)&&Array.isArray(day.sunrise)){
    for(let d=0;d<day.time.length;d++){
      const sr=day.sunrise[d],ss=day.sunset[d];
      if(poolZonSentinel(sr,ss)) continue;
      const fo=fractIndex(ss);
      if(fo!=null) overgangen.push({idx:fo,tijd:ss,op:false});
      const fr=fractIndex(sr);
      if(fr!=null) overgangen.push({idx:fr,tijd:sr,op:true});
    }
  }
  overgangen.sort((a,b)=>a.idx-b.idx);`;

module.exports=Object.freeze({
  EERSTE_BEZOEK_BRON,
  EERSTE_BEZOEK_PRODUCTIE,
  KALENDERDAG_PUNTEN_BRON,
  KALENDERDAG_PUNTEN_PRODUCTIE,
  OPHAALFOUT_BRON,
  OPHAALFOUT_PRODUCTIE,
  CACHE_FALLBACK_LAND_BRON,
  CACHE_FALLBACK_LAND_PRODUCTIE,
  POLAR_GRAFIEK_BRON,
  POLAR_GRAFIEK_PRODUCTIE,
  defaultLocation:Object.freeze({naam:"Amsterdam",lat:52.3676,lon:4.9041,land:"NL"})
});

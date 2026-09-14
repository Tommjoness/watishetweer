"use strict";

/* Bepaal de automatische weergave uitsluitend uit lokale tijdstrings van de
   gekozen plaats. daily.sunrise/sunset en weatherNowActueleLokaleTijd() zijn
   beide al in de timezone van die plaats, dus hier hoort bewust geen Date-
   parsing of apparaatstijdzone in. Ontbrekende/polaire zondata valt terug op
   de providerstatus current.is_day; er wordt nooit een zonsmoment verzonnen. */
function autoThemaOpZon(data,lokaleTijd){
  const fallback=data&&data.current&&data.current.is_day===0?"donker":"licht";
  const daily=data&&data.daily;
  const nu=typeof lokaleTijd==="string"?lokaleTijd.slice(0,16):"";
  const lokaalPatroon=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if(!daily||!Array.isArray(daily.time)||!Array.isArray(daily.sunrise)||!Array.isArray(daily.sunset)
    ||!lokaalPatroon.test(nu)) return fallback;

  const dag=nu.slice(0,10),i=daily.time.indexOf(dag);
  if(i<0) return fallback;
  const op=typeof daily.sunrise[i]==="string"?daily.sunrise[i].slice(0,16):"";
  const onder=typeof daily.sunset[i]==="string"?daily.sunset[i].slice(0,16):"";
  const geldig=t=>lokaalPatroon.test(t)&&t.slice(0,10)===dag;
  if(!geldig(op)||!geldig(onder)||op>=onder) return fallback;

  return nu>=op&&nu<onder?"licht":"donker";
}

module.exports={autoThemaOpZon};

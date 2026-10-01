/* Plaatsnamen in het Engels: zoekresultaten (Open-Meteo) en "Mijn locatie"
   (BigDataCloud) worden in het Engels opgevraagd, zodat een Engelse bezoeker
   "Paris", "Cologne" en "Ghent" ziet in plaats van "Parijs", "Keulen" en "Gent".
   Alleen de taalparameter verandert; de rest van de aanvraag blijft gelijk. */
(function () {
  "use strict";
  var origineel = window.fetch;
  if (typeof origineel !== "function") return;
  function engels(url) {
    if (url.indexOf("geocoding-api.open-meteo.com") !== -1) return url.replace(/([?&]language=)nl(?=&|$)/, "$1en");
    if (url.indexOf("api.bigdatacloud.net") !== -1) return url.replace(/([?&]localityLanguage=)nl(?=&|$)/, "$1en");
    return url;
  }
  window.fetch = function (invoer, opties) {
    try {
      var url = typeof invoer === "string" ? invoer : invoer && invoer.url ? String(invoer.url) : String(invoer || "");
      var nieuw = engels(url);
      if (nieuw !== url) invoer = typeof invoer === "string" || !invoer.url ? nieuw : new Request(nieuw, invoer);
    } catch (e) { /* onbekende invoer: ongewijzigd doorgeven */ }
    return origineel.call(this, invoer, opties);
  };
})();

/* Start de Engelse vertaallaag zodra de pagina er is. */
(function () {
  "use strict";
  function start() {
    window.WeatherNowVertaallaag.start({
      kern: window.WeatherNowVertaalkern,
      eenheden: window.WeatherNowTaalEenheden,
      woordenboek: window.WeatherNowWoordenboekEn,
      taal: "en-GB"
    });
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();

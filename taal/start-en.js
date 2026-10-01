/* Start de Engelse vertaallaag zodra de pagina er is. */
(function () {
  "use strict";
  function start() {
    window.WeatherNowVertaallaag.start({
      kern: window.WeatherNowVertaalkern,
      eenheden: window.WeatherNowTaalEenheden,
      woordenboek: window.WeatherNowWoordenboekEn,
      bronEngels: window.__WIW_BRON_EN__,
      taal: "en-GB"
    });
  }
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
})();

/*
 * Taalkeuze voor iedere pagina. Klein en zonder afhankelijkheden: in het
 * Nederlands (standaard) doet dit script niets behalve de keuze-API zetten.
 * Voor Engels laadt het de vertaalbundel; die vertaalt de pagina en alle latere
 * updates. De keuze staat alleen in deze browser (localStorage) en is ook via
 * ?taal=en of ?taal=nl te zetten.
 */
(function () {
  "use strict";
  var SLEUTEL = "weerbriefing.taal.v1";
  var BUNDEL = "__TAAL_EN_BUNDEL__";
  /* Zichtbaarheid van de schakelaar komt uit taal/instellingen.json (build). */
  var SCHAKELAAR = "__TAAL_SCHAKELAAR__" === "ja";
  var TALEN = { nl: 1, en: 1 };

  function bewaar(taal) {
    try { localStorage.setItem(SLEUTEL, JSON.stringify(taal)); } catch (e) { /* privévenster */ }
  }
  function lees() {
    try {
      var q = new URLSearchParams(location.search).get("taal");
      if (q && TALEN[q]) { bewaar(q); return q; }
    } catch (e) { /* oude browser */ }
    try {
      var ruw = localStorage.getItem(SLEUTEL), v = ruw;
      try { v = JSON.parse(ruw); } catch (e) { /* ook een kale waarde telt */ }
      if (v && TALEN[v]) return v;
    } catch (e) { /* geblokkeerde opslag */ }
    return "nl";
  }

  var taal = lees();
  window.WeatherNowTaal = Object.freeze({
    taal: taal,
    kies: function (nieuw) {
      if (!TALEN[nieuw] || nieuw === taal) return;
      bewaar(nieuw);
      try {
        var u = new URL(location.href);
        if (u.searchParams.has("taal")) { u.searchParams.delete("taal"); location.replace(u.href); return; }
      } catch (e) { /* geen URL-API */ }
      location.reload();
    }
  });
  /* De schakelaar: een kleine "EN"/"NL"-knop rechtsboven, in de andere taal.
     Weerpagina: op een smal scherm in de hoek naast de merknaam, op een breed
     scherm als laatste vakje in de zoekbalk. Subpagina's: rechts naast
     "← Terug naar het weer". Anders bovenaan de inhoud, rechts uitgelijnd. */
  var STIJL = ".taal-keuze{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;" +
    "min-width:32px;min-height:28px;padding:0 9px;border:1px solid var(--rule,#DCE1DE);color:var(--ink-70,inherit);" +
    "font-family:var(--sans,inherit);font-weight:500;font-size:11px;line-height:1;letter-spacing:.12em;text-decoration:none}" +
    ".taal-keuze:hover{border-color:var(--ink,currentColor);color:var(--ink,inherit)}" +
    ".taal-keuze:focus-visible{outline:1px solid var(--ink,currentColor);outline-offset:2px}" +
    ".mast.taal-keuze-plek{position:relative}" +
    ".taal-keuze-hoek{position:absolute;top:0;right:0}" +
    ".mast.taal-keuze-ruimte h1{padding-right:48px}" +
    ".tools>.taal-keuze{border-left:none;padding:0 14px;min-height:0}" +
    ".taal-keuze-rij{display:flex;justify-content:space-between;align-items:baseline;gap:12px}" +
    ".taal-keuze-boven{display:flex;justify-content:flex-end;margin:0 0 12px}";
  function zetSchakelaar() {
    if (!SCHAKELAAR || document.querySelector("[data-taal-keuze]")) return;
    var doel = taal === "en" ? "nl" : "en";
    var a = document.createElement("a");
    a.href = "?taal=" + doel;
    a.className = "taal-keuze";
    a.textContent = doel.toUpperCase();
    /* De zichtbare tekst (EN/NL) staat vooraan in de naam, zodat spraakbediening "EN" herkent (WCAG 2.5.3). */
    a.setAttribute("aria-label", doel === "en" ? "EN – English" : "NL – Nederlands");
    a.setAttribute("lang", doel === "en" ? "en-GB" : "nl");
    a.setAttribute("hreflang", doel === "en" ? "en-GB" : "nl");
    a.setAttribute("translate", "no");
    a.setAttribute("data-taal-keuze", doel);
    a.addEventListener("click", function (e) { e.preventDefault(); window.WeatherNowTaal.kies(doel); });
    var stijl = document.createElement("style");
    stijl.textContent = STIJL;
    (document.head || document.documentElement).appendChild(stijl);

    var mast = document.querySelector(".mast");
    var tools = mast && mast.querySelector(".tools");
    if (mast) {
      mast.classList.add("taal-keuze-plek");
      var breed = window.matchMedia ? window.matchMedia("(min-width: 901px)") : null;
      var plaats = function () {
        var hoek = !(tools && breed && breed.matches);
        /* In de hoek houdt een lange kop ("Weer in Capelle aan den IJssel
           vandaag") ruimte vrij voor de knop. */
        a.classList.toggle("taal-keuze-hoek", hoek);
        mast.classList.toggle("taal-keuze-ruimte", hoek);
        if (hoek) mast.appendChild(a);
        else tools.insertBefore(a, tools.querySelector(".results"));
      };
      plaats();
      if (breed) {
        if (breed.addEventListener) breed.addEventListener("change", plaats);
        else if (breed.addListener) breed.addListener(plaats);
      }
      return;
    }
    var terug = [].filter.call(document.querySelectorAll('p > a[href="/"]'), function (l) {
      return /^\s*←/.test(l.textContent);
    })[0];
    if (terug) {
      /* Naast de alinea, niet erin: de vertaallaag vertaalt een alinea als één
         zinsblok, en de knop hoort in zijn eigen taal te blijven. */
      var alinea = terug.parentElement, rij = document.createElement("div");
      rij.className = "taal-keuze-rij";
      alinea.parentNode.insertBefore(rij, alinea);
      rij.appendChild(alinea);
      rij.appendChild(a);
      return;
    }
    var houder = document.querySelector("main") || document.body;
    var p = document.createElement("p");
    p.className = "taal-keuze-boven";
    p.appendChild(a);
    houder.insertBefore(p, houder.firstChild);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", zetSchakelaar, { once: true });
  else zetSchakelaar();

  if (taal !== "en") return;

  /* Vóór de app: de lader is het eerste deferred script, de vertaalbundel komt
     later. Daarom zet de lader zelf de taal van de aanvragen om. */
  /* Plaatsnamen in het Engels: zoekresultaten (Open-Meteo) en "Mijn locatie"
     (BigDataCloud) worden in het Engels opgevraagd, zodat een Engelse bezoeker
     "Paris", "Cologne" en "Ghent" ziet in plaats van "Parijs", "Keulen" en "Gent".
     Alleen de taalparameter verandert; de rest van de aanvraag blijft gelijk. */
  (function () {
    "use strict";
    var origineel = window.fetch;
    if (typeof origineel !== "function") return;
    /* Officiële Engelse brontekst (waarschuwingen): de vertaallaag laat die letterlijk staan. */
    var bronEngels = window.__WIW_BRON_EN__ = window.__WIW_BRON_EN__ || new Set();
    function schoon(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
    function onthoud(s) { s = schoon(s); if (!s) return; bronEngels.add(s); s.replace(/([.!?])\s+(?=[A-Z0-9ÀÉÖÜ"'(])/g, "$1\n").split("\n").forEach(function (z) { if (z) bronEngels.add(schoon(z)); }); }
    function isWaarschuwingen(url) { return /\/api\/waarschuwingen(?:\?|$)/.test(url); }
    function engels(url) {
      /* Waarschuwingen: de officiële Engelse tekst van de weerdienst (MeteoAlarm en-GB). */
      if (isWaarschuwingen(url) && !/[?&]taal=/.test(url)) return url + (url.indexOf("?") === -1 ? "?" : "&") + "taal=en";
      if (url.indexOf("geocoding-api.open-meteo.com") !== -1) return url.replace(/([?&]language=)nl(?=&|$)/, "$1en");
      if (url.indexOf("api.bigdatacloud.net") !== -1) return url.replace(/([?&]localityLanguage=)nl(?=&|$)/, "$1en");
      return url;
    }
    window.fetch = function (invoer, opties) {
      try {
        var url = typeof invoer === "string" ? invoer : invoer && invoer.url ? String(invoer.url) : String(invoer || "");
        var nieuw = engels(url);
        if (nieuw !== url) invoer = typeof invoer === "string" || !invoer.url ? nieuw : new Request(nieuw, invoer);
        if (isWaarschuwingen(nieuw)) {
          /* Eerst onthouden, dan pas het antwoord aan de app geven: zo is de
             Engelse tekst bekend voordat hij op het scherm komt. */
          var registreer = function (d) {
            [].concat(d && d.lijst || []).forEach(function (w) { if (w && /^en/i.test(String(w.taal || ""))) { onthoud(w.titel); onthoud(w.tekst); } });
          };
          return origineel.call(this, invoer, opties).then(function (antwoord) {
            if (!antwoord) return antwoord;
            if (typeof antwoord.clone === "function") {
              return antwoord.clone().json().then(function (d) { registreer(d); return antwoord; }, function () { return antwoord; });
            }
            /* Antwoord zonder clone(): onthoud tijdens het lezen door de app. */
            var lees = antwoord.json;
            if (typeof lees === "function") antwoord.json = function () { return lees.call(antwoord).then(function (d) { registreer(d); return d; }); };
            return antwoord;
          });
        }
      } catch (e) { /* onbekende invoer: ongewijzigd doorgeven */ }
      return origineel.call(this, invoer, opties);
    };
  })();

  var html = document.documentElement;
  html.setAttribute("lang", "en-GB");
  html.setAttribute("data-taal", "en");
  var s = document.createElement("script");
  s.src = "/" + BUNDEL;
  s.async = false;
  (document.head || html).appendChild(s);
})();

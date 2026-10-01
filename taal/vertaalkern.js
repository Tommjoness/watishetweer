/*
 * Vertaalkern NL → EN (Brits Engels) voor watishetweer.nl.
 *
 * Werkt op hele tekstblokken, nooit woord voor woord:
 *   1. exacte teksten (knoppen, kopjes, labels) uit het woordenboek;
 *   2. zinspatronen met open plekken (getallen, tijden, plaatsen, dagen),
 *      ieder met een zelfgeschreven Engelse zin;
 *   3. een blok met meerdere zinnen wordt per zin vertaald en alleen
 *      vervangen als ÍEDERE zin een vertaling heeft.
 * Lukt dat niet, dan geeft de kern `null` terug: de aanroeper laat de tekst
 * dan staan en de taalbewaker meldt hem. Er wordt dus nooit half vertaald.
 *
 * UMD: in de browser `window.WeatherNowVertaalkern`, in Node `require()`.
 */
(function (root, maak) {
  const api = maak();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WeatherNowVertaalkern = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function schoon(s) {
    return String(s == null ? "" : s)
      .replace(/­/g, "")
      .replace(/[   ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* Nederlandse getallen naar Brits Engels: 0,9 → 0.9 en 1.750 → 1,750.
     Een min wordt het typografische minteken als het origineel dat had. */
  function getal(nl) {
    const s = String(nl).trim();
    if (/^[−-]?\d{1,3}(\.\d{3})+$/.test(s)) return s.replace(/\./g, ",");
    return s.replace(/(\d),(\d)/g, "$1.$2");
  }

  /* opties.bronEngels: een Set met officiële Engelse brontekst (bijvoorbeeld de
     Engelse waarschuwingstekst van MeteoAlarm). Die wordt nooit opnieuw vertaald. */
  function maakVertaler(woordenboek, opties = {}) {
    const exact = new Map();
    for (const [nl, en] of Object.entries(woordenboek.exact || {})) exact.set(schoon(nl), en);
    const patronen = (woordenboek.patronen || []).map(([re, en], i) => {
      if (!(re instanceof RegExp)) throw new Error(`Patroon ${i} is geen RegExp`);
      if (!re.source.startsWith("^") || !re.source.endsWith("$")) throw new Error(`Patroon ${i} moet de hele tekst dekken (^…$): ${re}`);
      return { re, en };
    });
    const hulp = { getal, t: null, alEngels: null, lijst: woordenboek.lijsten || {} };
    /* Alle Engelse teksten die deze vertaler zelf heeft gemaakt. De app leest
       soms een al vertaalde schermtekst terug en plakt die voor een
       Nederlandse zin (bijvoorbeeld in het aria-label van de neerslaggrafiek).
       Zo'n zin is dan al Engels en hoeft niet opnieuw vertaald te worden. */
    const gemaakt = new Set();

    function vertaalEen(tekst) {
      const s = schoon(tekst);
      if (!s) return s;
      if (exact.has(s)) return exact.get(s);
      for (const { re, en } of patronen) {
        const m = re.exec(s);
        if (!m) continue;
        const uit = typeof en === "function" ? en(m, hulp) : en.replace(/\$(\d)/g, (_, n) => m[Number(n)] ?? "");
        if (uit != null) { gemaakt.add(schoon(uit)); return uit; }
      }
      return null;
    }
    /* Een zin vertalen, of laten staan als hij al Engels is. */
    function vertaalOfEngels(z) {
      const v = vertaalEen(z);
      if (v != null) return v;
      return isAlEngels(z) ? schoon(z) : null;
    }

    /* Splitst alleen op een zinseinde gevolgd door een hoofdletter of cijfer;
       afkortingen als "km/u." komen in de patronen zelf voor. */
    function zinnen(s) { return s.split(/(?<=[.!?])\s+(?=[A-Z0-9ÀÉÖÜ"'(])/); }

    function vertaal(tekst) {
      const s = schoon(tekst);
      if (!s) return s;
      const direct = vertaalEen(s);
      if (direct != null) return direct;
      if (isAlEngels(s)) return s;
      const delen = zinnen(s);
      if (delen.length < 2) return null;
      const uit = [];
      for (const z of delen) {
        const v = vertaalOfEngels(z);
        if (v == null) return null;
        uit.push(v);
      }
      /* Een al Engelse tekst gevolgd door zijn eigen Nederlandse bron levert
         dezelfde zin(nen) twee keer achter elkaar op; die staan er één keer. */
      for (let i = 0; i < uit.length; i++) {
        for (let n = Math.floor((uit.length - i) / 2); n >= 1; n--) {
          let gelijk = true;
          for (let k = 0; k < n; k++) if (schoon(uit[i + k]) !== schoon(uit[i + n + k])) { gelijk = false; break; }
          if (gelijk) { uit.splice(i + n, n); n = Math.floor((uit.length - i) / 2) + 1; }
        }
      }
      const resultaat = uit.join(" ");
      gemaakt.add(schoon(resultaat));
      return resultaat;
    }
    /* Welke zinnen van een tekst geen vertaling hebben (voor de taalbewaker). */
    function onvertaald(tekst) {
      const s = schoon(tekst);
      if (!s || vertaalEen(s) != null || isAlEngels(s)) return [];
      const delen = zinnen(s);
      if (delen.length < 2) return [s];
      return delen.filter(z => vertaalOfEngels(z) == null);
    }
    hulp.t = vertaal;
    /* Teksten die al Engels zijn (bijvoorbeeld een door de app gekopieerde,
       eerder vertaalde knoptekst) hoeven niet opnieuw vertaald te worden. */
    const engels = new Set([...exact.values()].map(schoon));
    const bron = opties.bronEngels || null;
    function isAlEngels(tekst) { const t = schoon(tekst); return engels.has(t) || gemaakt.has(t) || !!(bron && bron.has(t)); }
    hulp.alEngels = isAlEngels;
    return { vertaal, vertaalEen, onvertaald, isAlEngels, schoon, getal, aantalExact: exact.size, aantalPatronen: patronen.length };
  }

  /* Teksten die in iedere taal gelijk blijven: getallen, tijden, eenheden,
     symbolen en eigennamen. De taalbewaker telt deze niet als onvertaald. */
  const NEUTRAAL = /^[\s\d.,:;/%°+−\-–—·•|()[\]→←↑↓×…*#'"!?<>›‹»«☀☾☼★✓✕×]*(km\/h|mm|cm|m|km|hPa|UV|AQI|°C|°F|h)?[\s\d.,:;/%°+−\-–—·•|()[\]→←↑↓…<>›‹»«☀☾☼★✓✕×]*$/;
  /* E-mailadressen, paden, querystrings en technische sleutels. */
  const TECHNISCH = /^(?:[\w.+-]+@[\w-]+(?:\.[\w-]+)+|[/?][\w/:=.&%-]*|[a-z][\w-]*(?:\.[\w-]+)+|[a-z]+[A-Z][A-Za-z]*)$/;
  function isNeutraal(s, eigennamen) {
    const t = schoon(s);
    if (!t) return true;
    if (NEUTRAAL.test(t) || TECHNISCH.test(t)) return true;
    if (eigennamen && eigennamen.has(t)) return true;
    return false;
  }

  return { schoon, getal, maakVertaler, isNeutraal };
});

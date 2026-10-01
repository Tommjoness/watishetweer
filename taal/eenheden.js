/*
 * Bepaalt de vertaaleenheden van een pagina, precies zoals de vertaallaag en
 * de taalbewaker ze zien. Een element waarvan alle kinderen "inline" zijn
 * (vet, span, afkorting, link, SVG-tspan …) is één zinsblok: de hele tekst
 * wordt als geheel vertaald, zodat Engelse woordvolgorde mogelijk blijft.
 * Elementen met blok-kinderen leveren alleen hun eigen losse tekstnodes.
 */
(function (root, maak) {
  const api = maak();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WeatherNowTaalEenheden = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const INLINE = new Set(["B", "STRONG", "EM", "I", "SPAN", "ABBR", "TIME", "SMALL", "SUP", "SUB", "A", "BR", "WBR", "CODE", "MARK", "U", "Q", "S", "tspan", "TSPAN"]);
  const OVERSLAAN = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "svg:style"]);
  const ATTRIBUTEN = ["aria-label", "title", "alt", "placeholder", "aria-description", "aria-valuetext"];

  function isAndereTaal(el) {
    const lang = el.getAttribute && el.getAttribute("lang");
    return !!lang && !/^nl\b/i.test(lang);
  }
  function tekstVan(el) { return (el.textContent || "").replace(/\s+/g, " ").trim(); }
  function heeftTekst(el) { return /\S/.test(el.textContent || ""); }
  function isOvergeslagen(el) {
    for (let e = el; e; e = e.parentElement) {
      if (OVERSLAAN.has(e.tagName)) return true;
      if (e.getAttribute && (e.getAttribute("translate") === "no" || e.hasAttribute("data-taal-vast"))) return true;
      /* Tekst die de app al als andere taal markeert (bijv. officiële Engelse
         NWS-tekst met lang="en") is brontekst en wordt niet vertaald. */
      if (e.getAttribute && e.tagName !== "HTML" && isAndereTaal(e)) return true;
    }
    return false;
  }
  function isZinsblok(el) {
    if (!heeftTekst(el)) return false;
    for (const kind of el.children) {
      if (!INLINE.has(kind.tagName)) return false;
      if (!isZinsblok(kind) && heeftTekst(kind)) return false;
    }
    return true;
  }

  /* Levert [{soort:"blok",el}, {soort:"tekst",node}, {soort:"attr",el,naam}] in documentvolgorde. */
  function eenheden(wortel) {
    const uit = [];
    function loop(el) {
      if (isOvergeslagen(el)) return;
      for (const naam of ATTRIBUTEN) {
        const v = el.getAttribute && el.getAttribute(naam);
        if (v && /\S/.test(v)) uit.push({ soort: "attr", el, naam, tekst: v.replace(/\s+/g, " ").trim() });
      }
      if (isZinsblok(el)) {
        uit.push({ soort: "blok", el, tekst: tekstVan(el) });
        for (const kind of el.querySelectorAll("*")) {
          for (const naam of ATTRIBUTEN) {
            const v = kind.getAttribute(naam);
            if (v && /\S/.test(v)) uit.push({ soort: "attr", el: kind, naam, tekst: v.replace(/\s+/g, " ").trim() });
          }
        }
        return;
      }
      for (const n of el.childNodes) {
        if (n.nodeType === 3) {
          const t = n.textContent.replace(/\s+/g, " ").trim();
          if (t) uit.push({ soort: "tekst", node: n, tekst: t });
        } else if (n.nodeType === 1) loop(n);
      }
    }
    loop(wortel);
    return uit;
  }

  return { eenheden, isZinsblok, isAndereTaal, INLINE, ATTRIBUTEN };
});

/*
 * Vertaallaag in de browser. Vertaalt de pagina na het laden en daarna iedere
 * tekst die de app later schrijft (MutationObserver), inclusief aria-label,
 * title, alt, placeholder en de documenttitel.
 *
 * Werkwijze per zinsblok (element met alleen inline kinderen):
 *   1. het hele blok wordt als één zin vertaald; inline kinderen (bijvoorbeeld
 *      een vet getal) blijven behouden als hun tekst letterlijk in de Engelse
 *      zin terugkomt;
 *   2. lukt dat niet, dan wordt iedere tekstnode apart vertaald (tegels met een
 *      los label en een losse waarde);
 *   3. een tekst zonder vertaling blijft in het Nederlands staan (nooit half
 *      vertaald) en komt in `window.__WIW_TAAL_ONTBREEKT__`, zodat de
 *      taalbewaker hem meldt.
 * Getallen en tijden die in iedere taal gelijk zijn, krijgen alleen de Engelse
 * decimaalpunt (0,9 → 0.9).
 */
(function (root, maak) {
  const api = maak();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WeatherNowVertaallaag = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function start(opties) {
    const { kern, eenheden: E, woordenboek, taal } = opties;
    const doc = opties.document || document;
    const vertaler = kern.maakVertaler(woordenboek, { bronEngels: opties.bronEngels });
    const eigennamen = new Set(woordenboek.eigennamen || []);
    const gezet = new WeakMap();          // node of element → tekst die wij schreven
    const gezetAttr = new WeakMap();      // element → Map(attribuut → tekst die wij schreven)
    const ontbreekt = new Set();
    let observer = null;

    function schoon(s) { return kern.schoon(s); }
    function neutraal(s) { return kern.isNeutraal(s, eigennamen); }
    function neutraalEn(s) { return s.replace(/(\d),(\d)/g, "$1.$2"); }
    /* Smalle kolomkoppen krijgen een korte vorm (bijv. "Precip."), zodat het
       Engels net zo goed in de kolom past als het Nederlands. */
    const koppen = woordenboek.koppen || {};
    const kopSelector = woordenboek.kopSelector || "";
    function kopVorm(el, s) {
      if (!kopSelector || !el || !el.closest) return null;
      const kort = koppen[schoon(s)];
      return kort && el.closest(kopSelector) ? kort : null;
    }

    /* Vertaalt één losse tekst; null als er geen vertaling is. */
    function vertaalTekst(ruw, el) {
      const s = schoon(ruw);
      if (!s) return ruw;
      const kort = kopVorm(el, s);
      if (kort) return kort;
      if (neutraal(s)) return neutraalEn(ruw);
      if (vertaler.isAlEngels(s)) return ruw;
      const en = vertaler.vertaal(s);
      if (en == null) { ontbreekt.add(s); return null; }
      /* Witruimte rond de tekst blijft staan, zodat inline-opmaak niet aan elkaar plakt. */
      const voor = /^\s/.test(ruw) ? " " : "", na = /\s$/.test(ruw) ? " " : "";
      return voor + en + na;
    }

    /* Rem op heen-en-weer schrijven: als de app een tekst direct terugzet
       nadat wij hem vertaalden, stopt de laag na 20 keer binnen 2 seconden
       even met die node, zodat de pagina nooit vastloopt. */
    const schrijfteller = new WeakMap();
    function magSchrijven(doel) {
      const nu = Date.now();
      const t = schrijfteller.get(doel) || { n: 0, sinds: nu, rustTot: 0 };
      if (nu < t.rustTot) return false;
      if (nu - t.sinds > 2000) { t.n = 0; t.sinds = nu; }
      t.n++;
      if (t.n > 20) {
        t.rustTot = nu + 5000; t.n = 0; t.sinds = nu; schrijfteller.set(doel, t);
        /* Nooit stil: de taalbewaker moet een tekst zien die blijft terugspringen. */
        ontbreekt.add("↻ " + schoon(doel.textContent || "").slice(0, 120));
        return false;
      }
      schrijfteller.set(doel, t);
      return true;
    }

    function zetTekst(node, tekst) {
      if (node.textContent !== tekst) {
        if (!magSchrijven(node)) return;
        node.textContent = tekst;
      }
      gezet.set(node, tekst);
    }

    function tekstnodes(el) {
      const uit = [];
      const loop = doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
      for (let n = loop.nextNode(); n; n = loop.nextNode()) if (/\S/.test(n.textContent)) uit.push(n);
      return uit;
    }

    /* Zet een Engelse zin terug in een blok en houdt inline kinderen waar mogelijk. */
    function herbouwBlok(el, en) {
      const kinderen = [...el.children].filter(k => /\S/.test(k.textContent || ""));
      const delen = [];
      let rest = en, gelukt = true;
      for (const kind of kinderen) {
        const eigen = schoon(kind.textContent);
        const kindEn = E.isAndereTaal(kind) ? eigen : neutraal(eigen) ? neutraalEn(eigen) : vertaler.vertaal(eigen);
        const pos = kindEn == null ? -1 : rest.indexOf(kindEn);
        if (pos < 0) { gelukt = false; break; }
        delen.push(rest.slice(0, pos), { kind, tekst: kindEn });
        rest = rest.slice(pos + kindEn.length);
      }
      if (!gelukt) { el.textContent = en; return; }
      delen.push(rest);
      const frag = doc.createDocumentFragment();
      for (const d of delen) {
        if (typeof d === "string") { if (d) frag.appendChild(doc.createTextNode(d)); continue; }
        const nodes = tekstnodes(d.kind);
        if (E.isAndereTaal(d.kind)) { /* brontekst in andere taal blijft letterlijk */ }
        else if (nodes.length === 1) zetTekst(nodes[0], d.tekst);
        /* Een kind met eigen inline elementen ("Mail naar <a>…</a>") wordt
           op dezelfde manier herbouwd; textContent zou de link wissen. */
        else if (d.kind.children.length) herbouwBlok(d.kind, d.tekst);
        else d.kind.textContent = d.tekst;
        frag.appendChild(d.kind);
      }
      el.textContent = "";
      el.appendChild(frag);
    }

    function verwerkBlok(el) {
      const tekst = schoon(el.textContent);
      if (gezet.get(el) === tekst) return;
      const nodes = tekstnodes(el);
      if (nodes.every(n => gezet.get(n) === n.textContent)) { gezet.set(el, tekst); return; }
      /* Eerst het hele blok als één zin; inline kinderen blijven waar hun tekst terugkomt. */
      const en = kopVorm(el, tekst) || (neutraal(tekst) ? neutraalEn(tekst) : vertaler.vertaal(tekst));
      if (en != null) {
        if (!magSchrijven(el)) return;
        herbouwBlok(el, en);
        for (const n of tekstnodes(el)) gezet.set(n, n.textContent);
        gezet.set(el, schoon(el.textContent));
        return;
      }
      /* Dan per tekstnode: voor blokken die uit losse labels en waarden bestaan
         (plaatsnaam + provincie, label + waarde). Wat geen vertaling heeft,
         blijft staan en wordt als losse tekst gemeld. */
      /* Dan per tekstnode: blokken die uit losse delen bestaan (label + waarde,
         twee korte zinnen in eigen spans). Alleen als ieder deel een vertaling
         heeft; anders blijft lopende tekst heel en Nederlands en worden de
         ontbrekende zinnen gemeld. Losse labels zonder zinsbouw mogen wel
         gedeeltelijk (bijv. plaatsnaam + provincie). */
      const perNode = nodes.map(n => (gezet.get(n) === n.textContent ? n.textContent : vertaalStil(n.textContent, n.parentElement)));
      if (perNode.every(v => v != null)) {
        nodes.forEach((n, i) => zetTekst(n, perNode[i]));
        gezet.set(el, schoon(el.textContent));
        return;
      }
      if (/[.!?]\s+\S|[.!?]$/.test(tekst) && tekst.length > 40) {
        for (const z of vertaler.onvertaald(tekst)) ontbreekt.add(z);
        return;
      }
      for (const n of nodes) {
        if (gezet.get(n) === n.textContent) continue;
        const v = vertaalTekst(n.textContent, n.parentElement);
        if (v != null) zetTekst(n, v);
      }
      gezet.set(el, schoon(el.textContent));
    }

    /* Als vertaalTekst, maar zonder iets als ontbrekend te melden. */
    function vertaalStil(ruw, el) {
      const s = schoon(ruw);
      if (!s) return ruw;
      const kort = kopVorm(el, s);
      if (kort) return kort;
      if (neutraal(s)) return neutraalEn(ruw);
      if (vertaler.isAlEngels(s)) return ruw;
      const en = vertaler.vertaal(s);
      if (en == null) return null;
      return (/^\s/.test(ruw) ? " " : "") + en + (/\s$/.test(ruw) ? " " : "");
    }

    function verwerkTekstnode(node) {
      if (gezet.get(node) === node.textContent) return;
      const en = vertaalTekst(node.textContent, node.parentElement);
      if (en != null) zetTekst(node, en);
    }

    function verwerkAttribuut(el, naam) {
      const waarde = el.getAttribute(naam);
      if (!waarde || !/\S/.test(waarde)) return;
      let kaart = gezetAttr.get(el);
      if (kaart && kaart.get(naam) === waarde) return;
      const en = vertaalTekst(waarde);
      if (en == null) return;
      const uit = schoon(en);
      if (!kaart) { kaart = new Map(); gezetAttr.set(el, kaart); }
      kaart.set(naam, uit);
      if (waarde !== uit && magSchrijven(el)) el.setAttribute(naam, uit);
    }

    function verwerk(wortel) {
      for (const e of E.eenheden(wortel)) {
        if (e.soort === "blok") verwerkBlok(e.el);
        else if (e.soort === "tekst") verwerkTekstnode(e.node);
        else verwerkAttribuut(e.el, e.naam);
      }
    }

    function verwerkTitel() {
      const t = doc.title;
      if (!t || gezet.get(doc) === t) return;
      const en = vertaalTekst(t);
      if (en == null) return;
      const uit = schoon(en);
      gezet.set(doc, uit);
      if (uit !== t) doc.title = uit;
    }

    /* Hoogste voorouder die nog één zinsblok vormt: daar begint de vertaling. */
    function blokWortel(el) {
      let huidig = el;
      while (huidig && huidig.parentElement && huidig.parentElement !== doc.body && E.isZinsblok(huidig.parentElement)) huidig = huidig.parentElement;
      return huidig;
    }

    function verwerkMutaties(lijst) {
      const wortels = new Set();
      let titel = false;
      for (const m of lijst) {
        const doel = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (!doel) continue;
        if (doel.closest && doel.closest("title")) { titel = true; continue; }
        if (!doc.body || !doc.body.contains(doel)) continue;
        if (m.type === "attributes") { verwerkAttribuut(doel, m.attributeName); continue; }
        wortels.add(blokWortel(doel));
      }
      /* Alleen de buitenste wortels: een wortel binnen een andere wordt toch meegenomen. */
      for (const w of wortels) {
        let binnen = false;
        for (const ander of wortels) if (ander !== w && ander.contains(w)) { binnen = true; break; }
        if (!binnen && w.isConnected) verwerk(w);
      }
      if (titel) verwerkTitel();
      if (observer) observer.takeRecords();
    }

    /* Vertalen op het moment van schrijven. Code in de app die haar eigen
       tekst bewaakt ("staat er niet X, zet dan X") schrijft zo meteen de
       vertaling, en als die er al staat verandert er niets: geen heen-en-weer
       tussen app en vertaallaag, en geen kort Nederlands moment. */
    function onderschepTextContent() {
      const Proto = typeof Node !== "undefined" ? Node.prototype : null;
      const d = Proto && Object.getOwnPropertyDescriptor(Proto, "textContent");
      if (!d || !d.set || !d.configurable) return;
      Object.defineProperty(Proto, "textContent", {
        configurable: true, enumerable: d.enumerable, get: d.get,
        set(waarde) {
          if (typeof waarde === "string" && waarde && (this.nodeType === 1 || this.nodeType === 3) && this.isConnected !== false && !binnenVast(this)) {
            const en = vertaalStil(waarde, this.nodeType === 1 ? this : this.parentElement);
            if (en != null && en !== waarde) {
              if (d.get.call(this) === en) return;
              d.set.call(this, en);
              const t = this.nodeType === 3 ? this : this.firstChild;
              if (t && t.nodeType === 3 && !t.nextSibling) gezet.set(t, en);
              if (this.nodeType === 1) gezet.set(this, schoon(en));
              return;
            }
          }
          d.set.call(this, waarde);
        }
      });
    }
    function binnenVast(node) {
      for (let e = node.nodeType === 1 ? node : node.parentElement; e; e = e.parentElement) {
        if (e.tagName === "SCRIPT" || e.tagName === "STYLE" || e.tagName === "TITLE") return true;
        if (e.getAttribute && (e.getAttribute("translate") === "no" || e.hasAttribute("data-taal-vast"))) return true;
        if (e.tagName !== "HTML" && E.isAndereTaal(e)) return true;
      }
      return false;
    }

    const html = doc.documentElement;
    if (opties.onderschep !== false) onderschepTextContent();
    html.setAttribute("lang", taal || "en-GB");
    verwerkTitel();
    if (doc.body) verwerk(doc.body);
    if (typeof MutationObserver === "function") {
      observer = new MutationObserver(verwerkMutaties);
      observer.observe(html, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: E.ATTRIBUTEN });
    }
    html.setAttribute("data-taal-klaar", "");
    const staat = { ontbreekt, vertaler, verwerk, stop() { if (observer) observer.disconnect(); } };
    if (typeof window !== "undefined") window.__WIW_TAAL_ONTBREEKT__ = ontbreekt;
    return staat;
  }

  return { start };
});

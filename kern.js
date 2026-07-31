// Laadt de echte app-code uit index.html en draait die in een nagebootste browser,
// zodat de tests de functies toetsen die ook live staan en niet een kopie ervan.
//
// Er is bewust geen jsdom of andere afhankelijkheid: de app raakt maar een klein
// stuk van de DOM aan en dat stuk namaken is minder werk dan een pakket erbij.
// Wat de app niet gebruikt zit hier ook niet in.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const BRON = path.join(__dirname, "index.html");

// Wat de tests uit de app moeten kunnen aanroepen. Ontbreekt er iets, dan is een
// functie hernoemd of verdwenen en moet de test dat melden, niet stilletjes overslaan.
const NODIG = ["S", "opOnder", "maan", "bft", "BFTNAAM", "nl",
               "meters", "briefing", "nowcast", "etmaal", "dagen", "nachten"];

// Handig om bij de hand te hebben, maar niet fataal als het er niet is.
const EXTRA = ["plaatsNu", "plaatsNuIndex", "plaatsKlok", "nuTimerStart", "clearNuTimer",
               "klokTimerStart", "clearKlokTimer", "klokBijwerken", "locatieNu", "afstandKm", "kompasKort", "dagDeel", "maanUnicode", "tekenAlles", "load", "chips", "controle", "lucht", "stempel", "icon", "hhmm", "kompas",
               "piek", "restkans", "daglengte", "nbsp", "esc", "clamp",
               "mins", "naarLokaal",
               "CODES", "DIRSVOL", "DAGEN", "BFT", "THEMAS", "ls"];

/* ---------- de app-code uit index.html halen ---------- */

let gecached = null;

function appBron() {
  if (gecached) return gecached;

  const html = fs.readFileSync(BRON, "utf8");
  const blokken = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]);
  if (!blokken.length) throw new Error("geen inline scriptblok gevonden in index.html");

  // typeof vangt een naam op die niet bestaat zonder de hele boel te laten klappen,
  // zodat we zelf een leesbare fout kunnen geven in plaats van een ReferenceError
  const regels = NODIG.concat(EXTRA)
    .map(n => "  __uit." + n + " = (typeof " + n + ' === "undefined" ? undefined : ' + n + ");")
    .join("\n");

  gecached = blokken.join("\n;\n")
    + "\n;(function(){\n  const __uit = {};\n" + regels
    + "\n  globalThis.__api = __uit;\n})();\n";
  return gecached;
}

/* ---------- de nagebootste browser ---------- */

function maakStijl() {
  const o = {};
  o.setProperty = (naam, waarde) => { o[naam] = waarde; };
  o.removeProperty = naam => { delete o[naam]; };
  return o;
}

function maakKlassen(el) {
  // Bij een vers maakElement()-element is className altijd "", dus dit verandert
  // niets voor bestaande tests. Bij een via parseFragment geparst element staat
  // className al vóór dit moment gezet (uit het class-attribuut), en zonder deze
  // seed begint classList.contains() dan ten onrechte bij een lege verzameling.
  const set = new Set((el.className || "").split(/\s+/).filter(Boolean));
  return {
    add: (...k) => { k.forEach(x => set.add(x)); el.className = [...set].join(" "); },
    remove: (...k) => { k.forEach(x => set.delete(x)); el.className = [...set].join(" "); },
    toggle: (k, aan) => {
      const wil = aan === undefined ? !set.has(k) : !!aan;
      if (wil) set.add(k); else set.delete(k);
      el.className = [...set].join(" ");
      return wil;
    },
    contains: k => set.has(k)
  };
}

function maakTekenvlak() {
  // de radar wordt in de tests niet getekend, maar een ontbrekende methode mag
  // nooit de reden zijn dat een test omvalt
  return new Proxy({}, {
    get(o, k) {
      if (k === "measureText") return t => ({ width: String(t).length * 6 });
      if (k === "createLinearGradient" || k === "createRadialGradient")
        return () => ({ addColorStop() {} });
      if (k === "getImageData") return () => ({ data: [] });
      if (k in o) return o[k];
      return (o[k] = () => {});
    },
    set(o, k, v) { o[k] = v; return true; }
  });
}

/* Zeer beperkte HTML-fragmentparser, uitsluitend voor de eenvoudige, ondiepe
   markup die deze app zelf via innerHTML genereert (spans/divs met class, id
   en data-*-attributen, geen self-closing tags, geen commentaar, geen
   <script>). Geen poging tot een volledige HTML-parser: hij hoeft alleen
   chips(), waarschuwingen() en vergelijkbare eenvoudige lijstjes te kunnen
   naspelen zodat click/keydown-handlers die de app zelf via
   querySelectorAll(...) koppelt, ook daadwerkelijk op iets aangrijpen. */
function parseFragment(html, doc) {
  const root = { children: [], tagName: "#fragment", _tekst: "" };
  const stack = [root];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|([^<]+)/g;
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'))?/g;
  let m;
  while ((m = re.exec(String(html)))) {
    if (m[5] !== undefined) { stack[stack.length - 1]._tekst += m[5]; continue; }
    const sluit = m[1] === "/", tag = m[2].toLowerCase(), attrsRaw = m[3] || "", zelfsluitend = m[4] === "/";
    if (sluit) {
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tagName.toLowerCase() === tag) { stack.length = i; break; }
      continue;
    }
    const attrs = {};
    attrRe.lastIndex = 0;
    let am;
    while ((am = attrRe.exec(attrsRaw))) {
      attrs[am[1]] = am[3] !== undefined ? am[3] : (am[4] !== undefined ? am[4] : "");
    }
    const kind = maakElement(attrs.id || "", doc);
    kind.tagName = tag.toUpperCase();
    kind.className = attrs["class"] || "";
    kind.classList = maakKlassen(kind);
    kind._attr = attrs;
    Object.keys(attrs).forEach(k => {
      if (k.indexOf("data-") === 0) kind.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = attrs[k];
    });
    kind._tekst = "";
    kind._parent = stack[stack.length - 1];
    stack[stack.length - 1].children.push(kind);
    if (!zelfsluitend) stack.push(kind);
  }
  const zetText = node => {
    node.children.forEach(zetText);
    node.textContent = (node._tekst || "") + node.children.map(k => k.textContent).join("");
  };
  zetText(root);
  return root.children;
}

// komt overeen met bv. "div.chip[data-i]", ".x", "#chipadd", "[data-lat]"
function matchtSelector(el, sel) {
  const stuk = /^([a-zA-Z][a-zA-Z0-9-]*)?((?:\.[-\w]+)*)((?:#[-\w]+)?)((?:\[[^\]]+\])*)$/.exec(sel.trim());
  if (!stuk) return false;
  const [, tag, klassen, id, attrs] = stuk;
  if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
  if (klassen) {
    const nodig = klassen.split(".").filter(Boolean);
    const heeft = (el.className || "").split(/\s+/).filter(Boolean);
    if (!nodig.every(k => heeft.includes(k))) return false;
  }
  if (id && el.id !== id.slice(1)) return false;
  if (attrs) {
    const paren = attrs.match(/\[[^\]]+\]/g) || [];
    for (const p of paren) {
      const inhoud = p.slice(1, -1);
      const gelijk = inhoud.match(/^([-\w]+)="([^"]*)"$/) || inhoud.match(/^([-\w]+)='([^']*)'$/);
      if (gelijk) { if ((el._attr || {})[gelijk[1]] !== gelijk[2]) return false; }
      else { if (!Object.prototype.hasOwnProperty.call(el._attr || {}, inhoud)) return false; }
    }
  }
  return true;
}
function alleAfstammelingen(el) {
  const uit = [];
  (el.children || []).forEach(k => { uit.push(k); uit.push(...alleAfstammelingen(k)); });
  return uit;
}
function bevatNode(el, zoek) {
  if (!el || !zoek) return false;
  for (const k of (el.children || [])) { if (k === zoek || bevatNode(k, zoek)) return true; }
  return false;
}

function maakElement(id, doc) {
  let _html = "";
  const el = {
    id: id || "",
    tagName: "DIV",
    textContent: "",
    innerText: "",
    value: "",
    className: "",
    checked: false,
    disabled: false,
    selectedIndex: 0,
    width: 640,
    height: 470,
    min: "0", max: "0", step: "1",
    dataset: {},
    children: [],
    style: maakStijl(),
    _attr: {},
    setAttribute(n, v) { this._attr[n] = String(v); },
    getAttribute(n) { return Object.prototype.hasOwnProperty.call(this._attr, n) ? this._attr[n] : null; },
    removeAttribute(n) { delete this._attr[n]; },
    hasAttribute(n) { return Object.prototype.hasOwnProperty.call(this._attr, n); },
    _handlers: {},
    /* Eerder waren dit no-ops: een test kon nooit een echt pointerevent laten
       afgaan op een addEventListener-handler uit de app. Nu worden handlers per
       type bewaard en kan dispatchEvent ze daadwerkelijk aanroepen, zodat een
       regressietest voor bijvoorbeeld de scrub-tooltip een echte pointermove
       kan simuleren in plaats van alleen de broncode te doorzoeken. */
    addEventListener(type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); },
    removeEventListener(type, fn) {
      if (this._handlers[type]) this._handlers[type] = this._handlers[type].filter(h => h !== fn);
    },
    dispatchEvent(ev) {
      const type = ev && ev.type;
      (this._handlers[type] || []).forEach(fn => fn(ev));
      return true;
    },
    click() {},
    focus() {},
    blur() {},
    select() {},
    scrollIntoView() {},
    remove() {},
    appendChild(k) { this.children.push(k); return k; },
    removeChild(k) { this.children = this.children.filter(x => x !== k); return k; },
    insertAdjacentHTML(waar, h) { this.innerHTML += h; },
    getContext() { return maakTekenvlak(); },
    getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, right: 900, bottom: 300, width: 900, height: 300 }; },
    closest() { return null; },
    /* querySelector(All) en contains() werken nu echt, tegen de laatst gezette
       innerHTML geparsed met parseFragment. innerHTML zelf blijft voor de rest
       van de tests een gewone string: de getter geeft precies terug wat er is
       gezet, dus elke bestaande regex-check op .innerHTML blijft ongewijzigd
       werken. Alleen wie nu ook querySelector(All) gebruikt, krijgt er iets
       bruikbaars voor terug. */
    querySelectorAll(sel) { return alleAfstammelingen(this).filter(k => matchtSelector(k, sel)); },
    querySelector(sel) { return alleAfstammelingen(this).find(k => matchtSelector(k, sel)) || null; },
    contains(node) { return node === this || bevatNode(this, node); }
  };
  Object.defineProperty(el, "innerHTML", {
    get() { return _html; },
    set(v) {
      _html = v;
      try { this.children = parseFragment(v, doc); } catch (e) { this.children = []; }
    },
    enumerable: true
  });
  el.classList = maakKlassen(el);
  return el;
}

function maakDocument(idsVooraf) {
  const bak = Object.create(null);
  const _handlers = {};
  const doc = {
    title: "",
    visibilityState: "visible",
    addEventListener(type, fn) { (_handlers[type] = _handlers[type] || []).push(fn); },
    removeEventListener(type, fn) {
      if (_handlers[type]) _handlers[type] = _handlers[type].filter(h => h !== fn);
    },
    dispatchEvent(ev) {
      const type = ev && ev.type;
      (_handlers[type] || []).forEach(fn => fn(ev));
      return true;
    },
    createElement(tag) { const e = maakElement("", doc); e.tagName = String(tag).toUpperCase(); return e; },
    getElementById(id) {
      if (!bak[id]) bak[id] = maakElement(id, doc);
      return bak[id];
    },
    // de app zoekt op een handvol klassen; een leeg element is genoeg om
    // .style en .classList op aan te spreken zonder over null te struikelen
    querySelector(sel) {
      const sleutel = "sel:" + sel;
      if (!bak[sleutel]) bak[sleutel] = maakElement("", doc);
      return bak[sleutel];
    },
    querySelectorAll() { return []; }
  };
  doc.documentElement = maakElement("html", doc);
  doc.body = maakElement("body", doc);
  doc.head = maakElement("head", doc);
  idsVooraf.forEach(id => doc.getElementById(id));
  return { doc, bak };
}

function maakOpslag() {
  const m = new Map();
  return {
    getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: k => { m.delete(String(k)); },
    clear: () => m.clear(),
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; }
  };
}

/* ---------- een verse app-omgeving opzetten ---------- */

function idsUitHtml() {
  const html = fs.readFileSync(BRON, "utf8");
  return [...new Set([...html.matchAll(/\sid="([\w-]+)"/g)].map(m => m[1]))];
}

let idsGecached = null;

/**
 * Draait index.html in een lege omgeving en geeft de functies terug.
 * @param {number} breedte  schermbreedte in px, bepaalt of de app de telefoonopmaak kiest
 * @param {object} [opties]
 * @param {string} [opties.zoek]            location.search, bv. "?lat=52.1&lon=4.3&plaats=Delft" of "?hier=1"
 * @param {object|null} [opties.opgeslagen] vooraf in localStorage onder KEY_P gezet, bv. {lat,lon,label}
 * @param {function} [opties.geo]           vervangt getCurrentPosition(gelukt,mislukt,opties) volledig
 * @param {string} [opties.permissieStatus] "granted"|"denied"|"prompt"; ontbreekt = geen Permissions API (Safari/iOS)
 * @param {function} [opties.fetch]         vervangt fetch(url); standaard blijft alles onbeantwoord hangen
 * @returns {{api:object, bak:object, venster:object}}
 */
function laadKern(breedte, opties) {
  opties = opties || {};
  if (!idsGecached) idsGecached = idsUitHtml();
  const { doc, bak } = maakDocument(idsGecached);

  // Netwerk hangt bewust: elke ophaalpoging blijft open staan, dus de app komt
  // nooit voorbij zijn eigen laadstap en overschrijft de testdata niet. Een
  // openstaande belofte houdt node niet in leven, een timer zou dat wel doen.
  // De teller staat een test toe te bevestigen dat een actie geen fetch
  // veroorzaakt, zonder dat dat afhangt van wat er ooit mee zou resolven.
  // Een test kan dit met opties.fetch vervangen (bv. voor reverse geocoding of
  // een load()-aanroep die wél moet resolven); de teller blijft dan meelopen.
  const fetchStaat = { teller: 0 };
  const nooit = () => { fetchStaat.teller++; return new Promise(() => {}); };
  const fetchImpl = opties.fetch
    ? (...a) => { fetchStaat.teller++; return opties.fetch(...a); }
    : nooit;

  /* Nagebootste timers: geen echte klok, maar een handmatig te verzetten teller.
     Eerder deden setTimeout/setInterval hier niets en verdwenen ze meteen; dat
     werkte zolang een test toch elke functie zelf aanriep, maar een regressie
     als "na een minuut werkt de klok bij" is daarmee niet na te spelen. Nu
     bewaart elke oproep zijn functie en resterende tijd, en verzet
     avancerenTimers(ms) de klok in stapjes zodat ook een interval dat binnen
     die periode meerdere keren zou aflopen, ook echt meerdere keren vuurt. */
  let volgendTimerId = 1;
  const timers = new Map();
  function _timerPlannen(fn, ms, periode) {
    const id = volgendTimerId++;
    timers.set(id, { fn, resterend: Number(ms) || 0, periode: periode || null });
    return id;
  }
  function avancerenTimers(ms) {
    let over = Number(ms) || 0;
    while (over > 0) {
      let volgende = null;
      for (const t of timers.values()) if (volgende === null || t.resterend < volgende) volgende = t.resterend;
      if (volgende === null || volgende > over) {
        for (const t of timers.values()) t.resterend -= over;
        break;
      }
      for (const t of timers.values()) t.resterend -= volgende;
      over -= volgende;
      const klaar = [...timers.entries()].filter(([, t]) => t.resterend <= 0);
      for (const [id, t] of klaar) {
        if (t.periode) t.resterend = t.periode; else timers.delete(id);
        t.fn();
      }
    }
  }

  const venster = {
    innerWidth: breedte || 1280,
    innerHeight: 900,
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
    scrollTo() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
  };

  const zand = {
    document: doc,
    window: venster,
    self: venster,
    navigator: Object.assign({
      userAgent: "Weerbriefing-test",
      language: "nl-NL",
      onLine: true,
      geolocation: opties.geoOntbreekt ? undefined : {
        getCurrentPosition: opties.geo || ((_ok, mis) => { if (mis) mis({ code: 2, message: "geen locatie in de test" }); }),
        watchPosition() { return 0; },
        clearWatch() {}
      }
      // serviceWorker staat er bewust niet in, dan slaat de app het registreren over
    }, opties.permissieStatus !== undefined ? {
      permissions: { query: async () => ({ state: opties.permissieStatus }) }
    } : {}),
    location: { href: "https://test.local/" + (opties.zoek || ""), search: opties.zoek || "", pathname: "/", origin: "https://test.local", hash: "" },
    localStorage: maakOpslag(),
    sessionStorage: maakOpslag(),
    fetch: fetchImpl,
    // tijdgestuurde dingen: geen echte klok, zie avancerenTimers hierboven
    setTimeout: (fn, ms) => _timerPlannen(fn, ms, null),
    clearTimeout: id => { timers.delete(id); },
    setInterval: (fn, ms) => _timerPlannen(fn, ms, Number(ms) || 0),
    clearInterval: id => { timers.delete(id); },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    queueMicrotask: fn => Promise.resolve().then(fn),
    URL, URLSearchParams, AbortController, AbortSignal, TextEncoder, TextDecoder,
    Image: function Image() { return maakElement("", doc); },
    // meldingen uit de app zelf horen niet in de testuitvoer, echte fouten wel
    console: { log() {}, info() {}, debug() {}, warn: console.warn, error: console.error }
  };
  zand.globalThis = zand;
  zand.top = venster;
  zand.parent = venster;

  // vooraf in localStorage zetten: KEY_P ("weerbriefing.plaats") is een vaste
  // sleutel in de app zelf, dus rechtstreeks zo genoemd om geen kopie van die
  // naam hier te hoeven onderhouden
  if (opties.opgeslagen !== undefined && opties.opgeslagen !== null) {
    zand.localStorage.setItem("weerbriefing.plaats", JSON.stringify(opties.opgeslagen));
  }

  vm.createContext(zand);
  try {
    vm.runInContext(appBron(), zand, { filename: "index.html", timeout: 20000 });
  } catch (e) {
    throw new Error("index.html liep vast tijdens het laden: " + (e && e.message ? e.message : e));
  }

  const api = zand.__api;
  if (!api) throw new Error("de app gaf niets terug, is het scriptblok in index.html gewijzigd?");

  const kwijt = NODIG.filter(n => api[n] === undefined);
  if (kwijt.length) {
    throw new Error("deze namen staan niet meer in index.html: " + kwijt.join(", ")
      + ". Pas NODIG in test/kern.js aan, of herstel de naam in de app.");
  }

  return { api, bak, venster, avancerenTimers, fetchStaat, doc, timerAantal: () => timers.size, localStorage: zand.localStorage };
}

module.exports = { laadKern };

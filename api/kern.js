// Laadt de echte app-code uit index.html en draait die in een nagebootste browser,
// zodat de tests de functies toetsen die ook live staan en niet een kopie ervan.
//
// Er is bewust geen jsdom of andere afhankelijkheid: de app raakt maar een klein
// stuk van de DOM aan en dat stuk namaken is minder werk dan een pakket erbij.
// Wat de app niet gebruikt zit hier ook niet in.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const BRON = path.join(__dirname, "..", "index.html");

// Wat de tests uit de app moeten kunnen aanroepen. Ontbreekt er iets, dan is een
// functie hernoemd of verdwenen en moet de test dat melden, niet stilletjes overslaan.
const NODIG = ["S", "opOnder", "maan", "bft", "BFTNAAM", "nl",
               "meters", "briefing", "nowcast", "etmaal", "dagen", "nachten"];

// Handig om bij de hand te hebben, maar niet fataal als het er niet is.
const EXTRA = ["load", "chips", "controle", "lucht", "stempel", "icon", "hhmm", "kompas",
               "piek", "restkans", "daglengte", "inNederland", "nbsp", "esc", "clamp",
               "mins", "naarLokaal", "radarTeken", "knmiVerwachting", "R",
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
  const set = new Set();
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

function maakElement(id, doc) {
  const el = {
    id: id || "",
    tagName: "DIV",
    textContent: "",
    innerHTML: "",
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
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
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
    querySelector(sel) { return doc.querySelector(sel); },
    querySelectorAll() { return []; },
    contains() { return false; }
  };
  el.classList = maakKlassen(el);
  return el;
}

function maakDocument(idsVooraf) {
  const bak = Object.create(null);
  const doc = {
    title: "",
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
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
 * @returns {{api:object, bak:object, venster:object}}
 */
function laadKern(breedte) {
  if (!idsGecached) idsGecached = idsUitHtml();
  const { doc, bak } = maakDocument(idsGecached);

  // Netwerk hangt bewust: elke ophaalpoging blijft open staan, dus de app komt
  // nooit voorbij zijn eigen laadstap en overschrijft de testdata niet. Een
  // openstaande belofte houdt node niet in leven, een timer zou dat wel doen.
  const nooit = () => new Promise(() => {});

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
    navigator: {
      userAgent: "Weerbriefing-test",
      language: "nl-NL",
      onLine: true,
      geolocation: {
        getCurrentPosition(_ok, mis) { if (mis) mis({ code: 2, message: "geen locatie in de test" }); },
        watchPosition() { return 0; },
        clearWatch() {}
      }
      // serviceWorker staat er bewust niet in, dan slaat de app het registreren over
    },
    location: { href: "https://test.local/", search: "", pathname: "/", origin: "https://test.local", hash: "" },
    localStorage: maakOpslag(),
    sessionStorage: maakOpslag(),
    fetch: nooit,
    // tijdgestuurde dingen doen in een test niets: de tests roepen elke functie zelf aan
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
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

  return { api, bak, venster };
}

module.exports = { laadKern };

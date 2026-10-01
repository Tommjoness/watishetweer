"use strict";

/*
 * Browsertest van de vertaallaag zelf, los van de weerapp: zinsblokken met
 * opmaak, losse labels, attributen, documenttitel, latere updates door de
 * app, getallen, translate="no" en de rem tegen heen-en-weer schrijven.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const TAAL = path.join(__dirname, "..", "taal");
const bron = ["vertaalkern.js", "eenheden.js", "vertaallaag.js"].map(f => fs.readFileSync(path.join(TAAL, f), "utf8")).join("\n;\n");

const woordenboek = `window.WeatherNowWoordenboekEn = {
  exact: { "Neerslag": "Precipitation", "Droog": "Dry", "Zoek een plaats": "Search for a place", "Weer vandaag": "Weather today", "Morgen": "Tomorrow" },
  patronen: [
    [/^Vannacht koelt het af naar ongeveer (\\d+) graden\\.$/, (m) => "Tonight it cools to about " + m[1] + " degrees."],
    [/^Deel het weer voor (.+)$/, (m) => "Share the weather for " + m[1]],
    [/^(\\d+) graden$/, (m) => m[1] + " degrees"],
    [/^Officiële titel: (.+) · Bron: (.+)$/, (m) => "Official title: " + m[1] + " · Source: " + m[2]]
  ],
  eigennamen: ["Almere"]
};`;

const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Weer vandaag</title></head><body>
<h2 id="kop">Neerslag</h2>
<p id="zin">Vannacht koelt het af naar ongeveer <b id="vet">12 graden</b>.</p>
<div id="tegel"><span>Neerslag</span><span>0,4 mm</span></div>
<button id="knop" aria-label="Deel het weer voor Almere">Almere</button>
<input id="zoek" placeholder="Zoek een plaats">
<p id="vast" translate="no">Neerslag</p>
<p id="onbekend">Dit staat niet in het woordenboek.</p>
<p id="later">Droog</p>
<p id="officieel">Officiële titel: <span lang="en" id="titel">Flood Watch</span> · Bron: National Weather Service</p>
<p id="bron" lang="en">Heavy rain may cause flooding.</p>
</body></html>`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage();
  const fouten = [];
  page.on("pageerror", e => fouten.push(e.message));
  await page.setContent(html);
  await page.addScriptTag({ content: bron + "\n" + woordenboek });
  await page.evaluate(() => {
    window.__staat = window.WeatherNowVertaallaag.start({ kern: window.WeatherNowVertaalkern, eenheden: window.WeatherNowTaalEenheden, woordenboek: window.WeatherNowWoordenboekEn, taal: "en-GB" });
  });

  const lees = () => page.evaluate(() => ({
    lang: document.documentElement.lang,
    titel: document.title,
    kop: document.getElementById("kop").textContent,
    zin: document.getElementById("zin").textContent,
    vet: document.getElementById("vet") && document.getElementById("vet").textContent,
    vetInZin: !!document.querySelector("#zin > b#vet"),
    tegel: [...document.querySelectorAll("#tegel span")].map(s => s.textContent),
    knopLabel: document.getElementById("knop").getAttribute("aria-label"),
    knop: document.getElementById("knop").textContent,
    zoek: document.getElementById("zoek").getAttribute("placeholder"),
    vast: document.getElementById("vast").textContent,
    onbekend: document.getElementById("onbekend").textContent,
    officieel: document.getElementById("officieel").textContent,
    titelBlijftEn: document.getElementById("titel") && document.getElementById("titel").getAttribute("lang") === "en" && document.getElementById("titel").parentElement.id === "officieel",
    bron: document.getElementById("bron").textContent,
    ontbreekt: [...window.__WIW_TAAL_ONTBREEKT__]
  }));

  let r = await lees();
  assert.equal(r.lang, "en-GB");
  assert.equal(r.titel, "Weather today", "documenttitel wordt vertaald");
  assert.equal(r.kop, "Precipitation");
  assert.equal(r.zin, "Tonight it cools to about 12 degrees.", "zin met vet getal wordt als geheel vertaald");
  assert(r.vetInZin && r.vet === "12 degrees", "het vette deel blijft hetzelfde element met Engelse inhoud");
  assert.deepEqual(r.tegel, ["Precipitation", "0.4 mm"], "label en waarde apart; decimaalkomma wordt punt");
  assert.equal(r.knopLabel, "Share the weather for Almere", "aria-label wordt vertaald");
  assert.equal(r.knop, "Almere", "eigennaam blijft staan");
  assert.equal(r.zoek, "Search for a place", "placeholder wordt vertaald");
  assert.equal(r.vast, "Neerslag", "translate=no blijft onaangeroerd");
  assert.equal(r.onbekend, "Dit staat niet in het woordenboek.", "zonder vertaling blijft de tekst heel en Nederlands");
  assert.deepEqual(r.ontbreekt, ["Dit staat niet in het woordenboek."], "alleen de onvertaalde tekst wordt gemeld");
  assert.equal(r.officieel, "Official title: Flood Watch · Source: National Weather Service", "zin rond officiële Engelse titel wordt vertaald");
  assert(r.titelBlijftEn, "de officiële titel (lang=en) blijft hetzelfde element");
  assert.equal(r.bron, "Heavy rain may cause flooding.", "officiële Engelse brontekst blijft onaangeroerd en wordt niet gemeld");

  /* Latere updates door de app. */
  await page.evaluate(() => {
    document.getElementById("later").textContent = "Morgen";
    document.getElementById("zin").innerHTML = "Vannacht koelt het af naar ongeveer <b>7 graden</b>.";
    document.getElementById("knop").setAttribute("aria-label", "Deel het weer voor Oss");
    document.title = "Neerslag";
    const nieuw = document.createElement("p"); nieuw.id = "nieuw"; nieuw.textContent = "Droog"; document.body.appendChild(nieuw);
  });
  await page.waitForTimeout(50);
  r = await page.evaluate(() => ({
    later: document.getElementById("later").textContent,
    zin: document.getElementById("zin").textContent,
    knopLabel: document.getElementById("knop").getAttribute("aria-label"),
    titel: document.title,
    nieuw: document.getElementById("nieuw").textContent
  }));
  assert.deepEqual(r, { later: "Tomorrow", zin: "Tonight it cools to about 7 degrees.", knopLabel: "Share the weather for Oss", titel: "Precipitation", nieuw: "Dry" }, "updates na het laden worden direct vertaald");

  /* App-code die haar eigen tekst bewaakt ("staat er niet X, zet X"): door
     vertalen-bij-schrijven ontstaat geen heen-en-weer en blijft het Engels. */
  const bewaakt = await page.evaluate(async () => {
    const el = document.createElement("p"); el.id = "bewaakt"; document.body.appendChild(el);
    let schrijfacties = 0;
    const zet = () => { if (el.textContent !== "Droog") { schrijfacties++; el.textContent = "Droog"; } };
    const obs = new MutationObserver(zet);
    obs.observe(el, { childList: true, characterData: true, subtree: true });
    zet();
    await new Promise(r => setTimeout(r, 300));
    obs.disconnect();
    return { tekst: el.textContent, schrijfacties, ontbreekt: [...window.__WIW_TAAL_ONTBREEKT__].filter(t => t.startsWith("↻")) };
  });
  assert.equal(bewaakt.tekst, "Dry", "bewaakte tekst staat in het Engels");
  assert(bewaakt.schrijfacties <= 25, `geen eindeloze lus (${bewaakt.schrijfacties} schrijfacties)`);

  /* Een app die de Nederlandse tekst steeds terugzet, laat de pagina niet vastlopen. */
  const duur = await page.evaluate(async () => {
    const el = document.getElementById("later");
    const obs = new MutationObserver(() => { if (el.textContent !== "Droog") el.textContent = "Droog"; });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
    const t0 = performance.now();
    el.textContent = "Droog";
    await new Promise(r => setTimeout(r, 300));
    obs.disconnect();
    return performance.now() - t0;
  });
  assert(duur < 2000, `heen-en-weer schrijven wordt geremd (duurde ${Math.round(duur)} ms)`);

  assert.deepEqual(fouten, [], "geen paginafouten");
  await browser.close();
  console.log("Vertaallaag-browsertest geslaagd: zinsblokken met opmaak, losse labels, attributen, titel, latere updates, getallen, translate=no en lusrem.");
})().catch(e => { console.error(e); process.exit(1); });

"use strict";
/*
 * Lichtvervuiling bij Nachtzicht (alleen Nederland):
 *   - het databestand heeft bron, peiljaar, licentie, methode en een geldig raster;
 *   - de grensgevallenregel geeft één klasse alleen als die buiten de foutmarge valt;
 *   - de opzoekfunctie in index.html geeft voor bekende plaatsen de verwachte weergave
 *     en buiten Nederland/het raster niets;
 *   - iedere regel heeft een Engelse vertaling, en de Over-pagina verantwoordt de bron.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.join(__dirname, "..");
const { vakKlasse } = require("./lichtvervuiling-raster.js");

/* 1. Databestand */
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "lichtvervuiling-nl.json"), "utf8"));
assert.equal(data.peiljaar, 2015, "peiljaar van de RIVM-kaart");
assert.match(data.bron, /rivm_licht_20150315_gm_hhnachtonbew/, "bron noemt het exacte RIVM-bestand");
assert.equal(data.bronSha256, "301fc6a538cd99adfad17965c7391b5d29d20d65ef8dc61729a2402b8ffae1d8", "bron-hash van het RIVM-bestand");
assert.match(data.licentie, /Public Domain/, "licentie vastgelegd");
assert.deepEqual(data.methode.grenzen, [0.5, 2], "klassegrenzen 0,5 en 2 mcd/m²");
assert.equal(data.methode.natuurlijk, 0.25, "natuurlijke achtergrond één keer 0,25 mcd/m²");
const R = data.raster, bytes = Buffer.from(data.klassen, "base64");
assert.equal(bytes.length, Math.ceil(R.rijen * R.kolommen / 2), "rastergrootte klopt met de codering");
assert(fs.statSync(path.join(ROOT, "lichtvervuiling-nl.json")).size < 60000, "databestand blijft klein (< 60 kB)");
const tel = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
for (let i = 0; i < R.rijen * R.kolommen; i++) tel[(bytes[i >> 1] >> ((i & 1) * 4)) & 15]++;
assert.equal(tel.slice(6).reduce((a, b) => a + b, 0), 0, "alleen waarden 0–5 in het raster");

/* 2. Grensgevallenregel op een kunstmatig veld (zonder RIVM-bestand). */
const veld = f => (x, y) => f(x, y);
const lat = 52.1, lon = 5.1;
assert.equal(vakKlasse(veld(() => 0.1), lat, lon), 1, "totaal 0,35: zeker laag");
assert.equal(vakKlasse(veld(() => 0.3), lat, lon), 4, "totaal 0,55: laag tot matig (binnen de marge van 0,5)");
assert.equal(vakKlasse(veld(() => 1.0), lat, lon), 2, "totaal 1,25: zeker matig");
assert.equal(vakKlasse(veld(() => 2.0), lat, lon), 5, "totaal 2,25: matig tot hoog");
assert.equal(vakKlasse(veld(() => 5.0), lat, lon), 3, "totaal 5,25: zeker hoog");
assert.equal(vakKlasse(veld(() => null), lat, lon), 0, "geen gegevens: geen klasse");
assert.equal(vakKlasse(veld((x) => (Math.floor(x / 250) % 2 ? 0.05 : 1.2)), lat, lon), 4, "gemengde cellen binnen het vak: twee klassen");

/* 3. Opzoekfunctie uit index.html */
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const bron = html.match(/const LICHTVERVUILING_TEKST=[\s\S]*?\n\];?|const LICHTVERVUILING_TEKST=\[[\s\S]*?\]\];/);
const functie = html.match(/function lichtvervuilingKlasse\(d,lat,lon\)\{[\s\S]*?\n\}/);
assert(bron && functie, "LICHTVERVUILING_TEKST en lichtvervuilingKlasse staan in index.html");
const ctx = { atob: s => Buffer.from(s, "base64").toString("binary"), Uint8Array, Number, Math };
vm.createContext(ctx);
vm.runInContext(bron[0] + "\n" + functie[0] + "\nglobalThis.T=LICHTVERVUILING_TEKST;globalThis.K=lichtvervuilingKlasse;", ctx);
const naam = (la, lo) => { const c = ctx.K(JSON.parse(JSON.stringify(data)), la, lo); return c ? ctx.T[c][0] : null; };
const verwacht = [
  ["Dwingelderveld", 52.81, 6.40, "laag"],
  ["Vlieland", 53.297, 5.06, "laag tot matig"],
  ["Den Burg", 53.054, 4.797, "matig"],
  ["Utrecht", 52.091, 5.122, "matig tot hoog"],
  ["Rotterdam", 51.922, 4.479, "hoog"],
  ["Antwerpen (BE)", 51.22, 4.40, null],
  ["Aken (DE)", 50.776, 6.083, null],
  ["Noordzee", 52.5, 3.8, null],
  ["New York", 40.71, -74.0, null]
];
for (const [plaats, la, lo, k] of verwacht) assert.equal(naam(la, lo), k, `${plaats}: verwacht ${k}`);

/* 4. Engels en bronverantwoording */
const kern = require("../taal/vertaalkern.js");
const v = kern.maakVertaler(require("../taal/en.js"));
for (const [k, uitleg] of ctx.T.slice(1)) {
  for (const [waar, waarEn] of [["in Den Haag", "in The Hague"], ["in Vlieland", "in Vlieland"], ["hier", "here"]]) {
    const blok = `Lichtvervuiling ${waar}: ${k} (geschat). ${uitleg} Geschat op basis van de RIVM-kaart, voor een heldere, maanloze nacht. Bron`;
    const en = v.vertaal(blok);
    assert(en && en.startsWith(`Light pollution ${waarEn}: `) && /\(estimated\)\. .+ Estimated from the RIVM map, for a clear, moonless night\. Source$/.test(en), `Engelse regel voor ${k} (${waar}); kreeg ${en}`);
  }
  assert(v.vertaal(k), `losse klasse ${k} vertaald (vet woord blijft staan)`);
}
assert(!/2015/.test(html.match(/Geschat op basis van de RIVM-kaart[^<]*/)[0]), "de korte regel noemt geen jaartal (staat achter Bron)");
assert(html.includes('<a href="/over/#lichtvervuiling">Bron</a>'), "regel linkt naar de bronverantwoording");
assert(/\(\?:huidige\|mijn\) locatie/.test(html) && html.includes('"hier"'), "zonder bruikbare plaatsnaam staat er \"hier\"");
const over = fs.readFileSync(path.join(ROOT, "over", "index.html"), "utf8");
assert(over.includes('<h2 id="lichtvervuiling">'), "Over-pagina heeft de sectie lichtvervuiling");
assert(/uit 2015/.test(over) && /niet actueel en niet landelijk gevalideerd/.test(over), "Over-pagina noemt het bronjaar en de beperking");
console.log("Lichtvervuiling: databestand (RIVM 2015, hash, licentie), grensgevallenregel, opzoekfunctie voor bekende plaatsen, alleen Nederland, Engels en bronverantwoording geslaagd.");

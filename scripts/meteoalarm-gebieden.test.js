"use strict";
/*
 * Bouwscript MeteoAlarm-gebieden (zonder netwerk en zonder sleutel):
 *   - vereenvoudiging houdt ringen gesloten en verkleint grillige randen;
 *   - Polygon en MultiPolygon worden compacte polygonlijsten, andere typen niets;
 *   - het script leest de sleutel alleen uit de omgeving en zet hem alleen in de
 *     Authorization-header, nooit in een URL.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { vereenvoudig, compacteVorm } = require("./meteoalarm-gebieden.js");

const ring = [];
for (let i = 0; i <= 360; i++) {
  const a = i * Math.PI / 180;
  ring.push([6 + 0.3 * Math.cos(a) + 0.0005 * Math.sin(40 * a), 52.8 + 0.2 * Math.sin(a)]);
}
ring[360] = ring[0];
const v = compacteVorm({ type: "Polygon", coordinates: [ring] });
assert.equal(v.length, 1, "één polygoon");
const buiten = v[0][0];
assert(buiten.length >= 4 && buiten.length < ring.length / 4, "grillige rand sterk vereenvoudigd (" + buiten.length + " punten)");
assert.deepEqual(buiten[0], buiten[buiten.length - 1], "ring blijft gesloten");
assert(buiten.every(([x, y]) => Math.abs(x * 1e4 - Math.round(x * 1e4)) < 1e-6 && Math.abs(y * 1e4 - Math.round(y * 1e4)) < 1e-6), "afgerond op 4 decimalen");

const klein = [[0, 0], [0.001, 0], [0.001, 0.001], [0, 0]];
assert.deepEqual(vereenvoudig(klein, 0.003), klein, "kleine ring blijft heel");
assert.equal(compacteVorm({ type: "MultiPolygon", coordinates: [[ring], [klein]] }).length, 2, "MultiPolygon houdt alle delen");
assert.equal(compacteVorm({ type: "Point", coordinates: [1, 2] }), null, "punt is geen gebied");
assert.equal(compacteVorm(null), null, "geen geometrie");

const bron = fs.readFileSync(path.join(__dirname, "meteoalarm-gebieden.js"), "utf8");
assert(/authorization: "Bearer " \+ TOKEN/.test(bron), "sleutel alleen in de Authorization-header");
assert(!/[?&](?:token|key|apikey|access_token)=/i.test(bron), "sleutel nooit als URL-parameter");
const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "meteoalarm-gebieden.yml"), "utf8");
assert(/METEOALARM_API_TOKEN: \$\{\{ secrets\.METEOALARM_API_TOKEN \}\}/.test(workflow), "workflow leest de sleutel uit de GitHub-secret");
assert(!/schedule:/.test(workflow), "geen schema: de daglimiet blijft vrij voor handmatige runs");
console.log("MeteoAlarm-gebieden: vereenvoudiging, compacte vormen en sleutel alleen als header geslaagd.");

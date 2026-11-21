"use strict";

/* Unittests voor de Nachtzicht-pagina's: de parkenlijst en het lichtfilter,
   de maanfasen (Meeus), de samenstelling van de kern uit de eigenaren van de
   app, de aanvraag naar Open-Meteo en de opbouw van de pagina's. De gelijkheid
   met de app zelf toetst nachtzicht-pariteit-browser.test.js. */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { PARKEN, BASIS, MAAN, parkUrl } = require("./nachtzicht.config.js");
const { parkenMetLicht, lichtVoorPark, parkPagina, overzichtPagina, maanPagina } = require("./generate-nachtzicht.js");
const { zonMaanBron, presentatieBron, kernBron, laadKern } = require("./nachtzicht-bron.js");

const ROOT = path.join(__dirname, "..");
const INDEX = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const RUNTIME = fs.readFileSync(path.join(__dirname, "nachtzicht-runtime.js"), "utf8");
const K = laadKern(INDEX);
const gewoon = v => JSON.parse(JSON.stringify(v));

/* ---------- parken en lichtvervuiling ---------- */
assert.strictEqual(new Set(PARKEN.map(p => p.slug)).size, PARKEN.length, "dubbele slug in de parkenlijst");
for (const p of PARKEN) {
  assert(/^[a-z0-9-]+$/.test(p.slug), `slug ${p.slug} is niet url-veilig`);
  assert(/^Q\d+$/.test(p.wikidata), `${p.slug}: Wikidata-id ontbreekt`);
  assert(p.lat > 50.7 && p.lat < 53.6 && p.lon > 3.3 && p.lon < 7.3, `${p.slug}: coördinaat ligt niet in Nederland`);
}
const parken = parkenMetLicht();
assert.strictEqual(parken.length, 19, "verwacht 19 parken met een volledige lichtkaart");
for (const grens of ["meinweg", "zoom-kalmthoutse-heide"]) {
  assert.strictEqual(lichtVoorPark(PARKEN.find(p => p.slug === grens)), null, `${grens} ligt aan de grens en hoort niet mee te doen`);
}
for (let i = 1; i < parken.length; i++) {
  const a = parken[i - 1], b = parken[i];
  assert(a.licht.volgorde < b.licht.volgorde || (a.licht.volgorde === b.licht.volgorde && a.kort.localeCompare(b.kort, "nl") <= 0), "parken staan niet van donker naar licht");
}

/* ---------- maanfasen (Meeus) tegen gepubliceerde momenten, UTC ---------- */
const BEKEND = [
  ["volle maan", Date.UTC(2026, 0, 3, 10, 3)],
  ["nieuwe maan", Date.UTC(2026, 1, 17, 12, 1)],
  ["nieuwe maan", Date.UTC(2026, 7, 12, 17, 37)],
  ["volle maan", Date.UTC(2026, 9, 26, 4, 11)]
];
for (const [naam, ms] of BEKEND) {
  const fase = gewoon(K.hoofdfasen(ms - 3 * 86400000, 4, "UTC")).find(f => f.naam === naam);
  assert(fase && Math.abs(fase.ms - ms) <= 5 * 60000, `${naam} rond ${new Date(ms).toISOString()}: berekend ${fase && new Date(fase.ms).toISOString()}`);
}
const fasen = gewoon(K.hoofdfasen(Date.UTC(2026, 9, 6, 12), 4, "Europe/Amsterdam"));
assert.deepStrictEqual(fasen.map(f => f.naam + " " + f.datum + " " + f.tijd), [
  "nieuwe maan 2026-10-10 17:50", "eerste kwartier 2026-10-18 18:12", "volle maan 2026-10-26 05:11", "laatste kwartier 2026-11-01 21:28"
], "fasen in Nederlandse tijd, ook na de overgang naar wintertijd");

/* ---------- maanfase van de app volgt dezelfde hoofdfasen ----------
   Een jaar lang, ieder uur: de naam die de app geeft (maan() uit index.html,
   via de kern) is de naam van de dichtstbijzijnde hoofdfase als die binnen een
   dag ligt, en anders wassend of afnemend; gemeten tegen de losse
   Meeus-berekening van /maan/. Met de oude gemiddelde maanmaand week de naam
   ongeveer 800 uur per jaar af. */
{
  const start = Date.UTC(2026, 9, 1), eind = start + 366 * 86400000, dag = 86400000;
  const momenten = gewoon(K.hoofdfasen(start - 10 * dag, 60, "UTC"));
  const TUSSEN = { "nieuwe maan": "wassende sikkel", "eerste kwartier": "wassende maan", "volle maan": "afnemende maan", "laatste kwartier": "afnemende sikkel" };
  let afwijkend = 0, eerste = null;
  for (let t = start; t < eind; t += 3600000) {
    let dichtst = null;
    for (const m of momenten) if (!dichtst || Math.abs(m.ms - t) < Math.abs(dichtst.ms - t)) dichtst = m;
    const vorige = momenten.filter(m => m.ms <= t).pop();
    const verwacht = Math.abs(dichtst.ms - t) <= dag ? dichtst.naam : TUSSEN[vorige.naam];
    const app = gewoon(K.maanOverzicht(t, 52.1, 5.18, "UTC")).naam;
    if (app !== verwacht) { afwijkend++; if (!eerste) eerste = new Date(t).toISOString() + " app=" + app + " verwacht=" + verwacht; }
  }
  assert.strictEqual(afwijkend, 0, "maanfase van de app wijkt af van de hoofdfasen, eerste: " + eerste);
  const op = (naam, ms) => gewoon(K.maanOverzicht(ms, 52.1, 5.18, "UTC"));
  const nieuw = momenten.find(m => m.naam === "nieuwe maan" && m.ms > start), vol = momenten.find(m => m.naam === "volle maan" && m.ms > start);
  assert(op("nieuw", nieuw.ms).ill < 0.001 && op("vol", vol.ms).ill > 0.999, "verlichting niet 0 bij nieuwe en 1 bij volle maan");
  /* 9 oktober 2026, 18:00 UTC: de nieuwe maan (10 oktober 15:50 UTC) is minder dan een dag weg. */
  assert.strictEqual(op("", Date.UTC(2026, 9, 9, 18)).naam, "nieuwe maan");
  /* 7 oktober 2026, 22:00 UTC: ongeveer 9 procent verlicht (de oude berekening gaf 12). */
  assert(Math.abs(op("", Date.UTC(2026, 9, 7, 22)).ill - 0.09) < 0.015, "verlichting op 7 oktober");
}

/* ---------- samenstelling van de kern ---------- */
assert.throws(() => zonMaanBron(INDEX.replace("/* ---------- stand van zon en maan ---------- */", "")), /stand van zon en maan/, "ontbrekend anker in index.html moet de build laten falen");
const presentatie = presentatieBron();
assert(presentatie.includes("Matige omstandigheden, maar door") && !presentatie.includes("Geen goed zichtvenster"), "de tekstbewerkingen van de build op de vensterzin ontbreken");
assert(kernBron(INDEX).includes("function nachtzichtScore(rijen){"), "de scorefunctie van de app ontbreekt in de kern");
assert.deepStrictEqual(gewoon(K.nachten({}, 52, 5, "Europe/Amsterdam")), [], "zonder data geen nachten");
assert.deepStrictEqual(gewoon(K.nachten({ hourly: { time: ["2026-10-06T22:00"] }, daily: {} }, 52, 5, "Europe/Amsterdam")), [], "zonder is_day geen nachten");

/* ---------- dezelfde aanvraag als de app ---------- */
const lijst = (bron, re, label) => { const m = re.exec(bron); assert(m, label + " niet gevonden"); return m[1].split(","); };
const appUur = lijst(INDEX.replace(/"\s*\n\s*\+"/g, ""), /const f=basis\+"[^"]*&hourly=([a-z0-9_,]+)/, "uurvelden van de app");
const appNu = lijst(INDEX.replace(/"\s*\n\s*\+"/g, ""), /&current=([a-z0-9_,]+)/, "actuele velden van de app");
for (const v of lijst(RUNTIME, /const UURVELDEN = "([^"]+)"/, "UURVELDEN")) assert(appUur.includes(v), `uurveld ${v} vraagt de app niet op`);
for (const v of lijst(RUNTIME, /const NUVELDEN = "([^"]+)"/, "NUVELDEN")) assert(appNu.includes(v), `actueel veld ${v} vraagt de app niet op`);
for (const deel of ["past_hours=24", "wind_speed_unit=kmh", "daily=sunrise,sunset"]) assert(RUNTIME.includes(deel), `aanvraag mist ${deel}`);
/* Ook de lichtere reserve-aanvraag van de app (fmin, bij een trage volledige
   aanvraag) moet alle velden hebben waarmee Nachtzicht rekent; zonder zicht
   toonde Nachtzicht anders "Onvoldoende data". */
const appReserve = lijst(INDEX.replace(/"\s*\n\s*\+"/g, ""), /const fmin=basis\+"[^"]*&hourly=([a-z0-9_,]+)/, "uurvelden van de reserve-aanvraag");
for (const v of lijst(RUNTIME, /const UURVELDEN = "([^"]+)"/, "UURVELDEN")) assert(appReserve.includes(v), `uurveld ${v} ontbreekt in de reserve-aanvraag van de app`);

/* ---------- pagina's ---------- */
const kern = kernBron(INDEX);
const park = parken[0], html = parkPagina(park, kern);
assert(html.includes(`<link rel="canonical" href="${parkUrl(park)}">`), "canonical van de parkpagina");
assert(html.includes(`<h1 class="nz-park-kop">Sterren kijken in ${park.naam}</h1>`), "kop van de parkpagina");
assert(/connect-src 'self' https:\/\/api\.open-meteo\.com;/.test(html), "CSP staat alleen Open-Meteo toe");
assert(!/<script[^>]+src=/.test(html), "geen externe scripts");
const config = JSON.parse(/<script type="application\/json" id="nz-config">([^<]*)<\/script>/.exec(html)[1]);
assert.deepStrictEqual(config.park, { slug: park.slug, lat: park.lat, lon: park.lon }, "configuratie van de parkpagina");
/* Lauwersmeer heeft eigen broncontent; de andere 18 parken mogen die niet overnemen. */
const lauwersmeer=parken.find(p=>p.slug==="lauwersmeer");
assert(lauwersmeer,"Lauwersmeer hoort tot de geselecteerde parken");
const lauwersmeerHtml=parkPagina(lauwersmeer,kern);
assert(lauwersmeerHtml.includes("Waar kun je sterren kijken in Nationaal Park Lauwersmeer?"),"specifieke Lauwersmeer-kop");
assert(lauwersmeerHtml.includes("Dark Sky Park")&&lauwersmeerHtml.includes("Achter de Zwarten")&&lauwersmeerHtml.includes("Vlinderbalg"),"drie kijklocaties en erkenning");
assert(lauwersmeerHtml.includes("Marnewaard")&&lauwersmeerHtml.includes('https://www.np-lauwersmeer.nl/het-lauwersmeer/dark-sky-park/'),"veiligheidsnuance en officiële bron");
for(const ander of parken.filter(p=>p.slug!=="lauwersmeer"))assert(!parkPagina(ander,kern).includes("Waar kun je sterren kijken in Nationaal Park Lauwersmeer?"),ander.slug+": Lauwersmeer-informatie lekt naar een ander park");
const vertalerPark=require("../taal/vertaalkern.js").maakVertaler(require("../taal/en.js"));
assert.equal(vertalerPark.vertaal("Waar kun je sterren kijken in Nationaal Park Lauwersmeer?"),"Where can you go stargazing in Lauwersmeer National Park?");
assert.equal(vertalerPark.vertaal("Bron:"),"Source:","de zichtbare bronvermelding moet ook in het Engels zijn");
assert(vertalerPark.vertaal("Nationaal Park Lauwersmeer is sinds oktober 2016 officieel erkend als Dark Sky Park. Bij helder weer en weinig storende verlichting kun je er veel sterren zien en soms ook de Melkweg. De parkorganisatie noemt drie geschikte plekken: Activiteitencentrum Lauwersnest, hemelplatform Achter de Zwarten bij Suyderoogh en hemelplatform Vlinderbalg aan de Strandweg.").includes("Lauwersnest Visitor Centre"),"Engelse kijklocaties");
assert(vertalerPark.vertaal("Op de wegen en paden gelden volgens de parkorganisatie 's nachts in beginsel dezelfde toegangsregels als overdag; militair oefenterrein Marnewaard is uitgezonderd. Controleer vóór je bezoek de actuele informatie van het park en blijf op toegankelijke routes. De verwachting en lichtvervuilingsklasse hierboven gelden voor een representatief punt in het park; plaatselijke omstandigheden kunnen afwijken.").includes("Marnewaard military training area"),"Engelse toegangswaarschuwing");
const overzicht = overzichtPagina(parken, kern);
assert.strictEqual((overzicht.match(/<tr data-park="/g) || []).length, parken.length, "overzicht heeft een rij per park");
assert(overzicht.includes(`in ${parken.length} geselecteerde nationale parken.`), "overzicht beschrijft de selectie en het aantal parken");
assert(overzicht.includes("De parken zijn gegroepeerd op geschatte lichtvervuiling, van laag naar hoog. Binnen iedere categorie staan ze op alfabetische volgorde."), "overzicht beschrijft beide sorteerniveaus");
for (const p of parken) assert(overzicht.includes(`href="${BASIS}${p.slug}/"`), `overzicht linkt niet naar ${p.slug}`);
const maan = maanPagina(kern, Date.UTC(2026, 9, 6, 12));
assert(maan.includes(`<link rel="canonical" href="https://watishetweer.nl${MAAN}">`) && maan.includes('id="nz-maan-fasen"'), "maanpagina");
assert(maan.includes("Hoe staat de maan vandaag? Bekijk de actuele maanfase"),"zoekintentie direct in de inleiding");
assert(maan.includes('class="kaart breed nz-maan-pagina"'),"alleen de maanpagina krijgt de nieuwe brede opmaak");
assert.equal((maan.match(/class="nz-maan-thema"/g)||[]).length,1,"maanpagina toont precies één themabediening");
assert.equal((maan.match(/data-maan-thema=/g)||[]).length,6,"drie themaknoppen plus drie runtimeverwijzingen zijn aanwezig");
assert(maan.includes('class="nz-maan-uitleg"')&&maan.includes("<summary>Over de berekening en de afbeelding</summary>"),"wetenschappelijke toelichting blijft toegankelijk in een uitklap");
assert.equal((maan.match(/id="nz-maan-(?:schijf|naam|tijden|fasen|tijdzone|plaats|elders|standplaats)"/g)||[]).length,8,"alle acht maanruntime-ID's blijven uniek");
assert(maan.includes("NASA's Scientific Visualization Studio")&&maan.includes("Astronomical Algorithms"),"bronnen en methode blijven leesbaar");

assert(maan.includes("Maanlicht kan zwakke sterren en de Melkweg moeilijker zichtbaar maken"),"geen absolute bewering over de Melkweg");
assert(!maan.includes("Bij een volle maan verdwijnt de Melkweg")&&!maan.includes("hooguit enkele minuten"),"overdreven claims zijn verdwenen");
assert(maan.includes('id="nz-maan-elders">; de tijden kunnen per plaats en datum verschillen</span>'),"locatie- en datumafhankelijke tijden correct geduid");
assert(maan.includes('<link rel="canonical" href="https://watishetweer.nl/maan/">')&&maan.includes("<title>De maan vandaag: fase, opkomst en ondergang | watishetweer.nl</title>"),"SEO-metadata onveranderd");
assert(maan.includes("De maanopkomst en maanondergang worden bij het openen berekend."),"initiële HTML bevat een correcte laadmelding");
assert(maan.includes("<noscript>")&&maan.includes("momentopname van 2026-10-06 12:00 UTC")&&maan.includes("Voor De Bilt op 2026-10-06:"),"zonder JS staat een gedateerde momentopname");
assert(maan.includes("De volgende hoofdfasen volgens deze momentopname (Nederlandse tijd):")&&/<noscript>[\s\S]*?<ul><li>/.test(maan),"zonder JS bevat de pagina ook komende fasen");
assert.equal((maan.match(/<noscript>/g)||[]).length,2,"geen dubbele no-JS-blokken");
const maanVertaald=vertalerPark.vertaal("Hoe staat de maan vandaag? Bekijk de actuele maanfase, het verlichtingspercentage en de op- en ondergang in De Bilt. Maanlicht kan zwakke sterren en de Melkweg moeilijker zichtbaar maken; voor sterrenkijken zijn ook bewolking en lichtvervuiling belangrijk.");
assert(maanVertaald&&maanVertaald.startsWith("What is the Moon like today?"),"nieuwe inleiding volledig Engels");
assert.equal(vertalerPark.vertaal("De maanopkomst en maanondergang worden bij het openen berekend."),"Moonrise and moonset times are calculated when the page opens.");
assert.equal(vertalerPark.vertaal("; de tijden kunnen per plaats en datum verschillen"),"; times may differ by location and date");

console.log(`Nachtzicht: ${PARKEN.length} parken in de lijst, ${parken.length} met volledige lichtkaart; ${BEKEND.length} maanfasen binnen 5 minuten; kern en aanvraag gelijk aan de app; pagina-opbouw klopt.`);

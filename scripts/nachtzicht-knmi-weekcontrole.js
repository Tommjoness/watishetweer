"use strict";

const { execFileSync } = require("node:child_process");
const { appendFileSync, mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const EDR = "https://api.dataplatform.knmi.nl/edr/v1/collections/hourly-in-situ-meteorological-observations-validated";
const ARCHIEF = "https://cdn.knmi.nl/knmi/map/page/klimatologie/gegevens/uurgegevens/";
const UITVOER = "nachtzicht-knmi-resultaten";
const UUR = 3_600_000;
// 2 t/m 8 november 2026 in Europe/Amsterdam. Beiden zijn UTC-eindtijdstippen.
const START = Date.parse("2026-11-01T23:00:00Z");
const EINDE = Date.parse("2026-11-08T22:00:00Z");
const UREN = Array.from({ length: 168 }, (_, i) => START + i * UUR);
const VELDEN = ["N", "VV", "RH"];
const STATIONS = [
  { nummer: "240", lat: 52.3172, lon: 4.7897 },
  { nummer: "260", lat: 52.0989, lon: 5.1797 },
  { nummer: "269", lat: 52.4483, lon: 5.5081 },
  { nummer: "290", lat: 52.2731, lon: 6.8908 },
  { nummer: "310", lat: 51.4414, lon: 3.5958 }
];

function archiefUren(tekst, nummer) {
  const regels = tekst.split(/\r?\n/);
  const kop = regels.find(regel => /^#\s*STN,\s*YYYYMMDD,/.test(regel));
  if (!kop) throw new Error("KNMI-archiefkop ontbreekt.");
  const kolommen = kop.slice(1).split(",").map(waarde => waarde.trim());
  if (!["STN", "YYYYMMDD", "HH", ...VELDEN].every(veld => kolommen.includes(veld))) {
    throw new Error("Benodigde KNMI-archiefkolom ontbreekt.");
  }
  const uit = new Map();
  for (const regel of regels.filter(regel => /^\s*\d+,2026110[1-8],/.test(regel))) {
    const waarden = regel.split(",").map(waarde => waarde.trim());
    const rij = Object.fromEntries(kolommen.map((veld, i) => [veld, waarden[i]]));
    if (rij.STN !== nummer || waarden.length !== kolommen.length || !/^(?:[1-9]|1\d|2[0-4])$/.test(rij.HH)) {
      throw new Error(`Ongeldige archiefrij voor station ${nummer}.`);
    }
    const [_, jaar, maand, dag] = /^(\d{4})(\d\d)(\d\d)$/.exec(rij.YYYYMMDD);
    const einde = Date.UTC(Number(jaar), Number(maand) - 1, Number(dag), Number(rij.HH));
    if (einde < START || einde > EINDE) continue;
    if (uit.has(einde)) throw new Error(`Dubbel uur in het KNMI-archief van ${nummer}.`);
    const velden = Object.fromEntries(VELDEN.map(veld => {
      if (rij[veld] === "") return [veld, null];
      if (!/^-?\d+$/.test(rij[veld])) throw new Error(`Ongeldige archiefwaarde voor ${veld} bij ${nummer}.`);
      return [veld, Number(rij[veld])];
    }));
    uit.set(einde, velden);
  }
  return uit;
}

function edrUren(antwoord, station) {
  const dekkingen = antwoord.type === "CoverageCollection" ? antwoord.coverages : [antwoord];
  const uit = new Map();
  if (!Array.isArray(dekkingen) || !dekkingen.length) throw new Error("EDR bevat geen dekking.");
  for (const dekking of dekkingen) {
    const assen = dekking.domain?.axes;
    const tijden = assen?.t?.values;
    const [lon] = assen?.x?.values || [];
    const [lat] = assen?.y?.values || [];
    if (dekking.type !== "Coverage" || !Array.isArray(tijden) || !tijden.length ||
        !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon - station.lon) > 0.01 || Math.abs(lat - station.lat) > 0.01 ||
        Object.entries(assen).some(([naam, as]) => naam !== "t" && as.values?.length !== 1)) {
      throw new Error(`Onverwachte EDR-locatie of tijdas voor station ${station.nummer}.`);
    }
    const reeksen = Object.fromEntries(VELDEN.map(veld => {
      const sleutel = Object.keys(dekking.ranges || {}).find(naam => naam.toUpperCase() === veld);
      const reeks = dekking.ranges?.[sleutel]?.values;
      const parameter = dekking.parameters?.[sleutel] ?? antwoord.parameters?.[sleutel];
      const eenheid = parameter?.unit?.symbol?.value ?? parameter?.unit?.label?.en ?? parameter?.unit;
      const toegestaan = { N: ["okta", "oktas"], VV: ["1", "dimensionless"], RH: ["mm", "millimeter", "millimetre"] };
      if (!Array.isArray(reeks) || reeks.length !== tijden.length || !toegestaan[veld].includes(String(eenheid).toLowerCase())) {
        throw new Error(`EDR-veld ${veld} heeft bij ${station.nummer} een ontbrekende reeks of onverwachte eenheid.`);
      }
      return [veld, reeks];
    }));
    tijden.forEach((tijd, i) => {
      const einde = Date.parse(tijd);
      if (!Number.isFinite(einde) || einde % UUR || einde < START || einde > EINDE || uit.has(einde)) {
        throw new Error(`Ongeldig of dubbel EDR-tijdstip bij ${station.nummer}.`);
      }
      const rij = Object.fromEntries(VELDEN.map(veld => [veld, reeksen[veld][i]]));
      if ((rij.N !== null && (!Number.isInteger(rij.N) || rij.N < 0 || rij.N > 9)) ||
          (rij.VV !== null && (!Number.isInteger(rij.VV) || rij.VV < 0 || rij.VV > 89)) ||
          (rij.RH !== null && (!Number.isFinite(rij.RH) || (rij.RH < 0 && rij.RH !== -0.1)))) {
        throw new Error(`Ongeldige EDR-meetwaarde bij ${station.nummer}.`);
      }
      uit.set(einde, rij);
    });
  }
  return uit;
}

function vergelijk(einde, archief, edr) {
  const oudereWaarden = archief.get(einde) ?? null;
  const nieuweWaarden = edr.get(einde) ?? null;
  const gelijk = Object.fromEntries(VELDEN.map(veld => {
    const oud = oudereWaarden?.[veld];
    const nieuw = nieuweWaarden?.[veld];
    return [veld, oud == null || nieuw == null ? null : Math.abs((veld === "RH" ? oud / 10 : oud) - nieuw) < 1e-8];
  }));
  return { eindeUtc: new Date(einde).toISOString(), archief: oudereWaarden, edr: nieuweWaarden, gelijk,
    spoorInArchief: oudereWaarden?.RH === -1, spoorNaarNul: oudereWaarden?.RH === -1 && nieuweWaarden?.RH === 0 };
}

async function download(url, headers = {}) {
  const respons = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(45_000) });
  if (!respons.ok) throw new Error(`KNMI-download gaf HTTP ${respons.status}.`);
  return Buffer.from(await respons.arrayBuffer());
}

async function main() {
  const sleutel = process.env.KNMI_EDR_API_KEY;
  if (!sleutel) throw new Error("Het KNMI-omgevingssecret ontbreekt.");
  mkdirSync(UITVOER, { recursive: true });
  const resultaten = [];
  for (const station of STATIONS) {
    const { nummer } = station;
    const adres = new URL(`${EDR}/locations/0-20000-0-06${nummer}`);
    adres.searchParams.set("datetime", `${new Date(START).toISOString()}/${new Date(EINDE).toISOString()}`);
    const inhoud = await download(adres, { Authorization: sleutel, Accept: "application/json" });
    writeFileSync(path.join(UITVOER, `edr-${nummer}.json`), inhoud);
    const edr = edrUren(JSON.parse(inhoud), station);
    const bestandsnaam = `uurgeg_${nummer}_2021-2030.zip`;
    const lokaalArchief = path.join(UITVOER, bestandsnaam);
    writeFileSync(lokaalArchief, await download(ARCHIEF + bestandsnaam));
    const tekst = execFileSync("unzip", ["-p", lokaalArchief], { encoding: "latin1", maxBuffer: 16_000_000 });
    const archief = archiefUren(tekst, nummer);
    const uren = UREN.map(einde => vergelijk(einde, archief, edr));
    resultaten.push({ nummer, edrUren: edr.size, archiefUren: archief.size, uren });
  }
  writeFileSync(path.join(UITVOER, "vergelijking.json"), JSON.stringify(resultaten, null, 2) + "\n");
  const kop = ["## KNMI-weekcontrole Nachtzicht · 2–8 november 2026", "",
    "| Station | Gekoppelde uren (max. 168) | N gelijk | VV gelijk | RH gelijk | Spoor in archief | Spoor als 0 mm in EDR |",
    "|---|---:|---:|---:|---:|---:|---:|"];
  const regels = resultaten.map(({ nummer, uren }) => {
    const tel = waardepaar => uren.filter(waardepaar).length;
    const aantallen = VELDEN.map(veld => `${tel(uur => uur.gelijk[veld] === true)}/${tel(uur => uur.gelijk[veld] !== null)}`);
    return `| ${nummer} | ${tel(uur => uur.archief && uur.edr)} | ${aantallen.join(" | ")} | ${tel(uur => uur.spoorInArchief)} | ${tel(uur => uur.spoorNaarNul)} |`;
  });
  const samenvatting = [...kop, ...regels, "", "Veldtotalen tonen gelijke waarden per geldig bronpaar. Bewolkingscode 9 is een geldige broncode voor onzichtbare bovenlucht. Neerslagsporen blijven herkenbaar in het archief.", ""].join("\n");
  writeFileSync(path.join(UITVOER, "samenvatting.md"), samenvatting);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, samenvatting);
  console.log(samenvatting);
  if (resultaten.some(station => station.edrUren !== UREN.length || station.archiefUren !== UREN.length)) {
    throw new Error("De week is onvolledig. Het controlebestand toont de ontbrekende uren.");
  }
}

module.exports = { archiefUren, edrUren, vergelijk };
if (require.main === module) main().catch(fout => { console.error(fout.message); process.exitCode = 1; });

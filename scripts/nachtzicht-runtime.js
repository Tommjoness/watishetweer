/* Runtime van de Nachtzicht-pagina's. Leest de configuratie uit
   <script id="nz-config">, haalt de verwachting op bij Open-Meteo (één
   aanvraag per bezoek, ook voor het overzicht van alle parken) en rekent met
   WeatherNowNachtzichtKern, dezelfde regels als Nachtzicht in de app. */
(function () {
  "use strict";
  const K = window.WeatherNowNachtzichtKern;
  const cfgEl = document.getElementById("nz-config");
  if (!K || !cfgEl) return;
  let cfg;
  try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }
  const TZ = cfg.tz || "Europe/Amsterdam";
  const API = "https://api.open-meteo.com/v1/forecast";
  /* Dezelfde velden, eenheden en uren als de aanvraag van de app (voor zover
     Nachtzicht ze gebruikt), zodat beide op dezelfde modeluitvoer rekenen. */
  const UURVELDEN = "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,weather_code,cloud_cover,wind_gusts_10m,visibility,is_day";
  const NUVELDEN = "temperature_2m,relative_humidity_2m,is_day,precipitation,visibility,weather_code,cloud_cover,wind_gusts_10m";
  const aanvraag = (lat, lon, uren) => API + "?latitude=" + lat + "&longitude=" + lon + "&current=" + NUVELDEN + "&hourly=" + UURVELDEN
    + "&daily=sunrise,sunset&forecast_days=" + Math.ceil(uren / 24 + 1) + "&past_hours=24&forecast_hours=" + uren + "&wind_speed_unit=kmh&timezone=" + encodeURIComponent(TZ);
  const DAGVOL = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

  const esc = v => String(v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]);
  const procent = v => Math.round(v) + "%";
  const scoreTekst = sc => Math.round(sc) + "/10";
  const datumTekst = iso => { const p = iso.split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)); return DAGVOL[d.getUTCDay()] + " " + p[2] + " " + MAANDEN[p[1] - 1]; };
  const hoofdletter = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  const kortVenster = n => n.venster ? (n.venster.nu ? "nu tot " + n.venster.tot : n.venster.van + "–" + n.venster.tot) : "geen" + (n.reden ? " (" + n.reden + ")" : "");
  const zichtTekst = m => m == null ? "onbekend" : m >= 10000 ? "10+ km" : (Math.round(m / 100) / 10).toString().replace(".", ",") + " km";
  function maanZin(m) {
    if (!m) return "onbekend";
    const delen = [hoofdletter(m.naam) + ", " + procent(m.ill * 100) + " verlicht"];
    if (m.momenten.length) delen.push(m.momenten.map(x => (x.type === "op" ? "op " : "onder ") + x.tijd).join(" · "));
    else delen.push(m.boven ? "de hele nacht boven de horizon" : "de hele nacht onder de horizon");
    return delen.join(" · ");
  }
  function haal(url, ms) {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), ms || 10000) : null;
    return fetch(url, ctl ? { signal: ctl.signal } : undefined)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .finally(() => { if (t) clearTimeout(t); });
  }
  function melding(el, tekst) { if (el) { el.textContent = tekst; el.hidden = false; } }

  /* ---------- één park ---------- */
  function park() {
    const p = cfg.park, uit = document.getElementById("nz-vannacht"), lijst = document.getElementById("nz-nachten"), status = document.getElementById("nz-status");
    haal(aanvraag(p.lat, p.lon, 170)).then(d => {
      const nachten = K.nachten(d, p.lat, p.lon, TZ, 6);
      if (!nachten.length) throw new Error("geen nachten");
      const n = nachten[0];
      const staven = n.uren.map(u => `<div class="nz-uur${u.goed ? " goed" : ""}" style="--h:${Math.max(2, Math.round(u.bewolking || 0))}%" title="${esc(u.tijd + ": " + (u.bewolking == null ? "bewolking onbekend" : procent(u.bewolking) + " bewolking") + (u.maanOp ? ", maan op" : ""))}"></div>`).join("");
      const tijden = n.uren.map(u => `<span>${esc(u.tijd.slice(0, 2))}</span>`).join("");
      const maanRij = n.uren.map(u => `<i class="${u.maanOp ? "op" : ""}"></i>`).join("");
      uit.innerHTML = `
<div class="nz-score"><span class="nz-cijfer">${esc(n.scoreTekst)}</span><span class="nz-oordeel"><b>${esc(n.oordeel)}</b><span>${esc(n.zin)}</span></span></div>
<dl class="nz-feiten">
<div><dt>Bewolking</dt><dd>gemiddeld ${n.bewolking == null ? "onbekend" : esc(procent(n.bewolking))}</dd></div>
<div><dt>Zicht</dt><dd>gemiddeld ${esc(zichtTekst(n.zicht))}</dd></div>
<div><dt>Maan</dt><dd>${esc(maanZin(n.maan))}</dd></div>
${n.zonOnder && n.zonOp ? `<div><dt>Zon</dt><dd>onder ${esc(n.zonOnder)} · op ${esc(n.zonOp)}</dd></div>` : ""}
</dl>
<figure class="nz-grafiek" aria-label="${esc("Bewolking per uur, " + n.uren[0].tijd + " tot " + n.uren[n.uren.length - 1].tijd)}">
<figcaption>Bewolking per uur <span class="nz-legenda"><span><i class="goed"></i>goed om te kijken</span><span><i></i>te bewolkt, slecht zicht of te veel maanlicht</span><span><i class="maan"></i>maan op</span></span></figcaption>
<div class="nz-staven" style="--n:${n.uren.length}">${staven}</div>
<div class="nz-maanrij" style="--n:${n.uren.length}" aria-hidden="true">${maanRij}</div>
<div class="nz-tijden" style="--n:${n.uren.length}" aria-hidden="true">${tijden}</div>
</figure>`;
      uit.hidden = false;
      lijst.innerHTML = `<table><thead><tr><th scope="col">Nacht</th><th scope="col">Indicatie</th><th scope="col">Kijkvenster</th></tr></thead><tbody>${nachten.map(x => `<tr><th scope="row">${esc(x.label)}</th><td class="nz-n">${esc(x.scoreTekst)} <span>${esc(x.oordeel)}</span></td><td class="nz-zin">${esc(x.zin)}</td></tr>`).join("")}</tbody></table>`;
      lijst.hidden = false;
      if (status) status.hidden = true;
    }).catch(() => melding(status, "De verwachting kon niet worden geladen. Probeer het later opnieuw."));
  }

  /* ---------- overzicht van alle parken ---------- */
  function overzicht() {
    const parken = cfg.parken || [], status = document.getElementById("nz-status");
    if (!parken.length) return;
    haal(aanvraag(parken.map(p => p.lat).join(","), parken.map(p => p.lon).join(","), 48), 15000).then(data => {
      const lijst = Array.isArray(data) ? data : [data];
      if (lijst.length !== parken.length) throw new Error("onvolledig");
      let gevuld = 0;
      parken.forEach((p, i) => {
        const rij = document.querySelector(`tr[data-park="${p.slug}"]`);
        const n = K.nachten(lijst[i], p.lat, p.lon, TZ, 1)[0];
        if (!rij || !n) return;
        rij.querySelector(".nz-n").innerHTML = `${esc(n.scoreTekst)} <span>${esc(n.oordeel)}</span>`;
        rij.querySelector(".nz-venster").textContent = kortVenster(n);
        gevuld++;
      });
      if (!gevuld) throw new Error("leeg");
      if (status) status.hidden = true;
    }).catch(() => melding(status, "De verwachting voor vannacht kon niet worden geladen. Probeer het later opnieuw."));
  }

  /* ---------- maan ---------- */
  function maanPagina() {
    const r = cfg.referentie, m = K.maanOverzicht(Date.now(), r.lat, r.lon, TZ);
    const set = (id, tekst) => { const el = document.getElementById(id); if (el) el.textContent = tekst; };
    set("nz-maan-naam", hoofdletter(m.naam) + ", " + procent(m.ill * 100) + " verlicht");
    const tijden = [m.op ? "op " + m.op : null, m.onder ? "onder " + m.onder : null].filter(Boolean).join(", ");
    set("nz-maan-tijden", tijden ? "Vandaag in " + r.naam + ": " + tijden + "." : "Vandaag komt de maan in " + r.naam + " niet op of niet onder.");
    const lijst = document.getElementById("nz-maan-fasen");
    if (lijst) lijst.innerHTML = m.fasen.map(f => `<li><b>${esc(hoofdletter(f.naam))}</b> ${esc(datumTekst(f.datum))}, ${esc(f.tijd)}</li>`).join("");
    const schijf = document.getElementById("nz-maan-schijf");
    if (schijf) schijf.innerHTML = `<svg viewBox="0 0 72 72" width="72" height="72" role="img" aria-label="${esc(hoofdletter(m.naam))}">${maanSvg(m.ill, m.fase)}</svg>`;
  }
  /* Verlicht deel van de schijf: rechts bij wassende, links bij afnemende maan (noordelijk halfrond). */
  function maanSvg(ill, fase) {
    const r = 30, rx = r * Math.abs(1 - 2 * ill), wassend = fase < 0.5;
    const rand = `<circle cx="36" cy="36" r="${r}" class="nz-maan-rand"/>`;
    if (ill < 0.02) return rand;
    if (ill > 0.98) return rand + `<circle cx="36" cy="36" r="${r}" class="nz-maan-licht"/>`;
    const buiten = wassend ? 1 : 0, binnen = (ill > 0.5) === wassend ? 1 : 0;
    return rand + `<path class="nz-maan-licht" d="M36 ${36 - r} A${r} ${r} 0 0 ${buiten} 36 ${36 + r} A${rx.toFixed(2)} ${r} 0 0 ${binnen} 36 ${36 - r}Z"/>`;
  }

  if (cfg.soort === "park") park();
  else if (cfg.soort === "overzicht") overzicht();
  else if (cfg.soort === "maan") maanPagina();
})();

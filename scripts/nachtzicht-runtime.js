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
  /* Eigen plaats (eigenaar, 12 oktober): heeft de bezoeker in de app een plaats
     in Nederland gekozen, dan gelden op- en ondergang voor die plaats; anders
     voor het referentiepunt De Bilt. De plaats staat al in de eigen browser
     (dezelfde sleutel als de app); er gaat niets naar een server. Alleen
     Nederland, omdat de tijden op deze pagina in Nederlandse tijd staan. */
  function eigenPlaats() {
    try {
      const p = JSON.parse(localStorage.getItem("weerbriefing.plaats") || "null");
      const lat = Number(p && p.lat), lon = Number(p && p.lon), naam = String((p && p.label) || "").split(",")[0].trim();
      if (!p || p.land !== "NL" || !naam || !(lat > 50.7 && lat < 53.7 && lon > 3.3 && lon < 7.3)) return null;
      return { naam, lat, lon };
    } catch (e) { return null; }
  }
  function maanPagina() {
    const r = eigenPlaats() || cfg.referentie, m = K.maanOverzicht(Date.now(), r.lat, r.lon, TZ);
    const set = (id, tekst) => { const el = document.getElementById(id); if (el) el.textContent = tekst; };
    set("nz-maan-naam", hoofdletter(m.naam) + ", " + procent(m.ill * 100) + " verlicht");
    const tijden = [m.op ? "op " + m.op : null, m.onder ? "onder " + m.onder : null].filter(Boolean).join(", ");
    set("nz-maan-tijden", tijden ? "Vandaag in " + r.naam + ": " + tijden + "." : "Vandaag komt de maan in " + r.naam + " niet op of niet onder.");
    set("nz-maan-plaats", r.naam);
    const lijst = document.getElementById("nz-maan-fasen");
    if (lijst) {
      lijst.innerHTML = m.fasen.map(f => `<li><span class="nz-maan-beeld"></span><span><b>${esc(hoofdletter(f.naam))}</b> ${esc(datumTekst(f.datum))}, ${esc(f.tijd)}</span></li>`).join("");
      /* De fase-icoontjes: licht recht aan de westkant (wassend) of oostkant
         (afnemend), in dezelfde stand als de grote maan. */
      lijst.querySelectorAll(".nz-maan-beeld").forEach((el, i) => { const f = FASE_STAND[m.fasen[i].naam]; maanBeeld(el, f.ill, f.fase < 0.5 ? 270 : 90, m.draai, 26, "f" + i); });
    }
    const schijf = document.getElementById("nz-maan-schijf");
    if (schijf) maanBeeld(schijf, m.ill, m.rand, m.draai, 120, "nu");
  }

  /* De maan als foto (NASA, volle maan) met de echte belichting erover: per
     beeldpunt de stand van de zon op de bolle maan, met de helderheidswet van
     Lommel-Seeliger. Zo blijft de maan tot vlak bij de schaduwgrens helder en
     is een smalle sikkel even smal als aan de hemel. De donkere kant krijgt een
     vage, koele aardschijn. Lukt dat niet (geen canvas, foto niet geladen), dan
     blijft de tekening hieronder staan. */
  let foto = null;
  function laadFoto() {
    if (!foto) foto = new Promise((ok, mis) => { const img = new Image(); img.onload = () => ok(img); img.onerror = mis; img.src = "/maan.webp"; });
    return foto;
  }
  /* rand: positiehoek van de verlichte rand met het noorden boven (270° = rechts,
     90° = links); draai: 0 met het noorden boven, 180 ondersteboven (zie
     maanStand in de kern). */
  function maanBeeld(el, ill, rand, draai, maat, sleutel) {
    const canvas = document.createElement("canvas"), ctx = canvas.getContext && canvas.getContext("2d");
    const tekening = () => { el.innerHTML = maanSvg(ill, rand, draai, maat, sleutel); };
    if (!ctx) { tekening(); return; }
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1)), n = Math.round(maat * dpr);
    canvas.width = canvas.height = n;
    canvas.className = "nz-maan-svg";
    canvas.style.width = canvas.style.height = maat + "px";
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("data-rand", Math.round(rand));
    canvas.setAttribute("data-draai", draai);
    el.replaceChildren(canvas);
    laadFoto().then(img => {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      /* De foto staat met het noorden boven; ondersteboven draait de hele maan. */
      ctx.save(); ctx.translate(n / 2, n / 2); ctx.rotate(draai * Math.PI / 180); ctx.drawImage(img, -n / 2, -n / 2, n, n); ctx.restore();
      const beeld = ctx.getImageData(0, 0, n, n), d = beeld.data;
      /* Zonrichting: z naar de kijker, x naar rechts, y naar beneden. De verlichte
         rand staat op positiehoek rand - draai (tegen de klok in vanaf boven). */
      const e = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * ill))), p = (rand - draai) * Math.PI / 180;
      const sx = -Math.sin(p) * Math.sin(e), sy = -Math.cos(p) * Math.sin(e), sz = -Math.cos(e);
      /* Aardschijn: sterker rond nieuwe maan. Op een lichte achtergrond en in de
         kleine fase-icoontjes iets lichter, zodat de schijf geen zwarte vlek wordt. */
      const inkt = (getComputedStyle(el).color.match(/\d+(\.\d+)?/g) || [0, 0, 0]).slice(0, 3).map(Number);
      const lichtThema = (0.2126 * inkt[0] + 0.7152 * inkt[1] + 0.0722 * inkt[2]) / 255 < 0.5;
      const aarde = (lichtThema ? 0.2 : maat < 40 ? 0.24 : 0.07) + 0.1 * (1 - ill) * (1 - ill), r = n / 2, rk = 1 / r;
      for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
        const x = (px + 0.5 - r) / r, y = (py + 0.5 - r) / r, rr = x * x + y * y, i = (py * n + px) * 4;
        if (rr >= 1 + rk) { d[i + 3] = 0; continue; }
        const nz = Math.sqrt(Math.max(0, 1 - rr)), mu0 = x * sx + y * sy + nz * sz;
        /* Lommel-Seeliger, met een zachte overgang van één beeldpunt breed. */
        const dag = mu0 > 0 ? Math.min(1, 2 * mu0 / (mu0 + Math.max(nz, 0.02))) : 0;
        const zacht = Math.max(0, Math.min(1, (mu0 + rk) / (2 * rk)));
        const licht = Math.pow(dag, 0.75) * zacht, a = (1 - licht) * aarde, l = licht * 1.12;
        d[i] = d[i] * (l + a * 0.92);
        d[i + 1] = d[i + 1] * (l * 0.99 + a * 0.98);
        d[i + 2] = d[i + 2] * (l * 0.95 + a * 1.08);
        d[i + 3] = 255 * Math.max(0, Math.min(1, (1 - Math.sqrt(rr)) / rk + 0.5));
      }
      ctx.putImageData(beeld, 0, 0);
    }).catch(tekening);
  }

  /* De maan als tekening: verlichte kant met randverduistering, de grote
     maanzeeën op hun echte plek, een zachte schaduwgrens en een vaag zichtbare
     donkere kant (aardschijn). Alleen nog als vangnet als de foto niet laadt. */
  const FASE_STAND = { "nieuwe maan": { ill: 0, fase: 0 }, "eerste kwartier": { ill: 0.5, fase: 0.25 }, "volle maan": { ill: 1, fase: 0.5 }, "laatste kwartier": { ill: 0.5, fase: 0.75 } };
  /* Maanzeeën in eenheden van de straal (x naar rechts, y naar beneden), zoals vanaf het noordelijk halfrond gezien. */
  const ZEEEN = [[-0.62, 0.02, 0.22, 0.38], [-0.52, -0.22, 0.14, 0.14], [-0.33, -0.36, 0.26, 0.2], [-0.12, -0.2, 0.1, 0.08], [0.13, -0.4, 0.15, 0.13], [0.3, -0.1, 0.18, 0.15], [0.17, 0.06, 0.09, 0.07], [0.66, -0.3, 0.09, 0.08], [0.55, 0.16, 0.11, 0.16], [0.34, 0.31, 0.08, 0.07], [-0.15, 0.36, 0.16, 0.12], [-0.42, 0.42, 0.09, 0.08], [-0.3, 0.16, 0.1, 0.09]];
  function maanSvg(ill, rand, draai, maat, sleutel) {
    const c = 50, r = 44, id = "nzm-" + sleutel;
    /* De verlichte vorm wordt rechts getekend (positiehoek 270°) en dan naar zijn
       echte stand gedraaid; de maanzeeën draaien mee met de hele maan. */
    const zeeen = `<g transform="rotate(${draai} ${c} ${c})">` + ZEEEN.map(([x, y, rx, ry]) => `<ellipse cx="${(c + x * r).toFixed(1)}" cy="${(c + y * r).toFixed(1)}" rx="${(rx * r).toFixed(1)}" ry="${(ry * r).toFixed(1)}"/>`).join("") + "</g>";
    let licht = "";
    if (ill >= 0.02) {
      let vorm;
      if (ill > 0.98) vorm = `<circle cx="${c}" cy="${c}" r="${r}" fill="#fff"/>`;
      else {
        const rx = r * Math.abs(1 - 2 * ill), binnen = ill > 0.5 ? 1 : 0, stand = (((270 - (rand - draai)) % 360) + 360) % 360;
        vorm = `<path fill="#fff" filter="url(#${id}-zacht)" transform="rotate(${Math.round(stand)} ${c} ${c})" d="M${c} ${c - r} A${r} ${r} 0 0 1 ${c} ${c + r} A${rx.toFixed(2)} ${r} 0 0 ${binnen} ${c} ${c - r}Z"/>`;
      }
      licht = `<mask id="${id}-licht">${vorm}</mask><g mask="url(#${id}-licht)"><circle cx="${c}" cy="${c}" r="${r}" fill="url(#${id}-dag)"/><g fill="#a99f86" opacity=".38" filter="url(#${id}-vaag)">${zeeen}</g></g>`;
    }
    return `<svg class="nz-maan-svg" viewBox="0 0 100 100" width="${maat}" height="${maat}" aria-hidden="true" focusable="false"><defs>`
      + `<radialGradient id="${id}-dag" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#fbf8ee"/><stop offset=".7" stop-color="#ece5d2"/><stop offset="1" stop-color="#d3cab3"/></radialGradient>`
      + `<radialGradient id="${id}-nacht" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#3a4541"/><stop offset="1" stop-color="#262e2b"/></radialGradient>`
      + `<filter id="${id}-zacht" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${maat < 40 ? 0.4 : 1.1}"/></filter>`
      + `<filter id="${id}-vaag" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${maat < 40 ? 1.2 : 2.2}"/></filter>`
      + `<clipPath id="${id}-schijf"><circle cx="${c}" cy="${c}" r="${r}"/></clipPath></defs>`
      + `<g clip-path="url(#${id}-schijf)"><circle cx="${c}" cy="${c}" r="${r}" fill="url(#${id}-nacht)"/><g fill="#1b211f" opacity=".3" filter="url(#${id}-vaag)">${zeeen}</g>${licht}</g>`
      + `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(127,127,127,.35)" stroke-width="${maat < 40 ? 1.6 : 0.6}"/></svg>`;
  }

  if (cfg.soort === "park") park();
  else if (cfg.soort === "overzicht") overzicht();
  else if (cfg.soort === "maan") maanPagina();
})();

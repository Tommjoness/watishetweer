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
  /* Eigen reserveroute (Visual Crossing, daarna WeatherAPI), zelfde vorm als Open-Meteo. */
  const RESERVE = "/api/forecast";
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
  /* Korte meter bij een score als "9/10": de lengte volgt het cijfer, de tint volgt de grenzen van het oordeel
     (goed vanaf 7, matig vanaf 4). De meter is sieraad (aria-hidden, geen tekst); score en oordeel blijven tekst. */
  const scoreMeter = tekst => {
    const m = /^(\d{1,2})\/10$/.exec(String(tekst).trim());
    if (!m) return "";
    const s = Math.min(10, Number(m[1]));
    return `<i class="nz-meter ${s >= 7 ? "goed" : s >= 4 ? "mid" : "laag"}" style="--s:${s / 10}" aria-hidden="true"></i>`;
  };
  const datumTekst = iso => { const p = iso.split("-").map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)); return DAGVOL[d.getUTCDay()] + " " + p[2] + " " + MAANDEN[p[1] - 1]; };
  const hoofdletter = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  const kortVenster = n => n.venster ? (n.venster.nu ? "nu tot " + n.venster.tot : n.venster.van + "–" + n.venster.tot) : "geen (" + (n.reden || "korter dan twee uur") + ")";
  const zichtTekst = m => m == null ? "onbekend" : m >= 10000 ? "10+ km" : (Math.round(m / 100) / 10).toString().replace(".", ",") + " km";
  function maanZin(m) {
    if (!m) return "onbekend";
    const delen = [hoofdletter(m.naam) + ", " + procent(m.ill * 100) + " verlicht"];
    if (m.momenten.length) delen.push(m.momenten.map(x => (x.type === "op" ? "op " : "onder ") + x.tijd).join(" · "));
    else delen.push((m.rest ? "de rest van de nacht " : "de hele nacht ") + (m.boven ? "boven" : "onder") + " de horizon");
    return delen.join(" · ");
  }
  function haal(url, ms) {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), ms || 10000) : null;
    return fetch(url, ctl ? { signal: ctl.signal } : undefined)
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .finally(() => { if (t) clearTimeout(t); });
  }
  /* Open-Meteo is primair. Faalt die (bijv. 503 "overloaded" of een time-out), dan
     probeert de losse parkpagina de reserveroute voor dit ene punt. Het overzicht
     van alle parken heeft bewust geen reserve: dat kost negentien aanvragen bij de
     betaalde bronnen. Ontbrekende velden blijven onbekend (nooit 0). */
  const metReserve = (lat, lon, uren) => haal(aanvraag(lat, lon, uren), 8000)
    .catch(() => haal(RESERVE + "?lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lon), 8000));
  /* ---------- verversingsbeleid ----------
     Een pagina die lang openstaat blijft kloppen. Het oordeel gaat over de rest van de nacht vanaf nu, dus:
     - iedere minuut wordt de uitkomst lokaal opnieuw berekend uit de opgehaalde verwachting (geen netwerk), alleen
       als de pagina zichtbaar is en bij terugkeer naar het tabblad of vanuit de terug-cache;
     - de opgehaalde verwachting wordt hoogstens een uur oud: daarna volgt één gewone aanvraag (zonder betaalde
       reserve), bij mislukken met toenemende wachttijd; er loopt nooit meer dan één aanvraag tegelijk;
     - werkende gegevens blijven staan als verversen mislukt; de regel "Verwachting van HH:MM" laat zien hoe oud ze zijn;
     - de DOM wordt alleen aangeraakt als de uitkomst verandert (open tabel, focus en voorgelezen tekst blijven). */
  const HERREKEN_MS = 60000, MAX_LEEFTIJD_MS = 3600000, WACHT_NA_FOUT_MS = [300000, 900000, 1800000];
  const st = { d: null, opgehaald: 0, laden: false, mislukt: 0, volgende: 0, timer: 0, uur: "", html: {}, tekst: "" };
  function bijgewerkt() {
    const el = document.getElementById("nz-bijgewerkt");
    if (!el || !st.opgehaald) return;
    const oud = st.mislukt > 0 && Date.now() - st.opgehaald >= MAX_LEEFTIJD_MS;
    const tekst = "Verwachting van " + K.naarLokaal(st.opgehaald, TZ) + "." + (oud ? " Verversen lukt nu niet." : "");
    if (tekst !== st.tekst) { st.tekst = tekst; el.textContent = tekst; }
    el.hidden = false;
  }
  /* herreken(): lokaal opnieuw tonen; false als er met deze gegevens niets meer te tonen is. ververs(): nieuwe
     gegevens ophalen en tonen (belofte); een fout laat het getoonde staan. */
  function houdBij(herreken, ververs, elkeMinuut) {
    if (st.timer) return;
    /* Het oordeel verandert per uur (de verwachting is uurdata): daar herberekenen we alleen bij een nieuw uur of bij
       terugkeer naar de pagina; de maan verandert doorlopend en wordt iedere minuut bijgewerkt. */
    const tik = e => {
      if (document.hidden) return;
      const uur = K.lokaleTijd(Date.now(), TZ).slice(0, 13);
      let bruikbaar = true;
      if (elkeMinuut || e || uur !== st.uur) { st.uur = uur; bruikbaar = herreken() !== false; }
      if (ververs && !st.laden && (!bruikbaar || Date.now() - st.opgehaald >= MAX_LEEFTIJD_MS) && Date.now() >= st.volgende) {
        st.laden = true;
        ververs().then(() => { st.mislukt = 0; st.volgende = 0; })
          .catch(() => { st.mislukt++; st.volgende = Date.now() + WACHT_NA_FOUT_MS[Math.min(st.mislukt, WACHT_NA_FOUT_MS.length) - 1]; })
          .finally(() => { st.laden = false; bijgewerkt(); });
      }
      bijgewerkt();
    };
    st.timer = setInterval(() => tik(false), HERREKEN_MS);
    document.addEventListener("visibilitychange", () => tik(true));
    window.addEventListener("pageshow", e => { if (e.persisted) tik(true); });
    window.addEventListener("online", () => tik(true));
  }
  /* Zet nieuwe HTML in een element, maar alleen als die van de vorige keer verschilt (de DOM kan al vertaald zijn). */
  function zetHtml(el, sleutel, html) {
    if (st.html[sleutel] === html) return false;
    st.html[sleutel] = html;
    el.innerHTML = html;
    return true;
  }

  /* Eén parkrij in het overzicht: wachtstand, geen gegevens of een gevulde nacht. De uitleg
     staat één keer boven de tabel; in de rij staat alleen "Niet beschikbaar"
     onder Vannacht en een streepje onder Beste periode (met een toegankelijke
     omschrijving, zodat een schermlezer niet alleen "streepje" hoort). */
  function rijStatus(rij, status) {
    if (!rij) return;
    const n = rij.querySelector(".nz-n .nz-w"), v = rij.querySelector(".nz-venster .nz-w");
    rij.classList.toggle("nz-niet", status === "niet");
    delete rij.dataset.nzSig;
    /* Het label "Beste periode" is op smalle schermen het enige dat de waarde duidelijk maakt (de
       kolomkoppen vervallen) en hoort dan voor schermlezers te bestaan, alleen bij geldige
       gegevens (zie de gegevenstak hieronder). Bij "niet beschikbaar" en tijdens laden draagt de omschrijving
       "Beste periode niet beschikbaar" de volledige betekenis; het label blijft dan verborgen om
       dubbel voorlezen te voorkomen. */
    const lbl = rij.querySelector(".nz-venster .nz-lbl");
    if (lbl) lbl.setAttribute("aria-hidden", "true");
    if (status === "niet") {
      n.textContent = "Niet beschikbaar";
      const streep = document.createElement("span");
      streep.setAttribute("aria-hidden", "true");
      streep.textContent = "—";
      const omschrijving = document.createElement("span");
      omschrijving.className = "nz-sr";
      omschrijving.textContent = "Beste periode niet beschikbaar";
      v.replaceChildren(streep, omschrijving);
    } else {
      n.textContent = v.textContent = "…";
    }
  }
  /* Eindfout: melding met een knop om het opnieuw te proberen. */
  function melding(el, tekst, opnieuw) {
    if (!el) return;
    if (!el.dataset.laden) el.dataset.laden = el.textContent;
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "nz-opnieuw";
    knop.textContent = "Opnieuw proberen";
    knop.addEventListener("click", () => {
      /* De knop verdwijnt zodra opnieuw wordt geladen: houd de focus op de statusregel (die blijft staan)
         en geef hem na het laden aan de inhoud (zie klaar()), zodat toetsenbordgebruikers hun plek houden. */
      if (document.activeElement === knop) { el.tabIndex = -1; el.dataset.focus = "1"; }
      knop.disabled = true; el.textContent = el.dataset.laden;
      if (el.dataset.focus) el.focus({ preventScroll: true });
      opnieuw();
    });
    const zin = document.createElement("span");
    zin.textContent = tekst;
    el.replaceChildren(zin, knop);
    el.hidden = false;
    /* Mislukt ook de nieuwe poging, dan krijgt de nieuwe knop de focus. */
    if (el.dataset.focus) { delete el.dataset.focus; knop.focus({ preventScroll: true }); }
  }
  /* De statusregel verdwijnt na het laden; had hij de focus (na "Opnieuw proberen"), dan gaat die naar de inhoud. */
  function klaar(status, inhoud) {
    if (!status) return;
    if (status.dataset.focus) {
      delete status.dataset.focus;
      if (inhoud) { inhoud.tabIndex = -1; inhoud.focus({ preventScroll: true }); }
    }
    status.hidden = true;
  }

  /* De uurwaarden van de grafiek als tekst voor toetsenbord en schermlezer: een uitklapbare tabel (zelfde
     patroon als "Grafiekgegevens als tabel" op de hoofdpagina). De balkjes zelf zijn niet focusbaar; de tabel
     heeft één tabstop (de samenvatting) en bevat tijd, bewolking, maanstand en de beoordeling per uur. */
  function urenTabel(uren) {
    const rijen = uren.map(u => `<tr><th scope="row">${esc(u.tijd)}</th><td>${u.bewolking == null ? "onbekend" : esc(procent(u.bewolking))}</td><td>${u.maanOp ? "maan op" : "maan niet op"}</td><td>${u.goed ? "goed om te kijken" : "te bewolkt, slecht zicht of te veel maanlicht"}</td></tr>`).join("");
    return `<details class="nz-gegevens"><summary>Bewolking per uur als tabel</summary><table><caption class="nz-sr">${esc("Bewolking per uur, " + uren[0].tijd + " tot " + uren[uren.length - 1].tijd)}</caption><thead><tr><th scope="col">Tijd</th><th scope="col">Bewolking</th><th scope="col">Maan</th><th scope="col">Beoordeling</th></tr></thead><tbody>${rijen}</tbody></table></details>`;
  }

  /* ---------- één park ---------- */
  function park() {
    const p = cfg.park, uit = document.getElementById("nz-vannacht"), lijst = document.getElementById("nz-nachten"), status = document.getElementById("nz-status");
    /* Toont de nachten uit d op dit moment; gooit als er geen nacht meer is. Ongewijzigde uitkomst raakt de DOM niet. */
    function toon(d) {
      const nachten = K.nachten(d, p.lat, p.lon, TZ, 6);
      if (!nachten.length) throw new Error("geen nachten");
      const n = nachten[0];
      const staven = n.uren.map(u => `<div class="nz-uur${u.goed ? " goed" : ""}" style="--h:${Math.max(2, Math.round(u.bewolking || 0))}%" title="${esc(u.tijd + ": " + (u.bewolking == null ? "bewolking onbekend" : procent(u.bewolking) + " bewolking") + (u.maanOp ? ", maan op" : ""))}"></div>`).join("");
      const tijden = n.uren.map(u => `<span>${esc(u.tijd.slice(0, 2))}</span>`).join("");
      const maanRij = n.uren.map(u => `<i class="${u.maanOp ? "op" : ""}"></i>`).join("");
      const html = `
<div class="nz-score"><span class="nz-cijfer">${esc(n.scoreTekst)}</span><span class="nz-oordeel"><b>${esc(n.oordeel)}</b><span>${esc(n.zin)}</span></span></div>
<dl class="nz-feiten">
<div><dt>Bewolking</dt><dd>gemiddeld ${n.bewolking == null ? "onbekend" : esc(procent(n.bewolking))}</dd></div>
<div><dt>Zicht</dt><dd>gemiddeld ${esc(zichtTekst(n.zicht))}</dd></div>
<div><dt>Maan</dt><dd>${esc(maanZin(n.maan))}</dd></div>
${n.zonOnder && n.zonOp ? `<div><dt>Zon</dt><dd>onder ${esc(n.zonOnder)} · op ${esc(n.zonOp)}</dd></div>` : ""}
</dl>
<figure class="nz-grafiek" aria-label="${esc("Bewolking per uur, " + n.uren[0].tijd + " tot " + n.uren[n.uren.length - 1].tijd)}">
<figcaption>Bewolking per uur <span class="nz-legenda"><span><i class="goed"></i>goed om te kijken</span><span><i></i>te bewolkt, slecht zicht of te veel maanlicht</span><span><i class="maan"></i>maan op</span></span></figcaption>
<div class="nz-staven" style="--n:${n.uren.length}" aria-hidden="true">${staven}</div>
<div class="nz-maanrij" style="--n:${n.uren.length}" aria-hidden="true">${maanRij}</div>
<div class="nz-tijden" style="--n:${n.uren.length}" aria-hidden="true">${tijden}</div>
</figure>
${urenTabel(n.uren)}`;
      const oud = uit.querySelector("details.nz-gegevens"), open = !!(oud && oud.open), focus = !!(oud && document.activeElement === oud.querySelector("summary"));
      if (zetHtml(uit, "uit", html)) {
        /* Een opnieuw opgebouwde grafiek houdt de uitklaptabel open en de focus waar die stond. */
        const nieuw = uit.querySelector("details.nz-gegevens");
        if (nieuw && open) nieuw.open = true;
        if (nieuw && focus) nieuw.querySelector("summary").focus({ preventScroll: true });
      }
      uit.hidden = false;
      zetHtml(lijst, "lijst", `<table><thead><tr><th scope="col">Nacht</th><th scope="col">Indicatie</th><th scope="col">Kijkvenster</th></tr></thead><tbody>${nachten.map(x => `<tr><th scope="row">${esc(x.label)}</th><td class="nz-n">${esc(x.scoreTekst)} <span>${esc(x.oordeel)}</span></td><td class="nz-zin">${esc(x.zin)}</td></tr>`).join("")}</tbody></table>`);
      lijst.hidden = false;
    }
    metReserve(p.lat, p.lon, 170).then(d => {
      toon(d);
      st.d = d; st.opgehaald = Date.now(); st.uur = K.lokaleTijd(st.opgehaald, TZ).slice(0, 13);
      bijgewerkt();
      klaar(status, uit);
      houdBij(() => { try { toon(st.d); return true; } catch (e) { return false; } },
        () => haal(aanvraag(p.lat, p.lon, 170), 8000).then(nieuw => { toon(nieuw); st.d = nieuw; st.opgehaald = Date.now(); }));
    }).catch(() => melding(status, "De verwachting kon niet worden geladen. Probeer het later opnieuw.", park));
  }

  /* ---------- overzicht van alle parken ---------- */
  /* ---------- direct antwoord boven het overzicht ---------- */
  /* Alleen wat al berekend is: de afgeronde score (7/10 of hoger heet in de hele site "Goed") en de
     redenen van de score. Een relatief beste park telt nooit als gunstig als alle parken slecht scoren. */
  const FACTOREN = ["neerslag", "bewolking", "maanlicht", "mist of zeer slecht zicht", "tijdelijk slechter zicht", "beperkt zicht"];
  const opsomming = lijst => lijst.length < 2 ? lijst.join("") : lijst.slice(0, -1).join(", ") + " en " + lijst[lijst.length - 1];
  function parkLinks(rijen, totaal) {
    if (rijen.length === totaal && totaal > 1) return "alle " + totaal + " parken";
    const link = r => `<a href="${esc(r.href)}" translate="no">${esc(r.naam)}</a>`;
    return rijen.slice(0, 3).map(link).join(", ") + (rijen.length > 3 ? " +" + (rijen.length - 3) : "");
  }
  function antwoordHtml(rijen) {
    const geldig = rijen.filter(r => r.n && r.n.score != null && /^\d+\/10$/.test(r.n.scoreTekst));
    if (!geldig.length) return "";
    const punt = r => Number(r.n.scoreTekst.split("/")[0]);
    const top = Math.max(...geldig.map(punt)), besten = geldig.filter(r => punt(r) === top);
    const gunstig = geldig.filter(r => punt(r) >= 7), rest = geldig.filter(r => punt(r) < 7);
    const factoren = groep => {
      const aantal = {};
      groep.forEach(r => (r.n.redenen || []).forEach(f => { aantal[f] = (aantal[f] || 0) + 1; }));
      return Object.keys(aantal).filter(f => aantal[f] * 2 >= groep.length)
        .sort((a, b) => aantal[b] - aantal[a] || FACTOREN.indexOf(a) - FACTOREN.indexOf(b)).slice(0, 3);
    };
    const zinnen = [];
    if (gunstig.length) {
      zinnen.push(`Vannacht zijn de omstandigheden in ${gunstig.length} van de ${geldig.length} parken gunstig (7/10 of hoger).`);
      zinnen.push(`Het best (${top}/10): ${parkLinks(besten, geldig.length)}.`);
      const f = rest.length ? factoren(rest) : [];
      if (f.length) zinnen.push(`Elders beperkend: ${opsomming(f)}.`);
    } else {
      zinnen.push("Vannacht is er geen park met gunstige omstandigheden.");
      zinnen.push(`Hoogste indicatie: ${top}/10 (${esc(besten[0].n.oordeel)}) in ${parkLinks(besten, geldig.length)}.`);
      const f = factoren(geldig);
      if (f.length) zinnen.push(`Beperkend in de meeste parken: ${opsomming(f)}.`);
    }
    if (geldig.length < rijen.length) { const n = rijen.length - geldig.length; zinnen.push(`Voor ${n} ${n === 1 ? "park" : "parken"} ontbreken gegevens.`); }
    return zinnen.join(" ");
  }

  function overzicht() {
    const parken = cfg.parken || [], status = document.getElementById("nz-status");
    if (!parken.length) return;
    /* Toont de uitkomst van lijst (één verwachting per park) op dit moment. Alle berekeningen gaan vóór de eerste
       DOM-wijziging; gooit als er voor geen enkel park een nacht is. Ongewijzigde rijen en antwoord blijven met rust. */
    function toon(lijst) {
      if (lijst.length !== parken.length) throw new Error("onvolledig");
      const uitkomst = parken.map((p, i) => ({ p, rij: document.querySelector(`tr[data-park="${p.slug}"]`), n: K.nachten(lijst[i], p.lat, p.lon, TZ, 1)[0] }));
      if (!uitkomst.some(x => x.rij && x.n)) throw new Error("leeg");
      const antwoordRijen = [];
      for (const { p, rij, n } of uitkomst) {
        if (!rij) continue;
        if (!n) { rijStatus(rij, "niet"); continue; }
        const koppeling = rij.querySelector("th a");
        antwoordRijen.push({ naam: koppeling ? koppeling.textContent : p.slug, href: koppeling ? koppeling.getAttribute("href") : "", n });
        const sig = n.scoreTekst + "|" + n.oordeel + "|" + kortVenster(n);
        if (rij.dataset.nzSig === sig && !rij.classList.contains("nz-niet")) continue;
        rij.dataset.nzSig = sig;
        rij.classList.remove("nz-niet");
        const periodeLabel = rij.querySelector(".nz-venster .nz-lbl");
        if (periodeLabel) periodeLabel.removeAttribute("aria-hidden");
        rij.querySelector(".nz-n .nz-w").innerHTML = `${esc(n.scoreTekst)} <span>${esc(n.oordeel)}</span>${scoreMeter(n.scoreTekst)}`;
        rij.querySelector(".nz-venster .nz-w").textContent = kortVenster(n);
        rij.querySelector(".nz-venster").classList.toggle("nz-geen", !n.venster);
      }
      const antwoord = document.getElementById("nz-antwoord"), html = antwoordHtml(antwoordRijen);
      if (antwoord && html) { zetHtml(antwoord, "antwoord", html); antwoord.hidden = false; }
      return antwoord && !antwoord.hidden ? antwoord : document.querySelector(".nz-tabel");
    }
    const lijstVan = data => Array.isArray(data) ? data : [data];
    const vraag = () => haal(aanvraag(parken.map(p => p.lat).join(","), parken.map(p => p.lon).join(","), 48), 15000).then(lijstVan);
    function laad() {
      parken.forEach(p => rijStatus(document.querySelector(`tr[data-park="${p.slug}"]`), "laden"));
      vraag().then(lijst => {
        const inhoud = toon(lijst);
        st.d = lijst; st.opgehaald = Date.now(); st.uur = K.lokaleTijd(st.opgehaald, TZ).slice(0, 13);
        bijgewerkt();
        klaar(status, inhoud);
        houdBij(() => { try { toon(st.d); return true; } catch (e) { return false; } },
          () => vraag().then(nieuw => { toon(nieuw); st.d = nieuw; st.opgehaald = Date.now(); }));
      }).catch(() => {
        parken.forEach(p => rijStatus(document.querySelector(`tr[data-park="${p.slug}"]`), "niet"));
        melding(status, "De verwachting voor vannacht kon niet worden geladen. Probeer het later opnieuw.", laad);
      });
    }
    laad();
  }

  /* ---------- maan ---------- */
  /* Eigen plaats (eigenaar, 12 oktober, wereldwijd): heeft de bezoeker in de app
     een plaats gekozen, dan gelden stand, op- en ondergang en tijden voor die
     plaats; anders voor het referentiepunt De Bilt. De plaats en de tijdzone
     staan al in de eigen browser (dezelfde opslag als de app); er gaat niets
     naar een server. Buiten Nederland is de tijdzone nodig: die komt uit de
     bewaarde verwachting van dezelfde plaats; ontbreekt die, dan De Bilt. */
  function geldigeZone(tz) { try { new Intl.DateTimeFormat("nl-NL", { timeZone: tz }); return true; } catch (e) { return false; } }
  function eigenPlaats() {
    try {
      const p = JSON.parse(localStorage.getItem("weerbriefing.plaats") || "null");
      const lat = Number(p && p.lat), lon = Number(p && p.lon), naam = String((p && p.label) || "").split(",")[0].trim();
      if (!p || !naam || !(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
      if (p.land === "NL") return { naam, lat, lon, tz: "Europe/Amsterdam", nl: true };
      const d = JSON.parse(localStorage.getItem("weerbriefing.data") || "null");
      const tz = d && d.d && d.d.timezone;
      if (!d || Math.abs(Number(d.lat) - lat) > 0.02 || Math.abs(Number(d.lon) - lon) > 0.02 || typeof tz !== "string" || !geldigeZone(tz)) return null;
      return { naam, lat, lon, tz, nl: false };
    } catch (e) { return null; }
  }
  function maanPagina() {
    const eigen = eigenPlaats(), r = eigen || { ...cfg.referentie, tz: TZ, nl: true };
    const m = K.maanOverzicht(Date.now(), r.lat, r.lon, r.tz);
    /* Ongewijzigde uitkomst (de pagina wordt iedere minuut opnieuw berekend) raakt de DOM en de maanfoto niet. */
    const handtekening = JSON.stringify([r.naam, r.tz, r.nl, m.naam, Math.round(m.ill * 100), m.op, m.onder, Math.round(m.rand), m.draai, m.fasen.map(f => f.datum + f.tijd)]);
    if (handtekening === st.html.maan) return;
    st.html.maan = handtekening;
    const set = (id, tekst) => { const el = document.getElementById(id); if (el) el.textContent = tekst; };
    set("nz-maan-naam", hoofdletter(m.naam) + ", " + procent(m.ill * 100) + " verlicht");
    /* In volgorde van de dag: wie eerst "onder 06:12" en dan "op 17:30" leest, ziet de maan ook in die volgorde. */
    const tijden = [["op", m.op], ["onder", m.onder]].filter(x => x[1]).sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)).map(x => x[0] + " " + x[1]).join(", ");
    set("nz-maan-tijden", tijden ? "Vandaag in " + r.naam + ": " + tijden + "." : "Vandaag komt de maan in " + r.naam + " niet op of niet onder.");
    set("nz-maan-plaats", r.naam);
    set("nz-maan-standplaats", r.naam);
    set("nz-maan-tijdzone", r.nl ? "Nederlandse tijd" : "plaatselijke tijd van " + r.naam);
    const elders = document.getElementById("nz-maan-elders");
    if (elders) elders.hidden = !r.nl;
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
  else if (cfg.soort === "maan") { maanPagina(); houdBij(() => { maanPagina(); return true; }, null, true); }
})();

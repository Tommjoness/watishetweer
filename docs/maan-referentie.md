# Maanreferentie (Moon 2.0, M0)

Onafhankelijke referentiegegevens van **NASA/JPL Horizons** voor de maan, plus een offline nulmeting van de huidige maankern. Dit is fase M0 van Moon 2.0 (zie `docs/open-meteo-monitoring.md` voor het CI-principe "geen live providers in CI").

M0 verandert **niets** aan de runtime: geen maanberekening, Nachtzichtscore, drempel, kijkvenster, vertaling of pagina. De Nachtzicht-onderzoekspilot blijft onaangeroerd.

## Bestanden

| Bestand | Rol |
|---|---|
| `scripts/maan-referentie/referentiekader.js` | De vaste lijst van locaties, momenten en opkomstvensters. Generator en test gebruiken dezelfde lijst |
| `scripts/maan-referentie/genereer-horizons.js` | Haalt de referentie live bij Horizons. **Draait nooit in CI** (weigert bij `CI` of `GITHUB_ACTIONS`) |
| `scripts/maan-referentie/horizons-2026-2028.json` | Vastgelegde referentie, met de exacte aanvraagparameters, de efemeride, de aardrotatiedekking en een inhoud-hash |
| `scripts/maan-referentie.test.js` | Offline test in `npm test`: integriteit, dekking, interne consistentie, CI-bewaking en nulmeting van de huidige kern |

## Bron en reproduceerbaarheid

- **Bron:** JPL Horizons API (`https://ssd.jpl.nasa.gov/api/horizons.api`, versie 1.2), efemeride **DE441**. Documentatie: <https://ssd.jpl.nasa.gov/horizons/manual.html>.
- **Opnieuw maken** (vanuit een omgeving die `ssd.jpl.nasa.gov` mag bereiken):
  `NODE_USE_ENV_PROXY=1 node scripts/maan-referentie/genereer-horizons.js`
- Elke aanvraag staat met alle parameters in `meta.aanvragen`. `meta.inhoudSha256` bewaakt dat niemand de gegevens met de hand wijzigt; de test faalt dan.
- **Aardrotatie:** Horizons meldt gemeten aardoriëntatiegegevens (EOP) tot 20 november 2026, en voorspellingen tot 15 februari 2027. Voor latere momenten is UT1−UTC dus niet gemeten. Het effect op topocentrische posities is hooguit enkele boogseconden [afgeleid: UT1−UTC < 1 s]. Bij een nieuwe generatie verschuift dit.

## Definities

| Term | Betekenis in de fixtures |
|---|---|
| Astrometrisch (Q1) | ICRF-positie met lichttijd, zonder aberratie en nutatie |
| Schijnbaar, airless (Q2, Q4) | Met lichttijd, aberratie, nutatie en precessie; **zonder** atmosferische refractie. Dit is de "geometrische hemelpositie" die je met een model zonder atmosfeer vergelijkt |
| Gebroken (Q4, `APPARENT=REFRACTED`) | Met het Horizons-refractiemodel (geel licht, 10 °C, 1010 mbar). Volgens Horizons is dit bij de horizon onzeker tot ±0,3° |
| Topocentrisch | Gezien vanaf de waarnemer (`coord@399`, geodetisch, hoogte in km) |
| Geocentrisch | Gezien vanaf het middelpunt van de aarde (`500@399`) |
| Opkomst en ondergang | `R_T_S_ONLY=GEO`, stap 1 minuut: de **gebroken bovenrand** op 0° boven de **geometrische** horizon, zonder kimduiking. De markering geldt voor de afgelopen stap, dus de nauwkeurigheid is ongeveer 1 minuut. Doorgang (`t`) en hoogste stand (`e`) gelden voor het middelpunt |

De huidige kern (`opOnder` in `index.html`) gebruikt voor de maan een middelpunthoogte van +0,125° als drempel. Dat is de gebruikelijke benadering (Meeus) van dezelfde gebeurtenis "gebroken bovenrand op de horizon", en daarmee rechtstreeks vergelijkbaar.

## Dekking

- **7 locaties:**
  - De Bilt;
  - Sydney;
  - Quito (evenaar, 2,85 km hoog);
  - Tokyo;
  - Longyearbyen (78°N, circumpolaire maan);
  - Ushuaia (55°S);
  - Apia (UTC+13, datumgrens).
- **30 momenten (2026, 2027 en 2028)**, per jaar:
  - smalle wassende en afnemende sikkel;
  - eerste en laatste kwartier;
  - bijna vol;
  - grote libratie;
  - beide Nederlandse klokwissels;
  - een moment rond elke zonnewende.

  De momenten zijn gekozen met een hulpbibliotheek; alle waarden komen uitsluitend van Horizons.
- **12 vensters van vijf etmalen per locatie** voor opkomst, doorgang en ondergang: rond de klokwissels en de zonnewendes.
  - Totaal 1371 gebeurtenissen.
  - Vijf vensters bij Longyearbyen hebben geen opkomst of ondergang. Daarvan is de gebroken hoogte op begin, midden en eind vastgelegd: drie keer steeds onder, twee keer steeds boven de horizon.

## Nulmeting van de huidige kern (ongewijzigd)

Gemeten tegen Horizons (topocentrisch, airless). Dit zijn eigenschappen van de bestaande kern, **geen** eis voor Moon 2.0:

| Grootheid | Mediaan | p95 | Max | Regressiegrens |
|---|---|---|---|---|
| Verlichting (procentpunt) | 0,38 | 1,60 | 2,34 | 2,4 |
| Hoogte (°; geocentrisch model, zonder parallax) | 0,79 | 2,07 | 2,49 | 2,5 |
| Randstand bij 5–95% verlichting (°) | 0,39 | 1,93 | 2,46 | 2,5 |
| Opkomst en ondergang buiten het poolgebied (min) | 2,7 | 8,3 | 14,6 | 15 |
| Opkomst en ondergang in het poolgebied (min) | 9,2 | 26,2 | 34,4 | 35, plus 1 bekende gemiste schampende opkomst |

**Toelichting:**
- Buiten 5–95% verlichting is de randstand wiskundig slecht bepaald: bij bijna volle of bijna nieuwe maan geeft een minieme positieafwijking een grote hoek. Daar is het maximum 11,8°; dat wordt gerapporteerd, maar niet begrensd.
- Bij Longyearbyen schampt de maan vaak langs de horizon, en daar wijkt de kern het meest af.
- Een kern die **slechter** wordt dan deze nulmeting, laat de test falen. De eisen voor Moon 2.0 worden in M1 apart vastgelegd.

# Maanreferentie (Moon 2.0, M0)

Onafhankelijke referentiegegevens van **NASA/JPL Horizons** voor de maan, plus een offline nulmeting van de huidige maankern. Dit is fase M0 van Moon 2.0 (zie `docs/open-meteo-monitoring.md` voor het CI-principe "geen live providers in CI").

M0 verandert **niets** aan de runtime: geen maanberekening, Nachtzichtscore, drempel, kijkvenster, vertaling of pagina. De Nachtzicht-onderzoekspilot blijft onaangeroerd.

## Bestanden

| Bestand | Rol |
|---|---|
| `scripts/maan-referentie/referentiekader.js` | De vaste lijst van locaties, momenten en opkomstvensters. Generator en test gebruiken dezelfde lijst |
| `scripts/maan-referentie/genereer-horizons.js` | Haalt de referentie live bij Horizons. **Draait nooit in CI** (weigert bij `CI` of `GITHUB_ACTIONS`) |
| `scripts/maan-referentie/horizons-2026-2028.json` | Vastgelegde referentie, met de exacte aanvraagparameters, de efemeride, de aardrotatiedekking en een inhoud-hash; inclusief validatiemonsters per 10 s rond 28 opkomst- en ondergangsmomenten |
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
| Astrometrisch (Q1) | ICRF-positie met alleen lichttijd: de "geometrische" richting naar de maan, zonder aberratie, nutatie of refractie |
| Schijnbaar, airless (Q2, Q4) | De richting waarin de maan aan de hemel staat (lichttijd, aberratie, nutatie, precessie), **zonder** atmosferische refractie. Hiermee vergelijk je een model zonder atmosfeer, zoals de huidige kern |
| Gebroken (Q4, `APPARENT=REFRACTED`) | Met het Horizons-refractiemodel (geel licht, 10 °C, 1010 mbar). Volgens Horizons is dit bij de horizon onzeker tot ±0,3° |
| Topocentrisch | Gezien vanaf de waarnemer (`coord@399`, geodetisch, hoogte in km) |
| Geocentrisch | Gezien vanaf het middelpunt van de aarde (`500@399`) |
| Opkomst en ondergang | `R_T_S_ONLY=GEO`, stap 1 minuut: de **gebroken bovenrand** op 0° boven de **geometrische** horizon, zonder kimduiking. De markering geldt voor de afgelopen stap. Gemeten nauwkeurigheid: zie de validatie hieronder (ongeveer ±1,5 min). Doorgang (`t`) en hoogste stand (`e`) gelden voor het middelpunt |

### Horizondefinities: huidige kern tegenover Horizons

| Aspect | Huidige kern (`index.html`) | Horizons-referentie (deze fixtures) | Gevolg voor de vergelijking |
|---|---|---|---|
| Positie | Vereenvoudigde **geocentrische** maan- en zonpositie (enkele termen), schijnbaar | DE441, topocentrisch en geocentrisch, schijnbaar (lichttijd, aberratie, nutatie) | De rekenfout van de kern staat los van het topocentrisch-geocentrisch-verschil. Beide worden apart gemeten |
| Hoogte (`maanHoogte`) | **Geometrisch, geocentrisch, middelpunt**; de breedte gaat rechtstreeks in de bolformule; geen parallax, geen refractie | `Elevation_(a-app)`: topocentrisch, middelpunt, zonder refractie. `Elevation_(r-app)`: met refractie | Modelafwijking: kern tegenover een uit Horizons berekende geocentrische hoogte met dezelfde vereenvoudiging. Het verschil met topocentrisch (parallax, max 0,99°) is een **definitieverschil**, geen kernfout |
| Opkomst en ondergang (`opOnder`) | Geocentrische middelpunthoogte = **+0,125°**. Dit is de standaardhoogte uit Meeus: 0,7275·π − 34′, met vaste gemiddelde parallax π ≈ 0,95°, vaste refractie 34′ en vaste halve diameter (0,2725·π) | `R_T_S_ONLY=GEO`: **gebroken bovenrand** op 0° boven de **geometrische** horizon (geen kimduiking), met het Horizons-refractiemodel | **Zelfde gebeurtenis.** De kern benadert hem met vaste waarden: de parallax varieert 0,90–1,01°, dus h0 varieert ongeveer ±0,04°. Ook de refractie bij de horizon is in werkelijkheid onzeker (Horizons: ±0,3°) |
| Zoekresolutie | Stap 10 min, daarna bisectie (sub-seconde binnen het eigen model) | Stap **1 min**; de markering geldt voor de afgelopen stap | De referentie is geen exacte seconde. Zie de validatie hieronder |
| Waarnemershoogte | Niet gebruikt | Gebruikt (geodetisch, km); GEO gebruikt geen kimduiking | Bij Quito (2,85 km) is het effect op de parallax verwaarloosbaar; kimduiking telt bewust niet mee |

**Validatie van de Horizons-tijdstippen** (`opkomstValidatie`, offline getoetst):
- Methode: voor 28 gebeurtenissen de gebroken middelpunthoogte en de schijfdiameter per 10 s.
- Resultaat: de gebroken bovenrand (middelpunt + halve diameter) gaat **68 s vóór tot 19 s ná** de gerapporteerde Horizons-minuut door 0° (24 niet-schampende gevallen).
- **Conclusie:** de referentie is op ongeveer ±1,5 min nauwkeurig. Een nauwkeurigheidsdoel van 1 minuut is met de RTS-tijden van Horizons alleen **niet** te toetsen. Voor M1 moet de referentie dan uit deze fijne hoogtemonsters komen (interpolatie), niet uit de RTS-minuut.
- **Schampende maan** (hoogteverandering < 0,05°/min, in deze set alleen Longyearbyen):
  - De kruising is slecht bepaald: tot 103 s van de minuut, of niet eenduidig.
  - Een hoogteverschil van 0,1° betekent daar al minuten. Grote tijdsverschillen zijn hier dus vooral een eigenschap van de geometrie, geen fout van de kern alleen.

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

Steeds apart gemeten, zodat definitieverschillen niet als kernfout gelden:
- **Modelafwijking:** de kern tegenover Horizons met **dezelfde definitie** als de kern (geocentrisch, middelpunt, zonder refractie). Dit is de werkelijke rekenfout. Er geldt een regressiegrens: hij mag niet groter worden.
- **Definitieverschil:** Horizons topocentrisch tegenover geocentrisch. Dat ziet de waarnemer extra, maar de kern berekent het bewust niet. Dit wordt alleen gerapporteerd.
- **Totaal:** de kern tegenover topocentrisch, dus het verschil met wat de waarnemer ziet. Hiervoor geldt de eerdere regressiegrens, die blijft staan.

| Grootheid | Modelafwijking (mediaan / p95 / max) | Definitieverschil (max) | Totaal (max) | Grenzen (model / totaal) |
|---|---|---|---|---|
| Verlichting (procentpunt) | 0,18 / 1,28 / 1,74 | 0,84 | 2,34 | 1,8 / 2,4 |
| Hoogte (°) | 0,51 / 1,35 / 1,65 | 0,99 (parallax) | 2,49 | 1,7 / 2,5 |
| Randstand bij 5–95% verlichting (°) | 0,38 / 0,91 / 1,11 | 1,77 | 2,46 | 1,2 / 2,5 |

**Opkomst en ondergang:**
- Gemeten als afstand tot het referentie-interval: de Horizons-minuut van 90 s ervoor tot 30 s erna.
- Ook uitgedrukt als **hoogte-equivalent** (tijdsverschil × hoogteverandering per minuut).

| Groep | Tijd (mediaan / p95 / max) | Hoogte-equivalent (max) | Gemist | Grenzen |
|---|---|---|---|---|
| Niet schampend (n=710) | 1,7 / 7,3 / 18,6 min | 1,65° | 0 | 19 min, 1,7°, 0 gemist |
| Schampend, < 0,05°/min (n=30, Longyearbyen) | 7,9 / 28,2 / 33,9 min | 1,27° | 1 | 35 min, 1,3°, ≤ 1 gemist |

**Toelichting:**
- Het hoogte-equivalent van de opkomstverschillen (max 1,65°) is even groot als de modelafwijking in de hoogte (max 1,65°). De minutenverschillen komen dus uit de vereenvoudigde maanpositie van de kern, versterkt door schuine of schampende maanbanen. Ze komen niet uit een andere horizondefinitie.
- Buiten 5–95% verlichting is de randstand slecht bepaald; de modelafwijking is daar max 5,55°. Dat wordt gerapporteerd, maar niet begrensd.
- In vijf vensters zonder opkomst of ondergang (Longyearbyen) vindt de kern ook geen gebeurtenis.
- De grenzen beschrijven de **bestaande** kern: een wijziging die hem slechter maakt, faalt. Het zijn geen eisen voor Moon 2.0; die volgen in M1.

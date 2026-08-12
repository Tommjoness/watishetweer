# Wat is het weer?

Nederlandstalige weerapp voor `watishetweer.nl`. De applicatie combineert actuele en verwachte weerdata met een centrale interpretatielaag, neerslag, luchtkwaliteit, pollen, waarschuwingen en Nachtzicht.

## Productie en build

Vercel bouwt de applicatie met:

```bash
npm run build
```

De build assembleert de canonieke bronbestanden en gecontroleerde buildlagen tot `public/`. Vercel publiceert die map als productie-artifact. Wijzig daarom niet handmatig bestanden in `public/`; die map wordt opnieuw opgebouwd.

Belangrijke ingangen:

- `index.html` — hoofdtemplate en primaire browserlogica.
- `interpretatie-engine.js` — centrale interpretatielogica.
- `build-weather.js` — assembleert het productie-artifact en bindt de serviceworker-cache aan de app-shell.
- `scripts/` — afgebakende build-, verificatie- en regressielagen.
- `api/` — publieke Vercel-routes; bevat alleen de dunne API-wrappers.
- `lib/` — serverlogica achter de API-wrappers.
- `vercel.json` — build/output en algemene responseheaders.

## API-routes

De huidige publieke serverroutes zijn:

- `api/plaatsnaam.mjs` — reverse geocoding voor `Mijn locatie` wanneer de directe BigDataCloud-resolutie niet genoeg oplevert.
- `api/waarschuwingen.mjs` — officiële weerwaarschuwingen op basis van de gekozen locatie.

Serverlogica staat in `lib/`. Voeg niet zomaar extra bestanden aan `api/` toe: ieder bestand daar wordt een publieke functie.

### Reverse geocoding

De standaardfallback is de publieke Nominatim-dienst van OpenStreetMap. De serverroute rondt coördinaten af, gebruikt een herkenbare product-User-Agent en geeft cache-instructies mee.

De basis-URL kan optioneel zonder codewijziging worden omgezet naar een andere Nominatim-compatible dienst:

```text
NOMINATIM_BASE_URL=https://geo.example.nl/nominatim
```

Zonder deze variabele blijft `https://nominatim.openstreetmap.org` de standaard. Een expliciet ingestelde maar ongeldige URL faalt gesloten; de applicatie schakelt dan niet stil terug naar de publieke dienst.

### Waarschuwingen

- Verenigde Staten en ondersteunde gebieden: National Weather Service, op coördinaat.
- Europa: MeteoAlarm, waarbij bruikbare CAP-gebiedsinformatie tegen het gekozen punt wordt gecontroleerd.
- Elders: geen bron als er geen betrouwbare ondersteunde waarschuwingbron is.

Een waarschuwing wordt alleen als plaatsgebonden kaart doorgegeven wanneer de server expliciet bewijs voor die plaatsdekking heeft. Landbrede of onbekende scope wordt niet als lokale waarschuwing gepresenteerd.

## Belangrijkste externe bronnen

| Onderdeel | Bron |
|---|---|
| actuele, uur- en dagverwachting | Open-Meteo |
| locatie zoeken | Open-Meteo Geocoding |
| luchtkwaliteit en pollen | Open-Meteo Air Quality |
| reverse geocoding | BigDataCloud, met Nominatim-compatible serverfallback |
| waarschuwingen VS | National Weather Service |
| waarschuwingen Europa | MeteoAlarm |
| kaartondergrond | CARTO / OpenStreetMap-attributie |

Zon- en maanstanden worden lokaal berekend. Bronvermeldingen die leveranciers vereisen staan in de interface en mogen niet zonder inhoudelijke controle worden verwijderd.

## Testen

De minimale lokale kwaliteitsketen is:

```bash
npm test
```

De buildketen is:

```bash
npm run build
```

De repository bevat daarnaast echte browsercontroles voor Chromium en WebKit, mobiele en desktopbreedtes, performance, neerslagrandgevallen, internationale locaties en serviceworker/offlinegedrag. GitHub Actions is de uiteindelijke merge-eis; een wijziging hoort niet gemerged te worden op basis van alleen een lokale groene subset.

Belangrijke contracten die expliciet worden getest:

- ontbrekende waarden mogen niet stil `0` worden;
- neerslagkans en neerslaghoeveelheid blijven semantisch gescheiden;
- plaats- en tijdlogica gebruikt de tijdzone van de gekozen locatie;
- geocodingduplicaten worden generiek verwijderd zonder gelijknamige echte plaatsen samen te voegen;
- waarschuwingen zijn fail-closed wanneer plaatsdekking niet bewezen is;
- lange plaatsnamen mogen geen horizontale overflow veroorzaken;
- het definitieve artifact en de serviceworker-cacheversie moeten bij elkaar horen;
- dezelfde kernfunctionaliteit wordt in Chromium en WebKit gecontroleerd.

## Serviceworker en cache

De serviceworker-versie wordt tijdens de build afgeleid van de definitieve app-shell. Verhoog of wijzig daarom niet handmatig een cacheversie om een wijziging ‘zichtbaar’ te krijgen. De gedeelde build-/postbuildhelpers vernieuwen en verifiëren de cachehash nadat het artifact is gewijzigd.

## Werkwijze voor wijzigingen

Werk via een aparte branch en pull request. Houd wijzigingen klein en bewijsbaar:

1. oorzaak vaststellen;
2. plan bepalen;
3. broncode aanpassen;
4. relevante unit-/contracttests toevoegen of bijwerken;
5. volledige regressie- en browserketen draaien;
6. preview controleren waar toegankelijk;
7. pas na merge productie, runtimefouten en het uiteindelijke deployment-SHA controleren.

Weerformules, interpretatiebeleid, waarschuwing-scope en andere productregels horen niet als screenshotpatch of plaats-specifieke uitzondering te worden aangepast. Nieuwe oplossingen moeten generiek blijven voor huidige en toekomstige locaties.

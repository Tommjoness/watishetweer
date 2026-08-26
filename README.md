# Wat is het weer?

Nederlandstalige weerapp voor `watishetweer.nl`. De applicatie combineert actuele en verwachte weerdata met een centrale interpretatielaag, neerslag, luchtkwaliteit, pollen, waarschuwingen en Nachtzicht.

## Productie en build

De productie draait op Cloudflare Pages. GitHub Actions bouwt en publiceert exact de gemergede `main`-SHA met:

```bash
npm run build:cloudflare
```

De basisbuild assembleert de canonieke bronbestanden en gecontroleerde buildlagen tot `public/`. `scripts/cloudflare-output.js` voegt daarna de Cloudflare Pages-output toe. Wijzig daarom niet handmatig bestanden in `public/`; die map wordt opnieuw opgebouwd.

Belangrijke ingangen:

- `index.html` — hoofdtemplate en primaire browserlogica.
- `interpretatie-engine.js` — centrale interpretatielogica.
- `build-weather.js` — assembleert het productie-artifact en bindt de serviceworker-cache aan de app-shell.
- `scripts/` — afgebakende build-, verificatie- en regressielagen.
- `api/` — gedeelde serverroute-modules en Cloudflare-cachebeleid.
- `functions/api/` — dunne Cloudflare Pages Function-bindings voor de publieke API-routes.
- `functions/_middleware.js` — securityheaders voor Pages Functions.
- `cloudflare/_headers` — canonieke securityheaders voor statische Pages-responses.
- `wrangler.jsonc` — Cloudflare Pages-projectconfiguratie.

De repository bevat geen tweede productieplatformconfiguratie. Cloudflare is de enige deployment- en runtimebron van waarheid.

## API-routes

De huidige publieke serverroutes zijn:

- `/api/plaatsnaam` — reverse geocoding voor `Mijn locatie` wanneer de directe BigDataCloud-resolutie niet genoeg oplevert.
- `/api/neerslag` — korte-termijnneerslag, met KNMI binnen ondersteunde dekking en gecontroleerde fallbacksemantiek.
- `/api/waarschuwingen` — officiële weerwaarschuwingen op basis van de gekozen locatie.

Serverlogica staat in `lib/`. De modules in `api/` leggen het HTTP-contract vast; `functions/api/` koppelt die modules aan Cloudflare Pages Functions. Cache-instructies voor CDN-responses gebruiken uitsluitend `Cloudflare-CDN-Cache-Control`.

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
| korte-termijnneerslag Nederland | KNMI |
| waarschuwingen VS | National Weather Service |
| waarschuwingen Europa | MeteoAlarm |
| kaartondergrond | CARTO / OpenStreetMap-attributie |

Zon- en maanstanden worden lokaal berekend. Bronvermeldingen die leveranciers vereisen staan in de interface en mogen niet zonder inhoudelijke controle worden verwijderd.

## Testen

De minimale lokale kwaliteitsketen is:

```bash
npm test
```

De Cloudflare-buildketen is:

```bash
npm run build:cloudflare
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
- dezelfde kernfunctionaliteit wordt in Chromium en WebKit gecontroleerd;
- productie moet aantoonbaar via Cloudflare lopen en exact overeenkomen met de verwachte GitHub-SHA.

## Serviceworker en cache

De serviceworker-versie wordt tijdens de build afgeleid van de definitieve app-shell. Verhoog of wijzig daarom niet handmatig een cacheversie om een wijziging zichtbaar te krijgen. De gedeelde build- en postbuildhelpers vernieuwen en verifiëren de cachehash nadat het artifact is gewijzigd.

Cloudflare CDN-cachebeleid voor de API staat in de route-modules en gebruikt `Cloudflare-CDN-Cache-Control`. Foutresponses blijven `private, no-store`.

## Werkwijze voor wijzigingen

Werk via een aparte branch en pull request. Houd wijzigingen klein en bewijsbaar:

1. oorzaak vaststellen;
2. plan bepalen;
3. broncode aanpassen;
4. relevante unit- en contracttests toevoegen of bijwerken;
5. volledige regressie- en browserketen draaien;
6. Cloudflare-preview controleren waar de workflow beschikbaar is;
7. pas na merge de Cloudflare-productiedeployment en production-smoke op dezelfde SHA controleren.

Weerformules, interpretatiebeleid, waarschuwing-scope en andere productregels horen niet als screenshotpatch of plaats-specifieke uitzondering te worden aangepast. Nieuwe oplossingen moeten generiek blijven voor huidige en toekomstige locaties.

## Productie terugdraaien

Gebruik een rollback alleen bij een bewezen productiestoring of ernstige regressie. De broncode op `main` en de actieve Cloudflare-deployment moeten uiteindelijk weer naar dezelfde bekende goede toestand wijzen.

1. Leg de fout, het tijdstip en de actieve build-SHA vast. De productie-HTML bevat hiervoor `weather-build-sha`.
2. Bepaal de laatste bekende goede commit of pull request.
3. Maak een gerichte revert op een aparte branch en laat de verplichte GitHub-checks volledig uitlopen.
4. Merge de revert pas wanneer de tests groen zijn. De workflow `Cloudflare production` publiceert daarna automatisch exact de nieuwe `main`-SHA.
5. Verifieer vervolgens de workflow `WeatherNow production smoke`, inclusief `www`-redirect, securityheaders, API-contracten en de wereldwijde mobiel/desktopmonitor.

Bij een acute storing kan een eerder bekend goed Pages-deployment tijdelijk vanuit Cloudflare worden hersteld. Repareer daarna alsnog de broncode via GitHub, zodat productie en `main` niet uiteen blijven lopen.

# Open-Meteo: CI zonder live aanroepen, beschikbaarheid buiten CI

Sinds 20 november 2026 doet GitHub Actions geen live aanroepen meer naar Open-Meteo. Open-Meteo (Patrick Zippenfenig, ticket #235915) bevestigde dat IP-adressen bij misbruik agressief worden geblokkeerd en beperkt, en vroeg om in CI mocktests te gebruiken in plaats van live API-aanroepen. GitHub-runners delen hun IP-adressen met veel andere gebruikers.

## Wat CI nu doet

- **Deterministische fixtures.** Browserchecks tegen preview en productie laden de echte site. Voor `*.open-meteo.com` (forecast, luchtkwaliteit, geocoding, hoogte) krijgen ze een contractgetrouw antwoord van `scripts/openmeteo-fixture.js`. Dat antwoord wordt opgebouwd uit de aanvraag van de pagina zelf: dezelfde velden, lengtes en tijdzone, één vaste UTC-offset, poolnacht en 24 uur daglicht zoals Open-Meteo ze levert, en HTTP 400 bij een onbekend veld. De bestaande controles (bronwaarheid, SHA, layout, toegankelijkheid, prestaties van de eigen site) blijven ongewijzigd.
- **Bewaker.** Iedere CI-job die bouwt, test of een browser start, laadt `scripts/ci/geen-live-openmeteo.cjs` via `NODE_OPTIONS`.
  - Open-Meteo is dan onbereikbaar: Node-DNS, `fetch` en `http(s)` worden geweigerd. Chromium krijgt een resolverregel, en iedere browsercontext krijgt een vangnetroute.
  - Elke poging wordt vastgelegd. De laatste stap van de job (`node scripts/ci/geen-live-openmeteo-controle.js`) faalt bij één poging, ook als een test die fout zelf wegving.
- **Contracttests.** `scripts/ci/geen-live-openmeteo.test.js` toetst de bewaker en eist de bewaker in alle relevante workflowjobs. Daarnaast verbiedt deze test Open-Meteo-hosts en live Open-Meteo-scripts in workflows. `scripts/history-fixture-synthetisch.test.js` toetst het fixturecontract.

## Wat uit CI is gehaald

| Was in CI | Nu |
|---|---|
| `production-smoke.js`: elk uur een live Open-Meteo-aanvraag als bronbeschikbaarheid | Uitkomst "controle niet uitgevoerd" (eerlijk: geen volledige acceptatie); de reserveroute wordt nog wel bewezen |
| `netwerkdiagnostiek.js https://api.open-meteo.com` bij een mislukte finale-releasejob | Alleen de eigen site |
| `openmeteo-daggrens-contract.js` (providercontract dagwaarden) bij iedere PR | Handmatig of periodiek buiten CI (zie hieronder) |
| Wereldwijde, finale-release- en pre-salemonitors: de exacte productie-URL live ophalen (met retries, afkoeling en pacing) en als fixture teruggeven | Dezelfde exacte URL, beantwoord met de contractgetrouwe fixture |
| Browserchecks zonder mock (week, mobiele CLS, live-performance, release-recovery, navigatie, WeatherAPI-reserve, preview-responsive, CWV, staff-audit) | Fixture voor alle Open-Meteo-hosts |

**Dekkingsverschuiving (bewust).** CI bewijst nu dat de site met een geldig Open-Meteo-antwoord goed werkt. Dat geldt voor iedere build, voor productie en voor alle 11+ locaties. CI bewijst niet meer:

- dat Open-Meteo op dit moment bereikbaar is;
- dat de live respons nog hetzelfde contract volgt;
- hoe snel Open-Meteo antwoordt.

Dat zijn providervragen. Die horen bij de monitoring hieronder.

**Nog live in GitHub Actions:** alleen `knmi-modelverificatie.yml`. Die draait per kwartaal en handmatig, en vergelijkt historische modeldata van Open-Meteo met KNMI-metingen. Het is een wetenschappelijke kwartaalcontrole en geen PR-CI-test, en een fixture kan die meting per definitie niet vervangen.

De eigenaar besloot op 20 november 2026: voorlopig ongewijzigd laten, en niet verwijderen zonder een werkend alternatief. De eerstvolgende geplande run is op 5 januari 2027. Mogelijke routes buiten gedeelde GitHub-runners, van licht naar zwaar:

| Route | Wat er nodig is | Afweging |
|---|---|---|
| A. Open-Meteo om akkoord vragen (ticket #235915) voor deze ene kwartaalrun | Eén bericht | Geen werk. Bij akkoord kan de workflow blijven; bij nee een van de routes hieronder |
| B. Handmatig lokaal draaien door de eigenaar | Node 22, de KNMI-sleutel lokaal, `DAGEN=28 UITVOER=… SAMENVATTING=… node scripts/knmi-modelverificatie.js`; de samenvatting met de hand in het resultatenissue zetten | Eigen IP, geen nieuwe infrastructuur; vergt vier keer per jaar een handeling |
| C. Self-hosted runner (eigen machine of VPS) alleen voor deze workflow | Runner installeren, `runs-on` aanpassen, secret en issuemelding blijven werken | Vast eigen IP en de automatisering blijft. Bij een openbare repository raadt GitHub self-hosted runners af; dit vraagt strikte beperking tot deze ene workflow zonder PR-trigger |
| D. Geplande Cloudflare Worker | Script porten, KNMI-sleutel als Worker-secret, uitkomst via een eigen GitHub-token naar het issue | Het meeste werk en nieuwe secrets; alleen zinvol als B en C afvallen |

Advies: eerst A. Bij een nee wordt B de standaard en C optioneel. Pas wanneer het gekozen alternatief één keer aantoonbaar heeft gewerkt, kan de geplande trigger uit de workflow.

## Monitoringstrategie buiten GitHub Actions

De eigenaar besloot op 20 november 2026: de echte beschikbaarheid van Open-Meteo wordt bewaakt door een afzonderlijke Hatchable-dienst, onafhankelijk van CI en buiten deze repository. Production-smokes blijven deterministisch. De punten hieronder zijn input voor die dienst.

**Contractvergelijking.** Een wijziging in het Open-Meteo-contract mag niet ongemerkt blijven doordat CI fixtures gebruikt. De monitoringdienst slaat daarom periodiek (bijvoorbeeld wekelijks) één echt antwoord op voor de forecast-URL die de app opbouwt, met het moment van ophalen. Daarna vergelijkt hij dat antwoord zonder netwerk met de fixture:

`WIW_ECHTE_OPENMETEO=<pad naar het opgeslagen JSON-antwoord> WIW_ECHTE_OPENMETEO_URL='<de exacte aanvraag>' WIW_ECHTE_OPENMETEO_NU=<ISO-moment van ophalen> node scripts/history-fixture-synthetisch.test.js`

Wat wordt vergeleken (`vergelijkContract` in `scripts/openmeteo-fixture.js`):
- kopvelden, tijdzone en offset;
- welke blokken en variabelen er zijn, en hun eenheden;
- lengtes, tijdformaat en tijdstap;
- waardetypes. `null` in het echte antwoord is toegestaan.

Bij een verschil faalt de vergelijking met een lijst van afwijkingen. Dan worden de fixture en de app bewust bijgewerkt. Het echte antwoord gaat niet in de repository.

1. **Echte bezoekers als primaire bron, zonder extra verzoeken.** PostHog krijgt al `weather_view_ready` (met laadduurband) en `weather_view_failed` (met fouttype). Cloudflare ziet aan de reserveroute `/api/forecast` (header `x-wiw-weather-source`) hoe vaak Open-Meteo bij bezoekers faalt. Voorstel: een alarm wanneer het aandeel `weather_view_failed` of het gebruik van de reserveroute duidelijk boven het normale niveau komt. De drempel bepalen we pas na een week meten.
2. **Eén lichte synthetische controle, vanaf een eigen, niet-gedeeld adres.** Een kleine geplande taak buiten GitHub Actions doet hooguit één minimale aanvraag per 30 tot 60 minuten, met een eigen User-Agent.
   - Een tijdelijke fout krijgt geen herhaling; een 429 wordt gerespecteerd.
   - Een melding volgt pas na drie opeenvolgende fouten.
   - Dit draait in de Hatchable-dienst (besluit eigenaar), niet in deze repository.
3. **Providercontracten periodiek.** `node scripts/openmeteo-daggrens-contract.js` (hooguit wekelijks) en de contractvergelijking hierboven draaien in de monitoringdienst of lokaal, nooit in CI. Het daggrenscontract controleert of Open-Meteo `precipitation_probability_max` berekent over de tijdstempels 00:00-23:00. De app rekent zelf met de uren 00-24 en gebruikt dat dagveld alleen als terugval. De fixture volgt hetzelfde venster en `history-fixture-synthetisch.test.js` legt dat vast. KNMI-modelverificatie blijft voorlopig ongewijzigd. Een afwijking wordt een gewone issue of PR.
4. **Scheiding blijft hard.** Monitoringscripts horen niet in `npm test` of in een workflow. De bewaker en de workflowcontrole in `geen-live-openmeteo.test.js` houden dat afgedwongen.

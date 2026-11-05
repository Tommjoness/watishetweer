# Gesharde testketen (P3-4, PR B): ontwerp, bewijs en uitrol

Status: **aanvullende, niet-verplichte controle** (workflow `Shadow testketen (niet verplicht)`, jobs `shadow-*`). De vereiste checks `test`, `quality` en `checkpoint` en hun jobs (`test`, `checkpoint-npm-test`, `checkpoint-browsers`) zijn ongewijzigd. `npm test` blijft de volledige keten voor lokaal gebruik.

## Waarom
`npm test` voert 272 `node`-commando's achter elkaar uit (ca. 60 minuten; lokaal 60,3 min). De jobs `test` en `checkpoint-npm-test` doen dat elk op een eigen runner, in twee verschillende browseromgevingen. Dit ontwerp haalt de wachttijd uit één runner zonder één test, assertion of kwaliteitsgate aan te passen.

## Indeling van de 272 commando's (afgeleid uit package.json, geen tweede lijst)
| Fase | Commando's | Waar |
|---|---|---|
| Bouwfase: alles tot en met het laatste muterende commando (`apply-voet.js`, #203) | 204 (109 prebuild-tests, `artifact:base`, 8 `test:built`, 14 `browser-smoke`, alle `apply-*` en `verify-*`, `platform-output-cleanup`, `run-prelaunch-isolated`) | één bouwjob per testfamily, in de oorspronkelijke volgorde |
| Shardfase: alles daarna (draait al tegen het definitieve artifact) | 68 | vier shards per testfamily |

De 46 niet-muterende commando's uit de tussenfasen (8 `test:built`, 14 smoke-browsertests en verify-scripts) zijn **fase-gebonden**: tegen het definitieve artifact falen er 32 (gemeten 5 november 2026; `public/` ongewijzigd na afloop, checksum gelijk). Ze zijn geschreven voor het artifact vóór `platform-output-cleanup` (inline scripts, markers en commentaar). Ze blijven daarom in de bouwfase, in dezelfde volgorde; ze kosten samen 1,5 minuut. De 14 smoke-tests draaien daardoor (net als nu) niet tegen het gebundelde artifact; dat is een bestaande dekkingsgrens en geen onderdeel van deze wijziging.

## Testfamilies en omgevingen
| Familie | Runner/omgeving | Zoals |
|---|---|---|
| `test` | `ubuntu-latest`, systeem-Chrome | job `test` |
| `checkpoint` | Playwright-container `v1.62.1-noble`, gekoppelde Chromium, WebKit beschikbaar | job `checkpoint-npm-test` |

Elke familie bouwt zelf (de bouwfase draait in de eigen omgeving), zodat de browseromgevingen gescheiden blijven. De CLS-budgetcontrole (`browser-mobile-cls-budget.test.js`) en de staff-audit in Chromium en WebKit staan ongewijzigd in `shadow-checkpoint-extra`, op een eigen runner na het controleren van het artifact.

## Veiligheidsmaatregelen
- **Dekking:** `scripts/ci/verifieer-dekking.js plan` bewijst vooraf dat elk van de 272 commando's precies één keer in de bouwfase of in precies één shard zit, dat de bouwfase een voorvoegsel in de oorspronkelijke volgorde is en dat er geen muterend commando in een shard zit. Achteraf bewijst `resultaten` dat per familie elk commando precies één keer is uitgevoerd met status 0.
- **Fail-closed aggregatie (`shadow-aggregatie`):** draait altijd; rood bij een job die niet `success` is (ook `skipped` of `cancelled`), een ontbrekend, onleesbaar, dubbel of onafgerond rapport, een ontbrekende of extra shard of een niet-toegewezen commando.
- **Artifact:** precies `public/` + `.weather-runtime-source.tmp` (het enige ander bestand dat een test leest) + het manifest. De bouwjob maakt een SHA-256 per bestand en een boomhash; elke shard controleert het gedownloade artifact (ontbrekend, extra of afwijkend bestand = rood). Geen symlinks toegestaan.
- **Gevoelige gegevens:** de bouwjob scant het artifact vóór het uploaden op verboden bestandsnamen (`.env`, sleutels, `.npmrc`, `.git`, `node_modules`) en op sleutel-/tokenpatronen; een treffer blokkeert het publiceren. Het artifact bevat alleen wat ook op de site staat plus het runtime-bronsnapshot van de (publieke) repo. Retentie 1 dag. De jobs hebben `contents: read` en geen secrets.
- **Performance-isolatie:** elke runner voert steeds één commando tegelijk uit (geen parallelle tests binnen een runner).
- **Concurrency:** `concurrency: shadow-testketen` laat één shadow-run tegelijk lopen. Per run: 1 plan + 2 bouw + 8 shard + 1 extra + 1 aggregatie = 13 jobs; piek ca. 12 tegelijk.

## Als package.json verandert
`verifieer-dekking.js plan` faalt met een duidelijke melding als de keten niet meer uit 272 commando's bestaat of een nieuw muterend commando na de bouwfase staat. Werk dan bewust de verwachting (272) en eventueel `scripts/ci/test-duren.json` bij; een verkeerde of verouderde duurtabel maakt shards ongelijk, nooit onjuist (elk commando blijft precies één keer).

## Uitrol (gefaseerd)
1. Deze PR: alleen de shadow-workflow en `scripts/ci/**`; geen verplichte check, geen branchregel gewijzigd.
2. Vergelijking over meerdere runs: resultaten (zelfde 272 commando's, zelfde uitkomst) en werkelijke doorlooptijden van de shadow-keten naast `test`/`checkpoint-npm-test`.
3. Pas daarna, na afzonderlijke toestemming, omschakelen van de vereiste checks (aggregatiejobs onder de bestaande namen). Niet in deze PR.

# Postbuild-domeineigenaren

Dit document is de fase-1 inventarisatie voor issue #114. Het beschrijft de huidige bewezen artifactketen zonder productgedrag te wijzigen. Doel is per volgende PR precies één domein naar een duidelijke canonieke eigenaar te verplaatsen en de oude correctielaag daarna te verwijderen.

## Architectuurprincipes

- Geen big-bang rewrite.
- Geen provider-, formule-, tijdzone- of waarschuwingsemantiek combineren met een architectuurverplaatsing.
- Een verifier mag blijven bestaan nadat een apply-laag verdwijnt, mits hij dan de canonieke eigenaar bewaakt in plaats van een compatibilitypatch.
- Een nieuwe `final`, `polish` of `hardening`-laag is geen oplossing voor consolidatie.
- Zichtbaar gedrag blijft per migratie bevroren door de bestaande unit-, contract-, matrix- en browsertests.
- Serviceworker/cache wordt na iedere artifactmutatie via de bestaande centrale cache-owner coherent gehouden.

## Huidige keten en beoogde eigenaar

| Huidige apply-laag | Huidige verantwoordelijkheid | Beoogde canonieke eigenaar | Beoordeling / migratierichting |
| --- | --- | --- | --- |
| `build-weather.js` | Basissamenstelling, interpretatie/correctness/kansbeleid, enkele productpatches en inline lagen | Build/assembly, niet inhoudelijke UI-correcties | Behouden als assembler; inhoudelijke bronpatches geleidelijk terugbrengen naar hun bronowner. |
| `inject-extra-neerslagproviders.js` | Injecteert extra providerclient én neerslagpresentatie | Neerslag-providerclient + neerslagpresentatie | Later splitsen zodat provider-assembly en presentatie expliciete owners zijn; geen providerwijziging in dezelfde stap. |
| `apply-mobile-screenshot-polish.js` | Mobiele layout/presentatiecorrecties | UI/layout owner | Hoge overlapkans met Q3/UI-shell/UI-polish. Eerst per selector inventariseren, niet als eerste migreren. |
| `apply-performance-final.js` | Performance-/rendercorrecties | Rendering/performance owner | Behouden tot overlap met latere UI-lagen per invariant is uitgezocht. |
| `apply-q3-senior-polish.js` | Gemengde visuele/UX-correcties | UI/layout, grafieken of copy per onderdeel | Te breed; later ontleden per domein. |
| `apply-q4-rain-periods.js` | Regenperioden in 24-uursgrafiek | Grafiek/neerslagpresentatie | Goede latere kandidaat, maar eerst rain-runtime en grafiekcontracts volledig mappen. |
| `apply-ui-shell.js` | Shell/layout/accessibility | Rendering/UI-shell | Waarschijnlijke blijvende owner voor shellgedrag; inhoudelijke copy hoort hier niet thuis. |
| `apply-pollen-hour-correctness.js` | Pollen uurselectie/presentatie | Luchtkwaliteit/pollen | Goede afzonderlijke migratiekandidaat nadat bronowner en unsupported-state zijn gemapt. |
| `apply-cache-fallback-country.js` | Landcontext bij cache/fallback | Locatie/fallback | Migreren naar locatie/fallback-owner; niet combineren met weerproviderlogica. |
| `apply-ui-polish-20260813.js` | Brede runtime UI/copycorrecties | Meerdere domeinen | Grootste consolidatieschuld; niet in één PR verwijderen. Eerst functies per domein toewijzen. |
| `apply-weather-fallback-hedge.js` | Forecast/fetch fallback-presentatie | Forecast/fallback | Canonieke owner moet de request/fallbackketen zijn; alleen migreren met bestaande failure-contracttests intact. |
| `apply-fetch-error-semantics.js` | Menselijke foutcopy na fetch/fallback | Forecast/fallback error owner | Samenhang met vorige laag; later één domein-PR, zonder netwerkstrategie te veranderen. |
| `apply-polar-chart-sentinel.js` | Pooldag/poolnacht grafieksentinel | Grafieken/astronomie | Kleine, afgebakende kandidaat na exacte bronanalyse. |
| `apply-unified-weather-truth.js` | Synchroniseert zichtbare weerwaarheid over UI | Neerslag/current-weather truth + rendering | Inhoudelijk belangrijk, relatief breed; niet als eerste verwijderen. Eerst owners per synchronisatiepad. |
| `apply-small-chance-consistency.js` | Consistentie kleine neerslagkans in zichtbare UI | Neerslagkansbeleid/neerslagpresentatie | Samen met Nederlandse neerslagcopy een goede vroege consolidatiezone, maar semantiek niet combineren zonder tests. |
| `apply-nederlandse-microcopy.js` | Corrigeert uitsluitend gedeelde neerslagzinnen uit eerder kansbeleid | `neerslagkans-policy-v3.js` / neerslagpresentatie | **Eerste aanbevolen migratie.** De latere laag corrigeert letterlijk output van de bestaande neerslagowner en voegt geen eigen semantiek toe. |
| `apply-seo-foundation.js` | Metadata/canonical/SEO-root | SEO owner | Afzonderlijk domein; geen reden om dit met runtimeconsolidatie te mengen. |
| `generate-seo-location-pages.js` | Genereert plaatsroutes | SEO/location-page generator | Blijvende build-owner; geen runtimecorrectielaag. |
| `apply-build-provenance.js` | Stempelt build-SHA/provenance | Build/provenance | Blijvende build-owner; hoort juist laat in de keten. |

## Eerste migratie: Nederlandse neerslagcopy

### Bewezen huidige situatie

`apply-nederlandse-microcopy.js` zoekt letterlijke zinnen in het reeds gebouwde artifact en herschrijft onder andere:

- `Neerslag wordt verwacht het komende uur.` → `Het komende uur wordt neerslag verwacht.`
- `Enkele druppels zijn mogelijk het komende uur.` → `Het komende uur zijn enkele druppels mogelijk.`
- `Kleine kans op neerslag het komende uur.` → `Het komende uur is er een kleine kans op neerslag.`
- `De komende twee uur wordt geen neerslag verwacht.` → `De komende twee uur wordt er geen neerslag verwacht.`

De bronzinnen worden al gegenereerd door `neerslagkans-policy-v3.js`. De late microcopylaag is daardoor geen zelfstandige domeineigenaar maar een compatibilitycorrectie over de bestaande owner.

### Gewenste migratie in de eerstvolgende code-PR

1. Laat `neerslagkans-policy-v3.js` direct de huidige productiecopy retourneren.
2. Breid/actualiseer de policytests zodat de uiteindelijke zinnen direct op de owner worden bewezen.
3. Verwijder `apply-nederlandse-microcopy.js` uit de postbuildketen.
4. Herschrijf `verify-nederlandse-microcopy.js` naar een owner-verifier: controleer de finale copy én dat de oude compatibilitymarker/apply-laag niet meer nodig is.
5. Verwijder het apply-script pas wanneer de volledige artifact- en browsermatrix op dezelfde SHA groen is.
6. Vergelijk vóór merge het finale artifact op relevante zichtbare neerslagcopy; verwacht geen inhoudelijk productverschil.

## Niet combineren met fase 1

De eerste migratie verandert niet:

- KNMI/Open-Meteo providerselectie;
- neerslagdrempels of kansen;
- actuele nat/droogwaarheid;
- waarschuwingen;
- pollen/UV;
- tijdzones of lokale kalenderdag;
- grafiekberekeningen;
- layout/CSS;
- CSP of inline-assets.

## Volgende kandidaten na succesvolle fase 1

Op basis van afbakening en risico is de voorlopige volgorde:

1. Nederlandse neerslagcopy compatibilitylaag → neerslagowner.
2. Fetch-errorcopy → forecast/fallback owner.
3. Cache/fallback-landcontext → locatie/fallback owner.
4. Pollen-uurcorrectheid → pollenowner.
5. Polar-chart sentinel → grafiek/astronomie-owner.
6. Pas daarna de brede UI-polish/weather-truth/Q3/mobile-lagen per functie ontleden.

Deze volgorde is geen toestemming om automatisch door te refactoren: iedere stap krijgt een afzonderlijke PR, eigen oorzaak-/owneranalyse en volledige relevante regressiecontrole.

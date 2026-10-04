# Lichtvervuiling bij Nachtzicht

Voor plaatsen in Nederland toont Nachtzicht onder de uitleg een regel met een grove schatting:

> Lichtvervuiling hier: **laag tot matig** (geschat). De Melkweg is zwak tot goed te zien. Geschat op basis van de RIVM-kaart, voor een heldere, maanloze nacht. [Bron](/over/#lichtvervuiling)

Het bronjaar (2015) en de beperkingen staan in de bronverantwoording op `/over/#lichtvervuiling`. Buiten Nederland, of als het land nog niet bekend is, verschijnt de regel niet.

## Bron
- RIVM, "Berekende hemelhelderheid in de nacht, zonder bewolking": `rivm_licht_20150315_gm_hhnachtonbew.tif`, peildatum 15-03-2015.
- Download: https://data.rivm.nl/data/ank/rivm_licht_20150315_gm_hhnachtonbew.zip. Controlegetallen (sha256): zip `567989d3…f123e0`, tif `301fc6a5…a1d8`.
- Licentie: Public Domain Mark 1.0.
- Inhoud: kunstmatige hemelhelderheid in het zenit, in mcd/m²; raster van 250 m in RD New.
- Geen gegevens: NoData (−3,4028e38) en de waarde 0. De 0-cellen liggen allemaal op zee, buiten het modeldomein.
- Het bronbestand staat niet in de repository. `lichtvervuiling-nl.json` (ongeveer 52 kB) wordt ermee gemaakt via `node scripts/lichtvervuiling-raster.js pad/naar/tif`.

## Methode
- **Vakken:** het raster heeft vakken van ongeveer 1 km (0,01° breedte × 0,015° lengte, lat 50,70–53,61, lon 3,30–7,26). De waarde van een vak is het gemiddelde van 4×4 cellen van 250 m rond het vakmidden. Er zijn minimaal 8 geldige cellen nodig.
- **Totale helderheid:** vakwaarde + 0,25 mcd/m² natuurlijke achtergrond, één keer opgeteld.
- **Klassen:** laag ≤ 0,5; matig > 0,5 t/m 2; hoog > 2 mcd/m². Dit is een productkeuze van watishetweer.nl, geen officiële indeling.
- **Omrekening:** mag/arcsec² = −2,5·log10(L[mcd]/1000/108000).

## Grensgevallen
- **Onzekerheidsmaat:** het centrale 80%-interval (p10–p90) van het verschil gemeten − kaart, in mag/arcsec², bij 246 SQM-puntmetingen van de provincie Drenthe (sept. 2015 – okt. 2016). Dat interval is −0,17 tot +0,67.
  - Dit is de enige set die onafhankelijk is van de kaart, uit dezelfde periode komt, uit punten bestaat en groot genoeg is.
- **Regel:** een vak krijgt twee buurklassen ("laag tot matig", "matig tot hoog") als:
  - de klasse binnen dat interval kan omslaan; of
  - de 250 m-cellen in het vak zelf over een klassegrens heen liggen.
  Anders krijgt het vak één klasse.
- **Zekere klasse per totale vakwaarde:**

  | Klasse | Totale vakwaarde |
  |---|---|
  | Zeker laag | ≤ 0,43 mcd/m² |
  | Zeker matig | 0,93–1,70 |
  | Zeker hoog | > 3,71 |
  | Twee klassen | alle waarden daartussen |

- **Verdeling over Nederland** (44 011 vakken met gegevens):

  | Weergave | Aandeel |
  |---|---|
  | Laag | 37% |
  | Laag tot matig | 38% |
  | Matig | 12% |
  | Matig tot hoog | 9% |
  | Hoog | 4% |

## Toets op recentere metingen (beperkt)
- **Bron:** Shah, Peletier e.a. 2025, "Beyond the Clouds" (arXiv 2507.11343v2), Tabel 1.
- **Wat is vergeleken:** de beginwaarden van januari 2020 op heldere, maanloze uren. Gekeken naar 24 Nederlandse locaties binnen de kaart; Borkum is apart beoordeeld.
- **Uitkomsten:**
  - samenhang r = 0,94;
  - gemeten in de mediaan 0,35 mag donkerder dan de kaart;
  - de enkele klasse was gelijk op 20 van de 24 locaties.
  - Afwijkingen:
    - Nes (Ameland), Boerakker en Heerenveen-Station: kaart helderder dan gemeten;
    - Oostkapelle: kaart donkerder.
  - 16 van de 24 verschillen vallen binnen het Drentse 80%-interval. Het interval is dus eerder te smal dan te ruim.
- **Wat dit niet is:** geen landelijke of actuele validatie. De locaties liggen vooral in Noord-Nederland en op donkere plekken. De trend 2020–2023 wisselt per locatie en is niet gecorrigeerd voor sensorveroudering.
- **Geen correctie op de kaart:** er is geen landelijke groeicorrectie toegepast.

## Code
- `index.html`: `#lichtvervuiling` onder `#nachthint`, met `toonLichtvervuiling()` en `lichtvervuilingKlasse()`. Het databestand wordt pas opgehaald bij de eerste Nederlandse plaats.
- `scripts/lichtvervuiling-raster.js`: maakt het databestand en bevat de grensgevallenregel.
- `scripts/lichtvervuiling.test.js` en `scripts/lichtvervuiling-browser.test.js`: de tests.

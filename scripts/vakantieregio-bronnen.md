# Kaart voor de schoolvakantieregio's

De kalender gebruikt de vestigingsplaats als uitgangspunt. De gekozen weerplaats geeft alleen een regio-indicatie. De wettelijke indeling volgt artikel 3 van de [Regeling vaststelling schoolvakanties 2025–2030](https://wetten.overheid.nl/BWBR0049811/2025-08-01). Het [publieksoverzicht van Rijksoverheid](https://www.rijksoverheid.nl/themas/onderwijs/schoolvakanties/regios-schoolvakantie) helpt bij huidige gemeentenamen. De regeling is leidend bij Altena en de voormalige gemeenten. Zeewolde, Hattem en Eemnes hebben een afwijkende regio binnen hun provincie.

De dataset is een lokale momentopname voor de 342 gemeenten in Europees Nederland. De site vraagt geen locatie aan en gebruikt de afgeronde coördinaten en landcode van de bestaande plaatskeuze. De JavaScript-asset voor de schoolvakantiepagina's bevat de bronvermeldingen, licentie en bewerking van de geometrie. Er is geen geodienst nodig tijdens een bezoek of in CI.

## Brongegevens voor de offline generator

Gebruik GDAL 3.10 met GEOS, Python GDAL en NumPy. Zet de volgende zes invoerbestanden in één directory. De SHA-256 hoort bij de gebruikte bron of, voor historische shapefiles, het geëxporteerde GeoJSON.

| Invoerbestand | Herkomst en bewerking | SHA-256 |
|---|---|---|
| `brk-gemeenten-350.geojson` | [Kadaster BRK Bestuurlijke Gebieden](https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/collections/gemeentegebied/items?f=json&limit=350), momentopname 2026. Kadaster, CC BY 4.0. | `bfad83099a964fc47164303737add507b01eec40f9cdcc59a26dc20097cb9e14` |
| `cbs-abcoude-2010.geojson` | [CBS/Kadaster Wijk- en Buurtkaart 2010 v3](https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/geografische-data/wijk-en-buurtkaart-2010). Exporteer `gem_2010_v3.shp`, `GM_NAAM = 'Abcoude'`, velden `GM_CODE,GM_NAAM`, naar EPSG:4326. Hergebruik met bronvermelding. | `043780c57137f7c9fc619fd40bd04cc0113ed7d5770a5586f0289a372915a418` |
| `cbs-didam-2004.geojson` | [CBS/Topografische Dienst Kadaster Wijk- en Buurtkaart 2004](https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/geografische-data/wijk-en-buurtkaart-2004). Exporteer `gem_2004_gen.shp`, `GM_NAAM = 'Didam'`, velden `GM_CODE,GM_NAAM`, naar EPSG:4326. Hergebruik met bronvermelding. | `bc2d7c218ff383d71796966936ea19b7deec3df9d2e9ad5b8289a8e126554a41` |
| `nlgis-dodewaard-1997.geojson` | [Onno Boonstra, NLGis shapefiles, DANS v2.2](https://doi.org/10.17026/DANS-XB9-T677), CC0. Neem de bijgewerkte 1997-shape, -index en -tabel, Dataverse IDs 275079, 273804 en 274453. Exporteer `CBSCODE = 220`, velden `GM_1997,GM_NAAM,CBSCODE`, van EPSG:28992 naar EPSG:4326. [CBS](https://vocabs.cbs.nl/cbs_ned/nl/page/?uri=https%3A%2F%2Fvocabs.cbs.nl%2Fgeo%2Fdef%2Fgemeenten%2FGM0220) meldt sinds 1955 geen grenswijziging vóór de opheffing in 2002. | `686a0f82c25525b6ce72e1cab53a5e8333e11c616821b4bf2a3f41c1bfa4cb17` |
| `cbs-aalburg-2018.geojson` | [CBS/Kadaster Wijk- en Buurtkaart 2018 v3](https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/geografische-data/wijk-en-buurtkaart-2018), CC BY 4.0. Exporteer laag `gemeenten2018`, `gemeentecode = 'GM0738'`, velden `gemeentecode,gemeentenaam`, naar EPSG:4326. | `b201eb16343166f3a8570c70d693f8d2e9ab37db36bc24bfc6058b9adfe2e7c8` |
| `bag-hank-dussen.json` | [Kadaster BAG-woonplaatsen](https://api.pdok.nl/kadaster/bag/ogc/v2/collections/woonplaats/items?f=json&bbox=4.86,51.69,5.03,51.77&limit=40), Public Domain Mark 1.0. De generator gebruikt identificaties 2214 en 2215. De gemeente Altena vermeldt Hank en Dussen als kernen. | `3b4258b3539d6b459d28f85e3d4656229320b42c53fc4252b9d9177af8016510` |

Genereer en controleer de compacte kaart.

```bash
python3 scripts/maak-vakantieregiokaart.py /pad/naar/bronnen scripts/vakantieregio-data.json
node scripts/seizoenspagina.test.js
```

De kaart bevat intervallen per breedtegraad op een raster van 0,001°. De grenzen van de regio's worden uit de bronpolygonen opgebouwd. Elk rastervak dat een regiogrens raakt, blijft leeg. Rond historische grenzen worden ook de volgende stroken uitgesloten, gemeten in RD New.

| Uitzondering | Strook rondom grens | Onderbouwing |
|---|---:|---|
| Abcoude | 35 m | De twee bekeken geometrieën gaven dezelfde uitkomst op het vergelijkingsraster. |
| Didam | 200 m | De officiële kaart is gegeneraliseerd. Het gemeten verschil met een tweede reconstructie liep tot circa 131 m. |
| Dodewaard | 550 m | De twee historische geometrieën verschilden plaatselijk circa 458 m. |
| Aalburg, Hank en Dussen | 50 m | Conservatieve marge voor de overgang tussen historische en huidige geometrie en de afbakening van woonplaatsen. |

De generator controleert de wettelijke indeling van de 342 gemeentecodes, de geografische representanten van de 338 gemeenten zonder splitsing en 20 controleplaatsen, inclusief de historische uitzonderingen en Baarle. De exacte BAG-positie van het gemeentehuis van Baarle-Nassau valt in Nederland. Het afgeronde rastervak kruist de landsgrens en geeft daarom het landelijke overzicht. Een volledig Nederlands rastervak bij de Oordeelsestraat geeft Zuid. Ontbrekende, buitenlandse en onzekere locaties krijgen het landelijke overzicht. Controleer bij een nieuwe bronversie gemeentelijke herindelingen, de geldende regeling, BAG-woonplaatsen, licenties en de gemeten randverschillen voordat de kaart wordt vernieuwd.

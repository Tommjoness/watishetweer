# Luchtmeetnet LKI: implementatiebesluit

Datum: 31 augustus 2026

## Correctie op de provider-shortlist

De eerste Nederlandse luchtkwaliteitskoppeling gebruikt **niet** een rauwe waarde van het dichtstbijzijnde meetstation. De Luchtmeetnet-route `concentrations?formula=lki&latitude=...&longitude=...` levert een lokale Nederlandse LKI. Die wordt als eigen index behandeld en mag niet als stationsmeting worden gelabeld.

De eerdere provider-shortlist blijft bruikbaar voor een latere stationslaag met PM2,5, PM10, NO2 en ozon, maar dat is een aparte uitbreiding.

## Productsemantiek

De bestaande Open-Meteo/CAMS-luchtkwaliteit blijft de hoofdwaarde:

- binnen Europa: Europese AQI;
- elders: Amerikaanse AQI volgens de bestaande fallback.

Voor een Nederlandse locatie kan daaronder aanvullend verschijnen:

`Nederlandse LKI 3/11 · RIVM/Luchtmeetnet`

Belangrijk:

- Europese AQI en Nederlandse LKI hebben een andere schaal;
- waarden worden niet gemiddeld, omgerekend of stilzwijgend vervangen;
- pollen blijft volledig uit de bestaande CAMS/Open-Meteo-keten komen;
- de aanvullende LKI is alleen context en blokkeert nooit de hoofdweergave.

## Freshness en validatie

De serveradapter:

- accepteert uitsluitend landcode `NL`;
- accepteert alleen geldige coördinaten;
- accepteert alleen `formula=LKI`;
- accepteert alleen numerieke waarden binnen 1–11;
- kiest de nieuwste geldige waarde die niet duidelijk in de toekomst ligt;
- weigert waarden ouder dan drie uur;
- gebruikt een kleine klokmarge van vijf minuten;
- rondt de zichtbare index af op een integer, maar bewaart ook de ruwe bronwaarde;
- gebruikt een korte, begrensde geheugen-cache van vijf minuten om Fair Use te respecteren.

## Fallback

Bij timeout, upstreamfout, oude data, foutieve data of ontbrekende dekking retourneert de extra provider `beschikbaar:false`.

De client laat dan de bestaande Open-Meteo/CAMS-luchtkwaliteit volledig ongemoeid. Een Luchtmeetnet-storing kan dus nooit de weerforecast, AQI, pollen of overige pagina-inhoud laten falen.

## Latere stationslaag

Een echte observationele stationslaag is pas zinvol wanneer daarnaast is vastgelegd:

- maximaal aanvaardbare stationafstand;
- welke stationstypen representatief genoeg zijn;
- freshness per component;
- afzonderlijke eenheden voor PM2,5, PM10, NO2 en O3;
- hoe verkeersstations versus achtergrondstations worden benoemd.

Tot die tijd wordt de Nederlandse LKI expliciet als **aparte index** gepresenteerd en niet als lokale stationsmeting.

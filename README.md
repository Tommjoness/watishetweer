# Weerbriefing

Statische weer-app op basis van Open-Meteo. Geen build, geen dependencies, geen API-sleutels.

## Draaien

Open `index.html` rechtstreeks in de browser, of zet alles op een statische host.
De service worker en het installeren als app werken alleen via https.

## Structuur

    index.html                de volledige app: opmaak, logica en tekst
    sw.js                     service worker, cachet de app maar nooit de weerdata
    manifest.json             gegevens voor het installeren als app
    icon-*.png                pictogrammen
    *.woff2                   Bodoni Moda, Instrument Sans en DM Mono, lokaal gehost
    run.js kern.js data.js   de testsuite, draait alleen lokaal
    api/plaatsnaam.js         omgekeerd zoeken bij Mijn locatie, Nominatim met terugval
    api/radarverwachting.js   tijdstappen van de KNMI-neerslagverwachting
    api/waarschuwingen.js     serverless functie voor de MeteoAlarm-feed

In `api/` horen precies drie bestanden, niet meer en niet minder. Vercel maakt
van elk bestand in die map een publieke serverfunctie, dus er mag niets anders
in staan. Alle overige bestanden horen in de hoofdmap.

Alles onder `api/` moet ook echt in die map staan. Vercel leidt alleen bestanden
in `api/` om naar een functie, dus een bestand dat in de hoofdmap blijft liggen
wordt stilzwijgend een 404 en de app valt terug op zijn noodoplossing.

## Bronnen

| onderdeel | bron | opmerking |
|---|---|---|
| uur- en dagverwachting | api.open-meteo.com | mix van ECMWF en DWD ICON |
| kwartierneerslag | api.open-meteo.com | alleen Europa en Noord-Amerika |
| luchtkwaliteit en pollen | air-quality-api.open-meteo.com | CAMS, pollen alleen in Europa |
| plaatsnamen | geocoding-api.open-meteo.com | |
| omgekeerd zoeken | api.bigdatacloud.net | bij Mijn locatie |
| radar | api.rainviewer.com | beelden per tien minuten |
| kaartondergrond | basemaps.cartocdn.com | |
| waarschuwingen | feeds.meteoalarm.org | via de eigen serverless functie |

Zon- en maanstand worden lokaal berekend, niet opgehaald.

De gratis laag van RainViewer levert alleen gemeten radarbeelden. De sleutel
`nowcast` staat wel in de JSON maar blijft leeg, want vooruitberekende beelden
zijn een betaalde functie.

Voor Nederland wordt dat gat gevuld met de neerslagverwachting van het KNMI,
tot twee uur vooruit per vijf minuten. Die komt binnen als kaartbeeld via WMS.
De functie `api/radarverwachting.js` haalt eenmalig op welke laag en welke
tijdstappen beschikbaar zijn, omdat het KNMI geen CORS-headers meegeeft. De
kaartbeelden zelf haalt de browser rechtstreeks op, want voor het tekenen van
een afbeelding is geen CORS nodig. Buiten Nederland valt dit weg en zie je
alleen gemeten beelden.

Bronvermelding is een voorwaarde bij RainViewer, CARTO en OpenStreetMap en
staat in de voettekst van de app. Laat die staan.

## Testen

    npm test

De suite leest `index.html` in en draait de echte functies, dus een wijziging in
de app wordt meteen meegenomen. `kern.js` haalt het scriptblok uit
`index.html` en draait dat in een nagebootste browser. Er zit bewust geen jsdom
of ander pakket in: de app raakt maar een klein deel van de DOM aan. Netwerk
hangt met opzet, zodat de app nooit voorbij zijn eigen laadstap komt en de
testdata niet overschrijft.

Geef een breedte mee aan `laadKern` om de telefoonopmaak te toetsen, bijvoorbeeld
`laadKern(390)`. Zonder waarde gaat hij uit van 1280.

128 controles, onder meer:

* zonstijden tegen bekende referenties en de maanfase tegen bekende nieuwe en volle maan
* briefingzinnen in zes weersituaties, plus randgevallen als poolzomer en ontbrekende data
* elk getal in de teksten heeft een eenheid of is een tijdstip
* de grafiek blijft binnen zijn kader en aslabels raken elkaar niet, op telefoon en desktop
* de warmste en koudste waarde krijgen altijd een cijfer, ook bij een grillig verloop
* elke `/api/`-route die de app opvraagt heeft ook echt een bestand in `api/`
* de locatiebepaling vraagt om gps en niet om de grove meting
* de briefing en de windmeter noemen dezelfde wind ook hetzelfde, van 0 tot 12 Bft
* elke serverfunctie is CommonJS, want ESM zonder "type": "module" faalt op Node 18 en 20

Zakt een test met de melding dat een naam niet meer in `index.html` staat, dan is
een functie hernoemd. Pas dan `NODIG` in `kern.js` aan of herstel de naam.

## Cache verversen

Na een wijziging het versienummer in `sw.js` ophogen, anders serveert de oude
service worker de vorige versie.

## KNMI-verwachting, wat je moet weten

Geverifieerd tegen de capabilities van het KNMI op 23 juli 2026:

    DATASET  radar_forecast_2.0
    LAYERS   precipitation_nowcast
    CRS      EPSG:3857 wordt ondersteund
    tijd     <Dimension name="time" ...>begin/eind/PT5M</Dimension>

De tijddimensie is een reeks over vele dagen, niet alleen de komende twee uur.
Lees hem daarom van achteren naar voren: het laatste moment in de reeks is het
nieuwste beschikbare beeld. Vanaf het begin lezen levert weken oude tijdstippen
op, en die vallen allemaal weg in het filter.

Op het moment van bouwen liep de anonieme WMS van het KNMI achter: het nieuwste
beeld was drie weken oud. De app meldt dat zelf onder de radar. Wordt de bron
weer bijgewerkt, dan verschijnt de vooruitblik vanzelf zonder aanpassing.

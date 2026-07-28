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
    lettermaten.json          letterbreedtes uit de woff2-bestanden, voor de kolomtest
    api/plaatsnaam.js         omgekeerd zoeken bij Mijn locatie, Nominatim met terugval
    api/radarverwachting.js   tijdstappen van de KNMI-neerslagverwachting
    api/waarschuwingen.js     kiest de waarschuwingsbron op basis van de locatie

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
| radar en satelliet | api.rainviewer.com | radar per tien minuten, infrarood als opvulling |
| kaartondergrond | basemaps.cartocdn.com | |
| waarschuwingen VS | api.weather.gov | exact op coordinaat |
| waarschuwingen Europa | feeds.meteoalarm.org | per land, gefilterd op gebied |

Zon- en maanstand worden lokaal berekend, niet opgehaald.

De code leest `radar.nowcast` uit de JSON en gebruikt die als vooruitblik.
Blijft die leeg, dan valt hij binnen Nederland terug op het KNMI. Of de gratis
laag die sleutel altijd vult is niet met zekerheid vastgesteld; de terugval
vangt beide gevallen af.

Radar is een mozaiek van nationale grondstations en dekt lang niet de hele
wereld. Waar niets staat is er geen onderscheid tussen "geen regen" en "geen
radar", dus dat wordt niet geraden. In plaats daarvan is er een knop naar de
infraroodsatelliet uit dezelfde JSON. Die dekt wel de hele wereld maar toont
wolkentoppen en geen neerslag, en dat staat er ook bij.

Voor Nederland wordt dat gat gevuld met de neerslagverwachting van het KNMI,
tot twee uur vooruit per vijf minuten. Die komt binnen als kaartbeeld via WMS.
De functie `api/radarverwachting.js` haalt eenmalig op welke laag en welke
tijdstappen beschikbaar zijn, omdat het KNMI geen CORS-headers meegeeft. De
kaartbeelden zelf haalt de browser rechtstreeks op, want voor het tekenen van
een afbeelding is geen CORS nodig. Buiten Nederland valt dit weg en zie je
alleen gemeten beelden.

Waarschuwingen komen van de National Weather Service in de Verenigde Staten en
van MeteoAlarm in Europa, gekozen op basis van de coordinaten. Elke waarschuwing
draagt zijn eigen gebied mee als polygoon of cirkel; die wordt tegen het punt
gehouden zodat een bui in de Pyreneeen niet boven Parijs verschijnt. Levert de
bron geen gebied, dan blijft de waarschuwing staan met de vermelding dat hij
voor een groter gebied geldt. Daarbuiten is er geen betrouwbare bron, dus dan
komt er niets. Een wereldwijde aggregator bestaat nog niet: de Alert Hub van de
WMO is er wel maar publiceert nog geen gevulde feedlijst.

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

432 controles, onder meer:

* zonstijden tegen bekende referenties en de maanfase tegen bekende nieuwe en volle maan
* briefingzinnen in zes weersituaties, plus randgevallen als poolzomer en ontbrekende data
* elk getal in de teksten heeft een eenheid of is een tijdstip
* de grafiek blijft binnen zijn kader en aslabels raken elkaar niet, op telefoon en desktop
* de warmste en koudste waarde krijgen altijd een cijfer, ook bij een grillig verloop
* elke `/api/`-route die de app opvraagt heeft ook echt een bestand in `api/`
* de locatiebepaling vraagt om gps en niet om de grove meting
* de briefing en de windmeter noemen dezelfde wind ook hetzelfde, van 0 tot 12 Bft
* geen komma die twee volledige hoofdzinnen aan elkaar plakt
* de dagnaam in de zevendagentabel houdt afstand tot het weericoon, op elke schermbreedte
* de tooltip blijft op elk uur binnen de tekening en elke regel past erin
* de weeromschrijving spreekt s nachts niet over zon
* het nachtvenster belooft geen heldere hemel die het niet meet, en zegt waarom er geen venster is
* buiten Europa geen Europese luchtindex en geen bewering over pollen
* de waarschuwingsbron wordt gekozen op coordinaten, nooit meer blind Nederland
* een waarschuwing met een gebied elders in het land wordt niet getoond

* de kop van de dagtabel vult evenveel kolommen als de gegevens eronder, op elke breedte
* elke nacht toont zijn eigen maanfase als schijfje naast de maantijden
* de briefing legt nadruk op de uitkomst, en nooit op meer dan een kwart van de tekst
* de service worker laat geen onafgevangen belofte ontsnappen
* ontbrekende pollendata wordt niet als "geen pollen" gepresenteerd
* de klok van de plaats staat naast de plaatsnaam
* radarbeelden staan altijd op volgorde van tijd, ongeacht uit welke bron ze komen
* de wolk in een samengesteld icoon dekt af wat erachter ligt, op elke achtergrond
* de radar wist het doek pas als de beelden binnen zijn, dus zonder flikkeren
* de radar kan zoomen en verschuiven, en meldt het als er geen vooruitblik is
* voorbij het aanvraagmaximum van de tegelbron (z=7) wordt de laatst geldige tegel
  client-side opgeschaald, zodat de gebruiker toch verder kan inzoomen
* teksten schuiven mee met de klok: vandaag, vanavond, vannacht
* windrichting als afkorting naast de snelheid, en datums achter vandaag en morgen
* de grafiek valt niet uit op een natte dag en breekt de lijn bij ontbrekende waarden
* de schuifbalk ziet er in Safari, Chrome en Firefox hetzelfde uit
* de bronvermeldingen staan onder elkaar en het nachtzicht lijnt uit met de score
* de KNMI-laag gebruikt de blauwe schaal, zodat de kleur niet omslaat bij de verwachting
* elke kolom van de zevendagentabel past zijn inhoud, van 320 tot 430 px breed
* elke serverfunctie is CommonJS, want ESM zonder "type": "module" faalt op Node 18 en 20

Zakt een test met de melding dat een naam niet meer in `index.html` staat, dan is
een functie hernoemd. Pas dan `NODIG` in `kern.js` aan of herstel de naam.

`lettermaten.json` bevat de letterbreedtes die uit de woff2-bestanden zijn gelezen.
Daarmee kan de suite uitrekenen hoe breed een label als "donderdag 30" werkelijk
wordt en of de kolom daar ruimte voor heeft. Vervang je een lettertype, dan moet
dat bestand opnieuw gegenereerd worden met fontTools.

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

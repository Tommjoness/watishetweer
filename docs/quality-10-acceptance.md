# Kwaliteitsacceptatie richting 10/10

Dit document voorkomt dat extra polish op smaak wordt goedgekeurd. Een release
mag alleen als `10/10-kandidaat` worden aangeduid wanneer de technische gates
groen zijn én de onderstaande menselijke taken aantoonbaar zonder structurele
frictie worden voltooid.

## Technische releasecriteria

- Productie toont exact dezelfde `weather-build-sha` als de geteste main-SHA.
- Alle bestaande quality-, preview-, recovery-, wereldwijde, performance-,
  accessibility- en production-smokejobs zijn groen op de bedoelde SHA.
- Geen horizontale overflow, afgekapte controls of labelbotsingen op 320, 360,
  390, 430, 768, 1280 en 1440 px in licht, donker en automatisch thema.
- De primaire forecast, WeatherAPI-fallback, stale-cachepresentatie en menselijke
  foutstatus blijven door hun bestaande regressies gedekt.
- De consentbrowsergate bewijst gelijke keuzes, minimaal 44 px mobiele doelen,
  toetsenbordfocus, compacte geometrie en nul Google-requests vóór toestemming.

Productiedoelen voor een representatieve periode van minimaal 28 dagen:

| Signaal | Doel |
| --- | ---: |
| Beschikbare weerweergaven | ≥ 99,9% |
| P75 LCP mobiel | ≤ 2,0 s |
| P75 INP mobiel | ≤ 150 ms |
| P75 CLS mobiel | ≤ 0,05 |
| Ernstige/kritieke accessibilitybevindingen | 0 |

Een korte meetperiode, een enkele synthetische run of ontbrekende data is geen
bewijs dat het doel is gehaald.

## Menselijke gebruikerstest

Test met minimaal tien personen die de site niet hebben gebouwd. Gebruik een
mix van iPhone, Android en desktop. Geef geen uitleg over de interface.

Laat iedere deelnemer deze taken uitvoeren:

1. Bepaal of het binnen twee uur waarschijnlijk gaat regenen.
2. Bepaal de minimum- en maximumtemperatuur van morgen.
3. Zoek een andere plaats en controleer daar de eerstvolgende uren.
4. Bewaar die plaats en keer daarna terug naar de oorspronkelijke plaats.
5. Vind het beste zichtvenster voor de komende nacht.
6. Weiger of accepteer Google Analytics en wijzig die keuze via Privacy.

Leg per taak vast: voltooid ja/nee, tijd tot voltooiing, verkeerde stappen,
hardop genoemde twijfel en apparaat/viewport. Noteer geen gekozen plaats of
andere locatiegegevens in het testrapport.

## Beslisregel

De UX-kandidaat slaagt pas wanneer:

- minimaal 90% van de deelnemers iedere kerntaak zelfstandig voltooit;
- geen taak bij meer dan één deelnemer dezelfde blokkerende verwarring geeft;
- er geen privacy-, accessibility- of databetrouwbaarheidsbevinding openstaat;
- PostHog alleen de gedocumenteerde generieke taakuitkomsten bevat en geen
  zoekterm, plaatsnaam, coördinaten of concrete weerwaarde.

Een bevinding wordt eerst gereproduceerd en geclassificeerd. Alleen bewezen
frictie leidt tot een productwijziging; voorkeuren zonder taakimpact worden niet
als redesignopdracht behandeld.

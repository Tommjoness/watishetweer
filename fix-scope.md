# Productieherstel 9 augustus 2026

Deze branch corrigeert drie na de senior-audit gevonden randgevallen en voegt tests toe tegen de uiteindelijke gebouwde productiecode.

- correcte argumentvolgorde voor actuele en dagelijkse neerslagwaarden;
- `vandaag`/`morgen` volgt de actuele lokale kalenderdag van de gekozen plaats, ook over 00:00 zonder herlaadactie;
- ontbrekende UV-data wordt als onbekend gemeld;
- doelgerichte regressietests draaien tegen `public/index.html` na alle buildtransformaties;
- de serviceworker-cachehash wordt opnieuw uit de definitieve productie-HTML afgeleid.

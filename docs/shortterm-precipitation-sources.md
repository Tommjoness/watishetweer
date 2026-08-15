# Korte-termijnneerslag

De productieketen maakt bewust onderscheid tussen een actuele observatie en een verwachting.

- **Actueel in Nederland en België binnen KNMI-dekking:** KNMI RTCOR-puntdata kan de modelmatige nat/droog-toestand corrigeren wanneer de meting vers en bruikbaar is.
- **Komende uren:** de gewone forecast gebruikt de beschikbare Open-Meteo `minutely_15`-reeks en valt bij ontbreken daarvan terug op uurdata volgens de centrale interpretatie-engine.
- **KNMI `radar_forecast_2.0` via WMS-timeseries:** niet actief in productie. Live controles op 15 augustus 2026 lieten zien dat zowel `GetPointValue` als standaard `GetFeatureInfo` voor deze laag ruimtelijk inconsistente tijdreeksen konden teruggeven. De productieketen faalt daarom gesloten in plaats van zulke waarden als lokale nowcast te presenteren.

Een toekomstige KNMI-nowcastroute mag pas opnieuw worden geactiveerd nadat de numerieke extractie voor meerdere locaties en referentietijden ruimtelijk en semantisch is bewezen, met regressies op de echte responsvorm.

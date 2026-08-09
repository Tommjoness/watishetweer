# Pre-launch audit — 12 punten

Deze branch rondt de laatste senior pre-launch audit af voordat `watishetweer.nl` publiek wordt gekoppeld.

1. NWS-geldigheid: gebeurteniseinde (`ends`) vóór CAP-berichtverval (`expires`).
2. Locatie is opt-in en privacygebruik wordt uitgelegd.
3. American Samoa valt onder NWS-dekking.
4. Waarschuwingsteksten worden niet midden in een woord afgekapt.
5. Waarschuwingstijden worden in lokale, leesbare tijd weergegeven.
6. Kwartierneerslag benoemt mogelijke interpolatie buiten native 15-minutenregio's.
7. BigDataCloud is primaire reverse-geocoder; publieke Nominatim alleen fallback.
8. Service-worker-cachehash omvat de volledige app-shell.
9. Nederlandse branding wordt `Wat is het weer?`.
10. Databronnen worden zichtbaar geattribueerd.
11. Verwijderen van bewaarde plaatsen is native keyboard/screenreader-toegankelijk.
12. CI gebruikt actuele Node-24 GitHub Actions en actuele Playwright.

Deze branch wordt pas gemerged wanneer de volledige regressiesuite, Chromium en WebKit op mobiel en desktop, de Vercel-preview en de uiteindelijke productie-smoke objectief groen zijn.

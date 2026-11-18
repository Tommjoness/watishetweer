# Officiële waarschuwingen: optionele Nederlandse vertaalroute

Status: de basisroute is live. De DeepL-integratie is standaard **uitgeschakeld** en vereist aparte expliciete activering.

## Eerst officiële gegevens, daarna alleen waar nodig vertalen

De huidige MeteoAlarm-CAP-selectie kiest officiële Nederlandse tekst als die bestaat. De bestaande waarschuwingscategorie wordt in het Nederlands gevormd uit de officiële niveau/type-velden; daarvoor worden geen vertaalkosten gemaakt.

Bij ontbrekend Nederlands kan de **server** (niet de browser) via de gespecialiseerde DeepL-API naar NL vertalen. Hiervoor moeten beide Cloudflare Pages-runtimevariabelen handmatig zijn gezet: `DEEPL_TRANSLATE_ENABLED=1` en de secret `DEEPL_API_KEY`. De implementatie gebruikt uitsluitend `https://api-free.deepl.com/v2/translate`; een pro-sleutel werkt daar niet. Vergeet niet de quota en voorwaarden van het specifieke API-pakket te controleren.

Het JSON-antwoord bewaart de officiële `tekst` en `taal` ongewijzigd. Alleen bij een geaccepteerde vertaling verschijnt daarnaast `vertaling: { tekst, methode:"deepl", automatisch:true }`. De Nederlandse interface toont een expliciet label 'Automatisch vertaald (niet officieel)' en de oorspronkelijke officiële tekst in een uitklap. De Engelse interface behoudt de officiële brontekst.

## Fail-closed, budget en privacy

- Zonder opt-in of sleutel wordt de vertaaldienst nooit aangeroepen.
- De server controleert bron-taal, niet-lege uitvoer, cijfers, herkenbare meeteenheden inclusief m/s, Beaufort en procenten, tijdzones en het aantal afzonderlijke instructieregels. Voor EN, FR, DE, ES en IT wordt ook conservatief het aantal expliciete ontkenningen/verboden **per instructieregel** vergeleken met de Nederlandse tekst. Afwijkingen geven uitsluitend de officiële brontekst terug.
- Maximaal 3 waarschuwingen per antwoord, maximaal 1.200 tekens per tekst, timeout 1,6 seconde. Geen vertaling als de brontekst op een afbreek-ellips eindigt; ook een afgebroken vertaalantwoord of sterk ingekorte uitvoer wordt geweigerd. Voorlopig komen alleen EN/FR/DE/ES/IT in aanmerking; overige talen blijven in de brontaal.
- Succesvolle vertalingen worden 24 uur in de Cloudflare-edgecache hergebruikt op een SHA-256-sleutel van exacte brontaal plus brontekst. De cacheversie is verhoogd om eerder geaccepteerde vertalingen opnieuw te laten controleren; de brontekst staat niet in de cache-URL.
- **Niet gegarandeerd foutloos**: een verkeerd vertaald verbod, onjuiste instructie of weggelaten betekenis kan nog steeds door deze woord- en structuurcontroles glippen. De testset bevat uitsluitend zelfgemaakte, synthetische voorbeeldteksten; géén echte provideruitvoer of gevalideerde DeepL-vertalingen. De officiële tekst blijft leidend. Publicatie vereist aanvullende handmatige, inhoudelijke acceptatie met echte providerteksten.

## Grenzen vóór activering

De bronadapter bewaart volledige officiële beschrijvingen en afzonderlijke veiligheidsinstructies, ook in de compacte MeteoAlarm-feed. De cacheversie is verhoogd zodat ingekorte oude feedgegevens niet worden hergebruikt. Bronnen van meer dan 1.200 tekens worden niet automatisch vertaald; de officiële tekst blijft volledig zichtbaar. Inhoudelijke acceptatie van lange veiligheidsinstructies vóór opt-in blijft nodig. Controleer daarnaast providerretentie, voorwaarden en privacy, kostengrens, terminologiewoordenlijst en quota vóór het activeren van een echte sleutel. Bewaar de sleutel uitsluitend als Cloudflare Pages runtime-secret en nooit in repository-, preview- of browsercode.
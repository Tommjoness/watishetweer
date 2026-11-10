# Officiële waarschuwingen: optionele Nederlandse vertaalroute

Status: concept-PR, standaard **uitgeschakeld**. Er is geen API-sleutel aangemaakt, geen betaalde dienst ingeschakeld en geen productiewijziging gedaan.

## Eerst officiële gegevens, daarna alleen waar nodig vertalen

De huidige MeteoAlarm-CAP-selectie kiest officiële Nederlandse tekst als die bestaat. De bestaande waarschuwingscategorie wordt in het Nederlands gevormd uit de officiële niveau/type-velden; daarvoor worden geen vertaalkosten gemaakt.

Bij ontbrekend Nederlands kan de **server** (niet de browser) via de gespecialiseerde DeepL-API naar NL vertalen. Hiervoor moeten beide Cloudflare Pages-runtimevariabelen handmatig zijn gezet: `DEEPL_TRANSLATE_ENABLED=1` en de secret `DEEPL_API_KEY`. De implementatie gebruikt uitsluitend `https://api-free.deepl.com/v2/translate`; een pro-sleutel werkt daar niet. Vergeet niet de quota en voorwaarden van het specifieke API-pakket te controleren.

Het JSON-antwoord bewaart de officiële `tekst` en `taal` ongewijzigd. Alleen bij een geaccepteerde vertaling verschijnt daarnaast `vertaling: { tekst, methode:"deepl", automatisch:true }`. De Nederlandse interface toont een expliciet label 'Automatisch vertaald (niet officieel)' en de oorspronkelijke officiële tekst in een uitklap. De Engelse interface behoudt de officiële brontekst.

## Fail-closed, budget en privacy

- Zonder opt-in of sleutel wordt de vertaaldienst nooit aangeroepen.
- De server controleert bron-taal, niet-lege uitvoer, cijfers en herkenbare meeteenheden; een providerfout of gewijzigde waarden betekent dat de originele tekst zichtbaar blijft.
- Maximaal 3 waarschuwingen per antwoord, maximaal 1.200 tekens per tekst, timeout 1,6 seconde. Geen vertaling als de aangeleverde tekst op een afbreek-ellips eindigt.
- Succesvolle vertalingen worden 24 uur in de Cloudflare-edgecache hergebruikt op een SHA-256-sleutel van exacte brontaal plus brontekst; de brontekst staat niet in de cache-URL.
- **Niet gegarandeerd foutloos**: automatische vertaling kan bijvoorbeeld een ontkenning of instructie verkeerd overbrengen zonder een getal te veranderen. De officiële tekst blijft daarom leidend. Publicatie van automatische veiligheidsvertalingen vereist aanvullende inhoudelijke acceptatie.

## Grenzen vóór activering

De huidige bronadapter kort sommige bronteksten tot 700 tekens in. Het wegnemen van deze limiet en testen van lange, complexe waarschuwingsinstructies is nog nodig. Controleer daarnaast providerretentie, voorwaarden en privacy, kostengrens, terminologiewoordenlijst en quota vóór het activeren van een echte sleutel. Bewaar de sleutel uitsluitend als Cloudflare Pages runtime-secret en nooit in repository-, preview- of browsercode.
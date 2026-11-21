# Officiële waarschuwingen: optionele Nederlandse vertaalroute

Status: de officiële waarschuwingsroute is live. **Deze concept-PR blokkeert automatische DeepL-vertalingen hard**, óók als `DEEPL_TRANSLATE_ENABLED=1` en een sleutel zijn gezet. De standaardinstelling blijft uit. Niets wordt hierdoor in productie geactiveerd.

## Eerst officiële gegevens, daarna alleen waar nodig vertalen

De huidige MeteoAlarm-CAP-selectie kiest officiële Nederlandse tekst als die bestaat. De bestaande waarschuwingscategorie wordt in het Nederlands gevormd uit de officiële niveau/type-velden; daarvoor worden geen vertaalkosten gemaakt.

Bij ontbrekend Nederlands bevat de server een **niet-vrijgegeven** DeepL-route. Na afzonderlijke inhoudelijke acceptatie zou de server (niet de browser) via die API naar NL kunnen vertalen. Hiervoor moeten beide Cloudflare Pages-runtimevariabelen handmatig zijn gezet: `DEEPL_TRANSLATE_ENABLED=1` en de secret `DEEPL_API_KEY`. De implementatie gebruikt uitsluitend `https://api-free.deepl.com/v2/translate`; een pro-sleutel werkt daar niet. Vergeet niet de quota en voorwaarden van het specifieke API-pakket te controleren.

Het JSON-antwoord bewaart de officiële `tekst` en `taal` ongewijzigd. Alleen bij een geaccepteerde vertaling verschijnt daarnaast `vertaling: { tekst, methode:"deepl", automatisch:true }`. De Nederlandse interface toont een expliciet label 'Automatisch vertaald (niet officieel)' en de oorspronkelijke officiële tekst in een uitklap. De Engelse interface behoudt de officiële brontekst.

## Fail-closed, budget en privacy

- Een harde codeblokkade (`WAARSCHUWINGVERTALING_VRIJGEGEVEN=false`) stopt de route vóór provider- en cachegebruik. Ook opt-in en sleutel kunnen deze blokkade niet omzeilen. Vrijgave vereist een nieuwe expliciet gereviewde codewijziging en tests.
- Zonder opt-in of sleutel wordt de vertaaldienst ook bij een eventuele toekomstige vrijgave nooit aangeroepen.
- De **niet-vrijgegeven validatieroute** controleert bron-taal, niet-lege uitvoer, cijfers, herkenbare meeteenheden inclusief m/s, Beaufort en procenten, tijdzones en het aantal afzonderlijke instructieregels. Voor EN, FR, DE, ES en IT wordt ook conservatief het aantal expliciete ontkenningen/verboden **per instructieregel** vergeleken met de Nederlandse tekst. Afwijkingen geven uitsluitend de officiële brontekst terug.
- Maximaal 3 waarschuwingen per antwoord, maximaal 1.200 tekens per tekst, timeout 1,6 seconde. Geen vertaling als de brontekst op een afbreek-ellips eindigt; ook een afgebroken vertaalantwoord of sterk ingekorte uitvoer wordt geweigerd. Voorlopig komen alleen EN/FR/DE/ES/IT in aanmerking; overige talen blijven in de brontaal.
- Succesvolle vertalingen worden 24 uur in de Cloudflare-edgecache hergebruikt op een SHA-256-sleutel van exacte brontaal plus brontekst. De cacheversie is verhoogd om eerder geaccepteerde vertalingen opnieuw te laten controleren; de brontekst staat niet in de cache-URL.
- **Semantische fout aantoonbaar gemist**: de structurele check accepteert zelfs een omkering van “Stay indoors” naar “Ga naar buiten” als expliciete ontkenningen en getallen overeenkomen. De testset bevat uitsluitend zelfgemaakte, synthetische voorbeeldteksten; géén echte provideruitvoer of gevalideerde DeepL-vertalingen. De officiële tekst blijft leidend. Publicatie vereist aanvullende handmatige, inhoudelijke acceptatie met echte providerteksten.

## Grenzen vóór activering

De bronadapter bewaart volledige officiële beschrijvingen en afzonderlijke veiligheidsinstructies, ook in de compacte MeteoAlarm-feed. De cacheversie is verhoogd zodat ingekorte oude feedgegevens niet worden hergebruikt. Bronnen van meer dan 1.200 tekens worden niet automatisch vertaald; de officiële tekst blijft volledig zichtbaar. Inhoudelijke acceptatie van lange veiligheidsinstructies vóór opt-in blijft nodig. Controleer daarnaast providerretentie, voorwaarden en privacy, kostengrens, terminologiewoordenlijst en quota vóór het activeren van een echte sleutel. Bewaar de sleutel uitsluitend als Cloudflare Pages runtime-secret en nooit in repository-, preview- of browsercode.
## Vrijgavevoorwaarden (nog niet vervuld)

1. Onafhankelijke menselijke domeinbeoordeling van echte officiële waarschuwingen en machinevertalingen uit alle vijf brontalen, met herleidbare bron en uitkomst.
2. Adversariële tests voor omgekeerde handelingsinstructies, gebiedsbeperkingen, noodadvies en weggevallen betekenis; controle van zowel correcte als onveilige uitvoer.
3. Bevestigde UI-fallback naar de volledige officiële brontekst, ook bij providerfouten, taalwissels en cachetoestanden; toets kosten, privacy, retentie en quota.
4. Afzonderlijke besluitvorming, codewijziging voor het verwijderen van de blokkade en volledig groene CI. Een runtimevariabele is niet genoeg.

De `veilig()`-helper toetst uitsluitend deterministische structuurconsistentie. Die naam is **geen claim van semantische veiligheid**.

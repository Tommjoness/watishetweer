# Meetplan SEO-evaluatie watishetweer.nl — evaluatie 12 november 2026

Opgesteld op 24 oktober 2026 (Europe/Amsterdam). Dit is een intern document en wordt niet in `public/` gepubliceerd.

| | |
|---|---|
| Doel | Vastleggen hoe de SEO-wijziging van 15 oktober 2026 op 12 november 2026 wordt beoordeeld, en hoe de snippetcorrectie (skiplink buiten zoeksnippets) los daarvan wordt gecontroleerd. |
| Hoort bij | Branch `agent/seo-snippet-skiplink-20261024`, code-commit `a4be4bec` (de pull request die dit document toevoegt). |
| Basis | Search Console-exports van 23 oktober 2026 (hele site; zoekopdracht bevat "per uur" op `/weer/`-pagina's; zoekopdracht bevat "weer amsterdam"; exact "weer amsterdam"; data t/m 21 oktober), de gerenderde HTML van de URL-inspectie, de repositorygeschiedenis (ondiepe clone, begint op 5 oktober) en de handmatige mobiele zoekresultaten van 24 oktober. |
| Status | Plan. Onderdelen met "nog te bepalen" worden ingevuld na een eventuele release. |

## 1. Wat de evaluatie wel en niet kan bewijzen

| Vraag | Kan op 12 november worden beantwoord? |
|---|---|
| Is de gemiddelde positie van de "per uur"-zoekopdrachten veranderd? | Ja, als ruw signaal (zie drempels, punt 7). |
| Is de verandering veroorzaakt door de introtekst van 15 oktober? | Nee. Er zijn 31 andere merges (elk een productiedeploy) tussen 12 en 16 oktober (zie punt 3), plus weer, seizoen en vraag. |
| Is de CTR verbeterd? | Nee. Bij ongeveer 2.000 vertoningen per periode is pas een CTR van circa 0,74% (5× de huidige 0,15%) met 80% power aantoonbaar. |
| Werkt de snippetcorrectie? | Alleen via een handmatige controle van het snippet (screenshot) nadat Google de pagina opnieuw heeft gecrawld. CTR-effect is niet meetbaar. |

## 2. Gecontroleerde statistische aannames

- Formule (twee proporties, tweezijdig 5%, power 80%): 0,15% → 0,30% vraagt 15.659 vertoningen per periode; met de gemeten 3/2.007 en een verdubbeling 15.714. Dat bevestigt "circa 15.700".
- Simulatie (4.000 herhalingen, z-toets, n = 15.700 per periode): power 0,82. De aanname klopt rekenkundig.
- Dit is een ondergrens. Klikken clusteren per zoekopdracht en per dag (overdispersie), en de zoekvraag verandert tussen perioden. De werkelijk benodigde omvang is groter; de factor is niet bepaald.
- Gemiddeld ongeveer 1.130 vertoningen per week (27 sep–21 okt) → 15.700 vertoningen zijn ongeveer 14 weken per periode.
- Detecteerbaar effect bij 80% power en 0,15% uitgangs-CTR: 2.000 vertoningen per periode → circa 0,74% (×4,9); 4.500 vertoningen → circa 0,48% (×3,2).
- Positieruis: standaarddeviatie van de dagpositie van de "per uur"-groep, 27 sep–14 okt (n = 18): 0,93 (bereik 10,9–14,4). Bij onafhankelijke dagen is de standaardfout van een 14-daagsgemiddelde circa 0,25. Autocorrelatie en verschuivingen in de zoekopdrachtmix maken de werkelijke onzekerheid groter; niet gekwantificeerd.

## 3. Interventie- en verstoringenlogboek

| Datum (Europe/Amsterdam) | Wat | Bewijs | Opmerking |
|---|---|---|---|
| 15 okt 2026 00:31 | Introtekst plaatspagina's noemt "per uur" (#531, commit `2d67cb8e`) | commitdatum | Moment van live-gaan niet apart geverifieerd. Alle dagen daarna zijn "na". |
| 12–16 okt | 31 andere merges naast #531 (32 in totaal: 8, 6, 6, 6, 6 per dag), o.a. #537 mobiel eerste scherm, #538 iconenset met omschrijving zichtbaar op mobiel, #517 nachtelijke herbouw van de productiedeploy | `git log` | Deze raken inhoud en opmaak van de pagina's. Alleen #531 raakte de SEO-bronbestanden. Effect op ranking onbekend. |
| 12–17 okt | Site-brede vertoningspiek: gemiddeld 1.598 vertoningen per dag op 14–17 okt tegen 432 per dag op 1–11 okt, met op 15–17 okt gemiddelde posities van ongeveer 26 tot 30 | Search Console, hele site | Oorzaak onbekend. Niet toe te schrijven aan een wijziging. |
| 25 okt 2026 13:33 CET | Reserveroute: Visual Crossing- en WeatherAPI-tijden in één vaste tijdas (#557, merge-commit `23d38fe2`) | `git log`; live build-SHA daarna gecontroleerd | Raakt alleen de serverroute `/api/forecast` en de tijdverwerking van de reserveprovider; geen SEO-bronbestand, geen vaste paginatekst. Effect op ranking niet gemeten. |
| 25 okt 2026 15:36 CET | Snippetcorrectie: skiplink in `<span data-nosnippet>` op homepage en 169 plaatspagina's (#556, merge-commit `95a6b596`) | `git log` (merge 14:36 UTC); live build-SHA `95a6b596` na de deploy gecontroleerd | Het exacte moment van live-gaan is niet apart vastgelegd. Nog vast te leggen: datum volgende Google-crawl (URL-inspectie "Laatst gecrawld") en datum waarop een ander snippet zichtbaar is (screenshot). |
| 25 okt 2026 20:24 CET | Waarschuwingen fase 1: specifieke gebeurtenisnaam, ernstlabel, volgorde en uitklap voor Amerikaanse meldingen (#560, merge-commit `03c6e968`) | `git log` (merge 19:23:58 UTC); live build-SHA `03c6e968` waargenomen om 19:33:34 UTC (20:33 CET, pollinterval 30 s, dus het livemoment ligt tussen 19:33:04 en 19:33:34 UTC); Cloudflare production, release recovery smoke en production smoke geslaagd | Alleen runtime-weergave bij een actieve Amerikaanse waarschuwing en de serverroute `/api/waarschuwingen`. Title, meta description, canonical, hreflang, robots, H1, structured data, OG-tags en zichtbare tekst zijn gemeten identiek aan `main` (204 tekstbestanden, build tegen build). Effect op ranking niet gemeten. |

## 4. Periodes

Drie periodes van veertien dagen, donderdag t/m woensdag, met dezelfde weekdagverdeling.

| Periode | Datums | Rol |
|---|---|---|
| P0 | 1–14 oktober | Nulmeting (bevat de piek van 12–13 oktober) |
| P1 | 15–28 oktober | Eerste periode na de introtekst |
| P2 | 29 oktober–11 november | Tweede periode na de introtekst |

Search Console loopt twee dagen achter (de export van 23 oktober eindigde op 21 oktober). Op 12 november is de laatste beschikbare dag waarschijnlijk 10 november. Twee keuzes: evalueren op 13 november, of P2 laten lopen tot de laatste beschikbare dag en uitsluitend met gemiddelden per dag rekenen, niet met totalen.

## 5. Exports

Per periode een eigen datumbereik. Zet in elke export het filter, exporteer, en bewaar de bestandsnaam met periode en filter.

Minimaal (4 per periode):
- A: zoekopdracht bevat "per uur" én pagina bevat "/weer/" (de groep).
- E: dezelfde zoekopdracht + pagina exact `https://watishetweer.nl/weer/amsterdam/`.
- F: zoekopdracht exact "weer amsterdam per uur".
- G: hele site, geen filter (context).

Uitgebreid (ook per periode): A + apparaat Mobiel, A + apparaat Desktop, A + land Nederland.

Eénmalig: A en E over 15 september t/m laatste beschikbare dag voor de dagreeks (blad Diagram).

De querylijst in de interface is begrensd op 1.000 rijen. De groep A telt circa 312 zoekopdrachten en past daarin; voor G niet (afgekapt).

## 6. Analyse (in deze volgorde)

1. Dagreeks per groep: vertoningen en positie, met 7-daags voortschrijdend gemiddelde en de data uit het logboek erin gemarkeerd.
2. Vaste mand zoekopdrachten, vastgelegd op basis van P0 alleen: de zoekopdrachten die samen minstens 70% van de P0-vertoningen in groep A dekken. Per periode de door Search Console gerapporteerde gemiddelde positie per zoekopdracht. Like-for-like positie = som van (gewicht × positie), met P0-vertoningsaandelen als vaste gewichten, over de zoekopdrachten die in beide periodes vertoningen hebben (gewichten herschaald). Rapporteer ook de dekking (aandeel P0-vertoningen waarvoor een vergelijking bestaat).
3. Mixeffect = verandering van de totale positie van de groep (zoals Search Console die rapporteert) min verandering van de like-for-like positie. Is het mixeffect even groot als de totale verandering, dan is die een verschuiving in zoekopdrachten, geen positieverandering.
4. Splitsingen: apparaat, land (Nederland / overig), Amsterdam-pagina apart, "weer amsterdam per uur" apart.
5. Aantal zoekopdrachten in de mand met gemiddelde positie ≤ 10. Dit is een indicatie op zoekopdrachtniveau, geen verdeling van vertoningen: Search Console geeft die verdeling niet.
6. Klikken en CTR, alleen als context, met 95%-betrouwbaarheidsinterval (Wilson).
7. Gevoeligheid, altijd naast elkaar: (a) volledige dataset; (b) zonder 12–13 oktober; (c) zonder 12–17 oktober (site-brede piek, zie logboek). Variant (c) is een toevoeging op de gevraagde (a) en (b), omdat 14–17 oktober eveneens afwijkt.
8. Handmatige controles: URL-inspectie voor `/weer/amsterdam/` en twee andere plaatspagina's (geïndexeerde HTML, laatst gecrawld, gevulde `wiw-hour-table`); mobiele privézoekopdracht "weer amsterdam per uur" met screenshot en datum.

## 7. Drempels (voor positie)

Dit zijn werkregels, gekozen op basis van de gemeten dagruis (punt 2). Ze zijn niet statistisch afgeleid.

- Verschil kleiner dan 1 positie: ruis.
- 1 tot 2 posities: zwak signaal, niet beslissend.
- 2 posities of meer, consistent in P1 én P2, in de dominante apparaatgroep (mobiel), in de volledige dataset én beide gevoeligheidsvarianten, en niet verklaard door het mixeffect: nuttig signaal. Geen bewijs van oorzaak.
- Dekking van de mand onder 60%, of minder dan circa 50 vertoningen per dag in de groep: onvoldoende gegevens.

## 8. Beslisregels

- Consistente verbetering van positie en relevante vertoningen: bestaande aanpak handhaven en verder observeren.
- Stabiel of slechter: eerst zoekopdrachten, concurrentie, zoekintentie en technische signalen beoordelen; nog geen wijziging.
- Onvoldoende gegevens: geen geforceerde conclusie.
- Maximaal één nieuwe SEO-ingreep, alleen bij een concrete oorzaak of duidelijke kans.

## 9. Open punten (niet te beslissen uit de huidige gegevens)

- Waarom de vertoningen op 18–21 oktober dalen: de daling is niet door een weekdageffect te verklaren (de gelijke weekdagen in 4–12 oktober liggen hoger), en zowel de Amsterdam-reeks (circa 17,9 → 203 → 5,2 vertoningen per dag in 1–11, 14–17 en 18–21 oktober) als de bredere groep (118 → 451 → 57) en de hele site (432 → 1.598 → 392) tonen een piek en een terugval. De exports bieden geen uitsplitsing per dag × apparaat, land of zoekopdracht, dus de oorzaak (vraag, zoekopdrachtmix, positie of een verandering in het zoekresultaat) is niet vast te stellen. Voor de P0-nulmeting kan dat wel alsnog met de uitgebreide exports in punt 5.
- Het effect van de cookiemelding op het snippet is niet onderzocht en niet getest (zie punt 10, stap 5). In de gerenderde HTML van Google staat de melding aan het eind van `body`, buiten elke `data-nosnippet`. Lokaal verschijnt ze niet.

## 10. Snippetcorrectie: controle na een eventuele release (los van de evaluatie van 15 oktober)

1. Leg vast: datum en tijd van de release, merge-commit-SHA, live build-SHA (`meta[name="weather-build-sha"]`) en dat de gerenderde HTML op `/weer/amsterdam/` de omhulde skiplink bevat: `<span data-nosnippet><a class="skiplink" href="#app">Ga naar hoofdinhoud</a></span>`.
2. Vraag in Search Console (actie van de eigenaar) indexering aan voor `/weer/amsterdam/` en twee andere plaatspagina's. Noteer "Laatst gecrawld" uit de URL-inspectie zodra die datum na de release ligt.
3. Herhaal de mobiele privézoekopdracht (Nederland, niet ingelogd) voor "weer amsterdam per uur", met screenshot en datum, op de eerste dag na de nieuwe crawl en een week later.
4. Succescriterium: het snippet toont niet meer "Ga naar hoofdinhoud". Dat is een controle van de weergave, geen bewijs van meer klikken.
5. Toont het snippet daarna andere standaardtekst, bijvoorbeeld de cookiemelding ("Bezoekstatistieken — Mag Google Analytics meten…") of de broodkruimel, dan is dat een tweede, afzonderlijk besluit. De cookiemelding valt onder toestemmingsinstellingen en vraagt daarom eerst akkoord van de eigenaar.
6. Google kiest het snippet per zoekopdracht. Een ander snippet bij één zoekopdracht bewijst niet dat het bij alle zoekopdrachten verandert, en het kan terugvallen op de meta description.

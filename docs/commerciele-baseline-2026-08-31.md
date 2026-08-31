# Commerciële nulmeting en 90-dagenbaseline — 31 augustus 2026

## Wat deze nulmeting wel en niet bewijst

Een historische 90-dagenbezoekersbaseline kan op 31 augustus 2026 niet betrouwbaar worden teruggeconstrueerd: Cloudflare Web Analytics was vóór deze wijziging bewust uitgeschakeld en de repository bevat geen andere historische bezoekersdatabase. Daarom start de commerciële 90-dagenbaseline op **T0: het moment waarop de workflow `Cloudflare Web Analytics setup` voor de eerste keer succesvol eindigt op een live `main`-SHA**. Alles vóór T0 blijft buiten de verkeersbaseline tenzij later een afzonderlijke, controleerbare bron wordt aangeleverd.

Dit document scheidt technische productkwaliteit, Search Console-status, nieuw te verzamelen bezoekersdata en eventuele omzet strikt van elkaar.

## Technische nulmeting

De sale-readinessaudit van 31 augustus 2026 legde voor de toenmalige productie de volgende officiële PageSpeed Insights-labresultaten vast:

| Profiel | Performance | Accessibility | Best Practices | SEO | Agentisch | FCP | LCP | TBT | CLS | Speed Index |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mobiel | 98 | 100 | 100 | 100 | 2/2 | 0,8 s | 2,3 s | 90 ms | 0,018 | 2,1 s |
| desktop | 100 | 100 | 100 | 100 | 2/2 | 0,2 s | 0,6 s | 40 ms | 0,021 | 0,8 s |

PageSpeed rapporteerde op dat moment geen CrUX-velddata. Dat betekent dat er toen geen voldoende echte-gebruikersdataset voor die rapportage beschikbaar was; het zegt niet dat de labtest ontbrak.

De production-smoke bewaakt daarnaast ieder uur de exacte live build-SHA, publieke routes en API-contracten, meerdere wereldlocaties op mobiel en desktop, interacties, performance en mobiele CLS. Technische beschikbaarheid en productcorrectheid blijven dus onafhankelijk van de nieuwe bezoekersmeting bewaakt.

## Search Console-snapshot

De ingelogde Google Search Console-sessie die op 31 augustus 2026 tijdens de overdrachtsaudit is uitgelezen rapporteerde:

- **37 bekende canonieke URL's** in de huidige sitemap-/productset;
- **18 van 37** als geïndexeerd in de op dat moment getoonde accountstatus;
- voor **18 plaatspagina's** liep sinds **28 augustus 2026** een validatietraject.

Deze cijfers zijn een account-snapshot uit die sessie en staan niet als verifieerbare Google-accountdata in de repository. Bij iedere latere commerciële rapportage moeten de actuele Search Console-cijfers opnieuw uit het account worden geëxporteerd of vastgelegd; de repository mag deze snapshot niet stil als actuele status blijven presenteren.

## T0 en meetbronnen

T0 wordt aantoonbaar door drie controles samen:

1. de bedoelde `main`-SHA staat daadwerkelijk live op `https://watishetweer.nl/`;
2. `Cloudflare Web Analytics setup` eindigt groen voor die SHA en verifieert via de Cloudflare API dat de Analytics-site met auto-install actief is;
3. de historische eigen `watishetweer_disable_rum`-Configuration Rule is, indien aanwezig, door diezelfde setup verwijderd en daarna niet meer aangetroffen.

Vanaf T0 worden deze bronnen gebruikt:

| Bron | Waarvoor | Belangrijkste metrics |
|---|---|---|
| Cloudflare Web Analytics | geaggregeerd echt gebruik en browserperformance | pageviews, bezoekers, bezochte paden, verwijzers, landen/apparaten waar beschikbaar, Web Vitals/performance |
| Google Search Console | organische vindbaarheid | klikken, impressies, CTR, gemiddelde positie, geïndexeerde/niet-geïndexeerde pagina's en sitemapstatus |
| GitHub production-smoke | productkwaliteit/reliability | exacte live SHA, routes/API's, browsergates, performance, CLS, fouten |
| financiële administratie | alleen echte monetisatie | bruto-opbrengst, directe kosten, nettowinst |

Cloudflare-bezoekersdata en Search Console-data zijn niet onderling uitwisselbaar: een Search Console-impressie is geen sitebezoek en een pageview is geen omzet.

## 90-dagenmeetcyclus

Gebruik vaste vergelijkingsmomenten vanaf T0. Rapporteer steeds de feitelijke periode en laat ontbrekende data leeg in plaats van die te schatten.

| Moment | Doel |
|---|---|
| T0 | analytics technisch actief en nulstand vastleggen; Search Console-snapshot verversen |
| T0 + 7 dagen | controleren of meting stabiel binnenkomt; grootste landingspagina's en indexeringsverschuivingen signaleren |
| T0 + 30 dagen | eerste bruikbare maandbaseline voor verkeer, organische zichtbaarheid en eventuele opbrengst |
| T0 + 60 dagen | tweede maand vergelijken zonder conclusies op één korte piek te baseren |
| T0 + 90 dagen | volledige commerciële baseline: verkeer, SEO-groei, betrouwbaarheid, kosten en uitsluitend aantoonbare omzet/winst |

Voor iedere checkpoint horen minimaal te worden vastgelegd: periode, live product-SHA aan het einde van de periode, Cloudflare pageviews/bezoekers, Search Console klikken/impressies/CTR/gemiddelde positie, indexeringsdekking, eventuele omzet, directe kosten en nettowinst. Noteer grote releases of meetonderbrekingen apart zodat een trend niet ten onrechte aan SEO of productgroei wordt toegeschreven.

## Commerciële beslisregel

Het eerder gekozen commerciële richtpunt is **minimaal €250 aantoonbare nettowinst per maand** voordat een hogere waardering primair op inkomsten wordt verdedigd. Dat is een doel, geen huidige prestatie. Zolang er geen aantoonbare inkomstenstroom is, wordt de waarde onderbouwd met productkwaliteit, overdraagbaarheid, organische tractie en echte gebruikersgroei, niet met fictieve omzet.

Na 90 dagen:

- zonder aantoonbare omzet: rapporteer verkeer en SEO als tractie, maar zet nettowinst op €0 als er daadwerkelijk geen opbrengst was;
- met omzet: gebruik alleen ontvangen/controleerbare opbrengsten minus direct toerekenbare kosten;
- bij stabiele nettowinst van minstens €250 per maand: bouw pas daarna een inkomstengebaseerde verkoopwaardering op, met meerdere maanden bewijs in plaats van één uitschieter.

## Baseline-template

Vul dit per checkpoint aan buiten of in een gedateerde opvolgnotitie; overschrijf de historische nulmeting niet.

| Metric | T0 | +7d | +30d | +60d | +90d |
|---|---:|---:|---:|---:|---:|
| Cloudflare pageviews | — |  |  |  |  |
| Cloudflare bezoekers | — |  |  |  |  |
| Search Console klikken | account-snapshot vereist |  |  |  |  |
| Search Console impressies | account-snapshot vereist |  |  |  |  |
| Search Console CTR | account-snapshot vereist |  |  |  |  |
| Gemiddelde positie | account-snapshot vereist |  |  |  |  |
| Geïndexeerde URL's | 18/37 snapshot |  |  |  |  |
| Omzet | niet vastgesteld |  |  |  |  |
| Directe kosten | niet vastgesteld |  |  |  |  |
| Nettowinst | niet vastgesteld |  |  |  |  |

## Interpretatiegrenzen

- De eerste dagen na T0 zijn te kort voor een betrouwbare verkoopmultiple of SEO-conclusie.
- Een stijging in pageviews zonder stijging in Search Console-klikken kan uit direct, referral of ander verkeer komen; controleer de bronverdeling voordat een oorzaak wordt genoemd.
- Een stijging in Search Console-impressies zonder meer klikken kan wijzen op bredere zichtbaarheid maar bewijst geen gebruikersgroei.
- Technische PageSpeed-/smokegroenheid bewijst productkwaliteit, niet markttractie.
- Geen historische analytics betekent geen historische nul; het betekent **onbekend**. Gebruik daarom nooit 0 bezoekers voor de periode vóór T0.

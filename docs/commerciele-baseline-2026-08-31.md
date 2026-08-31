# Commerciële nulmeting en 90-dagenbaseline — 31 augustus 2026

## Wat deze nulmeting wel en niet bewijst

Een historische 90-dagenbezoekersbaseline kan op 31 augustus 2026 niet betrouwbaar worden teruggeconstrueerd: Cloudflare Web Analytics was vóór deze wijziging bewust uitgeschakeld en de repository bevat geen andere historische bezoekersdatabase. Daarom start de commerciële 90-dagenbaseline op **T0: het eerste controleerbare moment waarop Cloudflare Web Analytics aantoonbaar actief verkeer ontvangt op de bedoelde live `main`-SHA**. Alles vóór T0 blijft buiten de verkeersbaseline tenzij later een afzonderlijke, controleerbare bron wordt aangeleverd.

Een succesvolle `Cloudflare Web Analytics setup`-workflow is de voorkeursroute om de accountconfiguratie via de Cloudflare API te verifiëren, maar de commerciële T0 hangt niet uitsluitend van die beheerroute af. Als de live browser aantoonbaar de officiële Cloudflare Insights-runtime bereikt en same-origin `/cdn-cgi/rum`-requests verstuurt, is de meting zelf feitelijk actief. Dat live gedrag is doorslaggevend voor de start van de bezoekersbaseline.

Dit document scheidt technische productkwaliteit, Search Console-status, nieuw te verzamelen bezoekersdata en eventuele omzet strikt van elkaar.

### Historische setupstatus op 31 augustus 2026

De eerdere merge-SHA `b4a660848338cece3e308f44ae6a2074d0895616` is succesvol naar Cloudflare Pages uitgerold en de volledige production-smoke op die SHA was groen. De afzonderlijke workflow `Cloudflare Web Analytics setup` bereikte daarna aantoonbaar dezelfde live SHA, maar de eerste Web Analytics-accountaanvraag faalde met HTTP 403 omdat de toen gebruikte Cloudflare-token onvoldoende Account Settings-rechten had. Daardoor kon op dat moment via die beheerworkflow niet worden bewezen dat Web Analytics actief was en startte T0 toen nog niet.

Die mislukte beheeractie heeft geen historische bezoekersdata opgeleverd en blijft als auditfeit staan. Zij zegt echter niets over een latere handmatige of platformmatige activering buiten die specifieke API-call.

### T0 nu aantoonbaar gestart

Op de finale productie-SHA **`15ee416761b8ff6a5dd92d05bb7bc0a7542cfdb7`** is op 31 augustus 2026 tijdens de production-smoke live Cloudflare RUM-verkeer waargenomen in zowel Chromium desktop als WebKit iPhone. Beide browserprofielen bereikten `static.cloudflareinsights.com` en verstuurden elk **3 same-origin requests naar `/cdn-cgi/rum`**. Dezelfde meting bleef vrij van console- en page-errors en de production-smoke eindigde volledig groen.

Daarmee is Cloudflare Web Analytics op live productie **feitelijk actief**. Voor deze commerciële baseline wordt daarom **T0 vastgelegd op 31 augustus 2026 om circa 16:31 CEST**, het eerste in deze auditketen controleerbare live moment waarop de meting actief is bewezen. Dit is bewust het eerste bewezen observatiemoment, niet de onbewezen aanname dat Cloudflare exact op dat tijdstip is ingeschakeld.

De eerdere API-permissiefout blijft alleen relevant voor toekomstige geautomatiseerde accountconfiguratie. Uit de live browsermeting mag niet worden afgeleid dat de GitHub Actions-token inmiddels extra Account Settings-rechten heeft; daarvoor zou de setupworkflow of Cloudflare API afzonderlijk opnieuw succesvol moeten worden geverifieerd. Voor de vraag of bezoekersmeting nu daadwerkelijk loopt, is die beheerpermissie echter geen blocker meer.

## Technische nulmeting

De sale-readinessaudit van 31 augustus 2026 legde voor de toenmalige productie de volgende officiële PageSpeed Insights-labresultaten vast:

| Profiel | Performance | Accessibility | Best Practices | SEO | Agentisch | FCP | LCP | TBT | CLS | Speed Index |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mobiel | 98 | 100 | 100 | 100 | 2/2 | 0,8 s | 2,3 s | 90 ms | 0,018 | 2,1 s |
| desktop | 100 | 100 | 100 | 100 | 2/2 | 0,2 s | 0,6 s | 40 ms | 0,021 | 0,8 s |

PageSpeed rapporteerde op dat moment geen CrUX-velddata. Dat betekent dat er toen geen voldoende echte-gebruikersdataset voor die rapportage beschikbaar was; het zegt niet dat de labtest ontbrak.

De finale production-smoke op `15ee416761b8ff6a5dd92d05bb7bc0a7542cfdb7` bevestigde daarnaast vijf groene productiegates: productiecontract, live performance in Chromium en WebKit, mobiele CLS, wereldwijde browsercontrole en staff-auditinteracties. De vijf koude mobiele CLS-runs lagen tussen 0,0108 en 0,0198, dus maximaal afgerond **0,020**, ruim binnen het bewaakte budget van 0,1.

De production-smoke bewaakt daarnaast ieder uur de exacte live build-SHA, publieke routes en API-contracten, meerdere wereldlocaties op mobiel en desktop, interacties, performance en mobiele CLS. Technische beschikbaarheid en productcorrectheid blijven dus onafhankelijk van de bezoekersmeting bewaakt.

## Search Console-snapshot

De ingelogde Google Search Console-sessie die op 31 augustus 2026 tijdens de overdrachtsaudit is uitgelezen rapporteerde:

- **37 bekende canonieke URL's** in de huidige sitemap-/productset;
- **18 van 37** als geïndexeerd in de op dat moment getoonde accountstatus;
- voor **18 plaatspagina's** liep sinds **28 augustus 2026** een validatietraject.

Deze cijfers zijn een account-snapshot uit die sessie en staan niet als verifieerbare Google-accountdata in de repository. Bij iedere latere commerciële rapportage moeten de actuele Search Console-cijfers opnieuw uit het account worden geëxporteerd of vastgelegd; de repository mag deze snapshot niet stil als actuele status blijven presenteren.

## T0 en meetbronnen

T0 wordt in deze baseline aantoonbaar door de volgende live controles samen:

1. de bedoelde `main`-SHA staat daadwerkelijk live op `https://watishetweer.nl/`;
2. een echte browser bereikt de officiële Cloudflare Insights-herkomst en verstuurt same-origin `/cdn-cgi/rum`-requests zonder onverwachte analytics-herkomst of browserfouten;
3. de productiecontrole koppelt die requests aan exact dezelfde live build-SHA.

De `Cloudflare Web Analytics setup`-workflow blijft daarnaast de voorkeursroute om accountconfiguratie, auto-install en eventuele oude Configuration Rules via de Cloudflare API te beheren en te auditen zodra de gebruikte token daarvoor voldoende rechten heeft. Die beheercontrole is aanvullend en vervangt de feitelijke live meting niet.

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
| Cloudflare pageviews | meting gestart; dashboardnulstand vastleggen |  |  |  |  |
| Cloudflare bezoekers | meting gestart; dashboardnulstand vastleggen |  |  |  |  |
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

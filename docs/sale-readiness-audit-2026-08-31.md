# Sale-readiness audit — 31 augustus 2026

## Afbakening

Deze audit is uitgevoerd tegen bron-SHA `36f2dfc1f86a3730fe8b6a5e0aae55a07387066d` en de op dat moment publiek actieve productie op `https://watishetweer.nl/`. De canonieke repository was `Tommjoness/watishetweer`. De audit beoordeelde productgedrag, performance, technische SEO en overdraagbaarheid. Privégegevens uit Google Search Console, Cloudflare Billing en de domeinregistrar waren niet beschikbaar en zijn niet als gecontroleerd gepresenteerd.

## Gecontroleerde feiten

- `main`, live `weather-build-sha` en de bedoelde productie-SHA waren gelijk.
- Cloudflare production, WeatherNow quality en WeatherNow production smoke waren groen voor dezelfde SHA.
- Er waren nul open pull requests en nul open issues.
- De wereldwijde productie-browsermonitor vergeleek zichtbare temperatuur, wind, UV, dag/nacht, lokale tijd, zon en zeven dagrijen met de live bronrespons voor Amsterdam, New York, Tokio, Sydney, Singapore en Longyearbyen op 390 px mobiel en 1440 px desktop. Alle twaalf combinaties hadden 0 px horizontale overflow.
- De interactieve productiesmoke controleerde de eerste grafiekstate, toegankelijke grafiektabel, toetsenbord, Sydney–Amsterdam Back/Forward, touch targets op 320–430 px, desktopresize, metadata en een ongeldige gedeelde URL.
- De live performancemonitor mat één volledige forecastaanvraag en 0 px overflow. Chromium desktop: DOM 265 ms, weerdata 1.673 ms, grafiek 1.682 ms. WebKit iPhone: DOM 520 ms, weerdata 1.368 ms, grafiek 1.742 ms.
- Vijf koude mobiele productieruns eindigden allemaal met data; maximale CLS was 0,011 bij een budget van 0,1 en de initiële scrollpositie bleef stabiel.
- De volledige kwaliteitsketen controleerde onder meer grafiek, briefing, Nachtzicht, weekverwachting, lege/foutstates, pooldag/poolnacht, licht/donker, toegankelijkheid, 320–430 px overflow, Chromium en WebKit.
- Een aanvullende live desktopinspectie bevestigde de briefing, 24-uursgrafiek, zeven dagen, Nachtzicht, expliciete donkere stand, ongeldige gedeelde URL, echte 404/noindex en het Longyearbyen-randgeval.

## PageSpeed Insights

Officieel nieuw rapport, vastgelegd op 31 augustus 2026 om 10:41 CEST:

| Profiel | Performance | Accessibility | Best Practices | SEO | Agentisch | FCP | LCP | TBT | CLS | Speed Index |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| mobiel | 98 | 100 | 100 | 100 | 2/2 | 0,8 s | 2,3 s | 90 ms | 0,018 | 2,1 s |
| desktop | 100 | 100 | 100 | 100 | 2/2 | 0,2 s | 0,6 s | 40 ms | 0,021 | 0,8 s |

- [Mobiel rapport](https://pagespeed.web.dev/analysis/https-watishetweer-nl/8pes0w05zp?form_factor=mobile)
- [Desktop rapport](https://pagespeed.web.dev/analysis/https-watishetweer-nl/8pes0w05zp?form_factor=desktop)

PageSpeed rapporteerde geen CrUX-velddata. Dat betekent dat het rapport op dat moment geen voldoende echte-gebruikersdataset toonde; het is geen mislukte labtest.

## SEO en indexeerbaarheid

- `robots.txt` liet crawling toe en verwees naar de canonieke sitemap.
- De live sitemap bevatte exact 37 unieke canonieke URL's: homepage, `/weer/`, `/over/` en 34 plaatsroutes. Er stonden geen `www`- of query-URL's in.
- Homepage en Amsterdam-route hadden een passende canonical, unieke metadata en parseerbare JSON-LD.
- De Amsterdam-route had één locatie-H1, WebSite/WebPage/BreadcrumbList-data, broodkruimels en vier echte nabijgelegen plaatslinks.
- De 404-route had `noindex,nofollow` en een bruikbare terugweg.
- Publieke zoekresultaten lieten de homepage, de plaatsindex en meerdere plaatsroutes als gevonden/crawlbaar zien.

Niet gecontroleerd: private Search Console-rapporten zoals Page indexing, Core Web Vitals per property, handmatige acties, sitemapverwerking en exacte zoekklikken. Die accountcontrole blijft onderdeel van de overdrachtschecklist.

## Bevinding en herstel

Er is geen ernstig productdefect bevestigd dat verdere UI- of datacode rechtvaardigde. Er was wel één operationele overdrachtsfout: `.github/workflows/cloudflare-preview.yml` was nog beperkt tot een oude migratiebranch en gebruikte de vaste previewnaam `pr-164`. Daardoor zou een normale nieuwe PR geen actuele Cloudflare-preview krijgen.

De bijbehorende sale-readinesswijziging maakt de previewbranch dynamisch per PR of handmatige run, verwijdert de oude branchbeperking en voorkomt dat verouderde previewruns doorlopen. Het beheer-, secrets-, kosten- en recoveryproces is vastgelegd in `docs/overdracht-runbook.md` en wordt door een repositorycontract bewaakt.

## Oordeel

Technisch is het product klaar voor overdracht zodra de sale-readiness-PR groen is gemerged en de nieuwe live SHA opnieuw door production smoke is bevestigd. De resterende acties zijn account- en verkoophandelingen: eigendom, billing, tokenrotatie, registrar/DNSSEC, Search Console en een actuele commerciële toets van bronvoorwaarden. Extra cosmetische codepolish heeft op basis van deze audit een lager rendement dan die overdrachts- en commerciële stappen.

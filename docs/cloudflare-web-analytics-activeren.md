# Cloudflare Web Analytics activeren

## Status

De productiesite en productie-smoke kunnen volledig groen zijn terwijl Cloudflare Web Analytics nog uit staat. De Analytics-setup is bewust apart gehouden van de normale deploy.

De setupworkflow gebruikt bij voorkeur een afzonderlijke GitHub Actions-secret `CLOUDFLARE_ANALYTICS_API_TOKEN`. Alleen wanneer die ontbreekt, valt de workflow tijdelijk terug op de bestaande `CLOUDFLARE_API_TOKEN`. Voor verkoopbaarheid en least privilege is een aparte Analytics-token de voorkeursroute.

## Minimale tokenrechten

Maak in Cloudflare een API-token voor het account van `watishetweer.nl` met uitsluitend de rechten die deze workflow nodig heeft:

### Account

- `Account Settings Read`
- `Account Settings Write` / `Edit`
- `Cloudflare Pages Read` / `Pages Read`

### Zone: watishetweer.nl

- `Config Rules Edit`

Beperk de account- en zoneresources tot het juiste Cloudflare-account en, waar de Cloudflare-tokeneditor dat ondersteunt, uitsluitend de zone `watishetweer.nl`.

Waarom deze rechten nodig zijn:

- Pages Read: de setup leest de custom domains van het Pages-project om de juiste `zone_tag` vast te stellen.
- Account Settings Read: Cloudflare vereist dit voor het opvragen/lijsten van Web Analytics-sites.
- Account Settings Write: Cloudflare vereist dit voor het aanmaken of activeren van de Web Analytics-site.
- Config Rules Edit: de setup verwijdert pas ná succesvolle Analytics-activatie uitsluitend de historische eigen `watishetweer_disable_rum`-regel.

## GitHub-secret

Plaats de nieuwe token in de repository als Actions-secret:

`CLOUDFLARE_ANALYTICS_API_TOKEN`

Laat `CLOUDFLARE_API_TOKEN` staan voor de normale Cloudflare Pages-deploy. Deel of log geen tokenwaarde.

## Setup uitvoeren

Start daarna de GitHub Actions-workflow:

`Cloudflare Web Analytics setup`

De workflow:

1. checkt de exacte bron-SHA uit;
2. wacht totdat exact die SHA publiek live staat;
3. selecteert de dedicated Analytics-token als die bestaat;
4. maakt/activeert de Web Analytics-site idempotent;
5. leest de site opnieuw terug en verifieert `auto_install` en de zone;
6. verwijdert alleen daarna de eigen historische RUM-blokkaderegel indien die nog bestaat.

De workflow moet volledig groen eindigen voordat de commerciële T0-baseline start.

## Verificatie

Na een groene setup hoort de volgende production-smoke of handmatige browsercontrole de officiële Cloudflare Web Analytics-beacon en de same-origin `/cdn-cgi/rum`-route te kunnen zien. De site mag geen handmatig hardcoded Analytics-token of externe tracking-snippet nodig hebben.

Als de setup opnieuw HTTP 403 geeft, verruim niet willekeurig de token. Controleer eerst welk endpoint faalt en vergelijk dat met bovenstaande minimale permissies.

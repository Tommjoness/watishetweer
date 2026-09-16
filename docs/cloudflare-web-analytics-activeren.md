# Cloudflare Web Analytics activeren

## Status

Cloudflare Web Analytics draait voor `watishetweer.nl` via de officiële Cloudflare RUM-laag. De normale Pages-deploy, de Analytics-setup en de read-only rapportage zijn bewust van elkaar gescheiden.

## Tokenrollen

Er zijn nu twee verschillende rollen. Gebruik ze niet door elkaar.

### 1. Read-only rapportage en admincockpit

GitHub Actions-secret:

`CLOUDFLARE_ANALYTICS_API_TOKEN`

Minimale Cloudflare-permissie:

- **Account → Account Analytics → Read**

Deze token wordt gebruikt voor:

- de workflow `Cloudflare human analytics report`;
- de bot-gefilterde 1/7/30-dagenrapportage;
- de afgeschermde Cloudflare-sectie op `/admin/seo/`.

De workflow synchroniseert deze token uitsluitend als `secret_text` naar de **production** Pages Functions-runtime. Previewdeployments krijgen hem niet. De browser krijgt de token nooit te zien.

### 2. Web Analytics activeren of herstellen

Optionele GitHub Actions-secret:

`CLOUDFLARE_ANALYTICS_SETUP_API_TOKEN`

Deze token is alleen nodig wanneer de setupworkflow zelfstandig Web Analytics moet kunnen aanmaken/activeren en de historische eigen `disable_rum`-regel moet kunnen verwijderen.

Benodigde setuprechten:

#### Account

- `Account Settings Read`
- `Account Settings Write` / `Edit`
- `Cloudflare Pages Read` / `Pages Read`

#### Zone: watishetweer.nl

- `Config Rules Edit`

Als `CLOUDFLARE_ANALYTICS_SETUP_API_TOKEN` ontbreekt, gebruikt de setupworkflow als fallback de bestaande `CLOUDFLARE_API_TOKEN`. De read-only `CLOUDFLARE_ANALYTICS_API_TOKEN` wordt **nooit** voor setup-writes geselecteerd.

Beperk tokens waar mogelijk tot het juiste Cloudflare-account en de zone `watishetweer.nl`.

## Setup uitvoeren

Start alleen wanneer activatie/herstel nodig is de GitHub Actions-workflow:

`Cloudflare Web Analytics setup`

De workflow:

1. checkt de exacte bron-SHA uit;
2. wacht totdat exact die SHA publiek live staat;
3. selecteert de dedicated setup-token of de deployfallback;
4. maakt/activeert de Web Analytics-site idempotent;
5. leest de site opnieuw terug en verifieert `auto_install` en de zone;
6. verwijdert alleen daarna de eigen historische RUM-blokkaderegel indien die nog bestaat.

Een permissiefout in deze setup is geen reden om de read-only rapportagetoken ruimer te maken.

## Admincockpit

De afgeschermde pagina `/admin/seo/` toont naast Search Console ook Cloudflare Web Analytics voor alleen `watishetweer.nl`:

- laatste 24 uur;
- laatste 7 dagen;
- laatste 30 dagen;
- bot-gefilterde visits (`bot: 0`);
- bot-gefilterde pageviews;
- uitgesloten bot-pageviews;
- bot-aandeel op basis van pageviews;
- samplingstatus van de Cloudflare RUM-query.

De route `/api/admin/seo/cloudflare` voert de GraphQL-query server-side uit en gebruikt dezelfde Cloudflare Access-validatie en e-mailallowlist als de bestaande SEO-cockpit. Responses zijn `private, no-store` en `noindex`.

`*.pages.dev` preview- en QA-hosts worden niet in deze rapportage meegenomen doordat de GraphQL-query expliciet op `requestHost: watishetweer.nl` filtert.

## Interpretatie

`Visits` zijn Cloudflare-bezoeken/sessies, geen unieke personen. `bot: 0` betekent dat Cloudflare het verkeer niet als bot classificeerde; het is geen sluitend bewijs dat achter elk bezoek een mens zat.

Langere vensters kunnen door Cloudflare worden gesampled. De cockpit toont daarom ook de samplingstatus; gesamplede 7- en 30-dagenwaarden moeten als schattingen worden gelezen.

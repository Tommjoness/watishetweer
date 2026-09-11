# Privé SEO-dashboard setup

De code in `admin/seo/` en `functions/api/admin/seo.js` is bewust **fail-closed**. Zonder Cloudflare Access en Google service-account secrets levert de API geen SEO-data.

## 1. Cloudflare Access

Maak in Cloudflare Zero Trust een Self-hosted Access application voor beide paden:

- `https://watishetweer.nl/admin/seo*`
- `https://watishetweer.nl/api/admin/seo*`

Sta alleen het gewenste beheer-e-mailadres toe. Noteer daarna:

- de team domain, bijvoorbeeld `teamnaam.cloudflareaccess.com`;
- de Application Audience (AUD) tag.

Configureer in Cloudflare Pages voor productie én previews waar gewenst:

- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`
- `SEO_ADMIN_EMAILS` — komma-gescheiden allowlist, bijvoorbeeld `beheer@example.com`

De Function verifieert de `Cf-Access-Jwt-Assertion` cryptografisch tegen de Cloudflare Access JWKS. Alleen de e-mailheader vertrouwen is bewust niet voldoende.

### Beschermde Pages-previews en GitHub Actions

Als Cloudflare Pages preview-deployments via Access zijn afgeschermd, moeten de CI-smoke- en browsertests zich ook expliciet authenticeren. Gebruik daarvoor een aparte Cloudflare Access **Service Token** voor GitHub Actions; zet de gebruikerspolicy niet uit en behandel een Access-redirect niet als een geslaagde test.

1. Maak in Zero Trust onder **Access controls → Service credentials → Service Tokens** een token voor GitHub Actions.
2. Voeg aan de bestaande Pages-preview Access application een **Service Auth** policy toe met selector **Service Token** en uitsluitend dat token.
3. Bewaar in GitHub Actions repository secrets:
   - `CF_ACCESS_CLIENT_ID`
   - `CF_ACCESS_CLIENT_SECRET`
4. Commit deze waarden nooit en zet ze niet in `wrangler.toml`.

De previewworkflow laadt `scripts/cloudflare-access-preload.cjs`. Die injecteert de twee Access-headers uitsluitend richting `*.watishetweer.pages.dev`; het productiedomein krijgt deze CI-credentials niet. Een half geconfigureerd token faalt hard.

Deze CI-token is alleen bedoeld om de buitenste preview-Accesslaag te passeren. De SEO-admin-API blijft intern de gebruikers-JWT en e-mailallowlist controleren; de service-tokenroute verzwakt die controle niet.

## 2. Google service account

Maak in Google Cloud één service-account aan. Download de JSON-key **niet naar de repository** en commit hem nooit.

Voeg het service-account e-mailadres toe als read-only gebruiker aan:

1. Google Search Console property `sc-domain:watishetweer.nl`;
2. de GA4-property van `watishetweer.nl` zodra die bestaat (Viewer is voldoende).

Configureer Cloudflare Pages secrets:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GSC_SITE_URL=sc-domain:watishetweer.nl`
- `GA4_PROPERTY_ID=<numerieke GA4 property id>` — optioneel tot GA4 bestaat

De private key mag de gebruikelijke PEM met echte newlines bevatten; ook een secret waarin newlines als `\n` staan wordt ondersteund.

## 3. GA4

Zolang `GA4_PROPERTY_ID` ontbreekt blijft Search Console volledig werken en toont het dashboard een duidelijke "Nog niet gekoppeld" status voor GA4.

Maak later in Google Analytics een aparte property en web data stream voor `https://watishetweer.nl`. De frontend GA4-tag is een afzonderlijke wijziging en hoort niet stilzwijgend bij deze PR: eerst measurement-id, CSP/privacy-impact en regressietests expliciet beoordelen.

## 4. Verificatie voor merge

Minimaal:

- `node --check functions/api/admin/seo.js`
- `node --check admin/seo/seo-dashboard.js`
- `node scripts/seo-admin-dashboard.test.js`
- bestaande `npm run test:prebuild`
- Cloudflare preview: zonder Access-config moet `/api/admin/seo` fail-closed antwoorden;
- beschermde preview: CI passeert Access alleen met het aparte service token en voert daarna de bestaande inhoudelijke tests ongewijzigd uit;
- na Access-config: niet-toegestane gebruikers 403/Access-deny, toegestaan beheeraccount krijgt data;
- bevestig dat responses `no-store` en `noindex` dragen.

Merge pas nadat productie-secrets, preview-service-token, Access-policies en een echte ingelogde dashboardcontrole expliciet zijn gecontroleerd.

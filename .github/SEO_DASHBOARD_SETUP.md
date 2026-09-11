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

### Beschermde Pages-URLs en GitHub Actions

Als `*.watishetweer.pages.dev` via Access is afgeschermd, moeten zowel previewchecks als de immutable productiecheck zich expliciet authenticeren. Gebruik daarvoor één aparte Cloudflare Access **Service Token** voor GitHub Actions; zet de gebruikerspolicy niet uit en behandel een Access-redirect niet als een geslaagde test.

1. Maak in Zero Trust onder **Access controls → Service credentials → Service Tokens** een token voor GitHub Actions.
2. Voeg aan de bestaande Pages Access application een **Service Auth** policy toe met selector **Service Token** en uitsluitend dat token.
3. Bewaar in GitHub Actions repository secrets:
   - `CF_ACCESS_CLIENT_ID`
   - `CF_ACCESS_CLIENT_SECRET`
4. Commit deze waarden nooit en zet ze niet in `wrangler.toml`.

De preview- én productionworkflow laden voor checks op `*.watishetweer.pages.dev` `scripts/cloudflare-access-preload.cjs`. Die injecteert de twee Access-headers uitsluitend richting dat Pages-hostpatroon; `watishetweer.nl`, `www.watishetweer.nl` en externe providers krijgen deze CI-credentials niet. Een half geconfigureerd token faalt hard.

Deze CI-token is alleen bedoeld om de buitenste Pages-Accesslaag te passeren. De SEO-admin-API blijft intern de gebruikers-JWT en e-mailallowlist controleren; de service-tokenroute verzwakt die controle niet.

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

De dashboard-API kan GA4 al server-side uitlezen via de Analytics Data API. Om de kaart **Gedrag na de klik** echt te vullen zijn drie dingen nodig:

1. een GA4-property voor `watishetweer.nl` met een web data stream;
2. het bestaande Google service-account als **Viewer** op die GA4-property;
3. `GA4_PROPERTY_ID` als numerieke property-id in Cloudflare Pages voor productie en preview, gevolgd door een nieuwe deployment.

Zonder `GA4_PROPERTY_ID` blijft Search Console volledig werken en toont het dashboard bewust "Nog niet gekoppeld".

Let op: alleen de uitleeskoppeling vullen geeft nog geen nieuwe GA4-metingen. Voor nieuwe bezoekersdata moet de site zelf GA4-events verzenden. Een frontend GA4-tag is een afzonderlijke privacywijziging: measurement-id, consent/CMP, CSP en privacytekst moeten dan expliciet worden beoordeeld en getest voordat tracking op productie wordt aangezet.

## 4. Verificatie voor merge

Minimaal:

- `node --check functions/api/admin/seo.js`
- `node --check admin/seo/seo-dashboard.js`
- `node scripts/seo-admin-dashboard.test.js`
- bestaande `npm run test:prebuild`
- Cloudflare preview: zonder Access-config moet `/api/admin/seo` fail-closed antwoorden;
- beschermde Pages-URLs: CI passeert Access alleen met het aparte service token en voert daarna de bestaande inhoudelijke tests ongewijzigd uit;
- na Access-config: niet-toegestane gebruikers 403/Access-deny, toegestaan beheeraccount krijgt data;
- bevestig dat responses `no-store` en `noindex` dragen.

Merge pas nadat productie-secrets, Pages-service-token, Access-policies en een echte ingelogde dashboardcontrole expliciet zijn gecontroleerd.
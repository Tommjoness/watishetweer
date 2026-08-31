# Gratis provideruitbreiding: neerslag, pollen en luchtkwaliteit

Datum: 31 augustus 2026

## Doel en harde randvoorwaarden

Deze notitie bepaalt welke extra databronnen veilig bij `watishetweer.nl` passen voordat er nieuwe runtimekoppelingen worden gebouwd.

Randvoorwaarden:

- alleen gratis publieke databronnen;
- bij voorkeur zonder API-key of account;
- officiële meetdiensten krijgen voorrang boven communitysensoren;
- een extra provider is altijd een aanvulling, nooit een reden om de bestaande Open-Meteo-forecast te blokkeren;
- observaties, modelverwachtingen, indices en concentraties worden niet als dezelfde soort waarheid behandeld;
- een providerfout moet fail-closed of terugvallen op de bestaande productwaarheid;
- bronvermelding en gebruiksvoorwaarden worden per provider expliciet geborgd;
- geen bron wordt alleen toegevoegd om het aantal providers te verhogen.

## Huidige productie

De huidige weerforecast blijft wereldwijd op Open-Meteo draaien. Voor korte-termijnneerslag bestaat daarnaast een generieke `/api/neerslag`-laag. Die gebruikt nu KNMI-puntdata binnen de ondersteunde dekking en laat bij ontbrekende of onbruikbare providerdata de gewone modelverwachting intact.

Luchtkwaliteit en pollen worden momenteel rechtstreeks via de Open-Meteo Air Quality API geladen. De UI vraagt actuele Europese/US AQI op en, voor pollen, uurwaarden voor els, berk, gras, bijvoet, ambrosia en olijf. Buiten de ondersteunde Europese pollencontext wordt geen lokale pollenconcentratie verzonnen.

Dit gedrag blijft de fallbackbasis tijdens provideruitbreiding.

## Shortlist

| Onderdeel | Provider | Gebied | Type waarheid | Toegang | Resolutie/actualiteit | Advies |
| --- | --- | --- | --- | --- | --- | --- |
| Luchtkwaliteit | Luchtmeetnet / RIVM e.a. | Nederland | officiële stationsmetingen | open API, geen nieuwe sleutel voorzien; Fair Use | ongevalideerde uurgemiddelden, stationafhankelijk | **P1: implementeren** als niet-blokkerende observationele aanvulling |
| Luchtkwaliteit | Umweltbundesamt Air Data API v4 | Duitsland | officiële stationsmetingen + LQI | publieke GET-API, geen sleutel in de officiële v4-interface | stündliche concentraties/index | **P2: implementeren** na NL |
| Luchtkwaliteit | NABEL / FOEN | Zwitserland | officiële stationsmetingen | publieke dataquery/open data | uurgemiddelden beschikbaar | **P3: onderzoeken/implementeren** nadat download/API-vorm voor runtime is vastgezet |
| Neerslag | DWD RADOLAN/RADAR | Duitsland | radarobservatie | DWD Open Data, keyless | operationele radarproducten; RY vijfminutenanalyse | **P1 voor Duitsland**, maar alleen na bewezen parser + projectie |
| Neerslag | DWD RADVOR/RV | Duitsland | radarnowcast | DWD Open Data, keyless | 5-minutenverwachting tot circa 2 uur volgens productdocumentatie | **P2**, apart bewijzen van observatiepad |
| Neerslag | MeteoSwiss OGD | Zwitserland | stationsmeting / radarobservatie | Open Government Data, keyless | 10-minutenstations; radar via STAC/HDF5 | **P2 voor Zwitserland** |
| Pollen | DWD ICON-ART | Duitsland | modelverwachting concentratie | DWD Open Data, keyless | dagelijks, dag 0 t/m +5; circa 6,5 km | **P1 voor Duitsland** als aparte pollenforecastbron |
| Pollen | MeteoSwiss pollenstations | Zwitserland | automatische stationsmetingen | Open Government Data, keyless | actuele concentraties, o.a. uurresolutie | **P2 voor Zwitserland** als observationele aanvulling |

## 1. Luchtkwaliteit

### Nederland: Luchtmeetnet

Luchtmeetnet is de eerste logische uitbreiding. Het netwerk is een initiatief van Nederlandse overheden en meetdiensten en stelt actuele, nog niet definitief gevalideerde meetwaarden via een open API beschikbaar.

Relevante openbare routes/documentatie:

- `https://www.luchtmeetnet.nl/informatie/download-data/open-data`
- `https://api-docs.luchtmeetnet.nl/`
- `https://api.luchtmeetnet.nl/open_api/stations`
- `https://api.luchtmeetnet.nl/open_api/measurements`
- bulk/historiek: `https://data.rivm.nl/data/luchtmeetnet/`

Gebruiksvoorwaarden die in de implementatie moeten terugkomen:

- bronvermelding naar Luchtmeetnet is vereist;
- de API kent Fair Use en geeft geen garantie op continuïteit;
- de realtime API bevat ongevalideerde uurgemiddelde metingen;
- dus nooit de hele luchtkwaliteitsmodule laten falen wanneer Luchtmeetnet niet reageert.

**Voorgestelde productsemantiek:** toon een recente officiële meting als aanvullende lokale context, met station + meettijd. Open-Meteo blijft beschikbaar voor gebiedsbrede modelcontext en voor locaties zonder bruikbaar station.

Niet doen:

- een verre verkeerslocatie stilzwijgend presenteren als exacte waarde voor de gekozen woonplaats;
- stationswaarden en Open-Meteo-modelwaarden middelen tot een niet-herleidbaar getal;
- een Nederlandse LKI/kwaliteitsklasse zonder expliciete schaal gelijkstellen aan de Europese of Amerikaanse AQI.

### Duitsland: Umweltbundesamt Air Data API v4

Het Duitse Umweltbundesamt publiceert een officiële Air Data API. Versie 4 levert per station stündliche pollutantconcentraties en de actuele Luftqualitätsindex.

Bronnen:

- `https://luftdaten.umweltbundesamt.de/api/air-data/v4/doc`
- interfacebeschrijving: `https://www.umweltbundesamt.de/system/files/medien/358/dokumente/schnittstellenbeschreibung_luftdaten_api_v4.pdf`

De v4-documentatie noemt onder meer PM10, PM2,5, NO2 en ozon. Niet ieder station meet iedere component.

**Advies:** pas toevoegen nadat de Nederlandse providerlaag generiek is gemaakt. Zelfde patroon: dichtstbijzijnde geschikte stations, maximale afstand, meettijd/staleness guard, bron zichtbaar, fallback intact.

### Zwitserland: NABEL

FOEN/BAFU beheert het National Air Pollution Monitoring Network (NABEL) met 16 meetlocaties. De publieke dataquery ondersteunt onder andere O3, NO2, SO2, CO, PM10 en PM2,5 en uurgemiddelden.

Bronnen:

- `https://www.bafu.admin.ch/bafu/en/home/topics/air/luftbelastung/data/historical-data/data-query.html`
- `https://www.bafu.admin.ch/en/national-air-pollution-monitoring-network-nabel`

**Advies:** inhoudelijk geschikt, maar pas runtimekoppelen zodra de stabiele machineleesbare download/API-route en gebruiksvoorwaarden voor die specifieke route zijn vastgelegd. Niet scrapen uit de website.

## 2. Neerslag

### Bestaande basis

Nederland en een deel van België hebben al de KNMI-aanvulling via de generieke neerslagroute. Wereldwijd blijft Open-Meteo de veilige forecastfallback.

### Duitsland: DWD RADOLAN

DWD publiceert operationele radardata zonder API-key in Open Data. De actuele RADOLAN-map bevat onder meer `RY`; de actuele directory toont vijfminutenbestanden in zowel binaire/HDF5-vorm. DWD-documentatie beschrijft RY als een vijfminuten, kwaliteitsgecontroleerde radar-neerslaganalyse. De data ligt op een Duits radargrid en vereist dus echte ruimtelijke conversie, niet een simpele lat/lon-index.

Bronnen:

- `https://opendata.dwd.de/weather/radar/radolan/`
- `https://opendata.dwd.de/weather/radar/radolan/ry/`
- uitleg/open-dataformats: `https://www.dwd.de/DE/leistungen/opendata/hilfe.html`
- DWD-gebruiksvoorwaarden/copyright: `https://www.dwd.de/copyright`

DWD vrij toegankelijke geodata mag met bronvermelding worden hergebruikt; de exacte bronvermelding wordt in de productfooter/data-uitleg opgenomen.

**Advies:** zeer waardevol voor Duitsland, maar niet direct in de bestaande KNMI-parser proppen. Bouw een geïsoleerde DWD-adapter met:

1. vaste productkeuze en expliciete versheidsgrens;
2. correcte RADOLAN-projectie;
3. punt-extractie met fixturetests op bekende gridlocaties;
4. fysieke validatie (`>= 0`, missing flags, schaalfactor);
5. alleen daarna registratie als actuele neerslagprovider voor `DE`.

### Duitsland: DWD RADVOR / RV

DWD-productdocumentatie beschrijft RV als een 5-minuten neerslagverwachting tot twee uur. Dat is potentieel de Duitse tegenhanger van een echte radarnowcast.

Bronnen:

- radarcomposites: `https://opendata.dwd.de/weather/radar/composite/`
- RADVOR-map: `https://opendata.dwd.de/weather/radar/radvor/`

**Advies:** tweede fase. Eerst actuele radarobservatie stabiel. Een nowcast mag pas `capabilities.nowcast=true` krijgen wanneer een volledige reeks, tijd-as, projectie en live freshness in regressietests bewezen zijn.

### Zwitserland: MeteoSwiss OGD

MeteoSwiss stelt sinds de OGD-uitrol meet-, klimaat- en forecastdata gratis, machineleesbaar en automatisch beschikbaar.

Relevante neerslagbronnen:

- 10-minuten stationsneerslag: `https://opendata.swiss/en/dataset/messwerte-niederschlag-10-min-summe`
- radarcollectie via STAC/HDF5: `https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-radar-precip`
- OGD-uitleg: `https://www.meteoswiss.admin.ch/services-and-publications/service/open-data.html`

De stationsdataset wordt iedere tien minuten bijgewerkt en omvat het automatische MeteoSwiss-netwerk plus extra neerslagstations.

**Advies:** Zwitserland is na Duitsland de interessantste neerslaguitbreiding. Start eventueel met stationsmetingen als lokale observatie; radar volgt pas wanneer HDF5/STAC-puntselectie volledig is getest.

## 3. Pollen

### Bestaande basis

Open-Meteo levert nu uurwaarden voor meerdere pollensoorten. Die bron blijft de brede fallback. De huidige UI behandelt concentratie als concentratie en gebruikt bewust geen universele `laag/matig/hoog`-schaal voor alle soorten en bronnen.

### Duitsland: DWD ICON-ART

DWD publiceert pollenconcentratieverwachtingen voor Duitsland als Open Data. De officiële datasetbeschrijving vermeldt:

- eenheid: `1/m³`;
- dekking Duitsland;
- circa 6,5 x 6,5 km ruimtelijke resolutie;
- dag 0 tot en met +5;
- dagelijkse gemiddelde concentratie;
- NetCDF;
- soorten: hazelaar, els, berk, grassen en ambrosia;
- alleen beschikbaar binnen het betreffende pollenseizoen.

Bronnen:

- `https://opendata.dwd.de/climate_environment/health/forecasts/pollen/`
- datasetbeschrijving: `https://opendata.dwd.de/climate_environment/health/forecasts/pollen/DESCRIPTION_ICON_ART_pollen_concentration_daily_en.pdf`

**Advies:** goede Duitse forecastbron, omdat de semantiek al concentratie `1/m³` is en daardoor principieel compatibel is met de huidige concentratiepresentatie. Wel expliciet als **daggemiddelde modelverwachting** labelen en niet doen alsof dit een actuele uurmeting is.

### Zwitserland: MeteoSwiss automatische pollenmetingen

MeteoSwiss exploiteert een nationaal pollennetwerk met 16 automatische meetstations. De OGD-dataset bevat actuele pollenconcentraties per station in uur-, dag- en jaarresolutie.

Bronnen:

- `https://opendata.swiss/en/dataset/pollenstationen-messwerte`
- OGD: `https://www.meteoswiss.admin.ch/services-and-publications/service/open-data.html`

**Advies:** inhoudelijk sterk als observationele aanvulling voor Zwitserland. Net als bij Luchtmeetnet geldt een maximale stationafstand en zichtbare meettijd; geen ruimtelijke schijnprecisie.

## Bronnen die nu bewust niet bovenaan staan

### OpenAQ

Niet als eerste uitbreiding gebruiken. De huidige API-toegang en onboarding zijn niet zo frictieloos/keyless als de gekozen overheidsbronnen. Voor Nederland/Duitsland/Zwitserland zijn bovendien directere officiële meetnetten beschikbaar.

### Communitysensoren / Sensor.Community

Waardevol als aanvullende crowdsourcinglaag, maar de kwaliteitscontrole, sensorplaatsing en representativiteit verschillen sterk. Niet geschikt om officiële meetnetten te verdringen in de eerste productieronde.

### RainViewer en alleen-visuele radartegels

Geen eerste keuze voor puntwaarheid. De productwaarde zit hier in kaarttegels/visualisatie, terwijl `watishetweer.nl` juist betrouwbare numerieke lokale waarheid nodig heeft. Licentie/gebruik en numerieke herleidbaarheid zijn bovendien minder eenvoudig dan bij de nationale open-datafeeds.

## Aanbevolen implementatievolgorde

### Fase A — Nederlandse luchtmetingen

1. Bouw een kleine generieke server-side luchtkwaliteitsproviderlaag naast de bestaande clientforecast.
2. Voeg Luchtmeetnet toe voor `NL`.
3. Cache stationmetadata ruim; cache meetwaarden kort volgens Fair Use.
4. Kies alleen een station binnen een expliciete maximale afstand en met voldoende recente data.
5. Publiceer bron, stationafstand en meettijd in de payload.
6. Laat iedere fout geruisloos terugvallen op de bestaande Open-Meteo-luchtkwaliteit.
7. Verander in deze fase geen AQI-schaalberekeningen.

### Fase B — Duitsland

1. Voeg Umweltbundesamt toe aan dezelfde luchtkwaliteitsproviderlaag.
2. Bouw DWD RADOLAN als volledig geïsoleerde neerslagadapter en registreer die pas na parser/projectietests.
3. Voeg daarna DWD ICON-ART pollen toe als dagelijkse Duitse forecastcontext.
4. Onderzoek pas daarna DWD RV/RADVOR als Duitse twee-uursnowcast.

### Fase C — Zwitserland

1. MeteoSwiss 10-minutenneerslag / later radar.
2. MeteoSwiss automatische pollenstations.
3. NABEL zodra de machineleesbare runtime-interface expliciet is vastgelegd.

## Architectuurregels voor alle nieuwe adapters

Iedere adapter publiceert minimaal:

- `provider` / `bron`;
- soort waarheid: `observatie`, `nowcast` of `model`;
- `gemetenOp` of geldige forecasttijd;
- `opgehaaldOp`;
- dekking/land;
- waar relevant station-ID, afstand en eenheden;
- expliciete beschikbaarheidsstatus en niet-technische fallbackreden.

Daarnaast:

- timeouts en AbortSignal op iedere externe call;
- bounded retries of helemaal geen retry in het gebruikersrequest;
- server-side caching voor stationmetadata en Fair-Use-gevoelige endpoints;
- responsevalidatie vóór data aan de productstate wordt toegevoegd;
- stale guards vóór een observatie een modelclaim mag corrigeren;
- providerdata nooit in een bestaande schaal persen zonder bewezen conversie;
- UI blijft werken wanneer iedere extra provider tegelijk uitvalt.

## Besluit

De provideruitbreiding is zinvol, maar de waarde komt uit **lokale officiële observaties en onafhankelijke forecastbronnen**, niet uit een zo lang mogelijke providerlijst.

Eerste implementatiekeuze: **Luchtmeetnet voor Nederland**. Dit is de laagste technische risico-uitbreiding met de duidelijkste productwaarde: echte officiële meetwaarden naast de huidige modelmatige luchtkwaliteit, zonder nieuwe API-key en met een eenvoudige fail-safe terugval.

Daarna: **DWD voor Duitsland** (luchtkwaliteit via UBA, neerslag via RADOLAN, pollen via ICON-ART) en vervolgens **MeteoSwiss/FOEN voor Zwitserland**.

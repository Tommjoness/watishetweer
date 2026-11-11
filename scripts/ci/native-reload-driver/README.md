# Native browserreload-driver (xdotool), vastgepind

De releasecontroles sturen een echte `Ctrl+R` naar een zichtbaar Chromium-venster
(`scripts/production-release-recovery-navigation.js`). Daarvoor is `xdotool` nodig, en dat zit niet in de
Playwright-image. Tot 11 november 2026 haalde de job het bij iedere run met `apt-get` op; die dag konden de
GitHub-runners in onze runs geen naam onder `ubuntu.com` meer vinden en bleef de controle rood zonder dat er één
assertion had gedraaid.

Daarom staan de twee benodigde pakketten hier in de repository en installeert de job ze met `dpkg`, zonder
pakketserver.

| Pakket | Versie | Bestand | SHA-256 |
|---|---|---|---|
| `libxdo3` | `1:3.20160805.1-5build1` | `libxdo3_3.20160805.1-5build1_amd64.deb` | `3506c2824a74255439813f824a1629387452d52c6efd6d7916b8b54e458175e8` |
| `xdotool` | `1:3.20160805.1-5build1` | `xdotool_3.20160805.1-5build1_amd64.deb` | `58a202c74bce31ca2d72d4d514942a5ab6191932696adc5d21d909c9216b13cb` |

Herkomst: Ubuntu 24.04 (noble), `universe`, amd64, ongewijzigd uit
`http://archive.ubuntu.com/ubuntu/pool/universe/x/xdotool/`. Het zijn dezelfde twee pakketten, in dezelfde versie, die
`apt-get install --no-install-recommends xdotool` in de image `mcr.microsoft.com/playwright:v1.62.1-noble` installeerde.
Alle overige afhankelijkheden (`libc6`, `libx11-6`, `libxinerama1`, `libxkbcommon0`, `libxtst6`) zitten al in die image.

## Waar dit gebruikt wordt

Dezelfde installatiestap staat in drie workflows:

- `.github/workflows/cloudflare-preview-deploy.yml` (job `preview-release-navigation`);
- `.github/workflows/release-recovery-production.yml` (job `browser-production-contract`);
- `.github/workflows/release-recovery-verification.yml` (job `recovery-build-browser`). Die draait op iedere pull
  request in dezelfde image en voert daarna `scripts/native-reload-driver-browser.js` uit: zichtbare Chromium onder
  Xvfb, native focus, `Ctrl+R` en een reload die de serviceworker levert terwijl de server uit staat.

De stap controleert eerst de SHA-256 van beide bestanden tegen de waarden in de workflow en installeert daarna alleen
die twee bestanden. `scripts/transfer-readiness.test.js` bewaakt dat de drie workflows, deze tabel en de bestanden
gelijk blijven en dat er geen `apt-get` terugkomt.

## Herkomst opnieuw controleren

```bash
sh scripts/ci/native-reload-driver/verifieer-herkomst.sh
```

Het script controleert de handtekening van de Ubuntu-archiefsleutel op `dists/noble/InRelease`, daarna de hash van
de pakketindex en daarna naam, grootte en SHA-256 van beide bestanden. Het installeert niets. Het heeft `gpgv`, `curl`,
`xz` en de sleutelring uit het pakket `ubuntu-keyring` nodig.

## Bijwerken

Nodig wanneer de Playwright-image naar een andere Ubuntu-versie gaat (de tag eindigt nu op `-noble`) of wanneer Ubuntu
een nieuwere versie van `xdotool` uitbrengt die je wilt overnemen.

1. Haal de nieuwe `.deb`-bestanden uit het officiële Ubuntu-archief en vervang de bestanden in deze map.
2. Pas `SUITE` en `VERSIE` in `verifieer-herkomst.sh` aan en draai het script. Neem de hashes die het toont over.
3. Zet de nieuwe bestandsnamen en hashes in de drie workflows, in de tabel hierboven en in
   `scripts/transfer-readiness.test.js`.
4. Open een pull request. `Release recovery verification` bewijst de installatie en de native reload in de echte
   image voordat er iets gemerged wordt.

Let op: `Cloudflare preview deploy` draait altijd met de workflow van `main`. Een pull request die deze map wijzigt,
wordt in de previewcontrole dus nog met de oude hashes gecontroleerd; het bewijs vóór merge komt uit
`Release recovery verification`. Na merge moeten open pull requests eerst met `main` worden bijgewerkt.

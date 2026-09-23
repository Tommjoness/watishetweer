# Werkafspraken voor Claude in deze repository

Deze afspraken zijn vastgelegd door de eigenaar en gelden voor iedere sessie.

## Pull requests: volgen tot mergebaar, nooit zelf mergen zonder akkoord

- Volg iedere pull request die je opent of beheert totdat hij gemerged kan worden: alle checks groen op de laatste commit, geen mergeconflict en geen openstaand reviewcommentaar.
- Faalt er een check, zoek dan de oorzaak, los die op en push een fix. Herhaal dat tot alles groen is. Zet nooit een test uit en sla er ook geen over om groen te worden.
- Verwerk reviewcommentaar of leg uit waarom niet.
- **Vraag altijd eerst toestemming aan de eigenaar voordat je merget.** Merge nooit zelfstandig. Een merge naar `main` zet de wijziging direct live via de Cloudflare-productiedeploy.

## Werkwijze in deze codebase

- Communiceer met de eigenaar in het Nederlands: gedetailleerd, duidelijk, feitelijk en goed gestructureerd.
- Noem tijden altijd in Nederlandse tijd (Europe/Amsterdam: CEST in de zomer, CET in de winter), ook voor CI-runs, deploys en geplande controles. GitHub en de sandbox rapporteren in UTC: reken dat om.
- Lees eerst `README.md` en `docs/overdracht-runbook.md` voor architectuur, deploy en beheer.
- Bewerk nooit handmatig bestanden in `public/`. Die map wordt bij iedere build opnieuw opgebouwd.
- Draai vóór iedere push `npm test` (Node 22). Voor de productie-artifact: `npm run build:cloudflare`.
- Houd oplossingen generiek. Maak geen plaats-specifieke uitzonderingen of screenshotpatches (zie de README).

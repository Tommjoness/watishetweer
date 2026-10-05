# Werkafspraken voor Claude in deze repository

Deze afspraken zijn vastgelegd door de eigenaar en gelden voor iedere sessie.

## Pull requests: volgen tot mergebaar, daarna zelf mergen

- Volg iedere pull request die je opent of beheert totdat hij gemerged kan worden: alle checks groen op de laatste commit, geen mergeconflict en geen openstaand reviewcommentaar.
- Faalt er een check, zoek dan de oorzaak, los die op en push een fix. Herhaal dat tot alles groen is. Zet nooit een test uit en sla er ook geen over om groen te worden.
- Verwerk reviewcommentaar of leg uit waarom niet.
- **Je mag zelfstandig mergen** (eigenaar, 1 oktober 2026). Een merge naar `main` zet de wijziging direct live via de Cloudflare-productiedeploy. Merge daarom alleen als al deze voorwaarden gelden:
  - `npm test` (Node 22) is lokaal groen op de laatste commit;
  - alle checks op GitHub zijn groen op die commit;
  - er is geen mergeconflict en er staat geen reviewcommentaar open;
  - de wijziging doet wat de eigenaar vroeg of goedkeurde, en niet meer.
- **Vraag wél eerst akkoord** bij:
  - een zichtbare ontwerpwijziging of een nieuw onderdeel dat de eigenaar nog niet heeft gezien of goedgekeurd;
  - het verwijderen van functionaliteit;
  - wijzigingen aan geheimen, sleutels, analytics of privacy;
  - wijzigingen aan deze werkafspraken zelf.
- **Na iedere merge:**
  - controleer de productiedeploy en de productiesmokes;
  - meld de eigenaar wat er live is gegaan en hoe de deploy verliep;
  - gaat er iets mis, zet dan direct een herstel klaar (bij voorkeur een revert-PR) en meld het.

## Werkwijze in deze codebase

- Communiceer met de eigenaar in het Nederlands: gedetailleerd, duidelijk, feitelijk en goed gestructureerd.
- Spreek de eigenaar aan met je en jij, niet met u. Houd de toon informeel en niet te formeel (eigenaar, 5 oktober 2026).
- Noem tijden altijd in Nederlandse tijd (Europe/Amsterdam: CEST in de zomer, CET in de winter), ook voor CI-runs, deploys en geplande controles. GitHub en de sandbox rapporteren in UTC: reken dat om.
- Lees eerst `README.md` en `docs/overdracht-runbook.md` voor architectuur, deploy en beheer.
- Bewerk nooit handmatig bestanden in `public/`. Die map wordt bij iedere build opnieuw opgebouwd.
- Draai vóór iedere push `npm test` (Node 22). Voor de productie-artifact: `npm run build:cloudflare`.
- Houd oplossingen generiek. Maak geen plaats-specifieke uitzonderingen of screenshotpatches (zie de README).

## E-mail namens de eigenaar

- Vraag altijd eerst toestemming voordat je een mail verstuurt, verwijdert of doorstuurt. Stel een mail op als concept, zodat de eigenaar hem kan nalezen.
- Onderteken iedere mail met de naam van de eigenaar: Maitri Polwatte Gedera.

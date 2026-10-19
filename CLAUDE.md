# Werkafspraken voor Claude — watishetweer.nl

> **Status:** projectinstructies van de eigenaar voor iedere Claude Code-sessie in deze repository.
> 
> **Voorrang:** deze afspraken gelden naast de systeembeveiliging, platformregels en bestaande projectdocumentatie. Bij tegenstrijdige oudere projectinstructies moet de meest recente, uitdrukkelijk door de eigenaar goedgekeurde afspraak worden gevolgd. Bij twijfel over een bevoegdheid: niet uitvoeren, eerst vragen.

## 1. Opdracht, scope en autonomie

- Werk zo zelfstandig mogelijk **binnen de concrete opdracht**, de beschikbare rechten en de veiligheidsgrenzen. Vraag geen toestemming voor normale analyses, gerichte tests, debugging, toegestane toolaanroepen of logische vervolgstappen.
- Maak eerst onderscheid tussen een **audit/onderzoek** en een **implementatieopdracht**:
  - **Audit (standaard):** read-only voor productcode, projectconfiguratie, externe diensten en productiesystemen. Lezen, onderzoeken en niet-destructieve tests zijn toegestaan. Wijzig niets, behalve tijdelijke testartefacten buiten de repository als die voor onderzoek nodig zijn.
  - **Implementatie (alleen na expliciete opdracht):** bereid de afgesproken, minimale wijzigingen zelfstandig voor op een afzonderlijke werkbranch of worktree. Behoud de bestaande functionaliteit en blijf binnen de goedgekeurde scope.
- Plan en verdeel het werk zelf. Gebruik waar zinvol gespecialiseerde subagents en parallelle read-only onderzoeken. Escaleer ingewikkelde of tegenstrijdige bevindingen gericht; herhaal niet automatisch een hele audit.
- Betrek de eigenaar alleen wanneer een noodzakelijke keuze, aanvullende bevoegdheid, zichtbare ontwerpbeslissing of mergegoedkeuring nodig is.
- Stop na het overeengekomen eindresultaat. Begin geen nieuw project en voeg geen extra verbeteringen toe zonder opdracht.
- Claim geen doorlopende achtergrondactiviteit nadat een sessie of taak werkelijk is beëindigd. Rapporteer de daadwerkelijke status en eventueel resterend werk.

## 2. Pull requests — voorbereiden tot merge-klaar

- Volg iedere pull request die je opent of beheert totdat deze aantoonbaar **merge-klaar** is, of meld expliciet een echte blokkade.
- Controleer vóór een mergeadvies minimaal:
  1. De actuele `main`-SHA, exacte PR-head-SHA en volledige diff ten opzichte van `main`.
  2. `npm test` op Node.js 22: lokaal groen op de definitieve code.
  3. Alle **vereiste** GitHub-checks: groen op **dezelfde actuele PR-head-SHA**.
  4. Geen mergeconflicten en geen onopgeloste reviewcommentaren.
  5. Geen onbedoelde wijzigingen buiten de overeengekomen scope.
  6. Relevante risico's, onzekerheden en testbeperkingen helder vermeld.
- Als `main` intussen verandert en branchbescherming een actuele branch vereist: werk de PR bij, controleer de diff opnieuw en laat de benodigde checks op de **nieuwe** head uitvoeren.
- Behandel een enkele groene rerun niet automatisch als bewijs dat een eerdere fout een timing-flake was. Maak onderscheid tussen regressies, omgevingsproblemen, externe providerstoringen en testflakiness. Documenteer onbewezen oorzaken.
- Verwerk reviewcommentaren of motiveer duidelijk waarom niet.
- Zet nooit tests uit, verzwak geen assertions of kwaliteitsgates en sla geen vereiste check over om een groene status te krijgen.

### 2.1 Mergebevoegdheid — altijd expliciet akkoord

**Claude mag nooit zelfstandig een PR mergen naar `main`, ook niet als alle checks groen zijn.**

- Vraag **voor iedere specifieke PR** uitdrukkelijk akkoord van de eigenaar om te mergen.
- Goedkeuring om een wijziging te onderzoeken, te maken, te pushen of een PR te openen is **geen** mergegoedkeuring.
- Een eerdere of algemene mergebevoegdheid vervalt voor deze werkwijze. Specifieke akkoordverklaringen mogen niet op andere PR's of gewijzigde head-SHA's worden toegepast.
- Controleer **vlak vóór** een goedgekeurde merge opnieuw: actuele `main`-SHA, exact goedgekeurde head-SHA, mergeability, openstaande reviews en alle vereiste checks.
- Als de goedgekeurde head-SHA is veranderd, vraag dan opnieuw expliciet akkoord na herbeoordeling.
- Gebruik de overeengekomen mergemethode (in beginsel squash) en rapporteer de uiteindelijke commit-SHA.
- Een merge naar `main` triggert automatisch de Cloudflare-productiedeploy. Dit maakt expliciete mergegoedkeuring extra belangrijk.
- Start geen losse productie-deployment, rollback of andere productiewijziging zonder afzonderlijke expliciete opdracht.

### 2.2 Na een goedgekeurde merge

- Controleer de daadwerkelijk gepubliceerde build-SHA op de live website en vergelijk deze met de mergecommit op `main`.
- Controleer de Cloudflare-productiedeploy, release recovery smoke, production smoke en overige voorgeschreven releasecontroles.
- Maak onderscheid tussen **gemerged**, **live** en **volledig geverifieerd**. Claim pas een geslaagde release wanneer het bewijs daarvoor aanwezig is.
- Meld de eigenaar welke wijzigingen live staan, welke controles slaagden, en welke beperkingen of openstaande checks er nog zijn.
- Bij een probleem: onderzoek gericht, bereid zo nodig een minimale fix of revert-PR voor en meld de impact. Voer geen nieuwe merge, rollback of destructieve herstelactie uit zonder afzonderlijk akkoord.

## 3. Testen, debugging en CI-efficiëntie

- Gebruik **Node.js 22** voor de lokale volledige testprocedure, tenzij de eigenaar expliciet een andere testomgeving opdraagt.
- Draai vóór iedere push de vereiste `npm test` op de definitieve code. Bouw waar nodig de productie-artifact met `npm run build:cloudflare`.
- **Diagnose vóór herhaling:** onderzoek bij een mislukking eerst de exacte test, foutmelding, logregels, omgeving en relevante wijzigingen.
- Gebruik gerichte tests en diagnostiek om een vermoedelijke oorzaak te toetsen. Herhaal de volledige lange testketen niet blind en start geen extra volledige run zolang een andere run nog loopt.
- Een herhaling of nieuwe volledige run is alleen zinvol als er een concrete reden is, bijvoorbeeld aangepaste code, een verholpen omgevingsfout of een noodzakelijke releasegate.
- Bij externe netwerk- of providerproblemen: bepaal of het probleem extern of een eigen regressie is. Herhaal alleen relevante controles waar dat verantwoord is.
- Laat langdurige tests, builds en CI-jobs waar ondersteund op de achtergrond draaien. Controleer de voortgang op redelijke momenten, niet via onnodig frequente polling of dubbele wachttaken.
- Weiger geen noodzakelijke controles vanwege hun duur: **juistheid en de bestaande kwaliteitsgates blijven leidend**.
- Geef bij lange of vastgelopen tests een korte feitelijke status: actief proces, laatst voltooide stap, vermoedelijke oorzaak indien onderbouwd, en volgende actie.

## 4. Werkwijze in de codebase

- Lees bij het begin van relevant repositorywerk eerst `README.md`, `docs/overdracht-runbook.md` en deze `CLAUDE.md` voor architectuur, productie, tests en beheer. Controleer of hun informatie actueel is.
- Bewerk nooit handmatig bestanden in `public/`. Die map is gegenereerde buildoutput en wordt opnieuw opgebouwd.
- Houd oplossingen generiek: geen plaats-specifieke uitzonderingen, screenshotpatches of hardcoded workarounds voor één testcase zonder technisch aantoonbare noodzaak.
- Geef de voorkeur aan de kleinste veilige wijziging. Vermijd ongevraagde refactors, functionele uitbreiding en vormgevingswijzigingen.
- Behoud bestaande weergave, weergegevens, toegankelijkheid, prestaties, SEO, Nederlandse/Engelse ondersteuning en caching tenzij een wijziging expliciet nodig is.
- Werk zorgvuldig met configuratie, afhankelijkheden en lockfiles. Controleer bij een dependencywijziging dat declaraties, lockfile en vastgepinde tests consistent blijven.
- Wijzig deze werkafspraken niet zelfstandig. Maak desgevraagd een voorstel of concept ter goedkeuring.

## 5. Bevoegdheden, privacy en beveiliging

Vraag altijd vooraf afzonderlijk toestemming voor:

- Een **merge** naar `main` of een afzonderlijke productie-deployment.
- Nieuwe of zichtbare ontwerpwijzigingen en onderdelen die nog niet door de eigenaar zijn goedgekeurd.
- Het verwijderen van functionaliteit of destructieve handelingen, waaronder verwijderen van branches, gegevens of configuratie.
- Wijzigingen aan geheimen, API-sleutels, analytics, tracking, toestemming of privacy-instellingen.
- Wijzigingen aan deze `CLAUDE.md` of aan de bevoegdheidsregels.
- Het extern publiceren, delen of verzenden van projectgegevens, interne logs of andere informatie buiten wat de opdracht en bevoegdheden toestaan.

Aanvullend:

- Gebruik de kleinste noodzakelijke, projectgebonden toolrechten. Gebruik geen `bypassPermissions` en schakel geen beveiligingscontroles uit.
- Publiceer nooit geheimen, tokens of API-sleutels in code, screenshots, logs, rapporten of berichten.
- Gebruik geen onbeveiligde publieke dashboards voor interne agent- of repositorylogs.
- Als een actie niet kan zonder hogere rechten: rapporteer de blokkade en werk waar mogelijk aan de overige onderdelen door.

## 6. Communicatie en rapportage

- Communiceer met de eigenaar in **het Nederlands**, helder, informeel, feitelijk en goed gestructureerd. Spreek de eigenaar aan met **je/jij**, niet met **u**.
- Noem tijden in **Nederlandse tijd** (`Europe/Amsterdam`: CEST in de zomer, CET in de winter). Reken UTC-tijden uit GitHub, Cloudflare of de sandbox correct om en vermeld het tijdstip wanneer dat relevant is.
- Maak in conclusies onderscheid tussen **bewezen**, **waarschijnlijk**, **onzeker** en **niet gecontroleerd**. Verzin geen resultaten of voortgang.
- Gebruik concrete URL's, relevante testnamen, commits en SHA's als bewijs. Controleer de actuele status voordat je iets als afgerond bestempelt.
- Rapportage van een PR bevat minimaal: scope en diff, exacte head-SHA, relevante lokale tests, GitHub-checks, resterende risico's en een helder mergeadvies. Vraag dan om mergeakkoord.
- Rapportage na een release bevat minimaal: nieuwe `main`-SHA, live build-SHA, deployuitkomst, resultaten van de verplichte smokes en openstaande beperkingen.
- Stel niet steeds dezelfde vragen als de instructies en eerdere antwoorden al voldoende duidelijk zijn.

## 7. Context- en sessie-efficiëntie

- Gebruik gerichte zoekacties en beperkte tooluitvoer waar mogelijk. Schrijf lange testuitvoer naar een tijdelijke locatie **buiten de repository** en citeer in de samenvatting de relevante regels.
- Lees bestanden niet onnodig opnieuw als ze in de sessie al zijn gelezen en sindsdien niet gewijzigd kunnen zijn.
- Bij volledige audits, code-review en kritieke diagnoses gaat grondigheid vóór besparing: lees alle relevante bronbestanden en bewijsstukken.
- Gebruik beschikbare checkpoints, takenoverzichten en samenvattingen voor lange workflows, maar verifieer na onderbrekingen de actuele repository- en taakstatus opnieuw.
- Vermijd parallel werk dat dezelfde bestanden of branches zonder coördinatie wijzigt.

## 8. E-mail namens de eigenaar

- Vraag **altijd vooraf toestemming** voordat je een e-mail verzendt, verwijdert, doorstuurt of een bestaande verzonden mail wijzigt.
- Maak eerst een concept dat de eigenaar kan beoordelen.
- Onderteken mails namens de eigenaar met: **Maitri Polwatte Gedera**.

## 9. Belangrijkste beslisregel

**Zo autonoom mogelijk bij onderzoeken, uitvoering en verificatie; altijd afzonderlijk expliciet toestemming vragen voordat een PR wordt gemerged of productie anderszins wordt gewijzigd.**

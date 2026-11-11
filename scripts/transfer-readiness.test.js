"use strict";

const assert=require("assert");
const fs=require("fs");
const path=require("path");

const root=path.join(__dirname,"..");
const lees=bestand=>fs.readFileSync(path.join(root,bestand),"utf8");
const readme=lees("README.md");
const runbook=lees("docs/overdracht-runbook.md");
const audit=lees("docs/sale-readiness-audit-2026-08-31.md");
/* SEC-02: de previewdeploy staat in de vertrouwde workflow_run-workflow; cloudflare-preview.yml is de secretloze PR-build. */
const preview=lees(".github/workflows/cloudflare-preview-deploy.yml");
const analyticsWorkflow=lees(".github/workflows/cloudflare-web-analytics.yml");
const production=lees(".github/workflows/cloudflare-production.yml");
const packageJson=JSON.parse(lees("package.json"));

/* node_modules hoort nooit in git, ook niet als symbolische link: "node_modules/"
   in .gitignore negeert alleen mappen, waardoor een link ooit wél meeging. */
assert(lees(".gitignore").split(/\r?\n/).includes("node_modules"),".gitignore moet node_modules zonder schuine streep negeren (map én link)");
{
  const r=require("child_process").spawnSync("git",["ls-files","--","node_modules"],{cwd:root,encoding:"utf8"});
  if(r.status===0)assert.equal(r.stdout.trim(),"","node_modules staat in git");
}

assert(readme.includes("docs/overdracht-runbook.md"),"README moet naar het overdrachtsrunbook verwijzen");
for(const onderdeel of [
  "## Product en eigendom",
  "## Architectuur",
  "## Databronnen en afhankelijkheden",
  "## Configuratie en secrets",
  "## Ontwikkelen, testen en deployen",
  "## Monitoring en alarmen",
  "## Kosten en limieten",
  "## Incident en herstel",
  "## Hoe wijzig ik X?",
  "## Overdrachtschecklist"
])assert(runbook.includes(onderdeel),`overdrachtsrunbook mist ${onderdeel}`);

for(const naam of ["CLOUDFLARE_API_TOKEN","CLOUDFLARE_ACCOUNT_ID","WEATHERAPI_KEY","VISUAL_CROSSING_API_KEY","KNMI_WMS_API_KEY","METEOALARM_API_TOKEN","NOMINATIM_BASE_URL"]){
  assert(runbook.includes(`\`${naam}\``),`overdrachtsrunbook mist configuratienaam ${naam}`);
}
assert(!/Authorization:\s*Bearer\s+[^<\s`]+/i.test(runbook),"overdrachtsrunbook mag geen Bearer-token bevatten");
assert(audit.includes("98 | 100 | 100 | 100 | 2/2"),"auditrapport mist de vastgelegde mobiele PageSpeed-score");
assert(audit.includes("100 | 100 | 100 | 100 | 2/2"),"auditrapport mist de vastgelegde desktop PageSpeed-score");

assert(!preview.includes("migrate/cloudflare-pages-20260826"),"previewworkflow mag niet meer aan de oude migratiebranch vastzitten");
assert(!preview.includes("pr-164"),"previewworkflow mag geen oude PR-preview hardcoden");
assert(preview.includes("CLOUDFLARE_PREVIEW_BRANCH: pr-${{ github.event.workflow_run.pull_requests[0].number }}"),"previewworkflow moet per PR een eigen branch gebruiken, afgeleid van de GitHub-gebeurtenis");
assert(preview.includes("cancel-in-progress: true"),"verouderde previewruns moeten worden geannuleerd");
assert(preview.includes("node scripts/run-production-worldwide-browser.js"),"preview moet de wereldwijde browsercontrole via de gecontroleerde retry-runner behouden");
assert(preview.includes("node scripts/weatherapi-live-fallback-browser.js"),"preview moet de echte WeatherAPI-fallback met geblokkeerde Open-Meteo bewijzen");

/* Analytics is een aparte, idempotente accountmutatie. De normale productieflow
   mag die instelling niet bij iedere deploy terug uitzetten of opnieuw schrijven. */
assert(runbook.includes(".github/workflows/cloudflare-web-analytics.yml"),"runbook mist de aparte Web Analytics-workflow");
assert(runbook.includes("scripts/cloudflare-web-analytics-setup.js"),"runbook mist het idempotente Web Analytics-setupscript");
assert(runbook.includes("Account Settings Read/Write"),"runbook mist de minimale aanvullende Cloudflare analyticsrechten");
/* Commerciële doelen en onderhandelingsinformatie horen niet in de publieke repository. */
assert(!fs.existsSync(path.join(root,"docs","commerciele-baseline-2026-08-31.md")),"commerciële baseline hoort niet in de publieke repository");
assert(!runbook.includes("commerciele-baseline"),"runbook mag niet naar een commerciële baseline in de repository verwijzen");
assert(analyticsWorkflow.includes("node scripts/cloudflare-web-analytics-setup.js"),"analyticsworkflow voert setupscript niet uit");
assert(analyticsWorkflow.includes("Wacht tot dezelfde SHA publiek live staat"),"analyticsworkflow mag accountconfig niet voor de bijbehorende productie activeren");
assert(!production.includes("cloudflare-disable-web-analytics.js"),"productiedeploy mag Web Analytics niet meer terug uitzetten");
assert(!production.includes("cloudflare-disable-rum.js"),"productiedeploy mag geen algemene RUM-blokkade meer instellen");
assert(packageJson.scripts["test:prebuild"].includes("cloudflare-web-analytics-setup.test.js"),"prebuild mist analytics-setupregressietest");
assert(packageJson.scripts.postbuild.includes("apply-cloudflare-web-analytics-csp.js"),"postbuild mist analytics-CSP-artifactstap");

/* Native browserreload-driver: xdotool komt uit twee vastgepinde, officiële Ubuntu-pakketten in de repository en
   niet meer van een pakketserver tijdens de job (11 november 2026: ubuntu.com was vanaf de runners niet vindbaar).
   De drie workflows hebben exact dezelfde stap; hashes, bestanden en README moeten gelijk blijven. */
{
  const crypto=require("crypto");
  const driverMap="scripts/ci/native-reload-driver";
  const pakketten=[
    {bestand:"libxdo3_3.20160805.1-5build1_amd64.deb",sha256:"3506c2824a74255439813f824a1629387452d52c6efd6d7916b8b54e458175e8",bytes:22202},
    {bestand:"xdotool_3.20160805.1-5build1_amd64.deb",sha256:"58a202c74bce31ca2d72d4d514942a5ab6191932696adc5d21d909c9216b13cb",bytes:42556}
  ];
  const debs=fs.readdirSync(path.join(root,driverMap)).filter(naam=>naam.endsWith(".deb")).sort();
  assert.deepEqual(debs,pakketten.map(p=>p.bestand).sort(),"de drivermap mag alleen de twee vastgepinde pakketten bevatten");
  const driverReadme=lees(driverMap+"/README.md");
  for(const p of pakketten){
    const inhoud=fs.readFileSync(path.join(root,driverMap,p.bestand));
    assert.equal(inhoud.length,p.bytes,`${p.bestand}: grootte wijkt af van het officiële pakket`);
    assert.equal(inhoud.subarray(0,8).toString("latin1"),"!<arch>\n",`${p.bestand}: geen Debian-pakket`);
    assert.equal(crypto.createHash("sha256").update(inhoud).digest("hex"),p.sha256,`${p.bestand}: SHA-256 wijkt af van het vastgepinde officiële pakket`);
    assert(driverReadme.includes(p.bestand)&&driverReadme.includes(p.sha256),`README van de driver mist ${p.bestand} of de hash`);
  }
  assert(lees(driverMap+"/verifieer-herkomst.sh").includes("ubuntu-archive-keyring.gpg"),"de herkomstcontrole moet de handtekening van de Ubuntu-archiefsleutel controleren");

  const stapNaam="Installeer native browserreload-driver (vastgepind, zonder pakketserver)";
  const installatiestap=(tekst,naam)=>{
    const regels=tekst.split(/\r?\n/),start=regels.findIndex(regel=>regel.trim()==="- name: "+stapNaam);
    assert(start>=0,`${naam}: mist de vastgepinde installatiestap`);
    assert.equal(regels.filter(regel=>regel.trim()==="- name: "+stapNaam).length,1,`${naam}: de installatiestap mag er precies één keer staan`);
    const inspring=regels[start].indexOf("- ");
    let einde=start+1;
    while(einde<regels.length&&(regels[einde].trim()===""||regels[einde].search(/\S/)>inspring))einde++;
    return {start,blok:regels.slice(start,einde).map(regel=>regel.trimEnd()).filter(Boolean).join("\n"),regels};
  };
  const workflows={
    "cloudflare-preview-deploy.yml":preview,
    "release-recovery-production.yml":lees(".github/workflows/release-recovery-production.yml"),
    "release-recovery-verification.yml":lees(".github/workflows/release-recovery-verification.yml")
  };
  const blokken=Object.entries(workflows).map(([naam,tekst])=>({naam,tekst,...installatiestap(tekst,naam)}));
  for(const {naam,tekst,blok,start,regels} of blokken){
    assert.equal(blok,blokken[0].blok,`${naam}: de installatiestap wijkt af van ${blokken[0].naam}`);
    const uitvoerend=blok.split("\n").filter(regel=>!regel.trim().startsWith("#"));
    assert(uitvoerend.some(regel=>regel.trim()==="working-directory: "+driverMap),`${naam}: de stap moet in ${driverMap} draaien`);
    assert(uitvoerend.some(regel=>regel.trim()==="set -eu"),`${naam}: de stap moet bij de eerste fout stoppen`);
    const controle=uitvoerend.findIndex(regel=>regel.trim()==="sha256sum --check --strict - <<'SHA256'");
    const installatie=uitvoerend.findIndex(regel=>regel.trim()==="dpkg --install "+pakketten.map(p=>p.bestand).join(" "));
    assert(controle>=0&&installatie>controle,`${naam}: eerst verplichte SHA-256-controle, daarna dpkg met precies de twee vastgepinde bestanden`);
    for(const p of pakketten)assert(uitvoerend.slice(controle,installatie).some(regel=>regel.trim()===`${p.sha256}  ${p.bestand}`),`${naam}: hashregel voor ${p.bestand} ontbreekt of wijkt af`);
    assert(!/\b(apt|apt-get|curl|wget|snap|pip|npm)\b|https?:/.test(uitvoerend.join("\n")),`${naam}: de installatiestap mag niets van het netwerk halen`);
    assert(!tekst.split(/\r?\n/).some(regel=>!regel.trim().startsWith("#")&&/\bapt(-get)?\s+(update|install)\b/.test(regel)),`${naam}: geen pakketserver meer tijdens de job`);
    assert(/image: mcr\.microsoft\.com\/playwright:v[0-9.]+-noble\b/.test(tekst)&&!/image: mcr\.microsoft\.com\/playwright:(?!v[0-9.]+-noble\b)/.test(tekst),`${naam}: de pakketten horen bij Ubuntu 24.04 (noble); bij een andere image eerst ${driverMap}/README.md volgen`);
    /* De driver staat er vóór de controle die hem gebruikt, en die controle blijft de echte, zichtbare browser met native reload. */
    const gebruik=naam==="release-recovery-verification.yml"
      ?"xvfb-run --auto-servernum node scripts/native-reload-driver-browser.js"
      :"xvfb-run --auto-servernum node scripts/production-release-recovery-navigation.js";
    const gebruikRegel=regels.findIndex(regel=>regel.trim()==="run: "+gebruik);
    assert(gebruikRegel>start,`${naam}: ${gebruik} moet na de installatiestap draaien`);
    if(naam!=="release-recovery-verification.yml"){
      const omgeving=regels.slice(start,gebruikRegel).join("\n");
      assert(omgeving.includes('HEADLESS: "false"')&&omgeving.includes('NATIVE_BROWSER_RELOAD: "true"'),`${naam}: de releasenavigatie moet zichtbaar en met native browserreload blijven draaien`);
    }
  }
  const navigatie=lees("scripts/production-release-recovery-navigation.js");
  for(const fragment of ['["windowfocus","--sync",venster]','["key","--clearmodifiers","ctrl+r"]','Chromium kreeg geen native focus','hoofdStart.navigationType!=="reload"','documentResponse.response.fromServiceWorker','deployed offline-reloadbewijs vereist zichtbare Chromium + native browserreload']){
    assert(navigatie.includes(fragment),`releasenavigatie mist bestaande native reload- of CDP-controle: ${fragment}`);
  }
  assert(runbook.includes(driverMap+"/README.md"),"runbook mist de onderhoudsinstructie van de native browserreload-driver");
}


console.log("Transfer-readiness: runbook, auditbewijs, geen commerciële baseline in de publieke repo, generieke Cloudflare-preview, vastgepinde native browserreload-driver en fail-safe Web Analytics-setup zijn geborgd.");

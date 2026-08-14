"use strict";

const path=require("path");
const {spawnSync}=require("child_process");

/*
 * Eén eigenaar van de definitieve artifactvolgorde.
 *
 * De onderliggende scripts blijven bewust onaangeraakt: deze refactor verandert
 * geen HTML/CSS/runtime-uitvoer, maar voorkomt dat package.json en losse
 * commando's ieder een eigen kopie van de volgorde onderhouden. De verifiers
 * blijven direct na de laag staan die zij bewaken; de finale verifier blijft
 * altijd als laatste stap draaien.
 */
const POSTBUILD_STAPPEN=Object.freeze([
  "apply-mobile-screenshot-polish.js",
  "verify-mobile-screenshot-build.js",
  "apply-performance-final.js",
  "apply-q3-senior-polish.js",
  "verify-q3-build.js",
  "apply-q4-rain-periods.js",
  "verify-q4-rain-periods.js",
  "verify-performance-final.js",
  "apply-ui-shell.js",
  "verify-ui-shell.js",
  "apply-pollen-hour-correctness.js",
  "verify-pollen-hour-correctness.js",
  "apply-cache-fallback-country.js",
  "verify-cache-fallback-country.js",
  "apply-ui-polish-20260813.js",
  "apply-weather-fallback-hedge.js",
  "verify-weather-fallback-hedge.js",
  "apply-fetch-error-semantics.js",
  "verify-fetch-error-semantics.js",
  "apply-polar-chart-sentinel.js",
  "verify-polar-chart-sentinel.js",
  "verify-final-27.js"
]);

function voerPostbuildUit(opt={}){
  const uitvoerder=typeof opt.spawnSync=="function"?opt.spawnSync:spawnSync;
  const node=opt.execPath||process.execPath;
  const scriptsMap=opt.scriptsDir||__dirname;

  for(const stap of POSTBUILD_STAPPEN){
    const absoluut=path.join(scriptsMap,stap);
    const resultaat=uitvoerder(node,[absoluut],{stdio:"inherit"});
    if(resultaat&&resultaat.error)throw resultaat.error;
    const status=resultaat&&Number.isInteger(resultaat.status)?resultaat.status:1;
    if(status!==0){
      const fout=new Error("Postbuild gestopt bij "+stap+" (exit "+status+")");
      fout.status=status;
      fout.stap=stap;
      throw fout;
    }
  }
}

if(require.main===module){
  try{voerPostbuildUit();}
  catch(e){console.error(e&&e.stack||e);process.exit(typeof e.status=="number"?e.status:1);}
}

module.exports={POSTBUILD_STAPPEN,voerPostbuildUit};

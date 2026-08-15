"use strict";

const fs=require("fs");
const os=require("os");
const path=require("path");
const {spawnSync}=require("child_process");

/*
 * prelaunch-regressions.test.js bevat bewust een cachehash-regressie die
 * build-weather.js met een tijdelijk gewijzigd manifest uitvoert. build-weather
 * maakt public/ opnieuw aan. Dat experiment mag nooit het artifact wijzigen dat
 * latere built-/browserregressies controleren.
 *
 * Bewaar daarom zowel manifest.json als de volledige bestaande public/-boom en
 * herstel ze in finally, ook wanneer de regressietest faalt of wordt afgebroken.
 */
const ROOT=path.join(__dirname,"..");
const PUBLIC=path.join(ROOT,"public");
const MANIFEST=path.join(ROOT,"manifest.json");
const TEST=path.join(ROOT,"prelaunch-regressions.test.js");
const tijdelijk=fs.mkdtempSync(path.join(os.tmpdir(),"watishetweer-prelaunch-"));
const publicBackup=path.join(tijdelijk,"public");
const hadPublic=fs.existsSync(PUBLIC);
const manifestOrigineel=fs.readFileSync(MANIFEST);

if(hadPublic)fs.cpSync(PUBLIC,publicBackup,{recursive:true});

let status=1,fout=null;
try{
  const resultaat=spawnSync(process.execPath,[TEST],{cwd:ROOT,stdio:"inherit",env:process.env});
  if(resultaat.error)fout=resultaat.error;
  status=Number.isInteger(resultaat.status)?resultaat.status:1;
}finally{
  /* Herstel eerst de broninvoer en daarna het complete gebouwde artifact. */
  fs.writeFileSync(MANIFEST,manifestOrigineel);
  fs.rmSync(PUBLIC,{recursive:true,force:true});
  if(hadPublic)fs.cpSync(publicBackup,PUBLIC,{recursive:true});
  fs.rmSync(tijdelijk,{recursive:true,force:true});
}

if(fout)throw fout;
process.exit(status);

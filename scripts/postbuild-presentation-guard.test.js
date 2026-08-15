"use strict";

const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const {POSTBUILD_STAPPEN,PRESENTATIE_MARKER,voerPostbuildUit}=require("./postbuild-pipeline.js");

const tijdelijk=fs.mkdtempSync(path.join(os.tmpdir(),"watishetweer-postbuild-guard-"));
const artifact=path.join(tijdelijk,"index.html");

try{
  fs.writeFileSync(artifact,"voor\n"+PRESENTATIE_MARKER+"\nna\n","utf8");
  const gezien=[];
  assert.throws(
    ()=>voerPostbuildUit({
      execPath:"node-test",
      scriptsDir:"/scripts-test",
      artifactPath:artifact,
      spawnSync:(node,args)=>{
        const naam=path.basename(args[0]);
        gezien.push(naam);
        if(naam==="apply-q3-senior-polish.js")fs.writeFileSync(artifact,"marker verwijderd\n","utf8");
        return {status:0};
      }
    }),
    e=>e&&e.stap==="apply-q3-senior-polish.js"&&/verwijderde neerslagpresentatie/.test(e.message),
    "postbuild moet direct stoppen bij de eerste stap die de presentatie uit het artifact verwijdert"
  );
  assert.deepStrictEqual(gezien,POSTBUILD_STAPPEN.slice(0,4),"geen latere postbuildstap mag na markerverlies draaien");

  fs.writeFileSync(artifact,"voor\n"+PRESENTATIE_MARKER+"\nna\n","utf8");
  let aantal=0;
  voerPostbuildUit({
    execPath:"node-test",
    scriptsDir:"/scripts-test",
    artifactPath:artifact,
    spawnSync:()=>{aantal++;return {status:0};}
  });
  assert.equal(aantal,POSTBUILD_STAPPEN.length,"intacte presentatie laat de volledige postbuildketen doorlopen");
  assert(fs.readFileSync(artifact,"utf8").includes(PRESENTATIE_MARKER));

  console.log("Postbuild presentatieguard: markerverlies faalt direct en intact artifact doorloopt de volledige keten.");
}finally{
  fs.rmSync(tijdelijk,{recursive:true,force:true});
}

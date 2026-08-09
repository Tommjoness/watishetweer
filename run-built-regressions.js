"use strict";

/* Draait doelgerichte regressies tegen exact public/index.html. kern.js leest
   normaal de bron-index, dus die wordt alleen voor de duur van deze subprocess-
   test vervangen en daarna altijd byte-voor-byte teruggezet. */
const fs=require("fs");
const path=require("path");
const {spawnSync}=require("child_process");

const bron=path.join(__dirname,"index.html");
const gebouwd=path.join(__dirname,"public","index.html");
if(!fs.existsSync(gebouwd)){
  console.error("Gebouwde WeatherNow-index ontbreekt; voer de build eerst uit.");
  process.exit(1);
}

const origineel=fs.readFileSync(bron);
let status=1;
try{
  fs.copyFileSync(gebouwd,bron);
  const r=spawnSync(process.execPath,[path.join(__dirname,"built-production-regressions.test.js")],{
    cwd:__dirname,stdio:"inherit",env:process.env
  });
  status=typeof r.status==="number"?r.status:1;
  if(r.error) console.error(r.error.message);
}finally{
  fs.writeFileSync(bron,origineel);
}
process.exit(status);

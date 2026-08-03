"use strict";

/*
 * De productiebundel wordt door build-weather.js in public/index.html gemaakt.
 * kern.js leest normaal de bron-index. Voor deze ene test draaien we daarom
 * tijdelijk exact de gebouwde productiecode in dezelfde nagebootste browser en
 * zetten we het bronbestand altijd terug, ook wanneer een controle mislukt.
 */
const fs=require("fs");
const path=require("path");
const {spawnSync}=require("child_process");

const bron=path.join(__dirname,"index.html");
const gebouwd=path.join(__dirname,"public","index.html");
if(!fs.existsSync(gebouwd)){
  console.error("Gebouwde WeatherNow-index ontbreekt; voer build-weather.js eerst uit.");
  process.exit(1);
}

const origineel=fs.readFileSync(bron);
let status=1;
try{
  fs.copyFileSync(gebouwd,bron);
  const r=spawnSync(process.execPath,[path.join(__dirname,"global-scenario-matrix-v2.test.js")],{
    cwd:__dirname,stdio:"inherit",env:process.env
  });
  status=typeof r.status==="number"?r.status:1;
  if(r.error) console.error(r.error.message);
}finally{
  fs.writeFileSync(bron,origineel);
}
process.exit(status);

"use strict";

const fs=require("fs");
const path=require("path");
const html=fs.readFileSync(path.join(__dirname,"..","public","index.html"),"utf8");

const oud="S.land=normLand(oud.land)||S.land;";
const nieuw="S.land=normLand(oud.land);";
if(html.includes(oud))throw new Error("Oude cachefallback kan nog stale landcode van mislukte locatie behouden.");
const aantal=html.split(nieuw).length-1;
if(aantal!==1)throw new Error("Gecorrigeerde cachefallback-landregel ontbreekt of is dubbel: "+aantal);

const BEGIN="/* ===== GEDEELDE URL PLAATSIDENTITEIT ===== */";
const EINDE="/* ===== EINDE GEDEELDE URL PLAATSIDENTITEIT ===== */";
if(html.split(BEGIN).length-1!==1||html.split(EINDE).length-1!==1)throw new Error("Gedeelde plaatsidentiteitslaag ontbreekt of is dubbel.");
const iGlobal=html.indexOf("/* ===== WERELDWIJDE LOCATIEHARDENING ===== */");
const iPlaats=html.indexOf(BEGIN),iStart=html.indexOf("/* ---------- start ---------- */");
if(!(iGlobal>=0&&iGlobal<iPlaats&&iPlaats<iStart))throw new Error("Gedeelde plaatsidentiteit moet na globale hardening en vóór startup draaien.");
for(const contract of ["WeatherNowSharedUrlPlaceIdentity","/api/plaatsnaam?lat=","Gedeelde locatie","timeoutMs:2500"]){
  if(!html.includes(contract))throw new Error("Gedeelde plaatsidentiteitscontract ontbreekt: "+contract);
}
console.log("Locatie-identiteitsartifact geverifieerd: cachefallback-land faalt gesloten en gedeelde plaatsnaam komt vóór startup uit gevalideerde coördinaten.");

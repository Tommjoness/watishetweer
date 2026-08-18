"use strict";

const fs=require("fs");
const path=require("path");
const PRODUCT_CONFIG=require("../product-config.js");
const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"public","index.html"),"utf8");
const bronHtml=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
const build=fs.readFileSync(path.join(ROOT,"build-weather.js"),"utf8");
const lateApply=fs.readFileSync(path.join(__dirname,"apply-cache-fallback-country.js"),"utf8");

const oud=PRODUCT_CONFIG.CACHE_FALLBACK_LAND_BRON;
const nieuw=PRODUCT_CONFIG.CACHE_FALLBACK_LAND_PRODUCTIE;
if(oud!=="S.land=normLand(oud.land)||S.land;"||nieuw!=="S.land=normLand(oud.land);")throw new Error("Cachefallback-landcontract in product-config is onverwacht gewijzigd.");
if(bronHtml.split(oud).length-1!==1||bronHtml.includes(nieuw))throw new Error("Ontwikkeltemplate bevat niet exact het verwachte cachefallback-broncontract.");
if(!build.includes("PRODUCT_CONFIG.CACHE_FALLBACK_LAND_BRON")||!build.includes("PRODUCT_CONFIG.CACHE_FALLBACK_LAND_PRODUCTIE"))throw new Error("Base-build bezit de cachefallback-landtransformatie niet aantoonbaar.");
if(lateApply.includes(oud)||lateApply.includes(nieuw))throw new Error("Late postbuildlaag bevat nog cachefallback-landsemantiek.");
if(html.includes(oud))throw new Error("Oude cachefallback kan in productie nog stale landcode van mislukte locatie behouden.");
const aantal=html.split(nieuw).length-1;
if(aantal!==1)throw new Error("Base-build cachefallback-landregel ontbreekt of is dubbel: "+aantal);

const BEGIN="/* ===== GEDEELDE URL PLAATSIDENTITEIT ===== */";
const EINDE="/* ===== EINDE GEDEELDE URL PLAATSIDENTITEIT ===== */";
if(html.split(BEGIN).length-1!==1||html.split(EINDE).length-1!==1)throw new Error("Gedeelde plaatsidentiteitslaag ontbreekt of is dubbel.");
const iGlobal=html.indexOf("/* ===== WERELDWIJDE LOCATIEHARDENING ===== */");
const iPlaats=html.indexOf(BEGIN),iStart=html.indexOf("/* ---------- start ---------- */");
if(!(iGlobal>=0&&iGlobal<iPlaats&&iPlaats<iStart))throw new Error("Gedeelde plaatsidentiteit moet na globale hardening en vóór startup draaien.");
for(const contract of ["WeatherNowSharedUrlPlaceIdentity","/api/plaatsnaam?lat=","Gedeelde locatie","timeoutMs:2500"]){
  if(!html.includes(contract))throw new Error("Gedeelde plaatsidentiteitscontract ontbreekt: "+contract);
}
console.log("Locatie-identiteitsartifact geverifieerd: cachefallback-land komt uitsluitend uit product-config/base-build en gedeelde plaatsnaam blijft vóór startup uit gevalideerde coördinaten komen.");

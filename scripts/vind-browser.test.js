"use strict";

const assert=require("assert");
const fs=require("fs");
const os=require("os");
const path=require("path");
const {vindBrowser}=require("./vind-browser.js");

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"wiw-vind-browser-"));
try{
  const leeg=path.join(tmp,"leeg");
  const eerste=path.join(tmp,"eerste");
  const tweede=path.join(tmp,"tweede");
  for(const map of [leeg,eerste,tweede])fs.mkdirSync(map);
  const maak=(map,naam,uitvoerbaar=true)=>{
    const p=path.join(map,naam);
    fs.writeFileSync(p,"#!/bin/sh\n");
    fs.chmodSync(p,uitvoerbaar?0o755:0o644);
    return p;
  };

  assert.equal(vindBrowser({PATH:leeg}),null,"zonder browser geen resultaat");
  assert.equal(vindBrowser({CHROME_PATH:"/expliciet/chrome",PATH:leeg}),"/expliciet/chrome","CHROME_PATH wint altijd");
  assert.equal(vindBrowser({CHROMIUM_PATH:"/expliciet/chromium",PATH:leeg}),"/expliciet/chromium","CHROMIUM_PATH is de tweede expliciete bron");

  maak(eerste,"chromium",false);
  assert.equal(vindBrowser({PATH:[leeg,eerste].join(path.delimiter)}),null,"niet-uitvoerbaar bestand telt niet");

  const chromium=maak(tweede,"chromium");
  assert.equal(vindBrowser({PATH:[eerste,tweede].join(path.delimiter)}),chromium,"PATH wordt zonder shell doorzocht");

  const chrome=maak(tweede,"google-chrome");
  assert.equal(vindBrowser({PATH:[eerste,tweede].join(path.delimiter)}),chrome,"google-chrome gaat voor chromium, net als de oude detectie");
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}

console.log("Browserdetectie: expliciete paden, PATH-volgorde en niet-uitvoerbare bestanden geborgd zonder login-shell.");

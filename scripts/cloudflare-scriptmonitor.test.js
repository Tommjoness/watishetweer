"use strict";

const assert=require("assert");
const {isAlleenGemeld,scheidConsoleFouten}=require("./cloudflare-scriptmonitor.js");

assert.equal(isAlleenGemeld("[Report Only] Refused to load https://watishetweer.nl/app-17b8ae474866.min.js because it does not appear in the script-src directive of the Content Security Policy."),true,"WebKit-melding van Cloudflare-scriptmonitoring telt niet als fout");
assert.equal(isAlleenGemeld("[Report Only] Refused to connect to https://api.open-meteo.com/v1/forecast because it does not appear in the connect-src directive of the Content Security Policy."),true,"ook connect-src-meldingen van de monitor");
assert.equal(isAlleenGemeld("Refused to load the script 'https://evil.example/x.js' because it violates the following Content Security Policy directive: \"script-src 'self'\". The action has been blocked."),false,"een echte, afdwingende CSP-overtreding blijft een fout");
assert.equal(isAlleenGemeld("TypeError: undefined is not an object"),false,"gewone runtimefouten blijven fouten");
assert.equal(isAlleenGemeld("Failed to load resource: the server responded with a status of 500 ()"),false,"mislukte requests blijven fouten");
assert.equal(isAlleenGemeld("Iets anders [Report Only] halverwege"),false,"alleen een melding die met [Report Only] begint telt als alleen-gemeld");
const {fouten,gemeld}=scheidConsoleFouten(["[Report Only] Refused to load a","echte fout","[Report Only] Refused to connect b"]);
assert.deepEqual(fouten,["echte fout"]);
assert.equal(gemeld.length,2);
console.log("Cloudflare-scriptmonitoring: Report-Only-meldingen apart, echte console- en CSP-fouten blijven fouten.");

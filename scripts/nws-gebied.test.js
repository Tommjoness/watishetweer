"use strict";

const assert=require("assert");
const handler=require("../lib/waarschuwingen.cjs");
const {inLengtegraadBereik,inNWS}=handler._intern||{};

assert.equal(typeof inLengtegraadBereik,"function","lengtegraadhelper moet testbaar zijn");
assert.equal(typeof inNWS,"function","NWS-gebiedsrouter moet testbaar zijn");

/* Normale intervallen blijven gewone west-oost-bereiken. */
assert.equal(inLengtegraadBereik(-150,-170,-129),true);
assert.equal(inLengtegraadBereik(-120,-170,-129),false);

/* west > oost betekent bewust: het gebied kruist ±180°. Beide kanten van de
   datumgrens horen dan bij hetzelfde interval, het midden van de wereld niet. */
assert.equal(inLengtegraadBereik(174,170,-170),true);
assert.equal(inLengtegraadBereik(-175,170,-170),true);
assert.equal(inLengtegraadBereik(0,170,-170),false);

/* De NWS heeft een expliciete Western Aleutians-zone voor Shemya en Attu. Deze
   eilanden liggen aan de positieve-lengtegraadkant van de datumgrens en vielen
   met de vroegere Alaska-box (-170..-129) buiten de routering. */
assert.equal(inNWS(52.72,174.1),true,"Shemya moet naar NWS worden gerouteerd");
assert.equal(inNWS(52.85,173.2),true,"Attu moet naar NWS worden gerouteerd");
assert.equal(inNWS(52.5,-175),true,"de westelijke Aleoeten aan de andere kant van ±180 moeten ook gedekt blijven");

/* De dateline-uitbreiding is bewust smal: hij mag geen groot stuk Rusland of
   de noordelijke Beringzee als NWS-gebied markeren. */
assert.equal(inNWS(60,175),false,"noordelijk Rusland/Beringgebied mag niet door de Aleoetenbox lekken");
assert.equal(inNWS(52.5,160),false,"ver buiten de westelijke Aleoeten mag NWS niet worden gekozen");

/* Bestaande kerngebieden blijven intact. */
assert.equal(inNWS(61.2,-149.9),true,"Anchorage/Alaska blijft NWS");
assert.equal(inNWS(40.7,-74.0),true,"CONUS blijft NWS");
assert.equal(inNWS(21.3,-157.8),true,"Hawaii blijft NWS");
assert.equal(inNWS(35.7,139.7),false,"Japan mag niet als NWS-gebied worden gezien");

console.log("NWS-gebiedsrouter: normale intervallen, datumgrens, westelijke Aleoeten en negatieve controles geslaagd.");

"use strict";

const assert=require("assert");
const handler=require("../lib/waarschuwingen.cjs");
const {inLengtegraadBereik,inNWS,isNWSLandCode}=handler._intern||{};

assert.equal(typeof inLengtegraadBereik,"function","lengtegraadhelper moet testbaar zijn");
assert.equal(typeof inNWS,"function","NWS-gebiedsrouter moet testbaar zijn");
assert.equal(typeof isNWSLandCode,"function","NWS-landgrens moet testbaar zijn");

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
assert.equal(inNWS(52.72,174.1),true,"Shemya moet geografisch NWS-kandidaat blijven");
assert.equal(inNWS(52.85,173.2),true,"Attu moet geografisch NWS-kandidaat blijven");
assert.equal(inNWS(52.5,-175),true,"de westelijke Aleoeten aan de andere kant van ±180 moeten ook gedekt blijven");

/* De dateline-uitbreiding is bewust smal: hij mag geen groot stuk Rusland of
   de noordelijke Beringzee als NWS-gebied markeren. */
assert.equal(inNWS(60,175),false,"noordelijk Rusland/Beringgebied mag niet door de Aleoetenbox lekken");
assert.equal(inNWS(52.5,160),false,"ver buiten de westelijke Aleoeten mag NWS niet worden gekozen");

/* De rechthoeken zijn alleen kandidaatfilters. De CONUS-box overlapt bewust
   landsgrenzen, dus Toronto en Monterrey kunnen geometrisch true zijn zonder
   dat NWS daar als bron mag worden gekozen. */
assert.equal(inNWS(43.6532,-79.3832),true,"Toronto illustreert overlap van de grove CONUS-box");
assert.equal(inNWS(25.6866,-100.3161),true,"Monterrey illustreert overlap van de grove CONUS-box");
assert.equal(isNWSLandCode("CA"),false,"Canada is geen NWS-landcode");
assert.equal(isNWSLandCode("MX"),false,"Mexico is geen NWS-landcode");

/* Bestaande NWS-kerngebieden en territoria blijven toegestaan. */
for(const code of ["US","PR","VI","GU","MP","AS"]){
  assert.equal(isNWSLandCode(code),true,code+" moet als NWS-land/territorium behouden blijven");
}
assert.equal(inNWS(61.2,-149.9),true,"Anchorage/Alaska blijft NWS-kandidaat");
assert.equal(inNWS(40.7,-74.0),true,"CONUS blijft NWS-kandidaat");
assert.equal(inNWS(21.3,-157.8),true,"Hawaii blijft NWS-kandidaat");
assert.equal(inNWS(35.7,139.7),false,"Japan mag niet als NWS-gebied worden gezien");

console.log("NWS-router: geometrische kandidaatfilter, datumgrens en bevestigde landcodes geslaagd.");

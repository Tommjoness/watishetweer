/* Centrale Nederlandse grammatica voor dynamische weerzinnen.
   Houdt grammatica los van kansberekening en databronnen. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.WeatherNowNederlandseGrammatica=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const schoon=soort=>String(soort||"neerslag").trim().replace(/\s+/g," ");
  const klein=soort=>schoon(soort).toLocaleLowerCase("nl-NL");
  const hoofdletter=tekst=>{tekst=String(tekst||"");return tekst?tekst.charAt(0).toLocaleUpperCase("nl-NL")+tekst.slice(1):tekst;};

  function isMeervoud(soort){
    return /(?:buien|korrels|vlokken)$/i.test(schoon(soort));
  }

  function actueleNeerslagZin(soort){
    const type=schoon(soort),typeKlein=klein(type);
    if(typeKlein==="regen")return "Het regent nu.";
    if(typeKlein==="motregen")return "Het motregent nu.";
    if(typeKlein==="sneeuw")return "Het sneeuwt nu.";
    if(typeKlein==="hagel")return "Het hagelt nu.";
    if(typeKlein==="onweer")return "Het onweert nu.";
    if(/onweersbuien$/i.test(type))return "Er zijn nu "+typeKlein+".";
    if(isMeervoud(type))return "Er vallen nu "+typeKlein+".";
    return "Er valt nu "+typeKlein+".";
  }

  function soortIsMogelijk(soort){
    const type=schoon(soort);
    return hoofdletter(type)+(isMeervoud(type)?" zijn":" is")+" mogelijk";
  }

  function soortWordtVerwacht(soort,tijdsbepaling){
    const type=schoon(soort);
    const wanneer=String(tijdsbepaling||"").trim();
    return type+(isMeervoud(type)?" worden":" wordt")+(wanneer?" "+wanneer:"")+" verwacht";
  }

  function opsomming(items){
    const delen=(Array.isArray(items)?items:[]).map(x=>String(x||"").trim()).filter(Boolean);
    if(delen.length<2)return delen[0]||"";
    if(delen.length===2)return delen[0]+" en "+delen[1];
    return delen.slice(0,-1).join(", ")+" en "+delen[delen.length-1];
  }

  function geenZichtvensterZin(redenen){
    const reden=opsomming(redenen);
    return reden?"Geen goed zichtvenster door "+reden:"Geen aaneengesloten gunstig modelvenster";
  }

  return {schoon,isMeervoud,actueleNeerslagZin,soortIsMogelijk,soortWordtVerwacht,opsomming,geenZichtvensterZin};
});

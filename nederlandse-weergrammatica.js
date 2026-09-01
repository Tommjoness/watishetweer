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
  const getal=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v))?Number(v):null;

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

  /* Eén centrale eigenaar voor dynamische tijd- en temperatuureenheden.
     Uur heeft in het Nederlands dezelfde vorm in enkel- en meervoud, maar loopt
     bewust door dezelfde formatter zodat zichtbare tekst, aria-labels en
     briefings niet ieder een eigen uitzonderingspad krijgen. */
  function eenheid(aantal,enkelvoud,meervoud){
    const n=getal(aantal);
    if(n===null)return "";
    return Math.abs(n)===1?String(enkelvoud):String(meervoud);
  }
  function getalMetEenheid(aantal,enkelvoud,meervoud){
    const n=getal(aantal);
    if(n===null)return "";
    return String(aantal)+" "+eenheid(n,enkelvoud,meervoud);
  }
  function minuten(aantal){return getalMetEenheid(aantal,"minuut","minuten");}
  function uren(aantal){return getalMetEenheid(aantal,"uur","uur");}
  function graden(aantal){return getalMetEenheid(aantal,"graad","graden");}
  function duur(urenAantal,minutenAantal){
    const u=getal(urenAantal),m=getal(minutenAantal);
    if(u===null&&m===null)return "";
    const delen=[];
    if(u!==null&&u!==0)delen.push(uren(u));
    if(m!==null&&(m!==0||!delen.length))delen.push(minuten(m));
    return delen.join(" en ");
  }
  function duurKort(urenAantal,minutenAantal){
    const u=getal(urenAantal),m=getal(minutenAantal);
    if(u===null&&m===null)return "";
    if(u!==null&&u>0)return String(u)+" u "+String(Math.max(0,m||0)).padStart(2,"0")+" min";
    return String(Math.max(0,m||0))+" min";
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

  return {schoon,isMeervoud,actueleNeerslagZin,soortIsMogelijk,soortWordtVerwacht,eenheid,getalMetEenheid,minuten,uren,graden,duur,duurKort,opsomming,geenZichtvensterZin};
});

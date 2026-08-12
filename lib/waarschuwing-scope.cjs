"use strict";

/* Servergrens voor officiële waarschuwingen.
   Een providerantwoord is pas geschikt als plaatswaarschuwing wanneer het item
   expliciet bewezen plaats-/gebiedspecifiek is. Landfeeds en toekomstige
   responses zonder zulke scope-metadata mogen nooit regionale waarschuwingen
   aan een willekeurige gekozen stad koppelen. Liever neutraal geen dekking dan
   een stellige kaart voor het verkeerde gebied. */
function alleenPlaatsgebonden(data){
  if(!data||typeof data!=="object")return data;
  const lijst=Array.isArray(data.lijst)?data.lijst:[];
  if(data.dekking!==true)return Object.assign({},data,{lijst:[]});

  const bewezen=lijst.filter(w=>w&&w.plaatsSpecifiek===true&&w.landelijk!==true);
  const bronIsNietPlaatsSpecifiek=data.plaatsSpecifiek===false;
  const bronHadAlleenOnbewezenKaarten=lijst.length>0&&bewezen.length===0;
  if(bronIsNietPlaatsSpecifiek||bronHadAlleenOnbewezenKaarten){
    return Object.assign({},data,{
      dekking:false,
      lijst:[],
      reden:"geen plaats-specifieke dekking",
      plaatsSpecifiek:false
    });
  }
  return Object.assign({},data,{lijst:bewezen});
}

module.exports={alleenPlaatsgebonden};

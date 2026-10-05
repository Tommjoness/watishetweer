"use strict";

/* Seizoenspagina's: vaste, jaarlijks terugkerende URL's met de echte
   verwachting zodra de dag binnen het verwachtingsvenster valt. Iedere pagina
   is alleen configuratie; het sjabloon en de runtime zijn gedeeld. Teksten met
   {plaatshouders} vult de runtime in. */

const {LOCATIES,BASIS_URL}=require("./seo-locations.config.js");

function plaatsroute(slug){
  const loc=LOCATIES.find(l=>l.slug===slug);
  if(!loc)throw new Error(`Seizoenspagina verwijst naar onbekende plaatsroute: ${slug}`);
  return {naam:loc.naam,lat:loc.lat,lon:loc.lon,href:`/weer/${loc.slug}/`};
}

const SEIZOENSPAGINAS=Object.freeze([
  Object.freeze({
    slug:"witte-kerst",
    naam:"Witte kerst",
    tijdzone:"Europe/Amsterdam",
    vensterDagen:7,
    ochtendUur:9,
    dagen:[{maand:12,dag:25,label:"Eerste kerstdag"},{maand:12,dag:26,label:"Tweede kerstdag"}],
    titel:"Witte kerst {jaar}: kans op sneeuw met kerst",
    beschrijving:"Wordt het een witte kerst in {jaar}? Vanaf {datum} staat hier de verwachting voor sneeuw en temperatuur op eerste en tweede kerstdag, voor De Bilt en grote plaatsen in Nederland.",
    intro:"Wordt het een witte kerst? Zeven dagen voor kerst staat hier de verwachting voor sneeuw op eerste en tweede kerstdag, voor De Bilt en zes grote plaatsen verspreid over Nederland.",
    uitleg:{
      kop:"Wanneer is het een witte kerst?",
      alineas:[
        "Er is officieel sprake van een witte kerst wanneer er in De Bilt op beide kerstdagen een gesloten sneeuwdek wordt gemeten. Sinds 1901 gebeurde dat acht keer; de laatste keer was in 2010."
      ],
      bron:{naam:"KNMI",url:"https://www.knmi.nl/over-het-knmi/nieuws/witte-kerst-steeds-zeldzamer"}
    },
    teksten:{
      ver:"De verwachting voor eerste en tweede kerstdag verschijnt hier op {datum}, zeven dagen van tevoren.",
      aftellenMeer:"Nog {n} dagen tot {dag}.",
      aftellenMorgen:"Morgen is het {dag}.",
      aftellenVandaag:"Vandaag is het {dag}.",
      allemaal:"Volgens de huidige verwachting ligt er op beide kerstdagen sneeuw in {plaats}. Blijft dat zo, dan is het officieel een witte kerst.",
      nietOp:"Volgens de huidige verwachting wordt het geen officiële witte kerst: in {plaats} ligt op {dag} geen sneeuwdek.",
      totNuToe:"Volgens de huidige verwachting ligt er op {dag} sneeuw in {plaats}. De verwachting voor {volgende} verschijnt op {datum}.",
      dagLater:"{dag}: de verwachting verschijnt op {datum}.",
      toelichting:"Sneeuwdek is de verwachte sneeuwhoogte in de ochtend. Een verwachting een week vooruit kan nog flink veranderen; deze pagina toont steeds de nieuwste. Bron: Open-Meteo.",
      fout:"De verwachting is op dit moment niet beschikbaar. Probeer het later opnieuw, of bekijk het weer voor je eigen plaats."
    },
    plaatsen:[
      {naam:"De Bilt",lat:52.0989,lon:5.1797,officieel:true},
      plaatsroute("amsterdam"),
      plaatsroute("rotterdam"),
      plaatsroute("utrecht"),
      plaatsroute("groningen"),
      plaatsroute("eindhoven"),
      plaatsroute("maastricht")
    ]
  })
]);

function seizoenUrl(pagina){return `${BASIS_URL}/${pagina.slug}/`;}

module.exports={SEIZOENSPAGINAS,seizoenUrl};
